# Infrastructure and Ops - System Requirements

## 1. Core Principles
- **Container-Native Scaling:** One application process per container using Bun. No PM2 in-process clustering. Scale via Docker Compose replicas (`instances=3`).
- **Single Process Topology:** Each container runs EXACTLY one SvelteKit server, one Prisma instance, and one DBOS executor.
- **Deterministic Connections:** Postgres connections are bounded and explicitly configured per container: Total Connections = `replicas × (PRISMA_POOL_MAX + DBOS_POOL_MAX)`.
- **Durable Coordination:** Stateful workflows and background jobs coordinate via Postgres, avoiding in-memory state or single-point-of-failure timers.

## 2. Runtime & Process Model (Bun Migration)
- **Runtime & Package Manager:** Bun (`bun.lockb` is authoritative).
- **Process Guard:** A single-responsibility initialization module runs BEFORE the server starts to guarantee `DBOS.launch()` is called exactly once.
- **Executor Identity:** The DBOS `executorID` is dynamically assigned based on the container instance index.
- **Pooling (Prisma v7):** Prisma uses `@prisma/adapter-pg` with a `pg.Pool` bounded by `PRISMA_POOL_MAX` (default 3). 
- **Pooling (DBOS):** DBOS system DB uses a distinct pool bounded by `DBOS_POOL_MAX` (default 3).

## 3. RLS Connection Pooling & Transaction Purity
- **The RLS/Prisma Race Condition:** Setting a Postgres session variable (`set_current_org_id`) on one pooled connection does NOT guarantee the next `prisma.findMany` query will use that same connection.
- **Defense in Depth (Tier 1):** ALL `SELECT`/`UPDATE`/`DELETE` queries must include an explicit `organizationId: currentOrgId` filter in the Prisma `WHERE` clause, regardless of RLS state.
- **Transactional Consistency (Tier 2):** When using RLS, the context injection AND the business logic must execute within the SAME interactive transaction:
  ```typescript
  await DBOS.runStep(() => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_current_org_id(${orgId})`;
    const result = await handler(tx);
    return result;
  }));
  ```

## 4. Work Execution: Durable Queues & Scheduled Tasks
- **The Problem:** In a multi-replica environment, `cron` jobs fire multiple times, and heavy background tasks overwhelm a single replica.
- **Durable Queues:** Background workloads (e.g., report generation, SeaweedFS cleanup) MUST be enqueued into Postgres-backed DBOS queues. Replicas act as concurrent workers pulling from these queues.
- **Scheduled Workflows:** Used strictly as *triggers*. A scheduled DBOS workflow runs exactly once per interval, enumerates work, and fan-outs tasks into durable queues for worker replicas to consume concurrently.
- **Concurrency Control:** Queue concurrency limits are strictly enforced to protect Postgres and external APIs.

## 5. Observability (OpenTelemetry)
- **Initialization:** Auto-instrumentation (e.g., Prisma, HTTP) must be registered in a Bun `--preload` script BEFORE application code loads. DO NOT use SvelteKit hooks for OTel setup.
- **Span Enhancement Policy:**
  - oRPC Calls: Must include `rpc.method` and `rpc.service`.
  - Auth/Cerbos: Must record `cerbos.action`, `cerbos.resource`, `cerbos.decision`.
  - Workflows: Must include `workflow.id` and `workflow.name`.
  - Errors: `setStatus({ code: SpanStatusCode.ERROR })` must be explicitly called with the exception payload and stack trace.
- **Tracing Helpers:** Use custom `withSpan` wrapper to guarantee graceful span closing and error recording around critical blocks.
