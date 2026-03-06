```typescript
// CAM and Associations - Prisma Schemas and Type Definitions

// 1. Core Association and Properties
export interface Association {
  id: string; // cuid
  organizationId: string; // Tier 1 isolation
  name: string;
  taxId: string | null;
}

export interface Unit {
  id: string;
  associationId: string;
  unitNumber: string;
  streetAddress: string;
}

// 2. Compliance: Violations
export type ViolationStatus = 'OPEN' | 'FIRST_NOTICE' | 'SECOND_NOTICE' | 'HEARING' | 'FINE_ASSESSED' | 'RESOLVED' | 'CLOSED';

export interface Violation {
  id: string; // cuid
  associationId: string;
  unitId: string;
  infractionType: string;
  description: string;
  status: ViolationStatus;
  createdAt: Date;
}

// 3. Governance: ARC Requests
export type ARCStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'MORE_INFO_NEEDED' | 'APPROVED' | 'APPROVED_CONDITIONS' | 'REJECTED';

export interface ArcRequest {
  id: string; // cuid
  associationId: string;
  unitId: string;
  projectType: string;
  description: string;
  status: ARCStatus;
  decisionRationale: string | null;
  createdAt: Date;
}

// 4. Maintenance: Work Orders
export type WorkOrderStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

export interface WorkOrder {
  id: string; // cuid
  associationId: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  assignedVendorId: string | null;
  priority: string;
  createdAt: Date;
}

// 5. Governance: Meetings & Boards
export interface BoardMember {
  id: string;
  associationId: string;
  userId: string;
  role: string; // President, Secretary, etc.
  termStart: Date;
  termEnd: Date | null;
}

export interface Meeting {
  id: string;
  associationId: string;
  title: string;
  meetingDate: Date;
  meetingType: 'ANNUAL' | 'BOARD' | 'SPECIAL';
  status: 'SCHEDULED' | 'COMPLETED' | 'MINUTES_APPROVED';
}

export interface Motion {
  id: string;
  meetingId: string;
  description: string;
  result: 'PASSED' | 'FAILED' | 'TABLED';
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
}

// 6. Unified Documents & Bindings
export type ContextType = 'VIOLATION' | 'ARC_REQUEST' | 'WORK_ORDER' | 'ASSOCIATION' | 'COMPLIANCE' | 'MEETING';

export interface Document {
  id: string; // cuid
  organizationId: string;
  associationId: string | null; 
  title: string;
}

export interface DocumentContextBinding {
  id: string;
  documentId: string;
  contextType: ContextType;
  contextId: string; 
}

// 7. Accounting
export interface Assessment {
  id: string;
  associationId: string;
  unitId: string;
  amountMinor: number;
  dueDate: Date;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
}

// 8. Financial / Reserve Studies (Legacy fields retained)
export interface ReserveComponent {
  id: string; 
  associationId: string;
  name: string;
  usefulLife: number;
  remainingLife: number;
  currentReplacementCostMinor: number;
}
```
