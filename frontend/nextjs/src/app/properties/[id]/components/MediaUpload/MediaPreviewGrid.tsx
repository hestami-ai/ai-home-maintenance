'use client';

import React from 'react';
import MediaPreview from './MediaPreview';

interface MediaItem {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
}

interface MediaPreviewGridProps {
  items: MediaItem[];
  maxDisplay?: number;
  className?: string;
}

export default function MediaPreviewGrid({ 
  items, 
  maxDisplay = 3,
  className = ''
}: MediaPreviewGridProps) {
  const displayItems = items.slice(0, maxDisplay);
  const remaining = Math.max(0, items.length - maxDisplay);

  return (
    <div className={`flex space-x-2 ${className}`}>
      {displayItems.map((item) => (
        <div key={item.id} className="w-16 h-16 flex-shrink-0">
          <MediaPreview
            url={item.url}
            thumbnailUrl={item.thumbnailUrl}
            title={item.name}
            type={item.type}
            className="w-full h-full"
          />
        </div>
      ))}
      {remaining > 0 && (
        <div className="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            +{remaining}
          </span>
        </div>
      )}
    </div>
  );
}
