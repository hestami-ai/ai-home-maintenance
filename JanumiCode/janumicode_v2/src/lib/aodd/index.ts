/**
 * Public AODD surface.
 *
 * Importers should reach for `import { ... } from '@/lib/aodd'` (or
 * the relative path equivalent) rather than reaching into individual
 * submodules. The submodule layout is an implementation detail and
 * may shift as later phases land.
 */

// Types
export {
  AODD_SCHEMA_VERSION,
  type AoddEvent,
  type AoddEventPayload,
  type AoddEventType,
  type InvocationStep,
  type LogPayload,
  type PayloadRef,
  type RunInfo,
  type RunSummary,
  type SubPhaseDecisionRef,
  type SubPhaseEventRange,
  type SubPhaseFallback,
  type SubPhaseRecordRef,
  type SubPhaseSummary,
  type SubPhaseSummaryHow,
  type SubPhaseSummaryWhat,
  type SubPhaseSummaryWho,
  type SubPhaseSummaryWhy,
} from './types';

// Emit
export {
  closeStreams,
  emit,
  endRun,
  initialize,
  isAoddConfigured,
  isAoddEnabled,
  startRun,
  withAoddSpan,
  type EmitOptions,
} from './emit';

// ID canonicalization
export {
  phaseIdToFilenameSegment,
  subPhaseIdToFilenameSegment,
  type PhaseIdSegmentOptions,
} from './idCanonicalize';

// Payload store
export {
  configurePayloadStore,
  maybeSpillText,
  readPayload,
  shouldSpillStructured,
  shouldSpillText,
  writeStructuredPayload,
  writeTextPayload,
} from './payloadStore';

// Logger handler
export {
  AoddLogHandler,
  registerAoddLogHandler,
  unregisterAoddLogHandler,
} from './loggerHandler';

// Summary writers
export {
  deriveAndWriteOneSubPhaseSummary,
  deriveAndWriteSubPhaseSummaries,
  renderSubPhaseSummaryMd,
  writeSubPhaseSummary,
} from './summaryWriter';
export {
  deriveAndWriteRunSummary,
  renderRunSummaryMd,
  writeRunSummary,
} from './runSummaryWriter';
export {
  deriveRunSummary,
  deriveSubPhaseSummary,
  groupBySubPhase,
  readEventsFile,
} from './summaryDeriver';

// Retention (stub in P1; lands in P9)
export {
  DEFAULT_RETENTION,
  pruneAoddRuns,
  type PruneResult,
  type RetentionConfig,
} from './retention';

// Completeness + fixtures
export {
  check5WH,
  checkChainIntegrity,
  discoverFixtures,
  loadManifest,
  runFixture,
  runSpotChecks,
  type CompletenessFailure,
  type FixtureExpectedSubPhase,
  type FixtureManifest,
  type FixtureRunResult,
  type FixtureSpotCheck,
} from './completeness';

// Replay
export {
  listRuns,
  listSubPhaseSummaries,
  readCausedByChain,
  readEvents,
  readEventsSync,
  readParentChain,
  readPayloadByRef,
  readPayloadByUlid,
  readRunSummary,
  readRunSummaryMd,
  readSubPhaseSummary,
  readSubPhaseSummaryMd,
  type EventFilter,
} from './replay';

// Sub-phase boundary tracking (used by stateMachine.setSubPhase to
// fill the sub_phase.exited payload with real duration_ms + status).
export { consumeSubPhaseState } from './subPhaseTracker';

// Per-record-type structural summarizer for record.added envelopes.
export { summarizeRecordContent } from './recordSummary';

// ULID
export { mintUlid } from './ulid';
