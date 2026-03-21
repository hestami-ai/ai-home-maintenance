/**
 * Navigation Resolver
 *
 * Resolves fuzzy user input ("go back to decompose", "restart intake")
 * to concrete phase/sub-phase targets, and assesses navigation safety.
 *
 * Pure functions — no side effects, fully testable.
 */

import { Phase, GateStatus } from '../types';
import { IntakeSubState } from '../types/intake';
import { ArchitectureSubState } from '../types/architecture';
import { getGatesForDialogue } from './gates';

// ==================== TYPES ====================

export interface NavigationTarget {
	majorPhase: Phase;
	subPhase?: string;
	subPhaseOwner?: 'INTAKE' | 'ARCHITECTURE';
}

export interface NavigationAssessment {
	target: NavigationTarget;
	direction: 'forward' | 'backward' | 'lateral';
	requiresGateCleanup: boolean;
	openGateCount: number;
	warning?: string;
}

// ==================== PHASE ORDERING ====================

const PHASE_ORDER: Record<string, number> = {
	[Phase.INTAKE]: 0,
	[Phase.ARCHITECTURE]: 1,
	[Phase.PROPOSE]: 2,
	[Phase.ASSUMPTION_SURFACING]: 3,
	[Phase.VERIFY]: 4,
	[Phase.HISTORICAL_CHECK]: 5,
	[Phase.REVIEW]: 6,
	[Phase.EXECUTE]: 7,
	[Phase.VALIDATE]: 8,
	[Phase.COMMIT]: 9,
	[Phase.REPLAN]: 2, // REPLAN is equivalent to PROPOSE level
};

// ==================== ALIAS MAP ====================

/**
 * Maps fuzzy user terms to concrete navigation targets.
 * Keys are normalized (lowercase, trimmed). Values are targets.
 */
const TARGET_ALIASES: Record<string, NavigationTarget> = {
	// Major phases
	'intake': { majorPhase: Phase.INTAKE },
	'architecture': { majorPhase: Phase.ARCHITECTURE },
	'propose': { majorPhase: Phase.PROPOSE },
	'proposal': { majorPhase: Phase.PROPOSE },
	'assumption': { majorPhase: Phase.ASSUMPTION_SURFACING },
	'assumptions': { majorPhase: Phase.ASSUMPTION_SURFACING },
	'assumption surfacing': { majorPhase: Phase.ASSUMPTION_SURFACING },
	'verify': { majorPhase: Phase.VERIFY },
	'verification': { majorPhase: Phase.VERIFY },
	'historical': { majorPhase: Phase.HISTORICAL_CHECK },
	'historical check': { majorPhase: Phase.HISTORICAL_CHECK },
	'review': { majorPhase: Phase.REVIEW },
	'execute': { majorPhase: Phase.EXECUTE },
	'execution': { majorPhase: Phase.EXECUTE },
	'validate': { majorPhase: Phase.VALIDATE },
	'validation': { majorPhase: Phase.VALIDATE },
	'commit': { majorPhase: Phase.COMMIT },
	'replan': { majorPhase: Phase.REPLAN },

	// ARCHITECTURE sub-phases
	'decompose': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.DECOMPOSING, subPhaseOwner: 'ARCHITECTURE' },
	'decomposing': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.DECOMPOSING, subPhaseOwner: 'ARCHITECTURE' },
	'decomposition': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.DECOMPOSING, subPhaseOwner: 'ARCHITECTURE' },
	'model': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.MODELING, subPhaseOwner: 'ARCHITECTURE' },
	'modeling': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.MODELING, subPhaseOwner: 'ARCHITECTURE' },
	'domain model': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.MODELING, subPhaseOwner: 'ARCHITECTURE' },
	'design': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.DESIGNING, subPhaseOwner: 'ARCHITECTURE' },
	'designing': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.DESIGNING, subPhaseOwner: 'ARCHITECTURE' },
	'component design': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.DESIGNING, subPhaseOwner: 'ARCHITECTURE' },
	'sequence': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.SEQUENCING, subPhaseOwner: 'ARCHITECTURE' },
	'sequencing': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.SEQUENCING, subPhaseOwner: 'ARCHITECTURE' },
	'presenting': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.PRESENTING, subPhaseOwner: 'ARCHITECTURE' },
	'architecture review': { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.PRESENTING, subPhaseOwner: 'ARCHITECTURE' },

	// INTAKE sub-phases
	'analyze': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.ANALYZING, subPhaseOwner: 'INTAKE' },
	'analyzing': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.ANALYZING, subPhaseOwner: 'INTAKE' },
	'analysis': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.ANALYZING, subPhaseOwner: 'INTAKE' },
	'product review': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PRODUCT_REVIEW, subPhaseOwner: 'INTAKE' },
	'product discovery': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PRODUCT_REVIEW, subPhaseOwner: 'INTAKE' },
	'proposing domains': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_DOMAINS, subPhaseOwner: 'INTAKE' },
	'domains': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_DOMAINS, subPhaseOwner: 'INTAKE' },
	'proposing journeys': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_JOURNEYS, subPhaseOwner: 'INTAKE' },
	'journeys': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_JOURNEYS, subPhaseOwner: 'INTAKE' },
	'proposing entities': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_ENTITIES, subPhaseOwner: 'INTAKE' },
	'entities': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_ENTITIES, subPhaseOwner: 'INTAKE' },
	'proposing integrations': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_INTEGRATIONS, subPhaseOwner: 'INTAKE' },
	'integrations': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING_INTEGRATIONS, subPhaseOwner: 'INTAKE' },
	'clarify': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.CLARIFYING, subPhaseOwner: 'INTAKE' },
	'clarifying': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.CLARIFYING, subPhaseOwner: 'INTAKE' },
	'clarification': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.CLARIFYING, subPhaseOwner: 'INTAKE' },
	'synthesize': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.SYNTHESIZING, subPhaseOwner: 'INTAKE' },
	'synthesizing': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.SYNTHESIZING, subPhaseOwner: 'INTAKE' },
	'approval': { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.AWAITING_APPROVAL, subPhaseOwner: 'INTAKE' },
};

/**
 * Context-sensitive aliases — resolved differently based on current phase.
 */
const CONTEXT_ALIASES: Record<string, (currentPhase: Phase) => NavigationTarget> = {
	'validating': (current) =>
		current === Phase.ARCHITECTURE
			? { majorPhase: Phase.ARCHITECTURE, subPhase: ArchitectureSubState.VALIDATING, subPhaseOwner: 'ARCHITECTURE' }
			: { majorPhase: Phase.VALIDATE },
	'proposing': (current) =>
		current === Phase.INTAKE
			? { majorPhase: Phase.INTAKE, subPhase: IntakeSubState.PROPOSING, subPhaseOwner: 'INTAKE' }
			: { majorPhase: Phase.PROPOSE },
};

// ==================== RESOLUTION ====================

/**
 * Normalize user input for matching against the alias map.
 */
function normalizeTarget(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/^(go\s+)?(back\s+)?(to|from|the|phase|sub-?phase)\s+/gi, '')
		.replace(/\s+(phase|sub-?phase)$/gi, '')
		.trim();
}

/**
 * Resolve a fuzzy user target string to a concrete NavigationTarget.
 *
 * @returns NavigationTarget or null if the target cannot be resolved
 */
export function resolveNavigationTarget(
	userTarget: string,
	currentPhase: Phase,
	_metadata?: Record<string, unknown>,
): NavigationTarget | null {
	const normalized = normalizeTarget(userTarget);
	if (!normalized) {return null;}

	// 1. Check context-sensitive aliases first
	const contextFn = CONTEXT_ALIASES[normalized];
	if (contextFn) {return contextFn(currentPhase);}

	// 2. Check static alias map (try multi-word first, then single word)
	if (TARGET_ALIASES[normalized]) {return TARGET_ALIASES[normalized];}

	// 3. Try matching against Phase enum values directly (case-insensitive)
	const upperTarget = normalized.toUpperCase().replace(/\s+/g, '_');
	for (const phase of Object.values(Phase)) {
		if (phase === upperTarget) {
			return { majorPhase: phase as Phase };
		}
	}

	// 4. Try matching against sub-state enum values
	for (const subState of Object.values(IntakeSubState)) {
		if (subState === upperTarget) {
			return { majorPhase: Phase.INTAKE, subPhase: subState, subPhaseOwner: 'INTAKE' };
		}
	}
	for (const subState of Object.values(ArchitectureSubState)) {
		if (subState === upperTarget) {
			return { majorPhase: Phase.ARCHITECTURE, subPhase: subState, subPhaseOwner: 'ARCHITECTURE' };
		}
	}

	return null;
}

// ==================== SAFETY ASSESSMENT ====================

/**
 * Assess the safety and requirements of a navigation transition.
 */
export function assessNavigation(
	target: NavigationTarget,
	currentPhase: Phase,
	dialogueId: string,
): NavigationAssessment {
	const currentOrder = PHASE_ORDER[currentPhase] ?? 0;
	const targetOrder = PHASE_ORDER[target.majorPhase] ?? 0;

	// Determine direction
	let direction: NavigationAssessment['direction'];
	if (target.majorPhase === currentPhase && target.subPhase) {
		direction = 'lateral'; // sub-phase within same phase
	} else if (targetOrder < currentOrder) {
		direction = 'backward';
	} else {
		direction = 'forward';
	}

	// Check for open gates
	let openGateCount = 0;
	try {
		const gatesResult = getGatesForDialogue(dialogueId);
		if (gatesResult.success) {
			openGateCount = gatesResult.value.filter(g => g.status === GateStatus.OPEN).length;
		}
	} catch { /* ignore */ }

	const requiresGateCleanup = direction === 'backward' && openGateCount > 0;

	// Generate warnings for forward skips
	let warning: string | undefined;
	if (direction === 'forward' && targetOrder - currentOrder > 1) {
		const skippedCount = targetOrder - currentOrder - 1;
		warning = `Skipping ${skippedCount} phase(s) to reach ${target.majorPhase}. Some data may be incomplete.`;
	}

	return {
		target,
		direction,
		requiresGateCleanup,
		openGateCount,
		warning,
	};
}

/**
 * Get a human-readable list of available navigation targets for the current context.
 */
export function getAvailableTargets(currentPhase: Phase): string {
	const phases = Object.values(Phase)
		.filter(p => p !== Phase.REPLAN)
		.map(p => p.toLowerCase())
		.join(', ');

	let subPhases = '';
	if (currentPhase === Phase.ARCHITECTURE) {
		subPhases = '\nArchitecture sub-phases: ' +
			Object.values(ArchitectureSubState).map(s => s.toLowerCase()).join(', ');
	} else if (currentPhase === Phase.INTAKE) {
		subPhases = '\nIntake sub-phases: analyze, product review, domains, journeys, entities, integrations, clarify, synthesize, approval';
	}

	return `Available phases: ${phases}${subPhases}`;
}
