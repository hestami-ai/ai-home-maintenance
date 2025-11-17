# LibreChat Docker Network Configuration

**Date**: November 14, 2025  
**Status**: Configuration Guide

---

## Overview

This guide explains how to configure Docker networking to allow Django and SvelteKit to communicate with LibreChat.

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    backend-dev Network                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  SvelteKit   │  │    Django    │  │   LibreChat API  │  │
│  │  (frontend)  │  │     (api)    │  │   (librechat)    │  │
│  │  :3000       │  │    :8050     │  │     :3080        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
┌────────▼────────┐                  ┌───────▼────────────────┐
│  LibreChat      │                  │  LibreChat Internal    │
│  Internal       │                  │  Services:             │
│  Network        │                  │  - MongoDB             │
│  (default)      │                  │  - MeiliSearch         │
│                 │                  │  - VectorDB            │
│                 │                  │  - RAG API             │
└─────────────────┘                  └────────────────────────┘
```

---

## Configuration Files

### 1. Main LibreChat Compose

**File**: `backend/LibreChat-main/docker-compose.yml`

This is the original LibreChat docker-compose file. **Do not modify this file** as it's maintained by the LibreChat project.

### 2. LibreChat Network Extension

**File**: `compose.librechat.yaml` (created in project root)

This file extends the LibreChat configuration to join the Hestami AI backend network:

```yaml
name: hestami-ai-librechat

networks:
  backend-dev:
    name: backend-dev
    external: true
  backend-prod:
    name: backend-prod
    external: true

services:
  api:
    networks:
      - default  # LibreChat's internal network
      - backend-dev  # Hestami AI backend network
    
    container_name: librechat-api
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${PORT:-3080}/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Setup Instructions

### Step 1: Ensure Backend Network Exists

The backend network should already exist from the main Hestami AI setup.

**Verify**:
```bash
docker network ls | grep backend-dev
```

**Expected Output**:
```
<network_id>   backend-dev   bridge    local
```

**If not found**, create it:
```bash
docker network create backend-dev
```

### Step 2: Start LibreChat with Network Extension

**Development**:
```bash
cd backend/LibreChat-main

# Start with both compose files
docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml up -d
```

**Production**:
```bash
cd backend/LibreChat-main

# Edit compose.librechat.yaml to use backend-prod network
# Then start with both compose files
docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml up -d
```

### Step 3: Verify Network Connectivity

**Check LibreChat is on backend network**:
```bash
docker network inspect backend-dev | grep -A 5 librechat
```

**Test connectivity from Django**:
```bash
docker exec django-dev curl http://librechat-api:3080/api/health
```

**Expected Response**:
```json
{"status":"ok"}
```

**Test connectivity from SvelteKit**:
```bash
docker exec frontend-dev curl http://librechat-api:3080/api/health
```

---

## Service Discovery

### Hostname Resolution

Once LibreChat is on the backend network, it can be accessed by other services using its container name:

**From Django**:
```python
LIBRECHAT_API_URL = 'http://librechat-api:3080'
```

**From SvelteKit**:
```typescript
LIBRECHAT_BASE_URL = 'http://librechat-api:3080'
```

### Port Mapping

LibreChat API runs on port `3080` inside the container. This port is:
- **Exposed** to the host (configurable via `PORT` env var)
- **Accessible** to other containers on the backend network

---

## Environment Variables

### LibreChat Environment

**File**: `backend/LibreChat-main/.env`

Ensure these are set:
```bash
PORT=3080
HOST=0.0.0.0
MONGO_URI=mongodb://mongodb:27017/LibreChat
```

### Django Environment

**File**: `.env.local` or `.env.prod`

Add:
```bash
LIBRECHAT_API_URL=http://librechat-api:3080
LIBRECHAT_ENCRYPTION_KEY=<your_fernet_key>
```

### SvelteKit Environment

**File**: `.env.local` or `.env.prod`

Add:
```bash
LIBRECHAT_API_URL=http://librechat-api:3080
```

---

## Troubleshooting

### Issue: Cannot Connect to LibreChat

**Symptoms**:
- Django or SvelteKit cannot reach LibreChat
- `curl: (6) Could not resolve host: librechat-api`

**Solutions**:

1. **Verify LibreChat is running**:
   ```bash
   docker ps | grep librechat
   ```

2. **Check network membership**:
   ```bash
   docker network inspect backend-dev
   ```
   
   Should show `librechat-api` in the containers list.

3. **Restart with network extension**:
   ```bash
   cd backend/LibreChat-main
   docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml down
   docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml up -d
   ```

4. **Check firewall rules**:
   ```bash
   # On host
   sudo iptables -L | grep DOCKER
   ```

### Issue: LibreChat Health Check Fails

**Symptoms**:
- Health check returns unhealthy status
- LibreChat container keeps restarting

**Solutions**:

1. **Check LibreChat logs**:
   ```bash
   docker logs librechat-api
   ```

2. **Verify MongoDB is running**:
   ```bash
   docker ps | grep mongo
   ```

3. **Test health endpoint directly**:
   ```bash
   docker exec librechat-api curl http://localhost:3080/api/health
   ```

4. **Check environment variables**:
   ```bash
   docker exec librechat-api env | grep -E 'PORT|MONGO_URI'
   ```

### Issue: Network Already Exists Error

**Symptoms**:
```
ERROR: Network backend-dev declared as external, but could not be found
```

**Solution**:
```bash
# Create the network
docker network create backend-dev

# Or use the existing network from main compose
docker-compose -f compose.dev.yaml up -d
```

### Issue: Port Conflict

**Symptoms**:
```
ERROR: for librechat-api  Cannot start service api: driver failed programming external connectivity on endpoint librechat-api: Bind for 0.0.0.0:3080 failed: port is already allocated
```

**Solutions**:

1. **Change LibreChat port**:
   ```bash
   # In backend/LibreChat-main/.env
   PORT=3081
   ```

2. **Stop conflicting service**:
   ```bash
   docker ps | grep :3080
   docker stop <container_id>
   ```

---

## Production Considerations

### Network Isolation

For production, consider using separate networks:

```yaml
networks:
  backend-prod:
    name: backend-prod
    external: true
  librechat-internal:
    name: librechat-internal
    internal: true  # No external access

services:
  api:
    networks:
      - backend-prod  # For Django/SvelteKit communication
      - librechat-internal  # For LibreChat internal services
  
  mongodb:
    networks:
      - librechat-internal  # Only accessible to LibreChat
```

### Security

1. **Firewall Rules**: Ensure LibreChat is not exposed to public internet
2. **Network Policies**: Use Docker network policies to restrict access
3. **TLS**: Enable TLS for inter-service communication in production
4. **Secrets**: Use Docker secrets for sensitive environment variables

---

## Monitoring

### Check Network Status

```bash
# List all networks
docker network ls

# Inspect backend network
docker network inspect backend-dev

# Check which containers are on the network
docker network inspect backend-dev | jq '.[0].Containers'
```

### Monitor Connectivity

```bash
# From Django
docker exec django-dev ping -c 3 librechat-api

# From SvelteKit
docker exec frontend-dev ping -c 3 librechat-api

# Check DNS resolution
docker exec django-dev nslookup librechat-api
```

### Network Traffic

```bash
# Monitor network traffic
docker stats librechat-api

# Check network interfaces
docker exec librechat-api ip addr show
```

---

## Alternative Configurations

### Option 1: Docker Compose Override (Not Recommended)

Create `backend/LibreChat-main/docker-compose.override.yaml`:

```yaml
services:
  api:
    networks:
      - default
      - backend-dev

networks:
  backend-dev:
    external: true
```

**Note**: This file is gitignored by LibreChat, so it won't be tracked.

### Option 2: Single Compose File (Not Recommended)

Merge LibreChat into main `compose.dev.yaml`:

**Pros**: Single command to start everything
**Cons**: Harder to maintain, conflicts with LibreChat updates

### Option 3: Network Alias (Alternative)

Use network aliases for service discovery:

```yaml
services:
  api:
    networks:
      backend-dev:
        aliases:
          - librechat
          - librechat-api
```

---

## Testing Checklist

- [ ] LibreChat starts successfully
- [ ] LibreChat is on backend-dev network
- [ ] Django can reach LibreChat (curl test)
- [ ] SvelteKit can reach LibreChat (curl test)
- [ ] Health check passes
- [ ] User registration creates LibreChat user
- [ ] User login establishes LibreChat session
- [ ] Chat API routes work through SvelteKit

---

## Quick Reference

### Start LibreChat with Backend Network

```bash
cd backend/LibreChat-main
docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml up -d
```

### Stop LibreChat

```bash
cd backend/LibreChat-main
docker-compose -f docker-compose.yml -f ../../compose.librechat.yaml down
```

### View Logs

```bash
docker logs -f librechat-api
```

### Test Connectivity

```bash
# From host
curl http://localhost:3080/api/health

# From Django
docker exec django-dev curl http://librechat-api:3080/api/health

# From SvelteKit
docker exec frontend-dev curl http://librechat-api:3080/api/health
```

---

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Status**: Configuration Complete
