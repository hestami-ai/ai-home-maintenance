// @janumipwb/rph-domain — the pure, deterministic domain kernel: state machines, transition guards, and
// invariant predicates. No I/O; depends only on rph-contracts.
export const RPH_DOMAIN_VERSION = '0.0.0';

export * from './transitions.data.js';
export * from './machine-exclusions.js';
export * from './stateMachine.js';
export * from './pwuGuards.js';
export * from './traceability.js';
export * from './decomposition.js';
export * from './governance.js';
export * from './execution.js';
export * from './transition-gate.js';
export * from './plan-proposal.js';
export * from './step-command-spec.js';
export * from './pwu-lifecycle-command-spec.js';
export * from './condition-grammar.js';
export * from './presentation.js';
export * from './conformance-manifest.js';
export * from './enforcement-register.js';
export * from './execution-failure-taxonomy.js';
export * from './aggregate-assurance.js';
