# Extract: RPH Canonical Domain Model (doc002), lines 1251-2418

Slice character: authored specification text, not a chat transcript — no HUMAN/ASSISTANT turns and therefore no sponsor rulings in this range. Covers §21-§43: step/runtime/governance/baseline/trace invariants, event and command semantics, concurrency, invalidation, required properties, failure taxonomy, controller contract, litmus tests, and the closing architecture rule. Wire shapes (interfaces, enums, table lists, command names) are demoted per brief; only load-bearing semantic rules are extracted. Filename abbreviated below as "RPH Canonical Domain Model.md".

## CONSTITUTIONAL CANDIDATES

- "The minimum viable Recursive Professional Harness is not the smallest system that can execute a configurable series of AI steps. It is the smallest system that can: represent user intent; structure that intent into bounded professional obligations; preserve those obligations through decomposition... and justify promotion of the resulting work into an authoritative baseline." (RPH Canonical Domain Model.md L2404-2416) — The closing architecture rule: the constitutional definition of what RPH minimally is.
- "If the answer to any of these is no, the implementation is collapsing architectural concerns that the RPH requires to remain distinct." (RPH Canonical Domain Model.md L2398) — The ten litmus tests (L2387-2396) are a constitutional acceptance gate against concern-collapse.
- "Commands express requested state changes. Events record accepted state changes." (RPH Canonical Domain Model.md L1654-1656) — The foundational request/acceptance asymmetry underlying the whole event model.
- "ExecutionState = SUCCEEDED must not automatically imply AssuranceState = SATISFIED" (RPH Canonical Domain Model.md L2099-2111) — Required tested property; the exec≠assurance separation (INV-5) stated as a machine-checkable law.
- "Step success does not imply PWU success." (RPH Canonical Domain Model.md L1298) — Same independence axiom at step granularity: mechanical completion never confers professional satisfaction.
- "Human override must not erase prior assurance findings." (RPH Canonical Domain Model.md L1387) — Authority can supersede but never rewrite the assurance record; findings are indelible.
- "An agent may recommend a decision but cannot exercise authority unless delegated." (RPH Canonical Domain Model.md L1391) — The human/AI authority boundary: recommendation and authority are distinct powers.
- "An authoritative baseline is immutable. Changes create a successor baseline." (RPH Canonical Domain Model.md L1428-1429) — Authoritative state is append-only; change means supersession, never mutation.
- "Baseline promotion is a governance event, not an execution step." (RPH Canonical Domain Model.md L1435) — Promotion belongs to the authority plane; no execution plan can promote.
- "Repository commit and baseline are related but not synonymous. A commit may exist without baseline promotion." (RPH Canonical Domain Model.md L1433-1434) — Code landing ≠ work being authoritatively accepted; two distinct events.

## DOCTRINE-CONOP

- "The runtime should use domain events for all material changes." (RPH Canonical Domain Model.md L1488) — Event-sourced doctrine: material change without an event is illegitimate.
- "The first implementation should expose commands and queries rather than unrestricted CRUD." (RPH Canonical Domain Model.md L2003) — API doctrine: every mutation passes through semantically named commands so invariants can gate it.
- "The migration adapter may expose legacy phase-compatible labels, but these labels cannot remain authoritative state." (RPH Canonical Domain Model.md L1807) — Legacy Product Lens phases are a compatibility view only; canonical objects hold authority (mapping table L1793-1805).
- "Invalidation is a first-class operation. ... Automatic invalidation must be conservative where consequences are high." (RPH Canonical Domain Model.md L1738, L1785) — Reacting to falsified premises is core domain behavior; automation errs toward flagging review on high-consequence objects.
- "Every control action must record: triggering condition; evidence or observations considered; policy authorizing the action; actor; affected objects; expected outcome." (RPH Canonical Domain Model.md L2233-2240) — Controller decisions are themselves governed, evidenced, policy-authorized records; each failure class maps to permitted control actions (L2203).

## SEMANTIC-INVARIANTS

- "A skipped mandatory step requires an authorized plan revision or waiver." (RPH Canonical Domain Model.md L1299) — Mandatory work cannot be quietly skipped; skipping is a governed act.
- "Every tool or model invocation must produce provenance. External outputs are untrusted until parsed and validated." (RPH Canonical Domain Model.md L1300-1301) — Twin execution laws: nothing external is trusted raw, and every invocation is traceable.
- "Requested capability is not granted capability. Capability scope must be explicit. Secret access must never be inferred from tool availability. ... Privilege expansion requires a new authorization event. Revoked bindings cannot be used for new attempts. Model output is treated as untrusted external input." (RPH Canonical Domain Model.md L1335-1341) — Runtime authorization laws: no implicit privilege, event-gated expansion, terminal revocation, models outside the trust boundary.
- "Approval requires authority. Waiver requires scope, rationale, duration, and affected objects." (RPH Canonical Domain Model.md L1385-1386) — Governance acts have mandatory structure; an unbounded or unreasoned waiver is invalid.
- "A decision cannot retroactively change evidence. Revocation triggers impact analysis." (RPH Canonical Domain Model.md L1388-1389) — Evidence is immune to authority; withdrawing authority propagates consequences.
- "Open blocking observations prevent promotion unless waived. Promotion evidence must be retained." (RPH Canonical Domain Model.md L1430-1431) — Baseline gate: blockers stop promotion; the justification for promotion is itself durable evidence.
- "Trace links are directed and typed. ... `SUPPORTS` must originate from Evidence or Assessment and target a Claim. `VERIFIES` must originate from an Assessment. ... Trace links cannot be silently rewritten. Invalidated source objects may invalidate downstream trace claims." (RPH Canonical Domain Model.md L1476-1482) — Traceability is semantic, tamper-evident, and invalidation-propagating; endpoint-type rules encode the assurance epistemology (only evidence supports, only assessments verify).
- "No command handler may directly update read-model tables without generating the corresponding domain event." (RPH Canonical Domain Model.md L1693) — No side-door writes; the event stream is the only path to state change.
- "On conflict: reject the command; reload current state; require re-evaluation; never silently overwrite." (RPH Canonical Domain Model.md L1703-1708) — Optimistic-concurrency law: conflicting intent must be re-formed against current reality.
- "Agent retries must not duplicate: commits; external API mutations; baseline promotion; approval decisions; evidence records." (RPH Canonical Domain Model.md L1716-1722) — Idempotency invariant naming the five duplication-catastrophic effect classes.
- "Their outputs cannot be recomposed until: required children reach acceptable states; shared dependencies are resolved; conflicts are assessed." (RPH Canonical Domain Model.md L1728-1732) — Recomposition gating: parallel child outcomes merge only after state, dependency, and conflict checks.
- "Parent mandatory obligations = allocated + retained + satisfied + authorized waivers" (RPH Canonical Domain Model.md L2117-2124) — Obligation conservation law: decomposition may move obligations but never lose them.
- "Every mandatory applicable constraint must remain traceable after decomposition." (RPH Canonical Domain Model.md L2128) — Constraint conservation: no constraint silently drops across the decomposition boundary.
- "If evidence becomes invalidated, every dependent supported claim must become contested, under review, or invalidated." (RPH Canonical Domain Model.md L2132) — Epistemic integrity: satisfaction cannot rest on dead evidence.
- "A baseline cannot become authoritative without an effective promotion decision. ... No new step may begin under a superseded Execution Plan." (RPH Canonical Domain Model.md L2136-2140) — Authority and currency gates: no unauthorized baselines, no execution under stale plans.
- "Every material assumption emitted by an agent must become an Assumption Object before dependent work reaches `READY`." (RPH Canonical Domain Model.md L2144) — No hidden material assumption: agent assumptions must be reified before dependent readiness.
- "Canvas layout operations must never increment semantic version." (RPH Canonical Domain Model.md L2148) — Presentation/semantics firewall: visual arrangement is meaning-inert by law (cf. Runtime Binding revision ≠ PWU semantic version, L1338).

## PROTOCOL-PRACTICE

- "Every command handler must: authenticate actor; authorize requested operation; load aggregate; check expected revision; validate preconditions; enforce invariants; produce one or more domain events; persist events atomically..." (RPH Canonical Domain Model.md L1680-1691) — The canonical ten-step command-handling sequence every mutation must follow.
- "Can execution succeed while assurance fails? ... Can a human override be identified without erasing the original finding? Can the system explain whether it is blocked because of work shape, execution, assurance, governance, or infrastructure?" (RPH Canonical Domain Model.md L2389-2396) — Litmus-test practice: pre-acceptance interrogation of any implementation design against concern separation.

## OPEN-QUESTIONS-CONTRADICTIONS

- Scenario 4 says "assurance state becomes `WAIVED` or conditionally satisfied" (RPH Canonical Domain Model.md L2316) while the required property at L2132 forces claims on invalidated evidence to contested/under-review/invalidated — the document does not state whether a waiver may bridge an invalidated-evidence gap or only open observations; the waiver-vs-epistemic-invalidation interaction is unresolved in this slice.
