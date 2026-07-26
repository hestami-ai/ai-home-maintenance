# Wave 1 Recorder Transaction Mechanism Validation Record

**Record ID:** `JAN-CSAA-W1-MANIFEST-001-RECORDER-MECHANISM-VALIDATION-001@0.1.0`

**Status:** `PASS — HOST-BOUND TXF MECHANISM QUALIFIED FOR THE EXACT WAVE 1 MANIFEST-SYNCHRONIZATION BYTE/PATH IDENTITY SURFACE; NO CARRIAGE YET`

**Recorded:** `2026-07-26T18:39:51.2712304-04:00`

**Recorder and validator:** Codex documentation recorder, distinct from the accountable sponsor

**Operational authority:** `JAN-CSAA-W1-MANIFEST-001-RECORDER-MECHANISM-AUTHORITY-001@0.1.0`

**Proposal served:** `JAN-CSAA-W1-MANIFEST-001@0.3.0`

**Prior blocker preserved:** `JAN-CSAA-W1-MANIFEST-001-RECORDING-CHECK-001@0.1.0`

**Purpose:** Freeze the separately authorized qualification of an external, recorder-only transactional mechanism before any successor pre-recording check or any `REG-D-019`, archive, active-README, completion, or confirmation write.

**Effect:** This record makes a qualifying mechanism available for a fresh §7.1 check. It does not itself pass that check, authorize carriage, append a register entry, create an archive, change the active README, create the conditional completion record, confirm a decision, close a gap, stage a file, or commit a change.

---

## 1. Authority and separation

The user supplied the exact exposed-message payload `Proceed.\n` after the recorder reported that a later retry required a separately authorized and independently validated transactional mechanism. The immutable operational-authorization record preserves that payload, its exact contextual boundary, and the following identity:

| Artifact | Exact identity |
| --- | --- |
| Operational-authorization record | 5,816 bytes; SHA-256 `59cc7e2a7a6c8bd7512981969a0747d73b1d88e57315228979d324fabd857a39`; UTF-8 without BOM; CRLF only; one terminal CRLF |

That authority permits only external recorder-mechanism provisioning, isolated scratch qualification, mechanism evidence, and a fresh Check 002. It does not alter any sponsor disposition or package byte and does not independently authorize §§3.1–3.3.

The accountable sponsor did not perform this technical validation. The recorder performed the executable qualification, and two separate read-only reviewers independently tested or reviewed the critical concurrency behavior. No reviewer changed a repository file.

---

## 2. Frozen mechanism

### 2.1 Host and volume qualification

| Property | Qualified value |
| --- | --- |
| Operating system | Microsoft Windows `10.0.26200.0`, 64-bit |
| Runtime used for qualification | PowerShell 7 on `.NET 10.0.9`, 64-bit process |
| Target volume | `E:` / label `HIGHSPD` |
| Drive type | Fixed, local |
| File system | NTFS |
| Transaction capability | `FILE_SUPPORTS_TRANSACTIONS` present; `CreateTransaction`, `CommitTransaction`, `RollbackTransaction`, and `CreateFileTransactedW` callable |
| Package placement | Every protected existing path and both prospective create-if-absent paths are on `E:` |
| Rejected attributes | No protected existing path is compressed, EFS-encrypted, or a reparse point |

The qualification is host-bound. A changed operating-system build, volume, file system, target placement, unsupported attribute, missing API, or absent `FILE_SUPPORTS_TRANSACTIONS` invalidates availability and requires a new validation record. There is no non-transactional fallback.

### 2.2 Exact operational source identities

All operational sources were provisioned outside the repository and outside every bound package path. Each is UTF-8 without BOM, LF-only, with one terminal LF.

| Source | Bytes | SHA-256 | Function |
| --- | ---: | --- | --- |
| `TxfHarness.cs` | 8,225 | `70f647f38df96e2ca3f8ece4f728142c67310b88c70f0cc4d4dba01c7ffb7e76` | Minimal KTM/TxF session, protected handle acquisition, transacted full-file overwrite/create, commit/rollback, hashing, and writer-denial probes |
| `TxfHarness.Tests.ps1` | 18,453 | `7aada3a717f9db3ee34fd96caf271b32d682bc03bad228ffd702c067c8a573f5` | Final 12-case executable qualification suite |
| `TxfAdversary.ps1` | 1,025 | `ce21fa4f69bb5a2d0198e3a7f13b7d1d480883d378f7fe9805164a5f67130cf8` | Separate-process repeated ordinary-writer adversary |
| `TxfCrashChild.ps1` | 913 | `749085a42a7343ee8ca66c1d1ecaef0c922bad6237f58d6fe61c5c86f631cc9f` | Forced-termination probe before or after commit |
| `TxfBoundSet.Validation.ps1` | 7,924 | `fb8d819fc2c5f7bba120767c470ef31787de2e2bd7c41ce2ee4ed2fbcf53efa5` | Exact 20-path package acquisition, identity, exclusion, absent-name reservation, and rollback validation |

The mechanism invokes:

- `CreateTransaction`;
- `CreateFileTransactedW` with `GENERIC_READ` and, for the phase write target, `GENERIC_WRITE`;
- share mode `FILE_SHARE_READ`, intentionally denying competing content writers and delete/rename opens;
- `OPEN_EXISTING` for protected existing paths;
- `CREATE_NEW` for an absent archive or completion path;
- `FILE_FLAG_WRITE_THROUGH` for transacted writers;
- `CommitTransaction` or `RollbackTransaction`; and
- ordinary postcommit verification readers opened with read access and share-read/write/delete while the retained transacted handles continue to enforce the writer/delete denial.

### 2.3 Required recorder protocol

For each proposal phase, the qualified mechanism SHALL:

1. fail closed unless all paths resolve to the qualified local NTFS volume and every unsupported attribute check passes;
2. determine the complete protected set before acquiring any handle;
3. acquire every existing protected path in deterministic full-canonical-path order;
4. request write access for the one existing phase write target and read access for every other existing protected path, always with share-read only;
5. abort and roll back if any existing writer, delete-capable handle, path conflict, missing path, identity mismatch, or unexpected error prevents complete acquisition;
6. perform every final byte-length, SHA-256, encoding, line-ending, terminal-newline, identifier, lifecycle, gap-state, authority, and next-register-identifier read through the acquired transacted handles;
7. reserve each authorized absent target with transactional `CREATE_NEW`; treat an exact existing allowed target only under the proposal's explicit resume rule and never overwrite an incompatible target;
8. construct each full successor from the exact protected preimage and verify the complete successor inside the transaction before commit;
9. flush each transacted writer and commit the phase as one KTM transaction;
10. retain all transacted file handles after commit;
11. while those handles still exclude content writers and namespace replacement, open compatible ordinary readers and reverify every committed byte/path identity required by the phase;
12. release no protecting transacted handle until all postcommit verification succeeds;
13. close the ordinary verification readers, then the retained transacted file handles, and finally the transaction handle only after the protected verification is complete; and
14. record an uncertain result as a blocker and inspect only exact proposal-permitted resume states; it SHALL NOT perform an unconditional repair, overwrite, relabel, or duplicate append.

Any deviation, unexpected return code, timeout, identity drift, target collision, unsupported host condition, or inability to preserve the complete protected set is a fail-closed result.

---

## 3. Proposal-surface interpretation

The proposal defines an exact dynamically bound identity in §5 as:

- ID/version;
- path;
- stored byte length;
- SHA-256 over stored bytes;
- encoding and line-ending form; and
- terminal-newline condition.

Its concurrency clauses require enforced multi-file read/write exclusion, exact-preimage protection, atomic full-file succession, atomic create-if-absent, unchanged path identity, and verification before release. The qualified TxF mechanism protects that exact stored unnamed-stream byte surface and the target namespace surface:

- ordinary and transacted content writers are denied;
- append and truncation requests are denied;
- delete, rename, replacement, hard-link creation, and ancestor rename were denied in the independent probes;
- a transactionally reserved absent name cannot be concurrently created;
- exact preimages are read only after protection is held;
- multi-file changes become visible together at commit; and
- committed stored bytes remain readable and verifiable while retained handles continue denying content writers.

Windows share-mode enforcement does not deny every metadata-specific access mask. Separate probes found that `FILE_WRITE_ATTRIBUTES`, `FILE_WRITE_EA`, and `WRITE_DAC` opens can succeed while the retained handle is present. Timestamps, alternate-stream data, extended attributes, and security descriptors are not constituents of the proposal's frozen exact identity. This validation therefore makes no claim to exclude all privileged raw-volume operations or every NTFS metadata/security mutation. It qualifies only the proposal's stored-byte and path-namespace identity surface.

If a later controlling interpretation expands “mutation” to metadata, security descriptors, alternate streams, raw-volume access, or another surface not present in the proposal's exact-identity rule, this qualification is insufficient and Check 002 or the affected phase must fail. No such expansion is silently assumed here.

Transactional in-place full-file overwrite is qualified as the proposal's equivalent-transaction/exclusive-lock branch, not as native content compare-and-swap and not as an ordinary rename. The exact preimage is read after transactional exclusion is acquired, the full successor is written and verified inside that transaction, visibility changes atomically at commit, and committed bytes are reverified before the exclusion is released.

---

## 4. Executable validation results

### 4.1 Final isolated suite

The final isolated run used:

`E:\Projects\hestami-ai\.codex-tmp\w1m-txf-probe\tests-run-006`

It returned `overall_pass = true` for all 12 tests:

| No. | Test | Result | Exact observed predicate |
| ---: | --- | --- | --- |
| 1 | `volume-supports-transactions` | `PASS` | `E:` reports `FILE_SUPPORTS_TRANSACTIONS` |
| 2 | `rollback-existing-and-new` | `PASS` | Old committed view remained visible, writer was denied, rollback restored the existing preimage, and the transacted create disappeared |
| 3 | `commit-and-verify-under-transacted-handle-lock` | `PASS` | Commit with handles open succeeded; ordinary reader saw committed bytes while retained handles still denied writers; writer became available only after release |
| 4 | `multi-file-atomic-commit` | `PASS` | Two overwrites and one create were jointly invisible before commit and jointly exact after commit while protected |
| 5 | `preexisting-writer-blocks-transaction` | `PASS` | A pre-existing ordinary writer prevented transacted writer acquisition and caused no change |
| 6 | `atomic-create-if-absent-conflict` | `PASS` | `CREATE_NEW` rejected an existing name without changing it |
| 7 | `expected-preimage-mismatch-aborts` | `PASS` | Mismatch detected from the protected transaction view caused rollback before mutation |
| 8 | `transacted-reader-enforces-read-set` | `PASS` | A protected read-only path denied an ordinary writer and retained exact content |
| 9 | `external-writer-continuously-excluded` | `PASS` | A separate process made at least 20 denied opens spanning precommit and postcommit verification; its first successful open occurred only after protected handles closed |
| 10 | `forced-process-termination-rolls-back` | `PASS` | Termination after dirty overwrite/create but before commit left only the exact old state |
| 11 | `forced-process-termination-after-commit-preserves-successor` | `PASS` | Termination after commit but before release left only the complete multi-file successor and released the locks for resume |
| 12 | `namespace-and-second-recorder-exclusion` | `PASS` | Delete, rename, and a second transacted writer were denied while the first recorder protected the target |

The final suite changed only isolated scratch fixtures. It did not write a bound package path.

### 4.2 Exact bound-set qualification

The separately frozen bound-set validator passed:

| Predicate | Result |
| --- | --- |
| Protected existing paths acquired in deterministic order | `PASS — 20` |
| Every protected identity read through its transacted handle | `PASS — exact bytes and SHA-256` |
| Writers denied for every protected existing path | `PASS — 20 of 20` |
| Prospective archive/completion names reserved transactionally | `PASS — 2` |
| Reserved absent names invisible before commit | `PASS` |
| Competing create denied | `PASS` |
| Rollback removed both reservations | `PASS` |
| Every existing bound identity exact after rollback | `PASS — 20 of 20` |
| Unsupported compressed/EFS/reparse attributes | `PASS — none present` |

The 20 existing paths were the live register, active README, proposal, attachment, eight §1.2 package members, four §2.1 historical artifacts, validation freeze, concern-owner determination, presentation record, and sponsor-response record. The two absent names were the exact proposal archive and conditional-completion paths.

No register, README, archive, completion, Draft, ledger, proposal, attachment, historical record, determination, presentation, or sponsor-response byte changed.

### 4.3 Independent corroboration

Two independent read-only reviews corroborated the critical behavior:

1. One reviewer opened a transacted writer on the exact 50,894-byte proposal, committed with the handle retained, read exactly 50,894 committed bytes with SHA-256 `45ca6f5bbe7868873eda2d297fad384f8cb01fb261dceaabf8cbabba9b2bc17b` through a compatible ordinary reader, observed ordinary writer error 32 before handle release, and observed ordinary writer success only after release. Proposal bytes, digest, and last-write time remained unchanged.
2. A separate reviewer confirmed on isolated `E:` fixtures that transactionally created names were invisible before commit, competing creation failed with error 6800, ordinary writers failed with error 32 before and after commit while handles remained open, invalidated transacted-handle I/O failed with error 6701, ordinary committed-byte reads returned the exact successor, hard-link creation and a second transaction writer were denied, ancestor rename was denied, and ordinary writer acquisition succeeded after release.

The independent authority/scope review concluded that the proposal's exact identity binds stored bytes and path rather than timestamps, EAs, or ACLs; the residual metadata-specific opens therefore do not defeat this exact qualification. It also concluded that the TxF full-file write qualifies under the proposal's exclusive-lock/equivalent-transaction branch when the protected preimage read, atomic commit, and postcommit verification protocol above is followed.

---

## 5. Known platform caveat

Microsoft strongly discourages new TxF dependencies and states that TxF may not be available in future Windows versions. Microsoft also recommends closing transacted handles before commit. This one-time host-bound protocol intentionally commits with handles retained because the proposal requires continuous exclusion through postcommit verification.

That retained-handle pattern was not accepted by assumption:

- it was executed repeatedly on the qualified host;
- it was tested with actual content overwrite and transactional create;
- the ordinary verifier read committed bytes successfully;
- an external adversary remained denied across the entire window;
- process termination before and after commit produced only exact old or exact successor states; and
- two independent probes corroborated the critical sharing behavior.

The mechanism is eligible only for the present host-bound operation and only while all frozen source hashes and environmental predicates remain exact. It SHALL NOT become a product dependency, general architectural commitment, provider selection, or portable program facility under this authority.

Primary platform references:

- <https://learn.microsoft.com/en-us/windows/win32/fileio/txf-basic-concepts>
- <https://learn.microsoft.com/en-us/windows/win32/fileio/how-to-use-transactional-ntfs>
- <https://learn.microsoft.com/en-us/windows/win32/fileio/programming-considerations-for-transacted-fileio->
- <https://learn.microsoft.com/en-us/windows/win32/fileio/deprecation-of-txf>
- <https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createfiletransactedw>

---

## 6. Qualification conclusion and expiry

**Conclusion:** `QUALIFIED_FOR_FRESH_CHECK_002`

The separately authorized mechanism now satisfies the previously absent capability predicate for:

- enforced carriage-wide stability of the exact stored-byte/path read set;
- exact-preimage full-file succession under an exclusive transactional operation;
- multi-file all-or-nothing visibility;
- atomic create-if-absent; and
- committed-byte verification before exclusion release.

This conclusion does not predetermine Check 002. The recorder must still recheck every §7.1 predicate, all exact package identities and states, the register endpoint, the complete protected set, the mechanism-source hashes, host/volume predicates, scoped worktree impact, staging state, and prospective successor.

The qualification expires immediately if:

- any operational source identity differs;
- the host, volume, file system, capability flag, or supported-attribute result differs;
- a protected path cannot be acquired in deterministic order;
- a required final identity or authority predicate differs;
- an archive or completion collision is incompatible;
- the postcommit retained-handle protocol cannot be reproduced;
- Check 002 fails;
- the sponsor revokes the operation; or
- the requested activity expands beyond the exact ratified documentation-only carriage.

---

## 7. Non-effect

At this record freeze:

- Check 001 remains immutable failed evidence;
- the sponsor-response record remains immutable;
- `REG-D-018` remains the final register decision;
- `REG-D-019` and `REG-D-020` remain absent;
- the active README remains the exact 101,717-byte source;
- the archive and completion paths remain absent;
- `JAN-CSAA-W1-GAP-001` remains open;
- no Wave 1 Draft gains authority;
- no implementation, configuration, test, oracle, dependency, provider, procurement, later wave, staging, or commit is authorized; and
- the only new repository artifact from this qualification is this documentation evidence record, in addition to the already recorded operational-authorization evidence.
