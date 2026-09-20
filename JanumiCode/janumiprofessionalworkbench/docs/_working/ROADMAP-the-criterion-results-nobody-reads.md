# ROADMAP — `JAN-CRITREAD`: the criterion results nobody reads

**Design:** `DESIGN-the-criterion-results-nobody-reads.md` · **Date:** 2026-09-20
**Rules:** `RPH-ASR-004`, `RPH-ASR-005`, `RPH-CON-005`

⭑ **Exit:** `completeAssuranceAssessment` refuses a positive disposition that does not answer every mandatory
criterion, and one that answers a mandatory criterion `UNABLE_TO_DETERMINE`; the register's two admissions
become ENFORCED rows with driven probes **for claim-bearing assessments**; and the floor-path limb is filed
with a named ratification rather than quietly claimed.

⛔⛔ **REVISED 2026-09-20, BEFORE ANY CODE — THE PRECONDITION WAS MEASURED WRONG AND THE ORDER IS INVERTED.**

~~§6.1's measurement: “ZERO non-test production dispatchers … so no production path produces a claim-bearing assessment”~~ — **there are SIX** (DESIGN §0.1), and the error was grepping a noun I coined rather than the obligation. Every one passes `claimResults: []`.

⭐⭐ **AND THAT TURNS L1 FROM IDLE INTO DESTRUCTIVE.** `record-assurance.ts` sends the floor's own disposition (`:195`) with `claimResults: []` (`:183`); `dispositionFromFindings` returns SATISFIED when every mandatory criterion is MET; and `floor.ts`'s `FS-01`/`FS-02`/`IP-01`…`IP-05` are all `mandatory: true` **with no `UNABLE_TO_DETERMINE` arm**. So a clean subject is a positive disposition with zero answers over seven mandatory criteria — **the exact arrangement `CR-02` refuses.** `record-assurance.test.ts` proves it is live, not latent: *“a fully-satisfied floor records one SATISFIED assessment per policy”* **passes today (4/4)**, and `recordAssuranceRecordingPlan` **throws** on refusal (`:122`) from two demo paths.

⭑ **SO THE ORDER IS L3 → L1, NOT L1 → L3.** A coverage gate over `claimResults` cannot ship while the only production producer of a positive disposition cannot populate `claimResults`. **L2 is unaffected** — with every production site passing `[]` there are zero answers, hence zero undetermined answers, hence no arrangement in which it can over-refuse.

### ⭐ REVISED ORDER

| # | item | status |
|---|---|---|
| 1 | `CR-06` | ⭐ **PROMOTED TO FIRST** — it is now a blocker, not a closing formality |
| 2 | `CR-01` | ships, **with only its `undetermined` output wired to a refusal** |
| 3 | `CR-03` (L2) | ships — strictly additive, cannot over-refuse |
| 4 | `CR-04` | **`RPH-ASR-005` only**; `RPH-CON-005` stays UNENFORCED_DISCLOSED |
| 5 | `CR-05` | rewritten — the bound is now over-refusal, not vacuity |
| — | `CR-02` (L1) | ⛔ **BLOCKED ON `CR-06`** |


---

### `CR-01` — the predicate, its own, reachable only from the command path

Takes the policy's criteria and the result's `claimResults`; returns the **unanswered** and the
**undetermined**. ⛔ **It is NOT the kernel's `mandatoryCriterionUnmet`** — `RPH-CON-005` pre-refutes that
reuse: it *"folds to INCONCLUSIVE rather than rejecting, so it fails both clauses of `deadPredicate`'s
contract."* Reusing it would also collapse the census that exists to detect exactly that wiring.

⭑ **MANDATORINESS IS DERIVED FROM THE POLICY'S `severityIfNotMet`**, the way the kernel already derives it —
never from the payload. The judged party does not set its own stakes (`R25`).

⛔ **REVISED: THE PREDICATE SHIPS WHOLE; ONLY `undetermined` IS WIRED TO A REFUSAL.** `unanswered` is computed and returned — `CR-05` needs it to MEASURE the over-refusal it discloses — but nothing refuses on it until `CR-06` lands. ⚠ An unwired return value is normally this repository's most-recorded defect; it is licensed here for exactly one increment because the disclosure in `CR-05` is its consumer, and `CR-05` is in the same commit.

⭑ **AND IT IMPORTS THE RATIFIED `CriterionResultOutcomeSchema` RATHER THAN RETYPING THE FIVE OUTCOMES.** ⚠ There are **two types named `CriterionResult`** in this repository with disjoint fields (DESIGN §0.6): the ratified §20.1 one, which nothing imports, and the kernel's `{mandatory, outcome}`, which drives every disposition. Taking the wrong one is this increment's live trap.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| call `mandatoryCriterionUnmet` instead | ~~⭐ `deadPredicate`'s census~~ ⛔ **THIS RED CANNOT FIRE** (DESIGN §0.7(ii)) — replaced by: the refusal must NAME the criterion, which a bare `boolean` cannot |
| read mandatoriness from `claimResults` | the stakes test — a validator that declares its own criterion non-mandatory is refused |
| treat an absent criterion as answered | `CR-02`'s coverage red |
| **CONTROL** | a result answering every mandatory criterion `MET` returns empty on both lists |

---

### ⛔⛔ `CR-02` — **BLOCKED ON `CR-06`** — ~~`RPH-CON-005`: a positive disposition must ANSWER every mandatory criterion~~

**DO NOT BUILD THIS UNTIL `CR-06` IS RULED.** As specified it refuses the floor's own success path: a clean subject reaches SATISFIED with `claimResults: []` over seven mandatory criteria, and `recordAssuranceRecordingPlan` throws rather than degrades. It would take down `record-assurance.test.ts` (passing, 4/4) and the demo's floor at runtime. The increment below is kept verbatim because it is correct **once `ClaimAssessmentResult` has a ratified claim-less route** — which is precisely what `CR-06` asks for.

A new gate at `completeAssuranceAssessment`, mirroring Gate A. Refusal code and marker follow Gate A's shape.

⛔ **POSITIVE DISPOSITIONS ONLY.** Gate A's docblock settles this: *"Negative dispositions … are deliberately
NOT gated: escalating or rejecting BECAUSE evidence is insufficient is the correct response, not a blocked
one."* An assessment that goes INCONCLUSIVE *because* a criterion is unanswered is the rule **working**.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| delete the gate | ⭐ the register's own arrangement — five BLOCKING criteria, `claimResults` answering four, SATISFIED — must stop being accepted |
| gate every disposition, not just positive ones | the INCONCLUSIVE control — refusing the correct answer is the over-refusal shape |
| compare against the policy's full criterion list rather than its MANDATORY subset | the advisory-criterion control — an ADVISORY criterion left unanswered must NOT block |
| **CONTROL** | a complete, all-`MET` result still completes to SATISFIED |

---

### `CR-03` — `RPH-ASR-005`: a positive disposition may not stand over an UNDETERMINED mandatory criterion

The disposition side of the same absence. ⭑ Separate from `CR-02` because *unanswered* and *answered
undetermined* are different facts with different remedies — the distinction `R26` exists to preserve, applied
one plane over.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| delete the gate | ⭐ the register's arrangement — one BLOCKING criterion `UNABLE_TO_DETERMINE`, SATISFIED — must stop being accepted |
| fold undetermined into unanswered (one gate, one message) | the two-facts test: the refusal must name WHICH, because the remedies differ |
| treat `NOT_MET` as undetermined | ⚠ `RPH-ASR-004`'s own arrangement is `NOT_MET` + SATISFIED — a separate row, not to be silently absorbed |
| **CONTROL** | an INCONCLUSIVE disposition over the same undetermined criterion is ACCEPTED |

---

### `CR-04` — the two register rows move to ENFORCED, with probes

`UNENFORCED_DISCLOSED` + `OBSERVED_ADMISSION` → `ENFORCED` + `enforcedAt` + `refusalCode` + `refusalMarker` +
`declaredMutations`, following `RPH-ASR-002`'s shape exactly.

⛔ **REVISED: ONLY `RPH-ASR-005` MOVES.** `RPH-CON-005` stays `UNENFORCED_DISCLOSED` because its gate (`CR-02`) is blocked. ⭑ Its row gains the reason — not “not built yet” but **“the only production producer of a positive disposition cannot satisfy this gate”**, which is a materially different disclosure and the one a reader needs.

⚠ **AND THE TWO LIMBS TAKE DIFFERENT REFUSAL CODES, DERIVED FROM CANON'S OWN WORDING.** `RPH-CON-005`'s anchor is *“Partial output … is invalid output”* → `RPH_VALIDATOR_OUTPUT_INVALID`. `RPH-ASR-005`'s is *“Unable-to-determine is never treated as met”* — a constraint on whether a disposition may stand, which is Gate A's shape → `RPH_VALIDATION_SEMANTIC_FAILED`. This also sharpens `CR-03`'s fold-the-gates mutant: folding is detectable on the **code**, not only the message.

⚠ **AND `RPH-ASR-004` DOES NOT MOVE.** Its arrangement is a `NOT_MET` criterion with a SATISFIED
recommendation — the same site, a third axis, and absorbing it because it is adjacent would be the
scope-inflation this register was built to stop.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| move a row to ENFORCED without a driven probe | the register's own gate — `ENFORCED` requires an observed refusal through `Engine.dispatch` |
| leave the rows UNENFORCED after wiring | the admission gate — an `OBSERVED_ADMISSION` whose arrangement is now refused is a false record |
| mark `RPH-ASR-004` enforced too | its own arrangement, which the gates do not refuse |

---

### `CR-05` — ⛔ the bound, in the register, before anyone can misread the green

⛔⛔ **REVISED — THE BOUND IS OVER-REFUSAL, NOT VACUITY.**

~~The rows record what these gates do not reach: every floor assessment carries `claimResults: []`, so on the demo's only lane the gates are **totally vacuous** — and no production path anywhere produces a claim-bearing assessment (§6.1, measured).~~

What the rows must record instead, because it is what a reader would otherwise get backwards:

- `RPH-ASR-005` (L2) is **ENFORCED at a named site with no live subject**: six production dispatchers reach `completeAssuranceAssessment`, all pass `claimResults: []`, so none can present an answered-undetermined criterion. ⭑ That is the standard `RPH-ASR-002` already meets — a named production **site**, proved by a driven refusal — and it must be stated, never softened to *“RPH-ASR-005 is enforced”*.
- `RPH-CON-005` (L1) is **blocked, and blocked for a reason worth naming**: its gate would refuse the floor's own SATISFIED path. Measured, not predicted — `record-assurance.test.ts` passes 4/4 today.

⚠ **AND THE DEMO LANE'S ESCAPE IS AN ACCIDENT, SO IT IS DISCLOSED AS ONE.** `demo-policy.ts:68` declares its one criterion `MATERIAL`, not BLOCKING. Change that single value and the demo's own SATISFIED path (`+page.server.ts:1967`) enters L1's arrangement too.

⭐ **THIS IS THE INCREMENT THAT MATTERS MOST AND IT SHIPS NO CODE.** A gate that cannot fire where the product
runs is this repository's most-recorded defect; `REG-F-365` measured 74% of a kernel dead that way. Shipping
`CR-02`/`CR-03` and calling `RPH-ASR-005` closed would be that defect committed by the programme created to
close it.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| write *"RPH-ASR-005 is enforced"* unqualified | the scope check — the claim must name **claim-bearing assessments** |
| drop the floor-path disclosure | `REG-F-409`'s precedent: it bounded its own scope rather than claiming the whole |

---

### ⭐⭐ `CR-06` — **REFRAMED: BUILD §32's `recordCriterionResult`** — ~~L3 is put to the sponsor as a ratification, with the evidence assembled~~

⛔ **L3 IS NOT A RULING. IT IS A RATIFIED §32 COMMAND THAT WAS NEVER BUILT** (DESIGN §0.7(iii)) — `recordCriterionResult`, criterion-keyed by its own name, sitting between `beginAssuranceAssessment` and `recordAssuranceObservation`. `submitEvidenceForAssessment` is the built precedent from the same unbuilt four. Its payload is not field-defined, so authoring it is the `Source TBD` class — which has its own established route and is **not** a licence to pick silently.

⭑ **AND IT MOVES THE GATE'S INPUT.** Once criterion results accumulate on the ASSESSMENT, `CR-01`/`CR-02` read them there — not from `validatorResult.claimResults`, whose claim-keyed container is why the floor could never populate it. ⚠ `CR-01` must therefore be **re-scoped against this input** before it is built; as written it reads the wrong channel.

⚠ **AND `REG-F-209` MUST BE ANSWERED FIRST OR DISCLOSED** (DESIGN §0.7(iv)): a policy's `criteria` are editable at an unchanged `semanticVersion` while an assessment is ASSESSING, so policy-derived mandatoriness is mutable after the fact.

The evidence below is kept — it is what established that §20.1 and §33 **compose**, which is the fact that reframed this increment.


§20 routes per-criterion results **only** through `claimResults`, and §33 nests them under a `claimId`. Floor
assessments carry `claimIds: []`, so their criterion results *"have no ratified home in §20 without inventing a
claim id, and inventing one is the disease this whole program is treating."*

⭑ **THE EVIDENCE FOR THE RULING IS ALREADY IN HAND AND CUTS ONE WAY.** The register's own probe writes
`claimResults: [{ criterionId: 'C1', result: 'NOT_MET', statement: … }]` — **keyed by `criterionId`, not nested
under a `claimId`.** So the criterion-keyed shape is already what the repository writes and reads in practice,
while §33's worked example says otherwise. ⚠ That is a discrepancy the ruling must resolve either way; it is
**not** a licence for me to pick.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| mint a `claimId` for floor criterion results | ⛔ the fabrication test — `record-assurance.ts` names this by name as the disease |
| route floor results through `observations` instead | the manufacture-from-silence test (`REG-D-059`): an unjudged criterion is not a finding |
| decide the §20 shape without a ruling | the ratification gate — §20 is canon |

---

## Not in scope

- ⛔ **`RPH-ASR-004`** (a `NOT_MET` criterion under a SATISFIED recommendation) — same site, third axis, its own
  row and its own probe.
- ⛔ **`REG-F-415`'s rendered string.** The demo's empty refusal text is the SYMPTOM; it is repaired by L3, not
  before. Fixing the renderer first would make a registered gap look closed from the only surface anyone
  watches — and with `REG-F-419` (no CI) that is the only surface there is.
- ⚠ **The `ProposedAssuranceObservation` shape** is a placeholder with §33 as its only ratified statement.
  Untouched here.
