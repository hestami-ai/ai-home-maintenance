# Staff Onboarding & Activation Flow

Implement a secure onboarding flow for Hestami staff users (`@hestami-ai.com`) where they are redirected to a "zero-privilege" activation page upon registration until they enter an admin-provided activation code.

## User Review Required

> [!IMPORTANT]
> - New Staff users will be redirected to `/app/staff/activation` immediately after login via [hooks.server.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/hooks.server.ts) or [+layout.server.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/+layout.server.ts) if their status is `PENDING` and email domain matches.
> - Admins will need to communicate the generated activation code to the new staff member securely (out-of-band).

## Proposed Changes

### Database Layer
#### [MODIFY] [schema.prisma](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/prisma/schema.prisma)
- Add fields to [Staff](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#20-21) model:
    - `activationCodeEncrypted` (String, nullable) - Stores the AES-256-GCM encrypted code.
    - `activationCodeExpiresAt` (DateTime, nullable) - Set to 8 hours from generation.
- **Migration**: Run `npm run db:migrate` to create and apply the migration.

### Shared Utils
#### [NEW] [encryption.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/security/encryption.ts)
- Implement `encrypt(text: string): string` and `decrypt(text: string): string` using Node.js `crypto` (AES-256-GCM).
- Use `APP_SECRET` or dedicated `ENCRYPTION_KEY` from environment variables.

### API Layer
#### [MODIFY] [staff.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/routes/staff.ts)
- Update [create](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/cam.ts#850-858) to accept `email` instead of `userId` (Admin enters email):
    - Lookup User by email.
    - If no User exists -> Return friendly error "User must register first".
    - If User exists -> Create [Staff](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#20-21) record linked to that User.
    - Generate 8-char alphanumeric code.
    - Encrypt and store in `activationCodeEncrypted`.
    - Set `activationCodeExpiresAt` to `now() + 8 hours`.
    - Return plain code in response (admin sees it once).
    - **Note:** This simplifies the Admin flow significantly.
- Add `activate` (see below) should also add user to Hestami Staff organization.
- Add `regenerateActivationCode` (Admin only):
    - Checks if staff is `PENDING`.
    - Generates new code and new 8-hour expiry.
    - Returns new code.
- Add [activate](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#138-144):
    - Accept `code` from authenticated user.
    - Get [Staff](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#20-21) record from context (populated by [+layout.server.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/+layout.server.ts) even for PENDING users).
    - Decrypt `activationCodeEncrypted`.
    - Verify code matches input.
    - Verify `activationCodeExpiresAt` > `now()`.
    - Set status to `ACTIVE`.
    - Clear encrypted code and expiry.
    - **Add user to Hestami Staff organization** (`PLATFORM_OPERATOR` type, org ID: `hestami-staff-org`) with `ADMIN` role and `isDefault: true`.

### Frontend Layer
#### [NEW] [Activation Page](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/app/staff/activation/+page.svelte)
- Simple form to enter activation code.
- Calls `staffApi.activate`.
- On success, redirects to `/app/admin`.

#### [MODIFY] [App Layout Server](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/app/+page.server.ts)
- **Redirection Logic:**
    1. If User email ends with `@hestami-ai.com`:
    2. Check `staff` object from parent layout.
    3. If `!staff` (User registered but Admin hasn't created Staff record yet) -> Redirect to `/app/staff/pending` (Page: "Account Pending Setup - Contact Admin").
    4. If `staff.status === 'PENDING'` -> Redirect to `/app/staff/activation`.
    5. If `staff.status === 'ACTIVE'` -> Allow access to `/app/admin` (or redirect there).

## Verification Plan

### Automated Tests
- Test `staff.create` generates code.
- Test `staff.activate` verifies code.

### Manual Verification
1. User registers with `test@hestami-ai.com`.
2. Verifies redirection to `/app/staff/activation`.
3. Admin logs in, goes to `Staff > New`.
4. Enters user's ID (or we add user lookup by email).
5. Admin gets code.
6. User enters code.
7. User activated and redirected.
