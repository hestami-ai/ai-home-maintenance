# JAN-CSAA-005 Current Subject Rebinding Record

**Evidence ID:** `JAN-CSAA-005-EVIDENCE-004`

**Evidence version:** `0.1.0`

**Status:** Complete author-side current-subject rebinding evidence for the working `JAN-CSAA-005` Draft; non-authoritative review input

**Accepted observation window:** `JAN-CSAA-005-REFRESH-OBS-029` began at `2026-07-28T13:08:58.6982147-04:00`; `JAN-CSAA-005-REFRESH-OBS-030` began at `2026-07-28T13:08:59.3965320-04:00`; the second internally stable read completed at `2026-07-28T13:08:59.7313669-04:00`

**Authority and limitation:** Read-only observation under `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`. This record changes no application source, test, configuration, dependency, provider, oracle, or repository state and confers no status or authority.

**Supersedes for current use:** [JAN-CSAA-005-EVIDENCE-003@0.1.0](<JAN-CSAA-005 - Current Subject Refresh and Compatibility Record.md>), whose OBS-027/028 parent-commit identity was invalidated by a later documentation-only commit. EVIDENCE-003 remains exact historical evidence and is not rewritten.

---

## 1. Rebinding cause and result

After OBS-027/028, the repository parent advanced from `49d45b90eeb45938b7f49f7372596d07a79eece2` to `0e7893f5fd343e3d74ca7dc73bad0221bb95f81c` through a commit outside the 19-path implementation/configuration perimeter. That advance triggered the recorded parent-commit invalidation rule even though the conclusion-bearing tracked manifest, selected dirty content, diffs, generated context, and committed `packages`/`apps` trees did not change.

OBS-029 and OBS-030 repeated the exact `read-only-method-v5-normalized-dirty-diff` method from EVIDENCE-003 and matched in every field.

---

## 2. Exact accepted subject

| Field | Accepted value in both observations |
| --- | --- |
| Repository root | `E:/Projects/hestami-ai` |
| Subject root | `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| Branch | `main` |
| Parent commit | `0e7893f5fd343e3d74ca7dc73bad0221bb95f81c` |
| Explicit perimeter | 19 pathspecs; 1,005 normalized bytes; SHA-256 `74bfdc46ebddddc7a4cafa12584e76f92faa6489feaf1078ac2772871182b390` |
| Selected-scope porcelain-v2 identity | 2 records; 385 normalized bytes; SHA-256 `d09d0ef72e64cc445a2b3e23a6c7082382e2a05df0bd106c6de90f47df183374` |
| Tracked implementation/configuration manifest | 541 records; 75,641 normalized bytes; SHA-256 `8b8c4e1d6dee18da4c5814725e69b42b2b8a002a5405b5fea7348ef8edd39a9a` |
| Dirty-identity manifest | 2 records; 594 normalized bytes; SHA-256 `4c1ac0e964882ab53898eaef176beefc252154ee13700588fb1a42ddc5488aac` |
| `packages` Git tree object | `9a1646f73dc4e75e6f1462c15e524e943e5b526a` |
| `apps` Git tree object | `673f7ae53d54a66ca6cc93f8a602413547c062ef` |
| Generated SvelteKit context | 1,010 bytes; SHA-256 `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4`; last write `2026-07-28T13:36:47.9541763Z` |
| Mutation journal | Absent |
| Running Bun processes | 0 |
| Pair equality | `TRUE` |

### 2.1 Dirty-path identities

| Subject-root-relative path | Status | Content bytes / SHA-256 | Normalized unstaged diff bytes / SHA-256 | Staged diff |
| --- | --- | --- | --- | --- |
| `apps/rph-demo/e2e/pwa-node-graph.e2e.ts` | Tracked, unstaged modified (`.M`) | 2,970 / `e301f438aea48ad7bfbeef717979fa83c566c3a3956c17c819abaf0ab8366fc8` | 817 / `9c64df496cc634a26d9037738a52ff63fa6d254e4e351b8fba937ca6e12f00a4` | Empty; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `apps/rph-demo/src/lib/PwuTypeCard.svelte` | Tracked, unstaged modified (`.M`) | 8,020 / `8b7487e3cc98d9e44543b259e098b46289e5ae1f9adda039dfe6404b51661704` | 2,237 / `c68cca158887275d0a19b86e311bb5273bdfb9e2f4b7612a5267cb9dd2588207` | Empty; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

---

## 3. Compatibility continuity

The only changed accepted-subject field between EVIDENCE-003 and this record is the parent commit. The later commit is outside the explicit implementation/configuration perimeter. The tracked-manifest, selected status, dirty content/diffs, generated context, and committed `packages`/`apps` tree identities are byte-identical to EVIDENCE-003.

The EVIDENCE-003 compatibility analysis therefore carries forward without expansion:

- the two dirty files add presentational/accessibility markup and one assertion inside an existing Playwright test;
- they add no import, dependency, command, graph edge, contract, schema, runtime entry point, configuration, or new test case;
- no recorded workspace, package, configuration, analyzer, coverage, runtime-trace, or semantic-capability count changes; and
- correctness, execution, approval, and behavior preservation remain unproved.

---

## 4. Current-use disposition

| Question | Result |
| --- | --- |
| Are OBS-029 and OBS-030 an internally stable matching pair? | `YES` |
| Is the dirty subject identified beyond the parent commit? | `YES` |
| Did the parent advance change a conclusion-bearing perimeter member? | `NO` |
| Does this record prove source correctness or behavior preservation? | `NO` |
| May the working Draft use this exact subject for current objective author verification? | `YES`, while every Section 2 identity remains unchanged |
| Does this record close the ledger, promote the Draft, or confer authority? | `NO` |

Any later change to branch, parent, perimeter, status, tracked manifest, dirty content/diff, staged diff, committed trees, generated-context bytes/time, mutation-journal state, or Bun-process quiescence invalidates this current-use disposition and requires another exact recheck.
