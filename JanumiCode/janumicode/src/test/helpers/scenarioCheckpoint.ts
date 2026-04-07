/**
 * Scenario Checkpoint Helpers — supports per-checkpoint resumable end-to-end
 * tests. The persistent DB at `test-output/checkpoints/<scenario>.db` IS the
 * fixture; this module just gives tests a typed way to ask "have we reached
 * checkpoint X yet?" and to compose paths consistently.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { IntakeSubState, ProposerPhase } from '../../lib/types/intake';
import { ArchitectureSubState } from '../../lib/types/architecture';

// Resolve from src/test/helpers → JanumiCode/janumicode/test-output
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
export const TEST_OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-output');
export const CHECKPOINT_DIR = path.join(TEST_OUTPUT_DIR, 'checkpoints');
export const ARTIFACT_DIR = path.join(TEST_OUTPUT_DIR, 'artifacts');

export function checkpointDbPath(scenario: string): string {
	return path.join(CHECKPOINT_DIR, `${scenario}.db`);
}

export function scenarioArtifactDir(scenario: string): string {
	return path.join(ARTIFACT_DIR, scenario);
}

export function ensureCheckpointDirs(): void {
	fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
	fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

/**
 * Ordered checkpoints for the architecture-flow scenario. Numeric values
 * encode progression — `>=` comparisons answer "have we passed this point?"
 *
 * INTAKE checkpoints map to the proposer round just completed; ARCHITECTURE
 * checkpoints map to the architecture sub-state just entered.
 */
export enum ArchScenarioCheckpoint {
	NONE = 0,
	INTAKE_PRODUCT_REVIEW = 1,           // After INTENT_DISCOVERY → PRODUCT_REVIEW (initial MMP)
	INTAKE_BUSINESS_DOMAINS = 2,         // Proposer round 1 complete
	INTAKE_JOURNEYS = 3,                 // Proposer round 2 complete
	INTAKE_ENTITIES = 4,                 // Proposer round 3 complete
	INTAKE_INTEGRATIONS = 5,             // Proposer round 4 complete
	INTAKE_AWAITING_APPROVAL = 6,        // Plan finalized, awaiting human approval
	ARCH_TECHNICAL_ANALYSIS = 7,         // ARCHITECTURE phase entered, in TECHNICAL_ANALYSIS
	ARCH_DECOMPOSING = 8,
	ARCH_MODELING = 9,
	ARCH_DESIGNING = 10,
	ARCH_PRESENTING = 11,
}

/**
 * Snapshot of the relevant workflow state needed to derive a checkpoint.
 * Produced by `WorkflowTestDriver.findResumableDialogue`.
 */
export interface ResumableSnapshot {
	dialogueId: string;
	currentPhase: string;          // e.g., 'INTAKE', 'ARCHITECTURE'
	intakeSubState: IntakeSubState | null;
	proposerPhase: ProposerPhase | null;
	architectureSubState: ArchitectureSubState | null;
	awaitingInput: boolean;
}

/**
 * Map a workflow snapshot to the highest checkpoint it has reached.
 * Returns NONE for an empty/uninitialized DB.
 */
export function describeCheckpoint(snap: ResumableSnapshot | null): ArchScenarioCheckpoint {
	if (!snap) { return ArchScenarioCheckpoint.NONE; }

	if (snap.currentPhase === 'ARCHITECTURE') {
		switch (snap.architectureSubState) {
			case ArchitectureSubState.PRESENTING:
				return ArchScenarioCheckpoint.ARCH_PRESENTING;
			case ArchitectureSubState.DESIGNING:
			case ArchitectureSubState.VALIDATING:
				return ArchScenarioCheckpoint.ARCH_DESIGNING;
			case ArchitectureSubState.MODELING:
				return ArchScenarioCheckpoint.ARCH_MODELING;
			case ArchitectureSubState.DECOMPOSING:
				return ArchScenarioCheckpoint.ARCH_DECOMPOSING;
			case ArchitectureSubState.TECHNICAL_ANALYSIS:
			case ArchitectureSubState.SEQUENCING:
			default:
				return ArchScenarioCheckpoint.ARCH_TECHNICAL_ANALYSIS;
		}
	}

	if (snap.currentPhase === 'INTAKE') {
		if (snap.intakeSubState === IntakeSubState.AWAITING_APPROVAL) {
			return ArchScenarioCheckpoint.INTAKE_AWAITING_APPROVAL;
		}
		// Map proposer rounds — round N just completed = checkpoint N+1
		if (snap.proposerPhase === ProposerPhase.INTEGRATION_QUALITY) {
			return ArchScenarioCheckpoint.INTAKE_INTEGRATIONS;
		}
		if (snap.proposerPhase === ProposerPhase.ENTITY_DATA_MODEL) {
			return ArchScenarioCheckpoint.INTAKE_ENTITIES;
		}
		if (snap.proposerPhase === ProposerPhase.JOURNEY_WORKFLOW) {
			return ArchScenarioCheckpoint.INTAKE_JOURNEYS;
		}
		if (snap.proposerPhase === ProposerPhase.BUSINESS_DOMAIN_MAPPING) {
			return ArchScenarioCheckpoint.INTAKE_BUSINESS_DOMAINS;
		}
		if (snap.intakeSubState === IntakeSubState.PRODUCT_REVIEW) {
			return ArchScenarioCheckpoint.INTAKE_PRODUCT_REVIEW;
		}
	}

	return ArchScenarioCheckpoint.NONE;
}

/**
 * Returns true if the snapshot has reached or passed the requested checkpoint.
 * Use this in `it()` cases to short-circuit work that has already been done.
 */
export function isCheckpointPast(
	snap: ResumableSnapshot | null,
	target: ArchScenarioCheckpoint,
): boolean {
	return describeCheckpoint(snap) >= target;
}

/** Friendly name for logging. */
export function checkpointName(cp: ArchScenarioCheckpoint): string {
	return ArchScenarioCheckpoint[cp] ?? `UNKNOWN(${cp})`;
}
