# **Phase 22: Admin Permissions & Settings UX**

## **Implementation Roadmap**

**Related Document:** `(Phase 22) Admin Permissions and Settings UX.md`  
**Status:** Phase 22.1 Complete  
**Last Updated:** 2024-12-29

---

## **Overview**

This roadmap tracks implementation of the Permissions (`/app/admin/permissions`) and Settings (`/app/admin/settings`) pages in the Staff Admin Portal.

**Key Principle:** The Permissions page focuses on **visibility and audit** (not staff management, which is at `/app/admin/staff`).

---

## **Phase 22.1 - Foundation (MVP)**

### 1. Permissions Page - Basic Structure

#### 1.1 Page Setup
- [x] Create `/app/admin/permissions/+page.svelte` (replace placeholder)
- [ ] Create `/app/admin/permissions/+page.server.ts` for server-side data
- [x] Add sub-navigation tabs component (Overview, Org Roles, Role Definitions, Audit Log)
- [x] Implement tab routing or client-side tab switching

#### 1.2 Permissions Overview Dashboard
- [x] Create dashboard layout with metric cards
- [x] Display total organizations count
- [x] Display total users across all organizations
- [x] Display role distribution chart (org roles breakdown)
- [x] Display recent permission changes (last 10)
- [x] Add quick action links (search orgs, search users, audit log, staff management)

#### 1.3 Organization Roles List (Read-Only)
- [x] Create organization list table component
- [x] Implement cross-org organization query (staff API)
- [x] Display columns: Organization, Type, Members, Admins, Status
- [x] Add filters: By type, By status, Search by name
- [ ] Add pagination (cursor-based, backend ready)

#### 1.4 Basic Audit Log
- [x] Create audit log table component
- [x] Query ActivityEvent for permission-related changes
- [x] Display columns: Timestamp, Actor, Action, Target, Details, Organization
- [ ] Add basic date range filter (backend ready)
- [ ] Add pagination (backend ready)

### 2. Settings Page - Basic Structure

#### 2.1 Page Setup
- [x] Create `/app/admin/settings/+page.svelte` (replace placeholder)
- [ ] Create `/app/admin/settings/+page.server.ts` for server-side data
- [x] Add sub-navigation tabs (Platform, Org Settings, Notifications, Integrations, Security, Data)

#### 2.2 Platform Settings (Read-Only Display)
- [x] Create settings display layout
- [x] Display current platform name and support contact
- [x] Display current timezone and language defaults
- [x] Display operational limits (file size, session timeout, rate limits)

#### 2.3 Feature Flags (Read-Only Display)
- [x] Create feature flags list component
- [x] Display AI Assistance status
- [x] Display Vendor Discovery status
- [x] Display Document OCR status
- [x] Display Beta Features status

#### 2.4 Security Settings (Read-Only Display)
- [x] Display current authentication settings
- [x] Display session management settings
- [x] Display access control settings

### 3. Backend API - Phase 22.1

#### 3.1 Permissions API Endpoints
- [x] Create `permissionsAdmin.ts` oRPC router
- [x] Implement `listOrganizations` - list all orgs with member counts
- [x] Implement `getOrganization` - get org detail with member roles
- [x] Implement `getAuditLog` - query permission-related activity events
- [x] Implement `getStats` - dashboard metrics
- [x] Implement `getRecentChanges` - recent permission changes

#### 3.2 Settings API Endpoints
- [ ] Create `platformSettings.ts` oRPC router (deferred - using mock data for Phase 22.1)
- [ ] Implement `staffGetPlatformSettings` - read current settings
- [ ] Implement `staffGetFeatureFlags` - read feature flag states
- [ ] Implement `staffGetSecuritySettings` - read security config

#### 3.3 Cerbos Policies
- [x] Create `permissions_admin.yaml` resource policy
- [ ] Create `platform_settings.yaml` resource policy
- [x] Add staff access rules for new endpoints

### 4. Database Schema (if needed)

#### 4.1 Platform Settings Table
- [ ] Evaluate if `PlatformSetting` table is needed or use config files
- [ ] If table needed: Add Prisma schema
- [ ] If table needed: Create migration
- [ ] If table needed: Seed default values

---

## **Phase 22.2 - Visibility & Audit**

### 5. Permissions - Organization Detail View

#### 5.1 Organization Detail Page
- [ ] Create `/app/admin/permissions/org/[id]/+page.svelte`
- [ ] Display organization info (name, type, created, status)
- [ ] Display member roles table
- [ ] Display role distribution chart for org
- [ ] Display recent permission activity for org

#### 5.2 Member Roles Table
- [ ] List all members with their roles
- [ ] Show joined date and last active
- [ ] Add search/filter by name, role
- [ ] Link to user profile (if exists)

### 6. Permissions - Role Definitions View

#### 6.1 Role Definitions Tab
- [ ] Create role definitions component
- [ ] Parse Cerbos policies to extract role capabilities
- [ ] Display organization roles with permissions matrix
- [ ] Display staff roles with permissions matrix
- [ ] Add search/filter by role name

#### 6.2 Permissions Matrix
- [ ] Create reusable permissions matrix component
- [ ] Show resources as rows
- [ ] Show actions as columns (View, Create, Update, Delete, Special)
- [ ] Indicate allowed/denied with icons

### 7. Permissions - Advanced Audit

#### 7.1 Advanced Audit Filtering
- [ ] Add filter by actor (who made change)
- [ ] Add filter by target user
- [ ] Add filter by action type (GRANT, REVOKE, MODIFY)
- [ ] Add filter by organization
- [ ] Add date range picker

#### 7.2 Audit Export
- [ ] Implement CSV export for audit log
- [ ] Add export button with date range selection
- [ ] Include all relevant columns in export

### 8. Settings - Editable Platform Settings

#### 8.1 Platform Settings Form
- [ ] Convert read-only display to editable form
- [ ] Add validation for each setting
- [ ] Implement save with confirmation
- [ ] Add audit logging for setting changes

#### 8.2 Feature Flags Management
- [ ] Convert to toggle switches
- [ ] Implement enable/disable with confirmation
- [ ] Add audit logging for flag changes

### 9. Settings - Notification Settings

#### 9.1 Notification Channels
- [ ] Display channel status (Email, SMS, Push, In-App)
- [ ] Show configuration status for each channel
- [ ] Add placeholder for channel configuration

#### 9.2 Notification Types Matrix
- [ ] Display notification types vs channels matrix
- [ ] Show which notifications go to which channels
- [ ] Add placeholder for editing (future phase)

### 10. Backend API - Phase 22.2

#### 10.1 Additional Permissions Endpoints
- [ ] Implement `staffGetOrganizationDetail` - full org with members
- [ ] Implement `staffGetRoleDefinitions` - parsed Cerbos policies
- [ ] Implement `staffExportAuditLog` - CSV export endpoint

#### 10.2 Settings Update Endpoints
- [ ] Implement `staffUpdatePlatformSettings` - update settings
- [ ] Implement `staffUpdateFeatureFlag` - toggle feature flags
- [ ] Add DBOS workflow for setting changes (audit trail)

---

## **Phase 22.3 - Advanced Features**

### 11. Permissions - Alerts & Analytics

#### 11.1 Permission Change Alerts
- [ ] Define alert conditions (bulk changes, unusual patterns)
- [ ] Create alerts display component
- [ ] Implement alert generation logic
- [ ] Add alert dismissal/acknowledgment

#### 11.2 User Search Across Organizations
- [ ] Create cross-org user search component
- [ ] Search by name, email
- [ ] Display user's roles across all orgs
- [ ] Link to org detail for each membership

#### 11.3 Role Distribution Analytics
- [ ] Create analytics dashboard component
- [ ] Show role distribution trends over time
- [ ] Show org growth metrics
- [ ] Add export for analytics data

### 12. Settings - Organization Settings

#### 12.1 Organization Selector
- [ ] Create org search/select component
- [ ] Load org-specific settings on selection

#### 12.2 Organization Settings Form
- [ ] Display org display name, logo, colors
- [ ] Display org timezone
- [ ] Display feature overrides
- [ ] Display limit overrides
- [ ] Implement save with audit logging

### 13. Settings - Integration Management

#### 13.1 Integration List
- [ ] Display active integrations with status
- [ ] Show connection status for each
- [ ] Add test connection button

#### 13.2 Integration Detail
- [ ] Display API key management (masked)
- [ ] Show usage metrics
- [ ] Show last sync timestamp

### 14. Settings - Security Settings (Editable)

#### 14.1 Authentication Settings
- [ ] Editable password policy
- [ ] Editable 2FA requirements
- [ ] Save with audit logging

#### 14.2 Session Management
- [ ] Editable session duration
- [ ] Editable idle timeout
- [ ] Editable concurrent sessions limit

#### 14.3 Access Control
- [ ] IP allowlist management
- [ ] Failed login lockout settings

### 15. Settings - Data Management

#### 15.1 Data Retention Display
- [ ] Display current retention policies
- [ ] Show data types and retention periods

#### 15.2 Audit Log Settings
- [ ] Display audit retention period
- [ ] Display sensitive data masking status
- [ ] Add export audit logs action

### 16. Backend API - Phase 22.3

#### 16.1 Alerts & Analytics Endpoints
- [ ] Implement `staffGetPermissionAlerts`
- [ ] Implement `staffSearchUsersAcrossOrgs`
- [ ] Implement `staffGetRoleAnalytics`

#### 16.2 Organization Settings Endpoints
- [ ] Implement `staffGetOrganizationSettings`
- [ ] Implement `staffUpdateOrganizationSettings`

#### 16.3 Integration Endpoints
- [ ] Implement `staffGetIntegrations`
- [ ] Implement `staffTestIntegration`

#### 16.4 Security Settings Endpoints
- [ ] Implement `staffUpdateSecuritySettings`
- [ ] Add DBOS workflow for security changes

---

## **Phase 22.4 - Enterprise Features**

### 17. Permissions - Compliance & Reporting

#### 17.1 Compliance Reporting
- [ ] Create compliance report generator
- [ ] Define report templates (SOC2, GDPR, etc.)
- [ ] Implement scheduled report generation
- [ ] Add report download

#### 17.2 Permission Comparison
- [ ] Create comparison tool UI
- [ ] Compare user vs user permissions
- [ ] Compare org vs org role distributions
- [ ] Export comparison results

#### 17.3 Anomaly Detection
- [ ] Define anomaly detection rules
- [ ] Implement detection logic
- [ ] Create anomaly alerts display
- [ ] Add investigation workflow

### 18. Settings - Enterprise Features

#### 18.1 Email Template Customization
- [ ] Create template editor UI
- [ ] List system email templates
- [ ] Implement template preview
- [ ] Implement template save

#### 18.2 Webhook Configuration
- [ ] Create webhook management UI
- [ ] Add/edit/delete webhooks
- [ ] Configure event subscriptions
- [ ] Display delivery logs

#### 18.3 Backup & Restore
- [ ] Display backup configuration
- [ ] Show backup history
- [ ] Implement manual backup trigger
- [ ] Implement restore workflow

#### 18.4 GDPR Data Export
- [ ] Create data export request UI
- [ ] Implement user data export
- [ ] Implement org data export
- [ ] Track export request history

### 19. Backend API - Phase 22.4

#### 19.1 Compliance Endpoints
- [ ] Implement `staffGenerateComplianceReport`
- [ ] Implement `staffComparePermissions`
- [ ] Implement `staffGetAnomalies`

#### 19.2 Enterprise Settings Endpoints
- [ ] Implement email template CRUD
- [ ] Implement webhook CRUD
- [ ] Implement backup/restore endpoints
- [ ] Implement GDPR export endpoints

---

## **Testing Checklist**

### Unit Tests
- [ ] Permissions API endpoints
- [ ] Settings API endpoints
- [ ] Cerbos policy authorization
- [ ] Data transformation functions

### Integration Tests
- [ ] Staff can view all organizations
- [ ] Staff can view org member roles
- [ ] Staff can view audit log
- [ ] Staff can update platform settings
- [ ] Non-staff cannot access permissions/settings pages
- [ ] Audit logging captures all changes

### E2E Tests
- [ ] Navigate to permissions page
- [ ] Filter and search organizations
- [ ] View organization detail
- [ ] Export audit log
- [ ] Update platform settings
- [ ] Toggle feature flags

---

## **Dependencies**

### External Dependencies
- None identified

### Internal Dependencies
- Staff authentication and authorization (Phase 16) ✓
- Activity event logging (existing) ✓
- Cerbos policy infrastructure (existing) ✓
- Organization and membership models (existing) ✓

---

## **Notes**

- Placeholder pages already exist at `/app/admin/permissions` and `/app/admin/settings`
- Staff role management is handled separately at `/app/admin/staff`
- All endpoints should use `authedProcedure` for cross-org staff access
- All mutations should use DBOS workflows for audit trail
- Consider caching for Cerbos policy parsing (Role Definitions view)

