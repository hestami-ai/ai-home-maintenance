// User interface matching the backend response
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_role: string;
  phone_number?: string;
  service_provider?: string | null;
  [key: string]: any;
}

// Authentication tokens interface
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

// Authentication session type
export interface AuthSession {
  // For cookie-based auth
  accessToken?: string;
  refreshToken?: string;
  // For server-side session auth
  sessionId?: string;
  // User data
  user?: User;
  // Error information
  error?: string;
}

/**
 * Authentication endpoints
 * Centralized definition of all authentication-related API endpoints
 */
export const AUTH_ENDPOINTS = {
  LOGIN: '/api/users/login/',
  REFRESH: '/api/users/token/refresh/',
  LOGOUT: '/api/users/logout/',
  REGISTER: '/api/users/register/',
  PROFILE: '/api/users/profile/'
};

/**
 * Service Category enum matching Django's ServiceCategory TextChoices
 */
export enum ServiceCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  HVAC = 'HVAC',
  GENERAL_MAINTENANCE = 'GENERAL_MAINTENANCE',
  LANDSCAPING = 'LANDSCAPING',
  CLEANING = 'CLEANING',
  SECURITY = 'SECURITY',
  PEST_CONTROL = 'PEST_CONTROL',
  ROOFING = 'ROOFING',
  REMODELING = 'REMODELING',
  OTHER = 'OTHER'
}

/**
 * Service Request Priority enum matching Django's Priority TextChoices
 */
export enum ServicePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

/**
 * Service Request Status enum matching Django's Status TextChoices
 */
export enum ServiceStatus {
  PENDING = 'PENDING',
  IN_RESEARCH = 'IN_RESEARCH',
  BIDDING = 'BIDDING',
  REOPENED_BIDDING = 'REOPENED_BIDDING',
  ACCEPTED = 'ACCEPTED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DECLINED = 'DECLINED'
}

/**
 * API response interface
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers?: Headers;
}

/**
 * API error interface
 */
export interface ApiError {
  status: number;
  message: string;
  details?: any;
}

/**
 * Property descriptives interface
 */
export interface PropertyDescriptives {
  garage?: boolean;
  basement?: boolean;
  bedrooms?: string;
  bathrooms?: string;
  utilities?: {
    gas?: string;
    sewer?: string;
    water?: string;
    electricity?: string;
    internetCable?: string;
  };
  yearBuilt?: string;
  unitNumber?: string;
  propertyType?: string;
  heatingSystem?: string;
  squareFootage?: string;
  gatedCommunity?: boolean;
  airConditioning?: boolean;
  [key: string]: any; // Allow for additional fields
}

/**
 * Service provider details interface
 */
export interface ServiceProviderDetails {
  id: string;
  users_details: User[];
  company_name: string;
  description: string;
  service_area: any; // GeoJSON object
  is_available: boolean;
  rating: string;
  total_reviews: number;
  average_rating: string;
  categories_info: any[];
  created_at: string;
  updated_at: string;
}

/**
 * Property details interface
 */
export interface PropertyDetails {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
}

/**
 * Schedule interface
 */
export interface Schedule {
  date: string;
  flexible: boolean;
}

/**
 * Service request interface
 */
export interface ServiceRequest {
  id: string;
  property: string;
  property_details: PropertyDetails;
  category: string;
  category_display: string;
  provider: string | null;
  provider_details: ServiceProviderDetails | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  preferred_schedule: Schedule;
  estimated_duration: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  estimated_cost: string | null;
  final_cost: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_details: User;
  budget_minimum: number | null;
  budget_maximum: number | null;
  bid_submission_deadline: string | null;
  selected_provider: string | null;
  selected_provider_details: ServiceProviderDetails | null;
  runner_up_provider: string | null;
  runner_up_provider_details: ServiceProviderDetails | null;
  bids: any[];
  clarifications: any[];
  media_details: any[];
  is_diy: boolean;
  research_entries: any[];
}

/**
 * Media interface for property images, videos, and documents
 */
export interface Media {
  id: string;
  property_ref: string;
  service_request: string | null;
  service_report: string | null;
  report_photo_type: string | null;
  uploader: string;
  file: string;
  file_type: string;
  file_size: number;
  title: string;
  description: string;
  upload_date: string;
  file_url: string;
  thumbnail_small_url: string;
  thumbnail_medium_url: string;
  thumbnail_large_url: string;
  is_image: boolean;
  is_video: boolean;
  media_type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'OTHER';
  media_sub_type: string;
  location_type: string;
  location_sub_type: string;
  location_display: string;
  parent_type: string;
  original_filename: string;
  mime_type: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  processing_status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  metadata?: {
    scan_status?: 'SCANNING' | 'COMPLETED' | 'FAILED';
    is_safe?: boolean;
    scan_message?: string;
    scan_date?: string;
    [key: string]: any;
  };
}

/**
 * Property interface
 */
export interface Property {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county?: string;
  country: string;
  status: string;
  created_at: string;
  updated_at: string;
  owner: string;
  owner_details: User;
  media_count: number;
  descriptives: PropertyDescriptives;
  service_requests: ServiceRequest[];
  // Extended fields for media handling
  featuredImage?: string | null;
  media?: Media[];
}

/**
 * Property creation input interface
 */
export interface PropertyInput {
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  descriptives?: PropertyDescriptives;
}
