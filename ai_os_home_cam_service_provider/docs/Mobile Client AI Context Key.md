# Mobile Client AI Context Key

## 1. Architectural Invariants
*   **Platform**: Hestami AI OS (Mobile).
*   **Core Role**: Thin UI / Orchestration layer.
*   **Logic Location**: 100% Server-side (DBOS/oRPC).
*   **Trust Boundary**: Client is untrusted; all inputs validated via Zod; all actions authorized via Cerbos.
*   **Type Safety**: Source of truth is `prisma/schema.prisma` -> `openapi.json` -> Managed SDK.

## 2. Mandatory Behaviors (MUST)
*   **UUID Idempotency**: All `POST/PATCH/DELETE` calls MUST include a unique `idempotencyKey`.
*   **Explicit Scoping**: All API calls MUST be scoped to an active `organization_id`.
*   **Standard Errors**: Handle `StandardErrorEnvelope` (code, type, field_errors) for all UI feedback.
*   **Telemetry**: Forward `trace_id` and include `organization_id` in all telemetry spans.
*   **Context Check**: Prompt user for Organization selection if no active context is found post-auth.

## 3. Forbidden Behaviors (MUST NOT)
*   **NO Business Logic**: Do not calculate prices, permissions, or complex state transitions on-device.
*   **NO Manual SDKs**: Never manually define an interface that exists in the generated types.
*   **NO Local Persistence**: Never store sensitive data or master records in local DBs (Room/SwiftData).
*   **NO Cross-Tenant Leakage**: Do not allow UI interactions between different organizations unless explicitly proxied by a specific cross-org API.

## 4. High-Level Flow Rules
1. **Intake**: Gather minimal intent -> Server creates Case -> Client tracks Case status.
2. **Decision**: Server presents options (Quotes/Tasks) -> Client collects choice -> Server executes.
3. **Outcome**: Server completes workflow -> Client renders terminal state.

## 5. Development Pipeline
`Prisma` -> `Zod` -> `oRPC` -> `OpenAPI` -> `Mobile SDK (Generated)`.
*If a type is missing, it must be added to the Backend first.*
