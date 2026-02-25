# System Requirements Document (SRD) - Phase 40: LibreChat Integration

## 1. Introduction
### 1.1 Purpose
This document defines the requirements for integrating LibreChat as the primary conversational interface within the `hestami-ai-os` ecosystem. It covers authentication, backend orchestration, and native mobile client interfacing.

### 1.2 Scope
The scope includes:
- Centralizing identity management using Authentik.
- Implementing OIDC authentication for Web and Mobile clients.
- Developing a server-side service and DBOS workflows to interact with the LibreChat API.
- Exposing chat functionality via oRPC for native mobile UIs.

## 2. System Architecture
The integration follows a server-authoritative model:
- **Identity Provider (IdP):** Authentik serves as the OIDC provider for all components.
- **Web Client:** Uses `better-auth` to authenticate against Authentik.
- **Mobile Clients (iOS/Android):** Use native OIDC flows (Authorization Code + PKCE) against Authentik.
- **LibreChat:** Configured as a confidential OIDC client to Authentik.
- **Hestami Backend:** Orchestrates LibreChat API calls via durable DBOS workflows.

## 3. Functional Requirements

### 3.1 Authentication & Authorization
- **FR-1: Single Sign-On (SSO):** Users must be able to log in once via Authentik and access both the Hestami OS and LibreChat.
- **FR-2: Mobile PKCE:** Mobile clients must use the Proof Key for Code Exchange (PKCE) flow for secure authentication without client secrets.
- **FR-3: Role Mapping:** Authentik must pass user roles (e.g., Owner, Technician) to LibreChat via OIDC claims to control feature access.

### 3.2 Backend Orchestration
- **FR-4: LibreChat Service:** A dedicated backend service must encapsulate REST API calls to LibreChat (e.g., creating conversations, fetching history).
- **FR-5: Durable Workflows:** State-changing operations (like creating a chat linked to a Service Call) must be wrapped in DBOS workflows to ensure atomicity and idempotency.
- **FR-6: oRPC API:** The backend must expose chat management functions to clients via oRPC routers.

### 3.3 Client Interfaces
- **FR-7: Native Mobile UI:** Mobile clients must implement native SwiftUI (iOS) and Jetpack Compose (Android) interfaces for initiating and managing chat sessions.
- **FR-8: Contextual Linking:** The system must support linking specific LibreChat `conversationId`s to Hestami entities (e.g., `ConciergeCase`, `Property`) in the database.

## 4. Technical Specifications

### 4.1 Backend Components
- **Service Layer:** `LibreChatService` using `fetch` with Bearer token authentication.
- **Workflow Layer:** `createChatWorkflow` using `DBOS.runStep` for API calls and database persistence.
- **API Layer:** `chatRouter` (oRPC) for client-to-server communication.

### 4.2 Database Schema (Prisma)
The `ConciergeCase` or similar entities should be extended to include:
```prisma
model ConciergeCase {
  id                String   @id @default(uuid())
  libreChatId       String?  // Reference to LibreChat conversation
  // ... other fields
}
```

## 5. Non-Functional Requirements

### 5.1 Security
- All API keys for LibreChat must be stored as server-side environment variables.
- Mobile clients must never store or transmit the LibreChat API key.

### 5.2 Reliability
- Use of DBOS ensures that if a chat is created in LibreChat but the Hestami database update fails, the workflow can be retried or compensated.

### 5.3 Performance
- Chat initialization should happen asynchronously where possible, providing immediate feedback to the user.

## 6. Interface Requirements

### 6.1 LibreChat API
- Base URL: Defined via `LIBRECHAT_API_URL`.
- Auth: API Key defined via `LIBRECHAT_API_KEY`.

### 6.2 Hestami oRPC API
- `chat.create`: 
    - Input: `{ title: string, idempotencyKey: string }`
    - Output: `{ conversationId: string }`

## 7. Implementation Plan (Phase 40)
1. Configure Authentik Providers for Web, Mobile, and LibreChat.
2. Update LibreChat `.env` for OIDC.
3. Implement `LibreChatService` in the Hestami backend.
4. Implement `createChatWorkflow` in DBOS.
5. Expose `chatRouter` via oRPC.
6. Implement native "Start Chat" UI in SwiftUI and Jetpack Compose.
```

<!--
[PROMPT_SUGGESTION]Create a technical guide for configuring the Authentik OIDC provider specifically for this LibreChat integration.[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]Show me the Prisma schema changes needed to link LibreChat conversations to Service Calls as defined in the SRD.[/PROMPT_SUGGESTION]
