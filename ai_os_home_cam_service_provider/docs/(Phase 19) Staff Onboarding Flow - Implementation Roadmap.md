# Phase 19: Staff Onboarding Flow - Implementation Roadmap

This roadmap tracks implementation progress for the secure staff onboarding flow described in `(Phase 19) Staff Onbarding Flow.md`.

---

## Redirection Strategy Decision

> **Decision Required**: Choose where to implement the staff redirection logic.

### Options Analysis

| Option | File | Pros | Cons |
|--------|------|------|------|
| **A** | `hooks.server.ts` | Runs on every request; catches all routes early; single point of control | Adds latency to every request; staff lookup already happens in `+layout.server.ts`; duplicates DB queries |
| **B** | `+layout.server.ts` | Already fetches `staff` profile; data flows to all child routes; no duplicate queries | Doesn't redirect—only provides data; would need to add redirect logic here |
| **C** | `+page.server.ts` (per-route) | Fine-grained control; only runs on specific pages | Requires adding logic to multiple files; easy to miss routes |
| **D** | `app/+layout.server.ts` (new) | Scoped to `/app/*` routes only; inherits from root layout | Requires creating new file; cleaner separation |

### Recommendation

**Option B + D Hybrid**: 
1. Root `+layout.server.ts` already fetches `staff` profile (no changes needed)
2. Create `src/routes/app/+layout.server.ts` to handle `/app/*` redirection logic for staff users
3. This keeps redirection scoped to authenticated app routes and avoids duplicate DB queries

- [ ] **Confirm redirection strategy before implementation**

---

## Phase 1: Database Layer

### 1.1 Schema Changes
- [ ] Add `activationCodeEncrypted` field to `Staff` model (String, nullable)
- [ ] Add `activationCodeExpiresAt` field to `Staff` model (DateTime, nullable)
- [ ] Run `npm run db:migrate` to create and apply migration

**File**: `prisma/schema.prisma`

---

## Phase 2: Shared Utilities

### 2.1 Encryption Module
- [ ] Create `src/lib/server/security/encryption.ts`
- [ ] Implement `encrypt(text: string): string` using AES-256-GCM
- [ ] Implement `decrypt(ciphertext: string): string` using AES-256-GCM
- [ ] Use `HESTAMI_ACTIVATION_KEY` environment variable
- [ ] Add key validation on module load (fail fast if missing/invalid)

### 2.2 Activation Code Generator
- [ ] Create helper function to generate 8-character alphanumeric codes
- [ ] Ensure codes are cryptographically random (use `crypto.randomBytes`)

---

## Phase 3: API Layer

### 3.1 Modify `staff.create` Procedure
- [ ] Change input from `userId` to `email` (lookup user by email)
- [ ] Return friendly error if user doesn't exist: "User must register first"
- [ ] Generate 8-char alphanumeric activation code
- [ ] Encrypt code and store in `activationCodeEncrypted`
- [ ] Set `activationCodeExpiresAt` to `now() + 8 hours`
- [ ] Return plain activation code in response (admin sees once)

**File**: `src/lib/server/api/routes/staff.ts`

### 3.2 Add `regenerateActivationCode` Procedure
- [ ] Create new procedure (admin only)
- [ ] Verify staff status is `PENDING`
- [ ] Generate new code and new 8-hour expiry
- [ ] Return new plain code to admin
- [ ] Record activity event

### 3.3 Add `activateWithCode` Procedure
- [ ] Create new procedure for staff self-activation
- [ ] Accept `code` from authenticated user
- [ ] Get staff record from context (user's own staff profile)
- [ ] Decrypt `activationCodeEncrypted`
- [ ] Verify code matches input
- [ ] Verify `activationCodeExpiresAt > now()`
- [ ] Set status to `ACTIVE`, set `activatedAt`
- [ ] Clear `activationCodeEncrypted` and `activationCodeExpiresAt`
- [ ] Record activity event

### 3.4 Update Client API Types
- [ ] Regenerate oRPC client types after API changes
- [ ] Update `src/lib/api/staff.ts` with new procedures

---

## Phase 4: Frontend Layer

### 4.1 Redirection Logic
- [ ] Create `src/routes/app/+layout.server.ts` (if not exists)
- [ ] Implement redirection logic:
  - If user email ends with `@hestami-ai.com`:
    - If `!staff` → redirect to `/app/staff/pending`
    - If `staff.status === 'PENDING'` → redirect to `/app/staff/activation`
    - If `staff.status === 'ACTIVE'` → allow access (no redirect)

### 4.2 Pending Setup Page
- [ ] Create `src/routes/app/staff/pending/+page.svelte`
- [ ] Display message: "Account Pending Setup - Contact Admin"
- [ ] Include instructions for contacting admin
- [ ] Add logout button

### 4.3 Activation Page
- [ ] Create `src/routes/app/staff/activation/+page.svelte`
- [ ] Create `src/routes/app/staff/activation/+page.server.ts` (guard)
- [ ] Simple form with single input for activation code
- [ ] Call `staffApi.activateWithCode` on submit
- [ ] Display error messages (invalid code, expired code)
- [ ] On success, redirect to `/app/admin`

### 4.4 Update Admin Staff New Page
- [ ] Modify `src/routes/app/admin/staff/new/+page.svelte`
- [ ] Change User ID input to Email input
- [ ] Add user lookup/validation before submit
- [ ] Display generated activation code after successful creation
- [ ] Add "Copy Code" button for easy sharing
- [ ] Update info box text to reflect new flow

### 4.5 Add Regenerate Code UI (Staff Detail Page)
- [ ] Modify `src/routes/app/admin/staff/[id]/+page.svelte`
- [ ] Add "Regenerate Activation Code" button (visible when status is PENDING)
- [ ] Display new code in modal/alert after regeneration

---

## Phase 5: Testing

### 5.1 Unit Tests (Deferred)
- [ ] Test `encrypt`/`decrypt` round-trip
- [ ] Test activation code generation (length, character set)
- [ ] Test `staff.create` generates encrypted code
- [ ] Test `staff.activateWithCode` verifies code correctly
- [ ] Test `staff.activateWithCode` rejects expired codes
- [ ] Test `staff.regenerateActivationCode` creates new code

### 5.2 Integration Tests (Deferred)
- [ ] Test full flow: create staff → get code → activate
- [ ] Test redirection logic for `@hestami-ai.com` users
- [ ] Test non-staff users are not affected by redirection

### 5.3 Manual Verification
- [ ] Register new user with `test@hestami-ai.com`
- [ ] Verify redirect to `/app/staff/pending` (no staff record yet)
- [ ] Admin creates staff record via `/app/admin/staff/new`
- [ ] Verify activation code is displayed to admin
- [ ] User refreshes → redirected to `/app/staff/activation`
- [ ] User enters activation code
- [ ] Verify user is activated and redirected to `/app/admin`
- [ ] Verify expired codes are rejected (wait 8+ hours or manually expire)

---

## Implementation Notes

### Environment Variable
- **Key**: `HESTAMI_ACTIVATION_KEY`
- **Location**: `.env`
- **Format**: 32-byte hex string (64 characters) for AES-256

### Existing Implementation Context
- `staff.create` currently accepts `userId` (needs change to `email`)
- `staff.activate` exists but activates by `staffId` (admin action) - keep this
- New `staff.activateWithCode` is for self-service activation by the staff user
- Root `+layout.server.ts` already fetches `staff` profile - reuse this data
- `app/+page.server.ts` already has staff redirection to `/app/admin`

### Security Considerations
- Activation codes expire after 8 hours
- Codes are encrypted at rest (AES-256-GCM)
- Plain code shown only once to admin
- Failed activation attempts should be logged
- Consider rate limiting on activation endpoint

---

## Progress Summary

| Phase | Status | Items |
|-------|--------|-------|
| Decision | ⬜ Pending | 1 |
| Database | ⬜ Pending | 3 |
| Utilities | ⬜ Pending | 5 |
| API | ⬜ Pending | 12 |
| Frontend | ⬜ Pending | 12 |
| Testing | ⬜ Deferred | 12 |

**Legend**: ⬜ Pending | 🔄 In Progress | ✅ Complete | ⏸️ Deferred
