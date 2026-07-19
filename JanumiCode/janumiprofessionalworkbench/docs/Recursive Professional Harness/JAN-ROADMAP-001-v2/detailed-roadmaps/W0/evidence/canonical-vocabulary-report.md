# W0 Evidence — Canonical-Vocabulary Conformance Report (JPWB)

**Discharges:** `JAN-WP-0-002` (via `JAN-W0-DWP-002`). **Deliverables:** terminology migration table; legacy-term aliases; repository terminology scan report.
**Authority:** `RPH-DOC-000` (naming). **Grounding:** `grep` over `packages/**` + `apps/**` (JPWB), excluding `node_modules`/`dist`.

## 1. Scan result (JPWB subject of record)

| Prohibited / legacy term | Meaning | JPWB occurrences | Verdict |
| --- | --- | --- | --- |
| `Product Lens` / `ProductLens` | Legacy name for the Product Realization PWA | **0** | Conformant |
| bare `Lens` (word-boundary) | Ambiguous (PWA vs UI viewpoint) — prohibited dual use | **0** | Conformant |
| canonical `PWA` / `Undertaking` / `ProfessionalWork*` / `PwuType` | Canonical vocabulary | **63 files** | Present |

**Result:** JPWB source uses the canonical vocabulary and contains **zero** occurrences of the prohibited legacy term "Product Lens" and **zero** bare "Lens" tokens. `JAN-WP-0-002` exit criterion ("No target artifact uses Product Lens as the canonical name for Product Realization PWA") is **met** for the subject of record.

## 2. Legacy-term residence (aliases table)

| Legacy term | Canonical replacement | Where the legacy term still lives | Disposition |
| --- | --- | --- | --- |
| Product Lens | Product Realization PWA | `janumicode_v2` only (15 files) | `REMOVE` codebase (§ `legacy-classification.md`); no migration alias needed into JPWB |
| Legacy phase names (INTAKE…REPLAN) | RPH objects (Intent / PWU / Assurance / Decision / Baseline) | `janumicode` (v1) | `REMOVE`; RPH-DOC-005 §4–§5 holds the doc-level mapping |

Because the legacy codebases are `REMOVE` (not a migration source), **no runtime migration alias is required** in JPWB. The "aliases" obligation is discharged as a *documentation* mapping (RPH-DOC-005), not code.

## 3. Terminology migration table (legacy → canonical, for reference only)

| Legacy concept | Canonical Janumi term |
| --- | --- |
| Product Lens | Product Realization PWA |
| Workflow phase | (no direct canonical peer — superseded by PWU + Execution Plan + Assurance) |
| Phase state | independent PWU work / execution / assurance / shape-integrity state |
| Workflow Canvas | View (derived presentation) |
| Validator (legacy pass/fail) | Assurance Policy + Assessment + Observation + Disposition |

This table is **reference-only** under sponsor direction (nothing is migrated from legacy). It exists so a future decision to re-import a specific legacy concept re-enters through canonical vocabulary, never legacy naming.

## 4. Exit-criterion attestation

No JPWB artifact uses a prohibited canonical name; the legacy term is confined to a `REMOVE`-classified codebase; the migration table is recorded. `JAN-WP-0-002` **met**.
