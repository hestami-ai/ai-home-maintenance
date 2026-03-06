# IAM and Governance - System Requirements

## 1. Core Principles
- **Staff-Only Operations Context:** Hestami platform staff operate across organizations via the Staff Portal (`/app/admin/*`).
- **Organization-Scoped Context:** Customers (CAM, Concierge, Vendors) operate within strict Organization boundaries.
- **Explicit Role-Based Access Control (RBAC):** Cerbos handles policy layer, PostgreSQL RLS handles data layer.
- **Immutable Audit Trails:** All permission changes, staff assignments, and cross-org access must be logged as `ActivityEvent`.

## 2. Onboarding & Invitations
A unified invitation system powers all organization onboarding.

### 2.1 Invitation Types
1. **Platform Staff Onboarding**
   - User registers with `@hestami-ai.com`.
   - Admin generates an 8-char encrypted activation code.
   - User enters code at `/app/staff/activation` to become active.
2. **Sub-User Onboarding (Existing Organizations)**
   - Replaces the "Create Org" flow for users joining existing orgs.
   - Unified `OrganizationInvitation` entity (handles CAM homeowners, Contractor technicians, etc.).
   - Driven by 8-char codes or magic links, default 72h expiration.
   - If user has pending invites on login, prompt to accept.

## 3. Organizations Management
Staff portal (`/app/admin/organizations`) allows platform staff to manage all organizations.

### 3.1 Organization Types
- `COMMUNITY_ASSOCIATION`: Self-managed HOA/COA/POA.
- `MANAGEMENT_COMPANY`: Professional management firm.
- `SERVICE_PROVIDER`: Contractor organization.
- `INDIVIDUAL_PROPERTY_OWNER`, `TRUST_OR_LLC`, `COMMERCIAL_CLIENT`.
- `PLATFORM_OPERATOR`: Internal Hestami organization.

### 3.2 Management Capabilities
- **Platform Admins** can edit organization info and suspend/activate organizations (must provide reason; creates audit log).
- **Staff** have cross-org read visibility via Security Definer PostgreSQL functions bypassing RLS.

## 4. Governance (CAM Specific)
- **Board Management:** Board of Directors tracked via `Board` and `BoardMember` (linking `Party` to `Board` with term dates).
- **Committee Management:** Arbitrary committees (e.g., ARC Committee) defined with specific roles (Chair, Secretary, Member).
- **Staff Scoping:** CAM organizations (Management Companies or Self-Managed HOAs) can have `Staff`. These staff are strictly scoped to the `CAM` pillar.

## 5. Admin Permissions and Settings
- **Permissions Dashboard:** Read-only aggregate view of roles across all orgs, Cerbos rule definitions, and an immutable audit log of granted/revoked permissions.
- **System Settings:** Global configuration (Session timeouts, default languages) and boolean Feature Flags (e.g., "AI Assistance") that can be overridden at the organization level.

## 6. Execution Rules for AI Agents
- **Code First:** All data schemas related to these requirements are located in `schemas.ts`.
- **Policy First:** All RLS and Cerbos rules are explicitly defined in `rls-policies.md`.
- **No Implicit State:** When building workflows, you MUST use DBOS workflows for any mutations.
- **Cross-Org Access:** You MUST use `orgTransaction` or `setOrgContextForWorkItem` when a staff member accesses another organization's data to ensure RLS context is set and audit trails are recorded.
