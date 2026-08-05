# DESIGN — REG-F-022's evidence requirements

**Date:** 2026-08-05 · **Status:** v2 — RATIFIED 2026-08-05, authoring authorized · **Raised as:** REG-E-026

> **v1 of this note (below, §8) concluded "do not land anything".** That conclusion rested on a measurement that
> was **wrong by a factor of five and a half**, made by me, in the same way this register has now named eight
> times. v1 is retained struck rather than deleted, because the error is more instructive than the conclusion.

---

## 0. THE CORRECTION THAT CHANGES THE RULING

**v1 said: "Only 2 of 12 policies have a required-evidence section (§15.5, §16.4). Ten have no textual basis
whatsoever."**

**Measured properly: 11 of 12 policies carry an evidence section, listing 89 items.** Only §20
POL-CONSTRAINT-PROPAGATION has none.

### How the error was made

I grepped RPH-DOC-004 for the heading `Required evidence`. It occurs exactly twice — §15.5 and §16.4. I reported
that as a fact about **the corpus**. It is a fact about **my search string**.

From §17 onward the heading is simply **`Evidence`**:

| § | Policy | Heading | Items |
|---|---|---|---|
| 15.5 | POL-INTENT-FIDELITY | **Required evidence** | 7 |
| 16.4 | POL-INTENT-COMPLETENESS | **Required evidence** | 6 |
| 17.4 | POL-ASSUMPTION-DISCLOSURE | Evidence | 7 |
| 18.4 | POL-REQUIREMENT-COVERAGE | Evidence | 8 |
| 19.4 | POL-DECOMPOSITION-COVERAGE | Evidence | 9 |
| **20** | **POL-CONSTRAINT-PROPAGATION** | **— none —** | **0** |
| 21.4 | POL-ARCHITECTURE-COVERAGE | Evidence | 11 |
| 22.4 | POL-HISTORICAL-CONSISTENCY | Evidence | 7 |
| 23.4 | POL-INTENT-PRESERVATION | Evidence | 8 |
| 24.4 | POL-TEST-ADEQUACY | Evidence | 8 |
| 25.4 | POL-FITNESS-FOR-PURPOSE | Evidence | 9 |
| 26.4 | POL-BASELINE-PROMOTION | Evidence | 9 |
| | | | **89** |

**This is `feedback_absence_of_evidence` for the eighth recorded time, and the aggravating detail is where the
warning was written.** `doc004-conformance.test.ts` — a file I have edited — carries this in its own helper:

> *"BY TITLE, never by number. Subsection numbering is NOT uniform across the twelve policies … Assuming a number
> is the single most reliable way to read the wrong subsection and report it as ratified."*

I obeyed that warning and then made its mirror image: I assumed the **title** was uniform. The general form —
recorded because it is the one that keeps recurring — is:

> **Any lookup key can be non-uniform, not just the one that burned you last time.** A search for a *label*
> establishes where the label is, never where the *content* is. To claim content is absent, the search must be
> over content, or over an enumeration derived from structure (here: "every `# N. Policy` section", then ask what
> subsections it has) — never over a name I expect that content to travel under.

### Why the ruling flips

v1's ruling — *"closing this means authoring five fields × every requirement × twelve policies, of which ten have
no corpus basis whatsoever"* — was true only of the false measurement. With 89 ratified items in hand,
`description` is **transcription**, not invention, and the remaining authoring is a handful of stated derivation
rules plus one authored sentence per item. That is ordinary governed authoring, not fabrication.

---

## 1. The second thing v1 missed: the corpus already has two tiers

RPH-DOC-004 §3.1 defines the policy with **two** evidence fields, and both already exist in the contract
(`objects.ts`, `AssurancePolicyDefinition`):

```typescript
requiredEvidence: EvidenceRequirement[];
optionalEvidence?: EvidenceRequirement[];
```

The heading split is therefore not cosmetic — **it is the field selector.** Two policies say *"Required
evidence"*; nine say *"Evidence"*. The mapping writes itself:

| Corpus heading | Field | Policies | Items |
|---|---|---|---|
| `Required evidence` | `requiredEvidence` | §15, §16 | **13** |
| `Evidence` | `optionalEvidence` | §17, §18, §19, §21, §22, §23, §24, §25, §26 | **76** |
| *(no section)* | both `[]` | §20 | 0 |

**This is the conservative reading and the faithful one at the same time**, which is rare enough to say out loud.
Calling all 89 "required" would add the word *required* to nine sections that do not use it — exactly the
"no added word" rule `sentenceCase` already enforces on criterion text. And it is conservative in effect: only
the 13 the corpus actually calls required ever gate a verdict.

**The risk, stated rather than buried:** the split could be authorial drift in the source document rather than
intent. If a sponsor later rules that it is drift, the fix is **one line in the mapping rule**, not 89 re-authored
entries — which is the whole reason the mapping is expressed as a rule over headings and machine-checked against
the document, instead of hand-assigned per policy.

## 2. What the ratified shape needs, and where each field comes from

§6.1 is a `z.strictObject` of nine fields. Per item:

| Field | Source | Rule |
|---|---|---|
| `id` | **DERIVED** | `EV-<section>-<NN>`, ordinal in document order. Deterministic; carries its own provenance. |
| `description` | **TRANSCRIBED** | The corpus item verbatim, sentence-cased. Machine-checked against the markdown. |
| `evidenceType` | **AUTHORED (classified)** | One of the 9 ratified `EvidenceType` members, per the table in §4. |
| `cardinality` | **DERIVED** | Corpus hedges (*"where applicable"*, *"where relevant"*) → `ZERO_OR_MORE`; otherwise `AT_LEAST_ONE`. |
| `requiredForDispositions` | **DERIVED** | `SATISFIED_ONLY`, on §15.9. See §3. |
| `mayBeWaived` | **DERIVED (fail-closed)** | `false`. The corpus never says a requirement may be waived; DOC-003's *"fail closed; escalate rather than invent"* picks the arm that cannot silently permit. |
| `admissibilityRules` | **HONESTLY EMPTY** | `[]`. §6.2 states admissibility globally, not per requirement. |
| `freshnessRule` | **HONESTLY ABSENT** | Omitted. Optional, and no policy states one. |
| `purpose` | **AUTHORED** | One sentence per item, tying it to the claims that item serves. The only genuinely new prose. |

Only **two** of nine are authored content (`evidenceType` classification, `purpose`); the rest are transcription,
a stated derivation, or an honest empty. v1's "five invented fields" was a consequence of the bad measurement.

## 3. `requiredForDispositions` — the corpus settles it

v1 called this *"the behavioural fork … the corpus states neither"*. **The corpus states one of them**, in §15.9,
the disposition rule of the very first policy that declares required evidence:

> **SATISFIED only when:** no blocking fidelity finding remains; all mandatory constraints trace into the intent;
> material ambiguities are disclosed; **required evidence is admissible.**

Required evidence is named as a condition of **SATISFIED**, not of assessing. That is `SATISFIED_ONLY`, and it is
corroborated by §17.7 (*"SATISFIED means assumptions have been disclosed, not necessarily verified"*).

**Nothing gets `ALL`.** So `blockingEvidenceIds` stays empty, every assessment still lands `READY`, and v1's
nightmare arm — *"the product ships unable to complete an assessment"* — is not merely avoided, it is
**refuted by the ratified text** rather than dodged by a preference.

**What it does cost, named in advance:** Gate A becomes live for the two intent policies. Any caller completing a
SATISFIED assessment under §15 or §16 without submitting evidence will now be **refused**. That is the gate
working. Which callers, and what happens to them, is measured in the roadmap rather than guessed here.

## 4. `evidenceType` classification

Each item is classified into the ratified 9-member enum by what the item *is*, not by what the policy is about:

- `SOURCE` — user-originated or externally-authored input (originating expression, supplied documents, external sources, Git history).
- `ARTIFACT` — a governed professional work product (Product Intent, catalogs, architecture artifacts, working product).
- `TRACE` — a linkage structure (traceability matrix, trace links, allocations, dependency graph).
- `ANALYSIS` — a derived study (security analysis, design rationale, execution rationale).
- `TEST_RESULT` — test execution output (test results, coverage reports, end-to-end evidence).
- `MEASUREMENT` — a quantity (artifact hashes).
- `OBSERVATION` — a recorded finding or field fact (open findings, incident records, operational evidence).
- `REVIEW` — a human or agent judgement (user or human review, prior assurance findings).
- `APPROVAL` — an authority act (decisions, waivers).

The per-item assignment lives with the data, in `sourceSection`, where the existing provenance discipline can see it.

## 5. `requiredEvidenceTypes` is superseded and removed

The 12 policies carry `requiredEvidenceTypes: readonly string[]` — an authored 2–3 member guess, self-declared
`AUTHORED (no ratified source)`, read by nothing. The new fields state the same thing with 89× the resolution.

**It is removed, not kept alongside.** Keeping both creates precisely the twin that REG-F-029 review finding (c)
caught three days ago — *"the scope field a live refusal reads could not be edited, and editing its twin drove the
two apart"*. 

### The one-time coverage comparison, and what it found

Run before the old values passed out of the working tree. **Eight previously-declared types are not represented in
the new classification** — and the comparison is worth keeping because of *why*:

| Policy | Declared | Not represented | Reading |
|---|---|---|---|
| `pol_constraint_propagation` | SOURCE, TRACE | both | §20 has no evidence section; `[]` is the corpus's state. |
| `pol_intent_fidelity` | +TRACE | TRACE | §15.5 lists no linkage structure — seven items, none a trace. |
| `pol_intent_completeness` | +ANALYSIS | ANALYSIS | §16.4 is six catalogs and a risk profile; no derived study. |
| `pol_requirement_coverage` | +SOURCE | SOURCE | §18.4 is governed artifacts plus a matrix; no raw user-originated input. |
| `pol_decomposition_coverage` | +ANALYSIS | ANALYSIS | §19.4 is PWUs, obligations and graphs; no analysis document. |
| `pol_historical_consistency` | +TRACE | TRACE | §22.4 is records and rationale; no trace structure. |
| `pol_baseline_promotion` | +TRACE | TRACE | §26.4's nearest item is the manifest, classified ARTIFACT — **the one arguable call** (see below). |

**In six of the eight, the old field asserted an evidence type that no ratified item supports.** That is not a
narrowing caused by the new authoring; it is the new authoring declining to inherit an unsupported claim. It is
also the clearest possible argument for removing the field rather than keeping it as a cross-check: a summary that
names types its own source list does not contain cannot check anything.

**The arguable one, flagged rather than smoothed over:** `baseline manifest` (§26.4) is classified `ARTIFACT`.
It could be read as `TRACE`, since a manifest relates a baseline to its constituent artifacts and versions. I
classified it as a document because `AMBIGUOUS_BASELINE_SCOPE` is decided by *reading* it. A reviewer who
disagrees changes one entry, and the disagreement is visible here rather than buried in a data file.

## 6. A defect this authoring exposes: `cardinality` is declared and unread

`ZERO_OR_MORE` means zero instances satisfy the requirement. **Gate A does not read `cardinality` at all** — it
computes required-minus-received on ids alone. So a `ZERO_OR_MORE` requirement would block a SATISFIED verdict
until evidence arrived, which is the exact opposite of what the cardinality says.

The same blindness is in the `EVIDENCE_PENDING → READY` arrow and the §38 `missingEvidence` fold. Today it is
invisible because every `requiredEvidence` is `[]`. It becomes live the moment this lands.

**This is REG-F-022's own family, one field deeper**: a declared governance field that no consumer reads. It is
filed separately and fixed as part of this work — a landing that made cardinality *look* enforced while inverting
its meaning would be worse than the vacuum it replaces.

## 7. What is deliberately NOT done

- **§20 POL-CONSTRAINT-PROPAGATION gets `[]` for both fields.** The corpus gives it no evidence section, and
  inventing one to make twelve-of-twelve look complete is the disease. The census must show 11, not 12.
- **`freshnessRule` stays absent** on every requirement, including §24's, where `STALE_TEST_RESULT` is tempting.
  The `FreshnessRule` shape would have to be invented.
- **Floor policies get nothing.** The de minimis floor is not in §15–§26; it has no ratified evidence list.
- **No `AdmissibilityRule` is authored.** §6.2's eight conditions are global prose, not per-requirement rules.

---

## 8. ~~v1 — superseded~~

~~The sections below are v1's reasoning, retained for the record. Its measurement (§2: "2 of 12") is wrong;~~
~~its ruling (P-1: "do not land invented requirements") followed validly from that wrong measurement and is~~
~~therefore also withdrawn. What survives v1 intact: the ruling that `description`/`purpose` being required~~
~~strings means no requirement can be stated without authored prose (still true — §6.1 is unchanged), and the~~
~~observation that `requiredEvidenceTypes` is itself authored (still true, and the reason it is removed rather~~
~~than promoted).~~

~~**P-1 — Do not land invented requirements.** — WITHDRAWN. It rested on ten policies having "no textual basis~~
~~whatsoever"; nine of those ten have a ratified `Evidence` section.~~

~~**P-2 — Raise the ratification as REG-E-026.** — DONE, and answered: ratified 2026-08-05.~~

~~**P-3 — Offer the mechanism, ready and unused.** — SUPERSEDED. The inputs exist, so the mechanism is built.~~

~~**P-4 — Correct REG-F-022's entry on the 8/9-vs-9/9 point.** — STANDS. Still nine of nine undelivered.~~

~~**P-5 — the least-inventive default** (one requirement per declared *type*) — SUPERSEDED by one requirement per~~
~~ratified *item*, which is better grounded and 6.8× more specific.~~
