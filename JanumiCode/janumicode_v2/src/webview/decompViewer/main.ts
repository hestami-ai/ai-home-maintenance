/**
 * Decomposition Viewer webview entry.
 *
 * Bootstraps the Svelte App and wires extension-host message plumbing
 * into a shared store. Messages:
 *   host → webview: init | snapshot_update | error
 *   webview → host: ready | refresh_requested | mmp_*
 */

import { mount } from 'svelte';
import App from './App.svelte';
import { setVsCodeApi, applySnapshot, showError } from './stores/snapshot';

declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

/**
 * Render a fatal-error banner directly into the webview DOM. Used for
 * problems that happen BEFORE Svelte can mount — otherwise the webview
 * is just blank and the dev has no signal at all.
 */
function renderFatal(msg: string, stack?: string): void {
  const target = document.getElementById('app') ?? document.body;
  target.innerHTML =
    '<div style="padding:16px;color:#f88;font-family:monospace;white-space:pre-wrap">' +
    'Decomp Viewer bootstrap failed:\n\n' + msg +
    (stack ? '\n\n' + stack : '') +
    '</div>';
}

try {
  const vscode = acquireVsCodeApi();
  setVsCodeApi(vscode);

  window.addEventListener('message', (event) => {
    const msg = event.data as { type: string; snapshot?: unknown; message?: string };
    switch (msg.type) {
      case 'init':
      case 'snapshot_update':
        if (msg.snapshot) applySnapshot(msg.snapshot);
        break;
      case 'error':
        if (typeof msg.message === 'string') showError(msg.message);
        break;
      default:
        break;
    }
  });

  const target = document.getElementById('app');
  if (!target) throw new Error('#app element missing from DOM');

  // Svelte 5 uses `mount(App, {...})`, not `new App({...})`.
  mount(App, { target });

  // Tell the host we're ready — host replies with the init snapshot.
  vscode.postMessage({ type: 'ready' });

  // Surface JS errors that occur after mount into the webview itself so
  // blank-viewer failures are self-describing.
  window.addEventListener('error', (e) => {
    renderFatal('Unhandled error: ' + (e.message ?? String(e.error ?? 'unknown')), e.error?.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    renderFatal('Unhandled promise rejection: ' + (reason?.message ?? String(reason)), reason?.stack);
  });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  renderFatal(msg, stack);
}
