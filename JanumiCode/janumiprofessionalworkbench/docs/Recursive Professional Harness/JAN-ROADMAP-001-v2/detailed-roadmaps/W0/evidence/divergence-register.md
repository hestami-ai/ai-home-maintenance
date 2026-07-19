# W0 Evidence — JPWB-vs-Corpus Divergence Register and ADR Baseline

**Discharges:** `JAN-WP-0-007` (via `JAN-W0-DWP-006`). **Deliverables:** initial divergence register; ADR baseline; decisions/deferrals/assumptions.
**Record contracts:** `JAN-ROADMAP-001-C` (divergence, decision, deferral, waiver, assumption_or_unknown).
**Consolidation source:** this roadmap's findings + the standing harmonization corpus (`HARMONIZATION-FINDINGS.md`, `HARMONIZATION-LOG.md`, `dead-kernel-census.txt`). Per master §19, no repository fact is invented; per §18, the register is kept lean.

## 1. Divergences (contract: id, subject, sources_in_conflict, description, materiality, classification, proposed_resolution, status)

### DIV-W0-001 — Roadmap target-framing vs realized state **[MATERIAL-DECISION TRIGGER]**
- **subject:** master wave framing (greenfield-from-legacy) vs the realized JPWB engine.
- **sources_in_conflict:** `JAN-ROADMAP-001` W0–W2 + WP-0-003…007 (legacy-migration framing) ↔ JPWB repository evidence (`jpwb-current-state-inventory.md`) + sponsor direction (legacy dead).
- **description:** the master sequences W0 (ground legacy) → W1 (build kernel) → W2 (build persistence). JPWB already realizes the substance of W1 and W2 and parts of W3/W4/W8. W0-as-written is therefore not the true next step; the true next step is a conformance-baseline + re-baseline of later waves against realized state.
- **materiality:** MATERIAL. **classification:** master §10 trigger (materially changing target framing / program scope).
- **proposed_resolution:** accept the reframed W0 (`JAN-W0-DR-001`); at G0, authorize a successor Master Roadmap revision (master §20) re-baselining W1 as *kernel conformance verification + gap closure*, W2 as *persistence conformance verification + recovery closure*, and W5/W6 as *not-applicable-legacy / reinterpreted*.
- **status:** **RESOLVED (2026-07-19)** — sponsor approved the G0 gate with condition C1; the W1+ re-baseline is authorized. W1 proceeds as conformance-verification + hollow-layer closure (`JAN-W1-DR-001`). A successor Master Roadmap revision formalizing the wave re-baseline is recorded as a standing follow-up under W1.

### DIV-W0-002 — No legacy migration substrate (W5/W6 moot)
- **subject:** legacy shadow-mode and pilot-authority waves.
- **sources_in_conflict:** master W5 (WP-5-001…006) + W6 + rule 11 (legacy phases → compatibility projections) ↔ no live legacy substrate (legacy = `REMOVE`).
- **description:** there is no legacy execution to instrument, shadow, compare, or place under RPH authority. The waves' apparatus has no input in this repository.
- **materiality:** MATERIAL. **classification:** scope (bundled with DIV-W0-001).
- **proposed_resolution:** record W5/W6 legacy-facing obligations as not-applicable; preserve their normative *intent* (no dual writable authority; no external side effects during comparison) trivially; re-baseline via successor master.
- **status:** OPEN (bundled with DIV-W0-001).

### DIV-W0-003 — No authentication (fabricated principal) **[SECURITY]**
- **subject:** identity and authority (master WS-I / W10).
- **sources_in_conflict:** the corpus mandates authentication on governed commands — **DOC-002 §27.2** ("*Every command handler must: 1. authenticate actor; 2. authorize requested operation*", L1687-1692) and **DOC-007 §39** ("*Human decisions require authenticated identity*", L2444), with **no** production-only/demo exemption — ↔ JPWB: **no authenticating boundary exists** (no `hooks.server.ts`; 0 session/token/`locals` derivations in `apps/rph-demo/src`; 0 `authenticate` steps in `packages/rph-application|rph-domain`).
- **description:** a single hardcoded principal `{ actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' }` is injected at **four** sites: `lib/server/workbench.ts:128` (`issuedBy`, the shared envelope choke point — 100% of UI commands), `routes/decisions/+page.server.ts:35` (Decision `authority`), `routes/undertakings/[id]/+page.server.ts:362` (`executedBy`), `:383` (`evaluator`/`producer`). The kernel takes `issuedBy` **as-supplied**; `ActorReference.json` requires only `actorId` minLength:1 with no verification binding, so the contract layer cannot reject it either.
- **sharpest technical points (code-grounded):** (1) the fake `actorType:'HUMAN'` **actively passes** the real kernel authority gate — `governance.ts:170` sets `authorityHeld = actorType ∈ {HUMAN, SYSTEM}` and writes `issuedBy` as the record's authority (l.307), so the invariant "only a held human/system authority may approve" is satisfied by a fabricated human, and separation-of-duties is architecturally impossible (proposer==approver==self). (2) DOC-002 §5 ("*Authority is distinct from actor identity*", L404) is collapsed — one ActorReference literal is reused as both identity and Decision authority. (3) The INV-8 **independence control is NOT defeated** — it *fails safe*: the demo policy declares `independenceRequirement:'NONE'` so the check is skipped (never a fabricated VERIFIED), and under any real requirement the collapsed identity would fire `INDEPENDENCE_VIOLATION` (`assurance.ts:849,855-882`). **Latent exception:** `checkIndependence('HUMAN', …)` checks only `evaluator.actorType==='HUMAN'` (`assurance-rules.ts:172-175`), so a HUMAN-independence policy would be trivially self-reviewed by the fabricated HUMAN — the demo does not use one, but it is a threat-model note.
- **materiality (calibrated, adversarially verified — 3/3 lenses concur):** **LOW today** (single-tenant demo; ephemeral `:memory:` sqlite → no durable forged audit; localhost, no network/tenant surface; degenerate self-forgery of the sole operator with an honest placeholder label; `PromoteBaseline`→AUTHORITATIVE unwired; `/test-api` 404-gated). **CRITICAL if shipped multi-tenant** (forged HUMAN authority on Decisions/waivers/baseline-approvals + assurance evaluator across tenants, persisted to a durable audit log via a file-backed sqlite config flip). It is a **genuine unconditional-MUST corpus violation** either way — correctly **deferred-with-disclosure**, *not* "acceptable-for-now."
- **classification:** security (deferred-with-disclosure; corpus grants no exemption).
- **proposed_resolution:** platform-security workstream (master **W10 / WS-I**): an authenticating boundary (`hooks.server.ts`) deriving a **verified** `ActorReference` before dispatch; thread it through the envelope choke point + the three in-payload literals (authority from the distinct AuthorityReference concept); **fail closed on missing identity** (reject, do not fabricate); distinct real evaluator/producer + proposer≠approver to put SoD and independence in force. A hard gate **SHALL** block any multi-tenant deployment until resolved. Does **not** block W0's grounding purpose (no tenant impact from W0).
- **status:** OPEN, tracked. *(Evidence: workflow `wf_effc0248-e39`, 8 agents, adversarially verified.)*

### DIV-W0-004 — Hollow governed layer
- **subject:** governed rules deciding vs merely existing.
- **sources_in_conflict:** corpus expectation (governed rules enforce) ↔ `dead-kernel-census.txt` (LIVE 19 / DEAD 55 — 55 kernel functions reachable only from tests).
- **description:** the professional kernel is correct and tested, but ~74% of it was historically unreached by production call sites, which invoked weaker literals. Green tests prove the kernel, not the wiring.
- **materiality:** MATERIAL. **classification:** implementation-fidelity.
- **proposed_resolution:** the harmonization *wiring* program (in progress this session; rule-array enforcement thread complete — five of six ASSURANCE_POLICY arrays now enforced) is the closure path. W0 formalizes the register; closure proceeds under W1 re-baseline.
- **status:** OPEN — in progress.

### DIV-W0-005 — Corpus maturity (draft, not ratified)
- **subject:** normative-source ratification.
- **sources_in_conflict:** most RPH-DOC-002…010 are "draft/baseline"; the master roadmap is "proposed."
- **description:** W0 grounds against a provisional corpus (permitted by the master W0 entry criterion) but must not present draft-conformance as ratified-conformance.
- **materiality:** MATERIAL (governance). **classification:** governance.
- **proposed_resolution:** record ratification as a G0 condition; conformance claims are "against provisional corpus vN-draft."
- **status:** OPEN.

## 2. Decisions (contract: id, title, question, status, authority, evidence, alternatives, decision, rationale, affected_artifacts)

### DEC-W0-001 — Adopt reframed-W0 strategy
- **question:** should W0 be executed literally (legacy migration inventory) or reframed to JPWB current-state grounding?
- **alternatives:** A1 literal; A2 skip; A3 reframe (see roadmap §7).
- **decision:** A3 — reframe. **authority:** coding agent within delegated latitude, **conditioned on** sponsor ratification of DIV-W0-001 at G0.
- **evidence:** JPWB inventory; sponsor direction; RPH-DOC-005 §2 self-concession.
- **rationale:** honors sponsor direction + master intent; reuses prior work; yields a usable baseline; keeps destination.
- **status:** **EFFECTIVE (2026-07-19)** — ratified by the sponsor's G0 APPROVE_WITH_CONDITIONS (C1). **affected_artifacts:** `JAN-W0-DR-001`, all W0 evidence.

### DEC-W0-002 — Classify legacy `REMOVE`
- **question:** disposition of `janumicode` + `janumicode_v2`.
- **decision:** `REMOVE` (not a migration source). **authority:** sponsor direction 2026-07-19.
- **evidence:** sponsor message; phase-engine location; "Product Lens" confined to legacy.
- **rationale:** nothing to import/migrate/inherit.
- **status:** EFFECTIVE. **affected_artifacts:** `legacy-classification.md`.

## 3. Deferrals (contract: id, requirement, rationale, target, consequence, compensating_controls, authority, status)

### DEF-W0-001 — Per-capability conformance scoring
- **requirement:** exhaustive per-invariant conformance proof of each master W1/W2 outcome against JPWB.
- **rationale:** W0 delivers the baseline + register; deep scoring belongs to each wave's detailed roadmap.
- **target:** respective wave detailed roadmaps (W1-DR-001, W2-DR-001).
- **consequence:** W0 does not certify full corpus conformance (only the baseline).
- **compensating_controls:** the standing gate + dead-kernel census + divergence register.
- **authority:** coding agent. **status:** ACTIVE.

## 4. Assumptions / unknowns (contract: id, statement, type, impact, resolution_method, resolution_gate, owner, status)

### ASM-W0-001
- **statement:** the standing green gate reflects the current tree.
- **type:** assumption. **impact:** baseline validity. **resolution_method:** re-run gate at G0 assembly. **resolution_gate:** G0. **owner:** agent. **status:** OPEN.

### UNK-W0-001
- **statement:** exact per-capability conformance depth of each master W1/W2 outcome in JPWB (conformant vs partial vs hollow).
- **type:** unknown. **impact:** later-wave sizing. **resolution_method:** DWP-004/005/006 + later-wave roadmaps. **resolution_gate:** G1+. **owner:** agent. **status:** OPEN.

## 5. ADR baseline (initial)

The W0 ADR baseline is the set {DEC-W0-001, DEC-W0-002} above, plus the standing engineering decisions already recorded in the harmonization corpus (`HARMONIZATION-LOG.md` Increments through Y; `DECISION-*`, `RULING-*`, `DESIGN-*` in `docs/_working/`). W0 does not re-author those; it references them as the established ADR base and adds the two W0 decisions. Future ADRs SHALL use the `JAN-ROADMAP-001-C` decision contract.

## 6. Exit-criterion attestation

Every material divergence is captured and classified; no unresolved *critical* item is silent (DIV-W0-003 surfaced; DIV-W0-001 surfaced for decision). `JAN-WP-0-007` exit criterion **met** for the register; the ADR baseline is established.
