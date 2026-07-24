# Post-JAN-CMDPRE Backlog

*Captured 2026-07-24 at sponsor direction ("add all three to the backlog and sequence as you think best"), after
JAN-CMDPRE reached SERIES COMPLETE (all ten DWP-00…09 DELIVERED) and passed its post-build adversarial review.
Three follow-ups: one born from the review, two are the register's own remaining work items (RESIDUALS R6, R5).*

**Standing practice for each item:** design note → implementation roadmap → implementation (never straight to
code). Nothing here is a live defect — JAN-CMDPRE is complete and verified; these are the *next* increments of
value, sequenced below with rationale. Each is re-scoped against the tree at its own start.

---

## Recommended sequence: BL-1 → BL-2 → BL-3

**Why this order.** BL-1 is *discovery* — it could surface defects of higher priority than the two known items,
so it runs first (find the unknowns before polishing the knowns), while the review tooling from the CMDPRE pass
is warm and it directly answers the sponsor's stated concern. BL-2 is a *bounded, well-understood closure* of the
CMDPRE program itself, low-risk, and can be informed by anything BL-1 turns up on the PWU-lifecycle surface. BL-3
is the *largest* build and the least urgent (the DWP-09 audit already ran and found zero), and its value is
**gated on evidence** — if BL-1 shows stored contradictions actually occur, BL-3 rises; if not, it stays a
capability nicety. **BL-1's findings may reprioritize BL-2/BL-3** (a live defect it finds jumps ahead of both).

---

## BL-1 — Adversarial review sweep of the surfaces built outside ultracode

- **Source:** the JAN-CMDPRE post-build review (`CMDPRE-post-build-adversarial-review-2026-07-24.md`) empirically
  confirmed the sponsor's hypothesis — the confirmed defects clustered in the execution-plan/**step** family,
  exactly the surface implemented outside the per-DWP adversarial reviews. That family got a review only where
  the CMDPRE lenses happened to reach it.
- **Scope (to be bounded first, with the sponsor):** the *rest* of **JAN-EXECPLAN** — the plan-level and
  step-level handlers not touched by CMDPRE, the branch/first-match selection, the DR-004 transition-grammar /
  flow interpreter — plus any **other** surface the sponsor recalls building without ultracode (candidates from
  memory: PWA Designer render/authoring, the ASPLE calibration fixture, PWA authoring recovery). Step 1 of BL-1
  is a short scoping pass that names the surfaces; the sponsor holds knowledge here I cannot fully derive.
- **Method:** reuse the proven CMDPRE review harness — code-truth map → adversarial lenses (bypass, over/under-
  refusal, mutation-coverage/anti-vacuity, kernel/state-machine fidelity, refusal-code, doc-fidelity) → independent
  refutation of every finding → completeness critic. Read-only agents; live mutation red-proofs performed by the
  reconciling engineer. (The script is at `scratchpad/cmdpre-review.mjs`; generalize its CONTEXT to the new surface.)
- **Value:** HIGH. Directly addresses the stated concern; the CMDPRE pass proved this discipline finds real
  defects (2 MAJOR anti-vacuity gaps + 1 machine inconsistency) in precisely these surfaces. **Effort:** medium–high
  (review + reconciling whatever it finds). **Risk:** low (discovery is read-only; fixes gated on confirmed findings).
- **Deliverable:** a review report per surface + reconciled fixes with the full gate green, mirroring the CMDPRE pass.

## BL-2 — RESIDUALS R6 / F-6: PWU-lifecycle precondition uniformity

- **Source:** RESIDUALS.md **R6** + SPEC-001 §5.4 (fork F-6). The six `advancePwuLifecycle` commands
  (`BeginPwuShaping`, `MarkPwuReady`, `ChallengePwu`, `ReshapePwu`, `InvalidatePwu`, `SupersedePwu`) advance a
  status axis but carry **no** `precondition` field — `advancePwuLifecycle` is the third write primitive,
  independent of `advanceStatus`, so the DWP-06 compiler-mandatory INV-1 does not reach them.
- **Not a live defect:** a same-state re-issue is *already* refused today (via `canAdvanceWorkLifecycle` →
  `canTransition`, which excludes the NOOP) and returns the correct `RPH_ILLEGAL_STATE_TRANSITION`. R6 is a
  **mechanism-uniformity** gap: these sites satisfy INV-1 only by an incidental guard (GUARD_ONLY_ACCIDENTAL),
  with a documented wrong-code risk if that guard is ever changed, and they lack an application-layer re-issue
  kill test.
- **Design question (design-first):** migrate `advancePwuLifecycle` to carry a mandatory `precondition` parameter
  enforced ahead of its guard (mirroring what DWP-01b/06 did for `advanceStatus`), then author the six
  `fromStates(...)` sets from the PWU.workLifecycleState machine's in-arrows — **or** rule that the existing
  `canTransition` guard is a sufficient, declared equivalent and instead add the missing kill tests + an explicit
  classification. Either way, close the "wrong-code-if-guard-changes" risk and add the kill tests.
- **Value:** medium (uniformity + regression-proofing, not a live fix). **Effort:** low–medium (6 commands, the
  exact DWP pattern; the primitive change is small but touches the third write path — care warranted). **Risk:** low.
- **Sequenced after BL-1** so any PWU-lifecycle issue the sweep surfaces folds in here.

## BL-3 — RESIDUALS R5: live projection-level contradiction surfacing

- **Source:** RESIDUALS.md **R5**. The DWP-09 audit is a point-in-time script, not a live projection; §2.1 now
  scopes its "contradiction-free" conclusion to the three shapes the census actually scans and enumerates four it
  is structurally blind to (two different mutually-exclusive terminal events on one aggregate; a terminal
  aggregate later receiving a non-self event; non-monotonic `aggregateRevision`; a cross-aggregate stale
  reference — e.g. a REVOKED Decision still named by an AUTHORITATIVE Baseline).
- **Design question (design-first):** a rebuildable projection that scans the event log for the four unscanned
  shapes and surfaces any stored contradiction (read-model flag + UI), turning the one-off audit into continuous
  coverage. Decide the detection set, where it lives (a `coherent`-style proof layer vs. a standalone projection),
  and how it reports without gating the write path.
- **Value:** medium, **evidence-gated:** rises materially if BL-1's sweep shows stored contradictions actually
  occur; stays a capability nicety if not (the current seed has zero). **Effort:** high (new projection +
  detection + surfacing). **Risk:** medium (new capability, but read-only over the log).
- **Sequenced last** — largest, least urgent, and its priority is set by BL-1's findings.

---

*Each item is design-first and re-scoped at its own start. BL-1's report may re-order BL-2/BL-3. Cross-refs:
`RESIDUALS.md` (R5, R6), `CMDPRE-post-build-adversarial-review-2026-07-24.md`, `JAN-CMDPRE-SPEC-001` §5.4/§7 (F-6),
`JAN-CMDPRE-DR-001` §16/§18.*
