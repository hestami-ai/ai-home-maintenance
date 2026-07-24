# Extract: Persistence, Migration, Dual-Run, and Cutover Design (part B, L1501-2993)

Source: `Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Persistence, Migration, Dual-Run, and Cutover Design.md`
Note: this is a specification document, not a chat transcript — no [HUMAN]/[ASSISTANT] tags apply; no sponsor rulings appear in this range.

## CONSTITUTIONAL CANDIDATES

- "RPH and legacy cannot both write authoritative semantic state." (Persistence Design.md L2929) — Conformance test #1; the single-authority axiom the whole migration design defends.
- "One legacy dialogue may have only one authority mode at a time." (Persistence Design.md L2318) — Authority is exclusive and explicit per dialogue; forbids ambiguous or mixed authority.
- "Only one component may calculate compatibility phase: Compatibility Projection Handler ... No other service may independently derive and persist it." (Persistence Design.md L2346-2352) — Single-writer code ownership for the derived legacy phase; kills parallel derivations.
- "A generic pass/fail cannot automatically become satisfied assurance unless the policy criteria can be reconstructed." (Persistence Design.md L2175) — Migration cannot launder criteria-less legacy results into satisfied assurance.
- "A legacy approved flag becomes an effective Decision only if migration can identify: actor; subject; subject version or stable artifact; decision type; timestamp. Otherwise it is provenance-only and migration may require reapproval." (Persistence Design.md L2179-2187) — Authority without identity is not authority; unidentifiable approvals demand reapproval.
- "It does not become an authoritative Baseline. It may be included as a Baseline item only when a separate acceptance decision and its authority can be reconstructed." (Persistence Design.md L2197) — A legacy repository commit never confers baseline authority by itself.
- "RPH command → RPH state transition → execution adapter call → RPH result ingestion → compatibility phase projection. Not: Legacy phase mutation → later copy to RPH" (Persistence Design.md L1957-1970) — Once RPH is authoritative, writes flow forward from RPH; copy-back is constitutionally banned.
- "Do not restore legacy semantic authority globally. ... Once the platform depends on RPH-only semantics such as independent assurance and baselines, global rollback to legacy phases would lose meaning." (Persistence Design.md L2677-2686) — Post-cutover rollback is incident recovery, never authority reversion; cutover is semantically one-way.
- "Never blindly retry an uncertain side effect. The controller first performs reconciliation." (Persistence Design.md L2638-2641) — Restart discipline: reconcile-before-retry for externally-effectful execution attempts.
- "A legacy phase label cannot answer those questions. The RPH persistence model exists to make those answers durable, queryable, auditable, and operationally enforceable." (Persistence Design.md L2991-2993) — Final rule: migration success = ability to answer the fifteen professional-accountability questions from durable data.
- "They cannot drive execution or governance." (Persistence Design.md L1897) — Shadow RPH records (authority_mode = SHADOW) are measurement-only; shadow state never gains agency.

## DOCTRINE-CONOP

- "No migration SQL should be finalized from names in this document alone." (Persistence Design.md L1739) — Legacy schema labels are conceptual placeholders; code inspection precedes migration commitment.
- Each legacy record classified as one of: "Canonical migration source ... Provenance-only source ... Compatibility source ... Accidental implementation state ... Untrusted or ambiguous source" (Persistence Design.md L1743-1798) — Five-way migration triage; not everything legacy is professional semantics.
- "pass/fail result without criteria; assumption text without source or impact; approval flag without authority identity; artifact without version identity." (Persistence Design.md L1794-1797) — What makes a legacy record untrusted: missing criteria, provenance, authority, or version identity.
- "The legacy dialogue itself is not the root professional object; the concrete professional work is the Undertaking and its Professional Work Graph." (Persistence Design.md L2129) — Dialogue = interaction/provenance/Intent origin, never the semantic root.
- "It does not become PWU lifecycle directly." (Persistence Design.md L2139) — Legacy phase maps to compatibility milestone/grouping/migration hint only; phase ≠ lifecycle.
- "The legacy orchestrator may be used internally as an execution adapter, but it cannot independently mutate semantic legacy phase state." (Persistence Design.md L1953) — Pilot-stage demotion: legacy code survives as adapter, never as authority.
- "Do not force mid-operation migration without tested state mapping." (Persistence Design.md L2082) — Late-stage active dialogues finish under legacy, migrate at a controlled milestone, or get a limited bridge.
- "unresolved divergence accepted explicitly." (Persistence Design.md L2012) — Stage-4 exit: divergence may remain, but only by explicit acceptance, never silence.
- "rollback no longer requires restoring legacy phase authority." (Persistence Design.md L2114) — Stage-7 retirement exit criterion; independence from legacy authority defines done.
- "The `COMMIT` label remains a legacy compatibility milestone. Its derivation may summarize independently modeled repository-operation and baseline-governance state; neither implies the other." (Persistence Design.md L2391) — Repository commit and baseline governance are orthogonal; the legacy label conflated them.
- "A rule change rebuilds the legacy compatibility phase projection but does not change semantic state." (Persistence Design.md L2395) — Derivation rules are versioned; changing how phase is derived never mutates canonical meaning.
- "Do not update several aggregates in one broad transaction merely to simulate Execution Workflow atomicity." (Persistence Design.md L2455) — Cross-aggregate flows use events, sagas, compensation; each step independently durable.
- "canonical commands never validate against projections alone." (Persistence Design.md L1701) — Projections are derived reads; command legality is judged against canonical state.
- "Projection tables do not need independent authoritative backups if rebuild is proven." (Persistence Design.md L2614) — Rebuildability, not backup, is the durability guarantee for derived state.
- "Prefer retaining: content hash; parsed result; provenance; bounded diagnostic excerpt; rather than all raw context indefinitely." (Persistence Design.md L2567-2574) — Raw model output retention doctrine: keep the accountable core, not the whole context.
- "Retain while any active or historical claim, assessment, decision, or baseline depends on it." (Persistence Design.md L2578) — Evidence retention is dependency-driven, not time-driven.
- "Corrections create: new artifact; new semantic version; supersession link." (Persistence Design.md L1543-1547) — Evidence/baseline content is immutable; correction-by-supersession only.
- "Each numbered domain change is command-driven and event-backed." (Persistence Design.md L2921) — The vertical-slice sequence's governing rule: no semantic write outside command+event.

## VOCABULARY

- "`authority_mode` values: `LEGACY`; `SHADOW_RPH`; `RPH`; `LEGACY_COMPLETING`; `ARCHIVED_LEGACY`." (Persistence Design.md L2275-2281) — The five exclusive authority modes; the migration's central state vocabulary.
- "Classification values: `EQUIVALENT`; `RPH_STRONGER`; `LEGACY_BEHAVIOR_MISSING`; `ACCIDENTAL_LEGACY_BEHAVIOR`; `SEMANTIC_CONFLICT`; `IMPLEMENTATION_DEFECT`; `UNRESOLVED`." (Persistence Design.md L2425-2433) — Shadow-comparison divergence taxonomy; notably admits RPH may be stronger or legacy behavior accidental.

## SEMANTIC-INVARIANTS

- "If affected rows equal zero: RPH_REVISION_CONFLICT. The command must not silently retry using stale business assumptions." (Persistence Design.md L2505-2511) — Optimistic concurrency: conflicts surface to the caller; no silent stale retry.
- "The semantic-change decision should be explicit in command handlers and covered by tests." (Persistence Design.md L2545) — Semantic-version increments (objective, boundary, constraint, decomposition changes) vs non-semantic (retry, canvas move, formatting) is a tested, explicit rule.
- "zero duplicate governance decisions; zero duplicate baseline promotions; zero silent constraint-loss incidents" (Persistence Design.md L2711-2713) — Cutover thresholds are zero-tolerance on duplicated authority and dropped constraints.
- "Legacy shadow conversion does not trigger external side effects." (Persistence Design.md L2931) — Shadow mode is side-effect-free by conformance test, not just convention.
- "human decisions are version-bound" (Persistence Design.md L2701) — Cutover precondition: no decision floats free of the exact subject version it approved.
- "Baselines bind exact object versions and hashes." (Persistence Design.md L2937) — Conformance test #9; baseline identity is version+hash exact, migration included.
- "Every migrated object retains a legacy-source mapping." (Persistence Design.md L2933) with "Duplicate migration batches do not duplicate RPH objects." (L2932) — Migration is traceable and idempotent by test.

## PROTOCOL-PRACTICE

- Seven-stage migration ladder: Stage 0 discovery → 1 schema introduction → 2 shadow projection → 3 dual execution pilot → 4 shadow at scale → 5 RPH default → 6 existing-dialogue treatment → 7 legacy retirement; legacy stays authoritative through Stage 2. (Persistence Design.md L1801-2115) — Authority transfers only per-cohort, gated by explicit exit criteria each stage.
- "revoke ordinary application write permission to legacy phase-state columns; permit only migration/fallback service role where necessary; add database trigger or audit to detect unauthorized writes." (Persistence Design.md L2030-2032) — Dual-authority prevention is enforced at the database, not just in application code.
- Recommended roles: "`rph_runtime` ... may not: rewrite event history; directly alter authoritative baselines; directly update legacy phase fields" and "`rph_projection` ... may not: mutate canonical semantic tables." (Persistence Design.md L2778-2802) — Role separation mirrors the write-path doctrine: runtime, projection, migration, audit each capability-bounded.
- Recovery ordering: "Restore canonical database → restore artifact storage → verify event sequence → replay outbox → rebuild projections → reconcile active execution attempts → resume controllers" (Persistence Design.md L2604-2612) — Canonical-first recovery; controllers resume only after reconciliation.
- Pilot rollback procedure: "1. suspend new commands; 2. reconcile active execution attempts; 3. create rollback snapshot; 4. convert current RPH state to legacy-compatible milestone; 5. mark the legacy dialogue LEGACY_COMPLETING; 6. resume under legacy; 7. preserve RPH audit state." (Persistence Design.md L2667-2673) — Rollback is audited and eligibility-gated ("no irreversible RPH-only semantic action", L2660), never a data wipe.
- "Alert on: unauthorized legacy phase write; ... stale assessment used for current semantic version; ... orphaned legacy mapping." (Persistence Design.md L2759-2770) — Migration integrity is actively monitored; authority violations are alertable events.
- Within one aggregate command: "lock or compare revision; validate; update state; write version snapshot; append event; write outbox; write command receipt. One database transaction." (Persistence Design.md L2441-2451) — The atomic unit of semantic change; receipt, event, and outbox never diverge from state.

## OPEN-QUESTIONS-CONTRADICTIONS

- "The following labels are conceptual placeholders until code inspection confirms the actual schema" (Persistence Design.md L1725) — Open: the entire legacy inventory (§21) is unverified against real code; every mapping in §24 is contingent on that inspection.
