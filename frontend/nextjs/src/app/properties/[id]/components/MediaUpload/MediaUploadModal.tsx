'use client';

import { 
  useCallback, 
  useEffect, 
  useState, 
  useMemo 
} from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';
import DragDropArea from './DragDropArea';
import FileList from './FileList';
import MetadataForm from './MetadataForm';
import { 
  MediaFile, 
  MediaTypeOption, 
  LocationTypeOption,
  MediaTypesResponse,
  LocationTypesResponse,
  DEFAULT_MEDIA_TYPE,
  DEFAULT_MEDIA_SUBTYPE,
  DEFAULT_LOCATION_TYPE,
  DEFAULT_LOCATION_SUBTYPE
} from './types';

interface MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
}

export default function MediaUploadModal({
  isOpen,
  onClose,
  propertyId
}: MediaUploadModalProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaTypes, setMediaTypes] = useState<MediaTypeOption[]>([]);
  const [locationTypes, setLocationTypes] = useState<LocationTypeOption[]>([]);
  const [allUploadsSuccessful, setAllUploadsSuccessful] = useState(false);

  const selectedFile = useMemo(() => {
    return files.find(f => f.id === selectedFileId);
  }, [files, selectedFileId]);

  const resetState = useCallback(() => {
    setFiles([]);
    setSelectedFileId(null);
    setIsUploading(false);
    setAllUploadsSuccessful(false);
  }, []);

  const handleClose = useCallback(() => {
    if (allUploadsSuccessful) {
      resetState();
    }
    onClose();
  }, [onClose, allUploadsSuccessful, resetState]);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const [mediaTypesRes, locationTypesRes] = await Promise.all([
          fetch('/api/media/types'),
          fetch('/api/media/locations')
        ]);

        if (!mediaTypesRes.ok || !locationTypesRes.ok) {
          console.error('MediaUploadModal: Failed to fetch types');
          return;
        }

        const [mediaTypesData, locationTypesData]: [MediaTypesResponse, LocationTypesResponse] = await Promise.all([
          mediaTypesRes.json(),
          locationTypesRes.json()
        ]);

        // Validate media types response
        if (!mediaTypesData?.types || !mediaTypesData?.subTypes) {
          console.error('MediaUploadModal: Invalid media types data structure:', mediaTypesData);
          return;
        }

        // Validate location types response
        if (!locationTypesData?.types || !locationTypesData?.subTypes) {
          console.error('MediaUploadModal: Invalid location types data structure:', locationTypesData);
          return;
        }

        // Transform media types
        const formattedMediaTypes = mediaTypesData.types.map(type => {
          const formatted: MediaTypeOption = {
            value: type.value,
            label: type.label,
            subTypes: mediaTypesData.subTypes[type.value]?.map(subType => ({
              value: subType.value,
              label: subType.label
            })) || []
          };
          return formatted;
        });

        // Transform location types
        const formattedLocationTypes = locationTypesData.types.map(type => {
          const formatted: LocationTypeOption = {
            value: type.value,
            label: type.label,
            subTypes: locationTypesData.subTypes[type.value]?.map(subType => ({
              value: subType.value,
              label: subType.label
            })) || []
          };
          return formatted;
        });

        setMediaTypes(formattedMediaTypes);
        setLocationTypes(formattedLocationTypes);
      } catch (error) {
        console.error('MediaUploadModal: Error fetching types:', error);
      }
    };

    if (isOpen) {
      fetchTypes();
    }
  }, [isOpen]);

  const handleFileAdd = useCallback((newFiles: File[]) => {
    const newMediaFiles: MediaFile[] = newFiles.map(file => ({
      id: uuidv4(),
      file,
      title: file.name,
      description: '',
      mediaType: DEFAULT_MEDIA_TYPE,
      mediaSubType: DEFAULT_MEDIA_SUBTYPE,
      locationType: DEFAULT_LOCATION_TYPE,
      locationSubType: DEFAULT_LOCATION_SUBTYPE,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newMediaFiles]);
    if (newMediaFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(newMediaFiles[0].id);
    }
  }, [selectedFileId]);

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
    if (selectedFileId === fileId) {
      const remainingFiles = files.filter(f => f.id !== fileId);
      setSelectedFileId(remainingFiles.length > 0 ? remainingFiles[0].id : null);
    }
  }, [files, selectedFileId]);

  const handleMetadataUpdate = useCallback((fileId: string, updates: Partial<MediaFile>) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, ...updates } : file
    ));
  }, []);

  const handleUpload = useCallback(async () => {
    if (isUploading || files.length === 0) return;

    setIsUploading(true);
    setAllUploadsSuccessful(false);
    let successCount = 0;

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('property_ref', propertyId);
        formData.append('original_filename', file.file.name);
        formData.append('mime_type', file.file.type);
        formData.append('file_type', file.file.type);
        formData.append('file_size', file.file.size.toString());
        formData.append('title', file.title);
        formData.append('description', file.description || '');
        formData.append('media_type', file.mediaType || 'OTHER');
        formData.append('media_sub_type', file.mediaSubType || 'OTHER');
        formData.append('location_type', file.locationType || '');
        formData.append('location_sub_type', file.locationSubType || '');

        // Update file status to uploading
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f
        ));

        try {
          const response = await fetch('/api/media/upload', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            },
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
            
            // Handle session expiration
            if (response.status === 401) {
              throw new Error('Session expired. Please refresh the page and try again.');
            }
            
            throw new Error(errorData.error || 'Upload failed');
          }

          const data = await response.json();

          // Update file status to success
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { 
              ...f, 
              status: 'success', 
              progress: 100,
              uploadedId: data.id,
              fileUrl: data.fileUrl,
              thumbnailUrl: data.thumbnailUrl
            } : f
          ));

          successCount++;
        } catch (error) {
          console.error(`Error uploading file ${file.title}:`, error);
          
          // Update file status to error
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } : f
          ));
        }
      }

      // Set all uploads successful if all files were uploaded successfully
      setAllUploadsSuccessful(successCount === files.length);
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, propertyId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-center justify-center">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black/30 transition-opacity" onClick={onClose} />

        {/* Modal content */}
        <div className="relative transform rounded-lg bg-gray-50 dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl sm:p-6">
          {/* Close button */}
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary-main focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div>
            <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4">
              Upload Media
            </h3>

            <DragDropArea
              onFilesSelected={handleFileAdd}
              className="mb-4"
            />

            <div className="grid grid-cols-2 gap-4 h-[500px]">
              <div className="rounded-lg p-4 overflow-hidden bg-gray-50 dark:bg-gray-800">
                <h4 className="font-medium mb-2">Selected Files</h4>
                <div className="h-[calc(100%-2rem)] overflow-y-auto">
                  <FileList
                    files={files}
                    selectedFileId={selectedFileId}
                    onFileSelect={setSelectedFileId}
                    onFileRemove={handleFileRemove}
                  />
                </div>
              </div>

              <div className="rounded-lg p-4 overflow-y-auto">
                <h4 className="font-medium mb-2">File Metadata</h4>
                {selectedFile ? (
                  <MetadataForm
                    file={selectedFile}
                    onUpdate={(updates) => handleMetadataUpdate(selectedFile.id, updates)}
                    mediaTypes={mediaTypes}
                    locationTypes={locationTypes}
                  />
                ) : (
                  <p className="text-gray-500 text-center mt-8">
                    Select a file to edit its metadata
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md bg-secondary-main px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
              onClick={handleClose}
            >
              {allUploadsSuccessful ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
