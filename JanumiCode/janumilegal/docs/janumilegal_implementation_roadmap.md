# JanumiLegal Implementation Roadmap

**Status:** Companion to `janumilegal_product_description.md` (source doctrine), `janumilegal_product_description_evolution.md` (architectural addendum), and `janumilegal_multi_matter_isolation_addendum.md` (multi-tenancy addendum).
**Form:** Wave-based checklist. Each wave has an exit gate. Waves do not start until the prior wave's gate passes.
**Codebase:** `JanumiCode/janumilegal/` (separate from JanumiCode v2; no source sharing).
**Substrate:** VS Code extension + Svelte webview + better-sqlite3 sidecar (form factor locked, mirrors JanumiCode v2). Active matter context is the cognitive isolation discipline; no VS Code workspace switching for matter switching.

**Adopted decisions (pre-Wave-0):**
- Issue Bloom — **Proposal C** (three-pass hybrid with seed coverage and divergence dampening) is adopted.
- First customer / design partner — **JC Law** (Linthicum Heights, MD; primary jurisdictions MD/VA/PA/DC; family law as MVP focus). See `janumilegal - initial client profile.md`.
- Counsel review of privilege architecture — **deferred** until a runnable demonstration exists; engineering proceeds against the privilege design draft (`docs/design/governed_stream_privilege.md`).
- Citator strategy — **hybrid open-data MVP** (Eyecite + CourtListener + CAP + Maryland primary-law sources) with all authority support labeled `machine_assessed` until commercial citator licensing (Wave 8/9 readiness item). Treatment classification is `machine_assessed_treatment`, never collapsed with citator status.
- Form factor — **VS Code + Svelte** locked.
- Staffing model for initial implementation — AI agents (this assistant) author CLV, lens packs, prompts, design documents, gold-matter content; user is product owner and reviewer.
- Calibration — gold-capture protocol (`docs/calibration/gold_capture_protocol.md`) authored before Wave 5 begins; seed gold matter is the source-document Family Law custody-enforcement test fixture.

Conventions:
- `[ ]` = open · `[~]` = in progress · `[x]` = done · `[-]` = deferred with rationale
- A **gate** is a binary go/no-go. Failing a gate halts wave promotion.

---

## Wave 0 — Foundations and Boundaries

**Objective:** Establish the codebase, build pipeline, persistence floor, and architectural ground rules before any legal logic exists.

### 0.1 Repository and build
- [ ] Initialize `JanumiCode/janumilegal/` as an independent project (own `package.json`, own `tsconfig.json`, own `esbuild.js`).
- [ ] Wire VS Code extension scaffold (extension host bundle).
- [ ] Wire webview client TypeScript bundle (lessons from JanumiCode v2: compiled TS modules under `src/webview/`, no template-literal client JS).
- [ ] Wire better-sqlite3 sidecar bundle (extension, webview, sidecar, rpcWorker — minimum four bundles).
- [ ] CI: typecheck, lint, unit-test on every commit.
- [ ] CI: configuration-vs-code linter stub (rule set populated in Wave 5).

### 0.2 Persistence floor
- [ ] Define greenfield SCHEMA_V1 with full tenancy scope: every domain table carries `firm_id`, `client_id`, `matter_id` (per multi-matter §9).
- [ ] Tables: firms, clients, matters, users, user_matter_access, lenses, lens versions, states, state outputs, artifacts, governed_stream_op, governed_stream_matter, agents, agent_runs, joint_representation_groups, common_interest_links, matter_keys, matter_context_switches, cross_matter_operation_audit.
- [ ] Sidecar RPC client + worker; sync bridging via SharedArrayBuffer + Atomics.wait.
- [ ] Schema validator (`validateSchema()`).
- [ ] Migration runner tolerant of consolidated-schema duplicate columns.

### 0.2a Tenant isolation floor
- [ ] Scoped data-access layer: every domain query injects active scope (firm/client/matter); unscoped queries refused.
- [ ] Linter rule: raw `db.prepare(...)` outside the scoped data-access layer is a CI error.
- [ ] Active matter context per session; switch is observable and recorded.
- [ ] Screened-matter filter applied at the data-access layer (not the UI layer).

### 0.3 Architectural ground rules (encoded as platform invariants)
- [ ] Three-layer enforcement: Layer 1 (core), Layer 2 (lens packs), Layer 3 (firm config) — directory boundaries with import-direction rule (lower layers may not import higher).
- [ ] Agent registry schema (TypeScript type) per source §Agent Registry — but enforce evolution §14 capability-group exclusivity.
- [ ] State-machine orchestrator interface (state handler contract; no state logic yet).
- [ ] CLV interface stubs (no entries yet).

### Wave 0 gate
- [ ] Build produces all bundles cleanly.
- [ ] Empty extension activates in VS Code.
- [ ] Sidecar opens DB, runs SCHEMA_V1, closes cleanly.
- [ ] CI green on a no-op test.
- [ ] Synthetic two-matter test: a query issued under matter A's scope cannot return any row from matter B; raw `db.prepare` use outside the scoped layer fails CI.

---

## Wave 1 — Canonical Legal Vocabulary and Collision Check

**Objective:** Lock the lexical foundation before any prompt template, schema, or lens pack is authored. Per evolution §1–§2.

### 1.1 CLV core entries (authored — see `docs/clv/canonical_vocabulary_v1.md`)
- [ ] CLV storage and versioning (`canonical_vocabulary` table, write-via-migration only).
- [ ] Generator extracts structured form from `docs/clv/canonical_vocabulary_v1.md`.
- [ ] Initial migration loads all v1 entries: 14 sections covering issues/claims/assertions, facts/findings/conclusions, reasoning primitives, authority, releases, reviews, parties, artifacts, gates, multi-matter tenancy, verification status, release status, privilege classification, plus versioning rules.
- [ ] Each entry: termId, canonicalName, oneLineDefinition, longDefinition, scope, allowedSynonyms, prohibitedSynonyms, exampleUsage, exampleMisuse, version.
- [ ] CLV read API (used by prompt templates and schemas).

### 1.2 Vocabulary Collision Check (VCC)
- [ ] VCC engine: detect cross-lens, cross-jurisdiction, cross-firm, prohibited-synonym, and soft collisions.
- [ ] Severity matrix per evolution §2.4 (BLOCK / WARN+ack / WARN).
- [ ] VCC trigger points: lens-pack load, firm-config merge, matter open, lens upgrade, CLV publish.
- [ ] `VocabularyCollisionReport` artifact + persistence.
- [ ] Firm-admin acknowledgement console for WARN+ack severities.

### 1.3 Schema and prompt-template binding
- [ ] Schema metadata convention: domain-meaningful fields declare CLV `termId`.
- [ ] Prompt-template registry binds to CLV `termId`s; load fails if reference is unresolved.

### Wave 1 gate
- [ ] CLV holds the full core set; every entry passes lint.
- [ ] VCC catches a deliberate seeded collision in test (synthetic Layer 2 redefining a Layer 1 term ⇒ BLOCK).
- [ ] Loading any artifact that references an unknown CLV term fails closed.

---

## Wave 2 — Lens Runtime, State Machine, Bounded Agent Execution

**Objective:** Build the orchestrator that will run every lens, before any specific lens exists.

### 2.1 Phase manifest contract
- [ ] `LensPhaseManifest` schema (evolution §4.1).
- [ ] Manifest loader with hard validation: schema, agent references, CLV references, VCC pre-check.
- [ ] Manifest versioning + supersedes chain.

### 2.2 State-machine orchestrator
- [ ] State handler dispatch.
- [ ] Required-state enforcement (no skipping).
- [ ] Allowed-transition enforcement (predecessors satisfied).
- [ ] Output-schema validation per state.
- [ ] State Transition Validator agent (deterministic, source agent #6).
- [ ] Escalation routing.

### 2.3 Bounded agent execution framework
- [ ] Agent registry storage and lookup.
- [ ] Agent invocation contract: lens id, lens version, state id, permitted task, prohibited actions, input data, output schema, validation rules, escalation conditions.
- [ ] Capability-group exclusivity enforcement (evolution §14).
- [ ] **`AgentInvocationScope` envelope mandatory on every agent call (multi-matter §5.1).**
- [ ] **Prompt assembler reads only from envelope; no global retrieval, no firm-wide RAG, no cross-matter examples.**
- [ ] **Per-matter prompt-cache namespace; no cache key may be reused across matters.**
- [ ] **Per-matter embedding stores; no shared vector store contains matter content.**
- [ ] LLM provider abstraction (model-agnostic).
- [ ] Agent run logging to operational track of Governed Stream (Wave 3 wires the stream itself).

### 2.4 Provider configuration
- [ ] CLI providers registered (anthropic + others) — adapt JanumiCode v2's pattern.
- [ ] `.env` loading; per-firm provider config in Layer 3.

### Wave 2 gate
- [ ] A trivial test lens (manifest with two states) loads and runs end-to-end with a mock agent.
- [ ] Required-state skip is blocked.
- [ ] Capability-group violation in a registry entry fails registration.
- [ ] Manifest with unknown CLV term fails to load.
- [ ] Two-matter agent isolation test: agent invoked on matter A receives a context envelope that excludes matter B; attempted access to matter B's sources is refused at the data-access layer; prompt cache key namespacing verified.

---

## Wave 3 — Governed Stream, Privilege Architecture, MMP

**Objective:** Stand up the audit/reasoning record with privilege awareness from day one. Per evolution §3 and §13.

### 3.1 Dual-track Governed Stream
- [ ] Operational-track storage (`governed_stream_op`).
- [ ] Matter-track storage, **physically segmented per matter** (per-matter file is the default; alternative recorded in privilege design doc).
- [ ] **Per-matter content keys; per-client wrap key; per-firm wrap key.**
- [ ] **Mental-impressions sub-segment encrypted with a separate per-matter key (not the same as matter content key).**
- [ ] Write-time classification: `op_metadata`, `work_product_factual`, `work_product_mental`, `attorney_client`, `client_confidential`, `public_record`.
- [ ] Cross-track read prohibition by default; unified matter view scoped to firm boundary.
- [ ] **Stream event scope mandatory: firm/client/matter, user, active_matter_context, CLV scope, Privilege Frame snapshot ref.**
- [ ] **Cross-matter event prohibition: a single event may not reference two matters; spanning operations emit paired events with shared correlation id.**

### 3.2 Privilege/Work Product Classifier agent
- [ ] Agent #46 implementation (LLM-backed where needed, deterministic where possible).
- [ ] Mandatory invocation on any non-`op_metadata` write.
- [ ] Privilege Frame schema (evolution §12) — initial fields: attorneyClientPairs, jointRepresentation, commonInterestPartners, corporateClient, protectiveOrders, sealedRecords, thirdPartyPresenceWaivers.
- [ ] **Joint-representation and common-interest data models populated; `CommonInterestLink` records explicit `sharedArtifactIds` (no implicit sharing).**

### 3.3 Discovery export controls
- [ ] Matter-scoped export only (no platform-wide bulk export).
- [ ] Classification-filtered export packages with redaction summary.
- [ ] Export log to operational track only.

### 3.4 Retention
- [ ] Per-firm, per-matter-type retention configuration (Layer 3).
- [ ] Default = matter lifecycle + jurisdictional floor.
- [ ] No "delete everything" admin path; deletion requires documented basis.

### 3.5 MMP (Matter Mirror / Menu / Pre-Mortem)
- [ ] MMP card types: Mirror, Menu, Pre-Mortem (legal-domain semantics per evolution §13).
- [ ] MMP storage (per matter, versioned).
- [ ] MMP webview UI (mirror decisions, menu selections, pre-mortem decisions).
- [ ] MMP submissions classified as `work_product_mental`.
- [ ] MMP outputs feed downstream states (not optional prompts).

### 3.6 Standalone privilege design doc
- [x] `docs/design/governed_stream_privilege.md` authored (engineering draft).
- [ ] Counsel review — deferred until runnable demonstration exists. Tracked as a Wave 9 readiness item.

### Wave 3 gate
- [ ] Privilege design doc reviewed by counsel.
- [ ] Synthetic matter generates events across all six classifications; export with discovery filter excludes mental-impressions and attorney-client by default.
- [ ] MMP cycle runs end-to-end on a test lens.
- [ ] No code path writes to matter track without classification.

---

## Wave 4 — Lens Boundary Handoff, Context Engineering, Reasoning Review

**Objective:** Make context loss between states detectable. Per evolution §6.

### 4.1 Lens Boundary Handoff (LBH)
- [ ] `LensBoundaryHandoff` schema.
- [ ] LBH producer at every handoff-flagged state transition and every cross-lens boundary.
- [ ] LBH as required input to downstream state.
- [ ] Cross-lens CLV scope check.

### 4.2 Context Engineer (legal)
- [ ] Context assembly entry point analogous to JanumiCode v2's `assembleContext()`.
- [ ] Narrative Curator agent (legal): produces the human-readable LBH `curatorNotes`.

### 4.3 Reasoning review and meta-governance agents (Tier 12)
- [ ] Lens Completeness Auditor.
- [ ] Intent Drift Detector (compares final artifact to originating LBH and Mirror cards).
- [ ] Shortcut / Superficiality Detector.
- [ ] Too-Clever-By-Half Review Agent.

### Wave 4 gate
- [ ] Test lens with three states emits LBH at each boundary; downstream state receiving missing LBH fails closed.
- [ ] Intent Drift Detector flags a synthetic drift case.
- [ ] LBH cross-lens CLV scope check blocks a synthetic mismatched lens chain.

---

## Wave 5 — Issue Bloom (Proposal C), Recursive Decomposition, Saturation

**Objective:** Implement the three-pass bloom discipline before any practice-area lens authors issue logic. Per evolution §7.

### 5.1 Three-pass Issue Bloom
- [ ] Pass 1 (SEED COVERAGE): every lens-defined seed domain produces a candidate or recorded non-applicability.
- [ ] Pass 2 (DIVERGENCE): at least one off-seed candidate or explicit attestation.
- [ ] Pass 3 (CONSOLIDATION + DAMPENING): no new domains; refinement only; new-domain in pass 3 escalates.
- [ ] Termination = pass 3 emits clean `IssueCandidateSet`. Hard cap = 3.

### 5.2 Issue Prune
- [ ] Retain / remove / defer / escalate decisions with reasons.
- [ ] No silent pruning rule (every removal carries an attested reason).
- [ ] Pruning decisions written to matter track of Governed Stream as `work_product_mental`.

### 5.3 Recursive sub-issue decomposition
- [ ] Per-retained-issue recursive decomposition with its own three-pass discipline per recursion level.
- [ ] Tier-based gate (analogous to JanumiCode v2 Wave 6): a recursion level may not start until the prior level's saturation has terminated.
- [ ] Promise.all gating semantics for parallel sub-issue branches.

### 5.4 Calibration and gold capture (protocol authored: `docs/calibration/gold_capture_protocol.md`)
- [ ] Seed gold matter `JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001` populated end-to-end from source-document lines 1040–2511.
- [ ] Synthetic two-matter isolation gold test `JLEGAL-ISO-MULTI-MATTER-001` operational.
- [ ] Assertion runner integrated with CI; hard-gate metrics enforced on every CI run (no override).
- [ ] Per-state structured outputs for all 22 states populated.
- [ ] Failure-trap encoding for all six source-document traps.
- [ ] Bloom evaluation: seed coverage rate (gated 100%), divergence rate (tracked), late-addition rate (gated 0), prune-reason completeness (gated 0 silent prunes).
- [ ] `regression_report.json` stored to operational track per run.

### Wave 5 gate
- [ ] Three-pass bloom runs on a synthetic seed-only matter, a synthetic novel matter, and a synthetic mixed matter; all produce conformant outputs.
- [ ] Late-addition in pass 3 triggers escalation.
- [ ] Recursive sub-issue decomposition completes on a multi-level test fixture without runaway.
- [ ] Gold set committed.

---

## Wave 6 — Practice-Area Lens Pack v1, Authority Verification, Conflicts

**Objective:** Ship the first runnable practice-area lens pack and the legal-content infrastructure it depends on. Per source MVP §Initial Lens Packs.

### 6.1 Lens packs (build to source MVP scope, not narrowed)
- [ ] Legal Research Memo Lens.
- [ ] Client Advice Draft Lens.
- [ ] Court Filing Draft Lens.
- [ ] Redline / Agreement Review Lens.
- [ ] Direct Legal Conclusion Lens.
- [ ] Authority Verification Lens.
- [ ] One or two practice-area lens packs shaped by the first customer (e.g., Family Law Production, Criminal Defense Production).

For each lens:
- [ ] Phase manifest authored (machine-readable, not prose).
- [ ] Per-state input/output schemas with CLV bindings.
- [ ] Per-state validators registered.
- [ ] Per-state prompt templates registered.
- [ ] Issue-domain seed set (for lenses with bloom).
- [ ] LNFR-domain bindings declared (Wave 8 layer wires the gates).
- [ ] Required-artifacts list.
- [ ] Release-policy bindings.

### 6.2 Authority verification — content infrastructure (hybrid open-data MVP)
- [ ] Citator integration design doc (`docs/design/citator_integration.md`) — open-data architecture for MVP.
- [ ] Citator provider abstraction; MVP wires Eyecite (extraction), CourtListener API (case retrieval + citation graph), CAP (historical opinions), Maryland primary-law sources (mgaleg.maryland.gov, Md. Rules, MD appellate opinions).
- [ ] Mechanical checks: citation format (Eyecite), source presence, quote matching, pinpoint existence, statute section existence, document section existence.
- [ ] Machine-assessed support: LLM-backed evaluation of whether authority supports proposition, controlling vs. persuasive, no adverse changes outcome.
- [ ] Machine-assessed treatment: classifier on top of CAP + CourtListener for "still good law / distinguished / criticized / overruled" — labeled `machine_assessed_treatment`, never collapsed with citator status.
- [ ] Citator-status field reserved as a distinct CLV term; remains empty until commercial citator is wired (Wave 8/9 readiness item).
- [ ] Deterministic/Probabilistic Check Labeler: never collapses any of mechanical / machine-assessed support / machine-assessed treatment / citator status / attorney-confirmed.
- [ ] UI labeling per CLV §11: source located, quote matched, machine-assessed support, machine-assessed treatment, citator status (when available), attorney confirmation required, attorney confirmed.

### 6.3 Conflicts agent
- [ ] Conflict-of-Interest Detection Agent (Tier 10, new per evolution §8.1).
- [ ] Trigger points: matter open, party addition, lens activation, reviewer assignment.
- [ ] `ConflictReport` severity model: none, waivable, non-waivable, imputed, requires-screening.
- [ ] Hard release block on non-waivable / unresolved.
- [ ] **Conflicts-only data-access surface (multi-matter §7.3): returns party identifiers, party roles, and matter status only — never matter-track content. Restricted to the conflicts agent and the firm conflicts-officer role. Audit trail to operational track.**

### 6.3a Brief bank / clause library promotion (multi-matter §5.3)
- [ ] Explicit attorney-action promotion flow.
- [ ] Content-scrubbing pass before any artifact enters firm knowledge layer.
- [ ] Source matter records the export; receiving matter records the inbound reference.
- [ ] No firm-wide RAG over matter content; firm knowledge layer contains only promoted, scrubbed artifacts plus public-record content.

### 6.4 Source-to-claim trace
- [ ] Trace data model: claim → source → supporting span → fact/authority type → state → verification status → attorney confirmation status.
- [ ] Source-to-Claim Trace Validator agent.

### Wave 6 gate
- [ ] All MVP lens packs load, validate, and run on a synthetic matter.
- [ ] The Family Law Production test fixture from source §Test Use Case passes its assertion set (lines 2462–2484 of source).
- [ ] Citator integration returns real status on at least one jurisdiction.
- [ ] Synthetic conflict triggers hard release block.

---

## Wave 7 — Attorney Action Model, Release Gates, UI Workbench

**Objective:** Wire human attorney involvement and release controls. Per evolution §9.

### 7.1 Attorney action model
- [ ] `AttorneyAction` schema (replaces boolean approval everywhere).
- [ ] Bar-number registry per attorney; jurisdiction admission tracking.
- [ ] Artifact version hashing; approval binds to bytes.
- [ ] Signature modes: wet, electronic, platform attestation, ECF-compatible.
- [ ] Reviewer Assignment Agent (deterministic, source agent #49).

### 7.2 Release Gate Evaluator
- [ ] Deterministic gate (source agent #50, evolution §5.4 LNFR consumption).
- [ ] Inputs: artifact type, target audience, review status, source trace status, authority verification status, privilege status, conflict status, LNFR gate status, firm policy, required approvals.
- [ ] Outputs: internal_draft, attorney_review_required, client_release_blocked, approved_for_client_use, filing_blocked, approved_for_filing.
- [ ] Filing requires `signing_attorney` admitted in forum jurisdiction (not approving partner alone).

### 7.3 UI workbench (custom legal views over VS Code)
- [ ] **Matter Header Bar (multi-matter §8.1) on every primary view: persistent, prominent, color-coded per matter, never collapsible.**
- [ ] **Explicit Switch Matter affordance (multi-matter §8.2): click-only, confirmation on pending work, full UI re-paint on switch, recorded to operational track.**
- [ ] **Folder-hierarchy on-disk layout (multi-matter §8.3): `firms/<firm_id>/clients/<client_id>/matters/<matter_id>/...` mirroring the DB scope tuple.**
- [ ] **Single active matter context per VS Code window; webview never shows non-active-matter content; explorer browse is read-only and does not switch active matter.**
- [ ] **Side-by-side comparison requires separate VS Code windows (separate processes, separate active matter contexts).**
- [ ] **Cross-matter dashboards (multi-matter §8.4): distinct chrome, read-only, no mutation affordances.**
- [ ] **Mistaken-matter recovery flow (multi-matter §8.6): mark misattribution, surface remediation checklist, re-evaluate release gates for affected artifacts.**
- [ ] Matter dashboard.
- [ ] Lens state machine view.
- [ ] Issue tree.
- [ ] Pruning decision log.
- [ ] Authority map.
- [ ] Source-to-claim trace view.
- [ ] Fact / law / assumption split view.
- [ ] Risk register.
- [ ] Attorney review queue.
- [ ] Legal production queue.
- [ ] Filing assembly view.
- [ ] Client communication console.
- [ ] Redline workbench.
- [ ] Release gate view.
- [ ] Governed Stream view (per-matter only; with classification-aware visibility).

### 7.4 Form-factor decision (locked pre-Wave-0)
- [x] VS Code + Svelte webview + better-sqlite3 sidecar locked. No migration plan needed at this time.

### Wave 7 gate
- [ ] End-to-end attorney workflow: matter open → bloom/prune → research/draft/filing → review → approve → release blocked or approved per target.
- [ ] Filing release blocked when signing attorney is not admitted in forum jurisdiction.
- [ ] All UI views render against a real matter without firm-specific hardcoding.
- [ ] Matter switch test: switching matters re-paints the entire UI; no panel retains stale matter content; switch event recorded.
- [ ] Screened-matter test: a user screened out from matter X sees no notifications, no autocomplete entries, no recently-viewed entries, no telemetry surfacing matter X.

---

## Wave 8 — LNFR Layer, Lens Versioning, Hardcoding Audit, Second-Firm Test

**Objective:** Lock platform discipline before opening to a second customer.

### 8.1 LNFR layer
- [ ] LNFR domain registry: privilege, candor to tribunal, conflicts, UPL, jurisdictional admission, confidentiality, deadlines and limitations, retention, malpractice exposure, billing/engagement scope, sanctions, competence, supervisory responsibility.
- [ ] LNFR bloom and saturation per matter (three-pass discipline analogous to Issue Bloom).
- [ ] LNFR gates feed Release Gate Evaluator; LNFR failure blocks release even when lens validators pass.
- [ ] LNFR results owned by matter (not reset by lens addition).

### 8.2 Lens versioning and migration
- [ ] Per-event lens-version recording on every state output, artifact, validator run, stream event.
- [ ] Default matter pinning to lens version at last completed state.
- [ ] Migration metadata: SAFE / PARTIAL / INCOMPATIBLE per version transition.
- [ ] Mid-matter upgrade flow with attorney authorization.
- [ ] Authority freshness floor; configurable re-verification trigger on lens upgrade.

### 8.3 First-customer hardcoding audit
- [ ] Configuration-vs-code linter rule set populated and CI-blocking in Layer 1.
- [ ] Periodic schema/registry/CLV audit script for Layer-3 identifiers.
- [ ] Hardcoded findings tracked.

### 8.4 Second-firm test
- [ ] Synthetic second firm + second jurisdiction + second practice area instantiated.
- [ ] Canonical evaluation suite runs against it.
- [ ] Test fails if onboarding requires changes outside Layer 3 + Layer 2 lens-pack adaptation.

### 8.5 Telemetry and regression auditor
- [ ] Required-state completion rate.
- [ ] Unsafe release rate.
- [ ] Unsupported claim rate.
- [ ] Silent pruning rate.
- [ ] Authority verification false-confidence rate.
- [ ] Attorney packet usefulness score.
- [ ] **Cross-matter operation audit reporting: count and detail of every authorized cross-matter operation (joint rep, common-interest, brief-bank promotion, conflicts read).**
- [ ] **Screened-matter surfacing audit: automated scan for any UI/notification/telemetry path that could surface a screened matter to a screened-out user.**

### Wave 8 gate
- [ ] LNFR gate failure blocks release on a synthetic deadline-miss matter.
- [ ] Lens upgrade mid-matter: SAFE upgrade auto-advances; PARTIAL marks stale states; INCOMPATIBLE refuses without force-migrate.
- [ ] Hardcoding linter green on Layer 1.
- [ ] Second-firm test passes.

---

## Wave 9 — Hardening, Evaluation Harness, GA Readiness

**Objective:** Reach defensible v1.0.

### 9.1 Evaluation harness
- [ ] Benchmark / Test Harness Agent runs lens outputs against expected assertions at scale.
- [ ] Gold set expanded to ≥ 20 matters per practice-area lens.
- [ ] Regression delta reporting per lens version.

### 9.2 Security and privilege hardening
- [ ] Penetration test of matter-track encryption and key isolation.
- [ ] Privilege-leakage red-team (export filters, classification bypass attempts, mental-impressions firewall).
- [ ] **Cross-matter leakage red-team specifically targeting: prompt cache, embedding stores, prompt assembler, UI side-channels (notifications, autocomplete, recently-viewed, telemetry), screened-matter enforcement.**
- [ ] DR + backup story for matter-track storage; per-matter restore must not surface other matters' content.

### 9.3 Documentation
- [ ] Lens authoring guide.
- [ ] Firm onboarding guide.
- [ ] Attorney user guide (per role).
- [ ] Operations runbook.

### 9.4 Deferred-design follow-throughs (from evolution §15)
- [ ] Citator data model and license finalized.
- [ ] E-filing protocol scope decision.
- [ ] DMS integration design (iManage / NetDocuments) if pursued.
- [ ] Calibration/gold-capture protocol formalized.
- [ ] Form-factor decision (if not already locked in Wave 7).

### Wave 9 gate
- [ ] Red-team report addressed.
- [ ] Evaluation harness green on full gold set.
- [ ] Two firms (real or synthetic) onboarded through Layer 3 only.
- [ ] Counsel sign-off on privilege architecture and release controls.

---

## Cross-Wave Standing Disciplines

These do not belong to any single wave; they apply continuously from Wave 0.

- [ ] **No silent skips** — every absent state, pruned issue, redacted stream event carries a recorded reason.
- [ ] **No boolean approvals** — `AttorneyAction` records or nothing.
- [ ] **No raw "verified"** — verification labels are tiered (source located, quote matched, machine-assessed, attorney confirmation required, attorney confirmed).
- [ ] **No core (Layer 1) reference to Layer 3 identifiers** — CI-enforced.
- [ ] **No prompt template referencing an unknown CLV term** — load-time enforced.
- [ ] **No agent owning two capability groups** — registry-enforced.
- [ ] **No matter-track write without classification** — write API rejects.
- [ ] **No citator collapse** — citator status and machine-assessed support are separate fields, always.
- [ ] **No unscoped query** — every domain query carries firm/client/matter or comes from an explicitly-permitted unscoped registry.
- [ ] **No agent invocation without scope envelope** — no exceptions.
- [ ] **No cross-matter event in a single stream record** — paired events with correlation id only.
- [ ] **No UI affordance that surfaces a screened matter** — including notifications, autocompletes, telemetry, recently-viewed.
- [ ] **No firm-wide RAG over matter content** — firm knowledge contains only explicitly-promoted, scrubbed artifacts plus public-record content.
- [ ] **No simultaneous matter work in a single pane** — workspaces only.
- [ ] **No silent matter switch** — every switch is observable, confirmed, and recorded.

---

## Wave 10 — LLM/Agent Harness (Extension)

**Objective:** Wire real LLM provider calls and agentic-CLI subprocesses into the lens runtime, mirroring JanumiCode v2's provider/agent architecture.

Shipped: `LlmBackedAgent`, `CliBackedAgent`, lazy-loading provider registry (Mock / Ollama / Anthropic / Google), Goose / Claude / Codex / Gemini CLI agents, 11 authored Family Law prompt templates with CLV bindings, `FirmLlmRouting` slot in `FirmConfig`, `InvocationLogger` matter-track events.

### Wave 10.1 follow-ups (shipped)

- JSON-repair loop on LlmBackedAgent (configurable `repairAttempts`).
- `FallbackProvider` chain wrapper.
- Routing-driven thin-slice runner (`pnpm thin-slice:run -- --provider=ollama --cli=goose`).
- CLI envelope-source materialization wired through agent factories.
- Layer-1 `AgentRoutingConfig` types so Layer-2 factories don't violate import direction.

---

## Wave 11 — Reasoning-Review Harness (Validator Catalog)

**Objective:** Make every state output's reasoning quality measurable, auditable, and gate-able. Legal-domain analog of v2's `lib/review/harness/`.

Design: [docs/design/wave11_reasoning_review_harness.md](design/wave11_reasoning_review_harness.md). 24-validator initial catalog (12 deterministic + 12 LLM) across 9 families. Decorrelated reviewer-model invariant (calibration default: primary qwen2.5:9b / reviewer gemma2:e4b on local Ollama). Per-finding matter-track records under `work_product_factual` (deterministic) or `work_product_mental` (LLM). Final-synthesis decision feeds the Release Gate Evaluator: unresolved HIGH findings block external release.

### Wave 11 gate
- [ ] All 24 validators registered.
- [ ] Decorrelation invariant enforced at agent-build time.
- [ ] Thin slice produces a reasoning-review record per state.
- [ ] Release gate blocks on a synthetic HIGH finding.
- [ ] All 3 gold matters pass with expected reviewer agreement.
- [ ] Calibration / gold-capture protocol updated to capture reviewer findings as a fourth artifact class.

---

## Wave 12 — Review UX, AttorneyAction Integration, Reviewer-Agreement Metrics

**Objective:** Surface Wave 11 findings to the attorney; capture annotations; compute per-validator precision/recall.

Design: [docs/design/wave12_review_ux_and_reviewer_agreement.md](design/wave12_review_ux_and_reviewer_agreement.md). Webview finding panels with severity-coded UI; AttorneyAction extended with `acknowledged_finding` and `override_finding` types bound to artifact version hashes; calibration dashboard with per-validator precision/recall; gold-matter annotation pass via `scripts/thinSliceReview.ts --annotate`.

### Wave 12 gate
- [ ] Webview surfaces all per-state findings.
- [ ] AttorneyAction acknowledgement / override implemented; release gate honors them.
- [ ] Artifact-hash invalidation tested.
- [ ] Annotation pass run against all 3 gold matters.
- [ ] Calibration dashboard shows per-validator precision/recall.
- [ ] At least one validator severity-tuning iteration recorded.

---

## Wave 13 — Red-Team Harness (Adversarial & Prompt-Injection Validators)

**Objective:** Make the system robust under adversarial inputs (source-borne prompt injection, citation poisoning, encoding obfuscation, output exfiltration, reviewer co-option).

Design: [docs/design/wave13_red_team_harness.md](design/wave13_red_team_harness.md). 7 red-team validators across two slots (source-admission and per-state), 18-fixture starter corpus organized by attack family, defensive preamble injection for `suspect` sources, third decorrelated reviewer model for co-option auditing, CI gates `pnpm red-team:corpus` and `pnpm red-team:e2e`.

### Wave 13 gate
- [ ] 18-fixture corpus authored and labeled.
- [ ] 7 red-team validators implemented; corpus passes.
- [ ] Defensive preamble invariant enforced.
- [ ] Source-admission rejects blocked sources before any state sees them.
- [ ] `primary != reviewer != co_option_reviewer` invariant enforced at agent-build time.
- [ ] Calibration dashboard surfaces per-family red-team block rates.

---

## Wave Dependency Summary

```
Wave 0 → Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5 → Wave 6 → Wave 7 → Wave 8 → Wave 9 → Wave 10 → Wave 11 → Wave 12 → Wave 13
                                                       ↑
                                       (Wave 5 gold set feeds Wave 6 lens evaluation)
                                                       ↑
                                       (Wave 3 stream + Wave 4 LBH feed every later wave)
```

Waves 0–2 are platform; nothing legal-substantive runs.
Waves 3–5 are legal-aware infrastructure; still no practice-area content.
Wave 6 is the first wave that produces real legal artifacts.
Waves 7–9 mature the system to GA.

---

## Status Tracking

A separate `IMPLEMENTATION_STATUS.md` (not in this document) should track:
- Current wave.
- Open items per wave.
- Gate status.
- Deferred items with rationale.
- Risks raised since wave entry.

Update on every meaningful step. Do not let it rot.
