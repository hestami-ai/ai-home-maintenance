'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import type { ViewerAPI } from 'react-photo-sphere-viewer';
import { GalleryPlugin } from '@photo-sphere-viewer/gallery-plugin';
import '@photo-sphere-viewer/gallery-plugin/index.css';

interface VirtualTourProps {
  tours: Array<{
    id: string;
    url: string;
    room?: string;
  }>;
  availableRooms: string[];
  onRoomSelect: (rooms: string[]) => void;
  selectedRooms: string[];
}

export default function VirtualTourSection({
  tours,
  availableRooms,
  onRoomSelect,
  selectedRooms
}: VirtualTourProps) {
  const [currentTourIndex, setCurrentTourIndex] = useState(0);
  const viewerRef = useRef<ViewerAPI>(null);

  const handleRoomToggle = (room: string) => {
    const newSelectedRooms = selectedRooms.includes(room)
      ? selectedRooms.filter(r => r !== room)
      : [...selectedRooms, room];
    onRoomSelect(newSelectedRooms);
  };

  const handleNextTour = () => {
    if (currentTourIndex < tours.length - 1) {
      setCurrentTourIndex(prev => prev + 1);
    }
  };

  const handlePrevTour = () => {
    if (currentTourIndex > 0) {
      setCurrentTourIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.zoom(0);
      viewerRef.current.rotate({
        yaw: 0,
        pitch: 0
      });
    }
  }, [currentTourIndex]);

  if (!tours.length) {
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-300">No virtual tours available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Room selection 
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevTour}
            disabled={currentTourIndex === 0}
            className={`p-1 rounded-full text-white transition-colors ${
              currentTourIndex === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            aria-label="Previous tour"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Currently viewing: {tours[currentTourIndex].room || 'Unnamed Room'} ({currentTourIndex + 1} of {tours.length})
          </span>
          <button
            onClick={handleNextTour}
            disabled={currentTourIndex === tours.length - 1}
            className={`p-1 rounded-full text-white transition-colors ${
              currentTourIndex === tours.length - 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            aria-label="Next tour"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      */}

      {/* Virtual Tour Viewer */}
      <div className="relative h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <ReactPhotoSphereViewer
          ref={viewerRef}
          src={tours[currentTourIndex].url}
          height="500px"
          width="100%"
          defaultZoomLvl={0}
          mousewheelCtrlKey={true}
          loadingImg="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          loadingTxt="Loading virtual tour..."
          plugins={[[GalleryPlugin, {
            visibleOnLoad: true,
            items: tours.map(tour => ({
              id: tour.id,
              name: tour.room || 'Unnamed Room',
              thumbnail: tour.url,
              panorama: tour.url,
            }))
          }]]}
          navbar={[
            'zoom',
            'gallery',
            'fullscreen',
            {
              id: 'custom-download',
              title: 'Download',
              className: 'custom-download-button',
              content: 'Download',
              onClick: () => {
                const currentTour = tours[currentTourIndex];
                if (currentTour) {
                  const link = document.createElement('a');
                  link.href = currentTour.url;
                  link.download = `virtual-tour-${currentTour.room || 'unnamed'}.jpg`;
                  link.click();
                }
              },
            },
          ]}
        />
      </div>

      {/* Room Selection 
      <div className="flex flex-wrap gap-2">
        {availableRooms.map(room => (
          <button
            key={room}
            onClick={() => handleRoomToggle(room)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedRooms.includes(room)
                ? 'bg-primary-main text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            {room}
          </button>
        ))}
      </div>
      */}
    </div>
  );
}
