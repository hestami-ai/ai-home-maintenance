# **Technical Architecture: CAM Platform (Vantaca Clone) \- Fractal-HVA Compatible**

## **Executive Summary**

This document maps the technology stack (Morphir, DBOS, SvelteKit, Django, Postgres) to the business domain. It is designed specifically to be **Fractal-HVA Compatible**, meaning it enforces strict operational guarantees (idempotency, atomicity, introspection, versioning) to support a future transition to fully automated, agentic feature development.

## **1\. The Technology Stack Map**

| Component | Technology | Role in CAM Domain |
| :---- | :---- | :---- |
| **Frontend Runtime** | **Bun** | **High-performance JS Runtime.** Replaces Node.js. Used to run SvelteKit, install packages, and execute build scripts. |
| **Frontend Framework** | **SvelteKit** | Reactive dashboards for Managers; lightweight portals for Homeowners. Consumes **Morphir-generated TypeScript types**. |
| **Backend API** | **Django REST Framework** | User Auth (RBAC), API endpoints. **Must enforce Idempotency keys AND API Versioning on all requests.** Consumes **Morphir-generated Python models**. |
| **Database** | **PostgreSQL** | ACID compliance. Stores state AND the **Transactional Outbox** (Events) in the same commit. |
| **Workflow Engine** | **DBOS (Python SDK)** | **The "Action Item" Engine.** guarantees **monotonic** state transitions and **durable** execution. Acts as the runtime for future DSL workflows. |
| **Business Logic & Schema** | **Morphir** | **The Source of Truth.** Defines Data Structures (Entities) and Business Rules. Generates code for both Backend (Python) and Frontend (TS). |
| **Infra** | **Docker Compose** | Orchestration of Django, DBOS workers, and DB. |

## **2\. Fractal-HVA Readiness Strategy**

To ensure the system can eventually be governed by the Fractal-HVA agent, we must implement the **Operational Guarantees** immediately, even though the DSL Engine is deferred.

### **A. Atomicity & Events (The Transactional Outbox)**

Fractal-HVA requires that *every* state change emits an event, and that this emission is atomic. We cannot rely on "Fire and Forget" to a message bus.

* **Pattern:** Transactional Outbox.  
* **Implementation:**  
  1. Django/DBOS opens a transaction.  
  2. Updates Assessment table (e.g., Mark Paid).  
  3. Inserts row into OutboxEvent table ({topic: "payment.posted", payload: {...}}).  
  4. Commits transaction.  
  5. A separate DBOS background worker reads OutboxEvent and pushes to external consumers (if any).  
* **Benefit:** Zero lost events. Perfect history for future agents to analyze.

### **B. Idempotency (The "Safety Valve")**

Fractal-HVA agents may retry operations aggressively. The API must be safe to retry.

* **Requirement:** All POST/PUT/PATCH endpoints **MUST** accept Idempotency-Key header.  
* **Mechanism:**  
  * Middleware checks Redis/DB for the key.  
  * If key exists \-\> Return stored response (do not re-execute logic).  
  * If key is new \-\> Execute \-\> Store response \-\> Return.

### **C. API Versioning (The Evolution Guarantee)**

Fractal-HVA agents need to deploy new logic (v2) without breaking existing clients (v1).

* **Requirement:** Strict semantic versioning for all endpoints.  
* **Mechanism:** **Header-Based Versioning** (e.g., Accept: application/vnd.cam.v1+json).  
* **Benefit:** Ensures **Determinism**. Replaying a request from 2023 against the v1 API guarantees the same result, even if the business rules in v2 have changed.

### **D. Workflow Introspectability (DBOS)**

Future agents need to "see" what workflows exist.

* **Current State:** Workflows are Python code decorated with @workflow.  
* **Forward Compatibility:** We will expose a metadata endpoint (e.g., GET /meta/workflows) that inspects the registered DBOS handles and returns their signatures. This satisfies the "Introspectability" principle without a full DSL engine.

## **3\. Deep Dive: Implementation Strategy**

### **A. The "Action Item" Engine (DBOS)**

* **Domain Requirement:** Violation Escalation (Courtesy Notice \-\> 14 Days \-\> Fine).  
* **HVA Alignment:** DBOS provides the **Determinism** and **Monotonicity** required by the system prompt. It ensures workflow states advance only via defined transitions.  
* **Implementation:**  
  * Python functions with @dbos.workflow.  
  * dbos.sleep(14 days) for timing.

### **B. The Financial Core (Morphir Rules)**

* **Domain Requirement:** Fund Accounting Logic.  
* **HVA Alignment:** **Separation of Concerns.** Domain logic is separated from infrastructure.  
* **Implementation:**  
  * Logic defined in Morphir SDK.  
  * Transpiled to Python classes.  
  * These classes act as the "Black Box" logic evaluator that the future DSL engine would eventually wrap.

### **C. The Polyglot Domain Model (Morphir Schemas)**

* **Domain Requirement:** A WorkOrder must have the same structure in the UI, API, and DB.  
* **HVA Alignment:** **Single Source of Truth.** The Schema is defined in the DSL (Morphir), not the implementation.  
* **Implementation:**  
  * **Define:** type WorkOrder \= { id: UUID, status: Status, description: String } in Morphir.  
  * **Generate (Build Time via Bun):**  
    * frontend/src/types/WorkOrder.ts (TypeScript Interface).  
    * backend/domain/models/work\_order.py (Python Dataclass/Pydantic).  
  * **Result:** If you change the Model in Morphir, the build fails until both Frontend and Backend are updated, preventing "Schema Drift."

## **4\. Architecture Diagram (Updated)**

graph TD  
    subgraph "Design Time"  
        MorphirDef\[Morphir Definitions\]  
    end

    subgraph "Build Pipeline (Run by Bun)"  
        GenTS\[Generate TypeScript\]  
        GenPy\[Generate Python\]  
    end

    subgraph "Frontend Container (Bun Runtime)"  
        Svelte\[SvelteKit App\]  
        Types\[Shared TS Interfaces\]  
    end

    subgraph "API Layer (Django)"  
        Middleware\[Idempotency & Versioning\]  
        Endpoints\[REST Endpoints\]  
        PyModels\[Shared Python Models\]  
    end

    subgraph "Core Logic (Fractal Compatible)"  
        DBOS\[DBOS Workflow Engine\]  
    end

    subgraph "Persistence (Postgres)"  
        Tables\[Domain Tables\]  
        Outbox\[Outbox Events Table\]  
    end

    MorphirDef \--\> GenTS  
    MorphirDef \--\> GenPy  
      
    GenTS \--\> Types  
    GenPy \--\> PyModels  
      
    Types \-.-\>|Type Check| Svelte  
    PyModels \-.-\>|Import| Endpoints  
    PyModels \-.-\>|Import| DBOS

    Svelte \--\>|Idempotency \+ Version Header| Middleware  
    Middleware \--\> Endpoints  
    Endpoints \--\>|Trigger| DBOS  
      
    DBOS \--\>|Atomic Commit| Tables  
    DBOS \--\>|Atomic Commit| Outbox

## **5\. Migration Path to Full Fractal-HVA**

The system is designed to evolve into the full "Meta-Governed" state requested:

1. **Phase 1 (Current Scope):**  
   * **Logic:** Hardcoded in Morphir/Python.  
   * **Governance:** Code Review (Git).  
   * **Safety:** Idempotency Keys \+ Outbox Pattern \+ API Versioning.  
2. **Phase 2 (Future Scope):**  
   * **Logic:** Moved to Runtime DSL (stored in DB).  
   * **Governance:** POST /dsl/proposals API.  
   * **Safety:** The existing Idempotency/Outbox infrastructure remains unchanged; only the "Calculator" (Morphir) is swapped for a dynamic "Interpreter."

## **6\. Verdict**

This architecture meets the immediate business needs of a Vantaca clone (Robust Workflow, Fund Accounting) while adhering to the strict **Operational Guarantees** (Idempotency, Atomicity, Event Sourcing, API Versioning) required to support a future **Fractal-HVA** backend agent.