# ROADMAP — `JAN-CRITREAD`: the criterion results nobody reads

**Design:** `DESIGN-the-criterion-results-nobody-reads.md` · **Date:** 2026-09-20
**Rules:** `RPH-ASR-004`, `RPH-ASR-005`, `RPH-CON-005`

⭑ **Exit:** `completeAssuranceAssessment` refuses a positive disposition that does not answer every mandatory
criterion, and one that answers a mandatory criterion `UNABLE_TO_DETERMINE`; the register's two admissions
become ENFORCED rows with driven probes **for claim-bearing assessments**; and the floor-path limb is filed
with a named ratification rather than quietly claimed.

⛔ **THE PRECONDITION IS ALREADY DERIVED AND THE ANSWER IS IN THE DESIGN (§6.1).** No production path produces
a claim-bearing assessment: zero non-test dispatchers, and every `claimResults:` in the repo is `[]` except the
register's own probes. ⭐ That does not block `CR-01`–`CR-04` — the register's `ENFORCED` standard is *"a rule a
named PRODUCTION SITE refuses, proved by observing that refusal through `Engine.dispatch`"*, which is the
standard `RPH-ASR-002` already meets at this same site. **What it blocks is the CLAIM**, and `CR-05` is where
that gets bounded.

---

### `CR-01` — the predicate, its own, reachable only from the command path

Takes the policy's criteria and the result's `claimResults`; returns the **unanswered** and the
**undetermined**. ⛔ **It is NOT the kernel's `mandatoryCriterionUnmet`** — `RPH-CON-005` pre-refutes that
reuse: it *"folds to INCONCLUSIVE rather than rejecting, so it fails both clauses of `deadPredicate`'s
contract."* Reusing it would also collapse the census that exists to detect exactly that wiring.

⭑ **MANDATORINESS IS DERIVED FROM THE POLICY'S `severityIfNotMet`**, the way the kernel already derives it —
never from the payload. The judged party does not set its own stakes (`R25`).

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| call `mandatoryCriterionUnmet` instead | ⭐ `deadPredicate`'s census — its `referencedOnlyBy` set changes and the row must be re-dispositioned |
| read mandatoriness from `claimResults` | the stakes test — a validator that declares its own criterion non-mandatory is refused |
| treat an absent criterion as answered | `CR-02`'s coverage red |
| **CONTROL** | a result answering every mandatory criterion `MET` returns empty on both lists |

---

### `CR-02` — `RPH-CON-005`: a positive disposition must ANSWER every mandatory criterion

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

The rows record **what these gates do not reach**: every floor assessment carries `claimResults: []`, so on the
demo's only lane the gates are **totally vacuous** — and no production path anywhere produces a claim-bearing
assessment (§6.1, measured).

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

### `CR-06` — L3 is put to the sponsor as a ratification, with the evidence assembled

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
