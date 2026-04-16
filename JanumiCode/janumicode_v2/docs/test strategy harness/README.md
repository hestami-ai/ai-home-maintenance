

The test harness can be run via the CLI with two commands:

### 1. `janumicode run` - Execute a workflow run

```bash
# Basic mock mode run
node dist/cli/janumicode.js run \
  --intent "Build a CLI todo app" \
  --workspace . \
  --llm-mode mock \
  --auto-approve

# With intent from file
node dist/cli/janumicode.js run \
  --intent @specs/feature.md \
  --workspace . \
  --llm-mode mock \
  --auto-approve \
  --gap-report gap.json

# With phase limit and fixtures
node dist/cli/janumicode.js run \
  --intent "Add authentication" \
  --workspace . \
  --llm-mode mock \
  --auto-approve \
  --phase-limit 4 \
  --fixture-dir src/test/fixtures/llm
```

### 2. `janumicode verify` - Run harness against a corpus

```bash
# Verify corpus document
node dist/cli/janumicode.js verify \
  --corpus docs/specs/auth-feature.md \
  --workspace . \
  --llm-mode mock \
  --gap-report verification-gap.json
```

### Options

| Option | Description |
|--------|-------------|
| `--intent <string\|@file>` | Intent text or file reference (required for [run](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/database/init.ts:53:2-53:38)) |
| `--corpus <path>` | Corpus document path (required for `verify`) |
| `--workspace <path>` | Workspace root (required) |
| `--llm-mode <mock\|real>` | LLM provider mode (default: mock) |
| `--auto-approve` | Auto-approve all decisions |
| `--phase-limit <phase>` | Stop after completing this phase |
| `--fixture-dir <path>` | LLM fixtures directory for mock mode |
| `--gap-report <path>` | Output gap report JSON on failure |
| `--decision-overrides <json>` | Override decisions per sub-phase |