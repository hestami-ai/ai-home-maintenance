'use client';

import React from 'react';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { MediaUploadItem } from './types';

interface FilePreviewListProps {
  files: MediaUploadItem[];
  onRemove: (id: string) => void;
}

export default function FilePreviewList({ files, onRemove }: FilePreviewListProps) {
  if (files.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2">
      {files.map((file) => (
        <li
          key={file.id}
          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            {file.previewUrl && (
              <img
                src={file.previewUrl}
                alt={`Preview of ${file.file.name}`}
                className="h-10 w-10 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {file.file.name}
              </p>
              {file.error && (
                <p className="text-xs text-red-500">{file.error}</p>
              )}
              {file.uploading && (
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-main"
                    style={{ width: `${file.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          
          {!file.uploaded && (
            <button
              onClick={() => onRemove(file.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={`Remove ${file.file.name}`}
            >
              <XCircleIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
