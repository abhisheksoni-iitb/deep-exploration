import React, { useState, useEffect, useCallback } from 'react';
import { Agent, TranscriptItem, Summary, HistoryItem, PlannedMeeting, MeetingResult, FeedbackState, GameState, FinalSummary } from './types';
import { ALL_AGENTS } from './constants';
import { 
    planMeetings, 
    runMeetingTurn, 
    synthesizeFinalReport, 
    addUserInput, 
    getProjectHistory,
    saveAgentFeedback,
    getCurrentProject
} from './src/services/supabaseService';
import SetupScreen from './components/SetupScreen';
import PlanReviewScreen from './components/PlanReviewScreen';
import RoundtableMatrix from './components/RoundtableMatrix';
import TranscriptLog from './components/TranscriptLog';
import SummaryDisplay from './components/SummaryDisplay';
import Spinner from './components/Spinner';
import TurnIndicator from './components/TurnIndicator';
import HistoryViewer from './components/HistoryViewer';
import DownloadIcon from './components/icons/DownloadIcon';
import UserGroupIcon from './components/icons/UserGroupIcon';
import ClipboardIcon from './components/icons/ClipboardIcon';
import LightbulbIcon from './components/icons/LightbulbIcon';
import ShieldExclamationIcon from './components/icons/ShieldExclamationIcon';


// Helper Icon components to avoid creating new files
const ThumbsUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11.134 1.034a1.25 1.25 0 0 1 .832.57L13.5 4.25h2.75a1.25 1.25 0 0 1 1.25 1.25v6.25a1.25 1.25 0 0 1-1.25 1.25H15v2.5a1.25 1.25 0 1 1-2.5 0v-2.5h-2.5a1.25 1.25 0 0 1-1.25-1.25v-2.842a1.25 1.25 0 0 1 .046-.307Z" />
    </svg>
);

const ThumbsDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path d="M18.75 10h.25a1.25 1.25 0 0 1 0 2.5h-.25v-2.5ZM17.5 10v2.5h-2.5a1.25 1.25 0 0 0-1.25 1.25v2.842a1.25 1.25 0 0 0-.046.307l-.736 3.684a1.25 1.25 0 0 0 .832.57l1.536.384h2.75a1.25 1.25 0 0 0 1.25-1.25v-6.25a1.25 1.25 0 0 0-1.25-1.25H15V7.5a1.25 1.25 0 1 0-2.5 0v2.5h-1.25a1.25 1.25 0 0 0 0 2.5h1.25v-2.5Z" transform="rotate(180 10 10)" />
        <path d="M1 11.75a1.25 1.25 0 1 0 2.5 0v-7.5a1.25 1.25 0 1 0-2.5 0v7.5Z" />
    </svg>
);

const ChatBubbleLeftRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72 3.72a1.125 1.125 0 0 1-1.59 0l-3.72-3.72a2.122 2.122 0 0 1-1.98-2.193v-4.286c0-.97.616-1.813 1.5-2.097m6.75 0a4.498 4.498 0 0 0-6.75 0M3.75 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72 3.72a1.125 1.125 0 0 1-1.59 0L.39 17.087a2.122 2.122 0 0 1-1.98-2.193v-4.286c0-.97.616-1.813 1.5-2.097m6.75 0a4.498 4.498 0 0 0-6.75 0" />
    </svg>
);

// Feedback component defined inline to avoid creating new files
interface AgentFeedbackProps {
  agents: Agent[];
  feedback: FeedbackState;
  onFeedback: (agentId: string, vote: 'up' | 'down') => void;
}
const AgentFeedback: React.FC<AgentFeedbackProps> = ({ agents, feedback, onFeedback }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-xl font-bold text-indigo-300 mb-4">Rate Agent Contributions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map(agent => (
                    <div key={agent.id} className="bg-gray-900/50 p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <agent.avatar className="w-10 h-10 flex-shrink-0" />
                            <span className="font-semibold text-gray-200">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onFeedback(agent.id, 'up')}
                                className={`p-2 rounded-full transition-colors ${feedback[agent.id] === 'up' ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-green-700 text-gray-400'}`}
                                aria-label={`Thumbs up for ${agent.name}`}
                            >
                                <ThumbsUpIcon className="w-5 h-5" />
                            </button>
                             <button
                                onClick={() => onFeedback(agent.id, 'down')}
                                className={`p-2 rounded-full transition-colors ${feedback[agent.id] === 'down' ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-red-700 text-gray-400'}`}
                                aria-label={`Thumbs down for ${agent.name}`}
                            >
                                <ThumbsDownIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface UserInputPromptProps {
    onContinue: (userInput: string) => void;
}

const UserInputPrompt: React.FC<UserInputPromptProps> = ({ onContinue }) => {
    const [input, setInput] = useState('');

    const handleSubmit = () => {
        onContinue(input);
    };

    return (
        <div className="mt-8 bg-gray-800 p-6 rounded-lg border-2 border-dashed border-indigo-500/50">
            <h3 className="text-xl font-bold text-indigo-300 mb-3 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-6 h-6"/>
                Provide Direction for the Next Meeting
            </h3>
            <p className="text-gray-400 mb-4 text-sm">
                Your feedback will be provided as additional context to the agents in the next discussion. You can guide the conversation, ask for specific areas of focus, or challenge previous assumptions. Leave blank to proceed without adding context.
            </p>
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., 'Focus more on the direct-to-consumer marketing channels. I'm also concerned about the proposed tech stack's scalability; please address that.'"
                className="w-full h-28 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-gray-200 focus:ring-2 focus:ring-indigo-500 transition"
                aria-label="Your input for the next meeting"
            />
            <div className="text-right mt-4">
                <button
                    onClick={handleSubmit}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                >
                    Continue to Next Meeting
                </button>
            </div>
        </div>
    );
};

// Final Summary Display component defined inline
const FinalSummaryDisplay: React.FC<{ summary: FinalSummary }> = ({ summary }) => {
    const sections = [
        { title: 'Key Decisions & Pivots', items: summary.keyDecisionsAndPivots, icon: <LightbulbIcon className="w-6 h-6 text-yellow-400" />, color: 'border-yellow-500' },
        { title: 'Final Action Plan', items: summary.finalActionPlan, icon: <ClipboardIcon className="w-6 h-6 text-blue-400" />, color: 'border-blue-500' },
        { title: 'Outstanding Risks', items: summary.outstandingRisks, icon: <ShieldExclamationIcon className="w-6 h-6 text-red-400" />, color: 'border-red-500' },
    ];

    return (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-green-400 mb-4">Final Project Report</h2>
                <div className="bg-gray-900/50 p-4 rounded-md">
                    <h3 className="font-semibold text-lg text-indigo-300 mb-2">Executive Summary</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{summary.executiveSummary}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map(section => (
                    <div key={section.title} className={`bg-gray-900/50 p-4 rounded-lg border-l-4 ${section.color}`}>
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                            {section.icon}
                            <span className="ml-2">{section.title}</span>
                        </h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-300 text-sm">
                            {section.items.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
             <div className="bg-gray-900/50 p-4 rounded-md border-t-2 border-green-500">
                <h3 className="font-semibold text-lg text-indigo-300 mb-2">Project Conclusion</h3>
                <p className="text-gray-200 font-medium whitespace-pre-wrap">{summary.projectConclusion}</p>
            </div>
        </div>
    );
};


const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
};

/**
 * Rehydrates agent data in a history item loaded from localStorage.
 * JSON.stringify removes function components (like avatars), so this function
 * restores them by looking up the agent by ID from the master ALL_AGENTS list.
 * This prevents crashes when trying to render an avatar from a stored agent object.
 */
const rehydrateAgentData = (item: HistoryItem): HistoryItem => {
    // Helper to repopulate agent objects in a transcript array
    const populateTranscript = (transcript: TranscriptItem[] | undefined): TranscriptItem[] | undefined => {
        if (!transcript) return undefined;
        return transcript.map(t => {
            const newItem = { ...t }; 
            if ('agent' in newItem && newItem.agent) {
                const fullAgent = ALL_AGENTS.find(a => a.id === newItem.agent.id);
                if (fullAgent) newItem.agent = fullAgent;
            }
            if ('from' in newItem && newItem.from) {
                const fullFromAgent = ALL_AGENTS.find(a => a.id === newItem.from.id);
                if (fullFromAgent) newItem.from = fullFromAgent;
            }
            if ('to' in newItem && newItem.to) {
                const fullToAgent = ALL_AGENTS.find(a => a.id === newItem.to.id);
                if (fullToAgent) newItem.to = fullToAgent;
            }
            return newItem;
        });
    };

    // Rehydrate the meeting plan
    const rehydratedPlan = item.meetingPlan?.map(meeting => ({
        ...meeting,
        agents: meeting.agentIds.map(id => ALL_AGENTS.find(a => a.id === id)).filter((a): a is Agent => !!a)
    })) || null;

    // Rehydrate the meeting results (which also contain transcripts)
    const rehydratedResults = item.meetingResults.map(result => ({
        ...result,
        agents: result.agents.map(agent => ALL_AGENTS.find(a => a.id === agent.id) || agent),
        transcript: populateTranscript(result.transcript) || []
    }));

    // Rehydrate the transcript for an in-progress meeting
    const rehydratedCurrentTranscript = populateTranscript(item.currentTranscript);

    // Return a new history item object with all agent data rehydrated
    return {
        ...item,
        meetingPlan: rehydratedPlan,
        meetingResults: rehydratedResults,
        currentTranscript: rehydratedCurrentTranscript,
    };
};

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [viewingHistoryItem, setViewingHistoryItem] = useState<HistoryItem | null>(null);

    // Current project state
    const [currentProject, setCurrentProject] = useState<any>(null);
    const [currentMeeting, setCurrentMeeting] = useState<any>(null);
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
    const [meetingPlan, setMeetingPlan] = useState<PlannedMeeting[] | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState>({});
    
    const handleReset = () => {
        setGameState(GameState.SETUP);
        setCurrentProject(null);
        setCurrentMeeting(null);
        setTranscript([]);
        setAgents([]);
        setSummary(null);
        setFinalSummary(null);
        setMeetingPlan(null);
        setLoading(false);
        setErrorMessage('');
        setFeedback({});
    };

    const handleError = (message: string, error?: unknown) => {
        console.error(message, error);
        let specificMessage = message;
        if (error instanceof Error) {
            try {
                // Check if the error message is a JSON string from the API
                const errorJson = JSON.parse(error.message);
                if (errorJson.error && errorJson.error.message) {
                    specificMessage = `API Error: ${errorJson.error.message}`;
                } else {
                    specificMessage = error.message;
                }
            } catch (e) {
                // Not a JSON error message, use the original message with some common cases
                if (error.message.includes('API key not valid')) {
                    specificMessage = 'Your API key is invalid. Please check your configuration.';
                } else if (error.message.toLowerCase().includes('fetch')) {
                    specificMessage = 'A network error occurred. Please check your connection.';
                } else {
                     specificMessage = error.message;
                }
            }
        }
        setErrorMessage(specificMessage);
        setLoading(false);
    };

    const handlePlanMeetings = async (topic: string) => {
        setGameState(GameState.PLANNING);
        setErrorMessage('');
        setLoading(true);
        try {
            const response = await planMeetings(topic);
            setCurrentProject({ id: response.project_id, topic });
            setMeetingPlan(response.meeting_plan);
            setGameState(GameState.PLAN_REVIEW);
        } catch (error) {
            handleError('Failed to generate a meeting plan.', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewHistory = (item: HistoryItem) => {
        setViewingHistoryItem(item);
    };

    const handleResumeFromHistory = async (item: HistoryItem) => {
        // For now, we'll just load the topic and start fresh
        // In a full implementation, you'd restore the exact state
        setViewingHistoryItem(null);
        // You could implement full state restoration here
        handleError("Resume functionality will be implemented in the next phase.");
    };

    const startMeetingSeries = async () => {
        if (!currentProject) return;
        
        setGameState(GameState.ROUND_1);
        setLoading(true);
        setErrorMessage('');
        
        try {
            await runNextMeetingTurn();
        } catch (error) {
            handleError('Failed to start meeting series.', error);
        }
    };
    
    const runNextMeetingTurn = async () => {
        if (!currentProject) return;
        
        setLoading(true);
        setErrorMessage('');

        try {
            const response = await runMeetingTurn(currentProject.id);
            
            switch (response.action) {
                case 'meeting_started':
                    setCurrentMeeting(response.meeting);
                    setGameState(GameState.ROUND_1);
                    // Get agents for this meeting
                    if (response.meeting && meetingPlan) {
                        const meetingAgents = meetingPlan[response.meeting.meeting_index]?.agents || [];
                        setAgents(meetingAgents);
                    }
                    break;
                    
                case 'turn_completed':
                    // Update transcript with new items
                    if (response.transcript) {
                        const transformedTranscript = response.transcript.map(item => ({
                            type: item.type,
                            content: item.content,
                            agent: item.agent_id ? ALL_AGENTS.find(a => a.id === item.agent_id) : undefined,
                            from: item.from_agent ? ALL_AGENTS.find(a => a.id === item.from_agent) : undefined,
                            to: item.to_agent ? ALL_AGENTS.find(a => a.id === item.to_agent) : undefined,
                            sources: item.sources
                        }));
                        setTranscript(transformedTranscript);
                    }
                    break;
                    
                case 'meeting_completed':
                    setSummary(response.meeting?.summary);
                    setGameState(GameState.COMPLETE);
                    break;
                    
                case 'final_synthesis_needed':
                    setGameState(GameState.FINAL_SYNTHESIS);
                    break;
                    
                case 'project_complete':
                    setGameState(GameState.FINAL_COMPLETE);
                    setFinalSummary(response.project?.final_summary);
                    break;
            }
        } catch (error) {
            handleError('Failed to run meeting turn.', error);
        } finally {
            setLoading(false);
        }
    };

    const transcriptToMarkdown = (transcriptItems: TranscriptItem[]): string => {
        return transcriptItems.map(item => {
            switch (item.type) {
                case 'system':
                    return `\n*--- ${item.content} ---*\n`;
                case 'response':
                    let responseMd = `**${item.agent.name}:** ${item.content}`;
                    if (item.sources && item.sources.length > 0) {
                        responseMd += `\n\n    **Sources:**\n${item.sources.map(s => `    - [${s.title}](${s.uri})`).join('\n')}`;
                    }
                    return responseMd;
                case 'question':
                    return `> **${item.from.name} asks ${item.to.name}:** ${item.content}`;
                case 'answer':
                     let answerMd = `**${item.agent.name} answers:** ${item.content}`;
                     if (item.sources && item.sources.length > 0) {
                        answerMd += `\n\n    **Sources:**\n${item.sources.map(s => `    - [${s.title}](${s.uri})`).join('\n')}`;
                    }
                    return answerMd;
                default:
                    return '';
            }
        }).join('\n\n');
    };

    const handleDownloadTranscript = () => {
        const markdownContent = transcriptToMarkdown(transcript);
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roundtable-transcript-${new Date().toISOString()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFeedback = async (agentId: string, vote: 'up' | 'down') => {
        setFeedback(prev => ({...prev, [agentId]: prev[agentId] === vote ? null : vote }));
        
        if (currentMeeting) {
            try {
                await saveAgentFeedback(currentMeeting.id, agentId, vote);
            } catch (error) {
                console.error('Failed to save feedback:', error);
            }
        }
    };

    const handleContinueToNextMeeting = async (userInput: string) => {
        if (!currentMeeting) return;
        
        try {
            await addUserInput(currentMeeting.id, userInput);
            setGameState(GameState.ROUND_1);
            await runNextMeetingTurn();
        } catch (error) {
            handleError('Failed to continue to next meeting.', error);
        }
    };
    
    const handleGenerateFinalReport = async () => {
        if (!currentProject) return;
        
        setLoading(true);
        try {
            const response = await synthesizeFinalReport(currentProject.id);
            setFinalSummary(response.finalSummary);
            setGameState(GameState.FINAL_COMPLETE);
        } catch (error) {
            handleError('Failed to generate final report.', error);
        } finally {
            setLoading(false);
        }
    };
    
    // Auto-advance meeting turns
    useEffect(() => {
        if (gameState === GameState.ROUND_1 && !loading && !errorMessage && currentProject) {
            const timer = setTimeout(() => runNextMeetingTurn(), 2000);
            return () => clearTimeout(timer);
        }
    }, [gameState, loading, errorMessage, currentProject]);
    
    // Auto-transition to user input after meeting completion
    useEffect(() => {
        if (gameState === GameState.COMPLETE && meetingPlan && currentMeeting) {
            const isLastMeeting = currentMeeting.meeting_index === meetingPlan.length - 1;
            if (!isLastMeeting) {
                const timer = setTimeout(() => setGameState(GameState.AWAITING_USER_INPUT), 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [gameState, meetingPlan, currentMeeting]);
    
    // Continue meeting turns automatically
    const continueNextTurn = useCallback(() => {
        if (gameState === GameState.ROUND_1 && !loading && !errorMessage) {
            runNextMeetingTurn();
        }
    }, [gameState, loading, errorMessage]);
    
    useEffect(() => {
        if (gameState === GameState.ROUND_1 && !loading && !errorMessage) {
            const timer = setTimeout(continueNextTurn, 1500);
            return () => clearTimeout(timer);
        }
    }, [continueNextTurn]);
    
    // Auto-run next turn for ongoing meetings
    useEffect(() => {
        const shouldContinue = gameState >= GameState.ROUND_1 && 
                              gameState < GameState.COMPLETE && 
                              !loading && 
                              !errorMessage && 
                              currentProject;
                              
        if (shouldContinue) {
            const timer = setTimeout(() => runNextMeetingTurn(), 1000);
            return () => clearTimeout(timer);
        }
    }, [transcript, gameState, loading, errorMessage, currentProject]);
    
    if (viewingHistoryItem) {
        return <HistoryViewer item={viewingHistoryItem} onClose={() => setViewingHistoryItem(null)} />;
    }

    const renderMainContent = () => {
        if (gameState === GameState.SETUP) {
            return <SetupScreen onPlanMeetings={handlePlanMeetings} onResume={handleResumeFromHistory} allAgents={ALL_AGENTS} onViewHistory={handleViewHistory} />;
        }
        if (gameState === GameState.PLANNING || gameState === GameState.PLAN_REVIEW) {
            return <PlanReviewScreen 
                plan={meetingPlan} 
                topic={currentProject?.topic || ''}
                onStart={startMeetingSeries}
                onCancel={handleReset}
            />
        }

        const currentMeetingGoal = currentMeeting?.goal || '';
        const isMeetingFinished = gameState === GameState.COMPLETE || gameState === GameState.AWAITING_USER_INPUT;
        const isLastMeeting = meetingPlan && currentMeeting ? 
            currentMeeting.meeting_index === meetingPlan.length - 1 : false;

        return (
            <div className="space-y-8">
                <div>
                   <h2 className="text-2xl font-bold mb-2 text-indigo-400">Topic</h2>
                   <p className="text-lg bg-gray-800 p-4 rounded-lg">{currentProject?.topic || ''}</p>
                   {currentMeeting && (
                       <p className="text-md text-gray-400 mt-2">
                           Meeting {currentMeeting.meeting_index + 1}/{meetingPlan?.length}: <span className="font-semibold text-gray-300">{currentMeetingGoal}</span>
                       </p>
                   )}
                </div>
                 <TurnIndicator 
                    agents={agents}
                    currentAgent={agents[0]} // Simplified for now
                    gameState={gameState}
                />
                <RoundtableMatrix 
                    agents={agents} 
                    data={{ round1: {}, round2: {}, round3: {} }} // Simplified for now
                    currentAgent={agents[0]}
                    gameState={gameState}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-indigo-400">Meeting Transcript</h2>
                            <button
                                onClick={handleDownloadTranscript}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                Download
                            </button>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg h-[500px] overflow-y-auto shadow-inner">
                            <TranscriptLog transcript={transcript} />
                        </div>
                    </div>
                    <div>
                        {loading && (
                            <div className="bg-gray-800 p-6 rounded-lg h-full flex flex-col items-center justify-center">
                                <Spinner />
                                <p className="mt-4 text-lg text-gray-400 animate-pulse-fast">AI agents are thinking...</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    Processing meeting turn...
                                </p>
                            </div>
                        )}
                        {isMeetingFinished && summary && (
                            <div className="space-y-6">
                                <SummaryDisplay summary={summary} duration={currentMeeting?.duration} />
                                <AgentFeedback agents={agents} feedback={feedback} onFeedback={handleFeedback} />
                            </div>
                        )}
                        {gameState === GameState.FINAL_COMPLETE && finalSummary && (
                            <FinalSummaryDisplay summary={finalSummary} />
                        )}
                         { (gameState < GameState.COMPLETE || (gameState > GameState.COMPLETE && gameState < GameState.FINAL_COMPLETE)) && !loading && (
                            <div className="bg-gray-800 p-6 rounded-lg h-full flex flex-col items-center justify-center text-center">
                                 <h3 className="text-xl font-bold text-indigo-300">Meeting in Progress</h3>
                                 <p className="mt-2 text-gray-400">The roundtable is active. View the transcript for live updates.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-center mt-8">
                    {gameState === GameState.AWAITING_USER_INPUT && (
                         <UserInputPrompt onContinue={handleContinueToNextMeeting} />
                    )}
                    {gameState === GameState.COMPLETE && isLastMeeting && (
                        <button
                            onClick={handleGenerateFinalReport}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Generate Final Report
                        </button>
                    )}
                    {gameState === GameState.FINAL_COMPLETE && (
                        <button
                            onClick={handleReset}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Start a New Project
                        </button>
                    )}
                </div>
            </div>
        );
    };
    
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
                        Roundtable Meeting Agent
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">
                        A 360° AI-powered analysis of your ideas.
                    </p>
                </header>

                {errorMessage && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md mb-6" role="alert">
                        <div className="flex justify-between items-center">
                            <div>
                                <strong className="font-bold">An Error Occurred</strong>
                                <span className="block text-sm text-red-300">{errorMessage}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setErrorMessage('');
                                        runNextMeetingTurn();
                                    }}
                                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                                >
                                    Start Over
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {renderMainContent()}
            </div>
        </div>
    );
};

export default App;