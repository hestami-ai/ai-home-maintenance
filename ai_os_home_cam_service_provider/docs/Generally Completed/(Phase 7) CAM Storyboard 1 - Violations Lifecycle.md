# **CAM Storyboard \#2 — Violations Lifecycle**

**(Authoritative Reference Storyboard)**

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

## **1\. Workflow Overview**

**Workflow Name:** Violation Enforcement Lifecycle  
 **Primary Pillar:** Phase 1 — CAM  
 **Secondary Pillars:** Phase 2 (Work Orders), Phase 4 (Audit)  
 **Primary Purpose:** Enforce community rules in a consistent, auditable, and defensible manner.

---

## **2\. Trigger (Why This Workflow Exists)**

A violation workflow begins when **a potential breach of community rules is detected**.

### **Valid Triggers**

* Scheduled inspection

* Manual staff observation

* Owner complaint

* Board directive

* Follow-up on unresolved violation

**Key Principle:**

Detection ≠ Violation. Detection initiates *review*, not enforcement.

---

## **3\. Actors (Who Touches the Workflow)**

Ordered by typical interaction sequence:

1. **CAM Staff**

   * Intake

   * Evidence capture

   * Initial classification

2. **Community Manager**

   * Confirmation

   * Severity determination

   * Enforcement decisions

3. **Board Member(s)** *(conditional)*

   * Appeals

   * Policy interpretation

   * Escalated actions

4. **Property Owner** *(read/respond only)*

   * Notification

   * Response submission

5. **External Vendor** *(optional)*

   * Remediation execution

6. **Auditor / Compliance Reviewer** *(read-only, later)*

---

## **4\. Canonical States (Business States, Not UI States)**

These states **drive UI affordances, permissions, and audit rules**.

`DETECTED`  
`UNDER_REVIEW`  
`NOTICE_SENT`  
`OWNER_RESPONSE_PENDING`  
`ESCALATED`  
`REMEDIATION_IN_PROGRESS`  
`RESOLVED`  
`CLOSED`

### **State Rules**

* State transitions MUST occur inside DBOS workflows

* Every transition MUST produce an ActivityEvent

* Certain transitions require **explicit human decisions**

---

## **5\. Decision Points (Authority Checkpoints)**

These are the **non-negotiable governance moments**.

| Decision | Role | Required Input |
| ----- | ----- | ----- |
| Is this a valid violation? | Manager | Rule citation \+ evidence |
| Severity level? | Manager | Rule \+ precedent |
| Send notice? | Manager | Template \+ deadline |
| Escalate? | Manager | Justification |
| Apply fine? | Manager / Board | Amount \+ rationale |
| Authorize remediation? | Manager | Vendor \+ budget |
| Close violation? | Manager | Outcome summary |

**Every decision requires:**

* Confirmation

* Rationale

* Audit entry

---

## **6\. Required Artifacts (What Must Be Visible in the UI)**

These artifacts **must be visible at decision time**.

### **Core Artifacts**

* Governing rule text (excerpt \+ link)

* Evidence (photos, notes)

* Property/unit details

* Violation history (same unit \+ same rule)

* Timeline of actions

### **Conditional Artifacts**

* Owner responses

* Board resolutions

* Work orders

* Vendor invoices

If any artifact is missing, the UI must **block or warn** before decisions.

---

## **7\. Primary Screen: Violations Split View (Canonical)**

### **Screen ID**

`CAM-VIOLATIONS-01`

---

### **Left Pane — Violations List**

**Purpose:** High-volume triage

**Columns (dense, fixed order):**

* Unit

* Rule

* Severity

* Status

* Days Open

* Escalation Flag

**Controls:**

* Filter by status, severity, rule

* Sort by days open

* Bulk select (limited actions)

---

### **Right Pane — Violation Detail (Tabbed)**

#### **Tab 1 — Overview**

* Current status (visual state badge)

* Rule excerpt

* Severity

* Assigned staff

* SLA timers (if applicable)

#### **Tab 2 — Evidence**

* Photo gallery

* Notes

* Upload controls

* Timestamped evidence list

#### **Tab 3 — Actions**

* Confirm violation

* Send notice

* Escalate

* Apply fine

* Authorize remediation

* Resolve / Close

**Only actions valid for the current state are enabled.**

#### **Tab 4 — Communications**

* Notices sent

* Owner responses

* Message thread (read-only for owners)

#### **Tab 5 — Audit (Phase 4\)**

* ActivityEvent timeline

* Actor (human / system)

* Decision rationale

* Authorization context

---

## **8\. Secondary Screens**

### **8.1 Violation Creation (Intake)**

**Screen ID:** `CAM-VIOLATIONS-02`

* Property/unit selector

* Rule selector

* Initial notes

* Evidence upload

* Save → enters `UNDER_REVIEW`

No enforcement actions allowed here.

---

### **8.2 Owner Response Viewer**

**Screen ID:** `CAM-VIOLATIONS-03`

* Owner submission

* Attachments

* Timestamp

* Manager response controls

Owner input NEVER changes state automatically.

---

### **8.3 Remediation Authorization**

**Screen ID:** `CAM-VIOLATIONS-04`

* Vendor selection

* Budget source

* Scope summary

* Create CAM Work Order (Phase 2 link)

This is the **bridge to execution**, not execution itself.

---

## **9\. Audit Obligations (Phase 4 Mapping)**

Every one of the following MUST generate ActivityEvents:

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Detection logged | VIOLATION | CREATE |
| Violation confirmed | VIOLATION | CONFIRM |
| Notice sent | VIOLATION | NOTICE\_SENT |
| Owner response received | VIOLATION | RESPONSE\_RECEIVED |
| Escalation | VIOLATION | ESCALATE |
| Fine applied | VIOLATION | APPLY\_FINE |
| Work order created | WORK\_ORDER | CREATE |
| Violation resolved | VIOLATION | RESOLVE |
| Violation closed | VIOLATION | CLOSE |

Each event must record:

* Actor type (HUMAN / SYSTEM)

* Actor ID

* Rationale (where applicable)

* Related artifacts

---

## **10\. Failure & Edge Case Storyboards**

These must be supported explicitly:

### **A. False Positive**

* Violation marked invalid

* Closed with rationale

* No enforcement actions taken

### **B. Repeated Violations**

* Prior history highlighted

* Escalation suggested (not automatic)

### **C. Owner Appeal**

* Appeal flag

* Board review required

* Separate decision recorded

### **D. External HOA Rule Conflict**

* Document reference logged

* Manual interpretation recorded

* Audit emphasized

---

## **11\. AI Readiness (Future-Proofing)**

This workflow is designed so AI agents can later:

* Flag likely violations

* Suggest severity

* Draft notices

* Recommend escalation paths

But:

* **Humans always confirm**

* AI actions are advisory until explicitly authorized

* All AI involvement is auditable

---

## **12\. What This Storyboard Gives You**

After this single storyboard, you now have:

* A canonical CAM workflow

* A repeatable UI pattern

* Clear audit semantics

* A template for:

  * ARC requests

  * Concierge cases

  * Appeals

  * Enforcement workflows

