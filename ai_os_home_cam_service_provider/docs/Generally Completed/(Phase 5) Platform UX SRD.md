# **\============================================================**

# **📘 Hestami AI OS — Platform UX SRD (v1.0)**

## **Document Purpose**

This document defines the **platform-level user experience architecture** for the Hestami AI Operating System.

It governs:

* User identity and registration

* Organization creation and joining

* Role and authority establishment

* Onboarding flows for all pillars

* Organization context switching

* Platform navigation and scope clarity

* Cross-pillar UX consistency

* Audit and trust implications of UX actions

This SRD sits **above**:

* Phase 1 — CAM

* Phase 2 — Contractor Operations

* Phase 3 — Concierge

* Phase 4 — Activity & Audit

All pillar UIs MUST conform to the principles and requirements defined here.

---

---

## Key Technologies for the Frontend
* Sveltekit
* Skeleton UI Framework with dark and light mode theme switching
* Superforms for form handling and validation
* SvelteKit's built-in routing and layout system
* SvelteKit's server-side rendering preferred and API routes
* Flowbite Svelte for UI components
* Lucide icons for Svelte

## **0\. EXECUTIVE SUMMARY**

---

Hestami is not a single application.  
 It is a **multi-tenant, multi-role operating system** composed of three functional pillars sharing a common trust, identity, and workflow spine.

The Platform UX exists to answer, at all times:

1. **Who am I?** (identity)

2. **Who am I acting as?** (organization scope)

3. **What authority do I have?** (role \+ policy)

4. **What am I here to do?** (pillar intent)

If the UX fails to answer any of these clearly, the platform becomes unsafe, confusing, and unscalable.

---

---

## **1\. CORE UX PRINCIPLES (PLATFORM LEVEL)**

---

### **1.1 Identity ≠ Authority**

* User registration creates **identity only**

* Authority is granted **only** via organization membership

* UX MUST never imply authority that has not been explicitly granted

---

### **1.2 Organization Scope Is Always Explicit**

* Every meaningful screen MUST make the active organization obvious

* No silent scope switching

* No cross-org data blending

* AI agents inherit the same scope rules as humans

---

### **1.3 Entry Determines Experience**

Hestami users do not “land on a dashboard.”

They enter through **intent-based onboarding paths** that determine:

* Which pillar they see first

* Which navigation is available

* Which workflows are emphasized

---

### **1.4 Navigation Is a Consequence, Not a Choice**

Navigation structure is derived from:

* Organization type

* User role

* Cerbos policy outcomes

The UX MUST NOT allow users to “discover” unauthorized features through exploration.

---

---

## **2\. PLATFORM STORYBOARD UNITS**

---

The platform UX is composed of **five canonical storyboard units**.

These exist regardless of pillar.

1. User Registration (Identity)

2. Entry Vector Selection

3. Organization Creation / Joining

4. Role & Authority Confirmation

5. Organization Context Switching

Every user journey through Hestami is a composition of these units.

---

---

## **3\. USER REGISTRATION (IDENTITY ONLY)**

---

### **Purpose**

Create a **person**, not a tenant, admin, or operator.

---

### **Requirements**

* Email \+ password or SSO

* Email verification required

* Minimal profile only (name, locale)

---

### **UX Constraints**

* No dashboards

* No data access

* No assumptions about intent

---

### **Outcome**

* User exists

* No organization

* No permissions

* Immediately routed to Entry Vector Selection

---

---

## **4\. ENTRY VECTOR SELECTION (PLATFORM FORK)**

---

### **Purpose**

Determine **why the user is here**, before granting any authority.

---

### **Canonical Entry Options**

Displayed in plain, non-jargon language:

1. **I own a property**

2. **I manage a community / HOA**

3. **I run a service or contracting business**

4. **I was invited to join an organization**

This screen:

* Is mandatory

* Is not skippable

* May be revisited later to add roles

---

### **UX Rule**

The platform MUST NOT guess user intent.

---

---

## **5\. ORGANIZATION CREATION & JOINING**

---

### **5.1 Property Owner Onboarding (Phase 3\)**

**Intent:** Personal or portfolio property management

Requirements:

* Create Owner Organization (individual or entity)

* Register at least one property

* Optional HOA linkage or document upload

* Preference capture (concierge vs DIY)

Outcome:

* User gains OWNER role

* Lands in Concierge context

* CAM and Contractor navigation hidden

---

### **5.2 HOA / Community Onboarding (Phase 1\)**

**Intent:** Governance and shared asset management

Requirements:

* Create Association Organization

* Governance structure definition

* Initial data seeding (units, docs)

* Role assignment (board, staff)

Outcome:

* User gains ADMIN / MANAGER role

* Lands in CAM dashboard

* Concierge and Contractor tools hidden unless linked

---

### **5.3 Service Provider Onboarding (Phase 2\)**

**Intent:** Operational business management

Requirements:

* Create Service Provider Organization

* Compliance intake

* Operational setup (pricebook, workforce)

Outcome:

* User gains OWNER / ADMIN role

* Lands in Contractor Ops dashboard

* CAM governance hidden unless explicitly linked

---

### **5.4 Invitation-Based Joining (Cross-Cutting)**

Requirements:

* Invitation must specify:

  * Organization

  * Role

* User must explicitly accept

Outcome:

* Authority granted only as invited

* No onboarding unless required by role

---

---

## **6\. ROLE & AUTHORITY CONFIRMATION**

---

### **Purpose**

Make authority **visible and unambiguous**.

---

### **UX Requirements**

* Role clearly displayed (e.g., Board Member, Concierge Staff)

* Scope limitations explained where relevant

* Delegated authority explicitly labeled

---

### **Safety Rule**

The UX must never imply that a user “can probably do this.”

All authority must be explicit and policy-backed.

---

---

## **7\. ORGANIZATION CONTEXT SWITCHING**

---

### **Purpose**

Support multi-organization users safely.

---

### **UX Requirements**

* Persistent organization switcher

* Active organization always visible

* Confirmation required when switching

* Context reset on switch

---

### **Non-Negotiable Rule**

No screen may contain data from more than one organization context.

---

---

## **8\. PLATFORM NAVIGATION MODEL**

---

### **Principles**

* Navigation is organization-scoped

* Modules appear only if relevant

* Permissions hide items, not reorder them

* Empty states explain *why* something is unavailable

---

### **Navigation Behavior**

| Org Type | Default Pillar |
| ----- | ----- |
| Property Owner | Concierge |
| HOA / Association | CAM |
| Service Provider | Contractor Ops |

Cross-pillar navigation only appears when explicit relationships exist.

---

---

## **9\. PLATFORM-LEVEL AUDIT & TRUST REQUIREMENTS**

---

The following UX actions MUST produce audit events (Phase 4):

* Organization creation

* Role assignment

* Invitation acceptance

* Context switching

* Authority delegation

UX flows MUST make users aware when they are performing authority-granting actions.

---

---

## **10\. AI AGENT COMPATIBILITY**

---

Platform UX must be intelligible to AI agents:

* Entry vectors map to intent classification

* Organization scope is explicit and machine-readable

* Role context is visible and enforceable

* All actions are auditable

AI agents follow the same UX rules programmatically.

---

---

## **11\. WHAT THIS SRD ENABLES**

---

With this Platform UX SRD in place:

* Pillars feel purpose-built, not bolted together

* Onboarding scales without confusion

* Authority is defensible

* Audit trails are clean

* AI integration becomes safe and predictable

---

---

## **12\. SUMMARY**

---

The Hestami Platform UX is not about polish.  
 It is about **clarity, authority, and trust**.

This SRD defines the **contract between users, the platform, and future AI agents**.

All Phase 1–4 UI designs MUST conform to it.

