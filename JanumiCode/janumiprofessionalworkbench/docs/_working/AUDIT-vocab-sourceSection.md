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

## NOT fixed here, and why

Repointing 136 citations is not a mechanical edit. For each, the honest source either **exists** (DOC-007
§10–23 — then the fix is to cite it) or **does not** (the event/command is genuinely unschematized — then the
fields are unratified, and deciding whether to ratify them is §16 item 6 / item 9 territory, which §0.3
forbids an agent from choosing). Separating those two requires a per-entry contract decision. Surfaced as
drift per §17; the sponsor decides whether to (a) repoint the citations that have a real DOC-007 source and
(b) open a ratification pass for the rest.
