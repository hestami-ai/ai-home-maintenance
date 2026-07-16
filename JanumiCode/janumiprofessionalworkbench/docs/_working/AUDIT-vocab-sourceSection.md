# Audit — the vocab's `sourceSection` provenance is theater for 81% of field-bearing entries

**Produced 2026-07-16. Read-only audit; no code changed. This is a FINDING, not a fix.**
Triggered by Increment 5: the waiver's `scope` field cited `sourceSection: "DOC-002 §34.2 (requestWaiver)"`,
and DOC-002 §34.2 turned out to be a **bare list of command names** — the field was authored, the citation
pointed at a name. This audit asked: is the waiver an outlier, or the median?

## Method

Every entry in `packages/rph-contracts/vocab/{canonical-vocabulary,m1-object-fields,m3-commands-events}.json`
that carries `payloadFields`/`fields` **and** a `sourceSection` was classified by whether its cited source
actually **defines** those fields. "Defines" = cites a DOC-007 §10–23 section, which contains a
`typescript interface …Payload { … }`. Anything else (DOC-002 §26.x/§34.x, DOC-007 §32/§33 registry,
RPH-DOC-010 UX) names the thing without a field schema. Both buckets spot-verified against the source docs.

## Result

| | citations | authored fields |
|---|---:|---:|
| **Field-bearing entries total** | 168 | 628 |
| **HONEST** — cites a DOC-007 §10–23 interface that defines the fields | 32 | 203 |
| **HOLLOW** — fields authored on a name-list / unschematized registry | **136 (81%)** | **425 (68%)** |

Hollow citations by leading source:
- **112 → DOC-002 §26.x / §34.x** — bare `text` lists of event/command NAMES. Verified: §26.2 (core work
  events), §26.3 (assumption/constraint), §26.5 (assurance), §34.1/§34.2 (commands) are all name-only blocks.
- **12 → RPH-DOC-010** — the PWA Designer UX doc. §16 item 9 says exactly this: DOC-010 "demonstrates UX
  without freezing those wire shapes."
- **9 → DOC-007 §32/§33** — the event registry, which the vocab's own notes call "lists it unschema[tized]."
- 2 → guide §8.9, 1 → "added".

Verified both directions: DOC-007 §10.2 defines `interface CaptureIntentPayload { intentId, undertakingId,
originatingExpression, ontologyId, ontologyVersion }` (honest, matches the vocab). DOC-002 §26.2 is
```text
IntentCaptured
PwuProposed
DecompositionProposed
…
``` — 23 names, no fields, cited by 20 field-bearing entries.

## What it means — stated precisely, not overstated

- It does **not** mean the 425 fields are wrong. Many are reasonable inferences from DOC-002's prose model and
  the event's purpose. The defect is not (necessarily) the fields.
- It **does** mean `sourceSection` is **not evidence of ratification**. It presents as provenance — "these
  fields come from DOC-002 §26.2" — while §26.2 contains no fields. A reader (or an agent) who trusts the
  citation as proof the shape is contracted is misled 81% of the time. The field is provenance *theater*.
- This is the **same class of defect as the hollow governed layer**: a projection that presents as sourced.
  It operates here at the level of the contract's own provenance metadata — one layer beneath the code.
- It aligns with the guide's own §16 items 6 and 9: DOC-007's first slice deliberately leaves the granular
  events/commands unschematized (`PwuStateChanged` stands in for many). The vocab authored ahead of the
  ratified wire contract and cited a name-list to bridge the gap. The **code (vocab) is further along than
  the ratified contract** — the recurring shape of this whole harmonization.

## Consequence for the rest of the program

This is why the waiver (item 12) is genuinely unresolved *despite* having a `sourceSection`: the citation was
hollow. **A `sourceSection` may never be treated as proof a field shape is ratified — open the cited section.**
Whenever an increment leans on a vocab field's provenance, it must verify the citation resolves to a
field-defining source (DOC-007 §10–23), not a name-list. Four of the increments in this effort already hit a
hollow citation (waiver `scope`, and the `art`/`conv` prefixes).

---

## FOLLOW-UP 2026-07-16 — the partition, and a correction to my own offer

I told the sponsor the 136 split into "ones I can repoint" and "ones only you can ratify," and offered to do the
first half. **That half does not exist.** Mechanically partitioning every hollow entry by "does DOC-007 define
an `interface <Name>Payload` for it?":

| | |
|---|---:|
| DOC-007 interfaces in the entire document | **64** |
| Hollow field-bearing entries | 135 |
| → **REPOINTABLE** (a real DOC-007 interface exists) | **0** |
| → **UNRATIFIED** (DOC-007 defines nothing) | **135** (420 fields) |

Verified sound, because zero is exactly the result a buggy script fabricates: the extraction finds 64
interfaces and `CaptureIntentPayload` **is** among them (so the regex works and the honest bucket is real), while
`AssertClaimPayload`, `DetectAssumptionPayload`, `RecordAssuranceObservationPayload`, `ProposeDecisionPayload`
each return **zero** hits.

**This sharpens the finding rather than softening it.** The vocab is *not* mis-citing. It cites DOC-002
§26.x/§34.x precisely because that is the only place these commands/events are named **at all** — DOC-007
deliberately schematized a subset (§16 item 6: "DOC-007's first slice uses `PwuStateChanged`,
`AssuranceAssessmentCompleted`, and `DecisionEffective`, without fully modeling separate approval/effective
time"). So the real shape of it is:

> **DOC-007 ratifies a 64-interface wire surface. The vocab implements 135 more commands/events on 420 authored
> fields, ratified nowhere — and the system runs on them.**

That is the codebase running ahead of its own ratified contract, which is this whole harmonization's recurring
shape, now measured at the contract layer.

## DONE 2026-07-16 — the vocab no longer presents authored fields as sourced

Under the sponsor's grant, all **135** hollow entries' `sourceSection` are annotated `UNRATIFIED-AUTHORED`,
preserving the original citation and stating plainly: DOC-007 schematizes no interface for this, the cited
section names it but defines no fields, do not treat this as proof the shape is ratified, ratification pending.

**This ratifies nothing.** `sourceSection` is pure vocab metadata — not emitted to generated code, not read by
the generator — so this is documentation only (verified: generated code untouched, check-types 21/21, contracts
146/146). It converts silent provenance theater into visible disclosure, which is the honest state until the
ratification pass happens. The 33 untouched entries are the 32 genuine DOC-007 citations plus `RequestWaiver`,
already marked authored-under-grant in Increment 9.

## NOT fixed here, and why

Repointing 136 citations is not a mechanical edit. For each, the honest source either **exists** (DOC-007
§10–23 — then the fix is to cite it) or **does not** (the event/command is genuinely unschematized — then the
fields are unratified, and deciding whether to ratify them is §16 item 6 / item 9 territory, which §0.3
forbids an agent from choosing). Separating those two requires a per-entry contract decision. Surfaced as
drift per §17; the sponsor decides whether to (a) repoint the citations that have a real DOC-007 source and
(b) open a ratification pass for the rest.
