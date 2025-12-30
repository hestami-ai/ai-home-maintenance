# **Hestami AI OS**

## **Admin Permissions & Settings UX – System Requirements Document (SRD)**

**Document Type:** Internal UX / Operations SRD  
**Audience:** Product, Engineering, AI Developer Agents, Operations Leadership  
**Scope:** Staff Admin Portal – Permissions Management & System Settings  
**Status:** Requirements Definition  
**Phase:** 22  
**Related Documents:** Phase 16 (Hestami Staff UX), Phase 21 (RLS Enforcement)

---

## **1. Purpose & Scope**

### **1.1 Purpose**

This document defines the **Permissions Management** and **System Settings** UX for the Hestami AI OS Staff Admin Portal (`/app/admin/*`).

These pages enable Hestami platform staff to:

- View and manage role assignments across organizations
- Audit permission changes and access patterns
- Configure platform-wide and organization-specific settings
- Manage integrations, notifications, and security policies

### **1.2 Scope**

**In Scope:**
- Staff Admin Portal permissions management
- Platform-level settings configuration
- Organization-level settings management (staff view)
- Permission audit and compliance views
- Cerbos policy visibility (read-only)

**Out of Scope:**
- Customer-facing settings UI (separate org admin portal)
- Cerbos policy editing (managed via code/deployment)
- Visual design system specifications
- API schema definitions (covered in implementation roadmap)

---

## **2. Design Principles**

1. **Staff-Only Access**  
   These pages are exclusively for Hestami staff managing the platform.

2. **Read-First, Write-Carefully**  
   Prioritize visibility and audit over frequent mutations.

3. **Cross-Org Visibility**  
   Staff can view permissions and settings across all organizations.

4. **Audit Everything**  
   All permission and setting changes are logged immutably.

5. **Graceful Degradation**  
   Unimplemented features show clear placeholders, not errors.

---

## **3. User Personas**

### **3.1 Platform Administrator**
- Full access to all permissions and settings
- Can modify staff roles and pillar access
- Can configure platform-wide settings

### **3.2 Operations Coordinator**
- Can view permissions across organizations
- Can view but not modify platform settings
- Can manage organization-specific settings

### **3.3 Concierge Operator / CAM Specialist**
- Read-only access to permissions relevant to their pillar
- Limited settings access (notification preferences)

---

## **4. Permissions Management UX**

### **4.1 Relationship to Staff Management**

The platform has two related but distinct admin areas:

| Aspect | Staff Management (`/app/admin/staff`) | Permissions (`/app/admin/permissions`) |
|--------|---------------------------------------|----------------------------------------|
| **Primary Focus** | Staff lifecycle & individual management | Cross-org visibility & audit |
| **Staff CRUD** | ✓ Add, edit, suspend, deactivate | ✗ (links to Staff Management) |
| **Staff Role Editing** | ✓ Via `/staff/[id]/roles` | ✗ Read-only aggregate view |
| **Pillar Access** | ✓ Via `/staff/[id]/access` | ✗ Read-only aggregate view |
| **Organization Roles** | ✗ | ✓ Cross-org member role visibility |
| **Role Definitions** | ✗ | ✓ What can each role do (Cerbos) |
| **Permission Audit** | ✗ | ✓ All permission changes platform-wide |

**Design Rationale:** Staff Management handles the "who" (individual staff members and their lifecycle). Permissions handles the "what" (what can roles do, who has what across orgs, and audit trail).

---

### **4.2 Navigation**

**Entry Point:** `/app/admin/permissions`

**Sub-Navigation Tabs:**
1. Overview (Dashboard)
2. Organization Roles
3. Role Definitions
4. Audit Log

---

### **4.3 Permissions Overview (Dashboard)**

**Purpose:** At-a-glance view of permission state across the platform.

**Display Elements:**

| Metric | Description |
|--------|-------------|
| Organizations | Total organizations managed |
| Total Users | Count of users across all organizations |
| Role Distribution | Breakdown by organization role (Admin, Manager, Owner, etc.) |
| Recent Changes | Last 10 permission changes (role grants/revokes) |
| Alerts | Unusual patterns (e.g., bulk role changes, failed access attempts) |

**Quick Actions:**
- Search organizations
- Search users by name/email
- Jump to audit log
- Link to Staff Management (`/app/admin/staff`)

---

### **4.4 Organization Roles Management**

**Purpose:** View role assignments within customer organizations (cross-org visibility for staff).

#### **4.4.1 Organization List View**

**Table Columns:**
| Column | Description |
|--------|-------------|
| Organization | Organization name |
| Type | HOA, Property Owner, Management Company |
| Members | Total member count |
| Admins | Count of ADMIN role users |
| Status | Active, Suspended |
| Actions | View Details |

**Filters:**
- By organization type
- By status
- Search by name

#### **4.4.2 Organization Detail View**

**Sections:**

**Organization Info**
- Name, Type, Created date
- Primary contact
- Status

**Member Roles**
| Column | Description |
|--------|-------------|
| User | Name and email |
| Role | ADMIN, MANAGER, OWNER, TENANT, etc. |
| Joined | Date added to organization |
| Last Active | Last activity timestamp |
| Actions | View User |

**Role Distribution Chart**
- Visual breakdown of roles within the organization

**Recent Activity**
- Last 10 permission-related events for this organization

---

### **4.5 Role Definitions (Read-Only)**

**Purpose:** Display what each role can do, derived from Cerbos policies.

#### **4.5.1 Organization Roles**

For each role (ADMIN, MANAGER, BOARD_MEMBER, OWNER, TENANT, VENDOR, MEMBER, AUDITOR):

**Display:**
- Role name and description
- Derived roles it maps to
- Resource permissions matrix:

| Resource | View | Create | Update | Delete | Special |
|----------|------|--------|--------|--------|---------|
| Cases | ✓ | ✓ | ✓ | - | Assign |
| Properties | ✓ | ✓ | ✓ | - | - |
| Documents | ✓ | ✓ | ✓ | - | Export |
| ... | ... | ... | ... | ... | ... |

#### **4.5.2 Staff Roles**

Similar matrix for staff roles showing cross-org capabilities.

**Note:** This view is informational. Policy changes require code deployment.

---

### **4.6 Permissions Audit Log**

**Purpose:** Immutable record of all permission-related changes.

**Table Columns:**
| Column | Description |
|--------|-------------|
| Timestamp | When the change occurred |
| Actor | Who made the change |
| Action | GRANT, REVOKE, MODIFY |
| Target | User affected |
| Details | Role/permission changed |
| Organization | Org context (if applicable) |
| Reason | Optional justification |

**Filters:**
- Date range
- By actor
- By target user
- By action type
- By organization

**Export:**
- CSV export for compliance reporting

---

## **5. System Settings UX**

### **5.1 Navigation**

**Entry Point:** `/app/admin/settings`

**Sub-Navigation Tabs:**
1. Platform Settings
2. Organization Settings
3. Notifications
4. Integrations
5. Security
6. Data Management

---

### **5.2 Platform Settings**

**Purpose:** Global configuration affecting all organizations.

#### **5.2.1 General Settings**

| Setting | Type | Description |
|---------|------|-------------|
| Platform Name | Text | Display name (default: "Hestami AI") |
| Support Email | Email | Platform support contact |
| Support Phone | Phone | Platform support phone |
| Default Timezone | Select | Default timezone for new orgs |
| Default Language | Select | Default language (en-US) |

#### **5.2.2 Feature Flags**

| Flag | Type | Description |
|------|------|-------------|
| AI Assistance | Toggle | Enable AI-powered features |
| Vendor Discovery | Toggle | Enable automated vendor discovery |
| Document OCR | Toggle | Enable document text extraction |
| Beta Features | Toggle | Enable beta feature access |

**Note:** Feature flags affect all organizations. Per-org overrides in Organization Settings.

#### **5.2.3 Operational Limits**

| Setting | Type | Description |
|---------|------|-------------|
| Max File Size | Number (MB) | Maximum upload file size |
| Session Timeout | Number (min) | Idle session timeout |
| API Rate Limit | Number | Requests per minute per user |
| Max Concurrent Sessions | Number | Per-user session limit |

---

### **5.3 Organization Settings (Staff View)**

**Purpose:** View and override settings for specific organizations.

#### **5.3.1 Organization Selector**

- Search/select organization
- Quick filters: Active, Suspended, All

#### **5.3.2 Organization-Specific Settings**

**General:**
| Setting | Type | Description |
|---------|------|-------------|
| Display Name | Text | Organization display name |
| Logo | Image | Organization logo |
| Primary Color | Color | Brand color |
| Timezone | Select | Organization timezone |

**Feature Overrides:**
- Toggle to override platform defaults
- Per-feature enable/disable

**Limits:**
- Override platform limits for specific orgs
- Useful for enterprise customers

**Billing (Placeholder):**
- Subscription tier
- Usage metrics
- Billing contact

---

### **5.4 Notification Settings**

**Purpose:** Configure notification delivery and templates.

#### **5.4.1 Delivery Channels**

| Channel | Status | Configuration |
|---------|--------|---------------|
| Email | Active/Inactive | SMTP settings, sender address |
| SMS | Active/Inactive | Provider, sender number |
| Push | Active/Inactive | FCM/APNs configuration |
| In-App | Active | Always enabled |

#### **5.4.2 Notification Types**

| Type | Email | SMS | Push | In-App |
|------|-------|-----|------|--------|
| Case Created | ✓ | - | ✓ | ✓ |
| Case Updated | ✓ | - | ✓ | ✓ |
| Bid Received | ✓ | ✓ | ✓ | ✓ |
| Payment Due | ✓ | ✓ | - | ✓ |
| ... | ... | ... | ... | ... |

#### **5.4.3 Email Templates (Placeholder)**

- List of system email templates
- Preview capability
- Edit capability (future)

---

### **5.5 Integrations**

**Purpose:** Manage third-party service connections.

#### **5.5.1 Active Integrations**

| Integration | Status | Description |
|-------------|--------|-------------|
| Stripe | Connected/Disconnected | Payment processing |
| SendGrid | Connected/Disconnected | Email delivery |
| Twilio | Connected/Disconnected | SMS delivery |
| AWS S3 | Connected/Disconnected | File storage |
| OpenAI | Connected/Disconnected | AI services |
| SigNoz | Connected/Disconnected | Observability |

#### **5.5.2 Integration Detail**

For each integration:
- Connection status
- API key management (masked)
- Test connection button
- Usage metrics
- Last sync timestamp

#### **5.5.3 Webhooks (Placeholder)**

- Outbound webhook configuration
- Event subscriptions
- Delivery logs

---

### **5.6 Security Settings**

**Purpose:** Platform security configuration.

#### **5.6.1 Authentication**

| Setting | Type | Description |
|---------|------|-------------|
| Password Min Length | Number | Minimum password length |
| Password Complexity | Toggle | Require special characters |
| Password Expiry | Number (days) | Force password reset (0 = never) |
| 2FA Required | Toggle | Require two-factor authentication |
| 2FA Methods | Multi-select | TOTP, SMS, Email |

#### **5.6.2 Session Management**

| Setting | Type | Description |
|---------|------|-------------|
| Session Duration | Number (hours) | Maximum session length |
| Idle Timeout | Number (minutes) | Inactivity timeout |
| Concurrent Sessions | Number | Max sessions per user |
| Remember Me Duration | Number (days) | "Remember me" cookie duration |

#### **5.6.3 Access Control**

| Setting | Type | Description |
|---------|------|-------------|
| IP Allowlist | Text (IPs) | Restrict staff access by IP |
| Failed Login Lockout | Number | Attempts before lockout |
| Lockout Duration | Number (minutes) | Lockout period |

#### **5.6.4 Audit Settings**

| Setting | Type | Description |
|---------|------|-------------|
| Audit Retention | Number (days) | How long to keep audit logs |
| Sensitive Data Masking | Toggle | Mask PII in logs |
| Export Audit Logs | Action | Download audit logs |

---

### **5.7 Data Management**

**Purpose:** Data retention, backup, and export configuration.

#### **5.7.1 Data Retention**

| Data Type | Retention | Description |
|-----------|-----------|-------------|
| Activity Logs | 365 days | User activity events |
| Audit Logs | 7 years | Compliance audit trail |
| Deleted Records | 90 days | Soft-deleted data |
| Session Data | 30 days | Login sessions |
| Temp Files | 7 days | Uploaded temp files |

#### **5.7.2 Backup Configuration (Placeholder)**

- Backup frequency
- Backup retention
- Last backup timestamp
- Manual backup trigger

#### **5.7.3 Data Export (Placeholder)**

- Organization data export
- User data export (GDPR)
- Export history

---

## **6. Implementation Priority**

### **Phase 22.1 - Foundation (MVP)**

**Permissions:**
1. Permissions Overview dashboard (metrics, recent changes)
2. Organization Roles list view (read-only cross-org view)
3. Basic audit log (permission changes only)

**Settings:**
1. Platform Settings (General only, read-only display)
2. Feature Flags (read-only display)
3. Security Settings (display current values)

### **Phase 22.2 - Visibility & Audit**

**Permissions:**
1. Organization Detail view (member roles within org)
2. Role Definitions view (Cerbos policy visibility)
3. Advanced audit filtering and export

**Settings:**
1. Platform Settings (editable)
2. Feature Flags (editable)
3. Notification Settings (channel status)

### **Phase 22.3 - Advanced**

**Permissions:**
1. Permission change alerts
2. User search across organizations
3. Role distribution analytics

**Settings:**
1. Organization Settings management (per-org overrides)
2. Integration management
3. Security Settings (editable)
4. Data Management

### **Phase 22.4 - Enterprise**

**Permissions:**
1. Compliance reporting
2. Permission comparison (user vs user, org vs org)
3. Anomaly detection (unusual access patterns)

**Settings:**
1. Email template customization
2. Webhook configuration
3. Advanced backup/restore
4. GDPR data export

---

## **7. Technical Considerations**

### **7.1 Authorization**

- All endpoints require `hestami_staff` or `hestami_platform_admin` derived role
- Write operations require `hestami_platform_admin`
- Use `authedProcedure` for cross-org access (no org context required)

### **7.2 Data Access Patterns**

- Staff roles: Query `HestamStaff` table
- Org roles: Query `OrganizationMembership` table
- Settings: New `PlatformSetting` and `OrganizationSetting` tables
- Audit: Query `ActivityEvent` with permission-related filters

### **7.3 Cerbos Integration**

- Role Definitions view reads from Cerbos policy files
- Consider caching policy data for performance
- Policy changes require deployment (not runtime editable)

### **7.4 Audit Requirements**

All mutations must record:
- Actor (staff user ID)
- Action type
- Target entity
- Before/after values
- Timestamp
- Optional reason

---

## **8. Success Criteria**

The Permissions & Settings UX is successful if:

1. Staff can quickly find who has what permissions
2. Permission changes are auditable and traceable
3. Platform settings are centrally managed
4. Organization-specific overrides are possible
5. Security policies are enforceable
6. Compliance requirements are met (audit retention, export)

---

## **9. Open Questions**

1. **Org Admin Visibility:** Should organization admins have a separate, scoped view of their own org's permissions? (Currently staff-only)

2. **Notifications:** Should permission changes trigger notifications to affected users?

3. **Retention:** How long should permission audit logs be retained? (Default: 7 years for compliance)

4. **Cross-Reference:** Should the Permissions page link directly to Staff Management for staff-related actions, or keep them completely separate?

5. **Real-Time Updates:** Should the audit log support real-time updates (WebSocket) or polling?

---

## **10. Appendix**

### **A. Current Staff Roles (from Cerbos)**

| Role | Description |
|------|-------------|
| `PLATFORM_ADMIN` | Full platform access, all permissions |
| (Others TBD) | To be defined based on operational needs |

### **B. Current Organization Roles**

| Role | Description |
|------|-------------|
| `ADMIN` | Organization administrator |
| `MANAGER` | Organization manager |
| `BOARD_MEMBER` | HOA board member |
| `OWNER` | Property owner |
| `TENANT` | Property tenant |
| `VENDOR` | Service vendor |
| `MEMBER` | General member |
| `AUDITOR` | Read-only auditor |

### **C. Derived Roles (Cerbos)**

| Derived Role | Condition |
|--------------|-----------|
| `hestami_platform_admin` | `PLATFORM_ADMIN` in staffRoles |
| `hestami_staff` | Any staffRoles present |
| `org_admin` | `ADMIN` role in org |
| `org_manager` | `MANAGER` role in org |
| `org_management` | `ADMIN` or `MANAGER` in org |
| `org_stakeholder` | `OWNER`, `TENANT`, or `BOARD_MEMBER` in org |

