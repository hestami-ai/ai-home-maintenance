# **CAM Navigation & Domain Information Architecture (IA)**

This defines the **structural skeleton** of the CAM pillar.  
 All CAM UX flows plug into this.

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

## **1\. CAM Navigation Design Goals**

The CAM navigation must:

* Reflect **governance domains**, not features

* Be **predictable and stable**

* Scale from small HOAs to large portfolios

* Support **role-based visibility without reordering**

* Align cleanly with Cerbos resource kinds

If a CAM user cannot predict where something lives, the IA is wrong.

---

## **2\. Canonical CAM Left Navigation (v1)**

`Dashboard`  
`Associations`  
`Units & Properties`  
`Violations`  
`ARC Requests`  
`Work Orders`  
`Vendors`  
`Documents & Records`  
`Accounting`  
`Governance`  
`Reports`

### **Non-Negotiable Rules**

* Order is fixed

* Items are hidden (not moved) based on permissions

* Badge counts only appear on:

  * Violations

  * ARC Requests

  * Work Orders

* No cross-pillar items appear here

---

## **3\. Domain → UX → Backend Alignment**

This is critical for AI agents, Cerbos, and audits.

| Nav Item | Primary Domain | Core Resource Types |
| ----- | ----- | ----- |
| Dashboard | Aggregation | activity\_event |
| Associations | Governance | association |
| Units & Properties | Asset | unit, property |
| Violations | Compliance | violation |
| ARC Requests | Governance | arc\_request |
| Work Orders | Maintenance | work\_order |
| Vendors | Vendor Mgmt | vendor |
| Documents & Records | Records | document |
| Accounting | Finance | assessment, invoice |
| Governance | Board Ops | meeting, motion |
| Reports | Analytics | report |

This table should be embedded in the CAM UX SRD.

---

## **4\. CAM Dashboard (IA-Level Definition)**

The dashboard is **not** a reporting surface.

### **Dashboard Sections (Fixed)**

1. **Requires Action**

   * Pending ARC approvals

   * Escalated violations

   * Overdue work orders

2. **Risk & Compliance**

   * Open violations by severity

   * Repeat offenders

3. **Financial Attention**

   * Overdue assessments

   * Budget exceptions

Every dashboard card must deep-link to a **split-view operational screen**.

---

## **5\. Cross-Cutting CAM UX Patterns (Locked In)**

These patterns apply to **every CAM domain**:

* Split-view list \+ detail

* Tabbed detail panels:

  * Overview

  * Documents

  * History / Audit

* Explicit decision buttons

* Mandatory rationale for governance actions

These patterns are *not optional*.

---

