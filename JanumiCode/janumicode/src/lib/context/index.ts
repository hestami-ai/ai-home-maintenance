/**
 * Context Management Module
 *
 * Contract-driven context handoff layer.
 * The Context Engineer agent assembles optimally budgeted briefings
 * for downstream LLM agents using declarative policies.
 */

// Context Engineer (main entry point — replaces compiler)
export { assembleContext } from './contextEngineer';

// Types
export * from './engineTypes';

// Policy registry
export { getPolicy, getAllPolicyKeys, CONTEXT_POLICIES } from './policyRegistry';

// Handoff document store
export {
	storeHandoffDocument,
	getLatestHandoffDocument,
	getHandoffDocuments,
	getHandoffDocumentsSince,
	deleteHandoffDocuments,
} from './handoffDocStore';

// Cache
export {
	computeFingerprint,
	getCachedPacket,
	cachePacket,
	invalidateForDialogue,
	clearContextCache,
	getCacheSize,
} from './contextCache';

// Workspace file reader (still used by orchestrator.ts)
export * from './workspaceReader';
