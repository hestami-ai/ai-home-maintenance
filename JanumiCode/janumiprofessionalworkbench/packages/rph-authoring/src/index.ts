// @janumipwb/rph-authoring — the PWA-authoring capability layer. The Node entry point exports the CapabilityBroker
// (READ + PROPOSE over the engine seam) and re-exports the catalog/help data. Browser surfaces that only need the
// catalog/help import the pure "@janumipwb/rph-authoring/catalog" subpath instead (no engine dependency).
export const RPH_AUTHORING_VERSION = '0.0.0';

export * from './catalog.js';
export * from './broker.js';
