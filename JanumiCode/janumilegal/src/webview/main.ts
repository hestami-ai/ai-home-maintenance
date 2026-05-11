/**
 * Webview entry — Wave 7.
 *
 * Mounts the Svelte App component and bridges extension-host messages.
 */

import { mount } from 'svelte';
import App from './App.svelte';

const root = document.getElementById('root');
if (root) {
  mount(App, { target: root });
}
