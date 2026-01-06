# **System Requirements Document (SRD)**

## **Bun Runtime Migration & Container-Native Scaling**

**Version:** 1.0 (Roadmap-Enabling)  
 **Status:** Proposed  
 **Audience:** Platform Engineering, AI Software Agents, DevOps  
 **Scope:** Production runtime, build pipeline, and process model

---

## **1\. Purpose and Objectives**

### **1.1 Purpose**

This SRD defines the system requirements for migrating the backend runtime and operational model from:

* **Node.js \+ PM2 (cluster mode)**

to:

* **Bun (runtime \+ package manager)**

* **Docker Compose–native scaling (replicas)**

* **Single process per container**

The document exists to:

* Enable a **phased implementation roadmap**

* Eliminate ambiguous worker/connection semantics

* Improve failure signaling, health monitoring, and DB connection determinism

* Preserve durability, RLS correctness, and observability

---

### **1.2 Strategic Objectives**

The migration MUST:

1. Remove PM2 from the development, test and production control planes (i.e., no dependency on PM2 in any environment)

2. Adopt Bun as:

   * the package manager

   * the JavaScript/TypeScript runtime

3. Replace in-process clustering with **container-level replication**

4. Maintain deterministic Postgres connection budgets

5. Preserve DBOS durable execution semantics

6. Improve operational clarity and failure isolation

---

## **2\. In-Scope and Out-of-Scope**

### **2.1 In-Scope**

* Runtime execution model

* Package management

* Process supervision

* Container topology

* Prisma ORM v7 connection pooling

* DBOS worker lifecycle

* Health and readiness signaling

* Observability alignment (OTel)

### **2.2 Out-of-Scope**

* Database schema changes

* RLS policy redesign

* Introduction of PgBouncer

* Introduction of Kubernetes

* Functional changes to business workflows

* Frontend UX changes

---

## **3\. Current-State Summary (As-Is)**

### **3.1 Runtime & Process Model (As-Is)**

* PM2 in **cluster mode**

* Multiple OS processes per node

* In-process load balancing

* DBOS embedded per PM2 worker

* Prisma pool multiplied per worker

* Implicit and difficult-to-reason DB connection growth

### **3.2 Key Pain Points**

| Category | Problem |
| ----- | ----- |
| Scaling | Worker count implicitly multiplies DB connections |
| DBOS | Worker count tied to web concurrency |
| Health | PM2 hides container-level failures |
| Ops | Hard to reason about failure domains |
| Safety | Risk of retry storms and DB contention |
| Future | Incompatible with Bun-first runtime |

---

## **4\. Target-State Architecture (To-Be)**

### **4.1 High-Level Architecture**

**One process per container. One container per replica.**

* Runtime: **Bun**

* Scaling: **Docker Compose replicas**

* Load balancing: **Traefik**

* Process supervision: **Docker**

* Health signaling: **HTTP health endpoints \+ Docker healthcheck**

---

### **4.2 Target Runtime Model**

| Layer | Responsibility |
| ----- | ----- |
| Docker | Process supervision, restart |
| Compose | Replica scaling |
| Traefik | Traffic routing |
| Bun | Runtime \+ execution |
| SvelteKit | HTTP \+ SSR \+ API |
| Prisma v7 | ORM \+ DB access |
| DBOS | Durable orchestration |
| Postgres | Data \+ RLS |

---

## **5\. Functional Requirements**

### **FR-1: Runtime**

* The system SHALL run using **Bun** as the JavaScript/TypeScript runtime.

* The runtime SHALL not depend on Node.js in production.

### **FR-2: Package Management**

* The system SHALL use **Bun** as the package manager.

* `bun.lockb` SHALL be the authoritative lockfile.

### **FR-3: Process Model**

* The system SHALL run **exactly one application process per container**.

* No in-process clustering or worker management SHALL exist.

### **FR-4: Scaling**

* The system SHALL scale horizontally using **Docker Compose replicas**.

* Scaling SHALL NOT require code changes.

### **FR-5: DBOS Worker Semantics**

* Each container instance SHALL run **exactly one DBOS executor**.

* DBOS SHALL be initialized once per process.

* DBOS executor identity SHALL be deterministic per container.

### **FR-6: Prisma ORM v7 Pooling**

* Prisma SHALL use the **pg driver adapter**.

* Prisma connection pool max SHALL be explicitly configured per container.

* Default pool size SHALL be small and bounded.

### **FR-7: Health & Readiness**

* The system SHALL expose:

  * a liveness endpoint

  * a readiness endpoint

* Docker SHALL enforce health via `HEALTHCHECK`.

* Traefik SHALL route traffic only to healthy containers.

---

## **6\. Non-Functional Requirements**

### **NFR-1: Deterministic DB Connections**

Total Postgres connections SHALL be calculable as:

 `replicas × (Prisma_pool + DBOS_pool)`

*   
* No hidden or implicit connection growth is permitted.

### **NFR-2: Failure Isolation**

* Failure of one replica SHALL NOT impact others.

* Failure of the application process SHALL terminate the container.

### **NFR-3: Observability**

* OpenTelemetry SHALL continue to function without PM2.

* Logs SHALL be emitted to stdout/stderr.

* Metrics SHALL be exportable per container.

### **NFR-4: Rollback Safety**

* The migration SHALL support rollback to Node runtime if needed.

* Package manager migration SHALL be reversible independently of runtime.

---

## **7\. Configuration Requirements**

### **7.1 Runtime Configuration**

| Setting | Requirement |
| ----- | ----- |
| Bun version | Explicitly pinned |
| Entry command | `bun run start` |
| TS execution | Native (no ts-node) |

### **7.2 Prisma Configuration**

* Prisma v7 SHALL use `@prisma/adapter-pg`.

* Pool configuration SHALL be provided via `pg.Pool`.

* Pool max SHALL be configurable via environment variable.

### **7.3 DBOS Configuration**

* DBOS SHALL be configured via `DBOS.setConfig()`.

* DBOS system DB pool SHALL be explicitly bounded.

* DBOS SHALL NOT auto-scale with HTTP concurrency.

---

## **8\. Deployment & Operations Requirements**

### **8.1 Docker**

* App process SHALL be PID 1\.

* `restart: unless-stopped` SHALL be enabled.

* Healthcheck SHALL be configured.

### **8.2 Docker Compose**

* Replicas SHALL be adjustable without rebuild.

* Web and DBOS remain embedded in the same container (initially).

### **8.3 Traefik**

* Health-aware routing SHALL be enabled.

* Unhealthy containers SHALL be removed from rotation.

---

## **9\. Migration Constraints**

* Migration SHALL be phased.

* PM2 SHALL NOT coexist with Bun in production.

* PgBouncer SHALL NOT be introduced in this phase.

* Database behavior MUST remain identical.

---

## **10\. Acceptance Criteria**

The migration is considered successful when:

1. PM2 is completely removed from production

2. Application runs under Bun runtime in production

3. Scaling occurs via Compose replicas

4. DB connection counts are predictable and bounded

5. DBOS workflows function correctly

6. Health failures remove containers from traffic

7. Rollback path is validated

---

## **11\. Risks and Mitigations**

| Risk | Mitigation |
| ----- | ----- |
| Bun runtime incompatibility | Stage validation \+ rollback |
| DBOS behavior differences | Staging soak tests |
| Prisma pooling errors | Explicit pool config \+ metrics |
| Retry storms | Controlled DBOS pool \+ replica count |
| Observability gaps | OTel validation before cutover |

---

## **12\. Roadmap Enablement Notes**

This SRD intentionally supports:

* Delegation to AI developer agents

* Incremental rollout (pkg mgr → runtime → scaling)


---

## **13\. Summary**

This migration replaces **implicit, process-level scaling** with **explicit, container-level scaling**, aligns with Bun’s strengths, restores DB determinism, and simplifies operational reasoning—without introducing new infrastructure dependencies.

