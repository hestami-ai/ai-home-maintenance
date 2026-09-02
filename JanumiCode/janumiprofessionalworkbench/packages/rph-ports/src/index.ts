// @janumipwb/rph-ports — host-injectable port interfaces so the RPH engine holds zero platform/UI/host
// assumptions. Further ports (EventSink, IdentityProvider, CapabilityAuthorizer, ContentHasher, Clock,
// IdGenerator) land alongside the milestones that first need them.
//
// ArtifactStore LANDED 2026-09-02 under REG-D-049 — the seam DEF-W2-001 names, and the one PER-12 needs before
// retained model content can lawfully exist at all (its `purge` is what makes retention legal rather than
// merely possible).
export const RPH_PORTS_VERSION = '0.0.0';

export * from './ports/logger.js';
export * from './defaults/logger.js';
export * from './ports/storage.js';
export * from './ports/authentication.js';
export * from './ports/artifact-store.js';
export * from './defaults/artifact-store.js';
