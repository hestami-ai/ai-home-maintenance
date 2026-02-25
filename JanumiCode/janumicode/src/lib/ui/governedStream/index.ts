/**
 * Governed Stream Module
 * Unified webview for the JanumiCode Governed Stream UI
 */

export { GovernedStreamViewProvider } from './GovernedStreamPanel';
export type { GovernedStreamState, ClaimHealthSummary, StreamItem, PhaseMilestone } from './dataAggregator';
export { aggregateStreamState, computeClaimHealth, WORKFLOW_PHASES } from './dataAggregator';
