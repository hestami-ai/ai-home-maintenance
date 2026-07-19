# W0 Evidence — Legacy Lineage Classification

**Discharges:** the legacy-facing obligations of `JAN-WP-0-003`, `JAN-WP-0-004`, `JAN-WP-0-005` (via `JAN-W0-DWP-004`).
**Authority:** sponsor direction 2026-07-19 (recorded as `DEC-W0-002`); advisory mapping `RPH-DOC-005`.
**Classification vocabulary:** master §9 / Standard §3.4.

## 1. Sponsor direction (governing)

> "janumicode and janumicode v2 are legacy codebases, we don't have anything to import, migrate, inherit, etc. from them at this point." — sponsor, 2026-07-19.

This direction is the primary authority for the classifications below. It overrides the master roadmap's default framing of WP-0-003…007 as *legacy migration inventory* (recorded as `DIV-W0-001`).

## 2. Codebase-level classification

| Codebase | Path | Size (first-party code files) | Classification | Evidence |
| --- | --- | --- | --- | --- |
| JanumiCode v1 (`janumicode`) | `JanumiCode/janumicode` | 452 | **`REMOVE`** | Hosts the 11-phase engine (§3); sponsor direction — nothing to migrate/inherit. |
| JanumiCode v2 (`janumicode_v2`) | `JanumiCode/janumicode_v2` | 8,270 | **`REMOVE`** | Numbered `phase1…phase10` orchestrator; sole residence of legacy "Product Lens" (15 files); sponsor direction. |
| JPWB (`janumiprofessionalworkbench`) | `JanumiCode/janumiprofessionalworkbench` | — | **subject of record (target realization)** | Graded by conformance, not legacy classification. |

`REMOVE` here means: **not a migration source and not to be mined**. It does not mandate physical deletion of the directories (that is a separate housekeeping decision for the sponsor); it means no W0+ obligation depends on their internal behavior.

## 3. The 11-phase engine (located and dispositioned)

`RPH-DOC-005` §3 enumerates the eleven legacy compatibility phases. They are realized in **`janumicode/src/lib/workflow/orchestrator.ts`** with the described central phase switch (corroborated in `humanFacingState.ts`, `outputAdopter.ts`). Distinctive-name evidence (grep over `janumicode/src`): `ASSUMPTION_SURFACING` (22 files), `HISTORICAL_CHECK` (26), `REPLAN` (15), `PROPOSE` (52). INTAKE substates (DISCUSSING/SYNTHESIZING/AWAITING_APPROVAL/INTENT_DISCOVERY/PRODUCT_REVIEW/PROPOSING/CLARIFYING) are present.

| Legacy phase | RPH-DOC-005 dominant concern | Native JPWB carrier (target) | Classification |
| --- | --- | --- | --- |
| INTAKE (+ substates) | Shape Engineering | Intent aggregate + Intent/Product-Definition PWUs | `REMOVE` (intent carried natively) |
| ARCHITECTURE | Shape Engineering | Architecture PWU hierarchy | `REMOVE` |
| PROPOSE | Shape + Loop Engineering | Execution Plan + PWU proposal | `REMOVE` |
| ASSUMPTION_SURFACING | Assurance Engineering | Assumption objects + evidence admission | `REMOVE` |
| VERIFY | Assurance Engineering | Assurance Assessment + Observation | `REMOVE` |
| HISTORICAL_CHECK | Assurance + Context | (narrative memory — later wave) | `REMOVE` |
| REVIEW | Governance | Decision (version-bound) | `REMOVE` |
| EXECUTE | Loop + Harness | Execution Plan + Runtime Binding | `REMOVE` |
| VALIDATE | Assurance Engineering | Integrated assurance | `REMOVE` |
| COMMIT | Repo op + baseline governance | Baseline (immutable) ≠ commit | `REMOVE` |
| REPLAN | Loop control + reshaping | Reshape/impact-analysis loop | `REMOVE` |

**No phase is `PRESERVE`, `RECLASSIFY`, `GENERALIZE`, or `REPLACE`.** Their professional *intent* is already carried by JPWB's canonical model; the *implementation* is discarded. `RPH-DOC-005` §4–§5 remains the advisory doc-level mapping if a specific legacy behavior is ever re-requested.

## 4. Legacy validators (WP-0-005 legacy portion)

Legacy validator implementations in the `REMOVE` codebases are **not migrated**. The `RPH-DOC-004` assurance target is realized natively in `packages/rph-assurance`. `JAN-WP-0-005` is therefore discharged for legacy by classification; its JPWB-facing portion (grounding JPWB's own assurance) is in `jpwb-current-state-inventory.md` §7.

## 5. Non-silence attestation (WP-0-004/007 prohibited shortcut)

Per master §19 ("silently interpreting unexplained behavior as accidental"): no legacy behavior is *silently* discarded. The discard is **explicit and evidence-backed** (sponsor direction + RPH-DOC-005's own concession that its inventory is doc-based, not code-audited). Any specific legacy behavior later deemed necessary re-enters the program as a **new decision** through canonical vocabulary, not through the legacy code.

## 6. Exit-criterion attestation

The legacy lineages are dispositioned (`REMOVE`); the 11-phase engine is located and mapped; no legacy behavior is left `UNRESOLVED`. The legacy-facing obligations of `JAN-WP-0-003/004/005` are **met**.
