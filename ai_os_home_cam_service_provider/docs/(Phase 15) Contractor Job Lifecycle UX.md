# **Contractor Job Lifecycle**

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit 5 with Runes |
| UI Framework | Skeleton UI + Flowbite Svelte |
| Form Handling | Superforms |
| Icons | Lucide Svelte |
| Styling | TailwindCSS |
| Authentication | Better Auth (self-hosted) |
| API | oRPC (existing backend) |
| Authorization | Cerbos |

## **1\. Purpose & Scope**

**Purpose**  
 Enable service providers to **estimate, schedule, dispatch, execute, invoice, and close jobs** efficiently while remaining compliant with upstream authorization from:

* CAM (work orders)

* Concierge cases

* Direct customer requests

**Non-Goals**

* HOA governance

* Budget authorization

* ARC decisions

* Policy interpretation

Those are upstream inputs, not contractor responsibilities.

---

## **2\. Mental Model (Critical)**

**A Contractor Job is an execution container.**

It answers:

* What work is being performed?

* For whom?

* By which crew?

* On what schedule?

* At what cost?

* With what outcome?

It does **not** answer *why* the work was approved.

---

## **3\. Actors**

| Actor | Role |
| ----- | ----- |
| Contractor Admin | Business oversight |
| Dispatcher | Scheduling & assignment |
| Technician | Field execution |
| Office Staff | Estimates, invoicing |
| Customer (read-only) | Status visibility |
| CAM / Concierge | Status observers |

---

## **4\. Canonical Business States**

These states reflect **real service operations**.

`LEAD`  
`ESTIMATE_REQUESTED`  
`ESTIMATE_SENT`  
`ESTIMATE_APPROVED`  
`SCHEDULED`  
`DISPATCHED`  
`IN_PROGRESS`  
`ON_HOLD`  
`COMPLETED`  
`INVOICED`  
`PAID`  
`CLOSED`  
`CANCELLED`

Rules:

* State changes occur via DBOS workflows

* Some transitions are automated

* CAM/Concierge may observe but not control

---

## **5\. Job Creation Triggers**

A Contractor Job may originate from:

* CAM Work Order (authorized)

* Concierge Case (coordinated)

* Direct customer request

* Preventive maintenance schedule

Origin must always be recorded.

---

## **6\. Primary Screen: Contractor Jobs Split View**

### **Screen ID**

`CONTRACTOR-JOB-01`

This follows the platform-standard split-view pattern.

---

### **Left Pane — Jobs List**

**Purpose:** Operational triage

**Columns:**

* Job \#

* Customer

* Property

* Status

* Scheduled Date

* Assigned Crew

* Balance Due

**Filters:**

* Status

* Date

* Technician

* Origin type

* Customer

---

### **Right Pane — Job Detail (Tabbed)**

#### **Tab 1 — Overview**

* Job summary

* Origin reference

* Status

* Schedule

* Assigned crew

* SLA indicators

---

#### **Tab 2 — Scope & Estimate**

* Scope description

* Line-item estimate

* Approval status

* Change orders (if any)

Only this tab modifies scope/cost.

---

#### **Tab 3 — Scheduling & Dispatch**

* Calendar view

* Technician assignment

* Route notes

* Dispatch confirmations

---

#### **Tab 4 — Execution (Technician View)**

* Task checklist

* Notes

* Photos

* Time tracking

* Materials used

Mobile-first design required.

---

#### **Tab 5 — Invoicing & Payments**

* Invoice details

* Payment status

* Adjustments

* Export to accounting

---

#### **Tab 6 — Documents**

* Estimates

* Permits

* Completion photos

* Signed approvals

---

#### **Tab 7 — History & Audit**

* Status changes

* Actor

* System vs human

* Linked upstream references

---

## **7\. Secondary Screens**

### **7.1 Estimate Builder**

**Screen ID:** `CONTRACTOR-EST-01`

* Line-item pricing

* Templates

* Markups

* Approval workflow

Estimates may be:

* Required (CAM-linked)

* Optional (direct customer)

---

### **7.2 Dispatch Board**

**Screen ID:** `CONTRACTOR-DISP-01`

* Drag-and-drop scheduling

* Technician availability

* Job duration blocks

Dispatch decisions are **operational**, not audited like governance.

---

### **7.3 Technician Mobile View**

**Screen ID:** `CONTRACTOR-TECH-01`

* Job details

* Checklist

* Photo upload

* Time tracking

* Completion confirmation

Offline-capable.

---

## **8\. Authority & Permission Model**

| Role | Capabilities |
| ----- | ----- |
| Admin | Full |
| Dispatcher | Schedule, assign |
| Technician | Execute only |
| Office Staff | Estimate, invoice |
| CAM / Concierge | Read-only |

Permissions enforced via Cerbos.

---

## **9\. Audit Mapping (Phase 4\)**

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Job created | JOB | CREATE |
| Estimate approved | ESTIMATE | APPROVE |
| Dispatched | JOB | DISPATCH |
| Execution update | JOB | UPDATE |
| Completed | JOB | COMPLETE |
| Invoiced | INVOICE | CREATE |
| Paid | PAYMENT | CONFIRM |
| Closed | JOB | CLOSE |

Execution logs are **operational**, not governance-grade, but still auditable.

---

## **10\. Integration with CAM & Concierge**

| Source | Behavior |
| ----- | ----- |
| CAM Work Order | Read-only authorization |
| Concierge Case | Coordination reference |
| Contractor Job | Execution truth |

Status updates propagate upstream automatically.

---

## **11\. UX Guardrails**

* Contractors cannot modify CAM scope

* CAM cannot modify job execution

* Owners see limited status only

* Financial edits are controlled

---

## **12\. Why This UX Is Correct**

This design:

* Mirrors ServiceTitan-class workflows

* Preserves Phase boundaries

* Supports mobile execution

* Scales from solo operators to fleets

* Integrates cleanly with governance

---

## **13\. Hestami UX Completeness (Now)**

You now have:

* Platform UX ✔

* CAM UX ✔

* Concierge UX ✔

* Contractor UX ✔

* Audit UX ✔

**The full Hestami AI OS UX surface is now defined.**

