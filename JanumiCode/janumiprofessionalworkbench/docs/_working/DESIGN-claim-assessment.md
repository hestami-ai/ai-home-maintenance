# DESIGN — The claim-assessment capability (REG-D-024 / REG-F-044)

**Status:** design record, pre-roadmap. **Authority:** REG-D-024 (sponsor conferral, 2026-08-06).
**Grounding:** 12 agents, 2.25M tokens, measure-then-refute; every claim below carries its citation and
every authored decision is marked **AUTHORED**.

---

## 0. The question REG-D-024 withheld, and its answer

REG-D-024 refused to decide whether claim status is **COMMANDED** or **DERIVED**, on the ground that the
corpus ratifying *events with no commands* was evidence either way. **It is settled, and it is COMMANDED.**
My derived hypothesis is refuted by ratified text I had not found.

### Leg 1 — a ratified conformance test presupposes the command

**RPH-DOC-008 §13, RPH-EVD-002 — *Supported claim requires evidence*, verbatim and in full:**

> **Given** a claim with no admissible evidence.
> **When** status is changed to `SUPPORTED`.
> **Then** the command is rejected.

**"The command is rejected."** The corpus ratifies a claim-status-changing **command** by presupposition.
Only its *name* was never minted.

⚠ **REG-F-044's central measurement was true of the identifiers and false of the concept.** It reported
that a corpus-wide grep for `supportClaim|contestClaim|rejectClaim|…` returns zero — and it does. But the
**concept** is ratified two documents away, in a conformance test that says the word *command*. That is the
both-directions check the finding did not run, on the finding whose whole subject is absence. **Fifth
instance in this programme of a claim about my search presented as a claim about the corpus.**

### Leg 2 — PER-3 forbids the alternative

**JPWB-DOC-003 §9 PER-3, verbatim:** canonical state is mutated *"only through authenticated, authorized,
semantically named commands"*, and *"No generic CRUD/PATCH path, UI local state, RPH worker, validator,
projection worker, broker message, agent output, or informal approval bypasses this pipeline."*

Claim `status` **is** canonical state — a field of the ClaimObject envelope (RPH-DOC-002 §15.1;
RPH-DOC-007 §13) and a `status text not null` column of the authoritative `claims` table (RPH-DOC-009
§11.1). **PER-7** forecloses the projection escape: *"Projections are derived, disposable, and powerless…
never authoritative write targets."* So an engine that computes claim status **without** a command is
barred, whatever causes the computation.

### And my hypothesis failed its own test

It required the events-without-commands gap to be **claim-specific**. It is not: differencing RPH-DOC-002
§26.5 against §34.2, `EvidenceRejected`, `EvidenceExpired` and `WaiverExpired` are *also* events with no
§34.2 command — and `EvidenceRejected` is plainly an act. §34's own framing explains the gap: its heading is
**"Minimum API Surface"** and it opens *"The first implementation should expose commands and queries rather
than unrestricted CRUD."* **A minimum is not a doctrine.** RPH-DOC-004 §32 is the corpus's own repair
pattern — a later document minting commands §34.2 omitted (`beginAssuranceAssessment`,
`recordCriterionResult`, `selectAssuranceEvaluator`, `submitEvidenceForAssessment`).

*The elegance of the derived reading was the whole of its appeal, and it did not survive a single ratified
sentence. This is the second time today.*

---

## 1. ⚠ The build cannot produce a real gate, and that must be said in advance

REG-D-024 required this to be stated plainly rather than discovered later. **Measured, not argued:** one
agent dispatched as a **single actor** (`{actorId: 'agent-x', actorType: 'AGENT'}`):

```
CreateAssurancePolicy (independenceRequirement: DIFFERENT_AGENT)  → ACCEPTED
ActivateAssurancePolicy                                            → ACCEPTED
AssertClaim (subject the store has never held)                     → ACCEPTED
ProposeEvidence (producedBy = a HUMAN the agent is not)            → ACCEPTED
AdmitEvidence (the same agent admits its own evidence)             → ACCEPTED
RequestAssuranceAssessment / Begin / Complete(SATISFIED)           → ACCEPTED
```

**All nine accepted.** Final `assessmentState = SATISFIED`, on a policy declaring `DIFFERENT_AGENT`
independence, with every operand supplied by the one actor.

**Why neither candidate design fixes that:**

- **A new command** puts the trust on `command.issuedBy`, and **there is no authentication layer** —
  `dispatch` runs identity-presence, envelope schema, payload hash, idempotency, payload schema, handler,
  and no authentication stage. REG-F-014's own scope paragraph already said this: binding makes authority
  *consistent*, not *verifiable*.
- **Derivation from assessment** does not move the trust to Evidence. It moves it to **two fields of the
  same command that renders the verdict**: `completeAssuranceAssessment` takes both independence operands
  from its own payload.
- The operands that *would* discriminate are inert: `validatorRole` / `evaluatorRole` — **4 writes, 0 reads**.
  `assertedBy` is honestly bound to the issuer and is **read by nothing**. `AuthorityReference.scope` —
  written, never read (REG-E-027).

**CONCLUSION, stated so it cannot be quietly forgotten: this build makes the ratified Claim machine
REACHABLE and its ratified consumers LIVE. It does not make claim status unforgeable, and it must not be
described as doing so.** The smallest thing that would close it is an assessment rendered by a validator the
caller does not control — which needs the authentication tier the Charter allocates elsewhere, the same
boundary RPH-EXE-004 and REG-F-014 both record.

**What the build DOES buy, and it is not nothing:** RPH-EVD-002's refusal is **ratified and
engine-derivable** — admissibility is a fact the engine holds. So the command ships with at least one real,
ratified, non-forgeable refusal: *a claim with no admissible evidence cannot be moved to SUPPORTED.*

---

## 2. What is RATIFIED (transcribe) versus AUTHORED (disclose)

### Ratified — transcribe, do not adjust

| Item | Source |
|---|---|
| The eight `ClaimStatus` values | RPH-DOC-002 §15.1, verbatim enum |
| Four event **names** | RPH-DOC-002 §26.5 — `ClaimAsserted`, `ClaimSupported`, `ClaimContested`, `ClaimRejected` |
| `ClaimAsserted`'s **payload** | RPH-DOC-007 §13.1 — the only claim payload the corpus schematizes |
| RPH-EVD-002's refusal | no admissible evidence ⇒ the command to SUPPORTED is rejected |
| ASR-8's cascade | JPWB-DOC-003 §8.3 — invalidation ⇒ dependent supported claims become *"contested, under review, or invalidated"* |
| §15.2's promotion bar | a contested claim cannot authorize baseline promotion *"unless resolved or waived"* |
| PER-3 / PER-7 | commands mutate canonical state; projections never do |

### ⚠ AUTHORED — and REG-D-024 itself asserted otherwise

**REG-D-024 named "the three ratified event payloads" as a fixed point the build "must satisfy, not material
it may adjust." That premise is false.** RPH-DOC-007 contains **zero** occurrences of `ClaimSupported`,
`ClaimContested` or `ClaimRejected`; §26.5 is a bare name list. And the repository's own vocab says so, on
all three rows, in as many words:

> *"UNRATIFIED-AUTHORED (annotated 2026-07-16 under sponsor grant): DOC-007 schematizes NO interface for
> this, so these fields were AUTHORED, not derived… **Do NOT treat this sourceSection as proof the shape is
> ratified.** Ratification pending."*

**A conferral I wrote two hours ago — whose own text warns against authored guesses acquiring borrowed
authority — did exactly that, about a shape whose vocab row contains a sentence written to prevent it.**
Corrected in the register; the conferral of the capability stands, the premise does not.

**Also authored, and each must be disclosed at its site:**

1. **All 15 arrows of `Claim.status`.** The corpus has **no claim transition matrix** — RPH-DOC-002 carries
   explicit matrices for exactly two machines (§6.2 Intent, §8 PWU), and an arrow-adjacency regex over all
   63 corpus files finds **zero** claim arrows. The vocab's own machine-level `sourceSection` says
   *"Transitions RECONSTRUCTED… **NO explicit matrix**"*, and every one of its rows is noted `RECONSTRUCTED`.
2. **Every command name.** `supportClaim` / `assessClaim` / `recordClaimAssessment` — all authored.
   RPH-EVD-002 ratifies that *a* command exists and names none.
3. **The three payload shapes** (above).
4. **ASR-8's three-way disjunction.** *"contested, under review, or invalidated"* — no ratified text says
   which applies when. The machine cannot even express two of the three: there is **no
   `SUPPORTED → UNDER_ASSESSMENT` arrow** and **no `INVALIDATED` state**, while RPH-DOC-008 RPH-EVD-005 and
   RPH-DOC-006 §28 Test 10 both name the *"or under assessment"* limb as a conformance expectation.
5. **"Resolved."** §15.2 bars a contested claim *"unless resolved or waived"* and the corpus never defines
   resolution for a claim. Nothing leaves `CONTESTED` toward support in the declared machine.
6. **`SUPERSEDED` entirely** — zero corpus prose, and **5 of the 15 arrows** (a third of the machine).
7. **`WAIVED` for claims.** §26.3 ratifies `ConstraintWaived` and `ObligationWaived`; there is **no
   `ClaimWaived`**, and the machine's authored trigger `WaiverGranted` is a **Decision**-aggregate event.
8. **`CONDITIONALLY_SUPPORTED`** — no ratified prose; its single corpus occurrence is a hedged list in a
   legacy-mapping document. It also has no condition-closing arrow, which ASR-9 / DEC-6 require.

---

## 3. What to build

**Scope: make the machine reachable and its ratified consumers live. Nothing else.**

1. **One command, minimal surface** — `RecordClaimAssessment` **(AUTHORED name)**, carrying the target
   status and its operands. One command rather than four verbs, because four verbs multiply authored
   identifiers without adding a ratified distinction.
2. **RPH-EVD-002 as its first refusal** — reject `→ SUPPORTED` when the claim has no **admissible**
   evidence, derived from committed events, never from the payload. This is the one non-forgeable check
   available and it is ratified; it is also the red the build must predict and observe.
3. **Emit the ratified event names** — `ClaimSupported` / `ClaimContested` / `ClaimRejected`, payloads
   marked AUTHORED at their vocab rows (they already are).
4. **Feed `findContestedClaims`** — the live, ratified, permanently-unfed kernel predicate. Its input
   becomes a real fold over claim status, which is the single clearest proof the capability is not hollow.
5. **Land ASR-8's cascade** — `invalidateEvidence` already computes `affectedClaimIds` and mutates nothing.
   **AUTHORED:** of ASR-8's three limbs, take **`CONTESTED`**, because it is the only one the declared
   machine can express and the only one with a ratified consumer (§15.2's promotion bar). The other two are
   disclosed as unrepresentable, not silently dropped.
6. **Do NOT** add an `INVALIDATED` state, a `SUPPORTED → UNDER_ASSESSMENT` arrow, a resolution act, or a
   claim waiver. Each is authored, none has a consumer, and minting them would repeat the defect this whole
   entry exists to cure — a governed shape with no act that gives it a life.

**Out of scope and stated so:** `parentCompletionClaimId` resolution (REG-F-044's cheap move) is *not*
bundled here. It is a recomposition change, it does not close its own fail-open, and folding it in would let
this build claim a closure it has not earned.

---

## 4. What this design must never be described as

- **Not a gate.** §1. A caller can drive a claim to SUPPORTED through evidence it proposed and admitted.
- **Not a ratified state machine.** §2. Fifteen authored arrows.
- **Not a closure of RPH-EVD-001.** Reification needs the assessment to *decide* a claim; this build lets a
  command record one. Re-disposition is a separate measurement, and must be earned by a probe, not asserted.
