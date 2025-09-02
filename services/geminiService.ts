import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters } from "@google/genai";
import { Agent, Round1Result, Round2Result, Round3Result, Summary, Source, PlannedMeeting, MeetingResult, FinalSummary, TranscriptItem } from '../types';

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
    let jsonText = text;

    // The model can sometimes wrap the JSON in ```json ... ```.
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1];
    }

    // Fallback for when it's not in a code block but might have text before/after
    const firstBrace = jsonText.indexOf('{');
    const firstBracket = jsonText.indexOf('[');
    
    let startIndex = -1;

    if (firstBrace > -1 && firstBracket > -1) {
        startIndex = Math.min(firstBrace, firstBracket);
    } else if (firstBrace > -1) {
        startIndex = firstBrace;
    } else {
        startIndex = firstBracket;
    }

    if (startIndex === -1) {
        throw new Error(`No JSON object or array found in the response from ${agentName}.`);
    }

    const lastBrace = jsonText.lastIndexOf('}');
    const lastBracket = jsonText.lastIndexOf(']');
    const endIndex = Math.max(lastBrace, lastBracket);

    if (endIndex === -1 || endIndex < startIndex) {
         throw new Error(`JSON object or array not properly closed in the response from ${agentName}.`);
    }

    jsonText = jsonText.substring(startIndex, endIndex + 1);

    try {
        // First attempt to parse the extracted text
        return JSON.parse(jsonText) as T;
    } catch (e1) {
        console.warn(`Initial JSON parse for '${agentName}' failed. Attempting to fix common LLM errors. Error: ${(e1 as Error).message}`);
        
        try {
            // Fix 1: Replace all newline characters with a space. This is safer than trying to escape them,
            // as it won't corrupt the JSON structure if the model uses newlines for formatting.
            // This might cause loss of formatting in the final text, but it ensures parsability.
            let fixedJson = jsonText.replace(/(\r\n|\n|\r)/gm, " ");

            // Fix 2: Trailing commas in objects and arrays.
            fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1');

            return JSON.parse(fixedJson) as T;
        } catch (e2) {
            console.error(`Failed to parse JSON from ${agentName} even after cleaning.`);
            console.error('Original Text:', text);
            if (e1 instanceof Error) {
                console.error("Original parsing error:", e1.message);
            }
            if (e2 instanceof Error) {
                console.error("Second parsing error:", e2.message);
            }
            // Re-throw the original error to be caught by the UI handler.
            throw new Error(`The response from ${agentName} was not valid JSON, even after attempting to fix it.`);
        }
    }
};

const JSON_FORMATTING_INSTRUCTION = `CRITICAL FORMATTING RULE: Your entire response must be ONLY a single, raw, valid JSON object. Do not add any text, markdown, or formatting before or after the JSON. In all string values, you MUST correctly escape all special characters. Specifically, any double quote (") inside a string must be written as \\", and any newline character must be written as \\n.

CORRECT EXAMPLE for a string value:
{ "key": "This is a string with \\"quotes\\" and a\\nnew line." }

INCORRECT EXAMPLE:
{ "key": "This string has "unescaped" quotes and a
new line." }

Your JSON must be perfectly parsable by a standard JSON parser. Do not wrap the JSON in markdown like \`\`\`json ... \`\`\`.`;


export const planMeetings = async (topic: string, allAgents: Agent[]): Promise<PlannedMeeting[]> => {
    const prompt = `
        You are an expert project manager and strategist. Your task is to devise a logical and efficient series of meetings to analyze a project from inception to a go-to-market plan.

        Topic: "${topic}"

        Available Experts (use their 'id' for selection):
        ${allAgents.map(a => `- ${a.name} (id: ${a.id}) - Core function: ${a.shortPersona}`).join('\n')}

        Your goal is to create a project plan as a series of meetings. Follow these rules strictly:
        1.  **Project Lifecycle Flow:** The meetings must follow a logical project lifecycle. Start with strategy and validation, then move to feasibility and design, and finally cover execution and go-to-market.
        2.  **Strict 3-Expert Limit Per Meeting:** Each meeting MUST have exactly 3 experts. No more, no less. This is a critical constraint for focus.
        3.  **Optimal Expert Selection:** For each meeting's goal, select the three most critical experts. For example, a "Strategy & Market Validation" meeting should involve roles like Product Manager, VC, and Marketing Lead. A "Technical Feasibility" meeting needs the Tech Lead, UX/UI Designer, and maybe a Risk Analyst or Legal Counsel if there are specific concerns. Do not bring in execution-focused roles (like Sales or Support) into early strategy meetings.
        4.  **Actionable Goals:** Each meeting must have a concise, actionable 'goal'.
        5.  **Number of Meetings:** Plan for 2 to 4 meetings in total.

        ${JSON_FORMATTING_INSTRUCTION}

        Example of a good, logical plan:
        [
          {
            "goal": "Define the product vision, validate the market opportunity, and assess the business case.",
            "agentIds": ["product", "vc", "marketing"]
          },
          {
            "goal": "Determine technical feasibility, design the core user experience, and identify legal risks.",
            "agentIds": ["tech", "design", "legal"]
          },
          {
            "goal": "Develop the go-to-market strategy, financial projections, and operational plan.",
            "agentIds": ["growth", "finance", "operations"]
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
    meetingContext?: { 
        meetingGoal: string; 
        previousMeetingSummary?: Summary;
        userContext?: string;
    }
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

    const userContextPrompt = meetingContext?.userContext ? `
        IMPORTANT: You must also consider the following feedback and direction from the user, which was provided after the previous meeting concluded. This is a critical instruction to guide your response.
        --- USER DIRECTION ---
        ${meetingContext.userContext}
        --- END USER DIRECTION ---
    ` : '';

    const prompt = `
        Overall Topic: "${topic}"

        ${contextPrompt}

        ${userContextPrompt}

        Your Role: ${agent.persona}

        You are in Round 1 of a roundtable discussion with other experts for THIS meeting: ${otherAgents.map(a => a.name).join(', ')}.
        
        Use your access to Google Search to find the latest information, data, and trends to inform your answer.

        Your tasks:
        1.  **In-Depth Analysis:** Provide your primary expert analysis on the topic, adhering strictly to the specific deliverables and mindset outlined in your persona. Your answer should be detailed, insightful, and directly address the meeting's goal. Support your points with specific data, real-world examples, or the frameworks mentioned in your persona. Avoid generic statements. Aim for a comprehensive and actionable response.
        2.  **Cross-Questions:** Raise a maximum of 2 brief, insightful questions for up to 2 other specific experts in this meeting. Your questions should challenge their perspective or ask for clarification based on this meeting's goal.

        ${JSON_FORMATTING_INSTRUCTION}

        The JSON object must have this exact structure. Do not add or remove keys.
        {
          "mainAnswer": "Your comprehensive and detailed analysis here. Remember to escape characters correctly, like this: \\"quoted text\\" and newlines like this.\\nAnother line.",
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


    const parsed = parseJsonResponse<Partial<Omit<Round1Result, 'sources'>>>(response.text, agent.name);
    const result: Round1Result = {
        mainAnswer: parsed.mainAnswer || '',
        crossQuestions: parsed.crossQuestions || [],
        sources,
    };
    return result;
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
        1. **Answer Questions:** Provide concise, direct answers to each of these questions based on your persona.
        2. **Raise Follow-up Questions:** Based on the discussion so far, raise a maximum of 2 new, brief follow-up questions for up to 2 other experts to deepen the conversation.

        ${JSON_FORMATTING_INSTRUCTION}

        The JSON object must have this exact structure. Do not add or remove keys.
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
        
    const parsed = parseJsonResponse<Partial<Omit<Round2Result, 'sources'>>>(response.text, agent.name);
    const result: Round2Result = {
        answers: parsed.answers || [],
        crossQuestions: parsed.crossQuestions || [],
        sources,
    };
    return result;
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

        ${JSON_FORMATTING_INSTRUCTION}
        
        The JSON object must have this exact structure. Do not add or remove keys.
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

    const parsed = parseJsonResponse<Partial<Round3Result>>(response.text, agent.name);
    const result: Round3Result = {
        answers: parsed.answers || [],
    };
    return result;
};


export const synthesizeTranscript = async (
    topic: string,
    agents: Agent[],
    transcript: TranscriptItem[]
): Promise<Summary> => {
    // Optimization: Condense the transcript to only include the most important parts (main answers and final answers)
    // to reduce token count for the summary generation.
    const condensedTranscript = transcript
        .filter(item => item.type === 'response' || item.type === 'answer')
        .map(item => {
            if (item.type === 'response') {
                return `[${item.agent.name}'s Main Answer]: ${item.content}`;
            }
            if (item.type === 'answer') {
                 return `[${item.agent.name}'s Answer]: ${item.content}`;
            }
            return '';
        })
        .join('\n\n');
        
    const prompt = `
        You are an expert meeting facilitator. Analyze the following condensed roundtable meeting transcript.
        The goal of this meeting was to discuss: "${topic}"
        The participants were: ${agents.map(a => a.name).join(', ')}

        Condensed Transcript:
        ---
        ${condensedTranscript}
        ---

        Based on the entire discussion, generate a comprehensive summary. Your summary must be structured as a JSON object with the following keys: "keyInsights", "actionItems", "potentialRisks", and "consensusPoints". Each key must have an array of strings as its value. Ensure each point is concise and actionable.

        ${JSON_FORMATTING_INSTRUCTION}
    `;

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    const parsed = parseJsonResponse<Partial<Summary>>(response.text, "Synthesis Agent");
    const result: Summary = {
        keyInsights: parsed.keyInsights || [],
        actionItems: parsed.actionItems || [],
        potentialRisks: parsed.potentialRisks || [],
        consensusPoints: parsed.consensusPoints || [],
    };
    return result;
};

export const synthesizeSeries = async (
    topic: string,
    meetingResults: MeetingResult[]
): Promise<{finalSummary: FinalSummary}> => {
    const prompt = `
        You are a Chief of Staff responsible for creating a final executive report for a project. You have been given the summaries from a series of meetings.

        Project Topic: "${topic}"

        Here are the meeting summaries in chronological order:
        ${meetingResults.map((result, index) => `
        ---
        Meeting ${index + 1} (Goal: ${result.goal})
        - Key Insights: ${result.summary.keyInsights.join('; ')}
        - Action Items: ${result.summary.actionItems.join('; ')}
        - Potential Risks: ${result.summary.potentialRisks.join('; ')}
        - Consensus Points: ${result.summary.consensusPoints.join('; ')}
        ---
        `).join('\n')}

        Your task is to synthesize all of the above information into a single, structured Final Project Report. Do not just repeat the inputs; analyze and consolidate them into a coherent final assessment.

        ${JSON_FORMATTING_INSTRUCTION}

        Your response must be a JSON object with the following structure:
        {
          "executiveSummary": "A concise, high-level paragraph (3-4 sentences) summarizing the project's journey from concept to conclusion, and the final recommendation.",
          "keyDecisionsAndPivots": [
            "A bulleted list of the most critical decisions made or strategic pivots that occurred during the meetings."
          ],
          "finalActionPlan": [
            "A consolidated, prioritized list of the most important, actionable next steps for the project to move forward."
          ],
          "outstandingRisks": [
            "A bulleted list of the most significant risks that remain unresolved or require ongoing monitoring."
          ],
          "projectConclusion": "A clear, one-sentence final recommendation for the project (e.g., 'Proceed with funding and begin MVP development.', 'Conduct further market research before committing resources.', 'Shelve the project due to significant market risks.')."
        }
    `;

     const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    const parsed = parseJsonResponse<Partial<FinalSummary>>(response.text, "Final Synthesis Agent");
    const result: FinalSummary = {
        executiveSummary: parsed.executiveSummary || "No summary was generated.",
        keyDecisionsAndPivots: parsed.keyDecisionsAndPivots || [],
        finalActionPlan: parsed.finalActionPlan || [],
        outstandingRisks: parsed.outstandingRisks || [],
        projectConclusion: parsed.projectConclusion || "No conclusion was reached."
    };
    return { finalSummary: result };
}