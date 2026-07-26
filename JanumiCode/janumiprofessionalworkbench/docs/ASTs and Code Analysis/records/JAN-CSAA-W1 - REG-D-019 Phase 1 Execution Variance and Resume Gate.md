# REG-D-019 Phase 1 Execution Variance and Resume Gate

**Record ID:** `JAN-CSAA-W1-MANIFEST-001-PHASE1-VARIANCE-001@0.1.0`

**Status:** `RECORDED PROCEDURAL VARIANCE — EXACT MERGE-PENDING STATE PRESERVED; NO PHASE 2 ACTION UNTIL THE §3.2 RESUME GATE PASSES`

**Recorded:** `2026-07-26T19:01:45.8716899-04:00`

**Recorder:** Codex documentation recorder

**Proposal:** `JAN-CSAA-W1-MANIFEST-001@0.3.0`

**Affected phase:** Proposal §3.1, exact `REG-D-019` pending-decision execution

**Purpose:** Preserve a late independent-audit finding append-only, distinguish the exact safe live state from the procedural variance, and define the fail-closed gate that must control any consideration of proposal §3.2.

**Authority:** Evidence only. This record is not a sponsor disposition, concern-owner waiver, register decision, carriage permission, completion record, confirmation, gap closure, or merged-state claim.

---

## 1. Exact execution subject

| Field | Exact value |
| --- | --- |
| Phase-1 executor | `TxfPhase1.PendingDecision.ps1`; 12,765 bytes; SHA-256 `8909adcc7a27b3137fd225333e8615c047e6cb60824ae6ed2ca9c6c8696853a8`; UTF-8 without BOM; LF-only; one terminal LF; external recorder-only source |
| Pending entry | 3,922 bytes; SHA-256 `fb2f688daafd0cef47c016317927f3d5dc05e0971ae87f6c7af966d8da88c9f9`; UTF-8 without BOM; LF-only; one terminal LF |
| Register preimage | 101,465 bytes; SHA-256 `8e10767517bd98a8808a9d97dfcb6f6d0b6cba134e082b14e41588fbfa544798`; exact `REG-D-018` endpoint |
| Register successor | 105,388 bytes; SHA-256 `fad01c48361f422bf1f2b5021c466ec4add24de95bd0d285bda46d8a0e2173ab`; exact preimage prefix plus one LF and the exact pending entry |
| Register result | One exact `REG-D-019`; no `REG-D-020`; UTF-8 without BOM; LF-only; one terminal LF |
| Pending status | `EFFECTIVE — MERGE PENDING` |

The executor:

- re-hashed all five qualified mechanism sources and compiled the exact hashed helper bytes;
- acquired 24 existing protected paths in deterministic order;
- read and matched every protected path identity under TxF handles;
- denied ordinary writers before mutation;
- constructed, transactionally wrote, and verified the exact full register successor;
- committed with every protected handle retained;
- re-read the committed register and all 23 unchanged paths;
- reverified exact prefix preservation and entry occurrence;
- denied ordinary writers again through postcommit verification; and
- changed no active README, archive, completion, Draft, ledger, proposal, attachment, historical, authority, check, implementation, configuration, test, or oracle path.

---

## 2. Late independent-audit findings

The independent audit occurred after the exact pending successor had committed and before any §3.2 active-path, archive, or completion action.

### 2.1 Omitted protected recomputation

The executor verified the exact source README, exact attachment, exact passing Check 002, and every other protected predecessor, but it did not itself rerun proposal §3.1 steps 6–12 after acquiring the phase-1 protected set. Specifically, it did not inside that transaction:

1. decode each attachment Base64 field;
2. recheck every decoded `from` and `to` byte length and SHA-256;
3. recheck ordered unique `from` occurrence;
4. apply `W1M-C-01` through `W1M-C-05` in memory; or
5. recheck the 102,164-byte result digest, 1,531 lines, and modal counts.

Check 002 had performed those computations correctly, and the executor protected and re-hashed the exact Check 002, README, and attachment bytes. The deterministic result therefore has no identified byte uncertainty. The omission is nevertheless a mandatory procedural-timing variance and is not represented as conforming phase-1 execution.

### 2.2 Non-gating final absence observations

The executor required archive/completion absence before the transaction and again after acquiring the existing protected set. Its postcommit result reported both exact paths absent, but those two final booleans were output observations rather than conditions that could change `overall_pass` to false.

Nonexistent phase-1 names could not be held as existing-file handles without violating §3.1's register-only write rule. That does not excuse the reporting defect. Any later phase must use transactional `CREATE_NEW` for both names and fail closed on any collision.

### 2.3 Git-state timing

The outer invocation checked the explicit target paths for staged changes immediately before executing the phase, and a separate post-phase check again found none. The executor itself did not inspect the Git index while the file transaction was active. The live result is unstaged, but this distinction is preserved rather than collapsed into an in-transaction claim.

---

## 3. Exact safe live state after discovery

Fresh external verification after the audit found:

| Surface | Exact live state |
| --- | --- |
| Register | 105,388 bytes; SHA-256 `fad01c48361f422bf1f2b5021c466ec4add24de95bd0d285bda46d8a0e2173ab`; exact `REG-D-019` pending successor |
| Active `README.md` | 101,717 bytes; SHA-256 `ed2cde24be9ce0a99210644fdf655c192db5ee2c97ce0f587f446a1820ee5710`; exact source |
| Preservation snapshot | Absent |
| Conditional completion record | Absent |
| Target paths staged | None |
| `REG-D-020` | Absent |
| `CSAA-000-REQ-150` for this event | Not satisfied |
| `JAN-CSAA-W1-GAP-001` | Open |
| Wave 1 members | Non-authoritative Drafts; unchanged |

No partial README, archive, or completion state exists. The register successor is complete, prefix-preserving, unique, and externally verifiable. The truthful live register state remains `EFFECTIVE — MERGE PENDING`; it is neither confirmation evidence nor an `EFFECTIVE — MERGED` claim.

The append-only register SHALL NOT be rewritten to conceal or remove `REG-D-019`, and the pending decision SHALL NOT be appended a second time.

---

## 4. §3.2 resume gate

The proposal states:

- an exact existing `REG-D-019` pending decision SHALL NOT be appended again;
- a resumed recorder may enter §3.2 only after verifying the entry, sponsor/response identities, and every delegated predicate; and
- every entry or resumption into §3.2 must acquire carriage-wide exclusion and rerun steps 6–12 against the exact source or verified snapshot before any active-path write or completion action.

Accordingly, technical recovery is possible only if a fresh phase-2 transaction:

1. includes this variance record in the protected set;
2. re-hashes the exact mechanism and execution sources used for that phase;
3. acquires the complete existing protected set in deterministic order;
4. verifies the exact `REG-D-019` successor, its one-entry occurrence, sponsor identity/time, sponsor-response identity, delegation, and all unchanged authority predicates;
5. verifies the active README is still the exact source and both prospective create-if-absent targets are absent;
6. performs the complete attachment decode, per-field byte/hash validation, ordered unique-occurrence checks, five substitutions, result byte/hash/line-ending/line/modal checks while protection is held and before any write;
7. reserves both absent names with transactional `CREATE_NEW` and treats any collision as a rollback blocker;
8. creates the exact source snapshot, writes only the exact active README result, and creates a revised completion record that discloses this variance;
9. verifies all three transaction views before commit;
10. commits all three together while retaining every protected handle;
11. re-verifies every committed and unchanged identity while writer exclusion remains held;
12. asserts rather than merely reports every required postcondition; and
13. confirms before and after that no target is staged and no Git commit occurred.

If any condition fails, phase 2 SHALL make no write or SHALL leave only an exact proposal-recognized resume state. `REG-D-019` remains `EFFECTIVE — MERGE PENDING`, and no completion, confirmation, satisfaction, or closure claim is permitted.

---

## 5. Authority conclusion

Independent reviews disagreed initially on whether a new sponsor/concern-owner act was required. The controlling proposal text resolves the issue prospectively:

- §3.1's failure rule means the omitted phase-1 checks did not themselves create carriage permission and SHALL NOT be represented as performed;
- §3.2 separately states that an exact existing `REG-D-019` SHALL NOT be appended again and that a resumed recorder may enter §3.2 after verifying the exact entry, sponsor/response identities, and every delegated predicate;
- §3.2 then requires the resumed recorder to acquire carriage-wide exclusion and rerun steps 6–12 before any active-path write or completion action; and
- proposal §5.2 preserves an existing `EFFECTIVE — MERGE PENDING` state through later recoverable failure and routes it through §§3.2–3.3.

**Recorder conclusion:** `BUILT_IN_§3.2_RESUME_AUTHORITY_AVAILABLE; NO NEW SPONSOR OR CONCERN_OWNER ACT REQUIRED`

This is recovery under the already ratified exact procedure, not a waiver:

- no omitted check is deemed performed retroactively;
- no sponsor disposition, concern-owner determination, package identity, lifecycle state, gap state, scope, or requirement is changed;
- the complete omitted proof is rerun prospectively under the exact §3.2 exclusion before any write;
- this variance remains permanent evidence; and
- failure of any resume predicate leaves `REG-D-019` merge-pending and authorizes no accommodation.

A new sponsor or concern-owner act would be required to excuse or erase the historical omission, skip or weaken a §3.2 predicate, accept incompatible bytes/state, or expand the controlled procedure. None of those actions is taken.

Phase 2 may therefore be considered only through the exact resume gate in §4. No archive, README result, completion record, confirmation, satisfaction, closure, or merged-state claim is authorized unless its own exact phase predicates succeed.

---

## 6. Non-effect

This record:

- preserves rather than erases the variance;
- does not alter `REG-D-019`;
- does not duplicate the pending decision;
- does not change the active README;
- does not create the preservation snapshot or conditional completion record;
- does not authorize `REG-D-020` or any later confirmation identifier;
- does not close a gap or satisfy a requirement;
- does not promote any Draft;
- does not authorize an implementation, provider, dependency, later wave, staging, or commit; and
- does not treat the prepared but unstored completion candidate as evidence.
