# (Phase 37) Staff Portal Organizations Management - System Requirements

## 1. Overview

### 1.1 Purpose
Implement a comprehensive Organizations management feature for the Hestami AI OS Staff Portal. This feature enables Hestami staff to view, search, and manage all organization types across the platform from a centralized admin interface.

### 1.2 Scope
- Replace the placeholder "Customers" page at `/app/admin/customers`
- Create new Organizations management at `/app/admin/organizations`
- Support all organization types on the platform
- Enable view, search, filter, and status management capabilities

### 1.3 Background
The Staff Portal currently has a placeholder "Customers" page that redirects users to the Work Queue. Staff need a dedicated interface to:
- Look up customer/organization information for support purposes
- Manage organization status (suspend/activate accounts)
- View organization details, members, and related entities
- Support onboarding workflows by viewing organization state

---

## 2. Organization Types

The system must support all `OrganizationType` enum values:

| Type | Description | Primary Use Case |
|------|-------------|------------------|
| `COMMUNITY_ASSOCIATION` | Self-managed HOA/COA/POA | CAM pillar - governance, violations, ARC |
| `MANAGEMENT_COMPANY` | Professional property management firm | Manages multiple associations |
| `SERVICE_PROVIDER` | On-platform contractor organization | Contractor pillar - jobs, dispatch |
| `INDIVIDUAL_PROPERTY_OWNER` | Individual property owner | Concierge pillar - service calls |
| `TRUST_OR_LLC` | Trust/LLC entity property owner | Concierge pillar - multiple properties |
| `COMMERCIAL_CLIENT` | Commercial property client | Commercial services |
| `EXTERNAL_SERVICE_PROVIDER` | Off-platform vendor (reference only) | Vendor candidate tracking |
| `PLATFORM_OPERATOR` | Hestami internal organization | Platform administration |

---

## 3. Functional Requirements

### 3.1 Organization List View

**FR-3.1.1** The system SHALL display a paginated list of all organizations.

**FR-3.1.2** The list SHALL include the following columns:
- Organization name (clickable to detail view)
- Organization type (with badge)
- Status (ACTIVE, SUSPENDED, INACTIVE)
- Member count
- Active case count
- Created date
- Actions (View)

**FR-3.1.3** The system SHALL provide filtering by:
- Organization type (dropdown)
- Status (dropdown)
- Search text (name, slug)

**FR-3.1.4** The system SHALL display summary statistics:
- Total organizations
- Count by status (Active, Suspended, Inactive)
- Count by type

**FR-3.1.5** The list SHALL support cursor-based pagination.

### 3.2 Organization Detail View

**FR-3.2.1** The system SHALL display organization details including:
- Name, slug, type, status
- External contact information (name, email, phone)
- Creation and last update timestamps
- Settings (JSON)

**FR-3.2.2** The system SHALL display aggregated statistics:
- Member count
- Active case count / Total case count
- Property count
- Association count (for management companies)
- Work order count

**FR-3.2.3** The system SHALL display contextual tabs based on organization type:

| Organization Type | Tabs |
|-------------------|------|
| COMMUNITY_ASSOCIATION | Overview, Members, Associations, Properties, Activity |
| MANAGEMENT_COMPANY | Overview, Members, Managed Associations, Staff, Activity |
| SERVICE_PROVIDER | Overview, Members, Contractor Profile, Service Areas, Jobs, Activity |
| INDIVIDUAL_PROPERTY_OWNER | Overview, Members, Properties, Cases, Activity |
| TRUST_OR_LLC | Overview, Members, Properties, Cases, Activity |
| COMMERCIAL_CLIENT | Overview, Members, Properties, Contracts, Activity |
| EXTERNAL_SERVICE_PROVIDER | Overview, Contact, Activity |
| PLATFORM_OPERATOR | Overview, Members, Staff, Activity |

**FR-3.2.4** The Members tab SHALL display:
- User email and name
- Role within organization
- Primary flag
- Join date

### 3.3 Organization Management

**FR-3.3.1** Platform Admins SHALL be able to update organization information:
- Name
- External contact name
- External contact email
- External contact phone

**FR-3.3.2** Platform Admins SHALL be able to change organization status:
- Suspend (ACTIVE → SUSPENDED)
- Activate (SUSPENDED/INACTIVE → ACTIVE)
- Deactivate (ACTIVE/SUSPENDED → INACTIVE)

**FR-3.3.3** Status changes SHALL require a reason (1-1000 characters).

**FR-3.3.4** All changes SHALL be recorded in the activity log with:
- Previous and new values
- Reason for change
- Performing user ID
- Timestamp

### 3.4 Navigation & Integration

**FR-3.4.1** The admin navigation SHALL be updated:
- Rename "Customers" to "Organizations"
- Update route to `/app/admin/organizations`

**FR-3.4.2** The system SHALL redirect `/app/admin/customers` to `/app/admin/organizations` (301 redirect).

**FR-3.4.3** Case detail pages SHALL link organization names to the organization detail view.

---

## 4. Non-Functional Requirements

### 4.1 Security

**NFR-4.1.1** All endpoints SHALL require authentication (valid session).

**NFR-4.1.2** All endpoints SHALL verify staff role via Cerbos authorization.

**NFR-4.1.3** View/list operations SHALL be available to all Hestami staff (`hestami_staff` derived role).

**NFR-4.1.4** Edit/status change operations SHALL be restricted to Platform Admins (`hestami_platform_admin` derived role).

**NFR-4.1.5** Cross-organization data access SHALL use SECURITY DEFINER PostgreSQL functions to bypass RLS safely.

### 4.2 Performance

**NFR-4.2.1** List view SHALL load within 2 seconds for up to 1000 organizations.

**NFR-4.2.2** Detail view SHALL load within 1 second.

**NFR-4.2.3** Pagination SHALL use cursor-based approach for consistent performance.

### 4.3 Audit & Compliance

**NFR-4.3.1** All status changes SHALL create activity events.

**NFR-4.3.2** All name changes SHALL create activity events.

**NFR-4.3.3** Activity events SHALL include previous and new values for auditing.

---

## 5. Technical Architecture

### 5.1 Database Layer

SECURITY DEFINER functions (bypass RLS for staff access):

```
get_all_organizations_for_staff(type, status, search, limit, cursor)
get_organization_details_for_staff(org_id)
get_organization_members_for_staff(org_id, limit, cursor)
update_organization_status_for_staff(org_id, new_status, reason, performed_by_id)
update_organization_info_for_staff(org_id, name, contact_*, performed_by_id)
```

### 5.2 API Layer

oRPC Router: `organizationAdminRouter`

| Endpoint | Method | Authorization | Description |
|----------|--------|---------------|-------------|
| `organizationAdmin.list` | POST | hestami_staff | List all organizations |
| `organizationAdmin.get` | POST | hestami_staff | Get organization details |
| `organizationAdmin.getMembers` | POST | hestami_staff | Get organization members |
| `organizationAdmin.updateStatus` | POST | hestami_platform_admin | Change status |
| `organizationAdmin.update` | POST | hestami_platform_admin | Update info |

### 5.3 Authorization Layer

Cerbos resource: `organization_admin`

| Action | hestami_staff | hestami_platform_admin |
|--------|---------------|------------------------|
| view | ✓ | ✓ |
| list | ✓ | ✓ |
| view_members | ✓ | ✓ |
| edit | ✗ | ✓ |
| update_status | ✗ | ✓ |
| suspend | ✗ | ✓ |
| activate | ✗ | ✓ |

### 5.4 Frontend Layer

Routes:
- `/app/admin/organizations` - List view
- `/app/admin/organizations/[id]` - Detail view
- `/app/admin/customers` - Redirect to organizations

---

## 6. Data Model Reference

### 6.1 Organization (existing)

```prisma
model Organization {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String   @unique
  type                  OrganizationType
  status                OrganizationStatus @default(ACTIVE)
  settings              Json?
  externalContactName   String?
  externalContactEmail  String?
  externalContactPhone  String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  deletedAt             DateTime?

  // Relations
  memberships           UserOrganization[]
  associations          Association[]
  contractorProfile     ContractorProfile?
  conciergeCases        ConciergeCase[]
  // ... many more
}
```

### 6.2 OrganizationStatus (existing)

```prisma
enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  INACTIVE
}
```

---

## 7. UI/UX Requirements

### 7.1 List View

- Follow existing staff portal patterns (see Staff Management page)
- Stats cards at top showing totals
- Search bar with filter dropdowns
- Table with sortable columns
- Status badges with color coding:
  - ACTIVE: Green (success)
  - SUSPENDED: Red (error)
  - INACTIVE: Gray (surface)

### 7.2 Detail View

- Back navigation to list
- Header with org name, type badge, status badge
- Action buttons (Edit, Suspend/Activate) for Platform Admins
- Tab navigation for contextual content
- Cards for stats and info sections

### 7.3 Modals

- Edit Organization modal with form fields
- Status Change modal with reason textarea
- Confirmation before destructive actions

---

## 8. Out of Scope

The following are explicitly NOT included in this phase:

1. **Create Organization** - Organizations are created through onboarding flows
2. **Delete Organization** - Soft delete only, not exposed in UI
3. **Bulk Operations** - No bulk status changes or exports
4. **Advanced Filtering** - No date range filters, complex queries
5. **Organization Settings Editor** - JSON settings not editable in UI
6. **Member Management** - Cannot add/remove members from this view
7. **Impersonation** - Cannot log in as organization user

---

## 9. Dependencies

- Phase 16: Work Queue (pattern reference for SECURITY DEFINER functions)
- Phase 14: Staff Management (UI pattern reference)
- Cerbos authorization infrastructure
- Activity event logging infrastructure

---

## 10. Acceptance Criteria

1. Staff can navigate to `/app/admin/organizations` from sidebar
2. Staff can view list of all organizations with filtering
3. Staff can search organizations by name
4. Staff can view organization details including members
5. Platform Admins can edit organization name and contact info
6. Platform Admins can suspend/activate organizations with reason
7. Status changes appear in activity log
8. Old `/app/admin/customers` URL redirects to new location
9. Case detail pages link to organization detail view
10. All operations respect Cerbos authorization
