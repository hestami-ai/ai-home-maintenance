'use client';

import { useState } from 'react';
import { format } from 'date-fns';

interface ResearchEntry {
  id: string;
  research_data: any;
  research_content: string;
  notes: string;
  created_at: string;
  updated_at: string;
  researched_by_details: {
    name: string;
    email: string;
  };
}

interface ResearchHistoryProps {
  researchEntries: ResearchEntry[];
}

export default function ResearchHistory({ researchEntries }: ResearchHistoryProps) {
  const [expandedEntries, setExpandedEntries] = useState<{ [key: string]: boolean }>({});
  
  // Toggle expanded state for a research entry
  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  if (researchEntries.length === 0) {
    return (
      <div className="px-4 py-5 sm:px-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">No research entries yet</p>
      </div>
    );
  }
  
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {researchEntries.map((entry) => (
        <div key={entry.id} className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Research by {entry.researched_by_details.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            <button
              onClick={() => toggleExpand(entry.id)}
              className="text-primary-main hover:text-primary-dark"
            >
              {expandedEntries[entry.id] ? 'Collapse' : 'Expand'}
            </button>
          </div>
          
          {entry.notes && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes:</h4>
              <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">
                {entry.notes}
              </p>
            </div>
          )}
          
          {expandedEntries[entry.id] && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Research Content:</h4>
              <div 
                className="prose prose-sm max-w-none dark:prose-invert border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-gray-800"
                dangerouslySetInnerHTML={{ __html: entry.research_content }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
