/**
 * Architecture Canvas Webview Entry Point.
 *
 * Mounts the Svelte 5 App component. Defensive: any error during
 * bootstrap renders a fatal-error frame into #app instead of leaving
 * the panel blank, matching the decomp viewer's pattern. Without
 * this, the only visible signal of a webview failure is VS Code's
 * generic "view reported an error" with no log output.
 *
 * Note: VS Code's `acquireVsCodeApi()` can only be called once per
 * webview. The canvas's App.svelte handles the acquisition itself,
 * so this entry-point intentionally does NOT call it. Inbound
 * message logging here is a passive listener — addEventListener on
 * window does not consume the API handle.
 */

import { mount } from 'svelte';
import App from './App.svelte';

function renderFatal(msg: string, stack?: string): void {
  const target = document.getElementById('app');
  if (!target) return;
  // Use plain DOM so a malformed error message can't break the
  // fatal renderer itself. Inline styles bypass any CSS-load failure.
  target.style.cssText = 'padding:24px;font-family:monospace;color:#fff;background:#3b1d1d;height:100%;overflow:auto;';
  const h = document.createElement('h2');
  h.textContent = 'Architecture Canvas — fatal bootstrap error';
  h.style.cssText = 'margin:0 0 12px 0;font-size:14px;color:#ffb4ab;';
  const p = document.createElement('pre');
  p.textContent = msg + (stack ? '\n\n' + stack : '');
  p.style.cssText = 'white-space:pre-wrap;font-size:12px;line-height:1.5;margin:0;';
  target.appendChild(h);
  target.appendChild(p);
  // Mirror to the dev-tools console — devs open VS Code's
  // "Webview Developer Tools" to see this when the on-screen frame
  // is the only diagnostic.
  // eslint-disable-next-line no-console
  console.error('[canvas-webview] fatal:', msg, stack);
}

function main(): void {
  // eslint-disable-next-line no-console
  console.log('[canvas-webview] bootstrap starting');

  const target = document.getElementById('app');
  if (!target) {
    renderFatal('#app element missing from DOM at bootstrap time. The HTML host did not include the expected mount target.');
    return;
  }

  // Passive inbound-message logger. Helps diagnose "host posted but
  // webview ignored" vs "webview component logic discarded the
  // message" — the log fires unconditionally in the latter case.
  window.addEventListener('message', (event) => {
    const data = (event.data ?? {}) as { type?: string; nodes?: unknown[]; edges?: unknown[]; layout?: unknown[] };
    const summary: Record<string, unknown> = { type: data.type ?? '<unknown>' };
    if (Array.isArray(data.nodes)) summary.nodes = data.nodes.length;
    if (Array.isArray(data.edges)) summary.edges = data.edges.length;
    if (Array.isArray(data.layout)) summary.layout = data.layout.length;
    // eslint-disable-next-line no-console
    console.log('[canvas-webview] inbound message', summary);
  });

  try {
    // eslint-disable-next-line no-console
    console.log('[canvas-webview] mounting Svelte App');
    mount(App, { target });
    // eslint-disable-next-line no-console
    console.log('[canvas-webview] Svelte App mounted successfully');
  } catch (err) {
    renderFatal('Svelte App component failed to mount.', err instanceof Error ? err.stack : String(err));
  }
}

try {
  main();
} catch (err) {
  renderFatal('Unhandled error during bootstrap.', err instanceof Error ? err.stack : String(err));
}
