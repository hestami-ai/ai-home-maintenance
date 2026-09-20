# DESIGN — `JAN-CRITREAD`: three ratified rules fail for one reason, and only one third of it needs a ruling

**Rules:** `RPH-ASR-004`, `RPH-ASR-005`, `RPH-CON-005` · **Date:** 2026-09-20
**Findings:** `REG-F-409` (its command-path bound), `REG-F-415` (its true cause)
**Status:** design only, nothing implemented · ⛔ **REVISED 2026-09-20 — see §0**

---

## 0. ⛔⛔ REVISED 2026-09-20 BEFORE ANY CODE — L3 IS NOT THE THIRD LIMB, IT IS THE PRECONDITION OF L1

§6.1's central measurement is **FALSE**, and correcting it inverts the programme.

### 0.1 The measurement, redone

§6.1 says: *“there are **ZERO non-test production dispatchers** of `CompleteAssuranceAssessment` anywhere (only the handler registry and a test fixture)”*. **There are six.**

| production dispatch site | disposition it sends | `claimResults` |
|---|---|---|
| `packages/rph-engine/src/record-assurance.ts:165` | floor-computed (`a.disposition`, `:195`) | `[]` (`:183`) |
| `packages/rph-engine/src/reference-undertaking.ts:655` | — | `[]` (`:664`) |
| `packages/rph-engine/src/reference-undertaking.ts:1162` | — | `[]` (`:1171`) |
| `apps/rph-demo/src/lib/server/assurance/declared-policy-signoff.ts:196` | — | `[]` (`:211`) |
| `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:1967` | ⭐ **SATISFIED** | `[]` (`:696`) |
| `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:2073` | REJECTED | `[]` (`:696`) |

⛔ **HOW THE ERROR WAS MADE, BECAUSE IT IS THE REPOSITORY'S OWN NAMED DEFECT.** I searched for the noun I had coined — a `dispatch('CompleteAssuranceAssessment'` call — instead of the obligation. Every one of the six sites builds its command through a local `send(…)` helper. The standing rule broken here is quoted approvingly in this very design corpus: *grep the OBLIGATION, never a noun I coined this session.*

⭑ **AND THE CORRECTED FACT IS STRONGER THAN THE FALSE ONE.** “No producer exists” would have made the gate merely unexercised. The truth — **six live production producers, every one passing `claimResults: []`** — is what makes L1 dangerous rather than idle.

### 0.2 ⛔⛔ The consequence: L1 does not fail to fire. It BREAKS THE FLOOR.

Five measured links, in order:

1. `record-assurance.ts:183` passes `claimResults: []` **unconditionally**.
2. `record-assurance.ts:195` passes `dispositionRecommendation: a.disposition` — the floor's own verdict, straight through.
3. `dispositionFromFindings` returns **`SATISFIED`** when every mandatory criterion is `MET`/`NOT_APPLICABLE`.
4. `floor.ts`'s structural criteria — `FS-01-schema`, `FS-02-invariants`, `IP-01`…`IP-05` — are **all `mandatory: true` with no `UNABLE_TO_DETERMINE` arm** (`facts.schemaValid ? 'MET' : 'NOT_MET'`). A clean subject is all-`MET`.
5. So a clean subject drives a **positive disposition, zero criterion answers, seven mandatory criteria** — precisely the arrangement L1's gate refuses.

⭐⭐ **AND IT IS NOT LATENT.** `packages/rph-engine/src/record-assurance.test.ts` — *“a fully-satisfied floor records one SATISFIED assessment per policy, no open observations”* — **passes today: 4 files/4 tests, run 2026-09-20.** And `recordAssuranceRecordingPlan` **throws** on any refusal (`record-assurance.ts:122`), from two live demo paths (`floor-over-subject.ts:157`, `floor.ts:394`). L1 would not redden a test. **It would throw in the demo's floor at runtime.**

### 0.3 ⛔ So §5 was right about the risk and WRONG ABOUT ITS DIRECTION

~~*“They will be VACUOUS ON THE DEMO'S OWN LANE … a gate that cannot fire where the product actually runs is this repository's single most-recorded defect”*~~

The floor lane is the one lane where L1 **does** fire — and it is wrong every time it does, because the floor is contractually unable to populate `claimResults`; `record-assurance.ts:174-182` discloses that gap in its own words. ⭑ §5's instinct was sound and its object was inverted: the hazard was never vacuity, it was **OVER-REFUSAL** — the shape Gate A's own control exists to catch, and the shape `RPH-ASR-002`'s second declared mutation is written to produce.

### 0.4 The inversion, stated as the ruling it implies

⭐ **L3 IS THE PRECONDITION OF L1, NOT ITS THIRD LIMB.** A coverage gate over `claimResults` cannot ship while the only production producer of a positive disposition is structurally unable to populate `claimResults`. The ordering in §2's table is therefore reversed: **L3 → L1**.

⭑ **L2 IS UNAFFECTED AND STILL SHIPS.** It refuses a positive disposition over a criterion **answered** `UNABLE_TO_DETERMINE`. With all six production sites passing `[]`, there are zero answers, therefore zero undetermined answers, therefore **no arrangement in which it can over-refuse**. It is strictly additive — which is exactly what L1 is not.

### 0.5 ⚠ What keeps the DEMO's own lane out of L1's way, and how narrow it is

`demo-policy.ts:68` declares the demo policy's single criterion `severityIfNotMet: 'MATERIAL'` — not BLOCKING, so not mandatory under `BLOCKING_SEVERITIES`. **That one value is the only reason** the demo's own SATISFIED path (`+page.server.ts:1967`, which sends `SATISFIED` with `claimResults: []`) is not refused by L1 as well. One severity in one seed file is not a margin to build a gate on, and it is not a disclosure either — it is an accident.

### 0.6 Two things I was about to file as findings, and the register had already answered both

⭑ Recorded because the near-miss is the point, and because it is the fourth time this session the standing grep-the-register rule has paid.

- **“`ClaimAssessmentResult` is an unfilled `Source TBD`” — NOT A FINDING.** `REG-005:2147` already rules on precisely this move: *“**THE ERROR IS NOT THE OBSERVATION, IT IS THE PROMOTION.** … a `Source TBD` is not a gap, and neither is an unpinned read nothing consumes.”* And `objects.ts`'s placeholder block states the schedule in its own comment: *“tightened in the milestone that defines them (M7/M9/M11)”* — the same M7 `RPH-ASR-004`'s row names as owning the rejecting actor.
- **“`CriterionResultSchema` is ratified and orphaned” — ALREADY CATALOGUED.** `AUDIT-shape-survivorship-2026-08-20.md:148` lists it among the types with *“real strictObjects”* and `ClaimAssessmentResult` among the *“declared placeholders”*.

⭐ **ONE THING IS GENUINELY UNREGISTERED, AND IT IS A HAZARD RATHER THAN A DEFECT.** This repository holds **two types named `CriterionResult`** with **disjoint fields**: the ratified §20.1 one (`objects.ts:238` — `criterionId, result, rationale, evidenceIds`), which **nothing imports**, and the kernel's (`assurance-rules.ts:37` — `mandatory, outcome`), which drives every disposition. ⚠ The live one **cannot represent a criterion id at all**, which grounds §4's refusal to reuse the kernel helper on a harder fact than the census: reuse could not NAME the failing criterion even if the census permitted it. No register entry is owed — there is no site that conflates them, because the ratified type has no importers. It is a trap for this design's own author, and it is recorded here for that reason.

### 0.7 ⛔⛔ AND THEN AN ADVERSARIAL PANEL REFUTED THE THREE REMAINING DESIGN CALLS, 9 OF 9

Nine reviewers — three calls × three lenses (contract / precedent / vacuity), each instructed to REFUTE and to default to refuted when uncertain — returned **nine refutations and no survivals**. Three of their findings are load-bearing and I verified each myself before accepting it.

#### (i) ⭐⭐ §20.1 AND §33 DO NOT CONFLICT. THEY COMPOSE. This design's central premise was wrong.

§2.2 and §6.1 both treat *“§20 routes results through `claimResults`, and §33 nests them under a `claimId`”* as a **discrepancy a ruling must resolve**. Read verbatim, they are one shape. Canon's §33 worked example (`Assurance Policy Catalog and Validator Contract.md:1887-1902`):

```json
"claimResults": [ { "claimId": "claim_01J...",
    "criterionResults": [ { "criterionId": "IP-01", "result": "MET",
                            "rationale": "…", "evidenceIds": [ "evidence_01J..." ] } ] } ]
```

Those leaves are **field-for-field `CriterionResultSchema`** (`objects.ts:238`: `criterionId, result, rationale, evidenceIds`). §20 declares the container, §20.1 defines the leaf, §33 exhibits the composition: `claimResults: [{ claimId, criterionResults: CriterionResult[] }]`.

⭑ **SO §0.6'S “ORPHANED SCHEMA” READING WAS ALSO WRONG.** `CriterionResultSchema` is not stranded — it is §33's **leaf type**, waiting on the outer element `ClaimAssessmentResult` that was left a placeholder. ⛔ **And it is the three enforcement probes that are off-canon**, not the contracts: their flat `{criterionId, result}` entries match no ratified shape. I had taken their shape as the repository's — the fixture-is-the-tell inversion, committed while quoting the rule against it.

#### (ii) ⛔ THE CENSUS CLAIM IN §4 IS FALSE, AND IT PUT AN UNFIREABLE RED IN THE ROADMAP

§4 says reusing the kernel helper *“would also collapse `deadPredicate`'s census, which exists to detect exactly that wiring”*. **Measured:** `deadPredicate: '` occurs **exactly three times** in `enforcement-register.ts` — `classifyInterruptedAttempt` (`:2683`), `validateAssumptionReification` (`:3482`), `blocksIrreversibleWork` (`:3562`) — and `mandatoryCriterionUnmet` **is not among them**. `RPH-CON-005`'s guard is `OBSERVED_ADMISSION`; its `whyNoPredicate` exists precisely to say a `DEAD_PREDICATE` row would be wrong. There is no `referencedOnlyBy` set to perturb, so the roadmap's first predicted red **cannot fire**.

⭑ **THE CONCLUSION SURVIVES ON A BETTER FACT.** `mandatoryCriterionUnmet` is `readonly mandatoryCriterionUnmet?: boolean` (`assurance-rules.ts:249`) — **one boolean, no criterion identity**, folded into a reason string at `:277`. Reuse could not name the failing criterion. That is §0.6's point arrived at independently, and it is the reason to keep, because it is true.

#### (iii) ⭐⭐ L3 HAS A RATIFIED HOME AFTER ALL, AND IT IS AN UNBUILT COMMAND, NOT A RULING

§2.2 concludes from `record-assurance.ts`'s comment that floor criterion results *“have no ratified home in §20 without inventing a claim id”* and that §20 therefore needs a **ratification**. The comment is narrowly true — *within §20*. ⛔ **§32 ratifies a command for exactly this, and it was never built:**

> §32 Assurance Commands — `activateAssurancePolicy / requestAssuranceAssessment / submitEvidenceForAssessment / selectAssuranceEvaluator / beginAssuranceAssessment / **recordCriterionResult** / recordAssuranceObservation / completeAssuranceAssessment / …`

⭐ **Its name is CRITERION-keyed, not claim-keyed**, and it sits between `beginAssuranceAssessment` and `recordAssuranceObservation` — a per-criterion record made DURING assessment, needing no `claimId` at all. ⚠ And `assurance.ts:2038` says so **three lines from the comment I built on**: *“Criterion results ARE still dropped at the boundary: `recordCriterionResult` was never built.”* The register says it twice more (`HARMONIZATION-LOG.md:1768`; `limb:ASR-5:6`'s remedy step (1), *“Populate `claimResults` on the assessment”*).

⭑ **AND THERE IS A BUILT PRECEDENT.** `submitEvidenceForAssessment` was one of the same four unbuilt §32 commands and *“HAS since been built and registered”* (`REG-005:771`). Only `recordCriterionResult` remains. So L3 is **an unbuilt ratified command**, not a ruling — and `CR-06` is reframed accordingly.

#### (iv) ⚠ AND `REG-F-209` LANDS ON `CR-01`'S FOUNDATION

`CR-01` derives mandatoriness from the policy loaded via `ctx.store.loadObject`. `EDITABLE_PATCH_FIELDS` includes `'criteria'` (`assurance.ts:275`) and `editAssurancePolicy` commits `newSemanticVersion: loaded.semanticVersion` (`:400`) — both verified. `REG-F-209` (**OPEN**, `CODE_DIVERGES`, both directions driven) states it: *“`editPwa` and `editAssurancePolicy` never raise at all, whatever they rewrite.”* So a criterion's `severityIfNotMet` can move while an assessment is ASSESSING, at an unchanged version, and the gate would judge against criteria **the assessment was never measured under** — which is what `RPH-CON-006`/`007` forbid for policy and subject version at this very site.

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
| **L1 — COVERAGE** | `RPH-CON-005` | a positive disposition whose `claimResults` do not answer every mandatory criterion | ~~⭐ **none**~~ → ⛔ **BLOCKED ON L3** (§0.4) |
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
folds where the gate must refuse. ~~⚠ Reusing it would also collapse `deadPredicate`'s census, which exists to detect exactly that wiring.~~ ⛔ **FALSE — see §0.7(ii); `mandatoryCriterionUnmet` is in no `DEAD_PREDICATE` row. The conclusion stands on §0.7(ii)'s replacement fact.**

⭑ **The gate gets its own predicate**, taking the policy's criteria and the result's `claimResults`, returning
the unanswered and the undetermined. It is reachable only from the command path, so the census stays honest.

---

## 5. ~~⚠ What L1+L2 will NOT do, stated before it is built~~

⛔⛔ **THIS WHOLE SECTION IS SUPERSEDED BY §0.3.** Its claim — that L1+L2 would be VACUOUS on the floor lane — is measurably backwards: L1 fires on that lane every time and is wrong every time. The section is kept unedited below because the reasoning it applies is correct and only its object was wrong, and because §0.3's correction is unreadable without it.

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

⛔⛔ **THE FOLLOWING MEASUREMENT IS FALSE — SEE §0.1, WHICH REDOES IT AND FINDS SIX. The second half (“every `claimResults:` is `[]`”) HOLDS.**

~~**Measured:** there are **ZERO non-test production dispatchers** of `CompleteAssuranceAssessment` anywhere
(only the handler registry and a test fixture)~~, and **every `claimResults:` in the repository is `[]`**
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
