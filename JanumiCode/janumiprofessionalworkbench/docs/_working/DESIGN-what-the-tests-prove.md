# DESIGN — what the browser tests prove, and what qualifies the reviewer

**Programme:** `JAN-CRITREAD` · **Date:** 2026-09-23 · **Status:** revision 5 — ~~**PROPOSED, for ratification**~~
**RATIFIED 2026-09-23 by adoption of its recommendations as written (`REG-D-071`).** The sponsor found the whole too
long to review in the time available, adopted every §7 recommendation, and delegated the decisions still open to the
agent's recorded best judgement (§7.2). Revision 5 changes no mechanism: it corrects what revision 4 said about the
sponsor's own rulings (`REG-F-446`). Revisions 1–3 were each attacked by an adversarial review round and a verifier;
§8 lists every finding and where it went.
**Asked for by:** the sponsor, 2026-09-23, in place of `REG-D-068`'s three options (*"what if we don't make the tests
do two different jobs at once?"*, then *"write the design doc"*). · **Answers:** `REG-F-424`'s unanswered question.
**Related:** `REG-D-071`, `REG-F-446`, `REG-D-067`, `REG-D-068`, `R26` (recorded verbatim in `REG-F-446`; restated in
`REG-F-409`, `REG-F-412`, `REG-F-414`, `REG-D-066`, `REG-F-416`, `REG-D-067`, `REG-F-418`, at `validators.ts:317` and at
`mock-reasoning-review-validator.test.ts:221-228`), `REG-F-417`, `REG-F-418`, `REG-F-419`, `REG-F-424`, `REG-F-425`,
`REG-F-427`, `REG-F-428`, `REG-F-429`, `REG-F-435`, `REG-F-439`..`REG-F-445`, `REG-Q-025`, `REG-D-052`, `REG-D-060`,
`REG-D-066`, `REG-F-243`.

---

## In short

- **The browser tests prove the product HANDLES a reviewer's verdict.** In test engines only, a declared stand-in
  answers the review: the program checker's two real judgements, plus a clean answer the test itself states for the
  seven it cannot judge — recorded as *not judged*, with the test's answer beside it, and shown on every screen.
- **Whether a reviewer can EARN a verdict is measured separately**: drafts with known right answers, run through the
  real review path; every miss is written up as a register finding, and a gate check stays red until it is.
- **Nothing changes outside test engines.** All three floor policies still run everywhere, a failed or inconclusive
  floor still blocks, and no waiver discharges anything.
- **Order** (§6): the engine's recording change → the stand-in → the qualification harness and its first run → the
  thirteen browser tests switched over last.

---

## 0. How this was decided

1. **The complaint.** The sponsor read `REG-D-068`'s three options — replay a recorded judgement in the thirteen
   tests, build nothing, or replay only in new tests — and said all three *seem* to be *"some sort of failure or
   capitulation to not doing what's needed or useful"*.
2. **The reframing.** All three answer one question — *how can the test lane's reviewer be honest, repeatable AND make
   the tests green?* — while the tests are asked to do two jobs: prove the product HANDLES a verdict, and prove a
   verdict can be EARNED. The sponsor asked what happens if the tests stop doing both.
3. **An adversarial check of the reframing** found that the split is `REG-F-424`'s own question, that the
   reviewer-quality half is an OPEN obligation never started (`REG-Q-025`), and three flaws in the first sketch.
4. **The map.** Five read-only readers traced the record path and every gate that reads it; reviewer selection and the
   channels a test could use; what each browser test needs; the governing text verbatim; and what a qualification
   harness can be built from (§3).
5. **Three review rounds**, each a set of adversarial lenses and a verifier who re-checked every serious finding:

   | round | on | findings | SERIOUS raised → after verification | BLOCKER | largest |
   |---|---|---|---|---|---|
   | 1 | revision 1 | 66 | 38 → 28 | 0 | a scripted answer recorded as `MET` — `REG-F-409`'s shape |
   | 2 | revision 2 | 52 | 23 → 18 | 0 | a stipulation over an unread draft; an engine that admitted any writer; a trigger any red browser test would skip |
   | 3 | revision 3 | 32 | 11 → 10 | 0 | a write-up requirement that a definition change could dissolve; a sequencing check that could never fail; outcomes never recorded |

   The serious count fell each round; §8 disposes of every finding. This revision answers round 3; a final single-agent
   audit confirmed all ten of round 3's serious findings closed in the body, and found two new SERIOUS defects and five
   MINOR in revision 4's own changes, fixed here (§8.4). It was not attacked by a fourth full round.

Findings made on the way and filed rather than designed here: `REG-F-439` (three records corrected), `REG-F-440`
(the lane's drafts have no correct verdict), `REG-F-441` (the reviewer program can be swapped in any mode),
`REG-F-442` (stale host docs), `REG-F-443` (the preflight reads a retired switch), `REG-F-444` (two of `REG-F-435`'s
attributions were wrong — measured: the scrolling test's red was tracing, not the reviewer), `REG-F-445` (the live
lane's only verdict report reads a field that does not exist).

---

## 1. In plain language (for the sponsor)

**Today** one set of browser tests is asked two questions at once: *does the product handle a reviewer's verdict
correctly?* and *can a draft actually pass a real review?* No reviewer can answer both inside a test run: the program
checker honestly judges two of the nine questions; a live AI model is slow, costs money and answers differently on
different days; and a saved or scripted answer proves nothing about whether a draft can pass. So thirteen tests are
red, and every option so far gave something up.

**This design separates the two questions.**

- **The browser tests test the product.** In test mode only, the reviewer is replaced by a *declared stand-in*: the
  same program checker as today, which still really judges what it can (a dead end in the graph, a malformed graph),
  plus a clean answer **the test itself stipulates** for the questions the checker cannot judge. Each stipulated answer
  is recorded as what it is — *not judged by anyone* — with *"the test stipulated: clean"* written beside it. Outside
  engines built for tests, the product's rules behave exactly as today and that record fails the review; inside them,
  two checks gain one branch that reads the stipulation. The screens say so — on the graph arm, *"reasoning review: 2
  criteria evaluated, 7 stipulated by the test, not reviewed"* — but **the review's overall state, which every gate
  reads, still says SATISFIED with no mark**; the disclosure lives in the per-question records, the status text and the
  panels. A test that stipulates nothing gets today's result (inconclusive for a clean draft), recorded under the
  stand-in's name; a draft the checker could not read is never stipulated over. **Every draft on the test lane could
  lawfully be refused by a real reviewer, and two are explicitly deficient** — the tests stipulate them clean because
  they test what the product does after acceptance, not whether the draft deserves it.
- **The reviewer gets its own test: qualification.** A set of drafts with known right answers — clean ones with an
  honest account of their reasoning, and ones with a planted defect for each of the nine questions — run through the
  product's real review path against candidate models. Every miss, every clean draft not passed, every verdict that
  changes with a name must be written up as a register finding, and it stays owed on the record that holds it for as
  long as that record stands. A gate check is red while any such failure is not written up, and whenever the reviewer's
  definition or the cases change until the changed part is re-measured. It forces a measurement and its write-up — not
  a pass: nothing makes a reviewer good; you judge that from the report. It does not notice a change of model, cannot
  prove the replies came from the model it names, and nothing runs it but a person.

**What you would get.** All thirteen reds predicted green. Twelve rest on an earlier run with a stand-in that approved
everything, which turned them green on a different route (§4.6 says exactly how different); the thirteenth has never
been seen green anywhere. The dead-end test keeps proving a real defect is caught. And a durable, repeatable measurement
of the reviewer, kept in the repository and re-run when its definition changes. It reports; you judge.

**What you would give up** (each is a ruling in §7):
1. The red gate as a standing reminder that the test setup cannot review. It moves into a lane check — every SATISFIED
   review a test produces rests on a stipulation that test registered, plus at least one real judgement; the only
   other SATISFIED allowed is the reference seed's hand-written one — and into the qualification report.
2. **Inside engines built for tests only, a question nobody judged counts as answered when the test stipulated it.**
   There, three canon texts are set aside: `ASR-9`'s *"Unable-to-determine is never treated as met"*; `ASR-3`'s *"No
   PWA profile, low-risk classification, planner optimization, or local agent instruction may suppress the floor"*;
   Guide §8.4's *"A missing … required review cannot satisfy assurance or permit its protected transition"*. Outside
   those engines nothing changes. This also gives up `REG-D-067`'s *"none of it in the PRODUCT plane"* (Q2, Q5).
   ⭑ **Your 2026-08-20 ruling that the de minimis floor should never be skippable is not set aside.** It answered
   whether a waiver may discharge a failed required floor policy (`REG-F-202`), and nothing here waives, skips or
   disables a floor policy: all three still run in every engine, and a failed floor still blocks. Revision 4 said this
   design set that ruling aside, which stretched the ruling past the question it answered (`REG-F-446`). Whether its
   words also reach a criterion counted met on a test's stipulation was never put to you; Q5 (c) records the answer
   this design adopts.
3. Independence on the test lane becomes a label: the stand-in names no model, and one test author writes both the
   draft's plan and the stipulation (Q2).
4. `REG-D-068`'s flat *"a hand-written judgement is NOT licensed"*, narrowed (Q2).
5. Two tests restated to weaker claims, against `DOC-004:237` and `HARMONIZATION-LOG`'s *"No increment may turn one
   green by weakening its assertion"* — their stronger claim moves to qualification, which measures it but does not
   enforce it (Q6, Q9).
6. A contract change to two unratified payloads (Q4).
7. Held-out test cases, which `REG-Q-025` names, deferred in version one (Q7).

**What sits between ratification and green.** Eight increments (§6). **Two steps are yours**: you confer the case set —
about 26 drafts with their expected answers — before any run counts; and, on the recommended path, you authorize the
first run's frontier (paid) candidate. The first run also includes local models: about half an hour to an hour and a
quarter each on the shared server (§5.3). On `REG-F-427`'s evidence it will record missed defects and name-dependent
verdicts, and each must be filed as a finding before the gate turns green. §7's ruling sheet shows what each ruling
gates.

**What you would be revisiting:** your own rulings `REG-D-068` (Q2) and `REG-D-067` (Q3b, Q3c, Q5); the reach of
`R26` (Q3a) and of your 2026-08-20 ruling (Q5 (c)); canon's `ASR-2`, `ASR-9` (Q2) and `ASR-3` and Guide §8.4 (Q5), in
test engines only; and
`DOC-004:237` with the `HARMONIZATION-LOG` principle (Q6, Q9 (d)). §7 quotes each.

**Found on the way:** the scrolling test that went red on earlier stand-in runs is not a reviewer test at all — its red
was Playwright's tracing being off (`REG-F-444`, measured).

---

## 2. The question, and the answer this design proposes

`REG-F-424` (`:36913`) put it and nobody answered it:

> **Do the thirteen e2e specs exist to prove the WIRING carries a judgement, or to prove the floor CAN BE
> SATISFIED?**

**Proposed answer: WIRING — for the lane; satisfiability moves to qualification.** The evidence:

- **Eleven assert what the product does with a verdict.** Three of those also read the verdict back as a rendering
  check (the waiver tests at `:70`, and the control at `:217`). **Two were written to claim the verdict itself**
  (`assurance-floor`, *"a clean graph yields a SATISFIED floor…"*; `execution-model-invocation`, whose banner says it
  *"COMPLETED BECAUSE IT WAS ASSURED"*, `:221`). Their claim is restated (§4.6) and moves to Job 2.
- **No test on the lane can prove satisfiability honestly**: no draft on the default lane has a correct verdict for a
  real reviewer to reach (`REG-F-440`), and no reviewer measured so far is both repeatable and judging (`REG-F-427`,
  `REG-F-429`).
- **The corpus already draws this line.** The live-execution lane: *"The deterministic lane keeps proving the wiring"*
  (`playwright.live-exec.config.ts`) and *"A green tick tells us the wiring holds; only this tells us whether the
  reviewer is any good"* (`e2e-live-exec/execution.live.ts:200-201`). `R25`: the engine owes *"a competent reviewer
  was asked, their report is carried FAITHFULLY, and a satisfaction their own report does not support is refused"*
  (`DESIGN-undertaking-execution-sandbox.md:103`). **In an admitting engine, `R25`'s first limb is not owed, and its
  third holds only for the criteria the checker judged** — the dead-end test proves the third there; qualification
  speaks to the first.
- **Canon's licence, as this design reads it**: *"Test doubles stand in for external actors — models, validators,
  humans, tools — never for the domain's own boundaries"* (`JPWB-DOC-004:238`). That sentence is a prohibition on
  integration tests; this design reads it as licensing the stipulated half inside a test, and **Q2 (c) asks you to
  adopt that reading**. The Guide's *"A model, deterministic engine, hybrid, human procedure, or external service may
  implement the same policy"* (`:982`) licenses only the checker half.

**The limit canon puts on it:** *"a test that mocks the fact it exists to verify proves nothing"* (`DOC-004:244`).
Wherever a test exists to verify a JUDGEMENT, the judgement stays real: the checker's own judgements cannot be
stipulated over, and a draft it could not read is not stipulated at all (§4.1).

---

## 3. The map — the facts this design rests on

### 3.1 The record path

- A reviewer's answer is a `ReasoningReviewJudgement` (`packages/rph-assurance/src/validators.ts:254`): findings of
  `{criterionId, failed, statement, severity?}`, a recommendation, and nothing that names who answered.
- The mapper gives each policy criterion one outcome: absent → `UNABLE_TO_DETERMINE`, failed → `NOT_MET`, otherwise
  `MET` (`validators.ts:321`, `R26`). A hand-written clean row and an evaluated clean row are identical here.
- **Every existing rule already fails `UNABLE_TO_DETERMINE` closed.** The ladder: a mandatory `UNABLE_TO_DETERMINE` is
  INCONCLUSIVE (`assurance-rules.ts:57`); it recomputes the disposition from the rows and observations and reads the
  reviewer's recommendation only for the SATISFIED-with-`NOT_MET` boundary (`floor.ts:338-341`,
  `assurance-rules.ts:277`). Gate E's fold at `CompleteAssuranceAssessment` — the one production reader of criterion
  events — keeps the latest result per criterion and refuses a positive disposition with a mandatory
  `UNABLE_TO_DETERMINE` (`handlers/assurance.ts:2127-2141`); it is handed the assessment's policy. The publish gate
  (`floorGateBlock`, `floor-gate.ts:275`) reads only each floor policy's latest `assessmentState`.
- **Durable per criterion:** only `AssuranceCriterionEvaluated` — `{assessmentId, criterionId, result, rationale?}`
  (`messages.ts:1046`). Command payloads keep only a hash (`schema.ts:130`). ⚠ That event's schema is not in
  `RATIFIED_EVENT_PAYLOADS` (`messages.ts:3195`), so its strictness is never checked at runtime: a field the handler
  forgets to copy (`assurance.ts:1710-1715` builds the payload field by field) is caught only by a test.
- **The payloads that would carry a new field are UNRATIFIED-AUTHORED** (`vocab/m3-commands-events.json:639`: canon
  ratifies the NAMES; *"DOC-007 schematizes NO interface for either"*). Extending an authored payload is within
  programme authority (`PruneCause`, `f02f720d` — whose note also records that making a new event field REQUIRED was
  *"the first ruling [that] GOT THIS WRONG"*, because stored events predate it). **The outcome ENUM is not**: `ASR-9`
  fixes criterion results at *"five-valued"* (`JPWB-DOC-003:277`).
- The two deterministic floor policies build their rows directly (`packages/rph-assurance/src/floor.ts:180-190`,
  `:217-241`), and two of those rows are host literals, not judgements: `schemaValid: true` (`apps floor.ts:390`) and
  `traceComplete: true // WITHHELD` (`:280`). Nothing in this design touches them.
- **The kernel knows nothing about test mode:** 0 hits in `packages/` for any mode signal; `HandlerContext` is
  `{store, now, newEventId, logger}` (`kit.ts:28`); `CreateEngineDeps` has no mode field (`engine.ts:85`). **Nor does
  any storage adapter report whether it is durable**; SQLite is the only adapter in the repository.

### 3.2 Selection, and what "test mode" guarantees

- The mock is selected only when `opts.testMode && !process.env.JPWB_ASSURANCE_TOOL` (`assurance/index.ts:47`),
  *"because `JPWB_ASSESSOR=mock` once swapped in the content-blind mock in ANY environment while the floor still
  recorded SATISFIED"* (`:44-46`).
- **Test mode implies an in-memory store** in the demo host, by construction: `RPH_DEMO_MODE` has one value; only
  `server` plus `JPWB_DEMO_DB` gives a file (`workbench.ts:38`, `:46`, `:109`) — `R24`'s split
  (`DESIGN-undertaking-execution-sandbox.md:102`). **The converse does not hold**: the demo's ordinary boot and every
  vitest engine are in-memory and not test mode, and `createEngine`'s default store is in-memory
  (`sqlite-storage-adapter.ts:48-49`, `sql-driver.ts:41`).
- **`harnessExposed()` is not test mode:** `TEST_MODE || HARNESS` (`workbench.ts:263-265`), true on the live-execution
  lane — `server` + `JPWB_HARNESS=1` + a DURABLE temp database. Every `/test-api` route gates on it, and
  `/test-api/dispatch` dispatches any command sequence, one step at a time, with no transaction around the batch
  (`dispatch/+server.ts:28-29`).
- **The live AUTHORING lane is test mode too** (`playwright.live.config.ts:39`: `RPH_DEMO_MODE: 'test'`, the real Pi
  agent, no `JPWB_ASSURANCE_TOOL`), so under this design it runs the stand-in in an admitting engine. vitest sets no
  mode by default, but **twelve unit-test files opt in** through `vi.hoisted`; at least `floor-recording.test.ts` and
  `direct-load-containment.test.ts` call `runPwaFloor` without the live-reviewer seam.
- The reviewer PROGRAM can be swapped in every mode (`REG-F-441`); nothing in this design relies on that route.

### 3.3 What each browser test needs

Sixteen tests reach the graph reviewer (the twelve authoring-arm reds, and the passing dead-end, orphan,
editors-locked and gallery tests); two reach the work-product reviewer; none reaches the process-result arm. The `s01`
Slice reaches no reasoning reviewer (its step is a TRANSFORMATION).

| test | needs from the review | reads the verdict back? | after that, asserts |
|---|---|---|---|
| agent-retention | SATISFIED, to stage | no | conversation and transcript facts |
| agent-sse ×2 | SATISFIED (hash in the SSE body) | no | tool events, type names, edges |
| agent-ui | SATISFIED, to stage | no | type names, canonical unchanged before accept |
| assurance-floor-waiver ×3 | SATISFIED, as setup | `:70` (all three), `:217` (control) — rendering | waiver framing, publish refusal, panel rendering |
| execution-agent-authored-binding ×2 | SATISFIED, to show Accept | no | bindings; the publish gate admits |
| graph-validation (proper) | SATISFIED, to stage | no | analyzer report, computed in the test |
| pwa-coherence | SATISFIED, to stage | no | analyzer attributes |
| **assurance-floor (clean)** | SATISFIED | **`:70`, `:78`, `:82`** — its claim | atomic commit; the two deterministic validators; the publish gate admits |
| **execution-model-invocation** | WORK_PRODUCT SATISFIED | **`:235`** — its claim | bindings, exchange, artifact (`:85-219`) |
| assurance-floor (dead end) — passing | the checker's real RR-04 fault | yes: REJECTED | canonical untouched; discard works |
| graph-validation (orphan) — passing | nothing (schema-invariant rejects alone) | no | analyzer attributes |
| editors-locked, gallery — passing | nothing | no | accepts any staged status / screenshots |

**The dead-end test is the lane's one real discrimination check** — it went red under an always-yes stand-in
(`REG-F-435`). **The waiver tests' real subject rests on a BLOCKING finding hand-written through
`/test-api/dispatch`** (`assurance-floor-waiver.e2e.ts:83-114`). **All 42 e2e spec files, and one support module
(`e2e/support/gallery.ts`), import `test` straight from `@playwright/test`**, and none extends it. Specs reset the
engine in their own `beforeEach` or in the test body, and one (`smoke.e2e.ts`) never resets.

### 3.4 What canon and the register constrain

- **The floor.** `ASR-3`: *"No PWA profile, low-risk classification, planner optimization, or local agent instruction
  may suppress the floor"* (`DOC-003:249`). Guide §8.4: *"No PWA profile, low-risk classification, planner
  optimization, or local agent instruction may suppress this Reasoning Review floor"* and *"A missing, stale,
  malformed, failed, unavailable, or independence-invalid required review cannot satisfy assurance or permit its
  protected transition"* (`:854`). The sponsor, 2026-08-20, asked whether a governed waiver may discharge a failed
  required floor policy: *"de minimus floor should never be skippable"* (verbatim; register `:4844`, `REG-F-202`). Its
  scope, as ruled and built that day: no waiver discharges a required floor policy, in any engine — the discharge path
  was deleted. It does not speak to how a criterion's result is recorded (`REG-F-446`).
- **Criterion results.** `ASR-2`: *"Partial output — an unanswered mandatory criterion — is invalid output"*
  (`DOC-003:243`). `ASR-9`: *"Criterion results are five-valued (met / partially met / not met / not applicable /
  unable to determine); the exact spellings are contract shapes. Unable-to-determine is never treated as met"*
  (`:277`). `R26` read "unanswered" as `UNABLE_TO_DETERMINE` → INCONCLUSIVE rather than a rejected result; this design
  follows `R26`'s reading.
- **What `R26` was, verbatim** (`REG-F-446`, from the session record). Asked *"Which way?"* on `REG-F-409` with four
  options, the sponsor chose *"Fixture declares its coverage; gate goes red (Recommended)"* — the checker states only
  what it examined, absence becomes `UNABLE_TO_DETERMINE`, and *"The gate then stays RED until the five are
  addressed"* — and wrote: *"Red should land on a branch. REG-F-409 should carry the 11 test accounting as its
  evidence."* Not chosen: *"Split the rubric: deterministic vs judgement criteria"*, *"Fix the discard, leave the
  fixture alone"* (the checker claims all nine) and *"File it and move on"*.
  - ⛔ **Revision 4 quoted four later texts as `R26`'s rejections** — *"the repair the sponsor rejected by name under
    `R26`"* (`REG-D-067`), *"the one the sponsor forbade making claim nine"* (`REG-F-414`, `REG-D-066`), *"the shape
    the sponsor rejected by name"* (`REG-F-418`, which stays OPEN and is still true of the mock's clean arms) and the
    guard comment *"THE SPONSOR REJECTED BY NAME"*. The sponsor wrote none of those words; an option not chosen is not
    a rejection by name. Each is struck to `REG-F-446`. What stands is what was chosen: the checker declares only what
    it examined.
- **`REG-D-067`** paid the cost *"in the MERGE plane; none of it in the PRODUCT plane"* (`:36623-36624`), and **costed
  and killed two alternatives**: *"Scope out via policy severity"* — it *"makes the floor **overrule a rejection**"* and
  *"weakens the LIVE lane"* — and *"Replay a recorded judgement"* — *"Attributing one artifact's judgement to another is
  fabrication"* (`:36626-36633`). Its successor: *"a reviewer on the gate's default lane that evaluates every mandatory
  criterion — the only exit that neither fabricates nor disarms"* (`:36644-36645`).
- **`REG-F-424` (3)** refuted a *"Test-mode only"* design call for replay: the lane *"would reach a POSITIVE disposition
  while capturing nothing, which today is harmless only because the lane cannot reach one"* (`:36909`).
- **Allowed:** validator doubles (`DOC-004:238`); unit-test judgement literals — *"THE REMEDY IS DERIVED, NEVER
  HAND-LISTED — one `failed: false` row per criterion, from the policy's own list"* (`REG-D-066`, `:36516`); and
  `clearingJudgement`, *"legitimate for unit arrangements"* (`REG-D-068`, `:36879`).
- **Identity:** a distinct evaluator *"whose actual identities and lineage are recorded"* (Guide `:851`, `ASR-4`).
  **Anti-theater:** `B7`, `V1`.
- **Tests.** *"A failing required test is never removed, disabled, or weakened solely to obtain passing status.
  Changing what a test asserts is a semantic act requiring the same authority as changing the behavior it protects"*
  (`DOC-004:237`); modifying an oracle *"is a separately authorized act"* (`:256`). *"No increment may turn one green by
  weakening its assertion — that is the one move this whole effort exists to prevent"* (`HARMONIZATION-LOG.md:448-449`),
  which also rejected `it.fails()` as *"a green suite concealing non-enforcement"* and *"a separate `test:wiring` suite
  excluded from the gate"*, because *"A red gate that tells the truth beats a green one that measures nothing"*
  (`:439-444`). Prompts: *"prompt changes are evaluated against stable datasets and must not silently degrade
  behavior"* (`DOC-004:241`).
- **Qualification.** `REG-Q-025` (OPEN, so its safe default binds; `:299`), whole: *"Run held-out canaries and
  control-health analysis in an isolated, observe-first harness; record results as candidate engineering Evidence —
  not canonical Assurance Observations — until the subject/lifecycle contract is ratified; escalate material failure.
  Meta-assurance findings never hard-block a human governance act. Never auto-reject unrelated subjects or
  self-modify authoritative policies; activation, suspension, and evolution require explicit versioned governance."*
  Its statement carries a sponsor-adopted constraint: meta-assurance validators *"never hard-block human governance
  decisions"* (`:298`). Guide §8.8 (`:962`): an undetected canary *"should trigger escalation or a governed proposal"*
  and *"does not automatically reject unrelated professional work"*. No selection scorer
  (`DESIGN-validator-health.md:109-110`).
- **Gates.** *"A pre-commit hook or local gate run is developer convenience — valuable, and never the guarantee"*;
  an interim carrier executes *"the same versioned, policy-shaped reference artifacts the platform will later
  consume"* and *"is recorded in the register as an interim carrier with a planned authority transfer"*
  (`DOC-004:258`). There is no CI (`REG-F-419`). The gate's composition pin (`verif/assurance-surface.test.ts`) records
  each step's position *"AS AN ARGUMENT"*, pins the root command count (`REQUIRED_ROOT_COMMANDS`, 10) and a verif test
  floor (`VERIF_TEST_FLOOR`, 65).
- **Slices.** *"any Slice reaching a satisfaction hop MUST drive the floor, not stub it"* (`JAN-SLICE-DR-001:53-54`),
  and the line before it reads `ASR-9` as never weakened to green (`:52`). Both bind Slices only; none of the thirteen
  is one, and the one e2e Slice reaches no reasoning reviewer.
- **Other rulings leaned on:** `R24` (the mode split), `R25` (above), and `R2` — *"Live models for validation,
  deterministic recorded replay for CI"* (`DESIGN-undertaking-execution-sandbox.md:80`), whose elaboration governs the
  PRODUCER and is untouched here.

### 3.5 What exists for qualification

Nothing durable. The `REG-F-427` harness lived in the scratchpad; its probes were built through the real validator's
`print` seam, and its scorer re-typed `floor.ts`'s argument list with constants instead of calling the exported
`composeAssuranceOutcome`. Its register entry records the figures a cost estimate needs: a median of 18 s per review
(`REG-F-427` (6)) and prompts that loop at 240 s each in 1 to 5 of 16 per model (`REG-F-427` (5)). There is no reviewer
fingerprint (`policyVersion` and `validatorVersion` are the constant `'1'`); the files that define the reviewer changed
in 17 commits between 2026-09-02 and 2026-09-20. **The product has no local-model reviewer backend**: only `agy` and
`devin`, so a local model cannot be deployed as the reviewer without a new backing tool. The floor policy cannot be
versioned (`handlers/assurance.ts:84`; *"Floor policies cannot be versioned."*, `+page.server.ts:833`), and a durable
store is seeded once (`workbench.ts:192-195`), so a deployment seeded before a criteria change keeps the old rubric.
Precedents to copy: `JAN-PRPWA`'s one scorer on a gated deterministic path and a manual live path; the Virtuous Cycle
harness's rule that a change may not edit the probes that judge it; the gate-step pattern of `120d4ce6` and
`ea99ff28`.

---

## 4. Job 1 — a declared stand-in reviewer, in test mode only

### 4.1 What the stand-in is

**The existing structural checker, plus a clean answer the test stipulates for what the checker cannot judge.**

1. The checker (`mock-reasoning-review-validator.ts`) runs first, unchanged. Its answers stay real and are recorded as
   today: RR-04 and RR-09 on the graph arm; RR-04, plus RR-01 when the work product has content, on the work-product
   arm; RR-04 and RR-07 on the process-result arm.
2. **A stipulation completes a subject the checker READ; it never replaces a read.** If the checker judged no criterion
   at all — its unreadable branch, on any arm — the stand-in stipulates nothing and the review stays INCONCLUSIVE,
   honouring the checker's own rule: *"FAIL CLOSED on a subject this Validator could not read"*
   (`mock-reasoning-review-validator.ts:25`).
3. **If the test registered a stipulation for this subject and arm and the checker read the subject**, every criterion
   of the policy in force that the checker did NOT judge on this arm and branch is recorded as stipulated clean (§4.2).
4. **If none is registered**, nothing else is answered: the remainder arrives `UNABLE_TO_DETERMINE` and the review is
   INCONCLUSIVE — today's disposition and staging, recorded under the stand-in's identity. "No default verdict" is
   realised as fail-closed, not as a throw: a throw is `VALIDATOR_FAILED`, which stages `BLOCKED_EXTERNAL` and would
   turn the passing dead-end and orphan tests red (`validators.ts:399`; `agent/+server.ts:255`).
5. **Version one stipulates only CLEAN, and only the remainder.** The grammar is `{ framing, remaining: 'CLEAN' }`. The
   remainder is DERIVED — the policy's criteria minus what the checker judged — so **the stand-in** cannot answer a
   checker-judged criterion, and cannot hand-list one (`REG-D-066`). (The engine itself would admit a stipulated row
   from any writer; §4.3 closes that.) A scripted FAULT is left out: it would leave a durable BLOCKING observation
   indistinguishable from a reviewer's finding, and no test needs one.
6. **The stand-in's recommendation is derived, never copied.** SATISFIED only when the checker found nothing AND a
   stipulation covers the whole remainder; the checker's own REJECTED or CONDITIONALLY_SATISFIED when it found a fault;
   INCONCLUSIVE otherwise. So the stand-in never recommends a verdict it did not earn — it does not carry `REG-F-418`'s
   shape (the mock keeps it; that entry stays open). The ladder recomputes the disposition in every engine, and
   `BOUNDARY_REJECTED` cannot arise: it needs a SATISFIED recommendation with a mandatory `NOT_MET`.

**Identity.** `validatorId 'standin.reasoning-review'`; evaluator `{agentId: 'standin-reviewer', modelId: 'standin',
providerId: 'jpwb-test'}` — distinct from the mock, from `agy`, and by `modelId` from both default-lane producers.
⚠ **Independence here is a label.** `DIFFERENT_MODEL` compares `modelId` strings (`assurance-rules.ts:201-203`); the
stand-in names no model, and one test author writes both the producer's plan and the stipulation. `ASR-13` asks for
*actual* independence. This is accepted only because a stipulation counts for nothing outside a test engine (§4.3), and
**Q2 (e) asks you whether that is acceptable**.

**No exchange is captured, and that is correct.** `REG-F-424` (3)'s objection was a positive disposition *"while
capturing nothing"*. PER-9 records model TRIES; the stand-in makes none. What happened — a stipulation — is recorded on
the criterion events themselves, which is where a reader of the verdict looks.

### 4.2 Recording a stipulation — the central decision

| | form | consequence | verdict |
|---|---|---|---|
| **A** | a sixth `CriterionResultOutcome` value | amends `ASR-9` (*"five-valued"*) and a meaning canon owns (`DOC-002:295`); the kernel's hand-restated union (`assurance-rules.ts:16`) must learn it | possible; canon |
| **B** *(revision 1)* | `result: MET` plus a `basis: SCRIPTED` mark | writes `result: MET` for a criterion nobody judged — `REG-F-409`'s shape; makes `MET`'s meaning depend on the mark; forces every producer, host literals included, to stamp `EVALUATED`, and turns `REG-F-441`'s swapped program into an affirmative structured `EVALUATED` claim | **rejected** |
| **C** | the assessment only (`validatorId`, evaluator) | one mark per assessment cannot express a hybrid; a string no gate reads | **rejected** |
| — | the ratified axes | `evaluationMethod` is a POLICY declaration of how a criterion ought to be evaluated, not a mark on a result; `executionProvenance.originType` is per assessment and has no test member; `REG-F-243` is about judgement admitted as EVIDENCE — adjacent, not this | none fits |
| **D** | **`result: UNABLE_TO_DETERMINE`, with an optional `stipulated: 'MET'` beside it** on the authored `RecordCriterionResult` command and `AssuranceCriterionEvaluated` event | below | **recommended** |

**Why D.**
1. **The result says what is true — nobody judged the criterion — so every reader that does not know about stipulations
   fails it closed, with no change**: the ladder (INCONCLUSIVE), Gate E (refuses), any future reader. Outside test
   engines, the product behaves exactly as today.
2. **Outside test engines, `ASR-9`'s values and their meanings are untouched**, and `R26`'s meaning of
   `UNABLE_TO_DETERMINE` — *"nobody judged this"* — is preserved. The stipulation is a separate, declared statement.
3. **Nothing else changes.** Evaluated rows, the deterministic policies' rows and the host literals are written as
   today; no producer has to stamp anything, and nothing new is claimed about a swapped program.
4. **Absent means "no stipulation" — the conservative reading.** It upgrades nothing, so it is not the
   absence-read-as-a-value defect, and the field is optional in the event as the `PruneCause` lesson requires.

⚠ **What D does inside a test engine, said plainly:** a row whose result is `UNABLE_TO_DETERMINE` counts as met because
the test stipulated it. That is "unable-to-determine treated as met" — inside test engines only. It rests on one
reading of canon: **a validator double's answer is an answer inside a test (`DOC-004:238`) and nowhere else.** Q2 and
Q5 ask you to adopt that reading in terms.

**The name.** `stipulated` — checked: canon uses "stipulation" only as ordinary prose (`DOC-002:302-303`); `basis` was
rejected because canon uses it for *grounds* (an assumption's `basis`, `V1`'s *"basis cannot be inspected"*).

**What changes, where** (no migration: the field is optional, and no existing dispatch changes):
- the vocabulary: a new authored enum `StipulatedCriterionResult = ['MET']` in `canonical-vocabulary.json`, the
  optional field in the command's and the event's `payloadFields` (`m3-commands-events.json`), then `bun run gen`
  (`enums.ts`, `messages.ts`, `schemas/`) and the pinned count in `validate.test.ts`;
- `ReasoningReviewFinding` gains an optional `stipulated: true`; the mapper turns a stipulated finding into
  `{outcome: UNABLE_TO_DETERMINE, stipulated: MET}`; `FloorCriterion` carries it; `record-assurance` sends it; the
  handler's field-by-field literal (`assurance.ts:1710-1715`) copies it;
- Gate E's fold and the ladder gain the admitting branch (§4.3); the floor view, the status text and the undertaking
  page disclose it (§4.4); `/test-api/dispatch` refuses it (§4.3).

A model cannot mark its own answers stipulated: `coerceJudgement` rebuilds every finding field by field
(`reasoning-review-validator.ts:263-268`), so a model-supplied `stipulated` is already dropped. A test pins it.

### 4.3 The admitting engine — the one permission, and its locks

**The flag.** A new optional `CreateEngineDeps.admitStipulatedAnswers` — absent means *does not admit*, the refusing
value — threaded `CreateEngineDeps` → `createEngine`'s hand-written enumeration → `EngineDeps` → `Engine` →
`HandlerContext`, and exposed on the handle as a **required** read-only member, so the type checker forces every
wrapper that enumerates handle members to carry it — including the authoring turn's recorder and witness
(`authoring-turn.ts`), which are hand-written object literals. The floor callers (`runPwaFloor`,
`runFloorOverSubject`) read it from the engine they record into, not from `isTestMode()`, so one source decides both
uses.

**What it changes, only when true.**
1. **The ladder** — `composeAssuranceOutcome` and its wrappers `assuranceRecordingPlan`, `runFloorAndPlanRecording` and
   `runDeMinimisFloor`, all defaulting to *not admitting* — reads a stipulated row as its stipulation.
2. **Gate E's fold** admits a positive disposition whose mandatory `UNABLE_TO_DETERMINE` rows all carry a stipulation —
   **only for assessments under `floor.reasoning-review`**. The fold keeps the latest event per criterion WHOLE: a row
   counts as stipulated only if that latest event carries `stipulated: 'MET'`.

When false, both are today's code. Gate E and the ladder are not mocked; each gains one flag-gated branch that changes
which rows count as given, and nothing else.

**The permission, stated honestly.** In an admitting engine the mandatory floor is satisfied by answers no reviewer
gave. That bears directly on `ASR-3` and on Guide §8.4's *"cannot satisfy assurance or permit its protected
transition"*. It involves no waiver, and every floor policy still runs, so the sponsor's 2026-08-20 ruling is not
engaged as it was ruled; whether its words reach this case is Q5 (c). This design's position, for the sponsor to
adopt or refuse (Q2, Q5): a stipulated answer is a validator double answering the floor inside a test — and a missing
review everywhere else. Canon's *"never for the domain's own boundaries"* can be read against it: two of the domain's
own checks do gain a branch. The ruling is the sponsor's.

**Who can write a stipulation, and the channels closed.**
- **The stand-in** writes one only within its derived grammar (§4.1).
- **`/test-api/dispatch` refuses the whole request** — before dispatching any step, answering 4xx and naming the step —
  if any step's `RecordCriterionResult` payload carries `stipulated`. A per-step refusal inside the route's loop would
  not do: the route dispatches step by step with no transaction, so the steps before and after a refused one would
  still land (a stipulated row refused, then a Complete SATISFIED admitted).
- **In-process test code** — any vitest engine built with `admitStipulatedAnswers: true` — could write stipulations
  directly. **A verif census fails when a WRITE of a stipulated row — a stipulated `MET` value in a finding or a payload
  — or an engine built with `admitStipulatedAnswers: true` appears outside a named list of files**: the demo host's
  engine construction, the stand-in, the mapper, the recorder, the handler's payload literal, the generated contracts,
  and the tests of each (the kernel's admitting-branch and refusal tests among them). A new writer is then a reviewed
  act, not an accident. The census matches writes, not the field's name, so readers of the field are free.
- **The admitting branch is confined to `floor.reasoning-review`**, so a stipulation under any other policy is refused
  even in an admitting engine.

**Two guarantees, stated separately** (recommended; untested):
- **The engine's: an admitting engine is never durable.** `createEngine` refuses `admitStipulatedAnswers: true` unless
  its store reports that it is not durable. This needs a new REQUIRED member on the storage port; an adapter that does
  not report, or reports unknown, counts as durable, so the flag is refused. The SQLite adapter derives the answer from
  the connection it actually opened — `PRAGMA database_list`: a non-empty `file` is durable; `:memory:` and `''` are
  not — never from its constructor's arguments, since a driver can be injected with no filename. A fork's overlay
  reports its base's. So no stipulated SATISFIED outlives its process, under any host — the three-tier condition the
  sponsor attached to `REG-D-041`.
- **The host's: an admitting engine is a TEST engine.** The engine cannot know that: the demo's ordinary boot, every
  vitest engine and a SaaS host's ephemeral engines are all in-memory. The demo host sets the flag only when
  `isTestMode()`; a host that set it otherwise would admit stipulations in memory, and nothing in the core refuses it.

**The enumeration hazard, restated correctly.** A field left out of `createEngine`'s enumeration (`engine.ts:187-196`)
reaches neither the parent's `Engine` nor a fork's, because a fork is `createEngine({...deps, store})` and runs the same
enumeration — so the omission fails closed for both. The parent and a fork diverge only through an override in
`fork()`'s spread (`engine.ts:219-223`); the guard's mutant sits there.

### 4.4 What the product says about it

The disclosure is carried wherever the verdict is shown, not only in the record (`B7`, `V1`):
- `FloorView` and `loadPwaFloor` carry, per policy, how many mandatory rows were evaluated and how many stipulated;
- the SSE floor line keeps its prefix and says the truth — on the graph arm, *"⚖ Assurance floor SATISFIED (test mode)
  — schema and provenance pass; reasoning review: 2 criteria evaluated, 7 stipulated by the test, not reviewed."*; the
  counts follow the arm and branch — and the transcript, which `recordConversation` commits, records that line;
- the *"✓ Assured candidate"* line and the PWA panel carry the same disclosure beside the ✓;
- **the Undertaking page's Assurance tab**, where a work-product verdict is shown beside its validator identity from
  the §38 view (which folds no criterion events today), shows the same counts — the view gains that fold.

⚠ **What it does not change:** the assessment's own state — the one field every gate reads — says SATISFIED, with no
mark (option C was rejected, §4.2). The prefix is kept so `assurance-floor:70` and `assurance-floor-waiver:70` still
match; Q6 lists them anyway.

### 4.5 How a test states its stipulation

| channel | reaches both arms? | durable-store exposure | independence | verdict |
|---|---|---|---|---|
| inside the plan JSON the mock agent reads | graph arm only | — | ⛔ the instruction IS the reviewer's `prompt` (`agent/+server.ts:130`) — shared prompt lineage, an `ASR-13` dimension | rejected |
| an env var at webServer boot | yes | none | fine | rejected: per process, not per test |
| **a route, `/test-api/reviewer-script`** | yes | refused | a channel the producer never sees | **recommended** |

- The route **gates on `isTestMode()`, not `harnessExposed()`** — so it answers 404 on the durable live-execution
  server — and refuses a durable store as well. It does answer on the live authoring lane, which is test mode; none of
  that lane's specs registers anything, so its reviews stay INCONCLUSIVE, as they are with the mock today.
- **Keyed by (PWA, framing)**: `{ pwaId, framing: 'PWA_GRAPH' | 'WORK_PRODUCT', remaining: 'CLEAN' }`. A registration
  answers only the arm it names.
- **The registry belongs to the canonical engine handle** — the one a reset replaces — so a reset discards it by
  construction. **The stand-in consults it there, not on the fork it records into**: on an authoring turn the floor
  records into the turn's fork, which is a new handle. The registry refuses a PWA id the current engine does not hold;
  test-mode ids restart at every reset (`workbench.ts:326-327`), so a stale registration would otherwise answer a later
  test's PWA that got the same id.
- **Specs register through a harness helper, in the test body**, after the reset and after the PWA exists, reading its
  id from the store — never computing it, and never at `describe` or `beforeAll` level, which the first reset would
  wipe. The lane control reads registrations back from the server's registry (§4.8).
- **The work-product arm finds its PWA** from `artifact.producingPwuId` through the work unit and its undertaking —
  verified in J1-2 before anything relies on it.
- No stipulation digest is written into the SSE stream as a `sha256:` string: `acceptAgentCandidate` takes the first
  one it finds (`harness.ts:95`).

### 4.6 What each browser test becomes

- **The eleven** register `(PWA, PWA_GRAPH)` in their bodies. Their assertions are unchanged. The three waiver tests'
  read-backs (`:70`, `:217`) are rendering checks of a disclosed stipulation; Q6 lists them.
- **assurance-floor, clean graph.** Title restated to what it can prove — *"a clean graph with a stipulated remainder is
  SATISFIED in a test engine, recorded canonically, and publishes"* — and it gains the assertions that make it honest:
  the reasoning-review assessment's criterion events show the checker's two criteria `MET` with no stipulation and the
  other seven `UNABLE_TO_DETERMINE` stipulated `MET`; and the SSE line names the counts.
- **execution-model-invocation**, treated the same way: its banner (`:221`) and its `:235` message restated to
  *"completed because the floor composed SATISFIED from the checker's real answers and a stipulated remainder"*, and the
  same assertions for the work-product arm (RR-04 and RR-01 evaluated; seven stipulated).
- **assurance-floor, dead end** (passing). Registers the clean stipulation, must still see REJECTED, and gains the
  assertion that RR-04's criterion event is `NOT_MET` with no stipulation. The REJECTED comes from the open BLOCKING
  observation, so a derivation mutant that REPLACES the checker's RR-04 row is killed by the verdict and one that
  APPENDS a stipulated RR-04 after it is killed by that new assertion (§9).
- **execution-agent-authored-binding.** Registers `(PWA, PWA_GRAPH)` only; its work-product review stays unstipulated
  and INCONCLUSIVE, as today, and nothing asserts on it.
- **Unchanged:** the orphan test (the schema-invariant validator rejects alone), editors-locked and the gallery (no
  verdict asserted, no stipulation), and the `s01` Slice (no reasoning reviewer).
- **undertaking-scroll** is not a reviewer test: it calls no reviewer, and its red on the stand-in lanes was their
  tracing (`REG-F-444`: tracing off, 0 of 5; the gate's tracing, 5 of 5, same reviewer). It stays green in the gate;
  its synchronisation defect is filed.
- **Every spec, and `e2e/support/gallery.ts`, imports `test` from the harness module** (§4.8) — a one-line change in 43
  files.

**The prediction, with its evidence stated exactly.** All thirteen are predicted green.
- **The twelve authoring-arm tests** rest on `REG-F-435`'s approve-everything run, which turned them green — but out of
  process on the `agy` path, with tracing off, and at `748ad162`, before the whole `REG-D-070` acceptance rewrite
  (`DD-0`..`DD-6b`, the 4th to 13th commits after it) that every one of them goes through. Today's gate run adds that
  the checker passes RR-04 and RR-09 on every one of their drafts: all twelve are INCONCLUSIVE, none REJECTED. So the
  prediction is supported, not measured on this route.
- **The thirteenth** is red on the gate's lane because the in-process review is INCONCLUSIVE (`:235`, both attempts).
  It goes green only through the work-product stipulation, and **it has never been seen green on any lane**: the
  approve-everything run died earlier, at `:233`, on a race that exists only out of process.

**J1-4 — the races, fixed on their own evidence.** Each fix is shown red first on a route that exposes its race:
- the two **Begin & Execute** sites (`execution-model-invocation:71→75`, `execution-agent-authored-binding:101-103→106`),
  under a test-mode delay injected into the work-product floor;
- the **"Accept exact candidate"** click sites that introspect straight after the click (among them
  `agent-retention:51→52` and `execution-agent-authored-binding:68→73`), under a test-mode delay injected into the
  accept action's `commitAuthoringTurn` path (`pwa/[id]/+page.server.ts:518-525`) — the work-product floor never runs
  there.
Each then waits for the action's response or the banner's change before introspecting.

### 4.7 What this design does not change, and says so

- **The waiver tests' hand-written BLOCKING finding** (`/test-api/dispatch`). A fixture arranging canonical state
  through the command bus to BLOCK; it now cannot carry a stipulation (§4.3), and §4.8's second limb makes "nothing else
  on the lane is SATISFIED" a checked property.
- **Unit tests' `clearingJudgement` and `REG-D-066`'s derived literals**, routed through the real adapter and recorded
  as evaluated `MET`, as today — *"legitimate for unit arrangements"*, and Q2 (b) keeps that. Under D nothing re-means
  them. Moving them onto stipulations is possible later; not here.
- **The reference seed's hand-written SATISFIED** (`reference-undertaking.ts:637-676`) never reaches a reviewer
  (`REG-F-424` (2)); it keeps its own remedy, and §4.8 counts it as a named exclusion.
- **`REG-F-418`** — the mock still recommends SATISFIED on clean arms while examining two of nine. The stand-in does
  not (§4.1 rule 6); the mock's own defect stays open.
- **`REG-F-441`'s program swap** keeps its own design; this one relies on it nowhere, and one lane mutant uses exactly
  that shape.

### 4.8 The controls that replace what the red gate used to say

- **The checker control** (`default-lane-cannot-assure.test.ts`) measures the CHECKER, not the lane (`:75`). It stays —
  the checker still judges two of nine — retitled to what it measures, and its deletion instruction becomes *"delete
  when the checker itself is replaced, or judges all nine"* (Q3c).
- **The lane control.** Every e2e spec, and `e2e/support/gallery.ts`, imports `test` from the harness module, which
  extends Playwright's with an automatic fixture. **A verif census fails when any file under `e2e/` other than the
  harness module imports `test` from `@playwright/test`** (with its own mutant), so no current or future spec escapes
  it; the live lanes (`e2e-live*/`) are outside it and run no stipulations. The fixture's teardown runs after each
  test's `afterEach` hooks and before the next test's `beforeEach` — so after each test and before the next reset — and
  introspects every SATISFIED `floor.reasoning-review` assessment: canonical ones, and a staged candidate's.
  `/test-api/introspect` is extended to expose a staged candidate's criterion events (today it returns a candidate's
  object state only, `introspect/+server.ts:62-75`), the stipulation registry, and the event-log mark the last reset
  recorded.
  - **Limb 1.** Each one completed under `standin.reasoning-review` rests on at least one stipulated AND at least one
    evaluated mandatory row, **and on a registration** for its PWA and arm — read from the server's registry, which a
    reset discards — so a stipulation over an unread subject, a completion with no real judgement, or a stand-in that
    stipulates for a PWA nobody registered, reddens.
  - **Limb 2.** No other SATISFIED `floor.reasoning-review` exists, except the reference seed's. **The baseline is kept
    by the server**: at the end of every reset the server records the event-log position, and `/test-api/introspect`
    reports it; both limbs consider only assessments completed after that mark, so the seed's are excluded by position.
    Not by the fixture's own setup, which runs before the test's `beforeEach` and would see the previous test's state
    (ids restart at every reset, so a baseline read then would exclude ids the next test re-mints); and not in
    worker-local state, which a retry's new worker would lose — `smoke.e2e.ts` never resets, and a retry of it would
    otherwise read an empty baseline over the seed's records. The exclusion is structural, not keyed on a name a writer
    could copy.
  - **Its mutants sit at the lane's own seams:** the stand-in records stipulated rows as `MET`; the stand-in stipulates
    over an unreadable subject; the stand-in stipulates for an unregistered PWA; the registry selects the real adapter
    with an injected all-clean `print` (the `REG-F-435` / `REG-F-441` shape); the checker claims all nine;
    `/test-api/dispatch` admits a stipulated row; the baseline is taken from worker state or at fixture setup rather than
    from the server's reset mark (killed by a two-test arrangement in which the second test re-mints the first test's
    ids, and by a retry of a non-resetting test).
  - **Its threat model:** an undisclosed pass arising from a regression in the product, the stand-in or the lane's
    configuration. A spec author deliberately forging records is a code-review matter.
- **`HARMONIZATION-LOG`'s objection applies.** The lane control is a green assertion of a known incapacity — close to
  the *"green suite concealing non-enforcement"* the log rejected. It differs in that every pass is disclosed as
  stipulated and the capability claim moves into a gate of its own (Job 2). **Q9 (d) asks you whether that difference
  is enough.**
- **`reviewer-silence-is-not-a-pass.test.ts`** (`R26` at the mapper) is unchanged; a sibling pins that a stipulated row
  is not a pass for an engine that does not admit it.

---

## 5. Job 2 — qualifying the reviewer

### 5.1 What a run measures, and what must be escalated

For one candidate (a model behind a transport) and one reviewer definition (§5.5), over the case set (§5.2), scored
through the product's own rules:

1. **Contract** — a row for every criterion, well-formed; the `REG-F-428` malformation classes counted separately, so
   *"judged wrong"* and *"the product discarded what it said"* stay distinguishable.
2. **Discrimination** — on each planted-defect case, the planted criterion is faulted and the floor is not SATISFIED.
3. **Clean acceptance** — on each clean case (with a TRUE reasoning account), SATISFIED.
4. **Name invariance** — renamed copies reach the same outcome.
5. **Reproducibility** — repeated runs reach the same outcome.
6. **Boundedness** — every call answers within the transport's wall-clock bound: the product's 240 s kill, and `agy`'s
   own 3-minute print timeout on the `agy` path. A call that does not — a timeout, a refusal — still counts as the case
   having been MEASURED, and is a Boundedness failure. (The 28,000-character limit is on the PROMPT, and is a
   precondition on cases, not a measure of candidates.)

**Reported, not ranked, and not thresholded** in the first version: ranking would invent the weighting the corpus
withholds, and thresholds are oracle content for the sponsor to confer (Q7).

**But not silent.** `REG-Q-025` binds *"escalate material failure"*, and `DOC-004:241` forbids a prompt change that
*"silently degrade[s] behavior"*. So each of the following is a **material failure that must be escalated as a
register finding**, judged against the current oracle, with no weighting invented:
- **absolute:** a planted defect not faulted; a clean case not SATISFIED; a verdict that changes with the name; a
  Boundedness failure;
- **transitions**, evaluated **only when a run repeats a candidate** — keyed on (provider, model label, served-model
  digest) — against that candidate's previous run, and only for cases whose content is unchanged: a planted criterion
  that was faulted and now is not; a clean case that was SATISFIED and now is not; a well-formed reply that now counts a
  malformation class; repetitions that agreed and now disagree; a reply within the bound that is now past it; an
  answered criterion now `UNABLE_TO_DETERMINE`. A prompt change covered by a DIFFERENT candidate from last time is
  therefore not compared for degradation; the report says so. Changes of served template, server version or options are
  reported as confounds, not as a new candidate; added and removed cases are listed; and for a served template that
  injects the date, the report says so, because `REG-F-429` measured verdicts moving across a day boundary with nothing
  else changed.

Any ORDERING between two dispositions beyond these transitions is oracle content, and stays with the sponsor (Q7).

### 5.2 The case set

- **A case is DATA; only the reviewer-side assembly runs through product code.**
  - *Graph arm:* a graph export with fixed ids, or the export's node projection factored into a pure function over
    fixture rows with fixed ids (outside test mode ids are random, and a case must materialize the same prompt every
    run); literal intent, rationale, narration and prior gaps; a fixed or absent `candidateSubjectHash`; a fixed
    producer identity and semantic version.
  - *Work-product arm:* literal producing prompt, answer, rationale and prior gaps, and a fixed producer identity —
    never re-rendered, so a change to the producer's template does not move the reviewer's fingerprint.
  - *Factored out, into one module whose imports exclude `authoring-turn.ts` and every `$lib` specifier:* the content
    wrappers now inline in `runPwaFloor` (`apps floor.ts:398-413`) and `runWorkProductFloor`
    (`work-product-floor.ts:159-181`). The route-level pieces — narration, the subject hash, the agent's rationale —
    stay in the route; a case supplies them as literals.
- **What a case measures** is the Reasoning Review policy's disposition from `composeAssuranceOutcome` over that
  policy's reference alone (`packages/rph-assurance/src/floor.ts:56`), so no fact for the other two policies is
  fabricated.
- **Each case carries its oracle:** the criteria it expects faulted, the disposition it expects, and whether that
  expectation is *uncontested* or *the author's claim* (`REG-F-427` (4) calls the dead-end verdict *"the spec's claim
  … not a universal one"*). Oracles are versioned separately from the cases (§5.4).
- **Version one: about 26 cases** — on each of the graph and work-product arms, one clean case with a true reasoning
  account and three renamed copies of it, and one planted-defect case per RR criterion (each is constructible on both
  arms from the criterion's text; RR-05 on the graph arm only through intent and rationale). The process-result arm
  follows once it has a production case to model. **The lane's own drafts are not cases** (`REG-F-440`). Q9 (b) offers a
  smaller first set of about 15.
- **Held out** (`REG-Q-025`: *"Run held-out canaries"*; Guide §8.8). A second tier — deferred in version one if the
  sponsor rules Q7 (b) (i), as recommended.
  When it exists: the sponsor authors it and keeps it where the agent that tunes the reviewer's prompt cannot read it,
  and runs it there; its records are their own kind (§5.4), carrying only aggregate counts — per-case results would
  copy held-out content into the repository and give whoever tunes the prompt a pattern to fit; and its failures are
  escalated in aggregate form — a register finding carrying counts only (*"k of m planted defects undetected in
  held-out run R"*). ⚠ "Outside the repository" alone is not held out: it hides the cases from readers of the
  repository, not from an agent with filesystem access on the sponsor's machine. **And the tracked set is not held out
  either: it is visible to whoever tunes the prompt.** So version one defers `REG-Q-025`'s "Run held-out canaries", and
  says so.
- **Oracle integrity** (`DOC-004:256`; the Virtuous Cycle harness): the change that edits the reviewer's prompt,
  criteria or scoring may not edit the case set in the same increment; new cases are proposed oracle content until the
  sponsor confers them.

### 5.3 The runner

- **Through the product's real path**: the real validator with a transport injected at its `print` seam — made
  injectable *"so the §14.3 conformance scenario can exercise the REAL Validator path"*
  (`reasoning-review-validator.ts:279`) — then scoring through the exported `composeAssuranceOutcome`, never a re-typed
  argument list. The validator is constructed with the run's recorded evaluator identity, never through `judgeModel()`.
- **Two kinds of transport.** The product's own `agyPrint` and `devinPrint`, with their production identities and
  bounds, for candidates that could be deployed. A harness Ollama transport for exploratory local candidates, whose
  records are marked **not deployable** — the product has no local reviewer backend, so a report the sponsor can pick
  the deployed reviewer from costs frontier calls. **Never** through `JPWB_AGY_BIN` (`REG-F-441`). A *harness identity*
  — refused in a record — means a stub or synthetic provider label; a real Ollama model with its served digest is
  admitted, marked not deployable.
- **Bounds** of whichever product transport the candidate stands in for, re-imposed (an injected `print` bypasses
  them).
- **Pinning.** Local models are unloaded before each call (`REG-F-427` measured this pins within a day), and a run must
  finish within one server-clock day, recording the served template's hash per call (`REG-F-429`).
- **Retention.** Only the answer span (`splitAnswerSpan(raw).answer`) enters a tracked record. Reasoning — in its own
  field or inline — never enters a tracked record and never feeds a measure; it may be kept out of the tree for offline
  diagnosis, which `PER-12` permits (*"retained where available, quarantined from assurance, and usable only for
  offline diagnosis"*, `DOC-003:381`), or discarded.
- **Cost**, from `REG-F-427`'s recorded figures (a median of 18 s per review; 1 to 5 of 16 prompts looping at 240 s):
  version one's 26 cases at two repetitions are about 52 calls per candidate — **about half an hour to an hour and a
  quarter per local model** on the shared server, which serves one request at a time. A frontier candidate is the same
  52 calls, with prompts of about 4,000 to 26,000 characters each, paid per call.

### 5.4 The record

Append-only NDJSON under `docs/tracking/reviewer-qualification/`. Line kinds:
- **RUN (tracked)** — run id, date, commit, the reviewer fingerprint and the case-set digest (§5.5), the oracle version,
  the candidate's identity (provider, model label, served-model digest, served template hash, server version, options)
  and whether it is deployable.
- **CALL** — one per model call: run id, case id, repetition, role (initial or repair), the hash of the prompt actually
  sent, the answer span — or a transport-failure class (timeout, refusal), marked not re-scorable and carried as
  recorded — the resolved evaluator identity, and **the per-criterion outcome tuple and the disposition as scored at run
  time, with the scoring digest they were scored under**. Recording the run-time outcome is what lets a later
  re-scoring be compared with something (§5.6 limb 2).
- **ESCALATION** — (run id, case ids or a held-out count) → the register finding filed for it. Appended after the run,
  in the same increment.
- **RESCORED** — a record re-derived from its recorded answer spans through a changed scoring path, with no model call,
  stamped with the current fingerprint; it names its source record and the scoring digest it used, and needs no
  finding (§5.6).
- **ACKNOWLEDGED** — for a fingerprint move confined to the probe set (§5.6 limb 1): the new fingerprint, and either the
  case added to exercise the change or the reason none is needed.
- **SUPERSEDED** — names a record that no longer reproduces and the register finding that says why. It is refused while
  the named record still has an un-cited material failure. Records are struck this way, never deleted.
- **HELD_OUT** — (when the tier exists) run id, date, reviewer fingerprint, and a count for each material-failure class;
  no case ids, statements or per-case outcomes.

**Measures are computed at report time from the recorded run-time outcomes and the current oracle version**, and the
report names that version, so a corrected oracle never leaves a stale figure standing. All of it is candidate
engineering Evidence (`REG-Q-025`): never an `ASSURANCE_OBSERVATION`, never read by the product.

### 5.5 The fingerprints

- **The reviewer fingerprint** — what decides a verdict, at the grain of behaviour:
  - the materialized prompts of a **fingerprint probe set**, separate from the qualification cases and chosen to cover
    every branch of prompt assembly: each framing (the process-result arm with each observation kind, and its
    absent-report rendering), rationale absent and present (the *"NOT DECLARED"* instruction is what fifteen of sixteen
    lane prompts carried), prior gaps present, and — per framing — one probe with every slice oversize at once, since
    the content budget is capped by three terms and a one-input-at-a-time probe reaches only one of them;
  - **the excerpt budget constants themselves**, hashed explicitly;
  - the seed criteria as whole objects — id, description, `severityIfNotMet` (it decides mandatoriness) and
    `evaluationMethod`;
  - a **scoring digest**: a fixed corpus of RAW reply strings driven through the real validator's `print` seam —
    including each `REG-F-428` class (duplicate key, unknown and corrupted id, non-boolean `failed`, fenced JSON,
    prose-wrapped JSON) and one reply that fails the first parse, with the repair prompt captured — and the outcomes
    hashed as tuples of (aggregate, per-policy disposition, per-criterion outcome) only.
- **The case-set digest** — over each case's inputs as the reviewer sees them, **not over its oracle**. Correcting an
  oracle moves no digest; it changes what the escalation limb finds, which is cheap and correct.
- **Out of scope, stated:** the transports' bounds and argv (recorded in each run's candidate identity instead); **the
  model** — a change of model moves no fingerprint; and a durable deployment seeded before a criteria change, which runs
  the old rubric forever because the floor policy is locked (§3.5), so a record for the current fingerprint does not
  qualify it.
- Per `PER-9`, a fingerprint *identifies* a record and never substitutes for one.

### 5.6 The trigger

**`reviewer:qual:check`, a static check that runs no model.** Every record not SUPERSEDED is in its population, whatever
fingerprint it carries — **so whether a failure has been written up is a property of the record that holds it, not of
the definition currently in force**, and no later change of definition, acknowledgement or re-run can retire it. Its
limbs:
1. **Coverage.** Every current case — by its current materialized-prompt hash — has been MEASURED (answered, or failed
   at the transport, §5.1) in a RUN, or in a RESCORED record, carrying the current fingerprint. Model calls are owed only
   for what actually changed:
   - a **scoring-only** move (every case prompt unchanged) is discharged by a RESCORED record, re-derived from the
     recorded spans with no model call and stamped with the current fingerprint — except where a first try's parse
     outcome changed, which owes the repair call;
   - a move **only in the probe set** (a branch no case exercises — the process-result arm, an oversize budget) owes no
     model call, but reddens until an ACKNOWLEDGED line names the new fingerprint and either adds a case that exercises
     the change or says why none is needed, and until a RESCORED record re-stamps the unchanged cases under it;
   - otherwise, a run over the changed cases, with the unchanged ones re-stamped by RESCORED.
2. **Reproduction** — scoped, unlike limb 3, to the records that carry the **current** fingerprint and to the source
   records of current RESCORED lines, because only there is a mismatch unexpected. For those, and for each case whose
   content is unchanged: the recorded prompt hash matches a recomputation; and wherever the record's recorded scoring
   digest equals the current one, each re-scorable answer span, re-scored through the current path, reproduces the
   outcome **recorded at run time**. A mismatch there means a change reached the prompt or the scoring without moving
   the fingerprint — a real non-reproduction — discharged only by a SUPERSEDED line with a register finding, which the
   check accepts only if the named record really fails this limb, and after which that record stops counting for
   coverage. An old record under an earlier fingerprint is not compared against today's prompts or scoring: a deliberate
   change is expected to differ from it. A RESCORED line names its source record and the scoring digest it was
   re-derived under, and needs no finding — it is the expected discharge of a scoring move.
3. **Escalation.** Every material failure (§5.1) in every record not superseded — tracked, and held-out when that tier
   exists — has an ESCALATION line citing a register finding. **Intermediate runs are included**, so a drop introduced
   in one run of a run-edit-run increment is escalated there, not lost because the final run shows no further
   transition.

**What the first run must include** is the sponsor's choice (Q7 (d)); under the recommended option a verif pin checks
it (§6), and if the sponsor chooses option (ii), limb 1 gains the condition that the covering RUN is deployable.

**Where it runs.** `gate:fast`'s tail becomes `… && bun run coverage:floor:check && cd apps/rph-demo && bun run check &&
cd ../.. && bun run gate:tail`, where **`gate:tail`** is a root script that runs `reviewer:qual:check` from the
repository root and `bun run e2e` in `apps/rph-demo`, and **exits non-zero if either failed** — so an e2e red cannot
skip the check, and a red check cannot hide the browser tests. Placed early, a red check would blind everything after
it; appended after e2e, any e2e red would skip it without a word. The composition pin (`verif/assurance-surface.test.ts`)
records the new step list and this argument for the position; `REQUIRED_ROOT_COMMANDS` goes from 10 to 12
(`reviewer:qual:check`, `gate:tail`) and `VERIF_TEST_FLOOR` rises with the new verif tests. Each failure limb is driven
on temporary fixtures, as the `120d4ce6` / `ea99ff28` steps are; the check's builders live in the module of §5.2, with a
guard that it imports only that module, the validator and packages.

**What it is and is not.** *"never the guarantee"* (`DOC-004:258`): nothing runs it but a person (`REG-F-419`). It cannot
verify that replies came from the model named, nor that a run happened at all rather than a well-formed record being
written — that residual is recorded with the interim carrier. **It never forces a reviewer to be good**: once the
current definition is covered and every failure is written up, it is green whatever the runs found. Limb 3 reddens on
what a measurement FOUND until it is written up; it clears by filing, not by passing — Q8 (b) asks whether that is
compatible with *"never hard-block"*. The artifacts that transfer to the platform are the record format and **one
exported fingerprint function** shared by the check, the runner and any later product-side check; the planned transfer
is a product-side check computed over the STORED policy (Q10).

---

## 6. Order of work (for the roadmap)

| inc | content | depends on |
|---|---|---|
| J1-1 | (i) the `stipulated` field threaded and the admitting flag carried, with no behaviour; (ii) the ladder's admitting branch, its red shown after (i); (iii) Gate E's admitting branch, scoped to `floor.reasoning-review`, likewise; (iv) the storage port's durability report and `createEngine`'s refusal, including the fork path and a driver-injected file store; (v) `/test-api/dispatch` refuses a request carrying `stipulated`, before dispatching anything; (vi) the verif census of stipulation writers | ratification |
| J1-2 | the stand-in (rules 1–6); its selection under `isTestMode()`; the route, its harness helper and the canonical-handle registry; the disclosure text on every surface of §4.4; the unit-test blast radius (the twelve opted-in files) measured; **the sequencing pin** (below) | J1-1 |
| J1-3 | the specs register stipulations; `assurance-floor` and `execution-model-invocation` restated; 43 files import the harness `test`, with the census; introspect exposes candidates' criterion events; the lane control; the checker control retitled | J1-2, **J2-4** |
| J1-4 | the races, each shown red first on its own route | none |
| J2-1 | the factored builders; case set v1; **the sponsor confers it** | ratification |
| J2-2 | runner, transports, record format | J2-1 |
| J2-3 + J2-4 | fingerprints, the trigger and `gate:tail`, **landed together with the first recorded run and its escalations** | J2-2 |

⛔ **Sequencing (Q9 (a)): J1-3 lands after J2-4, enforced by a verif pin that exists before J1-3 can.** The pin lands in
J1-2, with the route. It is red if any **spec file** (`*.e2e.ts` under `apps/rph-demo/e2e/`) calls the route's harness
helper while `gate:fast` — resolved transitively through the `bun run` steps it names, so through `gate:tail` — does not
run `reviewer:qual:check`, or while `docs/tracking/reviewer-qualification/` holds no RUN line — and, under Q7 (d) (iii),
while no RUN line marked deployable exists. The harness module that defines the helper is exempt by path; it calls the
route by construction. The pin is shown red first by a probe spec that registers before the check exists, with the
harness module exempted, and a mutant drops the exemption. A local RUN appended before the frontier one does not
matter: the condition is that a deployable RUN exists, not that it came first. It runs in `bun run test`, which is already in `gate:fast` and does not depend on the check. (An
earlier revision put this rule inside the check itself, where it could never fail: before the check exists there is no
limb to redden, and after, both conditions always hold.) The lane's greens can be observed locally while J1-3 is being
built; they are committed after J2-4.

---

## 7. For ratification

### 7.0 The ruling sheet

| Q | what you rule | recommended | what it costs or sets aside | what it gates |
|---|---|---|---|---|
| Q1 | the lane proves handling; qualification measures earning | adopt | — | everything below |
| Q2 | `REG-D-068` withdrawn and narrowed; the canon reading; independence as a label | (a), (b), (c), (e) | `ASR-2`/`ASR-9` in test engines; independence on the lane | Job 1 |
| Q3a | Job 1 keeps what `R26` chose, and is not its option 3 | yes (`R26`'s words: `REG-F-446`) | — | Job 1 |
| Q3b | `REG-D-067`'s successor | (i) replace it | the end state of a real reviewer on the lane | — |
| Q3c | checker control kept; owed check struck at first green | adopt | — | — |
| Q4 | the record form | D | a contract change to two unratified payloads | Job 1 |
| Q5 | the one permission, conditional on the durability lock; the reach of the 2026-08-20 ruling | (a) with (b); (c) | `ASR-3`, Guide §8.4, in test engines; `REG-D-067`'s product-plane line | Job 1 |
| Q6a | ordinary test changes | authorize | — | Job 1 |
| Q6b | two tests restated to weaker claims | authorize, with Q9 (a) or (b) | `DOC-004:237`, `HARMONIZATION-LOG:448-449` | those two greens |
| Q7 | qualification scope | (a) escalation; (b) (i) defer held-out; (c) authorize one frontier run; (d) (iii) | `REG-Q-025`'s held-out clause, deferred; one paid run | the first green |
| Q8 | the trigger against `REG-Q-025`'s "never hard-block" | (a) (i); (b) yes | a red after every reviewer-definition change | — |
| Q9 | the order; the principle | (a); (d) yes | — | the first green |
| Q10 | a later product warning | yes, after Job 2 | — | — |

### 7.1 The questions

**Q1 — `REG-F-424`'s question.** The default lane's browser tests prove the product HANDLES a reviewer's verdict;
whether a reviewer can EARN one is measured by qualification and judged by you from its report. *Recommended: adopt.*

**Q2 — `REG-D-068`, and the reading of canon it needs.**
- (a) Withdraw replay (never built), superseded by this design.
- (b) Narrow *"A hand-written judgement is NOT licensed"* to: *a stipulated answer is licensed in a test engine when
  recorded as `UNABLE_TO_DETERMINE` with the stipulation beside it, and counts for nothing anywhere else; hand-written
  replies in unit arrangements remain legitimate as `REG-D-066` derives them, recorded as today.*
- (c) Adopt the reading this rests on: **a validator double's answer is an answer inside a test (`DOC-004:238`).** In
  test engines this sets aside `ASR-2` — *"Partial output — an unanswered mandatory criterion — is invalid output"* —
  and `ASR-9` — *"Unable-to-determine is never treated as met"* — for the stipulated rows; everywhere else both apply
  unchanged.
- (d) Know that the lane will stipulate clean answers on drafts that a real reviewer could lawfully refuse — every lane
  draft (`REG-F-440`), and two explicitly deficient: `pwa-coherence`'s graph, which its own spec calls *"not
  COHERENT"*, and a fixture work product whose own code says it *"performs no analysis"* — because those tests check
  what the product does after acceptance, not whether the draft deserves it.
- (e) **Accept that on the lane, independence is a label** — the stand-in names no model and one author writes both
  the plan and the stipulation — because a stipulation counts nowhere else?
*Recommended: (a), (b), (c), (e).*

**Q3a — `R26`, and what `REG-D-067` costed.** `R26` was a choice of one option in four (verbatim in §3.4 and
`REG-F-446`): the checker declares only what it examined and the gate goes red, with *"Red should land on a branch."*
Not chosen were option 2, *"Split the rubric"* — the judgement criteria *"visibly deferred to a live reviewer"*, which
*"needs a ratified way to say 'outside my competence'"* — and option 3, the checker claiming all nine. ⛔ Revision 4
said here that you had *"rejected, by name"* three phrases; those were the agent's words, not yours (`REG-F-446`). And
`REG-D-067` costed and killed two alternatives: replay (the fabrication) and *"Scope out via policy severity"* (the
disarm).
- **What `R26` chose is kept.** The checker still declares only its two per arm, and absence still reads
  `UNABLE_TO_DETERMINE` in every engine.
- **Nearest to option 2.** Job 1 records the seven as judged by nobody and defers them visibly — to qualification, not
  to a live reviewer on the lane — and the stipulation beside the row is, in test engines only, the way of saying so
  that option 2 lacked.
- **Fabrication.** The record does not claim the seven were evaluated: it says `UNABLE_TO_DETERMINE`, with the
  stipulation beside it, and every screen says *"stipulated by the test, not reviewed"*. The stand-in's own
  recommendation is derived, so it recommends no verdict it did not earn. (The mock keeps `REG-F-418`'s shape; that
  entry stays open.) ⚠ At the grain every gate reads — the assessment's state — a stipulated pass still reads
  SATISFIED with no mark; the disclosure lives in the criterion rows, the status text and the panels.
- **Disarming.** On the gate's lane, **in a test engine, this has the scope-out's effect on the seven**: the floor is
  satisfied over criteria nobody judged. It differs in the two ways that alternative was killed. A stipulation can
  never cover a criterion the checker judged, or a draft it could not read, so **no rejection is overruled** (the
  dead-end test proves it). And the live-execution lane — the one `REG-D-067` said *can* judge — is not test mode and is
  durable, so it neither admits stipulations nor exposes the route; **the live lanes' verdicts are untouched**. (The
  live authoring lane is test mode and runs the stand-in in an admitting engine, but none of its specs registers a
  stipulation, so its reviews stay INCONCLUSIVE, as with the mock today.) It also changes no policy's severity, and it
  is per test and disclosed.
- **Is that enough to make Job 1 consistent with what you chose, and not option 3?**
*Recommended: yes.* (Revision 4 also asked you to state `R26`'s words; the session record holds them, and `REG-F-446`
carries them.)

**Q3b — `REG-D-067`'s named successor**, *"a reviewer on the gate's default lane that evaluates every mandatory
criterion"*.
- (i) Replace it with Job 1 plus Job 2 — consistent with Q1, which says the lane proves handling.
- (ii) Keep it owed as the end state, with only Job 1 as the interim. Its arrival would then require: qualifying that
  reviewer through Job 2 (which stays permanent either way); lane drafts that have correct verdicts (`REG-F-440`);
  retiring the stand-in and the lane control; reverting the two restatements; and revisiting Q1.
*Recommended: (i).*

**Q3c — the checker control and the owed check.** Keep `default-lane-cannot-assure.test.ts`, retitled to what it
measures, with the deletion instruction *"delete when the checker itself is replaced, or judges all nine"*. Strike
`REG-D-067`'s owed check that the failing-spec set has not grown **when the lane is first observed green in a committed
gate run** (J1-3), not on ratification — until then its reason stands. *Recommended: adopt.*

**Q4 — how a stipulation is recorded.** D (recommended): `UNABLE_TO_DETERMINE` plus an optional `stipulated: 'MET'` on
the authored criterion command and event — outside test engines `ASR-9`'s values and meanings untouched; the programme's
authority for the payloads. A: a sixth `ASR-9` value — a canon amendment. B (revision 1): `MET` plus a mark — rejected
(§4.2). *Recommended: D.*

**Q5 — the one permission, and its lock.**
- (a) Accept that, **in engines built to admit stipulations**, two of the domain's own checks — the verdict ladder and
  Gate E's fold, the latter only for `floor.reasoning-review` — take a branch that counts a stipulated row as met, so a
  stipulated answer satisfies the mandatory floor there. That sets aside, in those engines, `ASR-3` — *"No PWA profile,
  low-risk classification, planner optimization, or local agent instruction may suppress the floor"* — and Guide §8.4
  — *"A missing … required review cannot satisfy assurance or permit its protected transition"* — and gives up
  `REG-D-067`'s *"none of it in the PRODUCT plane"*. This design
  holds that it changes which answers count and is not a double for a domain boundary; canon's *"never for the domain's
  own boundaries"* can be read the other way. The ruling is yours.
- (b) **(a) is conditional on (b).** The engine refuses the flag over any store not reporting itself non-durable, so
  "no stipulated pass outlives its process" is the engine's guarantee under every host. (b) is untested; it adds a
  durability report that every storage adapter must give, and one that does not report is treated as durable. That the
  engine is a TEST engine stays the host's fact (the demo sets the flag only in test mode). If (b) cannot be built, (a)
  comes back to you.
- (c) **Your 2026-08-20 ruling is not reached.** *"de minimus floor should never be skippable"* answered whether a
  governed waiver may discharge a failed required floor policy, and was built as reading (b): no waiver discharges one,
  in any engine (`REG-F-202`). Under (a) no waiver is involved, all three floor policies still run in every engine, and
  a failed or inconclusive floor still blocks. This design reads the ruling as not reaching a criterion counted met on
  a test's stipulation inside a test engine; that case is (a)'s, judged against `ASR-3` and §8.4. Revision 4 said (a)
  set the ruling aside, which stretched it past the question it answered (`REG-F-446`).
*Recommended: (a) and (b), together; and (c).*

**Q6a — the ordinary test changes.** Stipulations registered in the twelve authoring-arm specs and the work-product
spec; the dead-end test registering a clean stipulation and asserting its RR-04 row; the waiver read-backs at `:70` and
`:217` of a disclosed stipulation; the races waited on; 43 files importing the harness `test`. Each is a separately
authorized act under `DOC-004:256`, and none weakens an assertion. Under Q9 (a) or (b) they land in J1-3, after the
trigger; the sequencing pin reddens the gate if the registrations land before it. *Recommended: authorize.*

**Q6b — two tests restated to weaker claims.** `assurance-floor`'s clean test and `execution-model-invocation` were
written to claim a reviewer can satisfy the floor. Restated, they prove the product carries a stipulated SATISFIED
through; each gains its stipulation assertions.
- Against: *"A failing required test is never removed, disabled, or weakened solely to obtain passing status"*
  (`DOC-004:237`); *"No increment may turn one green by weakening its assertion — that is the one move this whole
  effort exists to prevent"* (`HARMONIZATION-LOG.md:448-449`).
- For: what they gave up moves to Job 2. **Job 2's trigger forces a recorded measurement of it and the write-up of every
  material failure; nothing enforces that a reviewer CAN satisfy the floor. You judge that from the report.** Whether
  that makes this *"not solely to obtain passing status"* is your ruling.
- An enforced alternative exists, with a cost: the trigger stays red until some DEPLOYABLE candidate's record has every
  clean case SATISFIED — frontier calls on every change to the reviewer's definition, and a gate that could stay red for
  as long as no reviewer is good enough.
- **Conditional on Q9 (a) or (b).** Under Q9 (b) the smaller case set must keep a clean work-product case, or nothing
  measures what `execution-model-invocation` gave up (§5.2 and Q9 (b) keep it). Under any other order these two stay red
  until the trigger and a first run land.
*Recommended: authorize, conditional on Q9 (a) or (b), without the enforced alternative.*

**Q7 — qualification.**
- (a) Report-only in version one, with the mandatory escalation of §5.1 — report-only WITHOUT escalation would be
  contrary to `REG-Q-025`'s binding safe default.
- (b) **The held-out tier.** `REG-Q-025`'s safe default names held-out canaries as the thing to run. The tracked set is
  not held out: whoever tunes the reviewer's prompt — the agent working on your machine — can read it. And a tier kept
  merely "outside the repository" is not held out from that agent either. The real choices:
  - (i) defer the held-out tier in version one, saying so in the register;
  - (ii) a minimal tier you author and keep outside the repository, run by hand — meeting the clause's letter, but
    hidden only from readers of the repository;
  - (iii) cases kept where the agent cannot read them (another machine or account), authored by you in §5.2's format —
    a graph with fixed ids, literal intent and rationale, the expected answers — and run there by you, at about half an
    hour to an hour and a quarter per local model.
  - Under (ii) or (iii), the design adds a coverage condition — a HELD_OUT record for the current fingerprint — so your
    hand-run gates the first green and every later change to the reviewer's definition, and an increment in §6 carries
    your authoring. Under (i), nothing held out gates anything.
- (c) **Frontier runs.** Who may run them, and at what cost: about 52 calls per candidate per run, with prompts of 4,000
  to 26,000 characters. No local model is deployable without a new backing tool.
- (d) **What the first run must include.**
  - (i) any candidate — cheap; the forced measurement may cover only models the product cannot deploy; enforced by
    nothing extra;
  - (ii) a deployable candidate on every change to the reviewer's definition — a paid run each time; enforced by a
    condition added to the trigger's coverage limb;
  - (iii) a deployable candidate in the FIRST run (J2-4), so your first report can inform the choice of deployed model,
    and any candidate after that — enforced once, by the sequencing pin (§6).
*Recommended: (a) yes; (b) (i), with (iii) as the tier's eventual form; (c) authorize one frontier run for (d);
(d) (iii). This puts one paid run, which you authorize, on the path to green.*

**Q8 — the trigger and `REG-Q-025`'s "never hard-block".**
- (a) Limbs 1 and 2 redden on a MISSING or STALE measurement. After a change to the reviewer's definition every gate run
  is red until the changed cases are re-measured — including runs for changes that touch nothing of the reviewer, which
  bears on *"Never auto-reject unrelated subjects"*. How often that happens is unmeasured: the files that define the
  reviewer changed in 17 commits between 2026-09-02 and 2026-09-20, an upper bound, since not every such change moves
  the fingerprint; J2-3 can measure the real rate over past commits. Options: (i) as designed; (ii) red only in a gate
  run whose change touches the fingerprinted components, a warning otherwise — more machinery, and a gate that reads its
  own diff.
- (b) Limb 3 reddens on what a measurement FOUND, until it is written up — it clears by filing, not by passing. Is that
  compatible with *"meta-assurance validators … never hard-block human governance decisions"*?
*Recommended: (a) (i) and (b) yes — both as an interim carrier; the merge stays your act.*

**Q9 — order, and the principle.**
- (a) As §6: the reds go green only once the trigger and a first run exist.
- (b) The same with a smaller first case set — about 15: the *minimal pair* (one clean graph with an honest reasoning
  account, and the same graph with a dead end), one clean work-product case, three renamed copies of the clean graph,
  and one planted defect per criterion on one arm. It shortens J2-1 and J2-4 and your conferral; it measures less
  (name invariance on the graph arm only; no planted defect on the work-product arm).
- (c) Land Job 1 first with the trigger recorded as owed. **(c) does not make the gate green sooner than (a)**: the two
  restated tests stay red until the trigger lands (Q6b), so the gate turns green at the same moment. It would commit
  eleven of the thirteen greens earlier — but only by dropping the sequencing pin (§6), which reddens the gate while
  registrations land ahead of the check, and with it the enforcement of Q7 (d) (iii); and it pays `REG-D-067`'s amnesty
  risk. It is dominated by (a), and this design does not support it.
- (d) **The principle.** `HARMONIZATION-LOG` holds that *"A red gate that tells the truth beats a green one that
  measures nothing"*. This design's answer is a green lane that discloses every stipulation, plus a separate gate that
  measures the reviewer. Do you accept that as not the *"green suite concealing non-enforcement"* the log rejected?
*Recommended: (a); and (d) yes.*

**Q10 — later, a product-side warning.** Should the product WARN — never refuse — when the configured judge model has no
qualification record for the fingerprint of the policy it actually holds? It is the planned destination of the interim
carrier, as `DOC-004:258` requires one; answering *no* leaves the carrier with no planned transfer. And it moves authority
from a merge-time red to a runtime warning — a weaker form, by design, because `REG-Q-025` forbids meta-assurance from
hard-blocking. *Recommended: yes, after Job 2 lands.*

### 7.2 How it was ratified, and the decisions delegated

The sponsor, 2026-09-23, verbatim: *"I reviewed the "JanumiCode\janumiprofessionalworkbench\docs\_working\DESIGN-what-the-tests-prove.md"
document and I found the totality of it to be too complex for me to follow in the time I had available. So we will
proceed with your recommendations you authored. For anything else related that needs my decision or input you will
need to author solutions and use your best judgement."*

So every recommendation above is adopted **as written, not reviewed question by question**. `REG-D-071` records it
that way and lists on its face what the adoption sweeps in. The two steps §1 reserved for the sponsor pass to the agent
under the delegation, each recorded as delegated best judgement flagged for sponsor confirmation, as the register's
front matter requires:
- **conferring the case set** (J2-1). The agent authors and confers it. Because the agent that confers the oracle is
  also the one that could tune the reviewer's prompt, §5.2's oracle-integrity rule is kept strictly: no increment that
  edits the reviewer's prompt, criteria or scoring may edit the cases, and version one tunes nothing.
- **the frontier run** (Q7 (c)): authorized by the adoption — one run of the case set against one deployable
  candidate.

---

## 8. Findings of the review rounds, and where each went

### 8.1 Revision 1 — five lenses and a verifier

**C** canon and register, **K** kernel mechanics, **S** the specs, **Q** qualification, **P** the sponsor's package. 66
findings, 0 BLOCKER. 38 were raised SERIOUS; after verification **28 SERIOUS** (below) and ten re-rated MINOR (C-7..C-10,
S-4, S-5, Q-2, Q-4, P-2, P-5; §8.5).

| id | finding (short) | disposition |
|---|---|---|
| C-1 | option B makes `MET` mean "met" only conditionally, and writes `REG-F-409`'s shape | form D (§4.2) |
| C-2 | the admit flag is a permission; `ASR-3`, §8.4:854, the 2026-08-20 ruling unmentioned | §4.3; §3.4; §1 give-up 2; Q5 (a) |
| C-3 | the texts most adverse to Job 1 left out | §3.4 quotes them (the code guard included); Q3a |
| C-4 | `REG-F-424` (3)'s "capturing nothing"; independence by label | §4.1; Q2 (e) |
| C-5 | *"escalate material failure"* dropped | §3.4 whole; §5.1; Q7 |
| C-6 | a required mark would stamp unit literals `EVALUATED` | dissolved by D (§4.7) |
| K-1 | the swapped program would be stamped `EVALUATED` | dissolved by D |
| K-2 | who states `EVALUATED` undefined | dissolved by D |
| K-3 | the lane control false on its own lane | population and a structural seed exclusion (§4.8) |
| S-1 | the screens would say a reviewer passed | §4.4, every surface |
| S-2 | host literals have no honest mark | dissolved by D |
| S-3 | the refusal had no path to a red | derived remainder; the dead-end test kills the derivation mutant (§4.6) |
| S-6 | the ceiling was a different route; the thirteenth fails on the reviewer | §4.6 |
| S-7 | the lane control's site unnamed | §4.8 |
| Q-1 | the fingerprint moved only for exercised branches | the probe set (§5.5) |
| Q-3 | a string match any appended line satisfied | per-call records with run-time outcomes; reproduction (§5.4, §5.6) |
| Q-6 | held-out tier: no trigger, leakage, threat model | §5.2; Q7 (b) |
| Q-7 | no cost; the trigger blinded e2e; conferral unlisted | §5.3; §5.6; §6 |
| Q-8 | no local model is deployable | §5.3; Q7 (c), (d) |
| Q-9 | the gate green whatever it found; `DOC-004:241` | §1; §5.1; §5.6 |
| P-1 | the thirteenth is red on the reviewer, not the race | §1; §4.6 |
| P-3 | the work before green unstated | §1; §6; Q9 |
| P-4 | `R26`'s rejection texts not put to the sponsor | Q3a |
| P-6 | stipulated clean on deficient drafts, unsaid | §1; Q2 (d) |
| P-7 | `execution-model-invocation` still claims assurance | §4.6; Q6b |
| P-8 | Q6 against `DOC-004:237`, not argued | Q6b |
| P-9 | the two locks share one host key | two guarantees stated separately (§4.3); Q5 (b) |
| P-10 | the canon reading unstated | §2; §4.2; Q2 (c) |

### 8.2 Revision 2 — four lenses and a verifier

**A** disposition audit, **D** form D and the locks, **Q** qualification, **P** the package. 52 findings, 0 BLOCKER. 23
were raised SERIOUS; after verification **18 SERIOUS** (below) and five re-rated MINOR (D-3, QR2-5, P2-1, P2-8, P2-9;
§8.5).

| id | finding (short) | disposition |
|---|---|---|
| A-1, P2-3 | Q6's condition was met by Q9 (c), under which its defence is false | Q6b conditional on Q9 (a) or (b); Q6a split off (§8.3 A3-3) |
| A-2 | the held-out clause deferred silently; no held-out escalation route | §5.2; the HELD_OUT line (§5.4); Q7 (b) |
| A-3, QR2-4, P2-6 | the trigger accepted records of models the product cannot run, unasked | Q7 (d), each option's enforcement stated |
| A-4, P2-5 | Q3a's "not disarming" used the wrong plane; the scope-out alternative not compared | Q3a compares with both costed alternatives |
| A-5 | the lane control reached no spec | the import migration and a census (§4.8) |
| A-6 | the accept-click races have no path from a work-product delay | J1-4 split by site (§4.6) |
| D-1 | a stipulation over a draft the checker could not read | rule 2 (§4.1); limb 1 needs an evaluated row (§4.8) |
| D-2 | the engine admits a stipulated row from any writer | dispatch refuses the whole request; a writer census; the branch confined (§4.3) |
| QR2-1 | a step after e2e is skipped by any e2e red | `gate:tail` runs both and exits with the worse (§5.6) |
| QR2-2 | which record the limbs read was undefined | every record not superseded (§5.6) |
| QR2-3 | "worse" undefined | named transitions, a candidate key, confounds (§5.1) |
| P2-2 | Q6's defence overstated what the trigger enforces | Q6b says it plainly, with an enforced alternative |
| P2-4 | the stand-in copied the checker's unearned SATISFIED | rule 6: derived recommendation (§4.1) |
| P2-7 | "Gate E and the ladder run as written" was false | struck; Q5 (a) self-contained |

### 8.3 Revision 3 — three lenses and a verifier

**A** disposition audit, **N** the mechanisms new in revision 3, **P** the package. 32 findings, 0 BLOCKER. 11 were raised
SERIOUS; after verification **10 SERIOUS** (below) and one re-rated MINOR (P3-5; §8.5).

| id | finding (short) | disposition |
|---|---|---|
| A3-1, N-2 | coverage and escalation read different records, so a definition change, an acknowledgement or a supersession could retire an un-cited failure | every record not superseded is in the population, whatever its fingerprint; RESCORED re-stamps; SUPERSEDED refused while a failure is un-cited; intermediate runs included (§5.6) |
| A3-2, N-1, P3-4 | the sequencing limb lived inside the check it had to detect, so it could never fail | a verif pin landed in J1-2, independent of the check; limb deleted (§6) |
| N-3 | no line recorded outcomes, so reproduction compared a re-derivation with itself | CALL records the run-time outcome tuple and its scoring digest (§5.4) |
| N-4 | a fixture cannot capture the state at the moment a spec's reset finishes | the baseline is taken inside `resetEngine`, on every reset; a mutant for the wrong capture (§4.8) |
| P3-1 | under the recommendations, green waited on more than §1 said | §1 names both of the sponsor's steps; Q7 (b) recommends deferral, so no held-out run gates green; the frontier run is on the path, stated |
| P3-2 | Q7 (b) implied a tier outside the repository is held out | Q7 (b)'s three real options, with the threat model |
| P3-3 | Q9 (b)'s set measured nothing of what `execution-model-invocation` gave up | the smaller set keeps a clean work-product case and renamed copies (Q9 (b)) |

### 8.4 The final audit of revision 4

One auditor: all ten round-3 SERIOUS findings closed in the body. It found, in revision 4's own changes:
- **SERIOUS — limb 2 widened too far.** Reading every record against today's prompts and scoring would redden every old
  record on any ordinary change. Limb 2 is now scoped to records carrying the current fingerprint and the sources of
  current RESCORED lines, compared only where the scoring digest matches; limb 3 alone reads every record (§5.6).
- **SERIOUS — the sequencing pin was red in every state**: it looked for the check in `gate:fast`'s own string, where
  `gate:tail` hides it, and it tripped on the harness module that defines the helper. It now resolves `gate:fast`
  transitively, keys on spec files, and exempts the harness module, with a mutant (§6).
- **MINOR:** "the earliest RUN" became "a deployable RUN exists"; Q9 (c) says it would have to drop the pin; the writer
  census matches writes and names the files that must write; the lane baseline is the server's reset mark, which
  survives a retry of a non-resetting test; Q7 (b)'s options (ii)/(iii) state their enforcement, and §5.2 is conditional
  on the ruling.

### 8.5 The MINOR findings of the three rounds, by theme

- **Citations and counts** (C-11, C-12, A-7, A-8, P2-10, P2-12, P3-9): quotations made byte-exact; `DOC-004:256` cited
  alone for *"separately authorized"*; `JAN-SLICE`'s scope; the hybrid licence narrowed; the finding counts, the
  `748ad162` wording and `HARMONIZATION-LOG`'s line numbers corrected; §1 quotes `ASR-3` and Guide §8.4 whole.
- **Vocabulary and provenance** (C-7, C-13): the ratified axes considered; `basis` renamed `stipulated`.
- **Requiredness and threading** (C-8, K-4, K-5, K-6, K-8, D-6, D-7, A-13): the field optional and absent-legal; the
  real edit list; the ladder's wrappers; the flag read from the engine, required on the handle; the fold reads the
  latest event whole; the registry on the canonical handle; J1-1 ordered so each red is observable.
- **The durability lock** (D-3, D-4, P2-8): two guarantees stated separately; the port member required, unknown
  counting as durable; SQLite reads the opened connection; Q5 (a) conditional on (b), (b) untested.
- **`PER-12`** (C-9, Q-12): retention permitted for offline diagnosis; only the answer span in tracked records.
- **The gate's limits** (C-10, C-18, QR2-10, A3-9, N-6): what a local gate cannot do; the principle asked in Q9 (d); the
  tail named concretely, with svelte-check before it and the pin's counts.
- **Other rulings** (C-14, A-15): `R24`, `R25`, `R2` named; `R25`'s limbs in an admitting engine (§2).
- **Register updates owed** (C-15, P2-14): §11; the owed failing-set check struck on the first committed green.
- **`ASR-2` versus `R26`'s reading** (C-16): §3.4.
- **The grammar and the recommendation** (K-7, S-8, D-8): `fault` dropped from v1; the recommendation derived; both
  derivation-mutant forms killed.
- **Keying, reset and blast radius** (S-4, S-5, S-9): (PWA, framing); the canonical-handle registry; registration in the
  test body through a helper; the twelve opted-in files.
- **Surfaces** (S-10, S-11, D-5, D-9, A3-7): the accept-click races; "unchanged" made precise; candidates' criterion
  events exposed; the Undertaking page's Assurance tab; `gallery.ts` and the harness module in the census.
- **Writers and channels** (A3-8, N-8, N-5): the verif census of stipulation writers; dispatch refuses the whole
  request before dispatching; limb 1 checks a registration was made.
- **The carve-out** (A-11): Q2 (b) keeps unit arrangements legitimate.
- **Qualification details** (Q-2, Q-4, Q-5, Q-10, Q-11, Q-13, Q-14, Q-15, C-17, A-14, A-16, QR2-5..QR2-9, QR2-11, A3-4,
  A3-5, A3-10, A3-11, N-7, P3-7, P3-10): seed versus stored criteria; cases as data with fixed ids and producer
  identities; the builders' module and import guard; per-call records and report-time scoring; the prompt limit as a
  precondition; the transferring artifacts; the case-set digest over inputs, not oracles; coverage owing calls only for
  changed prompts; the ACKNOWLEDGED and HELD_OUT line kinds defined; oversize-together probes and the budget constants
  hashed; the cost cited to `REG-F-427` (5) and (6) and recomputed for 26 cases; transitions evaluated only for a
  repeated candidate, stated; transport failures count as measured and are Boundedness failures; each Q7 (d) option's
  enforcement; the fingerprint's move rate given as an upper bound; limb 3 asked separately in Q8 (b).
- **The package** (P-2, P-5, P-11, P-12, P-13, P-14, P2-1, P2-9, P2-11, P2-13, P2-15, P2-16, A-9, A-10, A-12, A3-3, A3-6,
  P3-5, P3-6, P3-8, P3-11, P3-12, P3-13): the fingerprint does not cover the model; every give-up listed, with the
  canon texts quoted; the conferral and frontier steps in §1; §2's licence stated as a reading; Q2 (e) and Q9 (d) made
  questions; Q6 split into Q6a (any order) and Q6b (conditional); Q3b recommends (i) and states what (ii)'s arrival
  requires; Q9 (c) said to be dominated; the live authoring lane's treatment stated in Q3a; Q10's consequences; a
  ruling sheet (§7.0); the gate-grain fact in §1; the scrolling test moved to "found on the way".

---

## 9. Instruments — each with the red it must show first

| instrument | predicted red first |
|---|---|
| a stipulated row reaches `AssuranceCriterionEvaluated` as `UNABLE_TO_DETERMINE` + `stipulated: 'MET'` | the field does not exist; a test that sends it is refused |
| the handler copies `stipulated` into the event | — (a guard; its mutant drops the field — the runtime schema would not notice) |
| a non-admitting engine: a floor resting on stipulations is INCONCLUSIVE, and Gate E refuses its SATISFIED | green from the start by construction (D); its mutant honours stipulations regardless of the flag |
| an admitting engine: the same floor is SATISFIED, and Gate E admits it | red after J1-1 (i), before the admitting branches exist |
| Gate E's admitting branch refuses a stipulated SATISFIED under any policy but `floor.reasoning-review` | — (a guard; its mutant drops the policy scope) |
| stipulated `UNABLE_TO_DETERMINE`, then an unstipulated `UNABLE_TO_DETERMINE` for the same criterion → refused | — (a guard; its mutant takes the union of stipulations) |
| `createEngine` refuses `admitStipulatedAnswers` over a durable store, a fork of one, and a driver-injected file store | red before J1-1 (iv) |
| the flag reaches the fork as it reaches the parent | — (a guard; its mutant overrides the flag in `fork()`'s spread) |
| a stipulated clean turn driven through `beginAuthoringTurn` reaches SATISFIED | — (a guard; its mutant drops the member from the turn's recorder) |
| `/test-api/dispatch` refuses a request with one stipulated step followed by a Complete, and writes no event | the refusal does not exist |
| the writer census: `admitStipulatedAnswers: true` or a `stipulated:` payload outside the named files → red | the census does not exist; its mutant adds a writer |
| `/test-api/reviewer-script` answers 404 when `harnessExposed()` but not `isTestMode()` | the route does not exist; a copy of the existing routes would answer |
| a registration survives no reset: register, reset, recreate the same PWA id, run a clean turn → INCONCLUSIVE | — (a guard; its mutant keeps the registry across resets) |
| a registration is read from the canonical handle, not the fork | — (a guard; its mutant looks it up on the fork) |
| a registration reaches only the arm it names | — (a guard; its mutant keys by PWA alone) |
| an unreadable work product with a registered stipulation stays INCONCLUSIVE | — (a guard; its mutant stipulates over an unread subject) |
| the stand-in's recommendation is INCONCLUSIVE with no stipulation, SATISFIED only with a full one | — (a guard; its mutant copies the checker's constant) |
| `coerceJudgement` drops a model-supplied `stipulated` | — (a guard; its mutant copies it) |
| the SSE line, the panels and the Undertaking Assurance tab name the stipulated count | today's fixed strings |
| the dead-end test with a clean stipulation → still REJECTED, and RR-04's row `NOT_MET` with no stipulation | — (must stay green; the REPLACE mutant fails the verdict, the APPEND mutant the row) |
| the lane control: both limbs, the registration check, the import census, and the server's reset mark | — (guards; mutants at the lane's seams, §4.8, including a baseline taken from worker state or at fixture setup) |
| the twelve authoring-arm reds and the work-product red | red today (`REG-D-067`'s set) |
| each race fix | red under its own injected delay — the work-product floor for Begin & Execute, the accept action for the click sites |
| the sequencing pin: a spec registration while the check is not reachable from `gate:fast` or no (deployable) RUN exists → red; the harness module exempt | red first, by a probe spec that registers before the check exists; its mutant drops the exemption |
| the reviewer fingerprint MOVES on each component — a prompt branch, an oversize-together probe, a budget constant, a criterion field, a scoring rule, the repair prompt | the function does not exist; one red row per component |
| the reviewer fingerprint does not move on a comment-only edit | — (a guard; its mutant hashes whole files) |
| the trigger: each of its three limbs red; a RUN with an un-cited failure followed by a fingerprint move that leaves its cases unchanged stays red; a SUPERSEDED line naming a record that reproduces is refused; a scoring-only move discharged by RESCORED with no model call; green on a covered, reproduced, fully escalated store | the check does not exist |
| `gate:tail` exits non-zero if either e2e or the check fails | — (a guard; its mutants let either hide the other) |

Every new guard gets ledger mutants, with `why` written from observed output.

---

## 10. Filed separately, not in scope

`REG-F-441` (the program swap), `REG-F-442` (stale host docs), `REG-F-443` (the preflight reads a retired switch),
`REG-F-428` (malformed replies decided silently — qualification counts them), `REG-F-418` (the mock's unearned SATISFIED
recommendation — the stand-in does not carry it), `REG-F-440` (the lane's drafts — Job 1 does not need realistic
drafts; Job 2 builds its own), `REG-F-444` (the scrolling test's synchronisation), `REG-F-445` (the live lane's report),
`REG-F-424` (2) (the reference seed's hand-written floor), the host literals behind FS-01 and IP-05 (§3.1), and
`REG-D-066`'s unit literals (§4.7).

---

## 11. Exit

Revision 4 went to the sponsor, who adopted its recommendations on 2026-09-23 (`REG-D-071`); `R26`'s words are
recorded in `REG-F-446`. The updates owed by the rulings: **`REG-Q-025`** amended with what it now has (canary
isolation, the record shape, the trigger, and the held-out tier's deferral as ruled) — the first act on it anywhere;
**`REG-D-060`**'s *"OWED. The judge's own lifecycle"* line pointed at Job 2; **`REG-D-068`** superseded as Q2 rules; and
the interim-carrier entry for the trigger (`DOC-004:258`). **`REG-D-067`**'s owed failing-set check is struck later, when
the lane is first observed green in a committed gate run (Q3c). Then a roadmap (`ROADMAP-what-the-tests-prove.md`), then
the build in the order of §6. ⭑ `REG-D-068` is superseded and `REG-D-060` pointed at Job 2 with `REG-D-071`; `REG-Q-025`'s
amendment and the interim-carrier entry land with the trigger (J2-3 + J2-4), when there is something built to record.
