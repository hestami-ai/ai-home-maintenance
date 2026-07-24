# Extract: RPH-DOC-009 Persistence, Migration, Dual-Run, and Cutover Design

Source: `docs/Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Persistence, Migration, Dual-Run, and Cutover Design.md`
Note: spec document, not a transcript — no HUMAN/ASSISTANT tags apply and no sponsor turns occur, so there are no SPONSOR-RULINGS items.
Citation filename shortened to `RPH-DOC-009.md` for readability.
Coverage note: the assigned window was L1-1500, but the mandated shadow-comparison divergence taxonomy sits at L2425-2433; §§26-45 (authority modes, dual-authority prevention, divergence taxonomy, recovery, rollback, final rule) were read in targeted slices to honor the extraction focus. L1-1500 is largely DDL; meaning-level rules were extracted, schemas ceded to the repository.

## CONSTITUTIONAL CANDIDATES

- "At every migration stage, exactly one representation may be authoritative for professional semantic state." (RPH-DOC-009.md L41-43) — The central migration rule: single semantic authority at all times; everything else in the document enforces it.
- "The legacy `workflow_state` and legacy phase enum may remain available for compatibility, display, and fallback. They must not remain an independently writable semantic state machine after the RPH becomes authoritative." (RPH-DOC-009.md L45) — Compatibility survival is permitted; independent writability is not — the precise boundary of legacy afterlife.
- "That contradiction cannot be solved by selecting whichever value is more convenient. The architecture must define: which state is authoritative; which state is derived; when legacy writes stop; how existing legacy dialogues are handled; how fallback works without reintroducing dual authority." (RPH-DOC-009.md L86-94) — Convenience-picking between contradictory states is constitutionally barred; authority must be designed, not chosen ad hoc.
- "Accepted semantic changes produce immutable domain events." (RPH-DOC-009.md L116) — Append-only history is the persistence constitution's second pillar after single authority.
- "Current aggregate tables answer: What is authoritative now? Domain events and version tables answer: How did it become authoritative?" (RPH-DOC-009.md L130-138) — The now/became dichotomy — current state and history are distinct questions with distinct stores.
- "They may be: rebuilt; delayed; optimized; denormalized; independently versioned. They must not become authoritative write targets." (RPH-DOC-009.md L144-152) — Read projections are disposable by definition; authority never leaks into derived views.
- "Canonical state must not be mutated through unrestricted CRUD from the UI or orchestration code. Writes occur through: authenticated commands; invariant enforcement; aggregate mutation; domain events." (RPH-DOC-009.md L176-183) — All write paths are command-driven; no back door to canonical state.
- "An authoritative baseline is immutable through application policy and database permissions." (RPH-DOC-009.md L1251) — Baseline immutability is enforced at two independent layers, not by convention.
- "One legacy dialogue may have only one authority mode at a time." (RPH-DOC-009.md L2318) — The single-authority rule made concrete per dialogue: authority modes are exclusive.
- "The migration succeeds only when Janumi Professional Workbench can answer, from durable authoritative data: What did the user ask for? ... Who exercised authority? ... Why did the system proceed, stop, reshape, or reject? A legacy phase label cannot answer those questions." (RPH-DOC-009.md L2973-2991) — The Final Persistence Rule: success is defined as answerable professional accountability, not schema completion.
- "Core semantic relationships must not exist only inside opaque JSON." (RPH-DOC-009.md L112) — Relational canonicality: meaning-bearing links must be queryable and constrainable, never buried in blobs.

## DOCTRINE-CONOP

- "`LEGACY`; `SHADOW_RPH`; `RPH`; `LEGACY_COMPLETING`; `ARCHIVED_LEGACY`." (RPH-DOC-009.md L2275-2281) — The five authority modes; each dialogue's semantic sovereignty is one of exactly these.
- "SHADOW_RPH: legacy authoritative; RPH builds shadow semantic state; differences measured; no RPH side effects. ... RPH: RPH authoritative; the legacy compatibility phase is derived; all semantic writes occur through RPH commands." (RPH-DOC-009.md L2293-2304) — The two pivotal modes: shadow = measurement with hard no-side-effects; RPH = legacy becomes projection.
- "RPH command → RPH state transition → execution adapter call → RPH result ingestion → compatibility phase projection. Not: Legacy phase mutation → later copy to RPH" (RPH-DOC-009.md L1957-1970) — The required write direction under pilot authority; copy-later is expressly forbidden as dual authority.
- "Only one component may calculate compatibility phase: Compatibility Projection Handler. No other service may independently derive and persist it." (RPH-DOC-009.md L2346-2352) — Single-writer code ownership for the derived phase; derivation itself has one authority.
- "A rule change rebuilds the legacy compatibility phase projection but does not change semantic state." (RPH-DOC-009.md L2395) — Derivation rules are versioned and re-runnable; changing how you summarize never changes what happened.
- "A generic pass/fail cannot automatically become satisfied assurance unless the policy criteria can be reconstructed." (RPH-DOC-009.md L2175) — Migration cannot launder criterion-less legacy validator verdicts into assurance.
- "A legacy approved flag becomes an effective Decision only if migration can identify: actor; subject; subject version or stable artifact; decision type; timestamp. Otherwise it is provenance-only and migration may require reapproval." (RPH-DOC-009.md L2179-2187) — Authority without identity is not authority; unattributable approvals demand re-decision.
- "It does not become an authoritative Baseline. It may be included as a Baseline item only when a separate acceptance decision and its authority can be reconstructed." (RPH-DOC-009.md L2197) — A legacy commit is an artifact plus provenance; baselines require governed acceptance.
- "Do not restore legacy semantic authority globally. ... Once the platform depends on RPH-only semantics such as independent assurance and baselines, global rollback to legacy phases would lose meaning." (RPH-DOC-009.md L2677-2686) — Post-cutover rollback is semantically impossible, not just discouraged — legacy cannot represent RPH-only meaning.
- "The `COMMIT` label remains a legacy compatibility milestone. Its derivation may summarize independently modeled repository-operation and baseline-governance state; neither implies the other." (RPH-DOC-009.md L2391) — Repository operation and baseline governance are orthogonal; a commit never implies acceptance.
- "A later PWA publication does not silently alter an existing Undertaking." (RPH-DOC-009.md L443) — Version-binding immutability: published PWA versions never retroactively change bound work.

## SEMANTIC-INVARIANTS

- "`revision` is used for optimistic concurrency. `semantic_version` identifies meaning-bearing changes." (RPH-DOC-009.md L254-256) — Concurrency counting and meaning counting are distinct axes; conflating them corrupts both.
- "The service determines whether a command is semantic. ... The semantic-change decision should be explicit in command handlers and covered by tests." (RPH-DOC-009.md L2523-2545) — Semantic-versus-mechanical is a deliberate, tested per-command judgment (objective/boundary/obligation changes yes; retries, canvas moves, formatting no).
- "Canonical professional objects are not hard deleted after they have participated in: execution; assurance; governance; baselines; traceability." (RPH-DOC-009.md L260-266) — Participation confers permanence; lifecycle statuses (SUPERSEDED, WITHDRAWN, ABANDONED, REVOKED) replace deletion.
- "Evidence and baseline artifact content should be immutable. Corrections create: new artifact; new semantic version; supersession link." (RPH-DOC-009.md L1541-1547) — Correction-by-supersession, never mutation, for anything assurance or baselines depend on.
- "canonical commands never validate against projections alone." (RPH-DOC-009.md L1701) — Derived views can inform but never authorize; validation reads canonical state.

## PROTOCOL-PRACTICE

- "Classification values: `EQUIVALENT`; `RPH_STRONGER`; `LEGACY_BEHAVIOR_MISSING`; `ACCIDENTAL_LEGACY_BEHAVIOR`; `SEMANTIC_CONFLICT`; `IMPLEMENTATION_DEFECT`; `UNRESOLVED`." (RPH-DOC-009.md L2425-2433) — The shadow-comparison divergence taxonomy, verbatim; seeds the divergence protocol — every measured difference gets exactly one of these meanings.
- "unresolved divergence accepted explicitly." (RPH-DOC-009.md L2012) — Stage 4 exit criterion: `UNRESOLVED` is never silently carried past cutover; it must be explicitly accepted.
- "On restart, classify each nonterminal attempt: definitely not started; running with observable external ID; succeeded but result not recorded; failed; completion uncertain. ... Never blindly retry an uncertain side effect. The controller first performs reconciliation." (RPH-DOC-009.md L2622-2640) — Recovery meaning: restart is classification-then-reconciliation, never optimistic retry of external effects.
- "Restore canonical database → restore artifact storage → verify event sequence → replay outbox → rebuild projections → reconcile active execution attempts → resume controllers" (RPH-DOC-009.md L2604-2612) — The recovery ordering: canonical first, derived rebuilt, effects reconciled, only then resume.
- "A canonical command transaction must atomically: 1. lock or revision-check the aggregate; 2. validate invariants; 3. update current aggregate tables; 4. append domain events; 5. append object-version rows; 6. append outbox rows; 7. append command receipt result." (RPH-DOC-009.md L1359-1369) — The seven-step atomic write: state, history, outbox, and receipt succeed or fail together.
- "If affected rows equal zero: RPH_REVISION_CONFLICT. The command must not silently retry using stale business assumptions." (RPH-DOC-009.md L2505-2511) — Optimistic-concurrency loss means reload-and-re-decide, never silent replay.
- "revoke ordinary application write permission to legacy phase-state columns; permit only migration/fallback service role where necessary; add database trigger or audit to detect unauthorized writes." (RPH-DOC-009.md L2030-2032) — Dual-authority prevention is enforced in the database itself, with alerting on violation, not just in code.

## OPEN-QUESTIONS-CONTRADICTIONS

- "Events are not the only storage of current state in the initial implementation." (RPH-DOC-009.md L128) vs "Although events are authoritative history, state-history tables support efficient operational queries." (RPH-DOC-009.md L1453) — Not a true contradiction (§3.3 resolves via now/became split), but "authoritative" is used for both current tables and events; canon should fix one word per role.
