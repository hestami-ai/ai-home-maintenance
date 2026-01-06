# (Phase 28) Governance and Staff Management Implementation Roadmap

## Overview
Status: **In Progress** (P28.1 & P28.2 ✅ Complete, P28.3 Board & Committee Next)
Scope: Implementation of Board/Committee management and CAM Staff/Role management (both Management Companies and Self-Managed Associations).
Last Updated: 2026-01-02T19:00:00Z

---

## Investigation Context (2026-01-02)

### What Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| `Staff` model | `prisma/schema.prisma:915-957` | ✅ Exists (platform-level only) |
| `staffRouter` | `src/lib/server/api/routes/staff.ts` | ✅ Exists (platform-level only, 1314 lines) |
| `Party` model | `prisma/schema.prisma:1778+` | ✅ Complete with governance relations |
| `Board` model | `prisma/schema.prisma:4156-4178` | ✅ Complete |
| `BoardMember` model | `prisma/schema.prisma:4181-4201` | ✅ Complete |
| `BoardHistory` model | `prisma/schema.prisma:4444-4458` | ✅ Complete |
| `governanceBoardRouter` | `src/lib/server/api/routes/governance/board.ts` | ✅ Complete (6 endpoints) |
| `governanceWorkflow` | `src/lib/server/workflows/governanceWorkflow.ts` | ✅ Has board actions |
| Governance Landing UI | `src/routes/app/cam/governance/+page.svelte` | ✅ Basic layout |
| Board UI | `src/routes/app/cam/governance/board/+page.svelte` | ⚠️ Exists but needs API wiring |
| `AddBoardMemberModal` | `src/lib/components/cam/AddBoardMemberModal.svelte` | ⚠️ Needs Party selector integration |
| `governanceApi` (client) | `src/lib/api/cam.ts:637-761` | ✅ Complete |

### `governanceBoardRouter` Endpoints (Already Working)
- `create` - Create board for association
- `get` - Get board with members
- `list` - List boards for association
- `addMember` - Add Party as board member (via DBOS workflow)
- `removeMember` - Remove board member (via DBOS workflow)
- `listHistory` - View board change history

### Board UI Analysis
The board page at `/app/cam/governance/board/+page.svelte`:
- Uses `governanceApi.boards.list()` but doesn't properly map board members
- `loadBoardMembers()` clears the array instead of fetching actual data
- `handleAddMember()` has a `TODO: Add board member API when available` - API IS available
- `AddBoardMemberModal` takes name/email/phone but API expects `partyId` - needs Party picker

### Key Decisions & Notes
1. **Party Model is Domain Standard**: In HOA/CAM terminology, "Party" represents any person/entity with a relationship to the association. Board and committee members are selected from existing `Party` records.
2. **CAM Pillar Restriction**: Both `MANAGEMENT_COMPANY` and `COMMUNITY_ASSOCIATION` org types are restricted to `CAM` pillar only - staff cannot access `CONCIERGE` or `CONTRACTOR` pillars.
3. **Staff Model Extension**: The existing `Staff` model currently has no `organizationId` - all staff are Hestami platform-level. Phase 28 adds optional `organizationId` for org-scoped staff.
4. **Staff Management for Both Org Types**: Staff management is available for both Management Companies (common) and self-managed Community Associations (rare but valid use case).
5. **Email Invitations Deferred**: Email invitation workflow is deferred as email infrastructure is not yet integrated.
6. **Party Picker Component**: Does NOT exist in codebase. Must be created using `AssociationSelector.svelte` (`src/lib/components/cam/AssociationSelector.svelte`) as reference pattern. Backend `party.list` endpoint supports search functionality.
4. **Workflow Integration**: All mutating operations must use the existing DBOS workflow pattern established in `governanceWorkflow.ts`.

### Recommended Implementation Order
1. **Start with Board UI** (P28.3) - Backend is complete, just wire up the existing UI
2. **Add Committee Schema & API** (P28.1) - Parallel to Board pattern
3. **Extend Staff Model** (P28.1) - Add `organizationId` with migration
4. **Staff Management UI** (P28.2) - After backend is extended
5. **Integration & Polish** (P28.4) - Final phase

### Implementation Notes (2026-01-02)

#### P28.1 Completion - Org-Scoped Staff Router
- **Approach**: Created separate `orgStaffRouter` (rather than modifying existing `staffRouter`) to preserve backward compatibility with platform-level Hestami staff management
- **New Router**: `orgStaffRouter` at `src/lib/server/api/routes/staff.ts` (lines 1314-1986)
  - Uses `orgProcedure` to require organization context
  - Endpoints: `list`, `get`, `create`, `update`, `activate`, `deactivate`
- **Pillar Restriction**: Implemented `validatePillarAccessForOrgType()` helper function
  - Validates that `MANAGEMENT_COMPANY` and `COMMUNITY_ASSOCIATION` org types can only grant `CAM` pillar access
  - Throws `BAD_REQUEST` error if invalid pillars are specified
- **API Registration**: `orgStaffRouter` registered as `orgStaff` in `src/lib/server/api/index.ts`
- **Email Invitation**: Placeholder added with `TODO` comment - email system not yet integrated

---

## P28.1 Database & API Foundation

### Prisma Schema Updates
- [x] Add optional `organizationId` to `Staff` model
- [x] Create migration for existing Hestami staff (set `organizationId = null` for platform-level staff)
- [x] Implement `Committee` model
  - `id`, `associationId`, `organizationId`, `name`, `description`, `committeeType`
  - `isActive`, `arcLinked` (for ARC integration)
  - Relations to `CommitteeMember[]`
- [x] Implement `CommitteeMember` model
  - `id`, `committeeId`, `partyId`, `role`, `termStart`, `termEnd`, `isActive`
- [x] Define `CommitteeRole` enum (`CHAIR`, `VICE_CHAIR`, `SECRETARY`, `MEMBER`)
- [x] Define `CommitteeType` enum (`ARC`, `SOCIAL`, `LANDSCAPE`, `BUDGET`, `SAFETY`, `NOMINATING`, `CUSTOM`)

### Backend API (oRPC)
- [x] Update `staffRouter` to support organization-scoped CRUD (implemented as `orgStaffRouter`)
  - [x] Add `organizationId` filter to `list` endpoint
  - [x] Add authorization checks for org-scoped operations (uses `orgProcedure`)
  - [x] Enforce CAM-only pillar access for CAM org types (`validatePillarAccessForOrgType` helper)
- [x] Implement `governanceCommitteeRouter`
  - [x] `create` - Create committee for association
  - [x] `get` - Get committee details with members
  - [x] `list` - List committees for association
  - [x] `update` - Update committee details
  - [x] `addMember` - Add Party as committee member
  - [x] `removeMember` - Remove committee member
  - [x] `listMembers` - List committee members
- [x] `governanceBoardRouter` already implemented
  - [x] `create`, `get`, `list`, `addMember`, `removeMember`, `listHistory`

### Workflows (DBOS)
- [x] Implement `CREATE_COMMITTEE` workflow
- [x] Implement `UPDATE_COMMITTEE` workflow
- [x] Implement `ADD_COMMITTEE_MEMBER` workflow
- [x] Implement `REMOVE_COMMITTEE_MEMBER` workflow
- [x] Governance workflow exists (supports `CREATE_BOARD`, `ADD_BOARD_MEMBER`, `REMOVE_BOARD_MEMBER`)

### Frontend API Client
- [x] Add `governanceApi.committees` to `src/lib/api/cam.ts`

---

## P28.2 Staff Management UI (✅ Complete)

### Staff Directory / List View
- [x] Implement `/app/cam/management/staff` page
- [x] Split-view with staff list and summary panel
- [x] Filtering by status, role, pillar access

### Staff Detail & Editing
- [x] Tabbed detail view: Overview, Roles/Access, Activity
- [x] Form for editing `displayName`, `title`, and assignments (Implementation includes display and status toggle)
- [x] Status management (activate, suspend, deactivate)

### Staff Onboarding Flow
- [x] Invitation/Creation modal with role/pillar selection
- [x] **Validation Logic**: Enforce `CAM` pillar only restriction for `MANAGEMENT_COMPANY` and `COMMUNITY_ASSOCIATION` organization types
- [x] Email invitation workflow (DEFERRED - email infrastructure not integrated; record is created/activated immediately)

---

## P28.3 Board & Committee Management UI (Associations)

### Board Management (Governance > Board)
- [ ] **Wire up `loadBoardMembers()`** to use `governanceApi.boards.get(boardId)` with member data
- [ ] **Update `AddBoardMemberModal`** to use Party picker instead of manual name entry
- [ ] **Fix `handleAddMember()`** to call `governanceApi.boards.addMember()` with partyId
- [ ] **Fix `handleRemoveMember()`** to call `governanceApi.boards.removeMember()`
- [ ] Board member list view with current term status
- [ ] Edit board member role and term dates
- [ ] View board history

### Committee Management (Governance > Committees)
- [ ] Create `/app/cam/governance/committees` page
- [ ] Committee list view with member counts
- [ ] Committee Card/Detail view
- [ ] Create committee modal
- [ ] Membership management interface (Add/Remove)
- [ ] Committee role assignment

### Governance Navigation
- [ ] Update Governance landing page with Committees link
- [ ] Add "Board" and "Committees" sub-navigation

---

## P28.4 Integration & Polish

### CAM Sidebar Updates
- [x] Add "Team" or "Management" section for Management Companies
- [x] Route to `/app/cam/management/staff`

### Cerbos Policy Enforcement
- [ ] Implement/Verify `staff` resource policy for org-scoped operations
- [x] Implement `governance_committee` resource policy
- [x] Implement `governance_board` policy

### ARC Integration
- [ ] Link ARC Committee to ARC request review workflow
- [ ] Display assigned committee on ARC request detail
- [ ] Committee members can be reviewers

### Walkthrough & Verification
- [ ] Verify full lifecycle for board management
- [ ] Verify full lifecycle for committee management
- [ ] Verify full lifecycle for org-scoped staff management
- [ ] Document verification results in walkthrough

---

## Dependencies
- **Phase 27**: Association Management (for organization/association context)
- **Phase 16**: Hestami Staff Management (base Staff model and router)
- **Phase 7**: Governance foundation (Board, Meeting, Resolution models)

## Related Files Reference

### Backend (oRPC Routes)
| File | Purpose |
|------|---------|
| `src/lib/server/api/routes/staff.ts` | Platform-level staff CRUD |
| `src/lib/server/api/routes/party.ts` | Party (owner/tenant) CRUD - **use for board/committee member selection** |
| `src/lib/server/api/routes/governance/board.ts` | Board management API |
| `src/lib/server/api/routes/governance/meeting.ts` | Meeting management API |
| `src/lib/server/api/routes/governance/resolution.ts` | Resolution management API |
| `src/lib/server/api/routes/governance/index.ts` | Router exports |

### Workflows
| File | Purpose |
|------|---------|
| `src/lib/server/workflows/governanceWorkflow.ts` | DBOS workflow for governance ops |

### Frontend (API Clients)
| File | Purpose |
|------|---------|
| `src/lib/api/cam.ts` | CAM API client with `governanceApi` (line 637+) |
| `src/lib/api/staff.ts` | Staff API client |

### UI Components
| File | Purpose |
|------|---------|
| `src/lib/components/cam/AddBoardMemberModal.svelte` | Board member add modal |
| `src/lib/components/cam/dashboard/RecentGovernanceCard.svelte` | Dashboard governance widget |

### UI Routes
| Path | Purpose |
|------|---------|
| `/app/cam/governance/` | Governance landing page |
| `/app/cam/governance/board/` | Board management page |
| `/app/cam/governance/meetings/` | Meetings management |
| `/app/cam/governance/resolutions/` | Resolutions management |
| `/app/cam/governance/policies/` | Policies management |

## Notes
- The `Party` model is the domain-standard term for persons/entities in HOA management
- Board members and committee members are selected from existing `Party` records
- Staff pillar access is restricted to `CAM` only for CAM organization types
- Staff management applies to both `MANAGEMENT_COMPANY` and `COMMUNITY_ASSOCIATION` organizations
- Email invitations are deferred until email infrastructure is integrated

## Investigation Results (2026-01-02)

### Party Picker Component
- **Status**: ✅ Created (`src/lib/components/cam/PartyPicker.svelte`)
- **Reference Pattern**: `src/lib/components/cam/AssociationSelector.svelte` (dropdown with search)
- **Backend Support**: `party.list` endpoint exists with `search` parameter
- **Usage**: Board member and committee member selection

### Existing Selector/Picker Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `AssociationSelector.svelte` | `src/lib/components/cam/` | Association context switching |
| `DocumentPicker.svelte` | `src/lib/components/cam/` | Document selection |
| `AgendaItemLinkSelector.svelte` | `src/lib/components/cam/governance/` | Meeting agenda linking |

