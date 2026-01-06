# (Phase 28) Governance and Staff Management Requirements

## 1. Overview
This document outlines the requirements for implementing the missing Board/Committee and Staff management interfaces within the Community Association Management (CAM) pillar. The goal is to provide Community Associations (self-managed) and Management Companies with the tools necessary to manage their governance structures and internal personnel.

## 2. Target Users
- **CAM Management Company Admins**: Need to manage their internal staff, assign roles, and control pillar access.
- **Community Association Managers (Self-Managed)**: Need to manage Board of Directors and various Committees.
- **Board Members**: Need visibility into committee structures and staff assignments.

## 3. Functional Requirements

### 3.1 Staff and Role Management (For CAM Organizations)
- **Staff Directory**: A centralized list of all employees within the organization.
- **Staff Onboarding**: Ability to invite/create staff profiles linked to platform users.
- **Role Assignment**: Assign one or more `StaffRole` (e.g., `CAM_SPECIALIST`, `OPERATIONS_COORDINATOR`).
- **Pillar Access Control**: 
  > [!IMPORTANT]
  > **CAM Pillar Restriction**: Both `MANAGEMENT_COMPANY` and `COMMUNITY_ASSOCIATION` (self-managed) organizations are restricted **ONLY** to the `CAM` pillar. Staff members in these organizations cannot be granted access to `CONCIERGE` or `CONTRACTOR` pillars.
- **Status Lifecycle**: Manage staff status (`PENDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`).
- **Multi-tenancy**: Staff must be explicitly linked to an `Organization` for scoped management.
- **Email Invitations**: Deferred until email infrastructure is integrated.

> [!NOTE]
> **Applicable Org Types**: Staff management is available for **both** `MANAGEMENT_COMPANY` (common use case) and `COMMUNITY_ASSOCIATION` (self-managed) organization types. While less common, self-managed associations may also have paid staff.

> [!NOTE]
> **Existing Implementation**: The `Staff` model and `staffRouter` already exist for Hestami internal staff management. This phase extends the model with an optional `organizationId` field to support organization-scoped staff for Management Companies and Community Associations.

### 3.2 Board Management (For Community Associations)
- **Current Board View**: Display active board members with their positions (President, Treasurer, etc.) and term dates.
- **Managing Members**: Interface to add new board members from the community's `Party` list.
- **Term Tracking**: Track start and end dates for terms, including historical records of past members.
- **Role Control**: Assign and reassign board roles.

> [!NOTE]
> **Existing Implementation**: The `governanceBoardRouter` backend API is already implemented with `create`, `get`, `list`, `addMember`, `removeMember`, and `listHistory` endpoints. Phase 28 focuses on building the UI layer and enhancing term tracking features.

> [!TIP]
> **Party Model**: In HOA/CAM terminology, "Party" is the standard domain term for any person or entity that has a relationship with the association (owners, tenants, board members, etc.). The `Party` model already exists with `boardMemberships`, `meetingAttendance`, and `voteBallots` relations.

> [!WARNING]
> **Party Picker Required**: A `PartyPicker` component does **NOT** exist in the codebase. It must be created to enable selection of Party records for board/committee membership. Use `AssociationSelector.svelte` as a reference pattern. The backend `party.list` endpoint supports search functionality.

### 3.3 Committee Management (For Community Associations)
- **Committee Directory**: List all committees (e.g., ARC Committee, Social Committee, Landscape Committee).
- **Committee Creation**: Define new committees with names and descriptions.
- **Membership Management**: Add/remove members to/from committees.
- **Committee Roles**: Define roles within committees (Chair, Secretary, Member).
- **ARC Integration**: Link specific committees to the ARC request review workflow (e.g., Architectural Review Committee reviews ARC requests).

## 4. Technical Requirements
- **Prisma Schema Update**: 
  - Add optional `organizationId` to existing `Staff` model (with migration for existing Hestami staff data)
  - Implement generic `Committee` and `CommitteeMember` models
  - Define `CommitteeRole` enum (`CHAIR`, `VICE_CHAIR`, `SECRETARY`, `MEMBER`)
- **oRPC Routes**: 
  - Update `staffRouter` to support organization-scoped CRUD
  - Create `governanceCommitteeRouter` for committee management
  - Existing `governanceBoardRouter` is functional (UI needs implementation)
- **Cerbos Policies**: Implement authorization rules governing who can modify staff, boards, and committees.
- **SSR Alignment**: All primary views must support Server-Side Rendering (SSR) for initial load.
- **Durability**: All mutating operations must use DBOS workflows.

## 5. UI/UX Requirements
- **Consistency**: Follow the existing split-view and tabbed detail patterns used in the CAM pillar.
- **Accessibility**: Support keyboard navigation and ARIA-compliant components.
- **Feedback**: Provide real-time validation and clear toast notifications for all operations.

## 6. Data Model Reference

### Existing Models (No Changes Needed)
- `Party` - Person or entity that can own/rent property, used for board/committee membership
- `Board` - Board of Directors for an association
- `BoardMember` - Junction table linking Party to Board with role and term dates
- `BoardHistory` - Audit history for board changes

### Models to Modify
- `Staff` - Add optional `organizationId` to support organization-scoped staff

### New Models
- `Committee` - Generic committee structure for associations
- `CommitteeMember` - Junction table linking Party to Committee with role
- `CommitteeRole` enum - `CHAIR`, `VICE_CHAIR`, `SECRETARY`, `MEMBER`
