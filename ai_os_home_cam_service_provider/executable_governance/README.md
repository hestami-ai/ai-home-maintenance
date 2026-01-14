# haos-guard

A governance CLI tool designed to programmatically enforce the **Hestami AI Developer Agent** standards (Rules R1–R10). This tool assists agents and developers in maintaining the architectural integrity of the HAOS platform.

## Features

- **Boundary Enforcement (R5)**: Prevents Prisma and server-side logic from leaking into the UI/Client bundle.
- **Mutation Safety (R2/R3)**: Ensures all database writes are wrapped in DBOS workflows and include idempotency keys.
- **Type Strategy (R1/R8)**: Detects hardcoded enums and enforces the use of generated barrel imports.
- **Error Contract (R6)**: Ensures oRPC handlers use type-safe `.errors()` and throw typed errors instead of raw exceptions.
- **Timestamps (R9)**: Enforces `TIMESTAMPTZ(3)` for all Prisma model fields and SQL function definitions.
- **Cerbos Policies (R10)**: Validates that all Cerbos `.yaml` policy files are syntax-valid.
- **Security Check (R7/R8)**: Scans for raw SQL usage and sensitive variable exposure.
- **Deep Semantic Trace (R11)**: Traces oRPC handlers to ensure Cerbos authorization is checking `context.cerbos` in the call chain.
- **Pipeline Integrity (R4)**: Detects drift between Prisma schemas, Zod models, OpenAPI specs, and generated frontend types.

## Installation

Ensure you have [Bun](https://bun.sh) installed.

```bash
cd executable_governance
bun install
```

## Usage

### Run all checks
```bash
bun run src/cli.ts verify rules
```

### Run all checks and save to individual files (Windows)
```powershell
.\run_all_checks.ps1
```

### Run specific checks
```bash
bun run src/cli.ts verify boundaries
bun run src/cli.ts verify mutations
bun run src/cli.ts verify types
bun run src/cli.ts verify pipelines
bun run src/cli.ts verify errors
bun run src/cli.ts verify policies
bun run src/cli.ts verify timestamps
bun run src/cli.ts verify security
bun run src/cli.ts verify trace
```

### JSON Output
For machine consumption or agent feedback loops, use the `--json` flag. The tool will exit with code `1` if violations are found.

```bash
bun run src/cli.ts verify rules --json > report.json
```

## Configuration

Rules and folder boundaries are defined in `haos-guard.config.json`.

| Path | Purpose |
|------|---------|
| `projectRoot` | Path to the main application source (e.g., `../hestami-ai-os`) |
| `rules.R5.boundaries` | Definition of forbidden imports for specific file patterns |
| `paths` | Relative paths to schema and generated artifact files |

## Rule Reference

- **R2/R3**: Mutations must happen inside DBOS workflows with a valid `idempotencyKey`.
- **R4**: Pipeline artifacts (Prisma, Zod, OpenAPI, types) must be in sync.
- **R5**: No `@prisma/client` or `$lib/server` imports in `.svelte` or client-side stores.
- **R6**: oRPC handlers must define `.errors({...})` and use `throw errors.CODE(...)`.
- **R8**: Avoid `z.enum(['A', 'B'])` literals; use imported schemas from `api/schemas.ts`.
- **R9**: Use `TIMESTAMPTZ(3)` for consistent high-precision time storage.
- **R10**: Authorization (Cerbos) must be enforced and policies must be valid.

