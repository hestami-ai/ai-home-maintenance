/**
 * Architecture Canvas Webview Entry Point.
 *
 * Renders the interactive architecture canvas using Svelte + Canvas 2D.
 * Uses the JanumiCode design system for styling.
 */

import App from './App.svelte';

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
