import React from 'react';
import { Agent } from '../types';
import { GameState } from '../constants';

interface TurnIndicatorProps {
    agents: Agent[];
    currentAgent?: Agent;
    gameState: GameState;
}

const TurnIndicator: React.FC<TurnIndicatorProps> = ({ agents, currentAgent, gameState }) => {
    const getRoundText = () => {
        if (gameState === GameState.ROUND_1) return "Round 1";
        if (gameState === GameState.ROUND_2) return "Round 2";
        if (gameState === GameState.ROUND_3) return "Round 3";
        return "Meeting";
    };

    if (gameState < GameState.ROUND_1 || gameState >= GameState.SYNTHESIS) {
        return null;
    }

    return (
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 mb-8">
            <h3 className="text-lg font-bold text-indigo-300 mb-3 text-center tracking-wider">{getRoundText()} Turn</h3>
            <div className="flex items-center justify-center space-x-2 overflow-x-auto p-2 -mx-2">
                {agents.map((agent) => (
                    <div 
                        key={agent.id} 
                        className={`flex-shrink-0 flex items-center p-2 px-3 rounded-full transition-all duration-300 ease-in-out border-2 ${
                            agent.id === currentAgent?.id 
                                ? 'bg-indigo-600 border-indigo-400 scale-110 shadow-lg' 
                                : 'bg-gray-700 border-gray-600'
                        }`}
                    >
                        <span className="text-sm font-semibold text-white">{agent.name}</span>
                        {agent.id === currentAgent?.id && (
                             <span className="ml-2 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TurnIndicator;
