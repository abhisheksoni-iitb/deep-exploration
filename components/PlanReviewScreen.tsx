import React from 'react';
import { PlannedMeeting } from '../types';
import Spinner from './Spinner';

interface PlanReviewScreenProps {
    plan: PlannedMeeting[] | null;
    topic: string;
    onStart: () => void;
    onCancel: () => void;
}

const PlanReviewScreen: React.FC<PlanReviewScreenProps> = ({ plan, topic, onStart, onCancel }) => {
    return (
        <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-indigo-400">AI-Generated Meeting Plan</h2>
                    <p className="text-lg text-gray-400 mt-1">For topic: <span className="font-semibold text-gray-300">"{topic}"</span></p>
                </div>
                
                {!plan ? (
                     <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-900/50 rounded-lg">
                        <Spinner />
                        <p className="mt-4 text-lg text-gray-400 animate-pulse-fast">AI is planning the meeting series...</p>
                        <p className="text-sm text-gray-500 mt-2">This may take a moment.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {plan.map((meeting, index) => (
                            <div key={index} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <h3 className="text-lg font-bold text-indigo-300">
                                    Meeting {index + 1}: <span className="font-normal">{meeting.goal}</span>
                                </h3>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="text-sm text-gray-400 font-semibold">Attendees:</span>
                                    {meeting.agents?.map(agent => (
                                        <span key={agent.id} className="bg-gray-700 text-gray-200 text-xs font-medium py-1 px-2.5 rounded-full">
                                            {agent.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {plan && (
                     <div className="flex items-center justify-center gap-4 pt-4">
                        <button
                            onClick={onCancel}
                            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onStart}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                        >
                            Start First Meeting
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlanReviewScreen;