# Counsel Review Packet

**Status:** Engineering's consolidated index of materials for counsel review at Wave 9 GA readiness.
**Posture:** Counsel review was deferred from Wave 3 per established direction, pending demonstrable implementation. Wave 9 produces the runnable artifact and this packet.

The packet does not anticipate counsel's conclusions; it lists everything counsel should review and the open questions engineering has surfaced.

## Documents to review

### Doctrinal sources (read-first)

1. [Product description](../janumilegal_product_description.md) — source doctrine. Especially: §Core Product Doctrine, §Release Gate, §Tier 12.
2. [Evolution addendum](../janumilegal_product_description_evolution.md) — architectural gap closures.
3. [Multi-matter isolation addendum](../janumilegal_multi_matter_isolation_addendum.md) — multi-tenancy + screening architecture.
4. [Initial client profile](../janumilegal%20-%20initial%20client%20profile.md) — design partner context.

### Privilege / discovery (highest counsel-review priority)

1. [Governed Stream privilege design](../design/governed_stream_privilege.md) — full privilege architecture: dual-track storage, classification taxonomy, key hierarchy, hash chains, export pipeline + privilege log, retention.
   - **Open items for counsel** are listed in §12 of that document.
2. [DR + backup design](../design/dr_backup.md) — backup model + restoration semantics + cross-matter restoration prohibition.

### Vocabulary

1. [Canonical Legal Vocabulary v1](../clv/canonical_vocabulary_v1.md) — 51 entries authored. Counsel review focuses on whether the canonical definitions match Maryland legal usage and whether prohibited synonyms catch the right collisions.

### Calibration

1. [Gold capture protocol](../calibration/gold_capture_protocol.md) — calibration discipline.
2. [Family Law gold matter](../../calibration/gold/JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001/) — runnable end-to-end test fixture.
3. [Legal Research Memo gold matter](../../calibration/gold/JLEGAL-LRM-MD-RESEARCH-MEMO-001/).

### Operations

1. [Lens authoring guide](../guides/lens_authoring.md).
2. [Firm onboarding guide](../guides/firm_onboarding.md).
3. [Operations runbook](../operations/runbook.md).

## Architectural floors that counsel should explicitly validate

Each is enforced by code; counsel signs off that the *architectural intent* matches the legal-ethics requirement.

| Floor | Where enforced | Counsel question |
|---|---|---|
| AttorneyAction binds approval to artifact bytes | `releaseGate/evaluator.ts` matches on `artifactVersionHash` | Sufficient for "approval scope is the bytes" doctrine? |
| Filing requires forum admission | `attorneyAction/service.ts` refuses; `releaseGate/evaluator.ts` re-checks | Acceptable for MD/VA/PA/DC practice? |
| Classification at write time, no post-hoc reclassification | `governedStream/classifier.ts` + `matterTrackWriter.ts` | Default-to-most-restrictive (work_product_mental) — agreed posture? |
| Mental-impressions firewall (separate per-matter key) | `encryption/keyHierarchy.ts` provisions both | Acceptable for opinion work product? |
| Discovery production excludes mental + AC by default | `export/redactionPolicy.ts` + `exporter.ts` | Match MD discovery practice? |
| Privilege log auto-generated for excluded events | `export/exporter.ts` | Sufficient log fields? |
| Conflicts: non-waivable / imputed = hard release block | `conflicts/agent.ts` + `releaseGate/evaluator.ts` | Match Rule 1.7/1.10 expectations? |
| Cross-matter writes prohibited | `matterTrackWriter.ts` refuses | Sufficient for ethical-wall doctrine? |
| Screened-matter enforcement at data layer | `database/scopedDal.ts` (`listAccessibleMatters`) | Sufficient for screened-personnel rules? |
| Brief-bank promotion requires attorney action + scrubbing | `briefBank/promotion.ts` | Acceptable for client-confidential extraction? |
| Retention bound to matter lifecycle, not platform lifecycle | `firmConfig.retentionDays` + DR doc §2 | Defaults match MD record-keeping rules? |

## Red-team report

`src/test/redTeam.test.ts` — 10 adversarial scenarios; all currently green (architecture refuses each adversarial action). Counsel should review the adversarial scenarios to confirm the right adversaries are being modeled.

## Open items engineering has surfaced

These are not assumed. Counsel decides.

1. **Default retention floors** (DR doc §2; firm-config defaults). Match MD/VA/PA/DC requirements?
2. **Privilege classifier default-to-mental on uncertainty** — produces richer privilege logs but more events excluded from default discovery. Acceptable?
3. **Discovery filter overrides require basis** — is the `overrideBasis` field sufficient to evidence attorney decision-making for in-camera review?
4. **Cross-jurisdiction filing** — current model: each filing event is bound to a single forum and a single signing attorney. Pro-hac-vice scenarios need attorney-action extension.
5. **Brief bank promotion scrubbing tokens** — currently attorney-supplied. Counsel may want NLP-assisted PII detection (Wave 10+).
6. **Litigation hold mechanics** — placement and lift authority; whether holds propagate from matter to related matters.
7. **Client file-transfer** — Maryland's "entire file" approach is the default. Confirm.
8. **Backup of work_product_mental** — backups inherit the per-matter mental key. Acceptable for evidentiary integrity claims?

## Counsel sign-off — what we're asking for

For Wave 9 GA, the engineering ask is:

- Confirm the architectural intent of each floor in the table above matches counsel's reading of MD ethics rules and federal/MD discovery practice.
- Identify any floor where the current default is wrong for JC Law's actual practice.
- Identify any open item from the list above that requires immediate code change vs. ones that can be addressed in firm config.
- Sign off in writing on the privilege architecture (DR + governed-stream-privilege design docs) and the release gate (deterministic, attorney-action-bound).

Wave 10 (post-GA) absorbs counsel's findings; the architecture is designed so most likely changes (retention floors, redaction defaults, classification thresholds) are configuration, not code.
