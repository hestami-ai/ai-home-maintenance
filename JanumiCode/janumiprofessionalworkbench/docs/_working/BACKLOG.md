# JPWB Backlog

Standing open-work list, seeded 2026-08-20 from a register sweep (REG-F-100..196) plus staleness
findings made while attempting REG-F-120. **Rule inherited from the register: every item here is a
HYPOTHESIS about the tree until re-verified at pickup time** — two of the four items checked on
2026-08-17 were already stale when read, and the SonarQube campaign (58ddb228..172c5c18) has since
rewritten 136 files, so age everything below accordingly.

Retire items by STRIKING in place (`~~item~~` + disposition + commit), never by deleting.

## Actionable now

### REG-F-201 residue — the type-blind class is CLOSED for externally-supplied ids; two follow-ons

- [x] ~~**The general form of residue (1)**~~ — **AUDITED AND CLOSED 2026-08-20 (REG-F-201).** Two more
  exploitable sites, both fixed: `/pwa/[id]` (fabricated DRAFT unlocked the authoring surface; a
  guessable non-ULID policy id, `/pwa/floor.reasoning-review`, rendered as a draft PWA) and
  `PwaAuthoringBroker.getPwa()`, whose `?? 'DRAFT'` INVERTED the agent endpoint's lifecycle guard —
  it refused the legitimate PUBLISHED PWA and admitted every non-PWA. Six mutants KILLED; 74 e2e green.
### ✅ LANDED — the de minimis floor is unconditional in code (REG-F-202, 2026-08-20)

- [x] ~~**RESIDUE: make the non-discharge AUDIBLE at the demo surface.**~~ — **LANDED 2026-08-20.** Full detail in
  REG-F-202. Kept here for the two REVERSALS, which are the reusable part:
  - **I "proved" the affordance could never succeed, and the proof was a SEARCH.** Driving `recordWaiver` returned
    `"Nothing to waive: the floor is not blocking."` on a panel reading REJECTED (the panel renders a staged
    CANDIDATE's floor; the action reads CANONICAL), and all three seeds held ZERO non-SATISFIED canonical floor
    assessments — so I deleted the action, the form and the census row. **Wrong.** A refuter named
    `test-api/dispatch`: the assessment lifecycle is ordinary ratified commands on the same bus, and re-driving it
    got `Request`/`Begin`/`RecordObservation` all ACCEPTED and `recordWaiver` SUCCEEDING
    (`decisions: ['WAIVER/EFFECTIVE']`). My population was "the three seeds"; the real one was "the command bus".
  - **The remedy recorded in this file was RIGHT and its stated REASON was FALSE** — "the engine will refuse it"
    (it does not; the ROUTE ACTION did, and had since before ASR-3). Acting on the reason would have deleted a
    working ratified affordance. Always re-derive a recorded remedy's MECHANISM, not just its instruction.
  - **The sweep found four ENGINE refusal messages still offering a waiver as the way out** — including PublishPwa's,
    which is the demo's verbatim answer to "why can't I publish?" and formed a LOOP (record the waiver, retry, same
    refusal). d24c19ec changed what the gate DOES and never read what the gate SAYS.

- [ ] **NEW, from the same sweep: the demo can author ONLY the waiver kind that no longer does anything.**
  Its single `RequestWaiver` path (`pwa/[id]/+page.server.ts` `recordWaiver`) derives `waivedPolicyId` from the
  blocking FLOOR policy, so every waiver the workbench can mint is a floor waiver — and under ASR-3 a floor waiver
  discharges nothing. A NON-floor waiver, the kind that still legitimately discharges, cannot be authored anywhere
  in the surface. `decisions/+page.server.ts` deliberately does not offer one (ProposeDecision cannot carry DOC-004
  §12.2's WaiverDetail) and points at the floor panel as THE authoring path — which is now precisely the wrong
  place. Design-first: this is a missing capability, not a stale string, and building it is not residue.

### ✅ LANDED — original item, kept for its measurements

- [ ] **REG-F-202: the de minimis floor must never be skippable — remove floor-waiver discharge.**
  **THE QUESTION IS SETTLED; this is execution, not design.** ASR-3 (JPWB-DOC-003:249, ratified) —
  *"The de minimis assurance floor is UNCONDITIONAL. Risk proportionality governs assurance above a
  mandatory floor; it never makes the floor optional."* `waiverDischargesFloorPolicy`
  (`handlers/floor-gate.ts`) is an UNRATIFIED EXTRAPOLATION: the general §8.15/§12.2 waiver mechanism
  applied to the three REQUIRED floor policies, which canon exempts from that relief. RPH-GOV-005
  anchors on ASR-14 and governs how a waiver BEHAVES — it never granted a waiver reach over the floor.
  **⚠ DESIGNED, DRIVEN AND MEASURED 2026-08-20 — then REVERTED deliberately, unfinished rather than rushed.**
  The change was applied end-to-end in a working tree, the red was proven, the breakage was measured, and the
  tree was returned to green because half-removing an enforcement site is the one way to make this worse. Nothing
  below is a hypothesis; every number was observed.
  - **THE RED, MEASURED.** Added beside the existing control in `floor-waiver-scope.test.ts`: a waiver perfect in
    every scope dimension (exact policy, criterion, object, version; EFFECTIVE; unexpired) must NOT discharge.
    Failed as predicted — *"ASR-3: the floor is UNCONDITIONAL — a waiver may not discharge it: expected
    'ACCEPTED' to be 'REJECTED'"*. After the change it passed and the OLD control failed: the pair IS the
    inversion, and writing both makes the change visible instead of described.
  - **THE EDIT.** `floorGateBlock` stops consulting the discharge filter, and the apparatus goes with it —
    `openFindingCodes`, `FloorWaiver`, `effectiveFloorWaivers`, `waiverDischargesFloorPolicy`, plus the
    `waiverCovers`/`waiverStillDischarges` import and `FloorRecord.assessmentId`. **The deletion is TOTAL, not
    scoped, and that is forced:** `floorGateBlock` iterates only `FLOOR_POLICY_IDS_REQUIRED` and
    `waiverDischargesFloorPolicy` had exactly ONE call site inside it, so "do not consult it for those three" IS
    "do not consult it at all". Leaving it fails lint (`no-unused-vars`); `check-types` will NOT catch it (the
    base tsconfig sets neither `noUnusedLocals` nor `noUnusedParameters`).
  - **THE BREAKAGE, MEASURED: 5 of 1,067 tests**, every one asserting the pre-ruling behaviour —
    `floor-waiver-scope.test.ts` (the old control), `pwa-authoring.test.ts:916`,
    `execution-detail.test.ts:383` (⚠ the floor blocks EXECUTION STEP completion too, not only PWA publish —
    the change is broader than "publishing" and that is correct under ASR-3),
    `decision-kind-guard.test.ts:273`, and `execrem-wp16-enforcement-observed.test.ts` (the RPH-GOV-005 probe).
  - **THE ONE JUDGMENT CALL, with its answer.** RPH-GOV-005's register row is ENFORCED and its probe map is TOTAL
    over the ENFORCED rows, so the row cannot simply be orphaned. It does NOT need re-classifying: the rule keeps
    a live enforcement site at `waiver-authorization.ts:54` (`resolveWaiverAuthorization`, reached in production
    from `pwu.ts:1529`, refusing on decisionType/object/version and naming RPH-GOV-005 in its own refusal text).
    **Re-aim the probe there.** The accurate narrowing is neither "reach narrows" nor "reach becomes empty":
    RPH-GOV-005 loses its DISCHARGE site and keeps its AUTHORIZATION site.
  - **DO NOT also refuse at `RequestWaiver`.** Considered and rejected as over-refusal: ASR-14 (*"a waiver
    accepts risk; it never rewrites truth"*) describes exactly a recorded acceptance that changes no outcome. The
    ruling narrows a waiver's REACH, not its RECORDABILITY. What must not recur is a recorded waiver silently
    moving a gate — so make the non-discharge AUDIBLE at the surface instead.
  - **`floor-waiver-scope.test.ts` does not simply break — 3 of its 4 tests go VACUOUS**, asserting a REJECTED
    publish that becomes the unconditional answer. Its own header records that it passed for months in exactly
    that state (REG-F-015). Deleting it silently retires a ratified rule; keeping it leaves three tests that
    cannot fail. Re-aim: the kernel test `rph-domain/governance.test.ts:86-89` already exercises all three
    conjuncts non-vacuously, so delete the command-layer duplicates **with a header recording why the
    command-layer site vanished**.

  **⚠⚠ SECOND ATTEMPT, 2026-08-20: FOUR OF THE FIVE RE-AIMS ARE DONE AND PROVEN; ONE PIECE BLOCKS, AND IT IS
  ITS OWN INCREMENT.** Applied again, driven again, reverted again — but this time the remainder is a single
  named artifact rather than "the rest of the work". Everything below was OBSERVED, not planned.
  - **DONE AND GREEN when applied** (902 of 904 → 903 of 904 as each landed): `floor-waiver-scope.test.ts`
    re-aimed to ASR-3 + a control that can still publish (a SATISFIED floor — the ONLY arrangement that still
    publishes, therefore the only control available); `pwa-authoring.test.ts` inverted;
    `execution-detail.test.ts` inverted AND renamed; `decision-kind-guard.test.ts` inverted with its subject
    preserved (the ApproveDecision refusal still holds; only the CONSEQUENCE changed).
  - **THE ONE BLOCKER: the RPH-GOV-005 probe in `execrem-wp16-enforcement-observed.test.ts:1633`.** It cannot be
    minimally patched, and the file itself explains why at `:1623`: **RPH-GOV-005 was enforced INVERSELY** — no
    handler ever refused "this waiver is out of scope"; the FLOOR GATE refused, because the waiver failed to
    discharge. Deleting discharge deletes that inverse enforcement entirely. The probe's REFUSED arm still
    refuses (same code, same marker — the floor still blocks), but its CONTROL arm can never publish again, and
    re-arranging the control to publish via a SATISFIED floor would make the two arms differ by "floor satisfied
    or not" instead of by waiver scope — **a vacuous probe, which is the REG-F-015 defect this whole file
    exists to prevent.** So the probe must MOVE, not be patched.
  - **WHERE IT MOVES, and this is the good news: to a DIRECT refusal, which is stronger than the inverse one.**
    `resolveWaiverAuthorization` (`waiver-authorization.ts:54`, reached from `pwu.ts:1529`) refuses IN ITS OWN
    VOICE on decisionType (`:84`, "requires decisionType=WAIVER"), object (`:99`, "does not name") and version
    pin (`:110`). Re-aim the probe at the DECISION-TYPE or OBJECT limb — both are dispatchable through the bus.
    ⚠ **NOT the version limb:** `waiver-authority.test.ts:220-226` records that the pins are derived at PROPOSAL
    time and no command in reach moves the version between proposal and waive, so a bus-level version
    arrangement would be a control that cannot fail. That file drives it at the resolver instead, and says so.
  - **The register row moves with it:** `enforcedAt` (currently naming the deleted `waiverDischargesFloorPolicy`
    and `effectiveFloorWaivers`), `refusalMarker` (currently the floor's "the de minimis assurance floor is not
    SATISFIED for PWA" — becomes the authorization refusal's own text), and `declaredMutations` (the version
    conjunct now bites at the authorization path). The row stays **ENFORCED**; it does not need re-classifying.
  - **Helpers already in the probe file** for the new arrangement: `proposePwuAgainstIntent` (`:701`),
    `captureIntent` (`:727`), and the `dispatch`/`ok` pair. A decision arrangement to model on is at `:513`.

  **Work, in order:**
  1. RED FIRST — a floor waiver that discharges today must stop discharging. Controls both ways: a
     NON-floor waiver must still discharge, and a SATISFIED floor must still pass.
  2. `floorGateBlock` stops consulting the discharge path for `FLOOR_POLICY_IDS_REQUIRED`.
  3. **Record RPH-GOV-005's NARROWED REACH** — the rule is NOT retired (it still governs waivers over
     non-floor policies); leaving the narrowing implicit is how an enforcement site half-vanishes.
  4. Withdraw the demo's `recordWaiver` affordance on a blocking floor — the engine will refuse it, so
     the surface must stop offering it rather than offer-and-fail.
  5. Mutants, one victim each, including one for the control (a gate that refused EVERY waiver would
     pass the main test while breaking non-floor waivers).
  ⚠ Blast radius, derived: 10 files reference the discharge path (`floor-gate.ts`, `governance.ts`,
  `execution.ts`, `pwa-authoring.ts`, `skip-authorization.ts`, `enforcement-register.ts`,
  `floor-waiver-scope.test.ts`, `pwa-publish-stale-floor.test.ts`, `floor-gate.test.ts`,
  `__tests__/floor-fixtures.ts`) plus `apps/rph-demo/e2e/assurance-floor.e2e.ts`.
  ⚠ `floor-waiver-scope.test.ts` exists to prove the SCOPING of a mechanism that will no longer reach
  the floor — it must be re-aimed at non-floor waivers, not deleted.
  ⚠ THE LESSON THAT CAME WITH THE RULING, worth re-reading before starting: the discharge machinery is
  criterion-exact, version-exact, expiry-aware and fail-closed — and all of that precision is EVIDENCE
  OF THE PROBLEM, not mitigation. Rigor went into making floor waivers precise, none into asking
  whether they should exist. A carefully-specified exception to an unconditional rule reads as MORE
  legitimate than a sloppy one, which is exactly how it survived a ratified scope rule, a dedicated
  test suite, a REG-F-015 repair, and my own review an hour before the ruling.

- [ ] ~~**REG-F-202: the waiver gate is switched off by silence**~~ — **SUPERSEDED by the ruling above.**
  Retained for its evidence: `governance.ts:548-549` gates the only enforcement of §36.4 behind
  `waiverRules.length > 0` and no production policy declares them. **Now second-order** — it governs a
  path that should not exist for the three required floor policies. Re-file for NON-floor policies once
  the floor path is removed; that is where §36.4 still binds. Originally: DESIGN-FIRST, and the remedy shape
  is already named by precedent. `governance.ts:548-549` gates the ONLY enforcement of DOC-004 §12.2 /
  JCPWA §36.4 (*"a waiver may never drop a control to nothing"*) behind `waiverRules.length > 0`, and
  **no production policy declares `waiverRules`** — so it is enforced nowhere, and the demo drives a
  waiver against the BLOCKING floor policy with `compensatingControls: []`.
  `assurance.ts:1874-1888` fixed the identical shape and named the class it left behind: *"a policy
  field that defaults to 'no constraint' is a gate switched off by silence"*. **Remedy = UNION a floor
  in, not `??`.** ⚠ Turns on a canon question this cannot settle: does §36.4 bind a waiver against a
  FLOOR policy, and what is the minimum compensating control when the policy declares no rules?
  ⚠ **UNVERIFIED LIMB** — that the granted waiver then discharges the floor and permits publication.
  Drive it before relying on it.
- [x] ~~**REG-F-202 (b): align Gate B with its own file-mate**~~ — **DONE 2026-08-20**, and it needed a test
  before it needed a fix. Gate B collapsed ABSENT and EMPTY `permittedControlActions` into one skip, so a policy
  declaring an explicit `[]` — permitting NO control action — admitted every recommendation; its file-mate
  `rejectRemediationActionsNotPermitted` had already ruled the same question the other way and DOCUMENTED the
  reason (*"collapsing `[]` into 'unconstrained' would fail OPEN"*). ⚠ **The empty-set arm had no test because it
  was not EXPRESSIBLE:** the suite's `createPolicy` helper hard-coded `permittedControlActions: ['CONTINUE']`, so
  the one arrangement that separates fail-open from fail-closed could not be built. Parameterising the helper was
  the actual unblock. Predicted red observed — *"expected 'ACCEPTED' to be 'REJECTED'"* — then the one-line
  alignment; 138 files / 1,526 tests green. Mutant `MU-F202B-gate-b-collapses-absent-and-empty-again` guards it,
  and its anchor must carry the comment line above the guard: both code lines are BYTE-IDENTICAL in the file-mate
  twenty lines up, so either alone reports UNANCHORED.
- [ ] **Fix the workflow-script bug that silenced three refuters** — a backticked method call inside a
  backtick template literal closed the template early, so ALL THREE adversarial reviewers failed to
  launch, the lane results came back empty, and the synthesis agent re-derived the sweep alone and
  UNREFUTED. The failure WAS reported in the task result, but the roster it produced read as complete.
  ⚠ The standing lesson is not "escape backticks": it is that **a sweep must show its refuter lane
  actually ran before any of its findings are trusted** — hand-verification promptly downgraded one of
  its three "exploitable" findings.
- [ ] **A STANDING GATE for the type-blind class** — design-first. The audit closed the known sites;
  nothing stops the next one. A gate would have to identify reads whose id ORIGINATES EXTERNALLY
  (URL param, form field, query string) and reaches `getObject`/`loadObject` without a type
  assertion. ⚠ State its limits: it cannot see an id laundered through a variable, nor judge whether
  a downstream guard is genuine — the inverted guard at the agent endpoint LOOKED like one.
- [x] ~~**`?? 'DRAFT'` is a pattern, not two instances**~~ — **SWEPT TWICE 2026-08-20, and THE SECOND SWEEP
  REFUTED THREE OF MY OWN FIVE.** ⚠ I filed five sites here as "each refuter-confirmed". That was wrong, and the
  reason is worth more than the finding: **the first sweep's refuters attacked the TEXT** (is the quoted default
  really there, is it really the permissive value?) **and never attacked REACHABILITY or STAKE.** A second pass
  that asked "can absence actually arrive, and does anything downstream behave differently?" — with a separate
  agent attacking each proposed REMEDY rather than each finding — killed three. **A refuter only refutes the
  question you gave it.**
  - **REFUTED — `validators.ts:238` `severity ?? 'MATERIAL'`.** I called this the most serious of the five because
    it sits on the assurance floor. It is **FAIL-CLOSED**, and the investigator DROVE it rather than reading it:
    mandatory-ness comes from the POLICY criterion (`severityIfNotMet`), not from the observation's severity, so
    with `severityIfNotMet=BLOCKING` an ABSENT severity still yields `disposition=REJECTED`. The field is **inert
    at the gate** for exactly the criteria that gate. My "a BLOCKING finding downgraded to MATERIAL would let the
    floor pass" was the claim I should have driven before filing.
  - **REFUTED — `workbench.ts:414` `publicationStatus ?? 'DRAFT'`.** Not reachable. `publicationStatus` is
    **required** on `ProfessionalWorkArchitectureSchema` (`objects.ts:717`, not `.optional()`), and both
    production callers prove PWA-ness one frame up via `getObjectOfType`. It is NOT the "un-repaired third
    instance" of the REG-F-201 pair — the ids do not originate externally. Dead fallback, not a hole.
  - **REFUTED — `agent/index.ts:30` `pwa?.publicationStatus ?? 'DRAFT'`.** Not reachable: the route already 404s
    at `agent/+server.ts:280-282` using the SAME `broker.getPwa()`, one frame above the only call site. By the
    time the factory runs, the PWA has resolved.
  - **SURVIVED (both) — `decomposition.ts:647` / `:648`.** Genuinely FAIL_OPEN, and confirmed by a live PASSING
    test: `recomposition.test.ts:164` completes with a payload carrying nothing but the claim id and reaches
    **COMPOSABLE / parentSatisfied: true**. ⚠ **BUT THEY ARE ALREADY FILED — see REG-F-041 (OPEN) and
    `enforcement-register.ts:831-836` (RPH-EVD-001, `UNENFORCED_DISCLOSED`, `OBSERVED_ADMISSION`).** I ran a
    ten-agent sweep to re-find a disclosed item. **GREP THE REGISTER FIRST.** What IS new is below.

- [ ] **REG-F-041 IS UNBLOCKED, and nobody noticed because the blocker dissolved in a different entry.**
  Its **Merge target** reads *"…none of which change until **REG-E-028** rules"*, and REG-E-028 was
  **WITHDRAWN THE SAME DAY IT WAS FILED** (register:1407) — *"it is not a sponsor question, because the ratified
  corpus answers it"* — superseded by REG-F-042/043/044. **The recorded reason for inaction points at a question
  that no longer exists.** Verified by hand, both entries read in full.
  What survives is the SEPARABLE interim ask REG-F-041 states itself: making the three payload fields
  **REQUIRED**, *"the `GrantWaiver.effectiveAt` and `parentCompletionClaimId` medicine"* — explicitly available
  *"without any ratification"* since the shapes are AUTHORED. Its two recorded costs stand and are the whole of
  the remaining decision: it **refuses every existing caller**, and the vocab note declaring composable-by-default
  (`m3-commands-events.json:1960`, *"Defaults to true (preserves prior composable-by-default…)"*) is an authored
  decision that *"deserves an explicit reversal rather than a quiet one."*
  ⚠ **DESIGNED 2026-08-21 — `docs/_working/DESIGN-recomposition-judgement.md`. The design DECLINES this act as the
  next increment and re-sequences the work.** The cost objection is void (ZERO production callers; test edits
  only), but the act ranks 3rd of 3 on two of three lenses and **retains no record of the judgement it compels**.
  The reordering is the point: `COMPOSABLE` has NO consumer, while `RECOMPOSING -> RECOMPOSED` is driven-ACCEPTED
  with nothing cited (`verif/recomposition-ungoverned.test.ts`, REG-F-085). Work order is now:
  - [x] ~~**S-0 — refuse an empty composition.**~~ — **LANDED 2026-08-21.** `proposeRecomposition` refuses a
    contract naming no required children; red observed first, two mutants (opposite polarities on one line, the
    second defending the control). The discriminating control was re-arranged onto a child made acceptable by a
    real GRANTED waiver — WAIVED rather than SATISFIED, because the assurance axis moves while workLifecycle
    stays PROPOSED. ⚠ Along the way REG-F-015's guard caught that the suite's `propose()` helper had dispatched
    and DISCARDED its results for as long as it existed, and `verif/` caught two register-gate violations in my
    own preceding two commits — both docs-only, both committed without running the doc gates. **Run `verif/`
    before committing register prose; `git diff --stat` is not a check.**
  - [ ] **S-1 — ⚠ SPONSOR-BLOCKED. ESCALATED 2026-08-21, NOT BUILT.** REG-F-085 (`JPWB-REG-005:2481-2487`,
    Status OPEN — *contract Decision owed*) forbids **both** routes by name: requiring `SATISFIED` ships a command
    that can never fire, and accepting `COMPOSABLE` *"silently weakens a ratified guard … precisely the
    APPROVAL-for-decision substitution class already open as REG-F-076."* It states the fork is *"THE CANON
    QUESTION A BUILD AGENT MAY NOT ANSWER"* — (a) a missing acceptance act (new work) vs (b) `completeRecomposition`
    on the wrong arrow (a defect) — *"These have different authorities"* — and that the sequencing is *"a contract
    Decision, not a build one."* ⚠ My own design doc wrote S-1 as buildable because I read the PIN's header
    instead of the register entry it points at. See DESIGN-recomposition-judgement.md for the corrected §4 and for
    the blast-radius findings worth keeping (pwu-replay fold, event-surface-census, the unperformable-arrow trap).
  - [ ] **S-2 — then strengthen the verdict** (RAC + four named grafts, in the design).
  - S-3 — the other eight DEC-6 checks are a capability, not a fix (REG-F-042). Out of scope.

- [x] ~~**W-3 finding (i): the §34.5 query roster**~~ — **CLOSED 2026-08-20, REG-F-199, in both halves.**
  (a) THE INSTRUMENT: the walk matched unanchored SUBSTRINGS, so `getPwu` read as present inside
  `getPwuTemplate` — the sole positive result in the population it was commissioned to measure. The
  roster is **14 of 14** name-absent, not 13, and this bullet's own named survivor
  (`getAssuranceStatus`-adjacent) was in the ABSENT column all along. Fixed:
  `scripts/tracker/match.ts` + `verif/tracker-name-match.test.ts` +
  `MU-TRACKER-01-boundary-check-always-passes` (KILLED). Blast radius DERIVED over all 118
  consumer-walk items: one tier, two witness citations.
  (b) THE DELTA INVESTIGATION (5 lanes, investigate → adversarially refute, 15 subjects):
  **0 ABSENT · 2 EQUIVALENT · 13 PARTIAL.** No ratified capability is missing outright, so nothing
  from this roster may be filed as a bare gap. **§34.5 is an early, non-exhaustive enumeration, not a
  by-name contract** (REG-F-083 ratifies §34 as a MINIMUM surface and records its own omissions; the
  section supplies no signatures) — **§32.x/§29.x are the contract, and that is where the deltas
  are.** Per-subject roster: `census/f199-query-delta.ndjson`, gated in `tracker-ingest.test.ts`.

### REG-F-199 residue — the deltas the investigation found (each verified by a refuter; re-verify at pickup)

- [x] ~~**(1) `getObject` is the "unrestricted CRUD" read §34's own preamble forbids**~~ — **FIXED
  2026-08-20** by a typed seam, `getObjectOfType(handle, objectType, id)`, adopted at the Undertaking
  Workbench loader. It asserts a discriminator the system already maintains (`newEnvelope` writes
  `objectType`; the write side has gated on it all along at `handlers/pwu.ts:163,:192`), and takes the
  CONTRACT union rather than `string`, so a typo is a compile error and not a permanent `undefined`.
  `getObject` stays with a warning at its docblock — its other 14 call sites read INTERNAL ids (object
  state, module constants), which is not this defect. Two mutants, one victim each, opposite polarity:
  one reverts the loader, one makes the seam refuse everything so the CONTROL is what reddens.
  ⚠ **OWED, and the reason is recorded in the commit:** `csaa:inventory` regeneration and the two
  mutant RUNS were both deferred because a concurrent audit had scratch files in the tree — the
  inventory would have baked another session's scratch into the baseline, and a dirty tree scores
  ABORTED_DIRTY and voids every mutant verdict. `bun run build` must precede `bun run mutants` here.
  ⚠ **THE GENERAL FORM IS OPEN:** this fixed ONE loader. An audit of every production path where an
  externally-supplied id reaches a type-blind read is running; its roster decides where the seam is
  adopted next. Do not assume this class is closed because one instance is.
- [x] ~~**(1) THE ORIGINAL BULLET, kept for its evidence** — `getObject` is type-blind~~
  (`queries.ts:214`), stands in for four ratified typed queries, and no call site asserts the
  discriminator. Live consequence, **DRIVEN 2026-08-20 and worse than recorded** — the loader was executed against a
  PWA id and did NOT throw: it returned `undertaking.name = "Product Realization"`, the PWA's own
  name, because every downstream read is scoped and degrades to empty (`u.pwaId` is absent, so the
  PWA lookup becomes `getObject(engine, 'undefined')`, and `listPwus` filters to `[]`). **The page
  does not even look broken.** Only a NON-EXISTENT id 404s. Design ready (a `getObjectOfType` seam;
  the discriminator was measured present on 130/130 seeded aggregates). Originally: `/undertakings/<any-object-id>` renders a PWU, Baseline
  or Decision **as an Undertaking** instead of 404-ing (the loader's only guard is existence,
  `+page.server.ts:250`; `objectType` appears zero times in it). The discriminator IS in materialized
  state and IS checked — on the WRITE side only (`pwu.ts:192`). ⚠ This is the one limb of §34 that
  binds on substance rather than by name.
- [x] ~~**(2) half A — the OPEN-observation filter in `professional-work-graph.ts`**~~ — **FIXED
  2026-08-20.** It now reads each observation's CURRENT disposition from the store and FAILS CLOSED
  (diverging from all three assurance gates, which fail open — deliberate: its output is a green
  node). Red constructed at the seam by decorating `loadObject`, because the defect is unobservable
  end to end; `MU-F199-2-graph-reads-recording-event-disposition` KILLED. Two hand-maintained
  enumerations re-pointed in the same commit (`observation-command-surface.test.ts`'s tripwire
  message, and the ledger's "both retire together" → 2 of 3).
- [ ] **(2) half B — `work-projection.ts:14/:124`: NOT fixable there, and this bullet's original
  framing was WRONG.** ⚠ Do not attempt the same fix: `workProjector` has ZERO production consumers
  (`enforcement-register.ts:2314` already records this), and `Projector.apply(view, event)` takes no
  handle by ratified contract (RPH-PER-009) — a projector reaching the store would break rebuild
  determinism. Decisively: `work-projection.test.ts:193-215` already drives a synthetic REMEDIATED
  event through the fold and asserts `{}`, so **no red is available there at any layer**. The honest
  remedy is authoring the missing `WaiveAssuranceObservation` command + event + fold, which carries
  governance questions — a work package, not a fix. Re-filed as a named consumer of the
  `verif/observation-command-surface.test.ts` tripwire, which now names all three dead read branches.
- [ ] ~~**(2) The OPEN-observation filter is tautological in two read models**~~ —
  `professional-work-graph.ts:100` and `work-projection.ts:113-135` test the RECORDING EVENT's
  `disposition`, hard-coded `'OPEN'` at `assurance.ts:2386`, so a WAIVED or REMEDIATED finding would
  still suppress a green node (DOC-004 §38 limb 2). Every GATE does it correctly, loading current
  state (`assurance.ts:2076-2077` says so in terms) — an intra-repo divergence on one fact.
  ⚠ CAVEAT THAT MUST TRAVEL WITH IT: `RecordAssuranceObservation` is the only observation command and
  no command transitions `disposition`, so today every observation IS open and the defect is
  **unobservable at runtime** — it must be judged from the code, and a probe would wrongly clear it.
- [x] ~~**(3) `getPwuHierarchy` returns a SUPERSET of the hierarchy**~~ — **FIXED 2026-08-20**, and
  the OBVIOUS fix was wrong: keying on the contract's status being INVALID is defeated by one
  accepted `ReviseDecomposition` (INVALID is an in-arrow to SUPERSEDED, `decomposition.ts:491`, and
  the contract can never be re-validated), which resurrects the withdrawn edge. Keys on the
  `DecompositionRejected` EVENT instead — a log cannot be walked back. Four tests, and the fourth
  (ESCAPE) is what chooses between the designs; `MU-F199-3` KILLED. ⚠ The TOMBSTONE half is NOT
  done and should be filed separately, not folded in: hiding an ABANDONED node would delete the
  `workLifecycleState` the view exists to display and force `listPwus` to change too — a
  ratification act, not a repair (the REG-F-102 pattern).
- [ ] ~~**(3) `getPwuHierarchy` returns a SUPERSET of the hierarchy**~~ — `professional-work-graph.ts:45-50`
  emits parent→child edges on `DecompositionProposed` alone and never consults the contract's later
  status, so a decomposition validated INVALID (`DecompositionRejected`, a real dispatchable outcome)
  keeps its edges in the graph forever. Also no tombstone filter on nodes, where `listPwas`/`listPwuTypes`
  both have one.
- [ ] **(4) DEF-W4-002 is a FALSE-NEGATIVE deferral, live in four documents** — `G4-gate-package.md:14,:43`,
  `JAN-W4-DR-001:21`, `PROGRAM-STATUS.md:47` all say the Execution Workbench drill-down is deferred; it
  is **built** (JAN-EXECPLAN DWP-01..05, DR-004 DWP-06, JAN-EXECREM). Correct the records, and record the
  genuine residue instead: **the authoring half**. All 19 Undertaking-Workbench form actions were
  enumerated and none authors a plan; the only `ProposeExecutionPlan` path mints a hard-coded single
  TRANSFORMATION step with all four policy bags as empty literals, then auto-approves and activates.
  `ApplyTacticalChange` — a ratified §34.3 command with a real handler — has zero occurrences under `apps/`.
- [ ] **(5) The successor-version gap (the driven half of the headline)** — once PUBLISHED a `pwaId`'s
  `version` is frozen forever (`EditPwa` refuses outside DRAFT; the publication machine has no arrow
  back), so `PwaVersionReference`'s one-pwaId-many-versions addressing has no representation and
  Ref-Demo §19 L741's "changes create a successor version" is unimplementable. ⚠ The *other* half of that
  finding — "RPH-CON-009's version limb is a control that cannot fail" — was **REFUTED by driving it**;
  `packages/rph-application/src/handlers/pwa-version-binding.test.ts` shows the guard firing and
  discriminating. Do not re-file the dead-control claim.
- [ ] **(6) The ratified REL-4 traceability chain breaks at two named hops** — `TraceLinkType`
  (`traceability-view.ts:12-20`) has no PRODUCES/artifact member and `linksFor` has no `ArtifactRecorded`
  case, though `ArtifactRecorded` IS emitted with `producingPwuId` (`artifact.ts:74`); no `DecisionProposed`
  case either. And the consumer keeps a link only if an endpoint is a PWU, so Evidence–SUPPORTS→Claim is
  DROPPED — the exact chain §32.4 names is what the view cannot show. `TraceLinkSchema` is minted by nothing.
- [ ] **(7) Built-but-unreachable seams** — `readAggregateEvents` is implemented
  (`sqlite-storage-adapter.ts:251`) and is NOT a member of `EngineHandle`, so no read surface can ask for
  one object's history; the §28.2 assurance aggregate is computed (`+page.server.ts:131`), serialized, and
  **rendered nowhere**; `plansForPwus` has no per-PWU entry point. Each is a seam, not a build.
- [ ] **(8) Write-only fields (the REG-F-005 shape, alive) — RE-VERIFIED 2026-08-20 with
  identifier-boundary searches, and ONE OF THE FOUR TURNED OUT NOT TO BE A DEFECT.** Confirmed
  written-and-never-read: `affectedClaimIds` (writer `assurance.ts:642`, schema `messages.ts`, one
  test — no production reader), `downstreamImpactObjectIds` (writer `governance.ts:593`, schema
  `objects.ts:374` — those are its ONLY two occurrences in the tree), and
  `professional_work_object_versions` (CREATE at `schema.ts:81`, one INSERT at
  `sqlite-storage-adapter.ts:197`, zero SELECTs). Those three are the REG-F-005 shape and are
  sweep-or-file.
  ⚠ **`activeExecutionPlanId` IS NOT ONE OF THEM — DO NOT SWEEP IT.** It is ratified with zero
  writers and zero readers, and that is a RECORDED DECISION, not drift. RPH-EXE-001 ("a PWU has at
  most one active Execution Plan") is ENFORCED, by DERIVING the fact from authoritative plan state;
  writing the pointer was considered and REJECTED, because it hangs off the PWU aggregate while the
  command targets the Execution aggregate (DOC-002 §3.3), so maintaining it would mean a
  cross-aggregate write plus a PWU event type no contract defines — "inventing a shape to satisfy a
  guard". The reasoning is at `packages/rph-application/src/handlers/execution.ts:394-408`, and it
  also records the original defect: the guard USED to read the pointer, which was permanently
  `undefined`, so its one-active-plan limb was unreachable — "the kernel was wired; the fact it
  decides on was not."
  ⚠ **A READING TRAP, recorded because it nearly caught me.** `enforcement-register.ts:2222` says
  `currentBaselineId` is dead and "that is precisely the shape `activeExecutionPlanId` had before
  RPH-EXE-001 was enforced". That is literally true and easy to misread as "so the field was
  populated" — it was not; the RULE was enforced around it. The register row is about
  `currentBaselineId`'s own liveness, which remains a live finding THERE, not here.
- **NOT residue — already ruled, do not re-file:** `getImpactAnalysis`'s deltas belong to **REG-F-006**
  (OPEN/NARROWED, blocked on sponsor escalation REG-E-030), and `getPwuExecutionStatus`'s missing rollup
  is **corpus-CONFORMANT** under REG-F-080's ratified safe default ("`PWU.executionState` … is
  caller-asserted").
- [x] ~~**W-3 finding (ii): CaptureIntent's ratified birth state is observed by NOTHING**~~ —
  **FIXED 2026-08-20, and the recorded mechanism was WRONG first** (the citation-currency lesson,
  in miniature): the ratified axis state WAS observed (`intent.test.ts` asserts
  `state.intentStatus === 'RAW'`); the unobserved thing was the ENVELOPE MIRROR at birth
  (`lifecycleStatus`, fused with the axis on every transition, set independently in the birth
  literal). Assertion added and proven RED against the exact surviving mutation; correction +
  OBSERVED verdict appended to `census/w3-probes.ndjson`; gate asserts the full history.
### REG-F-200 residue — 9 of 21 deferrals misstate the tree (audited + indexed; corrections owed)

- [x] ~~**(a) Correct the stale CARRIERS**~~ — **DONE 2026-08-20** (`8f5efe23`): the live status field `DEF-W0-001`, its paired `UNK-W0-001` (same question, gate closed twice), `W4/JAN-W4-DR-001:22`, and `PROGRAM-STATUS.md:47`. The gate packages were left as written. ⚠ Kept below for the DISTINCTION, which is the reusable part: **NOT the dated gate packages.** The distinction is
  load-bearing: a gate package is a wave's dated EXIT RECORD, so G1 saying "deferred → W2" while G2
  says "delivered" is the correct flow, not a contradiction, and rewriting it would falsify history.
  What may be corrected is (i) LIVE status fields — done for `DEF-W0-001` in
  `W0/evidence/divergence-register.md`, and `UNK-W0-001` in the same file still reads `status: OPEN`
  although its `resolution_gate` (G1+) closed at both G1 and G2; and (ii) FORWARD-LOOKING prose that
  still asserts absence, e.g. `W4/JAN-W4-DR-001…roadmap.md:22` ("the demo route stubs it") and
  `PROGRAM-STATUS.md:47`. The full carrier roster with line numbers is in the audit output; the
  indexed status is queryable now via `tracker:query`.
- [x] ~~**(b) Re-state DEF-W9-003's premise, together with the row that asserts it**~~ — **DONE 2026-08-20** (`8f5efe23`), both carriers in one edit, and stated more precisely than the audit did: the binding is INSUFFICIENT, not absent. Kept below for the reasoning. It says PWA
  upgrade "folds on the **(built)** version binding". ⚠ Do NOT file this as "the foundation does not
  exist" — the binding EXISTS and is ENFORCED (REG-F-199 drove RPH-CON-009 both refusing and
  accepting). What is missing is version SUCCESSION: a `pwaId` holds one `version` for life, so an
  upgrade has nothing to upgrade *to*. Fix the deferral AND `W8-W10/disposition-and-gates.md:36`
  together, or the contradiction survives in the half you did not touch.
- [ ] **(c) The 5 PARTIALs — NARROWED 2026-08-20 after checking my own item, which was overstated.**
  `DEF-W1-001`, `DEF-W1-002`, `DEF-W2-003`, `DEF-W3-001`, `DEF-W3-002`. Each is built in part, so
  each misleads in exactly its built half — that stands. What does NOT stand is the implied sweep: I
  classified every carrier and **the majority are DATED GATE PACKAGES**, which are exit records and
  are deliberately not rewritten (the same distinction that scoped residue (a)). The index already
  carries the precise built/unbuilt split per deferral in `deferral_evidence`, and it is the live
  answer.
  So the residual is small and takes REG-F-100's grandfathering shape rather than a campaign:
  **when a PARTIAL is next touched for its own reasons, split it there** — restated as two rows,
  discharged and still-deferred — and only in FORWARD-LOOKING carriers: the `JAN-W*-DR-001` roadmap
  prose and the `JAN-W1-DR-001.yaml` structured rows. Explicitly *not in a sweep*, and explicitly not
  in the gate packages.
- [ ] **(d) A STANDING GATE over roadmap deferrals** — design-first. It would need: a machine-checkable
  DISCHARGE PREDICATE per row (named production symbol, route, or `data-testid`), failing when the
  predicate resolves in production while the row still reads deferred; a check that a deferral's
  stated TARGET WAVE did not close with the id neither discharged nor re-carried; and a check on
  affirmative PREMISE clauses ("folds on the *built* X"). ⚠ State its limits the way
  `verif/deferral-honesty.test.ts` does — it could not see delivery UNDER ANOTHER NAME
  (`startStepGate` discharged `canStartStep`; the command-bus receipt discharged `resolveIdempotency`),
  REACHABILITY (a symbol whose only caller is itself dead), SEMANTIC SUFFICIENCY (DEF-W3-001's "with
  impact analysis" would score discharged on an emitted `impactAnalysisRequired` that is
  `z.literal(true)` with zero readers), deferrals with no production symbol at all, or deferrals
  never given an id.
- [ ] **(e) SPONSOR / structural: the living control register is an empty template.**
  `JAN-ROADMAP-001-C-living-control-registers.yaml` declares record contracts for decisions,
  divergences, deferrals, waivers and assumptions — with required `status` fields — and holds `[]`
  for all five, under its own `status: ACTIVE_TEMPLATE`. Either populate it as the live home, or
  retire it and name the real one. The census index (`f200-deferrals.ndjson`) answers the deferral
  question today, but the other four registers have the same hole and no index.

- [ ] **A format-conformance RATCHET** — `format:check` is red for 267 files and is invoked by no
  gate, so the standing "conformance arrives edit-by-edit" policy has no measurement and cannot
  fail. A ratchet (the count may not increase, pinned the way the mutation ratchets are) makes the
  policy real without triggering the REG-F-194 wholesale-reformat churn trap. Design-first: it
  changes `gate:fast`.
- [ ] **Push `main` to origin** — 30 commits ahead as of 2026-08-20, carrying REG-F-199..202 and the
  whole ground-truth programme. NOT done autonomously: history on this branch is shared and pushing is
  outward-facing. Needs an explicit go-ahead.
- [ ] **W-3b: the 192 invariants' prose→code mapping** — judgment work (lanes + refuters, the
  REG-F-197 pattern), deliberately NOT done by grep in W-3. The canon 62 FAM-N invariants are the
  priority slice.
- [x] ~~**Implementation ground-truth program**~~ — **W-0..W-5 ALL LANDED 2026-08-20 (REG-F-198)**:
  substrate + ingest + census + measured verdicts + DRIVEN bridge + `tracker:build` in `gate:fast`.
  Remaining program residue: W-3b invariant mapping (below), the query-name delta (below), and the
  optional semantic layer (design §4, opt-in, never gate-load-bearing).
  Originally: design + roadmap landed 2026-08-20
  (`DESIGN-implementation-ground-truth.md`, `ROADMAP-implementation-ground-truth.md`): a bun:sqlite
  INDEX over the existing trackers (never a peer tracker) + the capability census with the
  stub-proof verdict ladder. Next: W-0 (substrate, with a check that can FAIL). Driven facts on
  record: better-sqlite3 does not load under bun; bun:sqlite has FTS5 (3.53.0); the corpus has
  zero INV-* ids; R1 checkboxes do not encode ratification.

- [x] ~~**REG-F-180 P4 re-audit (REG-E-019, Sonar placement)**~~ — **DONE 2026-08-20.** Search was
  stale (hits now exist) but none was the placement — the properties header itself pointed into the
  sibling repo, L1186's defect in a second location. **Placement authored: `docs/operations/sonarqube.md`**
  (scope authority, per-batch gate, the REG-F-100/`f9b8642f` mutation-anchor constraint, L1188/L1220
  exception discipline). REG-F-180 P4 + REG-E-019 updated in place. **Remaining sponsor act:** only REG-E-019's formal
  closure on Ratify Sheet R1 — the L1186 pointer already retired WITH its document on 2026-07-17
  (JAN-ENGC-001 §7.1 replaced it; both audits missed this — see the register's same-day correction).
- [x] ~~**REG-F-180 P2: the REG-D-008 shape-survivorship audit**~~ — **PERFORMED 2026-08-20,
  REG-F-197.** 247 schemas: 163 ENFORCED, 35 DIVERGENT_FILED, 18 DIVERGENT_UNFILED, 11
  REFERENCE_NO_FIXTURE, 3 PLACEHOLDER, 17 ABSENT. Full roster with evidence preserved at
  `AUDIT-shape-survivorship-2026-08-20.md` — the REG-F-120 lesson applied. Residue below.
- [ ] **REG-F-197 residue (i): file-or-moot the 18 DIVERGENT_UNFILED** — each divergence needs a
  register filing (deliberate, like the 35 filed) or a drift fix. Rostered in the audit artifact.
  ⚠ 28 of the DOC-007/008/009 actionables are UNREFUTED hypotheses with a measured ~36%% overturn
  rate — re-verify each before acting on it.
- [ ] **REG-F-197 residue (ii): the three PLACEHOLDER types** (`assurance_assessment_evidence`
  z.record, `ControlActionRecommendation`, DOC-004 §33 validator output) — the REG-F-005 shape,
  alive. Real types + fixtures, or a filed exception.
- [ ] **REG-F-197 residue (iii, SPONSOR): the DOC-000 vocabulary-governance fork** — JPWB-DOC-002
  claims to SUCCEED the “retired” charter; REG-D-034 makes the source corpora SOURCE OF RECORD.
  Which governs family-level vocabulary decides whether the DOC-000 ABSENT rows are findings.
- [ ] **REG-F-197 residue (iv, SPONSOR): build-or-moot the DOC-009 legacy-migration table family**
  (`migration_batches`, `legacy_object_mappings`, `dialogue_migration_status`,
  `migration_comparisons`) — greenfield repo, possibly never-to-be-built ground; needs a ruling,
  not a guess. ⚠ ~~"P1/P2 audits (never performed)"~~ — **P1 WAS performed,
  at REG-F-183, the same day as REG-F-180 and three entries later**; this backlog inherited
  REG-F-180's bullet without reading past it (the citation-currency failure, again). REG-F-183:
  all 58 REG-Q-045 items ARE carried, but 36 live in prose strings gated by NOTHING (four carriers:
  `purpose`/`sourceSection`/`completionClaims` on `PwuTemplate`, `appliesToRisk` on
  `ConformanceProfile`).
- [ ] **REG-F-183's remedy increment** — move the 36 prose-carried items to structured, gated
  carriage. Design-first; separate increment by the register's own no-riding rule. Related but
  distinct: `AUDIT-vocab-sourceSection.md` (81% of field-bearing vocab entries cite sources that
  never define their fields — provenance theater; unworked since 2026-07-16).
- [ ] **REG-F-120 residue** — see Dispositions below; only the orphaned-docstring hunt remained
  performable, worked 2026-08-20.

- [ ] **⚠ PRE-EXISTING RED, NOT OURS — `packages/csaa/src/subject/subject.test.ts` "matches the confirmed public
  TypeScript root populations"** fails with `expected 16 to be 8` for `scripts/tsconfig.json`. **Verified
  pre-existing by stashing:** it reproduces at HEAD with every working-tree change removed, so it is not a
  consequence of the REG-F-202 work. Recorded here ONLY so the next full-gate run is not mis-attributed — under
  the standing rule this belongs to the CSAA coding agent and we touch CSAA only where we break it. (We DID break
  `csaa:inventory:check` by editing covered sources, and regenerated the baseline; that is green.)

- [ ] **REG-F-043's `guard` -> `guardDescription` rename — STILL RIGHT, NO LONGER CHEAP (re-priced 2026-08-21).**
  154 `guard:` entries in `packages/rph-domain/src/transitions.data.ts`, and the projection ALREADY renames it
  downstream (`packages/rph-projections/src/pwu-behavior.ts:119` — `guardDescription: transition.guard`), so the
  source is the dishonest end and the fix is real: for 68 of 82 texts the field names a condition NOT enforced on
  that arrow. ⚠ **But its recorded "zero behavioural cost" is stale.** CSAA now reads the literal property name —
  `providers/jpwb-state-machines/observe-state-machines.ts:537` with an EXACT key set at `:516` — and names the
  file by path at `graph/validate-guard-classification-overlay.ts:85`. Renaming it breaks a CSAA observer, its
  overlay validation and its baselines. **That lands in the CSAA coding agent's territory under the standing scope
  rule, so it is not ours to take unilaterally** — it needs either a coordinated change or an explicit hand-off.
  Recorded in REG-F-043 with the mechanism.

## Blocked / awaiting sponsor

- [ ] **REG-F-180 P3 (REG-E-020 per-concern coverage floors)** — a ratified floor (100 % guard-logic
  / 90 % projection / risk-based UI) vs `vitest.config.ts`'s explicit, reasoned rejection of
  `perFile` thresholds. Discharging is not typing numbers into a config: it is choosing between a
  ratified floor and a measured ratchet. **Sponsor decision required.**

## Standing policy (not tasks — do not sweep)

- **REG-F-100's 64 grandfathered register entries** — burned down as each is next touched,
  explicitly *"not in a sweep."*
- **`format:check` is red for ~~`scripts/mutants/ledger.ts`~~ 267 FILES, and is in NO gate** —
  **CORRECTED 2026-08-20 by measuring what the note actually claims.** This bullet named ONE file;
  `bunx prettier --check "**/*.ts"` (the exact `format:check` command, `.prettierignore` already
  excluding node_modules/dist/coverage/docs) reports **267**: rph-application 105, rph-demo 38,
  rph-domain 27, rph-engine 17, rph-projections 16, csaa 6, contracts 4, authoring 3,
  scripts/mutants 2, and 3 loose files. `scripts/mutants/ledger.ts` is not a special case; it is two
  of two hundred and sixty-seven. The policy stands — wholesale reformatting is the REG-F-194
  Finding 3 churn trap, and conformance arrives edit-by-edit (verify your edited REGION against
  `bunx prettier <file>`'s output, not the whole file). What changes is that the note no longer
  reads as "one stubborn file".
  ⚠ **AND THE POLICY IS CURRENTLY UNFALSIFIABLE.** `format:check` is referenced by NOTHING —
  derived: no `gate`, `gate:fast`, `test` or `check-types` leg invokes it. So nothing measures
  whether "edit-by-edit convergence" is converging, and the number could rise without any signal.
  That is the hollow-instrument shape this programme is built to name, applied to formatting.
  A RATCHET (the count may not increase) would make the policy real, the way the mutation and
  coverage ratchets do. Recorded as an item below rather than done here, because it touches
  `gate:fast` and is a policy change, not a fix. NOT measured: whether 267 is rising or falling —
  there is no history to compare against, which is itself the point.

## Handed off (CSAA coding agent — touch only if we break it)

- **REG-F-196 Finding 1 (OPEN, the material one)** — the only end-to-end capsule witness
  (`repository-smoke.test.ts`, behind `CSAA_REPOSITORY_SMOKE=1`) is in no gate and failed on `main`
  (`PROGRAM_CREATION_FAILED` on `packages/rph-ports/package.json`) before reaching the arrow census.
  Binding until settled: no increment may cite an end-to-end capsule run as evidence.
  ⚠ The sonar campaign has since rewritten much of `packages/csaa` — the failure needs re-confirming
  before being cited.
  ⚠ A SECOND smoke suite is also known-failing: `csaa:semantic:smoke:declaration-context-analysis`
  (~72 min/run, opt-in) was found failing since BEFORE the campaign and REPORTED rather than fixed
  (`ef1f884c`, final section) — same class as Finding 1.
- **csaa CONTROLs remain ungradeable** while `EXCLUDED_PROJECTS = ['csaa']` holds — the filter
  reaches whole-workspace runs only (`run.ts`), so named-victim mutants are unaffected.

## Dispositions (recorded so they are not re-litigated)

- ~~REG-F-120: "21 further findings survived refutation and are not yet worked"~~ — **the population
  is UNRECOVERABLE and the named third of it was already done.** The 18 unnamed findings exist in no
  audit artifact anywhere in the repository (searched 2026-08-17, re-searched 2026-08-20); of the
  3 named: `failedFiles` docstring **fixed in place** (`run.ts:865-877`, survived the sonar rewrite),
  `OwnedLifecycleTarget` hollow **resolved in place** (`pwu.ts:465-475` — kept, narrowly scoped, "a
  NAME for the owned set … NO enforcement behind it", real protection named as
  `rejectArrowOwnedBySemanticCommand` + `verif/lifecycle-arrow-declarations.test.ts`), orphaned
  docstrings **already fixed at `e802fa22`, the same day the entry was filed** (plus two more at
  `8996e5d5` the entry never named). A five-file hunt over the entry's own merge-target files returned
  zero candidates — the orphans lived in `verif/` and `handlers/`, which the recorded remedy never named.
  Full chronology struck into REG-F-120 in place, 2026-08-20.
