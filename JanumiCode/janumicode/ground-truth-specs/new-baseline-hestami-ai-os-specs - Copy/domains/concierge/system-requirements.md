# Concierge Domain - System Requirements

## 1. Core Principles & Terminology
- **Terminology Mapping:** The UI presents "Service Calls" to Property Owners, but the backend canonical model is `ConciergeCase`. This distinction is strictly a presentation-layer abstraction.
- **Tenant Context:** Owners operate under their `organization_id` (Type: INDIVIDUAL_CONCIERGE) or interact directly with the Management Company's concierge desk.

## 2. Infrastructure & Entities
- **Property Portfolio Model:** 
  - `PropertyPortfolio` groups multiple properties for a single owner.
  - `IndividualProperty` stores address, type, and HOA context.
  - `PortfolioProperty` links properties to portfolios.
- **Case Management Model:**
  - `ConciergeCase`: The primary entity tracking status, priority, and assignments.
  - `CaseNote`: Tracking communication, typed via `CaseNoteType` (GENERAL, CLARIFICATION_REQUEST, DECISION_RATIONALE).
  - `OwnerIntent`: Captures the initial request before conversion into a formal case.
- **Asset Model:**
  - `IndividualAsset` tracks property systems (HVAC, Appliances) linked to the property.

## 3. Workflows & State Machine (DBOS)
- **Concierge Case Lifecycle:** Managed by a durable DBOS workflow (`caseLifecycleWorkflow`).
- **States:** INTAKE -> PENDING_OWNER -> ASSESSMENT -> PENDING_EXTERNAL -> IN_PROGRESS -> RESOLVED -> CLOSED -> CANCELLED.
- **Upstream Links:** The workflow must natively link `ConciergeCase` to CAM entities like `ArcRequest` or `WorkOrder` seamlessly, recording trace linkages without cross-tenant permission leaks.

## 4. Automation & Notifications
- Uses the `ActivityEvent` model to generate notifications derived from service call status changes.
- Preferences stored per user for email digests vs push notifications based on predefined categories (Quote Notifications, Document Updates, etc.).
