'use client';

import React, { useMemo, useState } from 'react';
import Image from "next/image";
import { PropertyMedia } from "../page";
import VideoPlayerModal from './VideoPlayer/VideoPlayerModal';

interface VideosSectionProps {
    videos?: PropertyMedia[];
    isCurrentOwner: boolean;
    onVideoUpdated: () => void;
    onOpenUploadModal: () => void;
}

const VideosSection: React.FC<VideosSectionProps> = ({
    videos = [],
    isCurrentOwner,
    onVideoUpdated,
    onOpenUploadModal
}) => {
    const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
    const [videoFilter, setVideoFilter] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<PropertyMedia | null>(null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    const handleImageLoad = () => {
        setIsImageLoading(false);
    };

    const filteredVideos = useMemo(() => {
        if (!videos) return [];

        const searchTerm = videoFilter.toLowerCase();
        return videos.filter(video =>
            video.media_type === 'VIDEO' &&
            !video.is_deleted &&
            (video.title?.toLowerCase().includes(searchTerm) ||
                video.description?.toLowerCase().includes(searchTerm))
        );
    }, [videos, videoFilter]);

    const handleVideoClick = (video: PropertyMedia) => {
        setSelectedVideo(video);
        setIsVideoModalOpen(true);
    };

    const handleSaveChanges = async (newTitle: string, newDescription: string) => {
        if (!selectedVideo) return;

        try {
            const response = await fetch(`/api/media/${selectedVideo.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: newTitle,
                    description: newDescription,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update video details');
            }

            onVideoUpdated();
        } catch (error) {
            console.error('Error updating video:', error);
            throw error;
        }
    };

    return (
        <div className="mt-4 border dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={videoFilter}
                        onChange={(e) => setVideoFilter(e.target.value)}
                        className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <svg
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto pr-2">
                {filteredVideos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredVideos.map((video) => (
                            <div
                                key={video.id}
                                className="cursor-pointer transition-all duration-200 hover:scale-105 group"
                                onClick={() => handleVideoClick(video)}
                            >
                                <div className="relative aspect-video rounded-lg overflow-hidden">
                                    {isImageLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                        </div>
                                    )}
                                    <Image
                                        src={video.thumbnail_large_url}
                                        alt={video.title || 'Video thumbnail'}
                                        fill
                                        className="object-cover transition-transform group-hover:scale-105"
                                        onLoad={handleImageLoad}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-20 transition-opacity">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg
                                                className="w-12 h-12 text-white opacity-80 group-hover:opacity-100"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {video.title || 'Untitled Video'}
                                    </h4>
                                    {video.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                            {video.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <p className="text-gray-500 dark:text-gray-400">No videos available</p>
                    </div>
                )}
            </div>

            {selectedVideo && (
                <VideoPlayerModal
                    isOpen={isVideoModalOpen}
                    onClose={() => setIsVideoModalOpen(false)}
                    videoUrl={selectedVideo.file_url}
                    title={selectedVideo.title}
                    description={selectedVideo.description}
                    isCurrentOwner={isCurrentOwner}
                    onSaveChanges={handleSaveChanges}
                    videoId={selectedVideo.id}
                />
            )}
        </div>
    );
};

export default VideosSection;
