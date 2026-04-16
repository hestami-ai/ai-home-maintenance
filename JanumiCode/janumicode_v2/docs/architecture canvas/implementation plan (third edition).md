# Architecture Canvas Implementation Plan (Third Edition)

Complete implementation addressing all identity model issues: sub-artifact semantic ID resolution, edge model for nested items, async ingestion decision, Phase 10 registration, and comprehensive test coverage.

---

## Summary

Implement the full Architecture Canvas with a coherent identity model: a `sub_artifact` registry table that maps intrinsic semantic IDs to parent governed_stream records, a sub-artifact edge table, deterministic (not async) relationship extraction, complete phase registration (0-10), and explicit test files for each new component.

---

## Critical Architectural Decisions

### Decision 1: Sub-Artifact Identity Model

**Problem:** Sub-artifacts (components, responsibilities, test_cases) have intrinsic semantic IDs (e.g., `COMP-001`) but `memory_edge` FK constraints require governed_stream record IDs.

**Solution:** Create a `sub_artifact` registry table that maps semantic IDs to parent records.

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS sub_artifact (
  id                  TEXT PRIMARY KEY,     -- Semantic ID (e.g., "COMP-001")
  parent_record_id    TEXT NOT NULL,       -- governed_stream.id
  json_path           TEXT NOT NULL,       -- JSON path within parent content
  kind                TEXT NOT NULL,       -- 'component', 'responsibility', etc.
  workflow_run_id     TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  FOREIGN KEY (parent_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS sa_parent ON sub_artifact(parent_record_id);
CREATE INDEX IF NOT EXISTS sa_kind ON sub_artifact(kind);
CREATE INDEX IF NOT EXISTS sa_workflow ON sub_artifact(workflow_run_id);
```

**Canvas Node ID Resolution:**
- Canvas nodes use **semantic IDs** directly (e.g., `COMP-001`, `TC-007`)
- The `sub_artifact` table provides the mapping to parent records for content lookup
- Layout persistence uses semantic IDs (stable under reordering)

---

### Decision 2: Sub-Artifact Edge Model

**Problem:** `memory_edge` FK constraints prevent storing edges between sub-artifacts.

**Solution:** Create a parallel `sub_artifact_edge` table for sub-artifact relationships.

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS sub_artifact_edge (
  id                  TEXT PRIMARY KEY,
  source_id           TEXT NOT NULL,       -- Semantic ID
  target_id           TEXT NOT NULL,       -- Semantic ID
  edge_type           TEXT NOT NULL,       -- 'satisfies', 'depends_on', 'governs'
  asserted_by         TEXT NOT NULL,
  asserted_at         TEXT NOT NULL,
  authority_level     INTEGER NOT NULL DEFAULT 5,
  status              TEXT NOT NULL DEFAULT 'system_asserted',
  workflow_run_id     TEXT NOT NULL,
  notes               TEXT,
  FOREIGN KEY (source_id) REFERENCES sub_artifact(id),
  FOREIGN KEY (target_id) REFERENCES sub_artifact(id),
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS sae_source ON sub_artifact_edge(source_id);
CREATE INDEX IF NOT EXISTS sae_target ON sub_artifact_edge(target_id);
CREATE INDEX IF NOT EXISTS sae_type ON sub_artifact_edge(edge_type);
CREATE INDEX IF NOT EXISTS sae_workflow ON sub_artifact_edge(workflow_run_id);
```

**Edge Type Assignment:**
| Edge Type | Table | Source/Target |
|-----------|-------|---------------|
| `derives_from` | `memory_edge` | Record-level (artifact_produced) |
| `implements` | `memory_edge` | Record-level |
| `tests` | `memory_edge` | Record-level |
| `satisfies` | `sub_artifact_edge` | Sub-artifact (component -> requirement) |
| `depends_on` | `sub_artifact_edge` | Sub-artifact (component -> component) |
| `governs` | `sub_artifact_edge` | Sub-artifact (ADR -> component) |

---

### Decision 3: Synchronous Ingestion with Deterministic Extraction

**Problem:** Ingestion pipeline is synchronous; Stage III (relationship extraction) cannot be async without breaking all phase handlers.

**Solution:** Keep ingestion synchronous. Implement **deterministic** relationship extraction in Stage III (no LLM calls). LLM-based extraction can be added later as an out-of-band enrichment process.

**Implementation:**
```typescript
// In ingestionPipelineRunner.ts
private runStageIII(record: GovernedStreamRecord): void {
  if (record.record_type !== 'artifact_produced') return;
  
  const content = record.content as Record<string, unknown>;
  
  // Extract sub-artifacts and register them
  this.registerSubArtifacts(record, content);
  
  // Extract deterministic edges from content structure
  this.extractSubArtifactEdges(record, content);
}

private registerSubArtifacts(record: GovernedStreamRecord, content: Record<string, unknown>): void {
  const now = new Date().toISOString();
  
  // Components
  for (const comp of (content.components ?? []) as Component[]) {
    this.db.prepare(`
      INSERT OR REPLACE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(comp.id, record.id, `components[${comp.id}]`, 'component', record.workflow_run_id, now);
    
    // Responsibilities
    for (const resp of comp.responsibilities ?? []) {
      this.db.prepare(`
        INSERT OR REPLACE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(resp.id, record.id, `components[${comp.id}].responsibilities[${resp.id}]`, 'responsibility', record.workflow_run_id, now);
    }
  }
  
  // Test suites and cases
  for (const suite of (content.test_suites ?? []) as TestSuite[]) {
    this.db.prepare(`
      INSERT OR REPLACE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(suite.suite_id, record.id, `test_suites[${suite.suite_id}]`, 'test_suite', record.workflow_run_id, now);
    
    for (const tc of suite.test_cases ?? []) {
      this.db.prepare(`
        INSERT OR REPLACE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tc.test_case_id, record.id, `test_suites[${suite.suite_id}].test_cases[${tc.test_case_id}]`, 'test_case', record.workflow_run_id, now);
    }
  }
  
  // ADRs
  for (const adr of (content.adrs ?? []) as ADR[]) {
    this.db.prepare(`
      INSERT OR REPLACE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adr.id, record.id, `adrs[${adr.id}]`, 'adr', record.workflow_run_id, now);
  }
  
  // Reasoning scenarios
  for (const scenario of (content.scenarios ?? []) as ReasoningScenario[]) {
    this.db.prepare(`
      INSERT OR REPLACE INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(scenario.id, record.id, `scenarios[${scenario.id}]`, 'reasoning_scenario', record.workflow_run_id, now);
  }
}

private extractSubArtifactEdges(record: GovernedStreamRecord, content: Record<string, unknown>): void {
  const now = new Date().toISOString();
  
  // Component -> Requirement (satisfies)
  for (const comp of (content.components ?? []) as Component[]) {
    for (const reqId of comp.satisfies_requirements ?? []) {
      this.db.prepare(`
        INSERT INTO sub_artifact_edge (id, source_id, target_id, edge_type, asserted_by, asserted_at, workflow_run_id)
        VALUES (?, ?, ?, 'satisfies', 'ingestion_pipeline', ?, ?)
      `).run(this.generateId(), comp.id, reqId, now, record.workflow_run_id);
    }
    
    // Component -> Component (depends_on)
    for (const dep of comp.dependencies ?? []) {
      this.db.prepare(`
        INSERT INTO sub_artifact_edge (id, source_id, target_id, edge_type, asserted_by, asserted_at, workflow_run_id)
        VALUES (?, ?, ?, 'depends_on', 'ingestion_pipeline', ?, ?)
      `).run(this.generateId(), comp.id, dep.target_component_id, now, record.workflow_run_id);
    }
  }
  
  // ADR -> Component (governs)
  for (const adr of (content.adrs ?? []) as ADR[]) {
    for (const compId of adr.governs_components ?? []) {
      this.db.prepare(`
        INSERT INTO sub_artifact_edge (id, source_id, target_id, edge_type, asserted_by, asserted_at, workflow_run_id)
        VALUES (?, ?, ?, 'governs', 'ingestion_pipeline', ?, ?)
      `).run(this.generateId(), adr.id, compId, now, record.workflow_run_id);
    }
  }
}
```

---

### Decision 4: Complete Phase Registration (0-10)

**Files:**
- `src/extension.ts` - Register all phase handlers including Phase 10

**Implementation:**
```typescript
import { Phase0Handler } from './lib/orchestrator/phases/phase0';
import { Phase1Handler } from './lib/orchestrator/phases/phase1';
import { Phase2Handler } from './lib/orchestrator/phases/phase2';
import { Phase3Handler } from './lib/orchestrator/phases/phase3';
import { Phase4Handler } from './lib/orchestrator/phases/phase4';
import { Phase5Handler } from './lib/orchestrator/phases/phase5';
import { Phase6Handler } from './lib/orchestrator/phases/phase6';
import { Phase7Handler } from './lib/orchestrator/phases/phase7';
import { Phase8Handler } from './lib/orchestrator/phases/phase8';
import { Phase9Handler } from './lib/orchestrator/phases/phase9';
import { Phase10Handler } from './lib/orchestrator/phases/phase10';

// In bootstrap()
engine.registerPhase(new Phase0Handler());
engine.registerPhase(new Phase1Handler());
engine.registerPhase(new Phase2Handler());
engine.registerPhase(new Phase3Handler());
engine.registerPhase(new Phase4Handler());
engine.registerPhase(new Phase5Handler());
engine.registerPhase(new Phase6Handler());
engine.registerPhase(new Phase7Handler());
engine.registerPhase(new Phase8Handler());
engine.registerPhase(new Phase9Handler());
engine.registerPhase(new Phase10Handler());
```

---

## Actual Artifact Shapes (from codebase)

### Phase 4: Architecture Definition

```typescript
// From phase4.ts
interface SoftwareDomain {
  id: string;
  name: string;
  ubiquitous_language: UbiquitousLanguageTerm[];
  system_requirement_ids?: string[];
}

interface Component {
  id: string;                    // Semantic ID (e.g., "COMP-001")
  name: string;
  domain_id?: string;
  responsibilities: Responsibility[];
  dependencies?: Dependency[];
}

interface Responsibility {
  id: string;                    // Semantic ID
  statement: string;
}

interface Dependency {
  target_component_id: string;   // References Component.id
  dependency_type: string;
}

interface ADR {
  id: string;                    // Semantic ID (e.g., "ADR-001")
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context?: string;
  decision: string;
  alternatives?: string[];
  rationale: string;
  consequences?: string[];
  governs_components?: string[]; // References Component.id
}
```

### Phase 7: Test Planning

```typescript
// From phase7.ts
interface TestSuite {
  suite_id: string;              // Semantic ID
  component_id: string;          // References Component.id
  test_type: 'unit' | 'integration' | 'end_to_end';
  runner_command?: string;
  test_cases: TestCase[];
}

interface TestCase {
  test_case_id: string;          // Semantic ID
  type: 'unit' | 'integration' | 'end_to_end';
  acceptance_criterion_ids: string[];
  component_ids?: string[];
  preconditions: string[];
  inputs?: Record<string, unknown>;
  execution_steps?: string[];
  expected_outcome: string;
  edge_cases?: string[];
  implementation_notes?: string;
}
```

### Phase 8: Evaluation Planning

```typescript
// From phase8.ts - THREE artifact kinds
interface FunctionalEvalCriterion {
  functional_requirement_id: string;
  evaluation_method: string;
  success_condition: string;
}

interface QualityEvalCriterion {
  nfr_id: string;
  category: string;
  evaluation_tool: string;
  threshold: string;
  measurement_method: string;
  fallback_if_tool_unavailable?: string;
}

interface ReasoningScenario {
  id: string;                    // Semantic ID
  description: string;
  pass_criteria: string;
}
```

---

## Implementation Waves

### Wave 1: Schema + Sub-Artifact Registry

**Files:**
- `src/lib/database/schema.ts` - Add `sub_artifact`, `sub_artifact_edge`, `canvas_layout_state` tables
- `src/lib/database/migrations.ts` - Add migration
- `src/lib/types/records.ts` - Add `satisfies`, `depends_on`, `governs` to MemoryEdgeType
- `src/test/unit/database/schema.test.ts` - Update test
- `src/lib/canvas/types.ts` (new) - CanvasNode, CanvasEdge types with semantic IDs

**Schema Additions:**
```sql
-- Sub-artifact registry (maps semantic IDs to parent records)
CREATE TABLE IF NOT EXISTS sub_artifact (
  id                  TEXT PRIMARY KEY,
  parent_record_id    TEXT NOT NULL,
  json_path           TEXT NOT NULL,
  kind                TEXT NOT NULL,
  workflow_run_id     TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  FOREIGN KEY (parent_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

-- Sub-artifact edges (satisfies, depends_on, governs)
CREATE TABLE IF NOT EXISTS sub_artifact_edge (
  id                  TEXT PRIMARY KEY,
  source_id           TEXT NOT NULL,
  target_id           TEXT NOT NULL,
  edge_type           TEXT NOT NULL,
  asserted_by         TEXT NOT NULL,
  asserted_at         TEXT NOT NULL,
  authority_level     INTEGER NOT NULL DEFAULT 5,
  status              TEXT NOT NULL DEFAULT 'system_asserted',
  workflow_run_id     TEXT NOT NULL,
  notes               TEXT,
  FOREIGN KEY (source_id) REFERENCES sub_artifact(id),
  FOREIGN KEY (target_id) REFERENCES sub_artifact(id),
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

-- Canvas layout persistence
CREATE TABLE IF NOT EXISTS canvas_layout_state (
  workflow_run_id     TEXT NOT NULL,
  node_id             TEXT NOT NULL,  -- Semantic ID
  x                   REAL NOT NULL,
  y                   REAL NOT NULL,
  width               REAL,
  height              REAL,
  collapsed           INTEGER DEFAULT 0,
  user_positioned     INTEGER DEFAULT 0,
  dependency_edges_visible INTEGER DEFAULT 1,
  last_modified_at    TEXT NOT NULL,
  PRIMARY KEY (workflow_run_id, node_id)
);
```

---

### Wave 2: Ingestion Pipeline Stage III

**Files:**
- `src/lib/orchestrator/ingestionPipelineRunner.ts` - Implement `runStageIII()` with sub-artifact registration
- `src/test/unit/orchestrator/ingestionPipelineStage3.test.ts` (new) - Test sub-artifact extraction

---

### Wave 3: Phase Registration + Extension Bootstrap

**Files:**
- `src/extension.ts` - Register Phase 0-10 handlers
- `package.json` - Add `elkjs` dependency, `customEditors` contribution, command
- `esbuild.js` - Add canvas webview build target

---

### Wave 4: Custom Editor Provider

**Files:**
- `src/lib/canvas/canvasDocumentProvider.ts` (new)
- `src/lib/canvas/canvasEditorProvider.ts` (new)
- `src/test/unit/canvas/canvasEditorProvider.test.ts` (new)

---

### Wave 5: Data Provider with Semantic ID Resolution

**Files:**
- `src/lib/canvas/canvasDataProvider.ts` (new) - Query sub_artifacts + sub_artifact_edge
- `src/lib/canvas/canvasEventSubscriber.ts` (new) - EventBus subscription
- `src/lib/canvas/canvasLayoutStore.ts` (new) - Position persistence
- `src/test/unit/canvas/canvasDataProvider.test.ts` (new)

**canvasDataProvider.ts:**
```typescript
export class CanvasDataProvider {
  getNodesForWorkflow(workflowRunId: string): CanvasNode[] {
    // Query sub_artifact registry
    const subArtifacts = this.db.prepare(`
      SELECT sa.id, sa.kind, sa.parent_record_id, sa.json_path, gs.phase_id, gs.content
      FROM sub_artifact sa
      JOIN governed_stream gs ON gs.id = sa.parent_record_id
      WHERE sa.workflow_run_id = ?
    `).all(workflowRunId);
    
    return subArtifacts.map(sa => {
      const parentContent = JSON.parse(sa.content);
      const nodeContent = this.extractAtPath(parentContent, sa.json_path);
      
      return {
        id: sa.id,  // Semantic ID
        type: sa.kind,
        phaseId: sa.phase_id,
        label: this.extractLabel(sa.kind, nodeContent),
        content: nodeContent,
        parentRecordId: sa.parent_record_id,
        x: 0, y: 0, width: 120, height: 60,
        status: 'complete',
      };
    });
  }
  
  getEdgesForWorkflow(workflowRunId: string): CanvasEdge[] {
    // Record-level edges from memory_edge
    const recordEdges = this.db.prepare(`
      SELECT id, source_record_id, target_record_id, edge_type
      FROM memory_edge
      WHERE workflow_run_id = ?
      AND edge_type IN ('derives_from', 'implements', 'tests')
    `).all(workflowRunId);
    
    // Sub-artifact edges from sub_artifact_edge
    const subArtifactEdges = this.db.prepare(`
      SELECT id, source_id, target_id, edge_type
      FROM sub_artifact_edge
      WHERE workflow_run_id = ?
    `).all(workflowRunId);
    
    return [
      ...recordEdges.map(e => ({
        id: e.id,
        sourceId: e.source_record_id,
        targetId: e.target_record_id,
        type: e.edge_type,
      })),
      ...subArtifactEdges.map(e => ({
        id: e.id,
        sourceId: e.source_id,
        targetId: e.target_id,
        type: e.edge_type,
      })),
    ];
  }
}
```

---

### Wave 6: Canvas Webview Infrastructure

**Files:**
- `src/webview/canvas/main.ts` (new)
- `src/webview/canvas/App.svelte` (new)
- `src/webview/canvas/stores/nodes.svelte.ts` (new)
- `src/webview/canvas/stores/edges.svelte.ts` (new)
- `src/webview/canvas/stores/viewport.svelte.ts` (new)
- `src/webview/canvas/stores/selection.svelte.ts` (new)

---

### Wave 7: ELK Layout Engine

**Files:**
- `src/webview/canvas/layout/elkLayout.ts` (new)
- `src/webview/canvas/layout/graphBuilder.ts` (new)
- `src/webview/canvas/layout/incremental.ts` (new)
- `src/webview/canvas/layout/phaseBands.ts` (new)

---

### Wave 8: Canvas Renderer

**Files:**
- `src/webview/canvas/renderer/canvasRenderer.ts` (new)
- `src/webview/canvas/renderer/nodeRenderer.ts` (new)
- `src/webview/canvas/renderer/edgeRenderer.ts` (new)
- `src/webview/canvas/renderer/phaseBands.ts` (new)
- `src/webview/canvas/renderer/icons.ts` (new)
- `src/webview/canvas/renderer/animations.ts` (new)

---

### Wave 9: Interactions

**Files:**
- `src/webview/canvas/interactions/panZoom.ts` (new)
- `src/webview/canvas/interactions/selection.ts` (new)
- `src/webview/canvas/interactions/drag.ts` (new)
- `src/webview/canvas/interactions/contextMenu.ts` (new)
- `src/webview/canvas/interactions/collapse.ts` (new)

---

### Wave 10: Detail Panel

**Files:**
- `src/webview/canvas/components/DetailPanel.svelte` (new)
- `src/webview/canvas/components/NodeIdentity.svelte` (new)
- `src/webview/canvas/components/NodeContent.svelte` (new)
- `src/webview/canvas/components/TraceabilityLinks.svelte` (new)
- `src/webview/canvas/components/WarningsList.svelte` (new)

---

### Wave 11: Toolbar + Controls

**Files:**
- `src/webview/canvas/components/Toolbar.svelte` (new)
- `src/webview/canvas/components/FitButton.svelte` (new)
- `src/webview/canvas/components/ZoomControls.svelte` (new)
- `src/webview/canvas/components/DependencyToggle.svelte` (new)

---

### Wave 12: Styles + Tests + Integration

**Files:**
- `src/webview/canvas/styles/colors.ts` (new)
- `src/webview/canvas/styles/badges.ts` (new)
- `src/test/unit/canvas/subArtifactIdStability.test.ts` (new)
- `src/test/unit/canvas/semanticIdResolution.test.ts` (new)
- `src/test/unit/canvas/subArtifactEdgeRewriting.test.ts` (new)
- `src/test/unit/canvas/liveUpdateFanout.test.ts` (new)
- `src/test/unit/webview/canvasWebviewBootstrap.test.ts` (new)

---

## File Summary

| Category | Files |
|----------|-------|
| Schema + Types | 5 |
| Ingestion Pipeline | 2 |
| Phase Registration | 3 |
| Custom Editor | 3 |
| Data Provider | 4 |
| Webview Infrastructure | 6 |
| Layout Engine | 4 |
| Renderer | 6 |
| Interactions | 5 |
| Detail Panel | 5 |
| Toolbar + Controls | 4 |
| Styles + Tests | 8 |
| **Total** | **55 files** |

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| Canvas opens as Custom Editor tab | Run command, verify tab opens |
| Sub-artifacts registered | Run Phase 4, verify `sub_artifact` table populated |
| Semantic IDs stable | Reopen canvas, verify same node IDs |
| Edges render for all 6 types | Verify all edge types visible |
| Sub-artifact edges work | Verify component->requirement edges |
| Pan/zoom works at 60fps | Drag canvas, verify smooth movement |
| Node selection shows detail panel | Click node, verify panel appears |
| Live updates work | Run workflow, verify nodes appear in real-time |
| Position persists across sessions | Drag node, close/reopen, verify position retained |
| Phase bands collapse | Double-click header, verify band collapses |
| Context menu appears | Right-click node, verify menu options |
| Fit All/Phase buttons work | Click buttons, verify viewport adjusts |
| Node animations work | Verify pending/generating/complete states animate |
| Dependency edge toggle works | Click toggle, verify edges hide/show |
| Phase 10 registered | Run workflow to completion, verify no unregistered phase error |
| Tests pass | Run `pnpm test`, verify all new tests pass |
