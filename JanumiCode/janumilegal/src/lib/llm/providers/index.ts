/**
 * Side-effect imports — registers all built-in providers in the global registry.
 *
 * Importing this module ensures `providerRegistry` knows about
 * 'mock', 'ollama', 'anthropic', 'google'. Real SDKs are still lazy-loaded
 * inside the factories.
 */

import '../mockProvider.js';
import './ollama.js';
import './anthropic.js';
import './google.js';

export {};
