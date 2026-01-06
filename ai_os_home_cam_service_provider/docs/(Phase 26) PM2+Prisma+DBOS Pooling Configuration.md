### **Implement PM2/DBOS/Prisma Connection Pool Configuration (Prisma v7 \+ DBOS \+ PM2)**

You are a senior software engineer AI agent working in a TypeScript monorepo for a production system. Implement a set of configuration changes related to Postgres connection pooling and worker topology.

#### **Current Architecture (assume)**

* Runtime: Node (SvelteKit server)

* Process manager: PM2 in cluster mode

* Workflow: DBOS (TypeScript)

* ORM: Prisma ORM v7 (Postgres)

* Database: Postgres with RLS

* Observability: OpenTelemetry

#### **Goals / Requirements**

1. **PM2**: Set cluster mode to **3 instances** in production for the main server process. (configurable through .env environment variable)

2. **DBOS worker topology**: Ensure there is **exactly one DBOS executor runtime per PM2 process**.

   * DBOS must not be launched multiple times within the same PM2 worker process due to multiple imports or multiple server entrypoints.

   * Each PM2 worker must have a **unique DBOS `executorID`**, derived from `PM2_INSTANCE_ID` (or an equivalent PM2 env var).

3. **DBOS Postgres pool**: Configure DBOS system database connection pool to a small, explicit max (target default \= **3**, but make it configurable via env var).

   * Use the DBOS configuration pattern that accepts either `systemDatabasePoolSize` or an explicit `systemDatabasePool` (prefer explicit Pool for determinism).

4. **Prisma ORM v7 Postgres pool**: Configure Prisma v7 pooling correctly using the **pg driver adapter**.

   * Do **not** rely on v6-era `connection_limit` URL param for Postgres.

   * Create a `pg.Pool` with `max = PRISMA_POOL_MAX` (default **3**) and pass it to Prisma using `@prisma/adapter-pg`. Should be configurable via environment variable

   * Ensure only one PrismaClient is instantiated per PM2 process (singleton).

5. **Verification / Observability**

   * Add a startup log (info level) confirming:

     * PM2 worker id / PID

     * DBOS executorID

     * Prisma pool max value

     * DBOS pool max value

   * Add a small diagnostic helper (behind an env flag) that can print Prisma pool metrics using `prisma.$metrics.json()` and extract:

     * `prisma_pool_connections_open`

     * `prisma_pool_connections_busy`

     * `prisma_pool_connections_idle`

Provide a runbook snippet in `docs/` or `README` showing how to verify total connections via Postgres:

 `SELECT application_name, state, COUNT(*) AS n`  
`FROM pg_stat_activity`  
`GROUP BY application_name, state`  
`ORDER BY n DESC;`

*   
6. **Non-goals**

   * Do not introduce PgBouncer.

   * Do not refactor DBOS into a separate service/container in this change.

   * Keep behavior functionally identical except for connection topology/config and improved determinism.

#### **Deliverables** 

1. Updated PM2 ecosystem configuration (`ecosystem.config.*`) to **instances=3** for production.

   2. A new single-responsibility module for DBOS initialization, e.g. `src/server/dbos/init.ts`, that guarantees DBOS is launched **once per process**.

      * Use a `let launched = false` guard or `globalThis` guard.

      * Ensure DBOS config is set before `DBOS.launch()`.

      * Set `executorID` to `web-${PM2_INSTANCE_ID}` (fallback `web-0`).

      * Configure DBOS system DB pool with explicit `pg.Pool({ max: DBOS_POOL_MAX })`.

   3. A new single-responsibility module for Prisma initialization, e.g. `src/server/db/prisma.ts`, that:

      * Uses `pg.Pool({ max: PRISMA_POOL_MAX })`

      * Creates `PrismaPg(pool)` adapter

      * Instantiates `PrismaClient({ adapter })` as a singleton

   4. Wire-up: Ensure the SvelteKit server startup path calls `ensureDbosLaunched()` exactly once per PM2 worker.

      * Confirm there is not another codepath starting DBOS (search for `DBOS.launch` and consolidate).

   5. Add env vars (with defaults):

      * `PRISMA_POOL_MAX` default 3

      * `DBOS_POOL_MAX` default 3

      * `PRINT_PRISMA_POOL_METRICS` optional (false by default)

   6. Add documentation: `docs/db-connection-topology.md` explaining:

      * Per-PM2-worker connection budgeting

      * How to verify via Prisma metrics and Postgres `pg_stat_activity`

      * Expected connection bounds (e.g., 3 workers × (Prisma max 3 \+ DBOS max 3\) \= 18 total, plus overhead)

#### **Implementation Notes / Pitfalls to avoid**

* Prisma v7 uses driver adapters by default; ensure `@prisma/adapter-pg` is installed and used.

* Avoid creating new PrismaClient instances in request handlers or workflow steps.

* Ensure DBOS init module does not create circular imports that cause multiple evaluations.

* Ensure any hot-reload / dev mode does not spawn uncontrolled pool creation.

* If there is an existing Postgres driver/pool, do not reuse it for Prisma unless it is explicitly safe; keep separate pools for Prisma and DBOS for now.

* Ensure any TypeScript build / module resolution is compatible with the new imports.

#### **Acceptance Criteria**

* With PM2 cluster set to 3, the system runs normally.

* Logs show exactly one DBOS launch per PM2 process and a unique executorID per process.

* Prisma pool max and DBOS pool max match env/defaults.

* `prisma.$metrics.json()` shows the expected pool sizes.

* Postgres `pg_stat_activity` shows connection counts consistent with:

  * \~`PM2_workers × PRISMA_POOL_MAX` Prisma connections (steady state)

  * plus \~`PM2_workers × DBOS_POOL_MAX` DBOS connections (steady state)

* No PgBouncer introduced.

