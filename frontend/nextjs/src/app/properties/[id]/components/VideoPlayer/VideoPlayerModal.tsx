'use client';

import React, { useState } from 'react';

interface VideoPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoUrl: string;
    title?: string;
    description?: string;
    isCurrentOwner?: boolean;
    onSaveChanges?: (newTitle: string, newDescription: string) => Promise<void>;
    videoId?: string;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
    isOpen,
    onClose,
    videoUrl,
    title = 'Video Player',
    description = '',
    isCurrentOwner = false,
    onSaveChanges,
    videoId
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(title);
    const [editedDescription, setEditedDescription] = useState(description);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (onSaveChanges) {
            setIsSaving(true);
            try {
                await onSaveChanges(editedTitle, editedDescription);
                setIsEditing(false);
            } catch (error) {
                console.error('Failed to save changes:', error);
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75">
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="relative w-full max-w-4xl overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                    <div className="absolute top-0 right-0 pt-4 pr-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 focus:outline-none"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="w-full">
                            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                                <video
                                    className="w-full h-full object-contain"
                                    controls
                                    autoPlay={false}
                                >
                                    <source src={videoUrl} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                            
                            <div className="mt-4 space-y-4">
                                {/* Edit button */}
                                {isCurrentOwner && !isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        disabled
                                        className="disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 text-sm font-medium"
                                    >
                                        Edit Details
                                    </button>
                                )}

                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Title
                                            </label>
                                            <input
                                                type="text"
                                                id="title"
                                                value={editedTitle}
                                                onChange={(e) => setEditedTitle(e.target.value)}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Description
                                            </label>
                                            <textarea
                                                id="description"
                                                value={editedDescription}
                                                onChange={(e) => setEditedDescription(e.target.value)}
                                                rows={3}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            />
                                        </div>
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                            >
                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
                                        {description && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerModal;