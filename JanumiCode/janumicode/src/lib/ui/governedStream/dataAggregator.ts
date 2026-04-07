/**
 * Data Aggregator for Governed Stream
 * Aggregates all data needed for the unified Governed Stream view
 * into a single GovernedStreamState snapshot.
 *
 * Supports multi-dialogue streams: the stream renders ALL dialogues
 * chronologically with boundary markers, while the header/health bar
 * reflects only the active dialogue.
 */

import type { DialogueEvent, Claim, Verdict, Gate } from '../../types';
import { ClaimStatus, GateStatus, Phase } from '../../types';
import { getLogger, isLoggerInitialized } from '../../logging';
import { getDialogueEvents, getClaims, getVerdicts, getGates, getHumanDecisions, getIntakeConversation, getQaExchanges } from '../../events/reader';
import { getWorkflowState, type WorkflowState } from '../../workflow/stateMachine';
import { getAllDialogues, type DialogueRecord } from '../../dialogue/lifecycle';
import {
	getCommandsForDialogue,
	getCommandOutputs,
	type WorkflowCommandRecord,
	type WorkflowCommandOutput,
} from '../../workflow/commandStore';
import type { IntakePlanDocument, IntakeConversationTurn, EngineeringDomainCoverageMap, IntakeModeRecommendation, IntakeCheckpoint, EngineeringDomain } from '../../types/intake';
import { IntakeSubState, EngineeringDomainCoverageLevel, isGatheringResponse } from '../../types/intake';
import { DOMAIN_INFO, DOMAIN_SEQUENCE } from '../../workflow/engineeringDomainCoverageTracker';
import type { HumanFacingStatus } from '../../types/maker';
import { getArchitectureDocumentForDialogue } from '../../database/architectureStore';
import { resolveHumanFacingState } from '../../workflow/humanFacingState';
import { getTaskGraphForDialogue, getTaskUnitsForGraph } from '../../database/makerStore';
import { getGraphProgress } from '../../workflow/taskGraph';
import { getDatabase } from '../../database';
import { getFindingsForDialogue } from '../../database/validationStore';
import type { MMPPayload, MirrorItem, MenuItem, MenuOption, PreMortemItem } from '../../types/mmp';

// ==================== Parsed JSON Cache ====================
// Events are immutable after write. Cache parsed detail/content by event_id
// to avoid redundant JSON.parse on repeated aggregation calls.

const PARSE_CACHE_MAX = 500;
 
const _parsedDetailCache = new Map<number, any>();
 
const _parsedContentCache = new Map<number, any>();

 
function cachedParseDetail(event: DialogueEvent): any {
	if (!event.detail) {return {};}
	const id = event.event_id;
	if (id && _parsedDetailCache.has(id)) {return _parsedDetailCache.get(id)!;}
	try {
		const parsed = JSON.parse(event.detail);
		if (id) {
			if (_parsedDetailCache.size >= PARSE_CACHE_MAX) {
				const first = _parsedDetailCache.keys().next().value;
				if (first !== undefined) {_parsedDetailCache.delete(first);}
			}
			_parsedDetailCache.set(id, parsed);
		}
		return parsed;
	} catch { return {}; }
}

 
function cachedParseContent(event: DialogueEvent): any {
	if (!event.content) {return {};}
	const id = event.event_id;
	if (id && _parsedContentCache.has(id)) {return _parsedContentCache.get(id)!;}
	try {
		const parsed = JSON.parse(event.content);
		if (id) {
			if (_parsedContentCache.size >= PARSE_CACHE_MAX) {
				const first = _parsedContentCache.keys().next().value;
				if (first !== undefined) {_parsedContentCache.delete(first);}
			}
			_parsedContentCache.set(id, parsed);
		}
		return parsed;
	} catch { return {}; }
}

/**
 * Summary counts of claim statuses for the health bar
 */
export interface ClaimHealthSummary {
	open: number;
	verified: number;
	disproved: number;
	unknown: number;
	conditional: number;
	total: number;
}

/**
 * A phase milestone inserted into the stream when phase transitions occur
 */
export interface PhaseMilestone {
	type: 'milestone';
	dialogueId: string;
	phase: Phase;
	timestamp: string;
}

/**
 * A single item in the review card requiring human attention.
 * Pre-categorized during data aggregation for rendering.
 */
export interface ReviewItem {
	kind: 'claim' | 'finding';
	claim?: Claim;
	verdict?: Verdict;
	adjudication?: import('../../roles/historianInterpreter').ClaimAdjudication;
	findingText?: string;
	findingIndex?: number;
	category: 'needs_decision' | 'awareness' | 'all_clear';
	categoryReason: string;
}

/**
 * Summary counts for the review dashboard
 */
export interface ReviewSummary {
	verified: number;
	disproved: number;
	unknown: number;
	conditional: number;
	open: number;
	historianFindings: number;
	needsDecisionCount: number;
	awarenessCount: number;
	allClearCount: number;
	adjudicationAvailable: boolean;
	consistent: number;
	inconsistent: number;
	adjConditional: number;
	adjUnknown: number;
}

/**
 * A stream item: dialogue turn, gate, milestone, or dialogue boundary marker
 */
export type StreamItem =
	| { type: 'human_message'; text: string; timestamp: string }
	| { type: 'turn'; turn: DialogueEvent; claims: Claim[]; verdict?: Verdict }
	| { type: 'gate'; gate: Gate; blockingClaims: Claim[]; resolvedAction?: string; metadata?: Record<string, unknown> }
	| { type: 'verification_gate'; gate: Gate; allClaims: Claim[]; verdicts: Verdict[]; blockingClaims: Claim[]; resolvedAction?: string }
	| { type: 'review_gate'; dialogueId: string; gate: Gate; allClaims: Claim[]; verdicts: Verdict[];
		historianFindings: string[]; reviewItems: ReviewItem[]; summary: ReviewSummary; resolvedAction?: string; resolvedRationale?: string }
	| PhaseMilestone
	| { type: 'dialogue_start'; dialogueId: string; goal: string; title: string | null; timestamp: string }
	| { type: 'dialogue_end'; dialogueId: string; status: string; timestamp: string }
	| { type: 'command_block'; dialogueId: string; command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[]; hasReview?: boolean }
	| { type: 'intake_turn'; dialogueId: string; turn: IntakeConversationTurn; timestamp: string; commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>; isLatest?: boolean; eventId?: number }
	| { type: 'intake_plan_preview'; dialogueId: string; plan: IntakePlanDocument; isFinal: boolean; timestamp: string }
	| { type: 'intake_approval_gate'; plan: IntakePlanDocument; dialogueId: string; timestamp: string; resolved?: boolean; resolvedAction?: string }
	| { type: 'intake_mode_selector'; dialogueId: string; recommendation: IntakeModeRecommendation; timestamp: string; resolved?: boolean; selectedMode?: string }
	| { type: 'intake_checkpoint'; dialogueId: string; checkpoint: IntakeCheckpoint; timestamp: string; resolved?: boolean }
	| { type: 'intake_domain_transition'; dialogueId: string; fromDomain: string; fromLabel: string; toDomain: string | null; toLabel: string | null; toDescription: string | null; timestamp: string }
	| { type: 'intake_gathering_complete'; dialogueId: string; coverageSummary: { adequate: number; partial: number; none: number; percentage: number }; intakeMode: string | null; timestamp: string }
	| { type: 'intake_analysis'; dialogueId: string; humanMessage: string; analysisSummary: string; codebaseFindings: string[]; engineeringDomainAssessment: Array<{ domain: string; level: string; evidence: string }>; timestamp: string; commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>; eventId?: number }
	| { type: 'intake_product_discovery'; dialogueId: string; requestCategory: string; productVision?: string; productDescription?: string; personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>; userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string }>; phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>; successMetrics?: string[]; uxRequirements?: string[]; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposal'; dialogueId: string; title: string; summary: string; proposedApproach: string; engineeringDomainCoverage: { adequate: number; partial: number; none: number; percentage: number }; timestamp: string }
	// Proposer-Validator items
	| { type: 'intake_proposer_business_domains'; dialogueId: string; domains: Array<{ id: string; name: string; description: string; rationale: string; entityPreview: string[]; workflowPreview: string[] }>; personas: Array<{ id: string; name: string; description: string }>; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposer_journeys'; dialogueId: string; journeys: Array<{ id: string; title: string; scenario: string; priority?: string }>; workflows: Array<{ id: string; name: string; description: string; businessDomainId: string }>; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposer_entities'; dialogueId: string; entities: Array<{ id: string; name: string; description: string; businessDomainId: string; keyAttributes: string[]; relationships: string[] }>; domainNames?: Record<string, string>; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposer_integrations'; dialogueId: string; integrations: Array<{ id: string; name: string; category: string; description: string; standardProviders: string[]; ownershipModel: string }>; qualityAttributes: string[]; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'qa_exchange'; dialogueId: string; question: string; answer: string; timestamp: string }
	| { type: 'reasoning_review'; dialogueId: string; concerns: Array<{ severity: string; summary: string; detail: string; location: string; recommendation: string }>; overallAssessment: string; reviewerModel: string; reviewPrompt?: string; timestamp: string }
	// Architecture phase items
	| { type: 'architecture_capabilities'; dialogueId: string; capabilities: Array<{ id: string; label: string; requirements: number; workflows: number; parentId: string | null }>; timestamp: string; eventId?: number }
	| { type: 'architecture_design'; dialogueId: string; components: Array<{ id: string; label: string; responsibility: string; rationale: string; parentId: string | null; workflowsServed: string[]; dependencies: string[]; interactionPatterns: string[]; technologyNotes: string; fileScope: string }>; dataModels: Array<{ id: string; entity: string; description: string; fields: Array<{ name: string; type: string; required: boolean }>; relationships: Array<{ targetModel: string; type: string; description: string }>; invariants: string[] }>; interfaces: Array<{ id: string; label: string; type: string; description: string; contract: string; providerComponent: string; consumerComponents: string[]; sourceWorkflows: string[] }>; implementationSequence: Array<{ id: string; label: string; description: string; componentsInvolved: string[]; dependencies: string[]; complexity: string; verificationMethod: string; sortOrder: number }>; timestamp: string; eventId?: number }
	| { type: 'architecture_validation'; dialogueId: string; score: number | null; findings: string[]; validated: boolean; timestamp: string; eventId?: number }
	| { type: 'architecture_gate'; docId: string; version: number; capabilities: number; components: number; goalAlignmentScore: number | null; dialogueId: string; timestamp: string; resolved?: boolean; resolvedAction?: string; mmpJson?: string; decompositionDepth?: number; eventId?: number }
	// Validation Review phase items
	| { type: 'validation_finding'; dialogueId: string; findingId: string; hypothesis: string; category: string; severity: string; location: string; tool_used: string; proof_status: string; proof_artifact: string | null; confidence: number; useful_rating: number | null; timestamp: string; eventId?: number }
	| { type: 'validation_summary'; dialogueId: string; totalFindings: number; provenCount: number; probableCount: number; categories: Record<string, number>; timestamp: string; eventId?: number };

/**
 * Summary of a dialogue for the switcher dropdown
 */
export interface DialogueSummary {
	dialogueId: string;
	title: string | null;
	goal: string;
	status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
	currentPhase: Phase;
	createdAt: string;
}

/**
 * Complete state snapshot for the Governed Stream view
 */
export interface GovernedStreamState {
	activeDialogueId: string | null;
	sessionId: string | null;
	currentPhase: Phase;
	workflowState: WorkflowState | null;
	streamItems: StreamItem[];
	claims: Claim[];
	claimHealth: ClaimHealthSummary;
	openGates: Gate[];
	phases: Phase[];
	/** All dialogues for the switcher dropdown */
	dialogueList: DialogueSummary[];
	/** INTAKE conversation state for the active dialogue (null if not in INTAKE) */
	intakeState: {
		subState: string;
		turnCount: number;
		currentPlan: IntakePlanDocument | null;
		finalizedPlan: IntakePlanDocument | null;
		engineeringDomainCoverage: EngineeringDomainCoverageMap | null;
		currentEngineeringDomain: string | null;
		intakeMode: string | null;
	} | null;
	/** ARCHITECTURE phase sub-state for the active dialogue */
	architectureState: {
		subState: string;
		validationAttempts: number;
		maxValidationAttempts: number;
		designIterations: number;
		decompositionDepth: number;
	} | null;
	/** MAKER human-facing state for the active dialogue */
	humanFacingState: HumanFacingStatus | null;
	/** MAKER task graph progress for the active dialogue */
	taskGraphProgress: {
		total: number;
		completed: number;
		failed: number;
		in_progress: number;
		pending: number;
		currentUnitLabel?: string;
	} | null;
}

/**
 * The ordered list of workflow phases for the stepper
 */
export const WORKFLOW_PHASES: Phase[] = [
	Phase.INTAKE,
	Phase.ARCHITECTURE,
	Phase.PROPOSE,
	Phase.ASSUMPTION_SURFACING,
	Phase.VERIFY,
	Phase.HISTORICAL_CHECK,
	Phase.REVIEW,
	Phase.EXECUTE,
	Phase.VALIDATE,
	Phase.COMMIT,
];

/**
 * Compute claim health summary from a list of claims
 */
export function computeClaimHealth(claims: Claim[]): ClaimHealthSummary {
	const summary: ClaimHealthSummary = {
		open: 0,
		verified: 0,
		disproved: 0,
		unknown: 0,
		conditional: 0,
		total: claims.length,
	};

	for (const claim of claims) {
		switch (claim.status) {
			case ClaimStatus.OPEN:
				summary.open++;
				break;
			case ClaimStatus.VERIFIED:
				summary.verified++;
				break;
			case ClaimStatus.DISPROVED:
				summary.disproved++;
				break;
			case ClaimStatus.UNKNOWN:
				summary.unknown++;
				break;
			case ClaimStatus.CONDITIONAL:
				summary.conditional++;
				break;
		}
	}

	return summary;
}

/**
 * Build stream items for a single dialogue with phase milestone dividers.
 * Routes each DialogueEvent by event_type to produce the appropriate StreamItem.
 */
function buildStreamItems(
	events: DialogueEvent[],
	claims: Claim[],
	verdicts: Verdict[],
	gates: Gate[],
	dialogueId?: string
): StreamItem[] {
	const items: StreamItem[] = [];

	let lastPhase: Phase | null = null;
	let lastPlanVersion = 0;

	// Create lookup maps
	const claimsByTurn = new Map<number, Claim[]>();
	for (const claim of claims) {
		const existing = claimsByTurn.get(claim.turn_id) ?? [];
		existing.push(claim);
		claimsByTurn.set(claim.turn_id, existing);
	}

	const verdictByClaim = new Map<string, Verdict>();
	for (const verdict of verdicts) {
		verdictByClaim.set(verdict.claim_id, verdict);
	}

	// Build a timeline of gates by created_at for interleaving (include resolved gates as history)
	// Note: getGates() returns DESC order; sort ASC for correct chronological interleaving
	const gateTimeline = gates
		.map((g) => ({ gate: g, timestamp: g.created_at }))
		.sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);

	// Pre-compute resolved actions and rationales for resolved gates
	const resolvedActions = new Map<string, string>();
	const resolvedRationales = new Map<string, string>();
	for (const g of gates) {
		if (g.status === GateStatus.RESOLVED) {
			const decResult = getHumanDecisions({ gate_id: g.gate_id, limit: 1 });
			if (decResult.success && decResult.value.length > 0) {
				resolvedActions.set(g.gate_id, decResult.value[0].action);
				if (decResult.value[0].rationale) {
					resolvedRationales.set(g.gate_id, decResult.value[0].rationale);
				}
			}
		}
	}

	// Build a map of finding_id → useful_rating from the validation_findings table
	// so rendered cards reflect any ratings applied after the event was written.
	const findingRatings = new Map<string, number | null>();
	if (dialogueId) {
		const findingsResult = getFindingsForDialogue(dialogueId);
		if (findingsResult.success) {
			for (const f of findingsResult.value) {
				findingRatings.set(f.finding_id, f.useful_rating ?? null);
			}
		}
	}

	let gateIdx = 0;

	for (const event of events) {
		// Insert milestone divider on phase change
		if (event.phase !== lastPhase) {
			items.push({
				type: 'milestone',
				dialogueId: dialogueId ?? '',
				phase: event.phase,
				timestamp: event.timestamp,
			});
			lastPhase = event.phase;
		}

		// Insert any gates that were triggered before this event
		while (
			gateIdx < gateTimeline.length &&
			gateTimeline[gateIdx].timestamp <= event.timestamp
		) {
			const gate = gateTimeline[gateIdx].gate;
			const blockingClaims = claims.filter((c) =>
				gate.blocking_claims.includes(c.claim_id)
			);
			const resolvedAction = resolvedActions.get(gate.gate_id);
			if (gate.blocking_claims.length > 0) {
				items.push({ type: 'verification_gate', gate, allClaims: claims, verdicts, blockingClaims, resolvedAction });
			} else {
				pushGateOrReviewGate(items, gate, blockingClaims, claims, verdicts, dialogueId, resolvedAction, resolvedRationales.get(gate.gate_id));
			}
			gateIdx++;
		}

		// Route by event_type to produce appropriate StreamItem
		const eventType = event.event_type;

		// Skip legacy turns — these are duplicates of human_message events
		// written by the old createAndAddTurn() path in dialogueOrchestrator.
		if (eventType === 'legacy') {
			continue;
		}

		// reasoning_review events are now rendered as command block outputs (not standalone)
		if (eventType === 'reasoning_review') {
			continue;
		}

		if (eventType === 'human_message') {
			const text = event.content ?? event.summary;
			// Skip MMP decision submissions — these are system-generated context
			// fed to the next proposer round, not user-authored messages
			if (text && text.startsWith('[MMP Decisions]')) {
				continue;
			}
			items.push({
				type: 'human_message',
				text,
				timestamp: event.timestamp,
			});
		} else if (eventType === 'intake_turn' || eventType === 'intake_clarification' || eventType === 'intake_gathering') {
			const detail = cachedParseDetail(event);
			const intakeTurn: IntakeConversationTurn = {
				id: event.event_id,
				dialogueId: event.dialogue_id,
				turnNumber: detail.turnNumber ?? 0,
				humanMessage: detail.humanMessage ?? '',
				expertResponse: detail.expertResponse,
				planSnapshot: detail.planSnapshot ?? null,
				tokenCount: detail.tokenCount ?? 0,
				isGathering: eventType === 'intake_gathering',
				createdAt: event.timestamp,
			};
			items.push({ type: 'intake_turn', dialogueId: dialogueId ?? '', turn: intakeTurn, timestamp: event.timestamp, eventId: event.event_id });

			// Inject plan preview if plan version changed
			const planVersion = intakeTurn.planSnapshot?.version ?? 0;
			if (planVersion > 0 && planVersion !== lastPlanVersion) {
				items.push({
					type: 'intake_plan_preview',
					dialogueId: dialogueId ?? '',
					plan: intakeTurn.planSnapshot!,
					isFinal: false,
					timestamp: event.timestamp,
				});
				lastPlanVersion = planVersion;
			}
		} else if (eventType === 'intake_analysis') {
			const detail = cachedParseDetail(event);
			const expertResponse = detail.expertResponse;
			items.push({
				type: 'intake_analysis',
				dialogueId: dialogueId ?? '',
				humanMessage: detail.humanMessage ?? '',
				analysisSummary: expertResponse?.analysisSummary ?? event.summary,
				codebaseFindings: expertResponse?.codebaseFindings ?? [],
				engineeringDomainAssessment: expertResponse?.engineeringDomainAssessment ?? [],
				timestamp: event.timestamp,
				eventId: event.event_id,
			});

			// Inject proposal card if analysis includes an initial plan
			const plan = expertResponse?.initialPlan ?? detail.initialPlan;
			if (plan) {
				// Compute domain coverage from the domain assessment if available
				const domainAssess: Array<{ domain: string; level: string }> = expertResponse?.engineeringDomainAssessment ?? [];
				let adequate = 0, partial = 0, none = 0;
				for (const d of domainAssess) {
					const lvl = (d.level ?? '').toUpperCase();
					if (lvl === 'ADEQUATE') { adequate++; }
					else if (lvl === 'PARTIAL') { partial++; }
					else { none++; }
				}
				const total = adequate + partial + none;
				const percentage = total > 0 ? Math.round(((adequate + partial * 0.5) / total) * 100) : 0;

				// Emit product discovery card separately (only for product_or_feature with MMP)
				{
					const aggLog = isLoggerInitialized() ? getLogger().child({ component: 'dataAggregator' }) : undefined;
					aggLog?.debug('productDiscoveryCheck', { requestCategory: plan.requestCategory, hasProductDiscoveryMMP: !!detail.productDiscoveryMMP, mmpLength: detail.productDiscoveryMMP ? String(detail.productDiscoveryMMP).length : 0, personasCount: plan.personas?.length ?? 0 });
				}
				if (plan.requestCategory === 'product_or_feature' && detail.productDiscoveryMMP) {
					items.push({
						type: 'intake_product_discovery',
						dialogueId: dialogueId ?? '',
						requestCategory: plan.requestCategory,
						productVision: plan.productVision,
						productDescription: plan.productDescription,
						personas: plan.personas,
						userJourneys: plan.userJourneys,
						phasingStrategy: plan.phasingStrategy,
						successMetrics: plan.successMetrics,
						uxRequirements: plan.uxRequirements,
						mmpJson: detail.productDiscoveryMMP,
						eventId: event.event_id,
						timestamp: event.timestamp,
					});
				}

				// Technical proposal card (product fields removed — reviewed in PRODUCT_REVIEW)
				items.push({
					type: 'intake_proposal',
					dialogueId: dialogueId ?? '',
					title: plan.title ?? '',
					summary: plan.summary ?? '',
					proposedApproach: plan.proposedApproach ?? '',
					engineeringDomainCoverage: { adequate, partial, none, percentage },
					timestamp: event.timestamp,
				});
				lastPlanVersion = plan.version ?? 0;
			}
		} else if (eventType === 'intake_synthesis') {
			const detail = cachedParseDetail(event);
			if (detail.finalizedPlan) {
				items.push({
					type: 'intake_plan_preview',
					dialogueId: dialogueId ?? '',
					plan: detail.finalizedPlan,
					isFinal: true,
					timestamp: event.timestamp,
				});
				lastPlanVersion = detail.finalizedPlan.version ?? 0;
			}
		} else if (eventType === 'intake_approval') {
			// Handled by injectIntakeDerivedCards (approval gate card)
		} else if (eventType === 'intake_proposer_business_domains') {
			const detail = cachedParseDetail(event);
			const content = cachedParseContent(event);
			items.push({
				type: 'intake_proposer_business_domains',
				dialogueId: dialogueId ?? '',
				domains: content.domains ?? [],
				personas: (content.personas ?? []).map((p: Record<string, unknown>) => ({
					id: p.id as string ?? '', name: p.name as string ?? '', description: p.description as string ?? '',
				})),
				mmpJson: detail.productDiscoveryMMP,
				eventId: event.event_id,
				timestamp: event.timestamp,
			});
		} else if (eventType === 'intake_proposer_journeys') {
			const detail = cachedParseDetail(event);
			const content = cachedParseContent(event);
			items.push({
				type: 'intake_proposer_journeys',
				dialogueId: dialogueId ?? '',
				journeys: (content.userJourneys ?? []).map((j: Record<string, unknown>) => ({
					id: j.id as string ?? '', title: j.title as string ?? '',
					scenario: j.scenario as string ?? '', priority: j.priority as string ?? 'MVP',
				})),
				workflows: (content.workflows ?? []).map((w: Record<string, unknown>) => ({
					id: w.id as string ?? '', name: w.name as string ?? '',
					description: w.description as string ?? '', businessDomainId: w.businessDomainId as string ?? '',
				})),
				mmpJson: detail.productDiscoveryMMP,
				eventId: event.event_id,
				timestamp: event.timestamp,
			});
		} else if (eventType === 'intake_proposer_entities') {
			const detail = cachedParseDetail(event);
			const content = cachedParseContent(event);
			// Build domain name lookup from prior proposer_domains event
			const domainNames: Record<string, string> = {};
			for (const prior of items) {
				if (prior.type === 'intake_proposer_business_domains') {
					for (const d of prior.domains) {
						domainNames[d.id] = d.name;
					}
				}
			}
			items.push({
				type: 'intake_proposer_entities',
				dialogueId: dialogueId ?? '',
				entities: (content.entities ?? []).map((e: Record<string, unknown>) => ({
					id: e.id as string ?? '', name: e.name as string ?? '',
					description: e.description as string ?? '', businessDomainId: e.businessDomainId as string ?? '',
					keyAttributes: Array.isArray(e.keyAttributes) ? e.keyAttributes as string[] : [],
					relationships: Array.isArray(e.relationships) ? e.relationships as string[] : [],
				})),
				domainNames: Object.keys(domainNames).length > 0 ? domainNames : undefined,
				mmpJson: detail.productDiscoveryMMP,
				eventId: event.event_id,
				timestamp: event.timestamp,
			});
		} else if (eventType === 'intake_proposer_integrations') {
			const detail = cachedParseDetail(event);
			const content = cachedParseContent(event);
			items.push({
				type: 'intake_proposer_integrations',
				dialogueId: dialogueId ?? '',
				integrations: (content.integrations ?? []).map((int: Record<string, unknown>) => ({
					id: int.id as string ?? '', name: int.name as string ?? '',
					category: int.category as string ?? 'other', description: int.description as string ?? '',
					standardProviders: Array.isArray(int.standardProviders) ? int.standardProviders as string[] : [],
					ownershipModel: int.ownershipModel as string ?? 'owned',
				})),
				qualityAttributes: Array.isArray(content.qualityAttributes) ? content.qualityAttributes as string[] : [],
				mmpJson: detail.productDiscoveryMMP,
				eventId: event.event_id,
				timestamp: event.timestamp,
			});
		} else if (eventType === 'architecture_technical_analysis') {
			// Suppressed — content is visible in the Technical Analysis command block card.
			// The event is stored for audit/history but doesn't need its own stream card.
		} else if (eventType === 'architecture_decomposition') {
			const detail = cachedParseDetail(event);
			const content = cachedParseContent(event);
			const caps = (content.capabilities ?? []).map((c: Record<string, unknown>) => ({
				id: c.capability_id as string ?? '',
				label: c.label as string ?? '',
				requirements: Array.isArray(c.source_requirements) ? (c.source_requirements as string[]).length : 0,
				workflows: Array.isArray(c.workflows) ? (c.workflows as string[]).length : 0,
				parentId: (c.parent_capability_id as string) || null,
			}));
			items.push({ type: 'architecture_capabilities', dialogueId: dialogueId ?? '', capabilities: caps, timestamp: event.timestamp, eventId: event.event_id });
		} else if (eventType === 'architecture_design' || eventType === 'architecture_modeling' || eventType === 'architecture_sequencing') {
			// Three events contribute to architecture_design StreamItems:
			//   - architecture_design carries components + interfaces + data_models (from doc)
			//   - architecture_modeling is visible via command blocks (data feeds into doc)
			//   - architecture_sequencing triggers a full card from the complete document
			//
			// We emit the design card at two points:
			//   1. After DESIGNING: components + interfaces + domain model
			//   2. After SEQUENCING: full card with all 4 sections (from architecture document)

			if (eventType === 'architecture_design') {
				const content = cachedParseContent(event);
				items.push({
					type: 'architecture_design',
					dialogueId: dialogueId ?? '',
					components: (content.components ?? []).map((c: Record<string, unknown>) => ({
						id: (c.component_id as string) ?? '',
						label: (c.label as string) ?? '',
						responsibility: (c.responsibility as string) ?? '',
						rationale: (c.rationale as string) ?? '',
						parentId: (c.parent_component_id as string) ?? null,
						workflowsServed: Array.isArray(c.workflows_served) ? c.workflows_served as string[] : [],
						dependencies: Array.isArray(c.dependencies) ? c.dependencies as string[] : [],
						interactionPatterns: Array.isArray(c.interaction_patterns) ? c.interaction_patterns as string[] : [],
						technologyNotes: (c.technology_notes as string) ?? '',
						fileScope: (c.file_scope as string) ?? '',
					})),
					dataModels: (content.data_models ?? []).map((m: Record<string, unknown>) => ({
						id: (m.model_id as string) ?? '',
						entity: (m.entity_name as string) ?? '',
						description: (m.description as string) ?? '',
						fields: Array.isArray(m.fields) ? (m.fields as Record<string, unknown>[]).map(f => ({
							name: (f.name as string) ?? '',
							type: (f.type as string) ?? 'string',
							required: Boolean(f.required),
						})) : [],
						relationships: Array.isArray(m.relationships) ? (m.relationships as Record<string, unknown>[]).map(r => ({
							targetModel: (r.target_model as string) ?? '',
							type: (r.type as string) ?? '',
							description: (r.description as string) ?? '',
						})) : [],
						invariants: Array.isArray(m.invariants) ? m.invariants as string[] : [],
					})),
					interfaces: (content.interfaces ?? []).map((i: Record<string, unknown>) => ({
						id: (i.interface_id as string) ?? '',
						label: (i.label as string) ?? '',
						type: (i.type as string) ?? '',
						description: (i.description as string) ?? '',
						contract: (i.contract as string) ?? '',
						providerComponent: (i.provider_component as string) ?? '',
						consumerComponents: Array.isArray(i.consumer_components) ? i.consumer_components as string[] : [],
						sourceWorkflows: Array.isArray(i.source_workflows) ? i.source_workflows as string[] : [],
					})),
					implementationSequence: [],
					timestamp: event.timestamp,
					eventId: event.event_id,
				});
			} else if (eventType === 'architecture_sequencing' && dialogueId) {
				// After SEQUENCING, the document has all 4 artifact types.
				// Emit a full design card from the complete architecture document.
				const archDocResult = getArchitectureDocumentForDialogue(dialogueId);
				if (archDocResult.success && archDocResult.value) {
					const doc = archDocResult.value;
					items.push({
						type: 'architecture_design',
						dialogueId: dialogueId ?? '',
						components: doc.components.map(c => ({
							id: c.component_id,
							label: c.label,
							responsibility: c.responsibility,
							rationale: c.rationale ?? '',
							parentId: c.parent_component_id ?? null,
							workflowsServed: c.workflows_served,
							dependencies: c.dependencies,
							interactionPatterns: c.interaction_patterns ?? [],
							technologyNotes: c.technology_notes ?? '',
							fileScope: c.file_scope ?? '',
						})),
						dataModels: doc.data_models.map(m => ({
							id: m.model_id,
							entity: m.entity_name,
							description: m.description ?? '',
							fields: m.fields.map(f => ({
								name: f.name,
								type: f.type,
								required: f.required,
							})),
							relationships: m.relationships.map(r => ({
								targetModel: r.target_model,
								type: r.type,
								description: r.description ?? '',
							})),
							invariants: m.invariants ?? [],
						})),
						interfaces: doc.interfaces.map(i => ({
							id: i.interface_id,
							label: i.label,
							type: i.type,
							description: i.description ?? '',
							contract: i.contract ?? '',
							providerComponent: i.provider_component,
							consumerComponents: i.consumer_components,
							sourceWorkflows: i.source_workflows,
						})),
						implementationSequence: doc.implementation_sequence.map(s => ({
							id: s.step_id,
							label: s.label,
							description: s.description ?? '',
							componentsInvolved: s.components_involved,
							dependencies: s.dependencies,
							complexity: s.estimated_complexity ?? 'MEDIUM',
							verificationMethod: s.verification_method ?? '',
							sortOrder: typeof s.sort_order === 'number' ? s.sort_order : 0,
						})),
						timestamp: event.timestamp,
						eventId: event.event_id,
					});
				}
			}
			// architecture_modeling events are visible via their command blocks.
		} else if (eventType === 'architecture_validation') {
			const detail = cachedParseDetail(event);
			items.push({
				type: 'architecture_validation',
				dialogueId: dialogueId ?? '',
				score: detail.goalAlignmentScore ?? null,
				findings: Array.isArray(detail.findings) ? detail.findings as string[] : [],
				validated: !detail.findings?.length && (detail.goalAlignmentScore ?? 1) >= 0.6,
				timestamp: event.timestamp,
				eventId: event.event_id,
			});
		} else if (eventType === 'architecture_presentation') {
			const detail = cachedParseDetail(event);

			// Look up the architecture gate to get resolved status, MMP, and decomposition depth.
			// When "Decompose Deeper" is used, multiple gates share the same docId.
			// Match the gate whose created_at is closest to (and >=) this presentation event's timestamp.
			//
			// IMPORTANT: Timestamps have different formats:
			//   - dialogue_events.timestamp: "YYYY-MM-DD HH:MM:SS" (SQLite datetime('now'))
			//   - gates.created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ" (JS toISOString())
			// Normalize both to "YYYY-MM-DD HH:MM:SS" for comparison.
			let archResolved = false;
			let archResolvedAction: string | undefined;
			let archMmpJson: string | undefined;
			let archDecompositionDepth: number | undefined;
			let bestGateMatch: typeof gateTimeline[0] | null = null;
			const normalizeTs = (ts: string) => ts.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
			const eventTimeNorm = normalizeTs(event.timestamp);
			for (const entry of gateTimeline) {
				try {
					const db = getDatabase();
					if (!db) { continue; }
					const metaRow = db.prepare(
						'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
					).get(entry.gate.gate_id) as { metadata: string } | undefined;
					if (metaRow) {
						const meta = JSON.parse(metaRow.metadata);
						if (meta.triggerCondition === 'ARCHITECTURE_REVIEW' && meta.architectureDocId === detail.docId) {
							const gateTimeNorm = normalizeTs(entry.gate.created_at);
							// Gate must be created at or after this presentation event
							if (gateTimeNorm >= eventTimeNorm) {
								bestGateMatch = entry;
								// Store metadata from this gate
								archMmpJson = typeof meta.mmp === 'string' ? meta.mmp : undefined;
								archDecompositionDepth = typeof meta.decompositionDepth === 'number' ? meta.decompositionDepth : undefined;
								break; // First gate at/after event time is the closest match
							}
							// If no gate is at/after event time yet, keep the last one seen
							// (handles case where gate and event have identical timestamps)
							bestGateMatch = entry;
							archMmpJson = typeof meta.mmp === 'string' ? meta.mmp : undefined;
							archDecompositionDepth = typeof meta.decompositionDepth === 'number' ? meta.decompositionDepth : undefined;
						}
					}
				} catch { /* ignore metadata lookup errors */ }
			}
			if (bestGateMatch) {
				if (bestGateMatch.gate.status === GateStatus.RESOLVED) {
					archResolved = true;
					archResolvedAction = resolvedActions.get(bestGateMatch.gate.gate_id);
				}
			}

			items.push({
				type: 'architecture_gate',
				docId: detail.docId ?? '',
				version: detail.version ?? 1,
				capabilities: detail.capabilities ?? 0,
				components: detail.components ?? 0,
				goalAlignmentScore: detail.goalAlignmentScore ?? null,
				dialogueId: event.dialogue_id,
				timestamp: event.timestamp,
				resolved: archResolved || undefined,
				resolvedAction: archResolvedAction,
				mmpJson: archMmpJson,
				decompositionDepth: archDecompositionDepth,
				eventId: event.event_id,
			});
		} else if (eventType === 'validation_finding') {
			const detail = cachedParseDetail(event);
			const usefulRating = detail.useful_rating !== undefined ? detail.useful_rating : null;
			// Merge live rating from DB if available
			const liveRating = findingRatings?.get(detail.finding_id ?? '');
			items.push({
				type: 'validation_finding',
				dialogueId: event.dialogue_id,
				findingId: detail.finding_id ?? '',
				hypothesis: detail.text ?? event.content ?? '',
				category: detail.category ?? 'best_practices',
				severity: detail.severity ?? 'medium',
				location: detail.location ?? '',
				tool_used: detail.tool_used ?? 'llm_only',
				proof_status: detail.proof_status ?? 'probable',
				proof_artifact: detail.proof_artifact ?? null,
				confidence: detail.confidence ?? 0.7,
				useful_rating: liveRating !== undefined ? liveRating : (usefulRating as number | null),
				timestamp: event.timestamp,
				eventId: event.event_id,
			});
		} else if (eventType === 'validation_summary') {
			const detail = cachedParseDetail(event);
			items.push({
				type: 'validation_summary',
				dialogueId: event.dialogue_id,
				totalFindings: detail.totalFindings ?? 0,
				provenCount: detail.provenCount ?? 0,
				probableCount: detail.probableCount ?? 0,
				categories: (detail.categories as Record<string, number>) ?? {},
				timestamp: event.timestamp,
				eventId: event.event_id,
			});
		} else {
			// Non-INTAKE events (proposal, assumption_surfacing, execution, commit, etc.)
			const turnClaims = claimsByTurn.get(event.event_id) ?? [];
			const firstClaim = turnClaims[0];
			const verdict = firstClaim ? verdictByClaim.get(firstClaim.claim_id) : undefined;

			items.push({
				type: 'turn',
				turn: event,
				claims: turnClaims,
				verdict,
			});
		}
	}

	// Append any remaining gates
	while (gateIdx < gateTimeline.length) {
		const gate = gateTimeline[gateIdx].gate;
		const blockingClaims = claims.filter((c) =>
			gate.blocking_claims.includes(c.claim_id)
		);
		const resolvedAction = resolvedActions.get(gate.gate_id);
		if (gate.blocking_claims.length > 0) {
			items.push({ type: 'verification_gate', gate, allClaims: claims, verdicts, blockingClaims, resolvedAction });
		} else {
			pushGateOrReviewGate(items, gate, blockingClaims, claims, verdicts, dialogueId, resolvedAction, resolvedRationales.get(gate.gate_id));
		}
		gateIdx++;
	}

	return items;
}

/**
 * Push a gate as either a review_gate (if current phase is REVIEW) or a plain gate.
 */
function pushGateOrReviewGate(
	items: StreamItem[],
	gate: Gate,
	blockingClaims: Claim[],
	allClaims: Claim[],
	verdicts: Verdict[],
	dialogueId?: string,
	resolvedAction?: string,
	resolvedRationale?: string
): void {
	if (dialogueId) {
		const wsResult = getWorkflowState(dialogueId);
		// Show review_gate when phase is REVIEW, or when a resolved gate with no blocking
		// claims exists in a dialogue that has passed through verification (has verdicts).
		// This preserves the rich review display for resolved review gates.
		const isReviewPhase = wsResult.success && wsResult.value.current_phase === Phase.REVIEW;
		const isResolvedReviewGate = gate.status === GateStatus.RESOLVED &&
			gate.blocking_claims.length === 0 && verdicts.length > 0;
		if (isReviewPhase || isResolvedReviewGate) {
			const { reviewItems, summary, historianFindings } = buildReviewGateData(
				allClaims, verdicts, dialogueId
			);
			items.push({
				type: 'review_gate',
				dialogueId: dialogueId!,
				gate,
				allClaims,
				verdicts,
				historianFindings,
				reviewItems,
				summary,
				resolvedAction,
				resolvedRationale,
			});
			return;
		}
	}
	// Read gate metadata (evaluation context, etc.) for enriched rendering
	let metadata: Record<string, unknown> | undefined;
	try {
		const db = getDatabase();
		if (db) {
			const row = db.prepare(
				'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
			).get(gate.gate_id) as { metadata: string } | undefined;
			if (row) {
				metadata = JSON.parse(row.metadata) as Record<string, unknown>;
			}
		}
	} catch { /* metadata read failed — render without enrichment */ }

	// Skip generic gate for architecture review — already rendered by architecture_gate stream item
	if (metadata?.triggerCondition === 'ARCHITECTURE_REVIEW') {
		return;
	}

	items.push({ type: 'gate', gate, blockingClaims, resolvedAction, metadata });
}

/**
 * Build enriched data for the interactive review gate card.
 * Categorizes claims and historian findings into actionable groups.
 */
function buildReviewGateData(
	claims: Claim[],
	verdicts: Verdict[],
	dialogueId: string
): { reviewItems: ReviewItem[]; summary: ReviewSummary; historianFindings: string[] } {
	// Build verdict lookup
	const verdictByClaim = new Map<string, Verdict>();
	for (const v of verdicts) {
		verdictByClaim.set(v.claim_id, v);
	}

	// Get historian findings + adjudication from workflow metadata
	let historianFindings: string[] = [];
	let adjudicationMap = new Map<string, import('../../roles/historianInterpreter').ClaimAdjudication>();
	let adjudicationAvailable = false;
	const wsResult = getWorkflowState(dialogueId);
	if (wsResult.success) {
		try {
			const metadata = JSON.parse(wsResult.value.metadata);

			// Read adjudication data (new structured format)
			if (metadata.historian_adjudication?.claim_adjudications) {
				adjudicationAvailable = true;
				for (const adj of metadata.historian_adjudication.claim_adjudications) {
					adjudicationMap.set(adj.claim_id, adj);
				}
				// Use general_findings from adjudication response
				if (Array.isArray(metadata.historian_adjudication.general_findings)) {
					historianFindings = metadata.historian_adjudication.general_findings;
				}
			}

			// Fallback: read flat historical_findings (backward compat)
			if (historianFindings.length === 0 && Array.isArray(metadata.historical_findings)) {
				historianFindings = metadata.historical_findings;
			}

			// Fallback: accumulate from proposal branches
			if (historianFindings.length === 0 && Array.isArray(metadata.proposalBranches)) {
				for (const branch of metadata.proposalBranches) {
					if (Array.isArray(branch.historical_findings)) {
						historianFindings.push(...branch.historical_findings);
					}
					// Also accumulate branch adjudication data
					if (!adjudicationAvailable && branch.historian_adjudication?.claim_adjudications) {
						adjudicationAvailable = true;
						for (const adj of branch.historian_adjudication.claim_adjudications) {
							adjudicationMap.set(adj.claim_id, adj);
						}
					}
				}
			}
		} catch { /* metadata parse failure — skip findings */ }
	}

	// Categorize claims
	const reviewItems: ReviewItem[] = [];
	const summary: ReviewSummary = {
		verified: 0, disproved: 0, unknown: 0, conditional: 0, open: 0,
		historianFindings: historianFindings.length,
		needsDecisionCount: 0, awarenessCount: 0, allClearCount: 0,
		adjudicationAvailable,
		consistent: 0, inconsistent: 0, adjConditional: 0, adjUnknown: 0,
	};

	for (const claim of claims) {
		const verdict = verdictByClaim.get(claim.claim_id);
		const adjudication = adjudicationMap.get(claim.claim_id);
		const status = claim.status;

		// Count by Verifier status
		if (status === ClaimStatus.VERIFIED) { summary.verified++; }
		else if (status === ClaimStatus.DISPROVED) { summary.disproved++; }
		else if (status === ClaimStatus.UNKNOWN) { summary.unknown++; }
		else if (status === ClaimStatus.CONDITIONAL) { summary.conditional++; }
		else { summary.open++; }

		// Count by Historian adjudication
		if (adjudication) {
			if (adjudication.verdict === 'CONSISTENT') { summary.consistent++; }
			else if (adjudication.verdict === 'INCONSISTENT') { summary.inconsistent++; }
			else if (adjudication.verdict === 'CONDITIONAL') { summary.adjConditional++; }
			else if (adjudication.verdict === 'UNKNOWN') { summary.adjUnknown++; }
		}

		// Categorize (Verifier-based, with Historian escalation)
		let category: ReviewItem['category'];
		let categoryReason: string;

		if (claim.criticality === 'CRITICAL' &&
			(status === ClaimStatus.DISPROVED || status === ClaimStatus.UNKNOWN)) {
			category = 'needs_decision';
			categoryReason = `CRITICAL claim with ${status} verdict`;
		} else if (adjudication?.verdict === 'INCONSISTENT') {
			// Historian escalation: INCONSISTENT claims always need a decision
			category = 'needs_decision';
			categoryReason = 'Historian: INCONSISTENT with historical record';
		} else if (status === ClaimStatus.CONDITIONAL) {
			category = 'awareness';
			categoryReason = 'Conditional verdict — review conditions';
		} else if (status === ClaimStatus.DISPROVED || status === ClaimStatus.UNKNOWN) {
			category = 'awareness';
			categoryReason = `NON_CRITICAL claim with ${status} verdict`;
		} else if (adjudication?.verdict === 'CONDITIONAL') {
			category = 'awareness';
			categoryReason = 'Historian: CONDITIONAL — conditions must be verified';
		} else if (status === ClaimStatus.VERIFIED && verdict?.novel_dependency) {
			category = 'needs_decision';
			categoryReason = 'Verified — but introduces a new dependency not currently in the project';
		} else if (status === ClaimStatus.VERIFIED) {
			category = 'all_clear';
			categoryReason = 'Verified successfully';
		} else {
			category = 'awareness';
			categoryReason = `${claim.criticality} claim — ${status}`;
		}

		reviewItems.push({ kind: 'claim', claim, verdict, adjudication, category, categoryReason });
	}

	// Categorize historian findings
	for (let i = 0; i < historianFindings.length; i++) {
		const finding = historianFindings[i];
		const lower = typeof finding === 'string' ? finding.toLowerCase() : '';
		const isHighSeverity = /critical|risk|warning|violation|contradict|disproved|incorrect/.test(lower);

		reviewItems.push({
			kind: 'finding',
			findingText: typeof finding === 'string' ? finding : JSON.stringify(finding),
			findingIndex: i,
			category: isHighSeverity ? 'needs_decision' : 'awareness',
			categoryReason: isHighSeverity
				? 'High-severity historical finding'
				: 'Informational historical finding',
		});
	}

	// Compute group counts
	summary.needsDecisionCount = reviewItems.filter((i) => i.category === 'needs_decision').length;
	summary.awarenessCount = reviewItems.filter((i) => i.category === 'awareness').length;
	summary.allClearCount = reviewItems.filter((i) => i.category === 'all_clear').length;

	return { reviewItems, summary, historianFindings };
}

/**
 * Build stream items for a single dialogue record, wrapped with boundary markers
 */
function buildDialogueStreamItems(record: DialogueRecord): StreamItem[] {
	const items: StreamItem[] = [];

	// Dialogue start marker
	items.push({
		type: 'dialogue_start',
		dialogueId: record.dialogue_id,
		goal: record.goal,
		title: record.title,
		timestamp: record.created_at,
	});

	// Get this dialogue's data
	const eventsResult = getDialogueEvents({ dialogue_id: record.dialogue_id, limit: 200 });
	const events = eventsResult.success ? eventsResult.value : [];

	const claimsResult = getClaims({ dialogue_id: record.dialogue_id });
	const claims = claimsResult.success ? claimsResult.value : [];

	const verdictsResult = getVerdicts();
	const allVerdicts = verdictsResult.success ? verdictsResult.value : [];
	// Filter verdicts to those for claims in this dialogue
	const claimIds = new Set(claims.map((c) => c.claim_id));
	const verdicts = allVerdicts.filter((v) => claimIds.has(v.claim_id));

	const gatesResult = getGates({ dialogue_id: record.dialogue_id });
	const gates = gatesResult.success ? gatesResult.value : [];

	// Build the inner stream items (events, milestones, gates)
	const eventItems = buildStreamItems(events, claims, verdicts, gates, record.dialogue_id);

	// Fetch persisted command blocks and Q&A exchanges for this dialogue
	const commandItems = buildCommandBlockItems(record.dialogue_id);
	const qaItems = buildQaExchangeItems(record.dialogue_id);

	// Merge event-based items, command blocks, and Q&A exchanges by timestamp
	const mergedItems = mergeStreamItemsByTimestamp(
		mergeStreamItemsByTimestamp(eventItems, commandItems), qaItems
	);

	// Inject derived INTAKE cards (mode selector, checkpoints, domain transitions,
	// gathering-complete, approval gate) from intake_conversations state
	injectIntakeDerivedCards(record.dialogue_id, mergedItems);

	// Sort after derived card injection
	sortStreamItemsByTimestamp(mergedItems);

	// Deduplicate architecture gates: only the last unresolved gate should be interactive.
	// Earlier unresolved gates are marked as superseded to prevent duplicate MMP sections.
	deduplicateArchitectureGates(mergedItems);

	items.push(...mergedItems);

	// Dialogue end marker for non-active dialogues
	if (record.status !== 'ACTIVE') {
		items.push({
			type: 'dialogue_end',
			dialogueId: record.dialogue_id,
			status: record.status,
			timestamp: record.completed_at ?? record.created_at,
		});
	}

	return items;
}

/**
 * Build command_block StreamItems for a dialogue from the database
 */
function buildCommandBlockItems(dialogueId: string): StreamItem[] {
	const cmdsResult = getCommandsForDialogue(dialogueId);
	if (!cmdsResult.success) {
		return [];
	}

	const items: StreamItem[] = [];
	for (const cmd of cmdsResult.value) {
		const outputsResult = getCommandOutputs(cmd.command_id);
		const allOutputs = outputsResult.success ? outputsResult.value : [];

		// Separate reasoning_review outputs from regular command outputs
		const regularOutputs = allOutputs.filter(o => o.line_type !== 'reasoning_review');
		const reviewOutputs = allOutputs.filter(o => o.line_type === 'reasoning_review');

		// Emit the command block (without reasoning reviews, but flagged if review exists)
		const hasReview = reviewOutputs.length > 0;
		items.push({ type: 'command_block' as const, dialogueId, command: cmd, outputs: regularOutputs, hasReview });

		// Emit each reasoning review as a standalone StreamItem.
		// Use the command block's start timestamp so the review sorts alongside its command block,
		// not after downstream content cards that share the completion timestamp.
		const cmdTimestamp = cmd.started_at ?? cmd.completed_at ?? reviewOutputs[0]?.timestamp ?? '';
		for (const reviewOutput of reviewOutputs) {
			try {
				const reviewData = JSON.parse(reviewOutput.content);
				const concerns = reviewData.concerns ?? [];
				items.push({
					type: 'reasoning_review' as const,
					dialogueId,
					concerns,
					overallAssessment: reviewData.overallAssessment ?? '',
					reviewerModel: reviewData.reviewerModel ?? '',
					reviewPrompt: reviewData.reviewPrompt,
					timestamp: cmdTimestamp,
				});
			} catch { /* skip malformed review */ }
		}
	}
	return items;
}

/**
 * Build qa_exchange StreamItems for a dialogue from the database
 */
function buildQaExchangeItems(dialogueId: string): StreamItem[] {
	const result = getQaExchanges(dialogueId);
	if (!result.success) { return []; }
	return result.value.map((qa) => ({
		type: 'qa_exchange' as const,
		dialogueId,
		question: qa.question,
		answer: qa.answer,
		timestamp: qa.timestamp,
	}));
}

/**
 * Resolve a possibly-malformed domain string to its canonical EngineeringDomain enum value.
 * LLM responses may return "PROBLEM_AND_MISSION" instead of "PROBLEM_MISSION", etc.
 * Returns the matched enum value, or null if no match is found.
 */
function resolveDomainEnum(raw: string): EngineeringDomain | null {
	// Exact match
	if (DOMAIN_INFO[raw as EngineeringDomain]) {
		return raw as EngineeringDomain;
	}
	// Normalize: strip common filler words, collapse separators
	const normalized = raw.toUpperCase().replaceAll(/\bAND\b/g, '').replaceAll(/[_\s]+/g, '_').replaceAll(/(?:^_|_$)/g, '');
	for (const domain of DOMAIN_SEQUENCE) {
		if (domain === normalized) { return domain; }
	}
	// Fallback: match by label
	const lowerRaw = raw.toLowerCase().replaceAll('_', ' ');
	for (const domain of DOMAIN_SEQUENCE) {
		if (DOMAIN_INFO[domain].label.toLowerCase() === lowerRaw) { return domain; }
	}
	return null;
}

/**
 * Normalize a timestamp string to ISO 8601 format for consistent comparison.
 * Handles two formats:
 *   - SQLite datetime('now'): "2026-02-25 19:51:28" (UTC but no T/Z)
 *   - JavaScript toISOString(): "2026-02-25T19:51:28.123Z" (full ISO)
 * Both represent UTC; this ensures string comparison works correctly.
 */
function normalizeTimestamp(ts: string): string {
	if (!ts) { return ''; }
	// Strip fractional seconds (.123Z → Z) so ISO and SQLite timestamps
	// compare at second granularity — the sort-priority tiebreaker handles
	// ordering within the same second.
	const stripped = ts.replace(/\.\d+Z$/, 'Z');
	// Already has 'T' separator — return as-is
	if (stripped.includes('T')) { return stripped; }
	// SQLite format "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"
	return stripped.replace(' ', 'T') + 'Z';
}

/**
 * Extract a timestamp from a StreamItem for ordering
 */
function getStreamItemTimestamp(item: StreamItem): string {
	let raw: string;
	switch (item.type) {
		case 'human_message': raw = item.timestamp; break;
		case 'turn': raw = item.turn.timestamp; break;
		case 'gate': raw = item.gate.created_at; break;
		case 'verification_gate': raw = item.gate.created_at; break;
		case 'review_gate': raw = item.gate.created_at; break;
		case 'milestone': raw = item.timestamp; break;
		case 'dialogue_start': raw = item.timestamp; break;
		case 'dialogue_end': raw = item.timestamp; break;
		case 'command_block': raw = item.command.started_at; break;
		case 'intake_turn': raw = item.timestamp; break;
		case 'intake_plan_preview': raw = item.timestamp; break;
		case 'intake_approval_gate': raw = item.timestamp; break;
		case 'intake_mode_selector': raw = item.timestamp; break;
		case 'intake_checkpoint': raw = item.timestamp; break;
		case 'intake_domain_transition': raw = item.timestamp; break;
		case 'intake_gathering_complete': raw = item.timestamp; break;
		case 'intake_analysis': raw = item.timestamp; break;
		case 'intake_product_discovery': raw = item.timestamp; break;
		case 'intake_proposer_business_domains': raw = item.timestamp; break;
		case 'intake_proposer_journeys': raw = item.timestamp; break;
		case 'intake_proposer_entities': raw = item.timestamp; break;
		case 'intake_proposer_integrations': raw = item.timestamp; break;
		case 'intake_proposal': raw = item.timestamp; break;
		case 'qa_exchange': raw = item.timestamp; break;
		case 'architecture_capabilities': raw = item.timestamp; break;
		case 'architecture_design': raw = item.timestamp; break;
		case 'architecture_validation': raw = item.timestamp; break;
		case 'architecture_gate': raw = item.timestamp; break;
		case 'reasoning_review': raw = item.timestamp; break;
		default: raw = ''; break;
	}
	return normalizeTimestamp(raw);
}

/**
 * Merge two timestamp-ordered StreamItem arrays into one, preserving relative order
 */
function mergeStreamItemsByTimestamp(a: StreamItem[], b: StreamItem[]): StreamItem[] {
	if (b.length === 0) { return a; }
	if (a.length === 0) { return b; }

	const result: StreamItem[] = [];
	let ai = 0;
	let bi = 0;

	while (ai < a.length && bi < b.length) {
		const ta = getStreamItemTimestamp(a[ai]);
		const tb = getStreamItemTimestamp(b[bi]);
		if (ta <= tb) {
			result.push(a[ai++]);
		} else {
			result.push(b[bi++]);
		}
	}

	while (ai < a.length) { result.push(a[ai++]); }
	while (bi < b.length) { result.push(b[bi++]); }

	return result;
}

/**
 * Sort priority for tiebreaking items at the same timestamp.
 * Lower number = earlier in the stream.
 * Command blocks (actions) sort before turns (results) at the same time,
 * so the execution detail precedes the status summary in the UI.
 */
function getStreamItemSortPriority(item: StreamItem): number {
	switch (item.type) {
		case 'milestone': return 0;
		case 'dialogue_start': return 1;
		case 'human_message': return 1.5;
		case 'intake_turn': return 2;
		case 'command_block': return 3;
		case 'intake_plan_preview': return 4;
		case 'turn': return 5;
		case 'gate': return 6;
		case 'verification_gate': return 6;
		case 'review_gate': return 7;
		case 'intake_approval_gate': return 8;
		case 'intake_mode_selector': return 3;
		case 'intake_analysis': return 4;      // After command_block (3) + reasoning_review (3.5)
		case 'intake_product_discovery': return 4.1;  // After analysis
		case 'intake_proposer_business_domains': return 4.2;
		case 'intake_proposer_journeys': return 4.3;
		case 'intake_proposer_entities': return 4.4;
		case 'intake_proposer_integrations': return 4.5;
		case 'intake_proposal': return 4.6;    // After product discovery
		case 'intake_domain_transition': return 5;
		case 'intake_gathering_complete': return 6;
		case 'intake_checkpoint': return 7;
		case 'qa_exchange': return 4;
		// Architecture synthesis events are always written AFTER the CLI commands
		// that informed them. They carry eventId so the eventId tiebreaker handles
		// ordering when both items have it; these priorities cover the mixed case
		// (synthesis vs a non-eventId item at the same second).
		case 'architecture_capabilities': return 3.6;
		case 'architecture_design': return 3.7;
		case 'architecture_validation': return 3.8;
		case 'architecture_gate': return 8;
		case 'reasoning_review': return 3.5; // Right after command_block (3) at the same timestamp
		case 'dialogue_end': return 9;
		default: return 10;
	}
}

/**
 * Return the event_id for items that originate from dialogue_events.
 * Used as a monotonic tiebreaker within the same timestamp second.
 */
function getStreamItemEventId(item: StreamItem): number | undefined {
	switch (item.type) {
		case 'turn': return item.turn.event_id;   // DialogueEvent already carries event_id
		case 'intake_turn': return item.eventId;
		case 'intake_analysis': return item.eventId;
		case 'intake_product_discovery': return item.eventId;
		case 'intake_proposer_business_domains': return item.eventId;
		case 'intake_proposer_journeys': return item.eventId;
		case 'intake_proposer_entities': return item.eventId;
		case 'intake_proposer_integrations': return item.eventId;
		case 'architecture_capabilities': return item.eventId;
		case 'architecture_design': return item.eventId;
		case 'architecture_validation': return item.eventId;
		case 'architecture_gate': return item.eventId;
		case 'validation_finding': return item.eventId;
		case 'validation_summary': return item.eventId;
		default: return undefined;
	}
}

/**
 * Sort a StreamItem array in-place by normalized timestamp.
 * Tiebreaker when timestamps are equal (second granularity):
 *   1. Both items have event_id → use monotonic DB insertion order.
 *   2. Otherwise → fall back to type-based sort priority.
 */
function sortStreamItemsByTimestamp(items: StreamItem[]): void {
	items.sort((a, b) => {
		const ta = getStreamItemTimestamp(a);
		const tb = getStreamItemTimestamp(b);
		if (ta < tb) { return -1; }
		if (ta > tb) { return 1; }
		// Same timestamp second: prefer monotonic event_id when both items have it
		const ea = getStreamItemEventId(a);
		const eb = getStreamItemEventId(b);
		if (ea !== undefined && eb !== undefined) { return ea - eb; }
		// Mixed or no event_id: fall back to type-based priority
		return getStreamItemSortPriority(a) - getStreamItemSortPriority(b);
	});
}

/**
 * Deduplicate architecture gates: when multiple unresolved gates exist for the same
 * docId (from validation re-iterations or "Decompose Deeper"), only the latest one
 * should be interactive. Earlier ones are marked as resolved/superseded to prevent
 * duplicate MMP sections and double-counted progress.
 */
function deduplicateArchitectureGates(items: StreamItem[]): void {
	// Collect indices of all unresolved architecture_gate items
	const unresolvedIndices: number[] = [];
	for (let i = 0; i < items.length; i++) {
		if (items[i].type === 'architecture_gate') {
			const gate = items[i] as Extract<StreamItem, { type: 'architecture_gate' }>;
			if (!gate.resolved) {
				unresolvedIndices.push(i);
			}
		}
	}
	// Mark all but the last unresolved gate as superseded
	if (unresolvedIndices.length > 1) {
		for (let k = 0; k < unresolvedIndices.length - 1; k++) {
			const gate = items[unresolvedIndices[k]] as Extract<StreamItem, { type: 'architecture_gate' }>;
			gate.resolved = true;
			gate.resolvedAction = 'SUPERSEDED';
		}
	}
}

/**
 * Aggregate stream state across all dialogues.
 * The stream contains all dialogue sequences chronologically.
 * The header (phase stepper, claim health) reflects only the active dialogue.
 *
 * @param activeDialogueId The currently active dialogue, if any
 * @returns Complete GovernedStreamState snapshot spanning all dialogues
 */
export function aggregateStreamState(activeDialogueId?: string): GovernedStreamState {
	const emptyHealth: ClaimHealthSummary = {
		open: 0, verified: 0, disproved: 0, unknown: 0, conditional: 0, total: 0,
	};

	const emptyState: GovernedStreamState = {
		activeDialogueId: activeDialogueId ?? null,
		sessionId: activeDialogueId ?? null,
		currentPhase: Phase.INTAKE,
		workflowState: null,
		streamItems: [],
		claims: [],
		claimHealth: emptyHealth,
		openGates: [],
		phases: WORKFLOW_PHASES,
		dialogueList: [],
		intakeState: null,
		architectureState: null,
		humanFacingState: null,
		taskGraphProgress: null,
	};

	// Try multi-dialogue path: query the dialogues table
	const dialoguesResult = getAllDialogues();
	const dialogues = dialoguesResult.success ? dialoguesResult.value : [];

	if (dialogues.length > 0) {
		return aggregateFromDialogueRecords(dialogues, activeDialogueId, emptyState);
	}

	// Fallback: no dialogues table rows (pre-migration or empty DB).
	// Use legacy single-dialogue behavior for backward compatibility.
	return aggregateLegacySingleDialogue(activeDialogueId, emptyState);
}

/**
 * Multi-dialogue aggregation from the dialogues table
 */
function aggregateFromDialogueRecords(
	dialogues: DialogueRecord[],
	activeDialogueId: string | undefined,
	emptyState: GovernedStreamState
): GovernedStreamState {
	const allStreamItems: StreamItem[] = [];
	const showBoundaryMarkers = dialogues.length > 1;

	// Build stream items for each dialogue in chronological order
	for (const record of dialogues) {
		const items = buildDialogueStreamItems(record);
		if (showBoundaryMarkers) {
			allStreamItems.push(...items);
		} else {
			// Single dialogue — skip boundary markers for cleaner UX
			allStreamItems.push(...items.filter(
				(item) => item.type !== 'dialogue_start' && item.type !== 'dialogue_end'
			));
		}
	}

	// Build dialogue list for the switcher
	const dialogueList: DialogueSummary[] = dialogues.map((d) => {
		const ws = getWorkflowState(d.dialogue_id);
		return {
			dialogueId: d.dialogue_id,
			title: d.title,
			goal: d.goal,
			status: d.status,
			currentPhase: ws.success ? ws.value.current_phase : Phase.INTAKE,
			createdAt: d.created_at,
		};
	});

	if (allStreamItems.length === 0) {
		return { ...emptyState, dialogueList };
	}

	// Active dialogue data for the header
	const effectiveActiveId = activeDialogueId
		?? dialogues.find((d) => d.status === 'ACTIVE')?.dialogue_id
		?? null;

	let currentPhase = Phase.INTAKE;
	let workflowState: WorkflowState | null = null;
	let activeClaims: Claim[] = [];
	let openGates: Gate[] = [];

	let intakeState: GovernedStreamState['intakeState'] = null;

	if (effectiveActiveId) {
		const wsResult = getWorkflowState(effectiveActiveId);
		if (wsResult.success) {
			workflowState = wsResult.value;
			currentPhase = workflowState.current_phase;
		}

		const claimsResult = getClaims({ dialogue_id: effectiveActiveId });
		activeClaims = claimsResult.success ? claimsResult.value : [];

		const gatesResult = getGates({ dialogue_id: effectiveActiveId, status: GateStatus.OPEN });
		openGates = gatesResult.success ? gatesResult.value : [];

		// Build INTAKE state if in INTAKE phase
		intakeState = buildIntakeState(effectiveActiveId, currentPhase, allStreamItems);
	}

	// Build MAKER state for the active dialogue
	const makerState = effectiveActiveId
		? buildMakerState(effectiveActiveId, currentPhase, openGates.length > 0, intakeState?.subState)
		: null;

	// Extract architecture sub-state from workflow metadata
	const architectureState = extractArchitectureState(workflowState);

	return {
		activeDialogueId: effectiveActiveId,
		sessionId: effectiveActiveId,
		currentPhase,
		workflowState,
		streamItems: allStreamItems,
		claims: activeClaims,
		claimHealth: computeClaimHealth(activeClaims),
		openGates,
		phases: WORKFLOW_PHASES,
		dialogueList,
		intakeState,
		architectureState,
		humanFacingState: makerState?.humanFacingState ?? null,
		taskGraphProgress: makerState?.taskGraphProgress ?? null,
	};
}

/**
 * Legacy single-dialogue aggregation (pre-migration fallback)
 */
function aggregateLegacySingleDialogue(
	dialogueId: string | undefined,
	emptyState: GovernedStreamState
): GovernedStreamState {
	const eventsResult = getDialogueEvents(
		dialogueId ? { dialogue_id: dialogueId, limit: 200 } : { limit: 200 }
	);
	if (!eventsResult.success || eventsResult.value.length === 0) {
		return emptyState;
	}

	const events = eventsResult.value;
	const effectiveDialogueId = dialogueId ?? events[0].dialogue_id;

	const claimsResult = getClaims({ dialogue_id: effectiveDialogueId });
	const claims = claimsResult.success ? claimsResult.value : [];

	const verdictsResult = getVerdicts();
	const verdicts = verdictsResult.success ? verdictsResult.value : [];

	const gatesResult = getGates({ dialogue_id: effectiveDialogueId });
	const allGates = gatesResult.success ? gatesResult.value : [];
	const openGates = allGates.filter((g) => g.status === GateStatus.OPEN);

	let workflowState: WorkflowState | null = null;
	let currentPhase = Phase.INTAKE;
	const wsResult = getWorkflowState(effectiveDialogueId);
	if (wsResult.success) {
		workflowState = wsResult.value;
		currentPhase = workflowState.current_phase;
	}

	const eventItems = buildStreamItems(events, claims, verdicts, allGates);
	const commandItems = buildCommandBlockItems(effectiveDialogueId);
	const qaItems = buildQaExchangeItems(effectiveDialogueId);
	const streamItems = mergeStreamItemsByTimestamp(
		mergeStreamItemsByTimestamp(eventItems, commandItems), qaItems
	);
	const claimHealth = computeClaimHealth(claims);

	// Inject derived INTAKE cards from intake_conversations state
	injectIntakeDerivedCards(effectiveDialogueId, streamItems);
	sortStreamItemsByTimestamp(streamItems);
	deduplicateArchitectureGates(streamItems);
	const intakeState = buildIntakeState(effectiveDialogueId, currentPhase, streamItems);

	// Build MAKER state
	const makerState = buildMakerState(effectiveDialogueId, currentPhase, openGates.length > 0, intakeState?.subState);

	return {
		activeDialogueId: effectiveDialogueId,
		sessionId: effectiveDialogueId,
		currentPhase,
		workflowState,
		streamItems,
		claims,
		claimHealth,
		openGates,
		phases: WORKFLOW_PHASES,
		dialogueList: [],
		intakeState,
		architectureState: extractArchitectureState(workflowState),
		humanFacingState: makerState.humanFacingState,
		taskGraphProgress: makerState.taskGraphProgress,
	};
}

/**
 * Inject derived INTAKE cards from intake_conversations state.
 * These cards are not backed by dialogue_events — they're computed from
 * the intake conversation's metadata (mode selector, checkpoints,
 * domain transitions, gathering-complete, approval gate).
 *
 * Called from buildDialogueStreamItems so it applies to ALL dialogues.
 */
function injectIntakeDerivedCards(dialogueId: string, streamItems: StreamItem[]): void {
	const convResult = getIntakeConversation(dialogueId);
	if (!convResult.success || !convResult.value) {
		return;
	}

	const conv = convResult.value;

	// Find earliest INTAKE content timestamp for ordering derived cards
	let firstIntakeTimestamp: string | null = null;
	for (const item of streamItems) {
		if (item.type === 'intake_turn' || item.type === 'intake_analysis' || item.type === 'human_message') {
			const ts = item.timestamp;
			if (!firstIntakeTimestamp || normalizeTimestamp(ts) < normalizeTimestamp(firstIntakeTimestamp)) {
				firstIntakeTimestamp = ts;
			}
		}
	}

	// Inject mode selector card if classifier result exists
	if (conv.classifierResult) {
		const isResolved = !!conv.intakeMode;
		const selectorTimestamp = firstIntakeTimestamp || conv.createdAt;
		streamItems.push({
			type: 'intake_mode_selector',
			dialogueId,
			recommendation: conv.classifierResult,
			timestamp: selectorTimestamp,
			resolved: isResolved,
			selectedMode: conv.intakeMode ?? undefined,
		});
	}

	// Inject checkpoint cards from stored checkpoints
	if (conv.checkpoints && conv.checkpoints.length > 0) {
		for (const checkpoint of conv.checkpoints) {
			streamItems.push({
				type: 'intake_checkpoint',
				dialogueId,
				checkpoint,
				timestamp: conv.updatedAt,
				resolved: true,
			});
		}
	}

	// Inject domain transition cards from consecutive gathering turns in the stream
	const gatheringItems = streamItems.filter(
		(item): item is Extract<StreamItem, { type: 'intake_turn' }> =>
			item.type === 'intake_turn' && (item.turn.isGathering ?? false)
	);
	for (let gi = 1; gi < gatheringItems.length; gi++) {
		const prevResp = gatheringItems[gi - 1].turn.expertResponse;
		const currResp = gatheringItems[gi].turn.expertResponse;
		if (prevResp && currResp && isGatheringResponse(prevResp) && isGatheringResponse(currResp)) {
			const prevResolved = resolveDomainEnum(prevResp.focusEngineeringDomain);
			const currResolved = resolveDomainEnum(currResp.focusEngineeringDomain);
			if (prevResolved !== currResolved) {
				const fromInfo = prevResolved ? DOMAIN_INFO[prevResolved] : undefined;
				const toInfo = currResolved ? DOMAIN_INFO[currResolved] : undefined;
				streamItems.push({
					type: 'intake_domain_transition',
					dialogueId,
					fromDomain: prevResp.focusEngineeringDomain,
					fromLabel: fromInfo?.label ?? prevResp.focusEngineeringDomain,
					toDomain: currResp.focusEngineeringDomain,
					toLabel: toInfo?.label ?? currResp.focusEngineeringDomain,
					toDescription: toInfo?.description ?? null,
					timestamp: gatheringItems[gi].timestamp,
				});
			}
		}
	}

	// Gathering complete: if there are gathering turns and subState advanced past GATHERING
	if (gatheringItems.length > 0 && conv.subState !== IntakeSubState.GATHERING) {
		const coverage = conv.engineeringDomainCoverage;
		let adequate = 0;
		let partial = 0;
		let none = 0;
		if (coverage) {
			for (const domain of DOMAIN_SEQUENCE) {
				switch (coverage[domain]?.level) {
					case EngineeringDomainCoverageLevel.ADEQUATE: adequate++; break;
					case EngineeringDomainCoverageLevel.PARTIAL: partial++; break;
					default: none++; break;
				}
			}
		}
		const total = DOMAIN_SEQUENCE.length;
		const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);
		streamItems.push({
			type: 'intake_gathering_complete',
			dialogueId,
			coverageSummary: { adequate, partial, none, percentage },
			intakeMode: conv.intakeMode ?? null,
			timestamp: gatheringItems.at(-1)!.timestamp,
		});
	}

	// Inject approval gate as a persistent stream artifact.
	// Use the intake_synthesis event timestamp as anchor — NOT conv.updatedAt which
	// shifts as the conversation gets updated during downstream phases, causing
	// the approval gate to sort after Architecture cards.
	// Fallback: if finalizedPlan is somehow null but subState is AWAITING_APPROVAL
	// (e.g., partial DB write), use draftPlan so the gate still appears.
	// Use finalizedPlan when available; fall back to draftPlan if subState is AWAITING_APPROVAL
	// but finalizedPlan was not persisted (e.g. partial DB write) — ensures gate always appears.
	const gatePlan = conv.finalizedPlan ?? (conv.subState === IntakeSubState.AWAITING_APPROVAL ? conv.draftPlan : null);
	if (gatePlan) {
		const wsResult = getWorkflowState(dialogueId);
		const currentPhase = wsResult.success ? wsResult.value.current_phase : Phase.INTAKE;

		// Find the synthesis event timestamp as a stable anchor for the gate
		let gateTimestamp = conv.updatedAt; // fallback
		for (const item of streamItems) {
			if (item.type === 'intake_plan_preview' && (item as { isFinal?: boolean }).isFinal) {
				gateTimestamp = item.timestamp;
				break;
			}
		}

		if (conv.subState === IntakeSubState.AWAITING_APPROVAL) {
			streamItems.push({
				type: 'intake_approval_gate',
				plan: gatePlan,
				dialogueId,
				timestamp: gateTimestamp,
			});
		} else if (currentPhase !== Phase.INTAKE) {
			streamItems.push({
				type: 'intake_approval_gate',
				plan: gatePlan,
				dialogueId,
				timestamp: gateTimestamp,
				resolved: true,
				resolvedAction: 'Approved',
			});
		} else if (conv.subState === IntakeSubState.DISCUSSING) {
			streamItems.push({
				type: 'intake_approval_gate',
				plan: gatePlan,
				dialogueId,
				timestamp: gateTimestamp,
				resolved: true,
				resolvedAction: 'Continued Discussing',
			});
		}
	}

	// Compute isLatest for the last intake_turn: only interactive when workflow
	// is in INTAKE phase AND conversation subState expects user input
	const wsResult2 = getWorkflowState(dialogueId);
	const phase = wsResult2.success ? wsResult2.value.current_phase : Phase.INTAKE;
	const awaitingInput = phase === Phase.INTAKE && (
		conv.subState === IntakeSubState.DISCUSSING ||
		conv.subState === IntakeSubState.CLARIFYING ||
		conv.subState === IntakeSubState.PROPOSING ||
		conv.subState === IntakeSubState.GATHERING ||
		conv.subState === IntakeSubState.PRODUCT_REVIEW
	);

	// During proposer rounds or PRODUCT_REVIEW, hide the technical proposal
	// and old product discovery card. The proposer cards replace them.
	// The intake_analysis card (homework) stays visible.
	const isProposerActive = conv.subState === IntakeSubState.PRODUCT_REVIEW
		|| conv.subState === IntakeSubState.PROPOSING_BUSINESS_DOMAINS
		|| conv.subState === IntakeSubState.PROPOSING_JOURNEYS
		|| conv.subState === IntakeSubState.PROPOSING_ENTITIES
		|| conv.subState === IntakeSubState.PROPOSING_INTEGRATIONS;

	if (isProposerActive) {
		// Remove the technical proposal card when proposer rounds are active
		// (it's superseded by the proposer-validator cards).
		// BUT keep intake_product_discovery — the user needs it during PRODUCT_REVIEW gate.
		for (let i = streamItems.length - 1; i >= 0; i--) {
			const t = streamItems[i].type;
			if (t === 'intake_proposal') {
				streamItems.splice(i, 1);
			}
		}
	}
	for (let i = streamItems.length - 1; i >= 0; i--) {
		if (streamItems[i].type === 'intake_turn') {
			(streamItems[i] as Extract<StreamItem, { type: 'intake_turn' }>).isLatest = awaitingInput;
			break;
		}
	}
}

/**
 * Build INTAKE UI state for the active dialogue.
 * Returns intakeState for driving finalize button and approval gate.
 * Stream item injection is handled by applyIntakeStreamProcessing (per-dialogue).
 */
function buildIntakeState(
	dialogueId: string,
	currentPhase: Phase,
	streamItems: StreamItem[]
): GovernedStreamState['intakeState'] {
	if (currentPhase !== Phase.INTAKE) {
		return null;
	}

	const convResult = getIntakeConversation(dialogueId);
	if (!convResult.success || !convResult.value) {
		return null;
	}

	const conv = convResult.value;

	return {
		subState: conv.subState,
		turnCount: conv.turnCount,
		currentPlan: conv.draftPlan,
		finalizedPlan: conv.finalizedPlan,
		engineeringDomainCoverage: conv.engineeringDomainCoverage ?? null,
		currentEngineeringDomain: conv.currentEngineeringDomain ?? null,
		intakeMode: conv.intakeMode ?? null,
	};
}

/**
 * Extract architecture sub-state from workflow metadata.
 * Returns null if not in ARCHITECTURE phase or metadata is missing.
 */
function extractArchitectureState(
	workflowState: WorkflowState | null
): GovernedStreamState['architectureState'] {
	if (!workflowState) {return null;}
	try {
		const meta = workflowState.metadata ? JSON.parse(workflowState.metadata) : null;
		if (!meta?.architectureSubState) {return null;}
		return {
			subState: meta.architectureSubState,
			validationAttempts: meta.validationAttempts ?? 0,
			maxValidationAttempts: meta.maxValidationAttempts ?? 2,
			designIterations: meta.designIterations ?? 0,
			decompositionDepth: meta.decompositionDepth ?? 0,
		};
	} catch { return null; }
}

/**
 * Build MAKER-specific state: human-facing state label + task graph progress.
 * Returns null fields if no task graph exists (non-MAKER workflow).
 */
function buildMakerState(
	dialogueId: string,
	currentPhase: Phase,
	hasOpenGates: boolean,
	intakeSubState?: string
): { humanFacingState: HumanFacingStatus; taskGraphProgress: GovernedStreamState['taskGraphProgress'] } {
	// Try to get task graph progress
	let taskGraphProgress: GovernedStreamState['taskGraphProgress'] = null;
	let currentUnitLabel: string | undefined;
	let isRepairing = false;
	let unitsCompleted: number | undefined;
	let unitsTotal: number | undefined;

	const graphResult = getTaskGraphForDialogue(dialogueId);
	if (graphResult.success && graphResult.value) {
		const progress = getGraphProgress(graphResult.value.graph_id);
		if (progress.success) {
			taskGraphProgress = progress.value;
			unitsCompleted = progress.value.completed;
			unitsTotal = progress.value.total;

			// Find current unit label
			const unitsResult = getTaskUnitsForGraph(graphResult.value.graph_id);
			if (unitsResult.success) {
				const inProgressUnit = unitsResult.value.find((u) => u.status === 'IN_PROGRESS');
				const repairingUnit = unitsResult.value.find((u) => u.status === 'REPAIRING');
				if (repairingUnit) {
					currentUnitLabel = repairingUnit.label;
					isRepairing = true;
				} else if (inProgressUnit) {
					currentUnitLabel = inProgressUnit.label;
				}
				if (currentUnitLabel) {
					taskGraphProgress.currentUnitLabel = currentUnitLabel;
				}
			}
		}
	}

	const humanFacingState = resolveHumanFacingState(currentPhase, {
		hasOpenGates,
		isRepairing,
		intakeSubState,
		unitsCompleted,
		unitsTotal,
		currentUnitLabel,
	});

	return { humanFacingState, taskGraphProgress };
}

// ==================== REVIEW MMP SYNTHESIS ====================

/**
 * Synthesize review findings into an MMP payload for the review gate.
 * - needs_decision items → Pre-Mortem (critical risks)
 * - awareness items → Menu (with accept-as-is / add-safeguard / block options)
 * - all_clear items → Mirror (confirmed assumptions, read-only)
 */
export function synthesizeReviewMMP(
	reviewItems: ReviewItem[],
	summary: ReviewSummary,
	historianFindings: string[],
): MMPPayload | undefined {
	const mirrorItems: MirrorItem[] = [];
	const menuItems: MenuItem[] = [];
	const preMortemItems: PreMortemItem[] = [];

	let mirrorIdx = 0;
	let menuIdx = 0;
	let pmIdx = 0;

	for (const item of reviewItems) {
		const claimText = item.claim?.statement ?? item.findingText ?? '';
		const verdictStatus = item.verdict?.verdict ?? item.claim?.status ?? '';
		const rationale = item.verdict?.rationale ?? item.categoryReason;

		switch (item.category) {
			case 'all_clear': {
				mirrorIdx++;
				const mirId = item.claim?.claim_id
					? `REV-MIR-${item.claim.claim_id}`
					: `REV-MIR-${mirrorIdx}`;
				mirrorItems.push({
					id: mirId,
					text: claimText,
					category: 'intent',
					rationale: rationale || `Verified by ${verdictStatus}`,
					status: 'accepted', // Pre-accepted (confirmed)
				});
				break;
			}

			case 'awareness': {
				menuIdx++;
				const menuId = item.claim?.claim_id
					? `REV-MENU-${item.claim.claim_id}`
					: `REV-MENU-${menuIdx}`;
				const options: MenuOption[] = [
					{
						optionId: `${menuId}-A`,
						label: 'Accept as-is',
						description: 'Proceed despite the uncertainty',
						tradeoffs: 'Risk remains unmitigated',
						recommended: true,
					},
					{
						optionId: `${menuId}-B`,
						label: 'Add safeguard',
						description: 'Add a verification step or fallback',
						tradeoffs: 'Additional implementation effort',
					},
					{
						optionId: `${menuId}-C`,
						label: 'Block on this',
						description: 'Do not proceed until resolved',
						tradeoffs: 'Delays the workflow',
					},
				];
				menuItems.push({
					id: menuId,
					question: claimText,
					context: rationale || `Status: ${verdictStatus}`,
					options,
				});
				break;
			}

			case 'needs_decision': {
				pmIdx++;
				const pmId = item.claim?.claim_id
					? `REV-RISK-${item.claim.claim_id}`
					: `REV-RISK-FINDING-${pmIdx}`;
				const isNovelDep = item.verdict?.novel_dependency === true;
				const severity = isNovelDep ? 'medium' as const
					: verdictStatus === 'DISPROVED' ? 'critical' as const
					: verdictStatus === 'UNKNOWN' ? 'high' as const
					: 'medium' as const;
				const failureScenario = isNovelDep
					? 'New dependency not currently in the project. Adopting carries risk: maintenance burden, security surface, learning curve, and potential lock-in.'
					: rationale || `This claim is ${verdictStatus.toLowerCase()} and requires your attention`;
				const mitigation = isNovelDep
					? 'Evaluate whether the benefits justify adding this to your stack. Consider alternatives already in use.'
					: undefined;
				preMortemItems.push({
					id: pmId,
					assumption: claimText,
					failureScenario,
					severity,
					mitigation,
					status: 'pending',
				});
				break;
			}
		}
	}

	// Add historian findings as pre-mortem items
	for (const finding of historianFindings) {
		pmIdx++;
		preMortemItems.push({
			id: `REV-HIST-${pmIdx}`,
			assumption: finding,
			failureScenario: 'Historical analysis identified this concern',
			severity: 'medium',
			mitigation: 'Review the finding and decide whether to proceed',
			status: 'pending',
		});
	}

	// Only return MMP if we have items beyond the read-only mirror
	if (menuItems.length === 0 && preMortemItems.length === 0 && mirrorItems.length === 0) {
		return undefined;
	}

	const result: MMPPayload = {};

	if (mirrorItems.length > 0) {
		result.mirror = {
			steelMan: `${summary.verified} claims verified, ${summary.disproved + summary.unknown} need attention`,
			items: mirrorItems.slice(0, 10), // Cap at 10 to keep UI manageable
		};
	}

	if (menuItems.length > 0) {
		result.menu = { items: menuItems.slice(0, 5) };
	}

	if (preMortemItems.length > 0) {
		result.preMortem = {
			summary: `${preMortemItems.length} item(s) require your decision before proceeding`,
			items: preMortemItems,
		};
	}

	return result;
}
