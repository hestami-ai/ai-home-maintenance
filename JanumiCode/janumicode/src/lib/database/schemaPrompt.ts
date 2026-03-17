/**
 * Schema Prompt Generator
 *
 * Builds a concise database schema prompt for the text-to-SQL LLM pass.
 * Selects relevant tables based on keyword matching against the user's question,
 * and formats them in compact DDL notation to minimize token usage.
 */

// ==================== TABLE CATALOG ====================

interface TableEntry {
	name: string;
	ddl: string;
	keywords: string[];
	primary: boolean;
}

const TABLE_CATALOG: TableEntry[] = [
	// ── Primary tables (always included) ──

	{
		name: 'dialogues',
		ddl: 'dialogues(dialogue_id PK, goal, status[ACTIVE/COMPLETED/ABANDONED], title, created_at)',
		keywords: [],
		primary: true,
	},
	{
		name: 'dialogue_events',
		ddl: 'dialogue_events(event_id INT PK, dialogue_id, event_type, role, phase, speech_act, summary, content, detail JSON, timestamp)',
		keywords: [],
		primary: true,
	},
	{
		name: 'claims',
		ddl: 'claims(claim_id PK, statement, introduced_by[EXECUTOR/TECHNICAL_EXPERT/VERIFIER/HISTORIAN/HUMAN], criticality[CRITICAL/NON_CRITICAL], status[OPEN/VERIFIED/CONDITIONAL/DISPROVED/UNKNOWN], dialogue_id, turn_id, assumption_type, created_at)',
		keywords: [],
		primary: true,
	},
	{
		name: 'verdicts',
		ddl: 'verdicts(verdict_id PK, claim_id FK→claims, verdict[VERIFIED/CONDITIONAL/DISPROVED/UNKNOWN], constraints_ref, evidence_ref, rationale, novel_dependency INT, timestamp)',
		keywords: [],
		primary: true,
	},
	{
		name: 'gates',
		ddl: 'gates(gate_id PK, dialogue_id, reason, status[OPEN/RESOLVED], blocking_claims JSON, created_at, resolved_at)',
		keywords: [],
		primary: true,
	},
	{
		name: 'human_decisions',
		ddl: 'human_decisions(decision_id PK, gate_id FK→gates, action[APPROVE/REJECT/OVERRIDE/REFRAME], rationale, timestamp)',
		keywords: [],
		primary: true,
	},
	{
		name: 'task_graphs',
		ddl: 'task_graphs(graph_id PK, dialogue_id, intent_id FK→intent_records, root_goal, graph_status[DRAFT/APPROVED/IN_PROGRESS/COMPLETED/FAILED/ABANDONED], created_at)',
		keywords: [],
		primary: true,
	},
	{
		name: 'task_units',
		ddl: 'task_units(unit_id PK, graph_id FK→task_graphs, label, goal, category[SCAFFOLD/IMPLEMENTATION/REFACTOR/TEST/DOCUMENTATION/CONFIGURATION/MIGRATION], status[PENDING/READY/IN_PROGRESS/VALIDATING/REPAIRING/COMPLETED/FAILED/SKIPPED], parent_unit_id FK→task_units, sort_order INT, created_at)',
		keywords: [],
		primary: true,
	},
	{
		name: 'intent_records',
		ddl: 'intent_records(intent_id PK, dialogue_id, human_goal, scope_in JSON, scope_out JSON, risk_posture[CONSERVATIVE/BALANCED/AGGRESSIVE], created_at)',
		keywords: [],
		primary: true,
	},

	// ── Secondary tables (included when keywords match) ──

	{
		name: 'repair_packets',
		ddl: 'repair_packets(repair_id PK, unit_id FK→task_units, suspected_cause, repair_strategy, attempt_count INT, max_attempts INT, result[FIXED/PARTIALLY_FIXED/FAILED/ESCALATED/TIMED_OUT], wall_clock_ms INT, created_at)',
		keywords: ['repair', 'fix', 'fixed', 'broken', 'attempt'],
		primary: false,
	},
	{
		name: 'validation_packets',
		ddl: 'validation_packets(validation_id PK, unit_id FK→task_units, checks JSON, pass_fail[PASS/FAIL], failure_type, created_at)',
		keywords: ['validation', 'validate', 'check', 'pass', 'fail', 'test'],
		primary: false,
	},
	{
		name: 'intake_conversations',
		ddl: 'intake_conversations(id INT PK, dialogue_id, sub_state[DISCUSSING/SYNTHESIZING/AWAITING_APPROVAL], turn_count INT, draft_plan JSON, accumulations JSON, finalized_plan JSON, created_at)',
		keywords: ['intake', 'plan', 'planning', 'discuss', 'conversation'],
		primary: false,
	},
	{
		name: 'cli_activity_events',
		ddl: 'cli_activity_events(event_id INT PK, dialogue_id, timestamp, role, phase, event_type, summary, detail, tool_name, file_path, status[success/error])',
		keywords: ['activity', 'event', 'tool', 'cli', 'log'],
		primary: false,
	},
	{
		name: 'workflow_commands',
		ddl: 'workflow_commands(command_id PK, dialogue_id, command_type[cli_invocation/llm_api_call/role_invocation], label, status[running/success/error], started_at, completed_at)',
		keywords: ['command', 'invocation', 'output', 'run', 'execution'],
		primary: false,
	},
	{
		name: 'workflow_command_outputs',
		ddl: 'workflow_command_outputs(id INT PK, command_id FK→workflow_commands, line_type[summary/detail/error/stdin/tool_input/tool_output], tool_name, content, timestamp)',
		keywords: ['command', 'output', 'stdout', 'stderr', 'execution'],
		primary: false,
	},
	{
		name: 'narrative_memories',
		ddl: 'narrative_memories(memory_id PK, dialogue_id, curation_mode, agent_frame, goal, causal_sequence, conflicts JSON, resolution_status, lessons JSON, created_at)',
		keywords: ['narrative', 'memory', 'lesson', 'story'],
		primary: false,
	},
	{
		name: 'decision_traces',
		ddl: 'decision_traces(trace_id PK, dialogue_id, curation_mode, decision_points JSON, created_at)',
		keywords: ['decision', 'trace', 'decision trace'],
		primary: false,
	},
	{
		name: 'open_loops',
		ddl: 'open_loops(loop_id PK, dialogue_id, category[blocker/deferred_decision/missing_info/risk/follow_up], description, related_claim_ids JSON, priority[high/medium/low], created_at)',
		keywords: ['loop', 'blocker', 'deferred', 'risk', 'open'],
		primary: false,
	},
	{
		name: 'outcome_snapshots',
		ddl: 'outcome_snapshots(snapshot_id PK, dialogue_id, graph_id FK→task_graphs, success INT[0/1], failure_modes JSON, units_completed INT, units_total INT, total_wall_clock_ms INT, created_at)',
		keywords: ['outcome', 'result', 'success', 'failure', 'complete'],
		primary: false,
	},
	{
		name: 'acceptance_contracts',
		ddl: 'acceptance_contracts(contract_id PK, intent_id FK→intent_records, dialogue_id, success_conditions JSON, required_validations JSON, non_goals JSON, created_at)',
		keywords: ['acceptance', 'contract', 'condition', 'criteria'],
		primary: false,
	},
	{
		name: 'task_edges',
		ddl: 'task_edges(edge_id PK, graph_id FK→task_graphs, from_unit_id FK→task_units, to_unit_id FK→task_units, edge_type[DEPENDS_ON/BLOCKS/RELATED])',
		keywords: ['edge', 'dependency', 'depends', 'block', 'order'],
		primary: false,
	},
	{
		name: 'claim_events',
		ddl: 'claim_events(event_id PK, claim_id FK→claims, event_type[CREATED/VERIFIED/DISPROVED/OVERRIDDEN], source, evidence_ref, timestamp)',
		keywords: ['claim event', 'claim history', 'verified', 'disproved', 'overridden'],
		primary: false,
	},
	{
		name: 'evidence_packets',
		ddl: 'evidence_packets(packet_id PK, unit_id FK→task_units, sources JSON, supported_statements JSON, unsupported_statements JSON, confidence REAL, gaps JSON, created_at)',
		keywords: ['evidence', 'proof', 'support', 'confidence'],
		primary: false,
	},
	{
		name: 'clarification_threads',
		ddl: 'clarification_threads(id INT PK, dialogue_id, item_id, item_context, messages JSON, created_at)',
		keywords: ['clarification', 'clarify', 'thread', 'question'],
		primary: false,
	},
];

// ==================== RELATIONSHIPS ====================

const SCHEMA_RELATIONSHIPS = `
-- Key relationships (use for JOINs):
-- verdicts.claim_id → claims.claim_id
-- human_decisions.gate_id → gates.gate_id
-- task_units.graph_id → task_graphs.graph_id
-- task_graphs.dialogue_id → dialogues.dialogue_id (scope to dialogue)
-- task_graphs.intent_id → intent_records.intent_id
-- repair_packets.unit_id → task_units.unit_id
-- validation_packets.unit_id → task_units.unit_id
-- evidence_packets.unit_id → task_units.unit_id
-- outcome_snapshots.graph_id → task_graphs.graph_id
-- workflow_command_outputs.command_id → workflow_commands.command_id
-- acceptance_contracts.intent_id → intent_records.intent_id`;

// ==================== TABLE SELECTION ====================

/**
 * Select relevant tables for the schema prompt based on keywords in the question.
 */
function selectRelevantTables(question: string): TableEntry[] {
	const lower = question.toLowerCase();
	const selected: TableEntry[] = [];

	for (const entry of TABLE_CATALOG) {
		if (entry.primary) {
			selected.push(entry);
			continue;
		}
		for (const kw of entry.keywords) {
			if (lower.includes(kw)) {
				selected.push(entry);
				break;
			}
		}
	}

	return selected;
}

// ==================== PROMPT BUILDER ====================

/**
 * Build a concise schema prompt for the text-to-SQL LLM pass.
 *
 * Selects relevant tables based on keyword matching against the user's question,
 * formats them in compact DDL notation, and appends relationship hints.
 *
 * @param question The user's natural language question
 * @param dialogueId The active dialogue ID (included as a hint)
 * @returns Schema prompt string ready for the LLM
 */
export function buildSchemaPrompt(question: string, dialogueId: string): string {
	const tables = selectRelevantTables(question);

	const lines: string[] = [
		`Database schema (SQLite, current dialogue_id = '${dialogueId}'):`,
		'',
	];

	for (const entry of tables) {
		lines.push(entry.ddl);
	}

	lines.push('');
	lines.push(SCHEMA_RELATIONSHIPS);

	return lines.join('\n');
}
