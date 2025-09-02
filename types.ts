import type React from 'react';

export enum GameState {
    SETUP,
    PLANNING,
    PLAN_REVIEW,
    ROUND_1,
    ROUND_2,
    ROUND_3,
    SYNTHESIS,
    COMPLETE, // A single meeting is complete
    AWAITING_USER_INPUT, // Waiting for user to provide context for the next meeting
    FINAL_SYNTHESIS,
    FINAL_COMPLETE, // Final summary is generated
    ERROR
}
export interface Agent {
    id: string;
    name: string;
    persona: string;
    shortPersona: string;
    avatar: React.FC<React.SVGProps<SVGSVGElement>>;
}

export interface CrossQuestion {
    ask_expert: string;
    question: string;
}

export interface Source {
    uri: string;
    title: string;
}

export interface Round1Result {
    mainAnswer: string;
    crossQuestions: CrossQuestion[];
    sources?: Source[];
}

export interface Answer {
    question: string;
    answer: string;
}

export interface Round2Result {
    answers: Answer[];
    crossQuestions: CrossQuestion[];
    sources?: Source[];
}

export interface Round3Result {
    answers: Answer[];
}

export interface MeetingData {
    round1: Record<string, Round1Result>;
    round2: Record<string, Round2Result>;
    round3: Record<string, Round3Result>;
}

export type TranscriptItem = 
    | { type: 'system', content: string }
    | { type: 'response', agent: Agent, content: string, sources?: Source[] }
    | { type: 'question', from: Agent, to: Agent, content: string }
    | { type: 'answer', agent: Agent, content: string, sources?: Source[] };


export interface AppState {
    gameState: GameState;
    topic: string;
    selectedAgents: Agent[];
    meetingData: MeetingData;
    transcript: TranscriptItem[];
    summary: Summary | null;
    currentAgentIndex: number;
    loading: boolean;
    error: string | null;
}

export interface Summary {
    keyInsights: string[];
    actionItems: string[];
    potentialRisks: string[];
    consensusPoints: string[];
}

export interface FinalSummary {
    executiveSummary: string;
    keyDecisionsAndPivots: string[];
    finalActionPlan: string[];
    outstandingRisks: string[];
    projectConclusion: string;
}


export interface PlannedMeeting {
    goal: string;
    agentIds: string[];
    agents?: Agent[]; // Populated in the app logic
}

export interface MeetingResult {
    goal:string;
    agents: Agent[];
    transcript: TranscriptItem[];
    summary: Summary;
    duration: string;
    userFeedback?: string;
}

export interface HistoryItem {
    id: string;
    topic: string;
    date: string;
    status: 'In Progress' | 'Completed';
    meetingPlan: PlannedMeeting[] | null;
    meetingResults: MeetingResult[];
    finalSummary: FinalSummary | null;
    // For resuming in-progress meetings
    gameState?: GameState;
    currentAgentIndex?: number;
    currentMeetingData?: MeetingData;
    currentTranscript?: TranscriptItem[];
    currentMeetingStartTime?: number | null;
}

export type FeedbackState = Record<string, 'up' | 'down' | null>;