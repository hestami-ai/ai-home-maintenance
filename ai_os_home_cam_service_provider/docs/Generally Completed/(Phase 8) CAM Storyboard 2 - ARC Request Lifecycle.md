# **CAM Storyboard \#2: ARC Request Lifecycle**

This is the **second canonical CAM workflow**, complementing Violations.

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

## **1\. Workflow Overview**

**Workflow Name:** ARC Request Lifecycle  
 **Primary Pillar:** Phase 1 — CAM  
 **Purpose:** Review, approve, deny, or conditionally approve architectural changes in a governed, auditable way.

---

## **2\. Trigger (Why This Workflow Exists)**

An ARC workflow begins when:

* An owner submits a modification request

* A manager initiates a request on behalf of an owner

* A board requests formal review of a change

**Submission ≠ approval.**  
 ARC is a deliberative process.

---

## **3\. Actors**

1. Property Owner (submit / view)

2. CAM Staff (intake)

3. Community Manager (review)

4. Board / ARC Committee (decision)

5. Auditor (read-only)

---

## **4\. Canonical Business States**

`DRAFT`  
`SUBMITTED`  
`UNDER_REVIEW`  
`NEEDS_INFO`  
`BOARD_REVIEW`  
`APPROVED`  
`APPROVED_WITH_CONDITIONS`  
`DENIED`  
`WITHDRAWN`  
`CLOSED`

Rules:

* State transitions only via DBOS

* Decision states require explicit votes or authority

* All state changes generate ActivityEvents

---

## **5\. Decision Points (Governance-Critical)**

| Decision | Authority | Requirements |
| ----- | ----- | ----- |
| Accept for review | Manager | Completeness check |
| Request more info | Manager / Board | Missing artifacts |
| Approve | Board / Committee | Vote \+ rationale |
| Conditional approval | Board / Committee | Conditions \+ enforcement |
| Deny | Board / Committee | Rule citation \+ rationale |

---

## **6\. Required Artifacts**

ARC decisions must surface:

* Proposal summary

* Drawings / plans

* Governing document excerpts

* Prior ARC precedents

* Property context

* Voting record

If any artifact is missing, the UI must **block final decisions**.

---

## **7\. Primary Screen: ARC Requests Split View**

### **Screen ID**

`CAM-ARC-01`

---

### **Left Pane — ARC Requests List**

Columns:

* Unit / Property

* Request Type

* Status

* Days Open

* Board Review Required

Filters:

* Status

* Property

* Request type

---

### **Right Pane — ARC Request Detail**

#### **Tab 1 — Overview**

* Request description

* Current state

* Key dates

* Assigned reviewers

#### **Tab 2 — Proposal**

* Drawings

* Specs

* Supporting docs

* Inline preview

#### **Tab 3 — Governing Rules**

* Cited CC\&R sections

* Architectural guidelines

* Precedent links

#### **Tab 4 — Decisions**

* Vote breakdown

* Decision options

* Mandatory rationale

* Conditional terms editor

#### **Tab 5 — History & Audit**

* ActivityEvent timeline

* Actor type (human/system)

* Authority context

---

## **8\. Secondary Screens**

### **8.1 ARC Submission (Owner View)**

* Guided form

* Required uploads

* Submission checklist

### **8.2 Board Voting Panel**

* Member list

* Vote controls

* Quorum indicator

* Lock-on-decision

---

## **9\. Audit Mapping (Phase 4\)**

Every ARC action must emit events:

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Submission | ARC\_REQUEST | SUBMIT |
| Info requested | ARC\_REQUEST | REQUEST\_INFO |
| Vote cast | ARC\_REQUEST | VOTE |
| Decision | ARC\_REQUEST | APPROVE / DENY |
| Conditional approval | ARC\_REQUEST | APPROVE\_CONDITIONAL |
| Close | ARC\_REQUEST | CLOSE |

Each event records:

* Actor

* Role

* Rationale

* Documents referenced

---

## **10\. Relationship to Other Domains**

ARC may spawn:

* Violations (unauthorized changes)

* Work Orders (approved installs)

* Concierge cases (Phase 3, later)

ARC never executes work directly.

---

## **11\. Why This Is the Right Next UX**

With:

* CAM Navigation & IA locked

* Violations storyboard complete

* ARC storyboard complete

You now have:

* The governance core of CAM

* The decision UX patterns

* The audit semantics

* The blueprint for the rest of the pillar

Everything else becomes mechanical.