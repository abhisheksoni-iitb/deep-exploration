import React, { useState } from 'react';
import { HistoryItem, MeetingResult } from '../types';
import SummaryDisplay from './SummaryDisplay';
import TranscriptLog from './TranscriptLog';

interface HistoryViewerProps {
    item: HistoryItem;
    onClose: () => void;
}

const MeetingAccordion: React.FC<{ result: MeetingResult, index: number }> = ({ result, index }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700">
            <h2>
                <button
                    type="button"
                    className="flex items-center justify-between w-full p-4 font-medium text-left text-gray-200 hover:bg-gray-800"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    <span className="flex items-center">
                        <span className="bg-indigo-600 text-white text-xs font-bold mr-3 px-2.5 py-1.5 rounded-full">{index + 1}</span>
                        {result.goal}
                    </span>
                    <svg className={`w-3 h-3 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5 5 1 1 5"/>
                    </svg>
                </button>
            </h2>
            {isOpen && (
                <div className="p-4 border-t border-gray-700">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div>
                            <SummaryDisplay summary={result.summary} duration={result.duration} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-indigo-400">Meeting Transcript</h3>
                            <div className="bg-gray-800 p-4 rounded-lg h-[400px] overflow-y-auto shadow-inner">
                                <TranscriptLog transcript={result.transcript} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const HistoryViewer: React.FC<HistoryViewerProps> = ({ item, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
            <div 
                className="bg-gray-900 rounded-2xl w-full max-w-7xl h-[95vh] p-4 sm:p-6 lg:p-8 relative border border-gray-700 shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="mb-6 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
                        aria-label="Close history view"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="text-3xl font-bold text-indigo-400 pr-10">Project History</h2>
                    <p className="text-lg text-gray-300 mt-2">{item.topic}</p>
                    <p className="text-sm text-gray-500 mt-1">{new Date(item.date).toLocaleString()}</p>
                </header>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                    {item.finalSummary && (
                        <div>
                            <h3 className="text-2xl font-bold mb-3 text-indigo-400">Final Report</h3>
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <p className="text-gray-300">{item.finalSummary}</p>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <h3 className="text-2xl font-bold mb-3 text-indigo-400">Meeting Series</h3>
                        <div className="space-y-2">
                             {item.meetingResults.map((result, index) => (
                                <MeetingAccordion key={index} result={result} index={index} />
                             ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoryViewer;