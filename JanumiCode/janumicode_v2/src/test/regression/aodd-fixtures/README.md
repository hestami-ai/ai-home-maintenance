# AODD trace-completeness fixtures

This directory holds frozen AODD traces consumed by `src/test/regression/aodd-completeness.test.ts`. Each fixture is one scenario; the regression test loads every `<scenario>/manifest.json` and validates the embedded trace against it.

## Layout

Each fixture lives in its own directory:

```
<scenario>/
  manifest.json
  .janumicode/
    runs/
      <scenario>/         # synthetic run_id == scenario name
        aodd/
          events.ndjson
          index.json
          payloads/...     (optional)
          summaries/
            phase-<id>/
              <sub>.summary.json
              <sub>.summary.md
            run.summary.json
            run.summary.md
```

The fixture directory IS the workspace root for the regression run — i.e. when the runner reads it, `<scenario>/` is what would normally be the user's workspace and the scenario name is the `run_id`. This keeps the test deterministic across captures.

## Manifest schema

See `src/lib/aodd/completeness.ts` (`FixtureManifest`). Required fields:

- `scenario` — must match the directory name
- `description` — what the fixture represents
- `schema_version` — AODD schema version at capture time (currently `1`)
- `expected_sub_phases[]` — each entry asserts a sub-phase summary exists with the declared status and passes 5W+H reconstructability
- `forbidden_events?` — event types that must NOT appear in the trace
- `spot_checks?` — per sub-phase, dotted-path assertions (`equals` / `matches` / `not_null`)

## Adding a new fixture

Two paths:

### Path A — capture from a real run

```
node scripts/aodd.js capture <run_id> <scenario-name> --workspace <ws>
```

This copies `<ws>/.janumicode/runs/<run_id>/aodd/` into `<scenario-name>/.janumicode/runs/<scenario-name>/aodd/`, rewrites the `run_id` to `<scenario-name>`, and stubs out a `manifest.json` (with placeholder `__TODO__` phase/sub identifiers). Edit the manifest to declare what should be asserted, then commit.

### Path B — synthesize from known events

For fixtures that depend on event combinations not produced by a real run (or that need to be reproducible without a workspace), extend `scripts/aodd-generate-fixtures.ts` with a new scenario function and re-run:

```
pnpm tsx scripts/aodd-generate-fixtures.ts
```

That script generates fixtures via the real `emit()` API, copies them in place, rewrites IDs, and writes hand-crafted manifests so spot checks reference stable values (model name, status, template_key, etc.).

## Stability across re-captures

ULIDs and timestamps in `events.ndjson` differ on every capture. Spot checks must therefore reference values that ARE stable (e.g., `who.model == 'claude-sonnet-4-6'`), not raw event ids. Chain integrity assertions tolerate the variability since they validate references resolve, not specific IDs.

If a re-capture causes the regression test to fail and the failure is just timestamp/ULID variance, the manifest spot checks were over-specified. Tighten or remove the affected check.

## When the regression test fails

The failure message lists every assertion that did not hold for the failing fixture:

- `parent_event_id X not found` → trace produced a dangling pointer. Investigate whether emit recently changed how parents are threaded.
- `sub-phase X/Y summary missing` → summary writer didn't produce the expected file. Either the summary writer broke or the trace doesn't contain events under that (phase, sub-phase).
- `5W+H: <field> is empty` → the deriver could not populate that field from the events available. A required source event (`prompt.template_rendered`, `llm.invoked`, etc.) may be missing.
- `spot check <path>: expected X, got Y` → semantic divergence. Either intentional (update the fixture + manifest) or a regression (fix the producer).

Per design memo §9, a refactor that breaks reconstructability fails this test even if product outputs are unchanged. That is by design.
