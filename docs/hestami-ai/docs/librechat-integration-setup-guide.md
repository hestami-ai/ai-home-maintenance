# LibreChat Integration - Complete Setup Guide

**Date**: November 14, 2025  
**Status**: Ready for Deployment

---

## Overview

This guide provides step-by-step instructions to deploy the LibreChat integration with your Hestami AI platform.

---

## Prerequisites

- Docker and Docker Compose installed
- Hestami AI backend services running
- LibreChat repository cloned to `backend/LibreChat-main/`
- Access to environment configuration files

---

## Setup Steps

### Step 1: Generate Encryption Key

Generate a Fernet encryption key for LibreChat password storage:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Example Output**:
```
xK8vZ9mN2pQ4rT6wY8aB1cD3eF5gH7iJ9kL0mN2oP4qR6sT8uV0wX2yZ4aB6cD8e=
```

**Save this key** - you'll need it in the next step.

---

### Step 2: Configure Environment Variables

#### Django Environment

Add to `.env.local` (development) or `.env.prod` (production):

```bash
# LibreChat Integration
LIBRECHAT_API_URL=http://librechat-api:3080
LIBRECHAT_ENCRYPTION_KEY=<paste_generated_key_here>
```

#### SvelteKit Environment

Add to `.env.local` (development) or `.env.prod` (production):

```bash
# LibreChat Integration
LIBRECHAT_API_URL=http://librechat-api:3080
```

#### LibreChat Environment

Configure `backend/LibreChat-main/.env`:

```bash
PORT=3080
HOST=0.0.0.0
MONGO_URI=mongodb://mongodb:27017/LibreChat
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=<your_meili_key>

# Add any other LibreChat-specific configuration
```

---

### Step 3: Start LibreChat with Network Extension

```bash
cd backend/LibreChat-main

# Start LibreChat with backend network access
docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml up -d
```

**Verify LibreChat is running**:
```bash
docker ps | grep librechat
```

**Expected Output**:
```
<container_id>   librechat-api   ...   Up   0.0.0.0:3080->3080/tcp
```

---

### Step 4: Test Network Connectivity

**From Django**:
```bash
docker exec django-dev curl http://librechat-api:3080/api/health
```

**From SvelteKit**:
```bash
docker exec frontend-dev curl http://librechat-api:3080/api/health
```

**Expected Response**:
```json
{"status":"ok"}
```

If you get an error, see the [Troubleshooting](#troubleshooting) section.

---

### Step 5: Restart Django and SvelteKit

Restart services to pick up new environment variables and code changes:

```bash
# Stop services
docker-compose -f compose.dev.yaml stop django celery celery-beat frontend

# Start services
docker-compose -f compose.dev.yaml up -d django celery celery-beat frontend
```

---

### Step 6: Run Django Migrations

The User model changes need to be migrated:

```bash
docker exec django-dev python manage.py migrate users
```

**Expected Output**:
```
Running migrations:
  Applying users.0005_add_librechat_integration_fields... OK
```

---

### Step 7: Verify Installation

#### Check Django Settings

```bash
docker exec django-dev python manage.py shell
```

```python
from django.conf import settings
print(f"LibreChat URL: {settings.LIBRECHAT_API_URL}")
print(f"Encryption Key Set: {bool(settings.LIBRECHAT_ENCRYPTION_KEY)}")
```

#### Check User Model

```python
from django.contrib.auth import get_user_model
User = get_user_model()

# Check fields exist
user = User.objects.first()
print(f"Has librechat_user_id: {hasattr(user, 'librechat_user_id')}")
print(f"Has librechat_password_encrypted: {hasattr(user, 'librechat_password_encrypted')}")
```

---

## Testing the Integration

### Test 1: User Registration

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "first_name": "Test",
    "last_name": "User",
    "user_role": "PROPERTY_OWNER"
  }'
```

**Check logs**:
```bash
# Django logs
docker logs django-dev | grep -i librechat

# Should see:
# - "Generated LibreChat password for user..."
# - "Started LibreChat provisioning workflow..."
```

**Verify in database**:
```bash
docker exec django-dev python manage.py shell
```

```python
from django.contrib.auth import get_user_model
User = get_user_model()

user = User.objects.get(email='test@example.com')
print(f"LibreChat User ID: {user.librechat_user_id}")
print(f"Password Encrypted: {bool(user.librechat_password_encrypted)}")
print(f"Synced At: {user.librechat_synced_at}")
```

---

### Test 2: User Login

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' \
  -c cookies.txt \
  -v
```

**Check logs**:
```bash
# SvelteKit logs
docker logs frontend-dev | grep -i librechat

# Should see:
# - "LibreChat session established for test@example.com"
```

**Verify session in Redis**:
```bash
docker exec redis-dev redis-cli

# Get session ID from cookies.txt
# Then check Redis
GET session:<session_id>:librechat
```

---

### Test 3: Chat API Access

```bash
# Get conversations
curl -X GET http://localhost:3000/api/chat/conversations \
  -b cookies.txt

# Send a message
curl -X POST http://localhost:3000/api/chat/agents/chat/google \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, how can you help me?",
    "conversationId": null
  }'
```

---

### Test 4: Image Upload

```bash
# Upload an image
curl -X POST http://localhost:3000/api/chat/files/images \
  -b cookies.txt \
  -F "file=@test-image.jpg"
```

**Expected Response**:
```json
{
  "message": "File uploaded and processed successfully",
  "_id": "...",
  "file_id": "...",
  "bytes": 2256092
}
```

---

## Troubleshooting

### Issue: LIBRECHAT_ENCRYPTION_KEY not set

**Symptoms**:
```
Warning: LIBRECHAT_ENCRYPTION_KEY is not set. LibreChat integration will not work.
```

**Solution**:
1. Generate key (see Step 1)
2. Add to `.env.local` or `.env.prod`
3. Restart Django: `docker-compose -f compose.dev.yaml restart django`

---

### Issue: Cannot connect to LibreChat

**Symptoms**:
- Django/SvelteKit logs show connection errors
- `curl: (6) Could not resolve host: librechat-api`

**Solution**:
1. Verify LibreChat is running:
   ```bash
   docker ps | grep librechat
   ```

2. Check network membership:
   ```bash
   docker network inspect backend-dev | grep librechat
   ```

3. Restart LibreChat with network extension:
   ```bash
   cd backend/LibreChat-main
   docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml down
   docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml up -d
   ```

---

### Issue: LibreChat user creation fails

**Symptoms**:
- User registered in Django but no `librechat_user_id`
- Workflow logs show errors

**Solution**:
1. Check LibreChat logs:
   ```bash
   docker logs librechat-api
   ```

2. Test LibreChat registration directly:
   ```bash
   curl -X POST http://localhost:3080/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test2@example.com",
       "password": "password123",
       "username": "test2"
     }'
   ```

3. Check DBOS workflow status:
   ```bash
   docker exec django-dev python manage.py shell
   ```
   
   ```python
   # Check workflow execution
   # DBOS stores workflow state in PostgreSQL dbos schema
   ```

---

### Issue: Login succeeds but chat doesn't work

**Symptoms**:
- User can login
- Chat API returns 401 errors

**Solution**:
1. Check if LibreChat session was established:
   ```bash
   docker logs frontend-dev | grep "LibreChat session established"
   ```

2. Check Redis for session:
   ```bash
   docker exec redis-dev redis-cli
   KEYS session:*:librechat
   ```

3. Try re-login to establish new session

---

### Issue: Migration fails

**Symptoms**:
```
django.db.utils.ProgrammingError: column "librechat_user_id" already exists
```

**Solution**:
Migration was already applied. Check:
```bash
docker exec django-dev python manage.py showmigrations users
```

---

## Monitoring

### Key Metrics to Monitor

1. **User Registration Success Rate**
   - Check `librechat_user_id` is set after registration
   - Monitor DBOS workflow completion

2. **Login Success Rate**
   - Check LibreChat session establishment
   - Monitor Redis session creation

3. **Chat API Performance**
   - Response times for chat endpoints
   - Error rates

4. **LibreChat Health**
   - Health check endpoint status
   - MongoDB connectivity
   - Resource usage

### Logging

**Django**:
```bash
docker logs -f django-dev | grep -i librechat
```

**SvelteKit**:
```bash
docker logs -f frontend-dev | grep -i librechat
```

**LibreChat**:
```bash
docker logs -f librechat-api
```

**Celery** (for workflows):
```bash
docker logs -f celery-dev
```

---

## Production Deployment

### Additional Steps for Production

1. **Use Production Network**:
   Edit `compose.librechat.yaml` to use `backend-prod` network

2. **Enable TLS**:
   Configure TLS for inter-service communication

3. **Set Secure Cookies**:
   Ensure `secure: true` in cookie settings

4. **Resource Limits**:
   Add resource limits to LibreChat service

5. **Backup Strategy**:
   - MongoDB backups for LibreChat data
   - PostgreSQL backups for Django data (includes encrypted passwords)

6. **Monitoring**:
   - Set up Prometheus metrics
   - Configure alerts for failures
   - Log aggregation (ELK stack)

---

## Rollback Plan

If issues arise, you can rollback:

1. **Stop LibreChat**:
   ```bash
   cd backend/LibreChat-main
   docker-compose down
   ```

2. **Revert Django Changes**:
   ```bash
   docker exec django-dev python manage.py migrate users <previous_migration>
   ```

3. **Remove Environment Variables**:
   Comment out `LIBRECHAT_*` variables

4. **Restart Services**:
   ```bash
   docker-compose -f compose.dev.yaml restart django frontend
   ```

Users will still be able to use all Django features. Chat features will be unavailable.

---

## Support

### Documentation

- [Integration Design](./librechat-integration-design.md)
- [Implementation Roadmap](./librechat-integration-roadmap.md)
- [Progress Tracker](./librechat-integration-progress.md)
- [SvelteKit Implementation](./librechat-sveltekit-implementation.md)
- [Docker Network Setup](./librechat-docker-network-setup.md)

### Logs Location

- Django: `volumes/dev/logs/django/`
- SvelteKit: Docker logs
- LibreChat: `backend/LibreChat-main/logs/`

---

## Next Steps

After successful deployment:

1. **Build Chat UI Component** - Create user-facing chat interface
2. **Add Conversation Management** - Delete, archive features
3. **Implement Malware Scanning** - For file uploads
4. **Mobile Client Integration** - iOS app chat features
5. **Analytics Dashboard** - Monitor chat usage

---

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Status**: Ready for Deployment
