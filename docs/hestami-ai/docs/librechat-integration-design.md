# LibreChat Integration Design

**Date**: November 14, 2025  
**Status**: Design Phase

---

## Executive Summary

This document outlines the integration of LibreChat's chat interface into the Hestami AI platform for both web (SvelteKit) and mobile (iOS) clients. The design focuses on a thin-skin approach where LibreChat provides the chat UI/UX while Django maintains user identity as the single source of truth.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                Mobile Client (iOS) / Web Client (SvelteKit)      │
│              Slim Chat UI: Threads, Messages, Media Upload       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SvelteKit Server (BFF)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Session Management (Redis)                               │   │
│  │  - Django JWT (access + refresh)                         │   │
│  │  - LibreChat Session Cookie                              │   │
│  │  - User metadata                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ API Routing                                              │   │
│  │  - /api/* → Django Backend (existing routes)             │   │
│  │  - /api/chat/* → LibreChat API (new proxy routes)        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────┬────────────────────────────┬──────────────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────┐   ┌────────────────────────────────────┐
│   Django Backend     │   │      LibreChat API                 │
│  ┌────────────────┐  │   │  ┌──────────────────────────────┐  │
│  │ User Mgmt      │  │   │  │ Chat Interface               │  │
│  │ JWT Issuance   │  │   │  │ Conversation Storage         │  │
│  │ Service Req    │  │   │  │ AI Model Integration         │  │
│  │ Properties     │  │   │  │ File Uploads                 │  │
│  │ LibreChat Sync │  │   │  │ (MongoDB + MeiliSearch)      │  │
│  └────────────────┘  │   │  └──────────────────────────────┘  │
└──────────┬───────────┘   └────────────┬───────────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────┐   ┌────────────────────────────────────┐
│   PostgreSQL         │   │   MongoDB + MeiliSearch + Vector   │
│  (Django data)       │   │   (LibreChat data)                 │
└──────────────────────┘   └────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Authentication Strategy: Dual-Token Approach

**Decision**: Maintain separate authentication tokens for Django and LibreChat, both managed by SvelteKit.

**Rationale**:
- LibreChat uses its own session-based authentication with cookies
- Django uses JWT-based authentication
- Token expiration lifecycles are different (LibreChat sessions vs JWT expiry)
- LibreChat conversation history is tied to its internal user ID, not JWT claims

**Implementation**:
```typescript
// Redis Session Structure
session:{sessionId}:user          → User metadata (from Django)
session:{sessionId}:tokens        → Django JWT (access + refresh)
session:{sessionId}:librechat     → LibreChat session cookie
user:{userId}:session             → Session lookup by user ID
```

### 2. User Provisioning: Django → LibreChat Sync

**Decision**: Use DBOS workflow to automatically create LibreChat users when Django users register.

**Flow**:
```
1. User registers in Django
   ↓
2. Django creates user record
   ↓
3. DBOS workflow triggered (via Celery or direct call)
   ↓
4. Workflow calls LibreChat registration API
   ↓
5. Store LibreChat user ID in Django User model
   ↓
6. Return success to user
```

**Django Model Update**:
```python
class User(AbstractUser):
    # ... existing fields ...
    librechat_user_id = models.CharField(max_length=255, null=True, blank=True)
    librechat_synced_at = models.DateTimeField(null=True, blank=True)
    librechat_password_encrypted = models.CharField(
        max_length=500, 
        null=True, 
        blank=True,
        help_text="Encrypted password for LibreChat authentication"
    )
```

### 3. Password Management: Generated Password Strategy (Option B)

**Decision**: Generate separate random password for LibreChat, stored encrypted in Django.

**Rationale**:
- Django passwords are hashed (irreversible) - cannot retrieve plaintext
- LibreChat requires plaintext password for authentication
- Separate credentials improve security (credential isolation)
- User never needs to know LibreChat password
- Password changes in Django don't affect LibreChat

**Implementation**:
```python
class User(AbstractUser):
    # ... existing fields ...
    
    def generate_librechat_password(self) -> str:
        """Generate and encrypt random password for LibreChat"""
        password = secrets.token_urlsafe(32)  # 32-char random password
        cipher = Fernet(settings.LIBRECHAT_ENCRYPTION_KEY.encode())
        encrypted = cipher.encrypt(password.encode())
        self.librechat_password_encrypted = encrypted.decode()
        self.save()
        return password
    
    def get_librechat_password(self) -> str:
        """Decrypt and return LibreChat password"""
        cipher = Fernet(settings.LIBRECHAT_ENCRYPTION_KEY.encode())
        decrypted = cipher.decrypt(self.librechat_password_encrypted.encode())
        return decrypted.decode()
```

**Security**:
- Uses Fernet symmetric encryption (cryptography library)
- Encryption key stored in environment variable
- Password only accessible via authenticated Django API endpoint
- Never exposed to client directly

### 4. API Routing: SvelteKit as Proxy

**Decision**: All LibreChat API calls proxy through SvelteKit at `/api/chat/*`. **No changes to existing `/api/*` routes.**

**Rationale**:
- Consistent authentication handling
- Centralized error handling
- Ability to intercept and log chat activity
- Security: LibreChat not exposed directly to clients
- Future-proofing for malware scanning integration

**SvelteKit Route Structure**:
```
# Existing routes (unchanged)
/api/users/*                → Django Backend
/api/properties/*           → Django Backend
/api/services/*             → Django Backend
/api/media/*                → Django Backend

# New routes (additive only)
/api/chat/conversations     → LibreChat API
/api/chat/messages          → LibreChat API
/api/chat/files/images      → LibreChat API
/api/chat/agents/chat/*     → LibreChat API
/api/chat/convos/update     → LibreChat API
```

### 5. Media Upload Strategy: Hybrid Approach

**Decision**: Phase 1 - Direct to LibreChat; Phase 2 - Django malware scan integration.

**Phase 1 (MVP)**:
```
Client → SvelteKit → LibreChat /api/files/images
```

**Phase 2 (Enhanced Security)**:
```
Client → SvelteKit → Django (malware scan) → LibreChat /api/files/images
                      ↓
                   Store scan results in Django
```

**Rationale**:
- LibreChat may have plugin support for malware scanning (needs investigation)
- Django already has media handling infrastructure
- Phased approach allows MVP delivery while planning security enhancements

### 6. No Conversation Linking (Initially)

**Decision**: Do not store LibreChat conversation IDs in Django for Phase 1.

**Rationale**:
- Chats are exploratory (users asking questions before creating service requests)
- No direct mapping between conversations and service requests
- Reduces coupling between systems
- Can be added later if needed

---

## Component Design

### 1. SvelteKit LibreChat API Module

**File**: `frontend/sveltekit/hestami-ai-ui/src/lib/server/librechat.ts`

```typescript
/**
 * LibreChat API integration module
 * Handles authentication translation and request proxying
 */

export const LIBRECHAT_BASE_URL = env.LIBRECHAT_API_URL || 'http://librechat:3080';

/**
 * Authenticate with LibreChat using Django user credentials
 * Returns LibreChat session cookie
 */
export async function authenticateLibreChat(
  email: string,
  password: string
): Promise<string | null> {
  // Call LibreChat /api/auth/login
  // Return session cookie
}

/**
 * Make authenticated request to LibreChat API
 */
export async function librechatRequest(
  sessionId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get LibreChat session from Redis
  // Add session cookie to request
  // Proxy to LibreChat
  // Handle session refresh if needed
}

/**
 * Upload image to LibreChat
 */
export async function uploadImageToLibreChat(
  sessionId: string,
  file: File
): Promise<{ file_id: string; _id: string }> {
  // Proxy multipart upload to LibreChat /api/files/images
}
```

### 2. Django LibreChat Sync Service

**File**: `backend/django/hestami_ai_project/users/services/librechat_sync.py`

```python
"""
LibreChat User Synchronization Service
Handles user provisioning and sync between Django and LibreChat
"""

class LibreChatSyncService:
    """Service for syncing users with LibreChat"""
    
    def __init__(self):
        self.librechat_url = settings.LIBRECHAT_API_URL
    
    async def create_librechat_user(self, user: User) -> dict:
        """
        Create user in LibreChat
        Returns: {'user_id': str, 'success': bool}
        """
        # POST to LibreChat registration endpoint
        # Store librechat_user_id in Django User model
        pass
    
    async def sync_user_profile(self, user: User) -> bool:
        """
        Sync user profile updates to LibreChat (Phase 2)
        """
        pass
```

**File**: `backend/django/hestami_ai_project/users/workflows/librechat_provisioning.py`

```python
"""
DBOS Workflow for LibreChat User Provisioning
"""

from dbos import DBOS, WorkflowContext

@DBOS.workflow()
async def provision_librechat_user(ctx: WorkflowContext, user_id: str):
    """
    Workflow to provision user in LibreChat after Django registration
    """
    # Step 1: Get user from Django
    user = await ctx.invoke(get_user_by_id, user_id)
    
    # Step 2: Create LibreChat user
    result = await ctx.invoke(create_librechat_user_step, user)
    
    # Step 3: Update Django user with LibreChat ID
    await ctx.invoke(update_user_librechat_id, user_id, result['user_id'])
    
    return result
```

### 3. SvelteKit Chat API Routes

**File**: `frontend/sveltekit/hestami-ai-ui/src/routes/api/chat/[...path]/+server.ts`

```typescript
/**
 * Catch-all proxy for LibreChat API
 * Handles authentication translation and request forwarding
 */

import { librechatRequest } from '$lib/server/librechat';
import { checkAuthentication } from '$lib/server/auth';

export async function GET({ request, cookies, params }) {
  const sessionId = checkAuthentication(cookies, request.url);
  const path = params.path;
  
  const response = await librechatRequest(sessionId, `/api/${path}`, {
    method: 'GET',
    headers: request.headers
  });
  
  return response;
}

export async function POST({ request, cookies, params }) {
  const sessionId = checkAuthentication(cookies, request.url);
  const path = params.path;
  const body = await request.formData() || await request.json();
  
  const response = await librechatRequest(sessionId, `/api/${path}`, {
    method: 'POST',
    body,
    headers: request.headers
  });
  
  return response;
}
```

---

## Data Flow Scenarios

### Scenario 1: User Registration

```
1. User submits registration form (web or mobile)
   Body: { email, password, first_name, last_name }
   ↓
2. SvelteKit → Django POST /api/users/register/
   ↓
3. Django creates User record with hashed password
   ↓
4. Django generates random LibreChat password
   user.generate_librechat_password() → returns plaintext password
   Stores encrypted in user.librechat_password_encrypted
   ↓
5. Django triggers DBOS workflow: provision_librechat_user
   Passes: user_id, librechat_password (plaintext)
   ↓
6. Workflow calls LibreChat POST /api/auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "<generated_32_char_password>",
     "username": "john_doe"
   }
   ↓
7. LibreChat creates user, returns user_id
   ↓
8. Workflow updates Django User.librechat_user_id
   ↓
9. Django returns JWT tokens to SvelteKit
   ↓
10. SvelteKit creates session in Redis with Django JWT
   ↓
11. Return success to client
```

### Scenario 2: User Login

```
1. User submits login form
   Body: { email, password }
   ↓
2. SvelteKit → Django POST /api/users/login/
   ↓
3. Django validates user's password, returns JWT + user data
   ↓
4. SvelteKit creates session in Redis with Django JWT
   ↓
5. SvelteKit → Django GET /api/users/librechat-password/
   Headers: Authorization: Bearer <django_jwt>
   ↓
6. Django decrypts and returns LibreChat password
   Response: { librechat_password: "<generated_password>" }
   ↓
7. SvelteKit → LibreChat POST /api/auth/login
   Body: { email, password: "<librechat_password>" }
   ↓
8. LibreChat validates and returns session cookie
   ↓
9. SvelteKit stores LibreChat session in Redis
   session:{sessionId}:librechat → "librechat_session_cookie"
   ↓
10. Return success to client with session cookie
```

### Scenario 3: Chat Message Send

```
1. Client → SvelteKit POST /api/chat/agents/chat/google
   Headers: Cookie: session_id=<sessionId>
   Body: { text: "How do I fix a leaky faucet?", ... }
   ↓
2. SvelteKit validates session
   ↓
3. SvelteKit retrieves LibreChat session from Redis
   ↓
4. SvelteKit → LibreChat POST /api/agents/chat/google
   Headers: Cookie: <librechat_session>
   Body: { text: "How do I fix a leaky faucet?", ... }
   ↓
5. LibreChat processes (SSE stream)
   ↓
6. SvelteKit proxies SSE response to client
   ↓
7. Client receives streaming response
```

### Scenario 4: Image Upload

```
1. Client → SvelteKit POST /api/chat/files/images
   Headers: Cookie: session_id=<sessionId>
   Body: FormData with image file
   ↓
2. SvelteKit validates session
   ↓
3. SvelteKit retrieves LibreChat session from Redis
   ↓
4. SvelteKit → LibreChat POST /api/files/images
   Headers: Cookie: <librechat_session>
   Body: FormData (proxied)
   ↓
5. LibreChat processes upload, returns:
   {
     "message": "File uploaded and processed successfully",
     "_id": "691631f334d822c48acacc97",
     "file_id": "74919409-e131-48b7-950a-a93c545afed6",
     "bytes": 2256092
   }
   ↓
6. SvelteKit returns response to client
```

---

## Security Considerations

### 1. Password Management (Option B - APPROVED)

**Implementation**: Generated Password Strategy

**How It Works**:
1. User sets password for Django (hashed with bcrypt/PBKDF2)
2. Django generates separate 32-character random password for LibreChat
3. LibreChat password encrypted with Fernet (symmetric encryption)
4. Stored in `User.librechat_password_encrypted` field
5. Retrieved only via authenticated Django API endpoint
6. Used transparently by SvelteKit during login

**Security Benefits**:
- ✅ Credential isolation (separate passwords for each system)
- ✅ User never knows LibreChat password
- ✅ Django password changes don't affect LibreChat
- ✅ Encrypted at rest (Fernet encryption)
- ✅ Only accessible via authenticated API call
- ✅ Never exposed to client

**Encryption Details**:
- Algorithm: Fernet (symmetric encryption from `cryptography` library)
- Key: 32-byte key stored in environment variable `LIBRECHAT_ENCRYPTION_KEY`
- Key generation: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

**API Endpoint**:
```
GET /api/users/librechat-password/
Authorization: Bearer <django_jwt>
Response: { "librechat_password": "<decrypted_password>" }
```

### 2. Session Security

- All sessions stored in Redis with TTL
- HTTP-only cookies for session IDs
- Secure flag enabled in production
- SameSite=Strict for CSRF protection
- Regular session cleanup via Redis expiration

### 3. Network Security

- LibreChat not exposed to public internet
- Only accessible via Docker internal network
- SvelteKit acts as security gateway
- All external requests authenticated via Django JWT

---

## Malware Scanning Integration

### Investigation Needed: LibreChat Plugin Support

**Questions**:
1. Does LibreChat support plugins or middleware for file upload processing?
2. Can we hook into the upload pipeline before files are stored?
3. Does LibreChat have webhook support for file events?

### Proposed Approaches

**Approach 1: Django Pre-Scan (Recommended for Phase 2)**
```
Client → SvelteKit → Django (malware scan) → LibreChat
                      ↓
                   Store scan metadata
                   Reject if malicious
```

**Approach 2: LibreChat Plugin (If Supported)**
```
Client → SvelteKit → LibreChat (with malware scan plugin)
                      ↓
                   Plugin calls Django scan service
                   Plugin rejects if malicious
```

**Approach 3: Post-Upload Scan (Fallback)**
```
Client → SvelteKit → LibreChat (upload)
                      ↓
                   Async scan via DBOS workflow
                   Delete if malicious
                   Notify user
```

---

## Open Questions & Investigation Tasks

### 1. LibreChat Authentication Deep Dive

**Tasks**:
- [ ] Review LibreChat authentication source code
- [ ] Test if LibreChat accepts JWT tokens instead of session cookies
- [ ] Document LibreChat's user model and required fields
- [ ] Test session expiration and refresh mechanisms

**Files to Review**:
- `backend/LibreChat-main/api/server/routes/auth.js` (or similar)
- `backend/LibreChat-main/api/server/middleware/auth.js`

### 2. LibreChat Plugin System

**Tasks**:
- [ ] Review LibreChat documentation for plugin/extension support
- [ ] Check if file upload hooks exist
- [ ] Test webhook capabilities
- [ ] Evaluate MCP (Model Context Protocol) support for custom tools

### 3. Network Configuration

**Tasks**:
- [ ] Update LibreChat docker-compose.yml to join backend network
- [ ] Configure Traefik routing for LibreChat (if needed)
- [ ] Test SvelteKit → LibreChat connectivity
- [ ] Document network topology

### 4. Password Synchronization Strategy

**Tasks**:
- [ ] Decide on password management approach (A, B, or C)
- [ ] Implement password sync in user registration workflow
- [ ] Handle password change scenarios
- [ ] Test password reset flows

---

## Implementation Phases

### Phase 1: MVP (Core Integration)

**Goals**: Basic chat functionality for web and mobile clients

**Deliverables**:
1. ✅ Design document (this file)
2. ⬜ LibreChat authentication investigation
3. ⬜ Django User model update (librechat_user_id field)
4. ⬜ DBOS workflow for user provisioning
5. ⬜ SvelteKit librechat.ts module
6. ⬜ SvelteKit /api/chat/* proxy routes
7. ⬜ Basic chat UI component (web)
8. ⬜ Network configuration (Docker Compose)
9. ⬜ Integration testing
10. ⬜ Documentation

**Timeline**: 2-3 weeks

### Phase 2: Enhanced Features

**Goals**: Malware scanning, improved UX, mobile optimization

**Deliverables**:
1. ⬜ Malware scanning integration (Django pre-scan)
2. ⬜ Mobile chat UI (iOS)
3. ⬜ Conversation management (archive, delete)
4. ⬜ User profile sync (Django → LibreChat)
5. ⬜ Enhanced error handling
6. ⬜ Performance optimization

**Timeline**: 2-3 weeks

### Phase 3: Advanced Features (Future)

**Goals**: Advanced chat features, analytics, automation

**Deliverables**:
1. ⬜ Conversation archival workflow (DBOS)
2. ⬜ Chat analytics dashboard
3. ⬜ Service request generation from chat
4. ⬜ AI-powered suggestions
5. ⬜ Multi-modal support (video)

**Timeline**: TBD

---

## Technical Specifications

### Environment Variables

**Django** (`.env` or `settings.py`):
```bash
# LibreChat Integration
LIBRECHAT_API_URL=http://librechat:3080
LIBRECHAT_ENCRYPTION_KEY=<32_byte_fernet_key>  # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**SvelteKit** (`.env`):
```bash
LIBRECHAT_API_URL=http://librechat:3080
```

**LibreChat** (`.env`):
```bash
PORT=3080
MONGO_URI=mongodb://mongodb:27017/LibreChat
MEILI_HOST=http://meilisearch:7700
# ... other LibreChat config ...
```

### Docker Compose Updates

**File**: `backend/LibreChat-main/docker-compose.yml`

```yaml
services:
  api:
    container_name: LibreChat
    networks:
      - backend  # Add to backend network
    # ... rest of config ...

networks:
  backend:
    external: true  # Join existing backend network
```

### Redis Session Schema

```
# User session
session:{uuid}:user
{
  "id": "user-uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "user_role": "homeowner",
  "librechat_user_id": "librechat-user-id"
}

# Django JWT tokens
session:{uuid}:tokens
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}

# LibreChat session
session:{uuid}:librechat
"connect.sid=s%3A..."

# User lookup
user:{user-uuid}:session
"{session-uuid}"
```

---

## Testing Strategy

### Unit Tests

1. **Django LibreChat Sync Service**
   - Test user creation in LibreChat
   - Test error handling (LibreChat unavailable)
   - Test duplicate user scenarios

2. **SvelteKit LibreChat Module**
   - Test authentication translation
   - Test request proxying
   - Test session management

### Integration Tests

1. **User Registration Flow**
   - Register user in Django
   - Verify LibreChat user created
   - Verify session established

2. **Chat Flow**
   - Send message via SvelteKit proxy
   - Verify message reaches LibreChat
   - Verify response streams correctly

3. **File Upload Flow**
   - Upload image via SvelteKit proxy
   - Verify file stored in LibreChat
   - Verify file accessible in chat

### End-to-End Tests

1. **Web Client**
   - Complete registration → login → chat → upload flow
   - Test session persistence
   - Test logout

2. **Mobile Client**
   - Same as web client
   - Test mobile-specific UI constraints

---

## Monitoring & Observability

### Metrics to Track

1. **Authentication**
   - LibreChat user creation success rate
   - Session creation/refresh rate
   - Authentication failures

2. **Chat Performance**
   - Message send latency
   - SSE stream performance
   - File upload success rate

3. **Errors**
   - LibreChat API errors
   - Session expiration rate
   - Network connectivity issues

### Logging Strategy

1. **SvelteKit**
   - Log all LibreChat API calls (method, path, status)
   - Log authentication events
   - Log errors with stack traces

2. **Django**
   - Log user provisioning events
   - Log DBOS workflow execution
   - Log sync failures

3. **LibreChat**
   - Use LibreChat's built-in logging
   - Monitor MongoDB for conversation data

---

## Risk Assessment

### High Risk

1. **Password Synchronization**
   - **Risk**: Security vulnerability if passwords not handled correctly
   - **Mitigation**: Use Option B (generated passwords) or Option C (token-based auth)

2. **Session Management Complexity**
   - **Risk**: Session desync between Django and LibreChat
   - **Mitigation**: Comprehensive testing, clear session lifecycle management

### Medium Risk

1. **LibreChat API Changes**
   - **Risk**: LibreChat updates break integration
   - **Mitigation**: Pin LibreChat version, monitor releases, test upgrades

2. **Network Latency**
   - **Risk**: Double-hop (SvelteKit → LibreChat) adds latency
   - **Mitigation**: Optimize proxy code, consider caching, monitor performance

### Low Risk

1. **Malware Scanning Performance**
   - **Risk**: Scanning delays file uploads
   - **Mitigation**: Async scanning, user feedback, optimize scan service

---

## Success Criteria

### MVP Success Criteria

1. ✅ Users can register and login via web/mobile
2. ✅ Users can send/receive chat messages
3. ✅ Users can upload images to chat
4. ✅ Sessions persist across page reloads
5. ✅ Authentication works seamlessly (no manual LibreChat login)
6. ✅ No data loss during session transitions

### Phase 2 Success Criteria

1. ✅ All uploaded files scanned for malware
2. ✅ Mobile UI optimized for small screens
3. ✅ Users can manage (delete/archive) conversations
4. ✅ Performance meets SLA (<500ms for message send)

---

## Appendix

### A. LibreChat API Endpoints (From Captures)

```
POST /api/auth/login
POST /api/auth/register (assumed)
POST /api/agents/chat/google
POST /api/files/images
POST /api/convos/update
GET  /api/conversations (assumed)
GET  /api/messages (assumed)
```

### B. Django User Model Schema

```python
class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    user_role = models.CharField(max_length=20, choices=USER_ROLE_CHOICES)
    phone_number = models.CharField(max_length=20, blank=True)
    
    # LibreChat integration fields (NEW)
    librechat_user_id = models.CharField(max_length=255, null=True, blank=True)
    librechat_synced_at = models.DateTimeField(null=True, blank=True)
```

### C. SvelteKit API Module Pattern

The existing `src/lib/server/api.ts` provides a clean pattern for Django API calls. We'll create a parallel `src/lib/server/librechat.ts` with similar structure but adapted for LibreChat's authentication model.

---

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Next Review**: After Phase 1 investigation tasks completed
