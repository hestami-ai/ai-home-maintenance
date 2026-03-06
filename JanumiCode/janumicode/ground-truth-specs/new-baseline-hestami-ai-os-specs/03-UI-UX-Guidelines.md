# Hestami OS: UI/UX Guidelines & Component Architecture

*Every UI requirement added below MUST include a `[Source: Phase X]` citation.*

## Phase 19: Staff Onboarding UI
- **Redirection Logic (`app/+layout.server.ts`):** Forces `@hestami-ai.com` accounts out of standard app flows. If no staff profile -> redirect to `/staff/pending`. If `PENDING` -> redirect to `/staff/activate`. [Source: Phase 19]
- **Activation Screen (`/staff/activate`):** Single-input form for the 8-char activation code. Redirects to `/app/admin` on success. [Source: Phase 19]
- **Admin Setup Screen:** `app/admin/staff/new` accepts Email instead of UserID. Displays plain activation code on success for admin to hand to user out-of-band. [Source: Phase 19]

## Phase 22: Admin Permissions & Settings UX
- **Permissions Dashboard (`/app/admin/permissions`):** Read-only cross-org view of membership roles, role definitions matrix, and detailed audit log with filters. [Source: Phase 22]
- **Settings Dashboard (`/app/admin/settings`):** Editable platform settings, feature flags overrides, integration management, and security settings config. [Source: Phase 22]

## Phase 24: Document Processing Queue (DPQ) UI
- **Admin DPQ Dashboard (`/app/admin/document-processing`):** Dedicated page featuring 5 tabs: Processing, Auto-Retry, Needs Attention, Infected, History. Displays metrics badges and bulk retry functionality. [Source: Phase 24]
- **Platform User Status Badges:** The concierge users view their document uploads with explicit status badges (`PROCESSING` spinner, `PROCESSING_FAILED` clock/warning, `ACTIVE` checkmark) and the ability to cancel an upload mid-flight. [Source: Phase 24]

## Phase 27: Association Management UI
- **CAM Association Creation:** Entry point is a "New Association" button in the `listPanel` header at `/app/cam/associations`. [Source: Phase 27]
- **Creation Form (`/app/cam/associations/new`):** Sectioned layout covering Profile (Name, Legal Name, Tax ID, Fiscal Year), Accounting, and Contract details. Uses `Superforms` for validation and Svelte 5 runes. [Source: Phase 27]

## Phase 28: Governance & Staff UI
- **Staff Management (`/app/cam/management/staff`):** Split-view directory with filtering. Tabbed detail for assignments. Staff Onboarding modal enforces CAM pillar restrictions. [Source: Phase 28]
- **Party Picker:** A custom `PartyPicker` component (similar to `AssociationSelector`) is required in modals for assigning Board/Committee members from existing `Party` records. [Source: Phase 28]
- **Committee Directories:** Dedicated lists and detail views for Committees under `/app/cam/governance/committees`. [Source: Phase 28]

## Phase 30: Association Isolation UI
- **Association Switcher (`AssociationSwitcher.svelte`):** Placed in the global header for CAM staff to explicitly switch contexts (populates `$currentAssociation` in `camStore`). [Source: Phase 30]
- **Contextual Filtering:** Document lists and sidebar badges dynamically filter based on the active Association context. Form uploads implicitly pass the `associationId`. [Source: Phase 30]

## Phase 31: International UI Support
- **Locales & Currency:** Display fields format dates and currency amounts using the organization's `defaultLocale` and `defaultCurrencyCode`. [Source: Phase 31]

## Phase 32: Reserve Studies UI
- **CAM Dashboard (`/app/cam/reserve-studies`):** Dedicated UI for component inventory, tracking snapshots for specific studies, and editing funding schedules. Includes CSV exports for inventory and schedules. [Source: Phase 32]

## Phase 33: Statutory Compliance UI
- **CAM Dashboard (`/app/cam/compliance`):** Provides an overview of Overdue and Due Soon compliance items. Detail pages combine checklists and document attachment features. Template creation page requires specific access. [Source: Phase 33]

## Phase 37: Staff Portal Organizations Management
- **List & Detail Views:** `/app/admin/organizations` showing stats (total/active/suspended), table with badge statuses, search, and type-contextual tabs on the detail page (e.g., properties vs cases vs vendors tab). Overrides previous `/customers` route via a 301 redirect. [Source: Phase 37]
- **Admin Constraints:** Platform Admins can edit/suspend, while typical Staff only view. Uses Cerbos `organization_admin.yaml`. [Source: Phase 37]

## Phase 38: Join Existing Organization Flow
- **Unified Onboarding:** Adds a 4th vector card at `/onboarding` for "I was invited to join", routing to `/onboarding/join/invitation`. Admins generate codes in pillar-specific `/members/invite` paths. [Source: Phase 38]
- **Auto-Detection Banner:** If a logged-in user has pending invitations matching their email, a banner component displays on layout load. [Source: Phase 38]

## UX Principles (Phase 5 Platform UX & Phase 6 CAM IA)
- **Identity != Authority**: Registration creates user identity. Authority requires active organization selection. UX MUST never imply a user has authority not explicitly granted by Cerbos policies.
- **Explicit Organization Scope**: Users must actively select an organization context via an explicit switcher in the persistent header. No silent data blending. Switching resets context entirely.
- **Intent-Based Onboarding (Entry Vectors)**: "I own a property" -> Concierge Dashboard, "I manage a community" -> CAM Dashboard, "I run a business" -> Service Provider Dashboard. The UX path restricts the visibility of tools outside that persona.
- **Role/Authority UI Component**: Explicitly badge every user with their role and specific scope (e.g. `RoleBadge` color-coded).
- **Tech Stack Guidelines**: SvelteKit 5 + Runes. Skeleton UI + Flowbite Svelte for components. Superforms for forms, Lucide for icons. Server-side rendering preferred.
- **Canonical CAM Navigation**: The layout utilizes a strict, non-negotiable 11-item sidebar (`Dashboard, Associations, Units & Properties, Violations, ARC Requests, Work Orders, Vendors, Documents & Records, Accounting, Governance, Reports`). Items are hidden entirely via Cerbos checks rather than re-ordered.
- **Split-View Model**: The primary presentation layout for any records. Left Pane (Dense list with filters/sorts) + Right Pane (Detail view with multi-tab approach: Overview, Documents, History/Audit).
- **Mandatory Decision Rationale**: All UI actions that assert authoritative changes (e.g. Confirming a Violation, Approving ARC, Authorizing WO) must spawn a modal demanding user 'Rationale' before proceeding.
- **Decision-Centric Documents**: Documents must be tied to entities and categorize correctly on upload. Never allow inline document editing. Referenced versions cannot be deleted.
- **Governance Constraints**: Governance panels (Meetings, Motions) must enforce strict voting irreversibility and capture conflict-of-interest checks.
- **Dashboard Action Queue**: The Dashboard is strictly a derived view with four fixed sections: `Requires Action`, `Risk & Compliance`, `Financial Attention`, `Recent Governance Activity`. No drag-and-drop customization. **No inline actions allowed**—all cards must deep-link to heavily filtered canonical lists.

## Generalized UI Guidelines
- **Type Generation Pipeline**: UI components MUST source categorical constants and enums directly from the centralized `generated` structures (via utilities like `documentCategories.ts` referencing `types.generated.ts`). Manual enumeration drift across the Svelte layer is explicitly banned. All API interactions should use the `orpc` router clients.
- **SSR-First Migration:** We mandate Server-Side Rendering (SSR) via `+page.server.ts` data loading over client-side stores (`organizationStore`, `auth`, `camStore` have been deleted). Svelte's `$page.data` explicitly flows via component props. Use of `onMount` and `$effect` should be limited entirely to client-side only interactions (like UI dropdowns or modals). Use form actions (`POST /api/organization/switch`) to handle state like Org switching. [Source: SSR Migration]
- **Role-Based UX Mobile Flows:** App flows center around Intake, Decision, and Outcome. Example: Homeowner submits a Service Call (`serviceCall.create`) -> CAM oversight (`violation.create`, `workOrder.updateStatus`) -> Quotes Approved -> Service Provider Jobs (`job.checkIn`, `job.complete`). [Source: RB-UXFR]
- **Landing Page Constraints:** Marketing pages require SaaS-style professional aesthetics using the Inter font family, 24px wide border radii, large white/negative spacing, and high-fidelity photography mixed with floating, minimalist software UIs (e.g., iPhone framing for a plumbing leak workflow estimation). [Source: System Architecture]
- **Landing Page Constraint**: Never include "dashboard" screens on the landing platform or root domains (`src/routes/+page.svelte`). All dashboards load under authenticated sub-routes like `/app/dashboard`, or `/app/cam`. The landing page layout is distinct and avoids Svelte store dependencies.
- **Mobile Client Constraints:** The Native Mobile app MUST act as a thin client merely orchestrating roles returned by the JWT server token and rendering context-mapped interfaces without duplicating validation or join logic. Follows MVVM (iOS) and AAC (Android) with state tracked from active user, active org, and real-time backend updates via Polling/WebSockets mapped through an oRPC SDK. [Source: MCIS]
- **Mobile Client Constraints**: Thin orchestrator layer. Server authoritative validation (workflow endpoints) instead of robust localized offline handling for complex state (apart from specific queue mechanisms required for dispatch sync). Built via natively decoupled APIs not emulating browser context.

---
