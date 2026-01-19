# Phase 38: Sub-User Onboarding Implementation Roadmap

**Version:** 1.0  
**Date:** January 18, 2026  
**Status:** Planning

---

## Overview

This roadmap outlines the implementation plan for enabling sub-user onboarding flows for existing organizations across all pillars (CAM, Contractor, Property Owner).

**Estimated Total Effort:** 8-12 days  
**Priority:** High

---

## Phase 38.1: Database Schema & Core Infrastructure

**Estimated Effort:** 2 days  
**Status:** ⬜ Not Started

### Tasks

- [ ] **38.1.1** Add `InvitationStatus` enum to Prisma schema
- [ ] **38.1.2** Add `JoinRequestStatus` enum to Prisma schema
- [ ] **38.1.3** Add `DeliveryMethod` enum to Prisma schema
- [ ] **38.1.4** Create `OrganizationInvitation` model in Prisma schema
- [ ] **38.1.5** Create `JoinRequest` model in Prisma schema (Phase 2 prep)
- [ ] **38.1.6** Add relations to `Organization` model
- [ ] **38.1.7** Add relations to `User` model
- [ ] **38.1.8** Generate and run Prisma migration
- [ ] **38.1.9** Generate Zod schemas from Prisma
- [ ] **38.1.10** Create SECURITY DEFINER function for invitation lookup

### Acceptance Criteria

- [ ] All new models exist in database
- [ ] Indexes are properly created for performance
- [ ] Zod schemas are generated and available

---

## Phase 38.2: Invitation API Routes

**Estimated Effort:** 2 days  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.1

### Tasks

- [ ] **38.2.1** Create `src/lib/server/api/routes/invitation.ts`
- [ ] **38.2.2** Implement `invitation.create` procedure
  - [ ] Input validation (email, role, organizationId)
  - [ ] Generate encrypted invitation code
  - [ ] Set expiration (default 72 hours)
  - [ ] Create invitation record
  - [ ] Record activity event
- [ ] **38.2.3** Implement `invitation.list` procedure
  - [ ] Filter by organization
  - [ ] Filter by status
  - [ ] Pagination support
- [ ] **38.2.4** Implement `invitation.get` procedure
- [ ] **38.2.5** Implement `invitation.resend` procedure
  - [ ] Regenerate code if expired
  - [ ] Update sentAt timestamp
- [ ] **38.2.6** Implement `invitation.revoke` procedure
  - [ ] Update status to REVOKED
  - [ ] Record activity event
- [ ] **38.2.7** Implement `invitation.accept` procedure
  - [ ] Validate code
  - [ ] Check expiration
  - [ ] Create organization membership
  - [ ] Update invitation status
  - [ ] Record activity event
- [ ] **38.2.8** Implement `invitation.pending` procedure
  - [ ] Return pending invitations for current user's email
- [ ] **38.2.9** Register invitation router in main API router
- [ ] **38.2.10** Create DBOS workflow for invitation lifecycle

### Acceptance Criteria

- [ ] All endpoints return correct responses
- [ ] Authorization checks prevent unauthorized access
- [ ] Activity events are recorded
- [ ] Idempotency keys work correctly

---

## Phase 38.3: Client-Side API Integration

**Estimated Effort:** 0.5 days  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.2

### Tasks

- [ ] **38.3.1** Create `src/lib/api/invitation.ts` client module
- [ ] **38.3.2** Export typed API functions:
  - [ ] `create()`
  - [ ] `list()`
  - [ ] `get()`
  - [ ] `resend()`
  - [ ] `revoke()`
  - [ ] `accept()`
  - [ ] `pending()`
- [ ] **38.3.3** Add to barrel export in `src/lib/api/index.ts`

### Acceptance Criteria

- [ ] All API functions are typed correctly
- [ ] Error handling matches other API modules

---

## Phase 38.4: Onboarding UI - Join Flow

**Estimated Effort:** 1.5 days  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.3

### Tasks

- [ ] **38.4.1** Update `/onboarding/+page.svelte`
  - [ ] Add fourth entry vector card for "Join Existing"
  - [ ] Add UserPlus icon import
- [ ] **38.4.2** Create `/onboarding/join/+page.svelte`
  - [ ] Two options: "I have a code" vs "Search for organization"
  - [ ] Route to appropriate sub-page
- [ ] **38.4.3** Create `/onboarding/join/+layout.svelte`
  - [ ] Consistent layout for join flow pages
  - [ ] Progress indicator (optional)
- [ ] **38.4.4** Create `/onboarding/join/invitation/+page.svelte`
  - [ ] Code input field (8 characters)
  - [ ] Submit handler calling `invitation.accept`
  - [ ] Success state with redirect
  - [ ] Error handling for invalid/expired codes
- [ ] **38.4.5** Create `/onboarding/join/invitation/+page.server.ts`
  - [ ] Handle form submission (progressive enhancement)
- [ ] **38.4.6** Add success confirmation page or redirect logic

### Acceptance Criteria

- [ ] Users can navigate to join flow from onboarding
- [ ] Invitation code entry works correctly
- [ ] Error states are clearly communicated
- [ ] Successful acceptance redirects to app

---

## Phase 38.5: Auto-Detection on Login

**Estimated Effort:** 1 day  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.2

### Tasks

- [ ] **38.5.1** Update `src/routes/+layout.server.ts`
  - [ ] Add pending invitations query
  - [ ] Return `pendingInvitations` in layout data
- [ ] **38.5.2** Create pending invitation banner component
  - [ ] Display organization name and role
  - [ ] "Accept" and "Dismiss" actions
- [ ] **38.5.3** Add banner to app layout
  - [ ] Show when `pendingInvitations.length > 0`
  - [ ] Dismissible with localStorage persistence
- [ ] **38.5.4** Update `src/routes/app/+layout.server.ts`
  - [ ] Check for pending invitations
  - [ ] Optional: redirect to acceptance flow

### Acceptance Criteria

- [ ] Users see pending invitations on login
- [ ] Banner is dismissible
- [ ] Accepting from banner works correctly

---

## Phase 38.6: CAM Pillar - Member Invitations

**Estimated Effort:** 1 day  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.4

### Tasks

- [ ] **38.6.1** Create `/app/cam/management/members/invite/+page.svelte`
  - [ ] Email input
  - [ ] Role selection (HOMEOWNER, BOARD_MEMBER, PROPERTY_MANAGER)
  - [ ] Unit/lot number input (for homeowners)
  - [ ] Board position input (for board members)
- [ ] **38.6.2** Create `/app/cam/management/members/invite/+page.server.ts`
  - [ ] Form action handler
- [ ] **38.6.3** Add "Invite Member" button to member list page
- [ ] **38.6.4** Create pending invitations tab in member management
- [ ] **38.6.5** Add invitation acceptance handler for CAM-specific membership creation
  - [ ] Create `CommunityMember` record on acceptance
  - [ ] Link to unit if applicable

### Acceptance Criteria

- [ ] CAM admins can invite homeowners
- [ ] CAM admins can invite board members
- [ ] Invitations include CAM-specific metadata
- [ ] Acceptance creates proper membership

---

## Phase 38.7: Contractor Pillar - Integration

**Estimated Effort:** 0.5 days  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.4

### Tasks

- [ ] **38.7.1** Review existing team member creation flow
  - [ ] `/app/contractor/admin/team/new/+page.svelte`
- [ ] **38.7.2** Migrate to use unified `OrganizationInvitation`
  - [ ] Update create handler to use invitation API
  - [ ] Maintain backward compatibility
- [ ] **38.7.3** Add pending invitations view to team management
- [ ] **38.7.4** Update activation flow to use unified system
  - [ ] `/staff/activate` → check both systems

### Acceptance Criteria

- [ ] Existing contractor team flow continues to work
- [ ] New invitations use unified system
- [ ] Activation works with both old and new codes

---

## Phase 38.8: Property Owner Pillar - Access Sharing

**Estimated Effort:** 1 day  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.4

### Tasks

- [ ] **38.8.1** Create `/app/property-owner/settings/access/+page.svelte`
  - [ ] List current access grants
  - [ ] "Invite" button
- [ ] **38.8.2** Create `/app/property-owner/settings/access/invite/+page.svelte`
  - [ ] Email input
  - [ ] Access level selection (CO_OWNER, TENANT, PROPERTY_MANAGER)
  - [ ] Property selection (if multiple)
- [ ] **38.8.3** Create invitation acceptance handler for property access
  - [ ] Create `PropertyAccess` record on acceptance

### Acceptance Criteria

- [ ] Property owners can invite co-owners
- [ ] Property owners can invite tenants
- [ ] Acceptance creates proper access record

---

## Phase 38.9: Email Notifications

**Estimated Effort:** 1 day  
**Status:** ⬜ Not Started  
**Dependencies:** Phase 38.2

### Tasks

- [ ] **38.9.1** Create invitation email template
  - [ ] Organization name
  - [ ] Inviter name
  - [ ] Role description
  - [ ] Magic link or code display
  - [ ] Expiration notice
- [ ] **38.9.2** Integrate with email service
  - [ ] Send on invitation creation (if delivery method = EMAIL)
  - [ ] Send on resend action
- [ ] **38.9.3** Create expiration reminder email template
  - [ ] Send 24 hours before expiration
- [ ] **38.9.4** Add email sending to invitation workflow

### Acceptance Criteria

- [ ] Invitation emails are sent correctly
- [ ] Magic links work for acceptance
- [ ] Reminder emails are sent before expiration

---

## Phase 38.10: Testing & QA

**Estimated Effort:** 1 day  
**Status:** ⬜ Not Started  
**Dependencies:** All previous phases

### Tasks

- [ ] **38.10.1** Write unit tests for invitation API routes
- [ ] **38.10.2** Write integration tests for invitation workflow
- [ ] **38.10.3** Write E2E tests for join flow
  - [ ] Happy path: code entry → acceptance → redirect
  - [ ] Error path: invalid code
  - [ ] Error path: expired code
- [ ] **38.10.4** Test CAM member invitation flow
- [ ] **38.10.5** Test contractor team invitation flow
- [ ] **38.10.6** Test property owner access invitation flow
- [ ] **38.10.7** Test auto-detection banner
- [ ] **38.10.8** Security testing
  - [ ] Rate limiting on code attempts
  - [ ] Authorization checks
  - [ ] Code encryption verification

### Acceptance Criteria

- [ ] All tests pass
- [ ] No security vulnerabilities
- [ ] Edge cases handled

---

## Progress Summary

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| 38.1 | Database Schema | ⬜ Not Started | 0/10 |
| 38.2 | Invitation API | ⬜ Not Started | 0/10 |
| 38.3 | Client API | ⬜ Not Started | 0/3 |
| 38.4 | Join Flow UI | ⬜ Not Started | 0/6 |
| 38.5 | Auto-Detection | ⬜ Not Started | 0/4 |
| 38.6 | CAM Integration | ⬜ Not Started | 0/5 |
| 38.7 | Contractor Integration | ⬜ Not Started | 0/4 |
| 38.8 | Property Owner Integration | ⬜ Not Started | 0/3 |
| 38.9 | Email Notifications | ⬜ Not Started | 0/4 |
| 38.10 | Testing & QA | ⬜ Not Started | 0/8 |

**Overall Progress:** 0/57 tasks (0%)

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not Started |
| 🟡 | In Progress |
| ✅ | Completed |
| ⏸️ | Blocked |
| ❌ | Cancelled |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Email delivery issues | Medium | Low | Use reliable email service, implement retry logic |
| Code brute-force attacks | High | Medium | Rate limiting, account lockout, monitoring |
| Migration complexity for contractor flow | Medium | Medium | Maintain backward compatibility, gradual migration |
| User confusion with dual flows | Medium | Low | Clear UI copy, contextual help |

---

## Dependencies

### Internal Dependencies
- Phase 16: Staff Management (completed)
- Phase 19: Staff Onboarding Flow (completed)
- Email service configuration
- Notification system

### External Dependencies
- None

---

## Rollback Plan

If issues arise post-deployment:
1. Disable "Join Existing" option in onboarding UI
2. Existing flows remain unaffected
3. Pending invitations can be manually processed
4. Database changes are additive (no breaking changes)

---

## Post-Implementation

### Monitoring
- Track invitation creation rate
- Track acceptance rate
- Monitor code validation failures
- Alert on unusual patterns (potential attacks)

### Documentation
- Update user guides for each pillar
- Create admin documentation for invitation management
- Update API documentation

### Future Enhancements (Out of Scope)
- Bulk invitation import (CSV)
- Organization discovery/marketplace
- SSO-based automatic assignment
- SMS invitation delivery
