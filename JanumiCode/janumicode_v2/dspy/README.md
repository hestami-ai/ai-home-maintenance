# DSPy Prompt-Template Optimization (pilot: `fr_saturation` / `gpt-oss:20b`)

Offline toolchain that optimizes JanumiCode prompt templates with DSPy and stages the
results for **manual** merge back into `prompts/`. DSPy is never a production runtime
dependency — see `docs/design/dspy-prompt-optimization.md` (Strategy C).

## Layout

```
dspy/
  src/                  TypeScript harness (run with tsx, reuses the real validators)
    types.ts            shared types
    metric.ts           deterministic fr_saturation metric (validators → 0..1 score)
    exportTrainset.ts   workspace DB → trainsets/<sub_phase>.trainset.jsonl
    scoreCli.ts         score ONE candidate output (stdin/JSON) — called by the Python metric
    baseline.ts         score the recorded outputs in the trainset → reports/
  trainsets/            harvested examples (jsonl)
  programs/             DSPy compiled programs (instruction + demos, JSON)
  candidates/           rendered candidate .system.md (the "after"), staged for review
  reports/              baseline + delta reports
  optimize/             Python: DSPy signature, program, MIPROv2 compile
```

## The metric

The score equals the **deterministic** subset of the production review bundle for
`(requirements_agent, fr_saturation)` (see `validatorRegistry.ts` DISPATCH_BUNDLES):

- `json_output_discipline_check`
- `contract_schema_validator`
- `parent_branch_classification_check`
- `decomposition_fanout_discipline`
- `traces_to_id_validity`

These run headless as pure functions over a reconstructed `ValidatorRuntimeParams`. The
LLM-judge validators in the same bundle (`grounding_validator`, `assumption_citation_validator`,
`tier_assignment_audit`, …) catch the grounding/citation defects but need a judge model;
they are a deferred second metric layer (not in this first pilot score).

## Commands

## Real optimization run (judge-in-the-loop, days-scale)

```bash
# launched detached; competes with any running thin-slice for the single GPU.
WITH_JUDGES=1 OPTIMIZER=mipro TRAIN_N=18 VAL_N=10 MAX_DEMOS=3 DEMO_THRESHOLD=0.8 \
  PYTHONIOENCODING=utf-8 nohup ./dspy/optimize/.venv/Scripts/python.exe \
  dspy/optimize/fr_saturation_optimize.py > dspy/reports/fr_saturation.mipro.log 2>&1 &

# monitor
tail -f dspy/reports/fr_saturation.mipro.log         # progress + per-eval scores
curl -s http://localhost:11434/api/ps                # which model is loaded now
#   gpt-oss:20b = program generating;  qwen3.5:9b = judges scoring

# outputs on completion:
#   dspy/programs/fr_saturation.compiled.json     compiled instruction + demos
#   dspy/candidates/.../*.system.md               rendered candidate (Strategy C staging)
#   dspy/reports/fr_saturation.delta.md           baseline vs optimized (judge-inclusive)
```

Timing: ~265 s per example evaluation (one gpt-oss generation + two judge calls).
A full val pass (10) ≈ 44 min; MIPROv2 light runs many passes → multi-day, longer while
a thin-slice run shares the GPU. This is expected and was authorized.

## Smoke / validation commands

```bash
# fast end-to-end check, deterministic metric, no judges (~5-10 min when GPU free)
SMOKE=1 PYTHONIOENCODING=utf-8 ./dspy/optimize/.venv/Scripts/python.exe dspy/optimize/fr_saturation_optimize.py
```

## Harness commands

```bash
# 1. harvest the trainset from the only current-format run
npx tsx dspy/src/exportTrainset.ts \
  --db "test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-127/.janumicode/test-harness/1780496036464.db" \
  --out dspy/trainsets/fr_saturation.trainset.jsonl

# 2. baseline: score the recorded gpt-oss:20b outputs (the number DSPy must beat)
npx tsx dspy/src/baseline.ts --trainset dspy/trainsets/fr_saturation.trainset.jsonl \
  --out dspy/reports/fr_saturation.baseline.md

# 3. (python) compile + export candidate — see dspy/optimize/README
```
