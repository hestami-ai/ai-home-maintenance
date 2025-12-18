# **CAM UX \#5 — Governance & Meetings**

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

**Purpose:**  
 Provide a structured, auditable workspace for **board governance**, including meetings, motions, votes, and resolutions that authorize or constrain CAM actions.

**This UX exists to answer:**

* Who decided?

* Under what authority?

* With what quorum?

* Based on which documents?

* With what outcome?

**Non-Goals (Explicit):**

* Casual collaboration tools

* Chat-first workflows

* Informal polling

* Decision shortcuts

---

## **2\. Mental Model (Critical)**

**Governance produces binding decisions that legitimize CAM actions.**

Meetings and motions are not events to be “logged.”  
 They are **sources of authority** that downstream workflows depend on.

Violations, ARC approvals, budgets, and work orders often **derive their legitimacy** from governance artifacts.

---

## **3\. Actors**

| Role | Interaction |
| ----- | ----- |
| Board Member | Vote, propose motions |
| Board Chair / Secretary | Run meetings, finalize records |
| Community Manager | Prepare agenda, execute outcomes |
| CAM Staff | Record keeping |
| Owners | Read-only (as permitted) |
| Auditor | Read-only, export |

---

## **4\. Canonical Governance Objects**

These are first-class entities in the CAM domain:

* **Meeting**

* **Agenda Item**

* **Motion**

* **Vote**

* **Resolution**

Each has lifecycle, authority, and audit semantics.

---

## **5\. Canonical Business States**

### **5.1 Meeting States**

`SCHEDULED`  
`IN_SESSION`  
`ADJOURNED`  
`MINUTES_DRAFT`  
`MINUTES_APPROVED`  
`ARCHIVED`

### **5.2 Motion States**

`PROPOSED`  
`SECONDED`  
`UNDER_VOTE`  
`APPROVED`  
`DENIED`  
`TABLED`  
`WITHDRAWN`

State transitions are:

* Explicit

* Role-restricted

* DBOS-managed

* Fully auditable

---

## **6\. Primary Screen: Governance & Meetings Split View**

### **Screen ID**

`CAM-GOV-01`

This follows the **standard CAM split-view pattern**.

---

### **Left Pane — Meetings List**

**Purpose:** Board-level visibility and navigation.

**Columns (dense):**

* Meeting Date

* Type (Regular / Special / Emergency)

* Status

* Quorum Met

* Minutes Status

**Filters:**

* Date range

* Status

* Meeting type

---

### **Right Pane — Meeting Detail (Tabbed)**

#### **Tab 1 — Overview**

* Meeting type

* Date & time

* Location / virtual link

* Attendees

* Quorum status (visual indicator)

---

#### **Tab 2 — Agenda**

* Ordered agenda items

* Linked documents

* Time allotments (optional)

* Locked once meeting starts

Agenda items may link to:

* ARC requests

* Violations

* Budgets

* Work orders

* Policy changes

---

#### **Tab 3 — Motions & Votes (Critical)**

For each motion:

* Motion text

* Proposer / seconder

* Vote breakdown

* Outcome

* Rationale / notes

Vote controls are:

* Explicit

* Irreversible once finalized

* Locked after close

---

#### **Tab 4 — Resolutions & Outcomes**

Shows:

* Approved motions

* Binding resolutions

* Linked downstream actions:

  * ARC decisions

  * Work order authorizations

  * Policy updates

This tab is what makes governance **operationally meaningful**.

---

#### **Tab 5 — Documents & Minutes**

* Draft minutes

* Final approved minutes

* Supporting documents

* Resolution attachments

Minutes approval is a **governance action**, not a file upload.

---

#### **Tab 6 — History & Audit**

* Meeting creation

* Attendance changes

* Motion lifecycle

* Vote records

* Actor \+ authority context

---

## **7\. Secondary Screens**

### **7.1 Meeting Creation & Scheduling**

**Screen ID:** `CAM-GOV-02`

Steps:

1. Select meeting type

2. Set date/time/location

3. Assign attendees

4. Draft agenda

5. Publish

Publishing generates an ActivityEvent.

---

### **7.2 Motion Proposal Panel**

**Screen ID:** `CAM-GOV-03`

* Motion text

* Related entities

* Supporting documents

* Submit for seconding

No vote allowed until motion is seconded.

---

### **7.3 Voting Panel (Board Members)**

**Screen ID:** `CAM-GOV-04`

* Motion summary

* Supporting docs

* Vote controls

* Conflict of interest indicator

* Vote confirmation

Votes are final once submitted.

---

## **8\. Decision & Authority Rules (Non-Negotiable)**

* Quorum must be satisfied before voting

* Voting eligibility enforced by role \+ meeting

* Votes are immutable

* Motions cannot be retroactively altered

* Outcomes must be explicitly recorded

These rules exist to preserve **legal defensibility**.

---

## **9\. Integration with Other CAM Domains**

Governance outcomes may:

* Approve or deny ARC requests

* Authorize work orders

* Modify enforcement policies

* Approve budgets

* Direct staff actions

All such linkages must be:

* Explicit

* Navigable

* Auditable

---

## **10\. Audit Mapping (Phase 4\)**

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Meeting created | MEETING | CREATE |
| Agenda published | MEETING | PUBLISH |
| Motion proposed | MOTION | PROPOSE |
| Motion seconded | MOTION | SECOND |
| Vote cast | VOTE | CAST |
| Motion approved/denied | MOTION | DECIDE |
| Minutes approved | MEETING | APPROVE\_MINUTES |

Each event captures:

* Actor

* Role

* Authority context

* Related documents

---

## **11\. Visibility Rules**

| Role | Access |
| ----- | ----- |
| Board | Full |
| Manager | Full |
| Staff | Read \+ record |
| Owners | Read-only (as allowed) |
| Vendors | None |

Visibility is enforced via Cerbos \+ RLS.

---

## **12\. UX Guardrails**

* No anonymous votes

* No inline editing of finalized decisions

* No retroactive changes

* Clear “binding decision” indicators

* Confirmation dialogs for governance actions

---

## **13\. Why This UX Is Correct**

This design:

* Mirrors real HOA governance practice

* Completes the CAM authority chain

* Makes audit trails explicit

* Prevents casual or ambiguous decision-making

* Integrates cleanly with ARC, Violations, Work Orders, and Documents

---

## **14\. CAM UX Status (After This Step)**

You now have:

* CAM Navigation & IA ✔

* Violations ✔

* ARC ✔

* Work Orders ✔

* Documents ✔

* Governance & Meetings ✔

This completes the **entire CAM governance surface**.
