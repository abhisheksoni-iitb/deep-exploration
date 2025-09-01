import React from 'react';
import { HistoryItem } from '../types';

interface HistoryListProps {
    history: HistoryItem[];
    onView: (item: HistoryItem) => void;
    onLoadTopic: (topic: string) => void;
    onResume: (item: HistoryItem) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ history, onView, onLoadTopic, onResume }) => {
    if (history.length === 0) {
        return null;
    }

    return (
        <div>
            <h3 className="text-lg font-medium text-indigo-300 mb-3">Meeting History</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 max-h-60 overflow-y-auto">
                <ul className="space-y-3">
                    {history.map((item) => (
                        <li key={item.id} className="p-3 bg-gray-700/50 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex-grow">
                                <div className="flex items-center">
                                    <span 
                                      className={`mr-3 inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${item.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'}`}
                                      title={`Status: ${item.status}`}
                                    ></span>
                                    <p className="font-semibold text-gray-200">{item.topic}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-1 pl-5">
                                    {new Date(item.date).toLocaleString()}
                                    {item.meetingPlan && ` · ${item.meetingPlan.length} Meeting(s)`}
                                </p>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2 self-end sm:self-center">
                                <button
                                    onClick={() => onLoadTopic(item.topic)}
                                    className="bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs py-1 px-3 rounded-md transition"
                                >
                                    Reuse Topic
                                </button>
                                {item.status === 'In Progress' ? (
                                    <button
                                        onClick={() => onResume(item)}
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1 px-3 rounded-md transition"
                                    >
                                        Resume
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onView(item)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1 px-3 rounded-md transition"
                                    >
                                        View Details
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default HistoryList;