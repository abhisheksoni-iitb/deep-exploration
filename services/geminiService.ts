import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters } from "@google/genai";
import { Agent, Round1Result, Round2Result, Round3Result, Summary, Source, PlannedMeeting, MeetingResult } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Using a placeholder. The app will not function correctly without a valid API key.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "YOUR_API_KEY_HERE" });

const GEMINI_MODELS = ["gemini-2.5-flash"];

interface ApiError {
    error: {
        code: number;
        message: string;
        status: string;
    }
}

const isRateLimitError = (error: unknown): boolean => {
    if (error instanceof Error) {
        try {
            const parsed = JSON.parse(error.message) as ApiError;
            return parsed.error?.status === 'RESOURCE_EXHAUSTED';
        } catch {
            return false;
        }
    }
    return false;
}

const generateContentWithFallback = async (params: Omit<GenerateContentParameters, 'model'>): Promise<GenerateContentResponse> => {
    let lastError: unknown = new Error("No models available to try or all failed.");
    for (const model of GEMINI_MODELS) {
        try {
            const response = await ai.models.generateContent({
                ...params,
                model: model,
            });
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Model ${model} failed. Error:`, error);
            if (isRateLimitError(error)) {
                console.warn(`Rate limit exceeded for ${model}. Trying next model...`);
                continue; 
            } else {
                // For other errors (e.g. invalid API key, prompt blocked), fail immediately.
                throw error;
            }
        }
    }
    throw lastError;
};


const parseJsonResponse = <T,>(text: string, agentName: string): T => {
    try {
        // The model can sometimes wrap the JSON in ```json ... ```.
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]) as T;
        }

        // Fallback for when it's not in a code block but might have text before/after
        const firstBrace = text.indexOf('{');
        const firstBracket = text.indexOf('[');
        
        let startIndex = -1;

        if (firstBrace > -1 && firstBracket > -1) {
            startIndex = Math.min(firstBrace, firstBracket);
        } else if (firstBrace > -1) {
            startIndex = firstBrace;
        } else {
            startIndex = firstBracket;
        }

        if (startIndex === -1) {
            throw new Error("No JSON object or array found in the response string.");
        }

        const lastBrace = text.lastIndexOf('}');
        const lastBracket = text.lastIndexOf(']');

        const endIndex = Math.max(lastBrace, lastBracket);

        if (endIndex === -1 || endIndex < startIndex) {
             throw new Error("JSON object or array not properly closed.");
        }

        const jsonText = text.substring(startIndex, endIndex + 1);
        
        return JSON.parse(jsonText) as T;
    } catch (e) {
        console.error(`Failed to parse JSON from ${agentName}:`, text);
        if (e instanceof Error) {
            console.error("Parsing error:", e.message);
        }
        throw new Error(`The response from ${agentName} was not valid JSON.`);
    }
};


export const planMeetings = async (topic: string, allAgents: Agent[]): Promise<PlannedMeeting[]> => {
    const prompt = `
        You are an expert project manager. Your task is to plan a series of focused, sequential roundtable meetings to comprehensively analyze a topic. The output of one meeting should logically feed into the next.

        Topic: "${topic}"

        Available Experts (use their 'id' for selection):
        ${allAgents.map(a => `- ${a.name} (id: ${a.id})`).join('\n')}

        Key Constraints:
        1.  **Strict 3-Expert Limit Per Meeting:** Each meeting MUST have a maximum of 3 experts. This is a non-negotiable rule for ensuring focused and efficient discussions. Do not create meetings with more than 3 participants.
        2.  **Logical Sequence:** Create a logical flow of meetings. A typical project might need 2-4 meetings (e.g., 1. Strategy & Vision, 2. Technical Feasibility & Design, 3. Go-to-Market & Launch). The goal of each meeting should build upon the previous one.
        3.  **Optimal Selection:** For each meeting, select only the most critical experts needed to achieve that specific meeting's goal. Think carefully about which perspectives are needed at each stage. If more expertise is required than can fit in one meeting, create a separate, subsequent meeting.

        Your tasks:
        1.  Determine the number of meetings required (between 1 and 4).
        2.  For each meeting, provide a concise 'goal' that is a clear, actionable objective.
        3.  For each meeting, select the necessary experts by their 'id' from the provided list, adhering to the strict 3-expert limit.

        Format your entire response as a single JSON object, and nothing else. Do not include markdown formatting. The JSON object must be an array, where each element represents a meeting.
        Example format:
        [
          {
            "goal": "Define the core user problem and validate the market opportunity.",
            "agentIds": ["product", "vc", "marketing"]
          },
          {
            "goal": "Assess technical feasibility and outline the initial UX/UI flow.",
            "agentIds": ["tech", "design", "product"]
          },
          {
            "goal": "Develop a go-to-market strategy and identify key growth channels.",
            "agentIds": ["marketing", "growth", "sales"]
          }
        ]
    `;
    
    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    return parseJsonResponse<PlannedMeeting[]>(response.text, "Planning Agent");
};

export const runRoundForAgent = async (
    agent: Agent,
    topic: string,
    otherAgents: Agent[],
    meetingContext?: { meetingGoal: string; previousMeetingSummary?: Summary }
): Promise<Round1Result> => {
    
    const contextPrompt = meetingContext?.previousMeetingSummary ? `
        This is a follow-up meeting.
        The goal of this specific meeting is: "${meetingContext.meetingGoal}".
        Context from the previous meeting's summary:
        - Key Insights: ${meetingContext.previousMeetingSummary.keyInsights.join('; ')}
        - Action Items: ${meetingContext.previousMeetingSummary.actionItems.join('; ')}
        - Potential Risks: ${meetingContext.previousMeetingSummary.potentialRisks.join('; ')}
        - Consensus Points: ${meetingContext.previousMeetingSummary.consensusPoints.join('; ')}
    ` : `This is the first meeting on this topic. The goal of this meeting is: "${meetingContext?.meetingGoal}"`;

    const prompt = `
        Overall Topic: "${topic}"

        ${contextPrompt}

        Your Role: ${agent.persona}

        You are in Round 1 of a roundtable discussion with other experts for THIS meeting: ${otherAgents.map(a => a.name).join(', ')}.
        
        Use your access to Google Search to find the latest information, data, and trends to inform your answer.

        Your tasks:
        1.  **Main Answer:** Provide your primary expert analysis on the topic, keeping this meeting's specific goal in mind. Be concise, using bullet points if helpful (max 100 words).
        2.  **Cross-Questions:** Raise a maximum of 2 brief, insightful questions for up to 2 other specific experts from the list for this meeting. Your questions should challenge their perspective or ask for clarification based on this meeting's goal.

        Format your entire response as a single JSON object, and nothing else. Do not include markdown formatting like \`\`\`json. The JSON object must look like this:
        {
          "mainAnswer": "Your concise analysis here.",
          "crossQuestions": [
            { "ask_expert": "Expert Name", "question": "Your question for them." },
            { "ask_expert": "Another Expert Name", "question": "Your second question." }
          ]
        }
    `;

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        }
    });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: Source[] = groundingChunks
        .map(chunk => chunk.web)
        .filter((web): web is { uri: string; title: string } => !!(web?.uri && web.title));


    const result = parseJsonResponse<Omit<Round1Result, 'sources'>>(response.text, agent.name);
    return { ...result, sources };
};

export const runFollowUpForAgent = async (
    agent: Agent,
    topic: string,
    questionsForAgent: string[],
    otherAgents: Agent[]
): Promise<Round2Result> => {
    const prompt = `
        Topic: "${topic}"

        Your Role: ${agent.persona}

        You are in Round 2 of a roundtable discussion with other experts: ${otherAgents.map(a => a.name).join(', ')}. In Round 1, other experts asked you the following questions:
        ${questionsForAgent.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

        Use your access to Google Search to find the latest information, data, and trends to inform your answers.

        Your tasks:
        1. **Answer Questions:** Provide concise, direct answers to each of these questions.
        2. **Raise Follow-up Questions:** Based on the discussion so far and the questions you just answered, raise a maximum of 2 new, brief follow-up questions for up to 2 other experts to deepen the conversation.

        Format your entire response as a single JSON object, and nothing else. Do not include markdown formatting. The JSON object must look like this:
        {
          "answers": [
            { "question": "The first question you were asked.", "answer": "Your answer to it." }
          ],
          "crossQuestions": [
            { "ask_expert": "Expert Name", "question": "Your new follow-up question." }
          ]
        }
    `;

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: Source[] = groundingChunks
        .map(chunk => chunk.web)
        .filter((web): web is { uri: string; title: string } => !!(web?.uri && web.title));
        
    const result = parseJsonResponse<Omit<Round2Result, 'sources'>>(response.text, agent.name);
    return { ...result, sources };
};

export const runRound3ForAgent = async (
    agent: Agent,
    topic: string,
    questionsForAgent: string[]
): Promise<Round3Result> => {
    const prompt = `
        Topic: "${topic}"

        Your Role: ${agent.persona}

        You are in the FINAL round (Round 3) of a roundtable discussion. This is the last chance for clarification. In Round 2, other experts asked you the following follow-up questions:
        ${questionsForAgent.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

        Your task is to provide concise, final answers to each of these questions. Do NOT ask any new questions.

        Format your entire response as a single JSON object, and nothing else. Do not include markdown formatting. The JSON object must look like this:
        {
          "answers": [
            { "question": "The first question you were asked.", "answer": "Your final answer to it." },
            { "question": "The second question you were asked.", "answer": "Your final answer." }
          ]
        }
    `;

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    return parseJsonResponse<Round3Result>(response.text, agent.name);
};


export const synthesizeTranscript = async (
    topic: string,
    agents: Agent[],
    transcript: string
): Promise<Summary> => {
    const prompt = `
        Analyze the following roundtable meeting transcript.
        The goal was to discuss: "${topic}"
        The participants were: ${agents.map(a => a.name).join(', ')}

        Transcript:
        ---
        ${transcript}
        ---

        Based on the entire discussion, generate a comprehensive summary. Your summary should be structured as a JSON object with the following keys: "keyInsights", "actionItems", "potentialRisks", and "consensusPoints". Each key should have an array of strings as its value.

        Format your entire response as a single JSON object, and nothing else. Do not include markdown formatting like \`\`\`json.
    `;

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    return parseJsonResponse<Summary>(response.text, "Synthesis Agent");
};

export const synthesizeSeries = async (
    topic: string,
    meetingResults: MeetingResult[]
): Promise<{finalSummary: string}> => {
    const prompt = `
        You are a senior executive analyzing the outcomes of a series of meetings about a project.

        Project Topic: "${topic}"

        The project progressed through several meetings, each with its own summary. Here are the summaries in chronological order:
        ${meetingResults.map((result, index) => `
        ---
        Meeting ${index + 1}: ${result.goal}
        Summary:
        - Key Insights: ${result.summary.keyInsights.join('; ')}
        - Action Items: ${result.summary.actionItems.join('; ')}
        - Potential Risks: ${result.summary.potentialRisks.join('; ')}
        - Consensus Points: ${result.summary.consensusPoints.join('; ')}
        ---
        `).join('\n')}

        Your task is to synthesize all these summaries into a single, high-level final report for the board. This report should summarize the project's journey and final conclusion. It should be a concise paragraph (max 200 words) that captures the most critical outcomes, decisions, and next steps.

        Format your response as a single JSON object with one key, "finalSummary".
        Example:
        {
            "finalSummary": "The project to build a Gen-Z social app began with strong market validation but faced significant technical hurdles. The final plan involves a phased rollout, focusing initially on core chat features, with a revised, more targeted marketing strategy. The primary risk remains user acquisition cost, which will be closely monitored post-launch."
        }
    `;

     const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    return parseJsonResponse<{finalSummary: string}>(response.text, "Final Synthesis Agent");
}