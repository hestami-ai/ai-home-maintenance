# JAN-CSAA-005 Current Subject Rebinding Record 003

**Evidence ID:** `JAN-CSAA-005-EVIDENCE-006`

**Evidence version:** `0.1.0`

**Status:** Complete author-side current-subject and authority-input rebinding evidence for the working Wave 1 Draft package; non-authoritative review input

**Accepted observation window:** `JAN-CSAA-005-REFRESH-OBS-033` began at `2026-07-28T19:02:17.284Z` and completed at `2026-07-28T19:02:18.106Z`; `JAN-CSAA-005-REFRESH-OBS-034` began at `2026-07-28T19:02:18.106Z` and completed at `2026-07-28T19:02:18.891Z`

**Authority and limitation:** Read-only observation under `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`. This record changes no application source, test, configuration, dependency, provider, oracle, canon artifact, register, staging area, or commit and confers no status or authority.

**Supersedes for current use:** [JAN-CSAA-005-EVIDENCE-005@0.1.0](<JAN-CSAA-005 - Current Subject Rebinding Record 002.md>), whose exact `JPWB-SPEC-001` authority-input identity changed after OBS-031/032. EVIDENCE-005 remains exact historical evidence and is not rewritten.

---

## 1. Rebinding cause and bounded effect

After EVIDENCE-005 and the successor objective-verification records were completed, the working-copy bytes of the excluded canon artifact `docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md` changed:

| Authority-state input | EVIDENCE-005 identity | Current OBS-033/034 identity |
| --- | --- | --- |
| `JPWB-SPEC-001 Professional Projection and Workbench Surface.md` | 768,371 bytes / `5b39982d9175bd7ebc0b06113469882e8572e8b396a540229c6d0fe0a137a8bf` | 1,136,158 bytes / `594a54bdcddb075e2e850ee86bdf2b4fcb513f555be5e246d6f344c27138244d` |

That change invalidated EVIDENCE-005 for current freshness even though the artifact remains outside the fixed 19-path implementation/configuration perimeter. The closure preflight rejected the stale identity before any archive, ledger, or closure-record write. No ledger transition occurred against the stale evidence.

The changed artifact is an existing user-owned working-copy change. This rebinding observed it without modifying, staging, committing, accepting, or rejecting its content.

No other accepted identity changed:

- branch and `HEAD` remain `main` and `5ba09db3b2b640aa2c74ac832bc444fbf6f3a035`;
- the 19-path perimeter, its two selected dirty files, their exact content and diff identities, the tracked manifest, package and lockfile, committed trees, generated context, mutation-journal state, and Bun-process quiescence remain byte-identical to EVIDENCE-005;
- the separate commissioning record remains 7,065 bytes with SHA-256 `578549db9b2503244ea36d70b4a670106a4c822d27638e487cb31d0bb39b6195`;
- the effective working register remains 120,174 bytes with SHA-256 `d9f4c0224c0f419e5bfe84e4989261b478fa7cbcce7759a819cc12398228e3a5`; and
- no main Wave 1 Draft, open ledger, objective-verification record, or cross-package reconciliation record changed.

---

## 2. Observation method

OBS-033 and OBS-034 each performed a full beginning-to-ending read using `read-only-method-v6-endpoint-corrected`:

1. record the observation start;
2. resolve branch and `HEAD`;
3. serialize the fixed 19 repository-root-relative pathspecs as an ordinal-sorted UTF-8/LF manifest with one terminal LF;
4. collect, ordinal-sort, normalize, and hash porcelain-v2 status and `git ls-files -s` records for that perimeter;
5. record exact content, normalized default-index unstaged diff, and normalized staged diff identities for both selected dirty paths;
6. record the generated SvelteKit context, root package and lockfile digests, committed `packages` and `apps` tree objects, mutation-journal state, and Bun-process count;
7. read and classify the exact SPEC-001, proposed commissioning-record, and effective-register authority inputs;
8. record the completion time only after every observation and classification completed; and
9. reject the pair unless both complete observations match in every conclusion-bearing field.

All non-empty text manifests use UTF-8 without BOM, LF only, ordinal ordering where applicable, and exactly one terminal LF. Empty diffs hash the zero-byte sequence.

The two accepted captures matched. The corrected completion timestamps bound the actual ends of the observations; they are not timestamps taken before the final Git, process, or authority-state checks.

---

## 3. Exact accepted implementation/configuration subject

| Field | Accepted value in OBS-033 and OBS-034 |
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

## 4. Exact authority-state inputs and conclusion

| Input | Current exact identity | Current classification |
| --- | --- | --- |
| `docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md` | 1,136,158 bytes / `594a54bdcddb075e2e850ee86bdf2b4fcb513f555be5e246d6f344c27138244d` | Declares `DRAFT`, `HYPOTHESIS`, and “not ratified”; not effective authority |
| `docs/canon/JPWB-SPEC-001 commissioning record (proposed REG-005 entry).md` | 7,065 bytes / `578549db9b2503244ea36d70b4a670106a4c822d27638e487cb31d0bb39b6195` | Declares `PROPOSED`, remains unnumbered, and expressly confers nothing |
| `docs/canon/JPWB-REG-005 Decision and Divergence Register.md` | 120,174 bytes / `d9f4c0224c0f419e5bfe84e4989261b478fa7cbcce7759a819cc12398228e3a5` | Contains no `JPWB-SPEC-001` entry |

The larger SPEC-001 working copy does not alter the Wave 1 obligation set because it still has no ratified or effective concern-owning status. Treating its content as an applicable canon source would improperly confer authority by author-side inference. This record therefore checks lifecycle and register state but does not import the Draft’s propositions into JAN-CSAA-001, JAN-CSAA-002, or JAN-CSAA-005.

An effective commission, ratification, or register entry naming `JPWB-SPEC-001` would be a distinct authority-state event. It would invalidate this conclusion and require concern-allocation review even if all implementation/configuration bytes remained unchanged.

---

## 5. Compatibility with existing objective evidence

The substantive verification target remains unchanged:

| Artifact | Current identity |
| --- | --- |
| `JAN-CSAA-001@0.3.0 / Draft` | 109,420 bytes / `cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b` |
| `JAN-CSAA-001-LEDGER-001@0.3.0 / OPEN` | 352,801 bytes / `55a476a2683ec65baa898b4b9425aecd3b6af17cd3c09aa2b8b59b3942e42e1a` |
| `JAN-CSAA-002@0.3.0 / Draft` | 162,179 bytes / `9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911` |
| `JAN-CSAA-002-LEDGER-001@0.3.0 / OPEN` | 250,049 bytes / `dd2a08970c927ddb26ef522c7fc405f7210da13e35e32405486da26009a52acc` |
| `JAN-CSAA-005@0.3.0 / Draft` | 119,118 bytes / `3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625` |
| `JAN-CSAA-005-LEDGER-001@0.3.0 / OPEN` | 459,849 bytes / `86940e63fc011ae58a460bb4f403d79763e8e8722edd5bfeeb75c6cb6597d3b4` |

The three successor objective-verification records and successor cross-package reconciliation remain exact, append-only historical proof of their stated checks. Their implementation/configuration subject is byte-identical to OBS-033/034. EVIDENCE-006 supplies only the new current freshness and unchanged-applicability conclusion required after the excluded Draft authority input changed; it does not retroactively rewrite those records or claim that they reviewed SPEC-001’s new content.

No objective method is converted into a pass by this rebinding. The already recorded current-phase method results remain usable only because:

1. every verified main and open-ledger preimage is exact;
2. every implementation/configuration identity relevant to those results is exact;
3. the changed file remains excluded from that perimeter; and
4. its lifecycle and register state still prevent it from becoming a mandatory concern-owning source.

---

## 6. Current-use disposition

| Question | Result |
| --- | --- |
| Are OBS-033 and OBS-034 complete, endpoint-corrected, matching observations? | `YES` |
| Is the current dirty implementation/configuration subject exactly identified? | `YES` |
| Did any conclusion-bearing implementation/configuration identity change from EVIDENCE-005? | `NO` |
| Did the changed SPEC-001 working copy become effective concern-owning authority? | `NO` |
| Did the stale-identity preflight mutate a ledger or create a closure record? | `NO` |
| May synchronized objective-ledger closure use EVIDENCE-006 with the exact existing verification records? | `YES`, while every identity and classification in this record remains unchanged |
| Does this record prove source correctness, behavior preservation, Proposed readiness, or authority? | `NO` |
| Does this record itself close a ledger, promote a Draft, or confer authority? | `NO` |

Any later change to branch, parent, perimeter, status, tracked manifest, dirty content or diff, staged diff, committed trees, root configuration identities, generated-context bytes or time, mutation-journal state, Bun-process quiescence, any exact authority-state input, or any lifecycle/register classification invalidates this current-use disposition and requires another exact recheck.
