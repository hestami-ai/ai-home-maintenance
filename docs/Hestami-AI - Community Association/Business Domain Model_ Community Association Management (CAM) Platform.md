# **Business Domain Model: Community Association Management (CAM) Platform**

## **Executive Summary**

This document outlines the domain model for a SaaS platform designed to compete with Vantaca. The core philosophy of this model revolves around **Association-Centricity** (each HOA is a distinct legal entity), **Fund Accounting** (strict separation of operating and reserve monies), and **Workflow Automation** (turning every business process into a trackable "Action Item").

## **1\. High-Level Entity Relationship Diagram (Mermaid)**

classDiagram  
    class ManagementCompany {  
        \+String name  
        \+Settings globalSettings  
    }  
    class Association {  
        \+String name  
        \+String taxId  
        \+String fiscalYearEnd  
    }  
    class Unit {  
        \+String address  
        \+String accountNumber  
    }  
    class Homeowner {  
        \+String firstName  
        \+String lastName  
        \+Boolean isBoardMember  
    }  
    class Ledger {  
        \+Decimal balance  
    }  
    class ActionItem {  
        \+String type  
        \+String currentStep  
        \+Date followUpDate  
    }  
    class Vendor {  
        \+String companyName  
        \+Boolean insuranceVerified  
    }  
    class BankAccount {  
        \+String accountNumber  
        \+Enum type (Operating, Reserve)  
    }

    ManagementCompany "1" \-- "\*" Association : manages  
    Association "1" \-- "\*" Unit : contains  
    Unit "1" \-- "\*" Homeowner : owns  
    Unit "1" \-- "1" Ledger : tracks\_debt  
    Association "1" \-- "\*" BankAccount : holds  
    Association "1" \-- "\*" Vendor : employs  
    Unit "1" \-- "\*" ActionItem : relates\_to  
    ActionItem "\*" \-- "1" Homeowner : assigned\_to

## **2\. Core Domains & Entity Definitions**

### **A. Organizational Hierarchy**

The structure must support a "Portfolio" view for managers handling multiple HOAs.

* **Management Company:** The SaaS tenant. The entity licensing the software.
  * *Note:* For **self-managed HOAs**, the Association itself acts as its own Management Company (a 1:1 relationship). The platform must support this use case where Board Members perform all management functions without a third-party management company.  
* **Portfolio:** A logical grouping of Associations assigned to a specific Community Manager.  
* **Association (HOA/COA):** The legal entity. Contains specific configuration for bylaws, late fees, and fiscal years.  
* **Phase/Neighborhood:** Sub-groups within an Association (often used for specific assessment rules).  
* **Unit (Property):** The physical asset. It has a unique account number and address.  
* **Resident:** The human element.  
  * *Sub-types:* Owner, Tenant, Previous Owner.  
  * *Attributes:* Contact preferences, Portal Access, Board Member Status.

### **B. Financial Domain (Fund Accounting)**

This is the most complex and critical differentiator. Unlike standard business accounting (QuickBooks), CAM requires Fund Accounting.

* **Fund:** Represents the "color of money."  
  * *Examples:* Operating Fund, Reserve Fund, Deferred Maintenance Fund.  
* **General Ledger (GL) Account:** Standard chart of accounts, but *must* be scoped to an Association.  
* **GL Entry:** A double-entry record linked to a GL Account, Association, and Fund.  
* **Bank Account:**  
  * Must allow **integration** (Transaction downloads, Lockbox files).  
  * Must support "Smart Transfers" (Moving money between Operating and Reserve).  
* **Budget:**  
  * Defined per Association, per Fiscal Year, per GL Account.

### **C. Accounts Receivable (AR) \- "The Assessment Engine"**

Automating the collection of dues.

* **Charge Type:** (e.g., Monthly Assessment, Special Assessment, Violation Fine).  
* **Owner Ledger:** The balance sheet for a specific unit.  
* **Assessment Rule:** Logic that defines how much to charge, how often, and to whom.  
  * *Logic:* "Charge $150 on the 1st of every month to all Units in Phase 1."  
* **Lockbox File:** An entity representing a batch of payments received from a bank integration.  
* **Delinquency Process:** A state machine for debt collection.  
  * *States:* Reminder \-\> Late Letter \-\> Intent to Lien \-\> Attorney Turnover.

### **D. Accounts Payable (AP)**

Paying vendors and managing approvals.

* **Vendor:** The service provider.  
  * *Attributes:* 1099 Status, Insurance Expiration Date (Crucial for liability).  
* **Invoice:** A bill received.  
  * *Lifecycle:* Received \-\> Data Entry \-\> Board Approval \-\> Manager Approval \-\> Ready for Check \-\> Paid.  
* **Payment:** The actual Check or ACH.

### **E. CCR (Covenants, Conditions, & Restrictions)**

Enforcing rules and managing property modifications.

* **Violation:** A breach of community rules.  
  * *Attributes:* Type (e.g., "Trash Cans"), Severity, Photo Proof, Status (Open/Closed).  
  * *Escalation Path:* Courtesy Notice \-\> 1st Fine \-\> 2nd Fine \-\> Hearing.  
* **ARC Request (Architectural Review):** A request by an owner to modify their home (e.g., "Install a Fence").  
  * *Attributes:* Dimensions, Contractor Info, Board Vote Status (Approve/Deny/Conditionally Approve).

### **F. Maintenance (Work Orders)**

* **Asset:** Physical items owned by the HOA (e.g., "Clubhouse Pool Pump", "Main Gate").  
* **Work Order:** A request for service.  
  * *Relationships:* Linked to Vendor (who fixes it), Association (who pays), and Unit (if applicable).

## **3\. The "Vantaca" Differentiator: The Action Item Engine**

Vantaca’s primary strength is that **everything** is an "Action Item." This acts as a wrapper around the domain entities above to drive workflow.

### **The Action Item Entity**

* **ID:** Unique Identifier.  
* **Type:** (e.g., "Invoice Approval", "Violation processing", "Homeowner Question").  
* **Linked Object:** Polymorphic association to (Invoice, Violation, Unit, etc.).  
* **Current Step:** Where is it? (e.g., "Manager Review").  
* **Role Assignment:** Who controls it now? (e.g., "Board Member").  
* **Transition Logic:**  
  * *Trigger:* "If status stays in 'Manager Review' for \> 3 days..."  
  * *Action:* "...Auto-escalate to Regional Manager."

### **The Message Entity**

Communication is tightly coupled with Action Items.

* **Message:** Email, SMS, or Portal Note.  
* **Direction:** Inbound/Outbound.  
* **Attachment:** Photos, PDFs.  
* *Constraint:* Every message must be attached to an Action Item or Unit.

## **4\. Portals & Permissions Model (RBAC)**

The system requires three distinct views into the data:

1. **Manager Portal (Internal):** Full access to GL, AP, AR, and processing engines.  
2. **Board Portal (Read-Heavy/Approval-Light):**  
   * View Financial Reports (Balance Sheet, Income Statement).  
   * Approve Invoices.  
   * Vote on ARC Requests.  
   * *Cannot* edit GL entries or sensitive homeowner data.  
3. **Homeowner Portal:**  
   * Make Payments.  
   * View Ledger History.  
   * Submit ARC Requests / Work Orders.  
   * View Violation Photos.

## **5\. Implementation Roadmap (MVP Priorities)**

To build this product, prioritize the domains in this order:

1. **The General Ledger (Foundation):** You cannot manage an HOA without a rock-solid, fund-accounting GL.  
2. **The Unit/Owner Database:** The source of truth for who owes money.  
3. **AR/Billing:** The ability to generate revenue (charges) and accept payments.  
4. **The Workflow Engine:** The ability to route tasks between Managers and Boards.  
5. **AP/Banking:** Paying bills and reconciling banks.  
6. **Violations/ARC:** The operational layer.