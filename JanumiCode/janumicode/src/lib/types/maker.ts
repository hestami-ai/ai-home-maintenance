/**
 * MAKER Types — Agent Integration Control Plane
 *
 * Defines all structured internal objects for the MAKER approach:
 * intent capture, task graph decomposition, per-unit execution,
 * bounded repair, multi-provider routing, and active memory injection.
 */

// ==================== INTENT & CONTRACT ====================

export interface IntentRecord {
	intent_id: string;
	dialogue_id: string;
	human_goal: string;
	scope_in: string[];
	scope_out: string[];
	priority_axes: string[];
	risk_posture: RiskPosture;
	clarifications_resolved: ClarificationItem[];
	created_at: string;
	updated_at: string;
}

export enum RiskPosture {
	CONSERVATIVE = 'CONSERVATIVE',
	BALANCED = 'BALANCED',
	AGGRESSIVE = 'AGGRESSIVE',
}

export interface ClarificationItem {
	question: string;
	answer: string;
	resolved_at: string;
}

export interface AcceptanceContract {
	contract_id: string;
	intent_id: string;
	dialogue_id: string;
	success_conditions: string[];
	required_validations: ValidationRequirement[];
	non_goals: string[];
	human_judgment_required: string[];
	created_at: string;
}

export interface ValidationRequirement {
	type: ValidationType;
	command?: string;
	expected_exit_code?: number;
	description: string;
}

export enum ValidationType {
	LINT = 'LINT',
	TYPE_CHECK = 'TYPE_CHECK',
	UNIT_TEST = 'UNIT_TEST',
	INTEGRATION_TEST = 'INTEGRATION_TEST',
	BUILD = 'BUILD',
	CUSTOM = 'CUSTOM',
}

// ==================== TASK GRAPH ====================

export interface TaskGraph {
	graph_id: string;
	dialogue_id: string;
	intent_id: string;
	root_goal: string;
	graph_status: TaskGraphStatus;
	created_at: string;
	updated_at: string;
}

export enum TaskGraphStatus {
	DRAFT = 'DRAFT',
	APPROVED = 'APPROVED',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	FAILED = 'FAILED',
	ABANDONED = 'ABANDONED',
}

export interface TaskUnit {
	unit_id: string;
	graph_id: string;
	label: string;
	goal: string;
	category: TaskCategory;
	inputs: string[];
	outputs: string[];
	preconditions: string[];
	postconditions: string[];
	allowed_tools: string[];
	preferred_provider: string | null;
	max_change_scope: string;
	observables: string[];
	falsifiers: string[];
	verification_method: string;
	status: TaskUnitStatus;
	parent_unit_id: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export enum TaskCategory {
	SCAFFOLD = 'SCAFFOLD',
	IMPLEMENTATION = 'IMPLEMENTATION',
	REFACTOR = 'REFACTOR',
	TEST = 'TEST',
	DOCUMENTATION = 'DOCUMENTATION',
	CONFIGURATION = 'CONFIGURATION',
	MIGRATION = 'MIGRATION',
}

export enum TaskUnitStatus {
	PENDING = 'PENDING',
	READY = 'READY',
	IN_PROGRESS = 'IN_PROGRESS',
	VALIDATING = 'VALIDATING',
	REPAIRING = 'REPAIRING',
	COMPLETED = 'COMPLETED',
	FAILED = 'FAILED',
	SKIPPED = 'SKIPPED',
}

export interface TaskEdge {
	edge_id: string;
	graph_id: string;
	from_unit_id: string;
	to_unit_id: string;
	edge_type: EdgeType;
}

export enum EdgeType {
	DEPENDS_ON = 'DEPENDS_ON',
	BLOCKS = 'BLOCKS',
	RELATED = 'RELATED',
}

// ==================== CLAIMS & EVIDENCE ====================

export interface ClaimUnit {
	claim_id: string;
	unit_id: string;
	statement: string;
	claim_scope: ClaimScope;
	falsifiers: string[];
	required_evidence: string[];
}

export enum ClaimScope {
	ATOMIC = 'ATOMIC',
	COMPOSITE = 'COMPOSITE',
	VAGUE = 'VAGUE',
}

export interface EvidencePacket {
	packet_id: string;
	unit_id: string;
	sources: string[];
	supported_statements: string[];
	unsupported_statements: string[];
	confidence: number;
	gaps: string[];
	created_at: string;
}

export interface ValidationPacket {
	validation_id: string;
	unit_id: string;
	checks: ValidationCheck[];
	expected_observables: string[];
	actual_observables: string[];
	pass_fail: 'PASS' | 'FAIL';
	failure_type: FailureType | null;
	created_at: string;
}

export interface ValidationCheck {
	check_type: ValidationType;
	command: string;
	exit_code: number;
	stdout_excerpt: string;
	passed: boolean;
}

// ==================== REPAIR ====================

export enum FailureType {
	// Auto-repair safe
	LINT_ERROR = 'LINT_ERROR',
	FORMAT_ERROR = 'FORMAT_ERROR',
	IMPORT_RESOLUTION = 'IMPORT_RESOLUTION',
	LOCAL_TYPE_ERROR = 'LOCAL_TYPE_ERROR',
	GENERATED_ARTIFACT_STALE = 'GENERATED_ARTIFACT_STALE',
	DETERMINISTIC_TEST_UPDATE = 'DETERMINISTIC_TEST_UPDATE',
	// Always escalate
	SECURITY_BOUNDARY = 'SECURITY_BOUNDARY',
	PERMISSION_POLICY = 'PERMISSION_POLICY',
	DATA_MIGRATION_RISK = 'DATA_MIGRATION_RISK',
	TENANT_ISOLATION = 'TENANT_ISOLATION',
	DESTRUCTIVE_CHANGE = 'DESTRUCTIVE_CHANGE',
	AMBIGUOUS_BEHAVIOR = 'AMBIGUOUS_BEHAVIOR',
	EXTERNAL_DEPENDENCY_GAP = 'EXTERNAL_DEPENDENCY_GAP',
	ARCHITECTURAL_CONFLICT = 'ARCHITECTURAL_CONFLICT',
	// Conditional
	FLAKY_TEST = 'FLAKY_TEST',
	RUNTIME_ERROR = 'RUNTIME_ERROR',
	UNKNOWN = 'UNKNOWN',
}

export enum RepairClassification {
	AUTO_REPAIR_SAFE = 'AUTO_REPAIR_SAFE',
	CONDITIONAL = 'CONDITIONAL',
	ESCALATE_REQUIRED = 'ESCALATE_REQUIRED',
}

export interface RepairPacket {
	repair_id: string;
	unit_id: string;
	suspected_cause: string;
	repair_strategy: string;
	attempt_count: number;
	max_attempts: number;
	escalation_threshold: RepairClassification;
	diff_before: string;
	diff_after: string;
	result: RepairResult;
	wall_clock_ms: number;
	created_at: string;
}

export enum RepairResult {
	FIXED = 'FIXED',
	PARTIALLY_FIXED = 'PARTIALLY_FIXED',
	FAILED = 'FAILED',
	ESCALATED = 'ESCALATED',
	TIMED_OUT = 'TIMED_OUT',
}

export const REPAIR_POLICY = {
	max_attempts_per_unit: 2,
	max_auto_repairs_per_unit: 1,
	max_minutes_per_unit: 20,
	escalate_on_repeated_failure: true,
	escalate_on_new_failure_class: true,
	escalate_on_scope_expansion: true,
	escalate_on_security_or_data_boundary: true,
	escalate_on_acceptance_contract_change: true,
} as const;

export const SAFE_AUTO_REPAIR_TYPES = new Set<FailureType>([
	FailureType.LINT_ERROR,
	FailureType.FORMAT_ERROR,
	FailureType.IMPORT_RESOLUTION,
	FailureType.LOCAL_TYPE_ERROR,
	FailureType.GENERATED_ARTIFACT_STALE,
	FailureType.DETERMINISTIC_TEST_UPDATE,
]);

export const ALWAYS_ESCALATE_TYPES = new Set<FailureType>([
	FailureType.SECURITY_BOUNDARY,
	FailureType.PERMISSION_POLICY,
	FailureType.DATA_MIGRATION_RISK,
	FailureType.TENANT_ISOLATION,
	FailureType.DESTRUCTIVE_CHANGE,
	FailureType.AMBIGUOUS_BEHAVIOR,
	FailureType.EXTERNAL_DEPENDENCY_GAP,
	FailureType.ARCHITECTURAL_CONFLICT,
]);

// ==================== HISTORICAL INVARIANTS ====================

export interface HistoricalInvariantPacket {
	packet_id: string;
	unit_id: string | null;
	dialogue_id: string;
	relevant_invariants: string[];
	prior_failure_motifs: string[];
	precedent_patterns: string[];
	reusable_subplans: string[];
	created_at: string;
}

// ==================== OUTCOME SNAPSHOT ====================

export interface OutcomeSnapshot {
	snapshot_id: string;
	dialogue_id: string;
	graph_id: string;
	providers_used: ProviderUsageRecord[];
	augmentations_used: string[];
	success: boolean;
	failure_modes: string[];
	useful_invariants: string[];
	units_completed: number;
	units_total: number;
	total_wall_clock_ms: number;
	created_at: string;
}

export interface ProviderUsageRecord {
	provider_id: string;
	role: string;
	units_executed: number;
	success_rate: number;
	avg_duration_ms: number;
}

// ==================== PROVIDER CAPABILITIES ====================

export interface ProviderCapabilityProfile {
	provider_id: string;
	name: string;
	capabilities: ProviderCapability[];
	cost_tier: CostTier;
	max_context_tokens: number;
	supports_streaming: boolean;
	supports_tool_use: boolean;
	strengths: string[];
	weaknesses: string[];
}

export enum ProviderCapability {
	CODE_GENERATION = 'CODE_GENERATION',
	CODE_REVIEW = 'CODE_REVIEW',
	REFACTORING = 'REFACTORING',
	TEST_GENERATION = 'TEST_GENERATION',
	DOCUMENTATION = 'DOCUMENTATION',
	ARCHITECTURE = 'ARCHITECTURE',
	FILE_MANIPULATION = 'FILE_MANIPULATION',
	VERIFICATION = 'VERIFICATION',
	REASONING = 'REASONING',
}

export type CostTier = 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH';

// ==================== HUMAN-FACING STATES ====================

export enum HumanFacingState {
	UNDERSTANDING = 'Understanding',
	FRAMING = 'Framing',
	NEEDS_INPUT = 'Needs Input',
	PLANNING = 'Planning',
	VERIFYING = 'Verifying',
	EXECUTING = 'Executing',
	REPAIRING = 'Repairing',
	BLOCKED = 'Blocked',
	COMPLETE = 'Complete',
}

export interface HumanFacingStatus {
	state: HumanFacingState;
	detail: string;
	progress?: { completed: number; total: number };
	currentUnit?: string;
}

// ==================== TOOLCHAIN DETECTION ====================

export interface ToolchainDetection {
	detection_id: string;
	workspace_root: string;
	project_type: string;
	package_manager: string;
	lint_command: string | null;
	type_check_command: string | null;
	test_command: string | null;
	build_command: string | null;
	detected_at: string;
	confidence: number;
}

// ==================== DECOMPOSITION QUALITY ====================

export enum DecompositionIssue {
	TOO_COARSE = 'TOO_COARSE',
	TOO_FRAGMENTED = 'TOO_FRAGMENTED',
	MISSING_OBSERVABLES = 'MISSING_OBSERVABLES',
	MISSING_FALSIFIERS = 'MISSING_FALSIFIERS',
	MULTI_OBJECTIVE_UNIT = 'MULTI_OBJECTIVE_UNIT',
}

export interface DecompositionQualityReport {
	graph_id: string;
	unit_count: number;
	issues: Array<{
		issue: DecompositionIssue;
		unit_id?: string;
		detail: string;
	}>;
	is_acceptable: boolean;
}

export const TASK_GRAPH_LIMITS = {
	target_min_units: 5,
	target_max_units: 15,
	soft_warning_units: 20,
	require_grouping_units: 25,
	reject_below_for_nontrivial: 3,
	max_claims_per_unit: 3,
	max_validation_methods_per_unit: 2,
	nested_top_level_min: 5,
	nested_top_level_max: 12,
} as const;
