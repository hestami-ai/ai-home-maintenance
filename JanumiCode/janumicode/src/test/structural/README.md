# Structural Tests

Comprehensive architectural testing framework that enforces clean architecture principles, detects violations, and provides actionable fix suggestions.

## Overview

Structural tests validate that the codebase maintains architectural integrity:

- **Layer Separation**: Presentation → Business Logic → Infrastructure → Foundation
- **Module Boundaries**: Strict isolation between major modules
- **Circular Dependencies**: Zero-tolerance policy
- **Foundation Integrity**: Foundation modules have no upward dependencies
- **Dependency Metrics**: Track coupling, fan-out, and instability
- **Agent Constraints**: AI/LLM-specific best practices

## Test Suites

### `layerBoundaries.test.ts`
Enforces 4-layer architecture with no reverse dependencies.

**Checks**:
- Presentation cannot access Database or CLI internals
- Business Logic cannot access UI
- Infrastructure cannot access Business Logic
- Foundation has zero upward dependencies

**Severity**: ERROR

### `moduleBoundaries.test.ts`
Ensures strict isolation between major modules.

**Checks**:
- Webview isolation from workflow/roles/orchestrator
- Database access only via store abstractions
- LLM provider access limited to approved modules

**Severity**: WARN (migration)

### `circularDeps.test.ts`
Detects circular dependencies with visualization.

**Features**:
- Mermaid diagram generation
- Fix suggestions ranked by difficulty
- Impact radius calculation

**Severity**: ERROR

### `dependencyMetrics.test.ts`
Analyzes dependency health and quality.

**Checks**:
- Excessive fan-out (>20 dependencies)
- Foundation module coupling
- Instability metrics
- Overall health score

**Severity**: WARN

### `foundationIntegrity.test.ts`
Hardens the foundation layer with strict rules.

**Checks**:
- Zero upward dependencies
- Minimal external dependencies (<10)
- No misplaced business logic
- Covenant compliance

**Severity**: ERROR

### `agentConstraints.test.ts`
Enforces AI/LLM-specific best practices.

**Checks**:
- Prompt integrity (no `any` types)
- LLM call patterns (retry, validation)
- Workflow determinism (no Date.now, Math.random)
- Context validation (PII redaction)

**Severity**: WARN

## Helper Modules

### `dependencyParser.ts`
Extracts import information from TypeScript files.

**Functions**:
- `getTypeScriptFiles()` - Find all .ts files
- `extractImports()` - Parse imports from file
- `getModulePath()` - Resolve relative paths

### `graphBuilder.ts`
Constructs dependency graphs and analyzes cycles.

**Functions**:
- `buildDependencyGraph()` - Create graph from imports
- `detectCycles()` - Find circular dependencies (Tarjan's algorithm)
- `getCouplingMetrics()` - Calculate afferent/efferent coupling
- `getHighFanOutModules()` - Find god modules

### `reporter.ts`
Enhanced reporting with severity levels and fix suggestions.

**Functions**:
- `createViolationReport()` - Initialize report
- `addViolation()` - Add violation with severity
- `formatViolationReport()` - Pretty-print with fixes

### `violationDocs.ts`
Maps violation patterns to actionable fixes.

**Structure**:
- Pattern identifier
- Severity level
- Title and explanation
- Step-by-step fix instructions
- Before/after examples
- Documentation links

### `cycleVisualizer.ts`
Generates Mermaid diagrams and suggests cycle fixes.

**Functions**:
- `generateMermaidDiagram()` - Create visual graph
- `suggestCycleFixes()` - Rank fixes by difficulty
- `calculateImpactRadius()` - Find affected modules

## Running Tests

```bash
# Run all structural tests
pnpm run test:structure

# Watch mode
pnpm run test:structure:watch

# Run specific test suite
npx vitest src/test/structural/layerBoundaries.test.ts

# Include in CI
pnpm run test:all
```

## Interpreting Results

### Success
```
✅ No violations found! Architecture is clean.
```

### Failure with Actionable Report
```
❌ ERROR: Presentation → Database bypass

   File: src/lib/ui/governedStream/GovernedStreamPanel.ts:123
   Import: ../database/init

   Why this is wrong:
   UI layer cannot directly access database infrastructure.
   This creates tight coupling and prevents clean testing/mocking.

   ✅ How to fix:
   1. Use workflow layer abstractions instead of direct database access
   2. Import from workflow stores (e.g., getWorkflowState, getClaims)
   3. If needed, add a new workflow function to expose the data

   Example:
   ❌ Before:
      import { getDatabase } from '../../database/init';
      const db = getDatabase();
      const claims = db.prepare('SELECT * FROM claims').all();

   ✅ After:
      import { getClaimsForDialogue } from '../../workflow/claims';
      const claims = getClaimsForDialogue(dialogueId);

   📖 See: docs/ARCHITECTURE.md#presentation-layer
```

## Metrics & Drift Detection

### Collect Metrics
```bash
pnpm run arch:metrics
```

Saves snapshot to `.arch-metrics/latest.json` with:
- Violation counts by severity
- Circular dependency count
- Health score (0-100)
- Trend vs previous

### Detect Drift
```bash
pnpm run arch:drift
```

Compares against baseline and fails CI if:
- Any new errors
- Warnings increase >10%
- New circular dependencies
- Health score drops >10 points

### Set Baseline
```bash
pnpm run arch:baseline
```

Captures current state as acceptable baseline.

## Integration with CI

Add to CI pipeline:

```yaml
- name: Structural Tests
  run: pnpm run test:structure

- name: Architecture Drift
  run: pnpm run arch:drift
```

## Customization

### Adding New Violation Patterns

1. Add pattern to `violationDocs.ts`:
```typescript
export const VIOLATION_DOCS: Record<string, ViolationFix> = {
  'my-new-pattern': {
    pattern: 'my-new-pattern',
    severity: 'error',
    title: 'Description',
    explanation: 'Why this is wrong',
    fixSteps: ['Step 1', 'Step 2'],
    example: { before: '...', after: '...' }
  }
};
```

2. Use in test:
```typescript
const violation: Violation = {
  file: '...',
  pattern: 'my-new-pattern',
  reason: 'Custom reason'
};
addViolation(report, violation);
```

### Adjusting Thresholds

Edit test assertions:
```typescript
// Allow more warnings during migration
expect(report.warnings.length).toBeLessThan(50);

// Stricter fan-out limit
const highFanOut = getHighFanOutModules(graph, 15);
```

## Best Practices

1. **Run tests locally** before pushing
2. **Fix errors immediately** - they block build
3. **Track warnings** - set timeline to fix
4. **Review metrics weekly** - watch for trends
5. **Update baseline** after major refactoring
6. **Document exceptions** if you must bypass a rule

## Troubleshooting

**Tests fail with "Cannot find module"**:
→ Run `pnpm install` to ensure dependencies are installed

**Metrics script fails**:
→ Ensure `.arch-metrics/` directory exists (created automatically)

**False positives**:
→ Add file/pattern to exclude list in test configuration

**Baseline missing**:
→ Run `pnpm run arch:baseline` to create initial baseline

## Resources

- Main docs: `docs/ARCHITECTURE.md`
- Quick ref: `docs/ARCH_QUICK_REF.md`
- Dependency Cruiser: `.dependency-cruiser.cjs`
