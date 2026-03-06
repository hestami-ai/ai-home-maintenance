```typescript
// Concierge Domain - Prisma Schemas and Type Definitions

export type ConciergeCaseStatus = 'INTAKE' | 'PENDING_OWNER' | 'ASSESSMENT' | 'PENDING_EXTERNAL' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type CasePriority = 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW';
export type CaseNoteType = 'GENERAL' | 'CLARIFICATION_REQUEST' | 'DECISION_RATIONALE';

export interface PropertyPortfolio {
  id: string; // cuid
  organizationId: string; // The Owner's Organization
  name: string;
  description: string | null;
  // ...
}

export interface IndividualProperty {
  id: string; // cuid
  ownerOrgId: string;
  name: string;
  propertyType: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string; // mapped from Globalization models later
  zipCode: string; // postalCode
  metadata: any | null; // yearBuilt, sqft, beds, baths
  externalHoa: any | null; 
}

export interface PortfolioProperty {
  id: string; // cuid
  portfolioId: string;
  propertyId: string;
}

export interface OwnerIntent {
  id: string; // cuid
  propertyId: string;
  category: string;
  urgency: string; // mapped to CasePriority
  title: string;
  description: string;
}

export interface ConciergeCase {
  id: string; // cuid
  caseNumber: string; // auto-generated
  propertyId: string;
  title: string;
  description: string;
  status: ConciergeCaseStatus;
  priority: CasePriority;
  linkedArcRequestId: string | null; // Link upstream to CAM ARC
  linkedWorkOrderId: string | null; // Link upstream to CAM WO
  intentId: string | null; // Link upstream to OwnerIntent
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseNote {
  id: string; // cuid
  caseId: string;
  authorId: string;
  noteType: CaseNoteType;
  content: string;
  createdAt: Date;
}
```
