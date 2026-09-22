// @janumipwb/rph-application — the command/query core. Depends on the StorageAdapter port, not on any
// concrete store.
export const RPH_APPLICATION_VERSION = '0.0.0';

export { Engine, memberOfGroup } from './command-bus.js';
// `memberOfGroup` is exported for the containment gate (`JAN-CRITREAD` `DD-6b`): the gate asks whether an
// aggregate a draft read by id is a member of a declared group, and it must ask with the SAME predicate the
// commit uses — a second copy of the rule in a test would answer a question the product does not ask.
export type { AuthedEngine } from './command-bus.js';
export type {
	BatchResult,
	DependencyGroup,
	DependencyKey,
	DependencyViolation,
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
// What an authoring turn's replay reads by id — ONE definition each, shared by the handler that reads it and the turn
// that must pin it (`JAN-CRITREAD` `DD-3`, `REG-D-070` §5.1).
export { newlyReferencedAssurancePolicyIds } from './handlers/pwa-authoring.js';
export { validatorNamedBy } from './handlers/assurance.js';
export type { OwnedLifecycleTarget } from './handlers/pwu.js';
export type { CommandHandler, HandlerContext } from './handlers/kit.js';
export { verifyExchangeContent, readAnswerSpan } from './exchange-resolution.js';
export type {
	RetentionVerdict,
	RefResolution,
	RetentionReport,
	ResolvableRef,
	ResolvableExchange,
	AnswerSpanRead
} from './exchange-resolution.js';
export { renderPromptTemplate, markersIn, promptTemplateFingerprint } from './prompt-render.js';
export type { RenderOutcome } from './prompt-render.js';
export {
	assembleStepContext,
	prepareModelInvocation,
	resolveInvocationSubject,
	resolvePwuTypeFacts
} from './execution-invocation.js';
export type { ContextAssembly, InvocationPlan, InvocationSubject } from './execution-invocation.js';
export * from './context-assembly.js';
