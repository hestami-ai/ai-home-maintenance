# Architecture Canvas Feature Description

**Version:** 1.0 (Draft)
**Date:** 2026-04-10
**Status:** Ideation / Design Phase

---

## 1. Overview

The Architecture Canvas is a live, interactive visualization of the JanumiCode workflow progression through Phases 3-8. It provides a whiteboard-style canvas that shows the hierarchical decomposition of requirements into architecture, technical specifications, implementation tasks, and tests.

### 1.1 Problem Statement

During workflow execution, humans struggle to understand progress in certain phases:

- **Architecture decomposition** (Phase 4): How components are being decomposed, which responsibilities are assigned, where dependencies exist
- **Traceability**: Which requirements are satisfied by which components
- **Cross-phase relationships**: How artifacts flow from requirements through to implementation

The Architecture Canvas addresses this by providing a real-time, structured visualization of the entire system architecture as it evolves.

### 1.2 Goals

- Make architecture decomposition progress visible and comprehensible
- Show three aspects simultaneously: hierarchy, dependencies, and traceability
- Provide live updates as agents produce artifacts
- Enable navigation and exploration of the architecture

---

## 2. Scope

### 2.1 Phase Coverage

| Phase | Name | Nodes Rendered |
|---|---|---|
| Phase 3 | System Specification | System Requirements, Interface Contracts |
| Phase 4 | Architecture Definition | Software Domains, Components, Responsibilities, ADRs |
| Phase 5 | Technical Specification | Data Models, API Definitions, Error Strategies, Config Params |
| Phase 6 | Implementation Planning | Implementation Tasks, Refactoring Tasks |
| Phase 7 | Test Planning | Test Suites, Test Cases |
| Phase 8 | Evaluation Planning | Eval Plans |

### 2.2 Root Node

The tree is rooted at **Phase 2 output** (Functional Requirements + Non-Functional Requirements), establishing full traceability from intent through implementation.

---

## 3. Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| **Rendering** | HTML Canvas | Performance with many nodes; smooth zoom/pan; crisp rendering at any scale |
| **Layout Engine** | ELK (Eclipse Layout Kernel) via `elkjs` | Best-in-class for hierarchical diagrams; supports layered layout, ports, edge routing |
| **Position Storage** | SQLite (separate table) | UI state, not Governed Stream; ephemeral; regenerable from artifacts |
| **Editor Integration** | VS Code Custom Editor / Editor Tab Webview | Full-width canvas; side-by-side with code |

---

## 4. Data Model

### 4.1 Node Types

Each node represents a Governed Stream artifact:

| Node Type | Source Artifact | Phase | Content Preview |
|---|---|---|---|
| `requirement` | `functional_requirements`, `non_functional_requirements` | 2 | Statement text |
| `system_requirement` | `system_requirements` | 3 | Statement, allocation |
| `interface_contract` | `interface_contracts` | 3 | Systems, protocol |
| `domain` | `software_domains` | 4.1 | Name, ubiquitous language |
| `component` | `component_model.components` | 4.2 | Name, responsibilities list |
| `responsibility` | `component_model.components.responsibilities` | 4.2 | Statement text |
| `adr` | `architectural_decisions.adrs` | 4.3 | Title, status |
| `data_model` | `data_models` | 5.1 | Entity names |
| `api_definition` | `api_definitions` | 5.2 | Endpoint paths |
| `error_strategy` | `error_handling_strategies` | 5.3 | Error types |
| `config_param` | `configuration_parameters` | 5.4 | Param names |
| `impl_task` | `implementation_plan.tasks` | 6 | Description, complexity |
| `refactor_task` | Refactoring Tasks from Phase 0.5 | 6 | Description, target |
| `test_suite` | Test Plans | 7 | Suite name |
| `test_case` | Test Cases | 7 | Case description |
| `eval_plan` | Eval Plans | 8 | Plan name |

### 4.2 Edge Types

| Edge Type | Visual Style | Source | Target | Meaning |
|---|---|---|---|---|
| `derives_from` | Solid line, arrow down | Child artifact | Parent artifact | This artifact was produced from that parent |
| `satisfies` | Dashed line, arrow up | Component/Task | Requirement | This artifact satisfies that requirement |
| `depends_on` | Dotted line, arrow sideways | Component | Component | This component depends on that component |
| `implements` | Double line | Impl Task | Tech Spec | This task implements that specification |
| `tests` | Dashed line, arrow down | Test Case | Impl Task/Requirement | This test verifies that artifact |
| `governs` | Solid line, diamond marker | ADR | Component | This ADR governs that component |

### 4.3 Node Visual Properties

| Property | Source |
|---|---|
| **Border color** | Phase (blue=3, green=4, orange=5, purple=6, teal=7-8) |
| **Background** | Status (white=complete, yellow=generating, red=flagged) |
| **Icon** | Node type (component, requirement, task, etc.) |
| **Badge** | Warning/flag count |
| **Size** | Proportional to content (responsibilities count, etc.) |

---

## 5. Visual Structure

### 5.1 Phase Bands

The canvas is organized into horizontal bands, one per phase:

```
+------------------------------------------------------------------+
| PHASE 3: SYSTEM SPEC                                             |
|   [Requirements] --> [System Requirements] --> [Interface Ctrcts]|
+------------------------------------------------------------------+
| PHASE 4: ARCHITECTURE                                            |
|   [Domains] --> [Components] --> [Responsibilities]              |
|   [ADRs]                                                          |
+------------------------------------------------------------------+
| PHASE 5: TECHNICAL SPEC                                           |
|   [Data Models] [API Defs] [Error Strategies] [Config Params]     |
+------------------------------------------------------------------+
| PHASE 6: IMPLEMENTATION PLANNING                                  |
|   [Impl Tasks] --> [Refactor Tasks]                               |
+------------------------------------------------------------------+
| PHASE 7-8: TEST & EVAL                                            |
|   [Test Suites] [Test Cases] [Eval Plans]                         |
+------------------------------------------------------------------+
```

### 5.2 Hierarchy Layout

Within each phase band, nodes are arranged hierarchically:

1. **Parent nodes** at top
2. **Children** below, connected by `derives_from` edges
3. **Cross-phase edges** connect across band boundaries
4. **Dependencies** shown as lateral edges within a band

### 5.3 Color Coding

| Phase | Border Color | Hex |
|---|---|---|
| Phase 2 (Requirements) | Blue | `#3B82F6` |
| Phase 3 (System Spec) | Blue | `#3B82F6` |
| Phase 4 (Architecture) | Green | `#10B981` |
| Phase 5 (Technical Spec) | Orange | `#F59E0B` |
| Phase 6 (Implementation) | Purple | `#8B5CF6` |
| Phase 7-8 (Test/Eval) | Teal | `#14B8A6` |

---

## 6. Interaction Affordances (v1)

### 6.1 Canvas-Level

| Action | Behavior |
|---|---|
| Pan | Click + drag on empty space |
| Zoom | Mouse wheel; pinch on trackpad |
| Fit All | Button: "Fit all" centers and scales to show all nodes |
| Fit Phase | Button: "Fit current phase" zooms to active phase band |
| Collapse Phase | Double-click phase header to collapse that band |

### 6.2 Node-Level

| Action | Behavior |
|---|---|
| Click node | Select; show detail panel on right |
| Double-click node | Expand/collapse children (if has children) |
| Right-click node | Context menu: "View in Governed Stream", "View ADRs", "Highlight dependencies" |
| Drag node | Reposition (position persists in `canvas_layout_state` table) |
| Hover edge | Show edge type tooltip; highlight connected nodes |

### 6.3 Detail Panel (Right Side)

When a node is selected, a detail panel appears:

| Section | Content |
|---|---|
| **Identity** | ID, name, phase, status, produced_at |
| **Content** | Full artifact content (scrollable) |
| **Traceability** | "Satisfies: [linked requirements]" with clickable links |
| **Dependencies** | "Depends on: [linked components]" with clickable links |
| **ADRs** | "Governing ADRs: [linked ADRs]" with clickable links |
| **Warnings** | Any flags (implementability, consistency, complexity) |
| **History** | "Derived from: [parent artifacts]" |

---

## 7. Live Update Behavior

### 7.1 Event Flow

1. **Agent produces artifact** via CLI invocation
2. **OutputParser** maps stdout to Governed Stream Record
3. **GovernedStreamWriter** persists record
4. **Event bus** emits `artifact_produced` event
5. **Canvas webview** receives event via `postMessage`
6. **Canvas creates new node** at appropriate position
7. **ELK incremental layout** repositions nodes smoothly
8. **Edges drawn** based on `memory_edge` relationships

### 7.2 Node Lifecycle Animation

| State | Visual Indicator |
|---|---|
| **Pending** | Dashed border, gray background |
| **Generating** | Pulsing border, "generating..." label |
| **Complete** | Solid border, white background |
| **Flagged** | Warning badge, yellow/red accent |

### 7.3 Layout Timing

| Trigger | Behavior |
|---|---|
| Initial load | Full ELK layout on all existing nodes |
| New node appears | Incremental ELK layout (smooth transition) |
| User drags node | Mark as "user-positioned"; exclude from auto-layout |
| Phase collapse/expand | Re-layout affected band |

---

## 8. Position Persistence

### 8.1 Database Schema

Position data is stored in a separate SQLite table, **not** in the Governed Stream:

```sql
CREATE TABLE canvas_layout_state (
  workflow_run_id     TEXT NOT NULL,
  node_id             TEXT NOT NULL,  -- artifact ID from Governed Stream
  x                   REAL NOT NULL,
  y                   REAL NOT NULL,
  width               REAL,
  height              REAL,
  collapsed           INTEGER DEFAULT 0,
  user_positioned     INTEGER DEFAULT 0,  -- 1 if dragged by user
  last_modified_at    TEXT NOT NULL,
  PRIMARY KEY (workflow_run_id, node_id)
);
```

### 8.2 Persistence Rules

- **User-dragged nodes**: Persist position; exclude from auto-layout
- **Auto-positioned nodes**: Position recalculated on load; not persisted
- **Collapsed state**: Persisted per node
- **Session reset**: If `canvas_layout_state` is cleared, canvas regenerates from ELK defaults

---

## 9. ELK Layout Configuration

```json
{
  "algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": 50,
  "elk.layered.spacing.nodeNodeBetweenLayers": 80,
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.compaction.postCompaction.strategy": "LEFT_RIGHT_CONSTRAINT",
  "phaseBands": {
    "enabled": true,
    "padding": 40,
    "headerHeight": 30
  }
}
```

---

## 10. v1 Feature Scope

### 10.1 In Scope

| Feature | Status |
|---|---|
| Pan/zoom canvas | Included |
| Click node -> detail panel | Included |
| Double-click -> expand/collapse children | Included |
| Right-click context menu | Included |
| Drag node to reposition | Included |
| Position persistence across sessions | Included |
| Phase band collapse | Included |
| Live updates as agents produce artifacts | Included |
| Edge rendering (all 6 types) | Included |
| Color coding by phase | Included |
| Warning badges on flagged nodes | Included |
| "Fit all" / "Fit phase" buttons | Included |
| Read-only (no user annotations) | Included |

### 10.2 Deferred

| Feature | Status |
|---|---|
| User annotations / sticky notes | Deferred |
| Export to SVG/PNG/Mermaid | Deferred |
| Multi-select / batch actions | Deferred |
| View mode switching (traceability-only, dependency-only) | Deferred |
| Custom edge styling | Deferred |
| Node filtering / search | Deferred |
| Minimap | Deferred |

---

## 11. Implementation Considerations

### 11.1 Performance Targets

| Metric | Target |
|---|---|
| Max nodes | 500+ without degradation |
| Pan/zoom latency | < 16ms (60fps) |
| Layout computation | < 500ms for full layout |
| Incremental layout | < 100ms per new node |
| Initial load | < 2s for typical workflow |

### 11.2 Canvas Rendering Architecture

```
+-------------------+     +-------------------+     +-------------------+
| Extension Host    |     | Webview           |     | Canvas Renderer   |
|                   |     |                   |     |                   |
| GovernedStream    |---->| postMessage       |---->| Event Handler     |
| Query             |     | Handler           |     |                   |
|                   |     |                   |     | Node/Edge Store   |
| canvas_layout_    |---->| State Sync        |---->| ELK Layout Engine |
| state             |     |                   |     |                   |
|                   |     |                   |     | Canvas Draw Loop  |
+-------------------+     +-------------------+     +-------------------+
```

### 11.3 Key Dependencies

- `elkjs` - ELK layout engine JavaScript port
- Canvas 2D API - Native browser rendering
- VS Code Webview API - Editor tab integration
- better-sqlite3 - Position persistence

---

## 12. Open Questions

| Question | Options |
|---|---|
| Should collapsed state persist across sessions? | Yes (in `canvas_layout_state`) / No |
| How to handle very large workflows (1000+ nodes)? | Virtualization / pagination / filtering |
| Should dependency edges be hideable? | Toggle button / always visible |
| How to show ADR relationships clearly? | Separate ADR panel / inline on component |

---

## 13. Future Enhancements (Post-v1)

1. **Minimap** - Overview navigation for large canvases
2. **Node filtering** - Show only components matching criteria
3. **View modes** - Traceability-only, dependency-only, task-graph
4. **Export** - SVG, PNG, Mermaid syntax
5. **Annotations** - User-added sticky notes, comments
6. **Multi-select** - Batch operations on selected nodes
7. **Diff view** - Compare two workflow runs side-by-side
8. **Real-time collaboration** - Multiple users viewing same canvas

---

*Document Version: 1.0*
*Last Updated: 2026-04-10*
*Status: Draft - Pending Implementation*
