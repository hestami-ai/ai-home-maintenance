/**
 * Contract harness — central registry of all contract suites.
 *
 * Order is bottom-of-ladder first (Phase 9/10), then climbing
 * upward to Phase 0. The diagnose CLI evaluates in registration order
 * so the first failure reported is the one closest to the symptom.
 *
 * Each suite is typed against its specific artifact shape. The
 * registry erases that to ContractSuite<unknown> via a single cast
 * because TArtifact appears contravariantly in `check` and cannot be
 * implicitly widened. The runner re-narrows when invoked.
 */

import type { ContractSuite } from './types';

import { phase10PreCommitConsistencyCheckContract } from './phase10-pre-commit-consistency-check.contract';
import { phase9PacketSynthesisContract } from './phase9-packet-synthesis.contract';
import { phase9ImplementationTaskExecutionContract } from './phase9-implementation-task-execution.contract';
import { phase9TestExecutionContract } from './phase9-test-execution.contract';
import { phase9EvaluationExecutionContract } from './phase9-evaluation-execution.contract';
import { phase8FunctionalEvaluationContract } from './phase8-functional-evaluation.contract';
import { phase8QualityEvaluationContract } from './phase8-quality-evaluation.contract';
import { phase8ReasoningEvaluationContract } from './phase8-reasoning-evaluation.contract';
import { phase7TestCaseSkeletonContract } from './phase7-test-case-skeleton.contract';
import { phase7TestCaseSaturationContract } from './phase7-test-case-saturation.contract';
import { phase6TaskSkeletonContract } from './phase6-task-skeleton.contract';
import { phase6TaskSaturationContract } from './phase6-task-saturation.contract';
import { phase5DataModelsContract } from './phase5-data-models.contract';
import { phase5DataModelSaturationContract } from './phase5-data-model-saturation.contract';
import { phase5ApiDefinitionsContract } from './phase5-api-definitions.contract';
import { phase5ErrorHandlingContract } from './phase5-error-handling.contract';
import { phase5ConfigParametersContract } from './phase5-configuration-parameters.contract';
import { phase4ComponentSkeletonContract } from './phase4-component-skeleton.contract';
import { phase4ComponentSaturationContract } from './phase4-component-saturation.contract';
import { phase4SoftwareDomainsContract } from './phase4-software-domains.contract';
import { phase4AdrCaptureContract } from './phase4-adr-capture.contract';
import { phase3SystemBoundaryContract } from './phase3-system-boundary.contract';
import { phase3SystemRequirementsContract } from './phase3-system-requirements.contract';
import { phase3InterfaceContractsContract } from './phase3-interface-contracts.contract';
import { phase2FrBloomSkeletonContract } from './phase2-fr-bloom-skeleton.contract';
import { phase2FrSaturationContract } from './phase2-fr-saturation.contract';
import { phase2NfrBloomSkeletonContract } from './phase2-nfr-bloom-skeleton.contract';
import { phase2NfrSaturationContract } from './phase2-nfr-saturation.contract';
import { phase1UserJourneyBloomContract } from './phase1-user-journey-bloom.contract';
import { phase1EntitiesBloomContract } from './phase1-entities-bloom.contract';
import { phase1BusinessDomainsBloomContract } from './phase1-business-domains-bloom.contract';
import { phase1SystemWorkflowBloomContract } from './phase1-system-workflow-bloom.contract';
import { phase1ReleasePlanContract } from './phase1-release-plan.contract';
import { phase1TechnicalConstraintsContract } from './phase1-technical-constraints-discovery.contract';
import { phase1ComplianceRetentionContract } from './phase1-compliance-retention-discovery.contract';
import { phase1VvRequirementsContract } from './phase1-vv-requirements-discovery.contract';
import { phase1IntentLensClassificationContract } from './phase1-intent-lens-classification.contract';
import { phase1ProductIntentDiscoveryContract } from './phase1-product-intent-discovery.contract';
import { phase1ScopeBoundingContract } from './phase1-scope-bounding.contract';
import { phase1ProductDescriptionSynthesisContract } from './phase1-product-description-synthesis.contract';
import { phase1IntentQualityCheckContract } from './phase1-intent-quality-check.contract';
import { phase1CanonicalVocabularyContract } from './phase1-canonical-vocabulary-discovery.contract';
import { phase0WorkspaceClassificationContract } from './phase0-workspace-classification.contract';
import { phase0VocabularyCollisionCheckContract } from './phase0-vocabulary-collision-check.contract';

export const CONTRACT_SUITES: ReadonlyArray<ContractSuite<unknown>> = [
  // Phase 10 (last gate).
  phase10PreCommitConsistencyCheckContract,
  // Phase 9 — bottom of ladder (consumer side).
  phase9PacketSynthesisContract,
  phase9ImplementationTaskExecutionContract,
  phase9TestExecutionContract,
  phase9EvaluationExecutionContract,
  // Phase 8.
  phase8FunctionalEvaluationContract,
  phase8QualityEvaluationContract,
  phase8ReasoningEvaluationContract,
  // Phase 7.
  phase7TestCaseSkeletonContract,
  phase7TestCaseSaturationContract,
  // Phase 6.
  phase6TaskSkeletonContract,
  phase6TaskSaturationContract,
  // Phase 5.
  phase5DataModelsContract,
  phase5DataModelSaturationContract,
  phase5ApiDefinitionsContract,
  phase5ErrorHandlingContract,
  phase5ConfigParametersContract,
  // Phase 4.
  phase4ComponentSkeletonContract,
  phase4ComponentSaturationContract,
  phase4SoftwareDomainsContract,
  phase4AdrCaptureContract,
  // Phase 3.
  phase3SystemBoundaryContract,
  phase3SystemRequirementsContract,
  phase3InterfaceContractsContract,
  // Phase 2.
  phase2FrBloomSkeletonContract,
  phase2FrSaturationContract,
  phase2NfrBloomSkeletonContract,
  phase2NfrSaturationContract,
  // Phase 1.
  phase1UserJourneyBloomContract,
  phase1EntitiesBloomContract,
  phase1BusinessDomainsBloomContract,
  phase1SystemWorkflowBloomContract,
  phase1ReleasePlanContract,
  phase1TechnicalConstraintsContract,
  phase1ComplianceRetentionContract,
  phase1VvRequirementsContract,
  phase1IntentLensClassificationContract,
  phase1ProductIntentDiscoveryContract,
  phase1ScopeBoundingContract,
  phase1ProductDescriptionSynthesisContract,
  phase1IntentQualityCheckContract,
  phase1CanonicalVocabularyContract,
  // Phase 0.
  phase0WorkspaceClassificationContract,
  phase0VocabularyCollisionCheckContract,
] as unknown as ReadonlyArray<ContractSuite<unknown>>;

export function findSuite(boundaryId: string): ContractSuite<unknown> | undefined {
  return CONTRACT_SUITES.find((s) => s.boundaryId === boundaryId);
}

export function allBoundaryIds(): string[] {
  return CONTRACT_SUITES.map((s) => s.boundaryId);
}
