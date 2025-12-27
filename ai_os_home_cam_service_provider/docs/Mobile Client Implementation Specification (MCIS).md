# Mobile Client Implementation Specification (MCIS)

## 1. Purpose & Scope
This document defines the normative architectural requirements for the Hestami AI OS mobile clients (iOS and Android). These clients are designated as **thin, orchestration-aware UI layers** that delegate all business logic, authorization, and state management to the Hestami backend.

## 2. Architectural Principles & Constraints
*   **SERVER-AUTHORITATIVE**: The server is the sole source of truth for identity, permissions, workflow state, and business rules.
*   **THIN CLIENT**: Mobile clients MUST NOT implement complex business logic. They are responsible for rendering UI, collecting user intent, and executing server-defined workflows.
*   **STATELESS UI**: Client-side state MUST be ephemeral and synchronized with the server. Persisted data on the device is limited to session tokens and non-sensitive UI preferences.
*   **TYPE-SAFE COMMUNICATION**: All communication MUST use the generated oRPC/OpenAPI SDKs. 手動で (manually) defining API interfaces is strictly prohibited.

## 3. Client vs. Server Responsibilities

| Responsibility | Client (Mobile) | Server (Backend) |
| :--- | :--- | :--- |
| **Authentication** | Secure token storage, login UI | Session management, JWT issuance |
| **Authorization** | UI visibility (RBAC) | Resource-level enforcement (Cerbos/RLS) |
| **Workflow State** | Navigation between steps | Validating transitions, DBOS workflows |
| **Validation** | Input formatting, immediate UX feedback | Semantic validation, persistence |
| **Idempotency** | UUID generation for mutations | Deduplication of operations |

## 4. Identity, Authentication, and Session Handling
*   **Standard**: Better Auth / JWT.
*   **Session Lifecycle**:
    *   Clients must handle `401 Unauthorized` by attempting a token refresh or redirecting to login.
    *   **Organization Context**: Users MUST explicitly select an active organization context immediately after login. All subsequent API calls MUST include the `organization_id` in the context header or as a required parameter.
*   **Token Security**:
    *   iOS: Keychain Services.
    *   Android: EncryptedSharedPreferences.

## 5. Role-Based UX Composition Model
*   The mobile client uses a **Modular UI Engine** where the dashboard and navigation are composed based on the user's active role (defined by the `orgRoles` returned by the auth service).
*   **Visibility ≄ Permission**: While the UI may hide elements based on roles, all security MUST be enforced by the server.

## 6. UX Flow Binding Rules
*   Every major UX flow (e.g., submitting a Service Call) MUST map to a specific set of API endpoints.
*   **Mutating Operations**: MUST include a client-generated `idempotencyKey` (UUID).
*   **Durable Workflows**: Clients MUST support polling or WebSockets for tracking long-running DBOS workflows (e.g., "Reviewing" state in a Service Call).

## 7. State Management Rules
*   Use standard platform tools (SwiftUI `@StateObject`/`@Observable`, Jetpack Compose `ViewModel`).
*   Global state MUST be limited to:
    *   Active User / Session
    *   Active Organization
    *   Global Notification Count

## 8. Error, Validation, and Retry Handling
*   **Error Model**: Standard Hestami error envelope (`code`, `type`, `field_errors`, `trace_id`).
*   **Retries**: Exponential backoff for idempotent GET requests. No auto-retry for mutating requests without explicit user action.
*   **Validation**: UI MUST reflect `field_errors` returned by the server's Zod schemas.

## 9. Platform-Specific Guidance
### iOS (Swift / SwiftUI)
*   **Minimum OS**: iOS 16+
*   **Architecture**: MVVM or Clean Architecture.
*   **Persistence**: SwiftData for local cache (read-only).

### Android (Kotlin / Jetpack Compose)
*   **Minimum API**: 26 (Android 8.0)+
*   **Architecture**: Android Architecture Components (AAC).
*   **Persistence**: Room for local cache (read-only).

## 10. Telemetry and Observability
*   **Distributed Tracing**: All API calls MUST forward the server-provided `trace_id` in subsequent logs.
*   **Logging**: Clients MUST ship application logs to the central Hestami observability stack (SigNoz) with `organization_id` metadata.

## 11. Forbidden Behaviors
*   **MUST NOT** bypass the oRPC type pipeline.
*   **MUST NOT** cache sensitive data (SSNs, Financials) locally.
*   **MUST NOT** perform cross-tenant data joins client-side.
*   **MUST NOT** implement "Local-First" mutation logic.
