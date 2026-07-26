# JAN-CSAA-000 Stage A Package Integrity Manifest

**Manifest ID:** `JAN-CSAA-000-INTEGRITY-001`

**Version:** `0.1.0`

**Status:** Complete for the exact Stage A/W0-17 presentation-ready package; W0-17 not presented and undisposed

**Authority:** Prepared under `JPWB-REG-005 REG-D-017` and W0-16. This manifest proves exact stored-byte identities only. It does not adopt `JAN-CSAA-000`, write a sponsor response, activate Wave 1, select a provider, authorize implementation or experiment, or alter an oracle.

---

## 1. Manifest boundary

The paths below are relative to `docs/ASTs and Code Analysis`. Every listed artifact is hashed as exact stored bytes with SHA-256. All listed artifacts are UTF-8 without BOM and use CRLF line endings.

This manifest deliberately excludes itself from its hash table, avoiding a circular self-digest. Its filename, permanent ID, version, and self-exclusion rule are bound from `JAN-CSAA-000-W017-INSTRUMENT-001@0.6.0`; the manifest is created after every artifact it hashes.

`Initial Chat.md` is included only to preserve the exact discovery input. Its inclusion does not give it normative, evidentiary, provider-selection, or implementation authority.

---

## 2. Exact artifact identities

| Ordinal | Relative path | Package role and state | Exact bytes | SHA-256 |
| ---: | --- | --- | ---: | --- |
| 1 | `README.md` | Exact `JAN-CSAA-000@0.2.1` Proposed candidate; non-authoritative; W0-17 undisposed | 98,588 | `3e0b5d503575b59c95f1e043d99122c5ebee5cff8429298347e7d3385c3725df` |
| 2 | `Wave 0 Sponsor Decision Instrument.md` | Ratified W0-01 through W0-16 source; explicitly no W0-17 disposition | 54,761 | `0c8603837bbc9f2ca7cb35fdda16ce68d2eabb8007ec81830e8d5550c65824ae` |
| 3 | `Initial Chat.md` | Background discovery input only; non-authoritative | 32,005 | `f34251a49098715cd8a446ec022a57cf83a44678f846d48a168f445b3464e13b` |
| 4 | `templates/CSAA Controlled Document Review Template.md` | Preserved controlled-review template `0.3.0` | 10,400 | `2e695d550ad4e2a5bbfd6d2330b5d4c860ce0ab6914ba336d199876ef9799a3c` |
| 5 | `templates/CSAA Requirement Ledger Template.md` | Preserved requirement-ledger template `0.3.0` | 9,256 | `24dc99b6259154f486114ce1f75d4d219f4a490ad7a325fc963292dcbe899aec` |
| 6 | `records/JAN-CSAA-000 - Self Review.md` | Historical exact-Draft author self-review `JAN-CSAA-000-SELF-REVIEW-001@0.1.0` | 28,174 | `9f6abc0019a2647c35fa567da05f6aecbd050e92e5c3f5c936b0121674ca07e1` |
| 7 | `records/JAN-CSAA-000 - Draft-to-Proposed Promotion Record.md` | Exact six-substitution promotion proof `JAN-CSAA-000-PROMOTION-001@0.1.0` | 3,396 | `1ff4e7f94931cc4e1dabf40a21173c59e0d55e5b8eceaeec146b110681b44b95` |
| 8 | `records/JAN-CSAA-000 - Proposed Correction Self Review.md` | Exact-candidate correction review `JAN-CSAA-000-CORRECTION-SELF-REVIEW-001@0.1.0` | 12,808 | `191a07f15c0d603b417da6eb58298ccb0d1abbdd89e6563a29a116a0b46250e7` |
| 9 | `records/JAN-CSAA-000 - Preparation Evidence Snapshot.md` | Revision/worktree-bound evidence `JAN-CSAA-000-EVIDENCE-001@0.2.0`; final accepted active-worktree observation in §7.4 | 25,619 | `52165ebbaa72613e6bf12ea54992e63779596ad6d101c2f0a25a055d74a5da03` |
| 10 | `records/JAN-CSAA-000 - Requirement Ledger.md` | Closed ledger `JAN-CSAA-000-LEDGER-001@0.2.0`; 783 reconciled rows; 255 current passed; 528 later nonperformed | 1,235,725 | `4688ef64f4b46f898bf3fff3dfee5a056695a9a167df8adbf7fbaad61ac74013` |
| 11 | `records/JAN-CSAA-000 - Independent Review.md` | Completed independent review `JAN-CSAA-000-INDEPENDENT-REVIEW-001@0.1.0`; zero unresolved blocker, major, or minor findings | 84,098 | `4feec4afadd3ca3ba1bee94f4a1581fe2a32b7981aeefaeba3b5d2031872ed40` |
| 12 | `records/JAN-CSAA-000 - Prospective Normative Carriage.md` | Conditional, non-executed carriage `JAN-CSAA-000-W017-CARRIAGE-001@0.1.0` | 12,372 | `b268b118218f0de14707a4f8486482799a59c6404aefc5a4453429fbdf7b6cdf` |
| 13 | `records/JAN-CSAA-000 - W0-17 Adoption Instrument.md` | Presentation-ready blank-response instrument `JAN-CSAA-000-W017-INSTRUMENT-001@0.6.0`; no sponsor disposition | 70,175 | `f289e083206d877393af774c91e8dc41da4081fb7f61d8e77f0666130ebde027` |

---

## 3. Integrity and invalidation rules

The package integrity check passes only when:

1. every listed path exists as a regular file;
2. every exact byte length matches;
3. every lowercase SHA-256 digest matches;
4. every listed file is UTF-8 without BOM and contains no bare LF or bare CR line ending;
5. `README.md` remains the exact Proposed candidate in row 1;
6. all 46 material-decision sponsor fields and all 6 sponsor-summary fields in row 13 remain blank;
7. `W0-17` remains unrecorded in `JPWB-REG-005`; and
8. no artifact or result is interpreted as provider, implementation, experiment, oracle-change, or Wave 1 authority.

Any byte change to a listed artifact invalidates this manifest for presentation. The changed artifact must be re-reviewed to the extent affected, all dependent identities must be refreshed, and a new manifest version must be created. This file must not be edited to disguise drift.

The prospective 98,856-byte Normative result is not a current artifact and is therefore not a row in this table. Its deterministic 24-substitution recipe and prospective SHA-256 `3626eb38fe994a886f6b5a6604887a9eb9e9e7df8a39282997527b50732b9d39` remain conditional evidence in row 12 only.

---

## 4. Closure statement

The exact Stage A package is integrity-frozen and ready for separate sponsor presentation. It is not presented in this record. Every sponsor-response field remains blank, `REQ-744` remains later and unperformed, `JAN-CSAA-000` remains Proposed, and Wave 1 remains inactive.

Temporary ledger-generation and prospective-carriage computation scripts are not package artifacts and were removed after their outputs were independently checked. No corpus filename was renamed.
