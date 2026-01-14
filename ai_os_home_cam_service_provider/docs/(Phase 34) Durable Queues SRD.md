# **Systems Requirements Document**

## **Durable Queues & Scheduled Workflows in a Container-Native DBOS Architecture**

### **Status**

Draft

### **Audience**

Platform engineering, backend engineers, AI software engineering agents, DevOps

---

## **1\. Background Context**

### **1.1 Current Architectural Direction**

The platform is migrating to a **container-native execution model** with the following characteristics:

* **Bun** as both runtime and package manager

* **One application process per container**

* **Horizontal scaling via Docker Compose replicas** (e.g., 3 replicas)

* **No PM2** or in-process clustering

* **Postgres** as the shared durable store (including DBOS system tables)

* **DBOS embedded in each application container**

This model simplifies operational reasoning and makes failure domains explicit, but it changes how **background work and scheduled tasks** must be coordinated.

---

### **1.2 Problem Being Addressed**

In a multi-replica environment (e.g., 3 containers), the system must support:

* **Background workflows** that should be processed by *any available replica*

* **Scheduled (“cron-like”) tasks** that must run **exactly once per interval**, not once per replica

* **Fan-out workloads** (e.g., monthly reports per tenant, cleanup tasks per bucket)

* **Bounded concurrency** to protect Postgres, external APIs, and storage systems

Without explicit coordination, naïvely starting workflows leads to:

* Work being pinned to a single replica

* Uneven utilization of replicas

* Risk of duplicate execution for scheduled tasks

* Difficulty reasoning about throughput and retries

---

### **1.3 Key Examples Driving Requirements**

1. **Monthly reports**

   * Run once per month

   * Generate many per-tenant or per-property reports

   * Potentially DB-heavy and time-consuming

2. **Periodic cleanup jobs**

   * Example: cleaning up temporary files in SeaweedFS buckets

   * Run hourly or daily

   * May involve large object listings and deletes

   * Must tolerate retries and partial failures safely

---

## **2\. Goals**

The system must:

1. Allow **all replicas to participate** in background work execution

2. Ensure **scheduled jobs run exactly once per interval**, regardless of replica count

3. Support **fan-out workloads** with predictable concurrency

4. Preserve **durability and retry semantics** across crashes and restarts

5. Avoid introducing new infrastructure (e.g., external queues or cron services)

6. Keep behavior easy to reason about and observable

---

## **3\. Non-Goals**

This effort does **not** aim to:

* Introduce Kafka, RabbitMQ, or cloud queue services

* Introduce PgBouncer

* Split DBOS into a separate service (initially)

* Optimize for massive horizontal scale beyond a single node

* Redesign existing business workflows

---

## **4\. Conceptual Model**

### **4.1 DBOS Executors**

* Each container replica runs **one DBOS executor**

* All executors connect to the same Postgres system database

* Executors coordinate through durable state stored in Postgres

---

### **4.2 Durable Queues**

Durable queues provide:

* A **shared work pool** across all replicas

* Durable storage of queued tasks

* Safe concurrent consumption by multiple executors

* Retry and recovery on failure

In this model:

* All replicas poll the same queue(s)

* Idle executors pull available work

* Busy executors do not block others from making progress

---

### **4.3 Scheduled Workflows**

Scheduled workflows provide:

* Time-based triggers (cron-like schedules)

* **Exactly-once execution per interval**, even with multiple replicas

* A coordination mechanism to avoid duplicate runs

Scheduled workflows are **triggers**, not necessarily the place where heavy work should happen.

---

## **5\. Functional Requirements**

### **5.1 Durable Queue Requirements**

* The system must support **durable queues** backed by Postgres.

* Any container replica running DBOS must be able to:

  * enqueue tasks

  * dequeue and execute tasks

* Each queued task must be executed by **at most one executor at a time**.

* Tasks must be retried safely if an executor crashes mid-execution.

---

### **5.2 Work Distribution**

* Work enqueued to a queue must be distributable across all replicas.

* No assumption may be made that the replica that enqueued a task will execute it.

* Idle replicas must be able to pick up work started elsewhere.

---

### **5.3 Concurrency Control**

* Each queue must support **configurable concurrency limits**.

* Concurrency limits must be used to:

  * protect Postgres from overload

  * protect external systems (e.g., SeaweedFS, third-party APIs)

* Concurrency must be enforceable without relying on in-process locks.

---

### **5.4 Scheduled Task Requirements**

* The system must support **cron-style schedules**.

* A scheduled task must run **exactly once per interval**, regardless of replica count.

* Scheduled execution must be durable across:

  * container restarts

  * node restarts

  * transient database failures

---

### **5.5 Fan-Out Patterns**

* Scheduled workflows must be able to:

  * enumerate work units (e.g., tenants, buckets, partitions)

  * enqueue tasks into durable queues

* Fan-out must not require spawning one workflow per replica manually.

* Fan-out logic must be idempotent.

---

## **6\. Required Usage Patterns**

### **6.1 Direct Workflow Start vs Queue Usage**

* Direct workflow start:

  * May remain pinned to the initiating replica

  * Suitable for request-scoped, short-lived workflows

* Durable queues:

  * Must be used for:

    * background processing

    * burst workloads

    * scheduled fan-out jobs

    * maintenance and cleanup tasks

---

### **6.2 Scheduled Trigger Pattern**

The recommended pattern is:

1. **Scheduled workflow fires**

   * Runs exactly once per interval

2. **Scheduled workflow enumerates work**

   * Determines which units of work are needed

3. **Scheduled workflow enqueues tasks**

   * Writes tasks to one or more durable queues

4. **Executors consume tasks**

   * Any replica may execute any task

   * Concurrency limits apply

---

## **7\. Reliability & Failure Semantics**

### **7.1 Crash Recovery**

* If an executor crashes while processing a task:

  * The task must be retried or resumed according to DBOS semantics

* No task may be silently dropped

---

### **7.2 Idempotency**

* All queued tasks must be written so that:

  * re-execution does not corrupt state

  * duplicate execution (if it occurs) is safe

* Cleanup and reporting tasks must tolerate partial progress.

---

## **8\. Observability Requirements**

* Queue depth must be observable

* Task execution success/failure must be observable

* Scheduled executions must be observable (start time, completion time)

* Failures must be traceable to:

  * executor

  * queue

  * workflow/task identifier

---

## **9\. Operational Requirements**

* Adding or removing replicas must not:

  * cause duplicate scheduled executions

  * require redeployment of schedules

* Queue and schedule definitions must be deployable as code

* Behavior must be consistent across dev, staging, and prod

---

## **10\. Example Scenarios**

### **10.1 Monthly Reports**

* A scheduled workflow runs monthly.

* It identifies all tenants requiring reports.

* It enqueues one report task per tenant.

* Three replicas pull tasks from the queue and execute them concurrently.

* Concurrency is capped to avoid DB overload.

---

### **10.2 SeaweedFS Cleanup**

* A scheduled workflow runs hourly.

* It identifies candidate objects or prefixes.

* It enqueues cleanup tasks in batches.

* Replicas execute cleanup tasks with bounded concurrency.

* Failures retry without deleting incorrect data.

---

## **11\. Risks & Considerations**

* Poorly chosen concurrency limits can still overload Postgres.

* Fan-out logic must be carefully designed to avoid explosive queue growth.

* Scheduled workflows must be tested under replica count \> 1\.

* Observability must be validated early to detect stuck queues or retry storms.

---

## **12\. Summary**

In a container-native, multi-replica architecture:

* **Durable queues** are the mechanism that turns replicas into a shared worker pool.

* **Scheduled workflows** are the mechanism that safely replaces cron.

* Together, they provide controlled, observable, exactly-once background execution without additional infrastructure.

This model preserves simplicity while enabling robust background processing for reporting, cleanup, and other system-level tasks.

