/**
 * Primitive Catalog
 *
 * Registers all composable primitives, wrapping existing functions.
 * Each primitive is a thin adapter between the registry's generic
 * (params, ctx) interface and the actual typed function.
 */

import type { PrimitiveDefinition } from './types';
import { PrimitiveCategory, PrimitiveSafety } from './types';
import type { PrimitiveRegistry } from './registry';
import { getWorkflowState, updateWorkflowMetadata, transitionWorkflow, TransitionTrigger } from '../workflow/stateMachine';
import {
	getGatesForDialogue,
	getGate,
	getBlockingClaims,
	resolveGate,
} from '../workflow/gates';
import { writeClaimEvent, writeDialogueEvent } from '../events/writer';
import { getOrCreateIntakeConversation } from '../events/reader';
import { processHumanGateDecision } from '../workflow/humanGateHandling';
import { updateTaskUnitStatus } from '../database/makerStore';
import { getTaskGraphForDialogue } from '../database/makerStore';
import { getGraphProgress } from '../workflow/taskGraph';
import { killAllActiveProcesses } from '../cli/spawnUtils';
import { assessRetryableActions } from '../ui/governedStream/textCommands';
import { GateStatus, HumanAction, ClaimEventType, Phase, Role } from '../types';
import type { Result } from '../types';
import { getDatabase } from '../database';

// ==================== STATE READS (OPEN) ====================

const stateGetWorkflowState: PrimitiveDefinition = {
	id: 'state.getWorkflowState',
	name: 'Get Workflow State',
	description: 'Read the current workflow phase, metadata, and checkpoint.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
	],
	returns: 'WorkflowState with current_phase and metadata (JSON object)',
	execute: (params) => {
		const result = getWorkflowState(params.dialogueId as string);
		if (!result.success) {return result;}
		// Parse metadata JSON for downstream bind access
		const state = result.value;
		return {
			success: true,
			value: {
				current_phase: state.current_phase,
				previous_phase: state.previous_phase,
				metadata: JSON.parse(state.metadata),
			},
		};
	},
};

const stateGetOpenGates: PrimitiveDefinition = {
	id: 'state.getOpenGates',
	name: 'Get Open Gates',
	description: 'Get all currently open gates for the dialogue.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
	],
	returns: 'Array of Gate objects with gate_id, reason, blocking_claims',
	execute: (params) => getGatesForDialogue(params.dialogueId as string, GateStatus.OPEN),
};

const stateGetGate: PrimitiveDefinition = {
	id: 'state.getGate',
	name: 'Get Gate',
	description: 'Get a single gate by its ID.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'gateId', type: 'string', description: 'Gate ID', required: true },
	],
	returns: 'Gate object with gate_id, status, reason, blocking_claims',
	execute: (params) => getGate(params.gateId as string),
};

const stateGetBlockingClaims: PrimitiveDefinition = {
	id: 'state.getBlockingClaims',
	name: 'Get Blocking Claims',
	description: 'Get the claims that are blocking a specific gate.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'gateId', type: 'string', description: 'Gate ID', required: true },
	],
	returns: 'Array of Claim objects with claim_id, statement, status, criticality',
	execute: (params) => getBlockingClaims(params.gateId as string),
};

const stateGetClaims: PrimitiveDefinition = {
	id: 'state.getClaims',
	name: 'Get Claims',
	description: 'Query claims for the dialogue, optionally filtered by status and/or criticality.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
		{ name: 'status', type: 'string', description: 'Filter by status (OPEN, VERIFIED, DISPROVED, UNKNOWN)', required: false },
		{ name: 'criticality', type: 'string', description: 'Filter by criticality (CRITICAL, HIGH, MEDIUM, LOW)', required: false },
	],
	returns: 'Array of Claim objects',
	execute: (params) => {
		const db = getDatabase();
		if (!db) {return { success: false, error: new Error('Database not initialized') };}
		let sql = 'SELECT * FROM claims WHERE dialogue_id = ?';
		const sqlParams: unknown[] = [params.dialogueId];
		if (params.status) {
			sql += ' AND status = ?';
			sqlParams.push(params.status);
		}
		if (params.criticality) {
			sql += ' AND criticality = ?';
			sqlParams.push(params.criticality);
		}
		return { success: true, value: db.prepare(sql).all(...sqlParams) };
	},
};

const stateGetVerdicts: PrimitiveDefinition = {
	id: 'state.getVerdicts',
	name: 'Get Verdicts',
	description: 'Get all verdicts for claims in this dialogue.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
	],
	returns: 'Array of Verdict objects with verdict_id, claim_id, verdict, rationale',
	execute: (params) => {
		const db = getDatabase();
		if (!db) {return { success: false, error: new Error('Database not initialized') };}
		const rows = db.prepare(
			'SELECT v.* FROM verdicts v JOIN claims c ON v.claim_id = c.claim_id WHERE c.dialogue_id = ?'
		).all(params.dialogueId);
		return { success: true, value: rows };
	},
};

const stateAssessRetryableActions: PrimitiveDefinition = {
	id: 'state.assessRetryableActions',
	name: 'Assess Retryable Actions',
	description: 'Check what retry actions are available: retry verification, retry repair, retry phase.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
	],
	returns: 'Array of RetryableAction with kind, label, description',
	execute: (params) => ({
		success: true,
		value: assessRetryableActions(params.dialogueId as string),
	}),
};

const stateGetIntakeConversation: PrimitiveDefinition = {
	id: 'state.getIntakeConversation',
	name: 'Get Intake Conversation',
	description: 'Get the current intake conversation state (subState, draftPlan, turnCount).',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
	],
	returns: 'IntakeConversationState with subState, draftPlan, turnCount',
	execute: (params) => getOrCreateIntakeConversation(params.dialogueId as string),
};

const stateGetGraphProgress: PrimitiveDefinition = {
	id: 'state.getGraphProgress',
	name: 'Get Task Graph Progress',
	description: 'Get completion stats for the task graph: total, completed, failed, in_progress, pending units.',
	category: PrimitiveCategory.STATE_READ,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
	],
	returns: 'Progress object with total, completed, failed, in_progress, pending counts',
	execute: (params) => {
		const graphResult = getTaskGraphForDialogue(params.dialogueId as string);
		if (!graphResult.success) {return graphResult as Result<unknown>;}
		if (!graphResult.value) {return { success: true, value: null };}
		return getGraphProgress(graphResult.value.graph_id);
	},
};

// ==================== STATE MUTATIONS (GUARDED) ====================

const mutationUpdateMetadata: PrimitiveDefinition = {
	id: 'mutation.updateMetadata',
	name: 'Update Workflow Metadata',
	description: 'Merge key-value updates into workflow state metadata (e.g., clear lastFailedPhase, set flags).',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
		{ name: 'updates', type: 'object', description: 'Key-value pairs to merge into metadata', required: true },
	],
	returns: 'Updated WorkflowState',
	execute: (params) =>
		updateWorkflowMetadata(
			params.dialogueId as string,
			params.updates as Record<string, unknown>
		),
};

const mutationProcessGateDecision: PrimitiveDefinition = {
	id: 'mutation.processGateDecision',
	name: 'Process Gate Decision',
	description: 'Resolve an open gate with a human decision (APPROVE, OVERRIDE, REJECT, REFRAME).',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'gateId', type: 'string', description: 'Gate ID to resolve', required: true },
		{ name: 'action', type: 'string', description: 'APPROVE | OVERRIDE | REJECT | REFRAME', required: true },
		{ name: 'rationale', type: 'string', description: 'Reason for the decision (min 10 chars)', required: true },
	],
	returns: 'HumanDecision record',
	preconditions: [
		(params) => {
			const result = getGate(params.gateId as string);
			if (!result.success) {return { ok: false, reason: `Gate not found: ${params.gateId}` };}
			if (result.value.status !== GateStatus.OPEN) {
				return { ok: false, reason: `Gate is not open (status: ${result.value.status})` };
			}
			return { ok: true };
		},
		(params) => {
			const rat = params.rationale as string;
			if (!rat || rat.length < 10) {
				return { ok: false, reason: 'Rationale must be at least 10 characters' };
			}
			return { ok: true };
		},
	],
	execute: (params) =>
		processHumanGateDecision({
			gateId: params.gateId as string,
			action: params.action as HumanAction,
			rationale: params.rationale as string,
			decisionMaker: 'orchestrator',
		}),
};

const mutationResolveGate: PrimitiveDefinition = {
	id: 'mutation.resolveGate',
	name: 'Resolve Gate',
	description: 'Explicitly close a gate with a resolution string.',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'gateId', type: 'string', description: 'Gate ID', required: true },
		{ name: 'decisionId', type: 'string', description: 'Decision record ID', required: true },
		{ name: 'resolution', type: 'string', description: 'Resolution text', required: true },
	],
	returns: 'Resolved Gate object',
	preconditions: [
		(params) => {
			const result = getGate(params.gateId as string);
			if (!result.success) {return { ok: false, reason: `Gate not found: ${params.gateId}` };}
			if (result.value.status !== GateStatus.OPEN) {
				return { ok: false, reason: `Gate is not open (status: ${result.value.status})` };
			}
			return { ok: true };
		},
	],
	execute: (params) =>
		resolveGate({
			gateId: params.gateId as string,
			decisionId: params.decisionId as string,
			resolution: params.resolution as string,
		}),
};

const mutationWriteClaimEvent: PrimitiveDefinition = {
	id: 'mutation.writeClaimEvent',
	name: 'Write Claim Event',
	description: 'Record a claim lifecycle event (CREATED, VERIFIED, DISPROVED, OVERRIDDEN).',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'claim_id', type: 'string', description: 'Claim ID', required: true },
		{ name: 'event_type', type: 'string', description: 'CREATED | VERIFIED | DISPROVED | OVERRIDDEN', required: true },
		{ name: 'source', type: 'string', description: 'Who triggered this (e.g., HUMAN)', required: true },
		{ name: 'evidence_ref', type: 'string', description: 'Evidence or rationale text', required: false },
	],
	returns: 'ClaimEvent record',
	execute: (params) =>
		writeClaimEvent({
			claim_id: params.claim_id as string,
			event_type: params.event_type as ClaimEventType,
			source: params.source as Role,
			evidence_ref: (params.evidence_ref as string) ?? undefined,
		}),
};

const mutationWriteDialogueEvent: PrimitiveDefinition = {
	id: 'mutation.writeDialogueEvent',
	name: 'Write Dialogue Event',
	description: 'Persist a dialogue event for audit trail.',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'dialogue_id', type: 'string', description: 'Dialogue ID', required: true },
		{ name: 'event_type', type: 'string', description: 'Event type (e.g., orchestrator_plan)', required: true },
		{ name: 'role', type: 'string', description: 'Role (HUMAN, EXECUTOR, etc.)', required: true },
		{ name: 'phase', type: 'string', description: 'Current workflow phase', required: true },
		{ name: 'speech_act', type: 'string', description: 'Speech act type', required: true },
		{ name: 'summary', type: 'string', description: 'Event summary', required: true },
	],
	returns: 'DialogueEvent with event_id',
	execute: (params) =>
		writeDialogueEvent({
			dialogue_id: params.dialogue_id as string,
			event_type: params.event_type as string,
			role: params.role as string,
			phase: params.phase as string,
			speech_act: params.speech_act as string,
			summary: params.summary as string,
		}),
};

const mutationResetClaimsToOpen: PrimitiveDefinition = {
	id: 'mutation.resetClaimsToOpen',
	name: 'Reset Claims to OPEN',
	description: 'Reset DISPROVED or UNKNOWN claims back to OPEN status and delete their verdicts. Used before re-verification.',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'claimIds', type: 'string[]', description: 'Array of claim IDs to reset', required: true },
	],
	returns: 'Number of claims reset',
	execute: (params) => {
		const db = getDatabase();
		if (!db) {return { success: false, error: new Error('Database not initialized') };}
		const ids = params.claimIds as string[];
		if (ids.length === 0) {return { success: true, value: 0 };}
		const placeholders = ids.map(() => '?').join(',');
		db.prepare(
			`UPDATE claims SET status = 'OPEN' WHERE claim_id IN (${placeholders}) AND status IN ('DISPROVED', 'UNKNOWN')`
		).run(...ids);
		db.prepare(
			`DELETE FROM verdicts WHERE claim_id IN (${placeholders})`
		).run(...ids);
		return { success: true, value: ids.length };
	},
};

const mutationResetAllClaimsToOpen: PrimitiveDefinition = {
	id: 'mutation.resetAllClaimsToOpen',
	name: 'Reset ALL Claims to OPEN',
	description: 'Reset ALL claims (including VERIFIED) for a dialogue back to OPEN status and delete their verdicts. Use this for full re-verification from scratch — e.g., after adding novel_dependency detection.',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID — all claims for this dialogue will be reset', required: true },
	],
	returns: 'Object with claimsReset and verdictsDeleted counts',
	execute: (params) => {
		const db = getDatabase();
		if (!db) {return { success: false, error: new Error('Database not initialized') };}
		const dialogueId = params.dialogueId as string;

		// Get all non-OPEN claim IDs for this dialogue
		const claims = db.prepare(
			`SELECT claim_id FROM claims WHERE dialogue_id = ? AND status != 'OPEN'`
		).all(dialogueId) as { claim_id: string }[];

		if (claims.length === 0) {
			return { success: true, value: { claimsReset: 0, verdictsDeleted: 0 } };
		}

		const ids = claims.map(c => c.claim_id);
		const placeholders = ids.map(() => '?').join(',');

		// Delete verdicts first (FK dependency)
		const delResult = db.prepare(
			`DELETE FROM verdicts WHERE claim_id IN (${placeholders})`
		).run(...ids);

		// Reset all claims to OPEN
		const updResult = db.prepare(
			`UPDATE claims SET status = 'OPEN' WHERE claim_id IN (${placeholders})`
		).run(...ids);

		return {
			success: true,
			value: {
				claimsReset: updResult.changes,
				verdictsDeleted: delResult.changes,
			},
		};
	},
};

const mutationUpdateTaskUnitStatus: PrimitiveDefinition = {
	id: 'mutation.updateTaskUnitStatus',
	name: 'Update Task Unit Status',
	description: 'Change a task unit status (PENDING, READY, IN_PROGRESS, COMPLETED, FAILED, SKIPPED).',
	category: PrimitiveCategory.STATE_MUTATION,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'unitId', type: 'string', description: 'Task unit ID', required: true },
		{ name: 'status', type: 'string', description: 'New status', required: true },
	],
	returns: 'Updated TaskUnit',
	execute: (params) =>
		updateTaskUnitStatus(params.unitId as string, params.status as any),
};

// ==================== UI COMMUNICATION (OPEN) ====================

const uiSystemMessage: PrimitiveDefinition = {
	id: 'ui.systemMessage',
	name: 'Show System Message',
	description: 'Display an informational message in the governed stream.',
	category: PrimitiveCategory.UI_COMMUNICATION,
	safety: PrimitiveSafety.OPEN,
	params: [
		{ name: 'message', type: 'string', description: 'Message text to display', required: true },
	],
	returns: 'void',
	execute: (params, ctx) => {
		ctx.uiChannel.postSystemMessage(params.message as string);
		return { success: true, value: undefined };
	},
};

// ==================== WORKFLOW CONTROL ====================

const controlRunWorkflowCycle: PrimitiveDefinition = {
	id: 'control.runWorkflowCycle',
	name: 'Run Workflow Cycle',
	description: 'Advance the workflow by running the main execution loop. The workflow will continue from the current phase.',
	category: PrimitiveCategory.WORKFLOW_CONTROL,
	safety: PrimitiveSafety.GUARDED,
	params: [],
	returns: 'void (workflow advances asynchronously)',
	execute: async (_params, ctx) => {
		await ctx.uiChannel.runWorkflowCycle();
		return { success: true, value: undefined };
	},
};

const controlTransitionToPhase: PrimitiveDefinition = {
	id: 'control.transitionToPhase',
	name: 'Transition to Phase',
	description: 'Move the workflow to a specific phase and automatically start executing from there. Uses MANUAL_OVERRIDE trigger, bypassing the forward-only transition graph. No need to call control.runWorkflowCycle separately — this primitive does both.',
	category: PrimitiveCategory.WORKFLOW_CONTROL,
	safety: PrimitiveSafety.GUARDED,
	params: [
		{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
		{ name: 'toPhase', type: 'string', description: 'Target phase: INTAKE, ARCHITECTURE, PROPOSE, ASSUMPTION_SURFACING, VERIFY, HISTORICAL_CHECK, REVIEW, EXECUTE, VALIDATE, COMMIT', required: true },
	],
	returns: 'Updated WorkflowState with new current_phase (workflow cycle started)',
	preconditions: [
		(params) => {
			const validPhases = Object.values(Phase);
			if (!validPhases.includes(params.toPhase as Phase)) {
				return { ok: false, reason: `Invalid phase: ${params.toPhase}. Valid phases: ${validPhases.join(', ')}` };
			}
			return { ok: true };
		},
	],
	execute: async (params, ctx) => {
		const result = transitionWorkflow(
			params.dialogueId as string,
			params.toPhase as Phase,
			TransitionTrigger.MANUAL_OVERRIDE,
			{ source: 'orchestrator', reason: 'User-requested phase transition' },
		);
		if (!result.success) {return result;}
		// Auto-run the workflow cycle from the new phase
		ctx.uiChannel.postSystemMessage(`Transitioned to ${params.toPhase} — starting execution...`);
		await ctx.uiChannel.runWorkflowCycle();
		return result;
	},
};

const controlKillAllProcesses: PrimitiveDefinition = {
	id: 'control.killAllProcesses',
	name: 'Kill All Active CLI Processes',
	description: 'Terminate all running CLI child processes. DANGEROUS — interrupts execution.',
	category: PrimitiveCategory.WORKFLOW_CONTROL,
	safety: PrimitiveSafety.RESTRICTED,
	params: [],
	returns: 'Number of processes killed',
	execute: () => ({ success: true, value: killAllActiveProcesses() }),
};

// ==================== REGISTRATION ====================

export function registerAllPrimitives(registry: PrimitiveRegistry): void {
	// State Reads
	registry.register(stateGetWorkflowState);
	registry.register(stateGetOpenGates);
	registry.register(stateGetGate);
	registry.register(stateGetBlockingClaims);
	registry.register(stateGetClaims);
	registry.register(stateGetVerdicts);
	registry.register(stateAssessRetryableActions);
	registry.register(stateGetIntakeConversation);
	registry.register(stateGetGraphProgress);

	// State Mutations
	registry.register(mutationUpdateMetadata);
	registry.register(mutationProcessGateDecision);
	registry.register(mutationResolveGate);
	registry.register(mutationWriteClaimEvent);
	registry.register(mutationWriteDialogueEvent);
	registry.register(mutationResetClaimsToOpen);
	registry.register(mutationResetAllClaimsToOpen);
	registry.register(mutationUpdateTaskUnitStatus);

	// UI Communication
	registry.register(uiSystemMessage);

	// Workflow Control
	registry.register(controlRunWorkflowCycle);
	registry.register(controlTransitionToPhase);
	registry.register(controlKillAllProcesses);
}
