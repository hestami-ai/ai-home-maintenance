# ROADMAP — landing the catalog's evidence requirements (REG-E-026) and the §36 failure taxonomy (REG-E-025)

**Date:** 2026-08-05 · **Authority:** sponsor ratification 2026-08-05 + standing authoring grant
**Design:** `DESIGN-evidence-requirements.md` (v2)

Each increment: land → gate → commit. No increment may leave a gate measuring nothing.

---

## Standing rule for this roadmap

Every increment names **the test that must redden** before its green is trusted. A green whose predicted red was
never named is not evidence — that is `feedback_green_needs_a_predicted_red`, and this roadmap's whole subject is
a control that has read an empty set since the day it was written.

---

## INCREMENT 1 — the corpus measurement, corrected and made executable

**Why first.** Everything downstream rests on "89 items across 11 policies". If that count is as wrong as "2 of
12" was, the authoring is built on sand. So the count becomes a **derived assertion** before it becomes content.

- Extend `doc004-conformance.test.ts` with an evidence-section reader that walks **every `# N. Policy` section**
  and asks which of `Required evidence` / `Evidence` it has — structure-first, never a name-first search.
- Assert: 12 policy sections; 2 carry `Required evidence`; 9 carry `Evidence`; **§20 carries neither**; 89 items.

**Predicted red:** delete a bullet from §15.5 in a scratch copy → the item count reddens. Rename §21.4's heading
to `Required evidence` → the tier split reddens.

**Gate:** `rph-product-realization-pwa` tests.

---

## INCREMENT 2 — the requirements themselves, into the ontology

- Add `requiredEvidence` / `optionalEvidence` (`EvidenceRequirement[]`) to `SeedPolicy` in
  `m8-ontology.json` + `ontology.types.ts`; regenerate.
- Author all 89 per DESIGN §2's field table. `sourceSection` records, per policy, which fields are transcribed,
  which derived by which rule, and which authored.
- **Remove `requiredEvidenceTypes`** from the 12 seed policies (DESIGN §5). Record the one-time coverage
  comparison — every previously-declared type must still appear among the classified `evidenceType`s, or the
  narrowing is disclosed.

**Predicted red:** `doc004-conformance.test.ts` gains a per-item description check; changing one authored
`description` away from the corpus wording reddens it.

**Gate:** `check-types` + `rph-product-realization-pwa` + `rph-contracts`.

---

## INCREMENT 3 — delivery: the field reaches the object

- `seedAdditivePolicies` maps both fields into `CreateAssurancePolicy`.
- `EngineSeedPolicy` (the engine's port type) declares them — its *not* declaring `requiredEvidenceTypes` is why
  the original drop could not produce a type error (REG-F-022).
- Invert `verif/policy-evidence-requirement-census.test.ts`: the pin at zero comes **out**, per its own
  instruction (*"DELETE THE PIN, do not extend it"*), and is replaced by a positive census — how many policies
  carry requirements, how many items, and **that §20 carries none**, so "all twelve" can never quietly become
  the passing condition.
- The CONTROL in that file is the one assertion that must **not** change.

**Predicted red:** drop either field from the `seedAdditivePolicies` payload → the positive census reddens
naming the policies. This is the mutation that proves the census is not the old blind reader.

**Gate:** `rph-engine` + the `verif` suite.

---

## INCREMENT 4 — make `cardinality` read (DESIGN §6)

A `ZERO_OR_MORE` requirement is satisfied by zero instances. Three sites compute "outstanding" from ids alone and
would invert that meaning the moment Increment 3 lands:

- `requestAssuranceAssessment` — the `EVIDENCE_PENDING → READY` arrow.
- `submitEvidenceForAssessment` — the same arrow's later evaluation.
- `completeAssuranceAssessment` — **Gate A**.
- `assurance-view.ts` — §38 `missingEvidence`.

One shared predicate, used by all four, so they cannot disagree — the same reason `driveAssessmentToAssessing`
exists.

**Predicted red:** a requirement with `cardinality: ZERO_OR_MORE` and no evidence must **not** block SATISFIED;
a sibling `AT_LEAST_ONE` with no evidence **must**. Both arms tested, and the ZERO_OR_MORE arm must redden if the
predicate is reverted to id-only.

**Gate:** `rph-application` + `rph-projections`.

---

## INCREMENT 5 — reconcile the callers with a gate that now bites

Gate A is live for §15/§16. Whatever this breaks is **a true report about a caller that could not have satisfied
the policy**, and the response is to fix the caller honestly — never to weaken the requirement, and never to
submit evidence for a referent that does not exist.

- Run the full suite and **record the actual failures** rather than the predicted ones.
- For each: either the caller genuinely has the evidence (submit it, citing the real object), or it genuinely
  does not (complete at the disposition its evidence supports, with the gap recorded as residual uncertainty).
- **`earnAssurance` must not conjure evidence.** Its own header records that it once did and that this was fixed;
  re-introducing it to keep a drive green would regress a closed finding to protect a number.

**Predicted red:** this increment *starts* red — that is its purpose. It ends when every red is either satisfied
by real evidence or honestly re-dispositioned.

**Gate:** full `bunx vitest run` + `test:dist`.

---

## INCREMENT 6 — REG-E-025: the §36 failure taxonomy

**A citation correction first.** REG-E-025 says *"DOC-004 §36.2"*. RPH-DOC-004 §36 is **Assurance Profiles**
(Lightweight / Standard / High). The failure taxonomy is **RPH-DOC-002 §36**, and its §36.2 is *Execution
failures*. The entry names the right seven items under the wrong document — recorded because a mis-cited
ratification is how a "ratified" claim gets laundered.

The full ratified picture, which REG-E-025 saw only one fifth of:

| § | Class family | Members |
|---|---|---|
| 36.1 | Shape failures | 8 |
| 36.2 | **Execution failures** | 7 |
| 36.3 | Assurance failures | 7 |
| 36.4 | Governance failures | 5 |
| 36.5 | Persistence failures | 5 |
| | | **32** |

closing with the §36-wide rule: **"Each failure class must map to permitted control actions."**

- Mint `ExecutionFailureClass` from **§36.2 only** — that is the taxonomy the two `failureClass` payload fields
  are about (they are on `FailExecutionStep` / `ExecutionStepFailed`). The other four families are real and
  ratified but belong to fields that do not exist; minting them now would be four more declared-and-unreachable
  vocabularies, which is REG-F-023's finding.
- Author the **§36.2 → `ControlAction`** mapping, satisfying the ratified sentence for the one family being
  minted, and disclose that the other four remain unmapped.
- Reconcile `TRANSIENT`: it appears in no §36 list, has no production producer, and is a test fixture only.

**Predicted red:** a `failureClass` outside the minted enum must be refused; the mapping must be total over the
enum (a member with no permitted control action reddens).

**Gate:** `rph-contracts` + `rph-application` + `rph-domain`.

---

## INCREMENT 7 — full gate, adversarial review, register

- Full gate: `vitest` + `test:dist` + `check-types` + `lint` + `boundary` + `apps/rph-demo` `check` + `playwright`.
- Adversarial review of the **authored** content specifically: every `purpose` sentence and every `evidenceType`
  classification is mine, and the corpus cannot arbitrate them. The review's job is to find the ones that assert
  more than the item supports.
- Register: REG-E-026 and REG-E-025 dispositions; the measurement correction as its own finding; the
  `cardinality` blindness as its own finding.

---

## What would make this roadmap wrong

Stated up front so it can be checked rather than defended:

1. **If the `Required evidence` / `Evidence` heading split is authorial drift**, the tier assignment is wrong —
   though the transcription, ids, and classification survive, and the fix is one rule.
2. **If §15.9's "required evidence is admissible" means admissibility-of-what-arrived rather than
   presence-of-all-required**, then Gate A's presence semantics are the wrong referent — but Gate A predates this
   work and its semantics are not changed here.
3. **If a sponsor intends §20 to have evidence requirements**, the honest `[]` is an under-delivery — visible as
   `11 of 12` in the census rather than hidden.
