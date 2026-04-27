<script lang="ts">
  /**
   * Architecture Canvas App Component.
   *
   * Renders the interactive architecture visualization using Canvas 2D.
   * Wave 7: Full implementation with Svelte + Canvas 2D.
   */

  import { onMount } from 'svelte';
  import type {
    CanvasNode,
    CanvasEdge,
    NodeLayoutState,
    ViewportState,
    CanvasOutboundMessage,
    CanvasInboundMessage,
  } from './types';
  import DetailPanel from './components/DetailPanel.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import { computeLayout, computeGridLayout } from './layout/elkLayout';
  import { getCanvasColors } from './styles/colors';

  // VS Code API type
  interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
  }

  // Acquire VS Code API - provided by the webview context
  const vscode = (window as unknown as { acquireVsCodeApi: () => VsCodeApi }).acquireVsCodeApi();

  // Canvas reference and context
  let canvasRef: HTMLCanvasElement | null = $state(null);
  let ctx: CanvasRenderingContext2D | null = $state(null);

  // Canvas state
  let nodes = $state<Map<string, CanvasNode>>(new Map());
  let edges = $state<Map<string, CanvasEdge>>(new Map());
  let layout = $state<Map<string, NodeLayoutState>>(new Map());
  let viewport = $state<ViewportState>({ x: 0, y: 0, zoom: 1 });
  let selectedNodeId = $state<string | null>(null);
  let hoveredNodeId = $state<string | null>(null);
  let dependencyEdgesVisible = $state(true);

  // Interaction state
  let isDragging = $state(false);
  let dragNodeId = $state<string | null>(null);
  /**
   * `isPanning` is set when the user starts a drag on empty canvas
   * background — the viewport translates by the drag delta. Without
   * this, there's no way to navigate the canvas at zoom-out levels
   * because we have no scrollbars (Canvas 2D doesn't generate any —
   * the host element is a fixed-size <canvas>, not an overflow
   * container). Mutually exclusive with isDragging (node drag).
   */
  let isPanning = $state(false);
  let lastMouseX = $state(0);
  let lastMouseY = $state(0);

  onMount(() => {
    if (canvasRef) {
      ctx = canvasRef.getContext('2d');
      initCanvas();
    }

    // Listen for messages from extension host
    window.addEventListener('message', handleMessage);

    // Tell the host we're ready to receive messages. The host posts
    // the init payload in response to this. Without the handshake,
    // the host's synchronous postMessage(init) call inside
    // resolveCustomEditor races the webview script load — the
    // webview script hasn't run yet, the listener doesn't exist, the
    // message is dropped, and the canvas sits there blank with no
    // error. The decomp viewer uses the same handshake pattern.
    // eslint-disable-next-line no-console
    console.log('[canvas-webview] sending ready signal');
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  });

  /**
   * Initialize canvas with proper sizing.
   */
  function initCanvas() {
    if (!canvasRef) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvasRef.getBoundingClientRect();
    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;

    if (ctx) {
      ctx.scale(dpr, dpr);
      render();
    }
  }

  /**
   * Handle messages from the extension host.
   */
  function handleMessage(event: MessageEvent<CanvasOutboundMessage>) {
    const message = event.data;

    switch (message.type) {
      case 'init':
        nodes = new Map(message.nodes.map(n => [n.id, n]));
        edges = new Map(message.edges.map(e => [e.id, e]));
        layout = new Map(message.layout.map(l => [l.nodeId, l]));
        // The host's data provider applies saved positions per-node from
        // canvas_layout_state. Any node WITHOUT a saved row keeps its
        // loadNodes default of x:0, y:0 — stacking it at the origin.
        // Even one prior user-drag creates this asymmetry: one node
        // moved, 200+ stuck at (0,0). So always compute the grid
        // layout, but only apply it to nodes that have NO saved
        // position. Saved drags still win.
        if (message.nodes.length > 0) {
          const savedIds = new Set(message.layout.map(l => l.nodeId));
          // eslint-disable-next-line no-console
          console.log('[canvas-webview] computing grid for unpositioned nodes', {
            total_nodes: message.nodes.length,
            saved_positions: savedIds.size,
            unpositioned: message.nodes.length - savedIds.size,
          });
          void computeAndApplyAutoLayout(savedIds);
        } else {
          render();
        }
        break;

      case 'nodeAdded':
        nodes = new Map(nodes).set(message.node.id, message.node);
        render();
        break;

      case 'edgeAdded':
        edges = new Map(edges).set(message.edge.id, message.edge);
        render();
        break;

      case 'nodeUpdated':
        if (nodes.has(message.nodeId)) {
          const updated = new Map(nodes);
          const existing = updated.get(message.nodeId)!;
          updated.set(message.nodeId, { ...existing, ...message.updates });
          nodes = updated;
          render();
        }
        break;

      case 'layoutUpdated':
        if (nodes.has(message.nodeId)) {
          const node = nodes.get(message.nodeId)!;
          node.x = message.x;
          node.y = message.y;
          render();
        }
        break;

      case 'viewportChanged':
        viewport = message.viewport;
        render();
        break;
    }
  }

  /**
   * Apply a LayoutResult's positions to the nodes Map and auto-fit
   * the viewport. Pure presentation step — no engine choice baked in.
   */
  function applyLayoutResult(result: { nodes: Map<string, { x: number; y: number; width: number; height: number }>; bounds: { minX: number; minY: number; maxX: number; maxY: number } }): void {
    const updated = new Map<string, CanvasNode>();
    for (const [id, n] of nodes) {
      const pos = result.nodes.get(id);
      if (pos) {
        updated.set(id, { ...n, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
      } else {
        updated.set(id, n);
      }
    }
    nodes = updated;
    if (canvasRef && result.bounds.maxX > result.bounds.minX) {
      const cw = canvasRef.width / (window.devicePixelRatio || 1);
      const ch = canvasRef.height / (window.devicePixelRatio || 1);
      const margin = 40;
      const graphW = result.bounds.maxX - result.bounds.minX + margin * 2;
      const graphH = result.bounds.maxY - result.bounds.minY + margin * 2;
      const zoom = Math.min(cw / graphW, ch / graphH, 1);
      viewport = {
        x: -result.bounds.minX * zoom + (cw - graphW * zoom) / 2 + margin * zoom,
        y: -result.bounds.minY * zoom + (ch - graphH * zoom) / 2 + margin * zoom,
        zoom,
      };
    }
    render();
  }

  /**
   * Lay out the canvas when no saved positions exist.
   *
   * Strategy: use the deterministic phase-banded grid layout as the
   * primary engine — it always succeeds, has no graph-shape
   * preconditions, and shows the user something usable on first open.
   * ELK's `layered` algorithm has thrown null derefs on this graph
   * across multiple structural defenses (dedupe, edge filter,
   * full-phase coverage, version upgrade); until we have a clean
   * reproducer for ELK's specific complaint, "always shows
   * something" beats "may show nothing." ELK is still wired
   * underneath — `computeLayout(nodes, edges)` is reachable for a
   * future toolbar toggle or for graphs we know are well-shaped.
   *
   * Saved positions (from canvas_layout_state) still take precedence
   * — this function only fires when the host ships 0 layout records.
   */
  async function computeAndApplyAutoLayout(skipIds?: Set<string>): Promise<void> {
    const nodeArr = Array.from(nodes.values());
    // Compute grid over unpositioned nodes only. Nodes with a saved
    // position (skipIds) are excluded from the layout pass and keep
    // their persisted x/y. Pass-through is OK — `applyLayoutResult`
    // only mutates nodes whose id appears in `result.nodes`.
    const toLayout = skipIds && skipIds.size > 0
      ? nodeArr.filter(n => !skipIds.has(n.id))
      : nodeArr;
    try {
      const result = computeGridLayout(toLayout);
      // eslint-disable-next-line no-console
      console.log('[canvas-webview] grid layout computed', {
        positioned: result.nodes.size,
        skipped: nodeArr.length - toLayout.length,
        bounds: result.bounds,
      });
      applyLayoutResult(result);
    } catch (err) {
      // Grid is deterministic and shouldn't throw, but if it does,
      // surface the error rather than silently blank-canvasing.
      // eslint-disable-next-line no-console
      console.error('[canvas-webview] grid layout failed', err);
      render();
    }
  }

  // Suppress "imported but unused" — `computeLayout` is intentionally
  // kept available for a future user-toggle into the ELK engine once
  // the null-deref class is reproduced and fixed upstream or worked
  // around in our graph shape.
  void computeLayout;

  /**
   * Send a message to the extension host.
   */
  function sendMessage(message: CanvasInboundMessage) {
    vscode.postMessage(message);
  }

  /**
   * Render the canvas.
   * Wave 9: Full implementation with Canvas 2D renderer.
   */
  function render() {
    if (!ctx || !canvasRef) return;

    const width = canvasRef.width / (window.devicePixelRatio || 1);
    const height = canvasRef.height / (window.devicePixelRatio || 1);

    // Clear canvas. NB: Canvas 2D's fillStyle does NOT accept CSS
    // custom properties — `ctx.fillStyle = 'var(--x)'` is silently
    // ignored, leaving the prior color (default black). All canvas
    // colors are resolved through the styles/colors palette helper
    // which reads CSS vars via getComputedStyle and falls back to
    // hard-coded hex values. Without this, the canvas renders
    // black-on-black and looks blank.
    const palette = getCanvasColors();
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, width, height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Render order: nodes first, edges on top. The previous order
    // (edges → nodes) drew edges from center-of-rect to
    // center-of-rect, which then got entirely overpainted by the
    // node bodies — making the Dependencies toggle look like it did
    // nothing because the edges were already invisible. Drawing
    // edges last puts them on top so the toggle's effect is
    // visible. The center-to-center geometry still shows the line
    // crossing the node bodies, but at least the segment between
    // nodes is visible.
    renderPhaseBands();
    renderNodes();
    renderEdges();

    ctx.restore();
  }

  /**
   * Phase band labels in the design doc are top-of-band headers with
   * the phase name. We compute band rows on the fly: group positioned
   * nodes by phaseId, find min/max y per phase, then draw a label at
   * the band's top-left (in world coords). No persistent band geometry
   * is stored — bands are derived from current node positions, so user
   * drags can pull a node into a "wrong" band visually but the label
   * layout remains stable for unmoved nodes.
   */
  const PHASE_LABELS: Record<string, string> = {
    '0': 'Phase 0 — Workspace',
    '1': 'Phase 1 — Intent',
    '2': 'Phase 2 — Requirements',
    '3': 'Phase 3 — System Spec',
    '4': 'Phase 4 — Architecture',
    '5': 'Phase 5 — Technical Spec',
    '6': 'Phase 6 — Implementation',
    '7': 'Phase 7 — Test Planning',
    '8': 'Phase 8 — Evaluation',
    '9': 'Phase 9 — Execution',
    '10': 'Phase 10 — Deployment',
  };
  function renderPhaseBands() {
    if (!ctx || nodes.size === 0) return;
    const palette = getCanvasColors();
    const bandBounds = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>();
    nodes.forEach(node => {
      const b = bandBounds.get(node.phaseId);
      if (!b) {
        bandBounds.set(node.phaseId, {
          minX: node.x, maxX: node.x + node.width,
          minY: node.y, maxY: node.y + node.height,
        });
      } else {
        b.minX = Math.min(b.minX, node.x);
        b.maxX = Math.max(b.maxX, node.x + node.width);
        b.minY = Math.min(b.minY, node.y);
        b.maxY = Math.max(b.maxY, node.y + node.height);
      }
    });
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    bandBounds.forEach((b, phaseId) => {
      // Translucent band fill so users can see the grouping at a glance.
      ctx!.fillStyle = palette.surfaceContainerHigh;
      ctx!.globalAlpha = 0.15;
      ctx!.fillRect(b.minX - 20, b.minY - 36, b.maxX - b.minX + 40, b.maxY - b.minY + 56);
      ctx!.globalAlpha = 1;
      // Top divider line.
      ctx!.strokeStyle = palette.outline;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(b.minX - 20, b.minY - 36);
      ctx!.lineTo(b.maxX + 20, b.minY - 36);
      ctx!.stroke();
      // Label.
      ctx!.fillStyle = palette.onSurface;
      ctx!.fillText(PHASE_LABELS[phaseId] ?? `Phase ${phaseId}`, b.minX - 16, b.minY - 30);
    });
  }

  /**
   * Render all edges.
   */
  function renderEdges() {
    if (!ctx) return;

    edges.forEach(edge => {
      const source = nodes.get(edge.sourceId);
      const target = nodes.get(edge.targetId);

      if (!source || !target) return;

      // Skip dependency edges if hidden
      if (edge.type === 'depends_on' && !dependencyEdgesVisible) return;

      ctx!.beginPath();
      ctx!.moveTo(source.x + source.width / 2, source.y + source.height / 2);
      ctx!.lineTo(target.x + target.width / 2, target.y + target.height / 2);
      ctx!.strokeStyle = getEdgeColor(edge.type);
      ctx!.lineWidth = 1.5;
      ctx!.stroke();
    });
  }

  /**
   * Render all nodes.
   */
  /**
   * Trim `text` with an ellipsis until its measured width fits within
   * `maxWidth`. Returns the original string when it already fits.
   * Uses a binary search (bounded at length) so it stays cheap even
   * when render() runs every mousemove during drag.
   */
  function truncateToWidth(ctxRef: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (!text) return '';
    if (ctxRef.measureText(text).width <= maxWidth) return text;
    const ellipsis = '…';
    // Quick bail when even the ellipsis won't fit — return empty so
    // the rectangle just shows as a chip with no label.
    if (ctxRef.measureText(ellipsis).width > maxWidth) return '';
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const candidate = text.slice(0, mid) + ellipsis;
      if (ctxRef.measureText(candidate).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + ellipsis;
  }

  function renderNodes() {
    if (!ctx) return;

    // Resolved palette — see render() for why we can't use var(--x)
    // strings directly with Canvas 2D.
    const palette = getCanvasColors();
    nodes.forEach(node => {
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;

      // Node background
      ctx!.fillStyle = getNodeColor(node.type, isSelected, isHovered);
      ctx!.fillRect(node.x, node.y, node.width, node.height);

      // Node border
      ctx!.strokeStyle = isSelected ? palette.primary : palette.outline;
      ctx!.lineWidth = isSelected ? 2 : 1;
      ctx!.strokeRect(node.x, node.y, node.width, node.height);

      // Node label — clip + truncate so long descriptions (FR
       // action text, NFR threshold sentences) don't overflow the
       // rectangle and crash into neighboring labels. Strategy:
       //   1. clip drawing to the rect bounds (defensive)
       //   2. measure; if wider than (width - 12px padding), trim
       //      with an ellipsis until it fits
       //   3. draw with the maxWidth arg as a final guard
      ctx!.fillStyle = palette.onSurface;
      ctx!.font = '12px system-ui';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      const maxLabelW = Math.max(20, node.width - 12);
      const labelStr = truncateToWidth(ctx!, node.label ?? '', maxLabelW);
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(node.x, node.y, node.width, node.height);
      ctx!.clip();
      ctx!.fillText(labelStr, node.x + node.width / 2, node.y + node.height / 2, maxLabelW);
      ctx!.restore();
    });
  }

  /**
   * Get the color for an edge based on its type.
   */
  function getEdgeColor(type: string): string {
    // Canvas 2D fillStyle/strokeStyle does not resolve `var(--xxx)`
    // — the palette helper reads CSS vars via getComputedStyle and
    // returns concrete hex/rgb strings (or hard-coded fallbacks).
    const palette = getCanvasColors();
    const colors: Record<string, string> = {
      satisfies: palette.tertiary,
      depends_on: palette.outline,
      governs: palette.warning,
      derives_from: palette.primary,
      implements: palette.tertiary,
      tests: palette.primary,
    };
    return colors[type] ?? palette.outline;
  }

  /**
   * Get the background color for a node. The original implementation
   * mapped `type` → CSS-var lookup, but every type returned the same
   * `var(--surface-container)` value, so the type parameter was
   * effectively unused. Type differentiation lives on the border
   * (rendered separately in renderNodes via palette.outline /
   * palette.primary). `_type` is kept on the signature so future
   * per-type backgrounds can plug in without callsite churn.
   */
  function getNodeColor(_type: string, isSelected: boolean, isHovered: boolean): string {
    const palette = getCanvasColors();
    if (isSelected) return palette.primary;
    if (isHovered) return palette.surfaceContainerHigh;
    return palette.surfaceContainer;
  }

  /**
   * Handle window resize.
   */
  function handleResize() {
    initCanvas();
  }

  /**
   * Handle mouse down for drag start.
   */
  function handleMouseDown(event: MouseEvent) {
    const rect = canvasRef?.getBoundingClientRect();
    if (!rect) return;

    const x = (event.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (event.clientY - rect.top - viewport.y) / viewport.zoom;

    // Check if clicking on a node — mouse-down on a node starts a node drag.
    for (const [id, node] of nodes) {
      if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
        isDragging = true;
        dragNodeId = id;
        selectedNodeId = id;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        render();
        return;
      }
    }

    // Empty-space click — deselect AND start a viewport pan. Panning
    // continues until mouseup; subsequent mousemove deltas translate
    // the viewport rather than any node. This is the only way to
    // navigate the canvas at zoom-out levels (no scrollbars).
    selectedNodeId = null;
    isPanning = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    render();
  }

  /**
   * Handle mouse move for dragging or panning.
   */
  function handleMouseMove(event: MouseEvent) {
    if (isDragging && dragNodeId) {
      // Node drag: deltas are scaled by zoom (we want the node to
      // follow the cursor in world coordinates).
      const dx = (event.clientX - lastMouseX) / viewport.zoom;
      const dy = (event.clientY - lastMouseY) / viewport.zoom;
      const node = nodes.get(dragNodeId);
      if (node) {
        node.x += dx;
        node.y += dy;
        render();
      }
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      return;
    }
    if (isPanning) {
      // Pan: deltas applied directly to viewport.x/y in screen space.
      // No zoom division — cursor and content move 1:1 visually.
      viewport = {
        x: viewport.x + (event.clientX - lastMouseX),
        y: viewport.y + (event.clientY - lastMouseY),
        zoom: viewport.zoom,
      };
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      render();
    }
  }

  /**
   * Handle mouse up for drag/pan end.
   */
  function handleMouseUp() {
    if (isDragging && dragNodeId) {
      const node = nodes.get(dragNodeId);
      if (node) {
        sendMessage({
          type: 'persistPosition',
          nodeId: dragNodeId,
          x: node.x,
          y: node.y,
        });
      }
    }

    isDragging = false;
    dragNodeId = null;
    isPanning = false;
  }

  /**
   * Handle wheel for zoom.
   */
  function handleWheel(event: WheelEvent) {
    event.preventDefault();

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * delta));

    viewport = { ...viewport, zoom: newZoom };
    render();

    sendMessage({ type: 'zoomChanged', zoom: newZoom });
  }

  /**
   * Zoom in by one step.
   */
  function handleZoomIn() {
    const newZoom = Math.min(5, viewport.zoom * 1.2);
    viewport = { ...viewport, zoom: newZoom };
    render();
    sendMessage({ type: 'zoomChanged', zoom: newZoom });
  }

  /**
   * Zoom out by one step.
   */
  function handleZoomOut() {
    const newZoom = Math.max(0.1, viewport.zoom / 1.2);
    viewport = { ...viewport, zoom: newZoom };
    render();
    sendMessage({ type: 'zoomChanged', zoom: newZoom });
  }

  /**
   * Fit all nodes in viewport.
   */
  function handleFitAll() {
    if (nodes.size === 0) return;

    // Calculate bounds of all nodes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    });

    if (minX === Infinity) return;

    const canvasWidth = canvasRef?.width ?? 800;
    const canvasHeight = canvasRef?.height ?? 600;
    const padding = 50;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 2);

    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    viewport = {
      x: canvasWidth / 2 - centerX * newZoom,
      y: canvasHeight / 2 - centerY * newZoom,
      zoom: newZoom,
    };

    render();
    sendMessage({ type: 'fitAll' });
  }

  /**
   * Discard saved positions for the current run, recompute the grid
   * layout from scratch, and tell the host to clear canvas_layout_state.
   * Useful after debugging drags leave the canvas in a chaotic state.
   */
  function handleResetLayout() {
    sendMessage({ type: 'resetLayout' });
    void computeAndApplyAutoLayout();
  }

  /**
   * Toggle dependency edge visibility.
   */
  function handleToggleDependencyEdges() {
    dependencyEdgesVisible = !dependencyEdgesVisible;
    render();
    sendMessage({ type: 'toggleDependencyEdges', visible: dependencyEdgesVisible });
  }

  /**
   * Close detail panel.
   */
  function handleCloseDetailPanel() {
    selectedNodeId = null;
    render();
  }

  /**
   * Get the currently selected node.
   */
  function getSelectedNode(): CanvasNode | null {
    if (!selectedNodeId) return null;
    return nodes.get(selectedNodeId) ?? null;
  }
</script>

<div class="canvas-container">
  <canvas
    bind:this={canvasRef}
    onresize={handleResize}
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
    onwheel={handleWheel}
  ></canvas>

  <Toolbar
    zoom={viewport.zoom}
    dependencyEdgesVisible={dependencyEdgesVisible}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
    onFitAll={handleFitAll}
    onToggleDependencyEdges={handleToggleDependencyEdges}
    onResetLayout={handleResetLayout}
  />

  {#if selectedNodeId}
    <DetailPanel
      node={getSelectedNode()}
      onClose={handleCloseDetailPanel}
    />
  {/if}
</div>

<style>
  .canvas-container {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--surface-0);
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
  }

  canvas:active {
    cursor: grabbing;
  }
</style>
