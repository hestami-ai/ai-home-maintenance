/**
 * MAKER Data Access Layer
 *
 * CRUD operations for all MAKER Agent Integration Control Plane tables.
 * Each function uses the singleton DB instance from init.ts, prepared
 * statements, and returns Result<T>.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from './init';
import type { Result } from '../types';
import type {
	IntentRecord,
	AcceptanceContract,
	TaskGraph,
	TaskUnit,
	TaskEdge,
	ClaimUnit,
	EvidencePacket,
	ValidationPacket,
	RepairPacket,
	HistoricalInvariantPacket,
	OutcomeSnapshot,
	ToolchainDetection,
	TaskGraphStatus,
	TaskUnitStatus,
	EdgeType,
	ClaimScope,
	RepairClassification,
	RepairResult,
	RiskPosture,
	ClarificationItem,
	ValidationRequirement,
	ValidationCheck,
	FailureType,
	ProviderUsageRecord,
} from '../types/maker';

// ==================== HELPERS ====================

function db() {
	const instance = getDatabase();
	if (!instance) {
		throw new Error('Database not initialized');
	}
	return instance;
}

function parseJSON<T>(value: string | null | undefined, fallback: T): T {
	if (!value) {return fallback;}
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

// ==================== INTENT RECORDS ====================

export function createIntentRecord(
	dialogueId: string,
	humanGoal: string,
	opts?: Partial<Pick<IntentRecord, 'scope_in' | 'scope_out' | 'priority_axes' | 'risk_posture' | 'clarifications_resolved'>>
): Result<IntentRecord> {
	try {
		const intentId = randomUUID();
		const now = new Date().toISOString();
		const record: IntentRecord = {
			intent_id: intentId,
			dialogue_id: dialogueId,
			human_goal: humanGoal,
			scope_in: opts?.scope_in ?? [],
			scope_out: opts?.scope_out ?? [],
			priority_axes: opts?.priority_axes ?? [],
			risk_posture: opts?.risk_posture ?? 'BALANCED' as RiskPosture,
			clarifications_resolved: opts?.clarifications_resolved ?? [],
			created_at: now,
			updated_at: now,
		};

		db().prepare(`
			INSERT INTO intent_records (intent_id, dialogue_id, human_goal, scope_in, scope_out, priority_axes, risk_posture, clarifications_resolved, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			record.intent_id, record.dialogue_id, record.human_goal,
			JSON.stringify(record.scope_in), JSON.stringify(record.scope_out),
			JSON.stringify(record.priority_axes), record.risk_posture,
			JSON.stringify(record.clarifications_resolved),
			record.created_at, record.updated_at
		);

		return { success: true, value: record };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getIntentRecord(intentId: string): Result<IntentRecord> {
	try {
		const row = db().prepare('SELECT * FROM intent_records WHERE intent_id = ?').get(intentId) as Record<string, unknown> | undefined;
		if (!row) {return { success: false, error: new Error(`IntentRecord not found: ${intentId}`) };}
		return { success: true, value: hydrateIntentRecord(row) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getIntentRecordForDialogue(dialogueId: string): Result<IntentRecord | null> {
	try {
		// Tiebreak by rowid (monotonic per insert) so "latest" is deterministic when
		// multiple records share a created_at timestamp.
		const row = db().prepare('SELECT * FROM intent_records WHERE dialogue_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(dialogueId) as Record<string, unknown> | undefined;
		return { success: true, value: row ? hydrateIntentRecord(row) : null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function updateIntentRecord(intentId: string, updates: Partial<Pick<IntentRecord, 'human_goal' | 'scope_in' | 'scope_out' | 'priority_axes' | 'risk_posture' | 'clarifications_resolved'>>): Result<IntentRecord> {
	try {
		const existing = getIntentRecord(intentId);
		if (!existing.success) {return existing;}

		const merged = { ...existing.value, ...updates, updated_at: new Date().toISOString() };
		db().prepare(`
			UPDATE intent_records SET human_goal = ?, scope_in = ?, scope_out = ?, priority_axes = ?, risk_posture = ?, clarifications_resolved = ?, updated_at = ?
			WHERE intent_id = ?
		`).run(
			merged.human_goal, JSON.stringify(merged.scope_in), JSON.stringify(merged.scope_out),
			JSON.stringify(merged.priority_axes), merged.risk_posture,
			JSON.stringify(merged.clarifications_resolved), merged.updated_at, intentId
		);

		return { success: true, value: merged };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

function hydrateIntentRecord(row: Record<string, unknown>): IntentRecord {
	return {
		intent_id: row.intent_id as string,
		dialogue_id: row.dialogue_id as string,
		human_goal: row.human_goal as string,
		scope_in: parseJSON<string[]>(row.scope_in as string, []),
		scope_out: parseJSON<string[]>(row.scope_out as string, []),
		priority_axes: parseJSON<string[]>(row.priority_axes as string, []),
		risk_posture: row.risk_posture as RiskPosture,
		clarifications_resolved: parseJSON<ClarificationItem[]>(row.clarifications_resolved as string, []),
		created_at: row.created_at as string,
		updated_at: row.updated_at as string,
	};
}

// ==================== ACCEPTANCE CONTRACTS ====================

export function createAcceptanceContract(
	intentId: string,
	dialogueId: string,
	opts?: Partial<Pick<AcceptanceContract, 'success_conditions' | 'required_validations' | 'non_goals' | 'human_judgment_required'>>
): Result<AcceptanceContract> {
	try {
		const contractId = randomUUID();
		const contract: AcceptanceContract = {
			contract_id: contractId,
			intent_id: intentId,
			dialogue_id: dialogueId,
			success_conditions: opts?.success_conditions ?? [],
			required_validations: opts?.required_validations ?? [],
			non_goals: opts?.non_goals ?? [],
			human_judgment_required: opts?.human_judgment_required ?? [],
			created_at: new Date().toISOString(),
		};

		db().prepare(`
			INSERT INTO acceptance_contracts (contract_id, intent_id, dialogue_id, success_conditions, required_validations, non_goals, human_judgment_required, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			contract.contract_id, contract.intent_id, contract.dialogue_id,
			JSON.stringify(contract.success_conditions), JSON.stringify(contract.required_validations),
			JSON.stringify(contract.non_goals), JSON.stringify(contract.human_judgment_required),
			contract.created_at
		);

		return { success: true, value: contract };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getAcceptanceContract(contractId: string): Result<AcceptanceContract> {
	try {
		const row = db().prepare('SELECT * FROM acceptance_contracts WHERE contract_id = ?').get(contractId) as Record<string, unknown> | undefined;
		if (!row) {return { success: false, error: new Error(`AcceptanceContract not found: ${contractId}`) };}
		return { success: true, value: hydrateAcceptanceContract(row) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getAcceptanceContractForDialogue(dialogueId: string): Result<AcceptanceContract | null> {
	try {
		// Tiebreak by rowid (monotonic per insert) so "latest" is deterministic when
		// multiple contracts share a created_at timestamp (created_at is ms-resolution
		// from new Date().toISOString(), so collisions in the same millisecond are real).
		const row = db().prepare('SELECT * FROM acceptance_contracts WHERE dialogue_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(dialogueId) as Record<string, unknown> | undefined;
		return { success: true, value: row ? hydrateAcceptanceContract(row) : null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

function hydrateAcceptanceContract(row: Record<string, unknown>): AcceptanceContract {
	return {
		contract_id: row.contract_id as string,
		intent_id: row.intent_id as string,
		dialogue_id: row.dialogue_id as string,
		success_conditions: parseJSON<string[]>(row.success_conditions as string, []),
		required_validations: parseJSON<ValidationRequirement[]>(row.required_validations as string, []),
		non_goals: parseJSON<string[]>(row.non_goals as string, []),
		human_judgment_required: parseJSON<string[]>(row.human_judgment_required as string, []),
		created_at: row.created_at as string,
	};
}

// ==================== TASK GRAPHS ====================

export function createTaskGraph(dialogueId: string, intentId: string, rootGoal: string): Result<TaskGraph> {
	try {
		const graphId = randomUUID();
		const now = new Date().toISOString();
		const graph: TaskGraph = {
			graph_id: graphId,
			dialogue_id: dialogueId,
			intent_id: intentId,
			root_goal: rootGoal,
			graph_status: 'DRAFT' as TaskGraphStatus,
			created_at: now,
			updated_at: now,
		};

		db().prepare(`
			INSERT INTO task_graphs (graph_id, dialogue_id, intent_id, root_goal, graph_status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`).run(graph.graph_id, graph.dialogue_id, graph.intent_id, graph.root_goal, graph.graph_status, graph.created_at, graph.updated_at);

		return { success: true, value: graph };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getTaskGraph(graphId: string): Result<TaskGraph> {
	try {
		const row = db().prepare('SELECT * FROM task_graphs WHERE graph_id = ?').get(graphId) as Record<string, unknown> | undefined;
		if (!row) {return { success: false, error: new Error(`TaskGraph not found: ${graphId}`) };}
		return { success: true, value: hydrateTaskGraph(row) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getTaskGraphForDialogue(dialogueId: string): Result<TaskGraph | null> {
	try {
		const row = db().prepare('SELECT * FROM task_graphs WHERE dialogue_id = ? ORDER BY created_at DESC LIMIT 1').get(dialogueId) as Record<string, unknown> | undefined;
		return { success: true, value: row ? hydrateTaskGraph(row) : null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function updateTaskGraphStatus(graphId: string, status: TaskGraphStatus): Result<TaskGraph> {
	try {
		const now = new Date().toISOString();
		db().prepare('UPDATE task_graphs SET graph_status = ?, updated_at = ? WHERE graph_id = ?').run(status, now, graphId);
		return getTaskGraph(graphId);
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

function hydrateTaskGraph(row: Record<string, unknown>): TaskGraph {
	return {
		graph_id: row.graph_id as string,
		dialogue_id: row.dialogue_id as string,
		intent_id: row.intent_id as string,
		root_goal: row.root_goal as string,
		graph_status: row.graph_status as TaskGraphStatus,
		created_at: row.created_at as string,
		updated_at: row.updated_at as string,
	};
}

// ==================== TASK UNITS ====================

export function createTaskUnit(
	graphId: string,
	unit: Omit<TaskUnit, 'unit_id' | 'graph_id' | 'created_at' | 'updated_at'>
): Result<TaskUnit> {
	try {
		const unitId = randomUUID();
		const now = new Date().toISOString();
		const full: TaskUnit = { ...unit, unit_id: unitId, graph_id: graphId, created_at: now, updated_at: now };

		db().prepare(`
			INSERT INTO task_units (unit_id, graph_id, label, goal, category, inputs, outputs, preconditions, postconditions,
				allowed_tools, preferred_provider, max_change_scope, observables, falsifiers, verification_method,
				status, parent_unit_id, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			full.unit_id, full.graph_id, full.label, full.goal, full.category,
			JSON.stringify(full.inputs), JSON.stringify(full.outputs),
			JSON.stringify(full.preconditions), JSON.stringify(full.postconditions),
			JSON.stringify(full.allowed_tools), full.preferred_provider, full.max_change_scope,
			JSON.stringify(full.observables), JSON.stringify(full.falsifiers), full.verification_method,
			full.status, full.parent_unit_id, full.sort_order, full.created_at, full.updated_at
		);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function bulkCreateTaskUnits(
	graphId: string,
	units: Array<Omit<TaskUnit, 'unit_id' | 'graph_id' | 'created_at' | 'updated_at'>>
): Result<TaskUnit[]> {
	try {
		const results: TaskUnit[] = [];
		const txn = db().transaction(() => {
			for (const unit of units) {
				const result = createTaskUnit(graphId, unit);
				if (!result.success) {throw result.error;}
				results.push(result.value);
			}
		});
		txn();
		return { success: true, value: results };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getTaskUnit(unitId: string): Result<TaskUnit> {
	try {
		const row = db().prepare('SELECT * FROM task_units WHERE unit_id = ?').get(unitId) as Record<string, unknown> | undefined;
		if (!row) {return { success: false, error: new Error(`TaskUnit not found: ${unitId}`) };}
		return { success: true, value: hydrateTaskUnit(row) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getTaskUnitsForGraph(graphId: string): Result<TaskUnit[]> {
	try {
		const rows = db().prepare('SELECT * FROM task_units WHERE graph_id = ? ORDER BY sort_order ASC').all(graphId) as Record<string, unknown>[];
		return { success: true, value: rows.map(hydrateTaskUnit) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getReadyUnits(graphId: string): Result<TaskUnit[]> {
	try {
		const rows = db().prepare("SELECT * FROM task_units WHERE graph_id = ? AND status = 'READY' ORDER BY sort_order ASC").all(graphId) as Record<string, unknown>[];
		return { success: true, value: rows.map(hydrateTaskUnit) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function updateTaskUnitStatus(unitId: string, status: TaskUnitStatus): Result<TaskUnit> {
	try {
		const now = new Date().toISOString();
		db().prepare('UPDATE task_units SET status = ?, updated_at = ? WHERE unit_id = ?').run(status, now, unitId);
		return getTaskUnit(unitId);
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

function hydrateTaskUnit(row: Record<string, unknown>): TaskUnit {
	return {
		unit_id: row.unit_id as string,
		graph_id: row.graph_id as string,
		label: row.label as string,
		goal: row.goal as string,
		category: row.category as TaskUnit['category'],
		inputs: parseJSON<string[]>(row.inputs as string, []),
		outputs: parseJSON<string[]>(row.outputs as string, []),
		preconditions: parseJSON<string[]>(row.preconditions as string, []),
		postconditions: parseJSON<string[]>(row.postconditions as string, []),
		allowed_tools: parseJSON<string[]>(row.allowed_tools as string, []),
		preferred_provider: (row.preferred_provider as string) || null,
		max_change_scope: row.max_change_scope as string,
		observables: parseJSON<string[]>(row.observables as string, []),
		falsifiers: parseJSON<string[]>(row.falsifiers as string, []),
		verification_method: row.verification_method as string,
		status: row.status as TaskUnitStatus,
		parent_unit_id: (row.parent_unit_id as string) || null,
		sort_order: row.sort_order as number,
		created_at: row.created_at as string,
		updated_at: row.updated_at as string,
	};
}

// ==================== TASK EDGES ====================

export function createTaskEdge(graphId: string, fromUnitId: string, toUnitId: string, edgeType: EdgeType): Result<TaskEdge> {
	try {
		const edgeId = randomUUID();
		const edge: TaskEdge = { edge_id: edgeId, graph_id: graphId, from_unit_id: fromUnitId, to_unit_id: toUnitId, edge_type: edgeType };

		db().prepare('INSERT INTO task_edges (edge_id, graph_id, from_unit_id, to_unit_id, edge_type) VALUES (?, ?, ?, ?, ?)')
			.run(edge.edge_id, edge.graph_id, edge.from_unit_id, edge.to_unit_id, edge.edge_type);

		return { success: true, value: edge };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getEdgesForGraph(graphId: string): Result<TaskEdge[]> {
	try {
		const rows = db().prepare('SELECT * FROM task_edges WHERE graph_id = ?').all(graphId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				edge_id: row.edge_id as string,
				graph_id: row.graph_id as string,
				from_unit_id: row.from_unit_id as string,
				to_unit_id: row.to_unit_id as string,
				edge_type: row.edge_type as EdgeType,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getDependenciesForUnit(unitId: string): Result<TaskEdge[]> {
	try {
		const rows = db().prepare("SELECT * FROM task_edges WHERE to_unit_id = ? AND edge_type = 'DEPENDS_ON'").all(unitId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				edge_id: row.edge_id as string,
				graph_id: row.graph_id as string,
				from_unit_id: row.from_unit_id as string,
				to_unit_id: row.to_unit_id as string,
				edge_type: row.edge_type as EdgeType,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== CLAIM UNITS ====================

export function createClaimUnit(unitId: string, statement: string, claimScope: ClaimScope, falsifiers: string[], requiredEvidence: string[]): Result<ClaimUnit> {
	try {
		const claimId = randomUUID();
		const claim: ClaimUnit = { claim_id: claimId, unit_id: unitId, statement, claim_scope: claimScope, falsifiers, required_evidence: requiredEvidence };

		db().prepare('INSERT INTO claim_units (claim_id, unit_id, statement, claim_scope, falsifiers, required_evidence) VALUES (?, ?, ?, ?, ?, ?)')
			.run(claim.claim_id, claim.unit_id, claim.statement, claim.claim_scope, JSON.stringify(claim.falsifiers), JSON.stringify(claim.required_evidence));

		return { success: true, value: claim };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getClaimUnitsForUnit(unitId: string): Result<ClaimUnit[]> {
	try {
		const rows = db().prepare('SELECT * FROM claim_units WHERE unit_id = ?').all(unitId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				claim_id: row.claim_id as string,
				unit_id: row.unit_id as string,
				statement: row.statement as string,
				claim_scope: row.claim_scope as ClaimScope,
				falsifiers: parseJSON<string[]>(row.falsifiers as string, []),
				required_evidence: parseJSON<string[]>(row.required_evidence as string, []),
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getClaimUnitsForGraph(graphId: string): Result<ClaimUnit[]> {
	try {
		const rows = db().prepare(`
			SELECT cu.* FROM claim_units cu
			JOIN task_units tu ON cu.unit_id = tu.unit_id
			WHERE tu.graph_id = ?
		`).all(graphId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				claim_id: row.claim_id as string,
				unit_id: row.unit_id as string,
				statement: row.statement as string,
				claim_scope: row.claim_scope as ClaimScope,
				falsifiers: parseJSON<string[]>(row.falsifiers as string, []),
				required_evidence: parseJSON<string[]>(row.required_evidence as string, []),
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== EVIDENCE PACKETS ====================

export function createEvidencePacket(unitId: string, packet: Partial<Pick<EvidencePacket, 'sources' | 'supported_statements' | 'unsupported_statements' | 'confidence' | 'gaps'>>): Result<EvidencePacket> {
	try {
		const packetId = randomUUID();
		const full: EvidencePacket = {
			packet_id: packetId,
			unit_id: unitId,
			sources: packet.sources ?? [],
			supported_statements: packet.supported_statements ?? [],
			unsupported_statements: packet.unsupported_statements ?? [],
			confidence: packet.confidence ?? 0,
			gaps: packet.gaps ?? [],
			created_at: new Date().toISOString(),
		};

		db().prepare(`
			INSERT INTO evidence_packets (packet_id, unit_id, sources, supported_statements, unsupported_statements, confidence, gaps, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(full.packet_id, full.unit_id, JSON.stringify(full.sources), JSON.stringify(full.supported_statements),
			JSON.stringify(full.unsupported_statements), full.confidence, JSON.stringify(full.gaps), full.created_at);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getEvidencePacketsForUnit(unitId: string): Result<EvidencePacket[]> {
	try {
		const rows = db().prepare('SELECT * FROM evidence_packets WHERE unit_id = ? ORDER BY created_at ASC').all(unitId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				packet_id: row.packet_id as string,
				unit_id: row.unit_id as string,
				sources: parseJSON<string[]>(row.sources as string, []),
				supported_statements: parseJSON<string[]>(row.supported_statements as string, []),
				unsupported_statements: parseJSON<string[]>(row.unsupported_statements as string, []),
				confidence: row.confidence as number,
				gaps: parseJSON<string[]>(row.gaps as string, []),
				created_at: row.created_at as string,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== VALIDATION PACKETS ====================

export function createValidationPacket(
	unitId: string,
	packet: Pick<ValidationPacket, 'checks' | 'expected_observables' | 'actual_observables' | 'pass_fail' | 'failure_type'>
): Result<ValidationPacket> {
	try {
		const validationId = randomUUID();
		const full: ValidationPacket = {
			validation_id: validationId,
			unit_id: unitId,
			checks: packet.checks,
			expected_observables: packet.expected_observables,
			actual_observables: packet.actual_observables,
			pass_fail: packet.pass_fail,
			failure_type: packet.failure_type,
			created_at: new Date().toISOString(),
		};

		db().prepare(`
			INSERT INTO validation_packets (validation_id, unit_id, checks, expected_observables, actual_observables, pass_fail, failure_type, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(full.validation_id, full.unit_id, JSON.stringify(full.checks), JSON.stringify(full.expected_observables),
			JSON.stringify(full.actual_observables), full.pass_fail, full.failure_type, full.created_at);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getValidationPacketsForUnit(unitId: string): Result<ValidationPacket[]> {
	try {
		const rows = db().prepare('SELECT * FROM validation_packets WHERE unit_id = ? ORDER BY created_at ASC').all(unitId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				validation_id: row.validation_id as string,
				unit_id: row.unit_id as string,
				checks: parseJSON<ValidationCheck[]>(row.checks as string, []),
				expected_observables: parseJSON<string[]>(row.expected_observables as string, []),
				actual_observables: parseJSON<string[]>(row.actual_observables as string, []),
				pass_fail: row.pass_fail as 'PASS' | 'FAIL',
				failure_type: (row.failure_type as FailureType) || null,
				created_at: row.created_at as string,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getLatestValidationForUnit(unitId: string): Result<ValidationPacket | null> {
	try {
		// Tiebreak by rowid (monotonic per insert) so "latest" is deterministic when
		// multiple packets share a created_at timestamp.
		const row = db().prepare('SELECT * FROM validation_packets WHERE unit_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(unitId) as Record<string, unknown> | undefined;
		if (!row) {return { success: true, value: null };}
		return {
			success: true,
			value: {
				validation_id: row.validation_id as string,
				unit_id: row.unit_id as string,
				checks: parseJSON<ValidationCheck[]>(row.checks as string, []),
				expected_observables: parseJSON<string[]>(row.expected_observables as string, []),
				actual_observables: parseJSON<string[]>(row.actual_observables as string, []),
				pass_fail: row.pass_fail as 'PASS' | 'FAIL',
				failure_type: (row.failure_type as FailureType) || null,
				created_at: row.created_at as string,
			},
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== REPAIR PACKETS ====================

export function createRepairPacket(
	unitId: string,
	packet: Pick<RepairPacket, 'suspected_cause' | 'repair_strategy' | 'attempt_count' | 'max_attempts' | 'escalation_threshold' | 'diff_before' | 'diff_after' | 'result' | 'wall_clock_ms'>
): Result<RepairPacket> {
	try {
		const repairId = randomUUID();
		const full: RepairPacket = {
			repair_id: repairId,
			unit_id: unitId,
			suspected_cause: packet.suspected_cause,
			repair_strategy: packet.repair_strategy,
			attempt_count: packet.attempt_count,
			max_attempts: packet.max_attempts,
			escalation_threshold: packet.escalation_threshold,
			diff_before: packet.diff_before,
			diff_after: packet.diff_after,
			result: packet.result,
			wall_clock_ms: packet.wall_clock_ms,
			created_at: new Date().toISOString(),
		};

		db().prepare(`
			INSERT INTO repair_packets (repair_id, unit_id, suspected_cause, repair_strategy, attempt_count, max_attempts,
				escalation_threshold, diff_before, diff_after, result, wall_clock_ms, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			full.repair_id, full.unit_id, full.suspected_cause, full.repair_strategy,
			full.attempt_count, full.max_attempts, full.escalation_threshold,
			full.diff_before, full.diff_after, full.result, full.wall_clock_ms, full.created_at
		);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getRepairPacketsForUnit(unitId: string): Result<RepairPacket[]> {
	try {
		const rows = db().prepare('SELECT * FROM repair_packets WHERE unit_id = ? ORDER BY created_at ASC').all(unitId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				repair_id: row.repair_id as string,
				unit_id: row.unit_id as string,
				suspected_cause: row.suspected_cause as string,
				repair_strategy: row.repair_strategy as string,
				attempt_count: row.attempt_count as number,
				max_attempts: row.max_attempts as number,
				escalation_threshold: row.escalation_threshold as RepairClassification,
				diff_before: row.diff_before as string,
				diff_after: row.diff_after as string,
				result: row.result as RepairResult,
				wall_clock_ms: row.wall_clock_ms as number,
				created_at: row.created_at as string,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getRepairAttemptCount(unitId: string): Result<number> {
	try {
		const row = db().prepare('SELECT COUNT(*) as count FROM repair_packets WHERE unit_id = ?').get(unitId) as { count: number };
		return { success: true, value: row.count };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== HISTORICAL INVARIANT PACKETS ====================

export function createHistoricalInvariantPacket(
	dialogueId: string,
	unitId: string | null,
	packet: Partial<Pick<HistoricalInvariantPacket, 'relevant_invariants' | 'prior_failure_motifs' | 'precedent_patterns' | 'reusable_subplans'>>
): Result<HistoricalInvariantPacket> {
	try {
		const packetId = randomUUID();
		const full: HistoricalInvariantPacket = {
			packet_id: packetId,
			unit_id: unitId,
			dialogue_id: dialogueId,
			relevant_invariants: packet.relevant_invariants ?? [],
			prior_failure_motifs: packet.prior_failure_motifs ?? [],
			precedent_patterns: packet.precedent_patterns ?? [],
			reusable_subplans: packet.reusable_subplans ?? [],
			created_at: new Date().toISOString(),
		};

		db().prepare(`
			INSERT INTO historical_invariant_packets (packet_id, unit_id, dialogue_id, relevant_invariants, prior_failure_motifs, precedent_patterns, reusable_subplans, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			full.packet_id, full.unit_id, full.dialogue_id,
			JSON.stringify(full.relevant_invariants), JSON.stringify(full.prior_failure_motifs),
			JSON.stringify(full.precedent_patterns), JSON.stringify(full.reusable_subplans), full.created_at
		);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getHistoricalInvariantPacketsForDialogue(dialogueId: string): Result<HistoricalInvariantPacket[]> {
	try {
		const rows = db().prepare('SELECT * FROM historical_invariant_packets WHERE dialogue_id = ? ORDER BY created_at ASC').all(dialogueId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				packet_id: row.packet_id as string,
				unit_id: (row.unit_id as string) || null,
				dialogue_id: row.dialogue_id as string,
				relevant_invariants: parseJSON<string[]>(row.relevant_invariants as string, []),
				prior_failure_motifs: parseJSON<string[]>(row.prior_failure_motifs as string, []),
				precedent_patterns: parseJSON<string[]>(row.precedent_patterns as string, []),
				reusable_subplans: parseJSON<string[]>(row.reusable_subplans as string, []),
				created_at: row.created_at as string,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== OUTCOME SNAPSHOTS ====================

export function createOutcomeSnapshot(
	dialogueId: string,
	graphId: string,
	snapshot: Pick<OutcomeSnapshot, 'providers_used' | 'augmentations_used' | 'success' | 'failure_modes' | 'useful_invariants' | 'units_completed' | 'units_total' | 'total_wall_clock_ms'>
): Result<OutcomeSnapshot> {
	try {
		const snapshotId = randomUUID();
		const full: OutcomeSnapshot = {
			snapshot_id: snapshotId,
			dialogue_id: dialogueId,
			graph_id: graphId,
			providers_used: snapshot.providers_used,
			augmentations_used: snapshot.augmentations_used,
			success: snapshot.success,
			failure_modes: snapshot.failure_modes,
			useful_invariants: snapshot.useful_invariants,
			units_completed: snapshot.units_completed,
			units_total: snapshot.units_total,
			total_wall_clock_ms: snapshot.total_wall_clock_ms,
			created_at: new Date().toISOString(),
		};

		db().prepare(`
			INSERT INTO outcome_snapshots (snapshot_id, dialogue_id, graph_id, providers_used, augmentations_used, success,
				failure_modes, useful_invariants, units_completed, units_total, total_wall_clock_ms, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			full.snapshot_id, full.dialogue_id, full.graph_id,
			JSON.stringify(full.providers_used), JSON.stringify(full.augmentations_used),
			full.success ? 1 : 0,
			JSON.stringify(full.failure_modes), JSON.stringify(full.useful_invariants),
			full.units_completed, full.units_total, full.total_wall_clock_ms, full.created_at
		);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getOutcomeSnapshotsForDialogue(dialogueId: string): Result<OutcomeSnapshot[]> {
	try {
		const rows = db().prepare('SELECT * FROM outcome_snapshots WHERE dialogue_id = ? ORDER BY created_at ASC').all(dialogueId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				snapshot_id: row.snapshot_id as string,
				dialogue_id: row.dialogue_id as string,
				graph_id: row.graph_id as string,
				providers_used: parseJSON<ProviderUsageRecord[]>(row.providers_used as string, []),
				augmentations_used: parseJSON<string[]>(row.augmentations_used as string, []),
				success: Boolean(row.success),
				failure_modes: parseJSON<string[]>(row.failure_modes as string, []),
				useful_invariants: parseJSON<string[]>(row.useful_invariants as string, []),
				units_completed: row.units_completed as number,
				units_total: row.units_total as number,
				total_wall_clock_ms: row.total_wall_clock_ms as number,
				created_at: row.created_at as string,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== TOOLCHAIN DETECTIONS ====================

export function upsertToolchainDetection(detection: Omit<ToolchainDetection, 'detection_id'>): Result<ToolchainDetection> {
	try {
		const detectionId = randomUUID();
		const full: ToolchainDetection = { detection_id: detectionId, ...detection };

		// Delete existing detections for this workspace+project combo then insert
		db().prepare('DELETE FROM toolchain_detections WHERE workspace_root = ? AND project_type = ?')
			.run(full.workspace_root, full.project_type);

		db().prepare(`
			INSERT INTO toolchain_detections (detection_id, workspace_root, project_type, package_manager, lint_command, type_check_command, test_command, build_command, detected_at, confidence)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			full.detection_id, full.workspace_root, full.project_type, full.package_manager,
			full.lint_command, full.type_check_command, full.test_command, full.build_command,
			full.detected_at, full.confidence
		);

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

export function getToolchainDetectionsForWorkspace(workspaceRoot: string): Result<ToolchainDetection[]> {
	try {
		const rows = db().prepare('SELECT * FROM toolchain_detections WHERE workspace_root = ? ORDER BY confidence DESC').all(workspaceRoot) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				detection_id: row.detection_id as string,
				workspace_root: row.workspace_root as string,
				project_type: row.project_type as string,
				package_manager: row.package_manager as string,
				lint_command: (row.lint_command as string) || null,
				type_check_command: (row.type_check_command as string) || null,
				test_command: (row.test_command as string) || null,
				build_command: (row.build_command as string) || null,
				detected_at: row.detected_at as string,
				confidence: row.confidence as number,
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
