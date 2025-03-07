export type MediaType = 'IMAGE' | 'VIDEO' | 'FILE' | 'OTHER';
export type MediaSubType = 'REGULAR' | '360_DEGREE' | 'FLOORPLAN' | 'DOCUMENT' | 'OTHER';
export type LocationType = 'INTERIOR' | 'EXTERIOR' | 'OTHER' | '';
export type LocationSubType = 'KITCHEN' | 'BATHROOM' | 'BEDROOM' | 'LIVING_ROOM' | 'GARDEN' | 'POOL' | 'OTHER' | '';

// Constants for default values
/**
 * Default media type.
 */
export const DEFAULT_MEDIA_TYPE: MediaType = 'OTHER';
/**
 * Default media sub-type.
 */
export const DEFAULT_MEDIA_SUBTYPE: MediaSubType = 'OTHER';
/**
 * Default location type.
 */
export const DEFAULT_LOCATION_TYPE: LocationType = '';
/**
 * Default location sub-type.
 */
export const DEFAULT_LOCATION_SUBTYPE: LocationSubType = '';

/**
 * Interface for a media file.
 * 
 * @description Represents a media file with its properties.
 */
export interface MediaFile {
  /**
   * Unique identifier for the media file.
   */
  id: string;  // Required
  /**
   * The file object.
   */
  file: File;  // Required
  /**
   * Title of the media file.
   */
  title: string;  // Required
  /**
   * Optional description of the media file.
   */
  description?: string;
  /**
   * Type of media (e.g. image, video, file, etc.).
   */
  mediaType?: MediaType;
  /**
   * Sub-type of media (e.g. regular, 360 degree, floorplan, etc.).
   */
  mediaSubType?: MediaSubType;
  /**
   * Type of location (e.g. interior, exterior, etc.).
   */
  locationType?: LocationType;
  /**
   * Sub-type of location (e.g. living room, kitchen, etc.).
   */
  locationSubType?: LocationSubType;
  /**
   * Status of the media file (e.g. pending, uploading, success, error).
   */
  status: 'pending' | 'uploading' | 'success' | 'error';  // Required
  /**
   * Progress of the media file upload (in percentage).
   */
  progress: number;  // Required
  /**
   * Optional error message.
   */
  error?: string;
}

export interface MediaUploadItem {
  id: string;
  file: File;
  previewUrl?: string;
  error?: string;
  uploading?: boolean;
  progress?: number;
  uploaded?: boolean;
  fileUrl?: string;
  thumbnailUrl?: string;
  uploadedId?: string;
}

// Base type for API responses
export interface ApiTypeResponse {
  types: Array<{
    value: string;
    label: string;
  }>;
  subTypes: {
    [key: string]: Array<{
      value: string;
      label: string;
    }>;
  };
}

// Specific response types
export type MediaTypesResponse = ApiTypeResponse;
export type LocationTypesResponse = ApiTypeResponse;

// Base type for frontend options
export interface TypeOption {
  value: string;
  label: string;
  subTypes: Array<{
    value: string;
    label: string;
  }>;
}

export type MediaTypeOption = TypeOption;
export type LocationTypeOption = TypeOption;

// API response types
export interface LocationTypeResponse {
  id: number;
  name: string;
  sub_types: LocationSubTypeResponse[];
}

export interface LocationSubTypeResponse {
  id: number;
  name: string;
  parent_type: number;
}

export const CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime'
  ],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov']
};
