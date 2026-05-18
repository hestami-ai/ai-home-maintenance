# Regression Test Suite

A fixture-driven regression harness for prompt templates. Replaces the
ad-hoc `src/test/fixtures/` and `src/test/prompt-probes/` capture
systems that rotted because they weren't tied to the regular test run.

## Lifecycle

```text
1. Extract  ── from a baseline thin-slice DB → fixture JSON
2. Author   ── hand-write the assertion block (T1/T2/T3) for the template
3. Run      ── `pnpm test` invokes both layers (deterministic + live)
4. Rebaseline ── deliberate, audit-logged update when a template changes
```

## Layers

| Layer | Runs | Cost | What it catches |
|---|---|---|---|
| **Deterministic** | every `pnpm test`, every `pnpm test:unit` | ms | Template structure drift, fixture schema validity, historical-response-vs-own-assertions sanity |
| **Live** | every `pnpm test` (the canonical run) | 30-60s per fixture | LLM behavior regressions against T1/T2/T3 assertions |

The deterministic layer is what *prevents rot*: a template change that
breaks a fixture's required-variables contract fails the build immediately.

## Operator commands

```bash
# Full canonical test run (unit + live integration + regression live)
pnpm test

# Inner-loop: just the unit tests (no Ollama)
pnpm test:unit

# Inner-loop: just the regression suite (filtered by template)
pnpm test:regression --templates implementation_task_decomposition

# Inner-loop: just regression deterministic (no Ollama)
pnpm test:regression:deterministic

# Extract new fixtures from a baseline DB
pnpm regression:extract --db <path-to-db> [--templates fr_bloom_skeleton,...]

# Rebaseline a fixture after a deliberate template change
pnpm regression:rebaseline <fixture-id>

# Status of fixtures (staleness, coverage)
pnpm regression:status
```

## Anti-rot mechanisms

1. **No skip flags.** If Ollama is unreachable, `pnpm test` fails loudly.
   Skip flags are how the prior fixtures rotted.
2. **Required CI gate.** The deterministic layer runs on every `pnpm test`.
   A template change that breaks a fixture's contract fails the build.
3. **Audit-logged rebaselining.** Every `pnpm regression:rebaseline`
   appends to `rebaseline-log.md` with timestamp + reason.
4. **Staleness detection.** `pnpm regression:status` flags fixtures
   whose `extracted_at` is older than the staleness threshold.

## The four-tier assertion model

Per-fixture assertions are layered. T1-T3 are deterministic; T4 is
optional and not built in v1.

- **T1 Schema** — response is valid JSON; required fields present;
  types correct; enum values in range.
- **T2 ID preservation** — every input ID that should appear in the
  output does. E.g., every `component_model.components[].id` appears as
  some `tasks[].component_id` in `implementation_plan`.
- **T3 Counted invariants** — array length bounds; coverage ratios;
  forbidden patterns (e.g., "no `comp-` prefix on `tasks[].component_id`
  when input uses bare slugs").
- **T4 LLM-judge** *(not in v1)* — second LLM call grading semantic
  equivalence between current and baseline responses.

See `assertions/` for the implementations.

## Fixture shape

See `fixtureSchema.ts` for the type. Roughly:

```json
{
  "fixture_id": "phase06_task_skeleton__sample-001",
  "extracted_from_run": "<thin-slice-run-id>",
  "extracted_at": "2026-05-14T10:00:00Z",
  "template_ref": { "agent_role": "...", "sub_phase": "..." },
  "invocation_params": { "provider": "...", "model": "...", "temperature": 0.4 },
  "template_variables": { "active_constraints": "...", ... },
  "baseline": { "response_text": "...", "parsed_json": {...}, "duration_ms": 47000 },
  "assertions": {
    "t1_schema": { "ref": "..." },
    "t2_id_preservation": [ {...} ],
    "t3_invariants": [ {...} ]
  }
}
```

The **assertions block is the source of truth.** The historical baseline
response is a diff target and sanity check — but the regression contract
is what's in `assertions`, not what the LLM happened to produce.

## Directory layout

```
src/test/regression/
├── README.md                       (this file)
├── fixtureSchema.ts                fixture types + Zod validators
├── extractor.ts                    walks thin-slice DB → fixtures
├── runner.ts                       render + invoke + assert
├── assertions/
│   ├── t1Schema.ts
│   ├── t2IdPreservation.ts
│   └── t3Invariants.ts
├── deterministic.test.ts           fast no-Ollama anti-rot tests
├── live.test.ts                    slow Ollama re-invocation tests
├── fixtures/                       *.fixture.json files
├── ollamaPrecheck.ts               availability check shared by tests
└── rebaseline-log.md               audit trail of baseline updates
```
