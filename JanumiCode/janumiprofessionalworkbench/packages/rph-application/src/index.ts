// @janumipwb/rph-application — the command/query core. Depends on the StorageAdapter port, not on any
// concrete store.
export const RPH_APPLICATION_VERSION = '0.0.0';

export { Engine } from './command-bus.js';
export type { AuthedEngine } from './command-bus.js';
export type {
	BatchResult,
	EngineDeps,
	EventSubscriber,
	ObjectPostcondition,
	ObjectPostconditionConflict,
	RevisionGuardConflict,
	RevisionPrecondition
} from './command-bus.js';
export { HANDLERS } from './handlers/registry.js';
// The arrow -> owning-command table. Exported so CONTROLS can DERIVE from it rather than restate it:
// `pwu-fold-drive-sites.test.ts` (REG-F-084) walks every row to check the event is emitted by some test.
// Restating this list in a control is how it rots — five files already name its rows in prose.
export { PWU_SEMANTIC_LIFECYCLE_COMMANDS } from './handlers/pwu.js';
export type { OwnedLifecycleTarget } from './handlers/pwu.js';
export type { CommandHandler, HandlerContext } from './handlers/kit.js';
