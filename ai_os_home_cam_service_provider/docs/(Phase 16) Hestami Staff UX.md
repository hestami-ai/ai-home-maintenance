# **Hestami AI OS**

## **Staff UX – Consolidated System Requirements Document (SRD)**

**Document Type:** Internal UX / Operations SRD  
 **Audience:** Product, Engineering, AI Developer Agents, Operations Leadership  
 **Scope:** Staff-facing UX across all pillars  
 **Status:** Phase 1 (Human-heavy execution, AI-assisted extraction)

---

## **1\. Purpose & Scope**

### **1.1 Purpose**

This document defines the **Staff User Experience (UX)** for the Hestami AI OS platform.

The Staff UX is the **internal operating system** through which Hestami personnel:

* Coordinate Concierge services

* Manage CAM and governance workflows

* Perform vendor discovery and onboarding

* Maintain institutional memory

* Move cases forward reliably and audibly

The goal is to ensure:

* Operational consistency

* Auditability

* Scalability

* Future automation compatibility

---

### **1.2 Out of Scope**

This document does **not** define:

* Customer-facing UX

* Visual design system

* API schemas

* AI agent implementation details

---

## **2\. Design Principles**

1. **Case-Centric Operations**  
    All staff work is performed within the context of a Case.

2. **Human-in-Control, System-Governed**  
    Humans perform actions; the system enforces structure.

3. **Explicit State, No Implicit Progress**  
    Work only advances through defined states.

4. **Messy Inputs → Structured Outputs**  
    The UX must absorb unstructured reality and produce clean data.

5. **Automation-Neutral UX**  
    The UX does not change when automation replaces human steps.

---

## **3\. Staff Personas (Logical Roles)**

Note: One human may assume multiple roles.

### **3.1 Concierge Operator**

* Manages property issue resolution

* Performs vendor discovery

* Coordinates bids and execution

### **3.2 Operations Coordinator**

* Oversees case queues

* Handles escalations and SLA risks

* Ensures cross-pillar consistency

### **3.3 CAM / Governance Specialist**

* Manages HOA governance workflows

* Ensures compliance with governing documents

### **3.4 Vendor Liaison**

* Manages vendor entities

* Oversees credentials and performance

### **3.5 Platform Administrator**

* System configuration

* Permissions and access control

---

## **4\. Core UX Architecture**

### **4.1 Global Navigation (Staff)**

Persistent left navigation:

1. Work Queue

2. Cases

3. Concierge Operations

4. CAM / Governance

5. Vendors

6. Customers & Properties

7. Documents & Evidence

8. Activity & Audit

9. System Tools

---

## **5\. The Case Model (Platform Backbone)**

### **5.1 Definition**

A **Case** is the atomic unit of work in Hestami AI OS.

Examples:

* Concierge repair request

* Vendor onboarding

* HOA violation

* Governance meeting cycle

---

### **5.2 Canonical Case States**

All Cases move through a subset of the following states:

1. **Created**

2. **Triage**

3. **Context Assembly**

4. **Plan / Scope Definition**

5. **Execution Preparation**

6. **Execution In Progress**

7. **Decision / Approval**

8. **Completion**

9. **Review & Record**

10. **Closed**

---

### **5.3 Exception States (Overlay)**

* Blocked

* Escalated

* Paused

* Reopened

Exception states annotate—not replace—primary states.

---

## **6\. Work Queue UX**

### **6.1 Purpose**

The Work Queue is the **default landing page** for staff.

It answers:

“What needs attention right now?”

---

### **6.2 Work Queue Requirements**

Each item must display:

* Case ID

* Case type

* Property / HOA

* Current state

* Time in state

* Required action (explicit)

* Priority / SLA indicator

Filtering:

* By pillar

* By state

* By assigned operator

* By urgency

---

## **7\. Case Detail UX**

### **7.1 Standard Case Layout**

**Header**

* Case ID

* Case type

* Current state

* Assigned staff

* SLA indicators

**Tabs**

1. Overview

2. Context

3. Scope

4. Tasks

5. Vendors

6. Bids

7. Communications

8. Timeline

9. Review

10. Audit

---

## **8\. Concierge Operations UX**

### **8.1 Concierge Case Lifecycle Mapping**

| Case State | Concierge Meaning |
| ----- | ----- |
| Created | Customer submits issue |
| Triage | Staff interprets problem |
| Context Assembly | Property & issue validated |
| Scope Definition | Scope of work defined |
| Execution Prep | Vendor discovery & outreach |
| Execution | Bidding / work execution |
| Decision | Customer selects option |
| Completion | Work completed |
| Review | Vendor & outcome recorded |
| Closed | Case archived |

---

## **9\. Vendor Discovery & Research UX (Human-Heavy)**

### **9.1 Purpose**

To convert unstructured internet research into structured vendor entities that:

* Are reusable

* Are auditable

* Improve over time

---

### **9.2 Vendor Research Workspace**

#### **Context Header (Persistent)**

* Case ID

* Property summary

* Required service category

* Coverage location

* Constraints

---

### **9.3 Vendor Capture Form**

**Required Inputs**

1. Source URL

2. HTML Paste Field (raw HTML)

3. Plain Text Paste Field (fallback)

Rules:

* Any combination accepted

* Submission never blocked due to incomplete inputs

Primary Action:  
 **Extract Vendor Information**

---

### **9.4 Extraction Workflow**

1. Submission enters **Extraction Pending**

2. Backend service processes inputs

3. Extracted fields populated with confidence scores

---

### **9.5 Extraction Results & Confirmation**

**Two-Column Layout**

Left:

* Extracted structured fields (editable)

* Confidence indicators

Right:

* Source evidence viewer

* Highlighted extraction evidence

Staff Actions:

* Accept

* Edit

* Remove

* Annotate

Primary CTA:  
 **Confirm Vendor Candidate**

---

### **9.6 Vendor Candidate Entity**

Upon confirmation:

* Vendor Candidate created

* Linked to Case

* Provenance stored (URL, timestamp)

* Status set to *Identified*

Rule:

Vendors must never exist only as URLs.

---

### **9.7 Error Handling**

* Extraction failure → manual entry allowed

* Multiple vendors detected → selection required

* Duplicate vendor detected → merge or override decision

---

## **10\. Bid Coordination UX**

### **10.1 Bid Management**

For each vendor:

* Scope version attached

* Response deadline set

* Required attachments listed

Staff track:

* Outreach attempts

* Missing responses

* Clarifications

Incomplete bids are flagged automatically.

---

## **11\. Decision Preparation UX**

### **11.1 Decision Summary**

Staff prepare:

* Side-by-side bid comparison

* Normalized pricing

* Key differences

* Recommendation with rationale

This artifact is customer-facing.

---

## **12\. Execution Tracking UX**

### **12.1 Timeline View**

Displays:

* Milestones

* Notes

* Issues

* Status changes

Staff intervene only when exceptions occur.

---

## **13\. Review & Record UX**

### **13.1 Post-Completion Review**

Staff capture:

* Outcome summary

* Vendor performance notes

* Issues encountered

* Reusability flags

This feeds future cases.

---

## **14\. Vendor Management UX**

### **14.1 Vendor Profile (Internal)**

Includes:

* Contact info

* Service categories

* Coverage area

* Credentials

* Past cases

* Performance notes

* Risk flags

Vendors may exist without platform accounts.

---

## **15\. Communications UX**

### **15.1 Unified Communication Log**

* Email, SMS, portal messages

* Internal notes vs. external messages

* All communications tied to a Case

No off-platform communication is authoritative.

---

## **16\. Documents & Evidence**

All artifacts:

* Are versioned

* Are timestamped

* Are linked to Cases

* Are immutable post-close

---

## **17\. Activity & Audit**

Every action logs:

* Actor

* Action

* Timestamp

* Context

* Optional rationale

This supports:

* Governance

* Dispute resolution

* Compliance

* Training data

---

## **18\. Automation Compatibility**

This UX supports:

* Human execution today

* AI execution tomorrow

* Hybrid workflows indefinitely

Automation replaces **actors**, not **flows**.

---

## **19\. Success Criteria**

The Staff UX is successful if:

* No work happens outside Cases

* Staff always know what to do next

* Institutional knowledge compounds

* Customers experience seamless service

* Automation can increase without UX redesign

# **21\. Staff Management & Lifecycle UX**

## **21.1 Purpose**

Define the UX and system behavior for:

* Adding Hestami staff

* Assigning roles and permissions

* Managing active staff assignments

* Deactivating or removing staff

* Preserving auditability and operational continuity

---

## **21.2 Staff Entity Model (Conceptual)**

Each staff member is represented as a **Staff Entity** with:

* Unique staff ID

* Name and contact details

* Role(s)

* Pillar access permissions

* Status (Active, Suspended, Deactivated)

* Assignment history

* Activity history

Staff entities persist indefinitely for audit purposes.

---

## **21.3 Add / Onboard Staff UX**

### **Entry Point**

**System Tools → Staff Management**

### **Add Staff Flow**

1. Admin selects **“Add Staff Member”**

2. Admin enters:

   * Name

   * Email

   * Initial role(s)

   * Pillar access

3. System:

   * Creates Staff Entity

   * Issues secure invitation

   * Sets status \= *Pending Activation*

No case assignments allowed until activation is complete.

---

## **21.4 Role & Permission Management UX**

Admins can:

* Assign multiple roles to a staff member

* Grant or revoke pillar access

* Set case assignment eligibility

Permission changes:

* Take effect immediately

* Are logged in Activity & Audit

* Do not retroactively alter past actions

---

## **21.5 Staff Assignment UX (Case-Level)**

Within a Case:

* Staff can be:

  * Assigned as primary owner

  * Added as collaborators

* Assignment changes:

  * Require justification (optional)

  * Are time-stamped

  * Appear in case timeline

---

## **21.6 Deactivation & Removal UX (Critical)**

### **Deactivation (Preferred)**

Use when staff leave or change roles.

**Behavior:**

* Staff status set to *Deactivated*

* Login disabled immediately

* All active case assignments flagged

### **Required Admin Actions on Deactivation**

Before finalizing:

* System presents:

  * List of active cases

  * Pending tasks

* Admin must:

  * Reassign cases

  * Acknowledge responsibility transfer

No case may remain assigned to a deactivated staff member.

---

### **Emergency Suspension**

Used for:

* Security incidents

* Policy violations

**Behavior:**

* Immediate access revocation

* Cases auto-escalated to Operations Coordinator

* Admin review required within defined SLA

---

## **21.7 Audit & Compliance Requirements**

All staff lifecycle events must be logged:

* Creation

* Role changes

* Assignment changes

* Deactivation

* Suspension

Audit logs are immutable.

---

## **21.8 Automation Compatibility**

As AI agents assume staff-like roles:

* Agents may be modeled as Staff Entities

* With restricted permissions

* And explicit scopes of action

This allows:

* Mixed human/agent teams

* Unified auditing

* Gradual transition

---

## **22\. Impact on Existing UX**

This addition:

* Does **not** alter Case UX

* Does **not** alter Concierge UX

* Improves operational safety

* Prepares for scaling staff and automation

