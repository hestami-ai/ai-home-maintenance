/**
 * JanumiCode v2 — Webview Client Entry Point
 *
 * Mounts the Svelte 5 App component into the #app element.
 *
 * The inline bootstrap script in the provider HTML already called
 * acquireVsCodeApi() and stashed the result on `window.__janumiVscode` so
 * uncaught errors get forwarded to the extension host. We reuse that
 * handle here — calling acquireVsCodeApi() again would throw.
 */

import { mount } from 'svelte';
import App from './App.svelte';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    __janumiVscode?: VsCodeApi;
  }
}

declare function acquireVsCodeApi(): VsCodeApi;

function log(level: 'info' | 'warn' | 'error', message: string): void {
  const v = window.__janumiVscode;
  if (v) {
    try { v.postMessage({ type: 'webviewLog', level, message }); } catch { /* nothing */ }
  }
}

function postError(message: string, stack?: string): void {
  const v = window.__janumiVscode;
  if (v) {
    try { v.postMessage({ type: 'webviewError', message, stack }); } catch { /* nothing */ }
  }
}

function bootstrap(): void {
  log('info', 'main.ts loaded; resolving vscode handle');

  // Reuse the handle from the inline bootstrap script. Fall back to
  // acquireVsCodeApi() only if for some reason the inline script did not run.
  let vscode = window.__janumiVscode;
  if (!vscode) {
    try {
      vscode = acquireVsCodeApi();
      window.__janumiVscode = vscode;
    } catch (err) {
      // No way to report this — the inline script's vscode handle was missing
      // AND we can't acquire one. Render a visible error so the user sees it.
      const target = document.getElementById('app');
      if (target) {
        target.innerHTML = '<div style="padding:16px;color:#f88">Failed to acquire VS Code API: ' +
          (err instanceof Error ? err.message : String(err)) + '</div>';
      }
      return;
    }
  }

  const target = document.getElementById('app');
  if (!target) {
    postError('Mount target #app missing from DOM at main.ts entry');
    return;
  }

  log('info', 'mounting Svelte App component');
  try {
    // Clear the static fallback before mounting so Svelte starts from a clean target.
    target.innerHTML = '';
    mount(App, {
      target,
      props: { vscode },
    });
    log('info', 'Svelte App mounted successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    postError('Svelte mount() threw: ' + message, stack);
    target.innerHTML =
      '<div style="padding:16px;color:#f88">Svelte mount failed: ' + message + '</div>';
  }
}

bootstrap();
