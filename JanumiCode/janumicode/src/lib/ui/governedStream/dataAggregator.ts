/**
 * Data Aggregator for Governed Stream
 * Aggregates all data needed for the unified Governed Stream view
 * into a single GovernedStreamState snapshot.
 *
 * Supports multi-dialogue streams: the stream renders ALL dialogues
 * chronologically with boundary markers, while the header/health bar
 * reflects only the active dialogue.
 */

import type { DialogueTurn, Claim, Verdict, Gate } from '../../types';
import { ClaimStatus, GateStatus, Phase } from '../../types';
import { getDialogueTurns, getClaims, getVerdicts, getGates, getHumanDecisions, getIntakeConversation, getIntakeTurns, getQaExchanges } from '../../events/reader';
import { getWorkflowState, type WorkflowState } from '../../workflow/stateMachine';
import { getAllDialogues, type DialogueRecord } from '../../dialogue/lifecycle';
import {
	getCommandsForDialogue,
	getCommandOutputs,
	type WorkflowCommandRecord,
	type WorkflowCommandOutput,
} from '../../workflow/commandStore';
import type { IntakePlanDocument, IntakeConversationTurn, DomainCoverageMap, IntakeModeRecommendation, IntakeCheckpoint, IntakeGatheringTurnResponse } from '../../types/intake';
import { IntakeSubState, DomainCoverageLevel, isGatheringResponse, isAnalysisResponse } from '../../types/intake';
import { DOMAIN_INFO, DOMAIN_SEQUENCE, type EngineeringDomain } from '../../workflow/domainCoverageTracker';
import type { HumanFacingStatus } from '../../types/maker';
import { resolveHumanFacingState } from '../../workflow/humanFacingState';
import { getTaskGraphForDialogue, getTaskUnitsForGraph } from '../../database/makerStore';
import { getGraphProgress } from '../../workflow/taskGraph';
import { getDatabase } from '../../database';

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
	| { type: 'turn'; turn: DialogueTurn; claims: Claim[]; verdict?: Verdict }
	| { type: 'gate'; gate: Gate; blockingClaims: Claim[]; resolvedAction?: string; metadata?: Record<string, unknown> }
	| { type: 'verification_gate'; gate: Gate; allClaims: Claim[]; verdicts: Verdict[]; blockingClaims: Claim[]; resolvedAction?: string }
	| { type: 'review_gate'; gate: Gate; allClaims: Claim[]; verdicts: Verdict[];
		historianFindings: string[]; reviewItems: ReviewItem[]; summary: ReviewSummary; resolvedAction?: string; resolvedRationale?: string }
	| PhaseMilestone
	| { type: 'dialogue_start'; dialogueId: string; goal: string; title: string | null; timestamp: string }
	| { type: 'dialogue_end'; dialogueId: string; status: string; timestamp: string }
	| { type: 'command_block'; command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }
	| { type: 'intake_turn'; turn: IntakeConversationTurn; timestamp: string; commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }> }
	| { type: 'intake_plan_preview'; plan: IntakePlanDocument; isFinal: boolean; timestamp: string }
	| { type: 'intake_approval_gate'; plan: IntakePlanDocument; dialogueId: string; timestamp: string; resolved?: boolean; resolvedAction?: string }
	| { type: 'intake_mode_selector'; recommendation: IntakeModeRecommendation; timestamp: string; resolved?: boolean; selectedMode?: string }
	| { type: 'intake_checkpoint'; checkpoint: IntakeCheckpoint; timestamp: string; resolved?: boolean }
	| { type: 'intake_domain_transition'; fromDomain: string; fromLabel: string; toDomain: string | null; toLabel: string | null; toDescription: string | null; timestamp: string }
	| { type: 'intake_gathering_complete'; coverageSummary: { adequate: number; partial: number; none: number; percentage: number }; intakeMode: string | null; timestamp: string }
	| { type: 'intake_analysis'; humanMessage: string; analysisSummary: string; codebaseFindings: string[]; domainAssessment: Array<{ domain: string; level: string; evidence: string }>; timestamp: string; commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }> }
	| { type: 'intake_proposal'; title: string; summary: string; proposedApproach: string; domainCoverage: { adequate: number; partial: number; none: number; percentage: number }; timestamp: string }
	| { type: 'qa_exchange'; question: string; answer: string; timestamp: string };

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
		domainCoverage: DomainCoverageMap | null;
		currentDomain: string | null;
		intakeMode: string | null;
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
 * Build stream items for a single dialogue with phase milestone dividers
 */
function buildStreamItems(
	turns: DialogueTurn[],
	claims: Claim[],
	verdicts: Verdict[],
	gates: Gate[],
	dialogueId?: string
): StreamItem[] {
	const items: StreamItem[] = [];

	let lastPhase: Phase | null = null;

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

	let gateIdx = 0;

	for (const turn of turns) {
		// Insert milestone divider on phase change
		if (turn.phase !== lastPhase) {
			items.push({
				type: 'milestone',
				phase: turn.phase,
				timestamp: turn.timestamp,
			});
			lastPhase = turn.phase;
		}

		// Insert any gates that were triggered before this turn
		while (
			gateIdx < gateTimeline.length &&
			gateTimeline[gateIdx].timestamp <= turn.timestamp
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

		// Build the turn item
		const turnClaims = claimsByTurn.get(turn.turn_id) ?? [];
		const firstClaim = turnClaims[0];
		const verdict = firstClaim ? verdictByClaim.get(firstClaim.claim_id) : undefined;

		items.push({
			type: 'turn',
			turn,
			claims: turnClaims,
			verdict,
		});
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
	const turnsResult = getDialogueTurns({ dialogue_id: record.dialogue_id, limit: 200 });
	const turns = turnsResult.success ? turnsResult.value : [];

	const claimsResult = getClaims({ dialogue_id: record.dialogue_id });
	const claims = claimsResult.success ? claimsResult.value : [];

	const verdictsResult = getVerdicts();
	const allVerdicts = verdictsResult.success ? verdictsResult.value : [];
	// Filter verdicts to those for claims in this dialogue
	const claimIds = new Set(claims.map((c) => c.claim_id));
	const verdicts = allVerdicts.filter((v) => claimIds.has(v.claim_id));

	const gatesResult = getGates({ dialogue_id: record.dialogue_id });
	const gates = gatesResult.success ? gatesResult.value : [];

	// Build the inner stream items (turns, milestones, gates)
	const turnItems = buildStreamItems(turns, claims, verdicts, gates, record.dialogue_id);

	// Fetch persisted command blocks and Q&A exchanges for this dialogue
	const commandItems = buildCommandBlockItems(record.dialogue_id);
	const qaItems = buildQaExchangeItems(record.dialogue_id);

	// Merge turn-based items, command blocks, and Q&A exchanges by timestamp
	const mergedItems = mergeStreamItemsByTimestamp(
		mergeStreamItemsByTimestamp(turnItems, commandItems), qaItems
	);

	// Apply intake processing: if this dialogue has intake conversation data,
	// filter out INTAKE-phase audit dialogue_turns and inject proper intake_turn
	// cards with per-version plan previews. This ensures historical dialogues
	// also render intake conversations correctly.
	applyIntakeStreamProcessing(record.dialogue_id, mergedItems);

	// Re-sort after intake processing (it pushes new items to the end)
	sortStreamItemsByTimestamp(mergedItems);

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

	return cmdsResult.value.map((cmd) => {
		const outputsResult = getCommandOutputs(cmd.command_id);
		const outputs = outputsResult.success ? outputsResult.value : [];
		return { type: 'command_block' as const, command: cmd, outputs };
	});
}

/**
 * Build qa_exchange StreamItems for a dialogue from the database
 */
function buildQaExchangeItems(dialogueId: string): StreamItem[] {
	const result = getQaExchanges(dialogueId);
	if (!result.success) { return []; }
	return result.value.map((qa) => ({
		type: 'qa_exchange' as const,
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
	const normalized = raw.toUpperCase().replace(/\bAND\b/g, '').replace(/[_\s]+/g, '_').replace(/^_|_$/g, '');
	for (const domain of DOMAIN_SEQUENCE) {
		if (domain === normalized) { return domain; }
	}
	// Fallback: match by label
	const lowerRaw = raw.toLowerCase().replace(/_/g, ' ');
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
	// Already has 'T' separator — normalize by ensuring Z suffix
	if (ts.includes('T')) { return ts; }
	// SQLite format "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"
	return ts.replace(' ', 'T') + 'Z';
}

/**
 * Extract a timestamp from a StreamItem for ordering
 */
function getStreamItemTimestamp(item: StreamItem): string {
	let raw: string;
	switch (item.type) {
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
		case 'intake_proposal': raw = item.timestamp; break;
		case 'qa_exchange': raw = item.timestamp; break;
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
		case 'intake_turn': return 2;
		case 'command_block': return 3;
		case 'intake_plan_preview': return 4;
		case 'turn': return 5;
		case 'gate': return 6;
		case 'verification_gate': return 6;
		case 'review_gate': return 7;
		case 'intake_approval_gate': return 8;
		case 'intake_mode_selector': return 3;
		case 'intake_analysis': return 1.5;    // After dialogue_start, before intake_turn
		case 'intake_proposal': return 1.8;    // After analysis, before turns
		case 'intake_domain_transition': return 5;
		case 'intake_gathering_complete': return 6;
		case 'intake_checkpoint': return 7;
		case 'qa_exchange': return 4;
		case 'dialogue_end': return 9;
		default: return 10;
	}
}

/**
 * Sort a StreamItem array in-place by normalized timestamp,
 * with type-based tiebreaking for items at the same time.
 */
function sortStreamItemsByTimestamp(items: StreamItem[]): void {
	items.sort((a, b) => {
		const ta = getStreamItemTimestamp(a);
		const tb = getStreamItemTimestamp(b);
		if (ta < tb) { return -1; }
		if (ta > tb) { return 1; }
		// Tiebreaker: milestones/turns before command blocks at same timestamp
		return getStreamItemSortPriority(a) - getStreamItemSortPriority(b);
	});
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
	const turnsResult = getDialogueTurns(
		dialogueId ? { dialogue_id: dialogueId, limit: 200 } : { limit: 200 }
	);
	if (!turnsResult.success || turnsResult.value.length === 0) {
		return emptyState;
	}

	const turns = turnsResult.value;
	const effectiveDialogueId = dialogueId ?? turns[0].dialogue_id;

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

	const turnItems = buildStreamItems(turns, claims, verdicts, allGates);
	const commandItems = buildCommandBlockItems(effectiveDialogueId);
	const qaItems = buildQaExchangeItems(effectiveDialogueId);
	const streamItems = mergeStreamItemsByTimestamp(
		mergeStreamItemsByTimestamp(turnItems, commandItems), qaItems
	);
	const claimHealth = computeClaimHealth(claims);

	// Apply intake processing (filter audit turns, inject proper cards)
	applyIntakeStreamProcessing(effectiveDialogueId, streamItems);
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
		humanFacingState: makerState.humanFacingState,
		taskGraphProgress: makerState.taskGraphProgress,
	};
}

/**
 * Apply intake stream processing to a dialogue's stream items.
 * If the dialogue has intake conversation data, this:
 *   1. Filters out INTAKE-phase audit dialogue_turns (they duplicate richer intake cards)
 *   2. Injects proper intake_turn cards with per-version plan previews
 *   3. Appends a finalized-plan card if one exists
 *
 * Called from buildDialogueStreamItems so it applies to ALL dialogues,
 * not just the active one.
 */
function applyIntakeStreamProcessing(dialogueId: string, streamItems: StreamItem[]): void {
	const convResult = getIntakeConversation(dialogueId);
	if (!convResult.success || !convResult.value) {
		return;
	}

	const conv = convResult.value;

	// Remove INTAKE-phase audit dialogue_turns — they are lightweight audit
	// entries ({role, phase, content_ref}) with no message text. The richer
	// intake_turn / intake_analysis cards replace them with full content.
	for (let i = streamItems.length - 1; i >= 0; i--) {
		const item = streamItems[i];
		if (item.type === 'turn' && item.turn.phase === Phase.INTAKE) {
			streamItems.splice(i, 1);
		}
	}

	// Inject intake turn cards with associated command blocks embedded inside.
	// Each intake turn is persisted AFTER its CLI command completes, so its
	// createdAt is later than the command_block started_at. We:
	//   1. Associate command_blocks with the intake turn they belong to
	//   2. Embed them in the intake_turn StreamItem (rendered between human/expert)
	//   3. Remove them from the main stream to avoid duplication
	//   4. Adjust the intake_turn timestamp to the earliest associated command_block
	const turnsResult = getIntakeTurns(dialogueId);
	let lastPlanVersion = 0;
	let firstIntakeTurnTimestamp: string | null = null;
	if (turnsResult.success) {
		// Collect command_block items sorted chronologically
		const cmdBlockItems = streamItems
			.filter((item): item is Extract<StreamItem, { type: 'command_block' }> => item.type === 'command_block')
			.sort((a, b) => normalizeTimestamp(a.command.started_at).localeCompare(normalizeTimestamp(b.command.started_at)));

		// Track which command_block IDs are consumed by intake turns
		const consumedCommandIds = new Set<string>();

		let previousTurnNormalized = '';
		for (const turn of turnsResult.value) {
			const normalizedTurnTs = normalizeTimestamp(turn.createdAt);

			// Find command_blocks between the previous turn and this turn
			const associatedCmds = cmdBlockItems.filter((cmd) => {
				const cmdTs = normalizeTimestamp(cmd.command.started_at);
				return cmdTs < normalizedTurnTs &&
					(!previousTurnNormalized || cmdTs > previousTurnNormalized) &&
					!consumedCommandIds.has(cmd.command.command_id);
			});
			for (const cmd of associatedCmds) {
				consumedCommandIds.add(cmd.command.command_id);
			}

			// Use the earliest associated command_block timestamp for ordering
			const effectiveTimestamp = associatedCmds.length > 0
				? associatedCmds[0].command.started_at
				: turn.createdAt;

			if (!firstIntakeTurnTimestamp) {
				firstIntakeTurnTimestamp = effectiveTimestamp;
			}

			// Build the embedded command block data
			const embeddedBlocks = associatedCmds.map((cmd) => ({
				command: cmd.command,
				outputs: cmd.outputs,
			}));

			// Check if this is an analysis turn (inverted flow)
			if (isAnalysisResponse(turn.expertResponse)) {
				const analysis = turn.expertResponse;
				streamItems.push({
					type: 'intake_analysis',
					humanMessage: turn.humanMessage,
					analysisSummary: analysis.analysisSummary,
					codebaseFindings: analysis.codebaseFindings ?? [],
					domainAssessment: analysis.domainAssessment ?? [],
					timestamp: effectiveTimestamp,
					commandBlocks: embeddedBlocks.length > 0 ? embeddedBlocks : undefined,
				});
				// Add proposal card derived from the analysis
				const plan = analysis.initialPlan;
				if (plan) {
					const coverage = conv.domainCoverage;
					let adequate = 0, partial = 0, none = 0;
					if (coverage) {
						for (const domain of DOMAIN_SEQUENCE) {
							switch (coverage[domain]?.level) {
								case DomainCoverageLevel.ADEQUATE: adequate++; break;
								case DomainCoverageLevel.PARTIAL: partial++; break;
								default: none++; break;
							}
						}
					}
					const total = DOMAIN_SEQUENCE.length;
					const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);
					streamItems.push({
						type: 'intake_proposal',
						title: plan.title,
						summary: plan.summary,
						proposedApproach: plan.proposedApproach,
						domainCoverage: { adequate, partial, none, percentage },
						timestamp: turn.createdAt,
					});
					lastPlanVersion = plan.version;
				}
			} else {
				streamItems.push({
					type: 'intake_turn',
					turn,
					timestamp: effectiveTimestamp,
					commandBlocks: embeddedBlocks.length > 0 ? embeddedBlocks : undefined,
				});

				const turnPlanVersion = turn.planSnapshot?.version ?? 0;
				// Skip plan preview for gathering turns (version 0) or unchanged versions
				if (turnPlanVersion > 0 && turnPlanVersion !== lastPlanVersion) {
					streamItems.push({
						type: 'intake_plan_preview',
						plan: turn.planSnapshot,
						isFinal: false,
						timestamp: turn.createdAt,
					});
					lastPlanVersion = turnPlanVersion;
				}
			}

			previousTurnNormalized = normalizedTurnTs;
		}

		// Remove consumed command_blocks from the main stream
		if (consumedCommandIds.size > 0) {
			for (let i = streamItems.length - 1; i >= 0; i--) {
				const item = streamItems[i];
				if (item.type === 'command_block' && consumedCommandIds.has(item.command.command_id)) {
					streamItems.splice(i, 1);
				}
			}
		}
	}

	// Fix INTAKE milestone timestamp to sort before all INTAKE content.
	if (firstIntakeTurnTimestamp) {
		for (const item of streamItems) {
			if (item.type === 'milestone' && item.phase === Phase.INTAKE) {
				item.timestamp = firstIntakeTurnTimestamp;
			}
		}
	}

	// Append finalized plan if it differs from the last draft version
	if (conv.finalizedPlan && conv.finalizedPlan.version !== lastPlanVersion) {
		streamItems.push({
			type: 'intake_plan_preview',
			plan: conv.finalizedPlan,
			isFinal: true,
			timestamp: conv.updatedAt,
		});
	}

	// Inject mode selector card if classifier result exists
	if (conv.classifierResult) {
		const isResolved = !!conv.intakeMode;
		// Use the earliest intake content timestamp for ordering
		const selectorTimestamp = firstIntakeTurnTimestamp || conv.createdAt;
		streamItems.push({
			type: 'intake_mode_selector',
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
				checkpoint,
				timestamp: conv.updatedAt,
				resolved: true,
			});
		}
	}

	// Inject domain transition and gathering-complete cards from gathering turn data
	if (turnsResult.success) {
		const gatheringTurns = turnsResult.value.filter(
			(t) => isGatheringResponse(t.expertResponse),
		);

		// Domain transitions: detect consecutive gathering turns with different focusDomain
		for (let gi = 1; gi < gatheringTurns.length; gi++) {
			const prev = gatheringTurns[gi - 1].expertResponse as IntakeGatheringTurnResponse;
			const curr = gatheringTurns[gi].expertResponse as IntakeGatheringTurnResponse;
			// Normalize domain strings to canonical enum values for comparison
			const prevResolved = resolveDomainEnum(prev.focusDomain);
			const currResolved = resolveDomainEnum(curr.focusDomain);
			if (prevResolved !== currResolved) {
				const fromInfo = prevResolved ? DOMAIN_INFO[prevResolved] : undefined;
				const toInfo = currResolved ? DOMAIN_INFO[currResolved] : undefined;
				streamItems.push({
					type: 'intake_domain_transition',
					fromDomain: prev.focusDomain,
					fromLabel: fromInfo?.label ?? prev.focusDomain,
					toDomain: curr.focusDomain,
					toLabel: toInfo?.label ?? curr.focusDomain,
					toDescription: toInfo?.description ?? null,
					timestamp: gatheringTurns[gi].createdAt,
				});
			}
		}

		// Gathering complete: if there are gathering turns and subState advanced past GATHERING
		if (gatheringTurns.length > 0 && conv.subState !== IntakeSubState.GATHERING) {
			const coverage = conv.domainCoverage;
			let adequate = 0;
			let partial = 0;
			let none = 0;
			if (coverage) {
				for (const domain of DOMAIN_SEQUENCE) {
					switch (coverage[domain].level) {
						case DomainCoverageLevel.ADEQUATE: adequate++; break;
						case DomainCoverageLevel.PARTIAL: partial++; break;
						default: none++; break;
					}
				}
			}
			const total = DOMAIN_SEQUENCE.length;
			const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);
			streamItems.push({
				type: 'intake_gathering_complete',
				coverageSummary: { adequate, partial, none, percentage },
				intakeMode: conv.intakeMode ?? null,
				timestamp: gatheringTurns[gatheringTurns.length - 1].createdAt,
			});
		}
	}

	// Inject approval gate as a persistent stream artifact:
	// - AWAITING_APPROVAL: active card with approve/continue buttons
	// - DISCUSSING with finalized plan: user chose "Continue Discussing" → resolved
	// - Phase past INTAKE: plan was approved → resolved
	if (conv.finalizedPlan) {
		const wsResult = getWorkflowState(dialogueId);
		const currentPhase = wsResult.success ? wsResult.value.current_phase : Phase.INTAKE;

		if (conv.subState === IntakeSubState.AWAITING_APPROVAL) {
			// Active: awaiting user decision
			streamItems.push({
				type: 'intake_approval_gate',
				plan: conv.finalizedPlan,
				dialogueId,
				timestamp: conv.updatedAt,
			});
		} else if (currentPhase !== Phase.INTAKE) {
			// Phase has moved past INTAKE → plan was approved
			streamItems.push({
				type: 'intake_approval_gate',
				plan: conv.finalizedPlan,
				dialogueId,
				timestamp: conv.updatedAt,
				resolved: true,
				resolvedAction: 'Approved',
			});
		} else if (conv.subState === IntakeSubState.DISCUSSING) {
			// Back to discussing after seeing the finalized plan → user chose to continue
			streamItems.push({
				type: 'intake_approval_gate',
				plan: conv.finalizedPlan,
				dialogueId,
				timestamp: conv.updatedAt,
				resolved: true,
				resolvedAction: 'Continued Discussing',
			});
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
		domainCoverage: conv.domainCoverage ?? null,
		currentDomain: conv.currentDomain ?? null,
		intakeMode: conv.intakeMode ?? null,
	};
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
