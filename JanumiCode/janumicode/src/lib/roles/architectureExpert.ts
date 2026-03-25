/**
 * Architecture Expert Role
 *
 * LLM-backed role for the ARCHITECTURE phase sub-workflow.
 * Provides four invocation functions, one per document-producing sub-state:
 *   - invokeArchitectureDecomposition: DECOMPOSING → capabilities + workflows (Use Case Model)
 *   - invokeArchitectureModeling: MODELING → domain entities + relationships (Domain Model)
 *   - invokeArchitectureDesign: DESIGNING → components + interfaces (System Architecture + ICD)
 *   - invokeArchitectureSequencing: SEQUENCING → phased implementation plan (Implementation Roadmap)
 *
 * Each invocation is structured as a complex agent task — the prompt describes
 * the engineering task and the CLI tool uses its own planning, tool access,
 * and decomposition to produce the document artifact.
 *
 * Uses the TECHNICAL_EXPERT provider since the Architecture Expert is
 * the Technical Expert performing deeper structural analysis.
 */

import type { Result } from '../types';
import { Role, Phase } from '../types';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { resolveProviderForRole } from '../cli/providerResolver';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { assembleContext } from '../context';
import { updateWorkflowMetadata } from '../workflow/stateMachine';
import type { DeferredCommandBlock } from './technicalExpertIntake';
import { emitWorkflowCommand } from '../integration/eventBus';

/** Emit deferred command block start after context assembly completes */
function emitDeferredStart(cb?: DeferredCommandBlock): void {
	if (!cb) { return; }
	emitWorkflowCommand({
		dialogueId: cb.dialogueId,
		commandId: cb.commandId,
		action: 'start',
		commandType: cb.commandType ?? 'cli_invocation',
		label: cb.label,
		summary: cb.label,
		status: 'running',
		timestamp: new Date().toISOString(),
	});
}
import type {
	CapabilityNode,
	WorkflowNode,
	ComponentSpec,
	DataModelSpec,
	InterfaceSpec,
	ImplementationStep,
	ArchitectureDocument,
	DecompositionConfig,
	DomainCapabilityMapping,
} from '../types/architecture';
import type { IntakePlanDocument, DomainCoverageMap } from '../types/intake';
import { getLogger, isLoggerInitialized } from '../logging';
import { randomUUID } from 'node:crypto';

// ==================== SYSTEM PROMPTS ====================

const DECOMPOSING_SYSTEM_PROMPT = `You are the ARCHITECTURE EXPERT in a governed multi-role dialogue system.

# Your Role
You perform CAPABILITY DETECTION and WORKFLOW GRAPH GENERATION — the "Global Planner" step.
You receive an approved implementation plan and produce a structured decomposition into CAPABILITIES and WORKFLOWS.

The plan includes:
- **Requirements, decisions, constraints** — the core specification
- **domainProposals** — user-validated business domains (from INTAKE Proposer Round 1). Use these as the PRIMARY source for capability grouping. Do NOT ignore them.
- **workflowProposals** — user-validated workflows (from INTAKE Proposer Round 2). Use these as the PRIMARY source for workflow definitions. Do NOT reinvent workflows from scratch when validated proposals exist.
- **entityProposals** — user-validated data entities (from INTAKE Proposer Round 3). Reference these when defining workflow inputs/outputs.
- **userJourneys** — user-validated journey scenarios. Use these to ensure workflow coverage.
- **phasingStrategy** — user-defined implementation phasing. Respect this when organizing capabilities.

If the plan contains these proposer artifacts, they represent user-validated design decisions and MUST be used as the foundation for your decomposition — not as suggestions to consider.

# Definitions
- **Capability**: A cohesive group of functionality that the system must provide. Each capability
  traces back to one or more requirements from the approved plan. Capabilities are NOT constrained
  to the 12 engineering domains — they are functional groupings that emerge from requirements.
- **Capability Hierarchy**: Organize capabilities in a tree (max 2 levels deep).
  Top-level capabilities represent major functional areas (e.g., "Property Management").
  Sub-capabilities break these into specific feature groups (e.g., "Property Records",
  "Maintenance Requests", "ARC Governance"). Use \`parent_capability_id\` to link sub-capabilities
  to their parent. Set to null for top-level capabilities.
- **Workflow**: A sequence of steps that describes how a capability operates at runtime.
  Each workflow belongs to exactly one capability (usually a leaf capability) and identifies
  actors, triggers, and outputs.

# Repair Mode
If the context includes a "Prior Architecture Document" section with validation findings, this is a REPAIR pass.
You MUST:
- Preserve capabilities and workflows that are NOT cited in the validation findings
- Only modify, add, or remove items to address the specific findings
- Ensure every workflow ID referenced in a capability's "workflows" array has a full definition in the workflows array
- Do NOT regenerate from scratch — make targeted fixes

# Critical Guardrails
1. EVERY capability MUST trace to at least one requirement from the plan (no scope creep)
2. EVERY requirement from the plan MUST be covered by at least one capability (no gaps)
3. Capabilities should be cohesive — group related requirements, don't create one per requirement
4. Workflows must be concrete enough to identify actors and trigger conditions
5. EVERY workflow ID referenced in a capability's "workflows" array MUST have a full definition in the top-level "workflows" array (no dangling references)
6. Include domain_mappings for EVERY capability — map to the engineering domain(s) listed in
   the Domain Coverage section using their exact names. If unsure, use coverage_contribution: "SECONDARY".
   Do NOT leave domain_mappings empty.
7. Use parent_capability_id to create a hierarchy. Top-level capabilities should be broad functional
   areas. Sub-capabilities should be specific enough to map to concrete workflows.
8. Do NOT write, create, or modify any files. Your output is JSON only.
9. Do NOT execute shell commands or use tools to make changes to the codebase.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "capabilities": [
    {
      "capability_id": "CAP-<SHORT-NAME>",
      "parent_capability_id": null,
      "label": "Top-level capability name",
      "description": "What this capability area provides",
      "source_requirements": ["REQ-1", "REQ-2"],
      "domain_mappings": [
        {
          "mapping_id": "DM-<UUID>",
          "domain": "<EngineeringDomain enum value>",
          "capability_id": "CAP-<SHORT-NAME>",
          "requirement_ids": ["REQ-1"],
          "coverage_contribution": "PRIMARY"
        }
      ],
      "workflows": ["WF-<SHORT-NAME>"]
    }
  ],
  "workflows": [
    {
      "workflow_id": "WF-<SHORT-NAME>",
      "capability_id": "CAP-<SHORT-NAME>",
      "label": "Human-readable workflow name",
      "description": "What this workflow accomplishes",
      "steps": [
        {
          "step_id": "STEP-1",
          "label": "Step label",
          "actor": "User|System|API|Worker",
          "action": "What happens",
          "inputs": ["input artifact"],
          "outputs": ["output artifact"],
          "next_steps": ["STEP-2"]
        }
      ],
      "actors": ["User", "System"],
      "triggers": ["User submits form"],
      "outputs": ["Created record"]
    }
  ]
}`;

// ── MODELING prompt: Domain Model document ──

const MODELING_SYSTEM_PROMPT = `You are the ARCHITECTURE EXPERT performing DOMAIN MODELING.

# Your Task
Produce a comprehensive Domain Model for the system described in the context below.
The Domain Model defines every data entity the system works with — their fields,
relationships, constraints, and business invariants.

# Approach
1. **Start from entityProposals** — if the context includes user-validated \`entityProposals\`
   from the INTAKE phase, use them as the PRIMARY source for entities. They contain pre-validated
   names, key attributes, relationships, and domain assignments. Do NOT ignore them.
2. Use \`domainProposals\` (if present) to understand domain groupings and entity previews.
3. Examine the capabilities and workflows to identify additional entities not covered by proposals.
4. Read the ground-truth spec files in the workspace if available (look for
   specs/ or ground-truth-specs/ directories) to understand domain patterns.
5. For each entity, define complete field-level detail including types, constraints,
   and validation rules.
6. Map all relationships with cardinality and direction.
7. Define business invariants — rules that must always hold across the data model.

# Critical Guardrails
1. EVERY entity MUST trace to at least one workflow (no invented entities).
   If an entity is needed, identify which workflow step produces or consumes it.
2. Include field-level detail: name, type, required/optional, description, constraints.
3. Relationships MUST reference other entities in this model (no dangling references).
4. Do NOT invent infrastructure entities (caches, queues, registries) unless
   requirements explicitly demand them.
5. Do NOT write, create, or modify any files. Your output is JSON only.
6. Do NOT execute shell commands or use tools to make changes to the codebase.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "data_models": [
    {
      "model_id": "DM-<SHORT-NAME>",
      "entity_name": "EntityName",
      "description": "What this entity represents and its role in the system",
      "fields": [
        { "name": "field_name", "type": "string|uuid|integer|timestamp|boolean|jsonb|enum(...)", "required": true, "description": "Purpose and validation rules" }
      ],
      "relationships": [
        { "target_model": "DM-<ID>", "type": "one-to-one|one-to-many|many-to-many", "description": "What this relationship means" }
      ],
      "constraints": ["Unique on email", "Check: status IN ('active', 'archived')"],
      "invariants": ["A tenant must have at least one admin user", "Property address cannot change after listing is published"],
      "source_requirements": ["REQ-1", "REQ-2"]
    }
  ]
}`;

// ── DESIGNING prompt: System Architecture + Interface Contract documents ──

const DESIGNING_SYSTEM_PROMPT = `You are the ARCHITECTURE EXPERT performing COMPONENT DESIGN and INTERFACE SPECIFICATION.

# Your Task
Design the component architecture and interface contracts for the system described below.
You receive capabilities, workflows, AND the Domain Model as input. Your job is to determine
what software modules (components) the system needs and how they communicate (interfaces).

# Repair Mode
If the context includes validation findings or human feedback about specific issues, this is a REPAIR pass.
You MUST:
- Preserve components and interfaces that are NOT cited in the validation findings
- Only modify, add, or remove items to address the specific findings
- Ensure every component serves at least one workflow (fix orphan components by connecting them)
- Ensure interfaces exist between all dependent component pairs
- Do NOT regenerate the entire architecture from scratch — make targeted fixes

# Design Approach: Flow-First
For each workflow, trace how data flows through the system:
1. What workflow step triggers the flow?
2. What component receives the trigger?
3. What domain entities does it read/write?
4. What component does it call next, and through what interface?
5. What is returned to the actor?

Components should EMERGE from this flow analysis — they exist because the workflow
needs them, not because they follow an arbitrary architectural template.

# Component Requirements
Each component must include:
- **responsibility**: A detailed paragraph explaining WHAT the component does, what
  user-visible behavior it enables, and HOW it interacts with its dependencies.
  NOT a one-sentence label. Write enough that an implementer could start coding.
- **rationale**: WHY this component exists as a separate module. Reference specific
  requirements (REQ-ids) or workflows (WF-ids) that necessitate it.
- **interaction_patterns**: HOW this component communicates with each dependency.
  e.g., "Calls COMP-AUTH via REST for token validation", "Subscribes to COMP-EVENTS
  for property updates".

# Interface Requirements
Each interface must include a CONCRETE contract:
- HTTP method + path + request/response shapes for REST
- Event name + payload schema for EVENT
- Method signature for RPC
- NOT just a label like "Property API"

# Anti-Hallucination Guardrails
- Do NOT create components for infrastructure patterns (idempotency registries,
  workflow orchestrators, message queues, caching layers, saga coordinators)
  unless specific requirements explicitly demand them.
- Do NOT create wrapper or adapter components that just delegate to another component.
- Every component MUST serve at least one workflow. Every workflow MUST have at least
  one component implementing it.
- Interface providers and consumers MUST reference components that exist in your output.
- Focus on what the user asked to build, not what a generic architecture template suggests.
- Do NOT write, create, or modify any files. Your output is JSON only.
- Do NOT execute shell commands or use tools to make changes to the codebase.

# Workspace Inspection
Before finalizing components, examine the workspace for implementation context:
1. Look at src/ directory structure for existing module organization patterns.
2. Read ground-truth spec files (specs/ or ground-truth-specs/) for domain
   patterns that suggest natural component boundaries.
3. Check project configs (package.json, tsconfig.json, build configs) for
   hints about intended module structure.
4. Align file_scope paths with actual workspace directory conventions.

# Stopping Criteria for Components
A component is well-decomposed when ALL are true:
1. **Context Fit**: Its scope fits within the context token limit
2. **Verifiable Output**: It produces concrete, testable outputs
3. **Clear Inputs**: All dependencies are explicit, not assumed
4. **Single Responsibility**: It serves ≤ the threshold number of workflows

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "components": [
    {
      "component_id": "COMP-<SHORT-NAME>",
      "label": "Component name",
      "responsibility": "Detailed paragraph: what it does, what behavior it enables, how it works",
      "rationale": "Why this exists: which requirements and workflows necessitate it",
      "workflows_served": ["WF-<ID>"],
      "dependencies": ["COMP-<ID>"],
      "interaction_patterns": ["Calls COMP-X via REST for Y", "Reads from DM-Z via database query"],
      "technology_notes": "Stack/pattern decisions with justification",
      "file_scope": "src/modules/<name>/",
      "parent_component_id": null
    }
  ],
  "interfaces": [
    {
      "interface_id": "API-<SHORT-NAME>",
      "type": "REST|EVENT|RPC|FILE|IPC",
      "label": "Interface name",
      "description": "What this interface provides and why it exists",
      "provider_component": "COMP-<ID>",
      "consumer_components": ["COMP-<ID>"],
      "contract": "POST /api/v1/properties { name: string, address: Address } → { id: uuid, created_at: timestamp }",
      "source_workflows": ["WF-<ID>"]
    }
  ]
}`;

// ── SEQUENCING prompt: Implementation Roadmap document ──

const SEQUENCING_SYSTEM_PROMPT = `You are the ARCHITECTURE EXPERT performing IMPLEMENTATION SEQUENCING.

# Your Task
Produce an Implementation Roadmap — a phased plan for building the system described below.
You receive the complete architecture (capabilities, domain model, components, interfaces)
and must determine the optimal order for implementation.

# Approach
1. **Respect the product phasing strategy** — if the context includes a \`phasingStrategy\` from the
   INTAKE phase (e.g., "Phase 1: Home Assistant, Phase 2: Service Provider FSM"), align the
   implementation roadmap with these user-defined product phases. Technical dependency resolution
   should operate WITHIN each product phase, not override the product phasing.
2. Identify foundation components that have no dependencies or only external dependencies.
   These form the first technical phase within each product phase.
3. Group components that depend on earlier phases into subsequent technical phases.
4. Within each phase, order by: data model first, then logic, then interfaces.
5. Each step should identify:
   - Which components are built or modified
   - What must be built first (dependency edges)
   - How to verify the step works (concrete verification method)
   - Estimated complexity (LOW/MEDIUM/HIGH based on component scope)

# Workspace-Aware Sequencing
Before finalizing the implementation order, examine the workspace:
1. Look at src/ directory structure for existing implementation layers.
2. Check for existing build scripts, migration files, or deployment configs
   that suggest a natural build order.
3. Examine ground-truth spec files (specs/ or ground-truth-specs/) for
   domain priorities or phasing guidance.
4. Align verification methods with the project's actual test and build tooling.

# Critical Guardrails
1. Implementation steps MUST have no circular dependencies.
2. Every component from the architecture MUST appear in at least one step.
3. Dependencies between steps must respect component dependency order.
4. Verification methods should be concrete: "Run unit tests for X", "Verify API endpoint
   returns expected schema", not vague "Test it".
5. Do NOT write, create, or modify any files. Your output is JSON only.
6. Do NOT execute shell commands or use tools to make changes to the codebase.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "implementation_sequence": [
    {
      "step_id": "STEP-<N>",
      "label": "Phase N: Step name",
      "description": "What to build in this step and why it comes at this point",
      "components_involved": ["COMP-<ID>"],
      "dependencies": ["STEP-<N>"],
      "estimated_complexity": "LOW|MEDIUM|HIGH",
      "verification_method": "Concrete verification: run tests, check endpoints, validate schemas",
      "sort_order": 1
    }
  ]
}`;

// ==================== DECOMPOSING INVOCATION ====================

export interface DecompositionResult {
	capabilities: CapabilityNode[];
	workflows: WorkflowNode[];
	raw_response: string;
}

/**
 * Invoke the Architecture Expert for DECOMPOSING (Global Planner).
 * Transforms the approved intake plan into capabilities and workflows.
 */
export async function invokeArchitectureDecomposition(
	dialogueId: string,
	approvedPlan: IntakePlanDocument,
	domainCoverage: DomainCoverageMap | null,
	tokenBudget: number,
	options?: { commandId?: string; dialogueId?: string; onEvent?: (event: CLIActivityEvent) => void; humanFeedback?: string | null; priorArchitectureDoc?: import('../types/architecture').ArchitectureDocument | null; commandBlock?: DeferredCommandBlock }
): Promise<Result<DecompositionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureExpert', phase: 'DECOMPOSING' })
		: null;

	try {
		// 1. Resolve provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as unknown as Result<DecompositionResult>;
		}

		// 2. Assemble context via Context Engineer
		const extras: Record<string, unknown> = { approvedPlan, domainCoverage, humanFeedback: options?.humanFeedback };
		if (options?.priorArchitectureDoc) {
			extras.priorArchitectureDoc = options.priorArchitectureDoc;
		}

		const contextResult = await assembleContext({
			dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: Phase.ARCHITECTURE,
			subPhase: 'DECOMPOSING',
			tokenBudget,
			extras,
			onEvent: options?.onEvent,
		});

		if (!contextResult.success) {
			return contextResult as unknown as Result<DecompositionResult>;
		}
		emitDeferredStart(options?.commandBlock);

		// 3. Build stdin and invoke
		const stdinContent = buildStdinContent(DECOMPOSING_SYSTEM_PROMPT, contextResult.value.briefing);

		// Emit stdin content for command block visibility
		if (options?.commandId && options?.dialogueId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Architect — Capability Decomposition',
				summary: '── stdin ──',
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		log?.info('Invoking architecture decomposition', {
			contextLength: contextResult.value.briefing.length,
		});

		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent: options?.onEvent,
		});

		if (!cliResult.success) {
			return cliResult as unknown as Result<DecompositionResult>;
		}

		const rawResponse = cliResult.value.response;

		// Cache raw output BEFORE parsing — enables adopt/retry on parse failure
		updateWorkflowMetadata(dialogueId, { cachedRawCliOutput: rawResponse });

		// 4. Parse response
		const parsed = parseDecompositionResponse(rawResponse);
		if (!parsed.success) {
			log?.error('Failed to parse decomposition response', { error: parsed.error.message });
			return parsed;
		}

		log?.info('Decomposition complete', {
			capabilities: parsed.value.capabilities.length,
			workflows: parsed.value.workflows.length,
		});

		return parsed;
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== DESIGNING INVOCATION ====================

export interface DesignResult {
	components: ComponentSpec[];
	interfaces: InterfaceSpec[];
	raw_response: string;
}

// ==================== MODELING INVOCATION ====================

export interface ModelingResult {
	data_models: DataModelSpec[];
	raw_response: string;
}

// ==================== SEQUENCING INVOCATION ====================

export interface SequencingResult {
	implementation_sequence: ImplementationStep[];
	raw_response: string;
}

/**
 * Invoke the Architecture Expert for DESIGNING (Local Planner).
 * Transforms capabilities and workflows into components, data models, etc.
 */
export async function invokeArchitectureDesign(
	dialogueId: string,
	architectureDoc: ArchitectureDocument,
	decompositionConfig: DecompositionConfig,
	humanFeedback: string | null,
	tokenBudget: number,
	options?: { commandId?: string; dialogueId?: string; onEvent?: (event: CLIActivityEvent) => void; constraintsAndDecisions?: Record<string, unknown> | null; workspaceSpecs?: string | null; commandBlock?: DeferredCommandBlock }
): Promise<Result<DesignResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureExpert', phase: 'DESIGNING' })
		: null;

	try {
		// 1. Resolve provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as unknown as Result<DesignResult>;
		}

		// 2. Assemble context via Context Engineer
		const designExtras: Record<string, unknown> = { architectureDoc, decompositionConfig, humanFeedback };
		if (options?.constraintsAndDecisions) { designExtras.constraintsAndDecisions = options.constraintsAndDecisions; }
		if (options?.workspaceSpecs) { designExtras.workspace_specs = options.workspaceSpecs; }

		const contextResult = await assembleContext({
			dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: Phase.ARCHITECTURE,
			subPhase: 'DESIGNING',
			tokenBudget,
			extras: designExtras,
			onEvent: options?.onEvent,
		});

		if (!contextResult.success) {
			return contextResult as unknown as Result<DesignResult>;
		}
		emitDeferredStart(options?.commandBlock);

		// 3. Build stdin and invoke
		const stdinContent = buildStdinContent(DESIGNING_SYSTEM_PROMPT, contextResult.value.briefing);

		// Emit stdin content for command block visibility
		if (options?.commandId && options?.dialogueId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Architect — Architecture Design',
				summary: '── stdin ──',
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		log?.info('Invoking architecture design', {
			contextLength: contextResult.value.briefing.length,
			iteration: humanFeedback ? 'revision' : 'initial',
		});

		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent: options?.onEvent,
		});

		if (!cliResult.success) {
			return cliResult as unknown as Result<DesignResult>;
		}

		const rawResponse = cliResult.value.response;

		// Cache raw output BEFORE parsing
		updateWorkflowMetadata(dialogueId, { cachedRawCliOutput: rawResponse });

		// 4. Parse response
		const parsed = parseDesignResponse(rawResponse);
		if (!parsed.success) {
			log?.error('Failed to parse design response', { error: parsed.error.message });
			return parsed;
		}

		log?.info('Design complete', {
			components: parsed.value.components.length,
			interfaces: parsed.value.interfaces.length,
		});

		return parsed;
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== RESPONSE PARSING ====================

/**
 * Extract JSON from LLM response, handling markdown fences and preamble text.
 */
function extractJson(raw: string): string {
	const trimmed = raw.trim();

	// Try direct parse
	try {
		JSON.parse(trimmed);
		return trimmed;
	} catch { /* continue */ }

	// Try extracting from markdown fence
	const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
	if (fenceMatch) {
		return fenceMatch[1].trim();
	}

	// Try finding balanced JSON object
	const firstBrace = trimmed.indexOf('{');
	if (firstBrace >= 0) {
		let depth = 0;
		for (let i = firstBrace; i < trimmed.length; i++) {
			if (trimmed[i] === '{') { depth++; }
			else if (trimmed[i] === '}') { depth--; }
			if (depth === 0) {
				return trimmed.substring(firstBrace, i + 1);
			}
		}
	}

	return trimmed;
}

function parseDecompositionResponse(rawResponse: string): Result<DecompositionResult> {
	try {
		const jsonStr = extractJson(rawResponse);
		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.capabilities)) {
			return { success: false, error: new Error('Response missing "capabilities" array') };
		}
		if (!Array.isArray(parsed.workflows)) {
			return { success: false, error: new Error('Response missing "workflows" array') };
		}

		// Normalize capabilities
		const capabilityIds = new Set(
			(parsed.capabilities as Record<string, unknown>[]).map(c => c.capability_id as string).filter(Boolean)
		);
		const capabilities: CapabilityNode[] = parsed.capabilities.map((c: Record<string, unknown>) => ({
			capability_id: (c.capability_id as string) || `CAP-${randomUUID().substring(0, 8)}`,
			parent_capability_id: (c.parent_capability_id as string) && capabilityIds.has(c.parent_capability_id as string)
				? (c.parent_capability_id as string) : null,
			label: (c.label as string) || '',
			description: (c.description as string) || '',
			source_requirements: Array.isArray(c.source_requirements) ? c.source_requirements as string[] : [],
			domain_mappings: Array.isArray(c.domain_mappings)
				? (c.domain_mappings as Record<string, unknown>[]).map(dm => ({
					mapping_id: (dm.mapping_id as string) || `DM-${randomUUID().substring(0, 8)}`,
					domain: dm.domain as DomainCapabilityMapping['domain'],
					capability_id: (dm.capability_id as string) || c.capability_id as string,
					requirement_ids: Array.isArray(dm.requirement_ids) ? dm.requirement_ids as string[] : [],
					coverage_contribution: (dm.coverage_contribution as 'PRIMARY' | 'SECONDARY') || 'PRIMARY',
				}))
				: [],
			workflows: Array.isArray(c.workflows) ? c.workflows as string[] : [],
		}));

		// Normalize workflows
		const workflows: WorkflowNode[] = parsed.workflows.map((w: Record<string, unknown>) => ({
			workflow_id: (w.workflow_id as string) || `WF-${randomUUID().substring(0, 8)}`,
			capability_id: (w.capability_id as string) || '',
			label: (w.label as string) || '',
			description: (w.description as string) || '',
			steps: Array.isArray(w.steps)
				? (w.steps as Record<string, unknown>[]).map(s => ({
					step_id: (s.step_id as string) || '',
					label: (s.label as string) || '',
					actor: (s.actor as string) || '',
					action: (s.action as string) || '',
					inputs: Array.isArray(s.inputs) ? s.inputs as string[] : [],
					outputs: Array.isArray(s.outputs) ? s.outputs as string[] : [],
					next_steps: Array.isArray(s.next_steps) ? s.next_steps as string[] : [],
				}))
				: [],
			actors: Array.isArray(w.actors) ? w.actors as string[] : [],
			triggers: Array.isArray(w.triggers) ? w.triggers as string[] : [],
			outputs: Array.isArray(w.outputs) ? w.outputs as string[] : [],
		}));

		return {
			success: true,
			value: { capabilities, workflows, raw_response: rawResponse },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to parse decomposition response') };
	}
}

function parseDesignResponse(rawResponse: string): Result<DesignResult> {
	try {
		const jsonStr = extractJson(rawResponse);
		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.components)) {
			return { success: false, error: new Error('Response missing "components" array') };
		}

		// Normalize components
		const components: ComponentSpec[] = parsed.components.map((c: Record<string, unknown>) => ({
			component_id: (c.component_id as string) || `COMP-${randomUUID().substring(0, 8)}`,
			label: (c.label as string) || '',
			responsibility: (c.responsibility as string) || '',
			rationale: (c.rationale as string) || '',
			workflows_served: Array.isArray(c.workflows_served) ? c.workflows_served as string[] : [],
			dependencies: Array.isArray(c.dependencies) ? c.dependencies as string[] : [],
			interaction_patterns: Array.isArray(c.interaction_patterns) ? c.interaction_patterns as string[] : [],
			technology_notes: (c.technology_notes as string) || '',
			file_scope: (c.file_scope as string) || '',
			parent_component_id: (c.parent_component_id as string) || null,
		}));

		// Normalize interfaces
		const interfaces: InterfaceSpec[] = (parsed.interfaces ?? []).map((i: Record<string, unknown>) => ({
			interface_id: (i.interface_id as string) || `API-${randomUUID().substring(0, 8)}`,
			type: (i.type as InterfaceSpec['type']) || 'REST',
			label: (i.label as string) || '',
			description: (i.description as string) || '',
			provider_component: (i.provider_component as string) || '',
			consumer_components: Array.isArray(i.consumer_components) ? i.consumer_components as string[] : [],
			contract: (i.contract as string) || '',
			source_workflows: Array.isArray(i.source_workflows) ? i.source_workflows as string[] : [],
		}));

		return {
			success: true,
			value: { components, interfaces, raw_response: rawResponse },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to parse design response') };
	}
}

// ==================== MODELING PARSE ====================

function parseModelingResponse(rawResponse: string): Result<ModelingResult> {
	try {
		const jsonStr = extractJson(rawResponse);
		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.data_models)) {
			return { success: false, error: new Error('Response missing "data_models" array') };
		}

		const data_models: DataModelSpec[] = parsed.data_models.map((m: Record<string, unknown>) => ({
			model_id: (m.model_id as string) || `DM-${randomUUID().substring(0, 8)}`,
			entity_name: (m.entity_name as string) || '',
			description: (m.description as string) || '',
			fields: Array.isArray(m.fields)
				? (m.fields as Record<string, unknown>[]).map(f => ({
					name: (f.name as string) || '',
					type: (f.type as string) || 'string',
					required: Boolean(f.required),
					description: (f.description as string) || '',
				}))
				: [],
			relationships: Array.isArray(m.relationships)
				? (m.relationships as Record<string, unknown>[]).map(r => ({
					target_model: (r.target_model as string) || '',
					type: (r.type as 'one-to-one' | 'one-to-many' | 'many-to-many') || 'one-to-many',
					description: (r.description as string) || '',
				}))
				: [],
			constraints: Array.isArray(m.constraints) ? m.constraints as string[] : [],
			invariants: Array.isArray(m.invariants) ? m.invariants as string[] : [],
			source_requirements: Array.isArray(m.source_requirements) ? m.source_requirements as string[] : [],
		}));

		return {
			success: true,
			value: { data_models, raw_response: rawResponse },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to parse modeling response') };
	}
}

// ==================== SEQUENCING PARSE ====================

function parseSequencingResponse(rawResponse: string): Result<SequencingResult> {
	try {
		const jsonStr = extractJson(rawResponse);
		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.implementation_sequence)) {
			return { success: false, error: new Error('Response missing "implementation_sequence" array') };
		}

		const implementation_sequence: ImplementationStep[] = parsed.implementation_sequence.map(
			(s: Record<string, unknown>, idx: number) => ({
				step_id: (s.step_id as string) || `STEP-${idx + 1}`,
				label: (s.label as string) || '',
				description: (s.description as string) || '',
				components_involved: Array.isArray(s.components_involved) ? s.components_involved as string[] : [],
				dependencies: Array.isArray(s.dependencies) ? s.dependencies as string[] : [],
				estimated_complexity: (s.estimated_complexity as ImplementationStep['estimated_complexity']) || 'MEDIUM',
				verification_method: (s.verification_method as string) || '',
				sort_order: typeof s.sort_order === 'number' ? s.sort_order : idx + 1,
			})
		);

		return {
			success: true,
			value: { implementation_sequence, raw_response: rawResponse },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to parse sequencing response') };
	}
}

// ==================== MODELING INVOCATION FUNCTION ====================

/**
 * Invoke the Architecture Expert for MODELING (Domain Model).
 * Transforms capabilities and workflows into domain entities with full field detail.
 */
export async function invokeArchitectureModeling(
	dialogueId: string,
	architectureDoc: ArchitectureDocument,
	tokenBudget: number,
	options?: { commandId?: string; dialogueId?: string; onEvent?: (event: CLIActivityEvent) => void; humanFeedback?: string | null; approvedPlan?: Record<string, unknown> | null; workspaceSpecs?: string | null; commandBlock?: DeferredCommandBlock }
): Promise<Result<ModelingResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureExpert', phase: 'MODELING' })
		: null;

	try {
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as unknown as Result<ModelingResult>;
		}

		const modelingExtras: Record<string, unknown> = { architectureDoc, humanFeedback: options?.humanFeedback };
		if (options?.approvedPlan) { modelingExtras.approvedPlan = options.approvedPlan; }
		if (options?.workspaceSpecs) { modelingExtras.workspace_specs = options.workspaceSpecs; }

		const contextResult = await assembleContext({
			dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: Phase.ARCHITECTURE,
			subPhase: 'MODELING',
			tokenBudget,
			extras: modelingExtras,
			onEvent: options?.onEvent,
		});

		if (!contextResult.success) {
			return contextResult as unknown as Result<ModelingResult>;
		}
		emitDeferredStart(options?.commandBlock);

		const stdinContent = buildStdinContent(MODELING_SYSTEM_PROMPT, contextResult.value.briefing);

		if (options?.commandId && options?.dialogueId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Architect — Domain Modeling',
				summary: '── stdin ──',
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		log?.info('Invoking architecture modeling', {
			contextLength: contextResult.value.briefing.length,
		});

		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent: options?.onEvent,
		});

		if (!cliResult.success) {
			return cliResult as unknown as Result<ModelingResult>;
		}

		// Cache raw output BEFORE parsing
		updateWorkflowMetadata(dialogueId, { cachedRawCliOutput: cliResult.value.response });

		const parsed = parseModelingResponse(cliResult.value.response);
		if (!parsed.success) {
			log?.error('Failed to parse modeling response', { error: parsed.error.message });
			return parsed;
		}

		log?.info('Modeling complete', { dataModels: parsed.value.data_models.length });
		return parsed;
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== SEQUENCING INVOCATION FUNCTION ====================

/**
 * Invoke the Architecture Expert for SEQUENCING (Implementation Roadmap).
 * Transforms the complete architecture into a phased implementation plan.
 */
export async function invokeArchitectureSequencing(
	dialogueId: string,
	architectureDoc: ArchitectureDocument,
	tokenBudget: number,
	options?: { commandId?: string; dialogueId?: string; onEvent?: (event: CLIActivityEvent) => void; humanFeedback?: string | null; phasingStrategy?: unknown[] | null; workspaceSpecs?: string | null; commandBlock?: DeferredCommandBlock }
): Promise<Result<SequencingResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureExpert', phase: 'SEQUENCING' })
		: null;

	try {
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as unknown as Result<SequencingResult>;
		}

		const seqExtras: Record<string, unknown> = { architectureDoc, humanFeedback: options?.humanFeedback };
		if (options?.phasingStrategy) { seqExtras.phasingStrategy = options.phasingStrategy; }
		if (options?.workspaceSpecs) { seqExtras.workspace_patterns = options.workspaceSpecs; }

		const contextResult = await assembleContext({
			dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: Phase.ARCHITECTURE,
			subPhase: 'SEQUENCING',
			tokenBudget,
			extras: seqExtras,
			onEvent: options?.onEvent,
		});

		if (!contextResult.success) {
			return contextResult as unknown as Result<SequencingResult>;
		}
		emitDeferredStart(options?.commandBlock);

		const stdinContent = buildStdinContent(SEQUENCING_SYSTEM_PROMPT, contextResult.value.briefing);

		if (options?.commandId && options?.dialogueId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Architect — Implementation Sequencing',
				summary: '── stdin ──',
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		log?.info('Invoking architecture sequencing', {
			contextLength: contextResult.value.briefing.length,
		});

		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent: options?.onEvent,
		});

		if (!cliResult.success) {
			return cliResult as unknown as Result<SequencingResult>;
		}

		// Cache raw output BEFORE parsing
		updateWorkflowMetadata(dialogueId, { cachedRawCliOutput: cliResult.value.response });

		const parsed = parseSequencingResponse(cliResult.value.response);
		if (!parsed.success) {
			log?.error('Failed to parse sequencing response', { error: parsed.error.message });
			return parsed;
		}

		log?.info('Sequencing complete', { steps: parsed.value.implementation_sequence.length });
		return parsed;
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== BATCH DECOMPOSITION INVOCATION ====================

const DECOMPOSITION_SYSTEM_PROMPT = `You are the ARCHITECTURE EXPERT performing TARGETED DECOMPOSITION.

# Task
You are given components that violated stopping criteria during recursive evaluation.
For each one, analyze whether it should be decomposed into sub-components or kept intact.

# Decision Framework
For each violating component:
1. **DECOMPOSE** into meaningful sub-components if genuine implementation boundaries exist.
   Set parent_component_id on each sub-component to link to the parent.
2. **KEEP INTACT** if the component is semantically cohesive despite the violations.
   Return it unchanged with parent_component_id: null.

# Analysis Guidelines
- Consider each component in context of the FULL architecture (siblings, interfaces, data flows).
- If workflows are cohesive (e.g., all CRUD on one entity), KEEP the component intact.
- If distinct workflow groups touch different domain entities or data paths, DECOMPOSE.
- Examine workspace (src/, ground-truth-specs/, project configs) for file structure that
  confirms or denies proposed boundaries.
- Do NOT redesign components that are not listed in the violating set.
- Do NOT split into Data/Logic/API layers unless genuinely separable.
- Each sub-component needs: component_id, label, responsibility, rationale, workflows_served,
  dependencies, interaction_patterns, technology_notes, file_scope, parent_component_id.

# Response Format
Your response MUST be valid JSON:

\`\`\`json
{
  "components": [
    {
      "component_id": "COMP-<SHORT-NAME>",
      "label": "Component name",
      "responsibility": "Detailed: what it does, what behavior it enables, how it works",
      "rationale": "Why this exists: which requirements and workflows necessitate it",
      "workflows_served": ["WF-<ID>"],
      "dependencies": ["COMP-<ID>"],
      "interaction_patterns": ["Calls COMP-X via REST for Y"],
      "technology_notes": "Stack/pattern decisions",
      "file_scope": "src/modules/<name>/",
      "parent_component_id": "COMP-<PARENT-ID> or null if kept intact"
    }
  ]
}
\`\`\``;

/**
 * Invoke the Architecture Expert for batched component decomposition.
 * Sends all violating components in one request with full architecture context,
 * allowing the agent to make coherent decomposition decisions across the set.
 *
 * The agent may keep components intact if they are semantically cohesive.
 * Returns sub-components (with parent_component_id set) and intact components.
 */
export async function invokeBatchDecomposition(
	dialogueId: string,
	violating: Array<{ component: ComponentSpec; violations: string[] }>,
	architectureDoc: ArchitectureDocument,
	options?: { commandId?: string; dialogueId?: string; onEvent?: (event: CLIActivityEvent) => void; constraintsAndDecisions?: Record<string, unknown> | null; humanFeedback?: string | null }
): Promise<Result<ComponentSpec[]>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureExpert', phase: 'DECOMPOSITION' })
		: null;

	try {
		// 1. Resolve provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as unknown as Result<ComponentSpec[]>;
		}

		// 2. Build focused context with full architecture + violating components
		const contextSections: string[] = [];

		// Full architecture context for coherent reasoning
		contextSections.push('# Capabilities');
		for (const cap of architectureDoc.capabilities) {
			contextSections.push(`- ${cap.capability_id}: ${cap.label} — ${cap.description}`);
		}

		contextSections.push('\n# Workflows');
		for (const wf of architectureDoc.workflow_graph) {
			const stepSummary = wf.steps.map(s => `${s.label} (${s.actor})`).join(' → ');
			contextSections.push(`- ${wf.workflow_id}: ${wf.label} — ${stepSummary}`);
		}

		if (architectureDoc.data_models.length > 0) {
			contextSections.push('\n# Domain Model');
			for (const dm of architectureDoc.data_models) {
				const rels = dm.relationships.map(r => `→ ${r.target_model} (${r.type})`).join(', ');
				contextSections.push(`- ${dm.model_id}: ${dm.entity_name} — ${dm.description}${rels ? ` [${rels}]` : ''}`);
			}
		}

		if (architectureDoc.interfaces.length > 0) {
			contextSections.push('\n# Interfaces');
			for (const iface of architectureDoc.interfaces) {
				contextSections.push(`- ${iface.interface_id}: ${iface.label} (${iface.type}) — ${iface.provider_component} → ${iface.consumer_components.join(', ')}`);
			}
		}

		contextSections.push('\n# All Current Components (for context)');
		for (const comp of architectureDoc.components) {
			contextSections.push(`- ${comp.component_id}: ${comp.label} — ${comp.responsibility.substring(0, 120)}${comp.responsibility.length > 120 ? '...' : ''}`);
			if (comp.workflows_served.length > 0) {
				contextSections.push(`  Workflows: ${comp.workflows_served.join(', ')}`);
			}
		}

		// Intake context: constraints, decisions, and human feedback
		if (options?.constraintsAndDecisions) {
			const cd = options.constraintsAndDecisions;
			if (Array.isArray(cd.constraints) && cd.constraints.length > 0) {
				contextSections.push('\n# Constraints (from Intake)');
				for (const c of cd.constraints as Array<{ id?: string; text?: string }>) {
					contextSections.push(`- [${c.id ?? '?'}] ${c.text ?? ''}`);
				}
			}
			if (Array.isArray(cd.decisions) && cd.decisions.length > 0) {
				contextSections.push('\n# Decisions (from Intake)');
				for (const d of cd.decisions as Array<{ id?: string; text?: string }>) {
					contextSections.push(`- [${d.id ?? '?'}] ${d.text ?? ''}`);
				}
			}
		}

		if (options?.humanFeedback) {
			contextSections.push('\n# Human Feedback / Validation Findings');
			contextSections.push(options.humanFeedback);
		}

		contextSections.push('\n# Components Requiring Analysis');
		contextSections.push('The following components violated stopping criteria and need decomposition analysis:');
		for (const v of violating) {
			contextSections.push(`\n## ${v.component.component_id}: ${v.component.label}`);
			contextSections.push(`Responsibility: ${v.component.responsibility}`);
			contextSections.push(`Rationale: ${v.component.rationale}`);
			contextSections.push(`Workflows served: ${v.component.workflows_served.join(', ')}`);
			contextSections.push(`Dependencies: ${v.component.dependencies.join(', ') || 'none'}`);
			if (v.component.interaction_patterns?.length > 0) {
				contextSections.push(`Interaction patterns: ${v.component.interaction_patterns.join('; ')}`);
			}
			contextSections.push(`File scope: ${v.component.file_scope || 'unset'}`);
			contextSections.push(`**Violations**: ${v.violations.join('; ')}`);
		}

		const context = contextSections.join('\n');

		// 3. Build stdin and invoke
		const stdinContent = buildStdinContent(DECOMPOSITION_SYSTEM_PROMPT, context);

		if (options?.commandId && options?.dialogueId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Architect — Batch Decomposition',
				summary: `Analyzing ${violating.length} components for decomposition (${violating.map(v => v.component.label).join(', ')})`,
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		log?.info('Invoking batch decomposition', {
			violatingCount: violating.length,
			contextLength: context.length,
		});

		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent: options?.onEvent,
		});

		if (!cliResult.success) {
			return cliResult as unknown as Result<ComponentSpec[]>;
		}

		// 4. Parse response — reuse the component normalization from parseDesignResponse
		const rawResponse = cliResult.value.response;
		const jsonStr = extractJson(rawResponse);
		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.components)) {
			return { success: false, error: new Error('Decomposition response missing "components" array') };
		}

		const components: ComponentSpec[] = parsed.components.map((c: Record<string, unknown>) => ({
			component_id: (c.component_id as string) || `COMP-${randomUUID().substring(0, 8)}`,
			label: (c.label as string) || '',
			responsibility: (c.responsibility as string) || '',
			rationale: (c.rationale as string) || '',
			workflows_served: Array.isArray(c.workflows_served) ? c.workflows_served as string[] : [],
			dependencies: Array.isArray(c.dependencies) ? c.dependencies as string[] : [],
			interaction_patterns: Array.isArray(c.interaction_patterns) ? c.interaction_patterns as string[] : [],
			technology_notes: (c.technology_notes as string) || '',
			file_scope: (c.file_scope as string) || '',
			parent_component_id: (c.parent_component_id as string) || null,
		}));

		log?.info('Batch decomposition complete', {
			inputComponents: violating.length,
			outputComponents: components.length,
		});

		return { success: true, value: components };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
