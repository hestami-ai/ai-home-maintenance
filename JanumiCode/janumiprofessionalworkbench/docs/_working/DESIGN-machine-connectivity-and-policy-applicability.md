# Machine connectivity, and giving policy applicability an operative consequence

> **Status: DESIGN. No code accompanies it.** Authored under the sponsor's 2026-08-05 delegated authoring grant,
> which changes the discipline from *"do not invent"* to *"author from the corpus, and disclose what is authored"*.
> Every disposition below cites what it rests on; each is labelled **DELIVERY** (a ratified thing not reaching the
> runtime), **TRANSCRIPTION** (a ratified shape not yet schematized), or **AUTHORED** (genuinely new, mine, and
> marked).
>
> It supersedes the framing of REG-E-024, which asked *"what becomes of the unreachable states"*. That question had
> a weaker premise than the facts support.

---

## 1. The question was too weak, and the stronger one changes the answer

REG-F-023 asked **which states have no in-arrow**. The stronger question is **which states are reachable from the
machine's own initial state**, transitively. It finds strictly more, and what it finds is not a tidy-up:

| machine | reachable from its declared start |
|---|---|
| `PWU.assuranceState` | **1 of 11** |
| `AssuranceAssessment.state` | 14 of 15 (`CANCELLED` stranded) |
| `ValidatorRegistryEntry.status` | no initial state at all |

**Ten of the eleven states on the PWU assurance axis cannot be reached from where the machine says a PWU starts.**
Read literally, a PWU can never become assured.

### 1.1 It is not true in practice, and the reason is the finding

`ProposePwu` creates every PWU with **`assuranceState: 'UNASSESSED'`** (`pwu.ts:214`). The machine declares
**`initialState: 'NOT_REQUIRED'`**. Those disagree, and they have disagreed since the machine was written.

`NOT_REQUIRED` is, measured: declared **initial**, declared **terminal**, with **no in-arrow and no out-arrow** — an
isolated vertex. `UNASSESSED` is the source of the machine's first arrow (`UNASSESSED → EVIDENCE_REQUIRED`, *"policy
requires evidence"*) and every other state descends from it.

So the engine is right and the declaration is wrong. **REG-F-023 recorded `UNASSESSED` as "a state with no
in-arrow"; it is in fact the machine's real entry point, mislabelled.** An entry point having no in-arrow is
correct — what is wrong is that the machine names a different state as its start.

> **Why the weaker question hid it.** "Has an in-arrow" treats every state independently, so a mislabelled entry
> point looks like an orphan and an isolated initial state looks fine. Connectivity asks whether the machine is a
> machine, and that is the property that was violated.

---

## 2. Dispositions

### 2.1 `PWU.assuranceState.initialState` → `UNASSESSED` — **DELIVERY**

Not a choice: the engine creates PWUs in `UNASSESSED`, and the ratified arrow set descends from it. This makes the
declaration match the corpus's own transition table and the code's behaviour simultaneously. Nothing is invented.

**Consequence:** `NOT_REQUIRED` becomes the stranded state — correctly, because nothing can currently reach it.

### 2.2 `UNASSESSED → NOT_REQUIRED` — **AUTHORED**, on ratified ground

`NOT_REQUIRED` means *assurance does not apply to this work*. DOC-004 §5.2 already ratifies the vocabulary for
deciding that: `ApplicabilityOutcome = REQUIRED | RECOMMENDED | OPTIONAL | NOT_APPLICABLE |
REQUIRES_HUMAN_DETERMINATION`. So the arrow's trigger is not invented — it is the §5.2 determination returning
`NOT_APPLICABLE` for every policy that could otherwise apply.

**AUTHORED part:** that §5.2 outcomes should *drive this axis* at all. The corpus defines the outcomes and the
states and never connects them. I am connecting them, and saying so.

### 2.3 `{REQUESTED, EVIDENCE_PENDING, READY} → CANCELLED` — **AUTHORED**, closing REG-F-021's R-1

`CANCELLED` is declared terminal with no in-arrow, which is why an assessment stalled in `EVIDENCE_PENDING` — its
required evidence never arriving — cannot be closed by anything. §32 names `invalidateAssuranceAssessment`, but its
ratified arrows run `SATISFIED`/`CONDITIONALLY_SATISFIED → INVALIDATED`: that is for invalidating a **verdict**, and
a stalled assessment has no verdict to invalidate.

**Authored:** cancellation is available from the three **pre-conclusion** states and from nowhere else. Not from
`ASSESSING` — an assessment being actively judged should reach a disposition (`INCONCLUSIVE` exists precisely for
"could not decide"), and allowing cancellation there would give a governed escape from an in-flight judgment.
Not from terminal states — a reached verdict is superseded or invalidated, never cancelled.

> **The distinction being drawn, stated so it can be argued with:** `INCONCLUSIVE` is *"we assessed and could not
> conclude"*. `CANCELLED` is *"we never assessed"*. Collapsing them would let a never-started assessment be recorded
> as a judgment that reached no conclusion, which is a stronger claim than the truth.

### 2.4 `ValidatorRegistryEntry.status` — **AUTHORED**, and the smallest honest version

Three states, no initial state, no arrows. DOC-004 §22 requires the audit log to record validator identity and
version, and the catalog declares `DEGRADED`/`DISABLED` — so **the assurance system cannot currently record that
one of its own validators is failing.**

Minimal authored machine: initial `ACTIVE`; `ACTIVE ↔ DEGRADED`; `ACTIVE → DISABLED`; `DEGRADED → DISABLED`.
`DISABLED` terminal. **Deliberately no `DISABLED → ACTIVE`:** re-enabling a disabled validator is a governed
re-admission and should be a new registry entry with its own provenance, not a silent revival — the same
supersede-never-mutate discipline the baseline machine uses.

**This one is scoped OUT of the first increment.** It needs commands, an aggregate and a registry that do not
exist; declaring arrows for an object nothing creates would add a second unreachable machine in place of the first.
Recorded here so the disposition is on file, and sequenced after.

### 2.5 Policy applicability — **TRANSCRIPTION**, then **DELIVERY**

REG-F-022's second instance: `appliesToPwuKinds` is authored by twelve catalog policies and read by nothing. It has
a **ratified home** — DOC-004 §5.1 `ApplicabilityRule.pwuKindConditions` — and the policy object already carries an
`applicability` field, which `createAssurancePolicy` hardcodes to `{}`.

Two defects, one under the other:

1. **`ApplicabilityRuleSchema` is `z.record(z.string(), z.unknown())`** — an opaque bag, while §5.1 defines a
   nine-field interface. **TRANSCRIPTION:** schematize it from §5.1. The interface is ratified text; typing it is
   not authoring.
2. **The handler hardcodes `applicability: {}`.** **DELIVERY:** carry the ontology's `appliesToPwuKinds` into
   `applicability.pwuKindConditions`, and the object types into `objectTypeConditions`.

**And then it must be READ, or this is REG-F-022 again one field over.** A `policyApplies(policy, subject)` kernel
predicate returning a §5.2 `ApplicabilityOutcome`, wired as a precondition on `RequestAssuranceAssessment`: an
assessment against a policy that is `NOT_APPLICABLE` to its subject is refused. That is the operative consequence
the field has never had — and it is what makes 2.2's arrow reachable in practice.

---

## 3. What is deliberately NOT in this design

**REG-F-022's evidence requirements.** Authoring `requiredEvidence` for twelve policies means nine
`EvidenceRequirement` fields each, of which the ontology supplies one (`evidenceType`). The other eight — id,
description, purpose, cardinality, admissibility rules, freshness, `requiredForDispositions`, waivability — are
genuine authoring, and `requiredForDispositions` in particular decides whether each requirement gates **assessing**
or only a **positive verdict** (REG-F-021 increment 3 established that distinction, the hard way).

The blast radius is comparable to the whole REG-F-021 programme: every catalog assessment would land in
`EVIDENCE_PENDING`, and every drive would need real evidence. **Doing it half-way is worse than not starting**, so
it gets its own design rather than a subsection of this one.

`admissibilityRules` will be `[]` there, and that is not laziness: §6.2's eight admissibility conditions are
already enforced generically by the ratified `evidenceAdmissibility` rule (RPH-EVD-007). Per-requirement rules are
a refinement, not a precondition of closing the gap.

---

## 4. Increments, and the red each must show first

| # | change | kind | first red |
|---|---|---|---|
| 1 | `initialState: 'UNASSESSED'` + connectivity gate | DELIVERY | connectivity test reports 10/11 stranded **before**; 1 (`NOT_REQUIRED`) after |
| 2 | `UNASSESSED → NOT_REQUIRED` arrow | AUTHORED | `NOT_REQUIRED` stranded before; zero stranded after |
| 3 | schematize `ApplicabilityRule` (§5.1) | TRANSCRIPTION | a policy with a malformed `applicability` is ACCEPTED before, refused after |
| 4 | deliver `pwuKindConditions`; `policyApplies` kernel; precondition | DELIVERY | delivery census names `appliesToPwuKinds` before, not after |
| 5 | `→ CANCELLED` arrows + `cancelAssuranceAssessment` | AUTHORED | a stalled `EVIDENCE_PENDING` assessment cannot be closed before; can after |
| 6 | `ValidatorRegistryEntry.status` | AUTHORED | deferred — needs an aggregate that does not exist |

**The gate this rests on must be strengthened first.** `state-reachability.test.ts` asks "has an in-arrow"; it must
ask "is reachable from the initial state", or increments 1 and 2 have no instrument. That strengthening is what
found all of this, and it belongs in the repository before the changes it justifies.
