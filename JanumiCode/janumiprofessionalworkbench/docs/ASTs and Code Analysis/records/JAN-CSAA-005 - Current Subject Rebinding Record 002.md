# JAN-CSAA-005 Current Subject Rebinding Record 002

**Evidence ID:** `JAN-CSAA-005-EVIDENCE-005`

**Evidence version:** `0.1.0`

**Status:** Complete author-side current-subject rebinding evidence for the working Wave 1 Draft package; non-authoritative review input

**Accepted observation window:** `JAN-CSAA-005-REFRESH-OBS-031` began at `2026-07-28T14:14:56.3890906-04:00` and completed at `2026-07-28T14:14:57.5754275-04:00`; `JAN-CSAA-005-REFRESH-OBS-032` began at `2026-07-28T14:14:57.5897416-04:00` and completed at `2026-07-28T14:14:58.6174189-04:00`

**Authority and limitation:** Read-only observation under `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`. This record changes no application source, test, configuration, dependency, provider, oracle, register, or repository state and confers no status or authority.

**Supersedes for current use:** [JAN-CSAA-005-EVIDENCE-004@0.1.0](<JAN-CSAA-005 - Current Subject Rebinding Record.md>), whose OBS-029/030 parent-commit identity was invalidated by a later documentation-only commit. EVIDENCE-004 remains exact historical evidence and is not rewritten.

---

## 1. Rebinding cause and bounded effect

After OBS-029/030 and objective author verification, repository `HEAD` advanced from `0e7893f5fd343e3d74ca7dc73bad0221bb95f81c` to its direct child `5ba09db3b2b640aa2c74ac832bc444fbf6f3a035`. The commit added exactly two files:

| Added repository-root-relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `JanumiCode/janumiprofessionalworkbench/docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md` | 768,371 | `5b39982d9175bd7ebc0b06113469882e8572e8b396a540229c6d0fe0a137a8bf` |
| `JanumiCode/janumiprofessionalworkbench/docs/canon/JPWB-SPEC-001 commissioning record (proposed REG-005 entry).md` | 7,065 | `578549db9b2503244ea36d70b4a670106a4c822d27638e487cb31d0bb39b6195` |

No existing file changed in that commit. Both additions are under `docs/**`, which is outside the 19-path implementation/configuration perimeter. The commit therefore triggered the explicit parent-commit invalidation predicate while leaving every conclusion-bearing implementation/configuration identity unchanged.

The authority-state check also found no new effective authority:

- `JPWB-SPEC-001@0.1.0` declares `DRAFT`, `HYPOTHESIS`, and “not ratified”;
- its separate commissioning record declares itself `PROPOSED`, unnumbered, awaiting sponsor merge, and expressly says it confers nothing; and
- the working `JPWB-REG-005` contains no entry for `JPWB-SPEC-001`.

This is a current-authoring compatibility conclusion only. A later effective commission, ratification, or register entry for `JPWB-SPEC-001` would be a new authority-state event and would require concern-allocation review.

---

## 2. Observation method and rejected preliminary capture

OBS-031 and OBS-032 each performed two beginning-to-ending reads using `read-only-method-v5-normalized-dirty-diff`:

1. resolve branch and `HEAD`;
2. serialize the fixed 19 repository-root-relative pathspecs as an ordinal-sorted UTF-8/LF manifest with one terminal LF;
3. collect, ordinal-sort, normalize, and hash porcelain-v2 status and `git ls-files -s` records for that perimeter;
4. record exact content, normalized default-index unstaged diff, and normalized staged diff identities for both selected dirty paths;
5. record the generated SvelteKit context, root package and lockfile digests, committed `packages` and `apps` tree objects, mutation-journal state, and Bun-process count;
6. repeat every identity within the observation; and
7. reject the observation unless its beginning and ending identities match.

All non-empty text manifests use UTF-8 without BOM, LF only, ordinal ordering where applicable, and exactly one terminal LF. Empty diffs hash the zero-byte sequence.

An earlier preliminary pair labeled `OBS-CLOSURE-001` and `OBS-CLOSURE-002` is rejected. Its PowerShell dirty-path array expression collapsed two intended paths into one invalid joined string, emitted file-read errors, and incorrectly returned an empty dirty array. It supplies no accepted identity, no freshness conclusion, and no authority. OBS-031/032 corrected the path construction with two explicit array members and reproduced the established EVIDENCE-004 dirty manifest exactly.

---

## 3. Exact accepted subject

Both observations were internally stable and matched one another in every field:

| Field | Accepted value in OBS-031 and OBS-032 |
| --- | --- |
| Repository root | `E:/Projects/hestami-ai` |
| Subject root | `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| Branch | `main` |
| Parent commit | `5ba09db3b2b640aa2c74ac832bc444fbf6f3a035` |
| Explicit perimeter | 19 pathspecs; 1,005 normalized bytes; SHA-256 `74bfdc46ebddddc7a4cafa12584e76f92faa6489feaf1078ac2772871182b390` |
| Selected-scope porcelain-v2 identity | 2 records; 385 normalized bytes; SHA-256 `d09d0ef72e64cc445a2b3e23a6c7082382e2a05df0bd106c6de90f47df183374` |
| Tracked implementation/configuration manifest | 541 records; 75,641 normalized bytes; SHA-256 `8b8c4e1d6dee18da4c5814725e69b42b2b8a002a5405b5fea7348ef8edd39a9a` |
| Dirty-identity manifest | 2 records; 594 normalized bytes; SHA-256 `4c1ac0e964882ab53898eaef176beefc252154ee13700588fb1a42ddc5488aac` |
| Root `package.json` | SHA-256 `ce83e2619fbbcc2bc82b95b0294b96336d7d264005c821c48551dcc8cee01ad0` |
| Root `bun.lock` | SHA-256 `9d4f7ecec8363ae4111538aa489383b3bcb4b5935afc5d93f78bf53b60229358` |
| `packages` Git tree object | `9a1646f73dc4e75e6f1462c15e524e943e5b526a` |
| `apps` Git tree object | `673f7ae53d54a66ca6cc93f8a602413547c062ef` |
| Generated SvelteKit context | 1,010 bytes; SHA-256 `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4`; last write `2026-07-28T13:36:47.9541763Z` |
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

## 4. Compatibility continuity

The only changed accepted-subject field between EVIDENCE-004 and this record is the parent commit. The later commit is outside the explicit implementation/configuration perimeter. The perimeter manifest, selected status, dirty content and diffs, generated context, root configuration digests, committed `packages` and `apps` trees, mutation-journal state, and Bun-process quiescence are byte-identical to EVIDENCE-004.

The EVIDENCE-003/004 compatibility analysis therefore carries forward without expansion:

- the two selected dirty files add presentational/accessibility markup and one assertion inside an existing Playwright test;
- they add no import, dependency, command, graph edge, contract, schema, runtime entry point, configuration, or new test case;
- the later commit adds no implementation/configuration-perimeter member and changes no effective authority;
- no recorded workspace, package, configuration, analyzer, coverage, runtime-trace, or semantic-capability count changes; and
- correctness, execution, approval, and behavior preservation remain unproved.

The objective verification and cross-package reconciliation records bound to EVIDENCE-004 remain exact historical evidence. Their current closure-support conclusions require append-only successor revalidation against this evidence before any ledger transition.

---

## 5. Current-use disposition

| Question | Result |
| --- | --- |
| Are OBS-031 and OBS-032 internally stable matching observations? | `YES` |
| Is the dirty subject identified beyond the parent commit? | `YES` |
| Did the parent advance change a conclusion-bearing perimeter member? | `NO` |
| Did the parent advance create effective authority applicable to the Wave 1 package? | `NO` |
| Does this record prove source correctness or behavior preservation? | `NO` |
| May append-only objective revalidation use this exact subject? | `YES`, while every §3 identity remains unchanged |
| Does this record itself close a ledger, promote a Draft, or confer authority? | `NO` |

Any later change to branch, parent, perimeter, status, tracked manifest, dirty content or diff, staged diff, committed trees, root configuration identities, generated-context bytes or time, mutation-journal state, Bun-process quiescence, or effective concern-owning authority invalidates this current-use disposition and requires another exact recheck.
