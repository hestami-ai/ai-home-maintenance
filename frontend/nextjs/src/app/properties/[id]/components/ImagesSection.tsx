'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from "next/image";
import ImageGallery from "next-image-gallery";

interface ImagesSectionProps {
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
    onOpenUploadModal: () => void;
}

const ImagesSection: React.FC<ImagesSectionProps> = ({
    images,
    selectedRooms,
    availableRooms,
    isImageGalleryLoaded,
    onToggleRoom,
    onOpenUploadModal
}) => {
    const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
    const [mounted, setMounted] = useState(false);
    const [galleryKey, setGalleryKey] = useState(0);

    useEffect(() => {
        setMounted(true);
        console.log('Component mounted, isImageGalleryLoaded:', isImageGalleryLoaded);
        console.log('Images array:', images);
        console.log('Selected rooms:', Array.from(selectedRooms));
    }, []);

    const isInitialRender = useRef(true);

    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }
        
        setGalleryKey(prevKey => prevKey + 1);
        setIsImageLoading(true);
        console.log('Selected rooms updated:', Array.from(selectedRooms));
    }, [images.length, selectedRooms.size]);

    const handleImageLoad = () => {
        setIsImageLoading(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
                {availableRooms.map((room) => (
                    <button
                        key={room}
                        onClick={() => onToggleRoom(room)}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors
                            ${selectedRooms.has(room) 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
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
                            key={galleryKey}
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
                        <p className="text-gray-500 dark:text-gray-400">No images available</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImagesSection;
