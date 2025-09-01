import React from 'react';
import { Agent, MeetingData } from '../types';
import { GameState } from '../constants';

interface RoundtableMatrixProps {
    agents: Agent[];
    data: MeetingData;
    currentAgent?: Agent;
    gameState: GameState;
}

const RoundtableMatrix: React.FC<RoundtableMatrixProps> = ({ agents, data, currentAgent, gameState }) => {
    
    const getCellContent = (rowAgent: Agent, colAgent: Agent) => {
        if (rowAgent.id === colAgent.id) {
            // Diagonal: Main Answer
            const mainAnswer = data.round1[rowAgent.id]?.mainAnswer;
            return (
                <div className="p-2">
                    <h4 className="font-bold text-sm text-indigo-300 mb-1">Main Answer</h4>
                    <p className="text-xs text-gray-300">{mainAnswer || '...'}</p>
                </div>
            );
        } else {
            // Off-diagonal: Cross-questions and Answers
            const q1 = data.round1[rowAgent.id]?.crossQuestions.find(q => q.ask_expert === colAgent.name)?.question;
            const a2 = data.round2[colAgent.id]?.answers.find(a => a.question === q1)?.answer;
            const q2 = data.round2[rowAgent.id]?.crossQuestions.find(q => q.ask_expert === colAgent.name)?.question;
            const a3 = data.round3[colAgent.id]?.answers.find(a => a.question === q2)?.answer;
            
            const hasInteraction = q1 || a2 || q2 || a3;

            return (
                <div className="p-2 space-y-2">
                    {q1 && (
                        <div>
                            <h4 className="font-bold text-xs text-purple-300">R1 Question</h4>
                            <p className="text-xs text-gray-300">{q1}</p>
                            {a2 && (
                                <div className="mt-1 pl-2 border-l-2 border-green-500/50">
                                    <h5 className="font-semibold text-xs text-green-300">R2 Answer</h5>
                                    <p className="text-xs text-gray-400">{a2}</p>
                                </div>
                            )}
                        </div>
                    )}
                    {q2 && (
                        <div>
                            <h4 className="font-bold text-xs text-purple-400">R2 Question</h4>
                            <p className="text-xs text-gray-300">{q2}</p>
                            {a3 && (
                                <div className="mt-1 pl-2 border-l-2 border-green-500/50">
                                    <h5 className="font-semibold text-xs text-green-400">R3 Answer</h5>
                                    <p className="text-xs text-gray-400">{a3}</p>
                                </div>
                            )}
                        </div>
                    )}
                    {!hasInteraction && <div className="text-xs text-gray-500 italic">No interaction</div>}
                </div>
            );
        }
    };
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">Interaction Matrix</h2>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2 border border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky left-0 z-10 w-28">
                                <span className="text-gray-400">Asker <span className="font-normal text-xs block">↓</span> / Asked <span className="font-normal text-xs">→</span></span>
                            </th>
                            {agents.map(agent => (
                                <th key={agent.id} className="p-2 border border-gray-700 bg-gray-800 text-indigo-300 font-semibold w-40 min-w-[10rem]">
                                    {agent.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(rowAgent => (
                            <tr key={rowAgent.id}>
                                <th className="p-2 border border-gray-700 bg-gray-800 text-indigo-300 font-semibold sticky left-0 z-10 bg-gray-900/50 backdrop-blur-sm w-28">
                                    {rowAgent.name}
                                </th>
                                {agents.map(colAgent => {
                                    const isCurrentTurn = (currentAgent?.id === rowAgent.id && (gameState === GameState.ROUND_1 || gameState === GameState.ROUND_2)) ||
                                                        (currentAgent?.id === colAgent.id && (gameState === GameState.ROUND_2 || gameState === GameState.ROUND_3));
                                    const isDiagonal = rowAgent.id === colAgent.id;

                                    return (
                                        <td key={`${rowAgent.id}-${colAgent.id}`}
                                            className={`border border-gray-700 align-top transition-all duration-500
                                            ${isDiagonal ? 'bg-gray-800/70' : 'bg-gray-800/40'}
                                            ${isCurrentTurn ? 'ring-2 ring-purple-500 animate-pulse-fast' : ''}`}>
                                            {getCellContent(rowAgent, colAgent)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoundtableMatrix;
