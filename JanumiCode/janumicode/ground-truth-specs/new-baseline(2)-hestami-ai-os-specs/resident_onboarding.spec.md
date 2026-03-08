# Feature: Resident Onboarding
**Pillar:** Concierge
**Priority:** Critical
**Status:** Specification

## 1. Intent
To securely register a new resident into the system, linking them to a specific property unit, and granting them appropriate access permissions (digital keys, app access).

## 2. Invariants
*   **Unit Validity:** A resident CANNOT be registered to a Unit ID that does not exist in the CAM system.
*   **Identity Uniqueness:** The email address must not already be associated with an active identity.
*   **Lease Validation:** Move-in date cannot be in the past (unless migration override is active).

## 3. Workflow: Register New Resident

### Step 1: Request Initiation
*   **Actor:** Concierge Staff or Self-Service Kiosk
*   **Input:** `RegisterResidentRequest` (See `api_contracts.ts`)
*   **Endpoint:** `POST /api/v1/concierge/residents`

### Step 2: Validation (Gate)
*   **Check 1:** Query `IdentityService` to ensure email is available.
*   **Check 2:** Query `CAMService` to verify `unitId` exists and is currently vacant or allows multiple occupants.

### Step 3: Execution
1.  Create `UserIdentity` in `IdentityService` with role `RESIDENT`.
2.  Create `ResidentProfile` in `ConciergeDB`.
3.  Link `ResidentProfile` to `UserIdentity`.

### Step 4: Side Effects
*   **Event:** Emit `RESIDENT_CREATED` to `EventBus`.
*   **Notification:** Send welcome email with activation link.
*   **Access Control:** Trigger `SmartLockService` (if available) to provision temporary access code.

## 4. Observables (Verification)
*   **Log:** "Resident registered: {id} for unit {unitId}"
*   **DB:** New record in `residents` table with `status='pending_verification'`.
*   **Event:** `resident.created` message appears on the bus.