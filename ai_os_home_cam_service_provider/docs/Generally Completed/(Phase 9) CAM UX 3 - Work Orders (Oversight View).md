# **CAM UX \#3 — Work Orders (Oversight View)**

---

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

---

## **1\. Purpose & Scope**

**Purpose:**  
 Provide CAM users (managers, staff, boards) a **governed, auditable view of authorized work**—why it exists, who approved it, how it’s funded, and whether it is compliant.

**Non-Goals (Explicit):**

* No technician dispatch

* No route optimization

* No timecards

* No job execution details

Those belong to **Phase 2 (Contractor Ops)**.

---

## **2\. Mental Model (Critical)**

**A CAM Work Order is an authorization and accountability artifact, not an execution engine.**

It answers:

* Why is work being done?

* Under what authority?

* With what budget?

* Against which asset?

* With what constraints?

* Is it complete and compliant?

---

## **3\. Actors**

| Role | Interaction |
| ----- | ----- |
| CAM Staff | Intake, coordination |
| Community Manager | Authorization, oversight |
| Board (conditional) | Approval, budget |
| Vendor (external) | View scope / upload completion |
| Auditor | Read-only |

---

## **4\. Canonical Business States**

These are **business states**, not UI states.

`DRAFT`  
`AUTHORIZED`  
`ASSIGNED`  
`IN_PROGRESS`  
`ON_HOLD`  
`COMPLETED`  
`REVIEW_REQUIRED`  
`CLOSED`  
`CANCELLED`

### **State Rules**

* State changes only via DBOS workflows

* Authorization states require explicit human action

* Execution states may be mirrored from Phase 2

* Closure requires confirmation and outcome summary

---

## **5\. Triggers (How Work Orders Are Created)**

A CAM Work Order may be created from:

* **Violation remediation**

* **ARC approval**

* **Preventive maintenance**

* **Board directive**

* **Emergency action**

A CAM Work Order MUST always reference its origin.

---

## **6\. Required Artifacts**

Before authorization, the following MUST be visible:

* Origin (Violation / ARC / Board motion)

* Asset (unit, common area)

* Scope summary

* Budget source (operating / reserve / special)

* Vendor (or TBD)

* Constraints (HOA rules, conditions)

Missing artifacts block authorization.

---

## **7\. Primary Screen: Work Orders Split View**

### **Screen ID**

`CAM-WO-01`

This follows the **canonical CAM split-view pattern**.

---

### **Left Pane — Work Orders List**

**Purpose:** Oversight and triage

**Columns (dense):**

* Work Order \#

* Asset

* Origin Type

* Status

* Vendor

* Budget Source

* Days Open

**Filters:**

* Status

* Origin

* Vendor

* Budget source

* Asset

**Badges:**

* `Board Approval Required`

* `Budget Exception`

* `Review Required`

---

### **Right Pane — Work Order Detail (Tabbed)**

#### **Tab 1 — Overview**

* Current state (authoritative badge)

* Origin link (click-through)

* Asset context

* Assigned vendor

* Key dates

* SLA indicators (if applicable)

---

#### **Tab 2 — Scope & Authorization**

* Scope description (read-only after authorization)

* Authorizing role (manager / board)

* Approval rationale (mandatory)

* Conditions or constraints

* Authorization timestamp

**This tab is the legal heart of the work order.**

---

#### **Tab 3 — Budget & Finance**

* Budget source

* Approved amount

* Spend to date

* Variance (highlighted)

* Linked invoices (read-only here)

CAM users **never edit invoices** here.

---

#### **Tab 4 — Vendor & Execution (Read-Only)**

* Vendor profile (summary)

* Execution status (mirrored)

* Completion uploads (photos, notes)

* External timestamps

No execution controls appear here.

---

#### **Tab 5 — Documents**

* Quotes

* Contracts

* Completion photos

* Permits (if required)

Documents are **referenced**, not managed, here.

---

#### **Tab 6 — History & Audit**

* ActivityEvent timeline

* Actor (human/system)

* Authorization context

* Linked decisions

---

## **8\. Secondary Screens**

### **8.1 Work Order Creation (Authorization Intake)**

**Screen ID:** `CAM-WO-02`

Used only by authorized CAM users.

Steps:

1. Select origin

2. Define scope

3. Select budget

4. Assign vendor or mark TBD

5. Submit for authorization

No execution begins here.

---

### **8.2 Board Approval Panel (Conditional)**

**Screen ID:** `CAM-WO-03`

Appears only if:

* Budget exceeds threshold

* Governing docs require board approval

Features:

* Vote controls

* Quorum indicator

* Rationale capture

* Lock-on-decision

---

## **9\. Decision Points (Authority Checkpoints)**

| Decision | Authority | Required |
| ----- | ----- | ----- |
| Authorize work | Manager / Board | Scope \+ rationale |
| Assign vendor | Manager | Compliance check |
| Approve budget | Manager / Board | Amount \+ source |
| Accept completion | Manager | Evidence review |
| Close work order | Manager | Outcome summary |

Every decision generates an ActivityEvent.

---

## **10\. Audit Mapping (Phase 4\)**

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Work order created | WORK\_ORDER | CREATE |
| Authorized | WORK\_ORDER | AUTHORIZE |
| Vendor assigned | WORK\_ORDER | ASSIGN |
| Status updated | WORK\_ORDER | STATUS\_CHANGE |
| Completion accepted | WORK\_ORDER | ACCEPT |
| Closed | WORK\_ORDER | CLOSE |
| Cancelled | WORK\_ORDER | CANCEL |

Each event captures:

* Actor type

* Authority context (Cerbos)

* Origin reference

* Documents referenced

---

## **11\. Relationship to Phase 2 (Contractor Ops)**

| CAM | Phase 2 |
| ----- | ----- |
| Authorizes work | Executes work |
| Governs budget | Tracks labor |
| Oversees compliance | Manages technicians |
| Audits decisions | Optimizes operations |

**Single source of truth for execution remains Phase 2\.**

CAM mirrors status; it does not control execution.

---

## **12\. UX Guardrails (Non-Negotiable)**

* CAM users cannot:

  * Edit execution steps

  * Modify time entries

  * Alter invoices

* Vendors cannot:

  * See unrelated CAM data

  * Alter scope or budget

* Owners (if visible) see:

  * Status only

  * No financials

---

## **13\. Why This UX Is Correct**

This design:

* Matches Vantaca’s governance-first approach

* Preserves clean Phase boundaries

* Supports Phase 4 audit rigor

* Scales to AI-assisted authorization later

* Prevents scope creep into contractor execution

---

## **14\. What This Unlocks Next**

With:

* Violations ✔

* ARC ✔

* Work Orders ✔

You now have the **entire CAM enforcement → authorization → execution chain**.

