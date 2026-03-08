import { UUID, ISO8601, UserIdentity } from '../00_SYSTEM_MANIFEST/shared_types';

export interface ResidentProfile {
  id: UUID;
  identityId: UUID; // Links to UserIdentity
  unitId: UUID;
  moveInDate: ISO8601;
  leaseEndDate?: ISO8601;
  preferences: {
    notifyByEmail: boolean;
    notifyBySms: boolean;
    allowFrontDeskPackageSign: boolean;
  };
}

export enum ServiceRequestStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface ServiceRequest {
  id: UUID;
  requesterId: UUID; // Resident
  unitId: UUID;
  category: 'maintenance' | 'cleaning' | 'transport' | 'other';
  description: string;
  images: string[]; // URLs
  status: ServiceRequestStatus;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface Parcel {
  id: UUID;
  recipientId: UUID;
  carrier: string;
  trackingNumber?: string;
  receivedAt: ISO8601;
  pickedUpAt?: ISO8601;
  storageLocation: string;
}