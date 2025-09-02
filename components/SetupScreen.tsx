import React, { useState, useEffect } from 'react';
import { Agent, HistoryItem } from '../types';
import HistoryList from './HistoryList';
import SparklesIcon from './icons/SparklesIcon';

interface SetupScreenProps {
    onPlanMeetings: (topic: string) => void;
    allAgents: Agent[];
    onViewHistory: (item: HistoryItem) => void;
    onResume: (item: HistoryItem) => void;
}

const HISTORY_KEY = 'roundtableHistory_v4';

const SetupScreen: React.FC<SetupScreenProps> = ({ onPlanMeetings, allAgents, onViewHistory, onResume }) => {
    const [topic, setTopic] = useState('');
    const [error, setError] = useState<string>('');
    const [history, setHistory] = useState<HistoryItem[]>([]);

    useEffect(() => {
        try {
            const storedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            setHistory(storedHistory);
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }, []);


    const handleStart = () => {
        if (!topic.trim()) {
            setError('Please enter a discussion topic.');
            return;
        }
        setError('');
        onPlanMeetings(topic);
    };

    return (
        <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700">
            <div className="space-y-6">
                <div>
                    <label htmlFor="topic" className="block text-lg font-medium text-indigo-300 mb-2">
                        Discussion Topic
                    </label>
                    <input
                        id="topic"
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., How to build a gen-z focused social gaming app for India"
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-3 px-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                </div>

                <HistoryList 
                    history={history}
                    onView={onViewHistory}
                    onLoadTopic={setTopic}
                    onResume={onResume}
                />
                
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                     <h3 className="text-lg font-medium text-indigo-300 mb-3">Available Experts</h3>
                     <div className="flex flex-wrap gap-x-4 gap-y-6 justify-center">
                        {allAgents.map(agent => (
                            <div key={agent.id} className="flex flex-col items-center text-center w-24" title={agent.name}>
                                <agent.avatar className="w-12 h-12 rounded-full transition-transform hover:scale-110" />
                                <span className="text-xs mt-2 text-gray-300 w-full">{agent.name}</span>
                            </div>
                        ))}
                     </div>
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                <div className="text-center pt-4">
                    <button
                        onClick={handleStart}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg inline-flex items-center gap-2"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Plan Meetings with AI
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetupScreen;