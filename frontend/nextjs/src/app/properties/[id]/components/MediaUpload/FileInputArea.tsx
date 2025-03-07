'use client';

import React, { useCallback } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { validateFile } from './utils';

interface FileInputAreaProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
}

export default function FileInputArea({ 
  onFilesSelected, 
  disabled = false,
  multiple = true 
}: FileInputAreaProps) {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const validation = validateFile(file);
      
      if (validation.isValid) {
        files.push(file);
      } else {
        console.error(`File validation failed for ${file.name}:`, validation.error);
      }
    }

    if (files.length > 0) {
      onFilesSelected(files);
    }

    // Reset the input so the same file can be selected again
    event.target.value = '';
  }, [onFilesSelected]);

  return (
    <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        onChange={handleFileChange}
        accept=".jpg,.jpeg,.png,.gif,.mp4,.mov"
        multiple={multiple}
        disabled={disabled}
        aria-label="Choose files to upload"
      />
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
        <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Click to select files
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          JPG, PNG, GIF up to 100MB
        </p>
      </div>
    </div>
  );
}
