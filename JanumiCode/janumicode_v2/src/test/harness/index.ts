/**
 * Test Harness - Re-exports for convenience.
 */

// Types
export type {
  DecisionOverride,
  GapReport,
  MissingRecord,
  SchemaViolation,
  AssertionFailure,
  SemanticWarning,
  HarnessResult,
  FixtureFile,
  FixtureManifest,
  PhaseContract,
  PhaseInvariant,
  AuthorityRule,
  RequiredArtifact,
  CorpusLock,
  TestIsolationConfig,
  PipelineRunnerConfig,
} from './types';

// Phase Contracts
export {
  PHASE0_CONTRACT,
  PHASE0_5_CONTRACT,
  PHASE1_CONTRACT,
  PHASE1_CONTRACT_PRODUCT,
  PHASE2_CONTRACT,
  PHASE2_CONTRACT_PRODUCT,
  PHASE3_CONTRACT,
  PHASE4_CONTRACT,
  PHASE5_CONTRACT,
  PHASE6_CONTRACT,
  PHASE7_CONTRACT,
  PHASE8_CONTRACT,
  PHASE9_CONTRACT,
  PHASE10_CONTRACT,
  PHASE_CONTRACTS,
  getPhaseContract,
  getRequiredArtifacts,
  getPhaseInvariants,
  getAuthorityRules,
} from './phaseContracts';

// Lineage Validator
export {
  validateLineage,
  buildGapReport,
  type LineageValidationResult,
} from './lineageValidator';

// Hestami Expectations
export {
  DEFAULT_EXPECTATIONS,
  FULL_WORKFLOW_EXPECTATIONS,
  validateExpectations,
  getExpectationsForPhase,
  getRequiredExpectations,
  getPreferredExpectations,
  type HestamiExpectation,
  type ExpectationResult,
} from './hestamiExpectations';

// Corpus Lock
export {
  createCorpusLock,
  saveCorpusLock,
  loadCorpusLock,
  verifyCorpusLock,
  checkFixtureDrift,
  getJanumicodeVersionSha,
  hashContent,
  getCorpusLockPath,
  ensureCorpusLock,
} from './corpusLock';

// Test Isolation
export {
  createIsolatedEnvironment,
  createParallelEnvironments,
  withIsolation,
  withParallelIsolation,
  createFixtureWorkspace,
  snapshotEnvironment,
  restoreFromSnapshot,
  type IsolatedTestEnvironment,
} from './testIsolation';

// Wave 4: Gap Report Enhancer
export {
  enhanceGapReport,
  formatEnhancedGapReport,
  type EnhancedGapReport,
  type FailsafeTrigger,
} from './gapReportEnhancer';

// Wave 4: CI Failsafe
export {
  CIFailsafe,
  createFailsafeFromEnv,
  DEFAULT_FAILSAFE_CONFIG,
  type FailsafeConfig,
  type FailsafeStatus,
  type FailsafeTrigger as CIFailsafeTrigger,
  type FailsafeType,
} from './ciFailsafe';

// Wave 4: AI Spend Guard
export {
  AISpendGuard,
  createSpendGuardFromEnv,
  DEFAULT_PRICING,
  type PricingTier,
  type SpendRecord,
  type SpendSummary,
  type BudgetAlert,
} from './aiSpendGuard';

// Wave 5-6: Rolling Coverage
export {
  RollingCoverageTracker,
  parseLcovFile,
  getPhaseFromPath,
  groupCoverageByPhase,
  type CoveragePoint,
  type CoverageTrend,
  type CoverageRegression,
  type CoverageReport,
} from './rollingCoverage';

// Wave 5-6: Phase Iteration
export {
  PhaseIterator,
  loadPhaseFixtures,
  collectPhaseRecords,
  isPhaseComplete,
  createFullWorkflowConfig,
  createPhaseRangeConfig,
  runPhaseIteration,
  type PhaseIterationConfig,
  type PhaseIterationResult,
  type IterationState,
} from './phaseIteration';
