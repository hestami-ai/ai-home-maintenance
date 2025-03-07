'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface MediaPreviewProps {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  type?: string;
  className?: string;
}

export default function MediaPreview({ 
  url, 
  thumbnailUrl, 
  title, 
  type = 'image',
  className = ''
}: MediaPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isVideo = type.startsWith('video/') || url.match(/\.(mp4|mov)$/i);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <div 
        className={`group relative cursor-pointer ${className}`}
        onClick={handleOpen}
        role="button"
        aria-label={`View ${title || 'media'} in full screen`}
      >
        {isVideo ? (
          <video
            src={url}
            className="w-full h-full object-cover rounded-lg"
            controls={false}
          />
        ) : (
          <div className="relative w-full h-full">
            <Image
              src={thumbnailUrl || url}
              alt={title || ''}
              fill
              className="object-cover rounded-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
          <ArrowsPointingOutIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </div>
      </div>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/80" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="relative max-w-5xl w-full max-h-[90vh] overflow-hidden rounded-lg">
            <button
              onClick={handleClose}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/20 p-2 text-white hover:bg-black/40 focus:outline-none"
              aria-label="Close preview"
            >
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            {isVideo ? (
              <video
                src={url}
                className="w-full h-full object-contain"
                controls
                autoPlay
                controlsList="nodownload"
              />
            ) : (
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <Image
                  src={url}
                  alt={title || ''}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
            )}

            {title && (
              <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white p-4">
                <Dialog.Title className="text-lg font-medium">
                  {title}
                </Dialog.Title>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
