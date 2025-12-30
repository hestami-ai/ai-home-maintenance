# SSR Migration Requirements Document

## Overview

This document specifies the requirements for migrating the Hestami AI SvelteKit application from a client-side store-based architecture to a Server-Side Rendering (SSR) first architecture. The goal is to eliminate client-side stores for data that can be provided via SSR, ensuring type consistency and alignment with the Hestami AI Onboarding Guide.

## Guiding Principles

1. **Prefer SSR to the maximum extent possible** - Per the Hestami AI Onboarding Guide
2. **Constrain `onMount` and `$effect` to strictly necessary circumstances** - Only for client-side interactivity (dropdowns, modals)
3. **Data flows via props, not stores** - Server load functions provide data, components receive via props
4. **Full Prisma types throughout** - No custom minimized interfaces; send full data objects
5. **Type extraction from `types.generated.ts`** - For API response types only, not custom interfaces

---

## Phase 1: Core Infrastructure

### 1.1 Remove `organizationStore`

**Current State:**
- `src/lib/stores/organization.ts` defines `organizationStore` with `OrganizationMembership` interface
- Used by ~81 components to access current organization and memberships
- Initialized in `+layout.svelte` from server data

**Target State:**
- Delete `src/lib/stores/organization.ts`
- Organization data flows from `+layout.server.ts` → `+layout.svelte` → child components via props
- Components access organization via `$page.data` or explicit props

**Implementation Steps:**
1. Update `+layout.server.ts` to return full Prisma `Organization` objects in memberships
2. Update `+layout.svelte` to pass data via props to `Header`
3. Update `Header.svelte` to receive and pass props to `UserMenu`
4. Update `UserMenu.svelte` to receive all data via props (no store access)
5. Remove `organizationStore` import from all components
6. Delete `src/lib/stores/organization.ts`

### 1.2 Remove `auth` Store

**Current State:**
- `src/lib/stores/auth.ts` defines `auth` store with user session data
- Initialized in `+layout.svelte` from server data

**Target State:**
- Delete `src/lib/stores/auth.ts`
- User data flows from `+layout.server.ts` → components via props or `$page.data`

**Implementation Steps:**
1. Update `+layout.svelte` to pass `user` to `Header` as prop
2. Update `Header.svelte` to pass `user` to `UserMenu` as prop
3. Remove `auth` import from all components
4. Delete `src/lib/stores/auth.ts`

### 1.3 Keep `theme` Store (Exception)

**Rationale:** Theme preference requires `localStorage` access and instant toggle without page reload.

**Action:** Keep `src/lib/stores/theme.ts` as-is. This is an acceptable client-side store.

---

## Phase 2: Organization Switching

### 2.1 Create Server Action for Organization Switching

**Current State:**
- `UserMenu.svelte` calls `organizationStore.setCurrent()` and does `window.location.href` redirect

**Target State:**
- Organization switching via SvelteKit form action
- Server sets the default organization in database
- Server redirects to appropriate app section

**Implementation Steps:**

1. Create `src/routes/api/organization/switch/+server.ts`:
```typescript
import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, locals }) => {
    const formData = await request.formData();
    const organizationId = formData.get('organizationId') as string;
    
    if (!locals.user) {
        throw redirect(303, '/login');
    }
    
    // Verify membership
    const membership = await prisma.userOrganization.findUnique({
        where: {
            userId_organizationId: {
                userId: locals.user.id,
                organizationId
            }
        },
        include: { organization: true }
    });
    
    if (!membership) {
        throw redirect(303, '/app');
    }
    
    // Clear existing default, set new default
    await prisma.$transaction([
        prisma.userOrganization.updateMany({
            where: { userId: locals.user.id, isDefault: true },
            data: { isDefault: false }
        }),
        prisma.userOrganization.update({
            where: { id: membership.id },
            data: { isDefault: true }
        })
    ]);
    
    // Redirect based on org type
    const orgType = membership.organization.type;
    let redirectPath = '/app';
    if (orgType === 'INDIVIDUAL_PROPERTY_OWNER' || orgType === 'TRUST_OR_LLC') {
        redirectPath = '/app/concierge';
    } else if (orgType === 'COMMUNITY_ASSOCIATION' || orgType === 'MANAGEMENT_COMPANY') {
        redirectPath = '/app/cam';
    } else if (orgType === 'SERVICE_PROVIDER') {
        redirectPath = '/app/contractor';
    }
    
    throw redirect(303, redirectPath);
};
```

2. Update `UserMenu.svelte` to use form submission:
```svelte
<form method="POST" action="/api/organization/switch">
    <input type="hidden" name="organizationId" value={membership.organization.id} />
    <button type="submit" class="...">
        {membership.organization.name}
    </button>
</form>
```

---

## Phase 3: Component Refactoring

### 3.1 `+layout.svelte`

**Changes:**
- Remove `organizationStore` and `auth` imports
- Remove `initializeOrganization()` function
- Remove `$effect` that syncs stores
- Pass data directly to `Header` component

**Before:**
```svelte
<script lang="ts">
    import { auth, organizationStore } from '$lib/stores';
    // ... store initialization logic
</script>
<Header />
```

**After:**
```svelte
<script lang="ts">
    import { theme } from '$lib/stores'; // Only theme store remains
    
    let { data, children } = $props();
</script>
<Header 
    user={data.user} 
    memberships={data.memberships}
    currentOrganization={data.organization}
/>
```

### 3.2 `Header.svelte`

**Changes:**
- Remove store imports
- Accept props for user, organization, memberships
- Pass props to `UserMenu`

**Props Interface:**
```typescript
interface Props {
    user: User | null;
    memberships: Array<{ organization: Organization; role: string; isDefault: boolean }>;
    currentOrganization: Organization | null;
}
```

### 3.3 `UserMenu.svelte`

**Changes:**
- Remove store imports and default values from stores
- Accept all data via required props
- Use form action for org switching
- Keep only `isOpen` as client-side state (for dropdown)

**Props Interface:**
```typescript
interface Props {
    user: User;
    memberships: Array<{ organization: Organization; role: string; isDefault: boolean }>;
    currentMembership: { organization: Organization; role: string; isDefault: boolean } | null;
}
```

**Allowed Client-Side State:**
- `isOpen: boolean` - Dropdown toggle state
- Keyboard event listener for Escape key

### 3.4 `OrganizationSwitcher.svelte`

**Changes:**
- Remove store imports
- Accept props
- Use form action for switching

---

## Phase 4: Page Components

### 4.1 Pattern for Page Components

All page components should:
1. Get data from `+page.server.ts` load function
2. Access organization context via `await parent()` in load function
3. Pass data to child components via props

**Example `+page.server.ts`:**
```typescript
export const load: PageServerLoad = async ({ parent, locals }) => {
    const { organization, memberships } = await parent();
    
    // Fetch page-specific data using organization context
    const data = await fetchData(organization.id);
    
    return { data, organization, memberships };
};
```

**Example `+page.svelte`:**
```svelte
<script lang="ts">
    let { data } = $props();
</script>

<MyComponent 
    organization={data.organization}
    items={data.items}
/>
```

### 4.2 Components to Update

The following components import stores and need refactoring:

**High Priority (blocks other work):**
- `src/lib/components/layout/Header.svelte`
- `src/lib/components/layout/UserMenu.svelte`
- `src/lib/components/layout/OrganizationSwitcher.svelte`
- `src/routes/+layout.svelte`
- `src/routes/app/+layout.svelte`

**Medium Priority:**
- `src/lib/components/ui/RoleIndicator.svelte`
- `src/lib/components/ui/PermissionGate.svelte`
- `src/lib/components/ui/AuthorityCard.svelte`
- `src/lib/components/cam/RequiresActionCard.svelte`
- `src/lib/components/cam/AssociationSelector.svelte`
- `src/lib/components/cam/CamSidebar.svelte`

**Lower Priority (page components):**
- All files in `src/routes/app/**/*.svelte` that import stores
- All files in `src/routes/onboarding/**/*.svelte` that import stores

---

## Phase 5: Onboarding Flow

### 5.1 Current State

Onboarding uses stores to track multi-step form state:
- `communityOnboarding`
- `propertyOwnerOnboarding`
- `serviceProviderOnboarding`

### 5.2 Target State

Options (choose one):
1. **URL-based state** - Store form data in URL query params
2. **Server session** - Store form data in server-side session
3. **Keep stores** - Onboarding is a special case where client-side state is acceptable

**Recommendation:** Keep onboarding stores for now. They are isolated to the onboarding flow and don't affect the main app architecture.

---

## Phase 6: Type Consistency

### 6.1 Use Full Prisma Types

All components should use the full Prisma `Organization` type, not minimized versions.

**Correct:**
```typescript
import type { Organization } from '../../../generated/prisma/client';

interface Props {
    organization: Organization;
}
```

**Incorrect:**
```typescript
interface Props {
    organization: { id: string; name: string; slug: string };
}
```

### 6.2 Type Extraction for API Responses

When working with API response types, extract from `types.generated.ts`:

```typescript
import type { operations } from '$lib/api/types.generated';

export type OrganizationListItem = operations['organization.list']['responses']['200']['content']['application/json']['data']['organizations'][number];
```

---

## Verification Checklist

After migration, verify:

- [ ] `npm run check` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] User can log in and see their organizations
- [ ] User can switch organizations (page reloads to new context)
- [ ] User can sign out
- [ ] All app sections load correctly with organization context
- [ ] No console errors related to stores or hydration
- [ ] `src/lib/stores/organization.ts` is deleted
- [ ] `src/lib/stores/auth.ts` is deleted
- [ ] Only `theme.ts` remains in stores directory (plus any onboarding stores)

---

## Files to Delete

After successful migration:
- `src/lib/stores/organization.ts`
- `src/lib/stores/auth.ts`

## Files to Create

- `src/routes/api/organization/switch/+server.ts`

## Files to Modify

See Phase 3 and Phase 4 for complete list of ~81 files.

---

## Rollback Plan

If issues arise:
1. Revert to previous commit
2. Stores remain functional as fallback
3. Incremental migration can be paused at any phase

---

## Success Criteria

1. Zero client-side stores for auth/organization data
2. All data flows from server → client via props
3. Type consistency maintained (full Prisma types)
4. `npm run check` passes
5. Application functions correctly in browser
