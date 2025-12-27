# Role-Based UX Flow Reference (RB-UXFR)

## 1. Overview
This reference maps the primary UX flows for each mobile-enabled persona to their corresponding backend API interactions.

## 2. Persona: Property Owner (Concierge)

### Flow 1: Onboarding & Property Setup
*   **Purpose**: Register an individual/entity owner and their first property.
*   **APIs**:
    *   `organization.create`: Create the "Household" or "LLC" organization.
    *   `organization.setDefault`: Set the new org as the active context.
    *   `propertyPortfolio.create`: Initialize the owner's portfolio.
    *   `property.create`: Register the primary residence/asset.
*   **Terminal States**:
    *   `Success`: Redirect to Dashboard.
    *   `Failure`: Display field-level validation errors (e.g., invalid address).

### Flow 2: Service Call Intake
*   **Purpose**: Report a maintenance issue (Plumbing, HVAC, etc.).
*   **APIs**:
    *   `serviceCall.create`: Submits issue details, urgency, and category. Returns a `conciergeCaseId`.
    *   `attachment.upload`: Upload photos/videos of the issue.
*   **Blocking Errors**:
    *   `INSUFFICIENT_PERMISSIONS`: User not associated with the property.
    *   `LIMIT_EXCEEDED`: Too many open cases (spam protection).

### Flow 3: Quote Review & Approval
*   **Purpose**: Review and authorize work from a service provider.
*   **APIs**:
    *   `quote.list`: Fetch available quotes for a specific `serviceCallId`.
    *   `quote.approve`: Approve a selected quote (triggers workflow transition).
    *   `quote.decline`: Reject a quote with a reason.
*   **Async States**: "Pending Approval" -> "Scheduled".

## 3. Persona: CAM Staff (Property Manager)

### Flow 1: Violation Inspection
*   **Purpose**: Record a governing document violation while on-site.
*   **APIs**:
    *   `violation.create`: Capture property, rule violated, and description.
    *   `attachment.upload`: Attach evidence photos.
*   **Terminal States**:
    *   `Success`: Violation status -> `OPEN`. Triggers notice generation workflow.

### Flow 2: Work Order Oversight
*   **Purpose**: Update or close association work orders.
*   **APIs**:
    *   `workOrder.list`: View all work orders for the active organization.
    *   `workOrder.updateStatus`: Transition from `ASSIGNED` to `COMPLETED`.

## 4. Persona: Service Provider (Technician)

### Flow 1: Job Lifecycle
*   **Purpose**: Manage a job from arrival to completion.
*   **APIs**:
    *   `job.checkIn`: Record start time (Geo-fencing check recommended but server-authoritative).
    *   `job.addNote`: Add technician comments/findings.
    *   `job.complete`: Submit final report and trigger invoicing workflow.

## 5. Shared Flows

### Organization Context Switching
*   **Purpose**: Switching between different HOAs or properties if the user belongs to multiple.
*   **APIs**:
    *   `user.getOrganizations`: List all associated organizations and roles.
    *   `session.updateContext`: Notify the server of the new active `organization_id`.

### Notification Hub
*   **Purpose**: View and dismiss alerts.
*   **APIs**:
    *   `notification.list`: Fetch alerts filtered by importance.
    *   `notification.markRead`: Dismissal.
