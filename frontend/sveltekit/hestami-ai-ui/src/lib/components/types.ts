/**
 * Type definitions for the ImageGallery component
 */

/**
 * Interface for property images with metadata
 */
export interface PropertyImage {
    id: string;
    url: string;
    thumbnail?: string;
    area?: string; // e.g., 'kitchen', 'bathroom', 'living room'
    uploadDate: Date;
    description?: string;
    tags?: string[];
    width?: number;
    height?: number;
}

/**
 * Interface for gallery items in the ImageGallery component
 */
export interface GalleryItem {
    original: string;
    thumbnail: string;
    fullscreen?: string;
    originalHeight?: number;
    originalWidth?: number;
    loading?: 'lazy' | 'eager';
    thumbnailHeight?: number;
    thumbnailWidth?: number;
    thumbnailLoading?: 'lazy' | 'eager';
    originalClass?: string;
    thumbnailClass?: string;
    renderItem?: (item: GalleryItem) => any; // SvelteComponent
    renderThumbInner?: (item: GalleryItem) => any; // SvelteComponent
    originalAlt?: string;
    thumbnailAlt?: string;
    originalTitle?: string;
    thumbnailTitle?: string;
    thumbnailLabel?: string;
    description?: string;
    srcSet?: string;
    sizes?: string;
    bulletClass?: string;
    type?: 'image' | 'video';
    tags?: string[];
}

/**
 * Props interface for the ImageGallery component
 */
export interface ImageGalleryProps {
    items: GalleryItem[];
    startIndex?: number;
    showThumbnails?: boolean;
    showFullscreenButton?: boolean;
    showPlayButton?: boolean;
    showBullets?: boolean;
    showNav?: boolean;
    autoPlay?: boolean;
    slideInterval?: number;
    slideDuration?: number;
    thumbnailPosition?: 'top' | 'bottom' | 'left' | 'right';
    galleryClass?: string;
    thumbnailsClass?: string;
    mainViewerClass?: string;
    navButtonsClass?: string;
    showTags?: boolean;
    tagContainerClass?: string;
    tagClass?: string;
    activeTagClass?: string;
    clearFilterClass?: string;
}
