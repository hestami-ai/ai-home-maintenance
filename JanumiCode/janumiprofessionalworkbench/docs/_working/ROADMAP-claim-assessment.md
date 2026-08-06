# ROADMAP — claim-assessment capability

**Design:** `DESIGN-claim-assessment.md`. **Authority:** REG-D-024. **Closes:** REG-F-044.
**Does NOT close:** RPH-EVD-001 (re-disposition must be earned by a probe, not asserted).

Every increment names **the red it predicts before it is written**, and the red is run and observed.
A control that cannot fail is not a control (standing rule); each refusal therefore carries both a
mutant that reddens it and a positive case that must stay green.

---

## INC-1 — Contracts

Add **`RecordClaimAssessment`** to `packages/rph-contracts/vocab/m3-commands-events.json`
(**tabs + LF**; wrong format ⇒ thousand-line diff), then `bun run gen`.

- Payload: `targetStatus: ClaimStatus`, `assessmentId?: string`, `rationale?: string`,
  `contradictingEvidenceIds?: string[]`.
- **Every field annotated `UNRATIFIED-AUTHORED`**, matching the three event rows that already carry
  that annotation. RPH-EVD-002 ratifies that *a* command exists; the name and shape are mine.
- One command, not four verbs — four verbs would multiply authored identifiers without adding a
  ratified distinction (design §3.1).

**Gate:** `check-types`, `rph-contracts` tests.
**Predicted red:** none — additive. If anything reddens, a name collided.

---

## INC-2 — Handler, and the one refusal that is ratified

`recordClaimAssessment` in `handlers/assurance.ts`, routed through `advanceStatus` on
`Claim.status` so transition legality comes from the declared machine (**authored — REG-F-045**).

**The RPH-EVD-002 refusal, derived and not taken from the payload:**

> *Given a claim with no admissible evidence. When status is changed to `SUPPORTED`. Then the command
> is rejected.*

Admissible = an `EVIDENCE` object with `status === 'ADMISSIBLE'` whose `supportsClaimIds` names this
claim, folded from **committed events**. `EvidenceStatus` is `PROPOSED | ADMISSIBLE | REJECTED |
SUPERSEDED | INVALIDATED`, so `ADMISSIBLE` is the ratified term and no interpretation is required.

Emit `ClaimSupported` / `ClaimContested` / `ClaimRejected` per target status.

**Predicted reds — three, and the third is the one that matters:**
1. `→ SUPPORTED` with no admissible evidence ⇒ REJECTED. *Mutant:* delete the refusal ⇒ this reddens.
2. `→ SUPPORTED` **with** admissible evidence ⇒ ACCEPTED. **This is the control**: without it, a
   refusal that refuses everything passes test 1. *Mutant:* make the refusal unconditional ⇒ reddens.
3. Evidence that is `PROPOSED` but **not** `ADMISSIBLE` ⇒ still REJECTED. *Mutant:* weaken the check
   to mere existence ⇒ **only this one reddens.** This is what pins *admissible* rather than *present*
   — the same distinction `authorityDecisionId` needed (EFFECTIVE, not merely present).

---

## INC-3 — Feed `findContestedClaims`

`findContestedClaims` (`rph-domain/src/governance.ts:301`) is **live, ratified (§15.2), and
permanently unfed**: `canPromoteBaseline` is called at `handlers/governance.ts:813` **with no
`contestedClaims` argument at all**, and the field is `?? []` inside. Every production promotion has
evaluated it against nothing.

Derive `ContestedClaimView[]` from committed claim state for the baseline's items and pass it.

**Predicted reds:**
1. Promote a baseline whose item has a `CONTESTED` claim ⇒ REFUSED with `CONTESTED_CLAIM`.
   *Mutant:* stop passing the argument ⇒ reddens (i.e. reproduces today's behaviour).
2. **Control:** the same promotion with the claim `SUPPORTED` ⇒ ACCEPTED. Without it, this is
   indistinguishable from a promotion refused for one of the other six reasons — the REG-F-015 trap,
   where every assertion was true about a different refusal.

---

## INC-4 — ASR-8's cascade, one limb of three

**JPWB-DOC-003 §8.3 ASR-8:** *"When evidence is invalidated or expires, every dependent supported
claim becomes contested, under review, or invalidated."* `invalidateEvidence` already computes
`affectedClaimIds` and **mutates no claim**.

**AUTHORED:** take **`CONTESTED`**. It is the only limb the declared machine can express (there is no
`SUPPORTED → UNDER_ASSESSMENT` arrow and no `INVALIDATED` state) and the only one with a ratified
consumer (§15.2's promotion bar, now fed by INC-3). **The other two limbs are disclosed as
unrepresentable in the code and the register — not silently dropped.**

**Predicted reds:**
1. Invalidate evidence supporting a `SUPPORTED` claim ⇒ claim becomes `CONTESTED`. *Mutant:* drop
   the cascade ⇒ reddens.
2. **Control:** invalidating evidence that supports **no** claim leaves every claim untouched.
3. **The chain, end to end:** admissible evidence → `SUPPORTED` → invalidate → `CONTESTED` →
   promotion REFUSED. This is the single test proving the capability is not hollow, because it is the
   only one that traverses command → status → ratified consumer.

---

## INC-5 — Record

- **Close REG-F-044** with the measurement, not the intention: claim states reached, events emitted,
  `findContestedClaims` fed.
- **Do NOT close RPH-EVD-001.** Its `OBSERVED_ADMISSION` probe must be re-run and re-dispositioned on
  what it observes. Reification means an assessment *decides* a claim; this build lets a command
  *record* one.
- **Restate the limit in the register, in the same words as the design:** this makes the machine
  reachable and its consumers live; it does **not** make claim status unforgeable. The nine-command
  single-actor sequence still succeeds.

**Final gate (each leg its own exit code, nothing piped):** `check-types` · `lint` · `boundary` ·
`bunx vitest run` · `test:dist` · `apps/rph-demo bun run check` · `bunx playwright test`.
