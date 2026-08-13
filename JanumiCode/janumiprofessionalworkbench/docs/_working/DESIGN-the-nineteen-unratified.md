# DESIGN — the nineteen unratified declarations (REG-F-121's pinned finding)

**Status: DESIGN IN PROGRESS — enumeration and mechanism MEASURED (2026-08-13); per-site dispositions pending
the checks in §4. No change lands from this doc until it carries a roadmap section.**

## 1. The population, enumerated (measured 2026-08-13, census at commit `6262faa0`)

19 distinct declared arrows no machine ratifies, from FOUR sites. The shape: each site declares
`fromStates × targetStates` as a RECTANGLE; the machine ratifies a sparse subset; these are the difference.

| # | Arrow | Site |
|---|-------|------|
| 1 | `Claim.status CONDITIONALLY_SUPPORTED -> REJECTED` | assurance.ts:770 |
| 2 | `Claim.status CONDITIONALLY_SUPPORTED -> SUPPORTED` | assurance.ts:770 |
| 3 | `Claim.status CONDITIONALLY_SUPPORTED -> UNDER_ASSESSMENT` | assurance.ts:770 |
| 4 | `Claim.status CONTESTED -> CONTESTED` **(self)** | assurance.ts:770 |
| 5 | `Claim.status CONTESTED -> SUPPORTED` | assurance.ts:770 |
| 6 | `Claim.status CONTESTED -> UNDER_ASSESSMENT` | assurance.ts:770 |
| 7 | `Claim.status OPEN -> CONTESTED` | assurance.ts:770 |
| 8 | `Claim.status OPEN -> REJECTED` | assurance.ts:770 |
| 9 | `Claim.status OPEN -> SUPPORTED` | assurance.ts:770 |
| 10 | `Claim.status SUPPORTED -> REJECTED` | assurance.ts:770 |
| 11 | `Claim.status SUPPORTED -> SUPPORTED` **(self)** | assurance.ts:770 |
| 12 | `Claim.status SUPPORTED -> UNDER_ASSESSMENT` | assurance.ts:770 |
| 13 | `Claim.status UNDER_ASSESSMENT -> UNDER_ASSESSMENT` **(self)** | assurance.ts:770 |
| 14 | `ExecutionPlan.status ACTIVE -> ACTIVE` **(self)** | execution.ts:668 |
| 15 | `RuntimeBinding.authorizationStatus PARTIALLY_AUTHORIZED -> PARTIALLY_AUTHORIZED` **(self)** | runtime-binding.ts:119 |
| 16 | `ValidatorRegistryEntry.status ACTIVE -> ACTIVE` **(self)** | validator-registry.ts:82 |
| 17 | `ValidatorRegistryEntry.status DEGRADED -> DEGRADED` **(self)** | validator-registry.ts:82 |
| 18 | `ValidatorRegistryEntry.status DISABLED -> DEGRADED` | validator-registry.ts:82 |
| 19 | `ValidatorRegistryEntry.status DISABLED -> DISABLED` **(self)** | validator-registry.ts:82 |

8 self-transitions; 11 non-self pairs. `assurance.ts:770` alone contributes 13.

## 2. The mechanism split (measured: `stateMachine.ts` + `checkTransition`)

`classifyTransition` consults `illegal` first, then classifies `from === to` as **NOOP**, then the machine's
transition list. `advanceStatus` goes through `checkTransition`, which admits **LEGAL or NOOP**
(`stateMachine.ts:59-65` records the split as deliberate — JAN-CMDPRE). Therefore, unless a site's
precondition narrows further:

- **The 8 self-transitions CAN FIRE at runtime.** Their sites' `fromStates` include the target state, so the
  precondition admits the pair and `checkTransition` admits the NOOP. These are **performed-but-unratified**
  arrows — the dangerous class: live behavior no ratified machine models.
- **The 11 non-self pairs CANNOT FIRE.** `checkTransition` refuses them (not ratified, not NOOP). These are
  **over-claimed declarations** — the census reports a capability the command does not have. The direction of
  error is the safe one (noisy false coverage-claims, no hidden behavior), but REG-F-119 recorded exactly this
  as "fabricated coverage arriving through a declaration instead of an inference."

⚠ Per-arrow confirmation is still owed: a site's `guard` or additional predicates could refuse a NOOP the
machine admits (the governance handlers do exactly this). The mechanism split above is the DEFAULT, not the
per-site fact.

## 3. Disposition hypotheses — stated as hypotheses, not decisions

- **The 11 over-claims:** narrow the declarations to the machine's actual pairs. Repository-side honesty, no
  behavior change, count drops 175 → 164 declared / unratified 19 → 8. The rectangle idiom cannot express a
  sparse relation, so narrowing may require per-target `fromStates` (split calls) or a spec-table idiom
  (STEP_COMMAND_SPECS shape). NOTE the REG-F-122 constraint: whatever idiom is used must keep the from-half
  readable at the site — no helper-composed preconditions.
- **The 8 self-transitions:** three possible dispositions, PER SITE, and they are not interchangeable:
  (a) the NOOP re-issue is a DEFECT (duplicate event, like governance's REVOKED->REVOKED) → refuse via
  precondition, arrow disappears from declarations;
  (b) the NOOP re-issue is MEANINGFUL (re-assessment recording new evidence at unchanged status — the HOLD
  shape) → the machine is incomplete; a self-arrow needs RATIFICATION (canon-tier, sponsor question, goes on
  the ratification-owed list — NOT decidable repository-side);
  (c) already ruled by JAN-CMDPRE (its DWP series decided NOOP handling per command; RESIDUALS R1-R6 were
  recorded as "none a defect") → cite the ruling, mark the arrow as deliberately-admitted, and pin it as such.

## 4. Checks that decide §3 — MUST be done before any roadmap is written

1. **Search the register + JAN-CMDPRE design corpus (Deferrals/Disclosed) for these exact sites.** Four of six
   "open" governance questions in a prior pass were already answered. The CMDPRE residuals R1-R6 are the most
   likely home of a prior ruling on these self-edges.
2. **Read the four sites** (assurance.ts:770, execution.ts:668, runtime-binding.ts:119,
   validator-registry.ts:82): what the command means, what its guard already refuses, what event a NOOP
   re-issue appends, and whether `docs/_working/ROADMAP-claim-assessment.md` already covers the Claim site.
3. **Drive one self-edge end-to-end** before claiming it fires: construct the aggregate in the state, issue the
   command targeting the same state, observe ACCEPT + event append (or a refusal that reclassifies it). The
   mechanism argument in §2 is not a substitute for driving the engine (verify-the-recorded-remedy).
4. Only then: the roadmap section, with a predicted red per change and the pinned finding's count updated
   deliberately (19 → 8 → per-site dispositions).

## 5. What this doc refuses to do

- No `transitions.data.ts` edit — machines are reconstructed from ratified corpus; adding self-arrows is a
  ratification act, not a repository act (REG-F-114's whole lesson, from the other side).
- No blanket rule for the 8 self-edges. The governance NOOPs were defects; a re-assessment NOOP may be the
  product working. A conclusion measured on one member of a class must not be written as a rule about the
  class (REG-F-120).
