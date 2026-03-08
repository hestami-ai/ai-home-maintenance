import { UUID, ISO8601 } from '../00_SYSTEM_MANIFEST/shared_types';
import { ServiceRequest, ServiceRequestStatus } from './domain_models';

// --- Resident Onboarding ---
export interface RegisterResidentRequest {
  email: string;
  firstName: string;
  lastName: string;
  unitId: UUID;
  leaseStart: ISO8601;
}

export interface RegisterResidentResponse {
  residentId: UUID;
  tempPassword?: string; // If auto-generated
  status: 'pending_verification' | 'active';
}

// --- Service Requests ---
export interface CreateServiceRequestPayload {
  category: string;
  description: string;
  priority: 'low' | 'normal' | 'high';
  preferredTimeSlots?: ISO8601[];
}

export interface UpdateServiceRequestStatusPayload {
  requestId: UUID;
  status: ServiceRequestStatus;
  notes?: string;
}