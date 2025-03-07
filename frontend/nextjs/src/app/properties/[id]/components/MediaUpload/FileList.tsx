'use client';

import { 
  CheckCircleIcon, 
  XCircleIcon,
  PhotoIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import { MediaFile } from './types';

interface FileListProps {
  files: MediaFile[];
  selectedFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onFileRemove: (fileId: string) => void;
}

export default function FileList({ 
  files, 
  selectedFileId, 
  onFileSelect, 
  onFileRemove 
}: FileListProps) {
  return (
    <div className="overflow-y-auto h-full">
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer
              ${selectedFileId === file.id ? 'bg-primary-light/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            onClick={() => onFileSelect(file.id)}
            role="button"
            aria-label={`Select ${file.file.name}`}
          >
            <div className="flex items-center space-x-3 flex-1">
              {file.file.type.startsWith('image/') ? (
                <PhotoIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              ) : (
                <VideoCameraIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              )}
              <span className="flex-1 truncate text-sm">{file.file.name}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {file.status === 'success' && (
                <CheckCircleIcon 
                  className="h-5 w-5 text-secondary-main" 
                  aria-label="Upload successful"
                />
              )}
              {file.status === 'error' && (
                <XCircleIcon 
                  className="h-5 w-5 text-red-500" 
                  aria-label={`Upload failed: ${file.error}`}
                />
              )}
              {file.status === 'uploading' && (
                <div className="h-5 w-5" role="status" aria-label="Uploading...">
                  <svg className="animate-spin h-5 w-5 text-secondary-main" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="sr-only">Uploading {file.file.name}...</span>
                </div>
              )}
              {file.status === 'pending' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove(file.id);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`Remove ${file.file.name}`}
                >
                  <XCircleIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
