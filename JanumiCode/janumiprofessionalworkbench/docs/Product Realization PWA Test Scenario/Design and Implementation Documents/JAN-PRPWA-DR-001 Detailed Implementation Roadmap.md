# JAN-PRPWA-DR-001 — Detailed Implementation Roadmap

*Repository-specific implementation authority for the Coherent-Leaf-with-Delegation authoring capability, derived per `JAN-ROADMAP-001-A` (Detailed Roadmap Generation & Normalization Standard).*

## 1. Document control and repository identity

| Field | Value |
| :--- | :--- |
| **Document ID** | `JAN-PRPWA-DR-001` |
| **Version** | `0.2.0-draft` (reconciled against the mandated §3.7 self-critique — see §19) |
| **Status** | `WAVE COMPLETE (2026-07-20). DWP-01…07 all DELIVERED + CONFORMANT (commits af3825c8, ceae3bd7, 82e93ca1, 09a806ba, e3e32b97, 2aaf50db, 5ae6c61a on branch sonar/jpwb-remediation-2026-07-20; not pushed). Full gate green: check-types 21/21, all unit suites, lint 0, boundary 0, e2e 28/28. D-C→Option 1 shipped; Option 3 systemic F-7 closure now ALSO DELIVERED post-wave (§15 — assurance-policy validation moved to the domain write boundary). Sub-decisions ruled + disclosed: RC-4 (DWP-04→05 e2e), D-E (agent advisory surface), D-F (delegated RR-slot label), oracle-format (assertion-set).` |
| **Generation standard** | `JAN-ROADMAP-001-A` v2.0.0-draft (this document conforms to its §2 inputs, §3 procedure, §4 sections, §5 DWP contract, §6 grounding bar) |
| **Program model** | **Standalone `JAN-PRPWA` program-instance** that ADOPTS the `JAN-ROADMAP-001-A` standard and the `JAN-IRP` lifecycle/gate model. It is **not** a wave inside `JAN-ROADMAP-001` (the RPH-migration master, whose `W0–W10` are driven to gated dispositions). Sponsor-selected "Option B", 2026-07-20. |
| **Design authority** | `JAN-PRPWA-DS-001@0.2.1-draft` (the specification this roadmap implements) + `JAN-PRPWA-EP-001@0.1.0-draft` (engineering-practice requirements, cross-cutting). |
| **Repository & branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| **Revision at grounding** | Git Commit SHA `2040ae37` (`2040ae37851eebe589da17a7425caf2c3bd6b6e9`) — verified as the exact `DS-001` grounding SHA. |
| **Persistence revision** | `packages/rph-persistence/src/schema.ts` `SCHEMA_VERSION=1`; **this roadmap adds NO tables/migrations** (fields ride the existing `PwuType` object payload). |
| **Runtime identity** | `Turborepo + Bun (1.3.14)` monorepo; demo `apps/rph-demo` (SvelteKit); harness Vitest + Playwright (system Edge, `RPH_DEMO_MODE=test`) + `svelte-check` + `eslint` + `dependency-cruiser` + SonarQube/SonarLint (`JAN-PRPWA-EP-001 EP-TST-13`). |
| **Grounding method** | 6-agent parallel repository inspection (208 tool-uses) per `JAN-ROADMAP-001-A §3.2/§6`; every current-state fact below carries `file:line` evidence and a knowledge-status tag. |

**Prior decisions, deferrals, waivers inherited:** `DS-001` R-1…R-12 (ratified + delegated-authority); deferred: variation layer (R-11), Fixture C import (R-8), V-model correspondence rendering, blocking gate, the **runtime attestation-capture mechanism** (R-10 runtime), `performerMode` automation axis (R-9).

## 2. Activated scope

**In scope (this roadmap authorizes):** the authoring-time realization of `DS-001` STD-1 (leaf criterion), STD-2/STD-3/R-9 (`executionBoundary` + `boundaryContract`), R-10 **authoring-time** obligations + INV-2 assurance *projection*, SPEC-1 (agnostic core), SPEC-2 (under-decomposition advisory), SPEC-5 (Fixtures A + B), and the invariants INV-1/INV-2/INV-4a/INV-4b/INV-6 (INV-3/INV-5 are preserved, not newly built). Decomposed into seven detailed work packages `JAN-PRPWA-DWP-01…07` (§9).

**Adaptation of the `§5` contract to a standalone instance:** the DWP `master_wave` slot is set to `PRPWA`; `master_work_packages` reference `DS-001` SPEC/STD/R identifiers (there is no `JAN-ROADMAP-001` master WP register for this program).

**Out of scope (restated + dispositioned):** the **domain template (SPEC-4) and its authorship rule (R-12)** — DEFERRED this wave; **no ACTIVE domain template is authored**, so DWP-03 ships only SPEC-2's template-independent arm (>1 distinct `requiredOutput`) and its two template-keyed arms (`pwuKind='typicallyDecomposed'`, branch-depth) are deferred with it; R-12's agent-drafts/human-activates governance is not exercised (no template is proposed); DWP-07's projected-ASPLE oracle is a **test fixture, not a governed template** (needs no human activation). Also out of scope: runtime floor-plan delegation branch (`packages/rph-assurance/src/floor.ts` `deMinimisFloorPlan` stays `isAiProduced`-keyed — CONFIRMED `:56-80`); Undertaking-time attestation capture/staleness; the variation layer; Fixture C; `performerMode`.

*Contract-shape note (§5 adaptation):* single-repo context — every DWP's `repository_scope` implies `repositories: [hestami-ai/ai-home-maintenance]` and, where unlisted, `database_objects: []` (this design adds none); these trivial keys are omitted for brevity, not dropped.

## 3. Normative-source digest

Requirements, invariants, prohibited shortcuts, and evidence obligations governing this wave (from `DS-001`, `EP-001`, `JAN-ENGC-001`):

- **Leaf criterion (STD-1)** — legitimate leaf ⇔ irreducible-within-scope (STD-1-I, four conjunctive clauses, agent judgment per R-5) OR delegated-across-a-boundary (STD-1-D).
- **Boundary model (STD-2/STD-3/R-9/R-10)** — per-PWU-Type `executionBoundary {INTERNAL(default), DELEGATED_EXTERNAL}` + `boundaryContract {counterpartyLabel, attestedAssurancePolicyIds[], applicabilityNote?}`; a delegated node authors a contract in lieu of children; green-at-boundary = deterministic admission + counterparty attestation substituting for Reasoning Review.
- **Invariants** — INV-1 (delegated ⇒ contract present AND no children), INV-2 (our substantive floor never claimed for delegated external work), INV-4a (advisory never fires on delegated), INV-4b (advisory heuristic, dismissible), INV-5 (exec≠assurance; authoring never self-certifies), INV-6 (advisory never blocks commit).
- **Forward-compat (R-11 F-1/F-2/F-3)** — per-type (never global) fields; leaf/lint key only on the *resolved* boundary; `boundaryContract` self-contained.
- **Prohibited shortcuts (aggregated)** — do not author platform substrate as PWUs (D-3); do not fold the automation axis into `executionBoundary` (R-9); do not turn the advisory into a hard gate / machine-check "irreducible" (R-5/P-2/INV-6); do not treat attestation as verification (C-5/INV-5); do not hand-edit generated contracts; do not regex policy ids.
- **Engineering practice (`JAN-ENGC-001` + `EP-001`)** — evidence ladder (`§6.2`), Definition of Done (`§9`), comments-as-contract, decision observability, SonarQube scan + full complexity remediation (`EP-TST-13`), prefer-real-infrastructure / mock discipline (`EP-TST-6`).

## 4. Current-state findings and evidence

All `CONFIRMED` unless noted; each with grounded evidence.

- **F-1 Greenfield.** `executionBoundary`/`boundaryContract`/`DELEGATED_EXTERNAL`/`counterpartyLabel`/`attestedAssurancePolicyIds` exist **only** in the `DS-001` doc — zero occurrences across `packages/**`, handlers, broker, tools, vocab, UI, tests. *(grep, all 6 inspectors).*
- **F-2 Dual strict-schema gates.** The write path validates twice: command-bus against the `z.strictObject` payload schema (`command-bus.ts:133`; `messages.ts:492/543`) **and** commit against the `z.strictObject` object schema (`kit.ts:205`; `PwuType.json:351 additionalProperties:false`). Unknown keys are rejected at both → contracts MUST land before any surface emits the fields.
- **F-3 Generated contracts.** `enums.ts`/`objects.ts`/`messages.ts` + `schemas/` are generated from vocab (`gen-enums←canonical-vocabulary.json`, `gen-objects←m1-object-fields.json`, `gen-messages←m3-commands-events.json`). Baseline `bun run gen` runs clean and the committed files equal `gen + prettier` **byte-exact** (`git diff` empty after gen+prettier); raw gen output differs only in formatting and would fail repo `format:check`. Fidelity tests (`enums/objects/messages.test.ts`) compare compiled schemas to vocab (prettier-agnostic) → they fail between a vocab edit and `bun run gen`, then pass. *(inspector 4, ran the pipeline.)*
- **F-4 Ratified patterns to mirror.** Enum: `CardinalityCode` (`canonical-vocabulary.json:64-75` → `enums.ts:197-199,818`). Helper subtype: `PermittedChildRule {typeId, cardinality:CardinalityCode(bare type, no enumRef), applicabilityNote?}` (`m1-object-fields.json:2852-2874` → `objects.ts:201-206/257-262`). Scalar enum fields use a **bare `type`**, not `enumRef` (`enumRef` is for enum arrays). `gen-objects` demotes a helper to a permissive `z.record` placeholder if it has <2 typed fields or any untyped field (`gen-objects.ts:108-112`).
- **F-5 Handler write boundary.** `definePwuType` builds `PwuType` state by **explicit named-field assignment (no `...p` spread)** → an unthreaded payload field is silently dropped (`pwa-authoring.ts:213-269`). `completionRule` is the defaulted-field precedent (object required, payload optional, handler applies default `:255-256`). `editPwuType` is a present-field patch merged onto the loaded state (`:389-427`). `withPwaVersionBump` wraps define/edit/remove (`:161-182,261,429,498`) → a boundary edit rides the PWA `semanticVersion` bump. All writers (seed, broker) go **through the handler** (`seed-workbench.ts:263-284`; `broker.ts:340-393`) → the handler is the single choke-point that can default `executionBoundary`.
- **F-6 INV-1 is not schema-expressible.** A cross-field predicate (delegated ⇒ contract present AND no children) cannot be a `z.strictObject` rule; it must be a handler reject + property test. `removePwuType` is the precedent for a hard structural invariant enforced **in the domain, not just the UI** (`pwa-authoring.ts:466-484`, `RPH_INVARIANT_VIOLATION`, comment `:475`).
- **F-7 Policy-validation locus asymmetry.** `requiredAssurancePolicyIds` is validated (ACTIVE, non-floor; reject floor/DRAFT/SUSPENDED/missing; retain pre-existing inactive) **only in the broker** `validatePolicyReferences` (`broker.ts:620-644`), **not** in the handler — so a non-broker dispatch can persist arbitrary ids. R-10 inherits this asymmetry (see §7 correction candidate, §15 D-C).
- **F-8 Broker carry pattern.** `requiredAssurancePolicyIds` is now *fully* threaded (view→input→payload→scaffold: `broker.ts:58,84,98,350,401-403,146,586`) — the exact carry pattern the two new fields replicate. `PwuTypeView`/`toTypeView` read only the known fields (`:45-59,182-199`) → new fields must be added or they are silently dropped.
- **F-9 Lint.** `lintComposition` = root + fan-out (`FANOUT_LIMIT=5`) + orphans only; no under-depth check (`lint.ts:71-81`). `CompositionNode` carries `{id,name,isRoot,permittedChildTypeIds}` (`:6-11`); `lint.test.ts`'s `node()` helper builds bare objects → new `CompositionNode` fields MUST be optional. `review_composition` calls `lintComposition(broker.listTypes())` with `mutates:false` (`tools.ts:201-217`) → agent surfacing is automatic; `PwuTypeView` must gain `executionBoundary` (structural assignability to `CompositionNode`).
- **F-10 Tools DSL constraint.** Tools are thin forwarders; the engine is the fail-loud guardrail (`tools.ts:1-5`). The `ParamType` DSL is `'string'|'boolean'|'string[]'|'object[]'` — **no singular-object type**; `toTypeBox` has no singular-object branch (`types.ts:48`; `pi-agent.ts:24-37`). `boundaryContract` is ONE sub-object → not `object[]`. The scalar-enum pattern to mirror is `cardinality` (`CARDINALITY_CODES` Set + `asCardinality` pre-check, `tools.ts:17-28`). `mock-agent.ts` is arg-agnostic verbatim forwarder (`:68-82`) → no mock change to exercise the fields.
- **F-11 System prompt.** `buildSystemPrompt` has no leaf/stopping criterion and no platform/content boundary; "Depth is good" (`system-prompt.ts:27`); the three planes exist implicitly but unnamed (composition `:20`, hand-off `:22`, lifecycle `:35`).
- **F-12 UI.** Authoring form renders per-child cardinality (`+page.svelte:1252-1306`) + declared policies (`:1307-1349` over `pickablePolicies:490-492`); `readTypeFields` decodes them (`+page.server.ts:200-227`); `policyReferenceError` validates ACTIVE/non-floor (`:232-251`); `load()` reads a fixed field set with no boundary (`:86-108`); inspector rail shows locked floor + additive policies (`+page.svelte:1362-1415`). The Designer health chip uses `analyzePwaGraph` (a DIFFERENT analyzer), not `lintComposition` (`:733-751`). `FloorView.reasoningGaps` is the precedent for a human advisory list (`+page.svelte:1520-1525`).
- **F-13 Assurance projection (INV-2 risk).** Leaf is structural and computed in **three** un-shared places (`pwa-graph-report.ts:49`, `pwaFlow.ts:388`, and a resolved-permits variant in `pwa-graph.ts:319`). `PwaGraphNode` is assurance- and boundary-blind (`pwa-graph.ts:19-27`). The §11.7.4 rail renders "Reasoning Review" **unconditionally** on every card (`PwuTypeCard.svelte:67-70`; `pwaFlow.ts:393-394`). The floor runs over the **whole PWA as one subject**, `isAiProduced:true`, not per-node (`floor.ts:283-289`). Floor labels are **triplicated** (`catalog.ts ASSURANCE_FLOOR` / `floor.ts FLOOR_POLICY_IDS` / `floor-policies.ts FLOOR_POLICY_DEFINITIONS`) — the hollow-governed-layer hazard; do not add a fourth list. *(INV-2 concrete-today: INFERRED, `PwuTypeCard.svelte:67-70` + `floor.ts:288` + DS-001 INV-2.)*
- **F-14 Existing attestation primitive.** `shapeReadinessAttestationId` + semantic-version staleness (`pwu.ts:410-416`) is the provenance-bearing-claim / "disclosure is not verification" pattern R-10 composes with.

## 5. Legacy semantic classification

No legacy migration — this is **additive greenfield**. Classification of the touched surfaces:

- `PwuType` object, Define/EditPwuType payloads, broker inputs, tools, UI, lint, projection → **PRESERVE** (unchanged behavior for all INTERNAL / existing types) + **GENERALIZE** (add the boundary dimension). `executionBoundary` defaults `INTERNAL` everywhere → every existing type, seed, catalog blueprint, and e2e plan is behavior-identical.
- Runtime floor plan (`deMinimisFloorPlan`) → **DEFER** (R-10 runtime, §11).
- The triplicated floor-label lists → **UNRESOLVED** pre-existing debt; this wave MUST NOT deepen it (derive delegated-rail semantics from the boundary annotation, not a 4th list).

## 6. Target-state gap analysis

| Target (DS-001) | Present at `2040ae37` | Gap |
| :--- | :--- | :--- |
| Leaf = irreducible OR delegated | leaf = `permittedChildTypeIds.length===0` (structural, ×3 sites) | boundary dimension absent; leaf-kind unrepresented |
| `executionBoundary`/`boundaryContract` on `PwuType` | absent | vocab + gen + handler + broker + tools + UI + projection threading |
| Under-decomposition advisory | none (asymmetric lint) | `checkUnderDecomposition` + `CompositionNode.executionBoundary/requiredOutputs` |
| Agnostic-core prompt (STD-1/D-3/three planes) | none ("Depth is good") | prompt authoring |
| Delegated-leaf assurance (INV-2) | rail shows Reasoning Review unconditionally | conditioned rail + separate report fields; runtime floor deferred |
| R-10 attestation validation | `requiredAssurancePolicyIds` broker-only | reuse `validatePolicyReferences` for `attestedAssurancePolicyIds` |

## 7. Alternatives considered and selected strategy; normative-document corrections

**Bound design decisions (ordinary route details, `JAN-ROADMAP-001-A §3.8`):**
- **`executionBoundary` cardinality → OPTIONAL/additive, resolved `absent = INTERNAL`.** Alt: required-with-handler-default (completionRule precedent). Selected optional because seeded/persisted types re-validate on read without it and edit rewrites the full state (`F-5`); required-without-default breaks the seed. *(Rationale: back-compat > symmetry; DS-001 "additive, existing types unaffected".)*
- **Enum representation → named `ExecutionBoundary` canonical enum.** Alt: inline literal union (`PwuType.status`). Selected named enum for tool/UI enumerability and free `enums.test.ts` fidelity coverage (`F-4`).
- **`boundaryContract` tool param → FLATTEN to scalar params** (`counterpartyLabel`, `attestedAssurancePolicyIds`, `boundaryApplicabilityNote`) reassembled in `run()`. Alt: add a singular `'object'` `ParamType` + `toTypeBox` branch. Selected flatten — no DSL change, matches existing tool flattening, avoids the `object[]` "0-or-many" contradiction with INV-1 (`F-10`). *(The vocab/handler contract stays the structured `BoundaryContract` sub-object; only the tool param is flattened.)*
- **`BoundaryContract` field constraints → `counterpartyLabel` non-empty, enforced in the HANDLER (not the schema).** The vocab→gen pipeline emits a bare `z.string()` and cannot express `minLength`/`maxLength` (CONFIRMED: `objects.ts` has zero `.min(`), so the non-empty check is a handler write-boundary reject co-located with the INV-1/STD-3 guard (C-5). `attestedAssurancePolicyIds` required array (MAY be empty — substantive per-treatment attestation is captured at Undertaking time, deferred). *("Oversized" rejection is dropped — no `maxLength` is expressible without a generator change, out of scope.)*
- **INTERNAL ⇒ no `boundaryContract` (added coherence guard; Inferred-rationale per `JAN-ENGC-001 §3.4`).** `DS-001` INV-1/STD-3 constrain only DELEGATED_EXTERNAL nodes and are silent on INTERNAL; this roadmap adds a symmetric handler reject because a contract on a non-delegated node is meaningless, unassured state. Recorded here as a bound route-refinement, **not** presented as `DS-001` INV-1; a future R-11 org-profile that rebinds a boundary MUST strip/rebuild the contract in the same edit (DWP-05 clear-on-flip).

**Resolved material decision (D-C, sponsor-ruled 2026-07-20; see §15):**
- **R-10 policy-validation locus → Option 1 (broker-parity).** `attestedAssurancePolicyIds` is validated in the broker exactly like `requiredAssurancePolicyIds` (reuse `validatePolicyReferences`); the structural INV-1/STD-3 guard and the empty-`counterpartyLabel` check go to the handler regardless (C-5). The pre-existing broker-only bypass (`F-7`, affecting `requiredAssurancePolicyIds` today) is **not** closed in this wave; the systemic fix (move all assurance-policy-reference validation into the handler) is **backlogged** as Option 3 (§15 Backlog), by sponsor direction.

**§7 normative-document corrections (DS-001 route refinements, no target-architecture change):**
- **RC-1 (increment re-order).** `DS-001` sequences the lint advisory (WP-C1-b) *before* the contracts thread (WP-C1-c). Grounded dependency (`F-9`): the advisory's INV-4a requires `executionBoundary` on `CompositionNode`, which the contracts thread introduces. **Refinement:** contracts (DWP-02) land before the advisory (DWP-03). Implementation-route change only; the destination (advisory that skips delegated) is unchanged.
- **RC-2 (assurance projection is a distinct DWP).** `DS-001` folds R-10's projection into general work; the inspection shows it is a distinct, INV-2-sensitive change (rail conditioning) warranting its own DWP-06.

## 8. Repository architecture and change map

Thread order (dependency-forced by `F-2`): **vocab → `bun run gen` → application handler → broker → {agent tools + system prompt} + {UI} + {lint} + {assurance projection}**.

- `packages/rph-contracts/vocab/{canonical-vocabulary,m1-object-fields,m3-commands-events}.json` → `bun run gen` → `src/{enums,objects,messages}.ts` + `schemas/` (+ prettier).
- `packages/rph-application/src/handlers/pwa-authoring.ts` — define/edit state + INV-1/STD-3 write-boundary reject; `pwuTypeNodesOf` projection node (add boundary).
- `packages/rph-authoring/src/{broker.ts,catalog.ts,lint.ts}` — view/input/scaffold threading; `PWU_TYPE_HELP`; `checkUnderDecomposition`; broker INV-1 pre-check + `validatePolicyReferences` reuse.
- `apps/rph-demo/src/lib/server/agent/{tools.ts,system-prompt.ts}` — tool params (flattened) + agnostic-core + STD-3 prose.
- `apps/rph-demo/src/routes/pwa/[id]/{+page.svelte,+page.server.ts}` — form + inspector + advisory human read (optional).
- `packages/rph-projections/src/{pwa-graph.ts,pwa-graph-report.ts}` + `apps/rph-demo/src/lib/pwaFlow.ts` + `PwuTypeCard.svelte` — `PwaGraphNode.executionBoundary` + conditioned rail (INV-2).

## 9. Detailed work-package register

```yaml
id: JAN-PRPWA-DWP-01
master_wave: PRPWA
master_work_packages: [DS-001:SPEC-1, D-1, D-1a, STD-1, P-1, D-3]
title: "Agnostic-core system prompt — leaf criterion, comprehensive-by-default, negative platform rule, the three planes"
outcome: "buildSystemPrompt teaches STD-1 (both leaf branches), P-1 comprehensive-by-default, D-3 (do NOT author substrate: ledger/memory/loop-control/JIT-context/credential-issuance/floor), and names the three planes (composition / artifact hand-off / PWU lifecycle) kept distinct from the platform/content classification and the floor triad. Prompt-only; no contracts."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["apps/rph-demo/src/lib/server/agent/system-prompt.ts::buildSystemPrompt (replace 'Depth is good' :27; add platform/content + three-planes section)", "apps/rph-demo/src/lib/server/agent/system-prompt.test.ts"]
  database_objects: []
  runtime_surfaces: ["Pi authoring agent grounding"]
dependencies: []
required_changes: ["State STD-1-I(a)-(d) + STD-1-D", "State P-1 + the D-3 substrate list", "Name + disambiguate the three planes (D-1a)"]
invariants: ["Advisory framed non-blocking (P-2/INV-6)", "Do NOT fold automation axis into executionBoundary (R-9)"]
prohibited_shortcuts: ["Turning the advisory prose into a 'must'", "Conflating the three planes with §5.2 classification or STD-1-I(d) floor triad (D-1a)"]
tests: ["system-prompt.test.ts asserts STD-1 both branches, D-3 substrate list, three named planes present (additive substrings; existing assertions unaffected)"]
evidence: ["Fixture A (author-from-intent) diff shows comprehensive decomposition + platform NOT authored (SPEC-5)", "EP-TST-8/EP-TST-3 (SHALL): substring-presence is NOT sufficient prompt-change evidence; behavioral regression = Fixtures A/B on the LIVE path (DWP-07); reasoning-quality/consistency dimensions discharged only by the live run — reasoned deferral (§12)"]
migration_and_compatibility: ["None — additive prose"]
rollback_and_recovery: ["Revert the prompt edit"]
risks: ["Prompt bloat / agy ENAMETOOLONG budget (reasoning-review prompt is separately budgeted — unrelated, but keep prompt concise)"]
open_decisions: ["Exact three-planes wording vs existing implicit coverage (F-11)"]
exit_criteria: ["check-types + test green; prompt states STD-1/P-1/D-3/three planes"]
delivery_state: DELIVERED  # commit af3825c8 — svelte-check 1604 files 0 errors/0 warnings; rph-demo unit suite 88/88
conformance_state: CONFORMANT
```

```yaml
id: JAN-PRPWA-DWP-02
master_wave: PRPWA
master_work_packages: [DS-001:SPEC-3, STD-2, STD-3, R-9, R-10(authoring), INV-1, F-1/F-2/F-3]
title: "Boundary contracts foundation — vocab + gen + handler write-boundary (INV-1) + broker seam"
outcome: "PwuType carries executionBoundary (enum, optional, resolve absent=INTERNAL) + boundaryContract (BoundaryContract subtype); DefinePwuType/EditPwuType payloads carry both (optional); the handler persists them, defaults INTERNAL, and enforces INV-1/STD-3 at the write boundary; the broker threads them through view/input/scaffold and reuses validatePolicyReferences for attestedAssurancePolicyIds."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "vocab/canonical-vocabulary.json:64 (+ ExecutionBoundary enum {INTERNAL,DELEGATED_EXTERNAL})"
    - "vocab/m1-object-fields.json:2852 (+ BoundaryContract helper: counterpartyLabel str req, attestedAssurancePolicyIds str[] req, applicabilityNote str opt), :1349 (+ executionBoundary type 'ExecutionBoundary' bare, boundaryContract type 'BoundaryContract' on PWU_TYPE)"
    - "vocab/m3-commands-events.json:2055,:2285 (+ both fields optional on DefinePwuType/EditPwuType)"
    - "bun run gen  → src/{enums,objects,messages}.ts + schemas/ ; then bun run format"
    - "packages/rph-application/src/handlers/pwa-authoring.ts:233-258 (define state + default INTERNAL), :406-420 (edit patch), + INV-1/STD-3 guard before withPwaVersionBump"
    - "packages/rph-authoring/src/broker.ts PwuTypeView:45, toTypeView:182, DefineTypeInput:73, EditTypeInput:88, ScaffoldSpec:136, defineType:331, editType:374, buildScaffoldCommands:549, validatePolicyReferences:620 (reuse for attested)"
  database_objects: ["PwuType payload (NO new tables); schemas/objects/PwuType.json regenerated; schemas/enums/ExecutionBoundary.json emitted"]
  runtime_surfaces: ["command-bus + commitState strict validation"]
dependencies: []
required_changes:
  - "Add ExecutionBoundary enum (bare scalar type on the field, no enumRef)"
  - "Add BoundaryContract helper with >=2 typed fields (else gen demotes to z.record placeholder — F-4)"
  - "Full `bun run gen` (NOT piecemeal) then prettier"
  - "Handler: executionBoundary = p.executionBoundary ?? 'INTERNAL'; conditional boundaryContract; default executionBoundary onto edit `next`"
  - "Handler INV-1/STD-3 against MERGED next state: DELEGATED_EXTERNAL ⇒ boundaryContract present AND no permittedChildTypeIds/permittedChildren; INTERNAL ⇒ no boundaryContract (Inferred-rationale coherence guard, §7); reject empty counterpartyLabel (non-empty check — schema cannot express minLength)"
  - "On edit, DERIVE boundaryContract presence from the RESOLVED executionBoundary — STRIP it on the INTERNAL branch of `next` (NOT omit-and-carry-forward: editPwuType patch-merges, so a DELEGATED→INTERNAL flip carrying a stale contract would fail INV-1)"
  - "Broker: thread both fields (mirror requiredAssurancePolicyIds carry, F-8); reuse validatePolicyReferences for attestedAssurancePolicyIds; add friendly INV-1 pre-check + scaffold guard"
invariants: ["INV-1 (handler, hard reject RPH_INVARIANT_VIOLATION — removePwuType precedent F-6)", "INV-5 (attestation is a claim, never authoring self-cert)", "F-1 per-type (never global)", "F-3 self-contained contract"]
prohibited_shortcuts:
  - "Hand-editing generated enums.ts/objects.ts/messages.ts (overwritten by gen)"
  - "Piecemeal gen — a stale enums scrape resolves executionBoundary to z.unknown() (unrecognized scalar, NOT z.string()); boundaryContract stays BoundaryContractSchema (same-file helper) and only degrades if the helper is omitted from helperSubTypes. Run FULL bun run gen (F-3)"
  - "Skipping prettier (format:check fails; ~1600-line noise diff)"
  - "Making executionBoundary required-without-default (breaks seed/edit-rewrite)"
  - "Enforcing INV-1 only in broker/UI (must be handler write boundary, C-5)"
  - "Regex/parsing policy ids (resolve against real ASSURANCE_POLICY status)"
  - "Re-validating pre-existing attested ids on an unrelated edit (retain-existing semantics)"
tests:
  - "Contract: PwuType + Define/EditPwuType strictObject accept the new fields (else strictObject rejects); ExecutionBoundary options == [INTERNAL,DELEGATED_EXTERNAL] (auto via enums.test.ts)"
  - "Property/INV-1: DELEGATED_EXTERNAL + non-empty children → REJECT; edit flipping to DELEGATED while children present → REJECT; delegated w/o contract → REJECT; INTERNAL w/ contract → REJECT"
  - "Boundary/C-5: out-of-enum executionBoundary rejected at BOTH gates; empty counterpartyLabel rejected at the handler write boundary (max-length not schema-expressible → no 'oversized' case)"
  - "Edit transition: DELEGATED_EXTERNAL→INTERNAL clears the contract and succeeds; INTERNAL→DELEGATED with children present → REJECT"
  - "R-10 policy: attestedAssurancePolicyIds floor/DRAFT/SUSPENDED/missing → REJECT (broker), ACTIVE non-floor accepted, pre-existing inactive retained on unrelated edit"
  - "Back-compat: pre-existing PwuType with no executionBoundary validates + edits (default applied); seed unaffected"
  - "Integration round-trip: command→handler→PwuTypeDefined/Redefined→persistence→projection incl. default INTERNAL"
  - "Regen signal: enums/objects/messages.test.ts fail before gen, pass after"
evidence: ["`bun run gen` clean; `git diff` empty vs gen+prettier baseline; check-types + rph-contracts/rph-application/rph-authoring tests green"]
migration_and_compatibility: ["Additive optional fields; no table/migration; withPwaVersionBump rides existing bump"]
rollback_and_recovery: ["Revert vocab + regen + revert handler/broker; additive so no data migration"]
risks: ["Dual-gate silent VALIDATION_FAILED if one schema layer missed (F-2)", "Placeholder demotion of BoundaryContract if <2 typed fields (F-4)"]
open_decisions: ["D-C RULED (Option 1, broker-parity): attestedAssurancePolicyIds validated in the broker like requiredAssurancePolicyIds; Option 3 handler-hardening backlogged (§15)"]
exit_criteria: ["All above tests green; a DELEGATED_EXTERNAL PwuType round-trips through the engine with a valid boundaryContract and is rejected if it has children"]
delivery_state: DELIVERED  # ExecutionBoundary enum + BoundaryContract helper (z.strictObject, no F-4) → full gen + prettier byte-exact; handler checkBoundaryCoherence (INV-1/STD-3, write-boundary, observable) on define+edit incl. strip-on-INTERNAL; broker validateBoundary (D-C Option 1 attested-policy parity) on define/edit/scaffold. Gate: check-types 21/21, lint 0, boundary 0, rph-contracts 153 / rph-application 184 / rph-authoring 29 (broker 24) green.
conformance_state: CONFORMANT  # SPEC-3/STD-2/STD-3/R-9/R-10(authoring)/INV-1/F-1/F-3 realized as specified; INV-5 untouched (attestation = counterparty claim, never authoring self-cert). Option-3 systemic handler-hardening remains backlogged (§15).
```

```yaml
id: JAN-PRPWA-DWP-03
master_wave: PRPWA
master_work_packages: [DS-001:SPEC-2, INV-4a, INV-4b, R-5, P-2]
title: "Under-decomposition advisory — symmetric partner to checkFanout, boundary-aware"
outcome: "lintComposition gains a non-blocking checkUnderDecomposition that SKIPS DELEGATED_EXTERNAL nodes (INV-4a, structural) and, for INTERNAL leaves, fires a dismissible heuristic on >1 distinct requiredOutput (INV-4b). Surfaced automatically on the agent path (review_composition)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["packages/rph-authoring/src/lint.ts CompositionNode:6 (+ optional executionBoundary + requiredOutputs), new checkUnderDecomposition, lintComposition:71", "packages/rph-authoring/src/broker.ts PwuTypeView (+ executionBoundary so listTypes() stays assignable to CompositionNode)", "lint.test.ts"]
  runtime_surfaces: ["review_composition agent tool (already calls lintComposition — surfaces automatically)"]
dependencies: [JAN-PRPWA-DWP-02]
required_changes: ["New optional CompositionNode fields (keep node() helper compiling)", "checkUnderDecomposition: skip DELEGATED_EXTERNAL; fire on INTERNAL leaf with >1 distinct requiredOutput", "Wire after checkFanout"]
invariants: ["INV-4a structural suppression on DELEGATED_EXTERNAL (not a tolerance)", "INV-6 non-blocking", "R-5 no machine-check of 'irreducible' — structural proxy only"]
prohibited_shortcuts: ["Absolute-invariant framing of the INTERNAL heuristic (INV-4b: dismissible)", "Template-keyed arms (pwuKind 'typicallyDecomposed' / branch-depth) — DEFERRED, depend on SPEC-4/R-12 template which does not exist"]
tests: ["INV-4a: advisory NEVER fires on DELEGATED_EXTERNAL", "INV-4b: fires on INTERNAL >1-output leaf; does NOT fire on single-output irreducible leaf", "existing root/fanout/orphan tests stay green"]
evidence: ["review_composition returns the advisory finding for a coarse INTERNAL multi-output leaf; none for a delegated leaf"]
migration_and_compatibility: ["Optional CompositionNode fields (back-compat with lint.test node() helper)"]
rollback_and_recovery: ["Remove checkUnderDecomposition call"]
risks: ["Only the >1-output arm is implementable now (template arms deferred) — communicate the partial heuristic (no silent cap)"]
open_decisions: ["Confirm >1-output-only scope for this wave (F-9 UNKNOWN)"]
exit_criteria: ["check-types + rph-authoring tests green; INV-4a/INV-4b property tests pass"]
delivery_state: DELIVERED  # lint.ts checkUnderDecomposition wired after checkFanout; CompositionNode gains optional executionBoundary + requiredOutputs (PwuTypeView already assignable from DWP-02); surfaces via review_composition (tools.ts:207 unchanged — passes listTypes() through). Gate: check-types 21/21, rph-authoring 33 tests (lint +4), lint 0, boundary 0.
conformance_state: CONFORMANT  # INV-4a hard structural skip on DELEGATED_EXTERNAL; INV-4b advisory (info) on >1 distinct requiredOutput, dismissible per R-5 (structural proxy, not an irreducibility machine-check); INV-6 non-blocking. Template-keyed arms DEFERRED (need SPEC-4/R-12) — partial heuristic disclosed in code + finding text (no silent cap).
```

```yaml
id: JAN-PRPWA-DWP-04
master_wave: PRPWA
master_work_packages: [DS-001:SPEC-3(tools), STD-3, R-10(authoring), SPEC-1(STD-3 prose)]
title: "Agent authoring surface — tool params (flattened) + STD-3 delegated-contract prose"
outcome: "define_pwu_type/edit_pwu_type/scaffold_graph expose executionBoundary (enum pre-check mirroring cardinality) + a flattened boundaryContract (counterpartyLabel/attestedAssurancePolicyIds/boundaryApplicabilityNote reassembled in run()); PWU_TYPE_HELP gains the fields; the system prompt gains STD-3 delegated-leaf authoring prose."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["apps/rph-demo/src/lib/server/agent/tools.ts define_pwu_type:390, edit_pwu_type:444, scaffold_graph items:229, + EXECUTION_BOUNDARY_CODES near :17", "packages/rph-authoring/src/catalog.ts PWU_TYPE_HELP:9-28", "apps/rph-demo/src/lib/server/agent/system-prompt.ts (STD-3 prose)", "tools.test.ts, system-prompt.test.ts"]
  runtime_surfaces: ["Pi tool schemas; mock path unchanged (arg-agnostic)"]
dependencies: [JAN-PRPWA-DWP-02, JAN-PRPWA-DWP-01]
required_changes: ["executionBoundary enum param + friendly pre-check (mirror asCardinality)", "FLATTEN boundaryContract to scalar params, reassemble in run(), forward to broker", "help parity via PWU_TYPE_HELP", "STD-3 prose (contract in lieu of children; reuse requiredInputs/Outputs for hand-off)"]
invariants: ["Tools do NOT re-implement INV-1 (engine is guardrail, F-10)", "attestedAssurancePolicyIds forwarded raw; broker validates (R-10)", "INV-2: prose never claims platform assures external work"]
prohibited_shortcuts: ["Modeling boundaryContract as object[] (0-or-many contradicts INV-1)", "Adding param validation to mock-agent (must stay verbatim forwarder)", "Hardcoding help text inline (pull from help.*)"]
tests: ["unit: enum pre-check accepts INTERNAL/DELEGATED_EXTERNAL, rejects garbage across the 3 tools", "unit: boundaryContract reassembled + forwarded to broker (spy)", "prompt: STD-3 prose present (substring); behavioral prompt-regression per EP-TST-8 = live Fixtures A/B (§12, DWP-07)", "e2e (mock path): a plan authoring a DELEGATED_EXTERNAL leaf with a boundaryContract round-trips to a rendered node"]
evidence: ["e2e mock-path plan authors a delegated leaf; INV-6 coarse-PWA-still-commits e2e"]
migration_and_compatibility: ["Additive params; omitting them resolves INTERNAL/no-contract; existing plans unaffected"]
rollback_and_recovery: ["Revert tool + prompt edits"]
risks: ["Flattened params must reassemble exactly to the broker's BoundaryContract shape"]
open_decisions: ["Whether define_from_template accepts executionBoundary (templates are all INTERNAL — likely leave INTERNAL-only)"]
exit_criteria: ["check-types + e2e (mock) green; delegated leaf authorable by the agent"]
delivery_state: DELIVERED  # tools.ts: EXECUTION_BOUNDARY_CODES + executionBoundaryError enum pre-check + boundaryInput reassembly (flattened counterpartyLabel/attestedAssurancePolicyIds/boundaryApplicabilityNote → BoundaryContract), threaded through define_pwu_type/edit_pwu_type/scaffold_graph; PWU_TYPE_HELP gains 4 keys (help.* not inline); system-prompt gains STD-3 "AUTHORING A DELEGATED LEAF" prose. mock-agent untouched (verbatim forwarder). Gate: check-types 21/21, rph-demo 94 tests (tools +5, prompt +1), lint 0, existing mock-path e2e green (12.3s).
conformance_state: CONFORMANT  # STD-3(tools)/R-10(authoring)/SPEC-1(STD-3 prose) realized; INV-1 left to the engine (F-10); INV-2 honored in prose (attested = counterparty claim). RC-4 (disclosed, PB-3 no-silent-narrowing): the dedicated delegated-leaf END-TO-END e2e (author → rendered node showing boundary) moves to DWP-05, where the form control + boundary rendering exist and the assertion is end-to-end meaningful; the delegated round-trip itself is already proven at unit (tool→broker reassembly) + integration (handler persist/INV-1) level, and the existing mock-path e2e is regression-green.
```

```yaml
id: JAN-PRPWA-DWP-05
master_wave: PRPWA
master_work_packages: [DS-001:WP-C1-e, SPEC-3(UI), STD-2, STD-3, R-10, INV-6]
title: "PWA Designer UI — per-type executionBoundary control, delegated boundaryContract sub-form, inspector boundary/leaf display, advisory surface"
outcome: "The authoring form offers a per-type executionBoundary select; DELEGATED_EXTERNAL hides the child-types block and reveals a boundaryContract sub-form (counterparty text + attested-policy multi-checkbox reusing pickablePolicies + note); readTypeFields decodes/validates/clears-children; load() reads boundary defaulting INTERNAL; the inspector shows a boundary badge + delegated-vs-irreducible leaf status; the advisory surfaces on the agent path (human read optional)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["apps/rph-demo/src/routes/pwa/[id]/+page.svelte typeform ~1246, f state 311-319, openDefine/openEdit/applyTemplate 353-409, childlist 1252-1306, inspector 1362-1415", "apps/rph-demo/src/routes/pwa/[id]/+page.server.ts load 86-108, readTypeFields 200-227, TypeFields 166-177, defineType/editType 319-374, policyReferenceError 232-251", "apps/rph-demo/e2e/pwa-authoring-rich.e2e.ts (+ new)"]
  runtime_surfaces: ["SvelteKit form actions; inspector rail"]
dependencies: [JAN-PRPWA-DWP-02, JAN-PRPWA-DWP-03, JAN-PRPWA-DWP-04]
required_changes: ["executionBoundary select (F-1 per-type)", "DELEGATED_EXTERNAL: hide children + boundaryContract sub-form", "readTypeFields decode + assemble + validate (reuse policyReferenceError); clear children when DELEGATED_EXTERNAL AND clear boundaryContract when resolved INTERNAL (symmetric)", "load() reads executionBoundary + boundaryContract (default INTERNAL) into data.types / PwuTypeNode", "inspector boundary badge + two-kinded leaf status via the shared leafKind helper (DWP-02, do NOT re-derive)", "advisory human read (optional, mirror reasoningGaps) — agent surface already automatic"]
invariants: ["INV-1 must hold at write boundary, not only visually (server must not persist delegated+children)", "INV-6 advisory never blocks commit; do NOT route through analyzePwaGraph valid/coherent gate", "INV-2 authoring never self-certifies"]
prohibited_shortcuts: ["Hiding child UI while still POSTing children", "Hiding the contract sub-form while still POSTing a contract (symmetric to children)", "Trusting attested ids without ACTIVE/non-floor check", "Global PWA-level boundary control (F-1)", "Free-text counterparty-only contract (STD-3 structured)", "Re-deriving leaf-KIND independently of the DWP-02 shared helper (F-13 divergence)"]
tests: ["e2e: author DELEGATED_EXTERNAL — child block disappears, contract fields appear, persisted type shows executionBoundary+boundaryContract via engine introspect; inspector shows badge + delegated-leaf status", "e2e INV-6: coarse INTERNAL PWA still commits with advisory present", "e2e/boundary C-5: attesting a DRAFT/floor id → form error", "component: inspector renders delegated rail; INTERNAL unchanged (back-compat)", "unit: readTypeFields decodes boundary + clears children for delegated"]
evidence: ["svelte-check + Playwright e2e green; delegated leaf authorable + rendered"]
migration_and_compatibility: ["Additive; INTERNAL default; existing seed PWA renders unchanged; rebuild package dists before svelte-check/e2e"]
rollback_and_recovery: ["Revert UI files"]
risks: ["Two authoring paths (UI + agent) must post the identical wire shape or e2es diverge", "Analyzer split (lintComposition vs analyzePwaGraph) — advisory must not be conflated with the coherence gate"]
open_decisions: ["D-E: advisory human surface — new inspector read vs 'surfaced via review_composition (agent)' suffices (F-12 UNKNOWN)", "Node-card DELEGATED marker (optional, §11.7.4 idiom)"]
exit_criteria: ["svelte-check + e2e green; delegated authoring + inspector display work; INV-6 e2e passes"]
delivery_state: DELIVERED  # +page.server.ts: load() threads executionBoundary(resolved)+boundaryContract; readTypeFields decodes boundary + SYMMETRIC clear (delegated⇒no children, internal⇒no contract) at the write boundary; defineType/editType thread both + validate attested ids via policyReferenceError (retain-existing on edit). +page.svelte: per-type executionBoundary select (F-1), DELEGATED hides child block + reveals boundaryContract sub-form (counterparty + attested multi-checkbox reusing pickablePolicies + note), inspector boundary badge + two-kinded leaf status + contract display. Shared leafKind helper in rph-projections (leaf.ts) — consumed by the inspector (here) and the DWP-06 rail (F-13 single source). e2e pwa-authoring-delegation (RC-4): child-block↔contract toggle, engine round-trip (executionBoundary+boundaryContract persisted, children cleared), inspector badge+contract. Gate: svelte-check 0, lint 0, boundary 0, 28/28 e2e (incl. rich/backbone regression), rph-projections leaf.test +5.
conformance_state: CONFORMANT  # STD-2/STD-3/R-10/INV-1(write-boundary, engine-enforced+client-symmetric)/INV-6(never gates)/INV-2(authoring never self-certifies — attested = counterparty claim). D-E RULED: the under-decomposition advisory's HUMAN read is satisfied by the agent surface (review_composition, DWP-03) — the roadmap frames the inspector read as optional and offers this option; no net-new advisory panel this wave (disclosed, PB-3). D-F (delegated Reasoning-Review slot label) deferred to DWP-06 where the rail lives.
```

```yaml
id: JAN-PRPWA-DWP-06
master_wave: PRPWA
master_work_packages: [DS-001:R-10, INV-2, INV-5, R-11(F-2)]
title: "Delegated-leaf assurance projection — condition the rail without claiming our floor for external work"
outcome: "PwaGraphNode carries executionBoundary (resolved); the graph report + §11.7.4 rail represent a DELEGATED_EXTERNAL leaf's assurance as (i) the two deterministic floor limbs we run on the boundary crossing PLUS (ii) 'Reasoning Review: substituted by counterparty attestation (required at Undertaking time)' — NEVER Reasoning Review shown satisfied for external work (INV-2). Delegated-assurance signal lives in SEPARATE report fields; the ValidatePwa gate stays keyed on report.valid (unchanged)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["packages/rph-projections/src/pwa-graph.ts:19-27 PwaGraphNode (+ executionBoundary), :47-61 report", "packages/rph-application/src/handlers/pwa-authoring.ts:532 pwuTypeNodesOf + workbench.ts:258 buildPwaExport (add boundary)", "apps/rph-demo/src/lib/pwaFlow.ts:19-28 PwuTypeNode (+ executionBoundary) + :388,393-394 (isLeaf/floorLabels)", "apps/rph-demo/src/lib/PwuTypeCard.svelte:67-73 rail", "apps/rph-demo/src/routes/pwa/[id]/+page.server.ts:86-108 load() data.types (card-rail source — threaded in DWP-05)"]
  runtime_surfaces: ["graph report projection (PwaGraphNode, 02-only); §11.7.4 card rail (fed by UI load() data.types → PwuTypeNode, depends on 05)"]
dependencies: [JAN-PRPWA-DWP-02, JAN-PRPWA-DWP-05]
required_changes: ["Thread executionBoundary into PwaGraphNode via BOTH builders (graph-report limb, 02-only)", "Card-rail limb: the §11.7.4 card is fed by load() data.types/PwuTypeNode (NOT PwaGraphNode) → needs executionBoundary on PwuTypeNode + load() threading (DWP-05); a card test without it false-greens (every node resolves INTERNAL)", "Condition the rail: delegated node shows 2 deterministic limbs + attestation-substitute for Reasoning Review", "Put delegated-assurance signal in SEPARATE report fields (mirror the `coherent` conservation layer discipline)", "Consume the shared leafKind helper (DWP-02) for leaf-KIND — do NOT re-derive (F-13; INV-1 keeps the sites agreeing)"]
invariants: ["INV-2: never render floor.reasoning-review as applicable/locked/SATISFIED on a delegated node; keep the 2 deterministic limbs", "INV-5: attestation is a counterparty claim, admission checks independent", "P-2/INV-6: ValidatePwa gate on report.valid UNCHANGED"]
prohibited_shortcuts: ["Adding a delegation branch to packages/rph-assurance/src/floor.ts deMinimisFloorPlan / claiming runtime coverage (R-10 runtime DEFERRED)", "Adding a 4th hardcoded floor-label list (derive from the boundary annotation — F-13 hollow-layer)", "Pulling server-only types into pure/browser-safe pwa-graph.ts (F-3)", "Testing INV-2 only on the graph report and not the rendered card (the card false-greens without DWP-05 load threading)"]
tests: ["unit/contract INV-2 (graph report): delegated node's projected assurance does NOT represent Reasoning Review satisfied; shows deterministic limbs + attestation-substitute", "component/e2e INV-2 (RENDERED CARD): the §11.7.4 card rail for a delegated node does NOT show Reasoning Review satisfied — exercised through the load()→data.types→card path, NOT only the graph report (else false-green)", "unit: leafKind derives from the shared helper; all sites agree under INV-1", "regression: existing pwa-graph/report + floor tests green (INTERNAL unchanged)"]
evidence: ["projection snapshot for a delegated leaf shows the conditioned rail; report.valid semantics unchanged for existing PWAs"]
migration_and_compatibility: ["INTERNAL default → existing PWAs/rail unchanged; no floor-plan change; no new tables"]
rollback_and_recovery: ["Revert projection + card edits"]
risks: ["Triplicated floor labels (F-13) — do not deepen divergence", "Whole-PWA floor subject cannot express per-node today — projection-only this wave"]
open_decisions: ["D-F: exact label for the delegated Reasoning-Review slot pre-attestation ('attestation required at Undertaking time' vs 'N/A — delegated') — must not read SATISFIED", "Whether requiredAssurancePolicyIds is also projected onto PwaGraphNode"]
exit_criteria: ["INV-2 contract test green; report.valid unchanged; delegated rail conditioned"]
delivery_state: DELIVERED  # BOTH limbs. Graph-report: PwaGraphNode gains executionBoundary via BOTH builders (pwuTypeNodesOf + buildPwaExport); analyzePwaGraph adds delegatedAssurance[] (SEPARATE field, mirrors `conservation`) + metric delegatedLeaves — valid/coherent UNCHANGED. Card-rail: PwuTypeNode/PwuCardData gain executionBoundary/attestationSubstitute; toPwaFlow conditions floorLabels via the shared leafKind (delegated ⇒ 2 deterministic limbs, DERIVED from ASSURANCE_FLOOR not a 4th list) + attestation substitute; PwuTypeCard renders the substitute row; +page load-adapter threads executionBoundary. Gate: check-types 21/21, lint 0, boundary 0, rph-projections 65 (+3 graph), rph-demo 96 (+2 flow), e2e card INV-2 (delegated rail substitutes RR, shows no RR floor) + INTERNAL-rail regression green.
conformance_state: CONFORMANT  # INV-2 enforced on BOTH the graph report AND the rendered card (the load()→data.types→PwuTypeNode→card path — no false-green). INV-5 untouched. P-2/INV-6: ValidatePwa gate keyed on report.valid, unchanged. leafKind is the SINGLE classifier (F-13) shared by inspector+card+report. D-F RULED: the delegated Reasoning-Review slot reads "…· substituted by counterparty attestation (required at Undertaking time)" — never SATISFIED. requiredAssurancePolicyIds NOT projected onto PwaGraphNode (unneeded; the card rail already shows declared policies from PwuTypeNode). Runtime floor-plan branch stays DEFERRED (R-10 runtime).
```

```yaml
id: JAN-PRPWA-DWP-07
master_wave: PRPWA
master_work_packages: [DS-001:SPEC-5, D-5, PB-2]
title: "Calibration harness — Fixtures A (author-from-intent / ASPLE) + B (bloodwork trio / delegation), scored vs projected oracle"
outcome: "Fixture A and Fixture B exist as replay/contract tests: A drives author-from-intent and diffs against PROJECTED ASPLE (platform omissions are passes, INV-3); B exercises delegation across three boundary placements (STD-1-D/STD-2/STD-3). The calibrate-peel-diff loop is repeatable."
knowledge_status: INFERRED
repository_scope:
  files_or_symbols: ["new apps/rph-demo/e2e/ or packages/*/src/*.test.ts fixtures", "projected-ASPLE oracle artifact (platform-stripped)"]
  runtime_surfaces: ["mock/live authoring path; diff scorer"]
dependencies: [JAN-PRPWA-DWP-01, JAN-PRPWA-DWP-02, JAN-PRPWA-DWP-03, JAN-PRPWA-DWP-04, JAN-PRPWA-DWP-05, JAN-PRPWA-DWP-06]
required_changes: ["Author the projected-ASPLE oracle — a TEST FIXTURE, not a governed R-12 domain template (needs no human activation) — stripping Governed Stream / Historian / Loop Detector / JIT platform leaks", "Fixture A: intent → output, diff vs projected oracle; platform omission = pass (INV-3)", "Fixture B: bloodwork trio delegation cases", "Fixtures A/B on the LIVE path serve as the EP-TST-8 prompt-regression evaluation set (§12) for DWP-01/DWP-04"]
invariants: ["INV-3: projected-ASPLE omissions are correct, never scored as gaps", "No silent caps — communicate what the diff does/doesn't cover"]
prohibited_shortcuts: ["Diffing against raw (unprojected) ASPLE", "Treating a platform omission as a coverage gap"]
tests: ["Fixture A diff passes for a conformant author-from-intent run", "Fixture B: small/med office (delegated analysis), integrated (internal), single-doc (referral leaf) each produce the expected leaf structure"]
evidence: ["Repeatable calibrate-peel-diff run; regression fixture committed"]
migration_and_compatibility: ["Test-only"]
rollback_and_recovery: ["Remove fixtures"]
risks: ["Live-agent nondeterminism — prefer the deterministic mock path for CI; live run as a manual calibration"]
open_decisions: ["Projected-ASPLE oracle format (structured expected-decomposition vs assertion set)"]
exit_criteria: ["Fixtures A + B green on the mock path; projected oracle committed"]
delivery_state: DELIVERED  # rph-projections/calibration.ts: PROJECTED_APLE_ORACLE (platform-peeled: Governed Stream/Historian/Loop Detector/Backpressure/Sandbox/Model-Diversity stripped; content = 6 ASPLE phases + AFU leaf + CACA review) + scoreAgainstOracle (calibrate-peel-diff, reuses the shared leafKind — F-13). Fixture A: conformant scores clean; INV-3 platform OMISSION = pass; platform-authored-as-PWU flagged; missing-area = gap; decomposed-AFU flagged. Fixture B (bloodwork trio): small-office DELEGATED analysis, integrated-hospital INTERNAL non-leaf, referral single DELEGATED leaf — each asserts leafKind + delegatedAssurance (ties DWP-06). Gate: check-types 21/21, lint 0, boundary 0, rph-projections 73 (+8 calibration).
conformance_state: CONFORMANT  # Oracle-format decision RULED → assertion-set (required work-area kinds + expected-leaf kinds + forbidden-platform kinds), robust to mock-plan wording vs a brittle full expected-tree. Deterministic CI path via literal graphs; the SAME scorer is reusable against a live-agent authoring run (the EP-TST-8 prompt-regression evaluation set for DWP-01/DWP-04) — that live path is MANUAL (agent nondeterminism), disclosed here (no silent cap). INV-3 discrimination (platform peeled, omission = pass) is proven both positively and negatively.
```

## 10. Data and persistence changes

**None to the schema.** `executionBoundary` + `boundaryContract` ride the existing `PwuType` object payload (`SCHEMA_VERSION` unchanged). `schemas/objects/PwuType.json` is regenerated (BoundaryContract inlined; no standalone file); `schemas/enums/ExecutionBoundary.json` is emitted. No live-DB migration is required because every writer routes through the handler (`F-5`) which defaults `INTERNAL`; a DB seeded before this change re-validates on read because the field is optional (`§7` decision). Event payloads `PwuTypeDefined`/`PwuTypeRedefined` gain the optional fields via the regenerated message schemas.

## 11. Execution, compatibility, and migration strategy

Land order (authoritative concurrency in §17): **{01 ∥ 02} → 03 → 04 → {05 ∥ 06} → 07** — 01 (prompt) is independent of 02 (contracts foundation); 05 (UI) and 06 (assurance projection) both gate on 02 (and 05 on 03/04). **06's card-rail limb additionally depends on 05** (the §11.7.4 card is fed by the UI `load()` path, not the graph projection — see DWP-06); only 06's graph-report limb is 05-independent. Each DWP: land → gate → commit before the next. `bun run gen` + `bun run format` is mandatory immediately after any vocab edit and before check-types/tests (`F-3`). Rebuild changed package dists before `svelte-check`/e2e. Back-compat is preserved throughout by the `absent = INTERNAL` resolution.

## 12. Assurance, tests, and evidence plan

Per `JAN-ENGC-001 §6.2` ladder + `EP-001`. Coverage by layer (consolidated from the DWP `tests`):
- **Unit** — leaf/boundary classifier; `toTypeView`/`load()` default INTERNAL; enum pre-checks; `readTypeFields` decode+clear.
- **Property/invariant** — INV-1 (delegated ⇒ no children + contract), INV-4a (advisory never fires on delegated — the machine-checkable claim), INV-4b (dismissible heuristic), INV-2 (projection never claims Reasoning Review satisfied for external work).
- **Integration** — `executionBoundary`+`boundaryContract` round-trip command→handler→event→persistence→projection incl. default INTERNAL.
- **Contract** — regenerated `PwuType`/`Define`/`Edit` schemas accept the fields; `enums/objects/messages.test.ts` fidelity (fail→pass = regen signal); Fixture A diff vs projected ASPLE as a contract/replay test.
- **Boundary (C-5)** — malformed/oversized `boundaryContract`, out-of-enum `executionBoundary`, DRAFT/floor attested id → rejected at the write boundary.
- **State-transition** — authoring-turn states unaffected (assert unchanged); if touched, full transition coverage.
- **End-to-end** — author-from-intent yields ≥1 delegated leaf; INV-6 coarse-PWA-still-commits-with-advisory.
- **Replay** — Fixtures A/B as committed regression evidence.
- **Prompt-regression (`EP-001 EP-TST-8/EP-TST-3`, SHALL)** — DWP-01/DWP-04 are material prompt changes; **substring-presence tests are NOT sufficient evidence.** The versioned prompt-regression evaluation set is **Fixtures A/B run on the LIVE path (DWP-07 manual calibration)** across the EP-TST-8 dimensions (structured output · reasoning quality · business decisions · tool selection · consistency). Reasoned deferral (`JAN-ENGC-001 §1.4/§6.2`): the mock CI path (verbatim forwarder, F-10) cannot evaluate reasoning-quality/consistency, so those dimensions are discharged only by the live calibration run — recorded as a deferral, not silently skipped.
- **Observability (SHOULD)** — `leaf.classified`/boundary-crossing decision traces (`EP-001 EP-CMT-5/EP-OBS-2`).
- **Chaos/Production** — N/A for this authoring-time change (recorded per `§6.2`).
- **Static analysis** — SonarQube/SonarLint run + complexity findings fully addressed (`EP-TST-13`).

## 13. Security, authority, and tenant-impact analysis

No new authority surface, no secrets, no tenant boundary crossed. **INV-5/exec≠assurance is the security-relevant invariant:** authoring MUST NOT self-certify assurance; a `boundaryContract` attestation is a counterparty **claim** validated at the write boundary, never treated as verification (C-5). **Pre-existing bypass (F-7):** `requiredAssurancePolicyIds` (and, as planned, `attestedAssurancePolicyIds`) ACTIVE-policy validation lives only in the broker, so a direct non-broker command dispatch can persist arbitrary ids — recorded as `§7` correction candidate / `§15` D-C for a ruling; INV-1 structural validation IS moved to the handler regardless.

## 14. Observability, recovery, and rollback

Every DWP is additive and independently revertible (see each `rollback_and_recovery`). Decision observability (`EP-001 EP-CMT-5/EP-OBS-2`): the leaf/boundary classification and INV-1 rejections SHOULD emit structured evidence (reason code + boundary), and INV-1 rejections MUST be observable (`JAN-ENGC-001 §4.11`, invariant-violation high-severity). No runtime side effects; recovery is git revert of the DWP's files + `bun run gen` for DWP-02.

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **D-C (RULED — sponsor 2026-07-20):** R-10 policy-validation locus → **Option 1 (broker-parity)** bound for this wave (`attestedAssurancePolicyIds` validated in the broker like `requiredAssurancePolicyIds`; structural INV-1/STD-3 + empty-`counterpartyLabel` go to the handler regardless).
- **~~BACKLOG~~ Option 3 — DELIVERED (F-7 CLOSED, sponsor-directed 2026-07-20):** *Assurance-policy-reference validation as a domain invariant.* The handler (`pwa-authoring.ts`) now enforces the ACTIVE/non-floor rule for `requiredAssurancePolicyIds` **and** a delegated node's `boundaryContract.attestedAssurancePolicyIds` at the domain write boundary (C-5) — `checkPolicyRefsOnState` + `assurancePolicyStatuses`, wired into `definePwuType` + `editPwuType`, retaining pre-existing (retain-existing) so an unrelated edit never re-rejects a since-deactivated reference. Floor ids come from the single canonical `FLOOR_POLICY_IDS` (rph-assurance via floor-gate — no 4th list, addressing the `F-13` hollow-layer theme). The broker + SvelteKit action keep their friendly pre-checks (same layered pattern as INV-1). Blast radius verified nil: `seedWorkbench` activates policies before authoring types (and the reference PWA references only `pol_*`, never floor), and every non-handler path already validates. Tests: a DIRECT command now REJECTS floor/DRAFT/missing (both fields) and retains a since-suspended reference. Gate: check-types 21/21, all unit suites (rph-application +6), lint 0, boundary 0, e2e 28/28.
- **Bound (§7):** executionBoundary OPTIONAL/default-INTERNAL; named enum; flattened tool param; counterpartyLabel non-empty.
- **Open (per-DWP):** D-E advisory human surface (DWP-05); D-F delegated Reasoning-Review label (DWP-06); template-keyed advisory arms deferred (DWP-03); define_from_template boundary override (DWP-04).
- **Assumptions:** ASPLE-projection oracle is authorable (DWP-07, INFERRED); mock path is sufficient for CI calibration.
- **Deferrals (inherited):** runtime attestation capture / floor-plan delegation branch; variation layer; Fixture C; `performerMode`; V-model correspondence.
- **Deferred this wave (dispositioned, §2):** SPEC-4 domain template + R-12 authorship rule (no ACTIVE template authored; R-12 not exercised). **Consequent partial SPEC-2 (no silent cap):** DWP-03 ships only the template-independent >1-output advisory arm; the `pwuKind='typicallyDecomposed'` and branch-depth arms are deferred pending SPEC-4/R-12.
- **Divergences from DS-001:** RC-1 (lint after contracts), RC-2 (assurance projection as its own DWP) — route refinements, destination unchanged.
- **Pre-existing debt not deepened:** triplicated floor labels (F-13); the skipped assurance-assignment ValidatePwa limb (`pwa-authoring.ts:576-581`).

## 16. Traceability matrix

| DS-001 authority | DWP | Files (representative) | Tests |
| :--- | :--- | :--- | :--- |
| SPEC-1 / STD-1 / D-3 / D-1a | DWP-01 | system-prompt.ts | system-prompt.test.ts + Fixture A |
| SPEC-3 / STD-2 / STD-3 / R-9 / R-10(auth) / INV-1 | DWP-02 | vocab + gen + pwa-authoring.ts + broker.ts | contract/property/boundary/integration |
| SPEC-2 / INV-4a / INV-4b | DWP-03 | lint.ts + broker PwuTypeView | lint.test.ts |
| SPEC-3(tools) / STD-3 prose | DWP-04 | tools.ts + catalog.ts + system-prompt.ts | tools.test.ts + e2e(mock) |
| WP-C1-e / UI | DWP-05 | +page.svelte + +page.server.ts | e2e + component |
| R-10 / INV-2 / INV-5 | DWP-06 | pwa-graph(.report).ts + pwaFlow.ts + PwuTypeCard.svelte | INV-2 contract |
| SPEC-5 / D-5 | DWP-07 | fixtures + projected oracle | Fixtures A/B |
| SPEC-4 / R-12 (domain template + authorship) | **DEFERRED** (§2/§15) | — (DWP-03's 2 template-keyed advisory arms deferred with it) | — |
| STD-4 / `JAN-ENGC-001` / `JAN-PRPWA-EP-001` (engineering practice) | cross-cutting | §12 assurance + §14 observability + §18 gate | evidence ladder · DoD · SonarQube EP-TST-13 · prompt-regression EP-TST-8 |

## 17. Implementation ordering and concurrency plan

Serial critical path: **02 → 03 → 04 → 05 → 06 → 07**. **01** runs concurrently with 02. 05 and 06 both depend on 02 (and 05 on 03/04); they MAY proceed in parallel after their deps land (different file sets: UI routes vs projections/card), converging at 07. Regen (DWP-02) is a hard barrier — no surface may emit the fields before it. Gate each DWP centrally (`check-types`/`test`/`lint`/`boundary`/`svelte-check`/e2e); never gate inside a sub-agent. **SonarLint on changed files SHOULD run per-DWP** (`EP-001 EP-TST-13`) so complexity is remediated as it lands, not accumulated to the once-per-wave SonarQube disposition (§18). **Shared leaf-KIND helper (anti-F-13):** DWP-02 introduces ONE `leafKind(resolvedExecutionBoundary, isStructuralLeaf)` (delegated ⇔ resolved `DELEGATED_EXTERNAL`; else irreducible-if-leaf); DWP-05 (inspector) and DWP-06 (card + report) both **consume it** — no independent re-derivation, so a node cannot be labelled differently across surfaces.

## 18. Exit criteria and gate package requirements

**Wave complete when** (per `JAN-ROADMAP-001-A §10`): all seven DWPs `delivery_state: DELIVERED` or validly dispositioned; the full gate green (check-types 21/21 · test · lint · boundary · svelte-check · Playwright e2e); the evidence-ladder items (§12) exist; INV-1/INV-2/INV-4a/INV-6 have passing property/contract tests; Fixtures A + B committed; D-C ruled; traceability (§16) reaches code+tests+evidence. **Gate package** (`G-PRPWA`): a gate record capturing per-DWP `conformance_state`, the test/evidence run, `bun run gen` cleanliness proof, the SonarQube findings disposition (`EP-TST-13`), and the readiness determination (§19), modeled on the `JAN-ROADMAP-001-v2 detailed-roadmaps/W{n}/evidence/G{n}-gate-package.md` format.

## 19. Self-critique and readiness determination

Per `JAN-ROADMAP-001-A §3.7`, the adversarial self-critique covers NINE dimensions. It was run 2026-07-20 at SHA `2040ae37` as an independent 3-lens pass (standard-conformance · code-grounding contradiction · sequencing/assurance/security); all three returned **`READY_WITH_CONDITIONS`**. Dimensions and disposition (all conditions reconciled into this v0.2):

1. **Normative coverage** — *resolved*: SPEC-4/R-12 and the consequent partial SPEC-2 delivery were undispositioned → now recorded in §2/§15/§16.
2. **Omitted difficult requirements** — *resolved*: EP-TST-8/EP-TST-3 prompt-regression was unaddressed → now in §12 + DWP-01/04/07 (live Fixtures A/B as the evaluation set; the mock-path limitation recorded as a reasoned deferral).
3. **Legacy behavior preservation** — **N/A**: additive greenfield; `executionBoundary` resolves `absent = INTERNAL`; every existing type/seed/plan is behavior-identical (§5/§10).
4. **Semantic-authority risks** — *live, controlled*: the hollow-governed-layer hazard (F-13 — triplicated floor labels; INV-5 mis-attribution) is bounded — DWP-06 must not add a 4th floor-label list and derives delegated-rail semantics from the boundary annotation; ValidatePwa stays keyed on `report.valid`; D-C escalated.
5. **Assurance/evidence gaps** — *resolved*: `counterpartyLabel` non-empty had no enforcement locus (gen emits bare `z.string()`) → moved to a handler write-boundary check (§7/DWP-02); every invariant (INV-1/2/4a/4b/6) now has a named validator.
6. **Security/permissions** — *controlled*: INV-5 preserved (attestation is a claim, never self-cert); D-C escalated, not silently scoped.
7. **Data migration/recovery** — **N/A**: no schema/table change (§10); each DWP independently revertible (§14).
8. **Over-engineering / unnecessary abstractions** — *resolved*: a 4th independent leaf-KIND derivation (DWP-05 inspector vs DWP-06 card) → collapsed to ONE shared `leafKind` helper both consume (§17/DWP-05/06); nothing the spec defers is built (runtime floor-plan branch stays deferred).
9. **Contradictions with code/corpus** — *resolved*: the DWP-06 card-rail dependency (card fed by UI `load()`, not the projection → DWP-06 now depends on DWP-05); the edit DELEGATED→INTERNAL contract-strip; and two miscited parentheticals (piecemeal-gen fallback types; bare `floor.ts`) → corrected.

**Readiness determination: `WAVE COMPLETE` (2026-07-20).** All self-critique conditions reconciled into v0.2.0 and honored through delivery. DWP-01…07 all landed → gated → committed under `JAN-ROADMAP-001-A §8` execution autonomy; each commit records its own gate evidence, and the dimensions above held in practice — notably (4) DWP-06 added NO 4th floor-label list (delegated-rail labels are DERIVED from `ASSURANCE_FLOOR`) and (8) the single shared `leafKind` helper is consumed by the inspector, the card rail, AND the graph report + calibration scorer (F-13 satisfied at four sites). Final full-tree gate: check-types 21/21, all unit suites green, lint 0, boundary 0, Playwright e2e 28/28.

**Delegated-authority gate record (this wave), per `JAN-ROADMAP-001` autonomous-gate authority — commits are the sponsor authorization; decisions recorded here for end-of-wave review:**
- **G-01…G-07** — each DWP's gate PASSED on the evidence in its `delivery_state`/`conformance_state` and commit message; no fabricated passes.
- **Sub-decisions ruled under delegated authority** (all disclosed, none silently narrowed — PB-3): **RC-4** the delegated-leaf END-TO-END e2e moved DWP-04→DWP-05 (needs the form control); **D-E** the under-decomposition advisory's human read is served by the agent surface (review_composition); **D-F** the delegated Reasoning-Review slot reads "substituted by counterparty attestation (required at Undertaking time)", never SATISFIED; **oracle-format** assertion-set over a brittle expected-tree.
- **Option 3 — DELIVERED (F-7 CLOSED, sponsor-directed post-wave 2026-07-20):** all assurance-policy-reference validation (`requiredAssurancePolicyIds` + `attestedAssurancePolicyIds`) is now enforced at the domain handler write boundary (`checkPolicyRefsOnState`), closing the broker/UI-only bypass. Blast radius verified nil (seed activates policies before authoring types; reference PWA references only `pol_*`); retain-existing + canonical floor ids (no 4th list). Gate: all suites + lint + boundary + e2e 28/28. See §15.

*End of JAN-PRPWA-DR-001 v0.2.0 — wave complete.*
