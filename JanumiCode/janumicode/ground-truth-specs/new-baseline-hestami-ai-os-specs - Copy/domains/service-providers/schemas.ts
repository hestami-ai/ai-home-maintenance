```typescript
// Service Providers - Prisma Schemas and Type Definitions

export type JobStatus = 
  | 'LEAD' 
  | 'TICKET' 
  | 'ESTIMATE_REQUIRED' 
  | 'ESTIMATE_SENT' 
  | 'ESTIMATE_APPROVED' 
  | 'JOB_CREATED' 
  | 'SCHEDULED' 
  | 'DISPATCHED' 
  | 'IN_PROGRESS' 
  | 'ON_HOLD' 
  | 'COMPLETED' 
  | 'INVOICED' 
  | 'PAID' 
  | 'CLOSED' 
  | 'CANCELLED';

export interface ContractorProfile {
  id: string; // cuid
  organizationId: string; // The Service Provider Org
  businessName: string;
  tradeLicenseNumber: string | null;
}

export interface Technician {
  id: string; // cuid
  organizationId: string;
  userId: string; // Link to base system user
  skills: string[]; // specialized skills
  isActive: boolean;
}

export interface Job {
  id: string; // cuid
  jobSequenceNumber: string; // user-friendly id
  organizationId: string; // The contractor performing the work
  originModule: 'CAM' | 'CONCIERGE' | 'DIRECT' | 'PREVENTIVE';
  originReferenceId: string | null; // Links to WorkOrder or ConciergeCase without foreign key constraints cross-tenant
  status: JobStatus;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DispatchAssignment {
  id: string; // cuid
  jobId: string;
  technicianId: string;
  assignedAt: Date;
  acknowledgedAt: Date | null;
}

export interface Estimate {
  id: string; // cuid
  jobId: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED';
  sentAt: Date | null;
  acceptedAt: Date | null;
  declinedReason: string | null;
}

export interface EstimateLine {
  id: string; // cuid
  estimateId: string;
  description: string;
  quantity: number; // Decimal wrapper
  unitPrice: number; // BigInt minor currency or Decimal depending on Globalization phase
  isTaxable: boolean;
  tier: 'GOOD' | 'BETTER' | 'BEST' | 'STANDARD';
}

export interface JobInvoice {
  id: string; // cuid
  jobId: string;
  invoiceNumber: string;
  dueDate: Date;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOID';
  totalMinor: number; 
  balanceMinor: number; 
}

export interface Payment {
  id: string; // cuid
  invoiceId: string;
  amountMinor: number;
  paymentMethod: string;
  referenceId: string | null;
  createdAt: Date;
}
```
