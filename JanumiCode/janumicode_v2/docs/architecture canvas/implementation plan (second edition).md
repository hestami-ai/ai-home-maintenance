# Architecture Canvas Full Implementation Plan

Complete implementation of the Architecture Canvas feature per the specification, including all infrastructure prerequisites: sub-artifact projection layer, missing edge types, relationship extraction, phase registration, live updates, and full interactivity.

---

## Summary

Implement the full Architecture Canvas feature in 10 waves, including all prerequisite infrastructure work: projection model for sub-artifacts, MemoryEdgeType expansion, Stage III relationship extraction, Phase 2-8 production registration, and complete canvas rendering with live updates and drag persistence.

---

## Infrastructure Prerequisites

These must be completed before or alongside the canvas implementation.

### Prerequisite 1: Sub-Artifact Projection Layer

**Problem:** Most node types (component, responsibility, test_case, etc.) are nested JSON inside `artifact_produced` records, not first-class records.

**Solution:** Create a projection layer that:
1. Extracts nested items from `artifact_produced.content`
2. Assigns stable synthetic IDs based on parent record ID + item path
3. Provides consistent interface for layout, selection, and persistence

**Files:**
- `src/lib/canvas/projection/types.ts` (new) - ProjectedNode, ProjectionRule
- `src/lib/canvas/projection/extractor.ts` (new) - Extract nested items
- `src/lib/canvas/projection/idGenerator.ts` (new) - Stable synthetic IDs
- `src/lib/canvas/projection/rules.ts` (new) - Extraction rules per artifact kind

**Stable ID Scheme:**
```typescript
// Synthetic ID format: {parentRecordId}:{jsonPath}
// Example: "abc123:components[0].responsibilities[2]"
function generateSyntheticId(parentId: string, jsonPath: string): string {
  return `${parentId}:${jsonPath}`;
}

function parseSyntheticId(id: string): { parentId: string; jsonPath: string } {
  const [parentId, ...pathParts] = id.split(':');
  return { parentId, jsonPath: pathParts.join(':') };
}
```

**Extraction Rules:**
```typescript
const PROJECTION_RULES: ProjectionRule[] = [
  {
    sourceKind: 'component_model',
    extract: (content) => {
      const components = content.components ?? [];
      return components.flatMap((comp, compIdx) => [
        { kind: 'component', path: `components[${compIdx}]`, label: comp.name },
        ...(comp.responsibilities ?? []).map((resp, respIdx) => ({
          kind: 'responsibility',
          path: `components[${compIdx}].responsibilities[${respIdx}]`,
          label: resp.statement,
        })),
      ]);
    },
  },
  {
    sourceKind: 'test_plan',
    extract: (content) => {
      const suites = content.test_suites ?? [];
      return suites.flatMap((suite, suiteIdx) => [
        { kind: 'test_suite', path: `test_suites[${suiteIdx}]`, label: suite.name },
        ...(suite.test_cases ?? []).map((tc, tcIdx) => ({
          kind: 'test_case',
          path: `test_suites[${suiteIdx}].test_cases[${tcIdx}]`,
          label: tc.description,
        })),
      ]);
    },
  },
  // ... rules for all 16 node types
];
```

---

### Prerequisite 2: MemoryEdgeType Expansion

**Problem:** `MemoryEdgeType` only has 3 of the 6 required edge types.

**Current:**
```typescript
// @/src/lib/types/records.ts:319-328
export type MemoryEdgeType =
  | 'derives_from' | 'supersedes' | 'contradicts'
  | 'validates' | 'corrects' | 'raises'
  | 'answers' | 'implements' | 'tests';
```

**Required Additions:**
```typescript
export type MemoryEdgeType =
  | 'derives_from' | 'supersedes' | 'contradicts'
  | 'validates' | 'corrects' | 'raises'
  | 'answers' | 'implements' | 'tests'
  | 'satisfies'    // NEW: Component -> Requirement
  | 'depends_on'   // NEW: Component -> Component
  | 'governs';     // NEW: ADR -> Component
```

**Files to Modify:**
- `src/lib/types/records.ts` - Add new types
- `src/lib/database/schema.ts` - Update edge_type index comment

---

### Prerequisite 3: Stage III Relationship Extraction

**Problem:** Ingestion pipeline Stage III is a stub.

**Current State:**
```typescript
// @/src/lib/orchestrator/ingestionPipelineRunner.ts:65-70
// Stage III is a no-op when no LLMCaller is available.
result.stagesCompleted.push(3);
```

**Solution:** Implement LLM-based relationship extraction.

**Files:**
- `src/lib/orchestrator/ingestionPipelineRunner.ts` - Implement `runStageIII()`
- `src/lib/orchestrator/templates/cross_cutting/ingestion_pipeline_stage3.system.md` - Already exists

**Implementation:**
```typescript
private async runStageIII(record: GovernedStreamRecord): Promise<EdgeCreated[]> {
  if (!this.llmCaller) {
    // Deterministic fallback for common patterns
    return this.extractDeterministicEdges(record);
  }
  
  // LLM-based extraction
  const prompt = this.renderTemplate('ingestion_pipeline_stage3', { record });
  const response = await this.llmCaller.call(prompt);
  return this.parseEdgeResponse(response);
}

private extractDeterministicEdges(record: GovernedStreamRecord): EdgeCreated[] {
  const edges: EdgeCreated[] = [];
  const content = JSON.parse(record.content);
  
  // Extract satisfies edges from component -> requirements
  if (content.kind === 'component_model') {
    for (const comp of content.components ?? []) {
      for (const reqId of comp.satisfies_requirements ?? []) {
        edges.push(this.createEdge('satisfies', comp.id, reqId, 'system_asserted'));
      }
    }
  }
  
  // Extract depends_on from component dependencies
  if (content.kind === 'component_model') {
    for (const comp of content.components ?? []) {
      for (const depId of comp.depends_on_components ?? []) {
        edges.push(this.createEdge('depends_on', comp.id, depId, 'system_asserted'));
      }
    }
  }
  
  // Extract governs from ADR -> components
  if (content.kind === 'architectural_decisions') {
    for (const adr of content.adrs ?? []) {
      for (const compId of adr.governs_components ?? []) {
        edges.push(this.createEdge('governs', adr.id, compId, 'system_asserted'));
      }
    }
  }
  
  return edges;
}
```

---

### Prerequisite 4: Phase 2-8 Production Registration

**Problem:** Production extension only registers Phase 0 and Phase 1.

**Files:**
- `src/extension.ts` - Register all phase handlers

**Implementation:**
```typescript
// In extension.ts bootstrap()
import { Phase2Handler } from './lib/orchestrator/phases/phase2';
import { Phase3Handler } from './lib/orchestrator/phases/phase3';
import { Phase4Handler } from './lib/orchestrator/phases/phase4';
import { Phase5Handler } from './lib/orchestrator/phases/phase5';
import { Phase6Handler } from './lib/orchestrator/phases/phase6';
import { Phase7Handler } from './lib/orchestrator/phases/phase7';
import { Phase8Handler } from './lib/orchestrator/phases/phase8';
import { Phase9Handler } from './lib/orchestrator/phases/phase9';

// After Phase 0 + 1 registration
engine.registerPhase(new Phase2Handler());
engine.registerPhase(new Phase3Handler());
engine.registerPhase(new Phase4Handler());
engine.registerPhase(new Phase5Handler());
engine.registerPhase(new Phase6Handler());
engine.registerPhase(new Phase7Handler());
engine.registerPhase(new Phase8Handler());
engine.registerPhase(new Phase9Handler());
```

---

## Implementation Waves

### Wave 1: Types + Schema + Projection Layer

**Files:**
- `src/lib/types/records.ts` - Add `satisfies`, `depends_on`, `governs` to MemoryEdgeType
- `src/lib/database/schema.ts` - Add `canvas_layout_state` table
- `src/lib/database/migrations.ts` - Add migration for new table
- `src/test/unit/database/schema.test.ts` - Update test
- `src/lib/canvas/types.ts` (new) - CanvasNode, CanvasEdge, ViewportState
- `src/lib/canvas/projection/types.ts` (new) - ProjectedNode, ProjectionRule
- `src/lib/canvas/projection/extractor.ts` (new) - Extract nested items
- `src/lib/canvas/projection/idGenerator.ts` (new) - Stable synthetic IDs
- `src/lib/canvas/projection/rules.ts` (new) - Extraction rules per kind

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS canvas_layout_state (
  workflow_run_id     TEXT NOT NULL,
  node_id             TEXT NOT NULL,  -- governed_stream.id or synthetic ID
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

### Wave 2: Custom Editor + Build System

**Files:**
- `package.json` - Add `customEditors` contribution, `elkjs` dependency, command
- `esbuild.js` - Add canvas webview build target
- `src/lib/canvas/canvasDocumentProvider.ts` (new) - Virtual document provider
- `src/lib/canvas/canvasEditorProvider.ts` (new) - CustomEditorProvider
- `src/extension.ts` - Register providers and phase handlers

**package.json Contributions:**
```json
{
  "dependencies": {
    "elkjs": "^0.11.1"
  },
  "contributes": {
    "customEditors": [
      {
        "viewType": "janumicode.architectureCanvas",
        "displayName": "Architecture Canvas",
        "selector": [{ "filenamePattern": "*.janumicode-canvas" }]
      }
    ],
    "commands": [
      {
        "command": "janumicode.openArchitectureCanvas",
        "title": "JanumiCode: Open Architecture Canvas"
      }
    ]
  }
}
```

---

### Wave 3: Data Provider + Event Subscriber

**Files:**
- `src/lib/canvas/canvasDataProvider.ts` (new) - Query artifacts and edges
- `src/lib/canvas/canvasEventSubscriber.ts` (new) - EventBus subscription
- `src/lib/canvas/canvasLayoutStore.ts` (new) - Position persistence
- `src/lib/orchestrator/ingestionPipelineRunner.ts` - Implement Stage III

**canvasDataProvider.ts:**
```typescript
export class CanvasDataProvider {
  getNodesForWorkflow(workflowRunId: string): CanvasNode[] {
    // 1. Query artifact_produced records
    const artifacts = this.queryArtifacts(workflowRunId);
    
    // 2. Project nested items
    const projectedNodes: CanvasNode[] = [];
    for (const artifact of artifacts) {
      const projected = this.projector.extract(artifact);
      projectedNodes.push(...projected.map(p => ({
        id: p.syntheticId,
        type: p.kind,
        phaseId: artifact.phase_id,
        label: p.label,
        content: p.data,
        parentId: artifact.id,
        x: 0, y: 0, width: 120, height: 60,
        status: 'complete',
      })));
    }
    
    return projectedNodes;
  }
  
  getEdgesForWorkflow(workflowRunId: string): CanvasEdge[] {
    // Query all 6 edge types
    const edges = this.db.prepare(`
      SELECT id, source_record_id, target_record_id, edge_type
      FROM memory_edge
      WHERE workflow_run_id = ?
      AND edge_type IN ('derives_from', 'satisfies', 'depends_on', 'implements', 'tests', 'governs')
    `).all(workflowRunId);
    
    return edges.map(e => ({
      id: e.id,
      sourceId: e.source_record_id,
      targetId: e.target_record_id,
      type: e.edge_type,
    }));
  }
}
```

---

### Wave 4: Canvas Webview Infrastructure

**Files:**
- `src/webview/canvas/main.ts` (new) - Entry point
- `src/webview/canvas/App.svelte` (new) - Root component
- `src/webview/canvas/stores/nodes.svelte.ts` (new) - Node state
- `src/webview/canvas/stores/edges.svelte.ts` (new) - Edge state
- `src/webview/canvas/stores/viewport.svelte.ts` (new) - Pan/zoom state
- `src/webview/canvas/stores/selection.svelte.ts` (new) - Selection state

---

### Wave 5: ELK Layout Engine

**Files:**
- `src/webview/canvas/layout/elkLayout.ts` (new) - elkjs wrapper
- `src/webview/canvas/layout/graphBuilder.ts` (new) - Convert to ELK graph
- `src/webview/canvas/layout/incremental.ts` (new) - Incremental layout
- `src/webview/canvas/layout/phaseBands.ts` (new) - Phase band constraints

---

### Wave 6: Canvas Renderer

**Files:**
- `src/webview/canvas/renderer/canvasRenderer.ts` (new) - Main draw loop
- `src/webview/canvas/renderer/nodeRenderer.ts` (new) - Node drawing (16 types)
- `src/webview/canvas/renderer/edgeRenderer.ts` (new) - Edge drawing (6 types)
- `src/webview/canvas/renderer/phaseBands.ts` (new) - Phase band backgrounds
- `src/webview/canvas/renderer/icons.ts` (new) - Node type icons
- `src/webview/canvas/renderer/animations.ts` (new) - Node lifecycle animations

**Node Lifecycle Animation:**
```typescript
// Animation loop for generating/pending states
function animateNodes(ctx: CanvasRenderingContext2D, nodes: CanvasNode[]): void {
  const now = Date.now();
  
  for (const node of nodes) {
    if (node.status === 'generating') {
      // Pulsing border
      const pulse = Math.sin(now / 200) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 + pulse * 0.5})`;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -now / 50; // Animated dash
    } else if (node.status === 'pending') {
      ctx.strokeStyle = '#9CA3AF';
      ctx.setLineDash([4, 4]);
    } else {
      ctx.strokeStyle = PHASE_COLORS[node.phaseId];
      ctx.setLineDash([]);
    }
    
    // Draw node...
  }
  
  requestAnimationFrame(() => animateNodes(ctx, nodes));
}
```

---

### Wave 7: Interactions

**Files:**
- `src/webview/canvas/interactions/panZoom.ts` (new) - Pan and zoom
- `src/webview/canvas/interactions/selection.ts` (new) - Click/double-click
- `src/webview/canvas/interactions/drag.ts` (new) - Node drag with persistence
- `src/webview/canvas/interactions/contextMenu.ts` (new) - Right-click menu
- `src/webview/canvas/interactions/collapse.ts` (new) - Phase band collapse

**Drag Persistence:**
```typescript
// On drag end, persist to database
async function onDragEnd(nodeId: string, x: number, y: number): Promise<void> {
  await vscode.postMessage({
    type: 'persistPosition',
    nodeId,
    x,
    y,
    userPositioned: true,
  });
}

// In extension host
case 'persistPosition':
  canvasLayoutStore.persistPosition({
    workflowRunId,
    nodeId: msg.nodeId,
    x: msg.x,
    y: msg.y,
    userPositioned: msg.userPositioned,
  });
  break;
```

---

### Wave 8: Detail Panel

**Files:**
- `src/webview/canvas/components/DetailPanel.svelte` (new)
- `src/webview/canvas/components/NodeIdentity.svelte` (new)
- `src/webview/canvas/components/NodeContent.svelte` (new)
- `src/webview/canvas/components/TraceabilityLinks.svelte` (new)
- `src/webview/canvas/components/WarningsList.svelte` (new)

---

### Wave 9: Toolbar + Controls

**Files:**
- `src/webview/canvas/components/Toolbar.svelte` (new)
- `src/webview/canvas/components/FitButton.svelte` (new)
- `src/webview/canvas/components/ZoomControls.svelte` (new)
- `src/webview/canvas/components/DependencyToggle.svelte` (new)

---

### Wave 10: Styles + Final Integration

**Files:**
- `src/webview/canvas/styles/colors.ts` (new) - Phase color palette
- `src/webview/canvas/styles/badges.ts` (new) - Warning badge rendering
- Integration testing and bug fixes

---

## File Summary

| Category | Files |
|----------|-------|
| Types + Schema | 9 |
| Custom Editor + Build | 5 |
| Data Provider + Events | 3 |
| Webview Infrastructure | 6 |
| Layout Engine | 4 |
| Renderer | 6 |
| Interactions | 5 |
| Detail Panel | 5 |
| Toolbar + Controls | 4 |
| Styles | 2 |
| **Total** | **49 files** |

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| Canvas opens as Custom Editor tab | Run command, verify tab opens |
| Nodes render for all 16 artifact types | Run workflow through Phase 8, verify all node types appear |
| Edges render for all 6 relationship types | Verify all edge types visible |
| Pan/zoom works at 60fps | Drag canvas, verify smooth movement |
| Node selection shows detail panel | Click node, verify panel appears |
| Live updates work | Run workflow, verify nodes appear in real-time |
| Position persists across sessions | Drag node, close/reopen, verify position retained |
| Phase bands collapse | Double-click header, verify band collapses |
| Context menu appears | Right-click node, verify menu options |
| Fit All/Phase buttons work | Click buttons, verify viewport adjusts |
| Node animations work | Verify pending/generating/complete states animate |
| Dependency edge toggle works | Click toggle, verify edges hide/show |
| Sub-artifact nodes render | Verify responsibilities, test_cases appear as nodes |
| Synthetic IDs stable | Reopen canvas, verify same node IDs |
