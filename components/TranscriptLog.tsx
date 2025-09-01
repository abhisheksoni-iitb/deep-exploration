import React, { useRef, useEffect } from 'react';
import { TranscriptItem, Source } from '../types';

interface TranscriptLogProps {
    transcript: TranscriptItem[];
}

const TranscriptLog: React.FC<TranscriptLogProps> = ({ transcript }) => {
    const endOfLogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfLogRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const renderSources = (sources: Source[] | undefined) => {
        if (!sources || sources.length === 0) return null;
        return (
            <div className="mt-2 pt-2 border-t border-gray-600/50">
                <h5 className="text-xs font-bold text-gray-400 mb-1">Sources:</h5>
                <ul className="space-y-1">
                    {sources.map((source, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-center">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate" title={source.title}>
                                {source.title}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )
    };

    const renderItem = (item: TranscriptItem, index: number) => {
        switch(item.type) {
            case 'system':
                return <div key={index} className="text-center text-sm text-gray-500 italic py-2">--- {item.content} ---</div>;
            case 'response':
                return (
                    <div key={index} className="p-3 bg-gray-700/50 rounded-lg">
                        <p><strong className="text-indigo-400">{item.agent.name}:</strong> {item.content}</p>
                        {renderSources(item.sources)}
                    </div>
                );
            case 'question':
                 return (
                    <div key={index} className="p-3 bg-gray-700/50 rounded-lg border-l-4 border-purple-500">
                        <p><strong className="text-purple-400">{item.from.name} asks {item.to.name}:</strong> {item.content}</p>
                    </div>
                );
            case 'answer':
                return (
                     <div key={index} className="p-3 bg-gray-700/50 rounded-lg border-l-4 border-green-500">
                        <p><strong className="text-green-400">{item.agent.name} answers:</strong> {item.content}</p>
                        {renderSources(item.sources)}
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div className="space-y-3">
            {transcript.map(renderItem)}
            <div ref={endOfLogRef} />
        </div>
    );
};

export default TranscriptLog;