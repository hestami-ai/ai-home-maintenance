'use client';

import React, { useState, useEffect } from 'react';
import ImageGallery from "next-image-gallery";

interface FloorplansSectionProps {
    images: {
        original: string;
        originalTitle: string;
        originalAlt: string;
        description: string;
        thumbnail: string;
        thumbnailTitle: string;
        thumbnailAlt: string;
        thumbnailLabel: string;
        thumbnailWidth: number;
        thumbnailHeight: number;
        originalWidth: number;
        originalHeight: number;
    }[];
    selectedRooms: Set<string>;
    availableRooms: string[];
    isImageGalleryLoaded: boolean;
    onToggleRoom: (roomName: string) => Promise<void>;
}

const FloorplansSection: React.FC<FloorplansSectionProps> = ({
    images,
    selectedRooms,
    availableRooms,
    isImageGalleryLoaded,
    onToggleRoom
}) => {
    const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        console.log('FloorplansSection mounted, isImageGalleryLoaded:', isImageGalleryLoaded);
        console.log('Floorplans array:', images);
    }, []);

    const handleImageLoad = () => {
        setIsImageLoading(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {availableRooms.map((room) => (
                    <button
                        key={room}
                        onClick={() => onToggleRoom(room)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
                            selectedRooms.has(room)
                                ? 'bg-hestami-red-dark text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        {room}
                    </button>
                ))}
            </div>
            <div className="rounded-xl">
                {mounted && images && images.length > 0 && isImageGalleryLoaded ? (
                    <div className="gallery-container relative">
                        {isImageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hestami-red-dark"></div>
                            </div>
                        )}
                        <ImageGallery
                            items={images}
                            showThumbnails={true}
                            showPlayButton={false}
                            showFullscreenButton={true}
                            showNav={true}
                            thumbnailPosition="bottom"
                            onImageLoad={handleImageLoad}
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-xl">
                        <p className="text-gray-500 dark:text-gray-400">
                            {mounted ? 'No floorplans available' : 'Loading floorplans...'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FloorplansSection;
