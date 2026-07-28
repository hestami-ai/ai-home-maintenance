# JAN-CSAA-005 Current Subject Refresh and Compatibility Record

**Evidence ID:** `JAN-CSAA-005-EVIDENCE-003`

**Evidence version:** `0.1.0`

**Status:** Complete author-side current-subject refresh and compatibility evidence for the working `JAN-CSAA-005` Draft; non-authoritative review input

**Subject:** Revision-and-worktree-bound JPWB implementation/configuration inventory after two selected tracked files acquired unstaged changes

**Accepted observation window:** `JAN-CSAA-005-REFRESH-OBS-027` began at `2026-07-28T12:48:38.8183925-04:00`; `JAN-CSAA-005-REFRESH-OBS-028` began at `2026-07-28T12:48:39.4492362-04:00`; the second internally stable read completed at `2026-07-28T12:48:39.7675224-04:00`

**Authority and limitation:** Collected read-only under the standing documentation commission recorded by `JPWB-REG-005 REG-D-021` and corrected by `REG-D-022`. This record observes and compares repository state. It selects no provider, approves no dependency, changes no application source, executes no build/test/analyzer/mutation command, changes no oracle, and confers no program authority.

**Predecessor evidence:** [JAN-CSAA-005-EVIDENCE-002@0.1.0](<JAN-CSAA-005 - Successor Preparation Evidence Snapshot.md>) remains historical evidence for its exact clean OBS-019/020 subject.

---

## 1. Acceptance and method

OBS-027 and OBS-028 used the same read-only method and matched in every conclusion-bearing field. Earlier exploratory captures after OBS-020 were not accepted because their perimeter or serialization method did not reproduce the frozen 19-path perimeter identity. They confer no subject identity and are not used by this record.

The accepted method:

1. records observation start and completion times, branch, and parent commit;
2. serializes the same 19 repository-root-relative pathspecs as an ordinal-sorted, UTF-8/LF manifest with one terminal LF;
3. records normalized `git status --porcelain=v2 --untracked-files=all` and ordinal-sorted `git ls-files -s` manifests for that exact perimeter;
4. for every selected dirty path, records repository-root-relative path, kind, porcelain status, current content bytes and SHA-256, normalized unstaged-diff bytes and SHA-256, and normalized staged-diff bytes and SHA-256;
5. separately records the ignored generated SvelteKit TypeScript context's bytes, digest, and UTC last-write time;
6. records the committed `packages` and `apps` tree identities; and
7. checks for the repository mutation journal and running Bun processes.

All text-manifest and diff identities in this record use UTF-8 without BOM, LF line endings, ordinal path ordering where applicable, and one terminal LF for a non-empty manifest. Empty manifests hash the zero-byte sequence.

---

## 2. Exact accepted subject

| Field | Accepted value in both observations |
| --- | --- |
| Repository root | `E:/Projects/hestami-ai` |
| Subject root | `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| Branch | `main` |
| Parent commit | `49d45b90eeb45938b7f49f7372596d07a79eece2` |
| Explicit perimeter | 19 pathspecs; 1,005 normalized bytes; SHA-256 `74bfdc46ebddddc7a4cafa12584e76f92faa6489feaf1078ac2772871182b390` |
| Selected-scope porcelain-v2 identity | 2 records; 385 normalized bytes; SHA-256 `d09d0ef72e64cc445a2b3e23a6c7082382e2a05df0bd106c6de90f47df183374` |
| Tracked implementation/configuration manifest | 541 records; 75,641 normalized bytes; SHA-256 `8b8c4e1d6dee18da4c5814725e69b42b2b8a002a5405b5fea7348ef8edd39a9a` |
| Dirty-identity manifest | 2 records; 594 normalized bytes; SHA-256 `4c1ac0e964882ab53898eaef176beefc252154ee13700588fb1a42ddc5488aac` |
| Staged-diff identity for both dirty paths | Zero bytes per path; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `packages` Git tree object | `9a1646f73dc4e75e6f1462c15e524e943e5b526a` |
| `apps` Git tree object | `673f7ae53d54a66ca6cc93f8a602413547c062ef` |
| Generated SvelteKit context | `apps/rph-demo/.svelte-kit/tsconfig.json`; 1,010 bytes; SHA-256 `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4`; last write `2026-07-28T13:36:47.9541763Z` |
| Mutation journal | Absent |
| Running Bun processes | 0 |
| Pair equality | `TRUE` for method, commit, branch, perimeter, status, tracked manifest, dirty identities, staged and unstaged diffs, generated context, committed trees, and quiescence checks |

### 2.1 Dirty-path identities

| Subject-root-relative path | Status | Content bytes / SHA-256 | Normalized unstaged diff bytes / SHA-256 | Staged diff |
| --- | --- | --- | --- | --- |
| `apps/rph-demo/e2e/pwa-node-graph.e2e.ts` | Tracked, unstaged modified (`.M`) | 2,970 / `e301f438aea48ad7bfbeef717979fa83c566c3a3956c17c819abaf0ab8366fc8` | 817 / `9c64df496cc634a26d9037738a52ff63fa6d254e4e351b8fba937ca6e12f00a4` | Empty |
| `apps/rph-demo/src/lib/PwuTypeCard.svelte` | Tracked, unstaged modified (`.M`) | 8,020 / `8b7487e3cc98d9e44543b259e098b46289e5ae1f9adda039dfe6404b51661704` | 2,237 / `c68cca158887275d0a19b86e311bb5273bdfb9e2f4b7612a5267cb9dd2588207` | Empty |

The dirty-identity manifest uses the repository-root-relative forms of these paths and includes every field named in Section 1. The table uses subject-root-relative forms for readability.

---

## 3. Compatibility analysis

The two unstaged changes are bounded to:

- an inline presentational SVG with an accessible `AI agent` image role, name-layout styling, and root-badge layout adjustments in `PwuTypeCard.svelte`; and
- one Playwright assertion that two `AI agent` images render in the existing PWA node-graph scenario.

The observed diffs:

- add no import, export, package, dependency, workspace, compiler, build, test-command, coverage, mutation, analyzer, gate, persistence, network, or runtime-service declaration;
- add no TypeScript semantic object, contract, command, event, persistence schema, dependency edge, or package-boundary edge;
- change no file's previously recorded source/test/configuration classification;
- change no committed `packages` or `apps` tree identity because both edits remain unstaged working-tree content; and
- do not alter the numerical file, package, configuration, analyzer, coverage, or runtime-trace observations already reported by the inventory.

Accordingly, the prior technical inventory conclusions remain compatible with this exact dirty subject. The subject identity does not remain the clean OBS-019/020 identity: every current conclusion is now bound to parent commit plus the OBS-027/028 status, tracked-manifest, dirty-content, diff, and generated-context identities above.

This compatibility conclusion does not assert that the two changes are correct, tested, approved, staged, committed, or behavior-preserving. The Playwright assertion is observed source, not executed evidence.

---

## 4. Freshness and invalidation

This record remains current only while every conclusion-bearing identity in Section 2 remains unchanged. It is invalidated by any of:

- parent-commit or branch change;
- perimeter membership or tracked-manifest change;
- selected status membership, dirty content, unstaged diff, or staged diff change;
- generated SvelteKit context bytes or last-write-time change;
- `packages` or `apps` tree change;
- mutation-journal appearance or a conflicting active mutation process; or
- a later finding that the two dirty changes affect a claimed inventory conclusion.

The working Draft and its ledger SHALL be refreshed or marked stale if any invalidation trigger occurs before their exact Proposed-candidate freeze.

---

## 5. Disposition

| Question | Result |
| --- | --- |
| Are OBS-027 and OBS-028 an internally stable matching pair? | `YES` |
| Is the selected scope clean? | `NO`; two tracked paths have unstaged changes |
| Is the dirty subject exactly identified beyond the parent commit? | `YES` |
| Do the observed dirty changes invalidate an existing technical inventory conclusion? | `NO CURRENTLY IDENTIFIED`, bounded to the analysis in Section 3 |
| Does this record prove correctness or behavior preservation? | `NO` |
| May the working Draft use this subject for current author-side verification? | `YES`, while Section 4 remains satisfied |
| Does this record confer status or authority? | `NO` |

`JAN-CSAA-005-EVIDENCE-003@0.1.0` is therefore accepted as current author-side refresh and compatibility evidence for the working Draft. Independent adversarial review, integrity/provenance validation, final sponsor decision, and ministerial recording remain later lifecycle activities.
