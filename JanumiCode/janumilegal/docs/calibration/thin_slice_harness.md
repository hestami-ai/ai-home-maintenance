# Thin-Slice Calibration Harness

**Status:** Wave 9.x deliverable. Mirrors JanumiCode v2's thin-slice harness.

## Why two surfaces

Calibration in JanumiLegal has **two complementary validation surfaces**:

| Surface | What it validates | Where it lives | When it runs |
|---|---|---|---|
| Gold matters | Substantive outputs | `calibration/gold/<TEST_CASE_ID>/` | Every CI run; hard-gate metrics CI-blocking |
| Thin slice | Pipeline + prompts + isolation | `test-and-evaluation/thin-slice-specs/` + `test-and-evaluation/thin-slice-workspaces/` | Structural test in CI; LLM review on demand |

The gold-matter calibration validates that *the right substantive output was produced for a known-correct expected output*. The thin-slice harness validates that *every state's prompt template fires cleanly, the orchestrator + envelope discipline holds, and isolation is preserved* — without committing to a specific substantive answer.

This is the legal-domain equivalent of the JanumiCode v2 thin-slice validation of prompt-template clarity / model-adherence: gold matters check correctness; thin slices check that the pipeline plumbing is sound and the prompts are runnable end-to-end.

## What the thin slice is

A **single-incident, single-jurisdiction matter** that exercises every state of a target lens (default: Family Law Production) at least once. The spec is intentionally minimal:

- One alleged denial (not a pattern).
- One jurisdiction (no cross-jurisdiction surface).
- No emergency, no support dispute, no safety concern.
- One attorney, admitted in the matter forum.

The canonical spec ships at `test-and-evaluation/thin-slice-specs/single_issue_access_denial.md`. It is to the gold matter what TinyURL was to a real product description in v2.

## How it runs

### Structural mode (CI-friendly)

`pnpm thin-slice:run` (or `tsx scripts/initThinSliceRun.ts`) creates the next-numbered workspace under `test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-N/`, instantiates a synthetic firm/client/matter, drives all 11 Family Law states through the orchestrator with built-in **replay agents** (until LLM agents land), and writes:

- `platform.sqlite` — the platform DB.
- `firms/<firm>/clients/<client>/matters/<matter>/governed_stream.sqlite` — the matter-track Governed Stream.
- `thin-slice-summary.json` — run summary (state count, op-track count, matter-track count, workspace identifiers).

Structural-mode runs are **deterministic** and cheap — every per-state output is reproducible.

The structural test (`src/test/thinSlice.test.ts`) executes the same runner end-to-end inside vitest and asserts the captured outputs match expected shape (e.g., `IssuePrune` retains an issue, `DirectLegalConclusionDraft` sets `attorney_review_required: true`). This test runs in every CI build.

### LLM-review mode (operator-driven)

`pnpm thin-slice:review --workspace <path-to-workspace>` walks the captured records and invokes Claude CLI (`claude -p ...`) per record to score:

- **prompt_clarity** (1–5)
- **output_validity** (1–5)
- **structural_correctness** (1–5)
- **capability_match** (`yes` / `borderline` / `no`)
- **issues** (bullets)
- **summary** (1–2 sentences)

The reviewer writes a markdown report to `<workspace>/thin-slice-review.md` with per-state scores, per-event-type op-track counts, per-classification matter-track counts, and a flagged-records section.

LLM-review mode is **operator-driven** (not CI). It requires a `claude` CLI on PATH and exists for the calibration cycle when prompt-templates change or new lens packs land.

Pass `--skip-llm` to emit a structural-only report (op-track + matter-track event counts + per-state output hashes). Useful for diff-checking two workspaces before/after a manifest change.

## Caveats — Wave 9.x state

- **Replay agents stand in for real LLM agents.** Wave 10+ wires Anthropic SDK; the runner accepts a custom `agentFactory` so the same harness drives real-LLM runs without code change.
- **The reviewer's view of "prompt template" is currently the captured state output and the lens manifest's documented input/output schema.** When real LLM agents land, the captured `agent_invoked` event will carry the actual prompt text, and the reviewer will score the prompt directly.
- **The thin slice does not exercise filing/release.** Release-gate end-to-end behavior is covered by `wave7E2E.test.ts`. The thin slice's purpose is the bloom→prune→draft→conclusion pipeline.

## Usage

```sh
# Run a thin slice (structural).
pnpm thin-slice:run

# Or with a specific spec:
pnpm thin-slice:run -- -s test-and-evaluation/thin-slice-specs/single_issue_access_denial.md -y

# Dry run to see what would happen.
pnpm thin-slice:run -- --dry-run

# Review the most recent workspace with LLM scoring (operator-only, requires claude CLI).
pnpm thin-slice:review -- --workspace test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-1

# Review without LLM (structural diff-friendly).
pnpm thin-slice:review -- --workspace test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-1 --skip-llm
```

## When to run a thin slice

| Trigger | Run? |
|---|---|
| Every commit that changes platform code | structural test in CI (always) |
| New lens manifest or manifest version bump | manual `thin-slice:run` + `thin-slice:review --skip-llm` to diff outputs |
| Prompt-template change (Wave 10+) | manual `thin-slice:run` + `thin-slice:review` (full LLM scoring) |
| New CLV migration | structural test + `pnpm calibration` |
| Pre-release of a new lens pack version | full LLM-review pass |
| Pre-counsel-review demonstration | full LLM-review pass + record the workspace + report for counsel |

## Naming convention

- Specs: `test-and-evaluation/thin-slice-specs/<scenario_handle>.md`.
- Workspaces: `test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-N/` (auto-numbered, never reused).
- Reports: `<workspace>/thin-slice-review.md`.

## Reference

- JanumiCode v2 origin: `JanumiCode/janumicode_v2/scripts/init-thin-slice-run.sh`, `JanumiCode/janumicode_v2/scripts/thin-slice-review.js`, `JanumiCode/janumicode_v2/test-and-evaluation/thin-slice-specs/tinyurl-thin-slice.md`.
- JanumiLegal runner: `src/lib/calibration/thinSlice.ts`.
- JanumiLegal scripts: `scripts/initThinSliceRun.ts`, `scripts/thinSliceReview.ts`.
