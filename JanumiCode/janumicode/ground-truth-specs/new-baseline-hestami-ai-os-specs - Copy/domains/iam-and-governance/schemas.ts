```typescript
// IAM and Governance - Prisma Schemas and Type Definitions

// 1. Core Organization Models
export type OrganizationType =
  | 'COMMUNITY_ASSOCIATION'
  | 'MANAGEMENT_COMPANY'
  | 'SERVICE_PROVIDER'
  | 'INDIVIDUAL_PROPERTY_OWNER'
  | 'TRUST_OR_LLC'
  | 'COMMERCIAL_CLIENT'
  | 'EXTERNAL_SERVICE_PROVIDER'
  | 'PLATFORM_OPERATOR';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface Organization {
  id: string; // cuid
  name: string;
  slug: string; // unique
  type: OrganizationType;
  status: OrganizationStatus; // default ACTIVE
  settings: Record<string, any> | null;
  externalContactName: string | null;
  externalContactEmail: string | null;
  externalContactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// 2. Staff and User Models
export interface User {
  id: string; // cuid
  email: string; // unique
  // ... other standard fields
}

export type StaffStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface Staff {
  id: string; // cuid
  userId: string; // Relation to User
  organizationId: string | null; // Nullable for Platform Staff, set for CAM Staff
  status: StaffStatus; // default PENDING
  activationCodeEncrypted: string | null; // AES-256-GCM
  activationCodeExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// 3. Sub-User Onboarding (Unified Invitation System)
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
export type DeliveryMethod = 'CODE' | 'EMAIL' | 'SMS';
export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface OrganizationInvitation {
  id: string; // cuid
  organizationId: string; // Relation to Organization
  email: string;
  role: string;
  invitedByUserId: string; // Relation to User
  codeEncrypted: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null; // Relation to User
  status: InvitationStatus; // default PENDING
  metadata: Record<string, any> | null; // JSON (unit number, etc.)
  deliveryMethod: DeliveryMethod; // default CODE
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JoinRequest {
  id: string; // cuid
  organizationId: string;
  userId: string;
  requestedRole: string;
  verificationData: Record<string, any> | null;
  status: JoinRequestStatus; // default PENDING
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  // @@unique([organizationId, userId])
}

// 4. Governance (CAM Specific) Models
export interface Party {
  id: string; // cuid
  // ... (Person or entity related to HOA)
}

export interface Board {
  id: string; // cuid
  organizationId: string;
  // ...
}

export interface BoardMember {
  id: string; // cuid
  boardId: string;
  partyId: string;
  role: string; // President, Treasurer, etc.
  termStartDate: Date;
  termEndDate: Date | null;
}

export type CommitteeRole = 'CHAIR' | 'VICE_CHAIR' | 'SECRETARY' | 'MEMBER';

export interface Committee {
  id: string; // cuid
  organizationId: string;
  name: string;
  description: string | null;
}

export interface CommitteeMember {
  id: string; // cuid
  committeeId: string;
  partyId: string;
  role: CommitteeRole;
}
```
