# LibreChat SvelteKit Implementation

**Date**: November 14, 2025  
**Status**: Complete

---

## Overview

This document details the SvelteKit implementation for LibreChat integration, including the LibreChat module, authentication flow updates, and API proxy routes.

---

## Implemented Components

### 1. LibreChat Module

**File**: `frontend/sveltekit/hestami-ai-ui/src/lib/server/librechat.ts`

#### Functions

**Session Management**:
- `getLibreChatSession(sessionId)` - Retrieves LibreChat session from Redis
- `setLibreChatSession(sessionId, librechatSession)` - Stores LibreChat session in Redis

**Authentication**:
- `authenticateLibreChat(email, password)` - Authenticates with LibreChat API
- `getLibreChatPasswordFromDjango(djangoAccessToken)` - Fetches LibreChat password from Django

**API Requests**:
- `librechatRequest(sessionId, path, options)` - Makes authenticated requests to LibreChat
- `uploadImageToLibreChat(sessionId, file)` - Handles image uploads

#### Key Features

- Async implementation
- Redis session storage (24-hour TTL)
- Cookie parsing for LibreChat session
- Error handling and logging
- Support for FormData and JSON requests

---

### 2. Updated Login Flow

**File**: `frontend/sveltekit/hestami-ai-ui/src/lib/server/auth/index.ts`

#### Login Flow Steps

```
1. User submits login form (email + password)
   ↓
2. Authenticate with Django
   POST /api/users/login/
   ↓
3. Create Django session in Redis
   Store JWT tokens
   ↓
4. Fetch LibreChat password from Django
   GET /api/users/librechat-password/
   Authorization: Bearer <django_jwt>
   ↓
5. Authenticate with LibreChat
   POST http://librechat:3080/api/auth/login
   Body: { email, password: <librechat_password> }
   ↓
6. Store LibreChat session in Redis
   session:{sessionId}:librechat → "connect.sid=..."
   ↓
7. Return success to user
```

#### Error Handling

- Login succeeds even if LibreChat authentication fails
- Warnings logged for LibreChat failures
- User can still access Django features
- Chat features gracefully disabled if LibreChat unavailable

---

### 3. Chat API Proxy Routes

**File**: `frontend/sveltekit/hestami-ai-ui/src/routes/api/chat/[...path]/+server.ts`

#### Supported Methods

- **GET** - Fetch conversations, messages, etc.
- **POST** - Send messages, upload files, create conversations
- **PUT** - Update conversations
- **DELETE** - Delete conversations, messages

#### Request Flow

```
Client Request
   ↓
/api/chat/* (SvelteKit)
   ↓
Check Authentication (Django JWT via session)
   ↓
Get LibreChat Session from Redis
   ↓
Proxy to LibreChat API
   ↓
Return Response to Client
```

#### Content Type Handling

- **JSON**: `application/json` - Parsed and forwarded
- **FormData**: `multipart/form-data` - Forwarded for file uploads
- **Text**: Other types - Forwarded as-is

#### Error Handling

- **401**: No LibreChat session available
- **500**: Generic proxy errors
- Detailed logging for debugging

---

## API Routes

### Chat Routes (Proxied to LibreChat)

All routes under `/api/chat/*` are proxied to LibreChat:

```
GET  /api/chat/conversations      → LibreChat GET /api/conversations
POST /api/chat/conversations      → LibreChat POST /api/conversations
GET  /api/chat/messages           → LibreChat GET /api/messages
POST /api/chat/messages           → LibreChat POST /api/messages
POST /api/chat/files/images       → LibreChat POST /api/files/images
POST /api/chat/agents/chat/google → LibreChat POST /api/agents/chat/google
POST /api/chat/convos/update      → LibreChat POST /api/convos/update
```

### Existing Routes (Unchanged)

All existing routes continue to work:

```
/api/users/*       → Django
/api/properties/*  → Django
/api/services/*    → Django
/api/media/*       → Django
```

---

## Redis Session Structure

### Session Keys

```
# Django session data
session:{sessionId}:user
{
  "id": "user-uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "user_role": "homeowner"
}

# Django JWT tokens
session:{sessionId}:tokens
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}

# LibreChat session cookie
session:{sessionId}:librechat
"connect.sid=s%3A..."

# User lookup
user:{user-uuid}:session
"{session-uuid}"
```

---

## Environment Variables

### Required Variables

Add to `.env` or environment configuration:

```bash
# SvelteKit
LIBRECHAT_API_URL=http://librechat:3080
SVELTE_KIT_DJANGO_API_BASE_URL=http://django:8050
REDIS_URL=redis://redis:6379
```

### Development vs Production

**Development**:
```bash
LIBRECHAT_API_URL=http://localhost:3080
SVELTE_KIT_DJANGO_API_BASE_URL=http://localhost:8050
REDIS_URL=redis://localhost:6379
```

**Production**:
```bash
LIBRECHAT_API_URL=http://librechat:3080
SVELTE_KIT_DJANGO_API_BASE_URL=http://django:8050
REDIS_URL=redis://redis:6379
```

---

## Testing

### Test Login Flow

```bash
# 1. Register user
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "first_name": "Test",
    "last_name": "User",
    "user_role": "PROPERTY_OWNER"
  }'

# 2. Login
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' \
  -c cookies.txt

# 3. Test chat API (get conversations)
curl -X GET http://localhost:3000/api/chat/conversations \
  -b cookies.txt
```

### Test Chat Message

```bash
# Send a chat message
curl -X POST http://localhost:3000/api/chat/agents/chat/google \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "text": "How do I fix a leaky faucet?",
    "conversationId": null
  }'
```

### Test Image Upload

```bash
# Upload an image
curl -X POST http://localhost:3000/api/chat/files/images \
  -b cookies.txt \
  -F "file=@test-image.jpg"
```

---

## Error Scenarios

### LibreChat Unavailable

**Symptom**: User can login but chat features don't work

**Cause**: LibreChat service not running or not accessible

**Solution**:
```bash
# Check LibreChat is running
docker ps | grep librechat

# Check network connectivity
docker exec sveltekit-container curl http://librechat:3080/api/health
```

### No LibreChat Session

**Symptom**: 401 error when accessing chat routes

**Cause**: LibreChat authentication failed during login

**Solution**:
1. Check Django logs for LibreChat password retrieval
2. Check SvelteKit logs for LibreChat authentication
3. Verify `LIBRECHAT_ENCRYPTION_KEY` is set in Django
4. Re-login to establish new session

### Session Expired

**Symptom**: Chat works initially, then fails after 24 hours

**Cause**: LibreChat session expired in Redis

**Solution**:
- User needs to re-login
- LibreChat session will be re-established
- Consider implementing automatic session refresh

---

## Security Considerations

### Session Security

- LibreChat session stored in Redis with 24-hour TTL
- Session cookie never exposed to client
- All requests authenticated via Django JWT first
- LibreChat session retrieved server-side only

### Password Security

- LibreChat password never sent to client
- Retrieved from Django via authenticated endpoint
- Used only server-side for LibreChat authentication
- Encrypted at rest in Django database

### Network Security

- LibreChat not exposed to public internet
- Only accessible via SvelteKit proxy
- All external requests authenticated
- Internal Docker network communication only

---

## Monitoring

### Logs to Monitor

**SvelteKit**:
```bash
docker logs -f sveltekit-container | grep -i librechat
```

**Key Log Messages**:
- `LibreChat session established for {email}` - Success
- `LibreChat authentication failed for {email}` - Warning
- `Could not retrieve LibreChat password` - Error
- `No LibreChat session available` - Error

### Redis Keys to Check

```bash
# Check if LibreChat session exists
redis-cli GET "session:{sessionId}:librechat"

# List all LibreChat sessions
redis-cli KEYS "session:*:librechat"
```

---

## Next Steps

### Remaining Tasks

1. **Docker Network Configuration** - Ensure LibreChat can be reached
2. **Basic Chat UI Component** - Build chat interface
3. **Integration Testing** - End-to-end testing
4. **Error Handling UI** - User-friendly error messages
5. **Session Refresh** - Automatic LibreChat session renewal

---

## Troubleshooting

### LibreChat Authentication Fails

**Check**:
1. Django has `LIBRECHAT_ENCRYPTION_KEY` set
2. User has `librechat_password_encrypted` field populated
3. LibreChat service is running and accessible
4. Network connectivity between SvelteKit and LibreChat

**Debug**:
```bash
# Check Django logs
docker logs django-container | grep -i librechat

# Check SvelteKit logs
docker logs sveltekit-container | grep -i librechat

# Test LibreChat directly
curl -X POST http://librechat:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test_password"}'
```

### Chat Routes Return 401

**Cause**: No LibreChat session in Redis

**Solution**:
1. Re-login to establish session
2. Check Redis for session key
3. Verify session not expired

### Chat Routes Return 500

**Cause**: LibreChat service error or network issue

**Solution**:
1. Check LibreChat logs
2. Test LibreChat health endpoint
3. Verify network connectivity

---

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Status**: Implementation Complete
