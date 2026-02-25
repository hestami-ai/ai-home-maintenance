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
import { getDialogueTurns, getClaims, getVerdicts, getGates, getIntakeConversation, getIntakeTurns } from '../../events/reader';
import { getWorkflowState, type WorkflowState } from '../../workflow/stateMachine';
import { getAllDialogues, type DialogueRecord } from '../../dialogue/lifecycle';
import {
	getCommandsForDialogue,
	getCommandOutputs,
	type WorkflowCommandRecord,
	type WorkflowCommandOutput,
} from '../../workflow/commandStore';
import type { IntakePlanDocument, IntakeConversationTurn } from '../../types/intake';
import { IntakeSubState } from '../../types/intake';

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
 * A stream item: dialogue turn, gate, milestone, or dialogue boundary marker
 */
export type StreamItem =
	| { type: 'turn'; turn: DialogueTurn; claims: Claim[]; verdict?: Verdict }
	| { type: 'gate'; gate: Gate; blockingClaims: Claim[] }
	| PhaseMilestone
	| { type: 'dialogue_start'; dialogueId: string; goal: string; title: string | null; timestamp: string }
	| { type: 'dialogue_end'; dialogueId: string; status: string; timestamp: string }
	| { type: 'command_block'; command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }
	| { type: 'intake_turn'; turn: IntakeConversationTurn; timestamp: string }
	| { type: 'intake_plan_preview'; plan: IntakePlanDocument; isFinal: boolean; timestamp: string }
	| { type: 'intake_approval_gate'; plan: IntakePlanDocument; dialogueId: string; timestamp: string };

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
	gates: Gate[]
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

	// Build a timeline of gates by created_at for interleaving
	const gateTimeline = gates
		.filter((g) => g.status === GateStatus.OPEN)
		.map((g) => ({ gate: g, timestamp: g.created_at }));

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
			items.push({ type: 'gate', gate, blockingClaims });
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
		items.push({ type: 'gate', gate, blockingClaims });
		gateIdx++;
	}

	return items;
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
	const turnItems = buildStreamItems(turns, claims, verdicts, gates);

	// Fetch persisted command blocks for this dialogue
	const commandItems = buildCommandBlockItems(record.dialogue_id);

	// Merge turn-based items and command blocks by timestamp
	const mergedItems = mergeStreamItemsByTimestamp(turnItems, commandItems);

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
		case 'milestone': raw = item.timestamp; break;
		case 'dialogue_start': raw = item.timestamp; break;
		case 'dialogue_end': raw = item.timestamp; break;
		case 'command_block': raw = item.command.started_at; break;
		case 'intake_turn': raw = item.timestamp; break;
		case 'intake_plan_preview': raw = item.timestamp; break;
		case 'intake_approval_gate': raw = item.timestamp; break;
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
 * Milestones and intake_turns should appear before command_blocks at the same time.
 */
function getStreamItemSortPriority(item: StreamItem): number {
	switch (item.type) {
		case 'milestone': return 0;
		case 'dialogue_start': return 1;
		case 'intake_turn': return 2;
		case 'turn': return 3;
		case 'intake_plan_preview': return 4;
		case 'command_block': return 5;
		case 'gate': return 6;
		case 'intake_approval_gate': return 7;
		case 'dialogue_end': return 8;
		default: return 9;
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
	const streamItems = mergeStreamItemsByTimestamp(turnItems, commandItems);
	const claimHealth = computeClaimHealth(claims);

	// Apply intake processing (filter audit turns, inject proper cards)
	applyIntakeStreamProcessing(effectiveDialogueId, streamItems);
	const intakeState = buildIntakeState(effectiveDialogueId, currentPhase, streamItems);

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

	// Remove INTAKE-phase audit dialogue_turns — the richer intake_turn cards replace them.
	for (let i = streamItems.length - 1; i >= 0; i--) {
		const item = streamItems[i];
		if (item.type === 'turn' && item.turn.phase === Phase.INTAKE) {
			streamItems.splice(i, 1);
		}
	}

	// Inject intake turn cards with plan previews at each version change
	const turnsResult = getIntakeTurns(dialogueId);
	let lastPlanVersion = 0;
	let firstIntakeTurnTimestamp: string | null = null;
	if (turnsResult.success) {
		for (const turn of turnsResult.value) {
			if (!firstIntakeTurnTimestamp) {
				firstIntakeTurnTimestamp = turn.createdAt;
			}
			streamItems.push({
				type: 'intake_turn',
				turn,
				timestamp: turn.createdAt,
			});

			const turnPlanVersion = turn.planSnapshot?.version ?? 0;
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
	}

	// Fix INTAKE milestone timestamps: audit dialogue_turns are written AFTER the
	// command block completes, so the milestone inherits a late timestamp. Reset it
	// to match the first intake_turn so the milestone sorts before command blocks.
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

	// Inject approval gate if awaiting approval (active dialogue only)
	if (conv.subState === IntakeSubState.AWAITING_APPROVAL && conv.finalizedPlan) {
		streamItems.push({
			type: 'intake_approval_gate',
			plan: conv.finalizedPlan,
			dialogueId,
			timestamp: conv.updatedAt,
		});
	}

	return {
		subState: conv.subState,
		turnCount: conv.turnCount,
		currentPlan: conv.draftPlan,
		finalizedPlan: conv.finalizedPlan,
	};
}
