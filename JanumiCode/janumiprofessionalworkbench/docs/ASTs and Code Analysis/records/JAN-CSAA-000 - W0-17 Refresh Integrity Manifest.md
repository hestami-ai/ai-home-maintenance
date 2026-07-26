# JAN-CSAA-000 W0-17 Refresh Integrity Manifest

**Manifest ID:** `JAN-CSAA-000-INTEGRITY-002`

**Version:** `0.1.0`

**Status:** Complete for the exact refreshed W0-17 presentation package; frozen before presentation; W0-17 undisposed

**Authority:** Prepared under `JPWB-REG-005 REG-D-017` and W0-16. This manifest proves exact stored-byte identities only. It does not adopt `JAN-CSAA-000`, write or transfer a sponsor response, reserve or consume a register identifier, activate Wave 1, select a provider, authorize implementation or experiment, or alter an oracle.

---

## 1. Manifest boundary

The paths below are relative to `docs/ASTs and Code Analysis`. Every listed artifact is hashed as exact stored bytes with SHA-256. The encoding and line-ending column controls per row: Markdown and the archived snapshot use UTF-8 without BOM and CRLF; the three TSV attachments use UTF-8 without BOM and LF. No listed file contains a NUL byte.

This manifest deliberately excludes itself from its hash table, avoiding a circular self-digest. Its filename, permanent ID, version, and self-exclusion rule are bound by `JAN-CSAA-000-W017-INSTRUMENT-002@0.1.0`, which is row 29. The separate `JAN-CSAA-000-W017-PRESENTATION-002@0.1.0` record is also excluded because it is created only after this package is frozen and records the later presentation event without changing a listed artifact.

Rows 6 through 19 preserve the prior `0.2.1` package and its subsequent presentation, sponsor-response, and blocked-recording history. `JAN-CSAA-000-INTEGRITY-001@0.1.0` remains an immutable historical artifact; because its first row was path-bound to the then-current `README.md`, it is not represented as a current validator of the `0.3.0` README. The exact old candidate is preserved at row 6. No old response is copied, inferred, or transferred into the refreshed blank instrument.

`Initial Chat.md` is included only to preserve the exact discovery input. Its inclusion does not give it normative, evidentiary, provider-selection, or implementation authority.

---

## 2. Exact artifact identities

| Ordinal | Relative path | Package role and state | Exact bytes | SHA-256 | Encoding / endings |
| ---: | --- | --- | ---: | --- | --- |
| 1 | `README.md` | Exact `JAN-CSAA-000@0.3.0` Proposed candidate; non-authoritative; W0-17 undisposed | 101,802 | `a9e9174b3fb11f6c25c4d6c89db023a0163d781b288fe4045befd537aeb0a8eb` | UTF-8 no BOM / CRLF |
| 2 | `Wave 0 Sponsor Decision Instrument.md` | Ratified W0-01 through W0-16 source; explicitly no W0-17 disposition | 54,761 | `0c8603837bbc9f2ca7cb35fdda16ce68d2eabb8007ec81830e8d5550c65824ae` | UTF-8 no BOM / CRLF |
| 3 | `Initial Chat.md` | Background discovery input only; non-authoritative | 32,005 | `f34251a49098715cd8a446ec022a57cf83a44678f846d48a168f445b3464e13b` | UTF-8 no BOM / CRLF |
| 4 | `templates/CSAA Controlled Document Review Template.md` | Preserved controlled-review template `0.3.0` | 10,400 | `2e695d550ad4e2a5bbfd6d2330b5d4c860ce0ab6914ba336d199876ef9799a3c` | UTF-8 no BOM / CRLF |
| 5 | `templates/CSAA Requirement Ledger Template.md` | Preserved requirement-ledger template `0.3.0` | 9,256 | `24dc99b6259154f486114ce1f75d4d219f4a490ad7a325fc963292dcbe899aec` | UTF-8 no BOM / CRLF |
| 6 | `records/archive/JAN-CSAA-000@0.2.1.README.snapshot` | Exact preserved predecessor candidate; historical and non-authoritative | 98,588 | `3e0b5d503575b59c95f1e043d99122c5ebee5cff8429298347e7d3385c3725df` | UTF-8 no BOM / CRLF |
| 7 | `records/JAN-CSAA-000 - Self Review.md` | Historical exact-Draft author review `JAN-CSAA-000-SELF-REVIEW-001@0.1.0` | 28,174 | `9f6abc0019a2647c35fa567da05f6aecbd050e92e5c3f5c936b0121674ca07e1` | UTF-8 no BOM / CRLF |
| 8 | `records/JAN-CSAA-000 - Draft-to-Proposed Promotion Record.md` | Historical promotion proof `JAN-CSAA-000-PROMOTION-001@0.1.0` | 3,396 | `1ff4e7f94931cc4e1dabf40a21173c59e0d55e5b8eceaeec146b110681b44b95` | UTF-8 no BOM / CRLF |
| 9 | `records/JAN-CSAA-000 - Proposed Correction Self Review.md` | Historical exact-candidate correction review | 12,808 | `191a07f15c0d603b417da6eb58298ccb0d1abbdd89e6563a29a116a0b46250e7` | UTF-8 no BOM / CRLF |
| 10 | `records/JAN-CSAA-000 - Preparation Evidence Snapshot.md` | Historical revision/worktree evidence `JAN-CSAA-000-EVIDENCE-001@0.2.0` | 25,619 | `52165ebbaa72613e6bf12ea54992e63779596ad6d101c2f0a25a055d74a5da03` | UTF-8 no BOM / CRLF |
| 11 | `records/JAN-CSAA-000 - Requirement Ledger.md` | Historical closed ledger `JAN-CSAA-000-LEDGER-001@0.2.0` | 1,235,725 | `4688ef64f4b46f898bf3fff3dfee5a056695a9a167df8adbf7fbaad61ac74013` | UTF-8 no BOM / CRLF |
| 12 | `records/JAN-CSAA-000 - Independent Review.md` | Historical completed review `JAN-CSAA-000-INDEPENDENT-REVIEW-001@0.1.0` | 84,098 | `4feec4afadd3ca3ba1bee94f4a1581fe2a32b7981aeefaeba3b5d2031872ed40` | UTF-8 no BOM / CRLF |
| 13 | `records/JAN-CSAA-000 - Prospective Normative Carriage.md` | Historical unexecuted carriage `JAN-CSAA-000-W017-CARRIAGE-001@0.1.0` | 12,372 | `b268b118218f0de14707a4f8486482799a59c6404aefc5a4453429fbdf7b6cdf` | UTF-8 no BOM / CRLF |
| 14 | `records/JAN-CSAA-000 - W0-17 Adoption Instrument.md` | Preserved exact blank `0.2.1` presentation instrument; never backfilled | 70,175 | `f289e083206d877393af774c91e8dc41da4081fb7f61d8e77f0666130ebde027` | UTF-8 no BOM / CRLF |
| 15 | `records/JAN-CSAA-000 - Integrity Manifest.md` | Historical integrity manifest `JAN-CSAA-000-INTEGRITY-001@0.1.0` | 5,945 | `b2994ffb639cbd5351632f007ccaf7b920933326eaae7ceef02dcfb5cd22ac06` | UTF-8 no BOM / CRLF |
| 16 | `records/JAN-CSAA-000 - W0-17 Presentation Record.md` | Historical exact-package presentation record `001` | 10,554 | `a11d60e14da7abcde635590f16bbbee473688c50d9de77a967c573ddd1d6114f` | UTF-8 no BOM / CRLF |
| 17 | `records/JAN-CSAA-000 - W0-17 Historical Package Preservation Record.md` | Preservation attestation for the prior package and blank instrument | 2,569 | `4c81edaa96d4ad496459fa11c7b7a832456a6119869e393793cc3f0d063cbbdd` | UTF-8 no BOM / CRLF |
| 18 | `records/JAN-CSAA-000 - W0-17 Sponsor Response Record 001.md` | Exact itemized prior sponsor response; blocked and not transferred | 6,804 | `40f27e9b58c3b7db3bc696710a470955ec064b04c0543f56da16870732cec3ef` | UTF-8 no BOM / CRLF |
| 19 | `records/JAN-CSAA-000 - W0-17 Pre-Recording Compatibility Check 001.md` | Mandatory freshness failure and no-recording evidence | 4,792 | `45541a7f29fc83a6bc91ecb4e4bbceb03debbd05cde20d1a2bc0772ac0f6a75b` | UTF-8 no BOM / CRLF |
| 20 | `records/JAN-CSAA-000 - Refresh Preparation Evidence Snapshot.md` | Final refreshed repository evidence `JAN-CSAA-000-EVIDENCE-002@0.1.0` | 22,246 | `7707796aaf1acd0089ad229080fa0f1b5abdd8ec81d67bb03ce5bdb30d92ebce` | UTF-8 no BOM / CRLF |
| 21 | `records/JAN-CSAA-000-EVIDENCE-002 - Root Workspace Configuration Manifest.tsv` | Exact 49-row configuration-evidence attachment | 4,999 | `09dd1feb4d1852960fa43533111ab4d16a90f99944a81023c66bab026d187d28` | UTF-8 no BOM / LF |
| 22 | `records/JAN-CSAA-000-EVIDENCE-002 - Scope-Relevant Changed-Content Manifest.tsv` | Exact 22-row target-corpus-excluded changed-content attachment | 3,756 | `74bce5d33b6301a214d2f27a7208a03dfb79191e1a97ad0bf2d99e3bca00a6ee` | UTF-8 no BOM / LF |
| 23 | `records/JAN-CSAA-000 - Refresh Requirement Ledger.md` | Closed `JAN-CSAA-000-LEDGER-002@0.1.0`; 783 rows; 245 / 10 / 528 states | 1,262,060 | `19e2e6824c0b8a394d13a8645ecb3d2e656e64fa298eb496de21e06c0553c353` | UTF-8 no BOM / CRLF |
| 24 | `records/JAN-CSAA-000 - Refresh Draft Self Review.md` | Exact-Draft author review `JAN-CSAA-000-SELF-REVIEW-002@0.1.0`; no independence claimed | 19,267 | `371bb09bafe899baa25d210fe613ff74fdc313f0655dbdaaa7732c62044630b4` | UTF-8 no BOM / CRLF |
| 25 | `records/JAN-CSAA-000 - Refresh Draft-to-Proposed Promotion Record.md` | Successful six-substitution promotion plus rejected-attempt chronology | 5,673 | `e8d004fafc2c963af0889691662adae0a32b23cdfbe6d420390f85cf062dc851` | UTF-8 no BOM / CRLF |
| 26 | `records/JAN-CSAA-000 - Refresh Independent Review.md` | Exact-Proposed review `JAN-CSAA-000-INDEPENDENT-REVIEW-002@0.1.0`; 0 / 0 / 0 unresolved | 98,697 | `da5a3b7559aaaa0a13fe891bb6adefc978141e094c65941e82b2e1f988d36b92` | UTF-8 no BOM / CRLF |
| 27 | `records/JAN-CSAA-000 - Refreshed Prospective Normative Carriage.md` | Conditional unexecuted `JAN-CSAA-000-W017-CARRIAGE-002@0.1.0` | 11,157 | `e43832ab6a11a2cbb8632fefab1ea661649b5a2c0bfafc807c2d7e8fc96bbb44` | UTF-8 no BOM / CRLF |
| 28 | `records/JAN-CSAA-000-W017-CARRIAGE-002 - Exact Administrative Substitutions.tsv` | Exact ordered 24-operation carriage attachment | 14,385 | `3f2d9002cd0a8a9976e7e0fdf145f3ad54c5da3df44dd508536993010cabf7df` | UTF-8 no BOM / LF |
| 29 | `records/JAN-CSAA-000 - W0-17 Refreshed Adoption Instrument.md` | Presentation-ready blank `JAN-CSAA-000-W017-INSTRUMENT-002@0.1.0`; 47 decision fields and 6 summary fields blank | 78,520 | `0faf9cc4f50ce813034b19a4a7ef9aab9f10906145164d254c8f9ebfd08afbc5` | UTF-8 no BOM / CRLF |

---

## 3. Integrity and invalidation rules

The refreshed package integrity check passes only when:

1. every listed path exists as a regular file;
2. every exact byte length and lowercase SHA-256 digest matches;
3. every listed file is strict UTF-8 without BOM, contains no NUL, and has exactly the row-declared line-ending class;
4. row 1 remains the exact Proposed candidate;
5. row 23 contains 783 unique contiguous requirement IDs with the recorded 245 / 10 / 528 phase states;
6. row 26 remains a review of row 1 with zero unresolved blocker, major, or minor findings;
7. row 29 retains 16 `CARRIED_ACCURATELY` rows, 47 distinct blank decision fields, and 6 blank sponsor-summary fields;
8. rows 6 through 19 remain historical evidence only and no prior response is transferred;
9. `W0-17` remains unrecorded, `REG-D-018` remains absent and unconsumed, and Wave 1 remains inactive at presentation; and
10. no artifact or result is interpreted as provider, implementation, experiment, source-mutation, oracle-change, or later-wave authority.

Any byte change to a listed artifact invalidates this manifest for presentation. The changed artifact must receive affected review, all dependent identities must be refreshed, and a new manifest version must be created. This file must not be edited to disguise drift.

The prospective 101,717-byte Normative result is not a current artifact and is therefore not a row in this table. Its deterministic 24-substitution recipe and prospective SHA-256 `ed2cde24be9ce0a99210644fdf655c192db5ee2c97ce0f587f446a1820ee5710` remain conditional evidence in rows 27 and 28 only.

---

## 4. Closure statement

The exact refreshed Stage A package is integrity-frozen and ready for separate sponsor presentation. Every new sponsor-response field remains blank, `CSAA-000-REQ-744` remains sponsor-owned and unperformed, `JAN-CSAA-000` remains Proposed, `REG-D-018` remains prospective, and Wave 1 remains inactive.

No corpus filename was renamed. No repository file was staged or committed. The current register was not edited.
