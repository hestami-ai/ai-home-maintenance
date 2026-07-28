# JAN-CSAA-005 Current Subject Rebinding Record 004

**Evidence ID:** `JAN-CSAA-005-EVIDENCE-007`

**Evidence version:** `0.1.0`

**Status:** Complete author-side current-subject and authority-input rebinding evidence for the working Wave 1 Draft package; non-authoritative review input

**Accepted observation window:** `JAN-CSAA-005-REFRESH-OBS-035` began at `2026-07-28T19:20:38.576Z` and completed at `2026-07-28T19:20:39.472Z`; `JAN-CSAA-005-REFRESH-OBS-036` began at `2026-07-28T19:20:39.472Z` and completed at `2026-07-28T19:20:40.359Z`

**Authority and limitation:** Read-only observation under `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`. This record changes no application source, test, configuration, dependency, provider, oracle, canon artifact, register, staging area, or commit and confers no status or authority.

**Supersedes for current use:** [JAN-CSAA-005-EVIDENCE-006@0.1.0](<JAN-CSAA-005 - Current Subject Rebinding Record 003.md>), whose exact parent-commit and SPEC-001 authority-input identities were invalidated by commit `49b69fb7b78efa180fa19f3f2f24b8de749c3857`. EVIDENCE-006 remains exact historical evidence and is not rewritten.

---

## 1. Rebinding cause and bounded effect

After EVIDENCE-006 and before synchronized ledger closure, repository `HEAD` advanced from `5ba09db3b2b640aa2c74ac832bc444fbf6f3a035` to its direct child `49b69fb7b78efa180fa19f3f2f24b8de749c3857`.

The commit changed exactly one file:

| Commit-relative change | Current bytes | Current SHA-256 |
| --- | ---: | --- |
| `JanumiCode/janumiprofessionalworkbench/docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md` | 1,145,520 | `889a56679cac7f4a884e88103f9316be52ad7e34c9422ed8c7940288db9709f5` |

The commit is identified as:

- parent `5ba09db3b2b640aa2c74ac832bc444fbf6f3a035`;
- author and commit time `2026-07-28T15:18:24-04:00`;
- subject “All 27 SPEC-001 forks ruled under delegated authority — and one was resting on a false claim about the engine”; and
- one changed path under `docs/canon/**`, outside the fixed 19-path implementation/configuration perimeter.

The closure preflight rejected the stale EVIDENCE-006 parent before any pre-closure archive, ledger, or closure-record write. No ledger transition occurred against the stale evidence.

No conclusion-bearing implementation/configuration identity changed. The commit changed no `apps/**`, `packages/**`, root package/lockfile, selected dirty path, generated context, mutation journal, or running-process state.

---

## 2. Observation method

OBS-035 and OBS-036 each performed the full `read-only-method-v6-endpoint-corrected` capture:

1. record the observation start;
2. resolve branch and `HEAD`;
3. serialize the fixed 19 repository-root-relative pathspecs as an ordinal-sorted UTF-8/LF manifest with one terminal LF;
4. collect, ordinal-sort, normalize, and hash porcelain-v2 status and `git ls-files -s` records for that perimeter;
5. record exact content, normalized default-index unstaged diff, and normalized staged diff identities for both selected dirty paths;
6. record generated SvelteKit context, root package and lockfile digests, committed `packages` and `apps` tree objects, mutation-journal state, and Bun-process count;
7. read and classify the exact SPEC-001, proposed commissioning-record, and effective-register authority inputs;
8. record completion only after every observation and classification completed; and
9. reject the pair unless both complete observations match in every conclusion-bearing field.

All non-empty text manifests use UTF-8 without BOM, LF only, ordinal ordering where applicable, and exactly one terminal LF. Empty diffs hash the zero-byte sequence.

The two accepted captures matched exactly.

---

## 3. Exact accepted implementation/configuration subject

| Field | Accepted value in OBS-035 and OBS-036 |
| --- | --- |
| Repository root | `E:/Projects/hestami-ai` |
| Subject root | `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| Branch | `main` |
| Parent commit | `49b69fb7b78efa180fa19f3f2f24b8de749c3857` |
| Explicit perimeter | 19 pathspecs; 1,005 normalized bytes; SHA-256 `74bfdc46ebddddc7a4cafa12584e76f92faa6489feaf1078ac2772871182b390` |
| Selected-scope porcelain-v2 identity | 2 records; 385 normalized bytes; SHA-256 `d09d0ef72e64cc445a2b3e23a6c7082382e2a05df0bd106c6de90f47df183374` |
| Tracked implementation/configuration manifest | 541 records; 75,641 normalized bytes; SHA-256 `8b8c4e1d6dee18da4c5814725e69b42b2b8a002a5405b5fea7348ef8edd39a9a` |
| Dirty-identity manifest | 2 records; 594 normalized bytes; SHA-256 `4c1ac0e964882ab53898eaef176beefc252154ee13700588fb1a42ddc5488aac` |
| Root `package.json` | SHA-256 `ce83e2619fbbcc2bc82b95b0294b96336d7d264005c821c48551dcc8cee01ad0` |
| Root `bun.lock` | SHA-256 `9d4f7ecec8363ae4111538aa489383b3bcb4b5935afc5d93f78bf53b60229358` |
| `packages` Git tree object | `9a1646f73dc4e75e6f1462c15e524e943e5b526a` |
| `apps` Git tree object | `673f7ae53d54a66ca6cc93f8a602413547c062ef` |
| Generated SvelteKit context | 1,010 bytes; SHA-256 `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4`; mtime ns `1785245807954176300` (`2026-07-28T13:36:47.9541763Z`) |
| Mutation journal | `scripts/mutants/.in-flight` absent |
| Running Bun processes | 0 |
| Internal stability | `TRUE` in each observation |
| Pair equality | `TRUE` |

### 3.1 Dirty-path identities

| Subject-root-relative path | Status | Content bytes / SHA-256 | Normalized unstaged diff bytes / SHA-256 | Staged diff |
| --- | --- | --- | --- | --- |
| `apps/rph-demo/e2e/pwa-node-graph.e2e.ts` | Tracked, unstaged modified (`.M`) | 2,970 / `e301f438aea48ad7bfbeef717979fa83c566c3a3956c17c819abaf0ab8366fc8` | 817 / `9c64df496cc634a26d9037738a52ff63fa6d254e4e351b8fba937ca6e12f00a4` | Empty; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `apps/rph-demo/src/lib/PwuTypeCard.svelte` | Tracked, unstaged modified (`.M`) | 8,020 / `8b7487e3cc98d9e44543b259e098b46289e5ae1f9adda039dfe6404b51661704` | 2,237 / `c68cca158887275d0a19b86e311bb5273bdfb9e2f4b7612a5267cb9dd2588207` | Empty; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

---

## 4. Authority-state review of the new commit

| Input | Current exact identity | Current classification |
| --- | --- | --- |
| `docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md` | 1,145,520 bytes / `889a56679cac7f4a884e88103f9316be52ad7e34c9422ed8c7940288db9709f5` | Status block still declares `DRAFT`, `HYPOTHESIS`, and “not ratified” |
| `docs/canon/JPWB-SPEC-001 commissioning record (proposed REG-005 entry).md` | 7,065 bytes / `578549db9b2503244ea36d70b4a670106a4c822d27638e487cb31d0bb39b6195` | Still `PROPOSED`, unnumbered, and expressly non-conferring |
| `docs/canon/JPWB-REG-005 Decision and Divergence Register.md` | 120,174 bytes / `d9f4c0224c0f419e5bfe84e4989261b478fa7cbcce7759a819cc12398228e3a5` | Contains no `JPWB-SPEC-001` entry |

The new commit is an authority-state event requiring review rather than mechanical dismissal. Its message and new SPEC content describe 27 fork dispositions as “RULED UNDER DELEGATED AUTHORITY.” The same commit message expressly states: “These rulings confer no status on SPEC-001 itself. Ratification remains a separate act.” The controlled status block, separate proposed commission, and effective register are consistent with that boundary.

For this JAN-CSAA closure, the event does not change the applicable obligation set:

1. `JPWB-SPEC-001` remains an unratified Draft/HYPOTHESIS artifact and therefore is not imported wholesale as a concern-owning canon source.
2. The commit changes only the projection/workbench-surface specification; it changes no implementation/configuration member in the exact JAN-CSAA-005 subject.
3. No register entry confers an effective SPEC-001 status or amends the effective JAN-CSAA standing commission.
4. Nothing in this conclusion approves, rejects, or independently verifies the 27 fork rulings. It classifies only their effect on the bounded Wave 1 objective-ledger closure.

An effective SPEC-001 ratification, a register entry giving its dispositions cross-corpus effect, or a later identified direct conflict with an applicable JAN-CSAA obligation would invalidate this conclusion and require concern-allocation review.

---

## 5. Compatibility with existing objective evidence

The six substantive verification targets remain exact:

| Artifact | Current identity |
| --- | --- |
| `JAN-CSAA-001@0.3.0 / Draft` | 109,420 bytes / `cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b` |
| `JAN-CSAA-001-LEDGER-001@0.3.0 / OPEN` | 352,801 bytes / `55a476a2683ec65baa898b4b9425aecd3b6af17cd3c09aa2b8b59b3942e42e1a` |
| `JAN-CSAA-002@0.3.0 / Draft` | 162,179 bytes / `9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911` |
| `JAN-CSAA-002-LEDGER-001@0.3.0 / OPEN` | 250,049 bytes / `dd2a08970c927ddb26ef522c7fc405f7210da13e35e32405486da26009a52acc` |
| `JAN-CSAA-005@0.3.0 / Draft` | 119,118 bytes / `3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625` |
| `JAN-CSAA-005-LEDGER-001@0.3.0 / OPEN` | 459,849 bytes / `86940e63fc011ae58a460bb4f403d79763e8e8722edd5bfeeb75c6cb6597d3b4` |

The successor objective-verification records and cross-package reconciliation remain exact historical proof of their stated checks. Their implementation/configuration subject is byte-identical to OBS-035/036. EVIDENCE-007 supplies the new current parent, authority-input identity, and bounded unchanged-applicability conclusion; it does not rewrite those records or claim review of the new SPEC content.

No objective method becomes a pass because of this rebinding. Existing current-phase results remain usable only while the exact six target identities, implementation/configuration subject, and authority classification above remain unchanged.

---

## 6. Current-use disposition

| Question | Result |
| --- | --- |
| Are OBS-035 and OBS-036 complete, endpoint-corrected, matching observations? | `YES` |
| Is the current dirty implementation/configuration subject exactly identified? | `YES` |
| Did commit `49b69fb7…` change a conclusion-bearing implementation/configuration member? | `NO` |
| Did the commit ratify SPEC-001 or create a register entry for it? | `NO` |
| Were the delegated fork rulings reviewed for their effect on this bounded JAN-CSAA closure? | `YES` |
| Did that review find an applicable-obligation change for this closure? | `NO` |
| Did the stale-parent preflight mutate an archive, ledger, or closure record? | `NO` |
| May synchronized objective-ledger closure use EVIDENCE-007 with the exact existing verification records? | `YES`, while every identity and classification in this record remains unchanged |
| Does this record prove source correctness, behavior preservation, SPEC-001 correctness, Proposed readiness, or authority? | `NO` |
| Does this record itself close a ledger, promote a Draft, or confer authority? | `NO` |

Any later change to branch, parent, perimeter, status, tracked manifest, dirty content or diff, staged diff, committed trees, root configuration identities, generated-context bytes or time, mutation-journal state, Bun-process quiescence, any exact authority-state input, or any lifecycle/register classification invalidates this current-use disposition and requires another exact recheck.
