# Disaster Recovery and Backup — Matter-Track Storage

**Status:** Engineering design draft. Counsel review pending.
**Parents:** `docs/design/governed_stream_privilege.md`; `docs/janumilegal_multi_matter_isolation_addendum.md` §6.

## 1. What needs backing up

Three storage classes:

| Class | Location | Sensitivity | Recovery priority |
|---|---|---|---|
| Platform DB | `<dataRoot>/janumilegal_platform.sqlite` | Tenancy + registry + op-track | High — required to identify any matter |
| Matter-track files | `<dataRoot>/firms/<firm>/clients/<client>/matters/<matter>/governed_stream.sqlite` | Encrypted; **per-matter content** | Highest — contains substantive matter content |
| Matter content artifacts | (Wave 6+ artifact storage; same per-matter directory) | Encrypted | Highest |
| KMS / firm-key material | OS keychain or KMS | Highest sensitivity | Highest |

## 2. Backup model

### 2.1 Platform DB

Standard SQLite `.backup` API. Daily full backup; WAL streaming for hot copy. Stored in firm-controlled cold storage. Restoration recreates the registry but does NOT decrypt matter content (keys are separate).

### 2.2 Matter-track files

- **Per-matter file**, **encrypted at rest**, **zero modification at backup time**. The backup is a byte copy of the SQLite file.
- Backups are matter-scoped: a single firm's backup is a tree under `firms/<firm>/...`.
- Cross-firm consolidation in shared cold storage is **not permitted** without firm-specific encryption layer.
- Per-matter retention applies to backups: when retention expires per `firmConfig.retentionDays[matterType]`, the matter's backups are also marked for purge (separate documented basis required for actual deletion).

### 2.3 KMS / key material

- Per-firm master keys stored in KMS / OS keychain. Backup of key material is operator-controlled, never co-located with backup of matter files.
- Restoration requires **both** the matter file backup AND the corresponding firm key material. Loss of key material = loss of matter content (intentional; mitigates compromise of backup substrate).

## 3. RPO / RTO targets

| Tier | RPO | RTO |
|---|---|---|
| Platform DB | 24 hours | 4 hours |
| Active-matter file | 1 hour (WAL streaming) | 1 hour |
| Closed-matter file | 24 hours | 24 hours |
| Key material | 0 (write-on-rotation) | per KMS SLA |

## 4. Restoration procedure

1. Restore platform DB from cold storage; verify schema version matches expected.
2. Restore matter-track files for affected matters into firm/client/matter directory tree.
3. Re-establish KMS access for the firm.
4. Run schema validation + integrity verification:
   - SQLite `PRAGMA integrity_check` on each file.
   - Per-matter chain verification (`MatterTrackStore.verifyChain`).
   - Matter-key envelope decrypt test (read one event from each classification).
5. Op-track events for matter activity since last backup are partially or fully lost — there is no replay path. Document the gap in restoration notes; affected matters may need attorney-led reconstruction of any in-flight activations.

## 5. Cross-matter restoration prohibition

A restoration that brings in matters from a backup belonging to a different firm is **prohibited**. The restoration tooling refuses to mount matters from a firm directory unrecognized in the registry.

## 6. Verification and audit

- Quarterly restore drill on a non-production environment with synthetic data.
- Restore logs go to op-track only (metadata, no content).
- Integrity-check failures during restore trigger an alarm and refuse to expose the matter in the UI.

## 7. Open items for counsel

- Whether backups are subject to litigation hold the same way primary matter-track storage is.
- Whether quarterly restore drills with synthetic data create any discoverable record.
- Acceptable cross-jurisdiction storage of backup data (data-residency concerns).
- Notification obligations on partial restore (events lost between RPO and incident).

## 8. Wave alignment

- Wave 9 ships this design document and the verifyChain integrity check (already shipped in Wave 3).
- Wave 9.x or post-GA: backup automation, restore-drill harness, KMS integration. Out of scope for the structural Wave 9 gate.
