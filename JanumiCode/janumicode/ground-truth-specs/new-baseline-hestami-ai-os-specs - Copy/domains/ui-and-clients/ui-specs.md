# UI and Clients - Architecture Specifications

## 1. Web Application Layout Hierarchies
The web application is structured by pillar. Each pillar has boundary layouts that enforce authentication and active organization validation.

- `/app/cam`: Community Association Management. Assumes CAM role, requires `organization_id` header, optionally sets `association_id` context.
- `/app/concierge`: Resident/Concierge interface. Assumes Owner/Concierge role, requires `organization_id` header.
- `/app/service-provider`: Vendor/Contractor interface. Assumes Service Provider role, requires `organization_id` header.
- `/app/admin`: Platform administration (e.g., global Document Processing Queue). Assumes Staff role.

## 2. Standard Form Mutation Flow (Web)
1. User clicks "Save".
2. `superforms` intercepts, validates locally against Zod schema.
3. Form POSTs to standard SvelteKit action in `+page.server.ts`.
4. Action injects idempotency UUID.
5. Action calls oRPC strongly-typed client (`rpc.domain.create({ ... })`).
6. Action catches and parses oRPC errors (`VALIDATION_FAILED`), returns them to `superforms`.
7. Client-side toast displays `INTERNAL_SERVER_ERROR` or success.

## 3. Mobile Tech Stack
- **iOS:**
  - Swift / SwiftUI (Minimum iOS 16+)
  - MVVM or Clean Architecture
  - SwiftData for read-only local caching
- **Android:**
  - Kotlin / Jetpack Compose (Minimum API 26+)
  - Android Architecture Components (AAC)
  - Room for read-only local caching

## 4. Mobile Role-Based UX Composition
Mobile navigation is dynamic. A single app binary exists, but the "Modular UI Engine" exposes tabs/screens strictly based on the user's `orgRoles` returned after login or organization switching. If a user is both a Board Member and an Owner, the UI composes both sets of capabilities. Security is still enforced server-side.
