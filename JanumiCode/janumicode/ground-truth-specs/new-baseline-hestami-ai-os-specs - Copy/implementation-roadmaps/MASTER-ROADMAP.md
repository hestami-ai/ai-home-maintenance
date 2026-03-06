# Hestami AI OS - Master Greenfield Implementation Roadmap

## Overview
This roadmap is uniquely structured for AI Agent Software Developers executing a **Greenfield Implementation**. Do not assume legacy systems exist.

Agents MUST implement features in the strict sequence defined below to prevent dependency lock and "hallucinated" infrastructure.

---

## Phase 1: Core Infrastructure & Provisioning
**Goal:** Establish the deterministic runtime, database, and telemetry before any business logic is written.
1. **Init Bun Runtime**: Setup `package.json`, `bun.lockb`.
2. **Init Postgres & Prisma**: Establish `schema.prisma`. Configure `pg.Pool` with `max: 3` connection limit.
3. **Init DBOS**: Configure the DBOS executor. Build the `ensureDbosLaunched()` singleton guard in the SvelteKit initialization sequence.
4. **Init OpenTelemetry**: Implement Bun `--preload` script for OTel auto-instrumentation (SigNoz).
5. **Base SvelteKit Architecture**: Setup Tailwind, Skeleton UI, Superforms, and the initial `+layout.server.ts`.

## Phase 2: IAM & Central Governance (Domain 1)
**Goal:** Establish the multitenant security model. Everything else depends on this.
1. **Prisma Models**: `Organization`, `User`, `Staff`, `JoinRequest`, `OrganizationInvitation`.
2. **DBOS Workflows**: Setup durable workflows for `onboardOrganization`, `inviteUser`.
3. **Auth Platform**: Integrate Better Auth or JWT module.
4. **RLS & Cerbos**: Implement the Postgres RLS (`set_current_org_id`, `is_org_staff()`) combined with Cerbos rules.
5. **oRPC**: Setup `orgProcedure`, `staffProcedure` middlewares ensuring transactional context injection.

## Phase 3: Association Layer & Tier 2 Isolation (Domain 3)
**Goal:** Implement the Community Association Management structural layer on top of IAM.
1. **Prisma Models**: `Association`, `Document` (with Tier 2 `associationId`).
2. **RLS Tier 2**: Implement Tier 2 RLS ensuring non-staff external users check against `associationId = current_assoc_id()`.
3. **CAM UI Shell**: Create `/app/cam` Split-View sidebars and layouts.

## Phase 4: Document Processing Queue (DPQ) (Domain 2)
**Goal:** Standardize how large binary payloads are handled asynchronously.
1. **TUS Integration**: Deploy `tusd`. Handle webhooks.
2. **Prisma Models**: Update `Document` model with `DocumentStatus` (`PROCESSING`, `ACTIVE`, `INFECTED`).
3. **Queues & Workers**: Implement durable DBOS queues. Write worker steps for ClamAV scanning, ExifTool metadata, and libcvids/ffmpeg thumbnails.

## Phase 5: Feature Domains (In Parallel)
**Goal:** Now that Infrastructure, Governance, Auth, Isolation, and DPQ are done, feature pillars can be built.
- **Phase 5A (CAM Financials):** Build the Reserve Studies and Statutory Compliance engines.
- **Phase 5B (Concierge):** Build the homeowner interface, Service Calls, and Work Orders.
- **Phase 5C (Service Providers):** Build the Contractor interface.
- **Phase 5D:** Integrate native Mobile client SDK bindings via oRPC.

## Phase 6: Globalization & Scale-Out
**Goal:** Enable data-residency routing at scale.
1. Update Edge routers to inspect `X-Org-Id`.
2. Update Org schema defaults to configure currency, locale, and timezone.
