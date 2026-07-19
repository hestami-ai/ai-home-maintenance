# JAN-W0-DR-001 — W0 Detailed Implementation Roadmap

**Wave:** W0 — Normative Baseline and Code Grounding
**Gate:** G0 — Code-Grounded Migration Authorization
**Conforms to:** `JAN-ROADMAP-001-A` (Detailed Roadmap Generation and Normalization Standard), §4 required sections
**Machine-readable companion:** `JAN-W0-DR-001.yaml` (Template `JAN-ROADMAP-001-E`)

---

## 0. Reading note — normative language

This roadmap uses **SHALL / SHALL NOT** (mandatory), **SHOULD / SHOULD NOT** (expected absent approved reason), **MAY** (permitted), and **INFORMATIVE** (explanatory) per `JAN-ROADMAP-001` §3. A W0 detailed work package is not complete merely because a document exists; it is complete only when its evidence is code-grounded and its conformance is recorded.

---

## 1. Document control and repository identity

| Field | Value |
| --- | --- |
| Detailed roadmap ID | `JAN-W0-DR-001` |
| Version | `0.1.0-draft` |
| Status | `PROPOSED` (detailed-roadmap state per master §12.3) |
| Master roadmap | `JAN-ROADMAP-001@2.0.0-draft` (status: PROPOSED_NORMATIVE_BASELINE) |
| Master wave | `W0` |
| Activated master work packages | `JAN-WP-0-001` … `JAN-WP-0-007` |
| Repository | `hestami-ai` / GitHub `hestami-ai/ai-home-maintenance` |
| Repository root | `E:/Projects/hestami-ai` (single authoritative git repository) |
| Branch | `main` |
| Revision at grounding | `c2b853b1` (sponsor manual commit; last engineering-content commit `d37f0dd3`) |
| Subject-of-record path | `JanumiCode/janumiprofessionalworkbench/` (JPWB) |
| Persistence revision | `better-sqlite3`; canonical schema `packages/rph-persistence/src/schema.ts` — five tables (`professional_work_objects`, `professional_work_object_versions`, `domain_events`, `outbox_messages`, `command_receipts`); no ORM migration tool present |
| Runtime environment | Node/Bun workspace (Turbo monorepo); demo surface `apps/rph-demo` (SvelteKit); test harness Vitest + Playwright (system Edge, `RPH_DEMO_MODE=test`) |

**Repository-identity finding (CONFIRMED).** There is exactly one authoritative git repository at `E:/Projects/hestami-ai`. A vestigial empty `.git` directory that had appeared under `JanumiCode/janumiprofessionalworkbench/` (no HEAD, zero objects, zero refs, invalid to `git --git-dir`) was removed during W0 grounding; it never held unique history. JPWB is therefore tracked directly by the root repository, not as a submodule. The only submodule with pending state is `ai_os_home_cam_service_provider/signoz` (out of W0 scope; other-agent/operator-owned).

---

## 2. Activated master scope

W0 activates seven master work packages under gate G0. Their master normative outcomes are carried verbatim from `JAN-ROADMAP-001` §14 / `JAN-ROADMAP-001-B`:

| Master WP | Master normative outcome (capability obligation) |
| --- | --- |
| `JAN-WP-0-001` | Establish the authoritative document set, subject-specific authority, versions, statuses, dependencies, and supersession relationships. |
| `JAN-WP-0-002` | All artifacts SHALL use the canonical Janumi/JPWB/PWA/Undertaking/Professional Work Graph/Execution Workflow vocabulary. |
| `JAN-WP-0-003` | Identify the actual implementation units, storage locations, service boundaries, and sources of truth. |
| `JAN-WP-0-004` | Every legacy phase and substate SHALL be grounded in actual entry conditions, outputs, prompts, context sources, roles, and exit behavior. |
| `JAN-WP-0-005` | Every existing validator SHALL be classified by professional purpose, claims, evidence, criteria, independence, outputs, and downstream effects. |
| `JAN-WP-0-006` | All external and irreversible side effects SHALL be identified with idempotency, reconciliation, rollback, and authority characteristics. |
| `JAN-WP-0-007` | Capture representative legacy runs and classify all target-architecture differences; establish the divergence register and ADR baseline. |

**Scope reframe (material — see §5, §6, §15).** The master text frames WP-0-003…007 as an inventory of **legacy JanumiCode's phase engine, performed in order to migrate it**. Two code-grounded facts and one sponsor direction change what these obligations mean in this repository, without changing the master *destination*:

1. The subject-of-record is **JPWB — an already-substantially-built RPH engine**, not a greenfield build starting from a legacy phase engine (§4, §6).
2. **Sponsor direction (2026-07-19):** the legacy codebases `janumicode` (v1) and `janumicode_v2` carry **nothing to import, migrate, inherit, or preserve**.
3. `RPH-DOC-005` — the normative legacy inventory — states of itself (§2) that it is *"based on the supplied legacy Execution Workflow description and earlier feature specification, **not a complete code-level audit**,"* and instructs that Stage-0 *"must replace inferred descriptions with code-grounded contracts."*

Consequently, W0's substantive code-grounding **SHALL** be performed against **JPWB and the normative corpus**, and the legacy inventory obligations (WP-0-003…007) **SHALL** be discharged by a single evidence-backed classification of the legacy codebases as `REMOVE` (§5), not by mining them for behavior. WP-0-001, WP-0-002, and WP-0-007 remain fully substantive and apply to JPWB + the corpus.

---

## 3. Normative-source digest

The following sources govern W0. Authority is subject-specific (`JAN-ROADMAP-001` §6); generation order is not total precedence.

| Source (repo path under `docs/Recursive Professional Harness/`) | RPH ID | W0 relevance |
| --- | --- | --- |
| *…Canonical Vocabulary Charter…* | `RPH-DOC-000` | Naming authority; anchors WP-0-002 (canonical vocabulary). |
| *…Product Realization PWA – Migration to the RPH* | `RPH-DOC-001` | Migration architecture and program scope; anchors the §6 gap analysis. |
| *…RPH – Canonical Domain Model, Invariant Catalog, State Machines, Event Contract* | `RPH-DOC-002` | Target semantics for the JPWB object/state grounding. |
| *…PWA – Professional Ontology and Assurance Policy Specification* | `RPH-DOC-003` | PWA professional structure. |
| *…PWA – Assurance Policy Catalog and Validator Contract* | `RPH-DOC-004` | Target for validator/assurance grounding (WP-0-005). |
| *…Legacy JanumiCode – Semantic Inventory and RPH Conformance Mapping* | `RPH-DOC-005` | The doc-based legacy inventory W0 exists to code-ground; 11 phases + INTAKE substates. |
| *…Field Service Management SaaS Reference Undertaking* | `RPH-DOC-006` | Reference fixture; trace-corpus anchor (WP-0-007). |
| *…RPH – Command, Event, Schema Contract Package* | `RPH-DOC-007` | Wire/contract authority. |
| *…RPH – Executable Invariant and Conformance Test Specification* | `RPH-DOC-008` | Conformance-test authority (WP-0-006 recovery). |
| *…RPH – Persistence, Migration, Dual-Run, and Cutover Design* | `RPH-DOC-009` | Persistence/side-effect authority (WP-0-003/006). |
| *…PWA Designer and Undertaking Workbench – Reference Demonstration* | `RPH-DOC-010` | UX target (later waves). |
| Engineering Constitution; Engineering Doctrine; Platform Executive Overview; `JAN-ENG-POL-GIT-001` (Git isolation policy) | — | Governing non-RPH-DOC authority; the Git policy governs the multi-agent commit discipline W0 operates under. |

**W0-applicable obligations extracted (INFORMATIVE selection; not exhaustive):** the eight mandatory architectural rules (master §8) — in particular one writable semantic authority per Undertaking (rule 1), execution-success ≠ assurance/PWU/baseline satisfaction (rule 3), immutable published PWAs/baselines (rule 8), no runtime authority via PWA definition (rule 10), surface-not-silently-resolve material conflicts (rule 14). **W0-applicable prohibited shortcuts (master §19):** inventing repository facts to make a roadmap appear complete; freezing a roadmap when evidence shows it must change; treating a commit/deployment as a baseline. **Standard §6 quality bar:** grounding SHALL evidence ownership of state, data flow, failure behavior, persistence effects, side effects, test coverage, and hidden coupling — not merely list filenames.

---

## 4. Current-state findings and evidence

Findings are graded `CONFIRMED` (direct code/test/trace evidence), `INFERRED` (strongly supported, not directly demonstrated), `ASSUMED` (accepted for planning, requires validation), `UNKNOWN` (unresolved, plan-affecting).

### 4.1 Repository composition (CONFIRMED)

- The monorepo `JanumiCode/` contains three JanumiCode lineages plus satellites: `janumicode` (v1 legacy, 452 first-party TS/JS/PY files), `janumicode_v2` (v2 legacy, 8,270 first-party files), and `janumiprofessionalworkbench` (**JPWB — the subject of record**). Satellites: `janumilegal`, `mcp-servers`, `n8n`, `omnigent-main`, `voyage-embed`, `website`. Evidence: directory census + file counts.
- **JPWB packages (CONFIRMED):** `rph-contracts`, `rph-domain`, `rph-application`, `rph-persistence`, `rph-ports`, `rph-engine`, `rph-assurance`, `rph-authoring`, `rph-projections`, `rph-product-realization-pwa`, `typescript-config`; demo app `apps/rph-demo`. This is a layered RPH engine (contracts → domain kernel → application handlers → persistence/ports → engine composition → assurance/authoring/projections → demo).

### 4.2 The legacy phase engine (CONFIRMED, and classified REMOVE — §5)

- The **11 legacy phases** of `RPH-DOC-005` §3 (INTAKE → ARCHITECTURE → PROPOSE → ASSUMPTION_SURFACING → VERIFY → HISTORICAL_CHECK → REVIEW → EXECUTE → VALIDATE → COMMIT → REPLAN) are realized in **`janumicode/src/lib/workflow/orchestrator.ts`** with the described central phase switch (evidence: distinctive phase-name grep — `ASSUMPTION_SURFACING` in 22 files, `HISTORICAL_CHECK` in 26, `REPLAN` in 15; `switch`-over-phase in `workflow/orchestrator.ts`, `humanFacingState.ts`, `outputAdopter.ts`). INTAKE substates (DISCUSSING/SYNTHESIZING/AWAITING_APPROVAL/INTENT_DISCOVERY/PRODUCT_REVIEW/PROPOSING/CLARIFYING) are present.
- `janumicode_v2` is a distinct numbered `phase1…phase10` orchestrator (`src/lib/orchestrator/phases/`) and is the only place the legacy term **"Product Lens"** survives (15 files).
- **Neither legacy engine is a migration source** (sponsor direction, §5). RPH-DOC-005's inventory is confirmed doc-based, not code-audited (RPH-DOC-005 §2).

### 4.3 JPWB is a mature RPH engine (CONFIRMED)

- JPWB implements, in production code with a passing conformance gate, substantial portions of what the master roadmap sequences into **W1 (semantic kernel)** and **W2 (persistence/events/projections)**, and parts of **W3/W4/W8**: canonical Professional Work Objects with opaque ULID identity + provenance + semantic version; Intent/PWU/Assurance/Decision/Baseline aggregates; a domain-event store with a transactional outbox and command-receipt idempotency (`schema.ts` five-table model); rebuildable projections (`rph-projections`); an assurance kernel with versioned policies, evidence, observations, dispositions, independence checks; a PWA Designer surface (`apps/rph-demo`). Evidence: this session's engineering plus the standing conformance gate — `check-types` 21/21, unit tests (rph-application 145+, rph-engine 64, rph-authoring 25, rph-demo 85), `lint`, `boundary` (159 modules, 0 violations), Playwright E2E 25/25.
- **Contract single-source-of-truth (CONFIRMED):** machine contracts are generated from `packages/rph-contracts/vocab/*.json` via `bun run gen` into `src/enums.ts|objects.ts|messages.ts` and `schemas/*.json` — the WP-1-001 "single canonical source" obligation is already met in substance.

### 4.4 Prior code-grounding already performed this program (CONFIRMED)

- A harmonization program has already produced W0-grade evidence against the corpus: `docs/_working/dead-kernel-census.txt` (a LIVE/DEAD census of kernel functions; ~55 kernel functions found reachable only from tests — "dead in production"), `HARMONIZATION-FINDINGS.md`, `HARMONIZATION-LOG.md` (increments through Y), `engine-reference-map.md`, `OPEN-QUESTIONS.md`, `RESUME-STATE.md`, and audit notes (`AUDIT-*`, `RULING-*`, `DECISION-*`, `DESIGN-*`). W0 **SHALL** consolidate these into the formal divergence register rather than re-derive them.

### 4.5 Canonical vocabulary (CONFIRMED — JPWB conformant)

- JPWB source contains **zero** occurrences of "Product Lens" and **zero** bare "Lens" tokens; 63 files use canonical `PWA`/`Undertaking`/`ProfessionalWork*`/`PwuType` terminology. WP-0-002's exit criterion ("No target artifact uses Product Lens as the canonical name") is already satisfied for JPWB. The legacy term is confined to the REMOVE-classified `janumicode_v2`.

### 4.6 Known security divergence (CONFIRMED, escalated)

- No JPWB endpoint authenticates; the demo server fabricates a HUMAN principal. This is a CRITICAL security divergence recorded in the harmonization corpus and carried into this roadmap's §13. It is a platform-security workstream item that **SHALL NOT** ship to any multi-tenant context; it does not block W0's grounding purpose but MUST appear in the G0 risk register.

### 4.7 Unknowns (plan-affecting)

- `UNKNOWN`: the precise degree to which each master W1/W2 capability is *conformant* vs *partially built* vs *hollow* (settable-but-unenforced). The dead-kernel census indicates a real "hollow governed layer" risk. Quantifying per-capability conformance is the substantive body of W0 execution (§9, DWP-004/005/006).
- `UNKNOWN`: whether `RPH-DOC-005`'s per-phase "required canonical objects" are all realized in JPWB or only partially. Resolved by cross-walking RPH-DOC-005 §5 against `rph-contracts` object types.

---

## 5. Legacy semantic classification

Per Standard §3.4 and the master classification vocabulary. Under sponsor direction (2026-07-19), the dominant classification is `REMOVE` for the legacy lineages.

| Element | Classification | Evidence / rationale |
| --- | --- | --- |
| `janumicode` (v1) whole codebase | `REMOVE` | Sponsor direction: nothing to import/migrate/inherit. Confirmed to host the 11-phase engine, but not a migration source. |
| `janumicode_v2` whole codebase | `REMOVE` | Same. Also the sole residence of the legacy "Product Lens" term. |
| The 11 legacy phases (INTAKE…REPLAN) | `REMOVE` (as an implementation) / superseded-by-target | Their *professional intent* is already carried natively by JPWB's RPH model (Intent/PWU/Assurance/Decision/Baseline). RPH-DOC-005 §4–§5 provides the doc-level mapping; JPWB is the realized target. No phase is `PRESERVE`/`RECLASSIFY`/`GENERALIZE`/`REPLACE`. |
| INTAKE substate conflation (interaction/activity/execution/governance/control mixed) | `REMOVE` | Named by RPH-DOC-005 §3 as a principal migration *target*; JPWB already separates these axes (independent work/execution/assurance/shape-integrity state). |
| Legacy validators | `REMOVE` | Not migrated. JPWB has a native assurance kernel (RPH-DOC-004 target). WP-0-005 discharged by classification, not migration. |
| Legacy external side effects | `REMOVE` (not inherited) | JPWB's own execution-plane side effects are the subject of the forward inventory (§6, DWP-006); legacy side effects are not inherited. |
| JPWB (subject of record) | not a legacy element — it is the **target realization** | Graded by conformance (UNASSESSED → … → CONFORMANT), not by legacy classification. |

**Net:** no legacy behavior requires preservation, reclassification, generalization, or replacement. This discharges the *substance* of WP-0-003…007's legacy-facing obligations with an evidence-backed `REMOVE`, and reallocates their effort to grounding JPWB (§6, §9).

---

## 6. Target-state gap analysis

The material gap is **not** "legacy behavior not yet migrated." It is the **mismatch between the master roadmap's greenfield-from-legacy wave framing and the realized state of JPWB**, which the master itself invites the agent to surface (§8 rule 14; §9.8; Standard §7).

| Master assumption (as written) | Code-grounded reality | Gap / action |
| --- | --- | --- |
| W0 grounds a legacy phase engine to migrate it. | Legacy is dead (sponsor); JPWB is the realized RPH engine. | Reframe W0 to JPWB current-state grounding; classify legacy `REMOVE`. **Material-decision trigger** (§15). |
| W1 "the minimum canonical model … exists independently of the legacy phase engine" is to be built. | Substantially **already built** in JPWB (`rph-contracts`, `rph-domain`, aggregates, invariants). | W1 becomes a **conformance-verification + gap-closure** wave against JPWB, not a from-scratch build. Re-baseline at G0. |
| W2 durable persistence/events/projections is to be built. | **Already present** (five-table event-sourced store + outbox + receipts + projections). | Same: verify conformance + close gaps (e.g., recovery/reconciliation coverage, WP-2-007). |
| W5/W6 legacy shadow-mode and pilot authority over legacy Undertakings. | No legacy to shadow or place under RPH authority. | W5/W6 as written are **moot**; their normative *intent* (no dual writable authority; no external side effects during comparison) is preserved trivially. Flag as forward divergence for master re-baseline. |
| W3/W4/W8 vertical slice, demonstration UX, PWA Designer to be built. | **Partially built** in `apps/rph-demo` + `rph-product-realization-pwa`. | Re-baseline each against realized state at its own gate. |

**Selected gap posture:** W0 SHALL produce a **JPWB-vs-corpus conformance baseline** and a **divergence register** that together let the sponsor re-baseline the master roadmap's later waves against realized state. W0 does **not** itself change the master destination; changing wave order/outcomes requires a successor master (master §20) and is proposed, not enacted, in the G0 package.

---

## 7. Alternatives considered and selected strategy

| # | Alternative | Advantages | Disadvantages | Disposition |
| --- | --- | --- | --- | --- |
| A1 | Execute W0 literally: deep-inventory the legacy phase engines to migrate them. | Matches master text verbatim. | Contradicts sponsor direction; wastes effort on dead code; RPH-DOC-005 already concedes the doc-level inventory; produces nothing usable. | **Rejected.** |
| A2 | Skip W0; treat JPWB as already conformant. | Fast. | Violates master §19 (inventing completeness), Standard §6/§10; the dead-kernel census shows real hollowness; no G0 evidence. | **Rejected.** |
| A3 (selected) | Reframe W0 to code-ground **JPWB against the corpus**, classify legacy `REMOVE`, consolidate existing harmonization evidence into formal registers, and produce a G0 package that surfaces the roadmap-vs-reality re-baseline as a material decision. | Honors sponsor direction and master intent (real code grounding, surfaced conflicts); reuses prior work; yields a usable conformance baseline; keeps the destination intact while proposing route re-baseline through governance. | Requires the sponsor to accept a reframed W0 at G0. | **Selected.** |

**Selected strategy summary.** W0 SHALL (1) fix the authoritative document manifest and source-authority matrix; (2) confirm JPWB canonical-vocabulary conformance and record the legacy exception; (3) inventory JPWB's implementation units, persistence, service boundaries, and sources of truth; (4) classify the legacy lineages `REMOVE`; (5) consolidate JPWB-vs-corpus divergences into the living registers; (6) assemble the G0 gate package with an explicit re-baseline recommendation. Ordinary analysis choices are delegated to the agent; the roadmap-reframe is escalated (§15).

---

## 8. Repository architecture and change map

W0 is an **analysis and evidence wave**: it produces controlled documents, not code or schema changes. The change map is therefore additive-documentary.

| Action | Artifact | Master WP |
| --- | --- | --- |
| create | `detailed-roadmaps/W0/JAN-W0-DR-001-detailed-implementation-roadmap.md` (this file) | all W0 |
| create | `detailed-roadmaps/W0/JAN-W0-DR-001.yaml` (Template E form) | all W0 |
| create | `detailed-roadmaps/W0/evidence/document-manifest-and-source-authority.md` | JAN-WP-0-001 |
| create | `detailed-roadmaps/W0/evidence/canonical-vocabulary-report.md` | JAN-WP-0-002 |
| create | `detailed-roadmaps/W0/evidence/jpwb-current-state-inventory.md` | JAN-WP-0-003 (reframed) |
| create | `detailed-roadmaps/W0/evidence/legacy-classification.md` | JAN-WP-0-003/004/005 (legacy `REMOVE`) |
| create | `detailed-roadmaps/W0/evidence/divergence-register.md` (instances of `JAN-ROADMAP-001-C` contracts) | JAN-WP-0-007 |
| create | `detailed-roadmaps/W0/evidence/G0-gate-package.md` | gate G0 |
| no change | JPWB source, contracts, schema, tests | — (W0 is non-mutating) |

**No database, runtime, or UI change** is made in W0.

---

## 9. Detailed work-package register

Each detailed work package (`JAN-W0-DWP-00n`) maps master WPs to concrete grounding actions and evidence. Full machine form in `JAN-W0-DR-001.yaml`; summary here.

| DWP | Maps | Outcome | Key evidence | Exit criteria |
| --- | --- | --- | --- | --- |
| `JAN-W0-DWP-001` | WP-0-001 | Authoritative document manifest + subject-authority matrix for the RPH-DOC corpus + governance docs + roadmap package. | `document-manifest-and-source-authority.md`; RPH-ID↔file map (§3). | Every source is identified and assigned authority or marked non-authoritative; discrepancies logged. |
| `JAN-W0-DWP-002` | WP-0-002 | Canonical-vocabulary conformance report for JPWB; legacy exception recorded. | `canonical-vocabulary-report.md`; scan (0 "Product Lens"/0 "Lens" in JPWB; term confined to REMOVE legacy). | No JPWB artifact uses a prohibited canonical name; migration-alias note for legacy is recorded. |
| `JAN-W0-DWP-003` | WP-0-003 | JPWB implementation-unit, storage, service-boundary, and source-of-truth inventory. | `jpwb-current-state-inventory.md`; package graph; five-table persistence map; contract-generation source-of-truth. | Every JPWB semantic-state and side-effect store is identified. |
| `JAN-W0-DWP-004` | WP-0-003/004/005 | Legacy lineages classified `REMOVE` with evidence; the 11-phase engine located and dispositioned. | `legacy-classification.md`. | Legacy is dispositioned; no legacy behavior left `UNRESOLVED`. |
| `JAN-W0-DWP-005` | WP-0-005/006 | JPWB assurance/validator coverage and execution side-effect/recovery posture cross-walked to RPH-DOC-004/008/009; hollow-layer risks named. | inventory §; consolidated from dead-kernel census + harmonization findings. | Each material JPWB validator/side-effect is classified or flagged; recovery gaps named (e.g., attempt reconciliation). |
| `JAN-W0-DWP-006` | WP-0-007 | JPWB-vs-corpus divergence register + ADR baseline, consolidating existing harmonization evidence + this roadmap's new findings. | `divergence-register.md` (C-contract instances: divergences, decisions, deferrals, assumptions). | Every material divergence is captured and classified; no unresolved *critical* item is silent. |
| `JAN-W0-DWP-007` | gate G0 | G0 gate package with the re-baseline recommendation and explicit `APPROVE / APPROVE_WITH_CONDITIONS / REJECT / DEFER` request. | `G0-gate-package.md`. | Gate package complete per master §17; material-decision trigger surfaced for sponsor decision. |

Each DWP `delivery_state` begins `NOT_STARTED`, `conformance_state` `UNASSESSED`, and advances as evidence lands.

---

## 10. Data and persistence changes

**None.** W0 makes no schema, migration, or data change. For evidence, W0 **inventories** JPWB's persistence (DWP-003): the five-table event-sourced model in `packages/rph-persistence/src/schema.ts` (`professional_work_objects`, `professional_work_object_versions` keyed `(id, revision)`, `domain_events`, `outbox_messages`, `command_receipts` keyed on `idempotency_key`). Notable current-state facts to carry into W2 re-baseline: whole-`currentState` serialization per version row (O(N²) risk under high-revision aggregates), and the absence of a dedicated migration tool.

---

## 11. Execution, compatibility, and migration strategy

Because the legacy lineages are `REMOVE`, there is **no dual-run, shadow, or legacy-compatibility obligation to satisfy from legacy code**. The master's compatibility apparatus (derived compatibility milestones, legacy phase projections — WP-5-003, master rule 11) has **no legacy substrate** in this repository and is recorded as a forward divergence for master re-baseline (§15). Migration is therefore *greenfield-forward*: the program advances JPWB toward full corpus conformance, not away from a legacy engine. W0 itself performs no migration.

---

## 12. Assurance, tests, and evidence plan

- **W0 evidence is documentary and code-grounded**: each finding cites a file/symbol, a grep result, a test count, or a corpus section. W0 **SHALL NOT** assert a JPWB capability is conformant without a cited test or trace (master §19; Standard §10).
- **The JPWB conformance baseline** for later-wave re-baselining is the standing gate: `bun run check-types` (21 tasks), `bun run test` (Vitest suites), `bun run lint`, `bun run boundary` (depcruise), and Playwright E2E (25). W0 records the current green status as the baseline, not as proof of full corpus conformance (green tests prove the kernel, not that production wires it — the dead-kernel census is the counter-evidence W0 preserves).
- **No new tests are authored in W0** (non-mutating wave). Test *obligations* discovered during grounding are recorded against the wave that will build them.

---

## 13. Security, authority, and tenant-impact analysis

- **CRITICAL (carried, escalated):** no JPWB endpoint authenticates; the demo server fabricates a HUMAN principal. Recorded in the divergence register with materiality CRITICAL; **SHALL NOT** ship multi-tenant; owned by a platform-security workstream (aligns with master WS-I and W10). W0 surfaces it in the G0 risk register; it does not block W0's grounding purpose.
- **Authority-boundary posture (INFORMATIVE):** JPWB honors the master's "no runtime authority via PWA definition" (rule 10) and "one writable semantic authority" (rule 1) at the kernel level; W0 records these as conformance-relevant to verify per-capability in later waves.
- **Tenant impact:** none from W0 (no code/data change).

---

## 14. Observability, recovery, and rollback

- **W0 rollback is trivial and complete:** every W0 artifact is an added document under `detailed-roadmaps/W0/`; rollback = `git revert` of the W0 commit(s). No runtime or data effect exists to recover.
- **Recovery inventory (forward):** JPWB's restart-recovery / external-operation reconciliation posture (master WP-2-007) is named as an area to verify — attempt reconciliation and idempotent external operations exist in contract but their production wiring is a hollow-layer candidate (DWP-005). Recorded, not resolved, in W0.

---

## 15. Risks, assumptions, unknowns, decisions, deferrals, and divergences

### 15.1 Material divergences (instances of `JAN-ROADMAP-001-C` divergence contract; full text in the register)

- **DIV-W0-001 (MATERIAL → escalated as material-decision trigger).** *Subject:* roadmap target-framing vs realized state. *Sources in conflict:* `JAN-ROADMAP-001` W0–W2 (greenfield-from-legacy) vs JPWB repository evidence (mature RPH engine) + sponsor direction (legacy dead). *Proposed resolution:* accept the reframed W0 (this roadmap); re-baseline W1/W2 as conformance-verification waves and W5/W6 as moot-or-reinterpreted, via a successor master revision (master §20). *Status:* OPEN — **requires sponsor decision at G0** (master §10: materially changing target framing / program scope).
- **DIV-W0-002 (MATERIAL).** *Subject:* legacy migration substrate. *Conflict:* master WP-5-003 / rule 11 assume legacy phases to project as compatibility milestones vs no live legacy substrate. *Proposed resolution:* record W5/W6 legacy-facing obligations as not-applicable in this repository; preserve their normative *intent* trivially. *Status:* OPEN (bundled with DIV-W0-001).
- **DIV-W0-003 (CRITICAL, security).** *Subject:* authentication. *Conflict:* master WS-I / rule set vs JPWB fabricating a HUMAN principal with no authenticating endpoint. *Proposed resolution:* platform-security workstream; hard gate before any multi-tenant deployment. *Status:* OPEN, tracked.
- **DIV-W0-004 (MATERIAL).** *Subject:* hollow governed layer. *Conflict:* corpus expectation that governed rules decide vs dead-kernel census showing ~55 kernel functions reachable only from tests. *Proposed resolution:* the harmonization "wiring" program (already underway this session) is the closure path; W0 formalizes the register. *Status:* OPEN, in-progress.

### 15.2 Decisions to record (C decision contract)

- **DEC-W0-001:** adopt reframed-W0 strategy A3 (§7). Authority: coding agent within delegated latitude, **conditioned on** sponsor ratification of DIV-W0-001 at G0.
- **DEC-W0-002:** classify `janumicode` + `janumicode_v2` as `REMOVE` (§5). Authority: sponsor direction 2026-07-19.

### 15.3 Deferrals

- **DEF-W0-001:** deep per-capability conformance scoring of every W1/W2 master outcome against JPWB is deferred into the respective wave's detailed roadmap; W0 delivers the *baseline and divergence register*, not exhaustive per-invariant proof.

### 15.4 Assumptions / unknowns

- **ASM-W0-001 (ASSUMED):** the standing green gate reflects the current tree; re-run at G0 assembly to confirm. Resolution gate: G0.
- **UNK-W0-001 (UNKNOWN):** exact conformance depth of each master capability in JPWB (see §4.7). Resolution: DWP-004/005/006 + later-wave roadmaps.

### 15.5 Risks

- **R1:** treating JPWB's green gate as full corpus conformance (mitigated by preserving the dead-kernel census as counter-evidence).
- **R2:** the reframe is rejected at G0, requiring a return to literal W0 (low value) — mitigated by surfacing DIV-W0-001 early and explicitly.

---

## 16. Traceability matrix

Per `JAN-ROADMAP-001-F`. Populated instance in `JAN-W0-DR-001.yaml` `traceability_updates` and the register; summary:

| Normative obligation | Source | Master WP | DWP | Evidence artifact |
| --- | --- | --- | --- | --- |
| Authoritative document set + subject authority | master §6; WP-0-001 | JAN-WP-0-001 | DWP-001 | `document-manifest-and-source-authority.md` |
| Canonical vocabulary | RPH-DOC-000; WP-0-002 | JAN-WP-0-002 | DWP-002 | `canonical-vocabulary-report.md` |
| Implementation units / storage / sources of truth | WP-0-003; RPH-DOC-009 | JAN-WP-0-003 | DWP-003 | `jpwb-current-state-inventory.md` |
| Legacy grounding/classification | WP-0-004/005; RPH-DOC-005 | JAN-WP-0-003/004/005 | DWP-004 | `legacy-classification.md` |
| Validator/side-effect/recovery grounding | WP-0-005/006; RPH-DOC-004/008/009 | JAN-WP-0-005/006 | DWP-005 | inventory + register |
| Divergence register + ADR baseline | WP-0-007 | JAN-WP-0-007 | DWP-006 | `divergence-register.md` |
| G0 gate package | master §17; gate G0 | — | DWP-007 | `G0-gate-package.md` |

---

## 17. Implementation ordering and concurrency plan

W0 execution order (dependencies are light; most evidence is parallelizable):

1. `DWP-001` (document manifest) and `DWP-002` (vocabulary) — independent, MAY run concurrently.
2. `DWP-003` (JPWB inventory) and `DWP-004` (legacy classification) — MAY run concurrently after DWP-001.
3. `DWP-005` (validator/side-effect/recovery cross-walk) — after DWP-003.
4. `DWP-006` (divergence register + ADR baseline) — consolidates DWP-001…005 + existing harmonization corpus.
5. `DWP-007` (G0 gate package) — last; depends on all.

W0 makes no concurrent code mutations, so no worktree isolation is required (the multi-agent Git policy `JAN-ENG-POL-GIT-001` still governs: stage only W0 files by path; never `-A`; do not touch other agents' uncommitted work).

---

## 18. Exit criteria and gate package requirements

**W0 exit criteria (master §14 W0, reinterpreted per §5/§6):**

- Every material JPWB implementation unit, persistence store, service boundary, and source of truth is inventoried (DWP-003). *(The master's "every legacy phase/substate/validator/side-effect" is discharged by the `REMOVE` classification, DWP-004, plus JPWB's forward inventory.)*
- The legacy lineages are dispositioned (`REMOVE`); no legacy behavior is left `UNRESOLVED`.
- The authoritative document manifest, an ADR baseline, and the divergence register are produced and internally consistent.
- No unresolved *critical* item is silent (DIV-W0-003 is surfaced; DIV-W0-001 is surfaced for decision).

**G0 gate package (master §17) SHALL include:** master + detailed WP status; code-grounded findings and deviations; the current conformance-baseline (gate) result; migration/recovery/security notes; decisions/deferrals/waivers/divergences (the register); residual risk; a recommendation (`APPROVE / APPROVE_WITH_CONDITIONS / REJECT / DEFER`); and the proposed **re-baseline** disposition of W1+ (the successor-master proposal for DIV-W0-001), since sufficient evidence exists to propose it.

---

## 19. Self-critique and readiness determination

Per Standard §3.7 / §4 section 19.

- **Normative coverage:** all seven master W0 outcomes are addressed; three are substantive against JPWB (WP-0-001/002/007), four are discharged by evidence-backed `REMOVE` of legacy under sponsor direction (WP-0-003/004/005/006). Coverage is complete for the *reframed* W0; if the sponsor rejects the reframe (DIV-W0-001), coverage of the *literal* legacy-migration W0 is intentionally not attempted (rationale recorded).
- **Omitted difficult requirements:** none silently. The hardest items (hollow governed layer, authentication, per-capability conformance depth) are surfaced as OPEN divergences/unknowns, not buried.
- **Legacy behavior preservation:** none required (sponsor direction). The risk of *silently* discarding a needed legacy behavior is mitigated by RPH-DOC-005's existing doc-level mapping showing legacy intent is already carried by JPWB's model; any specific legacy behavior the sponsor later deems needed re-enters as a new decision.
- **Semantic-authority risk:** W0 changes no authority; it records that JPWB already holds single writable semantic authority per Undertaking at the kernel level (to be verified per-capability later).
- **Assurance/evidence gaps:** W0 relies partly on the standing green gate, which proves the kernel, not production wiring — explicitly flagged (R1), with the dead-kernel census preserved as counter-evidence.
- **Security/permissions:** the CRITICAL auth gap is surfaced (DIV-W0-003), not deferred silently.
- **Migration/recovery:** greenfield-forward; recovery-wiring gaps named for W2 re-baseline.
- **Overengineering check:** W0 deliberately avoids re-deriving the harmonization corpus and avoids deep legacy archaeology (dead code); it consolidates rather than re-litigates. Register bureaucracy is kept lean (master §18).
- **Sequencing/reversibility:** fully reversible (documentary; `git revert`).
- **Contradictions with code/corpus:** the central contradiction (roadmap framing vs realized state) is the headline finding, surfaced as DIV-W0-001.

**Readiness determination:** `PROPOSED`. This roadmap is competent and code-grounded and MAY be executed for its non-mutating evidence production immediately under the sponsor's standing authorization; its one material-decision trigger (DIV-W0-001, the W1+ re-baseline) is **not** executed — it is packaged for explicit sponsor decision at G0. Execution of DWP-001…007 (evidence + registers) proceeds; the master re-baseline awaits G0.
