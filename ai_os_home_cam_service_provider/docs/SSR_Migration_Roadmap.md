# SSR Migration Roadmap

This roadmap outlines the steps to migrate the Hestami AI SvelteKit application from client-side stores to a Server-Side Rendering (SSR) architecture. The goal is to maximize SSR usage, improve type safety, and reduce client-side state.

**Guiding Principles:**
1.  **Prefer SSR**: Data should flow from `+page.server.ts` / `+layout.server.ts` -> `+page.svelte` / `+layout.svelte` -> Components (via props).
2.  **No Client-Side Stores for Server Data**: Delete `organizationStore`, `auth` store, and `camStore`.
3.  **Type Safety**: Use full Prisma generated types.

---

## Phase 1: Core Infrastructure & Layouts
**Goal**: Update root layouts to provide necessary data via props and remove store initialization.

- [x] **1.1: Update `src/routes/+layout.server.ts`**
    - [x] Modify `load` function to return full Prisma `Organization` objects in `memberships` (currently mapped manually).
    - [x] Ensure `user` and `staff` data is complete.
    - [x] **Critical:** Use `createDirectClient` with `buildServerContext` for any server-side data fetching (as per Onboarding Package Section 6b). Do NOT use default `orpc` client.
- [x] **1.2: Update `src/routes/+layout.svelte`**
    - [x] Remove `organizationStore`, `auth` imports.
    - [x] Remove `initializeOrganization` and `$effect` sync logic.
    - [x] Pass `user`, `memberships`, `organization` directly to `<Header />` as props.
    - [x] **Verify**: App should still load, though children using stores might break (temporarily) or rely on their own store subscriptions until refactored. *Note: To avoid breaking the app during migration, consider keeping the store initialization temporarily but marking it deprecated until all consumers are migrated.*

## Phase 2: Organization Switching (Server Action)
**Goal**: Move organization switching logic from client-side store to server-side form action.

- [x] **2.1: Create Switch Action**
    - [x] Create `src/routes/api/organization/switch/+server.ts`.
    - [x] Implement `POST` handler: verify membership, update `isDefault` flags in DB, redirect based on org type.
- [ ] **2.2: Verify Switching**
    - [ ] Test with `curl` or Postman that sending `organizationId` updates the default organization in the DB.

## Phase 3: Core Component Refactoring
**Goal**: Refactor shared components to accept props instead of using stores.

- [x] **3.1: Refactor `Header.svelte`**
    - [x] Remove store imports.
    - [x] Add props: `user`, `memberships`, `currentOrganization`.
    - [x] Pass these props down to `UserMenu`.
- [x] **3.2: Refactor `UserMenu.svelte`**
    - [x] Remove store imports.
    - [x] Add props: `user`, `memberships`, `currentMembership`.
    - [x] Replace `organizationStore.setCurrent()` with `<form action="/api/organization/switch" ...>`.
- [x] **3.3: Refactor `OrganizationSwitcher.svelte`**
    - [x] Update to use props and server actions similar to `UserMenu`.

## Phase 4: Page Component Migration (Batched)
**Goal**: Systematically remove store usages from page components. Broken down by feature area.

### Batch 4.1: Admin & Settings
- [x] Refactor `src/routes/app/admin/settings/+page.svelte`
- [x] Refactor `src/routes/app/admin/work-queue/+page.server.ts` (if using stores logic) & `+page.svelte`
- [x] Refactor `src/routes/app/admin/documents/+page.svelte`
- [x] Refactor `src/routes/app/admin/cases/[id]/vendors/+page.svelte`
- [x] Refactor `src/routes/app/admin/cases/[id]/vendors/[vendorId]/+page.svelte`

### Batch 4.2: Contractor & Concierge
- [x] Refactor `src/routes/app/contractor/+page.svelte`
- [x] Refactor `src/routes/app/contractor/jobs/+page.svelte`
- [x] Refactor `src/routes/app/contractor/technicians/+page.svelte`
- [x] Refactor `src/routes/app/contractor/technicians/[id]/+page.svelte`
- [x] Refactor `src/routes/app/concierge/+page.svelte`
- [x] Refactor `src/routes/app/owner/+page.svelte`

### Batch 4.3: Onboarding & Auth
*Note: Onboarding heavily relies on state. Carefully check if stores can be replaced by URL params or if they should remain as "Wizard" state exceptions (per Requirements doc, keeping them might be acceptable, but check for `auth`/`org` store dependencies).*
- [x] Refactor `src/routes/login/+page.svelte`
- [x] Refactor `src/routes/register/+page.svelte`
- [x] Refactor `src/routes/onboarding/+page.svelte`
- [x] Refactor `src/routes/onboarding/community/details/+page.svelte`
- [x] Refactor `src/routes/onboarding/community/review/+page.svelte`
- [x] Refactor `src/routes/onboarding/property-owner/details/+page.svelte`
- [x] Refactor `src/routes/onboarding/property-owner/review/+page.svelte`
- [x] Refactor `src/routes/onboarding/service-provider/details/+page.svelte`
- [x] Refactor `src/routes/onboarding/service-provider/review/+page.svelte`

## Phase 5: CAM Store Migration
**Goal**: Migrate `camStore` data (`currentAssociation`, `badgeCounts`) to SSR.

- [x] **5.1: Analyze `cam.ts` dependencies**
    - [x] Identify `currentAssociation` and `badgeCounts` usage.
- [x] **5.2: Update `src/routes/app/cam/+layout.server.ts`**
    - [x] Fetch `associations` and `badgeCounts` in the load function.
    - [x] **Critical:** Use `createDirectClient` for fetching badge counts from the API [COMPLETED: used parallel list calls].
    - [x] Return minimal necessary data.
- [x] **5.3: Update `src/routes/app/cam/+layout.svelte`**
    - [x] Receive data from server.
    - [x] Remove functional `camStore` logic (kept legacy sync).
    - [x] Pass data via props or strict context context (if deep nesting requires it, use `setContext` pattern instead of store).
    - *Note: A temporary `camStore` sync has been added to `+layout.svelte` to prevent breaking legacy pages (5.4).*
- [x] **5.4: Refactor CAM Pages**
    - [x] `src/routes/app/cam/+page.svelte`
    - [x] `src/routes/app/cam/associations/+page.svelte` [Refactored to props, Switch Assn via Form POST]
    - [x] `src/routes/app/cam/associations/[id]/+page.svelte` [SSR Load created, Refactored to props, Switch Assn via Form POST]
    - [x] `src/routes/app/cam/work-orders/+page.svelte` [SSR Load created, Refactored to props, Filters via URL]
    - [x] `src/routes/app/cam/violations/[id]/+page.svelte` [SSR Load created, Refactored to props]
- [ ] **5.5: Delete `src/lib/stores/cam.ts`**

## Phase 6: Cleanup & Final Verification
**Goal**: Remove dead code and ensure system stability.

- [ ] **6.1: Delete Stores**
    - [ ] Delete `src/lib/stores/organization.ts`.
    - [ ] Delete `src/lib/stores/auth.ts`.
    - [ ] Delete `src/lib/stores/cam.ts`.
    - [ ] Ensure `src/lib/stores/index.ts` no longer exports them.
- [ ] **6.2: Verify Real-time Governance**
    - [ ] Ensure `src/lib/stores/governanceLive.ts` is UNTOUCHED and fully functional (this store is an exception for SSE).
- [ ] **6.3: Type Check & Build**
    - [ ] Run `npm run check`.
    - [ ] Run `npm run build`.
