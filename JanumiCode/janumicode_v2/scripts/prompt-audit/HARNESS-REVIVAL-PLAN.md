# Virtuous-Cycle GPU Harness — Revival Plan (Track 2)

## ⚠ PIVOT (2026-07-02) — V&V moved to the CALIBRATION CLI, not the VS Code harness
The virtuousCycle harness runs inside the VS Code extension host, which has an **unbounded-memory flaw in the governed-stream VISUALIZATION** (the webview eventBus retains every record). On a long real-model run the ext host goes unresponsive and exits (~4.5h in at P4 on the ornith run bn8ltlz7w — 1236 records; NOT a logic/model failure). Per operator: **do not chase the VS Code memory issue** (it's a visualization implementation flaw to deal with separately) and **use the calibration-run setup for current + future V&V** instead. The calibration path (`scripts/init-calibration-run.sh -m <model> -s <spec>` → `wave6-calibration-run.js` → headless `dist/cli/janumicode.js run --llm-mode real --auto-approve`) has **no webview**, so it's memory-stable (cal-29 proved it completes long runs), persists to `<workspace>/.janumicode/governed_stream.db`, and is model-agnostic. **Active V&V run: cal-30** (ornith:35b, trimmed intent, lean env: JANUMICODE_REVIEW_ENABLED=false + INGESTION_STAGE3_OFF=1 + RELEASE_MANIFEST_ADVISORY=1). Everything below about the harness stays as reference for the fixes already made (config-path, lean profile, phaseContracts, manifest-advisory, ornith wiring — all apply to the CLI path too since they're in shared code/config), but the harness itself is no longer the V&V vehicle.

Revive `src/test/e2e/harness-suite/virtuousCycle.harness.test.ts` (`pnpm harness:e2e`, real Ollama P0→P10) so it validates prompt-builder fixes end-to-end on **gemma4:31b-it-qat @ num_ctx 131072**. Status legend: `[ ]` open · `[x]` done.

## LIVE-RUN STATUS — 2026-07-01 (harness REVIVED, run 09c28e81 live)
The harness is running and correctly routed. Three operational discoveries (not obvious from code):
1. **Config path = globalStorage, NOT test-workspace.** `extension.ts:100` resolves `workspacePath = workspaceFolders?.[0] ?? globalStorageUri`. Under `pnpm harness:e2e`, `vscode.workspace.workspaceFolders` is **empty**, so ConfigManager reads `<.vscode-test>/user-data/User/globalStorage/hestami-ai.janumicode/.janumicode/config.json`. The test-workspace config.json is IGNORED. **This is why the harness was dead**: default orchestrator = `gemini_cli` → bootstrap validation fails at step 9/14. Fix: copy config.json to the globalStorage `.janumicode/` path (done). Bootstrap now passes 14/14.
2. **Lean profile is mandatory for local models.** With review+ingestion ON, P1 ran 266 invocations (221 `harness` reasoning_review on gemma4:e4b + 24 ingestion) for only ~20 CORE calls → ~2h/phase (each validator forces a gemma4:31b↔e4b ~19GB model swap; no keep-alive). Set `JANUMICODE_REVIEW_ENABLED=false` + `JANUMICODE_INGESTION_STAGE3_OFF=1` (mirrors run-harness.sh:117-118; now pass-through knobs in .vscode-test.harness.mjs). Neither affects CORE prompt materialization. Lean P1 = ~20 core calls, no swaps.
3. **Ext-host detaches from the launcher.** TaskStop/killing `pnpm harness:e2e` does NOT stop the spawned VS Code — it detaches and keeps driving phases on the GPU. Must tree-kill the `Code.exe` processes under `.vscode-test\vscode-win32-x64-archive-*\` (all such are the harness's isolated VS Code, never the user's IDE — filter by CommandLine `\.vscode-test`). Clean `<globalStorage>/.janumicode/governed_stream.db*` between runs.
4. **P1.8 release-manifest gate is fragile on gemma variance.** `release_exact_coverage_journeys` (and sibling `release_exact_coverage_*`) require the LLM release plan to place EVERY journey/workflow/entity in exactly one release; a dense model @ temp=1.0 omits some stochastically → HARD FAIL, no retry, no auto-fix (only `release_backward_dependency` auto-fixes). One trimmed run passed P1.8, the next failed with identical intent — pure variance. **Unblock:** new opt-in `JANUMICODE_RELEASE_MANIFEST_ADVISORY=1` (phase1.ts ~1824 + .vscode-test.harness.mjs pass-through) downgrades P1.8 blocking manifest gaps to advisory (logged + persisted, run proceeds). Default OFF → production unchanged. **Candidate real fix (deferred, out of audit scope):** a deterministic coverage auto-fix that appends uncovered journeys to a release + re-verifies, mirroring `autoFixBackwardDependencies` — "orchestrator owns the deterministic coverage axis, LLM owns placement judgment."

5. **OLLAMA TRANSPORT BUG (found, deferred behind the model swap).** gemma4:31b P2.2c failure root-caused (sub-agent) to `ollama.ts` `res.on('end')` resolving a stream that ended WITHOUT a `done:true` frame as a successful EMPTY response (`text=''`, `tokens=null`) — a silent truncation (tail variant of the gemma4:31b frame-loss family; head variant fixed in b003375). NFR-001 (first/coldest enrichment call) truncated → empty threshold → 2.2c `nfr_threshold_presence` blocking gap → P2 hard-fail. Layer-2c thinking-channel recovery fired + correctly declined (truncated thinking is unrecoverable). **Real fix (deferred):** in `res.on('end')` track `sawDone`; if `!sawDone` with no response, `reject` a RETRYABLE truncation error so the transport retry re-generates warm (+ a deterministic nfr-enrichment backstop seeding threshold/measurement from `seed_threshold`+VV `measurement`, both already in the prompt). NOT the prompt — NFR-001's prompt was well-formed and fully quantifiable.

6. **MODEL BAKE-OFF — ornith:35b-q4_K_M (qwen3.5-based).** Per operator, swapped CORE roles (orchestrator/domain_interpreter/requirements_agent) to `ornith:35b-q4_K_M` to test consistency vs gemma. Profile wired in `ollama.ts` (`isOrnith`, both callGenerate + chatCall): num_ctx 131072, temp 0.6, top_k 20, top_p 0.95, stop `<|im_end|>`, think:true, qwen-style json carve-out. Smoke test PASSED cleanly (`done:true`/`done_reason:stop`, tokens populated, valid `{threshold,measurement_method}` JSON for a compliance NFR — the exact gemma failure case). Deliberately NOT applying the transport fix, so the run cleanly measures ornith's native consistency. json_repair stays qwen3.5:9b; reasoning_review off.

Runs so far — full Hestami 09c28e81 (harvest, timed out P6); trimmed bu1u6jmkc (pre-review-fix, killed); trimmed bb2yxtvh1 (fixed build, P1.8 variance fail); trimmed bvs0av2ko (fixed build + manifest-advisory, P2.2c NFR-truncation fail); trimmed **bn8ltlz7w** (ornith:35b, manifest-advisory, ACTIVE). All lean profile, real-P9 OFF. Goal: live-validate PA-1/2(fix)/3/4/8(phase3 fix)/11(data_model)/14 + deferred PA-3/PA-5-A1, and assess ornith consistency vs gemma.

## Critical — model routing (satisfies the gemma4:31b@131072 requirement)
The `setOrchestratorRouting` test-hook (`src/testHooks.ts:114`) pins ONLY `orchestrator`; `domain_interpreter`/`requirements_agent` fall back to `DEFAULT_CONFIG` (`llamacpp`/`gpt-oss:20b`) — so the bloom/FR/NFR roles would run on the WRONG model. Fix = a committed workspace config merged at `ConfigManager` construction.

- [x] **NEW `test-and-evaluation/test-workspace/.janumicode/config.json`** (done) — AND copied to the globalStorage `.janumicode/` path (see LIVE-RUN STATUS #1; test-workspace copy alone is insufficient):
```json
{
  "llm_routing": {
    "orchestrator":       { "primary": { "backing_tool": "direct_llm_api", "provider": "ollama", "model": "gemma4:31b-it-qat" }, "temperature": 1 },
    "domain_interpreter": { "primary": { "backing_tool": "direct_llm_api", "provider": "ollama", "model": "gemma4:31b-it-qat" }, "temperature": 1 },
    "requirements_agent": { "primary": { "backing_tool": "direct_llm_api", "provider": "ollama", "model": "gemma4:31b-it-qat" }, "temperature": 1 },
    "reasoning_review":   { "primary": { "provider": "ollama", "model": "gemma4:e4b" }, "temperature": 1 },
    "json_repair":        { "primary": { "provider": "ollama", "model": "qwen3.5:9b" }, "fallback": { "provider": "ollama", "model": "gemma4:e4b" }, "temperature": 0, "fallback_temperature": 0 },
    "executor":           { "primary": { "backing_tool": "mimo_cli", "model": "ollama-local/gemma4:31b-it-qat" }, "temperature": 1 }
  }
}
```
  - `ollama.ts:96,100,168` auto-selects `num_ctx:131072` for `gemma4:31b-it-qat` (isGemma && !isGemmaLarge) — hardcoded, correct, only for `direct_llm_api` roles.
  - **mimo path does NOT forward num_ctx** → the Ollama SERVER must be started with `OLLAMA_CONTEXT_LENGTH=131072` (operational precondition).
  - `qwen3.5:9b` for json_repair is intentional (gemma pinned temp=1 breaks temp-0 determinism) — NOT stale.
- [x] **`.vscode-test.harness.mjs`**: added pass-through block for `JANUMICODE_EXECUTOR_BACKING_TOOL`, `JANUMICODE_MIMO_MODEL`, `JANUMICODE_MIMO_OPENAI_CONTEXT`, `JANUMICODE_MIMO_OPENAI_MAX_OUTPUT`, `JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S`, plus `JANUMICODE_REVIEW_ENABLED` + `JANUMICODE_INGESTION_STAGE3_OFF` (lean profile, LIVE-RUN STATUS #2). Doc comment updated to gemma4:31b-it-qat/direct_llm_api/ollama.

## Phase-contract fixes (`src/test/harness/phaseContracts.ts`) — real bugs + drift
- [x] **P0.5 bug** (fixed): `impact_enumeration` `art()` matcher never matched (`phase05.ts` writes `record_type:'cross_run_impact_report'` with no content.kind → permanent false-gap). Replaced with literal `{record_type:'cross_run_impact_report', sub_phase_id:'impact_enumeration', produced_by_agent_role:'consistency_checker'}`. (`refactoring_decision` sub-phase addition still open.)
- [ ] **P1 bug**: gate entry (lines 236-241) asserts `sub_phase_id:'product_handoff_gate'` — WRONG; real terminal gate fires at `sub_phase_id:'release_plan'` (`phase1.ts:1871`). Fix + add `coverage_verifier` (optional) + `release_plan` sequence.
- [ ] Mark/delete DEAD `PHASE1_CONTRACT` + `PHASE2_CONTRACT` (non-product; unreachable — lens hard-fails before them).
- [ ] Add missing **saturation** sub-phases (each emits `*_decomposition_pipeline` + `*_decomposition_node`): P2 `fr_saturation`/`nfr_saturation`, P4 `component_saturation` (node role = `domain_interpreter`, not architecture_agent), P5 `data_model_saturation`, P6 `task_saturation`, P7 `test_case_saturation`.
- [ ] P8: add `evaluation_coverage_report` (content.kind, role eval_design_agent).
- [ ] P9: add 7 entries (reconnaissance/module_ownership_planning/scaffold_manifest — all `optional:true`; implementation_packet + completion_criteria_coverage_report for packet_synthesis; quarantine_summary optional; cycle_iteration).
- [ ] **Caveat**: do NOT tighten `produced_by_agent_role` on saturation entries — `runCycleDelta.ts` re-enters with role `orchestrator`; current matcher treats role mismatch as soft (keep).

## Fixture path: real-Ollama-only (drop dead paths)
- [ ] `JANUMICODE_LLM_PROVIDER:'mock'` does NOTHING (extension.ts always registers live providers); `JANUMICODE_HARNESS_FIXTURE_DIR` is dead. Mock/fixture path already exists separately as `pnpm test:harness` (CLI + committed fixtures `src/test/_archive/fixtures-pre-regression/todo-app`).
- [ ] Fix misleading docs: `virtuousCycle.harness.test.ts:22`, `.vscode-test.harness.mjs:41-52`. Fix stale comments: `testHooks.ts:111`, `types.ts:420` (goose_cli→mimo_cli).

## CI (`.github/workflows/test-harness.yml`)
- [ ] Broken: invokes nonexistent `test-harness` CLI subcommand. Replace with `pnpm test:harness` (mock, CI-safe). Gate any real `pnpm harness:e2e` behind a `workflow_dispatch`-only self-hosted-GPU job (or `if:false` until a GPU runner exists).

## Runnability checklist (local, before first run)
- [x] Ollama at `127.0.0.1:11434` (verified up; `gemma4:31b-it-qat`, `gemma4:e4b`, `qwen3.5:9b` all pulled; `mimo` 0.1.3 on PATH). NOTE: harness routes gemma4:31b-it-qat via `direct_llm_api` which auto-selects num_ctx 131072 in ollama.ts — the `OLLAMA_CONTEXT_LENGTH=131072` server env only matters for the mimo/executor path (real-P9).
- [ ] Env: `JANUMICODE_E2E=1`, `JANUMICODE_HARNESS_REAL_PHASE9=1`, `JANUMICODE_HARNESS_ORCHESTRATOR_{BACKING=direct_llm_api,MODEL=gemma4:31b-it-qat,PROVIDER=ollama}`, `JANUMICODE_EXECUTOR_BACKING_TOOL=mimo_cli`, `JANUMICODE_MIMO_MODEL=ollama-local/gemma4:31b-it-qat`, `JANUMICODE_MIMO_OPENAI_CONTEXT=131072`, `JANUMICODE_HARNESS_TIMEOUT_MS=<multi-hour>` (default 10min will time out a real 31B P0→P10 run).
- [x] Clean stale `*.db` before each run — at the **globalStorage** `.janumicode/` path (LIVE-RUN STATUS #1), not test-workspace.

## Audit-regression mechanism (make findings permanent harness checks)
`agent_invocation` records carry the full rendered prompt at `content.prompt` (`llmCaller.ts:1294`). Two additive extension points, consumed every run:
- **A — `HestamiExpectation` (`hestamiExpectations.ts`, `type:'semantic_check'` + `VALIDATORS` map)** for prompt-content checks (audit D2/D3/D5/B1/B4). Filter `recs` to `record_type==='agent_invocation' && sub_phase_id===<sp>`, parse `content.prompt`. E.g. PA-1: "task_saturation prompt injects ≤N unrelated task/comp ids"; D2 generic: `content.prompt` never matches `/\{\{[a-zA-Z0-9_.]+\}\}/`; PA-14: eval_design prompt never contains `'No compliance regimes'` when compliance items exist upstream.
- **B — `PhaseInvariant` + `lineageValidator.ts` `InvariantCheck`** for structural checks (e.g. PA-1/PA-7 "decomposed node's parent_node_id resolves to a queued parent" — structural tree-walk).
Add each fixed finding's check in the SAME PR as the fix.

---
_Full analysis: this session's harness-revival agent output (transcript). Source assessment: [[project_prompt_materialization_audit]]._
