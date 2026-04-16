/**
 * Toolbar Component.
 *
 * Provides controls for canvas manipulation including zoom, fit, and
 * edge visibility toggles.
 *
 * Wave 12: Toolbar + Controls
 */

<script lang="ts">
  interface Props {
    zoom: number;
    dependencyEdgesVisible: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitAll: () => void;
    onToggleDependencyEdges: () => void;
  }

  let {
    zoom,
    dependencyEdgesVisible,
    onZoomIn,
    onZoomOut,
    onFitAll,
    onToggleDependencyEdges,
  }: Props = $props();

  function formatZoom(value: number): string {
    return `${Math.round(value * 100)}%`;
  }
</script>

<div class="toolbar">
  <div class="toolbar-group zoom-controls">
    <button
      class="toolbar-btn"
      onclick={onZoomOut}
      aria-label="Zoom out"
      title="Zoom out"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 8h12v1H2z"/>
      </svg>
    </button>
    <span class="zoom-value">{formatZoom(zoom)}</span>
    <button
      class="toolbar-btn"
      onclick={onZoomIn}
      aria-label="Zoom in"
      title="Zoom in"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 7.5h5V2h1v5.5h5v1h-5V14H7V8.5H2z"/>
      </svg>
    </button>
  </div>

  <div class="toolbar-separator"></div>

  <div class="toolbar-group">
    <button
      class="toolbar-btn"
      onclick={onFitAll}
      aria-label="Fit all nodes"
      title="Fit all"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 1h5v1H2v4H1zm14 0v5h-1V2h-4V1zm0 14h-5v-1h4v-4h1zM2 14h4v1H1v-5h1z"/>
      </svg>
    </button>
  </div>

  <div class="toolbar-separator"></div>

  <div class="toolbar-group">
    <button
      class="toolbar-btn toggle-btn"
      class:active={dependencyEdgesVisible}
      onclick={onToggleDependencyEdges}
      aria-label="Toggle dependency edges"
      title="Toggle dependency edges"
      aria-pressed={dependencyEdgesVisible}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v12H2zm1 1v10h10V3z"/>
        <path d="M5 5h2v2H5zm4 4h2v2H9z"/>
        <path d="M6 6l4 4"/>
      </svg>
      <span class="btn-label">Dependencies</span>
    </button>
  </div>
</div>

<style>
  .toolbar {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-container);
    border: 1px solid var(--outline);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-separator {
    width: 1px;
    height: 24px;
    background: var(--outline);
    margin: 0 4px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--on-surface);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .toolbar-btn:hover {
    background: var(--surface-container-high);
  }

  .toolbar-btn:active {
    background: var(--surface-container-highest);
  }

  .toggle-btn.active {
    background: var(--primary-container);
    color: var(--on-primary-container);
  }

  .toggle-btn.active:hover {
    background: var(--primary-container);
  }

  .zoom-value {
    min-width: 48px;
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--on-surface);
    font-variant-numeric: tabular-nums;
  }

  .btn-label {
    font-size: 11px;
    font-weight: 500;
  }

  svg {
    flex-shrink: 0;
  }
</style>
