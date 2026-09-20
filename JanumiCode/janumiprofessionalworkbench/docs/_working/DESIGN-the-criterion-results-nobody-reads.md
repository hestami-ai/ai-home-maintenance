# DESIGN — `JAN-CRITREAD`: three ratified rules fail for one reason, and only one third of it needs a ruling

**Rules:** `RPH-ASR-004`, `RPH-ASR-005`, `RPH-CON-005` · **Date:** 2026-09-20
**Findings:** `REG-F-409` (its command-path bound), `REG-F-415` (its true cause)
**Status:** design only, nothing implemented

---

## 1. The defect, and it is still live

The enforcement register carries `RPH-ASR-005` as `UNENFORCED_DISCLOSED` with a **driven admission**:

> *"a policy with one BLOCKING criterion, activated and assessed, completed with `dispositionRecommendation
> SATISFIED` while that criterion's result is `UNABLE_TO_DETERMINE` — **accepted**"*

⛔ **That is `REG-F-409`'s defect, unrepaired.** `R26` closed the FLOOR path — a criterion nobody judged now
scores `UNABLE_TO_DETERMINE` and folds to `INCONCLUSIVE`. The **COMMAND** path never asked. `R26`, `R31` and
`R32` all govern the floor; the ratified rule that an undetermined mandatory criterion is not a met one still
has no reader where authoritative state is written.

⭑ **AND `RPH-CON-005` IS THE SAME ABSENCE FROM THE OTHER SIDE**, which is why they are one programme:

> *"a policy with FIVE criteria all `severityIfNotMet` BLOCKING, assessed, then completed with `claimResults`
> answering only FOUR of them and recommending SATISFIED — accepted, and the assessment really advances to
> SATISFIED"*

Its own `why` says so: *"the same absence `RPH-ASR-004` and `RPH-ASR-005` record from the disposition side,
seen here from the COVERAGE side."*

---

## 2. ⭐⭐ The decomposition, which is the whole value of this design

I set out expecting one contract change and one ratification. **Measured, it is three limbs and only the third
needs a ruling.**

| limb | rule | what it refuses | contract change? |
|---|---|---|---|
| **L1 — COVERAGE** | `RPH-CON-005` | a positive disposition whose `claimResults` do not answer every mandatory criterion | ⭐ **none** |
| **L2 — DISPOSITION** | `RPH-ASR-005` | a positive disposition over an answered criterion that came back `UNABLE_TO_DETERMINE` | ⭐ **none** |
| **L3 — THE FLOOR PATH** | both, on the demo's own lane | nothing, because floor assessments carry no criterion results at all | ⛔ **ratification** |

### 2.1 Why L1 and L2 need nothing ratified

`claimResults` is **already in the payload** (`ValidatorResultSchema`), already ratified, and §20 already routes
per-criterion results through it — `recording.ts` says so in terms. `ClaimAssessmentResultSchema` is
`z.record(z.string(), z.unknown())`, i.e. **unconstrained**, so an outcome per criterion already fits.

⭐ **And the register's own admission proves the channel is POPULATED**: its arrangement completes with
`claimResults` *"answering only four"* of five. A thing that can answer four can answer five. **Nothing reads
it.** That is the entire L1/L2 gap.

### 2.2 Why L3 does need a ruling, in the code's own words

`record-assurance.ts` sets `claimResults: []` for floor assessments, and explains:

> *"EMPTY, AND NOT BECAUSE THE FLOOR HAS NOTHING TO SAY — a surfaced gap, not a silent drop. §20 routes
> per-criterion results ONLY through `claimResults`, and §33's worked example nests them under a `claimId`. The
> floor's assessments carry `claimIds: []`: it evaluates CRITERIA against a subject, not claims. So its
> criterion results have no ratified home in §20 **without inventing a claim id**, and inventing one is the
> disease this whole program is treating."*

⛔ **I tried to make this limb free and the code refused, correctly.** The floor's criterion results are
computed (`a.criteria`), honest, and homeless. Routing them through a minted `claimId` is the fabrication this
repository exists to prevent; §20 gaining a claim-less criterion route is a **ratification**, not a design
choice I may take.

---

## 3. The template already exists, and it is ENFORCED

`RPH-ASR-002` is enforced at `completeAssuranceAssessment`'s **Gate A**, which refuses a positive disposition
whose mandatory **evidence** is unmet. L1 and L2 are that gate one axis over, and Gate A settles two design
questions for free:

⭑ **ONLY POSITIVE DISPOSITIONS ARE GATED.** Gate A's docblock: *"Negative dispositions (REJECTED / ESCALATED /
INCONCLUSIVE) are deliberately NOT gated: escalating or rejecting BECAUSE evidence is insufficient is the
correct response, not a blocked one."* ⭐ **The same holds exactly here**: an assessment that goes INCONCLUSIVE
*because* a criterion is undetermined is the rule WORKING. Gating it would refuse the correct answer.

⭑ **THE MANDATORY SET COMES FROM THE POLICY, NOT THE PAYLOAD.** Gate A folds the policy's
`requiredForDispositions`; L1/L2 fold the policy's criteria and their `severityIfNotMet`, exactly as the kernel
already derives `mandatory` (`validators.ts`). The judged party does not get to declare its own stakes — the
same principle `R25` established for severity.

---

## 4. ⛔ The trap the register names, and how this design avoids it

`RPH-CON-005`'s `whyNoPredicate`:

> *"`mandatoryCriterionUnmet` exists in `rph-assurance` and is reached only on the floor path, where it folds to
> INCONCLUSIVE rather than rejecting — so it fails both clauses of `deadPredicate`'s contract."*

⭐ **So the obvious remedy is pre-refuted: do NOT wire the existing kernel helper to the command path.** It
answers a different question (what disposition follows) than the gate asks (may this disposition stand), and it
folds where the gate must refuse. ⚠ Reusing it would also collapse `deadPredicate`'s census, which exists to
detect exactly that wiring.

⭑ **The gate gets its own predicate**, taking the policy's criteria and the result's `claimResults`, returning
the unanswered and the undetermined. It is reachable only from the command path, so the census stays honest.

---

## 5. ⚠ What L1+L2 will NOT do, stated before it is built

⛔ **They will be VACUOUS ON THE DEMO'S OWN LANE.** Every floor assessment carries `claimResults: []`, so a gate
reading `claimResults` sees nothing there and refuses nothing. The demo is a floor-path application.

⭐ **This is the most important sentence in the design.** A gate that cannot fire where the product actually
runs is this repository's single most-recorded defect — `REG-F-365` measured 74% of a kernel dead that way, and
`REG-F-409` exists because a control reported SATISFIED over a rubric it had not read. Shipping L1+L2 and
calling `RPH-ASR-005` enforced would be that defect, committed by the programme created to close it.

⭑ **SO THE SCOPE IS BOUNDED IN THE REGISTER, NOT IN A COMMIT MESSAGE:** L1+L2 enforce on **claim-bearing**
assessments — what an authored policy produces — and the three rules stay `UNENFORCED_DISCLOSED` **for the
floor path** until L3 is ruled. Two arms of one rule, dispositioned separately, exactly as `REG-F-409` bounded
its own scope rather than claiming the whole.

---

## 6. What must be true for L1/L2 to be worth building at all

⚠ **An honest precondition, and it may kill the increment.** L1+L2 are worth building iff some assessment in
this system is CLAIM-BEARING — otherwise the gate has no live subject anywhere and is a control that cannot
fire, which §5 forbids on principle.

⭑ **This is DERIVABLE and must be derived before implementation**, not assumed: find every producer of a
`CompleteAssuranceAssessment` payload and ask whether any carries non-empty `claimResults`. The register's
admission arrangement is one (a test fixture). ⛔ **If the answer is "only the register's own probe", then L1+L2
are enforceable only against an arrangement written to be enforced against**, and the correct move is to file
that and go straight to L3's ratification.

### 6.1 ⭐ DERIVED BEFORE WRITING THE ROADMAP — and the first answer looked like a kill

**Measured:** there are **ZERO non-test production dispatchers** of `CompleteAssuranceAssessment` anywhere
(only the handler registry and a test fixture), and **every `claimResults:` in the repository is `[]`**
except three sites in `disclosure-observed.test.ts` — which are the enforcement register's own admission
probes. ⛔ **So no production path produces a claim-bearing assessment.** That is precisely the condition
§6 named as possibly fatal.

⭐⭐ **IT IS NOT FATAL, AND CHECKING WHY MATTERS MORE THAN THE ANSWER.** The register defines its own
standard: `ENFORCED` is *“a rule a named PRODUCTION SITE refuses, proved by observing that refusal through
`Engine.dispatch`”* — a named **site**, not a production **producer of the violating input**.
`RPH-ASR-002` is ENFORCED on exactly that basis today: its site is `completeAssuranceAssessment`, and its
proof is a driven probe. L1 and L2 meet the same standard at the same site.

⚠ **What the measurement DOES change is the claim that may be made.** It is now established, not assumed,
that these gates protect the KERNEL's command surface against a producer that does not exist yet — and
that §5's vacuity on the floor lane is total rather than partial. Both belong in the register row, and
neither may be softened into *“RPH-ASR-005 is enforced.”*

⭑ **ONE THING THE PROBES REVEALED IN PASSING**, worth carrying into the roadmap: the register's own
arrangement writes `claimResults: [{ criterionId: 'C1', result: 'NOT_MET', statement: … }]` — keyed by
**criterionId**, NOT nested under a `claimId` as §33's worked example does. So the shape a gate must read
is already in use and is already criterion-keyed, which narrows L1/L2 and is evidence for L3's ruling.

---

## 7. Exit

`completeAssuranceAssessment` refuses a positive disposition that does not answer every mandatory criterion, and
one that answers a mandatory criterion `UNABLE_TO_DETERMINE`; the refusals carry the ratified codes and name the
criteria; the register's two admissions become ENFORCED rows with driven probes **for claim-bearing
assessments**; and the floor-path limb is filed with a named ratification rather than quietly claimed.
