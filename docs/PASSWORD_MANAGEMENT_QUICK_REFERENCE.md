# Password Management - Quick Reference

## 🚀 Quick Start

### Web (SvelteKit)

```typescript
import { PasswordService } from '$lib/services/passwordService';

// Change password
await PasswordService.changePassword('old123', 'new456');

// Request reset
await PasswordService.requestPasswordReset('user@example.com');

// Confirm reset
await PasswordService.confirmPasswordReset('token', 'newPass789');
```

### iOS (Swift)

```swift
// Change password
PasswordService.changePassword(
    oldPassword: "old123",
    newPassword: "new456",
    confirmPassword: "new456"
) { result in
    switch result {
    case .success(let response):
        print(response.message)
    case .failure(let error):
        print(error.localizedDescription)
    }
}
```

---

## 📍 Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/users/password/change` | POST | ✅ Yes | Change password |
| `/api/users/password/reset` | POST | ❌ No | Request reset email |
| `/api/users/password/reset/confirm` | POST | ❌ No | Complete reset |

---

## 📦 Components

| Component | File | Use Case |
|-----------|------|----------|
| `PasswordChangeForm` | `src/lib/components/PasswordChangeForm.svelte` | Authenticated users |
| `PasswordResetRequestForm` | `src/lib/components/PasswordResetRequestForm.svelte` | Forgot password |
| `PasswordResetConfirmForm` | `src/lib/components/PasswordResetConfirmForm.svelte` | Reset with token |

---

## 🎨 Usage Examples

### In a Svelte Page

```svelte
<script lang="ts">
  import PasswordChangeForm from '$lib/components/PasswordChangeForm.svelte';
  
  function handleSuccess(event) {
    console.log('Success:', event.detail);
    // Show notification, redirect, etc.
  }
  
  function handleError(event) {
    console.error('Error:', event.detail);
  }
</script>

<PasswordChangeForm 
  onsuccess={handleSuccess}
  onerror={handleError}
/>
```

### With TypeScript Service

```typescript
import { PasswordService } from '$lib/services/passwordService';

async function changePassword() {
  try {
    const response = await PasswordService.changePassword(
      oldPassword,
      newPassword,
      confirmPassword
    );
    alert(response.message);
  } catch (error) {
    alert(error.message);
  }
}
```

---

## 🔐 Password Rules

- **Minimum:** 8 characters
- **Recommended:** 12+ with mixed case, numbers, symbols
- **Strength:** 0-5 scale (Weak → Strong)

### Strength Criteria
1. Length ≥ 8 chars (+1)
2. Length ≥ 12 chars (+1)
3. Upper + lowercase (+1)
4. Has numbers (+1)
5. Has symbols (+1)

---

## ⚠️ Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Validation error | Check input fields |
| 401 | Not authenticated | Redirect to login |
| 403 | Wrong password | Show error message |
| 404 | Not found | May be masked for security |
| 500 | Server error | Retry later |

---

## 🧪 Testing

```bash
# Web UI
http://localhost:5173/settings/password
http://localhost:5173/password-reset

# API (via curl)
curl -X POST http://localhost:5173/api/users/password/reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## 📱 iOS Integration

```swift
// 1. Add to your project
PasswordService.swift

// 2. Configure base URL
static let baseURL = "https://homeservices.hestami-ai.com"

// 3. Use methods
PasswordService.changePassword(...)
PasswordService.requestPasswordReset(...)
PasswordService.confirmPasswordReset(...)
```

---

## 🔧 Environment Setup

```bash
# SvelteKit .env
DJANGO_API_URL=http://api:8000

# Django .env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@hestami-ai.com
EMAIL_HOST_PASSWORD=xxx
PASSWORD_RESET_TIMEOUT=86400
```

---

## 📚 Documentation

- **Full API Docs:** `docs/PASSWORD_MANAGEMENT_API.md`
- **Implementation Guide:** `docs/PASSWORD_MANAGEMENT_IMPLEMENTATION.md`
- **This Quick Reference:** `docs/PASSWORD_MANAGEMENT_QUICK_REFERENCE.md`

---

## 🆘 Common Issues

**Email not received?**
- Check spam folder
- Verify Django email config
- Check SMTP credentials

**Token expired?**
- Tokens last 24 hours
- Request new reset link

**iOS can't authenticate?**
- Verify cookies enabled
- Check session is valid
- Ensure using correct base URL

---

## ✅ Checklist

- [ ] SvelteKit proxy routes working
- [ ] Django email configured
- [ ] Web UI accessible
- [ ] iOS integration tested
- [ ] Error handling verified
- [ ] Password strength working
- [ ] Email delivery working
- [ ] Token expiration working
