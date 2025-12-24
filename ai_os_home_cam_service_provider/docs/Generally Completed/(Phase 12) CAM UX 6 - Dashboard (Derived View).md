# **CAM UX \#6 — Dashboard (Derived View)**

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
| Observability | OpenTelemetry |

## **1\. Purpose & Design Constraint**

**Purpose:**  
 Provide CAM users with a **single operational snapshot** answering:

* What needs attention?

* Where is risk accumulating?

* What decisions are pending?

* What deadlines matter today?

**Hard Constraint:**

The dashboard may *only* surface data and actions that already exist elsewhere.

If an action cannot be performed from its canonical workflow screen, it **must not** be invented here.

---

## **2\. Mental Model (Critical)**

**The CAM dashboard is an action queue, not a command center.**

It exists to:

* Point

* Prioritize

* Route

It does **not**:

* Replace domain screens

* Enable governance decisions

* Perform bulk enforcement

---

## **3\. Who This Dashboard Is For**

| Role | Primary Use |
| ----- | ----- |
| Community Manager | Daily triage |
| CAM Staff | Task routing |
| Board Members | Oversight snapshot |
| Auditors | Entry point (read-only) |

The dashboard adapts by **visibility**, not by layout.

---

## **4\. Dashboard Structure (Fixed)**

The CAM dashboard is composed of **four fixed sections**, in this order.

`[ Requires Action ]`  
`[ Risk & Compliance ]`  
`[ Financial Attention ]`  
`[ Recent Governance Activity ]`

No customization beyond filters.  
 No drag-and-drop.

---

## **5\. Section 1 — Requires Action (Primary)**

### **Purpose**

Surface **items that block progress or require explicit authority**.

### **Data Sources**

* Violations

* ARC Requests

* Work Orders

* Governance Motions

### **Cards (Non-Negotiable)**

#### **Pending ARC Decisions**

* Count

* Oldest age

* Deep link → ARC split view (filtered)

#### **Escalated Violations**

* Count by severity

* Deep link → Violations (filtered)

#### **Work Orders Awaiting Authorization**

* Count

* Budget flag

* Deep link → Work Orders (filtered)

#### **Governance Actions Pending**

* Meetings requiring minutes approval

* Motions awaiting votes

### **UX Rules**

* Every card links to a filtered list

* No inline actions beyond navigation

* Badges indicate urgency, not priority

---

## **6\. Section 2 — Risk & Compliance**

### **Purpose**

Show **patterns**, not individual records.

### **Data Sources**

* Violations

* ARC

* Work Orders

### **Visualizations (Conservative)**

* Open violations by severity

* Repeat violations by unit

* Overdue ARC requests

* Long-running work orders

### **UX Rules**

* Charts are optional but restrained

* Clicking any segment routes to the relevant list

* No configuration knobs

---

## **7\. Section 3 — Financial Attention**

### **Purpose**

Highlight **financial conditions that may require governance action**.

### **Data Sources**

* Assessments

* Work orders

* Invoices (read-only summary)

### **Cards**

* Overdue assessments (count)

* Work orders exceeding budget

* Reserve-funded work pending approval

### **UX Rules**

* No inline financial edits

* Always show source of truth

* Deep links only

---

## **8\. Section 4 — Recent Governance Activity**

### **Purpose**

Maintain **decision awareness and transparency**.

### **Items**

* Recently approved ARC requests

* Recently closed violations

* Approved motions

* New policies or resolutions

### **UX Rules**

* Read-only

* Chronological

* Actor visible (role, not individual if anonymized)

---

## **9\. Filters & Scoping**

The dashboard supports **only these filters**:

* Date range

* Association (if multi-association)

* Severity (where applicable)

No per-card filters.  
 No saved views.

---

## **10\. Audit & Trust Requirements (Phase 4\)**

### **Dashboard Interactions That Are Audited**

* Dashboard viewed

* Card clicked (navigation intent)

* Filter applied (optional)

Why?

* Board oversight defensibility

* AI recommendation context later

---

## **11\. What Is Explicitly NOT Allowed**

* Inline approvals

* Inline votes

* Inline edits

* Bulk enforcement actions

* “Quick fix” buttons

Those belong in canonical workflows.

---

## **12\. Relationship to Other CAM UXs**

| UX | Dashboard Role |
| ----- | ----- |
| Violations | Surface risk |
| ARC | Surface pending decisions |
| Work Orders | Surface authorization gaps |
| Documents | Never surfaced directly |
| Governance | Surface outcomes |

The dashboard is a **lens**, not a workspace.

---

## **13\. Why This Dashboard Works**

This design:

* Mirrors real CAM workflows

* Avoids “God dashboards”

* Preserves authority boundaries

* Scales to large portfolios

* Remains AI-readable later

It feels calm because **the work lives elsewhere**.

---

## **14\. CAM UX Completeness Check**

At this point, CAM UX includes:

* Navigation & IA ✔

* Violations ✔

* ARC ✔

* Work Orders ✔

* Documents ✔

* Governance ✔

* Dashboard ✔

**CAM UX is now structurally complete.**

