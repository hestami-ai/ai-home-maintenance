# LibreChat Integration - Design Updates

**Date**: November 14, 2025  
**Status**: Updated with Option B (Generated Password)

---

## Summary of Changes

This document summarizes the updates made to the LibreChat integration design based on stakeholder feedback.

---

## Key Updates

### 1. ✅ API Routing Clarification

**Original Concern**: Proposed `/api/django/*` routing might break existing functionality.

**Resolution**: 
- **NO changes** to existing `/api/*` routes
- All existing routes continue to work as-is:
  - `/api/users/*` → Django
  - `/api/properties/*` → Django
  - `/api/services/*` → Django
  - `/api/media/*` → Django
- **Only additive changes**: New `/api/chat/*` routes for LibreChat
  - `/api/chat/conversations` → LibreChat
  - `/api/chat/messages` → LibreChat
  - `/api/chat/files/images` → LibreChat
  - `/api/chat/agents/chat/*` → LibreChat

**Impact**: Zero risk to existing functionality.

---

### 2. ✅ Password Management Strategy (Option B Approved)

**Challenge**: LibreChat requires plaintext password for authentication, but Django stores hashed passwords (irreversible).

**Solution**: Generated Password Strategy (Option B)

#### How It Works

1. **User Registration**:
   - User sets password for Django (hashed with bcrypt/PBKDF2)
   - Django generates separate 32-character random password for LibreChat
   - LibreChat password encrypted with Fernet and stored in `User.librechat_password_encrypted`
   - User never knows or sees LibreChat password

2. **User Login**:
   - User logs in with their Django password
   - SvelteKit fetches encrypted LibreChat password from Django API
   - SvelteKit decrypts and uses it to authenticate with LibreChat
   - Process is transparent to user

3. **Security**:
   - Credential isolation (separate passwords for each system)
   - Encrypted at rest (Fernet symmetric encryption)
   - Only accessible via authenticated Django API endpoint
   - Never exposed to client

#### Implementation Details

**Django User Model**:
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
    
    def generate_librechat_password(self) -> str:
        """Generate and encrypt random password for LibreChat"""
        password = secrets.token_urlsafe(32)
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

**New Django API Endpoint**:
```python
# GET /api/users/librechat-password/
# Authorization: Bearer <django_jwt>
# Response: { "librechat_password": "<decrypted_password>" }

class LibreChatPasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            password = request.user.get_librechat_password()
            return Response({'librechat_password': password})
        except ValueError as e:
            return Response(
                {'error': 'LibreChat password not set'},
                status=status.HTTP_404_NOT_FOUND
            )
```

**Environment Variables**:
```bash
# Django .env
LIBRECHAT_ENCRYPTION_KEY=<32_byte_fernet_key>

# Generate key:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Updated Data Flows

### User Registration Flow

```
1. User submits registration form
   Body: { email, password, first_name, last_name }
   ↓
2. SvelteKit → Django POST /api/users/register/
   ↓
3. Django creates User with hashed password
   ↓
4. Django generates LibreChat password
   user.generate_librechat_password() → returns plaintext
   Stores encrypted in user.librechat_password_encrypted
   ↓
5. Django triggers DBOS workflow
   Passes: user_id, librechat_password (plaintext)
   ↓
6. Workflow → LibreChat POST /api/auth/register
   Body: { email, password: "<generated_password>", ... }
   ↓
7. LibreChat creates user, returns user_id
   ↓
8. Workflow updates User.librechat_user_id
   ↓
9. Django returns JWT to SvelteKit
   ↓
10. SvelteKit creates session in Redis
   ↓
11. Return success to client
```

### User Login Flow

```
1. User submits login form
   Body: { email, password }
   ↓
2. SvelteKit → Django POST /api/users/login/
   ↓
3. Django validates user's password, returns JWT
   ↓
4. SvelteKit creates session in Redis
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
8. LibreChat returns session cookie
   ↓
9. SvelteKit stores LibreChat session in Redis
   session:{sessionId}:librechat → "librechat_session_cookie"
   ↓
10. Return success to client
```

---

## Updated Implementation Tasks

### Phase 1: MVP Implementation

**Task 1.1: Django User Model Update**
- ✅ Add `librechat_password_encrypted` field
- ✅ Add `generate_librechat_password()` method
- ✅ Add `get_librechat_password()` method
- Create migration
- Update serializers (exclude librechat fields)

**Task 1.2: Django LibreChat Password Endpoint** (NEW)
- Create `LibreChatPasswordView`
- Implement GET `/api/users/librechat-password/`
- Add authentication and decryption logic
- Add URL route
- Unit tests

**Task 1.3: Django LibreChat Sync Service**
- Implement `LibreChatSyncService`
- Add `create_user` and `authenticate` methods
- Unit tests

**Task 1.4: DBOS User Provisioning Workflow**
- Create `provision_librechat_user` workflow
- ✅ Update registration view to generate LibreChat password
- ✅ Pass generated password to workflow
- Workflow tests

**Task 1.5: SvelteKit LibreChat Module**
- Create `librechat.ts` module
- ✅ Update login flow to fetch LibreChat password from Django
- Implement authentication and request proxying
- Store LibreChat session in Redis

**Task 1.6: SvelteKit Chat API Routes**
- ✅ Create `/api/chat/[...path]` catch-all route (NO changes to existing routes)
- Implement specific routes
- Error handling

---

## Security Benefits

### Option B Advantages

1. **Credential Isolation**: Separate passwords for Django and LibreChat
2. **User Transparency**: User never needs to know LibreChat password
3. **Password Independence**: Django password changes don't affect LibreChat
4. **Encrypted Storage**: Fernet encryption for LibreChat password
5. **Controlled Access**: Only accessible via authenticated Django API
6. **No Client Exposure**: Password never sent to client

### Encryption Details

- **Algorithm**: Fernet (symmetric encryption)
- **Library**: `cryptography` (Python standard)
- **Key Storage**: Environment variable `LIBRECHAT_ENCRYPTION_KEY`
- **Key Length**: 32 bytes (256 bits)
- **Key Generation**: `Fernet.generate_key()`

---

## Dependencies

### New Python Dependencies

```txt
# requirements.txt
cryptography>=41.0.0  # For Fernet encryption
```

### Environment Variables

```bash
# Django .env
LIBRECHAT_API_URL=http://librechat:3080
LIBRECHAT_ENCRYPTION_KEY=<generate_with_fernet>

# SvelteKit .env
LIBRECHAT_API_URL=http://librechat:3080
```

---

## Testing Checklist

### Unit Tests

- [ ] `User.generate_librechat_password()` generates valid password
- [ ] `User.get_librechat_password()` decrypts correctly
- [ ] `LibreChatPasswordView` requires authentication
- [ ] `LibreChatPasswordView` returns correct password
- [ ] Encryption/decryption roundtrip works

### Integration Tests

- [ ] Registration generates and stores encrypted password
- [ ] DBOS workflow receives plaintext password
- [ ] LibreChat user created with generated password
- [ ] Login retrieves and uses LibreChat password
- [ ] LibreChat authentication succeeds
- [ ] Chat functionality works end-to-end

### Security Tests

- [ ] Encrypted password not exposed in API responses
- [ ] LibreChat password endpoint requires valid JWT
- [ ] User cannot access other users' LibreChat passwords
- [ ] Encryption key not exposed in logs or errors

---

## Migration Path

### For Existing Users (Future)

If users already exist in Django but not LibreChat:

1. Create management command: `python manage.py provision_librechat_users`
2. For each user without `librechat_user_id`:
   - Generate LibreChat password
   - Create LibreChat user via API
   - Update Django user record
3. Log results and errors

---

## Risks & Mitigation

### Risk: Encryption Key Compromise

**Mitigation**:
- Store key in secure environment variable
- Rotate key periodically (requires re-encryption)
- Use secrets management service (AWS Secrets Manager, etc.)

### Risk: LibreChat Password Sync Failure

**Mitigation**:
- DBOS workflow provides retry logic
- Log failures for manual intervention
- User can still use Django features if LibreChat fails

### Risk: Performance Impact

**Mitigation**:
- Encryption/decryption is fast (< 1ms)
- Cache LibreChat session in Redis (avoid repeated API calls)
- Monitor performance metrics

---

## Next Steps

1. ✅ Review and approve design updates
2. Generate Fernet encryption key for development
3. Implement Django User model updates
4. Implement LibreChat password endpoint
5. Update DBOS workflow
6. Update SvelteKit login flow
7. Test end-to-end registration and login flows

---

**Document Version**: 1.0  
**Last Updated**: November 14, 2025  
**Approved By**: Stakeholder (Option B)
