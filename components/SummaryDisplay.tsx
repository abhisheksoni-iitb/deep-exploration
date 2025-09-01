import React from 'react';
import { Summary } from '../types';
import UserGroupIcon from './icons/UserGroupIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import LightbulbIcon from './icons/LightbulbIcon';
import ShieldExclamationIcon from './icons/ShieldExclamationIcon';
import ClockIcon from './icons/ClockIcon';
import DownloadIcon from './icons/DownloadIcon';

interface SummaryDisplayProps {
    summary: Summary;
    duration?: string | null;
}

const SummarySection: React.FC<{ title: string, items: string[], icon: React.ReactNode, color: string }> = ({ title, items, icon, color }) => {
    return (
        <div className={`bg-gray-800/50 p-4 rounded-lg border-l-4 ${color}`}>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
                {icon}
                <span className="ml-2">{title}</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-300 text-sm">
                {items.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        </div>
    );
};

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summary, duration }) => {
    const handleDownloadSummary = () => {
        const { keyInsights, actionItems, potentialRisks, consensusPoints } = summary;
        
        const sections = [
            { title: "Key Insights", items: keyInsights },
            { title: "Action Items", items: actionItems },
            { title: "Potential Risks", items: potentialRisks },
            { title: "Consensus Points", items: consensusPoints }
        ];

        const markdownContent = sections.map(section => {
            let content = `## ${section.title}\n\n`;
            content += section.items.map(item => `- ${item}`).join('\n');
            return content;
        }).join('\n\n');

        const fullMarkdown = `# Roundtable Final Summary\n\n${markdownContent}`;

        const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roundtable-summary-${new Date().toISOString()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-indigo-400">Final Summary</h2>
                <div className="flex items-center gap-4">
                    {duration && (
                        <div className="flex items-center text-sm bg-gray-700/50 text-gray-300 py-1 px-3 rounded-full">
                            <ClockIcon className="w-4 h-4 mr-2" />
                            <span>{duration}</span>
                        </div>
                    )}
                    <button
                        onClick={handleDownloadSummary}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-3 rounded-lg transition duration-200 text-sm"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                    </button>
                </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <SummarySection
                    title="Key Insights"
                    items={summary.keyInsights}
                    icon={<LightbulbIcon className="w-6 h-6 text-yellow-400" />}
                    color="border-yellow-500"
                />
                <SummarySection
                    title="Action Items"
                    items={summary.actionItems}
                    icon={<ClipboardIcon className="w-6 h-6 text-blue-400" />}
                    color="border-blue-500"
                />
                <SummarySection
                    title="Potential Risks"
                    items={summary.potentialRisks}
                    icon={<ShieldExclamationIcon className="w-6 h-6 text-red-400" />}
                    color="border-red-500"
                />
                <SummarySection
                    title="Consensus Points"
                    items={summary.consensusPoints}
                    icon={<UserGroupIcon className="w-6 h-6 text-green-400" />}
                    color="border-green-500"
                />
            </div>
        </div>
    );
};

export default SummaryDisplay;