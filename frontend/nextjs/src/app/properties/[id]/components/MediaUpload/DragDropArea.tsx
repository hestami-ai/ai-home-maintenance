'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { CONFIG } from './types';

interface DragDropAreaProps {
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export default function DragDropArea({ onFilesSelected, className = '' }: DragDropAreaProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: CONFIG.allowedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: CONFIG.maxFileSize,
    validator: (file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !CONFIG.allowedExtensions.includes(extension)) {
        return {
          code: 'file-invalid-type',
          message: `Only ${CONFIG.allowedExtensions.join(', ')} files are allowed`
        };
      }
      return null;
    }
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
        transition-colors duration-200 ease-in-out
        ${isDragActive ? 'border-secondary-main bg-secondary-main/10' : 'border-gray-300 hover:border-gray-400'}
        ${className}`}
    >
      <input {...getInputProps()} />
      <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">
        {isDragActive ? (
          'Drop the files here...'
        ) : (
          <>
            Drag & drop files here, or click to select files
            <br />
            <span className="text-xs text-gray-500">
              Supported formats: {CONFIG.allowedExtensions.join(', ')}
              <br />
              Max size: {CONFIG.maxFileSize / (1024 * 1024)}MB
            </span>
          </>
        )}
      </p>
    </div>
  );
}
