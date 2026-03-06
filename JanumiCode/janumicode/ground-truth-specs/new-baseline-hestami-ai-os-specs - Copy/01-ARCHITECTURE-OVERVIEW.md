# 01 - Architecture Overview

## The Tech Stack
Hestami AI OS is a modern, container-native web application built with the following specific technology constraints chosen for high performance, reliability, and AI-agent compatibility.

### 1. The Runtime: Bun
- **Engine**: Bun serves as both the package manager and the runtime.
- **Why**: Eliminates Webpack/Node overhead, built-in SQLite (if needed), instantaneous TypeScript execution, and native Fetch.
- **Rules**: Do not use `npm` or `yarn`. Do not introduce PM2. The container uses `bun run start` natively.

### 2. The Application Framework: SvelteKit 5
- **Engine**: Svelte 5 utilizing **Runes** (`$state`, `$derived`, `$props`).
- **Why**: Deep SSR capabilities, zero-JS hydration, and highly deterministic UI updates without the overhead of React Virtual DOM.
- **Rules**: Server-side data fetching MUST happen in `+page.server.ts`. Forms MUST use `sveltekit-superforms` backed by Zod.

### 3. The Orchestration Layer: DBOS (Database OS)
- **Engine**: DBOS Transact Typescript SDK.
- **Why**: Ensures durable, exactly-once, idempotent execution of backend workflows. It replaces external queues (Kafka, RabbitMQ) and cron schedulers.
- **Rules**: Every single database mutation (Create, Update, Delete) MUST occur within a `@Workflow()` or `@Transaction()` step.

### 4. The API Layer: oRPC
- **Engine**: oRPC (Optimized RPC).
- **Why**: Full end-to-end type safety between the SvelteKit frontend (or mobile clients) and the SvelteKit backend.
- **Rules**: Inputs/Outputs must be strictly typed with `zod`. Auth and RLS must be injected into the procedure context before the handler runs.

### 5. The Database & ORM: PostgreSQL + Prisma v7
- **Engine**: PostgreSQL 14+ with Row-Level Security (RLS) enabled. Prisma ORM v7 using the `pg` driver adapter.
- **Why**: RLS ensures that tenants cannot cross-pollinate data, even if the NodeJS application has a bug.
- **Rules**: Strict connection pooling management is required to prevent connection exhaustion. `PRISMA_POOL_MAX=3`.

### 6. The Authorization Engine: Cerbos
- **Engine**: Cerbos Policies.
- **Why**: Decouples authorization logic from application code.
- **Rules**: RLS provides the "multitenant fence". Cerbos defines the "what can you do inside the fence" (RBAC).

## Conceptual Flow (The Golden Path)
1. **Client intent:** User submits a form via SvelteKit UI or Mobile App.
2. **Idempotency Assignment:** Client assigns a unique UUID to the request.
3. **RPC Execution:** The request hits the oRPC gateway.
4. **Context Injection:** The `orgProcedure` middleware extracts `X-Org-Id`, validates the JWT, evaluates Cerbos, and injects the context and Prisma transaction (`tx`).
5. **Database Transaction:** The DBOS workflow securely opens a connection, executes the `set_current_org_id()` RLS policy, and performs the mutation.
6. **Background Triggers (Optional):** DBOS queues asynchronously handle side-effects like ClamAV scanning or notifications.
