# Headless SonarQube (SonarLint) — Analysis & Remediation Guide

A practical guide for agents to (1) get **IDE-identical SonarQube findings** for any file(s) **without a server, Docker, editor, or copy-paste**, and (2) remediate findings **safely at scale** with a verification discipline that has been proven on ~660 fixes across this codebase.

> **TL;DR.** Drive the already-installed SonarLint language server (`sonarlint-ls.jar`) yourself over LSP/stdio. Open a file → collect `publishDiagnostics` → same findings as the editor's Problems panel, scriptable. Then fix in **tiers** (mechanical → light → judgment → crown-jewels), and **gate every batch** with `tsc` + re-sonar + `test:unit` (+ adversarial review / golden snapshots for behavior-changing refactors).

---

## 1. Why this exists

- The SonarQube/SonarCloud **server** path was unavailable, and **SonarCloud scans failed**.
- The editor (here: **Devin**, a Windsurf/VS Code fork) has **SonarQube for IDE (SonarLint) installed**, but its findings are ephemeral — pushed to the Problems panel over LSP `publishDiagnostics`, not persisted anywhere queryable (the log records issue *counts*, not rule keys; the H2 DB is internal + locked).
- Claude Code running in this editor only receives `<ide_diagnostics>` for files **currently open in a tab** — useless for a bulk sweep.

**Solution (validated):** spawn the bundled `sonarlint-ls.jar` as a headless LSP server and drive it yourself. Same analyzer engine (`sonarjs.jar` for JS/TS + Node eslint-bridge) ⇒ **findings are byte-identical to the IDE Problems panel** (verified: reproduced exact column spans + found the full superset).

---

## 2. Prerequisites (machine-specific — find yours)

The driver needs paths to the installed extension's bundled JRE, LS jar, analyzers, and a Node binary. On the machine this was built on:

| Piece | Path (example) |
|---|---|
| Extension root (`EXT`) | `C:/Users/<you>/.devin/extensions/sonarsource.sonarlint-vscode-<ver>-win32-x64` |
| Java | `<EXT>/jre/<jdkver>/bin/java.exe` |
| LS jar | `<EXT>/server/sonarlint-ls.jar` |
| Analyzers | `<EXT>/analyzers/{sonarjs,sonarjava,sonarpython,sonarhtml,sonarxml,sonartext,sonariac,...}.jar` |
| eslint-bridge (JS/TS) | `<EXT>/eslint-bridge` |
| Node | `C:/Program Files/nodejs/node.exe` |

**To find them on another machine:** locate the editor's extensions dir (`~/.devin/extensions`, `~/.vscode/extensions`, `~/.windsurf/extensions`, …), then the `sonarsource.sonarlint-vscode-*` folder; the `jre/`, `server/`, `analyzers/`, `eslint-bridge/` subfolders are inside it. Update the constants at the top of the driver scripts (§7).

---

## 3. Quick start

The ready-made scripts live in **`janumicode_v2/.sonar-remediation/`** (gitignored — durable working dir, not committed). If absent, reconstruct from §6.

### One file (ad hoc) — prints findings as JSON to stdout
```bash
node driver.js <absFile> <absWorkspaceRoot> [timeoutMs]
# e.g.
node driver.js e:/…/src/lib/llm/providers/ollama.ts  e:/…/JanumiCode/janumicode_v2
```

### Many files (persistent session — far cheaper per file)
```bash
# filelist.txt = newline-separated ABSOLUTE paths
node batch-runner.js filelist.txt <absWorkspaceRoot> <outDir> [maxWaitMsPerFile]
# writes <outDir>/worklist.json (findings) + <outDir>/ledger.json (resume state)
```

> **Cold-start caveat:** every fresh invocation pays **~30–40 s of boot** — it starts the JVM + `sonarlint-ls.jar`, boots the Node eslint-bridge, and **builds the whole TypeScript "program"** (the entire `tsconfig` type graph) before analyzing even one file. Type-aware rules need that context, so you cannot skip the workspace root. For **one** file, ~90% of wall-clock is boot. For **many**, `batch-runner.js` keeps **one** LS session alive and streams the whole list through it, so boot is paid once and each subsequent file analyzes in ~2–4 s. (A 149-file sweep ≈ 10 min, not 149 × 40 s.)
>
> **Resumable:** `batch-runner.js` skips files already in `<outDir>/ledger.json`. To force a fresh sweep, use a **new** `outDir` (a stale ledger silently skips everything).
>
> **Exclude junk** for speed + less noise: `node_modules/`, `.vscode-test/`, `dist/`, and `test-and-evaluation/calibration-workspaces/` (they inflate the TS program).

### Output shape (`worklist.json`)
```jsonc
{
  "workspace": "…", "updatedAt": "…", "totalFiles": N, "analyzed": N,
  "totalFindings": N,
  "byRule": { "typescript:S3776": 216, "typescript:S6551": 89, … },
  "files": { "e:/…/foo.ts": [ { "rule": "typescript:S3776", "message": "Refactor this function to reduce its Cognitive Complexity from 32 to the 15 allowed", "line": 762, "col": 3, "severity": 2 }, … ] }
}
```
The S3776 message embeds the **actual complexity** (`from N to the 15 allowed`) — parse it to prioritize/stratify.

---

## 4. Remediation methodology (proven on ~660 fixes)

Fix in **tiers by risk**, not by rule-count. Escalate verification rigor with risk.

| Tier | Rules (examples) | Nature | Machinery |
|---|---|---|---|
| **A** mechanical, behavior-preserving-by-construction | S3358 nested-ternary, S7778 multi-push, S2871 sort-cmp, S7781 replaceAll, S1874 deprecated, S7772 `node:` prefix, S3863 merge-imports, S6551 object-stringify | local 1:1 rewrites | fan-out (1 agent/file) → `tsc` + re-sonar + `test:unit` |
| **B** regex-safety + security | S8786/S5843 ReDoS, S5869 char-class, S4036 unsafe-binary, S2245/S2819 | narrow patterns, some real | adversarial 2-stage review → fan-out fix → gate |
| **C** cognitive-complexity + judgment | **S3776**, S4624 nested-template, S6571 union, S107 params, S2004 nested-fn | **control-flow restructuring** | coverage-aware decomposition + characterize-if-uncovered → gate → **adversarial equivalence review** |
| **C-severe (crown jewels)** | S3776 ≥ ~50, esp. ≥200 | genuine decomposition of load-bearing code | **record-stream golden-snapshot** characterization FIRST → decompose → golden must match byte-for-byte (§5.3) |
| **D** test-only | S5906 test-assertion specificity | pure test-readability churn, no prod impact | optional; lowest priority |

### The core loop (per batch)
1. **Emit a batch** (files + their in-scope finding lines) from the tracker.
2. **Fan out fixes** — one edit-only agent per file (§4.1).
3. **GATE** (§4.2) — `tsc` → re-sonar the changed files → `test:unit` → (for control-flow changes) adversarial equivalence review.
4. **Fix residuals + introduced findings** the gate surfaces; re-gate.
5. **Stamp** the batch done in a resumable tracker.

### 4.1 Fix agents are **EDIT-ONLY** (hard rule)
Fix/characterization/review agents must **not run Bash / spawn processes / run tests**. Reason: during this work, two review agents that were told to "benchmark" ran `taskkill /F /IM node.exe` — killing **all** node processes on the machine. Give agents `Read`/`Edit`/`Grep` only; **all test/tsc/sonar execution happens centrally** (by you, the orchestrator), which is both safe and lets one clean run validate the whole batch. State the prohibition explicitly in every agent prompt.

### 4.2 The gate (this is what makes scale safe)
- **`tsc --noEmit`** — catches type breaks *and* syntax breaks (e.g. an agent writing `COMP-*/VV-*` inside a `/** … */` block comment — the `*/` closes the comment and detonates the file).
- **Re-sonar the changed files** and diff against the pre-batch baseline: confirm the targeted findings are **cleared** AND **no new findings were introduced** (decompositions routinely spawn S107/S7778/S6551/S2301 from helper extraction — fix those too, then re-check).
- **`test:unit`** — `pnpm test:unit`. Known-good baseline is **3 pre-existing env-only suite failures** (decompViewer ×2 "in-memory DB cannot be readonly"; cal40 fixture ENOENT). Any *other* failure is a real regression — investigate, don't wave it through.
- **Never mask a regression by editing the test.** If a test fails, prove whether it's the code or the test (see §5.4).

---

## 5. Behavior-preserving refactors (Tier C / crown jewels)

Cognitive-complexity fixes **restructure control flow**, so `tsc` + `test:unit` passing is **not** sufficient proof of behavior preservation — especially for thinly-tested code. Add these:

### 5.1 Danger checklist (every extraction)
Require each agent to verify + report: **shortCircuit** (no operand evaluated more/less/earlier), **evalOrder**, **elseEffects/earlyReturn** (a guard-clause must not skip an else/trailing/cleanup that ran before), **returnValue** (identical value/type/shape on every path), **closure/`this`** (extracted helpers still read/mutate the same vars; no lost write-back — thread state via a params object **by reference**), **throwTiming** (same throw points; try/finally intact), **loopSemantics** (`continue`→`return` mapping is sound), **asyncAwait** (no added/removed parallelism), **mutationAliasing**.

### 5.2 Adversarial equivalence review
After a control-flow batch, run a **second, independent** agent per changed file that gets the **unified diff INLINE** and tries hard to **refute** equivalence across the danger classes. It is **Bash-forbidden** (all info is in the prompt; no reason to execute). This caught a real divergence in Tier C (a `parseVitestJson` refactor that narrowed a `try/catch`, turning graceful text-fallback into a phase-crashing throw on malformed reporter JSON).

### 5.3 Record-stream **golden snapshot** — the gold standard for large/untested functions
For a big, thinly-tested, load-bearing function (e.g. the 216–257-complexity saturation loops), characterize with a **golden snapshot captured from the *current* code before touching it**:

1. **Author** a test that drives the function through a **multi-branch scenario** (hermetic: `MockLLMProvider` + `createTestDatabase` + `setAutoApproveDecisions(true)`), then collects **everything it persists** — every `engine.writer.getRecordsByType(runId, <type>, false)` plus the relevant `workflow_runs` telemetry columns.
2. **Normalize** out all non-determinism: strip record `id`/`produced_at`/`workflow_run_id`/`janumicode_version_sha`/`derived_from_record_ids`; **remap** UUID `node_id`/`parent_node_id` to their deterministic `display_key`; drop timestamps and embedding-cosine floats; sort by a stable composite key.
3. Assert **`expect(normalized).toMatchSnapshot()`** — **do NOT hand-write expected values.** vitest captures the golden from the *actual* current behavior on first run. (This eliminates the #1 failure mode: edit-only agents guessing wrong expected values.)
4. **Run once on current code** → `Snapshots N written` (golden pinned).
5. **Decompose** the function (thread a single mutable run-state object by reference through per-pass / per-node / gate / finalize helpers).
6. **Re-run** → the snapshot must match **byte-for-byte**. A diff pinpoints the exact divergence. This proved all 5 saturation-loop monsters (cx 216–257 → ~1) behavior-preserving.

### 5.4 Is the failure the code or the test? (recurring)
Edit-only agents frequently write **wrong characterization tests** (they can't run them). Before "fixing" code, verify:
- **New (untracked) test?** `git diff HEAD` **hides untracked files** — a golden that fails on HEAD too is a bad *test*, not a regression. Confirm with `git ls-files --error-unmatch <test>`.
- **Restore-and-compare:** copy your changed source aside, `git checkout HEAD -- <source>`, run the test; if it still fails → the test's expectation is wrong (fix the test), not the code.
- Real examples caught this way: float `expect(x).toBe(0.6)` (actual `0.6000000000000001` → use `.toBeCloseTo`); an assertion assuming a field is `null` when the factory sets it; asserting `node_id` where the value is `task.id` (`story_id`).

---

## 6. Reconstructing the driver (self-contained mechanics)

If `.sonar-remediation/` is missing, a Node LSP client over `sonarlint-ls.jar` (stdio) is ~150 lines. Essentials:

**Launch:**
```
<EXT>/jre/…/bin/java.exe -jar <EXT>/server/sonarlint-ls.jar -stdio -analyzers <all analyzer jars>
```

**`initialize` params:** `processId`, `rootUri`, `workspaceFolders`, capabilities `{workspace:{configuration:true,workspaceFolders:true}, textDocument:{publishDiagnostics:{}}}`, and `initializationOptions`:
```jsonc
{
  "productKey": "vscode", "productName": "SonarLint VSCode", "productVersion": "…",
  "clientNodePath": "C:/Program Files/nodejs/node.exe",
  "eslintBridgeServerPath": "<EXT>/eslint-bridge",
  "connections": { "sonarqube": [], "sonarcloud": [] },   // standalone mode
  "rules": {}, "showVerboseLogs": true, "telemetryStorage": "…"
}
```
Then send `initialized`.

**Respond permissively to every server→client request** (else it blocks):
| Request | Reply |
|---|---|
| `workspace/configuration` | `items.map(() => ({}))` |
| `sonarlint/shouldAnalyseFile` | `{ shouldBeAnalysed: true }` |
| `sonarlint/isOpenInEditor` | `true` |
| `sonarlint/isIgnoredByScm` | `false` |
| `sonarlint/filterOutExcludedFiles` | `{ fileUris }` (echo input) |
| `sonarlint/listFilesInFolder` | `{ foundFiles: [] }` |
| `sonarlint/getJavaConfig` | `null` |
| anything else | `null` |

**Trigger analysis:** `textDocument/didOpen` with the file text and `languageId: "typescript"`. **Collect** findings from `textDocument/publishDiagnostics` for that uri. Use a **settle timer** (record after ~1.2–2.5 s of quiet, or when a `window/logMessage` "Analysis detected N issues" arrives). `textDocument/didClose` after recording to bound memory. Map each diagnostic: `rule = code.value`, `message`, `line = range.start.line + 1`, `col = range.start.character + 1`, `severity`.

---

## 7. Tooling reference (`janumicode_v2/.sonar-remediation/`, gitignored)

| File | Purpose |
|---|---|
| `driver.js` | single-file analysis → stdout |
| `batch-runner.js` | persistent-session sweep → `worklist.json` + resumable `ledger.json` |
| `setup.js` / `tierc-setup.js` | build a banded, resumable **tracker** from a worklist |
| `tierc-next-band.js` / `tierc-apply-band.js` | emit a band's file batch / stamp files done |
| `make-run.js` | inline a JSON batch into a Workflow template → run via `scriptPath` (avoids giant tool-call args). **Uses a replacement *function*** — `String.replace(re, str)` interprets `$1`/`$'`/`$&` in diffs and corrupts them; also escapes U+2028/U+2029 (valid in JSON, line-terminators in JS). |
| `build-diff-batch.js` | build per-file `git diff` batches for the equivalence reviewer |
| `tierc-c{1,2,3,4a}-fix.workflow.js`, `tierc-introduced-fix.workflow.js` | fan-out fixers (rule-specific guidance, edit-only) |
| `tierc-equivalence-review.workflow.js` | adversarial behavior-equivalence verifier (Bash-forbidden, diff inline) |
| `tierc-monster-chartest / -decompose.workflow.js` | golden-snapshot char-test authoring + decomposition for crown jewels |
| `tierc-tracker.json`, `tierc-accepted-skips.json`, `REMEDIATION-SUMMARY.md`, `RESUME-*.md` | state, principled won't-fixes, writeup, resume pointers |

**Workflow batching pattern (Tier C):** `next-band` → `make-run` (inline batch into a fix workflow) → `Workflow(scriptPath)` → central gate → `apply-band` stamp. Split large diff batches to **≤ ~430 KB** per Workflow script (512 KB hard limit).

---

## 8. Pitfalls & lessons (learned the hard way)

- **Cold start dominates single-file runs** — batch when you can.
- **Stale `ledger.json`** silently skips files — fresh `outDir` for a true re-sweep.
- **SonarLint doesn't follow TS narrowing** for S6551/S8786: `String(x)` after a `typeof x==='object'` check still flags. Fix by **casting the `String()` arg to a non-object type** (`as string | number | boolean`) — which *preserves* the original coercion — **not** by switching to `JSON.stringify` (that changes output for objects and **throws on bigint**). Behavior-preservation beats "cleaner."
- **`KnownLiterals | string` unions:** collapsing to `string` loses documented literals *and* can spawn S6564. Use the **`'a' | 'b' | (string & {})`** idiom (clears S6571, keeps literals + autocomplete) — *unless* the type is used as an open `Record<T, …>` key or the field is genuinely free-form text, where plain `string` is correct.
- **Decompositions introduce new findings** — always re-sonar after fixing; expect S107 (bundle params into a ctx object), S7778 (build arrays in one expression / merge pushes), S2301 (split a boolean-flag param into two functions or fold the flag into state).
- **`*/` inside a block comment** ends the comment → build break. Write `* /` or reword.
- **Edit-only char-tests are often wrong** — see §5.4. The central `test:unit` gate is what catches them; treat a first-run char-test failure as "diagnose test vs code," not "the refactor broke."
- **Don't over-fix.** Some findings are principled won't-fixes: wide-blast-radius `S107` (param-object refactor with a `Parameters<…>[N]` positional type ref + many call sites) → defer to a dedicated human-reviewed change; test-formatter S7778; intentional `KnownLiterals | string` widenings. Record the rationale in `accepted-skips.json`.

---

## 9. Results this methodology produced (as of 2026-07-10)

Phase-1 mechanical (539) + correctness review (1 real bug: S1764 loop-detector) + Tier A S6551 (61) + Tier B regex/security (53) + **Tier C cognitive-complexity/judgment (355 → 2 residual)**. All in-scope S3776/S4624/S6571/S2004 cleared; the 5 saturation-loop monsters (cx 216–257) decomposed and **golden-verified byte-for-byte behavior-preserving**. `tsc` clean; `test:unit` 3224 pass (only the 3 pre-existing env failures). ~43 new characterization tests added as durable coverage. Full writeup: `.sonar-remediation/REMEDIATION-SUMMARY.md`.
