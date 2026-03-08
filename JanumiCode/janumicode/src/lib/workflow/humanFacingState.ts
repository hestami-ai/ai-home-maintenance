/**
 * Human-Facing State Mapping Layer
 *
 * Maps internal workflow phases + context into clear, compact states
 * that the user sees in the Governed Stream UI. Replaces raw phase
 * names with human-simple labels per the target architecture doc.
 */

import { Phase } from '../types';
import { HumanFacingState, type HumanFacingStatus } from '../types/maker';

export interface HumanFacingContext {
	hasOpenGates: boolean;
	isRepairing?: boolean;
	intakeSubState?: string;        // 'DISCUSSING' | 'SYNTHESIZING' | 'AWAITING_APPROVAL'
	unitsCompleted?: number;
	unitsTotal?: number;
	currentUnitLabel?: string;
}

/**
 * Resolve the human-facing state from internal phase + context.
 * Priority: gate-blocked override > phase-specific > default.
 */
export function resolveHumanFacingState(
	phase: Phase,
	context: HumanFacingContext
): HumanFacingStatus {

	// Gate-blocked override (except for REVIEW which IS a gate phase)
	if (context.hasOpenGates && phase !== Phase.REVIEW) {
		return {
			state: HumanFacingState.BLOCKED,
			detail: 'Waiting for your decision on a blocking issue.',
		};
	}

	switch (phase) {
		case Phase.INTAKE: {
			switch (context.intakeSubState) {
				case 'SYNTHESIZING':
					return {
						state: HumanFacingState.FRAMING,
						detail: 'Synthesizing your requirements into a structured plan.',
					};
				case 'AWAITING_APPROVAL':
					return {
						state: HumanFacingState.NEEDS_INPUT,
						detail: 'Plan ready for your review and approval.',
					};
				default: // DISCUSSING or undefined
					return {
						state: HumanFacingState.UNDERSTANDING,
						detail: 'Grounding your request in the workspace, specs, and prior context.',
					};
			}
		}

		case Phase.PROPOSE:
			return {
				state: HumanFacingState.PLANNING,
				detail: 'Decomposing the work and building a task graph.',
			};

		case Phase.ASSUMPTION_SURFACING:
			return {
				state: HumanFacingState.PLANNING,
				detail: 'Surfacing assumptions and extracting verifiable claims.',
			};

		case Phase.VERIFY:
			return {
				state: HumanFacingState.VERIFYING,
				detail: 'Validating assumptions against evidence and constraints.',
			};

		case Phase.HISTORICAL_CHECK:
			return {
				state: HumanFacingState.VERIFYING,
				detail: 'Checking against prior decisions and historical patterns.',
			};

		case Phase.REVIEW:
			return {
				state: HumanFacingState.NEEDS_INPUT,
				detail: 'Proposal verified and ready for your approval.',
			};

		case Phase.EXECUTE: {
			if (context.isRepairing) {
				return {
					state: HumanFacingState.REPAIRING,
					detail: context.currentUnitLabel
						? `Auto-repairing: ${context.currentUnitLabel}`
						: 'Attempting automatic repair of a validation failure.',
					progress: context.unitsTotal
						? { completed: context.unitsCompleted ?? 0, total: context.unitsTotal }
						: undefined,
					currentUnit: context.currentUnitLabel,
				};
			}
			return {
				state: HumanFacingState.EXECUTING,
				detail: context.currentUnitLabel
					? `Executing: ${context.currentUnitLabel}`
					: 'Applying changes and running validations.',
				progress: context.unitsTotal
					? { completed: context.unitsCompleted ?? 0, total: context.unitsTotal }
					: undefined,
				currentUnit: context.currentUnitLabel,
			};
		}

		case Phase.VALIDATE:
			return {
				state: HumanFacingState.VERIFYING,
				detail: 'Running acceptance contract validations.',
			};

		case Phase.COMMIT:
			return {
				state: HumanFacingState.COMPLETE,
				detail: 'Work completed and validated.',
			};

		case Phase.REPLAN:
			return {
				state: HumanFacingState.PLANNING,
				detail: 'Incorporating feedback and replanning the approach.',
			};

		default:
			return {
				state: HumanFacingState.UNDERSTANDING,
				detail: `Phase: ${phase}`,
			};
	}
}

/**
 * Get a short label for the human-facing state (for status badges, headers).
 */
export function getHumanFacingStateLabel(state: HumanFacingState): string {
	return state; // The enum values are already display-friendly
}

/**
 * Get the CSS class suffix for styling the state indicator.
 */
export function getHumanFacingStateClass(state: HumanFacingState): string {
	switch (state) {
		case HumanFacingState.UNDERSTANDING: return 'understanding';
		case HumanFacingState.FRAMING: return 'framing';
		case HumanFacingState.NEEDS_INPUT: return 'needs-input';
		case HumanFacingState.PLANNING: return 'planning';
		case HumanFacingState.VERIFYING: return 'verifying';
		case HumanFacingState.EXECUTING: return 'executing';
		case HumanFacingState.REPAIRING: return 'repairing';
		case HumanFacingState.BLOCKED: return 'blocked';
		case HumanFacingState.COMPLETE: return 'complete';
	}
}
