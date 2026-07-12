// @janumipwb/rph-ports — host-injectable port interfaces so the RPH engine holds zero platform/UI/host
// assumptions. Further ports (StorageAdapter, EventSink, IdentityProvider, CapabilityAuthorizer,
// ArtifactStore, ContentHasher, Clock, IdGenerator) land alongside the milestones that first need them.
export const RPH_PORTS_VERSION = '0.0.0';

export * from './ports/logger.js';
export * from './defaults/logger.js';
export * from './ports/storage.js';
