/**
 * Hestami AI OS - Shared Kernel Types
 * These types are ubiquitous across all pillars.
 */

export type UUID = string;
export type ISO8601 = string;
export type Email = string;

export enum UserRole {
  RESIDENT = 'resident',
  CONCIERGE = 'concierge',
  VENDOR = 'vendor',
  CAM_MANAGER = 'cam_manager',
  ADMIN = 'admin'
}

export interface UserIdentity {
  id: UUID;
  email: Email;
  roles: UserRole[];
  createdAt: ISO8601;
  isActive: boolean;
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface SystemEvent<T = any> {
  eventId: UUID;
  topic: string;
  timestamp: ISO8601;
  payload: T;
  source: string;
}