# Requirements Decomposition Viewer — Visualization Options

This is a survey of visualization strategies suited to displaying the JanumiCode requirements decomposition tree (848 nodes, 4 tiers, release-tagged) with inline MMP (Mirror-and-Menu Protocol) interactions for human pruning decisions.

---

## The Problem at Scale

The current `hestami-cal-11-snapshot.md` is **614 KB, 10,894 lines, 848 nodes across 21 FR roots, 3 releases, 4 tiers (A/B/C/D), and 4 statuses** (pending/atomic/pruned/deferred). The existing `DecompositionNodeCard` in the Governed Stream sidebar renders this as a vertically-stacked recursive tree — workable for small runs, but impossible to navigate or use for MMP gating at this scale.

The key constraint: humans need to **accept/reject/defer/edit individual nodes and whole subtrees**, which is the MMP prune step. The viewer must make that decision surface tractable.

---

## Visualization Options

### Option 1 — Indented Tree + Virtual Scroll (incremental improvement)
The current sidebar approach, enhanced with:
- **Virtual scrolling** (only render visible rows) — already have `VirtualScroll.svelte`
- Flat row rendering instead of recursive component tree (avoids ~848 nested Svelte components)
- Keyboard navigation (j/k to traverse, space to expand, Enter to accept/reject)
- Filter bar: by tier, status, release, priority
- Sticky breadcrumb showing current subtree path

**Pros:** Least new infrastructure; reuses existing card components; familiar tree UX.  
**Cons:** Still fundamentally linear; hard to see the shape of the tree; no cross-subtree comparison.

---

### Option 2 — Zoomable Treemap (space-filling)
Each rectangle = one node; size proportional to subtree size (leaf count). Nested rectangles show parent/child structure. Color encodes tier or status.

**Interaction:** Click to zoom into a subtree. Hover shows story + ACs. Sidebar panel shows MMP UI for hovered/selected node.

**Relevant libs:** D3.js `treemap` or `partition` layout; or a Svelte-native port.

**Pros:** Entire tree visible at once; instantly reveals which subtrees are large/pending; release color-coding is obvious.  
**Cons:** Node labels hard to read at small sizes; MMP decisions require switching between visual + form panel; harder to implement in a VS Code webview.

---

### Option 3 — Collapsible Radial/Sunburst Tree
Root at center; releases form the first ring; FR roots the second; descendants expand outward. Color = tier/release. Click a sector to zoom and expand.

**Relevant libs:** D3.js `partition` + polar coordinates; `echarts` sunburst.

**Pros:** Very compact; release grouping is visually dominant; depth communicates tier nesting.  
**Cons:** Arc labels are hard to read at depth 4+; MMP interaction on arc slices is awkward; poor for text-heavy data.

---

### Option 4 — Collapsible Org-Chart / Dendrogram (horizontal tree)
Classic left-to-right tree. Each node = a card with tier badge, status chip, action summary. Collapse entire subtrees. Pan/zoom canvas.

**Relevant libs:** D3.js `tree`/`cluster`; `elkjs` for layout; or pure CSS flex tree. Can render inside VS Code webview as a custom editor (like the existing Architecture Canvas).

**Pros:** Familiar; subtree structure is clear; tier depth maps to horizontal position; good for text-heavy nodes.  
**Cons:** Very wide at depth 3+; requires pan/zoom; 848 nodes will need aggressive lazy-expansion (load children on expand).

---

### Option 5 — Two-Panel: Table-of-Contents + Detail (most MMP-friendly)
Left panel: virtualized flat list of nodes with tier/status/release filters + a mini-tree indent for hierarchy cues. Right panel: full node card with MMP controls (accept/reject/defer/edit per node, bulk-accept subtree button).

This mirrors how large spec tools (Linear, Notion, JIRA) handle hierarchical work items.

**Pros:**  
- Best for MMP throughput — user can work through a filtered list rapidly  
- Full detail visible without hover  
- Existing `DecisionBundleCard` pattern maps naturally to the right panel  
- Release filter reduces cognitive load to one release at a time  
- Can export the current filtered view as markdown/JSON for agent consumption

**Cons:** No spatial overview; requires good filtering to be efficient.

---

### Option 6 — Timeline / Kanban by Release (phase-board view)
Three columns (Release 1, 2, 3 + Backlog). Within each column, cards grouped by FR root. Tier/status chips. Drag-to-reassign (subtree move, matching the design decision in `release_prioritization_design.md`).

**Pros:** Release assignment and subtree moves are the primary UI affordance; directly maps to the human's mental model of "what ships when".  
**Cons:** Not a tree — hierarchy is flattened within each column; poor for understanding nested decomposition structure.

---

### Option 7 — Multi-level Accordion with Batch MMP Gate (recommended for v1)
A new VS Code custom editor (separate tab, like the Architecture Canvas) with:
- **Left rail:** Release → FR root hierarchy (21 roots, collapsible by release)
- **Main area:** Accordion per selected FR root, showing Tier A/B/C/D bands as collapsible sections
- **Batch gate strip at top:** "848 nodes, 279 atomic, 562 pending — Accept all atomic? Defer all deferred?"
- **Per-node row:** Status icon, tier badge, display_key, action summary, inline Accept/Reject/Defer/Edit buttons
- **Detail drawer (bottom or right):** Full story + ACs + rationale + surfaced assumptions + MMP decision controls

This is the highest-fidelity MMP surface because it exposes the tier structure (A/B/C/D) that drives orchestrator routing, and lets the human work one tier at a time or one release at a time.

---

## Recommendation

**For a first custom viewer: Option 7 (Multi-level Accordion) as the primary layout, with Option 1's virtual scroll within each accordion section.**

Rationale:
- The MMP protocol requires per-node and subtree-level decisions — accordion rows make that fast
- Tier bands (A→B→C→D) are the decomposition model's organizing principle and should be the primary grouping axis
- Release-based left rail matches the `release_prioritization_design.md` decision that releases are the top-level planning artifact
- Virtual scrolling within each section handles the 848-node scale
- Can be built as a VS Code custom editor (same pattern as `CanvasEditorProvider`) reading from the SQLite `governed_stream` table directly

## Clarifying Questions for the User

Before choosing, it would help to know:
1. **Primary interaction mode:** Will humans mostly work through nodes one-by-one (MMP gate review), or do they need a spatial overview first to understand the tree shape?
2. **MMP scope for this viewer:** Does this viewer need to *submit* decisions back to the JanumiCode engine (writing to the DB), or is it read-only + export for now?
3. **Technology preference:** Stay in VS Code webview (Svelte + VSCode API), or open to a standalone browser-based tool (could use richer viz libs like D3/ECharts)?
4. **Priority:** Spatial overview vs. MMP throughput — which matters more for the first version?


## Example Renderings of the Options
### Option 1: Indented Tree + Virtual Scroll
┌─────────────────────────────────────────────────────────────────┐
│  Decomposition Tree                                    [Filter ▼] │
├─────────────────────────────────────────────────────────────────┤
│  ◆ US-001 [Root]  "Search and book service provider"          │
│    ├─○ US-001-1.1 [Tier C] "Render list of providers..."      │
│    │  ├─● US-001-1.1-1 [Tier C] "Filter by verified status"   │
│    │  │  └─◇ US-001-1.1-1.1 [Tier D] "Fetch provider records" │
│    │  └─● US-001-1.1-2 [Tier C] "Display availability badge"  │
│    ├─○ US-001-1.2 [Tier C] "Show booking calendar..."         │
│    └─○ US-001-1.3 [Tier C] "Send confirmation notification"     │
│                                                                 │
│  ◆ US-002 [Root]  "Track service request status"               │
│    ├─○ US-002-1.1 [Tier C] "Poll status API"                   │
│    │  └─◇ US-002-1.1-1 [Tier D] "GET /status/:id"              │
│    └─○ US-002-1.2 [Tier C] "Render timeline component"         │
│                                                                 │
│  ... (scroll: 827 more nodes)                                  │
├─────────────────────────────────────────────────────────────────┤
│  [◀] 21 roots  •  848 nodes  •  279 atomic  •  562 pending   │
└─────────────────────────────────────────────────────────────────┘

### Option 2: Zoomable Treemap
┌─────────────────────────────────────────────────────────────────┐
│                          848 NODES                              │
│  ┌─────────────────────────────────────────┐                    │
│  │                                         │    ┌──────┐        │
│  │    RELEASE 1 (312 nodes)                │    │ REL  │        │
│  │    ┌──────────┬──────────────────┐     │    │  2   │        │
│  │    │ US-001   │ US-002           │     │    │(401) │        │
│  │    │ (87)     │ (45)             │     │    │      │        │
│  │    │ ┌─┬─┐    │    ┌──┐          │     │    │      │        │
│  │    │ │1│2│    │    │1 │          │     │    └──────┘        │
│  │    │ └─┴─┘    │    └──┘          │     │    ┌──┐            │
│  │    └──────────┴──────────────────┘     │    │3 │ (135)     │
│  │                                         │    └──┘            │
│  └─────────────────────────────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  ▓▓▓ Tier A (5)  ░░░ Tier B (49)  ▒▒▒ Tier C (487)  ▬ Tier D  │
│  [Zoom in]  [Release view]  [Tier view]  [Status view]         │
└─────────────────────────────────────────────────────────────────┘

### Option 3: Radial/Sunburst Tree
                    Release 1
           ╭─────────────────────╮
          ╱    US-001    US-002   ╲
         ╱   ╱│╲        ╱│╲         ╲
        │   ╱ │ ╲      ╱ │ ╲         │
        │  1.1 1.2    1.1 1.2       │  Release 2
         ╲  │││              ╱        ╱
          ╲ │││             ╱       ╱
           ╰─────────────────────╯
                  [ROOT]
                  
         ╭──────────────╮
        ╱   US-011  ...  ╲      Release 3
       │   ╱│╲            │     ╭────────╮
        ╲ │││            ╱     ╱ US-015   ╲
         ╰──────────────╯     │  ...      │
                              ╲           ╱
                               ╰─────────╯


### Option 4: Horizontal Dendrogram
ROOT                              Release 1
 │                                            
 ├─ US-001 ─────┬─ 1.1 ─────┬─ 1.1 ───◇ D  [pending]
 │   (search)   │  (list)   │  (fetch)
 │              │           └─ 1.2 ───◇ D  [atomic]
 │              │              (badge)
 │              └─ 1.2 ─────┬─ 1.1 ───◇ D  [pending]
 │                 (calendar) │  (dates)
 │                            └─ 1.2 ───◇ D  [pending]
 │                               (slots)
 ├─ US-002 ─────┬─ 1.1 ───◇ D  [atomic]
 │   (track)    │  (poll)
 │              └─ 1.2 ───◇ D  [pending]
 │                 (render)
 │
 ├─ US-003 ...
 │
[pan →]  [zoom +]  [zoom -]  [fit all]

### Option 5: Two-Panel (ToC + Detail)
┌────────────────────────┬──────────────────────────────────────┐
│ FILTER: [All ▼] [R1 ✓] │                                      │
│ SEARCH: ______________ │  US-001-1.1-1  [Tier D] [atomic]   │
│                        │  ─────────────────────────────────   │
│ ☰ Release 1            │  As a Data Fetcher, I want         │
│   ▸ US-001 (87)        │  Retrieve verification_status...     │
│   ▸ US-002 (45)        │                                      │
│   ▸ US-003 (32)        │  AC-101: Status fields exist         │
│   ▸ US-004 (28)        │  Measurable: SELECT status...        │
│ ☰ Release 2            │                                      │
│   ▸ US-011 (94)        │  [Accept] [Reject] [Defer] [Edit]   │
│   ▸ US-012 (76)        │                                      │
│   ▾ US-013 (112)       │  Traces to: ENT-PROVIDER, WF-1       │
│     ├ 1.1              │  Assumptions: A-0065, A-0066          │
│     ├ 1.2              │                                      │
│     ├ 1.3 ←            │  Child nodes: 3  |  Depth: 3         │
│     └ 1.4              │                                      │
│ ☰ Release 3            │  [Accept subtree] [Reject subtree]  │
│   ▸ US-015 (135)       │                                      │
│                        │                                      │
├────────────────────────┴──────────────────────────────────────┤
│ 21 roots  •  312 shown  •  279 atomic  •  [Batch: Approve all D] │
└─────────────────────────────────────────────────────────────────┘

### Option 6: Kanban by Release
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│    RELEASE 1 (312)      │      RELEASE 2 (401)    │      RELEASE 3 (135)     │
│   [Homeowner Service]   │  [Service Provider Ops] │      [CAM Hub]          │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ ┌─────┐ ┌─────┐        │ ┌─────┐ ┌─────┐ ┌─────┐ │ ┌─────┐                │
│ │001  │ │002  │        │ │011  │ │012  │ │013  │ │ │015  │                │
│ │[C]  │ │[C]  │        │ │[B]  │ │[C]  │ │[A]  │ │ │[C]  │                │
│ │87   │ │45   │        │ │94   │ │76   │ │112  │ │ │135  │                │
│ └─────┘ └─────┘        │ └─────┘ └─────┘ └─────┘ │ └─────┘                │
│ ┌─────┐ ┌─────┐        │                         │                        │
│ │003  │ │004  │        │                         │                        │
│ │[C]  │ │[D]  │        │                         │                        │
│ │32   │ │28   │        │                         │                        │
│ └─────┘ └─────┘        │                         │                        │
│                        │                         │                        │
│  [+ Add root]          │   [+ Add root]          │   [+ Add root]         │
├─────────────────────────┴─────────────────────────┴─────────────────────────┤
│  Tier: [All ▼]  Status: [Pending ✓]  Priority: [Critical ✓]  [Export view]  │
└─────────────────────────────────────────────────────────────────────────────┘

### Option 7: Multi-Level Accordion
┌─────────────────────────────────────────────────────────────────────────────┐
│  DECOMPOSITION VIEWER                    [Release: All ▼] [Tier: All ▼]      │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ RELEASES │  ◇ US-001  "Search and book service provider"  [87 nodes]       │
│          │  ┌──────────────────────────────────────────────────────────────┐ │
│ ▓ Rel 1  │  │ TIER A — Functional Sub-Areas (2 nodes)                    │ │
│ ░ Rel 2  │  │ ▾ US-001-1  "Provider discovery domain"                    │ │
│ ▒ Rel 3  │  │   └─ [no children — promote to Tier B?]                    │ │
│          │  │ ▾ US-001-2  "Booking flow domain"                          │ │
│          │  │   └─ [no children]                                         │ │
│          │  └──────────────────────────────────────────────────────────────┘ │
│ ▓ 312    │  ┌──────────────────────────────────────────────────────────────┐ │
│ ░ 401    │  │ TIER B — Scope Commitments (12 nodes)          
│          │  │ TIER C — Implementation (45 nodes)                [+ Batch ▼]│
│          │  │ ▾ US-001-1.1  "Render list of providers" [C]              │
│          │  │   ├─● US-001-1.1-1  "Filter by verified status" [C]        │
│          │  │   │  ├─◇ US-001-1.1-1.1  "Fetch provider records" [D] [✓]  │
│          │  │   │  └─◇ US-001-1.1-1.2  "Check expiry date" [D] [○]       │
│          │  │   └─● US-001-1.1-2  "Display badge" [C]                    │
│          │  │ ▾ US-001-1.2  "Show booking calendar" [C]                   │
│          │  │   └─ ...                                                   │
│          │  └───────────────────────────────────────────────────────────┘
│          │  ┌───────────────────────────────────────────────────────────┐
│          │  │ TIER D — Atomic Leaves (28 nodes)            [Approve All] │
│          │  │ ◇ US-001-1.1-1.1  "Fetch provider records"       [atomic] │
│          │  │ ◇ US-001-1.1-1.2  "Check expiry"                   [pend] │
│          │  │ ◇ US-001-1.1-2.1  "Render badge component"       [atomic] │
│          │  │ ... (25 more)                                          │
│          │  └───────────────────────────────────────────────────────────┘
│          │                                                                  │
│          │  [◀ Prev Root]    [Next Root ▶]    [Jump to: ___]            │
├──────────┴──────────────────────────────────────────────────────────────────┤
│  848 nodes  •  21 roots  •  279 atomic  •  562 pending  •  [Export] [Gate]   │
└─────────────────────────────────────────────────────────────────────────────┘