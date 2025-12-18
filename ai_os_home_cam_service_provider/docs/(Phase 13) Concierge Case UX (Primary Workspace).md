# **Phase 3 UX — Concierge Case (Primary Workspace)**

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
 Provide a single, durable workspace that translates **property-owner intent** into coordinated outcomes across:

* External HOAs (on-platform or off-platform)

* External service providers

* CAM governance workflows (when applicable)

* Human concierge judgment

* Future AI assistance

**Key Distinction (Non-Negotiable)**

A **Concierge Case is not a work order**.  
 It is an **intent → decision → coordination → outcome** container.

---

## **2\. Mental Model (Critical)**

**The Concierge Case is the owner’s “case file.”**

It answers:

* What is the owner trying to achieve?

* What constraints exist?

* What decisions were made?

* Who made them?

* What actions were taken?

* What was the outcome?

It persists even if:

* No work is executed

* The HOA is external

* Vendors are off-platform

* The request is denied

---

## **3\. Actors**

| Actor | Role |
| ----- | ----- |
| Property Owner | Intent submission, visibility |
| Concierge Staff | Coordination, judgment |
| Community Manager | Governance liaison (if HOA-linked) |
| External HOA | Decision source (external) |
| External Vendor | Execution (external or Phase 2\) |
| Auditor | Read-only |
| AI Assistant (future) | Recommendation, summarization |

---

## **4\. Canonical Business States**

These states are **business-meaningful** and drive UI affordances.

`INTAKE`  
`CLARIFYING`  
`UNDER_REVIEW`  
`WAITING_EXTERNAL`  
`DECISION_MADE`  
`ACTION_IN_PROGRESS`  
`RESOLVED`  
`CLOSED`  
`WITHDRAWN`

Rules:

* State transitions occur via DBOS workflows

* State changes are auditable

* Owners cannot force state transitions

* AI may recommend transitions, not execute them (initially)

---

## **5\. Triggers (How Cases Begin)**

A Concierge Case is created when:

* Owner submits a request (“I want to add a deck”)

* Owner asks a question (“Can I rent this property?”)

* Owner reports an issue (“Water damage in unit”)

* Concierge creates a case proactively (portfolio review)

---

## **6\. Required Artifacts**

At decision time, the case must surface:

* Property context

* Owner intent (original \+ clarified)

* Governing documents (uploaded or CAM-linked)

* Prior decisions / cases

* HOA constraints (if any)

* Cost / time considerations (if relevant)

Missing artifacts **block resolution**, not intake.

---

## **7\. Primary Screen: Concierge Case Split View**

### **Screen ID**

`CONCIERGE-CASE-01`

This deliberately mirrors the **CAM split-view pattern** to preserve platform coherence.

---

### **Left Pane — Case List**

**Purpose:** Owner \+ concierge triage

**Columns:**

* Case \#

* Property

* Intent Type

* Status

* Last Updated

* Waiting On (Owner / HOA / Vendor)

**Filters:**

* Status

* Property

* Intent category

* Waiting on

Owners see only their cases.  
 Concierge staff see assigned cases.

---

### **Right Pane — Case Detail (Tabbed)**

#### **Tab 1 — Overview**

* Owner intent (original phrasing)

* Current status (explicit badge)

* Assigned concierge

* Key dates

* “What’s blocking progress” indicator

---

#### **Tab 2 — Intent & Clarifications**

* Original request

* Follow-up questions

* Owner responses

* AI-generated summaries (future, labeled)

This tab preserves **intent history**.

---

#### **Tab 3 — Constraints & Context**

* Governing docs (linked)

* HOA rules (excerpted)

* Property metadata

* Prior relevant cases

This is where **CAM artifacts may appear**, read-only.

---

#### **Tab 4 — Decisions & Rationale (Critical)**

* Decision options considered

* Final decision

* Rationale (mandatory)

* Actor (human / AI-assisted)

* Authority source

This tab is structurally identical to CAM decision UX.

---

#### **Tab 5 — Actions & Coordination**

* External HOA communications (logged)

* Vendor coordination

* Links to:

  * CAM ARC

  * CAM Work Orders

  * Phase 2 Jobs (if applicable)

No execution happens here—only coordination and linkage.

---

#### **Tab 6 — Documents**

* Owner uploads

* HOA docs

* Vendor quotes

* Photos

Documents here are **decision inputs**, not storage.

---

#### **Tab 7 — History & Audit**

* ActivityEvent timeline

* Actor type

* Decision references

* Authorization context

This is Phase 4–aligned by design.

---

## **8\. Secondary Screens**

### **8.1 Case Creation (Owner)**

**Screen ID:** `CONCIERGE-CASE-02`

* Free-form description

* Property selection

* Optional attachments

* Submit

No forced categorization at intake.

---

### **8.2 Concierge Action Panel**

**Screen ID:** `CONCIERGE-CASE-03`

Used by concierge staff to:

* Request clarification

* Link CAM workflows

* Record decisions

* Close cases

All actions require rationale where appropriate.

---

## **9\. Decision Rules (Authority & Safety)**

* Owners never approve themselves

* Concierge decisions must cite constraints

* HOA decisions must be attributed explicitly

* AI recommendations must be labeled

* Final authority is always human (initial phases)

---

## **10\. Audit Mapping (Phase 4\)**

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Case created | CONCIERGE\_CASE | CREATE |
| Clarification requested | CONCIERGE\_CASE | REQUEST\_INFO |
| Decision recorded | DECISION\_RECORD | DECIDE |
| External response logged | EXTERNAL\_PARTY | RESPOND |
| Action initiated | CONCIERGE\_CASE | COORDINATE |
| Case resolved | CONCIERGE\_CASE | RESOLVE |
| Case closed | CONCIERGE\_CASE | CLOSE |

Every event records:

* Actor

* Role

* Human vs AI

* Documents referenced

---

## **11\. Relationship to CAM & Phase 2**

| Concierge Case | CAM | Phase 2 |
| ----- | ----- | ----- |
| Owner intent | Governance constraints | Execution |
| Decision container | Authority | Operations |
| Coordination | Approval | Job control |
| Outcome summary | Compliance | Completion |

The Concierge Case **orchestrates**, never replaces.

---

## **12\. Why This UX Is Correct**

This design:

* Honors intent vs execution separation

* Reuses CAM governance patterns

* Supports off-platform realities

* Is human-first but AI-ready

* Is fully auditable

* Feels like a *service*, not a ticket

---

## **13\. Platform UX Status (Now)**

You now have:

* Platform UX SRD ✔

* CAM UX (complete) ✔

* Concierge Case UX (primary) ✔

This completes the **operational surface of Hestami AI OS**.

