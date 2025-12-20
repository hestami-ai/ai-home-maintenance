# **CAM UX \#4 — Documents & Records (Decision-Centric)**

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
 Provide CAM users with a **structured, auditable, decision-aware records system** that supports:

* Governance

* Compliance

* Enforcement

* Financial accountability

* Dispute resolution

**This is not:**

* A generic document management system

* A Google Drive clone

* A dumping ground for uploads

---

## **2\. Mental Model (Critical)**

**In CAM, documents exist to justify decisions and actions.**

Every document should answer at least one question:

* What rule does this establish?

* What decision did this support?

* What obligation does this create?

* What evidence does this provide?

If a document cannot answer one of those, it is misclassified.

---

## **3\. Actors**

| Role | Interaction |
| ----- | ----- |
| CAM Staff | Upload, classify, link |
| Community Manager | Approve, reference in decisions |
| Board | Review, approve governance docs |
| Owners | Read-only access (scoped) |
| Auditors | Read-only, export |

---

## **4\. Canonical Document Categories (Non-Negotiable)**

Documents MUST be classified at upload time.

`Governing Documents`  
`Architectural Guidelines`  
`Policies & Resolutions`  
`Meeting Minutes`  
`Contracts & Agreements`  
`Financial Records`  
`Evidence & Inspections`  
`Correspondence`  
`Other (discouraged)`

Classification drives:

* Visibility

* Retention

* Audit handling

* Decision linking

---

## **5\. Required Metadata (At Upload)**

Every document MUST capture:

* Document type (from above)

* Effective date

* Version (if applicable)

* Visibility scope

* Related entities (optional at upload, mandatory before decisions)

Uploads without metadata are invalid.

---

## **6\. Primary Screen: Documents & Records Split View**

### **Screen ID**

`CAM-DOCS-01`

This follows the **standard CAM split-view pattern**.

---

### **Left Pane — Document List**

**Purpose:** Find and filter authoritative records quickly.

**Columns (dense):**

* Title

* Type

* Version

* Effective Date

* Status (Draft / Active / Superseded)

* Referenced In (count)

**Filters:**

* Type

* Status

* Effective date

* Referenced / Not referenced

---

### **Right Pane — Document Detail (Tabbed)**

#### **Tab 1 — Overview**

* Title

* Document type

* Current status

* Version history

* Visibility scope

* Superseded by / supersedes

---

#### **Tab 2 — Content**

* Inline preview (PDF/image/text)

* Download

* Print (audit-safe)

---

#### **Tab 3 — Usage & References (Critical)**

Shows where this document is used:

* Violations

* ARC Requests

* Work Orders

* Board Motions

* Decisions

This tab is what turns documents into **governance artifacts**.

---

#### **Tab 4 — History & Audit**

* Upload event

* Classification changes

* Visibility changes

* Referenced-in decisions

* Actor \+ authority

---

## **7\. Secondary Screens**

### **7.1 Document Upload & Classification**

**Screen ID:** `CAM-DOCS-02`

Steps:

1. Upload file

2. Select document type

3. Set effective date

4. Set visibility

5. Save

No decisions can reference the document until classification is complete.

---

### **7.2 Version Management**

**Screen ID:** `CAM-DOCS-03`

Capabilities:

* Upload new version

* Mark prior version as superseded

* Preserve full history

* Prevent deletion of referenced versions

Versioning is mandatory for governing documents.

---

## **8\. Visibility Rules (Governance-Driven)**

| Document Type | Board | Manager | Staff | Owner |
| ----- | ----- | ----- | ----- | ----- |
| Governing Docs | ✓ | ✓ | ✓ | ✓ |
| Policies | ✓ | ✓ | ✓ | ✓ |
| Minutes | ✓ | ✓ | ✓ | ✓ |
| Financial | ✓ | ✓ | ✓ | Limited |
| Evidence | ✓ | ✓ | ✓ | Conditional |
| Contracts | ✓ | ✓ | Limited | ✗ |

Visibility is enforced via Cerbos and RLS.

---

## **9\. Decision Integration (Phase 4 Alignment)**

Before a CAM decision can be finalized (ARC, violation, work order):

* Relevant documents MUST be linkable

* The decision UI must surface:

  * Document title

  * Version

  * Excerpt (optional)

* The resulting ActivityEvent must record:

  * Document ID(s)

  * Version(s)

This is non-optional for:

* ARC approvals

* Violation escalations

* Work order authorization

---

## **10\. Audit Mapping**

| Action | EntityType | Action |
| ----- | ----- | ----- |
| Document uploaded | DOCUMENT | CREATE |
| Classified | DOCUMENT | CLASSIFY |
| Version added | DOCUMENT | VERSION |
| Superseded | DOCUMENT | SUPERSEDE |
| Referenced in decision | DOCUMENT | REFERENCED |

Each audit event includes:

* Actor

* Role

* Reason (where applicable)

* Referencing entity

---

## **11\. Retention & Immutability Rules**

* Governing documents: immutable once effective

* Evidence: immutable once referenced

* Financial records: retention per jurisdiction

* No hard deletes; only supersede or archive

---

## **12\. UX Guardrails**

* Documents cannot be edited inline

* Metadata changes require audit entries

* Referenced documents cannot be deleted

* “Other” category triggers warning

---

## **13\. Why This UX Is Correct**

This design:

* Mirrors how real HOAs defend decisions

* Matches Vantaca’s document philosophy

* Supports Phase 4 forensic reconstruction

* Enables AI-assisted document reasoning later

* Prevents document sprawl and ambiguity

---

## **14\. What This Unlocks**

With:

* Violations ✔

* ARC ✔

* Work Orders ✔

* Documents ✔

You now have the **entire CAM governance substrate**.

