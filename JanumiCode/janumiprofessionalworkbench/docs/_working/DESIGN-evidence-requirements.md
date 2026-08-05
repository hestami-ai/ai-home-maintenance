# DESIGN — REG-F-022's evidence requirements: what is grounded, what is not, and why this does not land as code

**Date:** 2026-08-05 · **Status:** measurement + proposal, awaiting a ratification · **Raised as:** REG-E-026

---

## 1. Why this is opened now

REG-F-022 is the last thing making the restored §30 lifecycle **look** like it gates evidence without doing so.
Two live consequences, both currently vacuous:

- **`EVIDENCE_PENDING → READY`** keys on requirements whose `requiredForDispositions === 'ALL'`. No policy declares
  any requirement, so every assessment the product creates takes the vacuous arm and lands `READY` immediately.
- **Gate A** (completion-time: a SATISFIED disposition may not stand on unmet mandatory evidence) and §38's
  *"missing evidence"* fold both read an **empty required set** on every policy that ships.

The logic is correct and its **input is empty**. `verif/policy-evidence-requirement-census.test.ts` pins that at
zero and instructs: *"When REG-F-022 is fixed this reddens — DELETE THE PIN, do not extend it."*

## 2. What the corpus actually grounds — measured, not assumed

**The SHAPE is ratified.** DOC-004 §6.1 defines `EvidenceRequirement` with nine fields: `id`, `evidenceType`,
`description`, `purpose`, `cardinality` (a five-value enum), `admissibilityRules`, `freshnessRule?`,
`requiredForDispositions`, `mayBeWaived`.

**The CONTENT is almost entirely absent, and less present than REG-F-022's own entry says.**

| | Finding |
|---|---|
| Per-policy required-evidence sections | **2 of 12**. Only §15.5 and §16.4 exist. |
| What those two give | A **prose list of item names** — e.g. §15.5: *"originating expression; clarification dialogue; supplied documents; proposed Product Intent; constraints; recorded user corrections; prior intent version where applicable."* No ids, no `evidenceType`, no cardinality, no disposition-gating, no waivability. |
| What the dataset carries | `requiredEvidenceTypes: readonly string[]` on all 12 — evidence **types only**. |
| **Provenance of that field** | **`AUTHORED (no ratified source)`** — stated in each policy's own `sourceSection`, *including* `pol_intent_fidelity`, which is one of the two with a prose section. |

**That last row corrects REG-F-022's entry.** It reads: *"The ontology carries one of the nine, as
`readonly string[]`"* — which implies one field is **delivered** and eight are missing. In fact **zero of the nine
are delivered**: the one field present is authored too. The gap is not 8/9, it is 9/9.

## 3. What would have to be invented, per requirement

For a requirement minted from a declared type, with the most conservative honest reading of each field:

| Field | Status | Note |
|---|---|---|
| `id` | **DERIVABLE** | Deterministic from `(policyId, evidenceType)`. No content invented. |
| `evidenceType` | **AUTHORED (existing)** | Carried by the dataset, itself authored. |
| `cardinality` | **INVENTED** | Five ratified values; the corpus states none for any policy. |
| `requiredForDispositions` | **INVENTED, AND BEHAVIOURALLY LOAD-BEARING** | See §4. |
| `mayBeWaived` | **INVENTED** | Either value is a governance assertion. §12 governs waivers; it does not say which requirements admit one. |
| `admissibilityRules` | **HONESTLY EMPTY** | `[]` is faithful: the corpus declares none. |
| `freshnessRule` | **HONESTLY ABSENT** | Optional; omit. |
| `description` | **INVENTED** | Prose. For 10 of 12 policies there is not even a prose item list to paraphrase. |
| `purpose` | **INVENTED** | As above. |

So closing REG-F-022 by construction means authoring **five fields × every requirement × twelve policies**, of
which ten have no corpus basis whatsoever.

**The register already ruled on exactly this**, in REG-F-022's own entry: *"Inventing the other eight to close a
number is the disease this programme treats."* Nothing found here weakens that ruling; the measurement
strengthens it, because the ninth field turns out to be authored as well.

## 4. The one field that is not merely prose

`requiredForDispositions` decides **when** a requirement bites, and the two readings produce different systems:

- **`ALL`** — the requirement gates *assessing*. Every assessment lands in `EVIDENCE_PENDING` and stays there
  until the evidence arrives. The canonical drive submits none, so **the reference undertaking would stall** and
  the workbench would ship unable to complete an assessment.
- **`SATISFIED_ONLY`** / **`CONDITIONAL_OR_SATISFIED`** — the requirement gates a *positive conclusion*. Gate A
  becomes real, §38's missing-evidence fold becomes non-empty, and the lifecycle still flows: an assessor may
  examine work and REJECT it without ever seeing evidence only a SATISFIED verdict would need.

**This is a governance choice with a hard behavioural consequence, not a formatting decision.** Choosing `ALL`
silently converts a documentation gap into a system that cannot assess anything; choosing `SATISFIED_ONLY`
asserts that none of the catalog's evidence is a precondition of judgement. Neither is stated anywhere.

## 5. Proposal

**P-1 — Do not land invented requirements.** Consistent with REG-F-022's standing ruling and with the standing
rule against inventing governance content. The census pin stays, and its instruction ("delete, do not extend")
remains correct and unexecuted.

**P-2 — Raise the ratification as REG-E-026**, carrying the §3 table so the sponsor sees exactly which five
fields are being asked for and that ten of twelve policies have no textual basis at all.

**P-3 — Offer the mechanism, ready and unused.** The derivation from `requiredEvidenceTypes` to
`EvidenceRequirement[]` is a small pure function; what it cannot supply is the five invented fields. It is not
written here, because a mechanism whose inputs do not exist is the "instrument waiting" pattern this repository
already has too many of — and unlike `policyApplicability`, this one would have nothing to test against.

**P-4 — Correct REG-F-022's entry** on the 8/9-vs-9/9 point (§2). Done as part of this note.

**P-5 — If the sponsor wants a default rather than twelve authored sets**, the least-inventive option is:
one requirement per declared type, `cardinality: AT_LEAST_ONE`, `requiredForDispositions: SATISFIED_ONLY`,
`mayBeWaived: false`, `admissibilityRules: []`, and `description`/`purpose` **omitted** — which the ratified
shape forbids, since both are required strings. **That is the crux: §6.1 makes prose mandatory, so there is no
form of this requirement that can be stated without authoring content.** A sponsor who wants the gate live must
either author the prose or ratify a relaxation of §6.1.

## 6. What this note deliberately does not do

- It does not author `description`/`purpose` for ten policies with no source text.
- It does not pick `requiredForDispositions`, whose two readings differ by whether the product can assess at all.
- It does not extend the census pin, which would convert a disclosed gap into a permitted one.
