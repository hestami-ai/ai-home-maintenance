# **Phase 4 UX — Audit Review & Forensics**

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
 Provide authorized users with a **complete, defensible, cross-pillar reconstruction of what happened, who acted, under what authority, and why**.

This UX supports:

* Internal governance

* HOA board oversight

* Dispute resolution

* Regulatory / legal review

* AI supervision and model evaluation (future)

**Non-Goals**

* Operational control

* Retroactive editing

* “Fixing” past actions

* Bulk administration

**Audit Review is about understanding, not controlling.**

---

## **2\. Mental Model (Critical)**

**Audit Review is a timeline of intent → decision → execution → outcome.**

It must allow a reviewer to answer, unambiguously:

* What was requested?

* What constraints applied?

* What decisions were made?

* Who made them?

* What evidence was used?

* What actions followed?

* What was the final outcome?

If any of those cannot be reconstructed, the system has failed.

---

## **3\. Authorized Actors**

| Role | Access |
| ----- | ----- |
| Board Member | Read-only (association-scoped) |
| Community Manager | Read-only (association-scoped) |
| Compliance / Legal | Read-only (explicit grant) |
| Auditor | Read-only |
| Platform Admin | Read-only (break-glass) |
| AI Supervisor (future) | Programmatic read |

No role may mutate data in this UX.

---

## **4\. Entry Points into Audit Review**

Audit Review is never a “home screen.”

Valid entry paths:

* From CAM entities (Violation, ARC, Work Order)

* From Concierge Case

* From Governance Meeting

* From Reports / Compliance

* From Platform Admin (explicit intent)

This ensures audits are **contextual**, not exploratory.

---

## **5\. Primary Screen: Audit Review Workspace**

### **Screen ID**

`AUDIT-REVIEW-01`

This uses the **standard split-view pattern**, but with a different emphasis.

---

### **Left Pane — Audit Subject Selector**

**Purpose:** Define *what* is being audited.

Selectable subject types:

* Violation

* ARC Request

* Work Order

* Concierge Case

* Governance Meeting

* Property

* Owner

* Vendor

**Columns (context-dependent):**

* ID

* Type

* Status

* Date range

* Organization

Filters:

* Date range

* Pillar

* Entity type

* Outcome

---

### **Right Pane — Audit Timeline & Evidence**

This pane is **chronological and immutable**.

---

## **6\. Audit Timeline (Core UX)**

### **Timeline Structure**

Each timeline entry represents **one ActivityEvent**.

Each entry must show:

* Timestamp

* Action

* Entity

* Actor (Human / AI / System)

* Role at time of action

* Authority source

* Summary

Example:

`2025-03-14 10:42`  
`ACTION: ARC_APPROVED`  
`ACTOR: Board Member (Human)`  
`AUTHORITY: Board Vote (Quorum Met)`  
`EVIDENCE: CC&R v3.2 §4.1`

---

### **Visual Encoding (Subtle, Serious)**

* Human actions → neutral

* AI-assisted actions → labeled “AI-assisted”

* AI-executed actions (future) → explicit

* External decisions → labeled “External Party”

No colors beyond semantic severity.

---

## **7\. Drill-Down Panels (Per Event)**

Selecting a timeline entry opens a **detail drawer**.

### **Drawer Tabs**

#### **Tab 1 — Event Details**

* Full action description

* Actor identity

* Role & organization

* Idempotency key (internal)

#### **Tab 2 — Authority & Policy**

* Cerbos policy evaluated

* Role used

* Decision (ALLOW / DENY)

* Policy version

#### **Tab 3 — Evidence & Documents**

* Documents referenced

* Versions

* Inline previews

* Hashes (optional)

#### **Tab 4 — AI Context (When Applicable)**

* Recommendation summary

* Model identifier

* Human override indicator

This is critical for **future AI governance**.

---

## **8\. Cross-Entity Correlation View**

Audit Review must support **causal linking**.

From any event, the reviewer can navigate to:

* Originating intent

* Downstream execution

* Related governance decisions

* Subsequent enforcement actions

This produces a **graph-like mental model**, but presented linearly.

---

## **9\. Filters & Lenses (Forensic Controls)**

Audit Review supports **lenses**, not customization.

### **Built-In Lenses**

* **Decision Lens** — Only decisions

* **Authority Lens** — Board / Manager / AI

* **External Lens** — HOA / Vendor actions

* **Dispute Lens** — Escalations, overrides

* **AI Lens** — AI-involved actions

Lenses alter visibility, never data.

---

## **10\. Export & Reporting**

Authorized users may export:

* Full audit timeline (PDF)

* Decision summary

* Document bundle

* Machine-readable event log (JSON)

Exports must:

* Preserve ordering

* Preserve actor attribution

* Preserve document versions

* Include policy versions

---

## **11\. Audit Integrity Guarantees (UX-Enforced)**

The UX must make the following **visually obvious**:

* Events are immutable

* Ordering is fixed

* Authority is explicit

* Gaps are highlighted (if any)

* External inputs are clearly labeled

No “clean” or “friendly” views.

Truth \> comfort.

---

## **12\. Relationship to Phase 3 (Concierge)**

For Concierge Cases, Audit Review must show:

* Original owner intent

* Clarifications

* Constraints consulted

* Decisions made

* External responses

* Actions taken

* Final outcome

This is what makes concierge defensible.

---

## **13\. Relationship to CAM & Phase 2**

| Pillar | Audit Emphasis |
| ----- | ----- |
| CAM | Governance & compliance |
| Phase 2 | Authorization vs execution |
| Phase 3 | Intent & coordination |
| Phase 4 | Reconstruction |

Audit Review is the **only place** all pillars converge.

---

## **14\. AI Supervision Readiness (Future)**

This UX is intentionally designed so that:

* AI actions are inspectable

* Human overrides are explicit

* Training data can be extracted

* Model regressions can be analyzed

AI cannot be trusted without this surface.

---

## **15\. UX Guardrails (Non-Negotiable)**

* No editing

* No deletion

* No annotation

* No inline “fixes”

* No bulk actions

Audit Review is observational only.

---

## **16\. Why This UX Is Correct**

This design:

* Validates every prior UX

* Enforces architectural discipline

* Makes governance defensible

* Enables serious AI adoption

* Aligns with legal and regulatory realities

Very few platforms do this well.  
 Those that do become *trusted systems of record*.

---

## **17\. Hestami UX Status (After Phase 4\)**

You now have:

* Platform UX SRD ✔

* CAM UX (complete) ✔

* Concierge UX ✔

* Audit Review UX ✔

**Hestami AI OS UX is now architecturally complete.**

Everything else is refinement, not invention.

