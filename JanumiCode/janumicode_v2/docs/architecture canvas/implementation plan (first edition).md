# Architecture Canvas Implementation Plan

Implement a full-featured Architecture Canvas as a VS Code Custom Editor, providing live visualization of JanumiCode workflow artifacts across Phases 3-8 with ELK-powered hierarchical layout.

---

## Summary

Build the Architecture Canvas feature per the spec document, integrating as a VS Code Custom Editor with HTML Canvas rendering, elkjs layout engine, SQLite position persistence, and real-time updates via the existing event bus.

---

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Editor Integration | VS Code Custom Editor | Full-width canvas, split support, editor tab UX |
| Rendering | HTML Canvas API | Performance with 500+ nodes, smooth zoom/pan |
| Layout Engine | elkjs | Best-in-class for hierarchical diagrams |
| Position Storage | SQLite `canvas_layout_state` table | Ephemeral UI state, regenerable from artifacts |
| Live Updates | EventBus subscription | Reuse existing `record:added` events |

---

## Implementation Waves

### Wave 1: Database Schema + Dependencies

**Files:**
- `src/lib/database/schema.ts` - Add `canvas_layout_state` table
- `src/lib/database/migrations.ts` - Add migration for new table
- `package.json` - Add `elkjs` dependency

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS canvas_layout_state (
  workflow_run_id     TEXT NOT NULL,
  node_id             TEXT NOT NULL,
  x                   REAL NOT NULL,
  y                   REAL NOT NULL,
  width               REAL,
  height              REAL,
  collapsed           INTEGER DEFAULT 0,
  user_positioned     INTEGER DEFAULT 0,
  last_modified_at    TEXT NOT NULL,
  PRIMARY KEY (workflow_run_id, node_id)
);
```

---

### Wave 2: Custom Editor Provider

**Files:**
- `src/lib/canvas/canvasEditorProvider.ts` (new) - VS Code CustomEditorProvider implementation
- `src/lib/canvas/canvasPanel.ts` (new) - Webview panel management
- `src/extension.ts` - Register custom editor for `.janumicode-canvas` scheme

**Responsibilities:**
- Register `janumicode.architectureCanvas` custom editor
- Handle `resolveCustomEditor` to create webview
- Manage webview lifecycle
- Forward messages between extension host and webview

---

### Wave 3: Canvas Webview Infrastructure

**Files:**
- `src/webview/canvas/App.svelte` (new) - Root canvas component
- `src/webview/canvas/main.ts` (new) - Entry point for canvas webview
- `src/webview/canvas/stores/nodes.svelte.ts` (new) - Node state management
- `src/webview/canvas/stores/edges.svelte.ts` (new) - Edge state management
- `src/webview/canvas/stores/viewport.svelte.ts` (new) - Pan/zoom state
- `src/webview/canvas/stores/selection.svelte.ts` (new) - Selection state

**Responsibilities:**
- Svelte 5 reactive state management
- Message handling from extension host
- Viewport transform management

---

### Wave 4: ELK Layout Engine Integration

**Files:**
- `src/webview/canvas/layout/elkLayout.ts` (new) - elkjs wrapper
- `src/webview/canvas/layout/graphBuilder.ts` (new) - Convert artifacts to ELK graph
- `src/webview/canvas/layout/incremental.ts` (new) - Incremental layout for new nodes

**ELK Configuration:**
```json
{
  "algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": 50,
  "elk.layered.spacing.nodeNodeBetweenLayers": 80,
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF"
}
```

---

### Wave 5: Canvas Renderer

**Files:**
- `src/webview/canvas/renderer/canvasRenderer.ts` (new) - Main canvas draw loop
- `src/webview/canvas/renderer/nodeRenderer.ts` (new) - Node drawing (16 types)
- `src/webview/canvas/renderer/edgeRenderer.ts` (new) - Edge drawing (6 types)
- `src/webview/canvas/renderer/phaseBands.ts` (new) - Phase band backgrounds
- `src/webview/canvas/renderer/icons.ts` (new) - Node type icons

**Node Types to Render:**
1. `requirement` - Phase 2
2. `system_requirement` - Phase 3
3. `interface_contract` - Phase 3
4. `domain` - Phase 4.1
5. `component` - Phase 4.2
6. `responsibility` - Phase 4.2
7. `adr` - Phase 4.3
8. `data_model` - Phase 5.1
9. `api_definition` - Phase 5.2
10. `error_strategy` - Phase 5.3
11. `config_param` - Phase 5.4
12. `impl_task` - Phase 6
13. `refactor_task` - Phase 6
14. `test_suite` - Phase 7
15. `test_case` - Phase 7
16. `eval_plan` - Phase 8

**Edge Types to Render:**
1. `derives_from` - Solid line, arrow down
2. `satisfies` - Dashed line, arrow up
3. `depends_on` - Dotted line, arrow sideways
4. `implements` - Double line
5. `tests` - Dashed line, arrow down
6. `governs` - Solid line, diamond marker

---

### Wave 6: Interactions

**Files:**
- `src/webview/canvas/interactions/panZoom.ts` (new) - Pan and zoom handlers
- `src/webview/canvas/interactions/selection.ts` (new) - Click/double-click handlers
- `src/webview/canvas/interactions/drag.ts` (new) - Node drag with persistence
- `src/webview/canvas/interactions/contextMenu.ts` (new) - Right-click menu
- `src/webview/canvas/interactions/collapse.ts` (new) - Phase band collapse

**Interactions:**
| Action | Behavior |
|--------|----------|
| Pan | Click + drag on empty space |
| Zoom | Mouse wheel / pinch |
| Click node | Select, show detail panel |
| Double-click node | Expand/collapse children |
| Right-click node | Context menu |
| Drag node | Reposition, persist to DB |
| Double-click phase header | Collapse/expand band |

---

### Wave 7: Detail Panel

**Files:**
- `src/webview/canvas/components/DetailPanel.svelte` (new) - Right-side panel
- `src/webview/canvas/components/NodeIdentity.svelte` (new) - ID, name, phase, status
- `src/webview/canvas/components/NodeContent.svelte` (new) - Full artifact content
- `src/webview/canvas/components/TraceabilityLinks.svelte` (new) - Satisfies/depends links
- `src/webview/canvas/components/WarningsList.svelte` (new) - Flags and warnings

**Panel Sections:**
- Identity: ID, name, phase, status, produced_at
- Content: Full artifact content (scrollable)
- Traceability: Satisfies/depends links (clickable)
- ADRs: Governing ADRs (clickable)
- Warnings: Flags (implementability, consistency, complexity)
- History: Derived from parent artifacts

---

### Wave 8: Live Updates

**Files:**
- `src/lib/canvas/canvasDataProvider.ts` (new) - Query artifacts from governed_stream
- `src/lib/canvas/canvasEventSubscriber.ts` (new) - Subscribe to EventBus
- `src/lib/canvas/canvasLayoutStore.ts` (new) - Position persistence layer

**Event Flow:**
1. Agent produces artifact
2. GovernedStreamWriter persists record
3. EventBus emits `record:added`
4. canvasEventSubscriber receives event
5. Webview receives via postMessage
6. Canvas creates new node
7. ELK incremental layout
8. Edges drawn from `memory_edge` table

---

### Wave 9: Toolbar + Controls

**Files:**
- `src/webview/canvas/components/Toolbar.svelte` (new) - Top toolbar
- `src/webview/canvas/components/FitButton.svelte` (new) - Fit all/phase buttons
- `src/webview/canvas/components/ZoomControls.svelte` (new) - Zoom in/out/reset

**Controls:**
- Fit All - Center and scale to show all nodes
- Fit Phase - Zoom to active phase band
- Zoom In/Out/Reset
- Phase collapse toggles

---

### Wave 10: Color Coding + Badges

**Files:**
- `src/webview/canvas/styles/colors.ts` (new) - Phase color palette
- `src/webview/canvas/styles/badges.ts` (new) - Warning badge rendering

**Color Palette:**
| Phase | Color | Hex |
|-------|-------|-----|
| Phase 2-3 | Blue | `#3B82F6` |
| Phase 4 | Green | `#10B981` |
| Phase 5 | Orange | `#F59E0B` |
| Phase 6 | Purple | `#8B5CF6` |
| Phase 7-8 | Teal | `#14B8A6` |

**Node States:**
- Complete: White background, solid border
- Generating: Yellow background, pulsing border
- Flagged: Red accent, warning badge

---

## File Summary

| Category | Files | Est. Lines |
|----------|-------|------------|
| Database | 2 modified | ~30 |
| Custom Editor Provider | 3 new | ~250 |
| Canvas Webview | 15 new | ~1,500 |
| Layout Engine | 3 new | ~300 |
| Renderer | 5 new | ~600 |
| Interactions | 5 new | ~400 |
| Detail Panel | 5 new | ~350 |
| Live Updates | 3 new | ~200 |
| Toolbar | 3 new | ~150 |
| **Total** | **44 files** | **~3,780** |

---

## Dependencies to Add

```json
{
  "dependencies": {
    "elkjs": "^0.9.3"
  }
}
```

---

## Commands to Register

```json
{
  "commands": [
    {
      "command": "janumicode.openArchitectureCanvas",
      "title": "JanumiCode: Open Architecture Canvas"
    }
  ]
}
```

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| Canvas opens as Custom Editor tab | Run command, verify tab opens |
| Nodes render for all 16 artifact types | Run workflow through Phase 8, verify nodes appear |
| Edges render for all 6 relationship types | Verify `memory_edge` records produce visible edges |
| Pan/zoom works at 60fps | Drag canvas, verify smooth movement |
| Node selection shows detail panel | Click node, verify panel appears |
| Live updates work | Run workflow, verify nodes appear in real-time |
| Position persists across sessions | Drag node, close/reopen, verify position retained |
| Phase bands collapse | Double-click header, verify band collapses |
| Context menu appears | Right-click node, verify menu options |
| Fit All/Phase buttons work | Click buttons, verify viewport adjusts |

---

## Estimated Effort

| Wave | Effort |
|------|--------|
| Wave 1: Schema + Dependencies | 0.5 day |
| Wave 2: Custom Editor Provider | 1 day |
| Wave 3: Canvas Webview Infrastructure | 1.5 days |
| Wave 4: ELK Layout Engine | 1 day |
| Wave 5: Canvas Renderer | 2 days |
| Wave 6: Interactions | 1.5 days |
| Wave 7: Detail Panel | 1 day |
| Wave 8: Live Updates | 1 day |
| Wave 9: Toolbar + Controls | 0.5 day |
| Wave 10: Color Coding + Badges | 0.5 day |
| **Total** | **10.5 days** |
