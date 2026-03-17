/**
 * Architecture Phase Sub-Workflow
 *
 * Implements the ARCHITECTURE phase that sits between INTAKE and PROPOSE.
 * Transforms the approved IntakePlanDocument into a structured ArchitectureDocument
 * through a sub-workflow with six states producing specific engineering documents:
 *
 *   DECOMPOSING  →  Global decomposition: goal → capabilities → workflows (Use Case Model)
 *   MODELING     →  Domain modeling: workflows → entities, fields, relationships (Domain Model)
 *   DESIGNING    →  Component design + interfaces: domain model → components → contracts (System Architecture + ICD)
 *   SEQUENCING   →  Implementation roadmap: components → phased plan (Implementation Plan)
 *   VALIDATING   →  Traceability + structural consistency + goal alignment (Verification)
 *   PRESENTING   →  Present architecture to human for approval/refinement (Human Gate)
 *
 * The sub-workflow loops DESIGNING ← VALIDATING on validation failure (max 2 repair cycles),
 * and PRESENTING → DESIGNING on human revision requests.
 */

import type { Result, Phase } from '../types';
import { Role, SpeechAct } from '../types';
import type { PhaseExecutionResult } from './orchestrator';
import type { MMPPayload, MirrorItem, PreMortemItem } from '../types/mmp';
import { ArchitectureSubState, ArchitectureDocumentStatus } from '../types/architecture';
import type {
	ArchitectureDocument,
	CapabilityNode,
	WorkflowNode,
	ComponentSpec,
	DataModelSpec,
	InterfaceSpec,
	ImplementationStep,
	DomainCapabilityMapping,
	StoppingCriteria,
	DecompositionConfig,
} from '../types/architecture';
import { DEFAULT_DECOMPOSITION_CONFIG } from '../types/architecture';
import {
	createArchitectureDocument,
	getArchitectureDocumentForDialogue,
	updateArchitectureDocument,
	updateArchitectureDocumentStatus,
	createNewVersion,
} from '../database/architectureStore';
import { writeDialogueEvent } from '../events/writer';
import { getWorkflowState, updateWorkflowMetadata } from './stateMachine';
import { createGate, GateTriggerCondition } from './gates';
import { getLogger, isLoggerInitialized } from '../logging';
import { emitWorkflowCommand, emitCLIActivity } from '../integration/eventBus';
import { resolveProviderForRole } from '../cli/providerResolver';
import { randomUUID } from 'node:crypto';

// ==================== SUB-STATE MANAGEMENT ====================

/**
 * Architecture phase metadata stored in workflow_states.metadata.
 */
interface ArchitecturePhaseMetadata {
	architectureSubState: ArchitectureSubState;
	architectureDocId: string | null;
	designIterations: number;
	validationAttempts: number;
	maxValidationAttempts: number;
	decompositionConfig: DecompositionConfig;
	humanFeedback: string | null;
	/** When true, the next DESIGNING pass forces one additional decomposition level */
	decomposeDeeper: boolean;
	/** How many "Decompose Deeper" passes have been applied (0 = initial design) */
	decompositionDepth: number;
}

const DEFAULT_METADATA: ArchitecturePhaseMetadata = {
	architectureSubState: ArchitectureSubState.DECOMPOSING,
	architectureDocId: null,
	designIterations: 0,
	validationAttempts: 0,
	maxValidationAttempts: 2,
	decompositionConfig: DEFAULT_DECOMPOSITION_CONFIG,
	humanFeedback: null,
	decomposeDeeper: false,
	decompositionDepth: 0,
};

function getArchitectureMetadata(dialogueId: string): ArchitecturePhaseMetadata {
	const stateResult = getWorkflowState(dialogueId);
	if (!stateResult.success) return { ...DEFAULT_METADATA };
	const meta = JSON.parse(stateResult.value.metadata);
	return {
		architectureSubState: meta.architectureSubState ?? DEFAULT_METADATA.architectureSubState,
		architectureDocId: meta.architectureDocId ?? DEFAULT_METADATA.architectureDocId,
		designIterations: meta.designIterations ?? DEFAULT_METADATA.designIterations,
		validationAttempts: meta.validationAttempts ?? DEFAULT_METADATA.validationAttempts,
		maxValidationAttempts: meta.maxValidationAttempts ?? DEFAULT_METADATA.maxValidationAttempts,
		decompositionConfig: meta.decompositionConfig ?? DEFAULT_METADATA.decompositionConfig,
		humanFeedback: meta.humanFeedback ?? DEFAULT_METADATA.humanFeedback,
		decomposeDeeper: meta.decomposeDeeper ?? DEFAULT_METADATA.decomposeDeeper,
		decompositionDepth: meta.decompositionDepth ?? DEFAULT_METADATA.decompositionDepth,
	};
}

function updateArchitectureMetadata(
	dialogueId: string,
	updates: Partial<ArchitecturePhaseMetadata>
): void {
	updateWorkflowMetadata(dialogueId, updates);
}

// ==================== CAPABILITY ENGINEERING UTILITIES ====================

/**
 * Domain keyword patterns for fallback matching.
 * Maps keywords found in capability labels/descriptions to engineering domains.
 */
const DOMAIN_KEYWORDS: Record<string, string> = {
	'problem': 'PROBLEM_MISSION', 'mission': 'PROBLEM_MISSION', 'vision': 'PROBLEM_MISSION', 'value': 'PROBLEM_MISSION',
	'stakeholder': 'STAKEHOLDERS', 'persona': 'STAKEHOLDERS', 'user': 'STAKEHOLDERS', 'actor': 'STAKEHOLDERS', 'role': 'STAKEHOLDERS',
	'scope': 'SCOPE', 'boundary': 'SCOPE', 'mvp': 'SCOPE', 'phase': 'SCOPE',
	'capability': 'CAPABILITIES', 'feature': 'CAPABILITIES', 'function': 'CAPABILITIES',
	'workflow': 'WORKFLOWS_USE_CASES', 'use case': 'WORKFLOWS_USE_CASES', 'process': 'WORKFLOWS_USE_CASES', 'journey': 'WORKFLOWS_USE_CASES',
	'data': 'DATA_INFORMATION', 'model': 'DATA_INFORMATION', 'schema': 'DATA_INFORMATION', 'entity': 'DATA_INFORMATION', 'record': 'DATA_INFORMATION', 'database': 'DATA_INFORMATION',
	'deploy': 'ENVIRONMENT_OPERATIONS', 'infra': 'ENVIRONMENT_OPERATIONS', 'ci': 'ENVIRONMENT_OPERATIONS', 'monitor': 'ENVIRONMENT_OPERATIONS', 'environment': 'ENVIRONMENT_OPERATIONS',
	'performance': 'QUALITY_ATTRIBUTES', 'reliability': 'QUALITY_ATTRIBUTES', 'scalab': 'QUALITY_ATTRIBUTES', 'accessib': 'QUALITY_ATTRIBUTES',
	'security': 'SECURITY_COMPLIANCE', 'auth': 'SECURITY_COMPLIANCE', 'compliance': 'SECURITY_COMPLIANCE', 'encrypt': 'SECURITY_COMPLIANCE', 'permission': 'SECURITY_COMPLIANCE',
	'api': 'INTEGRATION_INTERFACES', 'integrat': 'INTEGRATION_INTERFACES', 'interface': 'INTEGRATION_INTERFACES', 'webhook': 'INTEGRATION_INTERFACES',
	'architect': 'ARCHITECTURE', 'component': 'ARCHITECTURE', 'module': 'ARCHITECTURE', 'pattern': 'ARCHITECTURE',
	'test': 'VERIFICATION_DELIVERY', 'verif': 'VERIFICATION_DELIVERY', 'accept': 'VERIFICATION_DELIVERY', 'deliver': 'VERIFICATION_DELIVERY',
};

/**
 * Deterministic domain mapping backfill for capabilities missing domain_mappings.
 *
 * Strategy 1: Match capability's source_requirements to INTAKE domains via
 *             requirement extractedFromTurnId ↔ DomainCoverageEntry.turnNumbers overlap.
 * Strategy 2: Keyword-match capability label/description against domain names.
 *
 * Only modifies capabilities with empty domain_mappings — LLM-provided mappings are preserved.
 */
export function backfillDomainMappings(
	capabilities: CapabilityNode[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	approvedPlan: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	domainCoverage: Record<string, any> | null,
): CapabilityNode[] {
	if (!domainCoverage) return capabilities;

	// Build requirement ID → domain set map from turn number overlap
	const reqToDomains = new Map<string, Set<string>>();
	const requirements = approvedPlan?.requirements ?? [];
	for (const req of requirements) {
		const reqId = req.id as string;
		const turnId = req.extractedFromTurnId as number | undefined;
		if (!reqId) continue;

		const domains = new Set<string>();
		for (const [domain, entry] of Object.entries(domainCoverage)) {
			const dEntry = entry as { level?: string; turnNumbers?: number[] };
			if (dEntry.level === 'NONE') continue;
			if (turnId !== undefined && dEntry.turnNumbers && dEntry.turnNumbers.includes(turnId)) {
				domains.add(domain);
			}
		}
		if (domains.size > 0) {
			reqToDomains.set(reqId, domains);
		}
	}

	return capabilities.map(cap => {
		if (cap.domain_mappings.length > 0) return cap; // LLM provided them

		// Strategy 1: Match via source_requirements → domain
		const inferredDomains = new Set<string>();
		for (const reqId of cap.source_requirements) {
			const domains = reqToDomains.get(reqId);
			if (domains) {
				for (const d of domains) inferredDomains.add(d);
			}
		}

		// Strategy 2: Keyword match against domain names
		if (inferredDomains.size === 0) {
			const text = `${cap.label} ${cap.description}`.toLowerCase();
			for (const [keyword, domain] of Object.entries(DOMAIN_KEYWORDS)) {
				if (text.includes(keyword)) {
					// Only map to domains with non-NONE coverage
					const entry = domainCoverage[domain] as { level?: string } | undefined;
					if (entry && entry.level !== 'NONE') {
						inferredDomains.add(domain);
						break; // Take first match
					}
				}
			}
		}

		// Fallback: map to CAPABILITIES domain
		if (inferredDomains.size === 0) {
			inferredDomains.add('CAPABILITIES');
		}

		const mappings: DomainCapabilityMapping[] = [...inferredDomains].map((domain, i) => ({
			mapping_id: `DM-BF-${cap.capability_id}-${i}`,
			domain: domain as DomainCapabilityMapping['domain'],
			capability_id: cap.capability_id,
			requirement_ids: cap.source_requirements,
			coverage_contribution: (i === 0 ? 'PRIMARY' : 'SECONDARY') as 'PRIMARY' | 'SECONDARY',
		}));

		return { ...cap, domain_mappings: mappings };
	});
}

/**
 * Compute capability coverage from an ArchitectureDocument.
 * Pure function — no DB access, no LLM calls.
 */
export function computeCapabilityCoverage(
	doc: ArchitectureDocument
): Record<string, import('../types/architecture').CapabilityCoverageEntry> {
	const workflowIds = new Set(doc.workflow_graph.map(w => w.workflow_id));
	const componentWorkflows = new Set(
		doc.components.flatMap(c => c.workflows_served)
	);

	const result: Record<string, import('../types/architecture').CapabilityCoverageEntry> = {};

	for (const cap of doc.capabilities) {
		const hasWorkflows = cap.workflows.some(wf => workflowIds.has(wf));
		const hasComponents = cap.workflows.some(wf => componentWorkflows.has(wf));
		const hasDomainMapping = cap.domain_mappings.length > 0;
		const childrenCount = doc.capabilities.filter(
			c => c.parent_capability_id === cap.capability_id
		).length;

		let level: 'NONE' | 'PARTIAL' | 'ADEQUATE';
		if (hasWorkflows && hasComponents && hasDomainMapping) {
			level = 'ADEQUATE';
		} else if (hasWorkflows || hasComponents) {
			level = 'PARTIAL';
		} else {
			level = 'NONE';
		}

		result[cap.capability_id] = {
			capability_id: cap.capability_id,
			label: cap.label,
			level,
			has_workflows: hasWorkflows,
			has_components: hasComponents,
			has_domain_mapping: hasDomainMapping,
			children_count: childrenCount,
		};
	}
	return result;
}

/** Build an onEvent callback for architecture CLI invocations. */
function buildArchitectureOnEvent(dialogueId: string) {
	return (event: import('../cli/types').CLIActivityEvent) => {
		emitCLIActivity(dialogueId, {
			...event,
			role: Role.TECHNICAL_EXPERT,
			phase: 'ARCHITECTURE' as Phase,
		});
	};
}

// ==================== MAIN DISPATCH ====================

/**
 * Execute the ARCHITECTURE phase.
 *
 * Dispatches to the appropriate sub-state handler based on the current
 * architecture sub-state stored in workflow metadata.
 */
export async function executeArchitecturePhase(
	dialogueId: string,
	tokenBudget: number = 10000
): Promise<Result<PhaseExecutionResult>> {
	try {
		const meta = getArchitectureMetadata(dialogueId);

		switch (meta.architectureSubState) {
			case ArchitectureSubState.DECOMPOSING:
				return await executeDecomposing(dialogueId, tokenBudget, meta);

			case ArchitectureSubState.MODELING:
				return await executeModeling(dialogueId, tokenBudget, meta);

			case ArchitectureSubState.DESIGNING:
				return await executeDesigning(dialogueId, tokenBudget, meta);

			case ArchitectureSubState.SEQUENCING:
				return await executeSequencing(dialogueId, tokenBudget, meta);

			case ArchitectureSubState.VALIDATING:
				return await executeValidating(dialogueId, meta);

			case ArchitectureSubState.PRESENTING:
				return await executePresenting(dialogueId, meta);

			default:
				return {
					success: false,
					error: new Error(`Unknown architecture sub-state: ${meta.architectureSubState}`),
				};
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to execute ARCHITECTURE phase'),
		};
	}
}

// ==================== DECOMPOSING (Global Planner) ====================

/**
 * DECOMPOSING sub-state: Transform the approved intake plan into
 * capabilities and workflow graph.
 *
 * Input:  Approved IntakePlanDocument from workflow metadata
 * Output: CapabilityNode[] + WorkflowNode[] → stored in ArchitectureDocument
 */
async function executeDecomposing(
	dialogueId: string,
	tokenBudget: number,
	meta: ArchitecturePhaseMetadata
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architecture', subState: 'DECOMPOSING' })
		: null;

	log?.info('Starting architecture decomposition', { dialogueId });

	// 1. Get the approved intake plan from workflow metadata
	const stateResult = getWorkflowState(dialogueId);
	if (!stateResult.success) {
		return { success: false, error: new Error('Failed to read workflow state') };
	}
	const workflowMeta = JSON.parse(stateResult.value.metadata);
	const approvedPlan = workflowMeta.approvedIntakePlan;

	if (!approvedPlan) {
		return {
			success: false,
			error: new Error('No approved intake plan found in workflow metadata'),
		};
	}

	// 2. Invoke Architecture Expert LLM for capability detection + workflow graph
	const decomposeCmdId = randomUUID();

	// Resolve provider name for command label
	let providerName = 'LLM';
	try {
		const pResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (pResult.success) { providerName = pResult.value.name; }
	} catch { /* use fallback */ }

	emitWorkflowCommand({
		dialogueId,
		commandId: decomposeCmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Architect — Capability Decomposition [${providerName}]`,
		summary: `Analyzing approved plan: "${approvedPlan.title}"`,
		status: 'running',
		timestamp: new Date().toISOString(),
	});

	const { invokeArchitectureDecomposition } = await import('../roles/architectureExpert.js');
	const decompositionResult = await invokeArchitectureDecomposition(
		dialogueId,
		approvedPlan,
		approvedPlan.domainCoverage ?? null,
		tokenBudget,
		{ commandId: decomposeCmdId, dialogueId, onEvent: buildArchitectureOnEvent(dialogueId), humanFeedback: meta.humanFeedback }
	);

	if (!decompositionResult.success) {
		log?.error('Architecture decomposition failed', { error: decompositionResult.error.message });
		emitWorkflowCommand({
			dialogueId,
			commandId: decomposeCmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: `Architect — Capability Decomposition [${providerName}]`,
			summary: `Failed: ${decompositionResult.error.message}`,
			status: 'error',
			timestamp: new Date().toISOString(),
		});
		return decompositionResult as unknown as Result<PhaseExecutionResult>;
	}

	const { capabilities: rawCapabilities, workflows } = decompositionResult.value;

	// Backfill domain mappings for capabilities where LLM omitted them
	const capabilities = backfillDomainMappings(
		rawCapabilities, approvedPlan, approvedPlan.domainCoverage ?? null
	);

	const now = new Date().toISOString();
	emitWorkflowCommand({
		dialogueId,
		commandId: decomposeCmdId,
		action: 'output',
		commandType: 'role_invocation',
		label: 'Architect',
		summary: `── Capabilities (${capabilities.length}) ──`,
		detail: capabilities.map(c => `${c.capability_id}: ${c.label} (${c.source_requirements.length} reqs, ${c.workflows.length} workflows)`).join('\n'),
		timestamp: now,
	});

	emitWorkflowCommand({
		dialogueId,
		commandId: decomposeCmdId,
		action: 'output',
		commandType: 'role_invocation',
		label: 'Architect',
		summary: `── Workflows (${workflows.length}) ──`,
		detail: workflows.map((w: { workflow_id: string; label: string; steps: unknown[]; actors: string[] }) => `${w.workflow_id}: ${w.label} (${w.steps.length} steps, actors: ${w.actors.join(', ')})`).join('\n'),
		timestamp: now,
	});

	emitWorkflowCommand({
		dialogueId,
		commandId: decomposeCmdId,
		action: 'complete',
		commandType: 'role_invocation',
		label: `Architect — Capability Decomposition [${providerName}]`,
		summary: `Identified ${capabilities.length} capabilities, ${workflows.length} workflows`,
		status: 'success',
		timestamp: now,
	});

	// 3. Create the initial ArchitectureDocument
	const docResult = createArchitectureDocument({
		dialogue_id: dialogueId,
		version: 1,
		capabilities,
		workflow_graph: workflows,
		components: [],
		data_models: [],
		interfaces: [],
		implementation_sequence: [],
		goal_alignment_score: null,
		validation_findings: [],
		status: ArchitectureDocumentStatus.DRAFT,
	});

	if (!docResult.success) {
		return { success: false, error: docResult.error };
	}

	// 4. Record event
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_decomposition',
		role: 'SYSTEM',
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.CLAIM,
		summary: `Identified ${capabilities.length} capabilities, ${workflows.length} workflows`,
		content: JSON.stringify({ capabilities, workflows }),
		detail: { subState: 'DECOMPOSING', docId: docResult.value.doc_id },
	});

	// 5. Advance sub-state to MODELING
	updateArchitectureMetadata(dialogueId, {
		architectureSubState: ArchitectureSubState.MODELING,
		architectureDocId: docResult.value.doc_id,
		designIterations: 0,
	});

	log?.info('Decomposition complete, advancing to MODELING', {
		capabilities: capabilities.length,
		workflows: workflows.length,
		docId: docResult.value.doc_id,
	});

	// Self-loop: stay in ARCHITECTURE phase, next advanceWorkflow() call will dispatch to MODELING
	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE' as Phase,
			success: true,
			// No nextPhase — stay in ARCHITECTURE (sub-state loops)
			metadata: {
				subState: 'DECOMPOSING',
				capabilities: capabilities.length,
				workflows: workflows.length,
				docId: docResult.value.doc_id,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

// ==================== MODELING (Domain Model Document) ====================

/**
 * MODELING sub-state: Produce the Domain Model document.
 *
 * Input:  Capabilities + Workflows from DECOMPOSING, approved plan requirements
 * Output: DataModelSpec[] with full field details, relationships, constraints, invariants
 *
 * This is a dedicated agent task invocation — the CLI tool receives the engineering
 * task description and uses its own planning, tool access, and decomposition to
 * produce the domain model. It can examine workspace files for existing patterns.
 */
async function executeModeling(
	dialogueId: string,
	tokenBudget: number,
	meta: ArchitecturePhaseMetadata
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architecture', subState: 'MODELING' })
		: null;

	log?.info('Starting domain modeling', { dialogueId, docId: meta.architectureDocId });

	if (!meta.architectureDocId) {
		return { success: false, error: new Error('No architecture document ID — DECOMPOSING must run first') };
	}

	const docResult = getArchitectureDocumentForDialogue(dialogueId);
	if (!docResult.success || !docResult.value) {
		return { success: false, error: new Error('Architecture document not found') };
	}
	const doc = docResult.value;

	// Invoke Architecture Expert for domain modeling
	const modelCmdId = randomUUID();

	let providerName = 'LLM';
	try {
		const pResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (pResult.success) { providerName = pResult.value.name; }
	} catch { /* use fallback */ }

	emitWorkflowCommand({
		dialogueId,
		commandId: modelCmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Architect — Domain Modeling [${providerName}]`,
		summary: `Modeling domain entities from ${doc.capabilities.length} capabilities, ${doc.workflow_graph.length} workflows`,
		status: 'running',
		timestamp: new Date().toISOString(),
	});

	const { invokeArchitectureModeling } = await import('../roles/architectureExpert.js');
	const modelResult = await invokeArchitectureModeling(
		dialogueId,
		doc,
		tokenBudget,
		{ commandId: modelCmdId, dialogueId, onEvent: buildArchitectureOnEvent(dialogueId) }
	);

	if (!modelResult.success) {
		log?.error('Domain modeling failed', { error: modelResult.error.message });
		emitWorkflowCommand({
			dialogueId,
			commandId: modelCmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: `Architect — Domain Modeling [${providerName}]`,
			summary: `Failed: ${modelResult.error.message}`,
			status: 'error',
			timestamp: new Date().toISOString(),
		});
		return modelResult as unknown as Result<PhaseExecutionResult>;
	}

	const { data_models } = modelResult.value;

	const modelNow = new Date().toISOString();
	emitWorkflowCommand({
		dialogueId,
		commandId: modelCmdId,
		action: 'output',
		commandType: 'role_invocation',
		label: 'Architect',
		summary: '── Domain Model Output ──',
		detail: [
			`Data Models (${data_models.length}): ${data_models.map((m: { entity_name: string }) => m.entity_name).join(', ')}`,
			...data_models.map((m: { model_id: string; entity_name: string; fields: unknown[]; relationships: unknown[] }) =>
				`  ${m.model_id}: ${m.entity_name} — ${m.fields.length} fields, ${m.relationships.length} relationships`
			),
		].join('\n'),
		timestamp: modelNow,
	});

	emitWorkflowCommand({
		dialogueId,
		commandId: modelCmdId,
		action: 'complete',
		commandType: 'role_invocation',
		label: `Architect — Domain Modeling [${providerName}]`,
		summary: `Modeled ${data_models.length} domain entities`,
		status: 'success',
		timestamp: modelNow,
	});

	// Update document with domain model
	updateArchitectureDocument(doc.doc_id, { data_models });

	// Record event
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_modeling',
		role: 'SYSTEM',
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.CLAIM,
		summary: `Domain model: ${data_models.length} entities`,
		content: JSON.stringify({ data_models }),
		detail: { subState: 'MODELING', entities: data_models.length },
	});

	// Advance to DESIGNING
	updateArchitectureMetadata(dialogueId, {
		architectureSubState: ArchitectureSubState.DESIGNING,
	});

	log?.info('Domain modeling complete, advancing to DESIGNING', {
		dataModels: data_models.length,
	});

	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE' as Phase,
			success: true,
			metadata: {
				subState: 'MODELING',
				dataModels: data_models.length,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

// ==================== DESIGNING (Component Architecture + Interfaces) ====================

/**
 * DESIGNING sub-state: Produce the System Architecture + Interface Contract documents.
 *
 * Input:  Capabilities + Workflows + Domain Model (from MODELING)
 * Output: ComponentSpec[] + InterfaceSpec[]
 *
 * The domain model is now available as structured input context, enabling
 * the agent to design components that align with the data model.
 * Recursive decomposition with stopping criteria is applied after the LLM call.
 */
async function executeDesigning(
	dialogueId: string,
	tokenBudget: number,
	meta: ArchitecturePhaseMetadata
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architecture', subState: 'DESIGNING' })
		: null;

	log?.info('Starting architecture design', {
		dialogueId,
		iteration: meta.designIterations,
		docId: meta.architectureDocId,
	});

	if (!meta.architectureDocId) {
		return {
			success: false,
			error: new Error('No architecture document ID in metadata — DECOMPOSING must run first'),
		};
	}

	// 1. Get current document
	const docResult = getArchitectureDocumentForDialogue(dialogueId);
	if (!docResult.success || !docResult.value) {
		return { success: false, error: new Error('Architecture document not found') };
	}
	const doc = docResult.value;

	let components: ComponentSpec[];
	let interfaces: InterfaceSpec[];

	if (meta.decomposeDeeper && doc.components.length > 0) {
		// ── "Decompose Deeper" path: Agent-backed re-design ──
		// Instead of mechanical heuristic splitting, re-invoke the CLI tool with
		// the existing architecture as context. The agent examines the workspace,
		// analyzes workflows, and produces meaningful sub-components using its
		// own planning and decomposition capabilities.
		const deeperCmdId = randomUUID();

		let deeperProviderName = 'LLM';
		try {
			const pResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
			if (pResult.success) { deeperProviderName = pResult.value.name; }
		} catch { /* use fallback */ }

		emitWorkflowCommand({
			dialogueId,
			commandId: deeperCmdId,
			action: 'start',
			commandType: 'role_invocation',
			label: `Architect — Deeper Decomposition [Depth ${meta.decompositionDepth}] [${deeperProviderName}]`,
			summary: `Re-analyzing ${doc.components.length} components for meaningful sub-component boundaries`,
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		// Re-invoke with explicit deeper decomposition feedback
		const deeperFeedback = [
			'The human has requested DEEPER DECOMPOSITION of the current component architecture.',
			'Examine the current components and their workflow assignments. For each component that',
			'serves multiple workflows or has broad responsibility, analyze whether meaningful',
			'sub-component boundaries exist based on:',
			'  1. Workflow analysis — can distinct workflows be served by separate sub-modules?',
			'  2. Data flow patterns — do different data entities flow through separate code paths?',
			'  3. Domain model alignment — does the Domain Model suggest entity-oriented boundaries?',
			'     Review the data_models in the architecture document for entity relationships that',
			'     indicate natural module boundaries.',
			'  4. Workspace codebase — examine existing source files and directory structure for',
			'     natural module boundaries (look at src/, ground-truth-specs/, project configs).',
			'  5. Implementation concerns — would an implementer naturally split this into files?',
			'',
			'Produce sub-components that reflect ACTUAL implementation boundaries, not generic layers.',
			'Do NOT split into Data/Logic/API unless the component genuinely has those separable concerns.',
			'Keep components that are already well-scoped. Only decompose where it adds clarity.',
		].join('\n');

		const { invokeArchitectureDesign } = await import('../roles/architectureExpert.js');
		const deeperResult = await invokeArchitectureDesign(
			dialogueId,
			doc,
			meta.decompositionConfig,
			deeperFeedback,
			tokenBudget,
			{ commandId: deeperCmdId, dialogueId, onEvent: buildArchitectureOnEvent(dialogueId) }
		);

		if (!deeperResult.success) {
			log?.error('Deeper decomposition failed, keeping existing design', {
				error: deeperResult.error.message,
			});
			emitWorkflowCommand({
				dialogueId,
				commandId: deeperCmdId,
				action: 'error',
				commandType: 'role_invocation',
				label: `Architect — Deeper Decomposition [Depth ${meta.decompositionDepth}] [${deeperProviderName}]`,
				summary: `Failed: ${deeperResult.error.message}. Keeping existing design.`,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
			// Fallback: keep existing components
			components = doc.components;
			interfaces = doc.interfaces;
		} else {
			({ components, interfaces } = deeperResult.value);

			const deeperNow = new Date().toISOString();
			emitWorkflowCommand({
				dialogueId,
				commandId: deeperCmdId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Architect',
				summary: `── Deeper Decomposition Output ──`,
				detail: [
					`Components: ${doc.components.length} → ${components.length}`,
					`Interfaces: ${doc.interfaces.length} → ${interfaces.length}`,
				].join('\n'),
				timestamp: deeperNow,
			});
			emitWorkflowCommand({
				dialogueId,
				commandId: deeperCmdId,
				action: 'complete',
				commandType: 'role_invocation',
				label: `Architect — Deeper Decomposition [Depth ${meta.decompositionDepth}] [${deeperProviderName}]`,
				summary: `Decomposed ${doc.components.length} → ${components.length} components`,
				status: 'success',
				timestamp: deeperNow,
			});
		}

		log?.info('Decompose Deeper: agent-backed re-design complete', {
			previousComponents: doc.components.length,
			newComponents: components.length,
			decompositionDepth: meta.decompositionDepth,
		});
	} else {
		// ── Normal design path ──
		// 2. Invoke Architecture Expert for component/interface design
		//    Domain model is already available in doc.data_models (from MODELING sub-state)
		const designCmdId = randomUUID();
		const passLabel = meta.designIterations > 0 ? ` [Revision ${meta.designIterations}]` : '';

		let designProviderName = 'LLM';
		try {
			const pResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
			if (pResult.success) { designProviderName = pResult.value.name; }
		} catch { /* use fallback */ }

		emitWorkflowCommand({
			dialogueId,
			commandId: designCmdId,
			action: 'start',
			commandType: 'role_invocation',
			label: `Architect — Architecture Design${passLabel} [${designProviderName}]`,
			summary: `Designing components from ${doc.capabilities.length} capabilities, ${doc.workflow_graph.length} workflows, ${doc.data_models.length} domain entities`,
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const { invokeArchitectureDesign } = await import('../roles/architectureExpert.js');
		const designResult = await invokeArchitectureDesign(
			dialogueId,
			doc,
			meta.decompositionConfig,
			meta.humanFeedback,
			tokenBudget,
			{ commandId: designCmdId, dialogueId, onEvent: buildArchitectureOnEvent(dialogueId) }
		);

		if (!designResult.success) {
			log?.error('Architecture design failed', { error: designResult.error.message });
			emitWorkflowCommand({
				dialogueId,
				commandId: designCmdId,
				action: 'error',
				commandType: 'role_invocation',
				label: `Architect — Architecture Design${passLabel} [${designProviderName}]`,
				summary: `Failed: ${designResult.error.message}`,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
			return designResult as unknown as Result<PhaseExecutionResult>;
		}

		({ components, interfaces } = designResult.value);

		const designNow = new Date().toISOString();
		emitWorkflowCommand({
			dialogueId,
			commandId: designCmdId,
			action: 'output',
			commandType: 'role_invocation',
			label: 'Architect',
			summary: `── Design Output ──`,
			detail: [
				`Components (${components.length}): ${components.map(c => c.label).join(', ')}`,
				`Interfaces (${interfaces.length}): ${interfaces.map(i => `${i.label} [${i.type}]`).join(', ')}`,
			].join('\n'),
			timestamp: designNow,
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: designCmdId,
			action: 'complete',
			commandType: 'role_invocation',
			label: `Architect — Architecture Design${passLabel} [${designProviderName}]`,
			summary: `Designed ${components.length} components, ${interfaces.length} interfaces`,
			status: 'success',
			timestamp: designNow,
		});
	}

	// 3. Apply recursive decomposition — check stopping criteria on each component
	//    and decompose further if needed
	const forcedMinDepth = meta.decomposeDeeper ? 1 : 0;

	// When doing deeper decomposition, scale up max_breadth to accommodate
	// the additional components produced by the agent-backed deeper analysis
	const decompositionConfig = meta.decomposeDeeper
		? { ...meta.decompositionConfig, max_breadth: meta.decompositionConfig.max_breadth * 3 }
		: meta.decompositionConfig;

	const recursionCmdId = randomUUID();
	const recursionLabel = meta.decomposeDeeper
		? `Architect — Deeper Decomposition [Depth ${meta.decompositionDepth}]`
		: `Architect — Recursive Decomposition [Pass ${meta.designIterations + 1}]`;
	emitWorkflowCommand({
		dialogueId,
		commandId: recursionCmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: recursionLabel,
		summary: meta.decomposeDeeper
			? `Forcing deeper decomposition on ${components.length} components (forcedMinDepth: ${forcedMinDepth}, max_breadth: ${decompositionConfig.max_breadth})`
			: `Evaluating ${components.length} components against stopping criteria`,
		status: 'running',
		timestamp: new Date().toISOString(),
	});

	const { applyRecursiveDecomposition } = await import('./architectureRecursion.js');
	const { invokeBatchDecomposition } = await import('../roles/architectureExpert.js');
	type DecomposeFnType = import('./architectureRecursion').DecomposeFn;

	const decomposeFn: DecomposeFnType = async (violating) => {
		const result = await invokeBatchDecomposition(
			dialogueId, violating, doc,
			{ commandId: recursionCmdId, dialogueId, onEvent: buildArchitectureOnEvent(dialogueId) }
		);
		return result.success ? result.value : [];
	};

	const recursionResult = await applyRecursiveDecomposition(
		dialogueId,
		components,
		doc.workflow_graph,
		decompositionConfig,
		tokenBudget,
		{ commandId: recursionCmdId, dialogueId, forcedMinDepth, decomposeFn }
	);

	const finalComponents = recursionResult.success
		? recursionResult.value
		: components; // Fallback to flat components if recursion fails

	const decomposed = finalComponents.length - components.length;
	const recursionNow = new Date().toISOString();
	emitWorkflowCommand({
		dialogueId,
		commandId: recursionCmdId,
		action: 'complete',
		commandType: 'role_invocation',
		label: recursionLabel,
		summary: decomposed > 0
			? `${components.length} → ${finalComponents.length} components (${decomposed} added by decomposition)`
			: `${components.length} components — all met stopping criteria`,
		status: 'success',
		timestamp: recursionNow,
	});

	// 4. Update the document with design output (components + interfaces only;
	//    data_models from MODELING, implementation_sequence from SEQUENCING)
	const updateResult = updateArchitectureDocument(doc.doc_id, {
		components: finalComponents,
		interfaces,
	});

	if (!updateResult.success) {
		return { success: false, error: updateResult.error };
	}

	// 5. Record event
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_design',
		role: 'SYSTEM',
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.CLAIM,
		summary: `Designed ${finalComponents.length} components, ${interfaces.length} interfaces`,
		content: JSON.stringify({ components: finalComponents, interfaces, data_models: doc.data_models }),
		detail: {
			subState: 'DESIGNING',
			iteration: meta.designIterations + 1,
			recursionApplied: recursionResult.success,
			decomposeDeeper: meta.decomposeDeeper,
			decompositionDepth: meta.decompositionDepth,
		},
	});

	// 6. Advance sub-state to SEQUENCING, clear the decomposeDeeper flag
	updateArchitectureMetadata(dialogueId, {
		architectureSubState: ArchitectureSubState.SEQUENCING,
		designIterations: meta.designIterations + 1,
		humanFeedback: null, // Clear feedback after consumption
		decomposeDeeper: false, // Clear the flag — deeper pass is done
	});

	log?.info('Design complete, advancing to SEQUENCING', {
		components: finalComponents.length,
		interfaces: interfaces.length,
	});

	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE' as Phase,
			success: true,
			metadata: {
				subState: 'DESIGNING',
				components: finalComponents.length,
				interfaces: interfaces.length,
				iteration: meta.designIterations + 1,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

// ==================== SEQUENCING (Implementation Roadmap) ====================

/**
 * SEQUENCING sub-state: Produce the Implementation Roadmap document.
 *
 * Input:  Components + Interfaces + Domain Model + Capabilities
 * Output: ImplementationStep[] organized into phased plan
 *
 * This produces the Implementation Plan document which is currently computed
 * by DESIGNING but not given dedicated attention. A separate agent invocation
 * with the full architecture context produces a higher-quality phased roadmap.
 */
async function executeSequencing(
	dialogueId: string,
	tokenBudget: number,
	meta: ArchitecturePhaseMetadata
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architecture', subState: 'SEQUENCING' })
		: null;

	log?.info('Starting implementation sequencing', { dialogueId, docId: meta.architectureDocId });

	if (!meta.architectureDocId) {
		return { success: false, error: new Error('No architecture document ID — DESIGNING must run first') };
	}

	const docResult = getArchitectureDocumentForDialogue(dialogueId);
	if (!docResult.success || !docResult.value) {
		return { success: false, error: new Error('Architecture document not found') };
	}
	const doc = docResult.value;

	// Invoke Architecture Expert for implementation sequencing
	const seqCmdId = randomUUID();

	let providerName = 'LLM';
	try {
		const pResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (pResult.success) { providerName = pResult.value.name; }
	} catch { /* use fallback */ }

	emitWorkflowCommand({
		dialogueId,
		commandId: seqCmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Architect — Implementation Sequencing [${providerName}]`,
		summary: `Planning implementation roadmap for ${doc.components.length} components`,
		status: 'running',
		timestamp: new Date().toISOString(),
	});

	const { invokeArchitectureSequencing } = await import('../roles/architectureExpert.js');
	const seqResult = await invokeArchitectureSequencing(
		dialogueId,
		doc,
		tokenBudget,
		{ commandId: seqCmdId, dialogueId, onEvent: buildArchitectureOnEvent(dialogueId) }
	);

	if (!seqResult.success) {
		log?.error('Implementation sequencing failed', { error: seqResult.error.message });
		emitWorkflowCommand({
			dialogueId,
			commandId: seqCmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: `Architect — Implementation Sequencing [${providerName}]`,
			summary: `Failed: ${seqResult.error.message}`,
			status: 'error',
			timestamp: new Date().toISOString(),
		});
		return seqResult as unknown as Result<PhaseExecutionResult>;
	}

	const { implementation_sequence } = seqResult.value;

	const seqNow = new Date().toISOString();
	emitWorkflowCommand({
		dialogueId,
		commandId: seqCmdId,
		action: 'output',
		commandType: 'role_invocation',
		label: 'Architect',
		summary: '── Implementation Roadmap ──',
		detail: implementation_sequence
			.map((s: { step_id: string; label: string; estimated_complexity: string; components_involved: string[] }) => `${s.step_id}. ${s.label} [${s.estimated_complexity}] — ${s.components_involved.join(', ')}`)
			.join('\n'),
		timestamp: seqNow,
	});

	emitWorkflowCommand({
		dialogueId,
		commandId: seqCmdId,
		action: 'complete',
		commandType: 'role_invocation',
		label: `Architect — Implementation Sequencing [${providerName}]`,
		summary: `Planned ${implementation_sequence.length} implementation steps`,
		status: 'success',
		timestamp: seqNow,
	});

	// Update document with implementation sequence
	updateArchitectureDocument(doc.doc_id, { implementation_sequence });

	// Record event
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_sequencing',
		role: 'SYSTEM',
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.CLAIM,
		summary: `Implementation roadmap: ${implementation_sequence.length} steps`,
		content: JSON.stringify({ implementation_sequence }),
		detail: { subState: 'SEQUENCING', steps: implementation_sequence.length },
	});

	// Advance to VALIDATING
	updateArchitectureMetadata(dialogueId, {
		architectureSubState: ArchitectureSubState.VALIDATING,
	});

	log?.info('Sequencing complete, advancing to VALIDATING', {
		steps: implementation_sequence.length,
	});

	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE' as Phase,
			success: true,
			metadata: {
				subState: 'SEQUENCING',
				implementationSteps: implementation_sequence.length,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

// ==================== VALIDATING ====================

/**
 * VALIDATING sub-state: Run goal-alignment check via Historian and
 * structural consistency validation.
 *
 * On failure: loop back to DESIGNING (max 2 repair cycles before presenting with caveats).
 * On success: advance to PRESENTING.
 */
async function executeValidating(
	dialogueId: string,
	meta: ArchitecturePhaseMetadata
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architecture', subState: 'VALIDATING' })
		: null;

	log?.info('Starting architecture validation', {
		dialogueId,
		attempt: meta.validationAttempts,
		docId: meta.architectureDocId,
	});

	if (!meta.architectureDocId) {
		return { success: false, error: new Error('No architecture document ID in metadata') };
	}

	const validateCmdId = randomUUID();
	emitWorkflowCommand({
		dialogueId,
		commandId: validateCmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Architect — Architecture Validation [Attempt ${meta.validationAttempts + 1}]`,
		summary: 'Running structural consistency checks and goal-alignment validation',
		status: 'running',
		timestamp: new Date().toISOString(),
	});

	// 1. Get current document
	const docResult = getArchitectureDocumentForDialogue(dialogueId);
	if (!docResult.success || !docResult.value) {
		emitWorkflowCommand({
			dialogueId,
			commandId: validateCmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: `Architect — Architecture Validation [Attempt ${meta.validationAttempts + 1}]`,
			summary: 'Architecture document not found',
			status: 'error',
			timestamp: new Date().toISOString(),
		});
		return { success: false, error: new Error('Architecture document not found') };
	}
	const doc = docResult.value;

	// 2. Run structural consistency checks (deterministic, no LLM)
	const structuralFindings = runStructuralValidation(doc);

	emitWorkflowCommand({
		dialogueId,
		commandId: validateCmdId,
		action: 'output',
		commandType: 'role_invocation',
		label: 'Architect',
		summary: structuralFindings.length > 0
			? `── Structural Checks: ${structuralFindings.length} finding(s) ──`
			: '── Structural Checks: Passed ──',
		detail: structuralFindings.length > 0
			? structuralFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')
			: 'No orphan components, no circular dependencies, all references valid.',
		timestamp: new Date().toISOString(),
	});

	// 2b. Requirements traceability check + deterministic repair
	try {
		const { runRequirementsTraceabilityCheck } = await import('../roles/architectureValidator.js');
		const stateForTrace = getWorkflowState(dialogueId);
		if (stateForTrace.success) {
			const traceMeta = JSON.parse(stateForTrace.value.metadata);
			const approvedPlan = traceMeta.approvedIntakePlan;
			const domainCoverage = approvedPlan?.domainCoverage ?? null;

			const traceResult = runRequirementsTraceabilityCheck(doc, approvedPlan, domainCoverage);

			// Attempt deterministic repair for unmapped domains
			if (traceResult.unmapped_domains.length > 0 && domainCoverage) {
				const repairedCapabilities = backfillDomainMappings(
					doc.capabilities, approvedPlan, domainCoverage
				);
				// Check how many domains are still unmapped after backfill
				const repairedMappedDomains = new Set<string>(
					repairedCapabilities.flatMap(c => c.domain_mappings.map(m => m.domain))
				);
				const stillUnmapped = traceResult.unmapped_domains.filter(d => !repairedMappedDomains.has(d));

				if (stillUnmapped.length < traceResult.unmapped_domains.length) {
					// Backfill resolved some gaps — persist repaired capabilities
					updateArchitectureDocument(doc.doc_id, {
						capabilities: repairedCapabilities,
					});
					doc.capabilities = repairedCapabilities;
					structuralFindings.push(
						`[REPAIRED] Domain mapping backfill resolved ${traceResult.unmapped_domains.length - stillUnmapped.length} unmapped domain(s)`
					);
				}

				for (const domain of stillUnmapped) {
					structuralFindings.push(`Domain "${domain}" has INTAKE coverage but no capability mapping after backfill`);
				}
			}

			// Report uncovered requirements
			for (const reqId of traceResult.uncovered_requirements) {
				structuralFindings.push(`Requirement ${reqId} is not covered by any capability`);
			}

			// Report NONE-coverage capabilities
			for (const [, entry] of Object.entries(traceResult.coverage_map) as [string, { level: string; label: string }][]) {
				if (entry.level === 'NONE') {
					structuralFindings.push(`Capability "${entry.label}" has NONE coverage — no workflows or components mapped`);
				}
			}
		}
	} catch {
		log?.warn('Requirements traceability check unavailable');
	}

	// 3. Run goal-alignment check via Historian (LLM-backed — Step 5)
	let goalAlignmentScore: number | null = null;
	let goalFindings: string[] = [];

	try {
		const { runGoalAlignmentCheck } = await import('../roles/architectureValidator.js');
		const alignmentResult = await runGoalAlignmentCheck(dialogueId, doc);
		if (alignmentResult.success) {
			goalAlignmentScore = alignmentResult.value.score;
			goalFindings = alignmentResult.value.findings;
		}
	} catch {
		// Goal alignment module not yet available — proceed with structural only
		log?.warn('Goal alignment check unavailable, using structural validation only');
	}

	// Emit goal-alignment output
	const scoreDisplay = goalAlignmentScore !== null
		? Math.round(goalAlignmentScore * 100) + '%'
		: 'N/A (module unavailable)';
	emitWorkflowCommand({
		dialogueId,
		commandId: validateCmdId,
		action: 'output',
		commandType: 'role_invocation',
		label: 'Architect',
		summary: `── Goal Alignment: ${scoreDisplay} ──`,
		detail: goalFindings.length > 0
			? goalFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')
			: 'No goal-alignment issues detected.',
		timestamp: new Date().toISOString(),
	});

	// 4. Combine findings and classify severity
	const allFindings = [...structuralFindings, ...goalFindings];
	const blockingStructural = structuralFindings.filter(f => !f.startsWith('[WARN]') && !f.startsWith('[REPAIRED]'));
	const hasBlockingFindings = blockingStructural.length > 0 || (goalAlignmentScore !== null && goalAlignmentScore < 0.6);

	// Classify blocking findings by owning phase:
	// - Capability/workflow issues → DECOMPOSING
	// - Component/interface/model issues → DESIGNING
	const decomposingKeywords = /\bCapability\b.*\bno workflows\b|\bno capability mapping\b|\bno backing requirements\b|\bDomain\b.*\bno capability\b/;
	const hasDecomposingFindings = blockingStructural.some(f => decomposingKeywords.test(f));

	// Determine re-iteration target: route to the earliest phase that can fix the findings
	const reiterationTarget = hasDecomposingFindings
		? ArchitectureSubState.DECOMPOSING
		: ArchitectureSubState.DESIGNING;

	const validated = !hasBlockingFindings;
	const warningCount = structuralFindings.filter(f => f.startsWith('[WARN]')).length;
	emitWorkflowCommand({
		dialogueId,
		commandId: validateCmdId,
		action: validated ? 'complete' : 'error',
		commandType: 'role_invocation',
		label: `Architect — Architecture Validation [Attempt ${meta.validationAttempts + 1}]`,
		summary: validated
			? `Validation passed (${scoreDisplay} goal alignment, ${allFindings.length} findings${warningCount > 0 ? `, ${warningCount} warnings` : ''})`
			: `Validation failed — ${blockingStructural.length} blocking finding(s), looping to ${reiterationTarget}`,
		status: validated ? 'success' : 'error',
		timestamp: new Date().toISOString(),
	});

	// 5. Update document with validation results
	updateArchitectureDocument(doc.doc_id, {
		goal_alignment_score: goalAlignmentScore,
		validation_findings: allFindings,
		status: hasBlockingFindings
			? ArchitectureDocumentStatus.DRAFT
			: ArchitectureDocumentStatus.VALIDATED,
	});

	// 6. Record event
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_validation',
		role: Role.HISTORIAN,
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.VERDICT,
		summary: `Goal alignment: ${goalAlignmentScore !== null ? `${Math.round(goalAlignmentScore * 100)}%` : 'N/A'}, ${allFindings.length} findings`,
		content: JSON.stringify({ goalAlignmentScore, findings: allFindings }),
		detail: {
			goalAlignmentScore,
			findings: allFindings,
			structuralFindings: structuralFindings.length,
			goalFindings: goalFindings.length,
		},
	});

	// 7. Decision: loop back to the appropriate phase or advance to PRESENTING
	if (hasBlockingFindings && meta.validationAttempts < meta.maxValidationAttempts) {
		// Route to the phase that owns the blocking findings
		const blockingOnly = allFindings.filter(f => !f.startsWith('[WARN]') && !f.startsWith('[REPAIRED]'));
		updateArchitectureMetadata(dialogueId, {
			architectureSubState: reiterationTarget,
			validationAttempts: meta.validationAttempts + 1,
			humanFeedback: `Validation failed (attempt ${meta.validationAttempts + 1}). Findings:\n${blockingOnly.map((f, i) => `${i + 1}. ${f}`).join('\n')}`,
		});

		log?.info(`Validation failed, looping back to ${reiterationTarget}`, {
			findings: blockingOnly.length,
			attempt: meta.validationAttempts + 1,
			target: reiterationTarget,
			hasDecomposingFindings,
		});
	} else {
		// Advance to PRESENTING (either validated or max repair cycles reached)
		updateArchitectureMetadata(dialogueId, {
			architectureSubState: ArchitectureSubState.PRESENTING,
			validationAttempts: meta.validationAttempts + 1,
		});

		if (hasBlockingFindings) {
			log?.warn('Max validation attempts reached, presenting with caveats', {
				findings: allFindings.length,
			});
		} else {
			log?.info('Validation passed, advancing to PRESENTING');
		}
	}

	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE' as Phase,
			success: true,
			metadata: {
				subState: 'VALIDATING',
				goalAlignmentScore,
				findings: allFindings.length,
				validated: !hasBlockingFindings,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

// ==================== PRESENTING (Human Gate) ====================

/**
 * PRESENTING sub-state: Present the architecture to the human for approval.
 * Creates a gate that blocks until the human:
 *   - Approves → transition to PROPOSE
 *   - Requests Changes → loop back to DESIGNING with feedback
 *   - Skips → transition to PROPOSE (graceful degradation)
 */
async function executePresenting(
	dialogueId: string,
	meta: ArchitecturePhaseMetadata
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architecture', subState: 'PRESENTING' })
		: null;

	if (!meta.architectureDocId) {
		return { success: false, error: new Error('No architecture document ID in metadata') };
	}

	// 1. Get the document
	const docResult = getArchitectureDocumentForDialogue(dialogueId);
	if (!docResult.success || !docResult.value) {
		return { success: false, error: new Error('Architecture document not found') };
	}
	const doc = docResult.value;

	// 2. Record presentation event
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_presentation',
		role: 'SYSTEM',
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.CLAIM,
		summary: `Architecture v${doc.version} ready for review (${doc.capabilities.length} capabilities, ${doc.components.length} components)`,
		content: JSON.stringify(buildArchitectureSummary(doc)),
		detail: {
			docId: doc.doc_id,
			version: doc.version,
			capabilities: doc.capabilities.length,
			components: doc.components.length,
			goalAlignmentScore: doc.goal_alignment_score,
		},
	});

	// 3. Extract MMP for human review
	const mmpPayload = extractArchitectureMMP(doc);

	// 4. Create an approval gate
	const gateResult = createGate({
		dialogueId,
		reason: `Architecture v${doc.version} requires human review`,
		blockingClaims: [],
		metadata: {
			triggerCondition: GateTriggerCondition.ARCHITECTURE_REVIEW,
			architectureDocId: doc.doc_id,
			architectureVersion: doc.version,
			capabilities: doc.capabilities.length,
			components: doc.components.length,
			goalAlignmentScore: doc.goal_alignment_score,
			validationFindings: doc.validation_findings.length,
			decompositionDepth: meta.decompositionDepth,
			mmp: mmpPayload ? JSON.stringify(mmpPayload) : undefined,
		},
	});

	if (!gateResult.success) {
		return { success: false, error: gateResult.error };
	}

	log?.info('Architecture gate created, awaiting human decision', {
		gateId: gateResult.value.gate_id,
		docId: doc.doc_id,
	});

	// Return with gateTriggered + awaitingInput to pause the workflow
	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE' as Phase,
			success: true,
			gateTriggered: true,
			awaitingInput: true,
			metadata: {
				subState: 'PRESENTING',
				gateId: gateResult.value.gate_id,
				docId: doc.doc_id,
				version: doc.version,
				capabilities: doc.capabilities.length,
				components: doc.components.length,
				goalAlignmentScore: doc.goal_alignment_score,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

// ==================== GATE RESOLUTION HANDLERS ====================

/**
 * Handle architecture gate resolution.
 * Called when the human makes a decision on the architecture gate.
 */
export function handleArchitectureGateResolution(
	dialogueId: string,
	action: 'APPROVE' | 'REVISE' | 'SKIP',
	feedback?: string
): Result<{ nextSubState: ArchitectureSubState | null; nextPhase: Phase | null }> {
	try {
		const meta = getArchitectureMetadata(dialogueId);

		switch (action) {
			case 'APPROVE': {
				// Mark document as approved
				if (meta.architectureDocId) {
					updateArchitectureDocumentStatus(
						meta.architectureDocId,
						ArchitectureDocumentStatus.APPROVED
					);
				}

				writeDialogueEvent({
					dialogue_id: dialogueId,
					event_type: 'architecture_approval',
					role: Role.HUMAN,
					phase: 'ARCHITECTURE',
					speech_act: SpeechAct.DECISION,
					summary: 'Architecture approved',
				});

				// Clear architecture metadata and set nextPhase to PROPOSE
				updateArchitectureMetadata(dialogueId, {
					architectureSubState: ArchitectureSubState.PRESENTING, // Will be ignored, moving to PROPOSE
					humanFeedback: null,
				});

				return {
					success: true,
					value: { nextSubState: null, nextPhase: 'PROPOSE' as Phase },
				};
			}

			case 'REVISE': {
				writeDialogueEvent({
					dialogue_id: dialogueId,
					event_type: 'architecture_revision',
					role: Role.HUMAN,
					phase: 'ARCHITECTURE',
					speech_act: SpeechAct.DECISION,
					summary: `Requested changes: ${feedback?.substring(0, 100) ?? '(no details)'}`,
					content: feedback ?? null,
				});

				// Determine re-entry point: DECOMPOSING if feedback mentions capabilities/decompose,
				// otherwise DESIGNING (the default revision target).
				const reDecomposeKeywords = /\b(decompos|capabilit|re.?decompos|restructur|from scratch)\b/i;
				const reviseTarget = feedback && reDecomposeKeywords.test(feedback)
					? ArchitectureSubState.DECOMPOSING
					: ArchitectureSubState.DESIGNING;

				updateArchitectureMetadata(dialogueId, {
					architectureSubState: reviseTarget,
					humanFeedback: feedback ?? 'Human requested changes (no specific feedback)',
					validationAttempts: 0, // Reset validation attempts for new cycle
				});

				return {
					success: true,
					value: { nextSubState: reviseTarget, nextPhase: null },
				};
			}

			case 'SKIP': {
				writeDialogueEvent({
					dialogue_id: dialogueId,
					event_type: 'architecture_skipped',
					role: Role.HUMAN,
					phase: 'ARCHITECTURE',
					speech_act: SpeechAct.DECISION,
					summary: 'Architecture phase skipped — proceeding with current depth',
				});

				// Proceed to PROPOSE without full architecture
				return {
					success: true,
					value: { nextSubState: null, nextPhase: 'PROPOSE' as Phase },
				};
			}

			default:
				return { success: false, error: new Error(`Unknown architecture gate action: ${action}`) };
		}
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Handle a "Decompose Deeper" request from the human.
 * Sets the decomposeDeeper flag and transitions back to DESIGNING
 * so the next workflow cycle applies forced deeper decomposition.
 */
export function handleArchitectureDecomposeDeeper(
	dialogueId: string,
): Result<void> {
	try {
		const meta = getArchitectureMetadata(dialogueId);

		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'architecture_deepen',
			role: Role.HUMAN,
			phase: 'ARCHITECTURE',
			speech_act: SpeechAct.DECISION,
			summary: `Requested deeper decomposition (depth ${meta.decompositionDepth} → ${meta.decompositionDepth + 1})`,
		});

		updateArchitectureMetadata(dialogueId, {
			architectureSubState: ArchitectureSubState.DESIGNING,
			decomposeDeeper: true,
			decompositionDepth: meta.decompositionDepth + 1,
			designIterations: meta.designIterations + 1,
			validationAttempts: 0,
			humanFeedback: null,
		});

		return { success: true, value: undefined };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== STRUCTURAL VALIDATION ====================

/**
 * Run deterministic structural consistency checks on the architecture document.
 * No LLM required — pure graph/data validation.
 */
function runStructuralValidation(doc: ArchitectureDocument): string[] {
	const findings: string[] = [];

	// 1. Orphan components: components that serve no workflow
	for (const comp of doc.components) {
		if (comp.workflows_served.length === 0) {
			findings.push(`Orphan component "${comp.label}" (${comp.component_id}) serves no workflow`);
		}
	}

	// 2. Circular dependencies in implementation sequence
	const stepIds = new Set(doc.implementation_sequence.map(s => s.step_id));
	for (const step of doc.implementation_sequence) {
		for (const dep of step.dependencies) {
			if (!stepIds.has(dep)) {
				findings.push(`Implementation step "${step.label}" depends on unknown step: ${dep}`);
			}
		}
	}
	// Simple cycle detection via topological sort
	const cycleFinding = detectCycleInSteps(doc.implementation_sequence);
	if (cycleFinding) {
		findings.push(cycleFinding);
	}

	// 3. Interface provider/consumer reference existing components
	const componentIds = new Set(doc.components.map(c => c.component_id));
	for (const iface of doc.interfaces) {
		if (!componentIds.has(iface.provider_component)) {
			findings.push(`Interface "${iface.label}" references unknown provider: ${iface.provider_component}`);
		}
		for (const consumer of iface.consumer_components) {
			if (!componentIds.has(consumer)) {
				findings.push(`Interface "${iface.label}" references unknown consumer: ${consumer}`);
			}
		}
	}

	// 4. Data model relationships reference existing models
	const modelIds = new Set(doc.data_models.map(m => m.model_id));
	for (const model of doc.data_models) {
		for (const rel of model.relationships) {
			if (!modelIds.has(rel.target_model)) {
				findings.push(`Data model "${model.entity_name}" references unknown target: ${rel.target_model}`);
			}
		}
	}

	// 5. Workflow references in capabilities
	const workflowIds = new Set(doc.workflow_graph.map(w => w.workflow_id));
	for (const cap of doc.capabilities) {
		for (const wfId of cap.workflows) {
			if (!workflowIds.has(wfId)) {
				findings.push(`Capability "${cap.label}" references unknown workflow: ${wfId}`);
			}
		}
	}

	// 6. Capability with no backing requirements (scope creep)
	for (const cap of doc.capabilities) {
		if (cap.source_requirements.length === 0) {
			findings.push(`Capability "${cap.label}" has no backing requirements (potential scope creep)`);
		}
	}

	// 7. Workflow completeness: every capability should have at least one workflow
	//    Infrastructure / cross-cutting capabilities (e.g., "Shared Platform Foundation",
	//    "Future Pillar Enablement") legitimately may have no user-facing workflows.
	//    Heuristic: capabilities whose label contains infrastructure keywords are
	//    downgraded to warnings; others remain blocking.
	const infraKeywords = /\b(shared|platform|foundation|infrastructure|cross.cutting|future|pillar|enablement|common|core.services)\b/i;
	for (const cap of doc.capabilities) {
		if (cap.workflows.length === 0) {
			if (infraKeywords.test(cap.label)) {
				findings.push(`[WARN] Capability "${cap.label}" has no workflows (infrastructure — non-blocking)`);
			} else {
				findings.push(`Capability "${cap.label}" has no workflows`);
			}
		}
	}

	// 8. Requirement traceability: every capability's source_requirements should trace
	//    through at least one workflow to at least one component
	for (const cap of doc.capabilities) {
		const capWorkflows = new Set(cap.workflows);
		const componentsServingCap = doc.components.filter(c =>
			c.workflows_served.some(wf => capWorkflows.has(wf))
		);
		if (componentsServingCap.length === 0 && cap.workflows.length > 0) {
			findings.push(`Traceability gap: capability "${cap.label}" has workflows but no components implement them`);
		}
	}

	// 9. Domain model coverage: every data entity referenced by a component's
	//    technology_notes or interaction_patterns should exist in the domain model
	//    (lightweight heuristic check — match model_id references)
	for (const comp of doc.components) {
		for (const dep of comp.dependencies) {
			// Check if any dependency references a model-like ID pattern
			if (dep.startsWith('DM-') && !modelIds.has(dep)) {
				findings.push(`Component "${comp.label}" references data model "${dep}" not found in domain model`);
			}
		}
	}

	// 10. Interface completeness: every component dependency should have a corresponding
	//     interface (at least one interface where the dependency is the provider and the
	//     component is the consumer, or vice versa)
	const interfaceEdges = new Set<string>();
	for (const iface of doc.interfaces) {
		for (const consumer of iface.consumer_components) {
			interfaceEdges.add(`${iface.provider_component}->${consumer}`);
		}
	}
	for (const comp of doc.components) {
		for (const dep of comp.dependencies) {
			// Skip parent-child relationships and non-component references
			if (!componentIds.has(dep)) continue;
			const edge = `${dep}->${comp.component_id}`;
			const reverseEdge = `${comp.component_id}->${dep}`;
			if (!interfaceEdges.has(edge) && !interfaceEdges.has(reverseEdge)) {
				findings.push(`Missing interface: "${comp.label}" depends on "${dep}" but no interface connects them`);
			}
		}
	}

	return findings;
}

/**
 * Detect cycles in implementation step dependencies using Kahn's algorithm.
 */
function detectCycleInSteps(steps: ImplementationStep[]): string | null {
	const inDegree = new Map<string, number>();
	const adj = new Map<string, string[]>();

	for (const step of steps) {
		inDegree.set(step.step_id, 0);
		adj.set(step.step_id, []);
	}

	for (const step of steps) {
		for (const dep of step.dependencies) {
			if (adj.has(dep)) {
				adj.get(dep)!.push(step.step_id);
				inDegree.set(step.step_id, (inDegree.get(step.step_id) ?? 0) + 1);
			}
		}
	}

	const queue: string[] = [];
	for (const [id, deg] of inDegree) {
		if (deg === 0) queue.push(id);
	}

	let visited = 0;
	while (queue.length > 0) {
		const current = queue.shift()!;
		visited++;
		for (const neighbor of adj.get(current) ?? []) {
			const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, newDeg);
			if (newDeg === 0) queue.push(neighbor);
		}
	}

	if (visited < steps.length) {
		return 'Circular dependency detected in implementation sequence';
	}
	return null;
}

// ==================== SUMMARY BUILDER ====================

/**
 * Build a human-readable summary of the architecture for the PRESENTING gate.
 */
function buildArchitectureSummary(doc: ArchitectureDocument): Record<string, unknown> {
	return {
		version: doc.version,
		status: doc.status,
		goalAlignmentScore: doc.goal_alignment_score,
		validationFindings: doc.validation_findings,
		capabilities: doc.capabilities.map(c => ({
			id: c.capability_id,
			label: c.label,
			requirements: c.source_requirements.length,
			workflows: c.workflows.length,
		})),
		workflows: doc.workflow_graph.map(w => ({
			id: w.workflow_id,
			label: w.label,
			capability: w.capability_id,
			steps: w.steps.length,
		})),
		components: doc.components.map(c => ({
			id: c.component_id,
			label: c.label,
			responsibility: c.responsibility,
			parent: c.parent_component_id,
			workflowsServed: c.workflows_served.length,
		})),
		dataModels: doc.data_models.map(m => ({
			id: m.model_id,
			entity: m.entity_name,
			fields: m.fields.length,
			relationships: m.relationships.length,
		})),
		interfaces: doc.interfaces.map(i => ({
			id: i.interface_id,
			label: i.label,
			type: i.type,
			provider: i.provider_component,
			consumers: i.consumer_components.length,
		})),
		implementationSteps: doc.implementation_sequence.map(s => ({
			id: s.step_id,
			label: s.label,
			complexity: s.estimated_complexity,
			components: s.components_involved.length,
			dependencies: s.dependencies.length,
		})),
	};
}

/**
 * Extract an MMP payload from an ArchitectureDocument for human review.
 * Mirror: architectural assumptions (interface types, dependencies, data models).
 * Pre-Mortem: validation findings as risks.
 */
export function extractArchitectureMMP(doc: ArchitectureDocument): MMPPayload | undefined {
	const mirrorItems: MirrorItem[] = [];
	const preMortemItems: PreMortemItem[] = [];
	let mirrorIdx = 0;
	let pmIdx = 0;

	// Mirror: key interface type assumptions
	for (const iface of doc.interfaces.slice(0, 5)) {
		mirrorIdx++;
		mirrorItems.push({
			id: `ARC-MIR-${mirrorIdx}`,
			text: `${iface.label}: ${iface.provider_component} communicates with consumers via ${iface.type}`,
			category: 'scope',
			rationale: iface.description || `Interface ${iface.interface_id} connects ${iface.consumer_components.length} consumer(s)`,
			status: 'pending',
		});
	}

	// Mirror: high-level component dependency assumptions
	for (const comp of doc.components.filter(c => c.dependencies.length > 0).slice(0, 3)) {
		mirrorIdx++;
		mirrorItems.push({
			id: `ARC-MIR-${mirrorIdx}`,
			text: `${comp.label} depends on: ${comp.dependencies.join(', ')}`,
			category: 'constraint',
			rationale: `Component ${comp.component_id} — ${comp.responsibility}`,
			status: 'pending',
		});
	}

	// Mirror: data model structure assumptions
	for (const model of doc.data_models.slice(0, 3)) {
		mirrorIdx++;
		mirrorItems.push({
			id: `ARC-MIR-${mirrorIdx}`,
			text: `Entity "${model.entity_name}" has ${model.fields.length} fields and ${model.relationships.length} relationships`,
			category: 'scope',
			rationale: model.description || `Data model ${model.model_id}`,
			status: 'pending',
		});
	}

	// Pre-Mortem: validation findings as risks
	for (const finding of doc.validation_findings) {
		pmIdx++;
		const severity = finding.toLowerCase().includes('orphan') || finding.toLowerCase().includes('circular') || finding.toLowerCase().includes('missing')
			? 'high' as const
			: 'medium' as const;

		preMortemItems.push({
			id: `ARC-RISK-${pmIdx}`,
			assumption: finding,
			failureScenario: `This structural issue could lead to implementation problems or drift from the approved plan`,
			severity,
			mitigation: 'Address during the DESIGNING re-iteration before approving',
			status: 'pending',
		});
	}

	// Only return MMP if we have items
	if (mirrorItems.length === 0 && preMortemItems.length === 0) {
		return undefined;
	}

	const result: MMPPayload = {};

	if (mirrorItems.length > 0) {
		result.mirror = {
			steelMan: `Architecture v${doc.version}: ${doc.capabilities.length} capabilities decomposed into ${doc.components.length} components with ${doc.data_models.length} data models and ${doc.interfaces.length} interfaces.`,
			items: mirrorItems,
		};
	}

	if (preMortemItems.length > 0) {
		result.preMortem = {
			summary: `${preMortemItems.length} validation finding(s) identified during architecture review`,
			items: preMortemItems,
		};
	}

	return result;
}
