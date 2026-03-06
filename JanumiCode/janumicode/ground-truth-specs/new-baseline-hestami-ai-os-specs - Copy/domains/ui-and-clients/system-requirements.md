# UI and Clients - System Requirements

## 1. Web Client (SvelteKit 5) Core Principles
- **SSR Preferred:** Use Server-Side Rendering (`+page.server.ts`) for data fetching to ensure SEO, performance, and secure token handling.
- **Svelte 5 Runes:** Use `$state`, `$derived`, and `$props` for all reactivity. Legacy reactivity (`let x = ...; $: `) is deprecated.
- **Form Handling:** All forms MUST use `sveltekit-superforms` integrated with Zod schemas matching the oRPC endpoint inputs.
- **Layout Consistency:** Use the "Split-View" list + detail pattern across platform pillars (CAM, Concierge, Service Providers).
- **CSS Framework:** TailwindCSS with Skeleton UI for component primitives. Lucide Svelte for iconography.

## 2. Mobile Clients (iOS & Android) MCIS
- **Thin, Orchestration-Aware Clients:** Mobile clients MUST NOT implement complex business logic. They render UI, collect intent, and blindly execute server-defined workflows.
- **Server-Authoritative:** The backend is the sole source of truth for identity, permissions, state, and rules.
- **Type-Safe Communication:** All communication MUST use generated oRPC/OpenAPI SDKs. No manual interface definitions.
- **Stateless UI:** Persisted data is limited to session tokens (Keychain/EncryptedSharedPreferences) and non-sensitive UI preferences. No offline-first mutation logic.

## 3. Operations & Patterns (Cross-Platform)
- **Idempotency:** The client (Web or Mobile) MUST generate a UUID for every mutating request (Create/Update/Delete) to safely retry network timeouts.
- **Context Injection:** Clients MUST explicitly pass the `organization_id` (and `association_id` if in CAM context) in the request headers (`X-Org-Id`, `X-Assoc-Id`) or body depending on the auth implementation.
- **Errors:** Standard error envelopes (`code`, `type`, `field_errors`, `trace_id`) are returned. Clients map `field_errors` to inputs.
- **Telemetry:** Mobile and Web clients should forward the `trace_id` and ship UI error logs to the central observability stack (SigNoz).
