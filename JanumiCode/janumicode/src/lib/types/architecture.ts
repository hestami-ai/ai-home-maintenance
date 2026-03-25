/**
 * Architecture Phase Types
 *
 * Defines the structured output of the Architecture phase sub-workflow,
 * which transforms the INTAKE plan's narrative into capabilities, workflows,
 * components, data models, interfaces, and implementation steps.
 *
 * The Architecture phase sits between INTAKE and PROPOSE in the pipeline:
 *   INTAKE → ARCHITECTURE → PROPOSE → ...
 *
 * Two separate taxonomies:
 *   - Engineering Domains (from INTAKE) = elicitation grammar (what to ask about)
 *   - Capabilities (from Architecture) = decomposition grammar (what to build)
 *   - DomainCapabilityMapping = explicit bridge between them
 */

import type { EngineeringDomain } from './intake';

// ==================== SUB-STATE ====================

export enum ArchitectureSubState {
	/** Codebase investigation: existing code, patterns, tech stack, constraints */
	TECHNICAL_ANALYSIS = 'TECHNICAL_ANALYSIS',
	/** Global decomposition: goal → capabilities → workflows */
	DECOMPOSING = 'DECOMPOSING',
	/** Domain modeling: workflows → entities, fields, relationships, invariants */
	MODELING = 'MODELING',
	/** Component design + interface contracts: domain model → components → interfaces */
	DESIGNING = 'DESIGNING',
	/** Implementation roadmap: components → phased implementation plan */
	SEQUENCING = 'SEQUENCING',
	/** Historian goal-alignment check + structural consistency + traceability */
	VALIDATING = 'VALIDATING',
	/** Present architecture to human for approval/refinement */
	PRESENTING = 'PRESENTING',
}

// ==================== DOCUMENT STATUS ====================

export enum ArchitectureDocumentStatus {
	DRAFT = 'DRAFT',
	VALIDATED = 'VALIDATED',
	APPROVED = 'APPROVED',
	SUPERSEDED = 'SUPERSEDED',
}

// ==================== DOMAIN-CAPABILITY MAPPING ====================

/**
 * Explicit mapping between an INTAKE engineering domain and an
 * Architecture capability. Requirements carry domain tags from INTAKE;
 * capabilities are LLM-generated (not domain-constrained) but linked
 * back to domains via the requirements they implement.
 */
export interface DomainCapabilityMapping {
	mapping_id: string;
	domain: EngineeringDomain;
	capability_id: string;
	requirement_ids: string[];
	coverage_contribution: 'PRIMARY' | 'SECONDARY';
}

// ==================== CAPABILITY COVERAGE ====================

export type CapabilityCoverageLevel = 'NONE' | 'PARTIAL' | 'ADEQUATE';

export interface CapabilityCoverageEntry {
	capability_id: string;
	label: string;
	level: CapabilityCoverageLevel;
	has_workflows: boolean;
	has_components: boolean;
	has_domain_mapping: boolean;
	children_count: number;
}

export type CapabilityCoverageMap = Record<string, CapabilityCoverageEntry>;

export interface RequirementsTraceabilityResult {
	/** Requirements from INTAKE plan not mapped to any capability */
	uncovered_requirements: string[];
	/** Capabilities with no source requirements (potential scope creep) */
	unbacked_capabilities: string[];
	/** INTAKE domains with coverage but no capability mapping */
	unmapped_domains: string[];
	/** Per-capability coverage assessment */
	coverage_map: CapabilityCoverageMap;
}

// ==================== CAPABILITY & WORKFLOW LAYER ====================
//                    (Global Planner / DECOMPOSING output)

export interface CapabilityNode {
	capability_id: string;
	/** null = top-level capability; set to parent's capability_id for sub-capabilities */
	parent_capability_id: string | null;
	label: string;
	description: string;
	source_requirements: string[];
	domain_mappings: DomainCapabilityMapping[];
	workflows: string[];
}

export interface WorkflowNode {
	workflow_id: string;
	capability_id: string;
	label: string;
	description: string;
	steps: WorkflowStep[];
	actors: string[];
	triggers: string[];
	outputs: string[];
}

export interface WorkflowStep {
	step_id: string;
	label: string;
	actor: string;
	action: string;
	inputs: string[];
	outputs: string[];
	next_steps: string[];
}

// ==================== COMPONENT & INTERFACE LAYER ====================
//                    (Local Planner / DESIGNING output)

export interface ComponentSpec {
	component_id: string;
	label: string;
	/** Detailed paragraph explaining what the component does and how it interacts */
	responsibility: string;
	/** Why this component exists as a separate module and which requirements it serves */
	rationale: string;
	workflows_served: string[];
	dependencies: string[];
	/** How this component communicates with each dependency (e.g., "calls REST API", "subscribes to events") */
	interaction_patterns: string[];
	technology_notes: string;
	file_scope: string;
	/** Parent component ID for hierarchical decomposition (null = top-level) */
	parent_component_id: string | null;
}

export interface DataModelSpec {
	model_id: string;
	entity_name: string;
	description: string;
	fields: DataField[];
	relationships: DataRelationship[];
	constraints: string[];
	/** Business rules that must always hold across the data model */
	invariants: string[];
	source_requirements: string[];
}

export interface DataField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

export interface DataRelationship {
	target_model: string;
	type: 'one-to-one' | 'one-to-many' | 'many-to-many';
	description: string;
}

export interface InterfaceSpec {
	interface_id: string;
	type: 'REST' | 'EVENT' | 'RPC' | 'FILE' | 'IPC';
	label: string;
	description: string;
	provider_component: string;
	consumer_components: string[];
	contract: string;
	source_workflows: string[];
}

// ==================== IMPLEMENTATION SEQUENCE ====================
//                    (Bridges to MAKER TaskGraph)

export interface ImplementationStep {
	step_id: string;
	label: string;
	description: string;
	components_involved: string[];
	dependencies: string[];
	estimated_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
	verification_method: string;
	sort_order: number;
}

// ==================== STOPPING CRITERIA ====================

/**
 * Stopping criteria for recursive decomposition.
 * A component is "atomic" (should not be decomposed further) when
 * all criteria are satisfied.
 */
export interface StoppingCriteria {
	/** Estimated context footprint fits within agent budget */
	context_fit: boolean;
	/** Component produces outputs that can be validated automatically */
	verifiable_output: boolean;
	/** All dependencies are explicit artifacts, not implicit assumptions */
	clear_inputs: boolean;
	/** Component serves ≤ threshold workflows (configurable, default 3) */
	single_responsibility: boolean;
}

export interface DecompositionConfig {
	/** Maximum recursion depth for component decomposition (default 3) */
	max_depth: number;
	/** Maximum components per decomposition level (default 25) */
	max_breadth: number;
	/** Workflow count threshold for single-responsibility (default 3) */
	responsibility_threshold: number;
	/** Maximum data models per component before splitting (default 5) */
	data_model_threshold: number;
	/** Token budget for context fit estimation */
	context_token_limit: number;
}

export const DEFAULT_DECOMPOSITION_CONFIG: DecompositionConfig = {
	max_depth: 3,
	max_breadth: 25,
	responsibility_threshold: 3,
	data_model_threshold: 5,
	context_token_limit: 12000,
};

// ==================== ARCHITECTURE DOCUMENT ====================

/**
 * The structured output of the Architecture phase.
 * Replaces the narrative `proposedApproach: string` from IntakePlanDocument.
 */
export interface ArchitectureDocument {
	doc_id: string;
	dialogue_id: string;
	version: number;

	// From Global Planner (DECOMPOSING)
	capabilities: CapabilityNode[];
	workflow_graph: WorkflowNode[];

	// From Local Planner (DESIGNING)
	components: ComponentSpec[];
	data_models: DataModelSpec[];
	interfaces: InterfaceSpec[];
	implementation_sequence: ImplementationStep[];

	// Validation state
	goal_alignment_score: number | null;
	validation_findings: string[];

	status: ArchitectureDocumentStatus;
	created_at: string;
	updated_at: string;
}

// ==================== CAPABILITY GRAMMAR TEMPLATES ====================

/**
 * A reusable decomposition template for common patterns.
 * The LLM can reference templates during DESIGNING to accelerate decomposition
 * instead of reasoning from scratch.
 */
export interface CapabilityTemplate {
	template_id: string;
	label: string;
	description: string;
	/** When to apply this template (keywords, patterns) */
	trigger_patterns: string[];
	/** Template component shapes */
	components: Omit<ComponentSpec, 'component_id' | 'parent_component_id'>[];
	/** Template data model shapes */
	data_models: Omit<DataModelSpec, 'model_id'>[];
	/** Template interface shapes */
	interfaces: Omit<InterfaceSpec, 'interface_id'>[];
	/** Template workflow shapes */
	workflows: Omit<WorkflowNode, 'workflow_id' | 'capability_id'>[];
}
