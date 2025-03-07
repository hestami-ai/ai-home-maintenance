'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';

interface MainImageUploadProps {
  propertyId: string;
  currentImage?: string;
  onImageUpdated: () => void;
}

export default function MainImageUpload({
  propertyId,
  currentImage,
  onImageUpdated,
}: MainImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', message: '', type: 'success' as 'success' | 'error' });
  const [selectedLocationType, setSelectedLocationType] = useState<string>('');

  const showNotification = (title: string, message: string, type: 'success' | 'error') => {
    setToastMessage({ title, message, type });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedLocationType) {
      showNotification('Error', 'Please select both an image and a view type.', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('property_ref', propertyId);
    formData.append('original_filename', selectedFile.name);
    formData.append('mime_type', selectedFile.type);
    formData.append('file_type', selectedFile.type);
    formData.append('file_size', selectedFile.size.toString());
    formData.append('media_type', 'IMAGE');
    formData.append('media_sub_type', 'REGULAR');
    formData.append('location_type', 'EXTERIOR');
    formData.append('location_sub_type', selectedLocationType);

    try {
      const response = await fetch(`/api/media/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || 'Failed to upload image');
      }

      showNotification('Success', 'Main image has been updated successfully.', 'success');
      onImageUpdated();
      setShowConfirmDialog(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedLocationType('');
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('Error', error instanceof Error ? error.message : 'Failed to upload image. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Validate file type
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showNotification('Invalid file type', 'Please upload only JPEG or PNG images.', 'error');
        return;
      }

      // Validate file size (100MB)
      if (file.size > 100 * 1024 * 1024) {
        showNotification('File too large', 'Please upload an image smaller than 100MB.', 'error');
        return;
      }

      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setShowConfirmDialog(true);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false,
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`w-full h-96 relative bg-gray-200 dark:bg-gray-800 cursor-pointer transition-colors
          ${isDragActive ? 'bg-primary/10' : ''}`}
      >
        <input {...getInputProps()} />
        {currentImage ? (
          <Image
            src={currentImage}
            alt="Property main view"
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <svg
              className="h-24 w-24 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="mt-4 text-sm text-gray-500">
              {isDragActive
                ? 'Drop the image here...'
                : 'Drag and drop an image here, or click to select'}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-xl w-full p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {currentImage ? 'Update Main Image' : 'Add Main Image'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentImage
                  ? 'Are you sure you want to replace the current main image?'
                  : 'Would you like to set this as the main image?'
                }
              </p>
              <br />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                (NOTE: This image should be either the street view or map view of the property so that it is easily visible to potential contractors / service providers.)
              </p>
            </div>

            <div className={`grid ${currentImage ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {currentImage && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Current Image</p>
                  <div className="relative aspect-video">
                    <Image
                      src={currentImage}
                      alt="Current property main view"
                      fill
                      className="object-cover rounded-md"
                    />
                  </div>
                </div>
              )}
              {previewUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{currentImage ? 'New Image' : 'Selected Image'}</p>
                  <div className="relative aspect-video">
                    <Image
                      src={previewUrl}
                      alt="Preview of new property main view"
                      fill
                      className="object-cover rounded-md"
                    />
                  </div>
                  <select
                    value={selectedLocationType}
                    onChange={(e) => setSelectedLocationType(e.target.value)}
                    className="mt-4 w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    aria-label="Select view type for the property image"
                  >
                    <option value="">Select view type</option>
                    <option value="STREET_VIEW">Street View</option>
                    <option value="MAP_VIEW">Map View</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setSelectedLocationType('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : currentImage ? 'Update Image' : 'Add Image'}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg z-50 ${toastMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {toastMessage.type === 'success' ? (
                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">
                {toastMessage.title}
              </p>
              <p className="mt-1 text-sm text-white/80">
                {toastMessage.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
