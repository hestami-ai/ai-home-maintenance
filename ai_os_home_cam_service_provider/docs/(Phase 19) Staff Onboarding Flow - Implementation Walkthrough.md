# Staff Onboarding Flow Implementation Walkthrough

I have successfully implemented the Staff Onboarding Flow, covering database schema changes, backend API updates, and frontend UI implementation.

## 1. Database Schema
- Added `activationCodeEncrypted` and `activationCodeExpiresAt` to the [Staff](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#20-21) model in [prisma/schema.prisma](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/prisma/schema.prisma).
- **Note:** You may need to run `npm run db:migrate` or `npx prisma db push` to apply these changes to your local database if the previous migration failed. Standard `db:generate` has been run to update types.

## 2. Shared Utilities
- Created [src/lib/server/security/encryption.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/security/encryption.ts) for AES-256-GCM encryption and activation code generation.

## 3. API Layer
- **New User Router:** Implemented `user.findUserByEmail` in [src/lib/server/api/routes/user.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/routes/user.ts).
- **Staff Router Updates ([src/lib/server/api/routes/staff.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/routes/staff.ts)):**
  - Modified [create](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#96-110) to accept `email`, lookup user, and generate activation code.
  - Added [regenerateActivationCode](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#138-147) for admins.
  - Added [activateWithCode](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/api/staff.ts#148-156) for staff self-service.
- **Router Registration:** Updated [src/lib/server/api/index.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/index.ts) to include `userRouter` and fixed router structure issues.

## 4. Frontend Layer
- **Redirection Logic:** Updated [src/routes/app/+layout.server.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/app/+layout.server.ts) to redirect:
  - `@hestami-ai.com` users without staff profile → `/staff/pending`
  - Pending staff members → `/staff/activate`
- **New Pages:**
  - [src/routes/staff/pending/+page.svelte](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/staff/pending/+page.svelte): "Account Pending Approval" message.
  - [src/routes/staff/activate/+page.svelte](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/staff/activate/+page.svelte): Activation code entry form.
- **Admin UI:**
  - Updated [src/routes/app/admin/staff/new/+page.svelte](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/routes/app/admin/staff/new/+page.svelte) to use Email input and display the generated activation code upon success.

## 5. Verification
- **Run Type Check:** `npm run check` (In progress).
- **Manual Test Plan:**
  1.  **Admin:** Go to `/app/admin/staff/new`. Create staff with a valid user email. Copy the activation code.
  2.  **Staff User:** Log in as that user. You should be redirected to `/staff/activate`.
  3.  **Activation:** Enter the code. You should be redirected to `/app` (Dashboard).
  4.  **Pending User:** Log in as an `@hestami-ai.com` user who is NOT staff. You should be redirected to `/staff/pending`.

## Next Steps
- Verify the `npm run check` output for any remaining type errors.
- Perform the manual test plan.
- Ensure `HESTAMI_ACTIVATION_KEY` environment variable is set.
