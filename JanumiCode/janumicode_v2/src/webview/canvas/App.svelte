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
  let lastMouseX = $state(0);
  let lastMouseY = $state(0);

  onMount(() => {
    if (canvasRef) {
      ctx = canvasRef.getContext('2d');
      initCanvas();
    }

    // Listen for messages from extension host
    window.addEventListener('message', handleMessage);

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
        render();
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

    // Clear canvas
    ctx.fillStyle = 'var(--surface-0)';
    ctx.fillRect(0, 0, width, height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Render edges (Wave 9)
    renderEdges();

    // Render nodes (Wave 9)
    renderNodes();

    ctx.restore();
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
  function renderNodes() {
    if (!ctx) return;

    nodes.forEach(node => {
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;

      // Node background
      ctx!.fillStyle = getNodeColor(node.type, isSelected, isHovered);
      ctx!.fillRect(node.x, node.y, node.width, node.height);

      // Node border
      ctx!.strokeStyle = isSelected ? 'var(--primary)' : 'var(--outline)';
      ctx!.lineWidth = isSelected ? 2 : 1;
      ctx!.strokeRect(node.x, node.y, node.width, node.height);

      // Node label
      ctx!.fillStyle = 'var(--on-surface)';
      ctx!.font = '12px system-ui';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(node.label, node.x + node.width / 2, node.y + node.height / 2);
    });
  }

  /**
   * Get the color for an edge based on its type.
   */
  function getEdgeColor(type: string): string {
    const colors: Record<string, string> = {
      satisfies: 'var(--tertiary)',
      depends_on: 'var(--outline)',
      governs: 'var(--warning)',
      derives_from: 'var(--primary)',
      implements: 'var(--tertiary)',
      tests: 'var(--primary)',
    };
    return colors[type] ?? 'var(--outline)';
  }

  /**
   * Get the color for a node based on its type.
   */
  function getNodeColor(type: string, isSelected: boolean, isHovered: boolean): string {
    if (isSelected) return 'var(--primary-container)';
    if (isHovered) return 'var(--surface-container-high)';

    const colors: Record<string, string> = {
      artifact: 'var(--surface-container)',
      requirement: 'var(--surface-container)',
      component: 'var(--surface-container)',
      adr: 'var(--surface-container)',
      test_case: 'var(--surface-container)',
    };
    return colors[type] ?? 'var(--surface-container)';
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

    // Check if clicking on a node
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

    // Clicking on empty space - deselect
    selectedNodeId = null;
    render();
  }

  /**
   * Handle mouse move for dragging.
   */
  function handleMouseMove(event: MouseEvent) {
    if (isDragging && dragNodeId) {
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
    }
  }

  /**
   * Handle mouse up for drag end.
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
