# (Phase 27) Association Management Requirements

## 1. Background and Context

The Hestami platform supports multiple types of organizations, including **Community Associations** (self-managed) and **Management Companies** (who manage multiple associations). 

While the core platform infrastructure supports multitenancy and organization hierarchies, the current CAM (Community Association Management) pillar UX for Management Companies is missing a critical feature: the ability to add new associations under their management after onboarding.

## 2. Problem Statement

A Management Company user, upon entering the CAM pillar, sees a list of existing associations (if any). However, there is no overt UX (buttons or forms) to "Add Managed Association". This creates a dead-end for management companies looking to scale their portfolio on the platform.

## 3. Goals

- Provide a clear, overt entry point in the Association list UI for creating a new association.
- Implement a robust, scalable backend flow for association creation that adheres to Hestami's architectural standards.
- Ensure all new associations are correctly stamped with the management company's `organizationId` for context.
- Automatically seed essential accounting structures (Chart of Accounts) for new associations.

## 4. Architectural Guidelines

### Backend (oRPC & DBOS)
- **oRPC Procedures**: Use type-safe `.errors()` and explicit input/output Zod schemas derived from the Prisma models.
- **DBOS Workflows**: All mutations (Creating the association, seeding accounts) **must** run within a durable DBOS workflow.
- **Idempotency**: Require an `idempotencyKey` for the creation process.
- **Authorization**: Use Cerbos policies to ensure only authorized personnel (e.g., `org_admin` of a management company) can create associations.

### Frontend (SvelteKit 5)
- **SSR Preferred**: Use server-side load functions and actions for the creation form.
- **UI Consistency**: Follow the CAM Pillar IA:
    - Sidebar navigation must remain stable.
    - Use the standard "Split-View" list + detail pattern.
    - Forms must use `Superforms` for validation.
- **Runes**: Leverage Svelte 5 runes (`$state`, `$derived`, `$props`) for state management.

## 5. Domain Alignment

- **Domain**: Governance
- **Primary Resource**: `association`
- **Navigation**: Lives under the `Associations` nav item in the CAM pillar.

## 6. Security & Multitenancy

- **RLS**: Row-Level Security must be respected. No cross-tenant leakage.
- **Organization Context**: The new association must be linked to the active management company's organization context.
