import React, { useState, useEffect, useCallback } from 'react';
import { Agent, AppState, MeetingData, TranscriptItem, Summary, HistoryItem, Source, PlannedMeeting, MeetingResult } from './types';
import { ALL_AGENTS, GameState } from './constants';
import { runRoundForAgent, runFollowUpForAgent, runRound3ForAgent, synthesizeTranscript, planMeetings, synthesizeSeries } from './services/geminiService';
import SetupScreen from './components/SetupScreen';
import PlanReviewScreen from './components/PlanReviewScreen';
import RoundtableMatrix from './components/RoundtableMatrix';
import TranscriptLog from './components/TranscriptLog';
import SummaryDisplay from './components/SummaryDisplay';
import Spinner from './components/Spinner';
import TurnIndicator from './components/TurnIndicator';
import HistoryViewer from './components/HistoryViewer';
import DownloadIcon from './components/icons/DownloadIcon';

const HISTORY_KEY = 'roundtableHistory_v4';
const HISTORY_LIMIT = 20;

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
};

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
    const [topic, setTopic] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [viewingHistoryItem, setViewingHistoryItem] = useState<HistoryItem | null>(null);

    // Multi-meeting state
    const [meetingPlan, setMeetingPlan] = useState<PlannedMeeting[] | null>(null);
    const [currentMeetingIndex, setCurrentMeetingIndex] = useState<number>(0);
    const [meetingResults, setMeetingResults] = useState<MeetingResult[]>([]);
    const [finalSummary, setFinalSummary] = useState<string | null>(null);
    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);


    // Per-meeting state (reset for each meeting)
    const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
    const [meetingData, setMeetingData] = useState<MeetingData>({ round1: {}, round2: {}, round3: {} });
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [currentAgentIndex, setCurrentAgentIndex] = useState<number>(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [meetingDuration, setMeetingDuration] = useState<string | null>(null);
    
    const handleReset = () => {
        setGameState(GameState.SETUP);
        setTopic('');
        setSelectedAgents([]);
        setMeetingData({ round1: {}, round2: {}, round3: {} });
        setTranscript([]);
        setSummary(null);
        setCurrentAgentIndex(0);
        setLoading(false);
        setErrorMessage('');
        setStartTime(null);
        setMeetingDuration(null);
        setMeetingPlan(null);
        setCurrentMeetingIndex(0);
        setMeetingResults([]);
        setFinalSummary(null);
        setCurrentHistoryId(null);
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

    const handlePlanMeetings = async (newTopic: string) => {
        setTopic(newTopic);
        setCurrentHistoryId(new Date().toISOString());
        setGameState(GameState.PLANNING);
        setErrorMessage('');
        setLoading(true);
        try {
            const plan = await planMeetings(newTopic, ALL_AGENTS);
            const populatedPlan = plan.map(p => ({
                ...p,
                agents: p.agentIds.map(id => ALL_AGENTS.find(a => a.id === id)).filter((a): a is Agent => !!a)
            }));
            setMeetingPlan(populatedPlan);
            setGameState(GameState.PLAN_REVIEW);
        } catch (error) {
            handleError('Failed to generate a meeting plan.', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResumeFromHistory = (item: HistoryItem) => {
        if (!item.meetingPlan) {
            handleError("Cannot resume: Meeting plan is missing from history.");
            return;
        }
    
        setViewingHistoryItem(null);
        
        // Restore state from history
        setCurrentHistoryId(item.id);
        setTopic(item.topic);
        setMeetingPlan(item.meetingPlan);
        setMeetingResults(item.meetingResults);
        setFinalSummary(item.finalSummary);
        setErrorMessage('');
        
        // Determine where to resume
        const meetingsDone = item.meetingResults.length;
        const totalMeetings = item.meetingPlan.length;
    
        if (meetingsDone < totalMeetings) {
            // Resume from the next meeting
            setupNextMeeting(meetingsDone);
        } else {
            // All meetings done, maybe it crashed during final synthesis?
            if (item.finalSummary) {
                setGameState(GameState.FINAL_COMPLETE);
            } else {
                setGameState(GameState.FINAL_SYNTHESIS);
            }
        }
    };

    const startMeetingSeries = () => {
        setMeetingResults([]);
        setFinalSummary(null);
        setupNextMeeting(0);
    };
    
    const setupNextMeeting = (index: number) => {
        if (!meetingPlan) return;
        
        setCurrentMeetingIndex(index);
        
        // Reset per-meeting state
        const currentMeeting = meetingPlan[index];
        setSelectedAgents(currentMeeting.agents || []);
        setTranscript([{ type: 'system', content: `Meeting ${index + 1}/${meetingPlan.length} starting. Goal: "${currentMeeting.goal}"` }]);
        const initialMeetingData: MeetingData = { round1: {}, round2: {}, round3: {} };
        (currentMeeting.agents || []).forEach(agent => {
            initialMeetingData.round1[agent.id] = { mainAnswer: '', crossQuestions: [] };
            initialMeetingData.round2[agent.id] = { answers: [], crossQuestions: [] };
            initialMeetingData.round3[agent.id] = { answers: [] };
        });
        setMeetingData(initialMeetingData);
        setSummary(null);
        setCurrentAgentIndex(0);
        setMeetingDuration(null);
        setStartTime(Date.now());
        setGameState(GameState.ROUND_1);
    };

    const processMeeting = useCallback(async () => {
        if (loading || selectedAgents.length === 0 || !meetingPlan) return;

        setLoading(true);
        setErrorMessage('');
        
        const currentMeetingGoal = meetingPlan[currentMeetingIndex].goal;
        const previousMeetingSummary = currentMeetingIndex > 0 ? meetingResults[currentMeetingIndex-1]?.summary : undefined;

        try {
            if (gameState === GameState.ROUND_1 && currentAgentIndex < selectedAgents.length) {
                const currentAgent = selectedAgents[currentAgentIndex];
                setTranscript(prev => [...prev, { type: 'system', content: `Round 1: ${currentAgent.name}'s turn...` }]);
                const otherAgents = selectedAgents.filter(a => a.id !== currentAgent.id);
                const result = await runRoundForAgent(currentAgent, topic, otherAgents, { meetingGoal: currentMeetingGoal, previousMeetingSummary });

                setMeetingData(prev => ({ ...prev, round1: { ...prev.round1, [currentAgent.id]: result } }));
                
                const questions = (result.crossQuestions || []).map(q => {
                    const toAgent = selectedAgents.find(a => a.name === q.ask_expert);
                    if (!toAgent) return null;
                    return { type: 'question' as const, from: currentAgent, to: toAgent, content: q.question };
                }).filter((item): item is TranscriptItem & { type: 'question' } => !!item);

                setTranscript(prev => [
                    ...prev,
                    { type: 'response', agent: currentAgent, content: `Main Answer: ${result.mainAnswer}`, sources: result.sources },
                    ...questions
                ]);
                setCurrentAgentIndex(prev => prev + 1);

            } else if (gameState === GameState.ROUND_1 && currentAgentIndex >= selectedAgents.length) {
                const hasRound1Questions = Object.values(meetingData.round1).some(r => r.crossQuestions && r.crossQuestions.length > 0);
                if (hasRound1Questions) {
                    setGameState(GameState.ROUND_2);
                    setCurrentAgentIndex(0);
                    setTranscript(prev => [...prev, { type: 'system', content: `Round 1 complete. Starting Round 2.` }]);
                } else {
                    setGameState(GameState.SYNTHESIS);
                    setTranscript(prev => [...prev, { type: 'system', content: `Round 1 complete. No new questions raised. Proceeding to summary.` }]);
                }
            
            } else if (gameState === GameState.ROUND_2 && currentAgentIndex < selectedAgents.length) {
                const currentAgent = selectedAgents[currentAgentIndex];
                setTranscript(prev => [...prev, { type: 'system', content: `Round 2: ${currentAgent.name}'s turn...` }]);
                const questionsForAgent = Object.values(meetingData.round1).flatMap(r => r.crossQuestions || []).filter(q => q.ask_expert === currentAgent.name).map(q => q.question);
                
                if (questionsForAgent.length > 0) {
                    const otherAgents = selectedAgents.filter(a => a.id !== currentAgent.id);
                    const result = await runFollowUpForAgent(currentAgent, topic, questionsForAgent, otherAgents);
                    setMeetingData(prev => ({ ...prev, round2: { ...prev.round2, [currentAgent.id]: result } }));
                    const transcriptAnswers: TranscriptItem[] = result.answers.map((a, index) => ({ type: 'answer' as const, agent: currentAgent, content: `Answered: "${a.question}" with "${a.answer}"`, sources: index === 0 ? result.sources : undefined }));
                    
                    const questions = (result.crossQuestions || []).map(q => {
                        const toAgent = selectedAgents.find(a => a.name === q.ask_expert);
                        if (!toAgent) return null;
                        return { type: 'question' as const, from: currentAgent, to: toAgent, content: q.question };
                    }).filter((item): item is TranscriptItem & { type: 'question' } => !!item);

                    setTranscript(prev => [ ...prev, ...transcriptAnswers, ...questions ]);
                } else {
                     setTranscript(prev => [...prev, { type: 'system', content: `${currentAgent.name} had no questions to answer.` }]);
                }
                setCurrentAgentIndex(prev => prev + 1);

            } else if (gameState === GameState.ROUND_2 && currentAgentIndex >= selectedAgents.length) {
                const hasRound2Questions = Object.values(meetingData.round2).some(r => r.crossQuestions && r.crossQuestions.length > 0);
                if (hasRound2Questions) {
                    setGameState(GameState.ROUND_3);
                    setCurrentAgentIndex(0);
                    setTranscript(prev => [...prev, { type: 'system', content: `Round 2 complete. Starting Round 3.` }]);
                } else {
                    setGameState(GameState.SYNTHESIS);
                    setTranscript(prev => [...prev, { type: 'system', content: `Round 2 complete. No new questions raised. Proceeding to summary.` }]);
                }
            
            } else if (gameState === GameState.ROUND_3 && currentAgentIndex < selectedAgents.length) {
                const currentAgent = selectedAgents[currentAgentIndex];
                setTranscript(prev => [...prev, { type: 'system', content: `Round 3: ${currentAgent.name}'s turn...` }]);
                const questionsForAgent = Object.values(meetingData.round2).flatMap(r => r.crossQuestions || []).filter(q => q.ask_expert === currentAgent.name).map(q => q.question);

                if (questionsForAgent.length > 0) {
                    const result = await runRound3ForAgent(currentAgent, topic, questionsForAgent);
                    setMeetingData(prev => ({ ...prev, round3: { ...prev.round3, [currentAgent.id]: result } }));
                    setTranscript(prev => [ ...prev, ...result.answers.map(a => ({ type: 'answer' as const, agent: currentAgent, content: `Final Answer: "${a.question}" with "${a.answer}"` })) ]);
                } else {
                    setTranscript(prev => [...prev, { type: 'system', content: `${currentAgent.name} had no new questions to answer.` }]);
                }
                setCurrentAgentIndex(prev => prev + 1);

            } else if (gameState === GameState.ROUND_3 && currentAgentIndex >= selectedAgents.length) {
                setGameState(GameState.SYNTHESIS);
                setTranscript(prev => [...prev, { type: 'system', content: `Round 3 complete. Synthesizing meeting summary...` }]);
            
            } else if (gameState === GameState.SYNTHESIS) {
                const fullTranscript = transcript.map(t => {
                    if (t.type === 'system') return `[SYSTEM] ${t.content}`;
                    if (t.type === 'response') return `[${t.agent.name}] ${t.content}`;
                    if (t.type === 'question') return `[${t.from.name} to ${t.to.name}] ${t.content}`;
                    if (t.type === 'answer') return `[${t.agent.name}] ${t.content}`;
                    return '';
                }).join('\n');

                const summaryResult = await synthesizeTranscript(topic, selectedAgents, fullTranscript);
                
                const endTime = Date.now();
                const durationInSeconds = Math.round((endTime - (startTime || endTime)) / 1000);
                const durationString = formatDuration(durationInSeconds);
                setMeetingDuration(durationString);
                setSummary(summaryResult);
                
                const newMeetingResult: MeetingResult = {
                    goal: currentMeetingGoal,
                    agents: selectedAgents,
                    transcript: [...transcript, { type: 'system', content: 'Synthesis complete.' }],
                    summary: summaryResult,
                    duration: durationString,
                };
                setMeetingResults(prev => [...prev, newMeetingResult]);

                setGameState(GameState.COMPLETE);
                setTranscript(prev => [...prev, { type: 'system', content: 'Meeting summary complete.' }]);
            
            } else if (gameState === GameState.FINAL_SYNTHESIS) {
                const { finalSummary } = await synthesizeSeries(topic, meetingResults);
                setFinalSummary(finalSummary);
                setGameState(GameState.FINAL_COMPLETE);
            }
        } catch (error) {
            handleError(`An error occurred during the meeting process.`, error);
        } finally {
            setLoading(false);
        }
    }, [gameState, currentAgentIndex, loading, selectedAgents, topic, meetingData, transcript, startTime, meetingPlan, currentMeetingIndex, meetingResults]);
    
    // Auto-run the processMeeting function when state is ready
    useEffect(() => {
        const isMeetingRunning = gameState >= GameState.ROUND_1 && gameState < GameState.COMPLETE;
        if ((isMeetingRunning || gameState === GameState.SYNTHESIS || gameState === GameState.FINAL_SYNTHESIS) && !loading && !errorMessage) {
            const timer = setTimeout(() => processMeeting(), 1000);
            return () => clearTimeout(timer);
        }
    }, [gameState, currentAgentIndex, loading, processMeeting, errorMessage]);

    // Auto-save history whenever the state changes
    useEffect(() => {
        if (gameState === GameState.SETUP || viewingHistoryItem || !currentHistoryId) {
            return;
        }
    
        const status: HistoryItem['status'] = gameState === GameState.FINAL_COMPLETE ? 'Completed' : 'In Progress';
    
        const newHistoryItem: HistoryItem = {
            id: currentHistoryId,
            topic,
            status,
            date: new Date().toISOString(),
            meetingPlan,
            meetingResults,
            finalSummary,
        };
    
        try {
            const history: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            const existingIndex = history.findIndex(item => item.id === currentHistoryId);
            
            if (existingIndex !== -1) {
                history[existingIndex] = newHistoryItem;
            } else {
                history.unshift(newHistoryItem);
            }
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
        } catch (e) {
            console.error("Failed to auto-save history", e);
        }
    
    }, [meetingPlan, meetingResults, finalSummary, gameState, currentHistoryId, topic, viewingHistoryItem]);


    const transcriptToMarkdown = (transcriptItems: TranscriptItem[]): string => {
        // ... (function content is unchanged)
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
    
    if (viewingHistoryItem) {
        return <HistoryViewer item={viewingHistoryItem} onClose={() => setViewingHistoryItem(null)} />;
    }

    const isLastMeeting = meetingPlan ? currentMeetingIndex === meetingPlan.length - 1 : false;

    const renderMainContent = () => {
        if (gameState === GameState.SETUP) {
            return <SetupScreen onPlanMeetings={handlePlanMeetings} onResume={handleResumeFromHistory} allAgents={ALL_AGENTS} onViewHistory={setViewingHistoryItem} />;
        }
        if (gameState === GameState.PLANNING || gameState === GameState.PLAN_REVIEW) {
            return <PlanReviewScreen 
                plan={meetingPlan} 
                topic={topic}
                onStart={startMeetingSeries}
                onCancel={handleReset}
            />
        }

        const currentMeetingGoal = meetingPlan ? meetingPlan[currentMeetingIndex].goal : '';

        return (
            <div className="space-y-8">
                <div>
                   <h2 className="text-2xl font-bold mb-2 text-indigo-400">Topic</h2>
                   <p className="text-lg bg-gray-800 p-4 rounded-lg">{topic}</p>
                   <p className="text-md text-gray-400 mt-2">
                       Meeting {currentMeetingIndex + 1}/{meetingPlan?.length}: <span className="font-semibold text-gray-300">{currentMeetingGoal}</span>
                   </p>
                </div>
                 <TurnIndicator 
                    agents={selectedAgents}
                    currentAgent={selectedAgents[currentAgentIndex]}
                    gameState={gameState}
                />
                <RoundtableMatrix 
                    agents={selectedAgents} 
                    data={meetingData}
                    currentAgent={selectedAgents[currentAgentIndex]}
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
                                    {gameState < GameState.SYNTHESIS && `Processing: ${selectedAgents[currentAgentIndex]?.name} (Round ${gameState-GameState.ROUND_1+1})`}
                                    {gameState === GameState.SYNTHESIS && `Synthesizing meeting summary...`}
                                    {gameState === GameState.FINAL_SYNTHESIS && "Synthesizing final project report..."}
                                </p>
                            </div>
                        )}
                        {gameState === GameState.COMPLETE && summary && (
                            <SummaryDisplay summary={summary} duration={meetingDuration} />
                        )}
                        {gameState === GameState.FINAL_COMPLETE && finalSummary && (
                            <div className="bg-gray-800 p-6 rounded-lg">
                                <h2 className="text-2xl font-bold text-indigo-400 mb-4">Final Project Report</h2>
                                <p className="text-gray-300 whitespace-pre-wrap">{finalSummary}</p>
                            </div>
                        )}
                         { (gameState < GameState.COMPLETE || (gameState > GameState.COMPLETE && gameState < GameState.FINAL_COMPLETE)) && !loading && (
                            <div className="bg-gray-800 p-6 rounded-lg h-full flex flex-col items-center justify-center text-center">
                                 <h3 className="text-xl font-bold text-indigo-300">Meeting in Progress</h3>
                                 <p className="mt-2 text-gray-400">The roundtable is active. View the matrix and transcript for live updates.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-center mt-8">
                    {gameState === GameState.COMPLETE && !isLastMeeting && (
                        <button
                            onClick={() => setupNextMeeting(currentMeetingIndex + 1)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Start Next Meeting
                        </button>
                    )}
                    {gameState === GameState.COMPLETE && isLastMeeting && (
                        <button
                            onClick={() => setGameState(GameState.FINAL_SYNTHESIS)}
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
    }

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
                                        processMeeting();
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