// @janumipwb/rph-application — the command/query core. Depends on the StorageAdapter port, not on any
// concrete store.
export const RPH_APPLICATION_VERSION = '0.0.0';

export { Engine } from './command-bus.js';
export type { BatchResult, EngineDeps, EventSubscriber } from './command-bus.js';
export { HANDLERS } from './handlers/registry.js';
export type { CommandHandler, HandlerContext } from './handlers/kit.js';
