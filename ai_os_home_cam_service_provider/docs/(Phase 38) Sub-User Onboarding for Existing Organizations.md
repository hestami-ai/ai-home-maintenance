# Phase 38: Sub-User Onboarding for Existing Organizations

## Systems Requirements Document

**Version:** 1.0  
**Date:** January 18, 2026  
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Problem Statement

The current onboarding flow only supports users who are creating new organizations. Users who need to join an **existing organization** as sub-users (e.g., homeowners joining a community association, technicians joining a contractor company) are incorrectly funneled into organization creation flows.

### 1.2 Affected User Types

| Pillar | User Type | Current Experience | Expected Experience |
|--------|-----------|-------------------|---------------------|
| CAM | Homeowner | Offered "Create Community Association" | Join existing HOA/community |
| CAM | Board Member | Offered "Create Community Association" | Join existing board |
| CAM | Property Manager | Offered "Create Management Company" | Join existing management company |
| Contractor | Technician | Offered "Create Service Provider" | Join existing contractor company |
| Contractor | Office Staff | Offered "Create Service Provider" | Join existing contractor company |
| Property Owner | Co-owner/Tenant | Offered "Create Property Owner Org" | Join existing property organization |

### 1.3 Solution Overview

Implement a dual-path onboarding system that distinguishes between:
1. **Organization Creators** - Users establishing new organizations (existing flow)
2. **Organization Joiners** - Users joining existing organizations (new flow)

---

## 2. Functional Requirements

### 2.1 Unified Invitation System

#### FR-2.1.1 Organization Invitation Entity
The system SHALL support a generic `OrganizationInvitation` entity that works across all pillars.

**Required Fields:**
- `id` - Unique identifier
- `organizationId` - Target organization
- `email` - Invitee email address
- `role` - Intended role within organization
- `invitedByUserId` - User who created the invitation
- `codeEncrypted` - Encrypted invitation/activation code
- `expiresAt` - Expiration timestamp
- `status` - PENDING | ACCEPTED | EXPIRED | REVOKED
- `metadata` - JSON field for pillar-specific data (unit number, employee ID, etc.)
- `createdAt` - Creation timestamp

#### FR-2.1.2 Invitation Code Generation
The system SHALL generate secure, time-limited invitation codes:
- 8-character alphanumeric codes
- Encrypted at rest
- Default expiration: 72 hours (configurable per organization)
- Single-use (consumed on acceptance)

#### FR-2.1.3 Invitation Delivery Methods
The system SHALL support multiple invitation delivery methods:
- **Code Display** - Admin receives code to share manually
- **Email Invitation** - System sends email with magic link
- **SMS Invitation** - System sends SMS with code (future phase)

### 2.2 Onboarding Entry Point Updates

#### FR-2.2.1 Join Existing Option
The onboarding page SHALL display a fourth entry vector: "Join Existing Organization"

#### FR-2.2.2 Invitation Code Entry
The system SHALL provide a dedicated page for entering invitation codes at `/onboarding/join/invitation`

#### FR-2.2.3 Organization Search (Phase 2)
The system SHALL allow users to search for organizations to request membership:
- Search by organization name
- Search by organization code/slug
- Search by address (for communities)

### 2.3 Admin Invitation Management

#### FR-2.3.1 Invite Member Interface
Each pillar's admin interface SHALL include an "Invite Member" action:
- CAM: `/app/cam/management/members/invite`
- Contractor: `/app/contractor/admin/team/new` (existing, needs enhancement)
- Property Owner: `/app/property-owner/settings/access/invite`

#### FR-2.3.2 Pending Invitations List
Admins SHALL be able to view and manage pending invitations:
- List all pending invitations
- Resend invitation
- Revoke invitation
- View invitation history

#### FR-2.3.3 Join Request Management (Phase 2)
Admins SHALL be able to review and approve/reject join requests:
- List pending requests
- View requester details and verification info
- Approve with role assignment
- Reject with optional reason

### 2.4 Auto-Detection and Routing

#### FR-2.4.1 Pending Invitation Detection
On user login, the system SHALL check for pending invitations matching the user's email.

#### FR-2.4.2 Invitation Prompt
If pending invitations exist, the system SHALL prompt the user to accept or dismiss.

#### FR-2.4.3 Post-Signup Routing
After signup, users with pending invitations SHALL be routed to the invitation acceptance flow instead of the standard onboarding.

### 2.5 Pillar-Specific Requirements

#### FR-2.5.1 CAM Pillar - Community Member Onboarding
- Homeowner invitations SHALL include unit/lot information
- Board member invitations SHALL include position/seat information
- Property manager invitations SHALL include assigned communities

#### FR-2.5.2 Contractor Pillar - Team Member Onboarding
- Existing activation code flow SHALL be integrated with unified system
- Role selection SHALL use existing `ServiceProviderRole` enum
- Team member invitations SHALL support multiple role assignment

#### FR-2.5.3 Property Owner Pillar - Access Sharing
- Co-owner invitations SHALL specify access level
- Tenant invitations SHALL include lease period (optional)
- Property manager invitations SHALL specify managed properties

---

## 3. Non-Functional Requirements

### 3.1 Security

#### NFR-3.1.1 Invitation Code Security
- Codes SHALL be cryptographically random
- Codes SHALL be encrypted at rest using AES-256
- Failed attempts SHALL be rate-limited (5 attempts per 15 minutes)
- Expired codes SHALL be automatically purged after 30 days

#### NFR-3.1.2 Authorization
- Only organization admins/owners SHALL create invitations
- Invitation acceptance SHALL require authenticated session
- Email verification SHALL be required before invitation acceptance

### 3.2 Performance

#### NFR-3.2.1 Invitation Lookup
- Invitation code lookup SHALL complete in < 100ms
- Pending invitation check on login SHALL not add > 50ms latency

### 3.3 Auditability

#### NFR-3.3.1 Activity Logging
All invitation actions SHALL be recorded in the activity timeline:
- Invitation created
- Invitation sent
- Invitation accepted
- Invitation revoked
- Invitation expired

---

## 4. Data Model

### 4.1 New Entities

```prisma
model OrganizationInvitation {
  id                  String              @id @default(cuid())
  organizationId      String
  email               String
  role                String
  invitedByUserId     String
  codeEncrypted       String?
  expiresAt           DateTime
  acceptedAt          DateTime?
  acceptedByUserId    String?
  status              InvitationStatus    @default(PENDING)
  metadata            Json?
  deliveryMethod      DeliveryMethod      @default(CODE)
  sentAt              DateTime?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  organization        Organization        @relation(fields: [organizationId], references: [id])
  invitedBy           User                @relation("InvitedBy", fields: [invitedByUserId], references: [id])
  acceptedBy          User?               @relation("AcceptedBy", fields: [acceptedByUserId], references: [id])

  @@index([email, status])
  @@index([organizationId, status])
  @@index([codeEncrypted])
}

model JoinRequest {
  id                  String              @id @default(cuid())
  organizationId      String
  userId              String
  requestedRole       String
  verificationData    Json?
  status              JoinRequestStatus   @default(PENDING)
  reviewedByUserId    String?
  reviewedAt          DateTime?
  rejectionReason     String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  organization        Organization        @relation(fields: [organizationId], references: [id])
  user                User                @relation(fields: [userId], references: [id])
  reviewedBy          User?               @relation("ReviewedBy", fields: [reviewedByUserId], references: [id])

  @@unique([organizationId, userId])
  @@index([organizationId, status])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum JoinRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum DeliveryMethod {
  CODE
  EMAIL
  SMS
}
```

### 4.2 Modified Entities

#### Organization
Add relation to invitations:
```prisma
model Organization {
  // ... existing fields
  invitations         OrganizationInvitation[]
  joinRequests        JoinRequest[]
}
```

---

## 5. API Specifications

### 5.1 Invitation Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rpc/invitation.create` | Create new invitation |
| GET | `/api/v1/rpc/invitation.list` | List invitations for organization |
| GET | `/api/v1/rpc/invitation.get` | Get invitation by ID |
| POST | `/api/v1/rpc/invitation.resend` | Resend invitation email |
| POST | `/api/v1/rpc/invitation.revoke` | Revoke pending invitation |
| POST | `/api/v1/rpc/invitation.accept` | Accept invitation (by code) |
| GET | `/api/v1/rpc/invitation.pending` | Get pending invitations for current user |

### 5.2 Join Request Routes (Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rpc/joinRequest.create` | Submit join request |
| GET | `/api/v1/rpc/joinRequest.list` | List requests for organization |
| POST | `/api/v1/rpc/joinRequest.approve` | Approve join request |
| POST | `/api/v1/rpc/joinRequest.reject` | Reject join request |
| POST | `/api/v1/rpc/joinRequest.cancel` | Cancel own request |

---

## 6. User Interface Specifications

### 6.1 Onboarding Entry Page Updates

**Location:** `/onboarding`

Add fourth card option:
- **Title:** "I was invited to join"
- **Subtitle:** "Join Organization"
- **Description:** "Enter an invitation code or find your organization to request access."
- **Icon:** UserPlus
- **Route:** `/onboarding/join`

### 6.2 New Pages

| Route | Purpose |
|-------|---------|
| `/onboarding/join` | Join flow entry - code or search |
| `/onboarding/join/invitation` | Enter invitation code |
| `/onboarding/join/search` | Search for organization (Phase 2) |
| `/onboarding/join/request` | Submit join request (Phase 2) |
| `/app/[pillar]/admin/invitations` | Manage invitations |

### 6.3 Admin Interface Enhancements

Each pillar admin section needs:
- "Invite Member" button in team/member list header
- Pending invitations tab/section
- Invitation history view

---

## 7. Integration Points

### 7.1 Email Service
- Invitation email templates
- Magic link generation
- Expiration reminder emails

### 7.2 Activity Timeline
- Record all invitation lifecycle events
- Link to relevant organization and users

### 7.3 Notification System
- Admin notification on join request
- User notification on invitation
- User notification on request approval/rejection

---

## 8. Migration Strategy

### 8.1 Existing Activation Codes
The existing `Staff` and `ServiceProviderTeamMember` activation code fields should be:
1. Maintained for backward compatibility
2. Gradually migrated to unified `OrganizationInvitation` system
3. Deprecated after full migration

### 8.2 Data Migration
No existing data migration required - this is a new feature.

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Sub-user onboarding completion rate | > 80% |
| Time from invitation to acceptance | < 24 hours (median) |
| Invitation expiration rate | < 20% |
| Support tickets for onboarding issues | 50% reduction |

---

## 10. Dependencies

- Phase 16: Staff Management (completed) - activation code pattern
- Phase 19: Staff Onboarding Flow (completed) - contractor team flow
- Email service integration
- Notification system

---

## 11. Out of Scope

- SSO/SAML-based automatic organization assignment
- Bulk invitation import (CSV)
- Organization discovery/marketplace
- Cross-organization transfers
