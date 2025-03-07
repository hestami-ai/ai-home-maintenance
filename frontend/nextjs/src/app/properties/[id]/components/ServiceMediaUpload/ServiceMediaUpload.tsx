'use client';

import React, { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { MediaUploadItem } from '../MediaUpload/types';
import { generateUniqueId, validateFile, createFilePreview } from '../MediaUpload/utils';
import FileInputArea from '../MediaUpload/FileInputArea';
import FilePreviewList from '../MediaUpload/FilePreviewList';

interface ServiceMediaUploadProps {
    propertyId: string;
    serviceType: 'record' | 'request';
    serviceRequestId?: string;
    onMediaUploaded: (mediaIds: string[]) => void;
    disabled?: boolean;
}

interface ExtendedMediaUploadItem extends MediaUploadItem {
    uploadedId?: string;
    previewUrl?: string;
    uploading?: boolean;
    progress?: number;
    uploaded?: boolean;
    error?: string;
    fileUrl?: string;
    thumbnailUrl?: string;
}

interface ServiceMediaUploadRef {
    uploadFiles: () => Promise<string[]>;
}

const ServiceMediaUpload = forwardRef<ServiceMediaUploadRef, ServiceMediaUploadProps>(({ propertyId, serviceType, serviceRequestId, onMediaUploaded, disabled = false }, ref) => {
    const [uploadItems, setUploadItems] = useState<ExtendedMediaUploadItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    const handleFilesSelected = useCallback(async (files: FileList | File[]) => {
        if (disabled) return;

        const newItems: ExtendedMediaUploadItem[] = [];

        for (const file of files) {
            const validation = validateFile(file);
            if (validation.isValid) {
                const previewUrl = await createFilePreview(file);
                newItems.push({
                    id: generateUniqueId(),
                    file,
                    previewUrl,
                    uploading: false,
                    progress: 0,
                    uploaded: false
                });
            }
        }

        if (newItems.length > 0) {
            setUploadItems(prev => [...prev, ...newItems]);
        }
    }, [disabled]);

    const handleRemoveItem = useCallback((id: string) => {
        setUploadItems(prev => prev.filter(item => item.id !== id));
        if (selectedItemId === id) {
            setSelectedItemId(null);
        }
    }, [selectedItemId]);

    const uploadFile = async (item: ExtendedMediaUploadItem) => {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('propertyId', propertyId);
        if (serviceRequestId) {
            formData.append('serviceRequestId', serviceRequestId);
        }
        formData.append('serviceType', serviceType);

        try {
            setUploadItems(prev => prev.map(i => 
                i.id === item.id ? { ...i, uploading: true, progress: 0 } : i
            ));

            const response = await fetch('/api/media/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            
            setUploadItems(prev => prev.map(i => 
                i.id === item.id ? { 
                    ...i, 
                    uploading: false, 
                    uploaded: true,
                    uploadedId: data.id,
                    fileUrl: data.fileUrl,
                    thumbnailUrl: data.thumbnailUrl
                } : i
            ));

            return data.id;
        } catch (error) {
            setUploadItems(prev => prev.map(i => 
                i.id === item.id ? { 
                    ...i, 
                    uploading: false, 
                    error: error instanceof Error ? error.message : 'Upload failed' 
                } : i
            ));
            return null;
        }
    };

    const uploadFiles = async () => {
        const uploadedIds: string[] = [];
        
        for (const item of uploadItems) {
            if (!item.uploaded && !item.error) {
                const id = await uploadFile(item);
                if (id) {
                    uploadedIds.push(id);
                }
            } else if (item.uploadedId) {
                uploadedIds.push(item.uploadedId);
            }
        }

        onMediaUploaded(uploadedIds);
        return uploadedIds;
    };

    useImperativeHandle(ref, () => ({
        uploadFiles
    }));

    return (
        <div className="space-y-4">
            <FileInputArea 
                onFilesSelected={handleFilesSelected}
                disabled={disabled}
            />
            <FilePreviewList 
                files={uploadItems}
                onRemove={handleRemoveItem}
            />
        </div>
    );
});

ServiceMediaUpload.displayName = 'ServiceMediaUpload';

export default ServiceMediaUpload;
