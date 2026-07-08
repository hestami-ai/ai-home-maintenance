# JanumiCode Cloud & Enterprise — Executable Product Description

> **Document type:** Operational Concept & Employment Model → Executable Product Description
> **Working title of the product:** *JanumiCode Cloud & Enterprise* (the "Platform"). The product ships in three **editions** — **Community** (open-source, self-hosted, single-tenant), **Enterprise** (commercial, self-hosted), and **Cloud** (hosted, multi-tenant) — over a single **open-core** codebase (`DEC-INTENT-15/16`); **Mobile / Web / VS Code Extension are *clients*, not editions** (one codebase, rebrandable). Edition and client names are working titles, freely renamable; the IDs below are stable.
> **Source of authority:** This document is authored per `docs/Product Description Creation Guidelines.md` (Operational Concept & Employment Model Guide) and structured for ingestion by JanumiCode v2 per `docs/Product Description Interview Framework.md`.
> **Ingestion instruction (for headless/attachment use):** *"Execute the intent described in the attached document."* — attach this file verbatim.
> **Status:** Draft v0.10 — adds the **deployment substrate strategy** (`DEC-INTENT-21`, `TECH-SUBSTRATE-1`, `VV-ISO-4`): **two permanent substrates chosen by workload need** — **Docker Compose** (dev/eval/CI, the `REL-1` Cloud beta, Community + small-Enterprise self-host) and **RKE2/Kubernetes** (Cloud GA from `REL-2` single-node → multi-node HA at `REL-4`; regulated/large Enterprise via Helm) — with **substrate-agnostic workloads** (Vault stays vault-of-record on both; only the orchestration layer is dual-authored) so migration is a re-orchestration, not a rewrite; the `RQ-04` stronger-isolation escalation is `RuntimeClass` gVisor/Kata on RKE2, which also strengthens the IL4/RMF posture. Builds on v0.9's infra topology (`DEC-INTENT-20`) and v0.8's agent test harness (`DEC-INTENT-19`). Design decisions are `DEC-INTENT-01..21` (A.2). All residuals **`RQ-01..RQ-12` are resolved** (2026-07-08); the AGPL **Community edition ships in `REL-1`** (`RQ-12`). See Part F.

---

## How to read this document (ID & structure conventions)

This is an **executable** product description: every operational element carries a **stable, namespaced ID** so downstream decomposition (JanumiCode Phases 1–10) can join by exact string, trace coverage, and detect drift. Do not renumber IDs; append new ones.

| Namespace | Meaning | Consumed by (phase) |
|---|---|---|
| `A-*` | Operational **Actor** (human, AI agent, external system, affected non-user) | 1.5 |
| `P-*` | **Persona** (a human-actor projection with goals/pain) | 1.5 |
| `SIT-*` | Operational **Situation** (normal / degraded / exception / escalation / recovery / termination) | 1.1, 7 |
| `CAP-*` | Operational **Capability** (what the system must accomplish, pre-software-allocation) | 1.9, 4 |
| `EMP-*` | **Employment pattern** (doctrine for invoking/coordinating a capability) | 1.7 |
| `DEC-*` | **Decision Model** (a first-class decision with authority, evidence, criteria, escalation) | 1.7, 2, 4 |
| `UJ-*` | **User Journey** (actor-centered projection; steps + acceptance criteria) | 1.6 |
| `WF-*` | **Workflow** (executable decomposition of an employment pattern; states/transitions) | 1.7 |
| `SB-*` | **Service Blueprint** (frontstage/backstage/supporting/infra coordination) | 1.6–1.7 |
| `SCN-*` | **System Scenario** (end-to-end, multi-actor operational event) | 1.6, 7 |
| `BD-*` / `ENT-*` | **Business Domain** / **Entity** (Common Data Model) | 1.5, 1.9, 5 |
| `INT-*` | **Integration** (external system / provider dependency) | 1.10 |
| `TECH-*` | **Technical Constraint** (stated, authoritative stack decision — not a proposal) | 1.3.2, 4, 5 |
| `VV-*` | **Verification & Validation requirement** (target / measurement / threshold) | 1.3.4, 7, 8 |
| `QA-*` | **Quality Attribute** (free-form NFR seed) | 1.3.4, 8 |
| `COMP-*` | **Compliance / audit obligation** | 1.3.3, 5, 7 |
| `VOC-*` | **Canonical Vocabulary** term | 1.3.5 |
| `REL-*` | **Release** (phasing unit) | 1.13 |
| `SM-*` | **Success Metric** | 1.11 |
| `OUT-*` | **Operational Outcome** (intended effect) | 1.1 |
| `SC-*` | **Operational Success Condition** (observable) | 1.1 |

**Layering discipline (from the Guidelines).** The layers below are *not* substitutes for one another; they are projections of the layer above:

```
Intent (Part A)
  → Operational Concept (Part B)        — the world the Platform creates
  → Employment Model (Part C)           — how capabilities are used under varying conditions
  → Derived Views (Part D)              — Personas, Journeys, Workflows, Decision Models, Blueprints, Scenarios, Common Data Model
  → Requirement seeds (Parts D–E)       — stack (TECH), V&V (VV/QA), compliance (COMP)
  → Traceability (Part E) + Open Questions (Part F)
```

**One-paragraph orientation.** JanumiCode today is a VS Code extension: a *Recursive Professional Harness* that takes a product intent and conducts the full professional work of software creation — decomposing intent into journeys, requirements, architecture, data models, APIs, tasks, tests, and executed code — under continuous human governance, with all authoritative state kept in a per-workspace SQLite database and rendered through a Svelte "governed stream" UI. This document describes evolving that single-user desktop harness into a **multi-tenant Cloud service, self-hostable Community (AGPL) and Enterprise editions, and a Mobile companion**, built on a proven modular-monolith platform stack (SvelteKit + Bun + oRPC + Prisma/PostgreSQL-RLS + DBOS + Cerbos) as the control plane, and adding an **isolated per-tenant execution plane** for the one thing that stack was never built to do: run untrusted compilers and coding agents.

---

# PART A — INTENT

## A.1 Intent Summary

**Problem.** JanumiCode's recursive decomposition-and-implementation harness is valuable but is trapped inside a single-user VS Code extension. It requires each user to install an editor, provision local GPU/model infrastructure or CLI executors, keep authoritative state in a local SQLite file, and run long jobs on their own machine. This excludes people who lack the local toolchain, prevents teams from collaborating on the same governed run, gives organizations no tenancy/identity/audit story, and offers no way to monitor or govern work away from the desktop.

**Desired change.** Make the *same operational capability and the same UI/UX* available (1) to individuals and small teams as a hosted **Cloud** service they reach from a browser, (2) to self-hosters as an **open-source Community edition** (single-tenant, AGPL-3.0) and to organizations as a commercial **Enterprise edition** with identity, multi-tenancy, audit, compliance, and private/air-gapped model support, and (3) to everyone as a **Mobile** companion for monitoring, initiating, and — above all — **governing** work in progress.

**Intended beneficiaries.** Solo builders and indie developers; product/engineering teams; enterprise platform, security, and compliance stakeholders; and the human "governors" who must approve, refine, or reject what the AI proposes.

**Constraints and preserved principles (must not be substituted away):**
- **Governance is the product, not a feature.** The human-in-the-loop authority model — capabilities are never silently promoted to authority; the AI may *propose* but a human *governs* consequential decisions — is preserved end-to-end. (`Agent Capability ≠ Agent Authority`.)
- **Faithful traceability.** The intent → requirement → design → implementation → validation-evidence spine is preserved; nothing generated is unattributable to an operational need.
- **Fidelity of the governed-stream experience.** The web/mobile experience must feel like the extension's governed stream and decomposition viewer, not a diminished re-skin. Svelte transferability is a means to this end.
- **Bring-your-own-keys first.** Users retain control of their model credentials; the Platform never requires surrendering keys to obtain core value. Platform-managed metered keys are an *option*, not a precondition.
- **Isolation.** No tenant's intent, artifacts, credentials, or executing code may be observable by another tenant. Untrusted generated code never executes in a shared process.

**What must not be prematurely specified.** This document does not fix the internal component architecture (that is JanumiCode Phase 4's job); it fixes the *operational reality*, the *employment doctrine*, the *stated stack constraints*, and the *validation targets*.

## A.2 Unresolved ambiguities carried forward

Material ambiguities are enumerated in **Part F** (not answered here to avoid invented certainty). The three product-shaping decisions already resolved by the sponsor are recorded as constraints:

- **DEC-INTENT-01 (resolved):** Rollout order is **Shared backend + Cloud SaaS first** → Enterprise → Mobile. Drives `REL-1..REL-4`.
- **DEC-INTENT-02 (resolved):** Engine placement is **two-plane** — decomposition orchestration runs as durable workflows in the control-plane monolith; Phase-9 code execution and coding-agent/compiler/PTY processes run in **isolated per-tenant sandbox workers**. Drives `TECH-EXEC-*`, `CAP-08`, `WF-EXEC`, `WF-SANDBOX-LIFECYCLE`.
- **DEC-INTENT-03 (resolved):** LLM access model is **BYOK cloud keys (default) + private/local model endpoints for Enterprise + platform-managed metered keys as an option.** Drives `BD-06` (Credentials & Model Access), `BD-07` (Metering & Billing), `INT-LLM-*`.

**Design decisions resolved from the Part F answers (2026-07-07):**
- **DEC-INTENT-04 — Execution runtime & compute governance.** Sandbox runtime = **OpenSandbox on Docker**, on a **single-node Linux deployment** initially (Docker Compose for dev/small + the `REL-1` Cloud beta). *(Substrate trajectory: **RKE2/Kubernetes** becomes the production/HA substrate from `REL-2`, multi-node at `REL-4` — `DEC-INTENT-21`; the earlier "no Kubernetes yet" stance is superseded by that phased plan.)* A **JanumiCode Compute Broker** sits above OpenSandbox to enforce tenant fairness, entitlement, metering, and billing. The broker↔runtime boundary is abstracted so OpenSandbox can later move to a stronger/multi-node backend without changing the product control plane. Drives `TECH-EXEC-1..4`, `CAP-08`, `WF-EXEC`, `WF-SANDBOX-LIFECYCLE`. (Supersedes the earlier `⟨OPEN Q-01/Q-04⟩`.)
- **DEC-INTENT-05 — Real-time transport.** The governed stream and collaboration/presence use a **bidirectional WebSocket** channel — a deliberate divergence from the reference stack's SSE default, chosen for two-way collaboration and because it maps 1:1 onto the extension's existing bidirectional `postMessage` protocol. Drives `TECH-STREAM-1/2`, `CAP-05`, `WF-STREAM-*`. (Supersedes `⟨OPEN Q-06⟩`.)
- **DEC-INTENT-06 — Mobile client.** **Capacitor-wrapped Svelte**, maximizing a **shared component/UI library across web, iOS, Android, and the VS Code extension**. Drives `TECH-MOB-1`, `TECH-FE-1/2`, `QA-1`. (Supersedes `⟨OPEN Q-02⟩`.)
- **DEC-INTENT-07 — Delivery, deployment & hosting is core value.** Delivering the generated project to **version control** (JanumiCode self-hosted git by default; optional tenant remote — `DEC-INTENT-12`), building, **deploying, and hosting** it (`DEC-INTENT-11`) is in scope as core value (especially for solo/small teams), not merely an integration point. Drives new `CAP-16`, `CAP-17`, `BD-14`, `UJ-15`, `UJ-16`, `WF-DELIVER`, `WF-HOST`; updates `B.8`, `A-17`, `INT-VCS`. (Supersedes `⟨OPEN Q-08⟩`; extended by `DEC-INTENT-11/12`.)
- **DEC-INTENT-08 — Secret custody.** **HashiCorp Vault — Community Edition** (self-hosted) is the **sole** per-tenant credential **vault of record**. (RQ-02/RQ-07 resolved: OpenSandbox's credential-vault is **not adopted as the authority** — Vault CE remains the sole vault-of-record on **both** substrates; on RKE2, Kubernetes Secrets / External Secrets Operator are **last-mile delivery only**, `DEC-INTENT-21`; last-mile injection is control-plane/Vault-based, `TECH-SEC-2`.) Drives `TECH-SEC-1`, `TECH-SEC-2`, `BD-06`.
- **DEC-INTENT-09 — Payments.** **Square** is the payment provider (relevant once platform-managed keys are billed, R2). Drives `INT-PAYMENT`.
- **DEC-INTENT-10 — Stack lock.** No Python / Django / FastAPI; legacy Python service stacks are explicitly **not** a target. **Bun + oRPC + DBOS + Prisma/Postgres + Cerbos** is the core selection. Drives all `TECH-*` (`TECH-STACK-LOCK`).
- **DEC-INTENT-11 — Application hosting & routing.** JanumiCode **hosts** the tenant's built app as a long-lived, isolated container on the single node, publicly reachable at `<tenant-app-id>-vcs.janumicode.com`; Cloudflare fronts `*.janumicode.com` → a single origin IP → **Traefik Host-based routing** to the right container. Tenant custom domains are deferred (subdomains-first). Drives `CAP-17`, `BD-14`, `WF-HOST`, `TECH-HOST-1`/`TECH-ROUTE-1`, `TECH-EDGE-1`.
- **DEC-INTENT-12 — Self-hosted version control.** JanumiCode runs a **self-hosted git server** (e.g., Gitea/Forgejo) on the node as the default composition; tenants may optionally mirror/push to their own remote (GitHub/GitLab). Drives `INT-VCS`, `TECH-VCS-1`, `BD-14`, `CAP-16`.
- **DEC-INTENT-13 — Media delivery edge.** A signed, expiring media-serving edge (Nginx `secure_link` + internal redirect to object storage) with **two modes**: (a) **platform media** (JanumiCode UI attachments/artifacts) is **JanumiCode-session/user-scoped** — a link works only for the requesting authenticated user, stronger than plain presigned URLs; (b) **deployed-app media** is served to the tenant app's own end users under **the deployed app's own session/auth** (or public signed-expiring links for public content) — JanumiCode does not impose its platform session on a public visitor (`A-20`). Drives `CAP-18`, `TECH-MEDIA-1`, `BD-09`, `WF-MEDIA-SERVE`, `VV-MEDIA-1`.
- **DEC-INTENT-14 — Compliance & auditability posture.** The Platform is designed, built, operated, **and documented** to pass a **SOC 2 Type 2** audit and to support **DoD RMF** (NIST 800-53) authorization and **GDPR** (and similar regimes): a mapped control framework with **continuous evidence collection**, an **immutable audit trail**, **encryption in transit + at rest**, **incident/breach response**, **data-subject-rights** handling, **change management**, **access reviews**, **vendor/subprocessor management**, and **backup/DR**. Drives `CAP-19`, `BD-11`, `WF-EVIDENCE`/`WF-DSR`/`WF-INCIDENT`/`WF-ACCESS-REVIEW`, `TECH-COMPLIANCE-1`/`TECH-AUDITLOG-1`/`TECH-CRYPTO-1`/`TECH-BCDR-1`, `COMP-SOC2-1`/`COMP-RMF-1`/`COMP-GDPR-1`, `VV-COMP-1`.

**Design decisions — product-family structure & open-core (2026-07-08):**
- **DEC-INTENT-15 — Editions & open-core licensing.** The product ships as **three editions over one codebase**: **Community** (open-source **AGPL-3.0**, self-hosted, **single-tenant**, BYOK), **Enterprise** (commercial license; the self-hosted Community core **plus** the `ee/` feature set), and **Cloud** (JanumiCode-hosted, **multi-tenant** = Enterprise features + hosted tenant operations). **The community/enterprise line is multi-tenancy:** Community = the decomposition engine, governed-stream UX, single-tenant self-host, delivery/hosting, self-hosted VCS + sandboxed execution runtime, BYOK, and base audit-log + encryption; **Enterprise/Cloud (`ee/`, commercial)** = multi-tenant org-isolation, SSO/federation, the Compute Broker's cross-tenant fairness/metering/billing, compliance-evidence automation (SOC 2/RMF/GDPR), multi-tenant credential isolation, and white-label multi-brand. **Editions differ by build-time `ee/` inclusion + a runtime license entitlement — never a code fork.** **Clients (web, mobile, VS Code extension) are not edition-split**; they are rebrandable surfaces (`TECH-BRAND-1`). A **Contributor License Agreement (CLA)** secures the relicensing rights the dual-license requires. Drives `TECH-REPO-1`, `TECH-LICENSE-1`, `TECH-BRAND-1`, `COMP-LIC-1`, `VOC-17`/`VOC-31..36`; refines `BD-13`/`ENT-FEATURE-FLAG`, `QA-5`. (Community edition ships in `REL-1`; `RQ-12` resolved.)
- **DEC-INTENT-16 — Monorepo & codebase topology.** A **single monorepo** (Bun workspaces + Turborepo): `packages/*` (shared, AGPL — including `packages/engine`, the extension's decomposition engine **extracted** to a headless, host-agnostic library consumed by both the extension and the control-plane server), `apps/*` (control-plane, docs), `clients/*` (web, mobile, vscode), and a **private `ee/*`** (commercial). The **public Community mirror** is derived by stripping `ee/` (allowlist publish + filtered history); a **one-way import boundary** (the community core never imports `ee/`) is enforced in CI (dependency-cruiser + a "community build"). Drives `TECH-REPO-1`; extends `TECH-ENGINE-1`; detailed in Appendix G.1.

**Design decision — versioning & compatibility (2026-07-08):**
- **DEC-INTENT-17 — Versioning & compatibility policy.** The Platform is **robust to change** by construction: **contract-first single-source versioning** (the `Prisma → Zod → oRPC → OpenAPI → SDK` chain is the versioned artifact), **additive-by-default** evolution, and explicit **version negotiation at every boundary JanumiCode does not control both sides of** (SDK, mobile, VS Code extension, self-hosted installs, the tenant's deployed app). Sponsor-resolved specifics: (a) **API = major-in-path** (`/api/v{n}/rpc/…`), additive within a major, parallel majors on a breaking change with **N-1 support on a published deprecation calendar** (`TECH-VER-2`); (b) **release channels** — Cloud continuous, Community rolling, **Enterprise LTS** (pinned, ~12–18 mo + security backports) (`TECH-VER-6`); (c) **mobile** — version handshake + graceful **forced-upgrade** floor + **Capacitor OTA live-updates** to shrink app-store lag (`TECH-VER-5`). Persistent state uses **expand/contract migrations + upcast-on-read (never reject an old `schemaVersion`)** (`TECH-VER-3`); durable runs **pin DBOS `application_version`** so in-flight work resumes across deploys (`TECH-VER-4`, `SIT-11`/`VV-DUR-1`). One **product SemVer** stamps all editions/clients; **public contracts** (API major, SDK, export format, license schema) are versioned independently with their own support windows (`TECH-VER-1`); a **CI-tested compatibility matrix** is the governing artifact. Drives `TECH-VER-1..6`, `VV-VER-1/2`, `VOC-37..41`; refines `TECH-API-1`, `TECH-WF-1`, `TECH-MOB-1`.

**Design decision — observability & service transparency (2026-07-08):**
- **DEC-INTENT-18 — Observability & tenant-facing status/SLO.** Telemetry is a **governed, versioned contract** (`TECH-OBS-2`): one **canonical semantic convention** (a single tenant attribute key, pinned OTel semconv + Schema URL, stable metric names), identical across editions, with **metrics + logs actually exported** (not just traces), content/secret-redacted (`VV-SEC-1`), evolving under **expand/contract + deprecation** (`TECH-VER-3`) so dashboards/alerts/SLOs — kept **as code** in the monorepo — survive upgrades. **Tenant-facing** (`CAP-20`, `TECH-OBS-3`): measured **SLIs** + a **status page** + internal **SLOs/error-budgets** that gate releases, but **no contractual availability SLA until HA** (single-node; `VV-AVAIL-1`, `REL-4`). Sponsor-resolved: (a) the status page is **served on the origin node** — the one approach identical across all editions incl. **air-gapped** Enterprise (no third-party subprocessor) — **complemented by an external synthetic probe/monitor that both detects a full node-down and sends the node-down alert off-node (email/push) itself** — *not* the on-node `WF-NOTIFY`, which shares the outage's failure domain (`WF-NOTIFY` carries *in-band* status/incident comms while the node is up) — so a hard-down still reaches tenants when the node and its on-node workflows are unreachable (a fully independent-failure-domain status **dashboard** is `REL-4`); (b) **tiered depth** — every tenant sees status + their own runs/sandbox/hosted-app health + usage/quota (`BD-07`) + SLO attainment (RLS-scoped, redacted), and **Enterprise** additionally **exports telemetry** to its own collector/SIEM + on-prem SigNoz (`TECH-OBS-4`). Drives `CAP-20`, `TECH-OBS-2/3/4`, `VV-OBS-1`/`VV-SLO-1`, `VOC-42..46`, `SM-11`, `BD-12` entities; refines `TECH-OBS-1`, `CAP-14`, `VV-AVAIL-1`, `COMP-INCIDENT-1`. (Candidate journey `UJ-21` — tenant reviews status & service levels.)

**Design decision — agent-facing test harness & virtuous-cycle diagnostics (2026-07-08):**
- **DEC-INTENT-19 — Agent-facing test harness & virtuous-cycle diagnostics.** Coding agents (and other agents/humans) get **structured, traceable test feedback from unit through E2E** so they can *diagnose and fix*, and a passing state is **independently verified to mean working**. Two harnesses — the platform's own CI and the **in-sandbox generated-project** loop — share **one diagnostic contract** (`TECH-TEST-1`): per test `{id → traces_to AC/task, status, failure-class, expected/actual, stack, timing, correlated trace_id + log refs}` in the same **expected / observed / likely-source / reproduce** shape as the pipeline's own agent-fix contract, normalized across frameworks (JUnit/TAP/native → contract). Every test run is a **traced operation** (`TECH-OBS-2`, `TECH-TEST-2`) so a failure bundles the code-under-test's correlated spans + logs. The **test pyramid** (unit → integration → contract → E2E against the hosted app) is a bounded feedback ladder (`TECH-TEST-5`). Sponsor-resolved: (a) **always-on full structured capture** (tiered retention — failure bundles kept long, passing-run bundles pruned fast); (b) **strong anti-fabrication** — the agent's green is a *proposal* the harness verifies via **coverage gates + mutation testing + anti-mock/anti-skip/no-empty-suite/'test-invokes-target' detectors** (`TECH-TEST-3`, realizes `VV-FAB-1`; closes the 'no tests found = pass' hole); (c) **hermetic + flake-quarantine** — flakes are first-class defects, a pass-after-flaky-fail is **not** 'fixed' (`TECH-TEST-4`); (d) **full ladder in the iterate loop**, E2E gated after lower levels green + Compute-Broker budget-capped, escalating to a stronger model / human governor on exhaustion (`TECH-TEST-5`). Drives `CAP-21`, `TECH-TEST-1..5`, `VV-TEST-1..3`, `VOC-47..51`, `SM-12`; refines `CAP-08`/`TECH-EXEC-3`, `VV-FAB-1`, `BD-08`, `UJ-12`.

**Design decision — platform infrastructure topology & tenant-app data plane (2026-07-08):**
- **DEC-INTENT-20 — Single-node trust tiers, two-instance data isolation & tenant-app data plane.** On the single node, everything runs as **containers in three trust tiers** (Docker/Compose on the `REL-1`/dev/small substrate; Kubernetes namespaces + NetworkPolicy/PSA on RKE2 from `REL-2` — `DEC-INTENT-21`): (1) a **trusted control-plane tier** (Traefik, the control-plane monolith, the **platform Postgres**, SeaweedFS, PgDog, Vault, the **VCS** (Gitea/Forgejo), SigNoz); (2) **OpenSandbox** as the **untrusted-workload boundary** — **ephemeral build/test/agent execution only** (`TECH-EXEC-*`); (3) a **tenant-app tier** (each hosted app + its backing data). *Shared node ≠ shared trust domain:* data isolation uses **two Postgres instances** — the platform control-plane DB (RLS org-multitenancy, `TECH-DB-2`) is a **separate process** from a **tenant-app Postgres** (**database-per-app** + scoped role, `REVOKE` across), so a semi-untrusted hosted app's SQL access can never reach the platform's crown jewels (`TECH-DB-5`; upholds `TECH-HOST-1`/`VV-ISO-1`). Object storage is **one SeaweedFS cluster** with **per-app buckets + scoped S3 keys**, platform buckets separate (`TECH-STORE-2`). **Hosted apps get a managed data plane** — a per-app database + bucket + **Vault-minted short-lived credentials** (`TECH-SEC-1`); the app never holds the platform DB credential. **PgDog** fronts both instances as a pooler (not an isolation boundary). The **VCS and other core services are trusted control-plane services — never inside OpenSandbox** (a trust inversion); **hosted apps run as hardened Docker containers via `WF-HOST`** (same hardening as `TECH-EXEC-2`), which sidesteps any dependence on OpenSandbox long-lived-service support. Docker **network segmentation** + default-deny isolates the tiers (tenant-app ingress via Traefik only; DB access only to the tenant-app instance; no route to the control-plane network). Drives `TECH-DB-5`, `TECH-STORE-2`, `TECH-TOPO-1`, `VV-ISO-3`, `VOC-52/53`, `BD-14` entities; refines `CAP-17`, `TECH-HOST-1`, `TECH-VCS-1`, `TECH-EXEC-2`, `DEC-INTENT-02`/`11`.

**Design decision — deployment substrate strategy (2026-07-08):**
- **DEC-INTENT-21 — Two deployment substrates (Docker Compose + RKE2), phased.** The platform runs on **two permanent substrates chosen by workload need**, with **substrate-agnostic workloads** (same OCI images; **Vault stays the vault-of-record on both** — Kubernetes Secrets / External Secrets Operator are *last-mile delivery*, not authoritative custody; storage via the S3 API) so moving between them is a **re-orchestration, not a rewrite** (extends the Compute Broker's abstracted runtime boundary, `TECH-EXEC-4`, platform-wide). **Docker Compose** = development, evaluation, CI, the **`REL-1` Cloud beta**, and single-tenant **Community** + small **Enterprise** self-host (permanent). **RKE2 / Kubernetes** = **Cloud GA from `REL-2`** (single-node RKE2) → **multi-node HA at `REL-4`**, plus the **regulated/large Enterprise self-host** path (Helm). Dividing rule: *multi-tenant / HA / regulated → RKE2; single-tenant / small / dev → Compose.* Only the **orchestration layer** is dual-authored: isolation/networking (Docker networks + default-deny ↔ **NetworkPolicy/Cilium + Pod Security Admission**), secrets last-mile (env/file ↔ **ESO / Vault Agent Injector**), ingress (Traefik container ↔ Traefik ingress controller), and the sandbox backend (OpenSandbox-on-Docker ↔ **sandbox-as-K8s-Jobs + `RuntimeClass` gVisor/Kata** — where the `RQ-04` stronger-isolation escalation lands). Tenant isolation (`VV-ISO-*`) must hold on **both**. RKE2 (FIPS-validated, DoD STIG, CIS-hardened, secure-by-default PSA/NetworkPolicy) also strengthens the **IL4/RMF** posture (`COMP-RMF-1`, `DEC-INTENT-14`). Drives `TECH-SUBSTRATE-1`, `VOC-54/55`, `VV-ISO-4`; refines `DEC-INTENT-04`/`20`, `DEC-INTENT-08`, `TECH-PKG-1`, `TECH-EXEC-2`, `TECH-TOPO-1`, `QA-4`, `REL-1`/`REL-2`/`REL-4`.

---
# PART B — OPERATIONAL CONCEPT

*The future operational reality the Platform creates. Broader than any single user's experience.*

## B.1 Actors

Human, automated, and external participants. Personas (`P-*`, Part D.1) are the human-facing subset; several actors are agents or systems that never "use an interface" yet are operationally decisive.

**Human actors**
- `A-01` **Solo Builder** — an individual turning an idea into deployed software; owns their own tenant-of-one; BYOK.
- `A-02` **Team Member / Collaborator** — works within a shared organization on shared projects and runs.
- `A-03` **Governor / Approver** — the human authority who adjudicates consequential proposals in the governed stream (approve / refine / reject / escalate). May be the same person as `A-01` for solo use, or a distinct role in teams/enterprise.
- `A-04` **Organization / Tenant Admin** — provisions members, roles, projects, credential vaults, and policy for an org tenant.
- `A-05` **Billing / Account Owner** — owns subscription, entitlements, and (if platform-managed keys are enabled) usage spend.
- `A-06` **Enterprise Platform Operator** — the customer's own ops/SRE who installs, upgrades, and runs a self-hosted Enterprise deployment.
- `A-07` **Enterprise Security / Compliance Officer** — sets residency, retention, SSO, and audit policy; reviews audit logs; never authors code.
- `A-08` **Platform Operator (JanumiCode staff)** — operates the multi-tenant Cloud; never reads tenant intent/artifacts/credentials except under explicit, audited support consent.
- `A-09` **Affected Non-User** — e.g., the end recipients of the software a builder ships, and downstream teams inheriting generated code; not Platform users but whose outcomes the Platform affects (quality/safety of generated code matters to them). When JanumiCode *hosts* the shipped app, the runtime-facing subset is modeled explicitly as `A-20`.

**Automated / AI actors** (JanumiCode's existing internals, now multi-tenant services)
- `A-10` **Client Liaison Agent** — the conversational ReAct router that classifies user intent and mediates between the human and the harness via the **Capability Broker** (READ / PROPOSE / GOVERN tiers).
- `A-11` **Decomposition Phase Agents** — the LLM-backed workers of Phases 1–8 (intent extraction, requirements, system spec, architecture, technical spec, planning, test planning, evaluation planning), including gatekeepers/validators and the coverage/saturation controllers.
- `A-12` **Execution Agents** — the Phase-9 coding executors (e.g., the `mimo`/OpenCode-derived agent and CLI coding agents) that write and run code inside a sandbox.
- `A-13` **Governance / Adjudication Agents** — validators, coherence checkers, and finding-surfacing logic that raise decisions for human governance rather than acting autonomously.
- `A-14` **Durable Workflow Orchestrator** — the engine that advances runs across phases, survives restarts, and guarantees exactly-once side effects.

**External systems**
- `A-15` **LLM Providers** — Anthropic, OpenAI, Google (cloud, BYOK or platform-managed); and private/local endpoints (Ollama, llama.cpp, vLLM) for Enterprise.
- `A-16` **Enterprise Identity Provider** — the customer's IdP (SSO via OIDC/SAML) for Enterprise.
- `A-17` **Version Control / Delivery Targets** — **JanumiCode's self-hosted git** (default) plus optional tenant-owned remotes (GitHub/GitLab); the deploy target is JanumiCode's own single-node hosting. **In core scope** (`CAP-16`, `CAP-17`, `DEC-INTENT-07/11/12`).
- `A-18` **Object Storage & Upload Edge** — the storage backend and resumable-upload service for attachments and generated artifacts.
- `A-19` **Observability Backend** — the traces/metrics/logs sink used to operate the Platform.
- `A-20` **Deployed-app End User** — a public visitor of a tenant's hosted app (`<tenant-app-id>-vcs.janumicode.com`); the runtime projection of `A-09` in the hosted case. Not a JanumiCode user (holds no JanumiCode session); JanumiCode routes their requests (Traefik) and serves the hosted app's media via signed, expiring links scoped by **the deployed app's own session/auth** (or public), not a JanumiCode session (`CAP-17`, `CAP-18`).
- `A-21` **Public Edge (Cloudflare)** — DNS/CDN that fronts `*.janumicode.com` and forwards to the single Traefik origin IP.
- `A-22` **External Auditor / Assessor** — a SOC 2 auditor or RMF assessor who examines evidence of control operating effectiveness over an audit period; read-only, scoped, audited access.
- `A-23` **Data Subject** — an individual (a tenant user or a deployed-app end user, `A-20`) whose personal data GDPR protects; may file access/erasure/portability/rectification requests.

## B.2 Environment

- **Technical.** Multi-tenant cloud (Cloud edition) and customer-controlled infrastructure incl. air-gapped (Enterprise). Browsers (desktop + mobile web) and native mobile clients. Long-running jobs (a decomposition + execution run can span minutes to hours). Untrusted code execution. GPU/compute availability is *not* assumed for Cloud tenants (they BYOK cloud models) but *is* typical for Enterprise (private models).
- **Organizational.** Solo (tenant-of-one), small team, and enterprise org hierarchies. Enterprise has separation of duties: platform operators, security/compliance, and builders are distinct people.
- **Regulatory.** The Platform targets **SOC 2 Type 2** (Trust Services Criteria), **DoD RMF** (NIST 800-53, for gov/Enterprise), and **GDPR** (for EU personal data), plus similar regimes — imposing data-residency, retention, access-audit, encryption, change-control, incident-notification, and data-subject-rights obligations (`DEC-INTENT-14`, `CAP-19`). Generated-code IP and the confidentiality of product intent are sensitive by default.
- **Temporal.** Runs are asynchronous and resumable; a Governor may be absent when a decision is raised, so decisions must persist and be actionable later (including from Mobile). Sessions reconnect after network loss without losing stream position.
- **Resource constraints.** BYOK model keys have rate limits and spend ceilings; sandbox compute is finite and must be fairly scheduled across tenants; mobile clients are bandwidth- and battery-constrained.
- **Uncertainty & information availability.** Intent is frequently incomplete; LLM outputs are non-deterministic and can drift, hallucinate IDs, or fail to converge; provider APIs fail transiently. The operational world must treat all of these as *normal*, not exceptional.

## B.3 Operational Situations

Situations the Platform must handle as first-class — not just the happy path. (Referenced by V&V and by workflows.)

- `SIT-01` **Normal decomposition run** — intent submitted, phases advance, human governs at gates, run completes.
- `SIT-02` **Incomplete / ambiguous intent** — required elements (what/who/problem) missing; system raises a clarification (Mirror/Menu) rather than inventing.
- `SIT-03` **Provider degradation** — LLM API rate-limited, timing out, or erroring; key exhausted or spend-capped.
- `SIT-04` **Execution failure** — generated code fails to compile, tests fail, or a coding agent stalls/wedges in the sandbox.
- `SIT-05` **Non-convergence** — saturation/decomposition loops fail to reach coverage or a fix loop does not converge within budget.
- `SIT-06` **Governance rejection / revision** — a human rejects or edits a proposal, requiring re-derivation of downstream artifacts.
- `SIT-07` **Absent governor** — a decision is raised with no human present; work must safely pause and notify, not proceed autonomously past its authority.
- `SIT-08` **Cross-run impact** — a new run overrides an interface certified in a prior run; downstream impact must be surfaced.
- `SIT-09` **Concurrent collaboration** — multiple team members view/act on the same run; conflicting actions must be resolved deterministically.
- `SIT-10` **Tenant isolation under multi-tenancy** — every read/write and every executing job is scoped to exactly one tenant; isolation must hold under connection pooling and shared workers.
- `SIT-11` **Interruption & resume** — server restart, deploy, or client disconnect mid-run; run state and stream position recover exactly.
- `SIT-12` **Spend / quota limit reached** — entitlement or budget ceiling hit mid-run; run pauses gracefully with a governed choice to raise limit or stop.
- `SIT-13` **Support access** — a platform operator needs to inspect a tenant's run to help; requires explicit, audited, time-boxed consent.
- `SIT-14` **Offboarding / export / deletion** — a tenant exports or deletes all their data; must be complete and verifiable.
- `SIT-15` **Air-gapped operation (Enterprise)** — no outbound internet; all models, storage, and telemetry are on-premise.
- `SIT-16` **Compute contention** — multiple tenants' sandbox jobs contend for the shared single node; one tenant must not starve another (the Compute Broker's fair-share mandate, `TECH-EXEC-4`).
- `SIT-17` **Delivery failure** — a VCS push is rejected (branch conflict / auth) or a deploy target/registry is unreachable; the run must degrade legibly with a governed next step (`WF-DELIVER`, `QA-2`).
- `SIT-18` **Hosted-app fault** — a hosted tenant app crashes / OOMs / fails health, or needs redeploy or rollback; the builder sees health and recovers it without affecting other tenants' apps or the control plane (`WF-HOST`).
- `SIT-19` **Audit / assessment** — an auditor requests evidence of control operating effectiveness over a period; the Platform must produce complete, timestamped evidence and documentation (`WF-EVIDENCE`, `UJ-17`).
- `SIT-20` **Security incident / data breach** — a suspected compromise or personal-data breach must be detected, contained, assessed, and notified within the required window (GDPR ≤72h; RMF IR) (`WF-INCIDENT`, `UJ-19`).
- `SIT-21` **Data-subject request** — a GDPR access/erasure/portability/rectification request must be identified across all stores and fulfilled within the legal window (`WF-DSR`, `UJ-18`).

## B.4 Outcomes (operational effects, not software outputs)

- `OUT-01` A builder who arrives with only an idea leaves with a **governed, traceable path from intent to executed, test-backed code** — without provisioning a local toolchain, GPU, or editor.
- `OUT-02` Consequential decisions are made by a **responsible human with sufficient context**, and the evidence, uncertainty, and rationale behind each are preserved for later review.
- `OUT-03` A team shares one **coherent operational picture** of a run; work initiated by one member is visible to and governable by another, without contradiction.
- `OUT-04` An enterprise operates the same capability **inside its own trust boundary**, with identity, isolation, residency, retention, and an audit trail sufficient for its compliance obligations.
- `OUT-05` A governor away from their desk can **understand and act on** a raised decision from a phone with the same authority and context as at the desktop.
- `OUT-06` When the normal path is insufficient (bad intent, provider failure, non-convergence), the system **degrades legibly** — it pauses, explains, and offers a governed choice, rather than failing silently or fabricating.
- `OUT-07` Tenants retain **control and portability** of their credentials, intent, and artifacts (export, delete, BYOK).
- `OUT-08` A builder's governed, test-backed project is **delivered to version control** (self-hosted by default; optional tenant remote) and built, with the delivered commit traceable back to the run (`CAP-16`).
- `OUT-09` The built app is **hosted by JanumiCode and publicly reachable over HTTPS** at a subdomain (`<tenant-app-id>-vcs.janumicode.com`) without the tenant provisioning any hosting (`CAP-17`).
- `OUT-10` The Platform is **audit-ready and compliant** — controls operate effectively over a period with evidence and documentation an auditor accepts (SOC 2 Type 2; initial scope Security/Confidentiality/Privacy/Processing Integrity, Availability following HA), RMF **IL4** authorization is supportable for the Enterprise edition, and GDPR obligations (data-subject rights, breach notification, records of processing) are met (`CAP-19`).

## B.5 Capabilities (`CAP-*` — pre-software-allocation)

What the operational system must be able to accomplish, without yet assigning these to software components.

- `CAP-01` **Identity & tenancy** — authenticate humans, resolve them to one or more tenants, and scope every operation to an active tenant.
- `CAP-02` **Intent intake** — accept a product intent as free text plus attachments/references, and preserve it faithfully as the run's source of truth.
- `CAP-03` **Recursive decomposition** — conduct JanumiCode's Phase 1–8 decomposition (intent → journeys → requirements → architecture → data/API → tasks → tests → evaluation) with coverage and traceability guarantees.
- `CAP-04` **Governed interaction** — mediate all human↔harness interaction through tiered capabilities (READ / PROPOSE / GOVERN), never promoting AI capability to authority without a human decision.
- `CAP-05` **Governed-stream presentation** — render the run as a live, resumable, paginated stream of governed records and a navigable decomposition view, identically across web and mobile.
- `CAP-06` **Decision adjudication** — raise consequential decisions to the responsible human with evidence/alternatives/authority limits; capture approve/refine/reject/escalate; propagate the outcome.
- `CAP-07` **Durable orchestration** — advance long-running, resumable runs with exactly-once side effects across restarts and deploys.
- `CAP-08` **Isolated execution** — run generated code, compilers, test runners, and coding agents in a per-tenant isolated sandbox; stream results back; never in a shared process.
- `CAP-09` **Model access** — reach LLMs via BYOK cloud keys, platform-managed metered keys, or private/local endpoints, with per-tenant secret isolation.
- `CAP-10` **File & artifact handling** — ingest attachments and persist generated artifacts with scanning, derivatives, and scoped retrieval.
- `CAP-11` **Collaboration** — let multiple members of a tenant share, view, and govern the same run coherently.
- `CAP-12` **Metering & entitlement** — track usage and enforce plan/quota/spend entitlements; bill where applicable.
- `CAP-13` **Audit & compliance** — record who did/saw/decided what, and enforce residency/retention/export/deletion.
- `CAP-14` **Observability & operations** — trace, meter, and log the Platform itself for its operators (telemetry as a governed, versioned contract — `TECH-OBS-2`); the *tenant-facing* projection is `CAP-20`.
- `CAP-15` **Notification & presence** — reach an absent human (esp. a governor) when their attention or authority is required.
- `CAP-16` **Delivery** — push the completed, governed project to **JanumiCode's self-hosted version control** (default; optional mirror to a tenant remote), build it, and deploy it (`DEC-INTENT-07`, `DEC-INTENT-12`).
- `CAP-17` **Application hosting & public routing** — run a tenant's built app as a long-lived, isolated container with an **isolated managed data plane** (per-app database + object storage, `DEC-INTENT-20`), and route public HTTPS to it by subdomain (Cloudflare `*.janumicode.com` → single-IP Traefik → Host-based container routing) (`DEC-INTENT-11`).
- `CAP-18` **Media delivery** — serve static/uploaded media via signed, expiring URLs: **JanumiCode-session/user-scoped** for platform media, and **deployed-app-session-scoped (or public)** for a hosted app's media (`DEC-INTENT-13`).
- `CAP-19` **Compliance & auditability** — operate under a mapped control framework (SOC 2 TSC / RMF / GDPR), continuously collect evidence of control operation, respond to incidents and data-subject requests, and maintain audit-ready documentation (`DEC-INTENT-14`).
- `CAP-20` **Tenant-facing status, health & service levels** — show a tenant the Platform's live **status** (incidents/maintenance), their own runs'/sandboxes'/hosted-apps' **health**, their **usage/quota**, and **SLO attainment** (measured SLIs; no contractual SLA until HA), and let **Enterprise export their telemetry** to their own stack (`DEC-INTENT-18`, `TECH-OBS-3`/`TECH-OBS-4`).
- `CAP-21` **Agent-facing test & diagnostic feedback** — give coding agents (and other agents/humans) **structured, traceable** test results from unit through E2E, each correlated to its AC/task and to the code-under-test's logs/traces, and **verify** that a passing state genuinely reflects working code (no fabricated passes) — the feedback substrate of the virtuous fix loop (`DEC-INTENT-19`, `UJ-12`).

## B.6 Information & Artifacts

Created, consumed, transformed, validated, preserved, transferred:
- **Product intent** (text + attachments + references) → the immutable run source.
- **Governed-stream records** — the append-only, ordered event log that *is* the authoritative run state; the UI is a pure projection of it.
- **Decomposition artifacts** — the handoff, journeys, requirements (US/AC/NFR), system spec, component model + ADRs, data models, API definitions, tasks, test plans, evaluation criteria, and implementation packets, all ID-linked by `traces_to`.
- **Generated code & test results** — the sandbox's output tree and run logs.
- **Decisions** — raised proposals + human adjudications + rationale.
- **Credentials** — encrypted per-tenant model keys and provider endpoints (secrets, never rendered).
- **Usage & audit records** — metering events and the immutable audit trail.
- **Files & derivatives** — uploaded documents, thumbnails/posters, scan verdicts.

## B.7 Relationships

- A **Tenant** (org) contains **Members** (users with roles) and **Projects**; a **Project** contains **Runs**; a **Run** owns a **governed stream** and, at Phase 9, one or more **Sandbox executions**.
- **Authority flows from human Governors, not from AI capability.** Agents (`A-10..A-14`) may READ and PROPOSE freely; GOVERN-tier effects require a human decision by an actor with the requisite role.
- **Isolation is defined at the data and execution layers**, not by network separation of internal modules (a modular-monolith + RLS + Cerbos model): every record carries a tenant scope; every sandbox belongs to exactly one tenant.
- **The Mobile client and Web client are peers** — both are projections of the same governed stream over the same real-time channel and the same API.

## B.8 System boundaries

**In scope:** identity/tenancy; intent intake; the full decomposition pipeline; governed interaction & adjudication; governed-stream + decomposition-viewer UX on web and mobile; durable orchestration; isolated execution of generated code; **delivery, deployment & hosting — self-hosted version control, build, and running the tenant's app as a long-lived container that JanumiCode hosts and routes to at a `*.janumicode.com` subdomain (`CAP-16`/`CAP-17`, `DEC-INTENT-11/12`)**; **scoped media delivery — platform-session-scoped, deployed-app-session-scoped or public (`CAP-18`)**; model access (BYOK/managed/private); file handling; collaboration; metering/entitlement/billing; audit/compliance; Platform observability; notifications.

**Out of scope (initial):** being a general-purpose IDE; **tenant custom domains** (deferred — `*.janumicode.com` subdomains only for now, `DEC-INTENT-11`); a marketplace of third-party agents/plugins; on-device (mobile) code execution or local model inference on the phone. *(Note: running a self-hosted VCS and hosting the tenant's deployed app on JanumiCode's own single-node infrastructure are now **in scope** — `CAP-16`/`CAP-17` — a correction from the earlier draft.)*

## B.9 Success conditions (observable)

The Operational Concept is successful when:
- `SC-01` A first-time Solo Builder, starting from a browser with only their own model key, reaches a completed, test-backed implementation run **without installing anything locally**.
- `SC-02` Every consequential decision in a completed run has a recorded human adjudication with preserved rationale; **zero** GOVERN-tier effects occurred without one.
- `SC-03` Two members of the same tenant can act on one run and observe a single, non-contradictory operational picture.
- `SC-04` An Enterprise operator stands up a self-hosted deployment that authenticates via their IdP, keeps all data and model traffic within their boundary, and produces an audit trail their compliance officer accepts.
- `SC-05` A governor completes an approve/refine/reject action from a mobile device, and the run advances accordingly.
- `SC-06` Under provider failure, non-convergence, or absent-governor conditions, runs pause with a legible explanation and a governed next-step — verified by fault injection.
- `SC-07` No tenant can observe another tenant's intent, artifacts, credentials, or executing code — verified by isolation tests.
- `SC-08` A governed-approved project is **delivered to version control and goes live as a hosted app** at its `*.janumicode.com` subdomain over HTTPS, isolated from the control plane and other tenants, with the deployed commit traceable to the run (`OUT-08`/`OUT-09`).
- `SC-09` An **external auditor obtains sufficient evidence of control operating effectiveness over the audit period** to support an unqualified SOC 2 Type 2 report; RMF and GDPR obligations are demonstrably met (`OUT-10`).

---
# PART C — EMPLOYMENT MODEL

*How capabilities (`CAP-*`) are actually used to accomplish outcomes under varying conditions. An employment pattern is not a single workflow — it is the doctrine that selects among workflows, actors, and decisions based on situation, risk, authority, and prior results.*

Each pattern below answers the Guideline's 16 questions in compressed form (**T**rigger → **SA** situation assessment → **AUTH** authority → **CS** capability selection → **EX/DEL** execution/delegation → **OBS** observation → **VAL** validation → **DEC** decision fork → **MEM** memory/outcome).

## C.1 `EMP-01` — Initiating and framing a run

- **T:** A human submits an intent (text + attachments/references) into a Project. **SA:** Classify the input (workflow initiation vs conversational query vs slash-command) via the Client Liaison (`A-10`); run the Intent Quality Check (present: *what / who / problem*?). **AUTH:** Any member with the Project *contributor* role may initiate; the initiator is recorded. **CS:** If intent is sufficient → start a decomposition run (`WF-RUN`); if insufficient → raise a clarification (`DEC-02`, Mirror/Menu) rather than proceeding (`SIT-02`). **EX/DEL:** Persist the intent immutably; emit `raw_intent_received` to the governed stream; hand to the orchestrator (`A-14`). **OBS:** The stream shows the run created and Phase 1 beginning. **VAL:** Intent is faithfully preserved and attributions resolvable. **DEC:** Continue / request clarification / cancel. **MEM:** The run's source-of-truth intent + its provenance.

## C.2 `EMP-02` — Governed decomposition advance (Phases 1–8)

- **T:** A run enters/advances a phase. **SA:** Phase agents (`A-11`) read prior artifacts (via the Broker READ tier) and produce the next artifact; deterministic verifiers check coverage and `traces_to` integrity. **AUTH:** Agents hold PROPOSE authority only; phase-exit past a governed gate requires the relevant human authority (`DEC-01`). **CS:** Choose per-phase strategy (e.g., per-component chunking, saturation loops) by artifact size/complexity. **EX/DEL:** Delegate extraction/synthesis to LLM calls (`EMP-08`); run gatekeepers/coherence checks. **OBS:** Stream records + the decomposition viewer update; coverage/gap and finding deltas surface. **VAL:** Blocking invariants (AC presence, `traces_to` resolution, persona→journey→domain→entity linkage, every automatable step backed by a workflow) must pass. **DEC:** Advance / re-derive (on rejection `SIT-06`) / raise decision / pause (non-convergence `EMP-06`). **MEM:** Versioned artifacts + findings, all ID-linked.

## C.3 `EMP-03` — Decision adjudication (the governance core)

- **T:** An agent surfaces a consequential proposal or an unadjudicated finding. **SA:** Classify the decision's **consequence and authority class** (`DEC-01`): reversible/low-stakes vs consequential/irreversible; and which role may decide. **AUTH:** GOVERN-tier effects require a human with the requisite role; agents may *prepare* but not *commit*. **CS:** Assemble the decision packet — the decision to be made, responsible decider, evidence, uncertainty, applicable constraints, alternatives, criteria, authority limits, escalation threshold, required rationale (per Guidelines §7). **EX/DEL:** Present it as a governed decision card in the stream (web/mobile); if the decider is absent, invoke `EMP-09`. **OBS:** The human's choice + rationale are captured. **VAL:** The choice is within the decider's authority; rationale present where required. **DEC:** Approve → propagate; Refine → re-derive with edits; Reject → discard + record; Escalate → route to higher authority; Defer → keep raised. **MEM:** Immutable decision record (proposal + adjudication + rationale + actor + time), feeding audit (`CAP-13`) and drift detection.

## C.4 `EMP-04` — Isolated execution (Phase 9)

- **T:** A run reaches implementation with governed-approved packets. **SA:** Determine required sandbox profile (language/runtime/toolchain, model endpoint, resource budget) and confirm no shared-process execution. **AUTH:** Execution of untrusted code is a GOVERN-gated capability; the tenant's plan/entitlement must permit sandbox compute (`EMP-10`). **CS:** Provision (or reuse) a **per-tenant isolated sandbox worker**; select the coding executor (`A-12`) and its model endpoint (`EMP-08`). **EX/DEL:** Delegate authoring/compiling/testing to the sandbox; stream stdout/results/artifacts back over the run channel. **OBS:** Live execution stream + test/gate results in the governed stream and decomposition viewer. **VAL:** Compile/test/gate outcomes; anti-mock and craft-conformance checks; sandbox-escape guards. **DEC:** Continue / retry step / re-plan (`SIT-04`) / escalate to human / terminate. **MEM:** Generated artifact tree + run logs + evaluation evidence, retained per tenant retention policy; sandbox torn down and its ephemeral state destroyed.

## C.5 `EMP-05` — Degraded provider / model access (`SIT-03`, `SIT-12`)

- **T:** An LLM call fails (rate limit, timeout, 5xx), a key is exhausted, or a spend cap is hit. **SA:** Classify transient vs permanent (`DEC-03`); check remaining budget/quota (`EMP-10`). **AUTH:** Automatic retry/backoff is within agent authority; *changing provider tier, raising spend, or switching a tenant's key* is a human decision. **CS:** Retry with backoff → fail over to an alternate configured endpoint if policy permits → otherwise pause and raise. **EX/DEL:** Bounded exponential-backoff retries; on exhaustion, pause the run at a resumable checkpoint. **OBS:** Provider status surfaced in the stream (never a silent hang). **VAL:** No fabricated content substitutes for a failed call (no-fabrication invariant). **DEC:** Resume / switch endpoint (human) / raise limit (`DEC-05`) / abort. **MEM:** Failure classification + retry history for observability and billing.

## C.6 `EMP-06` — Non-convergence handling (`SIT-05`)

- **T:** A saturation/decomposition or fix loop fails to reach coverage/convergence within its budget. **SA:** Distinguish *model-quality* non-convergence from *harness-misconfiguration* (e.g., timeout too aggressive) from *genuinely-ambiguous intent*. **AUTH:** Extending budget or accepting partial coverage with declared gaps is a human decision. **CS:** Apply the exemplar remedy — chunk-and-reconcile (per-component/per-chunk) before adding backstops; never fabricate to "complete" an artifact. **EX/DEL:** Re-run bounded loops; surface unreached items explicitly as declared gaps. **OBS:** Coverage report + gap list. **VAL:** Declared gaps are explicit, not silent omissions. **DEC:** Continue with declared gaps / extend budget / revise intent / stop. **MEM:** Coverage report + gap adjudications.

## C.7 `EMP-07` — Collaboration & concurrent action (`SIT-09`)

- **T:** Multiple members of a tenant view/act on the same run. **SA:** Determine action authority per member role; detect conflicting concurrent actions. **AUTH:** Role-scoped (Cerbos-style) per project/run; decisions are single-writer per decision item. **CS:** Serialize governance decisions per item (idempotency-keyed); broadcast stream updates to all viewers. **EX/DEL:** Apply the first valid adjudication; reject/duplicate-suppress the rest with a clear message. **OBS:** All members see the same ordered stream and the resulting decision. **VAL:** No two conflicting adjudications both take effect; presence/attribution correct. **DEC:** Accept / reject-as-superseded. **MEM:** Attributed decision + who-saw-what for audit.

## C.8 `EMP-08` — Model-access selection (`DEC-INTENT-03`)

- **T:** Any agent needs an LLM call. **SA:** Resolve the tenant's configured access mode for this project/run: BYOK cloud, platform-managed metered, or private/local endpoint. **AUTH:** Tenant admin configures allowed modes/endpoints; per-run selection stays within that policy. **CS:** Choose endpoint by the **tenant-configured** routing policy (task-tier→model mapping is tenant/project-configurable and overridable per phase — `DEC-INTENT-03`, Q-10) + availability; sensible defaults apply when unset. **EX/DEL:** Call via the resolved credential/endpoint from the per-tenant vault; meter tokens. **OBS:** Model/endpoint used is attributable (not the key itself). **VAL:** Credentials never leave the vault boundary or appear in logs/stream; air-gapped tenants make no outbound calls (`SIT-15`). **DEC:** Route / fail over (`EMP-05`). **MEM:** Metering event (tokens, model, cost) → `CAP-12`.

## C.9 `EMP-09` — Reaching an absent human (`SIT-07`)

- **T:** A decision requires a human who is not present. **SA:** Determine urgency and the eligible deciders + their notification preferences. **AUTH:** The run must **not** proceed past its authority; it pauses at a resumable point. **CS:** Notify eligible governors (push/email/in-app) with a deep link to the decision card. **EX/DEL:** Hold the run; keep the decision actionable from web or mobile. **OBS:** The pending decision is visible in each governor's queue. **VAL:** No autonomous progression past a GOVERN gate while unattended. **DEC:** Human acts (possibly from mobile, `UJ-08`) → resume; timeout → remains pending (never auto-approved). **MEM:** Notification + response latency for SLOs.

## C.10 `EMP-10` — Entitlement & spend enforcement (`SIT-12`)

- **T:** A run consumes metered resources (tokens, sandbox compute, storage). **SA:** Check the tenant's plan entitlements and remaining budget/quota before and during consumption. **AUTH:** Raising a limit or authorizing overage is the Billing/Account Owner's decision (`DEC-05`). **CS:** Allow within budget; approaching ceiling → warn; at ceiling → pause the run gracefully. **EX/DEL:** Enforce quotas at call/provisioning time; record metering. **OBS:** Usage + remaining budget visible. **VAL:** No metered work proceeds past a hard ceiling without authorization. **DEC:** Continue / raise limit / stop. **MEM:** Metering + entitlement decisions → billing + audit.

## C.11 Decision Models (`DEC-*`) — first-class

Consequential decisions are modeled explicitly (Guidelines §7), not buried in prose. Each carries: decider, evidence, uncertainty, constraints, alternatives, criteria, authority limits, escalation threshold, required rationale.

- `DEC-01` **Auto-apply vs raise-for-governance.** *Decider:* the harness policy proposes; a human confirms consequential/irreversible items. *Criteria:* consequence (reversible? blast radius?), authority class, tenant policy. *Escalation:* if unclear, raise rather than act (`Agent Capability ≠ Agent Authority`). *This is the load-bearing decision model of the whole product.*
- `DEC-02` **Clarify vs proceed on incomplete intent.** *Decider:* Client Liaison proposes; human confirms via Mirror/Menu. *Criteria:* are *what/who/problem* present; is the gap material. *Rationale required:* yes, when proceeding despite a gap.
- `DEC-03` **Retry vs escalate vs abort on failure/non-convergence.** *Decider:* agent within bounded retry budget; human beyond it. *Criteria:* transient vs permanent; budget remaining; convergence trend.
- `DEC-04` **Grant support access to a tenant's run.** *Decider:* Tenant Admin (Cloud). *Criteria:* explicit, time-boxed, audited consent; least-privilege scope. *Default:* deny.
- `DEC-05` **Proceed past a spend/quota ceiling.** *Decider:* Billing/Account Owner. *Criteria:* remaining value of the run vs overage cost; hard vs soft cap.
- `DEC-06` **Accept a completed run with declared coverage gaps.** *Decider:* Governor. *Criteria:* materiality of each declared gap; risk to `A-09` (downstream inheritors of the code).
- `DEC-07` **Provision/route model access mode.** *Decider:* Tenant Admin sets policy; per-run selection within it. *Criteria:* residency (`SIT-15`), cost, capability tier.

---
# PART D — DERIVED VIEWS

*Projections of Parts B–C, rendered in JanumiCode's decomposable form. None of these independently defines the system; each traces up to an operational need and down to requirements.*

## D.0 Derived views required (and why)

| View | Needed? | Why |
|---|---|---|
| **Personas** (`P-*`) | Required | Multi-actor operation with distinct authority (builder ≠ governor ≠ admin ≠ operator). Single-actor bias would hide the governance and enterprise-ops realities. |
| **User Journeys** (`UJ-*`) | Required | Actor-centered paths through the operational world; the primary decomposition seed for requirements + ACs. Multiple journeys are *views of the same run* and must stay consistent. |
| **System Scenarios** (`SCN-*`) | Required | Several journeys describe one operational event (e.g., a governed run) from different actors; scenarios keep them coherent and expose degraded/exception paths. |
| **Workflows** (`WF-*`) | Required | The employment patterns are inherently stateful, durable, and resumable (runs, execution, uploads, billing). This is the executable-decomposition layer. |
| **Decision Models** (`DEC-*`) | Required | Governance *is* the product; the capability-vs-authority decisions must be explicit, not buried in workflow arrows. (Authored in Part C.11.) |
| **Service Blueprints** (`SB-*`) | Required (selective) | The gap between an actor's experience and the backstage machinery (agents, sandbox, providers) is large and is where most risk lives; blueprint the highest-stakes journeys. |
| **Recursive work-unit model** | Referenced | The *product itself* is a Recursive Professional Harness for software (Guidelines §8); its recursive nature is JanumiCode's existing decomposition tree and is preserved, not re-modeled here. |

## D.1 Personas

*Completeness: operators, approvers, service-side/AI actors, and admins are all represented. Every persona initiates ≥1 journey (see D.3 coverage matrix).*

- `P-01` **Solo Builder ("Ravi")** *(actor `A-01`, also `A-03` for their own tenant)* — indie developer/founder turning ideas into shipped software. **Goals:** go idea→deployed code without local toolchain/GPU; stay in control of decisions and keys. **Pain:** editor/GPU setup friction; opaque AI that acts without asking; losing work on a crash.
- `P-02` **Team Contributor ("Dana")** *(`A-02`)* — engineer on a small team sharing projects/runs. **Goals:** pick up a teammate's run; contribute without stepping on others. **Pain:** conflicting edits; no shared picture of an in-flight run.
- `P-03` **Team Governor ("Mara")** *(`A-03`)* — tech lead who adjudicates consequential proposals. **Goals:** enough context to decide fast and correctly; preserved rationale for later review. **Pain:** decisions demanded without evidence; being a bottleneck when away from desk.
- `P-04` **Organization Admin ("Owen")** *(`A-04`)* — provisions members, roles, projects, credential vaults, policy. **Goals:** least-privilege access; safe shared key management. **Pain:** manual user churn; keys sprawled in configs.
- `P-05` **Billing / Account Owner ("Bea")** *(`A-05`)* — owns subscription and spend. **Goals:** predictable cost; guardrails before overspend. **Pain:** surprise bills; no per-project cost visibility.
- `P-06` **Enterprise Platform Operator ("Elena")** *(`A-06`)* — SRE who installs/runs the self-hosted deployment. **Goals:** reproducible install/upgrade; runs inside the trust boundary; observable health. **Pain:** bespoke deploys; hidden external calls.
- `P-07` **Enterprise Security/Compliance Officer ("Sam")** *(`A-07`)* — sets residency/retention/SSO/audit policy. **Goals:** SSO enforcement; complete audit trail; residency guarantees; verifiable deletion. **Pain:** unauditable AI actions; data leaving the boundary.
- `P-08` **Platform Operator — JanumiCode staff ("Priya")** *(`A-08`)* — operates the Cloud. **Goals:** keep the fleet healthy; help tenants without violating isolation. **Pain:** debugging blind; needing tenant data without consent.
- `P-09` **Mobile Governor ("Marco")** *(`A-03` on mobile)* — a governor acting from a phone. **Goals:** understand and act on a raised decision on the go with full context/authority. **Pain:** desktop-only approvals stalling runs.

> The AI actors (`A-10..A-14`) are modeled as operational actors and in the Employment Model, not as personas (they have capability, not authority — Guidelines Anti-Pattern *Automation Bias*).

## D.2 Product structure (Pillars)

Three pillars, each a distinct customer + problem, phased across releases (Part D-Phasing).

| Pillar | Target customer | Core problem solved | Dominant domains | Lead release |
|---|---|---|---|---|
| **Pillar 1 — Solo & Team Cloud (BYOK)** | Individuals & small teams | "I want to go from idea to governed, executed code from a browser, using my own model keys, with no local setup." | Identity/Tenancy, Intake, Decomposition-Run, Execution-Sandbox, Governed-Stream UX, Credentials, Collaboration | `REL-1` |
| **Pillar 2 — Self-hosted (Community & Enterprise)** | Self-hosters (OSS, single-tenant) and organizations/regulated industries | "Run the same capability inside our own boundary — free & open-source for a single tenant (**Community**, AGPL-3.0), or commercially with SSO, multi-tenant isolation, residency, retention, private models, and a compliance-grade audit trail (**Enterprise**, `ee/`)." | Identity/Tenancy (SSO), Model-Access (private), Audit/Compliance, Observability, Admin | `REL-2` |
| **Pillar 3 — Mobile Governance & Presence** | All audiences | "Let me monitor, initiate, and *govern* work — and act on raised decisions — from my phone." | Governed-Stream UX (mobile), Decision-Adjudication, Notification/Presence | `REL-3` |

---
## D.3 User Journeys

*Each journey is a projection of one operational event; journeys of the same run must stay mutually consistent (see `SCN-*`). Steps flagged `⚙automatable` are backed by a workflow (`WF-*`) with a matching trigger. ACs are verification-shaped (observable), not policy-shaped.*

### `UJ-01` — Solo Builder's first governed run (P-01) · Release `REL-1` · Priority: Critical
**Situation:** `SIT-01`. **Outcome:** `OUT-01`.
**Scenario:** Ravi signs up, adds his own model key, submits an intent, governs the run through decomposition and execution, and ends with test-backed code — all in a browser.
**Steps:**
1. Ravi *(A-01)* — signs up and creates a tenant-of-one. → Account + default tenant exist. ⚙automatable (`WF-TENANT-PROVISION`)
2. Ravi — adds a BYOK cloud model key in the credential vault. → Key stored encrypted; a validation call succeeds. ⚙automatable (`WF-CRED-VALIDATE`)
3. Ravi — creates a Project and submits a product-intent document (text + attachment). → `raw_intent_received` appears in the governed stream. ⚙automatable (`WF-RUN`)
4. System *(A-11)* — decomposes Phases 1–8, streaming records. → Journeys/requirements/architecture/etc. appear with coverage indicators. ⚙automatable (`WF-RUN`, `WF-DECOMP-PHASE`)
5. Ravi *(A-03 for own tenant)* — governs each raised decision (approve/refine). → Each decision records his adjudication + rationale. ⚙automatable (`WF-DECISION`)
6. System *(A-12)* — executes approved packets in an isolated sandbox, streaming results. → Generated code + passing tests appear. ⚙automatable (`WF-EXEC`)
7. Ravi — reviews the completed run and exports the artifact. → Downloadable artifact + traceability report. ⚙automatable (`WF-EXPORT`)
**Acceptance Criteria:**
- `AC-UJ01-1` A new user completes signup→first `raw_intent_received` with **no local software installed** (browser only).
- `AC-UJ01-2` A stored model key is encrypted at rest and **never** returned in any API response, log, or stream record (assert redaction).
- `AC-UJ01-3` Every GOVERN-tier decision in the run has exactly one recorded human adjudication before its downstream effect is applied.
- `AC-UJ01-4` On run completion, the exported artifact includes generated code, test results, and an intent→…→validation traceability report.

### `UJ-02` — Clarifying incomplete intent (P-01) · `REL-1` · High
**Situation:** `SIT-02`. **Decision:** `DEC-02`.
**Scenario:** Ravi submits a thin intent missing "who it serves"; the system asks rather than inventing.
**Steps:**
1. Ravi — submits an intent lacking a stated user/beneficiary. → Intake runs the quality check. ⚙automatable (`WF-RUN`)
2. System *(A-10)* — raises a Mirror/Menu clarification identifying the specific gap. → A clarification card appears; the run pauses. ⚙automatable (`WF-DECISION`)
3. Ravi — answers, or authorizes a system-proposed candidate. → Intent updated with provenance; run resumes. ⚙automatable (`WF-DECISION`)
**Acceptance Criteria:**
- `AC-UJ02-1` When any of {what, who, problem} is absent, the system raises a clarification and does **not** advance past Phase 1.
- `AC-UJ02-2` System-proposed candidates are marked as proposals requiring explicit authorization, distinct from user-authored intent.
- `AC-UJ02-3` No decomposition artifact is produced from a gap that was filled by silent invention (assert provenance on filled fields).

### `UJ-03` — Team collaboration on a shared run (P-02) · `REL-1` · High
**Situation:** `SIT-09`. **Outcome:** `OUT-03`. **Employment:** `EMP-07`.
**Scenario:** Dana opens a run started by a teammate and contributes while the teammate is also active.
**Steps:**
1. Dana *(A-02)* — opens a Project run shared within the tenant. → She sees the full ordered governed stream and current phase. ⚙automatable (`WF-STREAM-SUBSCRIBE`)
2. Two members — act on different decisions concurrently. → Each valid action applies once; conflicts on the same item are resolved deterministically. ⚙automatable (`WF-DECISION`)
3. Dana — sees a teammate's just-applied decision live. → Stream updates for all viewers within the freshness target. ⚙automatable (`WF-STREAM-BROADCAST`)
**Acceptance Criteria:**
- `AC-UJ03-1` Two members viewing one run observe the same ordered stream; no member sees a record another does not (given equal authority).
- `AC-UJ03-2` Two conflicting adjudications of the same decision item never both take effect; the superseded one returns a clear "already decided" result.
- `AC-UJ03-3` A decision applied by one member is reflected in another member's live view within `VV-RT-1`'s latency target.

### `UJ-04` — Governor adjudicates a consequential decision (P-03) · `REL-1` · Critical
**Situation:** `SIT-06`. **Outcome:** `OUT-02`. **Employment:** `EMP-03`. **Decision:** `DEC-01`.
**Scenario:** Mara is presented an architecture proposal with alternatives and evidence, and refines it.
**Steps:**
1. System *(A-13)* — surfaces a decision card: the decision, evidence, uncertainty, alternatives, authority limits, required rationale. → Card appears in Mara's queue. ⚙automatable (`WF-DECISION`)
2. Mara *(A-03)* — reviews evidence and chooses Refine, editing the proposal. → Her edit + rationale are captured. ⚙automatable (`WF-DECISION`)
3. System — re-derives affected downstream artifacts. → Impacted artifacts are re-generated and re-linked. ⚙automatable (`WF-DECOMP-PHASE`)
**Acceptance Criteria:**
- `AC-UJ04-1` Every decision card presents at minimum: the decision statement, ≥1 piece of evidence, available alternatives, and the decider's authority scope.
- `AC-UJ04-2` A Refine action re-derives only artifacts that `traces_to` the changed item (assert scope of re-derivation).
- `AC-UJ04-3` A decision cannot be committed by a user whose role lacks authority for that decision class (assert 403-equivalent).

### `UJ-05` — Org Admin provisions members, roles, and a credential vault (P-04) · `REL-1` · High
**Situation:** `SIT-10`. **Scenario:** Owen invites members, assigns roles, and configures a shared model-key vault scoped to a project.
**Steps:**
1. Owen *(A-04)* — invites members by email/code and assigns roles. → Invitations issued; on acceptance, members gain role-scoped access. ⚙automatable (`WF-INVITATION`)
2. Owen — adds a shared model key to a project-scoped vault. → Key stored encrypted; usable by runs in that project only. ⚙automatable (`WF-CRED-VALIDATE`)
3. Owen — revokes a departing member. → Their access ends immediately across web/mobile/API. ⚙automatable (`WF-MEMBER-REVOKE`)
**Acceptance Criteria:**
- `AC-UJ05-1` A member's effective permissions equal exactly their assigned role's policy for the active tenant (assert allow/deny per action).
- `AC-UJ05-2` A revoked member's next request (any surface) is denied within the session-revocation target.
- `AC-UJ05-3` A project-scoped key is usable by runs in that project and **rejected** for runs in any other project/tenant.

### `UJ-06` — Billing Owner sets budgets and hits a spend ceiling (P-05) · `REL-1` (metering) / `REL-2` (billing) · High
**Situation:** `SIT-12`. **Employment:** `EMP-10`. **Decision:** `DEC-05`.
**Steps:**
1. Bea *(A-05)* — sets a monthly spend cap and per-project quota. → Caps stored and enforced. ⚙automatable (`WF-ENTITLEMENT`)
2. System — a run approaches the cap. → Bea is warned at the configured threshold. ⚙automatable (`WF-METER`)
3. System — a run reaches a hard cap mid-execution. → The run pauses gracefully at a resumable point; Bea is offered raise-limit or stop. ⚙automatable (`WF-METER`, `WF-EXEC`)
**Acceptance Criteria:**
- `AC-UJ06-1` Metered usage (tokens, sandbox-minutes, storage) is recorded per run and attributable to a project (assert non-zero, correct attribution).
- `AC-UJ06-2` No metered work proceeds past a hard cap without an explicit raise-limit authorization by the Billing Owner.
- `AC-UJ06-3` A run paused at a cap resumes from its last checkpoint with no duplicated side effects after the limit is raised.

### `UJ-07` — Enterprise Operator installs and upgrades a self-hosted deployment (P-06) · `REL-2` · Critical
**Situation:** `SIT-15`. **Outcome:** `OUT-04`. **Scenario:** Elena stands up the Platform inside her network, connects the IdP, and later upgrades.
**Steps:**
1. Elena *(A-06)* — deploys via the published compose/container bundle with a config file. → All services start and pass health checks. ⚙automatable (`WF-HEALTH`)
2. Elena — points the deployment at the org IdP and private model endpoint. → SSO login and a private-model test call succeed. ⚙automatable (`WF-CRED-VALIDATE`)
3. Elena — performs a version upgrade with schema migration. → Upgrade completes with no data loss; migration is idempotent. ⚙automatable (`WF-MIGRATE`)
**Acceptance Criteria:**
- `AC-UJ07-1` A clean install reaches all-services-healthy from the published bundle following the documented steps only.
- `AC-UJ07-2` With air-gapped mode enabled, the deployment makes **zero** outbound network connections (assert via egress monitor).
- `AC-UJ07-3` A version upgrade preserves all existing tenants/projects/runs and re-runs migrations idempotently.

### `UJ-08` — Mobile Governor acts on a raised decision (P-09) · `REL-3` · Critical
**Situation:** `SIT-07`. **Outcome:** `OUT-05`. **Employment:** `EMP-09`.
**Scenario:** Marco receives a push that a run needs a decision and adjudicates from his phone.
**Steps:**
1. System *(A-14)* — a run pauses at a GOVERN gate with no one present; notifies eligible governors. → Marco receives a push with a deep link. ⚙automatable (`WF-NOTIFY`)
2. Marco *(A-03)* — opens the decision card on mobile with full context. → He sees the same evidence/alternatives as on desktop. ⚙automatable (`WF-STREAM-SUBSCRIBE`)
3. Marco — approves. → The run resumes; his adjudication is recorded. ⚙automatable (`WF-DECISION`)
**Acceptance Criteria:**
- `AC-UJ08-1` A decision card renders on a mobile viewport with the same decision statement, evidence, and alternatives as the web card (content parity).
- `AC-UJ08-2` A mobile adjudication resumes the paused run and is attributed to the acting governor.
- `AC-UJ08-3` While unattended at a GOVERN gate, a run never auto-advances; a notification-timeout leaves it pending, not approved.

### `UJ-09` — Security Officer configures SSO/residency/retention and reviews audit (P-07) · `REL-2` · Critical
**Situation:** `SIT-13`, `SIT-14`. **Outcome:** `OUT-04`. **Compliance:** `COMP-*`.
**Steps:**
1. Sam *(A-07)* — enforces SSO and sets a data-residency zone and retention policy. → New logins require SSO; data/processing pin to the zone. ⚙automatable (`WF-POLICY`)
2. Sam — reviews the audit log for a period. → A complete, tamper-evident record of who-did/saw/decided-what is available and exportable. ⚙automatable (`WF-AUDIT-EXPORT`)
3. Sam — triggers retention-based purge of expired data. → Expired artifacts are deleted and the deletion is logged. ⚙automatable (`WF-RETENTION`)
**Acceptance Criteria:**
- `AC-UJ09-1` With SSO enforced, password login is rejected for all org members (assert no non-SSO path succeeds).
- `AC-UJ09-2` The audit log contains an entry for every decision, credential access, and support-access grant, each with actor + timestamp; entries are append-only.
- `AC-UJ09-3` Data assigned to a residency zone is neither stored nor processed outside that zone (assert storage + compute locality).

### `UJ-10` — Consented support access to a tenant run (P-08 + P-04) · `REL-1` · Medium
**Situation:** `SIT-13`. **Decision:** `DEC-04`.
**Steps:**
1. Priya *(A-08)* — requests support access to a tenant's run to diagnose an issue. → A consent request reaches the Tenant Admin. ⚙automatable (`WF-SUPPORT-ACCESS`)
2. Owen *(A-04)* — grants time-boxed, scoped consent. → Priya gains read-only, time-limited access to that run only. ⚙automatable (`WF-SUPPORT-ACCESS`)
3. System — consent expires. → Priya's access ends automatically; the whole episode is audited. ⚙automatable (`WF-SUPPORT-ACCESS`)
**Acceptance Criteria:**
- `AC-UJ10-1` No platform operator can read tenant intent/artifacts/credentials without an active, unexpired consent grant (assert default-deny).
- `AC-UJ10-2` A support grant is scoped to a single run, is read-only by default, and expires automatically at its time box.
- `AC-UJ10-3` The request, grant, all accesses, and expiry are individually audited.

### `UJ-11` — Resume after interruption (P-01/P-02) · `REL-1` · Critical
**Situation:** `SIT-11`. **Driver:** `WF-RUN` durable checkpointing (`TECH-WF-1`, `CAP-07`).
**Steps:**
1. System — server restart/deploy occurs mid-run. → In-flight runs are checkpointed durably. ⚙automatable (`WF-RUN`)
2. Ravi — reconnects the client after a network drop. → The stream resumes from his last position without gaps or duplicates. ⚙automatable (`WF-STREAM-SUBSCRIBE`)
3. System — the orchestrator continues the run. → The run advances from its last durable step; no step re-executes its side effects. ⚙automatable (`WF-RUN`)
**Acceptance Criteria:**
- `AC-UJ11-1` After a control-plane restart, every in-flight run resumes to completion with each side effect executed exactly once.
- `AC-UJ11-2` A client reconnect replays no already-seen records and drops no records (assert stream continuity via keyset position).

### `UJ-12` — Isolated execution with a failing test → governed re-plan (P-01/P-03) · `REL-1` · Critical
**Situation:** `SIT-04`. **Employment:** `EMP-04`, `EMP-06`.
**Steps:**
1. System *(A-12)* — executes a task packet in a per-tenant sandbox; a test fails. → Failure + logs stream to the run. ⚙automatable (`WF-EXEC`)
2. System — attempts a bounded fix loop. → Either tests pass, or the loop hits its budget without converging. ⚙automatable (`WF-EXEC`)
3. On non-convergence — the system raises a governed choice (re-plan / extend budget / accept-with-gap / stop). → Mara decides. ⚙automatable (`WF-DECISION`)
**Acceptance Criteria:**
- `AC-UJ12-1` Generated code executes only inside a per-tenant sandbox; a sandbox cannot read another tenant's data or the control plane's secrets (assert isolation + escape guard).
- `AC-UJ12-2` A fix loop is bounded; on non-convergence the run pauses and raises a governed decision rather than looping indefinitely or fabricating a pass.
- `AC-UJ12-3` Sandbox ephemeral state is destroyed on teardown; only declared artifacts persist.

### `UJ-13` — Export and delete all tenant data (P-04/P-07) · `REL-2` · High
**Situation:** `SIT-14`. **Outcome:** `OUT-07`. **Compliance:** `COMP-DEL-1`.
**Steps:**
1. Owen/Sam — requests a full tenant export. → A complete archive (intents, artifacts, decisions, audit) is produced. ⚙automatable (`WF-EXPORT`)
2. Owen/Sam — requests full tenant deletion. → All tenant data is deleted; a deletion certificate is issued. ⚙automatable (`WF-RETENTION`)
**Acceptance Criteria:**
- `AC-UJ13-1` An export archive round-trips: its contents match what the tenant can see in the product (assert completeness).
- `AC-UJ13-2` After deletion, no tenant-scoped record remains queryable in any store (assert across DB + object storage), and a signed deletion certificate is returned.

### `UJ-14` — Configure a private/local model endpoint (P-06/P-04) · `REL-2` · High
**Situation:** `SIT-15`. **Employment:** `EMP-08`. **Decision:** `DEC-07`.
**Steps:**
1. Owen/Elena — registers a private model endpoint (Ollama/llama.cpp/vLLM) for a project. → A test call to the endpoint succeeds. ⚙automatable (`WF-CRED-VALIDATE`)
2. Owen/Elena — sets project policy to use the private endpoint. → Subsequent runs route all LLM calls to it. ⚙automatable (`WF-POLICY`)
**Acceptance Criteria:**
- `AC-UJ14-1` A run configured for a private endpoint issues **no** calls to any cloud provider (assert egress).
- `AC-UJ14-2` Endpoint credentials/URLs are stored in the per-tenant vault and never appear in stream/logs.

### `UJ-15` — Deliver, deploy & host the generated project (P-01/P-02) · `REL-1` · High
**Situation:** `SIT-01` (completion). **Outcome:** `OUT-08` (delivery) + `OUT-09` (hosted & reachable). **Capability:** `CAP-16`, `CAP-17`.
**Scenario:** After a governed-approved run, Ravi (or Dana) pushes to version control, builds, and deploys — and the app goes live at a JanumiCode subdomain.
**Steps:**
1. Ravi/Dana — sets up version control (a self-hosted git repo is created; optionally connects a tenant remote). → Repository ready; any remote validated. ⚙automatable (`WF-REPO-PROVISION`)
2. On a governed-approved run — requests delivery. → Project pushed to the git repo on a branch; a delivery record + link appear in the stream. ⚙automatable (`WF-DELIVER`)
3. Ravi/Dana — requests deploy. → The app is built into a container image and deployed. ⚙automatable (`WF-DELIVER`)
4. System — runs the app as a long-lived container and registers its route. → The app is live and publicly reachable at `<tenant-app-id>-vcs.janumicode.com`. ⚙automatable (`WF-HOST`)
**Acceptance Criteria:**
- `AC-UJ15-1` Delivery pushes only governed-approved artifacts to version control using tenant-scoped credentials from the vault (assert credentials tenant-scoped and not logged).
- `AC-UJ15-2` A delivery is traceable: the pushed commit/branch links back to the run and its traceability report (assert linkage).
- `AC-UJ15-3` A deploy/host action starts only on an explicit governed request; the Platform never auto-deploys without a human decision (assert no autonomous deploy).
- `AC-UJ15-4` After deploy, the app is reachable over HTTPS at its `<tenant-app-id>-vcs.janumicode.com` subdomain, and its container cannot reach the control plane or another tenant's app/data (assert reachability + isolation).

### `UJ-16` — Manage a hosted app (P-01/P-02) · `REL-1` · High
**Situation:** `SIT-18`. **Outcome:** `OUT-09`. **Capability:** `CAP-17`.
**Scenario:** Ravi views his hosted app's health, deploys a new version, and can roll back, stop, or delete it.
**Steps:**
1. Ravi — views the hosted app's status and health. → Current version, health, and route are shown. ⚙automatable (`WF-HOST`)
2. Ravi — deploys a new governed-approved version. → The new container replaces the old with no route change; a redeploy record appears. ⚙automatable (`WF-HOST`)
3. Ravi — rolls back to a prior version, or stops the app. → The prior version is restored (or the app stopped) and the route updated. ⚙automatable (`WF-HOST`)
4. Ravi — deletes the app when done. → The app is stopped and its data plane (database + bucket + credentials) is deprovisioned with no residue. ⚙automatable (`WF-HOST`)
**Acceptance Criteria:**
- `AC-UJ16-1` A redeploy swaps the running container for the new version while preserving the subdomain route (assert route continuity).
- `AC-UJ16-2` A rollback restores a previously-deployed version; a stop makes the subdomain return a clear unavailable response (assert both).
- `AC-UJ16-3` Hosted-app management actions are authorized (only roles with hosting authority) and audited (assert 403 for unauthorized; audit entry present).
- `AC-UJ16-4` Deleting a hosted app deprovisions its data plane — database dropped, bucket deleted, per-app credentials revoked — with a post-delete sweep showing 0 residual records (`VV-ISO-3`, `VV-DEL-1`).

### `UJ-17` — Auditor evidence review (P-07 + A-22) · `REL-2` · Critical
**Situation:** `SIT-19`. **Outcome:** `OUT-10`. **Capability:** `CAP-19`.
**Scenario:** Sam produces control evidence for an audit period; an external auditor examines it and confirms control operating effectiveness.
**Steps:**
1. System *(A-14)* — continuously collects timestamped control evidence over the period. → An evidence record accrues per control. ⚙automatable (`WF-EVIDENCE`)
2. Sam *(A-07)* — grants an auditor read-only, scoped, time-boxed access to evidence + documentation. → The auditor (`A-22`) can review, nothing else. ⚙automatable (`WF-SUPPORT-ACCESS`)
3. Auditor — samples controls and confirms each operated throughout the period. → Coverage + exceptions are recorded. ⚙automatable (`WF-AUDIT-EXPORT`)
**Acceptance Criteria:**
- `AC-UJ17-1` Every in-scope control has complete, timestamped evidence spanning the full audit period (assert no gaps).
- `AC-UJ17-2` Auditor access is read-only, scoped to evidence/documentation, time-boxed, and fully audited (assert least-privilege + audit entries).
- `AC-UJ17-3` The audit log backing the evidence is append-only and tamper-evident (assert integrity).

### `UJ-18` — Data-subject request (P-07 + A-23) · `REL-2` · High
**Situation:** `SIT-21`. **Outcome:** `OUT-10`. **Capability:** `CAP-19`, `CAP-13`.
**Scenario:** A data subject requests access to (or erasure of) their personal data; it is located across all stores and fulfilled within the legal window.
**Steps:**
1. Sam *(A-07)* — receives a verified data-subject (`A-23`) request. → A DSR record is opened with a due date. ⚙automatable (`WF-DSR`)
2. System — locates all personal data for the subject across DB, object storage, logs, and backups. → A complete data map is produced. ⚙automatable (`WF-DSR`)
3. System — fulfills the request (export / erase / rectify / port) and logs it. → The subject receives the result; the action is audited. ⚙automatable (`WF-DSR`)
**Acceptance Criteria:**
- `AC-UJ18-1` A DSR is fulfilled within the legal window (GDPR ≤30 days) (assert timeliness).
- `AC-UJ18-2` An erasure request removes the subject's personal data from all stores incl. backups per policy (assert completeness), with a certificate.
- `AC-UJ18-3` The request, data map, and fulfillment are audited; identity is verified before fulfillment (assert verification + audit).

### `UJ-19` — Incident / breach response (P-07) · `REL-1` · Critical
**Situation:** `SIT-20`. **Outcome:** `OUT-10`. **Capability:** `CAP-19`.
**Scenario:** A suspected breach is detected; the team contains it, assesses impact, and notifies within the required window.
**Steps:**
1. System *(A-14/A-19)* — detects an anomaly/indicator and raises an incident. → An incident record opens with severity + timeline. ⚙automatable (`WF-INCIDENT`)
2. Sam *(A-07)* — triages, contains, and assesses whether personal data was affected. → Containment + impact assessment recorded. ⚙automatable (`WF-INCIDENT`)
3. System — on a reportable breach, notifies regulator + affected parties within the window, then remediation + post-mortem. → Notifications sent + logged; corrective actions tracked. ⚙automatable (`WF-INCIDENT`, `WF-NOTIFY`)
**Acceptance Criteria:**
- `AC-UJ19-1` A reportable personal-data breach is notified within the required window (GDPR ≤72h) (assert timeliness via drill).
- `AC-UJ19-2` The incident lifecycle (detect→contain→assess→notify→remediate→post-mortem) is fully recorded and audited (assert completeness).
- `AC-UJ19-3` Containment isolates the affected scope without exposing other tenants (assert isolation preserved).

### D.3.1 Coverage matrix (persona → journeys → domains)
Every persona initiates ≥1 journey; every domain (D.4) hosts ≥1 journey and ≥1 workflow. Declared non-initiating actors: `A-09` (Affected Non-User), `A-20`/`A-21` (deployed-app end users / Cloudflare edge), and `A-22`/`A-23` (auditor / data subject — they participate in `UJ-17`/`UJ-18` but the initiating persona is `P-07`) — represented via outcomes/workflows (e.g., `OUT-01`/`OUT-09`/`OUT-10`, `WF-HOST`/`WF-MEDIA-SERVE`/`WF-EVIDENCE`), not as `P-*` personas.

| Persona | Journeys | Persona | Journeys |
|---|---|---|---|
| P-01 | UJ-01, UJ-02, UJ-11, UJ-12, UJ-15, UJ-16 | P-05 | UJ-06 |
| P-02 | UJ-03, UJ-11, UJ-15, UJ-16 | P-06 | UJ-07, UJ-14 |
| P-03 | UJ-04, UJ-12 | P-07 | UJ-09, UJ-13, UJ-17, UJ-18, UJ-19 |
| P-04 | UJ-05, UJ-10, UJ-13, UJ-14 | P-08 | UJ-10 |
| P-09 | UJ-08 | | |

---
## D.4 Common Data Model (Business Domains & Entities)

*Numbered domains; each hosts ≥1 journey and ≥1 workflow. Entities carry `ENT-*` IDs and `businessDomainId`. Foreign keys use exact-string IDs. This is a domain model, not a schema — Phase 5 derives fields/relations/constraints.*

### `BD-01` — Identity & Tenancy
*Hosts: UJ-05, UJ-07, UJ-09; Workflows: WF-TENANT-PROVISION, WF-INVITATION, WF-MEMBER-REVOKE.*
**Entities**
- `ENT-TENANT` **Tenant/Organization** — root isolation entity; type {solo, team, enterprise}, status, settings, residency zone.
- `ENT-USER` **User** — a human identity (email, auth provider); global, not tenant-scoped.
- `ENT-MEMBERSHIP` **Membership** — junction User↔Tenant with role and default flag.
- `ENT-ROLE` **Role** — named permission set within a tenant (Owner, Admin, Governor, Contributor, Viewer, BillingOwner, SecurityOfficer).
- `ENT-INVITATION` **Invitation** — pending membership (code/email, single-use, expiry).
- `ENT-SESSION` **Session** — authenticated session (opaque token; SSO-linked for Enterprise).
- `ENT-SSO-CONNECTION` **SSO Connection** *(Enterprise)* — IdP config (OIDC/SAML) bound to a tenant.
**Requirements**
- Every operational record is scoped to exactly one `ENT-TENANT`; cross-tenant reads are impossible at the data layer.
- A user may belong to multiple tenants and must select an active tenant per operation.
- Enterprise tenants can enforce SSO-only login and disable password auth.

### `BD-02` — Projects & Runs
*Hosts: UJ-01, UJ-03, UJ-11; Workflows: WF-RUN.*
**Entities**
- `ENT-PROJECT` **Project** — a container of runs within a tenant; owns default model-access policy and shared vault scope.
- `ENT-RUN` **Run** — one decomposition+execution instance; owns a governed stream; has phase state, status {active, paused, completed, failed, cancelled}, resumable checkpoint.
- `ENT-RUN-CHECKPOINT` **Run Checkpoint** — durable resumption point for `SIT-11`.
- `ENT-PHASE-STATE` **Phase State** — per-phase status/coverage within a run.
**Requirements**
- A run is resumable from its last checkpoint after control-plane restart with exactly-once side effects.
- A run belongs to exactly one project and inherits its model-access + entitlement policy.

### `BD-03` — Product Intent & Intake
*Hosts: UJ-01, UJ-02; Workflows: WF-RUN (intake sub-phase).*
**Entities**
- `ENT-INTENT` **Product Intent** — immutable source (text + attachment refs + `@`-references) for a run.
- `ENT-INTENT-ATTACHMENT` **Intent Attachment** — link to an uploaded file (`ENT-FILE`).
- `ENT-CLARIFICATION` **Clarification** — a raised Mirror/Menu gap + its resolution provenance (user-authored vs authorized-proposal).
**Requirements**
- Intent is preserved verbatim and is the run's traceability root.
- Fields filled from a gap carry provenance distinguishing human input from authorized system proposals; nothing is silently invented.

### `BD-04` — Decomposition Artifacts & Governed Stream
*Hosts: UJ-01, UJ-04; Workflows: WF-DECOMP-PHASE, WF-STREAM-SUBSCRIBE, WF-STREAM-BROADCAST.*
**Entities**
- `ENT-STREAM-RECORD` **Governed-Stream Record** — append-only, ordered, keyset-indexed event; the authoritative run state the UI projects. Types incl. intent, phase updates, artifacts, decisions, execution results, findings.
- `ENT-ARTIFACT` **Decomposition Artifact** — a produced artifact (handoff, journeys, requirements, system spec, component model, ADRs, data models, API defs, tasks, test plans, evaluation criteria, implementation packets), versioned and `traces_to`-linked.
- `ENT-TRACE-LINK` **Trace Link** — a `traces_to` edge between artifacts/IDs enabling coverage + drift detection.
- `ENT-FINDING` **Finding** — a validator/coherence finding bound to cited artifact IDs, adjudicable.
- `ENT-COVERAGE-REPORT` **Coverage Report** — per-phase coverage + declared gaps.
**Requirements**
- The stream is append-only and totally ordered per run; clients page by keyset and resume by position.
- Every requirement/component/data-model/task/test carries resolvable `traces_to`; dangling links are blocking.

### `BD-05` — Governance & Decisions
*Hosts: UJ-01, UJ-02, UJ-04, UJ-08, UJ-12; Workflows: WF-DECISION.*
**Entities**
- `ENT-DECISION` **Decision** — a raised proposal: statement, evidence, uncertainty, alternatives, applicable constraints, criteria, authority class, escalation threshold, required-rationale flag, status {pending, approved, refined, rejected, escalated, deferred}.
- `ENT-ADJUDICATION` **Adjudication** — a human's action on a decision: actor, choice, edits, rationale, timestamp; single-writer per decision.
- `ENT-AUTHORITY-POLICY` **Authority Policy** — maps decision class → roles permitted to decide (capability-vs-authority rules; Cerbos-backed).
**Requirements**
- No GOVERN-tier effect is applied without a matching `ENT-ADJUDICATION` by an authorized actor.
- Adjudications are immutable and feed the audit trail; conflicting concurrent adjudications resolve to one winner.

### `BD-06` — Credentials & Model Access
*Hosts: UJ-01, UJ-05, UJ-14; Workflows: WF-CRED-VALIDATE.*
**Entities**
- `ENT-CREDENTIAL` **Model Credential** — encrypted secret (cloud key or endpoint auth), scoped to tenant/project; never rendered.
- `ENT-MODEL-ENDPOINT` **Model Endpoint** — a reachable model (cloud provider, or private Ollama/llama.cpp/vLLM URL), with capability tier metadata.
- `ENT-ACCESS-POLICY` **Model-Access Policy** — per-project allowed modes {BYOK, platform-managed, private} and **tenant-configurable routing rules** (task-tier→model mapping, per-phase overridable; `DEC-INTENT-03`/Q-10).
**Requirements**
- Credentials are held in the per-tenant vault (**HashiCorp Vault CE**, `TECH-SEC-1`), encrypted at rest, decrypted only within the access boundary, and excluded from all logs/streams/exports.
- A project's runs may only use endpoints permitted by its access policy; tenants configure model routing (with sensible defaults); air-gapped tenants permit private endpoints only.
- Credentials live in the control-plane vault of record (`TECH-SEC-1`); a run's sandbox never reads them and the workload never holds a real key — the control plane supplies a single short-lived, scoped credential via `TECH-SEC-2` (primary: a control-plane egress/LLM proxy holds the key and the workload uses a fake key; alternative: an ephemeral tmpfs-mounted scoped token cleared on teardown).

### `BD-07` — Metering, Entitlements & Billing
*Hosts: UJ-06; Workflows: WF-METER, WF-ENTITLEMENT.*
**Entities**
- `ENT-USAGE-EVENT` **Usage Event** — a metered unit (LLM tokens, sandbox-minutes, storage-GB), attributed to run/project/tenant + endpoint.
- `ENT-ENTITLEMENT` **Entitlement** — plan limits/quotas/spend caps (hard/soft) per tenant/project.
- `ENT-PLAN` **Plan** — subscription tier and its entitlements. Initial commercial plan (`RQ-01`): a **30-day free trial, then a flat $20/month** subscription (BYOK); platform-managed key usage is metered and billed separately.
- `ENT-INVOICE` **Invoice** *(platform-managed keys)* — billable rollup of usage.
**Requirements**
- All metered work emits a usage event attributable to a project; no metered work exceeds a hard cap without authorization.
- BYOK usage is metered for visibility but need not be billed; platform-managed usage is billable. Base plan = 30-day free trial then $20/month (`RQ-01`); per-tier quota shapes remain to be detailed.

### `BD-08` — Execution & Sandboxes
*Hosts: UJ-01, UJ-12; Workflows: WF-EXEC, WF-SANDBOX-LIFECYCLE; Runtime: JanumiCode Compute Broker over OpenSandbox/Docker (`TECH-EXEC-1..4`).*
**Entities**
- `ENT-SANDBOX` **Sandbox** — an isolated per-tenant execution environment (an **OpenSandbox/Docker** sandbox on the single node) with a resource budget and toolchain profile; ephemeral.
- `ENT-COMPUTE-JOB` **Compute Job** — a unit of sandbox work admitted, scheduled, and metered by the **Compute Broker** (per-tenant fairness/entitlement/quota across tenants on the single node).
- `ENT-EXECUTION` **Execution** — a Phase-9 run of coding/compile/test/gate steps inside a sandbox, streaming results.
- `ENT-EXEC-ARTIFACT` **Execution Artifact** — generated code tree, test results, logs, evaluation evidence.
- `ENT-TEST-RESULT` **Test Result** — a **structured** per-test outcome (`TECH-TEST-1`): status, failure-class, expected/actual, stack, timing, `traces_to` its AC/task, and correlated trace/log refs.
- `ENT-DIAGNOSTIC-BUNDLE` **Diagnostic Bundle** — the agent-facing failure package (structured result + correlated spans/logs + `reproduce:{command, run_id, seed, versions}`), always captured, tiered-retained (`TECH-TEST-1/2`).
- `ENT-SANDBOX-PROFILE` **Sandbox Profile** — language/runtime/toolchain + model endpoint binding.
**Requirements**
- A sandbox belongs to exactly one tenant, cannot reach another tenant's data or the control plane's secrets, and is destroyed on teardown (only declared artifacts persist).
- Sandbox jobs are admitted and metered by the **Compute Broker**, which enforces per-tenant fairness/entitlement on the shared single node; the broker↔runtime boundary is abstracted so the OpenSandbox/Docker backend can be replaced without control-plane changes.
- Each sandbox runs with R1 Docker hardening (`RQ-04`, `TECH-EXEC-2`): rootless, seccomp + AppArmor, no-network-by-default (also enforcing test **hermeticity**, `TECH-TEST-4`), and CPU/memory/PID/disk caps.
- Execution results stream to the owning run in real time; on failure the agent gets a **structured diagnostic bundle** (`TECH-TEST-1/2`); fix loops are bounded, **flakes are quarantined not retried-to-green** (`TECH-TEST-4`), and a **pass is independently verified** (coverage + mutation + integrity detectors) — never fabricated (`TECH-TEST-3`, `VV-FAB-1`).

### `BD-09` — Files & Media
*Hosts: UJ-01 (attachment), UJ-13; Workflows: WF-UPLOAD, WF-FILE-PROCESS, WF-MEDIA-SERVE.*
**Entities**
- `ENT-FILE` **File** — an uploaded/generated object (storage key, status {pending, processing, active, infected, failed}, checksum, retention).
- `ENT-DERIVATIVE` **Derivative** — a thumbnail/poster/rendition of a file.
- `ENT-SCAN-RESULT` **Scan Result** — malware-scan verdict for a file.
- `ENT-MEDIA-LINK` **Media Link** — a signed, expiring URL to a media object served by the media edge (`TECH-MEDIA-1`), scoped either to a **JanumiCode session/user** (platform media) or to the **deployed app's own session / public** (deployed-app media).
**Requirements**
- Uploads are resumable; on completion each file is scanned before it becomes retrievable.
- Platform media is served via signed, expiring links scoped to the requesting JanumiCode session/user (a link issued to one is rejected for another or after expiry). Deployed-app media is served via signed, expiring links under the deployed app's own session/auth (or public) — JanumiCode never imposes its platform session on a public visitor (`TECH-MEDIA-1`).

### `BD-10` — Collaboration & Notification
*Hosts: UJ-03, UJ-08; Workflows: WF-NOTIFY, WF-STREAM-BROADCAST.*
**Entities**
- `ENT-PRESENCE` **Presence** — who is currently viewing a run.
- `ENT-NOTIFICATION` **Notification** — a message to a user (push/email/in-app) with a deep link, delivery status.
- `ENT-NOTIFICATION-PREF` **Notification Preference** — per-user channel/urgency settings.
**Requirements**
- Stream updates broadcast to all authorized viewers of a run within the real-time freshness target.
- A GOVERN gate with no present decider notifies eligible governors; runs never auto-advance while unattended.

### `BD-11` — Audit, Compliance & Controls
*Hosts: UJ-09, UJ-10, UJ-13, UJ-17, UJ-18, UJ-19; Workflows: WF-AUDIT-EXPORT, WF-RETENTION, WF-EXPORT, WF-POLICY, WF-SUPPORT-ACCESS, WF-EVIDENCE, WF-DSR, WF-INCIDENT, WF-ACCESS-REVIEW. Realizes `CAP-19` (`DEC-INTENT-14`).*
**Entities**
- `ENT-AUDIT-EVENT` **Audit Event** — append-only, tamper-evident record of who did/saw/decided what (actor, action, target, timestamp).
- `ENT-CONTROL` **Control** — a control mapped to framework criteria (SOC 2 TSC / NIST 800-53 / GDPR article), with owner, implementation, and test/evidence procedure.
- `ENT-EVIDENCE` **Evidence** — timestamped proof a control operated (config snapshot, access-review record, test result, log excerpt), retained for the audit period.
- `ENT-INCIDENT` **Incident** — a security incident/breach: detection, severity, containment, impact assessment, notifications, remediation, timeline.
- `ENT-DSR` **Data-Subject Request** — a GDPR request (access/erasure/portability/rectification/objection): subject, type, status, due date, fulfillment record.
- `ENT-PROCESSING-RECORD` **Record of Processing** — GDPR Art. 30 register of processing activities (purpose, categories, lawful basis, retention).
- `ENT-SUBPROCESSOR` **Subprocessor/Vendor** — a third party processing tenant data, with DPA + risk review (SOC 2 vendor mgmt / GDPR subprocessors).
- `ENT-ACCESS-REVIEW` **Access Review** — a periodic least-privilege review of who has access to what, with sign-off.
- `ENT-CHANGE-RECORD` **Change Record** — a governed change to the Platform (approval, test, deploy, evidence) for change management.
- `ENT-RESIDENCY-POLICY` **Residency Policy** — data/processing zone binding per tenant.
- `ENT-RETENTION-POLICY` **Retention Policy** — retention windows + purge rules.
- `ENT-CONSENT-GRANT` **Consent Grant** — time-boxed, scoped support-access authorization.
- `ENT-DELETION-CERT` **Deletion Certificate** — signed proof of tenant-data deletion.
**Requirements**
- Every decision, credential access, support-access grant, config change, and admin action produces an append-only, tamper-evident audit event (`TECH-AUDITLOG-1`).
- Each control has an owner and continuously-collected, timestamped evidence sufficient to demonstrate it operated throughout an audit period (SOC 2 Type 2).
- Residency/retention are enforced at storage and compute; deletion and data-subject requests are complete and verifiable across all stores incl. backups.
- Incidents follow a recorded detect→contain→assess→notify→remediate lifecycle; reportable breaches are notified within the required window.

### `BD-12` — Observability & Platform Operations
*Hosts: UJ-07 (health); realizes `CAP-14`/`CAP-20`; Workflows: WF-HEALTH, WF-MIGRATE, WF-INCIDENT, WF-NOTIFY. Candidate journey `UJ-21` (tenant reviews status & service levels).*
**Entities**
- `ENT-TRACE` **Trace/Span** — distributed trace of a request/run across control and execution planes.
- `ENT-METRIC` **Metric** — operational time series (queue depth, run latency, sandbox utilization).
- `ENT-HEALTHCHECK` **Health Check** — service liveness/readiness signal.
- `ENT-DEPLOYMENT` **Deployment** — a running Platform instance + version (for self-host upgrade tracking).
- `ENT-TELEMETRY-SCHEMA` **Telemetry Schema** — the versioned semantic-convention registry (one canonical tenant key, pinned OTel semconv/Schema URL, stable metric names) that traces/metrics/logs conform to (`TECH-OBS-2`).
- `ENT-SLI` **Service Level Indicator** — a measured signal (availability, API latency, time-to-first-artifact, stream freshness, sandbox admission, hosted-app uptime) derived from telemetry.
- `ENT-SLO` **Service Level Objective** — a target + error budget over an `ENT-SLI`; internal, drives release gating (no contractual SLA until HA).
- `ENT-SERVICE-STATUS` **Service Status** — the tenant-facing status signal: component up/degraded/down, incidents, and maintenance windows.
**Requirements**
- Platform telemetry never contains tenant intent/artifact content or secrets, and conforms to the one canonical `ENT-TELEMETRY-SCHEMA` (`TECH-OBS-2`, `VV-SEC-1`); its schema evolves by expand/contract + deprecation (`TECH-VER-3`) so dashboards/alerts/SLOs survive upgrades.
- Health/readiness endpoints gate load-balancing and deploys.
- Tenant-facing status/health/usage/SLO is a **tenant-scoped, content-redacted** projection (`CAP-20`, `TECH-OBS-3`); a full-node-down is detected **and** notified **out-of-band by that off-node probe/monitor** (email/push) — on-node workflows share the outage's failure domain — since the on-node status page is itself unreachable then (a fully independent status **dashboard** is HA, `REL-4`).

### `BD-13` — Admin & Policy
*Hosts: UJ-05, UJ-09; Workflows: WF-POLICY.*
**Entities**
- `ENT-POLICY-SET` **Policy Set** — tenant-level configuration (auth, access modes, residency, retention, notification defaults).
- `ENT-FEATURE-FLAG` **Feature Flag** — per-edition/tenant capability toggles (e.g., platform-managed keys, mobile client) layered over the license **entitlements** that unlock `ee/` capabilities (`TECH-LICENSE-1`).
**Requirements**
- Policy changes are audited and take effect without redeploy.
- Edition differences (**Community / Enterprise / Cloud**) are expressed as **build-time `ee/` inclusion + runtime license entitlements + policy/flags over a single open-core codebase — never a code fork** (`DEC-INTENT-15/16`, `TECH-REPO-1`/`TECH-LICENSE-1`). Clients (web/mobile/extension) are rebrandable surfaces, not editions (`TECH-BRAND-1`).

### `BD-14` — Delivery, Deployment & Hosting
*Hosts: UJ-15, UJ-16; Workflows: WF-REPO-PROVISION, WF-DELIVER, WF-HOST, WF-CRED-VALIDATE. Realizes `CAP-16`/`CAP-17` (`DEC-INTENT-07/11/12`).*
**Entities**
- `ENT-REPOSITORY` **Repository** — a JanumiCode-hosted git repository for the project (self-hosted git, default), with an optional mirror to a tenant-owned remote.
- `ENT-VCS-CONNECTION` **VCS Connection** — an optional tenant-owned remote-host binding (provider, repo, scoped token held in the vault) for mirror/push.
- `ENT-DEPLOY-TARGET` **Deploy Target** — the deployment destination + config; R1 default is **JanumiCode-hosted** (build a container image → local Docker registry → run on the node). External PaaS/VPS targets deferred to `REL-4`.
- `ENT-HOSTED-APP` **Hosted App** — a long-lived deployed container for a tenant's project: subdomain, image/version, status {deploying, running, degraded, stopped, failed}, resource limits, health.
- `ENT-APP-DATABASE` **App Database** — a hosted app's **managed database** on the tenant-app Postgres instance (own database + scoped role; Vault-minted credential), isolated from the platform DB and other apps (`TECH-DB-5`).
- `ENT-APP-BUCKET` **App Bucket** — a hosted app's **scoped object-storage bucket** on the shared SeaweedFS cluster (per-app S3 key), separate from platform buckets (`TECH-STORE-2`).
- `ENT-ROUTE` **Route** — the Host→container mapping (`<tenant-app-id>-vcs.janumicode.com` → hosted app), realized in Traefik (`TECH-ROUTE-1`).
- `ENT-DELIVERY` **Delivery** — a push/deploy event for a run (commit/branch ref, image, status, link back to the run's traceability).
**Requirements**
- Delivery pushes only governed-approved artifacts using tenant-scoped credentials; git is self-hosted by default with an optional tenant remote.
- A deploy/host action requires an explicit governed request (no autonomous deploy); every delivery links back to its run's traceability.
- A hosted app runs as an isolated per-tenant **hardened Docker** container (not an OpenSandbox sandbox) that cannot reach the control plane or another tenant's app/data, is resource-capped, and is reachable only via Traefik at its subdomain route.
- `WF-HOST` provisions each app's **isolated data plane** — an `ENT-APP-DATABASE` on the tenant-app Postgres (a separate trust domain from the platform DB) + an `ENT-APP-BUCKET`, with Vault-minted per-app credentials; teardown removes them (`DEC-INTENT-20`, `TECH-DB-5`/`TECH-STORE-2`, `VV-ISO-3`).

---
## D.5 Workflows

*Each workflow is derived from an employment pattern (Part C) and is durable/resumable (`TECH-WF-1`). `trigger`: `journey_step` (backs an automatable step), `event`, or `schedule`. Every `⚙automatable` journey step maps to a workflow here. Illegal transitions are rejected; side effects are idempotent (idempotency-keyed).*

### Core run & governance

**`WF-RUN` — Decomposition Run Orchestration** · trigger `journey_step` · backs `UJ-01,02,11`
- **Entry:** a sufficient `ENT-INTENT` exists. **Inputs:** intent, project policy, access policy.
- **States:** `Created → IntakeCheck → Decomposing(phase n) → [ExecutionHandoff] → Completed | Paused | Failed | Cancelled`.
- **Decision points:** `DEC-02` (intake sufficiency), gate governance per phase (`WF-DECISION`), `DEC-05`/`DEC-06` at limits/gaps.
- **Validation:** phase invariants (AC presence, `traces_to` integrity, coverage). **Retry/convergence:** delegates to `WF-DECOMP-PHASE`/`WF-EXEC`; bounded (`EMP-06`).
- **Escalation:** pause + raise decision when unattended (`EMP-09`) or non-convergent (`EMP-06`). **Failure states:** `Paused(reason)` (resumable) vs `Failed(cause)`.
- **Checkpointing:** durable after each phase and each side effect (`ENT-RUN-CHECKPOINT`); resumes exactly-once. **Completion:** all in-scope phases done or accepted-with-declared-gaps. **Artifacts:** `ENT-ARTIFACT*`, `ENT-COVERAGE-REPORT`, `ENT-EXEC-ARTIFACT`.

**`WF-DECOMP-PHASE` — Single-Phase Decomposition** · trigger `event` (phase entry) · backs `UJ-01,04`
- **Entry:** prior-phase artifacts present. **States:** `Reading → Producing → Verifying → GateGovernance → Committed | ReDeriving | Paused`.
- **Actions:** phase agents produce artifacts (chunked/saturation per size); deterministic verifiers run. **Decision:** raise gate decision (`WF-DECISION`). **Validation:** blocking invariants; no fabrication on LLM failure. **Convergence:** chunk-and-reconcile; declared gaps if bounded loop exhausts. **Failure:** `Paused` on provider failure (`EMP-05`). **Completion:** verified artifact committed + streamed. **Artifacts:** the phase's `ENT-ARTIFACT` + `ENT-FINDING`s.

**`WF-DECISION` — Decision Adjudication** · trigger `journey_step` · backs `UJ-01,02,03,04,08,12`
- **Entry:** an agent surfaces a proposal/finding. **States:** `Raised → (Notified?) → Adjudicated(approve|refine|reject|escalate|defer) → Propagated | Superseded`.
- **Decision:** `DEC-01` class + authority check (Cerbos-style). **Validation:** decider authorized; rationale present where required; single-writer (idempotency-keyed per decision item). **Escalation:** absent decider → `WF-NOTIFY` (`EMP-09`); higher authority on `escalate`. **Failure:** conflicting concurrent adjudication → one winner, others `Superseded`. **Completion:** outcome propagated to downstream artifacts. **Artifacts:** `ENT-DECISION`, `ENT-ADJUDICATION`, `ENT-AUDIT-EVENT`.

### Execution

**`WF-EXEC` — Isolated Execution** · trigger `journey_step` · backs `UJ-01,06,12`
- **Entry:** governed-approved packets + entitlement permits sandbox compute (`WF-ENTITLEMENT`). **States:** `Provisioning → Authoring → Building → Testing → [FixLoop k] → Evaluated → TearDown → Succeeded | Paused | Failed`.
- **Actions:** the **Compute Broker** (`TECH-EXEC-4`) admits the job (fairness/entitlement/quota) and provisions an **OpenSandbox/Docker** sandbox (`WF-SANDBOX-LIFECYCLE`); run coding agent (`A-12`) + compile/test/gate; stream results; the Broker meters compute. **Decision:** on failure → bounded fix loop; on non-convergence → raise governed choice (`WF-DECISION`, `DEC-06`). **Validation:** compile/test/gate + anti-mock + craft-conformance + sandbox-escape guard. **Retry/convergence:** fix loop bounded by budget; never fabricate a pass. **Escalation:** non-convergence/limit → human. **Failure:** `Paused` (governable) vs `Failed`. **Completion:** gates pass or accepted-with-gap. **Artifacts:** `ENT-EXEC-ARTIFACT`, `ENT-USAGE-EVENT`.

**`WF-SANDBOX-LIFECYCLE` — Sandbox Provision/Teardown** · trigger `event` · backs `UJ-12`
- **Runtime:** Compute Broker → OpenSandbox/Docker (`TECH-EXEC-1..4`). **States:** `Requested → Admitted(broker) → Provisioned → Bound(profile,endpoint) → Active → Draining → Destroyed`. **Validation:** tenant-scoped; no control-plane secret exposure; egress policy applied (air-gapped honored). **Failure:** provision timeout or broker-denied (over quota) → `WF-EXEC` pauses/raises. **Completion:** destroyed; ephemeral state gone; only declared artifacts persisted.

### Files

**`WF-UPLOAD` — Resumable Upload** · trigger `event` (attachment added during intake) · backs `UJ-01`
- **States:** `Initiated → Uploading(resumable) → Received → HandOffToProcessing`. **Validation:** tenant/project scope; size/type limits. **Completion:** file record `pending` → hands to `WF-FILE-PROCESS`.

**`WF-FILE-PROCESS` — File Scan & Derivatives** · trigger `event` (upload finished) · backs `UJ-01`
- **States:** `Queued(concurrency-gated) → Scanning → Extracting → Derivatives → Finalized(active) | Infected | Failed`. **Decision:** `DEC-03` transient/permanent on failure. **Retry:** exponential backoff for transient; DLQ for exhausted. **Validation:** malware-clean before retrievable. **Completion:** `active` + derivatives; **Failure:** `Infected`/`Failed` (needs attention). **Artifacts:** `ENT-FILE`, `ENT-DERIVATIVE`, `ENT-SCAN-RESULT`.

**`WF-MEDIA-SERVE` — Media Delivery** · trigger `event` (media request) · backs `UJ-01` (platform artifacts) + deployed-app media (`A-20`)
- **States:** `Requested → ScopeCheck(platform: JanumiCode session · deployed-app: app session/public) → IssueSignedLink | Reject(expired/unauthorized) → Serve(internal redirect to object storage)`. **Validation:** platform-media links are JanumiCode-session/user-scoped and time-limited (rejected for another user or after expiry); deployed-app-media links are scoped by the deployed app's own session/auth (or public) and time-limited — no JanumiCode session is required of a public visitor (`TECH-MEDIA-1`). **Artifacts:** `ENT-MEDIA-LINK`.

### Identity, credentials, collaboration

**`WF-TENANT-PROVISION` — Tenant/Account Setup** · trigger `journey_step` · backs `UJ-01` — `SignUp → CreateTenant → SeedDefaultRoles → Ready`. Completion: default tenant + Owner membership.
**`WF-INVITATION` — Member Invitation** · trigger `journey_step` · backs `UJ-05` — `Issued → (Delivered) → Accepted | Expired | Revoked`. Idempotent single-use code; role granted on accept.
**`WF-MEMBER-REVOKE` — Access Revocation** · trigger `journey_step` · backs `UJ-05` — `Requested → Revoked → SessionsInvalidated`. Completion: next request on any surface denied within target.
**`WF-CRED-VALIDATE` — Credential/Endpoint Validation** · trigger `journey_step` · backs `UJ-01,05,07,14` (also used internally by `WF-REPO-PROVISION`) — `Stored(encrypted) → TestCall → Valid | Invalid`. Validation: secret never logged/returned; test call proves reachability + auth.
**`WF-STREAM-SUBSCRIBE` — Stream Subscription/Resume** · trigger `journey_step` · backs `UJ-03,08,11` — `Connect → ResolvePosition(keyset) → Streaming → Reconnect(resume)`. Validation: no gaps/dupes on resume; authorized-viewer scope.
**`WF-STREAM-BROADCAST` — Multi-Viewer Broadcast** · trigger `event` (new record) · backs `UJ-03` — fan-out to authorized viewers within freshness target.
**`WF-NOTIFY` — Notification/Presence** · trigger `event` (attention/authority needed) · backs `UJ-08,19` — `Determine eligible → Send(push/email/in-app) → Track delivery/response`. Escalation source for `EMP-09`.

### Metering, entitlement, billing

**`WF-METER` — Usage Metering** · trigger `event` (metered op) · backs `UJ-06` — emit `ENT-USAGE-EVENT` per op (LLM tokens metered at the call site; sandbox compute metered by the **Compute Broker**, `TECH-EXEC-4`); warn at soft threshold; pause run at hard cap (raise → `WF-DECISION`/`DEC-05`).
**`WF-ENTITLEMENT` — Entitlement Check/Enforce** · trigger `event` (pre-consume) · backs `UJ-06` — allow/deny by remaining quota/budget before token/sandbox consumption; sandbox admission is enforced by the **Compute Broker** (`TECH-EXEC-4`).

### Enterprise, compliance, ops

**`WF-POLICY` — Policy Configuration** · trigger `journey_step` · backs `UJ-09,14` — apply auth/access/residency/retention/notification policy; audited; effective without redeploy.
**`WF-AUDIT-EXPORT` — Audit Retrieval/Export** · trigger `journey_step` · backs `UJ-09,17` — produce append-only audit export for a period; tamper-evident.
**`WF-RETENTION` — Retention Purge & Deletion** · trigger `schedule` (retention) + `journey_step` (explicit) · backs `UJ-09,13` — purge expired data; on tenant-delete produce `ENT-DELETION-CERT`; verify no residue across stores.
**`WF-SUPPORT-ACCESS` — Consented Support Access** · trigger `journey_step` · backs `UJ-10,17` — `Requested → GrantedByAdmin(time-boxed,scoped) → Accessed(audited) → Expired`. Default deny; `DEC-04`.
**`WF-EXPORT` — Artifact/Tenant Export** · trigger `journey_step` · backs `UJ-01,13` — produce complete, round-trip-verifiable archive of run/tenant data.
**`WF-HEALTH` — Health/Readiness** · trigger `schedule`/`event` · backs `UJ-07` — liveness/readiness gating LB + deploys.
**`WF-MIGRATE` — Deploy & Schema Migration** · trigger `event` (upgrade) · backs `UJ-07` — idempotent migrations; no data loss; preserves tenants/runs.

**`WF-EVIDENCE` — Control Evidence Collection** · trigger `schedule` + `event` · backs `UJ-17`
- **States:** `Scheduled/Triggered → Snapshot(control state) → Store(timestamped, immutable) → Retain(period)`. **Actions:** capture config snapshots, access-review outputs, control-test results, and log excerpts per `ENT-CONTROL`. **Validation:** evidence is timestamped, complete per control, and tamper-evident (`TECH-AUDITLOG-1`); no gaps across the audit period. **Artifacts:** `ENT-EVIDENCE`.
**`WF-DSR` — Data-Subject Request** · trigger `journey_step` · backs `UJ-18`
- **Entry:** a verified `ENT-DSR`. **States:** `Opened(due date) → VerifyIdentity → LocateData(all stores + backups) → Fulfill(access|erase|port|rectify) → Verify → Closed`. **Decision:** erasure requires confirmation; identity verified before fulfillment. **Validation:** fulfilled within the legal window; erasure complete across all stores; fully audited. **Artifacts:** `ENT-DSR`, `ENT-DELETION-CERT` (on erasure).
**`WF-INCIDENT` — Incident / Breach Response** · trigger `event` (detection) + `journey_step` · backs `UJ-19`
- **States:** `Detected → Triaged(severity) → Contained → Assessed(personal-data impact?) → [Notify(regulator+affected, within window)] → Remediated → PostMortem`. **Decision:** reportable-breach determination gates notification. **Validation:** notification within the required window; lifecycle fully recorded; containment preserves tenant isolation. **Artifacts:** `ENT-INCIDENT`, `ENT-AUDIT-EVENT`.
**`WF-ACCESS-REVIEW` — Periodic Access Review** · trigger `schedule` · backs `UJ-17`
- **States:** `Scheduled → Enumerate(access) → Review → SignOff | Revoke`. **Validation:** least-privilege confirmed; excess access revoked; sign-off recorded as evidence. **Artifacts:** `ENT-ACCESS-REVIEW`, `ENT-EVIDENCE`.

### Delivery & Hosting
**`WF-REPO-PROVISION` — Repository Provisioning** · trigger `journey_step` · backs `UJ-15`
- **Entry:** a new project. **States:** `Requested → CreateRepo(self-hosted git) → [ConnectRemote(tenant, validated via WF-CRED-VALIDATE)] → Ready`. **Validation:** the self-hosted repo exists and is writable; any tenant remote is reachable + auth-valid. **Completion:** `ENT-REPOSITORY` ready. **Artifacts:** `ENT-REPOSITORY`, `ENT-VCS-CONNECTION`.

**`WF-DELIVER` — Project Delivery (VCS push + build + deploy)** · trigger `journey_step` · backs `UJ-15`
- **Entry:** a governed-approved run + a repository (`ENT-REPOSITORY`, self-hosted git by default; optional `ENT-VCS-CONNECTION` remote). **States:** `Requested → Packaging → Pushing(git) → [Mirror(tenant remote)] → BuildImage → PushImage(local Docker registry) → HandOffToHost | Delivered | Failed` (`RQ-05`). **Decision:** a deploy/host requires an explicit governed request (no autonomous deploy). **Validation:** tenant-scoped credentials from the vault; only governed-approved artifacts; delivery linked back to run traceability. **Retry:** idempotency-keyed; transient failures retried. **Failure (`SIT-17`):** on a permanent failure (push rejected / branch conflict / build fails) the run pauses and raises a governed choice (retry / fix / skip) — never a silent fail (`QA-2`). **Completion:** `ENT-DELIVERY` + (if deploying) hands the image to `WF-HOST`. **Artifacts:** `ENT-DELIVERY`.

**`WF-HOST` — Application Hosting Lifecycle** · trigger `journey_step` (deploy/manage) + `event` (health) · backs `UJ-15,16`
- **Entry:** a built image (from `WF-DELIVER`) + a governed deploy request. **States:** `Deploying → ProvisionDataPlane → RegisterRoute(Traefik) → Running → [Redeploying | RollingBack | Draining] → Stopped → Destroyed | Failed`. **Actions:** provision the app's **isolated data plane** — create `ENT-APP-DATABASE` on the tenant-app Postgres + `ENT-APP-BUCKET` on SeaweedFS with **Vault-minted per-app credentials** (`TECH-DB-5`/`TECH-STORE-2`); run the app as an isolated, resource-capped, **hardened Docker** per-tenant container; register the Host route `<tenant-app-id>-vcs.janumicode.com` in Traefik (`TECH-ROUTE-1`); health-check; on **teardown (`Destroyed`)** deprovision the data plane (drop the database, delete the bucket, revoke the creds) leaving no residue. **Decision:** deploy/redeploy/rollback/stop/**delete** are authorized + governed. **Validation:** the container reaches **only its own** data plane — not the control plane, the platform DB, or another tenant's app/data (`VV-ISO-3`); reachable only via Traefik; a redeploy preserves the route + data plane. **Failure (`SIT-18`):** crash/OOM/failed-health → surface health + a recovery choice; never silently down. **Completion:** `Running` with a live route (or `Stopped`; `Destroyed` = deprovisioned, no residue). **Artifacts:** `ENT-HOSTED-APP`, `ENT-ROUTE`, `ENT-APP-DATABASE`, `ENT-APP-BUCKET`.

## D.6 Service Blueprints (selected, highest-stakes) & System Scenarios

**Service Blueprints** — where the actor experience meets the backstage machinery:
- `SB-01` **Governed Run** (backs `UJ-01`): *Frontstage* — intent composer, governed stream, decision cards, decomposition viewer. *Backstage (agents)* — Client Liaison, phase agents, validators. *Supporting* — durable orchestrator, coverage/trace verifiers. *Infra* — control-plane monolith (SvelteKit/oRPC/DBOS/Postgres-RLS), real-time channel, credential vault, LLM endpoints.
- `SB-02` **Isolated Execution** (backs `UJ-12`): *Frontstage* — live execution stream + gate results. *Backstage* — coding agent in sandbox. *Supporting* — Compute Broker (admission/fairness/metering), sandbox lifecycle, egress policy, escape guards. *Infra* — per-tenant OpenSandbox/Docker sandboxes on the single node (`TECH-EXEC-1..4`), object storage for artifacts.
- `SB-03` **Enterprise Onboarding** (backs `UJ-07,09`): *Frontstage* — install/config + admin console. *Backstage* — SSO handshake, policy engine. *Supporting* — migrations, health checks. *Infra* — self-hosted compose bundle, IdP, private model endpoint, on-prem storage/telemetry.

**System Scenarios** — one operational event, multiple actor views (kept mutually consistent):
- `SCN-01` **A governed run from intent to executed code** — unifies `UJ-01` (builder), `UJ-04` (governor), `UJ-12` (execution), `UJ-06` (billing), `UJ-11` (resume). All are views of one `ENT-RUN`.
- `SCN-02` **A decision raised while everyone is away** — unifies `EMP-09`, `UJ-08` (mobile governor), `WF-NOTIFY`; the run pauses and only advances on human action.
- `SCN-03` **Provider outage mid-run** — unifies `SIT-03`, `EMP-05`, `UJ-11`; run pauses legibly, resumes on recovery/endpoint switch, never fabricates.
- `SCN-04` **Enterprise stand-up & first governed run inside the boundary** — unifies `UJ-07`, `UJ-14`, `UJ-09`, then `SCN-01` entirely on-prem/air-gapped.

---
## D.7 Integrations

| ID | Integration | Category | Standard providers | Ownership | Rationale |
|---|---|---|---|---|---|
| `INT-LLM-CLOUD` | Cloud LLM APIs | model | Anthropic, OpenAI, Google | BYOK (default) or platform-managed | Core decomposition/execution reasoning; keys in per-tenant vault. |
| `INT-LLM-PRIVATE` | Private/local model endpoints | model | Ollama, llama.cpp, vLLM | Tenant-owned (Enterprise) | Air-gapped/private inference; reuses JanumiCode's existing local-provider support. |
| `INT-IDP` | Enterprise SSO | identity | OIDC, SAML IdPs | Tenant-owned | `OUT-04`; enforced SSO for Enterprise. R2. |
| `INT-STORAGE` | S3-compatible object storage | storage | SeaweedFS (self-host), S3 (cloud) | Platform / tenant | Attachments + generated artifacts; self-hostable S3-compatible storage. |
| `INT-UPLOAD` | Resumable upload edge | storage | TUSD | Platform | Reliable large-attachment upload; hooks into `WF-FILE-PROCESS`. |
| `INT-OBSERVABILITY` | Telemetry backend | ops | OpenTelemetry → SigNoz | Platform / tenant (Enterprise on-prem) | `CAP-14`; no tenant content in telemetry. |
| `INT-EMAIL` | Transactional email | comms | SMTP/nodemailer | Platform | Invitations, notifications. |
| `INT-PUSH` | Mobile push | comms | APNs, FCM | Platform | `UJ-08` mobile governance. R3. |
| `INT-PAYMENT` | Billing/payments | billing | **Square** | Platform | The $20/mo subscription + platform-managed-key billing (`DEC-INTENT-09`, `RQ-01`). **US domestic market initially** (`RQ-06`). R2. |
| `INT-VCS` | Version control | delivery | **Self-hosted git** (Gitea/Forgejo) default; optional tenant remote (GitHub/GitLab) | Platform (self-hosted) / tenant (optional remote) | **Core value** (`CAP-16`, `DEC-INTENT-07/12`): self-hosted git by default, optional mirror/push to a tenant remote (`WF-DELIVER`, `BD-14`, `TECH-VCS-1`). |
| `INT-SANDBOX` | Sandbox runtime | execution | **OpenSandbox** (Docker backend) | Platform | Isolated code-execution runtime under the Compute Broker (`TECH-EXEC-1..4`, `DEC-INTENT-04`). |
| `INT-SECRETS` | Secret store | security | **HashiCorp Vault** (self-hosted, Community Edition) | Platform / tenant (Enterprise on-prem) | Per-tenant credential vault (`TECH-SEC-1`, `DEC-INTENT-08`). |
| `INT-CDN` | Public DNS / CDN edge | edge | **Cloudflare** (`*.janumicode.com`) | Platform | Fronts all public subdomains → single Traefik origin IP; Host-based routing (`TECH-ROUTE-1`, `DEC-INTENT-11`). Tenant custom domains deferred. |

## D.8 Core Technological Infrastructure & Stack (`TECH-*`)

*These are **stated, authoritative constraints** (transcribed from the sponsor's directive to adopt the established modular-monolith platform stack), not proposals — Phases 4/5 treat them as pre-approved. Rationale is given, not vendor-name dumping. All previously `⟨OPEN⟩` TECH items are now resolved; residual unknowns live in Part F (`RQ-*`).*

| ID | Layer | Decision | Rationale |
|---|---|---|---|
| `TECH-FE-1` | Frontend framework | **SvelteKit 5 + Svelte 5 (runes)** | Direct transferability of the extension's Svelte governed-stream/decomposition-viewer/IntentComposer UI; SSR-first for fast dense data. |
| `TECH-FE-2` | UI system / shared components | A **shared Svelte component + design-system library** consumed by all surfaces — web, **Capacitor mobile (iOS/Android)**, and the VS Code extension — with an explicit theme-token set replacing VS Code `--vscode-*` vars | Preserve governed-stream look/feel and maximize reuse across targets (`DEC-INTENT-06`); components are already transport-agnostic (message protocol, not the VS Code API). White-label theming rides this shared library (`TECH-BRAND-1`). |
| `TECH-RT-1` | Runtime | **Bun (≥1.3)** | High-perf API execution; single-process-per-container; TypeScript end-to-end with the reused engine. |
| `TECH-API-1` | API layer | **oRPC** (single `/api/v1/rpc/{domain}[/{version}]/{method}` surface) | Typed end-to-end; **auto-generates OpenAPI → typed web/mobile/agent SDKs** (`TECH-MOB-1`); URL-path versioning — major-in-path + deprecation policy per `TECH-VER-2`. |
| `TECH-API-2` | Schemas/validation | **Zod** (generated from Prisma) | Single source of truth Prisma → Zod → oRPC I/O → OpenAPI → generated types. |
| `TECH-API-3` | Errors | Typed `.errors()` maps (never raw error throws) | Preserves observability (typed errors don't collapse to 500 in traces). |
| `TECH-DB-1` | Database | **PostgreSQL** | Mature and transactional; the substrate for RLS multi-tenancy + DBOS durable state. |
| `TECH-DB-2` | Multi-tenancy | **Row-Level Security (RLS)** on a shared schema; org + (optional) sub-scope keys; two DB roles (owner=BYPASSRLS for migrations, app=RLS-enforced); RLS context set **transaction-scoped** (AsyncLocalStorage + `SET LOCAL`/reset-before-commit) so pooled connections — including PgDog (`TECH-DB-4`) — can't leak context | A proven RLS isolation model; satisfies `SIT-10`, `SC-07`. |
| `TECH-DB-3` | ORM | **Prisma** (pg driver adapter) with a query extension for RLS-context injection | Deterministic connection-pool safety; the RLS-context-in-transaction pattern (`TECH-DB-2`) stays correct under pooling. |
| `TECH-DB-4` | Connection pooling / load balancing | **PgDog** in front of PostgreSQL — transaction-mode pooling, read/write split + load balancing across replicas, and a path to sharding | Multiplexes and caps DB connections for the Bun/DBOS/Prisma pools; scales reads and positions for replica/shard scale-out on the multi-node path (`REL-4`). Correctness note: RLS context (`TECH-DB-2`) must be **transaction-scoped** (`SET LOCAL`/reset-before-commit) to stay pooling-safe under transaction-mode pooling. |
| `TECH-DB-5` | Data trust-domain isolation | **Two Postgres instances on the one node**: the **platform control-plane DB** (RLS org-multitenancy, `TECH-DB-2` — the crown jewels) is a **separate process** from a **tenant-app Postgres** where each hosted app gets its **own database + scoped role** (`REVOKE` across databases); connection strings are **Vault-minted, short-lived, per-app** (`TECH-SEC-1`) and never grant platform-DB access. PgDog (`TECH-DB-4`) may front both but is a **pooler, not an isolation boundary** | `DEC-INTENT-20`, `CAP-17`, `TECH-HOST-1`, `VV-ISO-3`. A semi-untrusted (AI-generated) hosted app's SQL access is walled off from the platform + other tenants; a compromise's blast radius is one app's database, not the instance. |
| `TECH-WF-1` | Durable workflow engine | **DBOS** (Postgres-backed, exactly-once steps, scheduled workflows) | Realizes `CAP-07`/`WF-RUN`; **replaces JanumiCode's in-process orchestrator** so long runs survive restarts/deploys and resume (`SIT-11`); in-flight runs pin `application_version` (`TECH-VER-4`). |
| `TECH-AUTHZ-1` | Authorization | **Cerbos** (policy-as-code, derived roles, query-plan → DB filter) | Encodes the **capability-vs-authority** model (`DEC-01`, `ENT-AUTHORITY-POLICY`); decouples policy from code. |
| `TECH-AUTH-1` | Authentication | **better-auth** (DB-backed sessions) + **OIDC/SAML** for Enterprise SSO | Email/password for Cloud; enforced SSO for Enterprise (`UJ-09`). |
| `TECH-STORE-1` | Object storage | **SeaweedFS** (S3-compatible) | Attachments + artifacts + deployed-app media, tenant-scoped; media is served through the signed-link media edge (`TECH-MEDIA-1`), not raw presigned links. |
| `TECH-STORE-2` | Object-storage multi-tenancy | **One SeaweedFS cluster** shared across the platform and hosted apps, isolated by **per-app buckets + scoped S3 access keys** (SeaweedFS `identities`); **platform buckets are separate** from tenant-app buckets (ideally a distinct filer/volume for blast-radius); retrieval fronted by the signed-link media edge (`TECH-MEDIA-1`) | `DEC-INTENT-20`, `CAP-17`, `TECH-STORE-1`, `VV-ISO-3`. Object storage is safe to share at the cluster level — no cross-tenant query surface — as long as buckets + keys are per-app scoped. |
| `TECH-UP-1` | Uploads | **TUSD** resumable + post-finish hook → processing | Reliable large uploads; scan-before-retrievable. |
| `TECH-OBS-1` | Observability | **OpenTelemetry** (traces/metrics/logs) → **SigNoz**; DBOS reuses the global tracer | `CAP-14`; on-prem SigNoz for Enterprise; no tenant content/secrets in telemetry. Telemetry is a versioned contract (`TECH-OBS-2`); status/SLO (`TECH-OBS-3`); tenant export (`TECH-OBS-4`). |
| `TECH-OBS-2` | Telemetry schema (versioned contract) | **One canonical semantic convention**: a single attribute registry with **one tenant key** (`janumicode.tenant_id`), pinned OTel **semconv version + Schema URL**, stable metric names; **metrics + logs exported** (not only traces); telemetry evolves under **expand/contract + deprecation** (`TECH-VER-3`); **dashboards + alert rules as code** in the monorepo, deployed to SigNoz, identical across editions; content/secret-redacted | `DEC-INTENT-18`, `CAP-14`, `TECH-OBS-1`, `VV-SEC-1`. Dashboards/alerts/SLOs are consumers that break on silent telemetry drift — govern it like the API. |
| `TECH-OBS-3` | Status & SLO service | **SLIs** (availability, API latency, time-to-first-artifact, stream freshness, sandbox admission, hosted-app uptime) → **SLOs + error budgets** (internal, gate releases); a tenant-facing **status page** (up/degraded/down + incidents + maintenance) **served on the origin node**, with an **external synthetic probe/monitor** that detects reachability from outside **and itself emits the off-node (email/push) node-down alert** — *not* the on-node `WF-NOTIFY` (same failure domain as the outage); `WF-NOTIFY` carries *in-band* status/incident comms while the node is up; per-tenant health/usage/SLO is **RLS-scoped + content-redacted**. **No contractual availability SLA until HA** | `DEC-INTENT-18`, `CAP-20`, `VV-AVAIL-1`, `ENT-HOSTED-APP`, `BD-07`. On-node page = one approach across all editions incl. air-gapped; independent-failure-domain status is `REL-4`. |
| `TECH-OBS-4` | Tenant telemetry export | **Enterprise** tenants export their own OTel signals (traces/metrics/logs, conforming to `TECH-OBS-2`) to **their own collector/SIEM + on-prem SigNoz** (`TECH-OBS-1`), tenant-scoped and content-redacted | `DEC-INTENT-18`, `CAP-20`. The single canonical schema makes tenant export portable; Enterprise/air-gapped keeps all telemetry in-boundary. |
| `TECH-TEST-1` | Diagnostic contract | **One structured test-result schema** shared by platform CI and the in-sandbox generated-project harness: per test `{id → traces_to AC/task, status, failure-class, expected/actual, stack, timing, trace_id + log refs}` — same **expected / observed / likely-source / reproduce** shape as the pipeline's own agent-fix contract; N frameworks normalized via reporter adapters (JUnit/TAP/native → contract); **always-on full capture** with tiered retention (failure bundles long, passing-run bundles pruned) | `DEC-INTENT-19`, `CAP-21`. Agents diagnose from structured signal, not scraped stdout; one contract → skills/tooling transfer across both harnesses. |
| `TECH-TEST-2` | Traced test runs | Every test run is a **traced operation** emitting telemetry per the canonical schema (`TECH-OBS-2`), tagged with test-id + run-id; the code-under-test (incl. the generated app) emits spans/logs so a failure **bundles its correlated telemetry** | `DEC-INTENT-19`, `TECH-OBS-2`, `CAP-21`. The failure arrives with its own diagnosis context — no guessing which logs belong to which failure. |
| `TECH-TEST-3` | Test integrity (green = working) | The agent's passing claim is a **proposal the harness verifies**: **coverage gates + mutation testing + integrity detectors** (anti-mock, anti-skip, **no-empty-suite** — closing the 'no tests found = pass' hole — tautology, 'test-invokes-target') gate a run's green | `DEC-INTENT-19`, `VV-FAB-1`, `VV-TEST-2`; capability-vs-authority applied to tests (`DEC-01`). Mutation testing adds compute per leaf — Compute-Broker-budgeted. |
| `TECH-TEST-4` | Determinism & flake governance | **Hermetic** test env (no-network default `TECH-EXEC-2`, seeded data, frozen time, deterministic order); flakes are **detected** (variance across re-runs) and **quarantined as first-class defects** — a pass-after-flaky-fail is **not** counted fixed | `DEC-INTENT-19`, `VV-TEST-3`, `TECH-EXEC-2`. A flaky signal is worse than no signal for an iterating agent. |
| `TECH-TEST-5` | Test pyramid & agent loop | **Unit → integration → contract (`TECH-VER-2`) → E2E** (against the hosted app, `CAP-17`); E2E runs **in the iterate loop but gated** after lower levels green and **Compute-Broker budget-capped**; the bounded iterate → quarantine → **escalate** loop hands off to a stronger model / **human governor** on exhaustion (a governed decision, not defeat-as-success) | `DEC-INTENT-19`, `CAP-08`/`CAP-17`, `TECH-EXEC-4`, `UJ-12`. Fast/cheap feedback first; localizes failures; bounds sandbox cost. |
| `TECH-EDGE-1` | Reverse proxy / edge | **Traefik** behind a single origin IP; **Host-based routing** to control-plane services and to each tenant's hosted-app container | `DEC-INTENT-11`. Cloudflare (`INT-CDN`) fronts `*.janumicode.com` → this single IP; Traefik routes by Host (`<tenant-app-id>-vcs.janumicode.com` → the tenant container). Upload buffering; health-aware LB; trusts forwarded headers only from Cloudflare. |
| `TECH-ROUTE-1` | Public routing & DNS | Wildcard `*.janumicode.com` at Cloudflare → single origin IP → Traefik Host-match → target container; app-host scheme `<tenant-app-id>-vcs.janumicode.com` (sponsor-specified fixed label for the deployed-app host — the app-id is repo-derived; distinct from the self-hosted git server, which has no public subdomain); automatic TLS | `DEC-INTENT-11`; single-IP multi-tenant routing. Tenant **custom domains deferred** (subdomains-first; `REL-4`). |
| `TECH-PKG-1` | Packaging/orchestration | **Docker + Docker Compose on a single Linux node** for dev/eval, the **`REL-1` Cloud beta**, and Community/small self-host; **RKE2/Kubernetes** is the production/HA substrate from `REL-2` (`DEC-INTENT-21`, `TECH-SUBSTRATE-1`); multi-stage, non-root, healthcheck | Powers the Community/small self-host bundle (`UJ-07`) on Compose and the regulated Enterprise Helm deploy on RKE2. Single-node through `REL-2`; multi-node HA (`REL-4`) closes the `VV-AVAIL-1` gap. |
| `TECH-TOPO-1` | Node trust tiers & network segmentation | On the single node, **three trust tiers**: **trusted control-plane** (Traefik, monolith, platform Postgres, SeaweedFS, PgDog, Vault, **VCS**, SigNoz), **untrusted ephemeral** (OpenSandbox build/test/agent, `TECH-EXEC-2`), and **tenant-app** (hosted app + tenant-app Postgres/buckets). They are separated by **Docker networks + default-deny** (Compose) or **Kubernetes namespaces + NetworkPolicy/Cilium + Pod Security Admission** (RKE2, `DEC-INTENT-21`): tenant-app ingress via Traefik only, DB access only to the tenant-app instance, **no route to the control-plane network**; sandbox egress only via the control-plane proxy (`TECH-SEC-2`) | `DEC-INTENT-20`/`21`, `TECH-PKG-1`, `VV-ISO-3`. Core services + the VCS are **trusted** — never run inside OpenSandbox (a trust inversion); OpenSandbox contains only untrusted code. |
| `TECH-STREAM-1` | Real-time channel | **Bidirectional WebSocket** for the governed stream, collaboration presence, and client actions (`DEC-INTENT-05`); oRPC unary remains for request/response calls | A deliberate divergence from the reference stack's SSE default: two-way collaboration/presence (`SIT-09`) needs a bidirectional channel, and WebSocket maps 1:1 onto the extension's existing bidirectional `postMessage` protocol. Ordered delivery + keyset resume are preserved over the socket. |
| `TECH-STREAM-2` | Fan-out / presence hub | **Single-node in-process hub** for stream broadcast + presence initially (`DEC-INTENT-04`); **Redis pub/sub deferred** until a multi-node backend | On one node an in-process hub suffices; the hub interface is kept backend-agnostic so Redis pub/sub drops in when scaling out (`WF-STREAM-BROADCAST`). |
| `TECH-ENGINE-1` | Decomposition engine | **Reuse JanumiCode v2's existing engine as server-side library modules** (orchestrator, phase agents, capability broker, LLM providers — all already free of VS Code coupling), **extracted into the shared `packages/engine` workspace** (`DEC-INTENT-16`, `TECH-REPO-1`) and consumed by both the control-plane server and the extension, driven by DBOS workflows instead of the in-process loop | The core is already portable/headless (a CLI runner exists); this is a lift-and-rehost, not a rewrite. |
| `TECH-STATE-1` | Authoritative state | **Postgres governed-stream tables replace per-workspace SQLite** (+ sidecar bridge removed) | The SQLite sidecar exists only to survive Electron's native-ABI mismatch — irrelevant server-side; move to the tenant-scoped Postgres. |
| `TECH-EXEC-1` | Execution plane | **Isolated per-tenant sandboxes** running coding agents + compilers/test runners, driven by a job API; egress-controlled; escape-guarded | `DEC-INTENT-02/04`; the one capability beyond a standard SaaS control plane's scope. Untrusted code never runs in the control-plane process. |
| `TECH-EXEC-2` | Sandbox runtime | **OpenSandbox on Docker** on Compose (dev/small + the `REL-1` Cloud beta); on **RKE2** (`REL-2`+) the same sandbox abstraction runs as **isolated ephemeral Kubernetes Jobs/Pods** behind the Compute Broker (`DEC-INTENT-21`); the runtime boundary is abstracted for exactly this (`TECH-EXEC-4`) | R1 Docker-isolation **hardening is required** (`RQ-04`): rootless, seccomp + AppArmor, no-network-by-default egress, per-sandbox resource caps (CPU/memory/PIDs/disk). The stronger-isolation escalation is **`RuntimeClass` gVisor/Kata** on RKE2 (`REL-4`, `VOC-55`) if Docker/containerd hardening proves insufficient. |
| `TECH-EXEC-3` | In-sandbox executor | Reuse JanumiCode's coding-executor abstraction (`mimo`/OpenCode-derived + CLI agents); `node-pty`/ConPTY becomes a Linux PTY in-container | Preserves existing executor investment; Linux PTY drops the Windows ConPTY quirks. Feeds the coding agent structured test diagnostics via the harness (`TECH-TEST-1..5`). |
| `TECH-EXEC-4` | Compute governance | **JanumiCode Compute Broker** above OpenSandbox: admits/schedules sandbox jobs, enforces per-tenant fairness + entitlement + quota, and meters compute for billing; keeps the control plane runtime-backend-agnostic | `DEC-INTENT-04`; the product's tenancy/economics boundary over whatever sandbox runtime is in use (`WF-EXEC`, `WF-METER`, `WF-ENTITLEMENT`). |
| `TECH-MOB-1` | Mobile client | **Capacitor-wrapped Svelte** (`DEC-INTENT-06`) consuming the generated OpenAPI SDK + WebSocket stream; **shares the `TECH-FE-2` Svelte component library** with web and the extension | One UI codebase across web/iOS/Android/extension maximizes reuse and UX fidelity (`QA-1`); Capacitor provides the native shell + push (`INT-PUSH`) + **OTA live-updates** for version-skew mitigation (`TECH-VER-5`). R3. |
| `TECH-SEC-1` | Secret management (vault of record) | **HashiCorp Vault — Community Edition** (self-hosted; sponsor-selected) is the **sole per-tenant/per-project credential vault of record**: encrypted at rest, KMS-rooted (cloud-KMS auto-unseal for Cloud; Transit/Shamir for air-gapped Enterprise — resolves Q-03), decrypted only within the control-plane access boundary. Multi-tenancy = path-scoped KV (`secret/tenants/<t>/projects/<p>/…`) + templated ACL policies + per-tenant auth roles (Vault Namespaces are Enterprise-only; Enterprise on-prem = one tenant-owned Vault) | `BD-06`, `AC-UJ01-2`, `DEC-INTENT-08`, `RQ-07`. Licensing note: Vault CE is BUSL-1.1; **OpenBao** (MPL-2.0 fork) is the drop-in if an OSI-open license is later required. Redaction (`VV-SEC-1`) stays JanumiCode-owned **end-to-end**. |
| `TECH-SEC-2` | Sandbox credential injection | Getting exactly **one short-lived, single-endpoint credential** to a sandbox is done **by the control plane** (mints it from Vault, `TECH-SEC-1`) via a JanumiCode-owned injection interface. **Primary:** a **control-plane egress/LLM proxy** holds the credential and the sandbox workload uses a **fake placeholder key** — the workload never reads a real secret (satisfies `AC-UJ12-1`/`BD-08`). **Alternative** (where a proxy can't front the call): a short-lived, tightly-scoped token delivered as an **ephemeral tmpfs secret**, revoked/cleared on teardown | Resolves `RQ-02`/`RQ-07`. **OpenSandbox's own credential-vault is NOT adopted as the authority** — Vault CE is the sole vault-of-record on **both** substrates (`DEC-INTENT-08`/`DEC-INTENT-21`); last-mile delivery is substrate-appropriate (Compose: the proxy/tmpfs mechanism above; RKE2: Kubernetes Secrets / External Secrets Operator / Vault Agent Injector, Vault remaining authoritative). Aligns with `RQ-04` deny-by-default egress. |
| `TECH-RES-1` | Data residency | Residency-zone binding per tenant (storage + compute locality) | `OUT-04`, `UJ-09`; a global-control-plane + residency-scoped-data-plane model is the reference direction. Enterprise self-host is inherently single-zone. |
| `TECH-I18N-1` | Internationalization | Paraglide-JS | Optional; deferred beyond R2 unless required. |
| `TECH-DELIVER-1` | Delivery | Push to **self-hosted git** (default; optional tenant remote) + build a container image → local Docker registry, as a governed `WF-DELIVER` step using tenant-scoped credentials | Realizes `CAP-16`/`BD-14` (`DEC-INTENT-07/12`). External PaaS/VPS targets deferred to `REL-4`. |
| `TECH-VCS-1` | Version control runtime | **Self-hosted git server** (e.g., Gitea/Forgejo) on the node, one repo per project; optional mirror to a tenant remote | `DEC-INTENT-12`; the VCS is a **trusted control-plane service** (`TECH-TOPO-1`) — **not** run inside OpenSandbox — that is part of the on-node composition (`INT-VCS`, `ENT-REPOSITORY`). |
| `TECH-HOST-1` | Application hosting runtime | Each tenant's built app runs as a **long-lived, isolated, resource-capped container** (default caps `RQ-08`: ≤1 vCPU, ≤512 MB, ≤256 PIDs, ≤1 GB disk; tenant-overridable within plan) on the single node (same hardening as `TECH-EXEC-2`: rootless, seccomp/AppArmor), ingress **only** via Traefik with **Cloudflare WAF/rate-limit + Traefik per-route rate-limit**, no control-plane access, and an **isolated managed data plane** (per-app DB + bucket, `TECH-DB-5`/`TECH-STORE-2`) | `DEC-INTENT-11`, `CAP-17`, `ENT-HOSTED-APP`, `DEC-INTENT-20`. A **hardened Docker container** managed by `WF-HOST` (not an OpenSandbox sandbox; `TECH-TOPO-1`); fair-shared vs. build sandboxes by the Compute Broker (`SIT-16`/`VV-FAIR-1`). HA/scale shares the single-node gap (`RQ-03`). |
| `TECH-MEDIA-1` | Media delivery edge | **Nginx** `secure_link` signed, expiring links + `X-Accel-Redirect` internal redirect to object storage (`TECH-STORE-1`): **platform media** scoped to the JanumiCode session/user; **deployed-app media** scoped by the app's own session/auth or public | `DEC-INTENT-13`, `CAP-18`, `ENT-MEDIA-LINK`. Platform-media scoping is stronger than plain presigned URLs (usable by anyone holding the link until expiry). |
| `TECH-COMPLIANCE-1` | Control framework | A control catalog mapped to **SOC 2 TSC**, **NIST 800-53** (RMF), and **GDPR articles**, with owners, implementation, and evidence procedures; access controls are policy-as-code (Cerbos); continuous evidence via `WF-EVIDENCE` | `DEC-INTENT-14`, `CAP-19`, `ENT-CONTROL`. Documentation (policies/procedures/system description) maintained for auditors (`COMP-DOC-1`). |
| `TECH-AUDITLOG-1` | Immutable audit log | Append-only, **tamper-evident** (hash-chained / WORM-retained) audit log of who did/saw/decided/changed what; time-synced; retained per policy | `COMP-AUD-1`, `ENT-AUDIT-EVENT`, `VV-AUD-2`. Backs SOC 2/RMF audit + GDPR accountability. |
| `TECH-CRYPTO-1` | Encryption | **TLS 1.2+ in transit** everywhere (Cloudflare↔Traefik↔services); **at-rest encryption** for Postgres, object storage, Vault, and backups; keys managed via Vault/KMS (`TECH-SEC-1`) | `COMP-CRYPTO-1`, `VV-CRYPTO-1`. SOC 2 Confidentiality / RMF SC / GDPR Art. 32. |
| `TECH-BCDR-1` | Backup & disaster recovery | Automated, encrypted backups (Postgres, Vault, object storage) with a **tested single-node restore** (scripts + runbooks + docs) and defined **RTO/RPO** — satisfies **RMF Contingency Planning** in R1 (`RQ-11`) | `COMP-BCDR-1`, `VV-BCDR-1`. **SOC 2 Availability (continuous uptime) is deferred** to multi-node HA (`RQ-03`/`REL-4`). |
| `TECH-REPO-1` | Codebase & build topology | **Single monorepo** (Bun workspaces + Turborepo): `packages/*` (shared, **AGPL-3.0** — incl. `packages/engine`, `api-contract`, `sdk`, `db`, `ui`, `brand`), `apps/*` (control-plane, docs), `clients/*` (web, mobile, vscode), **private `ee/*`** (commercial). Community artifact = build **excluding `ee/`**; Enterprise/Cloud = superset build + license (`TECH-LICENSE-1`). A **one-way import boundary** (community core never imports `ee/`, enforced by dependency-cruiser + a CI "community build" that must stay green) and an **allowlist + filtered-history public mirror** keep `ee/` private while the community tree is published | `DEC-INTENT-15/16`. One tree preserves atomic refactors across the shared Prisma/oRPC schema; excluding `ee/` gives the OSS edition zero proprietary bytes (audit + attack-surface benefit). |
| `TECH-LICENSE-1` | Licensing & entitlement runtime | A **signed license file → entitlement registry** gates `ee/` features at runtime; `ee/` capabilities **self-register only if present and licensed** (the community core defines the extension-point interfaces and never names an `ee/` implementation — mirrors the Capability-Broker / `ENT-AUTHORITY-POLICY` pattern). Community = no license / permissive default | `DEC-INTENT-15`, `ENT-FEATURE-FLAG`, `BD-07`. One superset binary serves both self-hosted Enterprise and Cloud, differing only by license tier. |
| `TECH-BRAND-1` | White-label / theming | A config-driven **brand engine** (`packages/brand`): product name, logo/asset set, color/typography **design tokens**, legal/support URLs, feature-visibility. **Runtime theming** for multi-tenant Cloud (brand resolved per tenant/host); **build-time brand profiles** for self-hosted, mobile (per-brand app listing/bundle-id), and internal extension VSIX builds. Orthogonal to editions; the engine ships in Community, **multi-brand unlock is an Enterprise entitlement** | `DEC-INTENT-15`, `TECH-FE-2`. Rebrand clients without forking; layered config `defaults → edition → brand → tenant → instance`. |
| `TECH-VER-1` | Versioning model & stamping | **One product SemVer** stamps every edition + client (each build carries a resolved version + commit SHA — no unstamped/placeholder version in production); **public contracts** — the **API major**, generated **SDK** package, **export format**, and **license-file schema** — are versioned **independently** with their own support windows. A **CI-tested compatibility matrix** ({client versions} × {API major} × {schema range} × {edition/channel}) is the governing artifact | `DEC-INTENT-17`. Product version = release train; contract versions move slower so external consumers don't churn every release. |
| `TECH-VER-2` | API versioning & deprecation | **Major-in-path** `/api/v{n}/rpc/{domain}[/{version}]/{method}` (formalizes `TECH-API-1`): the top-level `v{n}` is the **primary contract major** (**N-1 supported** on a **published deprecation calendar**), and the optional per-method `{version}` segment versions a single method without bumping the whole major; **additive-only within a major**; a breaking change mints a new major that runs **in parallel**; typed **deprecation warnings** + the resolved API version returned in response metadata | `DEC-INTENT-17`. The API is the contract SDKs, mobile, and self-hosted installs bind to; parallel majors + calendar give independent upgraders a safe window. |
| `TECH-VER-3` | Schema & state evolution | **Expand/contract (parallel-change) migrations** (add → dual-write/backfill → migrate readers → retire) for Postgres, so deploys are zero-downtime and an older backup restores into a newer schema; every persisted payload (governed-stream records, events, exports, config, license) carries a `schemaVersion` and is **upcast on read** by a version chain — an older `schemaVersion` is **upgraded, never hard-rejected** | `DEC-INTENT-17`, `TECH-DB-3`, `TECH-BCDR-1`. State outlives code; upcasting keeps long-lived self-hosted installs and cross-version restores working. |
| `TECH-VER-4` | Durable-workflow versioning | Pin DBOS **`application_version`** so an in-flight run **resumes on its own pinned code version** across a mid-run deploy; new runs adopt the new version; each workflow declares a **version + lifecycle state** (current/deprecated/retired, `migratesTo`) bound to the DBOS app-version | `DEC-INTENT-17`, `TECH-WF-1`; the durable-resume guarantee (`SIT-11`, `VV-DUR-1`) silently depends on this — currently unpinned. |
| `TECH-VER-5` | Client negotiation & mobile updates | Every client (web, mobile, extension, SDK) sends its version; the server advertises a **supported range + min-supported floor**; below-min → a **graceful forced-upgrade** surface (not a crash); deprecated-but-supported → warning + telemetry. **Mobile** adds **Capacitor OTA live-updates** (ship JS/asset fixes between app-store releases; native shell unchanged) to shrink review lag | `DEC-INTENT-17`, `TECH-MOB-1`/`TECH-FE-2`. Version handshake is the single mechanism that tames mobile + self-host + SDK skew. |
| `TECH-VER-6` | Release channels & self-host upgrades | **Cloud = continuous** (canary → prod); **Community = rolling latest**; **Enterprise = LTS** (pinned releases, ~12–18 mo support + security backports); **schema auto-migrates on upgrade** (`TECH-VER-3`) within an **N-version support window** recorded per `ENT-DEPLOYMENT` | `DEC-INTENT-17`, `QA-4`, `UJ-07`. Channels are the lever for the self-hosted skew problem — customers control their own upgrade timing. |
| `TECH-SUBSTRATE-1` | Deployment substrate | **Two substrates, one workload set**: **Docker Compose** (dev/eval/CI, `REL-1` Cloud beta, Community + small-Enterprise self-host) and **RKE2/Kubernetes** (Cloud GA `REL-2` single-node → multi-node HA `REL-4`; regulated/large Enterprise via Helm). Workloads are **substrate-agnostic** (same OCI images; Vault vault-of-record on both, K8s Secrets/ESO = last-mile; S3 storage); only the orchestration layer differs — trust tiers as **Docker networks** ↔ **K8s namespaces + NetworkPolicy/Cilium + PSA**, sandbox as **OpenSandbox/Docker** ↔ **K8s Jobs + `RuntimeClass` gVisor/Kata**. RKE2 baseline: single server node, Cilium/Calico CNI, PSA restricted, RBAC, ResourceQuota/LimitRange, secrets-encryption + etcd snapshots off-host | `DEC-INTENT-21`. Migration = re-orchestration, not rewrite; `VV-ISO-*` verified on both (`VV-ISO-4`). |
| `TECH-STACK-LOCK` | Stack constraint | **No Python / Django / FastAPI; legacy Python service stacks are not a target.** The core is Bun + oRPC + DBOS + Prisma/Postgres + Cerbos | `DEC-INTENT-10`; resolves the stack ambiguity (`Q-11`). External runtime dependencies (e.g., OpenSandbox, Vault, PgDog, Nginx, Gitea, Cloudflare, **RKE2/Kubernetes**) may be black-box services in other languages. |

---
## D.9 Verification & Validation Requirements (`VV-*`) and Quality Attributes (`QA-*`)

*V&V items are the primary NFR seeds (target / measurement / threshold) — directly consumable by Phases 7/8. Thresholds are **accepted** as the sponsor's current defaults (Q-12); those noted `(accepted)` may still be revisited after early load/latency data. `VV-AVAIL-1`/`VV-SCALE-1` carry single-node caveats (see Part F residuals).*

| ID | Category | Target | Measurement | Threshold |
|---|---|---|---|---|
| `VV-ISO-1` | Tenant isolation | No cross-tenant data access | Automated isolation test suite (attempt cross-tenant read/write/execute) | 100% denied; 0 leaks |
| `VV-ISO-2` | Execution isolation | Sandbox (OpenSandbox/Docker) cannot reach other tenants' data or control-plane secrets; R1 hardening (rootless, seccomp/AppArmor, no-network-default, resource caps) is present | Escape/egress test battery per sandbox profile + hardening-control assertion | 0 escapes; egress matches policy; all `RQ-04` controls verified |
| `VV-ISO-3` | Data-tier isolation | A hosted app can reach **only its own** database + bucket — **not** the platform control-plane Postgres, and not another app's DB/bucket; the platform DB and tenant-app DB are **separate instances/trust domains** (`TECH-DB-5`/`TECH-STORE-2`) | From a hosted app, attempt to reach the platform DB, another app's DB, and another app's bucket; verify the separate-instance topology | 0 reachability of the platform DB or any other app's data; per-app creds scope-limited |
| `VV-ISO-4` | Substrate isolation parity | Tenant/data/execution isolation (`VV-ISO-1/2/3`) holds on **both** substrates — Docker networks + default-deny (Compose) and NetworkPolicy/PSA (RKE2) — with no weaker guarantee on either (`DEC-INTENT-21`, `TECH-SUBSTRATE-1`) | Run the isolation battery on a Compose deployment and on an RKE2 deployment | 0 cross-tenant / control-plane leaks on either substrate |
| `VV-GOV-1` | Governance invariant | No GOVERN-tier effect without a human adjudication | Audit-trail assertion over completed runs + fault injection | 0 unadjudicated GOVERN effects |
| `VV-GOV-2` | Absent-governor safety | Runs never auto-advance past a GOVERN gate unattended | Notification-timeout fault injection | 0 auto-advances |
| `VV-FAB-1` | No fabrication | Failed LLM/exec calls never yield fabricated artifacts/passes; a green is independently verified (`TECH-TEST-3`) | Fault injection on providers + the integrity gate (coverage + mutation + anti-mock/anti-skip/no-empty-suite/test-invokes-target) | 0 fabricated artifacts; 0 empty/skipped-to-pass suites accepted |
| `VV-RT-1` | Real-time freshness | Stream update visible to all viewers quickly | p95 record-to-render latency across viewers | ≤ 1.5 s (accepted) |
| `VV-DUR-1` | Durability/resume | In-flight runs resume exactly-once after restart | Kill-and-restart control plane mid-run | 100% resume; 0 duplicate side effects |
| `VV-DUR-2` | Stream continuity | Client reconnect drops/duplicates no records | Network-drop injection + keyset diff | 0 gaps; 0 dupes |
| `VV-SEC-1` | Secret redaction | Credentials never in API/logs/stream/export/telemetry | Automated scanner over all egress surfaces | 0 secret occurrences |
| `VV-SEC-2` | Revocation latency | Revoked member loses access promptly | Timed revoke→denied on every surface | ≤ 60 s (accepted) |
| `VV-AUD-1` | Audit completeness | Every decision/credential-access/support-grant is logged | Coverage assertion over a scripted session | 100% |
| `VV-AGP-1` | Air-gapped | Enterprise air-gapped mode makes zero outbound connections | Egress monitor during a full run | 0 outbound |
| `VV-DEL-1` | Deletion completeness | Tenant/app deletion leaves no residue | Post-delete query sweep across the platform DB, the **tenant-app Postgres (per-app databases) + per-app buckets**, and object store | 0 residual records |
| `VV-PERF-1` | Decomposition latency | Time-to-first-artifact after intent submit | p95 over representative intents | ≤ 30 s (accepted) |
| `VV-AVAIL-1` | Availability | Control-plane uptime | Monthly measured availability | ≥ 99.9% Cloud (confirmed target `RQ-03`; single-node topology (`DEC-INTENT-04`) is an accepted HA gap for now, mitigated by durable resume; multi-node HA is `REL-4`) |
| `VV-SCALE-1` | Concurrency | Concurrent active runs on the single node (`DEC-INTENT-04`) | Load test to saturation | bounded by node capacity (measured); graceful backpressure required; multi-node scaling deferred |
| `VV-FAIR-1` | Compute fairness | No tenant is starved beyond a bounded fair-share under contention (`SIT-16`, `TECH-EXEC-4`) | Multi-tenant sandbox load test to saturation; measure per-tenant share | no tenant below its fair-share floor while others exceed it; broker admission enforces it |
| `VV-COV-1` | Coverage integrity | Declared gaps are explicit; no silent omissions | Coverage-report assertion + trace-link integrity | 0 dangling `traces_to`; all gaps declared |
| `VV-COST-1` | Spend safety | No metered work past a hard cap without authorization | Budget-exhaustion fault injection | 0 unauthorized overage |
| `VV-DELIVER-1` | Delivery integrity | Delivery pushes only governed-approved artifacts with tenant-scoped, redacted credentials; the commit links back to run traceability; no autonomous deploy (`AC-UJ15-1..4`, `SIT-17`) | Delivery test + credential-redaction scan + deploy-gate assertion | 0 non-approved pushes; 0 secret leaks; 0 autonomous deploys |
| `VV-HOST-1` | Hosted-app isolation & reachability | A hosted app is reachable at its subdomain over HTTPS, and its container cannot reach the control plane or another tenant's app/data (`CAP-17`, `SIT-18`) | Reachability probe + escape/egress battery per hosted app | reachable; 0 escapes; ingress only via Traefik |
| `VV-ROUTE-1` | Public routing correctness | A request to `<tenant-app-id>-vcs.janumicode.com` reaches only that tenant's container; unknown/mismatched Host is rejected (`TECH-ROUTE-1`) | Host-routing test matrix (correct, cross-tenant, unknown host) | 100% correct routing; 0 cross-tenant leakage |
| `VV-MEDIA-1` | Scoped media delivery | A **platform** media link works only for its issuing JanumiCode session/user and before expiry; a **deployed-app** media link is enforced by the app's own session (or public) and expiry — no JanumiCode session required of a public visitor (`CAP-18`, `TECH-MEDIA-1`) | Replay a platform link from a different JanumiCode session + after expiry; verify a public deployed-app link needs no JanumiCode session | 0 cross-user platform use; 0 post-expiry use; deployed-app links behave per app auth |
| `VV-COMP-1` | Control operating effectiveness (Type 2) | Sampled controls demonstrate effective operation over the **full audit period** (not point-in-time) with complete evidence (`CAP-19`, `SIT-19`) | Auditor sampling + evidence-completeness assertion across the period | 0 exceptions; unqualified-opinion-supportable |
| `VV-AUD-2` | Audit-log integrity | The audit log is append-only, complete, and tamper-evident (`TECH-AUDITLOG-1`) | Tamper-injection + completeness assertion over a scripted session | 0 undetected tampering; 0 gaps |
| `VV-DSR-1` | Data-subject-request timeliness | DSRs are fulfilled within the legal window and completely (`UJ-18`, `SIT-21`) | Timed DSR drill (access + erasure across all stores incl. backups) | 100% within window; 0 residual after erasure |
| `VV-BREACH-1` | Breach-notification timeliness | A reportable breach is notified within the required window (`UJ-19`, `SIT-20`) | Tabletop / fault-injection breach drill, timed | notification ≤72h (GDPR); lifecycle recorded |
| `VV-CRYPTO-1` | Encryption everywhere | All data is encrypted in transit and at rest (`TECH-CRYPTO-1`) | Automated scan of channels + stores | 0 plaintext channels; 0 unencrypted stores |
| `VV-BCDR-1` | Backup & restore | A restore meets RTO/RPO and is periodically tested (`TECH-BCDR-1`) | Scheduled restore drill from backup | restore ≤ RTO; data loss ≤ RPO |
| `VV-VER-1` | Upgrade & backward compatibility | An upgrade N-1 → N migrates schema with **zero data loss**, in-flight runs resume, and an **N-1 backup restores into N**; every supported cell of the compatibility matrix passes (`TECH-VER-1/3/4/6`) | Automated upgrade + rollback + cross-version restore drill across the matrix | 0 data loss; 100% in-flight resume; all supported cells green |
| `VV-VER-2` | Version-skew safety | A below-min client is **gracefully forced to upgrade** (never a hard crash/blank); a deprecated-but-supported API major still works within its window; upcasters accept **every shipped `schemaVersion`** (`TECH-VER-2/3/5`) | Version-skew battery (old client × new server; old payload × new reader) | 0 hard failures; 0 rejected legacy payloads within the support window |
| `VV-OBS-1` | Telemetry schema stability | A version upgrade preserves dashboards/alerts/SLO queries (no metric/attribute break within the support window); exactly one canonical tenant key; metrics + logs actually export (`TECH-OBS-2`) | Schema-lint + upgrade drill replaying committed dashboards/alerts | 0 broken dashboards/alerts within window; 1 canonical tenant key; metrics + logs present |
| `VV-SLO-1` | Status & SLO integrity | SLIs compute correctly from telemetry; a **full node-down is detected and notified out-of-band by the off-node probe/monitor** (not an on-node workflow, which would share the outage) even though the on-node status page is unreachable; per-tenant status/health is RLS-scoped with **no cross-tenant leak** and no tenant content (`TECH-OBS-3`, `CAP-20`) | Inject a node-down + a partial degradation; verify detection, out-of-band notification, correct SLI, tenant isolation | node-down detected + notified; 0 cross-tenant leak; 0 tenant content in status |
| `VV-TEST-1` | Diagnostic completeness | A failing test yields a **structured, reproducible bundle** — assertion detail + correlated trace/logs + `reproduce:{command,run_id,seed}` + `traces_to` its AC/task (`TECH-TEST-1/2`, `CAP-21`) | Inject representative failures across the pyramid; assert bundle completeness + one-command reproduce | 100% of failures produce a complete, reproducible, AC-linked bundle |
| `VV-TEST-2` | Test integrity (green = working) | Coverage ≥ target and mutation score ≥ target per leaf; **0 empty/skipped-to-pass suites**; every 'pass' independently verified (`TECH-TEST-3`, `VV-FAB-1`) | Mutation + coverage run + integrity scan over a corpus incl. adversarial fake-pass attempts | coverage/mutation ≥ targets; 0 fake passes accepted |
| `VV-TEST-3` | Flake governance | Flakes are detected and quarantined as defects; a pass-after-flaky-fail is not counted fixed; the hermetic env has no ambient network (`TECH-TEST-4`) | Inject a nondeterministic test + a network-dependent test; verify detection, quarantine, hermetic block | flakes detected + quarantined; 0 masked-by-retry; 0 ambient-network reads |

**Quality Attributes (`QA-*`)** — free-form NFR seeds where a measurable V&V isn't yet framed:
- `QA-1` **UX fidelity** — the web/mobile governed-stream experience should feel continuous with the extension, not a diminished re-skin.
- `QA-2` **Legibility of degradation** — every failure/pause is explained to the user with a governed next step.
- `QA-3` **Portability of tenant data** — export/import formats are open and documented.
- `QA-4` **Operability** — self-host install/upgrade is reproducible from published artifacts with documented steps only, on the appropriate substrate: a **Docker Compose bundle** (Community/small) or an **RKE2 Helm chart** (regulated/large Enterprise) (`DEC-INTENT-21`).
- `QA-5` **Extensibility** — new decomposition phases / executors / model providers add without core forks; **edition differences are open-core `ee/` module inclusion + license entitlements + policy/flags, never forks** (`DEC-INTENT-15/16`, `TECH-REPO-1`/`TECH-LICENSE-1`, `BD-13`).
- `QA-6` **Accessibility** — governed-stream and decision surfaces meet WCAG AA (accepted) on web and mobile.

## D.10 Compliance & Governance Obligations (`COMP-*`)

*Compliance/audit surfaces are explicit (not silent). Each seeds retention/audit wiring (Phase 5) and tests (Phase 7).*
- `COMP-AUD-1` **Immutable audit trail** — append-only, tamper-evident record of who did/saw/decided what; exportable per period (`UJ-09`).
- `COMP-ISO-1` **Tenant data isolation** — enforced at data + execution layers; provable (`VV-ISO-*`).
- `COMP-RES-1` **Data residency** — tenant data + processing pinned to an assigned zone (`TECH-RES-1`).
- `COMP-RET-1` **Retention** — configurable retention windows with scheduled purge (`WF-RETENTION`).
- `COMP-DEL-1` **Right to deletion** — complete, verifiable tenant deletion with certificate (`UJ-13`, `VV-DEL-1`).
- `COMP-CONSENT-1` **Least-privilege support access** — no operator access without time-boxed, scoped, audited consent (`UJ-10`).
- `COMP-SSO-1` **Enforced SSO** — Enterprise can require IdP-based auth and disable passwords (`UJ-09`).
- `COMP-IP-1` **IP & confidentiality** — product intent and generated code are tenant-confidential by default; not used to train shared models; not readable across tenants.
- `COMP-KEY-1` **Credential custody** — BYOK secrets are held encrypted and returnable/removable by the tenant; never surrendered as a precondition of service.
- `COMP-SBOM-1` **Generated-code provenance** — **deferred** (Q-07); a candidate **Enterprise-only** offering: optionally attach provenance/SBOM/traceability to generated artifacts for downstream inheritors (`A-09`). Not in `REL-1..3`.
- `COMP-SOC2-1` **SOC 2 Type 2** — controls operate effectively over an audit period, with evidence (`VV-COMP-1`, `WF-EVIDENCE`). **Initial scope (`RQ-10`): Security (mandatory) + Confidentiality + Privacy + Processing Integrity.** **Availability is targeted but NOT in the initial scope** — the single-node topology (`DEC-INTENT-04`) cannot meet it until HA (`REL-4`, `RQ-11`).
- `COMP-RMF-1` **DoD RMF — target IL4** (`RQ-09`) — NIST 800-53 baseline for **Impact Level 4** (CUI; ≈ FedRAMP Moderate + DoD SRG controls), a defined authorization boundary, continuous monitoring, and a POA&M. The **software** implements the control set; a full IL4 ATO is granted to the **Enterprise/self-hosted edition deployed in the customer's IL4-authorized environment** (hosting/personnel/boundary controls are the deployment's).
- `COMP-GDPR-1` **GDPR** — lawful basis, data-subject rights (`UJ-18`), records of processing (`ENT-PROCESSING-RECORD`), DPAs/subprocessors (`ENT-SUBPROCESSOR`), breach notification ≤72h (`UJ-19`), EU data residency (`COMP-RES-1`), and privacy-by-design.
- `COMP-CRYPTO-1` **Encryption** — data encrypted in transit and at rest across all stores (`TECH-CRYPTO-1`, `VV-CRYPTO-1`).
- `COMP-CHANGE-1` **Change management** — Platform changes are governed, tested, approved, and evidenced (`ENT-CHANGE-RECORD`).
- `COMP-ACCESS-1` **Access management** — least-privilege (Cerbos) with periodic access reviews (`WF-ACCESS-REVIEW`, `ENT-ACCESS-REVIEW`).
- `COMP-VENDOR-1` **Vendor/subprocessor management** — third parties processing tenant data are inventoried with DPAs + risk review (`ENT-SUBPROCESSOR`).
- `COMP-BCDR-1` **Backup & recovery** — automated backups + **tested single-node restore** (scripts/runbooks/docs) with defined RTO/RPO satisfy **RMF Contingency Planning** in R1; **SOC 2 Availability (continuous uptime) is deferred** to multi-node HA (`RQ-11`, `TECH-BCDR-1`, `VV-BCDR-1`).
- `COMP-INCIDENT-1` **Incident response** — detect→contain→assess→notify→remediate, with breach notification in-window (`WF-INCIDENT`, `VV-BREACH-1`); tenant-facing status/incident communication is `TECH-OBS-3`/`COMP-OBS-1`.
- `COMP-OBS-1` **Observability & service transparency** — telemetry carries no tenant content/secrets (`VV-SEC-1`) and is retained per policy (`COMP-RET-1`); Platform status and incidents are communicated to affected tenants (`COMP-INCIDENT-1`, `TECH-OBS-3`); supports SOC 2 monitoring/communication criteria and GDPR data-minimization in telemetry (`DEC-INTENT-18`).
- `COMP-DOC-1` **Documentation** — policies, procedures, and a current system description are maintained for auditors (`TECH-COMPLIANCE-1`).
- `COMP-LIC-1` **Open-source & licensing compliance** — the Community edition is **AGPL-3.0**; its network-served **corresponding source** obligation is satisfied by the public mirror (`TECH-REPO-1`); `ee/` is under a **commercial license**; a **Contributor License Agreement (CLA)** secures the relicensing rights the dual-license requires; third-party dependency licenses are scanned for AGPL compatibility; NOTICE/attribution is maintained (`DEC-INTENT-15`, relates to `COMP-IP-1`).

## D.11 Canonical Vocabulary (`VOC-*`)

| ID | Term | Definition |
|---|---|---|
| `VOC-01` | **Platform** | The JanumiCode product family described here — **Community**, **Enterprise**, and **Cloud** editions, with web/mobile/extension clients. |
| `VOC-02` | **Extension** | The existing JanumiCode v2 VS Code extension (the source experience). |
| `VOC-03` | **Tenant** | The root isolation unit (`ENT-TENANT`); solo, team, or enterprise organization. |
| `VOC-04` | **Run** | One decomposition+execution instance over a product intent (`ENT-RUN`). |
| `VOC-05` | **Governed Stream** | The append-only, ordered, authoritative event log of a run that the UI projects. |
| `VOC-06` | **Decision Card** | The presented adjudication surface for a raised `ENT-DECISION`. |
| `VOC-07` | **Governor** | A human with authority to adjudicate a class of decisions. |
| `VOC-08` | **Capability vs Authority** | Capability = what an agent can technically do; Authority = permission to commit a consequential effect. Agents have capability; humans grant/hold authority. |
| `VOC-09` | **Capability Broker** | The mediation layer exposing READ / PROPOSE / GOVERN tiers to agents. |
| `VOC-10` | **BYOK** | Bring-Your-Own-Key: the tenant supplies model provider credentials. |
| `VOC-11` | **Sandbox** | An isolated, ephemeral, per-tenant execution environment (`ENT-SANDBOX`). |
| `VOC-12` | **Control Plane** | The modular-monolith services (identity, intake, orchestration, governance, UI/API). |
| `VOC-13` | **Execution Plane** | The isolated sandbox workers that run untrusted generated code. |
| `VOC-14` | **Decomposition** | JanumiCode's Phase 1–8 transformation of intent into governed, traceable artifacts. |
| `VOC-15` | **Packet** | An implementation packet: the per-task bundle handed to execution (Phase 9). |
| `VOC-16` | **Declared Gap** | An explicitly recorded coverage shortfall (never a silent omission). |
| `VOC-17` | **Edition** | A licensed/deployment tier of the one codebase: **Community** (AGPL, self-hosted, single-tenant), **Enterprise** (commercial, self-hosted, +`ee/`), or **Cloud** (hosted, multi-tenant). Distinguished by build-time `ee/` inclusion + runtime entitlement, never a fork (`DEC-INTENT-15/16`). *Clients (web/mobile/extension) are surfaces, not editions.* |
| `VOC-18` | **Air-gapped** | An Enterprise deployment with no outbound network access. |
| `VOC-19` | **Compute Broker** | The JanumiCode control-plane service that admits, schedules, and meters sandbox jobs and enforces per-tenant fairness/entitlement over the execution runtime (`TECH-EXEC-4`). |
| `VOC-20` | **OpenSandbox** | The sandbox runtime (Docker backend, single node initially) that executes generated code under the Compute Broker (`TECH-EXEC-2`). |
| `VOC-21` | **Delivery** | Pushing the governed project to version control, building, and deploying it (`CAP-16`, `WF-DELIVER`, `BD-14`). |
| `VOC-22` | **Hosted App** | A tenant's built app running as a long-lived, isolated JanumiCode-hosted container reachable at its subdomain (`ENT-HOSTED-APP`, `CAP-17`). |
| `VOC-23` | **Media Edge** | The Nginx-based media-serving layer issuing signed, expiring links — JanumiCode-session/user-scoped for platform media, and deployed-app-session-scoped (or public) for hosted-app media (`TECH-MEDIA-1`, `CAP-18`). |
| `VOC-24` | **Self-hosted VCS** | JanumiCode's on-node git server (default), with optional mirror to a tenant remote (`TECH-VCS-1`, `DEC-INTENT-12`). |
| `VOC-25` | **App Subdomain** | The public host for a hosted app: `<tenant-app-id>-vcs.janumicode.com` (`TECH-ROUTE-1`). |
| `VOC-26` | **Control** | A safeguard mapped to framework criteria (SOC 2 TSC / NIST 800-53 / GDPR), with owner + evidence (`ENT-CONTROL`). |
| `VOC-27` | **Evidence** | Timestamped proof a control operated over the audit period (`ENT-EVIDENCE`). |
| `VOC-28` | **Trust Services Criteria (TSC)** | The SOC 2 criteria: Security, Availability, Processing Integrity, Confidentiality, Privacy. |
| `VOC-29` | **RMF / ATO** | DoD Risk Management Framework; Authorization To Operate granted after assessment against NIST 800-53. |
| `VOC-30` | **DSR** | Data-Subject Request — a GDPR access/erasure/portability/rectification request (`ENT-DSR`). |
| `VOC-31` | **Open Core** | The delivery model: an AGPL-3.0 community core (`packages/*`) plus a commercial `ee/*` set, in one monorepo (`DEC-INTENT-15/16`, `TECH-REPO-1`). |
| `VOC-32` | **Community Edition** | The AGPL-3.0, self-hosted, single-tenant edition built **without** `ee/` (`TECH-REPO-1`). |
| `VOC-33` | **Enterprise Edition** | The commercial, self-hosted edition = Community core **plus** the `ee/` feature set (SSO, multi-tenant isolation, compliance-evidence, …). |
| `VOC-34` | **Entitlement** | A capability unlocked by a signed license at runtime (`TECH-LICENSE-1`, `ENT-FEATURE-FLAG`, `BD-07`). |
| `VOC-35` | **`ee/` (Enterprise Modules)** | The private, commercially-licensed package tree; imports the community core but is never imported by it; excluded from the public mirror. |
| `VOC-36` | **Client vs Edition** | *Clients* (web, mobile, VS Code extension) are UI surfaces — rebrandable (`TECH-BRAND-1`), **not** license editions. *Editions* are Community/Enterprise/Cloud. |
| `VOC-37` | **Compatibility Matrix** | The CI-tested table of supported {client version × API major × schema range × edition/channel}; the governing versioning artifact (`TECH-VER-1`). |
| `VOC-38` | **Expand/Contract** | Parallel-change migration: add-new → dual-write/backfill → migrate readers → retire-old, so schema changes are zero-downtime and restore-across-versions safe (`TECH-VER-3`). |
| `VOC-39` | **Upcaster** | An on-read transform that upgrades an older `schemaVersion` payload to current — old data is never hard-rejected (`TECH-VER-3`). |
| `VOC-40` | **Release Channel** | A cadence/support track: Cloud continuous, Community rolling, Enterprise **LTS** (pinned + backported) (`TECH-VER-6`). |
| `VOC-41` | **Version Negotiation / Min-Supported** | A client advertises its version; the server enforces a supported range + minimum, forcing graceful upgrade below the floor (`TECH-VER-5`). |
| `VOC-42` | **SLI** | Service Level Indicator — a measured signal (uptime, latency, time-to-first-artifact, …) derived from telemetry (`ENT-SLI`, `TECH-OBS-3`). |
| `VOC-43` | **SLO / Error Budget** | A target over an SLI + the allowed budget of misses; internal, gates releases — **not** a contractual SLA (deferred to HA) (`ENT-SLO`, `TECH-OBS-3`). |
| `VOC-44` | **Status Page** | The tenant-facing service-status surface (up/degraded/down + incidents + maintenance), served on the origin node + external probe (`ENT-SERVICE-STATUS`, `TECH-OBS-3`). |
| `VOC-45` | **Telemetry Schema** | The versioned semantic-convention registry (one canonical tenant key, pinned semconv/Schema URL, stable metric names) all telemetry conforms to (`ENT-TELEMETRY-SCHEMA`, `TECH-OBS-2`). |
| `VOC-46` | **Synthetic Probe** | An external blackbox check of Platform reachability from outside the node, driving status + out-of-band alerts (`TECH-OBS-3`, `VOC-44`). |
| `VOC-47` | **Virtuous Cycle** | The bounded agent loop: run tests → read structured diagnostics → diagnose → fix → re-run, escalating on exhaustion (`DEC-INTENT-19`, `CAP-21`, `UJ-12`). |
| `VOC-48` | **Diagnostic Bundle** | The agent-facing failure package: structured result + correlated spans/logs + reproduce info (`ENT-DIAGNOSTIC-BUNDLE`, `TECH-TEST-1`). |
| `VOC-49` | **Test Pyramid** | The feedback ladder unit → integration → contract → E2E, run fast-cheap-first and gated (`TECH-TEST-5`). |
| `VOC-50` | **Mutation Testing** | Injecting faults into the code to confirm the tests actually catch them — evidence that a green is real (`TECH-TEST-3`). |
| `VOC-51` | **Flake / Quarantine** | A nondeterministic test; quarantined as a first-class defect, never masked by retry-to-green (`TECH-TEST-4`). |
| `VOC-52` | **Trust Tier** | One of the single node's three isolation tiers — trusted control-plane, untrusted OpenSandbox (ephemeral), and tenant-app (`DEC-INTENT-20`, `TECH-TOPO-1`). |
| `VOC-53` | **Tenant-App Data Plane** | A hosted app's isolated managed backing services — a per-app database (on the tenant-app Postgres) + a scoped bucket, with Vault-minted credentials (`ENT-APP-DATABASE`/`ENT-APP-BUCKET`, `TECH-DB-5`/`TECH-STORE-2`). |
| `VOC-54` | **Deployment Substrate** | The orchestration layer a deployment runs on — **Docker Compose** (dev/small/self-host, `REL-1` Cloud beta) or **RKE2/Kubernetes** (Cloud GA + HA + regulated Enterprise) (`DEC-INTENT-21`, `TECH-SUBSTRATE-1`). |
| `VOC-55` | **RuntimeClass (gVisor/Kata)** | The Kubernetes mechanism for running untrusted sandbox workloads under a stronger isolation runtime — the `REL-4` escalation from Docker hardening (`RQ-04`, `TECH-EXEC-2`). |

---
## D.12 Phasing Strategy (Releases)

*Ordered per `DEC-INTENT-01`. Each release advances a set of journeys; every accepted journey appears in ≥1 release. A journey may be **step-partitioned across releases** — its first release is where it begins delivering value and later releases extend it; the phased journey is `UJ-06` (metering in `REL-1`; billing in `REL-2`). Sequencing rationale, not arbitrary bucketing.*

### `REL-1` — Shared backend + Cloud SaaS (BYOK) + Community edition — *foundation*
**Rationale:** The self-hosted backend is essentially the SaaS backend minus tenancy, so building the shared control plane + two-plane execution first maximizes reuse and gets to a usable product fastest. That single-tenant slice of the core, published under **AGPL-3.0**, **is** the **Community edition**, which therefore ships in this release (`DEC-INTENT-15/16`, `RQ-12`): the public `ee/`-stripped mirror + CLA go live (`TECH-REPO-1`, `COMP-LIC-1`) and the edition is self-hostable via the same single-node composition below with operability docs (`QA-4`). The *guided, hardened* self-host **install & upgrade** journey (`UJ-07`) and the commercial **Enterprise** layer land in `REL-2` — a step-partition, like `UJ-06` metering→billing.
**Journeys:** `UJ-01, UJ-02, UJ-03, UJ-04, UJ-05, UJ-06` (metering only), `UJ-10, UJ-11, UJ-12, UJ-15, UJ-16, UJ-19` (incident response). **Runtime:** single Linux node on **Docker Compose** (this Cloud release is a **beta**; RKE2 is the GA substrate from `REL-2`, `DEC-INTENT-21`) running the full composition — OpenSandbox/Docker build sandboxes under the Compute Broker (`TECH-EXEC-1..4`), **self-hosted git** (`TECH-VCS-1`), **hosted-app containers + Traefik Host-routing behind Cloudflare `*.janumicode.com`** (`TECH-HOST-1`/`TECH-ROUTE-1`), the **media edge** (`TECH-MEDIA-1`), WebSocket real-time (`TECH-STREAM-1`), Vault-backed BYOK vault (`TECH-SEC-1`). **Metering:** usage recorded (visibility), billing deferred.
**Exit criteria:** a Solo Builder and a Team complete governed runs incl. isolated execution, **delivery, and a live hosted app** at its `*.janumicode.com` subdomain (`VV-HOST-1`/`VV-ROUTE-1`); scoped media serving (`VV-MEDIA-1`); multi-tenancy + RLS isolation verified (`VV-ISO-*`); durable resume verified (`VV-DUR-*`); BYOK vault live (`VV-SEC-1`); governed-stream UX at parity with the extension (`QA-1`); **compliance controls operational** — immutable audit log (`VV-AUD-2`), encryption everywhere (`VV-CRYPTO-1`), incident response (`VV-BREACH-1`), **backup + tested single-node restore** (`VV-BCDR-1`, RMF CP), and continuous evidence collection, starting the **SOC 2 Type 2 observation period** (`CAP-19`, `DEC-INTENT-14`; **Availability deferred to HA**, `RQ-11`/`REL-4`). The **Community edition** builds (`ee/`-excluded) and its public **AGPL mirror + CLA** are live (`TECH-REPO-1`, `COMP-LIC-1`). The **tenant status page + measured SLIs** are live with internal SLOs/error-budgets (`TECH-OBS-3`, `VV-SLO-1`) over one **governed telemetry schema** (`TECH-OBS-2`, `VV-OBS-1`) — **no contractual SLA** (`VV-AVAIL-1`). The **agent-facing test harness** delivers structured diagnostics unit-through-E2E with **green-means-working** enforcement (`TECH-TEST-1..5`, `VV-TEST-1..3`, `VV-FAB-1`).

### `REL-2` — Enterprise (self-hosted / private / compliant)
**Rationale:** Layer identity/compliance/private-model/billing — the commercial **`ee/` Enterprise set** — onto the proven core. The **Community** edition (AGPL, single-tenant) already shipped in `REL-1` (`RQ-12`); `REL-2` adds the **Enterprise** edition = the *same* self-host build with `ee/` **included + licensed** (`DEC-INTENT-15/16`, `TECH-REPO-1`/`TECH-LICENSE-1`), plus the guided install/upgrade UX (`UJ-07`, `WF-MIGRATE`/`WF-HEALTH`).
**Journeys:** `UJ-06` (billing), `UJ-07`, `UJ-09`, `UJ-13`, `UJ-14`, `UJ-17` (audit), `UJ-18` (DSR). **Adds:** SSO (`INT-IDP`), private endpoints (`INT-LLM-PRIVATE`), residency/retention/audit (`COMP-*`), self-host bundle (`WF-MIGRATE`, `WF-HEALTH`), **Square** platform-managed billing (`INT-PAYMENT`), **SOC 2 Type 2 audit + RMF authorization + GDPR (data-subject rights, DPAs) + BCDR** (`COMP-SOC2-1`/`COMP-RMF-1`/`COMP-GDPR-1`/`COMP-BCDR-1`), Enterprise **telemetry export** (`TECH-OBS-4`), **Cloud GA on single-node RKE2** + an **Enterprise RKE2 (Helm)** self-host option for regulated/large deployments (`DEC-INTENT-21`, `TECH-SUBSTRATE-1`).
**Exit criteria:** clean self-host install + upgrade (`AC-UJ07-*`); air-gapped zero-egress (`VV-AGP-1`); audit completeness (`VV-AUD-1`); verifiable deletion (`VV-DEL-1`); SSO enforcement (`AC-UJ09-1`); **SOC 2 Type 2 evidence supportable** (`VV-COMP-1`); DSR drills pass (`VV-DSR-1`). *(Breach `VV-BREACH-1` and restore `VV-BCDR-1` are `REL-1` gates.)*

### `REL-3` — Mobile Governance & Presence
**Rationale:** With the API + real-time stream stable, add the mobile client as a peer consumer.
**Journeys:** `UJ-08`. **Adds:** push (`INT-PUSH`), **Capacitor-wrapped Svelte** mobile client sharing the `TECH-FE-2` component library (`TECH-MOB-1`), presence over WebSocket.
**Exit criteria:** mobile decision-card content parity (`AC-UJ08-1`); mobile adjudication resumes runs (`AC-UJ08-2`); unattended-gate safety on mobile path (`VV-GOV-2`).

### `REL-4` — Beyond (backlog, not committed)
Generated-code provenance/SBOM as an **Enterprise offering** (`COMP-SBOM-1`, Q-07); a **multi-node RKE2 execution backend** (`DEC-INTENT-21`, beyond the single-node substrate) with **Redis-backed fan-out** (`TECH-STREAM-2`) and **HA** (closing the `VV-AVAIL-1` single-node gap); stronger sandbox isolation via **`RuntimeClass` gVisor/Kata** (`VOC-55`) if the isolation-hardening review calls for it; **tenant custom domains** (`TECH-ROUTE-1`) and **external deploy targets** (PaaS/VPS); **hosted-app HA / autoscale** (`RQ-03` HA gap; autoscale within-plan per `RQ-08`); third-party agent/model marketplace; advanced cost governance; richer pricing tiers (`Q-09`). Explicitly out of `REL-1..3` scope.

## D.13 Success Metrics (`SM-*`)
- `SM-01` **Time-to-first-value** — median time from signup to first completed governed run (Cloud), no local install.
- `SM-02` **Governance integrity** — % of completed runs with zero unadjudicated GOVERN-tier effects (target 100%).
- `SM-03` **Isolation assurance** — isolation test pass rate (target 100%) and zero cross-tenant incidents.
- `SM-04` **Resume reliability** — % of interrupted runs that resume exactly-once (target 100%).
- `SM-05` **Enterprise adoption** — # of self-hosted deployments passing their own compliance review.
- `SM-06` **Mobile governance latency** — median time from decision-raised to mobile adjudication.
- `SM-07` **UX continuity** — task-parity score between extension and web/mobile for the core governed-run flow.
- `SM-08` **Cost safety** — zero unauthorized overages across tenants.
- `SM-09` **Delivery-to-live** — median time from a governed-approved run to a live, reachable hosted app; and the % of approved runs that reach a live hosted app.
- `SM-10` **Control effectiveness** — % of controls with complete, on-time evidence over the period (target 100%); audit exceptions (target 0); mean time to fulfill a data-subject request and to notify a breach (within legal windows).
- `SM-11` **Service transparency & SLO** — SLO attainment vs. target + error-budget burn (internal); status/incident-communication timeliness to affected tenants; and, for Enterprise, telemetry-export adoption.
- `SM-12` **Agent self-correction efficacy** — % of leaves reaching a **verified** green within the fix-loop budget; median iterations-to-green; coverage/mutation scores; fabricated-pass detection rate (accepted fake passes target 0).

---

# PART E — TRACEABILITY MODEL

The Platform preserves JanumiCode's traceability spine, extended to the operational layers of this document:

```
Intent (Part A)
  → Operational Need (OUT-*, SC-*)
  → Capability (CAP-*)
  → Employment Pattern (EMP-*) / Decision Model (DEC-*)
  → Actor/System View (P-*, UJ-*, WF-*, SB-*, SCN-*)
  → Requirement seed (US/AC derived from UJ-*; NFR from VV-*/QA-*; stack from TECH-*; compliance from COMP-*)
  → Design Element (JanumiCode Phase 4 components; Phase 5 data models/APIs)
  → Implementation (Phase 6 tasks; Phase 9 executed code)
  → Validation Evidence (Phase 7 tests; Phase 8 evaluation; VV-* thresholds)
```

**Worked example (one thread):**
`OUT-05` (govern from anywhere) → `CAP-15` (notification/presence) + `CAP-06` (adjudication) → `EMP-09` (absent human) + `DEC-01` (authority) → `P-09` / `UJ-08` (mobile governor) + `WF-NOTIFY` + `WF-DECISION` → US: "As a Governor, I adjudicate a raised decision from mobile" with `AC-UJ08-1..3` → components (notification service, decision service, mobile client) → tasks/tests → `VV-GOV-2` (unattended safety), `VV-RT-1` (freshness).

**Downstream ID mapping (for JanumiCode ingestion).** In Phase 1, `P-*`→personas, `UJ-*`→userJourneys, `BD-*/ENT-*`→businessDomains/entities, `WF-*`→workflows (with `journey_step` triggers linking automatable steps), `INT-*`→integrations, `TECH-*`→technicalConstraints (authoritative), `VV-*`→vvRequirements, `QA-*`→qualityAttributes, `COMP-*`→complianceExtractedItems, `VOC-*`→canonicalVocabulary. Phase 2 mints US/AC/NFR carrying `traces_to` back to these IDs; the coverage verifier (Phase 1.8) checks every persona→journey, every domain→journey+workflow, and every automatable step→workflow linkage asserted here.

---

# PART F — QUESTIONS: SPONSOR ANSWERS & RESIDUALS

*The questions below were answered by the sponsor on 2026-07-07 (answers preserved inline). Each has been folded into the authoritative sections and, where it has structural consequences, recorded as a decision (`DEC-INTENT-04..10`, Part A.2). What remains genuinely open is collected under **Residual questions** at the end — those must not be silently invented downstream (Guidelines §11.F).*

**Resolution map:** Q-01/Q-04 → `DEC-INTENT-04` (`TECH-EXEC-1..4`, Compute Broker, single-node) · Q-02 → `DEC-INTENT-06` (`TECH-MOB-1`) · Q-03 → `DEC-INTENT-08` (`TECH-SEC-1`) · Q-05 → `DEC-INTENT-09` (`INT-PAYMENT`) · Q-06 → `DEC-INTENT-05` (`TECH-STREAM-1/2`) · Q-07 → deferred (`COMP-SBOM-1`) · Q-08 → `DEC-INTENT-07` (`CAP-16`/`BD-14`/`UJ-15`/`WF-DELIVER`) · Q-09 → resolved via `RQ-01` (`ENT-PLAN`/`BD-07`) · Q-10 → `EMP-08`/`ENT-ACCESS-POLICY` · Q-11 → `DEC-INTENT-10` (`TECH-STACK-LOCK`) · Q-12 → thresholds accepted (`⟨tune⟩` removed).

- `Q-01` **Sandbox isolation technology** (`TECH-EXEC-2`) — rootless containers / gVisor / Firecracker microVMs / per-tenant pods? Governs `VV-ISO-2` design and cold-start/cost. *Must resolve before R1 execution GA.*

Answer: Initially we will use OpenSandbox with Docker as the sandbox runtime on the single-node cluster. Implement a JanumiCode Compute Broker above it to enforce tenant fairness, entitlement, metering, and billing. Do not introduce Kubernetes, Nomad, LXD, or Firecracker yet. Design the runtime boundary so OpenSandbox can later move to a stronger or multi-node backend without changing JanumiCode’s product control plane.

- `Q-02` **Mobile client technology** (`TECH-MOB-1`) — native vs React Native/Flutter vs Capacitor-wrapped Svelte? Affects R3 cost and UX-fidelity (`QA-1`).

Answer: Capacitor-wrapped Svelte. This will hopefully allow for a largely seamless and shared components and library across the web, iOS and android, and VS Code extension targets as much as possible.

- `Q-03` **Secret/KMS custody per edition** (`TECH-SEC-1`) — cloud KMS vs on-prem HSM/soft-KMS for Enterprise; residency implications.

Answer: I'm thinking HashiCorp Vault self-hosted community version; however, I thought had read that OpenSandbox had its own creditial component however I don't know if it will meet needs (see: https://github.com/opensandbox-group/OpenSandbox/blob/main/docs/guides/credential-vault.md)

- `Q-04` **Sandbox compute scheduling & fairness** — pooling model, warm pools, per-tenant quotas, and cost attribution across tenants (`VV-SCALE-1`, `WF-METER`).

Answer: For this initial deployment, this will need to be targeted towards a single node deployment that will be setup. For the time being, we will just use docker on a linux

- `Q-05` **Billing/payment provider** (`INT-PAYMENT`) — only relevant once platform-managed keys are billed (R2).

Answer: Square will be the payment provider

- `Q-06` **Real-time transport ceiling** (`TECH-STREAM-1`) — does collaboration presence (`SIT-09`) require bidirectional WebSocket, or does SSE + unary actions suffice through R3?

Answer: bidirectional websocket

- `Q-07` **Generated-code provenance/SBOM** (`COMP-SBOM-1`) — is attaching provenance to generated artifacts in scope, and to what standard?

Answer: Deferred for the time being. But could be a good enterprise specific service offering

- `Q-08` **VCS / deployment scope** (`INT-VCS`) — is pushing/deploying the generated project part of core value, or strictly an integration point left to the tenant? (Originally scoped out for R1–R3; **now in core scope** per `DEC-INTENT-07` — resolved below.)

Answer: Pushing/deploying the generated project is part of the core value; especially for small teams and solo developers

- `Q-09` **Pricing & entitlement model** — plan tiers, what BYOK vs managed unlocks, quota shapes (informs `BD-07`).

Answer: To Be Determined

- `Q-10` **Model-routing policy defaults** (`EMP-08`) — default task-tier→model mapping, and whether tenants can override per phase.

Answer: Tenants should be able to configure

- `Q-11` **Legacy vs current stack alignment** — an older Python/Django/FastAPI service stack exists in the reference material alongside the current Bun/oRPC/DBOS stack; this document targets the **current** stack. Confirm no requirement to align with the legacy services.

Answer: We will not be using Python / Django / FastAPI in the stack. No requirement to align with the legacy services. Bun / oRPC / DBOS OS is current core selection.

- `Q-12` **Threshold tuning** — all `⟨tune⟩` V&V thresholds (`VV-RT-1`, `VV-SEC-2`, `VV-PERF-1`, `VV-AVAIL-1`, `VV-SCALE-1`, `QA-6`) need sponsor-set values before Phase 7.

Answer: Those defaults seem reasonable at this time.

## Residual questions — status (RQ-01..RQ-12 all resolved by 2026-07-08)
*All residuals `RQ-01..RQ-12` are answered by the sponsor (answers preserved inline below) and integrated into the authoritative sections. **`RQ-12` (2026-07-08): the AGPL **Community edition ships in `REL-1`** — its public `ee/`-stripped mirror + CLA go live at `REL-1`; the guided self-host install/upgrade UX (`UJ-07`) and the commercial Enterprise layer remain `REL-2`.** **RQ-02/RQ-07: HashiCorp Vault Community Edition is the sole credential vault of record on both substrates; OpenSandbox's credential-vault is not adopted as the authority (Kubernetes Secrets / ESO are last-mile delivery on RKE2, `DEC-INTENT-21`). RQ-08 resolved with configurable defaults.***
**Residual resolution map:** RQ-01 → `ENT-PLAN`/`BD-07` (30-day free, then $20/mo) · RQ-02 → **Vault CE only** (vault-of-record on both substrates; OpenSandbox credential-vault not the authority; K8s Secrets/ESO = last-mile on RKE2; `TECH-SEC-1`/`TECH-SEC-2`, `DEC-INTENT-21`) · RQ-03 → `VV-AVAIL-1` (99.9% target; single-node gap accepted) · RQ-04 → `TECH-EXEC-2`/`BD-08`/`VV-ISO-2` (rootless + seccomp/AppArmor + no-network-default + resource caps) · RQ-05 → `TECH-DELIVER-1`/`BD-14`/`WF-DELIVER` (container-image → Docker registry) · RQ-06 → `INT-PAYMENT` (US domestic market initially) · RQ-07 → **Vault CE**, per-tenant path-scoped shared key (`TECH-SEC-1`) · RQ-08 → configurable defaults (per-app caps + Cloudflare/Traefik rate-limits, `TECH-HOST-1`) · RQ-09 → RMF **IL4** target (`COMP-RMF-1`) · RQ-10 → SOC 2 = Security+Confidentiality+Privacy+Processing Integrity; **Availability deferred** (`COMP-SOC2-1`) · RQ-11 → R1 backup + single-node restore (RMF CP); Availability → HA/`REL-4` (`TECH-BCDR-1`) · RQ-12 → **Community edition ships in `REL-1`** (public AGPL mirror + CLA live at `REL-1`; guided self-host install `UJ-07` + Enterprise layer stay `REL-2`; `DEC-INTENT-15/16`, `TECH-REPO-1`).

- `RQ-01` **Pricing & entitlement tiers** (from Q-09, `BD-07`) — plan tiers, what BYOK vs platform-managed unlocks, quota shapes. **Resolved:** 30-day free trial, then flat $20/month; per-tier quota shapes still to be detailed.

Answer: Let's go with free for 30-days and then $20 / month.

- `RQ-02` **Vault vs OpenSandbox credential-vault** (from Q-03, `TECH-SEC-1`) — evaluate whether OpenSandbox's built-in credential-vault component (per its docs) suffices or complements HashiCorp Vault; decide before the credential vault is finalized.

Answer: **RESOLVED (superseded by RQ-07 / 2026-07-08) — Vault CE only.** OpenSandbox's credential-vault is **not adopted as the authority**: **HashiCorp Vault Community Edition** is the sole per-tenant vault-of-record on **both** substrates (`DEC-INTENT-08`/`DEC-INTENT-21`). Last-mile injection is control-plane/Vault-based — on Compose a proxy (primary) or ephemeral tmpfs token; on RKE2 Kubernetes Secrets / External Secrets Operator / Vault Agent Injector (Vault remaining authoritative). Folded into `TECH-SEC-1`/`TECH-SEC-2`, `DEC-INTENT-08`. *(The original "K8s-tied, we run single-node Docker" rationale is itself superseded by the two-substrate strategy `DEC-INTENT-21`; the Vault-CE-only conclusion stands.)*

- `RQ-03` **Single-node availability / HA** (from Q-04 + Q-12, `VV-AVAIL-1`) — a single Linux node cannot structurally guarantee 99.9% across restarts/deploys. Confirm whether 99.9% is an R1 *target* (accepting the gap, mitigated by durable resume) or requires HA sooner. Multi-node HA is `REL-4`.

Answer: 99.9% is a target. We are constrained by single node for the time being.

- `RQ-04` **Docker-level isolation hardening** (from Q-01, `VV-ISO-2`) — Docker isolation for multi-tenant *untrusted* code is weaker than gVisor/microVM. Define interim compensating controls (seccomp/AppArmor, rootless, no-network default, resource caps) and the trigger to move to a stronger backend.

Answer: To the extent that Docker can support those options like seccomp/AppArmor, rootless, no-network default, resource caps, then we can target those for this first production rollout.

- `RQ-05` **Deploy-target taxonomy** (from Q-08, `BD-14`/`WF-DELIVER`) — which deploy targets are in scope for R1/R2 (container registries, PaaS, VPS, …) and the precise boundary of "initiate deploy then hand off" vs. ongoing operation.

Answer: This needs to be generally lightweight. I'm assuming docker is its own local container registry and can be sufficient for this first capability

- `RQ-06` **Square coverage** (from Q-05, `INT-PAYMENT`) — confirm Square supports the target billing geographies/currencies for platform-managed keys, else a fallback provider.

Answer: Square supports the domestic U.S. market which is our primary focus for now.

- `RQ-07` **Platform-managed-key custody (R2) — RESOLVED (credential engine = Vault CE).** A Platform-owned shared key uses the same **HashiCorp Vault Community Edition** vault of record with per-tenant path-scoped policies (`secret/tenants/<t>/…`) preventing cross-tenant exposure; injection per `TECH-SEC-2`. *(The metering/entitlement detail of a shared managed key is folded into `BD-07`.)*

Answer: Let's use HashiCorp Vault Community Edition; OpenSandbox's credential-vault is only for Kubernetes deployments (we run single-node Docker).

- `RQ-08` **Hosted-app resource governance & abuse (R1) — RESOLVED (configurable defaults).** Per-app defaults: CPU ≤ 1 vCPU, memory ≤ 512 MB, PIDs ≤ 256, ephemeral disk ≤ 1 GB (all tenant-overridable within plan limits); Cloudflare WAF + rate-limiting at the edge; Traefik per-route rate-limit + in-flight caps; the Compute Broker fair-shares hosted apps vs. build sandboxes (`SIT-16`/`VV-FAIR-1`, `TECH-HOST-1`). *(Surfaced by the hosting expansion.)*

Answer: You may choose some configurable defaults.

- `RQ-09` **RMF impact level — RESOLVED: target IL4.** NIST 800-53 baseline for **DoD IL4** (CUI); the software implements the controls, and the ATO is granted to the Enterprise/self-hosted edition deployed in the customer's IL4-authorized environment (`COMP-RMF-1`).

Answer: We will target IL4 which the current tech stack and architecture should easily meet.

- `RQ-10` **SOC 2 TSC scope — RESOLVED.** Initial audit = **Security + Confidentiality + Privacy + Processing Integrity**; **Availability is deferred** (not achievable on single node until HA, `REL-4`) (`COMP-SOC2-1`).

Answer: We will *target* all four beyond security. However, we are initially constrained by our single node so we won't be able to *achieve* availability. But we can probably meet at least minimal requirements for confidentiality, privacy and processing integrity.

- `RQ-11` **BCDR / availability — RESOLVED.** R1 delivers **backup + tested single-node restore** (scripts/runbooks/docs) with RTO/RPO satisfying **RMF Contingency Planning**; **SOC 2 Availability is deferred** to multi-node HA (`REL-4`) (`COMP-BCDR-1`, `TECH-BCDR-1`, `VV-BCDR-1`).

Answer: Yes, it is noted that for this initial release we will not be able to achieve SOC 2 Availability. We should be able to for RMF CP test recovery and RTO/RPO via backup procedures just so that we have scripts, documentation, runbooks, etc. Our initial focus would probably be on restoring the single node from backups.

- `RQ-12` **Community-edition launch timing — RESOLVED: `REL-1`** (from `DEC-INTENT-15/16`) — the AGPL, single-tenant, `ee/`-excluded **Community edition ships in `REL-1`**: its public mirror + CLA go live at `REL-1` and it is self-hostable via the `REL-1` single-node composition + operability docs (`QA-4`, `TECH-REPO-1`, `COMP-LIC-1`). The *guided, hardened* self-host **install/upgrade** journey (`UJ-07`) and the commercial **Enterprise** (`ee/`) layer remain `REL-2` — a step-partition, not a contradiction. *(Candidate follow-up: a dedicated `UJ-20` "self-hoster installs the Community edition" if the `REL-1` self-host UX warrants its own journey.)*

Answer: REL-1

---

# APPENDIX — Evolution context (informative, not decomposed)

*Background for reviewers; downstream decomposition should treat Parts A–F as authoritative and this appendix as rationale.*

## G.1 What transfers from the extension (coupling summary)
The extension already has a clean seam between a **host-agnostic core** (orchestration engine, phase agents, capability broker, LLM providers, config/secrets — **zero `vscode` imports**, already driven by a headless CLI) and a **thin VS Code shell**. Migration classes:
- **Portable (lift-and-rehost):** orchestration engine + Phases 0–10, Client Liaison + Capability Broker, cloud LLM providers, config/secrets model (env-based, not VS Code SecretStorage), sandbox path/layout logic, and ~95% of the Svelte UI (components talk via a JSON message protocol, not the VS Code API). In the monorepo this portable core becomes **`packages/engine`** + **`packages/ui`**, consumed by both the extension and the control-plane server (`DEC-INTENT-16`, `TECH-REPO-1`). → `TECH-ENGINE-1`, `TECH-FE-1/2`, `TECH-REPO-1`.
- **Adaptable (shim/abstraction):** the `postMessage` protocol → **bidirectional WebSocket** + oRPC (`TECH-STREAM-1`; the socket maps 1:1 onto the extension's existing two-way message channel); local model endpoints → per-tenant configurable (`INT-LLM-PRIVATE`); Node `fs` workspace scan → tenant storage; SQLite persistence → Postgres/RLS (`TECH-STATE-1/DB-2`).
- **Re-architected (genuinely new):** multi-tenancy/identity (`BD-01`, `TECH-DB-2`), the isolated execution plane (`TECH-EXEC-*`), durable orchestration replacing the in-process loop (`TECH-WF-1`), real-time fan-out/presence (`TECH-STREAM-2`; in-process hub now, Redis-backed when multi-node), billing/metering (`BD-07`), the mobile client (`TECH-MOB-1`). The desktop-coupled executors (CLI agents, `node-pty`/ConPTY, `mimo serve`, toolchain runners) move into per-tenant sandbox workers.

## G.2 Why this platform stack fits
JanumiCode-as-a-service has exactly the hard problems this modular-monolith stack is built for — multi-tenancy, long-running durable workflows, file/media uploads, authz, observability, self-host + cloud editions — and the stack (SvelteKit + oRPC + Prisma/Postgres-RLS + DBOS + Cerbos, with PgDog in front of Postgres) maps almost 1:1 onto them. The single delta is **untrusted code execution**, addressed by the added execution plane (`DEC-INTENT-02`/`DEC-INTENT-04`). Adopting an already-proven stack also means mature operational tooling from day one.

## G.3 How to use this document with JanumiCode v2
Attach this file to a new run with the instruction *"Execute the intent described in the attached document."* The document deliberately front-loads the Operational Concept and Employment Model (per `Product Description Creation Guidelines.md`) and renders the Derived Views in the Interview-Framework-compatible, ID-namespaced form the extractors expect (per `Product Description Interview Framework.md`), so Phase 1 extraction should map cleanly with minimal blocking coverage/traceability gaps. Resolve Part F questions before or during Phase 1 rather than letting decomposition invent answers.

---
*End of executable product description — JanumiCode Cloud & Enterprise, Draft v0.10.*









