/**
 * Technical Expert INTAKE Mode
 * Implements the conversational planning advisor role for the INTAKE phase.
 * The Technical Expert investigates the codebase to ground responses in reality,
 * bridges business requirements with technical capabilities, and produces
 * IntakeTurnResponse JSON (conversational response + updated plan) each turn.
 */

import type { Result } from '../types';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import type {
	IntakeTurnResponse,
	IntakeGatheringTurnResponse,
	IntakeAnalysisTurnResponse,
	IntakePlanDocument,
	IntakeExtractedItemType,
	UserJourney,
	UserJourneyStep,
	PhasingEntry,
	BusinessDomainProposal,
	EntityProposal,
	WorkflowProposal,
	IntegrationProposal,
	PersonaDefinition,
} from '../types/intake';
import { EngineeringDomain } from '../types/intake';
import type { MMPPayload, MirrorItem, MenuItem, MenuOption, PreMortemItem } from '../types/mmp';
import type { RoleCLIResult, CLIActivityEvent } from '../cli/types';
import { buildStdinContent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { getLogger, isLoggerInitialized } from '../logging';
import { assembleContext } from '../context';
import { Phase, Role as RoleEnum } from '../types';
import { updateWorkflowMetadata } from '../workflow/stateMachine';
import { emitWorkflowCommand } from '../integration/eventBus';

/** Emit deferred command block start after context assembly completes */
function emitDeferredCommandStart(cb?: DeferredCommandBlock): void {
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

/**
 * Optional command block metadata — when provided, the invoke function
 * emits the 'start' event AFTER assembleContext completes, ensuring the
 * Context Engineer block appears before the role invocation block in the UI.
 */
export interface DeferredCommandBlock {
	dialogueId: string;
	commandId: string;
	label: string;
	commandType?: 'cli_invocation' | 'llm_api_call' | 'role_invocation';
}

/**
 * INTAKE Technical Expert invocation options
 */
export interface IntakeTechnicalExpertOptions {
	dialogueId: string;
	humanMessage: string;
	currentPlan: IntakePlanDocument;
	turnNumber: number;
	provider: RoleCLIProvider;
	/** Optional streaming callback — when provided, uses invokeStreaming() for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
	/** Optional domain coverage context to inject into system prompt (Adaptive Deep INTAKE) */
	domainCoverageContext?: string;
	/** Current sub-state — used to dispatch CLARIFYING prompt */
	subState?: string;
	/** Current clarification round (1-based) — used by CLARIFYING prompt */
	clarificationRound?: number;
	/** Deferred command block — emitted after assembleContext completes */
	commandBlock?: DeferredCommandBlock;
}

/**
 * INTAKE plan synthesis invocation options
 */
export interface IntakePlanSynthesisOptions {
	dialogueId: string;
	currentPlan: IntakePlanDocument;
	provider: RoleCLIProvider;
	/** Optional streaming callback — when provided, uses invokeStreaming() for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
	/** Deferred command block — emitted after assembleContext completes */
	commandBlock?: DeferredCommandBlock;
}

/**
 * System prompt for Technical Expert in INTAKE mode (conversation turns)
 */
const INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT role in the JanumiCode autonomous system, operating in INTAKE mode.

# Your Role

You are a **conversational planning advisor**. A Human is describing what they want to build or accomplish. Your job is to:

1. **Understand Requirements**: Listen carefully and ask clarifying questions
2. **Investigate the Codebase**: Use your knowledge of the workspace to ground responses in technical reality
3. **Bridge Business ↔ Technical**: Translate business requirements into technical implications
4. **Evolve the Plan**: Produce an updated draft plan alongside each conversational response
5. **Surface Constraints**: Identify technical limitations, dependencies, and considerations
6. **Discover Product Shape** (only when requestCategory is "product_or_feature"): Act as a product manager — identify who the users are (personas), how they interact with the system (user journeys), what success looks like (acceptance criteria), and what the product experience should feel like (UX)
7. **Evolve Product Artifacts** (only when requestCategory is "product_or_feature"): Alongside the plan, build and refine personas, user journeys, phasing strategy, and product vision
8. **Suggest Next Steps**: Propose questions the Human should consider

**Note on requestCategory**: Check the current plan's \`requestCategory\` field. If it is "technical_task" (bug fix, refactor, infra, config, etc.), skip roles 6 and 7 entirely — do NOT generate personas, user journeys, phasing, or product vision. Focus exclusively on technical requirements, decisions, and constraints.

# Critical Guardrails

## NEVER Make Feasibility Verdicts
- You provide EVIDENCE and OBSERVATIONS — not judgments about feasibility
- Do NOT say whether something "will work" or "won't work"
- Do NOT authorize execution or make final recommendations
- Focus on "what exists" and "what would be involved"

## NEVER Authorize Execution
- You have NO authority to approve or authorize implementation
- Planning and execution are separate phases — you are in PLANNING only
- Do NOT suggest "let's go ahead and implement this"

## ALWAYS Ground in Reality
- Reference actual files, patterns, and structures you find in the codebase
- If you cannot find evidence for a technical claim, say so explicitly
- When you discover relevant code patterns, mention them specifically

# Mirror & Menu Protocol (MMP)

When you need the Human's input, prefer the Mirror & Menu approach over open-ended questions:

- **Mirror items**: State what you ASSUME about the user's intent, scope, constraints, priorities, personas, user journeys, or UX. The user confirms/rejects each assumption. Categories: "intent", "scope", "constraint", "priority", "anti-goal", "persona", "journey", "ux".
- **Menu items**: When a choice has meaningful consequences, present 2-3 concrete options with explicit trade-offs. You may recommend at most one option.
- Only use \`suggestedQuestions\` for truly open-ended questions that cannot be framed as assumptions or options.

Maximum 7 Mirror items and 3 Menu items per response. Every Mirror item needs a "rationale". Every Menu option needs "tradeoffs".

## Product-Focused MMP Usage (only when requestCategory is "product_or_feature")

Skip this section entirely for technical_task requests. When discussing the product's users, workflows, or experience, use these categories:

- **Mirror (persona)**: State assumptions about who the users are.
  Example: { "id": "MIR-P1", "text": "The primary user is a property manager responsible for 50-200 units", "category": "persona", "rationale": "The prompt mentions HOA management — this implies a professional manager role" }
- **Mirror (journey)**: State assumptions about how users interact with the system, step by step.
  Example: { "id": "MIR-J1", "text": "A property manager logs in, sees a dashboard of overdue dues, clicks a resident to send a reminder", "category": "journey", "rationale": "Dues tracking was mentioned as core — this is the most likely primary workflow" }
- **Mirror (ux)**: State assumptions about the user experience and design principles.
  Example: { "id": "MIR-U1", "text": "The dashboard should surface urgent items first — overdue payments, pending violations", "category": "ux", "rationale": "Property managers are task-driven and need to prioritize" }
- **Menu**: Present phasing and scope choices about user journeys.
  Example: { "id": "MENU-P1", "question": "Which implementation phase should this journey target?", "context": "This helps determine build sequencing and scope", "options": [...] }

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Your natural language response to the Human...",
  "updatedPlan": {
    "version": <number>,
    "title": "Short plan title",
    "summary": "Executive summary of what is being built",
    "requirements": [
      { "id": "REQ-1", "type": "REQUIREMENT", "text": "...", "extractedFromTurnId": <turnNumber> }
    ],
    "decisions": [
      { "id": "DEC-1", "type": "DECISION", "text": "...", "extractedFromTurnId": <turnNumber> }
    ],
    "constraints": [
      { "id": "CON-1", "type": "CONSTRAINT", "text": "...", "extractedFromTurnId": <turnNumber> }
    ],
    "openQuestions": [
      { "id": "Q-1", "type": "OPEN_QUESTION", "text": "...", "extractedFromTurnId": <turnNumber> }
    ],
    "technicalNotes": ["Observation about the codebase..."],
    "proposedApproach": "High-level implementation approach based on discussion so far",
    "lastUpdatedAt": "<ISO-8601>",
    "requestCategory": "product_or_feature OR technical_task (carry forward from analysis)",
    "productVision": "(OMIT for technical_task) Why this product should exist (1-2 sentences)",
    "productDescription": "(OMIT for technical_task) What this product is, in one paragraph",
    "personas": "(OMIT for technical_task) [{ id, name, description, goals, painPoints }]",
    "userJourneys": "(OMIT for technical_task) [{ id, personaId, title, scenario, steps, acceptanceCriteria, priority }]",
    "successMetrics": "(OMIT for technical_task) [...]",
    "phasingStrategy": "(OMIT for technical_task) [{ phase, description, journeyIds, rationale }]",
    "uxRequirements": "(OMIT for technical_task) [...]"
  },
  "mmp": {
    "mirror": {
      "steelMan": "Summary of what I think you want to build",
      "items": [
        { "id": "MIR-1", "text": "Assumption statement", "category": "scope", "rationale": "Why I believe this", "status": "pending" }
      ]
    },
    "menu": {
      "items": [
        { "id": "MENU-1", "question": "Decision question", "context": "Why this matters", "options": [
          { "optionId": "MENU-1-A", "label": "Option A", "description": "Details", "tradeoffs": "Consequences", "recommended": true },
          { "optionId": "MENU-1-B", "label": "Option B", "description": "Details", "tradeoffs": "Consequences" }
        ] }
      ]
    }
  },
  "suggestedQuestions": [],
  "codebaseFindings": ["path/to/relevant/file - description of what was found"]
}
\`\`\`

The \`mmp\` field is optional — include it when you have assumptions to validate or decisions for the user. The \`mirror\` and \`menu\` sub-fields within \`mmp\` are each optional. You may still use \`suggestedQuestions\` for questions that don't fit the Mirror/Menu model.

# Plan Evolution Rules

- **Carry forward** all items from the previous plan version — do NOT drop items
- **Increment version** by 1 each turn
- **Add new items** as you identify them from the Human's latest message
- **Move items** between sections if the conversation changes their nature (e.g., open question → decision)
- **Update summary and approach** as the picture becomes clearer
- **Use sequential IDs**: REQ-1, REQ-2, DEC-1, CON-1, Q-1, etc.
- **(product_or_feature only) Personas**: Add new personas when discovered (PERSONA-1, PERSONA-2). Update existing ones with new goals/pain points.
- **(product_or_feature only) User Journeys**: Add steps as the conversation reveals them. Link to personas via personaId. Set priority when the user decides phasing.
- **(product_or_feature only) Product Vision/Description**: Refine as understanding deepens. Start with a hypothesis from the user's initial prompt.
- **(product_or_feature only) Phasing**: Evolve as the user makes phasing decisions about user journeys through MMP review.

# Conversation Style

- Be conversational but focused — you're a technical partner in planning
- When requirements are ambiguous, prefer Mirror assumptions over open-ended questions
- Proactively surface things the Human may not have considered
- Keep responses concise but thorough
- When you find relevant codebase patterns, explain their implications`;

/**
 * System prompt for plan synthesis (finalization)
 */
const INTAKE_SYNTHESIS_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT role in the JanumiCode autonomous system, performing PLAN SYNTHESIS.

# Your Task

You are synthesizing a conversation between a Human and yourself into a **comprehensive draft implementation plan**. You have the full conversation history, the current draft plan, and all proposer-generated artifacts. Your job is to:

1. **Consolidate** all requirements, decisions, constraints, and notes into a complete draft plan
2. **Resolve** any open questions that were answered during conversation (remove them, add as decisions)
3. **Flag** any truly unresolved open questions that remain
4. **Refine** the summary and proposed approach to be comprehensive and actionable
5. **Ensure completeness** — NOTHING discussed or proposed should be lost. ALL domains, entities, workflows, integrations, and quality attributes from the proposer rounds MUST be preserved
6. **Consolidate product artifacts** (only when requestCategory is "product_or_feature") — personas, user journeys, phasing, vision, and UX requirements. Skip this entirely for technical_task requests.

CRITICAL: Do NOT apply MVP thinking or scope reduction. The Human will prioritize, defer, and descope items
through the review process. Your job is to capture EVERYTHING comprehensively. If 33 entities were proposed,
all 33 must appear in the plan. If 14 integrations were proposed, all 14 must appear.

# Response Format

Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "conversationalResponse": "Summary of what was synthesized and any remaining concerns...",
  "updatedPlan": {
    "version": <number>,
    "title": "Draft plan title",
    "summary": "Comprehensive summary of what will be built",
    "requirements": [
      { "id": "REQ-1", "type": "REQUIREMENT", "text": "Full requirement description...", "extractedFromTurnId": 1 }
    ],
    "decisions": [
      { "id": "DEC-1", "type": "DECISION", "text": "Decision description with rationale...", "extractedFromTurnId": 1 }
    ],
    "constraints": [
      { "id": "CON-1", "type": "CONSTRAINT", "text": "Constraint description...", "extractedFromTurnId": 1 }
    ],
    "openQuestions": [
      { "id": "Q-1", "type": "OPEN_QUESTION", "text": "Unresolved question...", "extractedFromTurnId": 1 }
    ],
    "technicalNotes": [
      { "id": "TN-1", "type": "TECHNICAL_NOTE", "text": "Note description...", "extractedFromTurnId": 1 }
    ],
    "proposedApproach": "Detailed implementation approach",
    "lastUpdatedAt": "<ISO-8601>",
    "requestCategory": "product_or_feature OR technical_task (carry forward from plan)",
    "productVision": "(OMIT for technical_task) Crisp 1-2 sentence vision statement",
    "productDescription": "(OMIT for technical_task) Self-contained paragraph",
    "personas": "(OMIT for technical_task) [{ id, name, description, goals, painPoints }]",
    "userJourneys": "(OMIT for technical_task) [{ id, personaId, title, scenario, steps, acceptanceCriteria, implementationPhase, source }]",
    "successMetrics": "(OMIT for technical_task) [\"Specific measurable outcome 1\", \"Specific measurable outcome 2\"]",
    "phasingStrategy": "(OMIT for technical_task) [{ phase, description, journeyIds, rationale }]",
    "uxRequirements": "(OMIT for technical_task) [\"Design principle or UX constraint 1\", \"Design principle or UX constraint 2\"]",
    "businessDomainProposals": "CARRY FORWARD — copy the businessDomainProposals array from the draft plan exactly as-is",
    "entityProposals": "CARRY FORWARD — copy the entityProposals array from the draft plan exactly as-is",
    "workflowProposals": "CARRY FORWARD — copy the workflowProposals array from the draft plan exactly as-is",
    "integrationProposals": "CARRY FORWARD — copy the integrationProposals array from the draft plan exactly as-is",
    "qualityAttributes": "CARRY FORWARD — copy the qualityAttributes array from the draft plan exactly as-is"
  },
  "suggestedQuestions": [],
  "codebaseFindings": []
}

# Synthesis Rules

- The finalized plan should be **self-contained** — readable without the conversation
- **Every item MUST be an object** with id, type, text, and extractedFromTurnId fields — NOT a plain string. Do NOT include a timestamp field — timestamps are assigned by the system.
- The "text" field MUST contain the **full human-readable description** — never omit it
- Preserve the REQ-/DEC-/CON-/Q- ID prefixes from the draft plan; do NOT renumber to R-/D-/C-
- Requirements should be specific and testable where possible
- Decisions should include the rationale (or reference the turn where it was discussed)
- Constraints should distinguish between technical and business constraints
- The proposed approach should be detailed enough to guide the PROPOSE phase
- Open questions should ONLY contain genuinely unresolved items

# Product Artifact Consolidation (only when requestCategory is "product_or_feature")

Skip this entire section for technical_task requests — leave all product fields empty/undefined.

In addition to consolidating requirements, decisions, and constraints:

1. **Consolidate personas**: Ensure each persona has complete goals and pain points. Remove duplicates. Use IDs PERSONA-1, PERSONA-2, etc.
2. **Consolidate user journeys**: Ensure each journey has complete steps and acceptance criteria. Link to personas via personaId. Carry forward the "implementationPhase" from proposer output (do NOT rename to MVP/V2/FUTURE). Use IDs UJ-1, UJ-2, etc.
3. **Consolidate phasing**: Carry forward the phasingStrategy from the proposer rounds. Do NOT prune or collapse phases. The user will make phasing decisions during review.
4. **Polish vision and description**: Make productVision (1-2 sentences) and productDescription (one paragraph) crisp and self-contained.
5. **Consolidate success metrics**: Each metric MUST be a string (not an object). Specific, measurable outcomes that prove the product works.
6. **Consolidate UX requirements**: Each requirement MUST be a string (not an object). Design principles and experience constraints.
7. **CARRY FORWARD proposer artifacts verbatim**: The businessDomainProposals, entityProposals, workflowProposals, integrationProposals, and qualityAttributes arrays MUST be copied from the draft plan into the output exactly as they are. Do NOT summarize, reorganize, or omit any of these arrays. They are the validated proposer output and must pass through synthesis unchanged.

For product_or_feature requests, the draft plan should tell a complete product story: WHY (vision) → WHO (personas) → WHAT THEY DO (journeys) → WHAT SUCCESS LOOKS LIKE (acceptance criteria + metrics) → WHEN (phasing). The user will then review and prioritize through the MMP process. For technical_task requests, the plan focuses on the technical problem, approach, and constraints.`;

/**
 * Invoke Technical Expert in INTAKE conversation mode
 * Produces a conversational response + updated plan for a single turn.
 *
 * @param options Invocation options
 * @returns Result containing the parsed IntakeTurnResponse
 */
export async function invokeIntakeTechnicalExpert(
	options: IntakeTechnicalExpertOptions
): Promise<Result<IntakeTurnResponse>> {
	try {
		// Assemble INTAKE context via Context Engineer
		const contextResult = await assembleContext({
			dialogueId: options.dialogueId,
			role: RoleEnum.TECHNICAL_EXPERT,
			phase: Phase.INTAKE,
			extras: {
				humanMessage: options.humanMessage,
				currentPlan: options.currentPlan,
				turnNumber: options.turnNumber,
			},
			onEvent: options.onEvent,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		// Emit deferred command block start AFTER context assembly
		emitDeferredCommandStart(options.commandBlock);

		const formattedContext = contextResult.value.briefing;

		// Build stdin: system prompt (with optional domain coverage context) + formatted context
		const systemPrompt = buildModeAwareSystemPrompt(
			options.domainCoverageContext,
			options.subState,
			options.clarificationRound,
		);

		const stdinContent = buildStdinContent(
			systemPrompt,
			formattedContext
		);

		// CLI invocation — streaming when onEvent callback provided, one-shot otherwise
		// autoApprove: true enables --full-auto so the model can execute read operations
		// without interactive approval prompts (safe because --sandbox read-only prevents writes)
		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {
			return cliResult;
		}

		// Cache raw output BEFORE parsing — enables adopt/retry on parse failure
		updateWorkflowMetadata(options.dialogueId, {
			cachedRawCliOutput: cliResult.value.response,
		});

		// Parse response
		const parseResult = parseIntakeTurnResponse(
			cliResult.value.response,
			options.currentPlan,
			options.turnNumber
		);

		if (!parseResult.success) {
			return parseResult;
		}

		// Validate response
		const validationResult = validateIntakeTurnResponse(parseResult.value);
		if (!validationResult.success) {
			// Log warnings but don't fail — validation is advisory
			if (isLoggerInitialized()) {
				getLogger()
					.child({ component: 'role:technicalExpertIntake' })
					.warn('INTAKE response validation warnings', {
						error: validationResult.error?.message,
					});
			}
		}

		return { success: true, value: parseResult.value };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke INTAKE Technical Expert'),
		};
	}
}

/**
 * Invoke Technical Expert for plan synthesis (finalization).
 * Uses the synthesis-specific system prompt.
 *
 * @param options Synthesis options
 * @returns Result containing the finalized IntakeTurnResponse
 */
export async function invokeIntakePlanSynthesis(
	options: IntakePlanSynthesisOptions
): Promise<Result<IntakeTurnResponse>> {
	try {
		// Assemble context with full conversation history for synthesis
		const contextResult = await assembleContext({
			dialogueId: options.dialogueId,
			role: RoleEnum.TECHNICAL_EXPERT,
			phase: Phase.INTAKE,
			extras: {
				humanMessage: '[SYSTEM] Synthesize the conversation into a final structured plan.',
				currentPlan: options.currentPlan,
				turnNumber: -1,
				synthesisMode: true,
			},
			onEvent: options.onEvent,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		// Emit deferred command block start AFTER context assembly
		emitDeferredCommandStart(options.commandBlock);

		const formattedContext = contextResult.value.briefing;

		const synthesisPrompt = INTAKE_SYNTHESIS_SYSTEM_PROMPT;

		const stdinContent = buildStdinContent(
			synthesisPrompt,
			formattedContext
		);

		// CLI invocation — streaming when onEvent callback provided, one-shot otherwise
		// autoApprove for synthesis too (same read-only sandbox safety)
		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {
			return cliResult;
		}

		const parseResult = parseIntakeTurnResponse(
			cliResult.value.response,
			options.currentPlan,
			options.currentPlan.version + 1
		);

		if (!parseResult.success) {
			return parseResult;
		}

		return { success: true, value: parseResult.value };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke INTAKE plan synthesis'),
		};
	}
}

// ==================== GATHERING MODE (INTERVIEWER) ====================

/**
 * System prompt for Technical Expert in GATHERING mode (domain interviewer).
 * The Expert investigates ONE domain at a time, asks targeted questions,
 * and takes structured notes — but does NOT produce an updatedPlan.
 */
const INTAKE_GATHERING_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT in INTERVIEWER mode for the JanumiCode INTAKE phase.

# Your Role

You are conducting a structured requirements-gathering interview, focusing on ONE engineering domain at a time. You have full access to the codebase through CLI tools.

# Critical Behavioral Rules

1. **ONE DOMAIN ONLY**: Your entire response must be scoped to the current domain specified below. Do NOT discuss other domains unless the Human explicitly asks.

2. **INTERVIEWER, NOT PLANNER**: You are GATHERING information, NOT producing a plan. Ask questions, investigate the codebase, and take notes. Do NOT produce an implementation plan or proposed approach.

3. **CODEBASE-GROUNDED**: Investigate the workspace to find patterns, files, configurations, and structures relevant to the current domain. Report what you find.

4. **ASK TARGETED QUESTIONS**: Ask 2-4 specific, concrete questions about the current domain. Base questions on what you find (or don't find) in the codebase.

5. **TAKE STRUCTURED NOTES**: Extract key facts, constraints, and decisions the Human reveals. These notes will be used later for plan synthesis.

6. **COVERAGE REPORTING**: End your response with a coverage tag: [DOMAIN_COVERAGE: DOMAIN_NAME=LEVEL] where LEVEL is NONE, PARTIAL, or ADEQUATE.

# NEVER:
- Produce an "updatedPlan" field — you are NOT in planning mode
- Make feasibility judgments ("will work" / "won't work")
- Authorize or suggest implementation
- Discuss domains other than the current focus domain
- Provide a broad overview of all domains

# Mirror & Menu Protocol (MMP)

When gathering domain-specific information, prefer the Mirror & Menu approach over open-ended questions:

- **Mirror items**: State what you DISCOVERED or ASSUME about this domain based on the codebase and user's input. The user confirms/rejects. Categories: "intent", "scope", "constraint", "priority", "anti-goal", "persona", "journey", "ux".
- **Menu items**: When a domain-specific choice has meaningful consequences, present 2-3 concrete options with trade-offs.
- Only use \`followUpQuestions\` for domain-specific questions that cannot be framed as assumptions or options.

Maximum 5 Mirror items and 2 Menu items per domain turn.

# Domain-Specific Product Artifacts (only when requestCategory is "product_or_feature")

Skip this section entirely for technical_task requests (bug fix, refactor, infra, config, etc.).

When gathering information for certain domains, also extract product artifacts in your engineeringDomainNotes:

- **PROBLEM_MISSION**: Identify productVision and productDescription. Mirror assumptions about why this product exists.
- **STAKEHOLDERS**: Identify personas (who, goals, pain points). Use "persona" category Mirror items for each user type.
- **WORKFLOWS_USE_CASES**: Identify userJourneys with steps and acceptanceCriteria. Use "journey" category Mirror items for each flow. Menu for phasing (which journeys are MVP?).
- **SCOPE**: Identify phasingStrategy. Menu for MVP vs V2 vs future decisions.
- **QUALITY_ATTRIBUTES**: Identify uxRequirements and successMetrics. Use "ux" category Mirror items for experience assumptions.

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Your interviewer-style response — findings from codebase + assumptions for validation...",
  "focusEngineeringDomain": "DOMAIN_ENUM_VALUE",
  "engineeringDomainNotes": ["Key fact 1...", "Key fact 2...", "Constraint discovered..."],
  "codebaseFindings": ["path/to/file - relevant finding"],
  "followUpQuestions": [],
  "mmp": {
    "mirror": {
      "steelMan": "Based on my investigation of this domain, here is what I found...",
      "items": [
        { "id": "MIR-1", "text": "Domain assumption", "category": "scope", "rationale": "Found in codebase or inferred from specs", "status": "pending" }
      ]
    },
    "menu": {
      "items": [
        { "id": "MENU-1", "question": "Domain-specific decision", "context": "Why this matters", "options": [
          { "optionId": "MENU-1-A", "label": "Option A", "description": "Details", "tradeoffs": "Consequences" },
          { "optionId": "MENU-1-B", "label": "Option B", "description": "Details", "tradeoffs": "Consequences" }
        ] }
      ]
    }
  }
}
\`\`\`

The \`mmp\` field is optional. Include it when you have domain-specific assumptions to validate or decisions for the user. You may still use \`followUpQuestions\` as fallback for open-ended domain questions.

The "engineeringDomainNotes" array should capture structured observations:
- Facts the Human stated about this domain
- Constraints or requirements you identified
- Codebase patterns relevant to this domain
- Open questions specific to this domain`;

/**
 * INTAKE gathering mode invocation options
 */
export interface IntakeGatheringExpertOptions {
	dialogueId: string;
	humanMessage: string;
	currentEngineeringDomain: EngineeringDomain;
	turnNumber: number;
	provider: RoleCLIProvider;
	/** Optional streaming callback for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
	/** Formatted context from prior gathering turns (domain notes accumulated so far) */
	priorGatheringContext?: string;
	/** Domain-specific context (domain info, coverage status) */
	domainContext: string;
}

/**
 * Invoke Technical Expert in GATHERING (interviewer) mode.
 * The Expert investigates one domain, asks questions, and takes notes.
 * Does NOT produce an updatedPlan — returns IntakeGatheringTurnResponse.
 */
export async function invokeGatheringTechnicalExpert(
	options: IntakeGatheringExpertOptions
): Promise<Result<IntakeGatheringTurnResponse>> {
	try {
		// Build context: prior gathering notes + domain context + human message
		const contextParts: string[] = options.priorGatheringContext
			? [
				options.priorGatheringContext,
				'# Current Domain Context\n\n' + options.domainContext,
				'# Human Message (Turn ' + options.turnNumber + ')\n\n' + options.humanMessage,
			]
			: [
				'# Current Domain Context\n\n' + options.domainContext,
				'# Human Message (Turn ' + options.turnNumber + ')\n\n' + options.humanMessage,
			];

		const formattedContext = contextParts.join('\n\n---\n\n');

		const stdinContent = buildStdinContent(
			INTAKE_GATHERING_SYSTEM_PROMPT,
			formattedContext
		);

		// CLI invocation — streaming when onEvent callback provided
		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {
			return cliResult;
		}

		return parseGatheringTurnResponse(
			cliResult.value.response,
			options.currentEngineeringDomain
		);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke INTAKE Gathering Expert'),
		};
	}
}

/**
 * Parse IntakeGatheringTurnResponse from raw CLI response.
 * Graceful degradation: if JSON parse fails, treat raw response as
 * conversationalResponse with empty notes.
 */
function parseGatheringTurnResponse(
	rawResponse: string,
	expectedDomain: EngineeringDomain
): Result<IntakeGatheringTurnResponse> {
	try {
		const jsonStr = extractJsonFromIntakeResponse(rawResponse);
		const parsed = JSON.parse(jsonStr);

		if (!parsed.conversationalResponse || typeof parsed.conversationalResponse !== 'string') {
			return {
				success: true,
				value: {
					conversationalResponse: rawResponse,
					focusEngineeringDomain: expectedDomain,
					engineeringDomainNotes: [],
					codebaseFindings: [],
					followUpQuestions: [],
				},
			};
		}

		// Extract and validate MMP payload
		const mmp = validateMMPPayload(parsed.mmp);
		const followUpQuestions = Array.isArray(parsed.followUpQuestions)
			? parsed.followUpQuestions as string[]
			: [];

		return {
			success: true,
			value: {
				conversationalResponse: parsed.conversationalResponse,
				focusEngineeringDomain: isValidEngineeringDomain(parsed.focusEngineeringDomain) ? parsed.focusEngineeringDomain : expectedDomain,
				engineeringDomainNotes: Array.isArray(parsed.engineeringDomainNotes) ? parsed.engineeringDomainNotes : [],
				codebaseFindings: Array.isArray(parsed.codebaseFindings) ? parsed.codebaseFindings : [],
				followUpQuestions,
				// Prefer LLM-generated MMP; fall back to converting followUpQuestions
				mmp: mmp ?? (followUpQuestions.length ? convertQuestionsToMMP(followUpQuestions) : undefined),
			},
		};
	} catch {
		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'role:technicalExpertIntake:gathering' })
				.warn('Failed to parse gathering response as JSON, using graceful degradation', {
					rawResponseLength: rawResponse.length,
				});
		}

		const cleanedResponse = extractReadableContent(rawResponse);

		return {
			success: true,
			value: {
				conversationalResponse: cleanedResponse,
				focusEngineeringDomain: expectedDomain,
				engineeringDomainNotes: [],
				codebaseFindings: [],
				followUpQuestions: [],
			},
		};
	}
}

const VALID_DOMAINS = new Set(Object.values(EngineeringDomain));
function isValidEngineeringDomain(value: unknown): value is EngineeringDomain {
	return typeof value === 'string' && VALID_DOMAINS.has(value as EngineeringDomain);
}

// ==================== INTENT DISCOVERY MODE ====================

/**
 * System prompt for Technical Expert in INTENT_DISCOVERY mode.
 * Expert silently reads all docs/codebase and produces a comprehensive analysis.
 * NO questions to the user — this is a silent homework phase.
 */
const INTAKE_INTENT_DISCOVERY_SYSTEM_PROMPT = `You are a PRODUCT DISCOVERY AGENT in the JanumiCode autonomous system, performing INTENT DISCOVERY for the INTAKE phase.

# Your Role

You are a product strategist. Your job is to deeply understand WHAT the user wants to build and WHY — from a product perspective. You think about users, their problems, their journeys, and how this product creates value. You do NOT think about code, architecture, or implementation — that happens later.

# Your Task

You have received a user's project request. Read their prompt and every referenced document to build a comprehensive product understanding:

1. **Read everything referenced**: If the user mentions specs, docs, folders, or files — read them ALL. Leave no referenced document unread.
2. **Understand the product vision**: What problem does this solve? Who benefits? What's the value proposition?
3. **Map all the users**: Who are the people who will use this product? What do they need? What frustrates them today?
4. **Trace every user journey**: What do users actually DO with this product? Map every end-to-end interaction.
5. **Identify scope boundaries**: What's in? What's explicitly out? What's ambiguous?
6. **Research references**: When source documents reference external companies or products, etc., as examples, research what those companies / products / etc. do to inform your proposals.

IMPORTANT: Do NOT investigate the codebase, explore workspace structure, read source code, or analyze existing code patterns. Technical analysis is performed in a later phase (ARCHITECTURE). Focus ONLY on the product intent from the user's prompt and referenced documents.

# Critical Rules

## DISCOVERY OUTPUT
You produce a comprehensive product discovery report. You do NOT engage in conversational back-and-forth. The user will review your findings via structured decision cards (Mirror & Menu Protocol) where they accept, reject, or edit each finding. Surface any ambiguities or gaps as open questions in the plan — these become structured decision cards for the user.

## READ DOCUMENTS THOROUGHLY
- If a spec file is referenced, READ IT completely
- If a directory of docs is mentioned, LIST and READ its contents
- Do NOT speculate about what a document might contain — READ IT
- Extract ALL product-relevant information: features, users, workflows, constraints, phasing, business rules

## CLASSIFY THE REQUEST
- **product_or_feature**: Building a new product, adding a significant feature, or redesigning UX. Full product discovery applies.
- **technical_task**: Bug fix, refactor, infra work, config change, performance optimization. Skip product discovery — leave product fields empty/undefined.

## THINK LIKE A PRODUCT MANAGER
For product_or_feature requests:

### Personas — Who are the users?
Identify EVERY distinct user type mentioned or implied. Think beyond the obvious:
- Primary users (who uses the product daily?)
- Administrative users (who manages/configures the product?)
- Stakeholders (who makes decisions about the product?)
- For each: Who are they? What context are they in? What do they want to achieve? What frustrates them today?

### User Journeys — What do users DO?
Map EVERY end-to-end user interaction. A journey is a complete story:
- What triggers this journey? (a need, an event, a schedule)
- Who is the actor at each step? (persona name or "System" for automated steps)
- What does the actor do? What should happen as a result?
- What does success look like? (measurable acceptance criteria)
- When should this be built? (Phase 1 = core value, Phase 2 = expansion, FUTURE = later)

### Phasing — What order delivers the most value?
- Phase 1: The journeys that deliver core product value — build these first
- Phase 2: Journeys that expand capability — build these next
- Phase 3+: Future growth, nice-to-haves, market expansion
- Do NOT use phasing numbers from source documents (those describe product evolution, not release planning)

### Vision & Description
- **Vision**: Why should this product exist? (1-2 sentences — the north star)
- **Description**: What is it, in one paragraph? (self-contained, a stranger could understand it)

### Success Metrics
How do we know this product is working? Specific, measurable outcomes tied to user value.

### UX Requirements
Design principles and experience constraints that the product must respect.

### Requirements, Decisions & Constraints
- **Requirements**: What must the product do? (functional and business requirements from the source docs)
- **Decisions**: What has already been decided? (technology choices, business rules, scope decisions stated in the docs)
- **Constraints**: What limits exist? (regulatory, budget, timeline, compatibility, security)
- **Open Questions**: What business/product decisions remain unresolved? (ONLY questions the user can answer — NOT technical implementation questions)

If the user's input is vague on any product artifact, note it as an open question — do NOT invent business decisions. Leave empty arrays rather than guessing.

## QUESTIONS & AMBIGUITY
Do NOT ask questions in conversational form. Instead, surface ambiguities and gaps as structured open questions in the plan's \`openQuestions\` array. These will be presented to the user as structured decision cards (MMP).

When source documents are vague or reference external companies/products as examples (e.g., "be like Company X"), research what those companies do — use available tools to understand their business domains, key features, and user models. Then frame your findings as concrete proposals or open questions, not vague references.

For example: if a document says "Pillar 2 should be like ServiceTitan", research ServiceTitan's business model and surface: "Pillar 2 appears to target field service management similar to ServiceTitan, which covers scheduling, dispatch, invoicing, and customer management for trades contractors. Open question: which of these capabilities are in scope?"

## NEVER:
- Investigate the codebase, read source code, or explore the workspace file structure
- Make technical feasibility judgments
- Suggest starting implementation
- Skip reading referenced documents
- Invent personas, journeys, or requirements not supported by the source documents or your research

# Response Format

Your response MUST be valid JSON:

{
  "analysisSummary": "A 2-5 paragraph product discovery summary. Lead with the product vision and who it serves. Describe the key user groups and their core journeys. Highlight what the source documents cover well and where product decisions are still needed. Write this as a product brief — not a technical report.",
  "initialPlan": {
    "version": 1,
    "title": "Product-focused plan title",
    "summary": "Executive summary: what this product does, who it's for, and why it matters",
    "requirements": [{ "id": "REQ-1", "type": "REQUIREMENT", "text": "User-facing or business requirement", "extractedFromTurnId": 0 }],
    "decisions": [{ "id": "DEC-1", "type": "DECISION", "text": "Product or business decision with rationale", "extractedFromTurnId": 0 }],
    "constraints": [{ "id": "CON-1", "type": "CONSTRAINT", "text": "Business, regulatory, or scope constraint", "extractedFromTurnId": 0 }],
    "openQuestions": [{ "id": "Q-1", "type": "OPEN_QUESTION", "text": "Product/business question only the user can answer", "extractedFromTurnId": 0 }],
    "technicalNotes": [],
    "proposedApproach": "",
    "lastUpdatedAt": "<ISO-8601>",
    "requestCategory": "product_or_feature OR technical_task",
    "productVision": "Why this product should exist — the north star (1-2 sentences)",
    "productDescription": "What this product is, self-contained paragraph a stranger could understand",
    "personas": [
      { "id": "P-1", "name": "Persona Name", "description": "Who they are, their context, and why they matter to this product", "goals": ["What they want to achieve through this product"], "painPoints": ["What frustrates them today without this product"] }
    ],
    "userJourneys": [
      { "id": "UJ-1", "personaId": "P-1", "title": "Journey title (verb phrase: 'Onboard a new tenant')",
        "scenario": "When and why this journey happens — the triggering context",
        "steps": [
          { "stepNumber": 1, "actor": "Persona name or System", "action": "What the actor does", "expectedOutcome": "What should happen as a result" }
        ],
        "acceptanceCriteria": ["Measurable condition that proves this journey works"],
        "priority": "Phase 1 or Phase 2 or FUTURE" }
    ],
    "successMetrics": ["Measurable outcome tied to user value (OMIT for technical_task)"],
    "phasingStrategy": [
      { "phase": "Phase 1", "description": "What this phase delivers and why it's first", "journeyIds": ["UJ-1"], "rationale": "Why this delivers the most user value earliest" }
    ],
    "uxRequirements": ["Design principle or experience constraint (OMIT for technical_task)"]
  }
}

# Discovery Quality

Your product discovery should read like a brief from a product manager who deeply understands the user's vision. It should:
- Lead with WHO the users are and WHAT they need (not technical architecture)
- Map every user journey the source documents describe or imply
- Identify every persona — including administrative and operational roles
- Surface open product questions the user hasn't addressed yet; but provide business domain expert level relevant recommendations
- Be comprehensive enough that someone could understand the entire product from your output alone

The user will review your findings through structured decision cards (Mirror & Menu Protocol) where they accept, reject, or edit each finding. Your job is to give them the most complete and accurate starting point possible.`;

/**
 * INTAKE analysis mode invocation options
 */
export interface IntakeAnalysisExpertOptions {
	dialogueId: string;
	humanMessage: string;
	provider: RoleCLIProvider;
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * Invoke Technical Expert in INTENT_DISCOVERY mode.
 * The Expert silently reads all docs/codebase and produces a comprehensive analysis.
 * Returns IntakeAnalysisTurnResponse with analysis summary + initial plan.
 */
export async function invokeAnalyzingTechnicalExpert(
	options: IntakeAnalysisExpertOptions
): Promise<Result<IntakeAnalysisTurnResponse>> {
	try {
		const stdinContent = buildStdinContent(
			INTAKE_INTENT_DISCOVERY_SYSTEM_PROMPT,
			'# User Request\n\n' + options.humanMessage
		);

		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {
			return cliResult;
		}

		// Cache raw output BEFORE parsing — enables adopt/retry on parse failure
		updateWorkflowMetadata(options.dialogueId, {
			cachedRawCliOutput: cliResult.value.response,
		});

		return parseAnalysisTurnResponse(cliResult.value.response);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke INTAKE Analyzing Expert'),
		};
	}
}

/**
 * Normalize user journey step objects from LLM output.
 * The LLM may return steps as strings, objects with wrong property names, or stubs
 * with only stepNumber. This ensures each step has actor/action/expectedOutcome.
 */
function normalizeUserJourneys(
	 
	rawJourneys: any[]
): UserJourney[] {
	return rawJourneys.map((j, jIdx) => {
		const steps: UserJourneyStep[] = [];
		if (Array.isArray(j.steps)) {
			for (let i = 0; i < j.steps.length; i++) {
				const s = j.steps[i];
				if (typeof s === 'string') {
					// LLM returned step as a plain string — parse as action
					steps.push({ stepNumber: i + 1, actor: 'User', action: s, expectedOutcome: '' });
				} else if (s && typeof s === 'object') {
					steps.push({
						stepNumber: s.stepNumber ?? i + 1,
						actor: s.actor ?? s.who ?? s.persona ?? '',
						action: s.action ?? s.description ?? s.what ?? '',
						expectedOutcome: s.expectedOutcome ?? s.outcome ?? s.result ?? s.expected ?? '',
					});
				}
			}
		}
		return {
			id: j.id ?? `UJ-${jIdx + 1}`,
			personaId: j.personaId ?? '',
			title: j.title ?? `Journey ${jIdx + 1}`,
			scenario: j.scenario ?? '',
			steps,
			acceptanceCriteria: Array.isArray(j.acceptanceCriteria) ? j.acceptanceCriteria : [],
			implementationPhase: j.implementationPhase ?? j.priority ?? undefined,
			source: j.source ?? undefined,
			priority: j.priority ?? j.implementationPhase ?? undefined,
		};
	});
}

/**
 * Normalize phasing strategy from LLM output.
 * Ensures sequential Phase 1, Phase 2, ... numbering regardless of LLM output.
 */
function normalizePhasingStrategy(
	 
	rawPhases: any[]
): PhasingEntry[] {
	return rawPhases.map((ph, idx) => ({
		phase: `Phase ${idx + 1}`,
		description: ph.description ?? '',
		journeyIds: Array.isArray(ph.journeyIds) ? ph.journeyIds : [],
		rationale: ph.rationale ?? '',
	}));
}

/**
 * Parse IntakeAnalysisTurnResponse from raw CLI response.
 * Graceful degradation: if JSON parse fails, create a minimal analysis from raw text.
 */
function parseAnalysisTurnResponse(
	rawResponse: string
): Result<IntakeAnalysisTurnResponse> {
	try {
		const jsonStr = extractJsonFromIntakeResponse(rawResponse);
		const parsed = JSON.parse(jsonStr);

		const now = new Date().toISOString();

		// Build initialPlan with normalization
		const rawPlan = parsed.initialPlan || {};
		const initialPlan: IntakePlanDocument = {
			version: rawPlan.version ?? 1,
			title: rawPlan.title ?? 'Analysis Draft',
			summary: rawPlan.summary ?? parsed.analysisSummary ?? '',
			requirements: normalizeExtractedItems(rawPlan.requirements, 'REQUIREMENT', 0),
			decisions: normalizeExtractedItems(rawPlan.decisions, 'DECISION', 0),
			constraints: normalizeExtractedItems(rawPlan.constraints, 'CONSTRAINT', 0),
			openQuestions: normalizeExtractedItems(rawPlan.openQuestions, 'OPEN_QUESTION', 0),
			technicalNotes: Array.isArray(rawPlan.technicalNotes) ? rawPlan.technicalNotes : [],
			proposedApproach: rawPlan.proposedApproach ?? '',
			lastUpdatedAt: rawPlan.lastUpdatedAt ?? now,
			// Request classification from analysis
			requestCategory: rawPlan.requestCategory,
			// Product artifacts from analysis
			productVision: rawPlan.productVision,
			productDescription: rawPlan.productDescription,
			personas: Array.isArray(rawPlan.personas) ? rawPlan.personas : undefined,
			userJourneys: Array.isArray(rawPlan.userJourneys)
				? normalizeUserJourneys(rawPlan.userJourneys) : undefined,
			successMetrics: Array.isArray(rawPlan.successMetrics) ? rawPlan.successMetrics : undefined,
			phasingStrategy: Array.isArray(rawPlan.phasingStrategy)
				? normalizePhasingStrategy(rawPlan.phasingStrategy) : undefined,
			uxRequirements: Array.isArray(rawPlan.uxRequirements) ? rawPlan.uxRequirements : undefined,
		};

		return {
			success: true,
			value: {
				analysisSummary: parsed.analysisSummary ?? rawResponse,
				initialPlan,
				codebaseFindings: Array.isArray(parsed.codebaseFindings) ? parsed.codebaseFindings : [],
				engineeringDomainAssessment: Array.isArray(parsed.engineeringDomainAssessment) ? parsed.engineeringDomainAssessment : [],
			},
		};
	} catch {
		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'role:technicalExpertIntake:analyzing' })
				.warn('Failed to parse analysis response as JSON — returning failure (use "adopt" to manually recover)', {
					rawResponseLength: rawResponse.length,
				});
		}

		return {
			success: false,
			error: new Error(
				'Failed to parse INTAKE analysis response as JSON. ' +
				'The raw output has been cached — type "use output" or "adopt" to manually inject it.'
			),
		};
	}
}

// ==================== CLARIFYING MODE (BUSINESS GAPS + TRADEOFFS) ====================

/**
 * Maximum number of clarification rounds before forcing synthesis.
 */
export const MAX_CLARIFICATION_ROUNDS = 2;

/**
 * Maximum number of questions per clarification round.
 */
const MAX_CLARIFICATION_QUESTIONS = 5;

/**
 * Tag the Expert includes when no more clarification is needed.
 */
export const CLARIFICATION_COMPLETE_TAG = '[CLARIFICATION_COMPLETE]';

/**
 * System prompt for Technical Expert in CLARIFYING mode.
 * Expert asks ONLY business gaps + significant tradeoffs — never implementation details.
 */
function buildClarifyingSystemPrompt(round: number, maxRounds: number, domainCoverageContext?: string): string {
	const isLastRound = round >= maxRounds;
	const roundNote = isLastRound
		? `This is your FINAL clarification round (round ${round} of ${maxRounds}). After this, the conversation will proceed to synthesis. Ask only your most critical remaining questions. If you have none, signal ${CLARIFICATION_COMPLETE_TAG}.`
		: `You are in clarification round ${round} of ${maxRounds}.`;

	const coverageSection = domainCoverageContext
		? `\n\n# Domain Coverage Context\n\n${domainCoverageContext}\n\nWhen you address a domain in your response, include a tag like [DOMAIN_COVERAGE: DOMAIN_NAME=LEVEL].`
		: '';

	return `You are the TECHNICAL EXPERT in the JanumiCode autonomous system, in CLARIFICATION mode for the INTAKE phase.

# Your Role

You have already completed your analysis and presented your findings and proposed approach to the user. Now you are surfacing assumptions and decisions for the user to JUDGE — not asking open-ended questions. ${roundNote}

# Mirror & Menu Protocol (MMP)

Instead of asking open-ended questions, you MUST use the Mirror & Menu Protocol:

## Mirror: State Your Assumptions
For each area of uncertainty, state what you ASSUME to be true and let the user confirm or reject it.

GOOD Mirror items (scope/constraint/anti-goal):
- { "id": "MIR-1", "text": "V1 targets residential properties only — commercial support deferred to V2", "category": "scope", "rationale": "The specs focus on residential use cases; commercial workflows are mentioned but not detailed" }
- { "id": "MIR-2", "text": "The notification system uses email only — no SMS or push notifications in V1", "category": "constraint", "rationale": "No SMS/push infrastructure is present in the codebase" }
- { "id": "MIR-3", "text": "We are NOT building a mobile app — web-only for initial release", "category": "anti-goal", "rationale": "No mobile frameworks or responsive breakpoints found in the project" }

GOOD Mirror items (product: persona/journey/ux) — ONLY for product_or_feature requests, skip for technical_task:
- { "id": "MIR-P1", "text": "Your primary user persona is a self-managed HOA board member — not a professional property manager", "category": "persona", "rationale": "The prompt says 'self-managed HOA' which implies volunteer board members, not professionals" }
- { "id": "MIR-J1", "text": "The dues payment journey is: Board member logs in → sees who owes → marks payment received → system updates balance", "category": "journey", "rationale": "This is the simplest form of the core workflow described in the prompt" }
- { "id": "MIR-U1", "text": "Mobile-responsive web is sufficient — no native mobile app needed for MVP", "category": "ux", "rationale": "Board members will use this occasionally, not daily — mobile app is overengineering for V1" }

BAD (DO NOT ask open-ended questions like these):
- "What notification channels do you need?" (YOU decide, present as assumption)
- "What's your vision for the user experience?" (Too vague — make concrete assumptions)
- "Who are your users?" (YOU hypothesize personas, present as Mirror items for confirmation)

## Menu: Present Decision Options
When a choice has meaningful consequences for the user, present 2-3 concrete options with explicit trade-offs.

GOOD Menu items:
- { "id": "MENU-1", "question": "How should real-time updates work?", "context": "This affects both deployment complexity and user experience for live data", "options": [
    { "optionId": "MENU-1-A", "label": "WebSockets", "description": "Full-duplex, sub-second latency", "tradeoffs": "More complex infrastructure, requires sticky sessions", "recommended": true },
    { "optionId": "MENU-1-B", "label": "Server-Sent Events", "description": "One-way push, simpler than WebSockets", "tradeoffs": "No client-to-server channel, limited browser connections" },
    { "optionId": "MENU-1-C", "label": "Polling", "description": "Simplest approach, 30-second refresh cycle", "tradeoffs": "Not truly real-time, higher server load at scale" }
  ] }

GOOD Menu items (product: phasing/scope) — ONLY for product_or_feature requests, skip for technical_task:
- { "id": "MENU-P1", "question": "Which user journeys should be in MVP?", "context": "This defines your launch scope and development timeline", "options": [
    { "optionId": "MENU-P1-A", "label": "Core workflows only", "description": "Dues tracking + violation recording", "tradeoffs": "Fastest to ship, covers 80% of daily use", "recommended": true },
    { "optionId": "MENU-P1-B", "label": "Core + reporting", "description": "Add financial reports and violation history", "tradeoffs": "More complete but 2-3x development scope" },
    { "optionId": "MENU-P1-C", "label": "Full suite", "description": "All journeys including resident portal", "tradeoffs": "Complete product but significantly longer timeline" }
  ] }

BAD (do NOT present menus for implementation details):
- "Should we use Redux or Zustand?" (YOU decide — not consequential to the user)

## What Belongs Where
- **Business gaps** (scope, priorities, user personas) → **Mirror items** (state your assumption, user confirms/rejects)
- **Product personas and journeys** (product_or_feature only) → **Mirror items** with category "persona", "journey", or "ux"
- **Meaningful technical tradeoffs** (cost, timeline, capability) → **Menu items** (present 2-3 options with trade-offs)
- **Phasing decisions** (what's MVP vs V2) → **Menu items** with concrete scope options
- Only use \`suggestedQuestions\` for truly open-ended questions that cannot be expressed as assumptions or options

# Mirror Categories
- "intent" — What the user wants to achieve
- "scope" — What's included/excluded from this phase
- "constraint" — Technical or business limitations
- "priority" — What matters most
- "anti-goal" — What we are explicitly NOT doing
- "persona" — Who the users are, their goals, their pain points
- "journey" — How users interact with the system, step-by-step flows
- "ux" — User experience assumptions, design principles

# Constraints

- Maximum 7 Mirror items per round
- Maximum 3 Menu items per round (each with 2-3 options)
- EVERY Mirror item MUST have a rationale explaining why you believe this assumption
- EVERY Menu option MUST have explicit tradeoffs
- You may recommend at most ONE option per Menu item
- If you have no genuine assumptions or decisions remaining, say so in conversationalResponse and include ${CLARIFICATION_COMPLETE_TAG}
- NEVER ask about: schema designs, field names, file formats, config syntax, library choices, naming conventions, test framework selection, or any detail you can determine yourself
- Carry forward all previous plan items — do NOT drop anything

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Brief narrative context. Summarize what you learned and what assumptions you are presenting for validation. Do NOT embed questions here.",
  "updatedPlan": {
    "version": <number>,
    "title": "...",
    "summary": "...",
    "requirements": [...],
    "decisions": [...],
    "constraints": [...],
    "openQuestions": [...],
    "technicalNotes": [...],
    "proposedApproach": "...",
    "lastUpdatedAt": "<ISO-8601>",
    "requestCategory": "product_or_feature OR technical_task (carry forward)",
    "productVision": "(OMIT for technical_task) ...",
    "productDescription": "(OMIT for technical_task) ...",
    "personas": "(OMIT for technical_task) [...]",
    "userJourneys": "(OMIT for technical_task) [...]",
    "successMetrics": "(OMIT for technical_task) [...]",
    "phasingStrategy": "(OMIT for technical_task) [...]",
    "uxRequirements": "(OMIT for technical_task) [...]"
  },
  "mmp": {
    "mirror": {
      "steelMan": "Based on my analysis, here is what I believe you want to build: [1-2 sentence summary]",
      "items": [
        { "id": "MIR-1", "text": "Assumption statement", "category": "scope", "rationale": "Why I believe this", "antiGoal": "What this excludes (optional)", "status": "pending" }
      ]
    },
    "menu": {
      "items": [
        { "id": "MENU-1", "question": "Decision question", "context": "Why this matters", "options": [
          { "optionId": "MENU-1-A", "label": "Option A", "description": "Details", "tradeoffs": "Consequences", "recommended": true },
          { "optionId": "MENU-1-B", "label": "Option B", "description": "Details", "tradeoffs": "Consequences" }
        ] }
      ]
    }
  },
  "suggestedQuestions": [],
  "codebaseFindings": []
}
\`\`\`

# Plan Evolution Rules

- **Carry forward** all items from the previous plan version — do NOT drop items
- **Increment version** by 1
- **Integrate** the user's answers from the previous round into decisions/requirements
- **Move** answered open questions to decisions
- **Update** summary and approach based on new information${coverageSection}`;
}

// ==================== MODE-AWARE PROMPT CONSTRUCTION ====================

/**
 * Build the system prompt with mode-appropriate behavioral directives.
 *
 * For CLARIFYING sub-state, uses the dedicated clarifying prompt.
 * For STATE_DRIVEN mode, the domain coverage context contains a strong
 * behavioral override that narrows the Expert's scope to the current domain.
 * For other modes (DOCUMENT_BASED, HYBRID_CHECKPOINTS), it appends advisory
 * coverage context without changing the Expert's fundamental behavior.
 *
 * Returns the base prompt unmodified when no domain context is provided.
 */
function buildModeAwareSystemPrompt(
	domainCoverageContext?: string,
	subState?: string,
	clarificationRound?: number,
): string {
	// CLARIFYING sub-state uses a dedicated prompt
	if (subState === 'CLARIFYING') {
		return buildClarifyingSystemPrompt(
			clarificationRound ?? 1,
			MAX_CLARIFICATION_ROUNDS,
			domainCoverageContext,
		);
	}

	if (!domainCoverageContext) {
		return INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT;
	}

	// Check if gathered context is present (prepended by buildDomainCoverageContextForExpert)
	const hasGatheredNotes = domainCoverageContext.includes('# Domain Gathering Notes');
	const gatheringInstruction = hasGatheredNotes
		? '\n\n# Using Gathered Domain Notes\n\n'
			+ 'The domain notes below were gathered during a structured interview phase. '
			+ 'Use them as the primary input for your plan. Do NOT re-ask questions '
			+ 'that were already answered during gathering. Focus on synthesizing the '
			+ 'gathered information into a coherent plan, then ask about any remaining gaps.'
		: '';

	// Check if this is STATE_DRIVEN mode (context contains the mode identifier)
	if (domainCoverageContext.includes('INTAKE MODE: State-Driven')) {
		return buildStateDrivenPrompt(domainCoverageContext) + gatheringInstruction;
	}

	// DOCUMENT_BASED and HYBRID_CHECKPOINTS: append coverage context as advisory
	return INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT
		+ gatheringInstruction
		+ '\n\n# Domain Coverage Context\n\n'
		+ domainCoverageContext
		+ '\n\nWhen you address a domain in your response, include a tag like [DOMAIN_COVERAGE: DOMAIN_NAME=LEVEL] (e.g., [DOMAIN_COVERAGE: SECURITY_COMPLIANCE=PARTIAL]) to help track coverage.';
}

/**
 * For STATE_DRIVEN mode, build a modified system prompt that replaces the
 * "Conversation Style" section with explicit single-domain focus instructions.
 * This ensures the Expert narrows its scope to one engineering domain at a time
 * rather than attempting to address everything at once.
 */
function buildStateDrivenPrompt(domainContext: string): string {
	// Replace the "Conversation Style" section with domain-focused instructions
	const modifiedPrompt = INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT.replace(
		/# Conversation Style[\s\S]*$/,
		`# Conversation Style — STATE-DRIVEN DOMAIN WALKTHROUGH

**CRITICAL: You are in State-Driven Domain Walkthrough mode.**

You are systematically walking the Human through engineering domains ONE AT A TIME to build comprehensive requirements. This is NOT a free-form conversation — you must stay focused on the current domain.

## Current Domain Focus

${domainContext}

## Behavioral Rules for This Mode

1. **SCOPE RESTRICTION**: Your conversational response MUST focus on the current domain listed above. Do NOT discuss other engineering domains unless the Human explicitly asks about them.

2. **QUESTION-DRIVEN**: Ask 2-4 focused, specific questions about the current domain. Make them concrete, not abstract. Reference what you find in the codebase when possible.

3. **EVIDENCE GATHERING**: If you can investigate the codebase to find information relevant to the current domain, do so. Report your findings within the scope of this domain.

4. **PLAN UPDATES**: Only add plan items (requirements, decisions, constraints, questions) that relate to the current domain. Carry forward all existing items but do not add items for other domains.

5. **COVERAGE REPORTING**: At the end of your response, include a coverage tag for the current domain: [DOMAIN_COVERAGE: DOMAIN_NAME=LEVEL] where LEVEL is NONE, PARTIAL, or ADEQUATE.

6. **DOMAIN COMPLETION**: When you believe the current domain has been sufficiently explored (the Human has answered your key questions and you have enough information), state this clearly: "I believe we have adequate coverage of [domain]. Ready to move to the next domain."

7. **DO NOT** attempt to cover all domains at once. DO NOT provide a broad overview. Stay narrow and deep on the current domain.`
	);

	return modifiedPrompt;
}

// ==================== MMP VALIDATION & FALLBACK ====================

/**
 * Validate and normalize an MMP payload from parsed JSON.
 * Returns a validated MMPPayload or undefined if the data is absent/invalid.
 */
function validateMMPPayload(raw: unknown): MMPPayload | undefined {
	if (!raw || typeof raw !== 'object') { return undefined; }

	const data = raw as Record<string, unknown>;
	const result: MMPPayload = {};

	// Validate Mirror card
	if (data.mirror && typeof data.mirror === 'object') {
		const mirrorData = data.mirror as Record<string, unknown>;
		const items = Array.isArray(mirrorData.items)
			? (mirrorData.items as unknown[])
				.filter((item): item is Record<string, unknown> =>
					!!item && typeof item === 'object' &&
					typeof (item as Record<string, unknown>).id === 'string' &&
					typeof (item as Record<string, unknown>).text === 'string')
				.map((item): MirrorItem => ({
					id: item.id as string,
					text: item.text as string,
					category: validateMirrorCategory(item.category) ?? 'intent',
					rationale: typeof item.rationale === 'string' ? item.rationale : '',
					antiGoal: typeof item.antiGoal === 'string' ? item.antiGoal : undefined,
					status: 'pending',
				}))
			: [];
		if (items.length > 0) {
			result.mirror = {
				steelMan: typeof mirrorData.steelMan === 'string' ? mirrorData.steelMan : '',
				items,
			};
		}
	}

	// Validate Menu card
	if (data.menu && typeof data.menu === 'object') {
		const menuData = data.menu as Record<string, unknown>;
		const items = Array.isArray(menuData.items)
			? (menuData.items as unknown[])
				.filter((item): item is Record<string, unknown> =>
					!!item && typeof item === 'object' &&
					typeof (item as Record<string, unknown>).id === 'string' &&
					typeof (item as Record<string, unknown>).question === 'string' &&
					Array.isArray((item as Record<string, unknown>).options))
				.map((item): MenuItem => ({
					id: item.id as string,
					question: item.question as string,
					context: typeof item.context === 'string' ? item.context : undefined,
					options: (item.options as unknown[])
						.filter((opt): opt is Record<string, unknown> =>
							!!opt && typeof opt === 'object' &&
							typeof (opt as Record<string, unknown>).optionId === 'string' &&
							typeof (opt as Record<string, unknown>).label === 'string')
						.map((opt): MenuOption => ({
							optionId: opt.optionId as string,
							label: opt.label as string,
							description: typeof opt.description === 'string' ? opt.description : '',
							tradeoffs: typeof opt.tradeoffs === 'string' ? opt.tradeoffs : '',
							recommended: opt.recommended === true ? true : undefined,
						})),
				}))
				.filter((item) => item.options.length >= 2) // Menu items must have ≥2 options
			: [];
		if (items.length > 0) {
			result.menu = { items };
		}
	}

	// Validate Pre-Mortem card
	if (data.preMortem && typeof data.preMortem === 'object') {
		const pmData = data.preMortem as Record<string, unknown>;
		const items = Array.isArray(pmData.items)
			? (pmData.items as unknown[])
				.filter((item): item is Record<string, unknown> =>
					!!item && typeof item === 'object' &&
					typeof (item as Record<string, unknown>).id === 'string' &&
					typeof (item as Record<string, unknown>).assumption === 'string' &&
					typeof (item as Record<string, unknown>).failureScenario === 'string')
				.map((item): PreMortemItem => ({
					id: item.id as string,
					assumption: item.assumption as string,
					failureScenario: item.failureScenario as string,
					severity: validatePreMortemSeverity(item.severity) ?? 'medium',
					mitigation: typeof item.mitigation === 'string' ? item.mitigation : undefined,
					status: 'pending',
				}))
			: [];
		if (items.length > 0) {
			result.preMortem = {
				summary: typeof pmData.summary === 'string' ? pmData.summary : '',
				items,
			};
		}
	}

	// Return undefined if no cards were populated
	return (result.mirror || result.menu || result.preMortem) ? result : undefined;
}

const VALID_MIRROR_CATEGORIES = new Set(['intent', 'scope', 'constraint', 'priority', 'anti-goal', 'persona', 'journey', 'ux']);
function validateMirrorCategory(val: unknown): 'intent' | 'scope' | 'constraint' | 'priority' | 'anti-goal' | 'persona' | 'journey' | 'ux' | null {
	return typeof val === 'string' && VALID_MIRROR_CATEGORIES.has(val)
		? val as 'intent' | 'scope' | 'constraint' | 'priority' | 'anti-goal' | 'persona' | 'journey' | 'ux'
		: null;
}

const VALID_PM_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
function validatePreMortemSeverity(val: unknown): 'low' | 'medium' | 'high' | 'critical' | null {
	return typeof val === 'string' && VALID_PM_SEVERITIES.has(val)
		? val as 'low' | 'medium' | 'high' | 'critical'
		: null;
}

/**
 * Fallback: convert legacy suggestedQuestions/followUpQuestions to MMP format.
 * Each question becomes a Menu item with a single "Your Response" option,
 * prompting the human to provide a custom answer.
 */
function convertQuestionsToMMP(questions: string[]): MMPPayload {
	return {
		menu: {
			items: questions.map((q, i): MenuItem => ({
				id: `LEGACY-Q-${i + 1}`,
				question: q,
				options: [
					{
						optionId: 'CUSTOM',
						label: 'Your Response',
						description: 'Provide your answer to this question',
						tradeoffs: '',
					},
					{
						optionId: 'SKIP',
						label: 'Skip',
						description: 'Skip this question for now',
						tradeoffs: 'The agent will use its best judgment',
					},
				],
			})),
		},
	};
}

// ==================== RESPONSE PARSING ====================

/**
 * Parse IntakeTurnResponse from raw CLI response.
 * Graceful degradation: if JSON parse fails, treat raw response as
 * conversationalResponse and carry forward previous plan version.
 */
function parseIntakeTurnResponse(
	rawResponse: string,
	previousPlan: IntakePlanDocument,
	turnNumber: number
): Result<IntakeTurnResponse> {
	try {
		// Extract JSON from response — multiple strategies for robustness
		const jsonStr = extractJsonFromIntakeResponse(rawResponse);

		const parsed = JSON.parse(jsonStr);

		// Validate required fields
		if (!parsed.conversationalResponse || typeof parsed.conversationalResponse !== 'string') {
			// Graceful degradation: use raw response as conversation
			return {
				success: true,
				value: {
					conversationalResponse: rawResponse,
					updatedPlan: {
						...previousPlan,
						version: previousPlan.version + 1,
						lastUpdatedAt: new Date().toISOString(),
					},
				},
			};
		}

		// Validate and construct plan
		const updatedPlan: IntakePlanDocument = parsed.updatedPlan
			? {
					version: parsed.updatedPlan.version ?? previousPlan.version + 1,
					title: parsed.updatedPlan.title ?? previousPlan.title,
					summary: parsed.updatedPlan.summary ?? previousPlan.summary,
					requirements: normalizeExtractedItems(
						parsed.updatedPlan.requirements,
						'REQUIREMENT',
						turnNumber
					),
					decisions: normalizeExtractedItems(
						parsed.updatedPlan.decisions,
						'DECISION',
						turnNumber
					),
					constraints: normalizeExtractedItems(
						parsed.updatedPlan.constraints,
						'CONSTRAINT',
						turnNumber
					),
					openQuestions: normalizeExtractedItems(
						parsed.updatedPlan.openQuestions,
						'OPEN_QUESTION',
						turnNumber
					),
					technicalNotes: Array.isArray(parsed.updatedPlan.technicalNotes)
						? parsed.updatedPlan.technicalNotes
						: previousPlan.technicalNotes,
					proposedApproach:
						parsed.updatedPlan.proposedApproach ?? previousPlan.proposedApproach,
					lastUpdatedAt:
						parsed.updatedPlan.lastUpdatedAt ?? new Date().toISOString(),
					// Request classification — carry forward
					requestCategory: parsed.updatedPlan.requestCategory ?? previousPlan.requestCategory,
					// Product artifacts — pass through if present, fall back to previous plan
					productVision: parsed.updatedPlan.productVision ?? previousPlan.productVision,
					productDescription: parsed.updatedPlan.productDescription ?? previousPlan.productDescription,
					personas: Array.isArray(parsed.updatedPlan.personas) ? parsed.updatedPlan.personas : previousPlan.personas,
					userJourneys: Array.isArray(parsed.updatedPlan.userJourneys) ? parsed.updatedPlan.userJourneys : previousPlan.userJourneys,
					successMetrics: Array.isArray(parsed.updatedPlan.successMetrics) ? parsed.updatedPlan.successMetrics : previousPlan.successMetrics,
					phasingStrategy: Array.isArray(parsed.updatedPlan.phasingStrategy) ? parsed.updatedPlan.phasingStrategy : previousPlan.phasingStrategy,
					uxRequirements: Array.isArray(parsed.updatedPlan.uxRequirements) ? parsed.updatedPlan.uxRequirements : previousPlan.uxRequirements,
				}
			: {
					...previousPlan,
					version: previousPlan.version + 1,
					lastUpdatedAt: new Date().toISOString(),
				};

		// Extract and validate MMP payload
		const mmp = validateMMPPayload(parsed.mmp);
		const suggestedQuestions = Array.isArray(parsed.suggestedQuestions)
			? parsed.suggestedQuestions as string[]
			: undefined;

		const response: IntakeTurnResponse = {
			conversationalResponse: parsed.conversationalResponse,
			updatedPlan,
			suggestedQuestions,
			codebaseFindings: Array.isArray(parsed.codebaseFindings)
				? parsed.codebaseFindings
				: undefined,
			// Prefer LLM-generated MMP; fall back to converting suggestedQuestions
			mmp: mmp ?? (suggestedQuestions?.length ? convertQuestionsToMMP(suggestedQuestions) : undefined),
		};

		return { success: true, value: response };
	} catch (error) {
		// Graceful degradation: if JSON parse fails entirely,
		// try to extract meaningful content from raw response
		if (isLoggerInitialized()) {
			const errMsg = error instanceof Error ? error.message : String(error);
			getLogger()
				.child({ component: 'role:technicalExpertIntake' })
				.warn('Failed to parse INTAKE response as JSON, using graceful degradation', {
					errorMessage: errMsg,
					rawResponseLength: rawResponse.length,
					rawResponse,
				});
		}

		return {
			success: false,
			error: new Error(
				'Failed to parse INTAKE turn response as JSON. ' +
				'The raw output has been cached — type "use output" or "adopt" to manually inject it.'
			),
		};
	}
}

/**
 * Extract readable content from raw CLI output that may contain
 * streaming JSONL events. Tries to pull agent_message text from
 * event lines; falls back to stripping JSON noise for readability.
 */
function extractReadableContent(rawResponse: string): string {
	const lines = rawResponse.split('\n').filter((l) => l.trim());
	const messages: string[] = [];

	for (const line of lines) {
		const extracted = extractMessageFromLine(line);
		if (extracted) {
			messages.push(extracted);
		}
	}

	if (messages.length > 0) {
		return messages.join('\n\n');
	}

	// Absolute fallback: return raw response (truncated for readability)
	if (rawResponse.length > 2000) {
		return rawResponse.substring(0, 2000) + '\n\n[Response truncated — parsing failed]';
	}
	return rawResponse;
}

/** Try to extract a readable message from a single JSONL line. */
function extractMessageFromLine(line: string): string | null {
	try {
		const event = JSON.parse(line);

		// Codex Responses API: item.completed with agent_message
		if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
			return event.item.text;
		}
		// Legacy format: assistant message
		if (event.role === 'assistant' && event.content) {
			return event.content;
		}
		// Result event
		if (event.type === 'result' && event.response) {
			return event.response;
		}
		return null;
	} catch {
		// Non-JSON line — keep it as plain text if it's not empty noise
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
			return trimmed;
		}
		return null;
	}
}

/**
 * Extract a JSON object string from a raw LLM response.
 * Handles markdown code fences, surrounding prose, and braces in trailing text.
 */
function extractJsonFromIntakeResponse(rawResponse: string): string {
	const trimmed = rawResponse.trim();

	return tryDirectParseIntake(trimmed)
		?? tryFenceExtractionIntake(trimmed)
		?? extractBalancedJsonObjectIntake(trimmed)
		?? trimmed;
}

function tryDirectParseIntake(text: string): string | null {
	try { JSON.parse(text); return text; } catch { return null; }
}

function tryFenceExtractionIntake(text: string): string | null {
	// Greedy match — grab everything up to the LAST closing fence.
	// Lazy ([\s\S]*?) fails when JSON contains backticks or nested code fences.
	const m = /```(?:json)?\s*([\s\S]*)\s*```/.exec(text);
	if (!m) { return null; }

	const content = m[1].trim();
	return tryDirectParseIntake(content) ?? extractBalancedJsonObjectIntake(content);
}

function extractBalancedJsonObjectIntake(text: string): string | null {
	const start = text.indexOf('{');
	if (start === -1) { return null; }

	const end = findMatchingBraceIntake(text, start);
	return end === -1 ? null : text.substring(start, end + 1);
}

function findMatchingBraceIntake(text: string, start: number): number {
	let depth = 0;
	let inString = false;
	let skip = false;

	for (let i = start; i < text.length; i++) {
		const ch = text[i];

		if (skip) { skip = false; continue; }

		if (inString) {
			skip = ch === '\\';
			if (ch === '"') { inString = false; }
			continue;
		}
		if (ch === '"') { inString = true; continue; }
		if (ch === '{') { depth++; }
		if (ch === '}' && --depth === 0) { return i; }
	}

	return -1;
}

/**
 * Normalize extracted items from parsed JSON.
 * Ensures each item has required fields and correct types.
 * Handles both object items ({id, text, ...}) and string items ("[ID] text...").
 */
function normalizeExtractedItems(
	items: unknown,
	defaultType: string,
	turnNumber: number
): IntakePlanDocument['requirements'] {
	if (!Array.isArray(items)) {
		return [];
	}

	return items.map((rawItem: unknown, index: number) => {
		// Handle string items: "[REQ-1] Full description..." or plain "Description..."
		if (typeof rawItem === 'string') {
			const parsed = parseStringItem(rawItem, defaultType, index);
			return {
				id: parsed.id,
				type: defaultType as IntakeExtractedItemType,
				text: parsed.text,
				extractedFromTurnId: turnNumber,
				timestamp: new Date().toISOString(),
			};
		}

		// Handle object items: {id, type, text, ...}
		const item = rawItem as Record<string, unknown>;
		return {
			id: (item.id as string) ?? `${defaultType.charAt(0)}-${index + 1}`,
			type: ((item.type as string) ?? defaultType) as IntakeExtractedItemType,
			text: (item.text as string) ?? '',
			extractedFromTurnId:
				typeof item.extractedFromTurnId === 'number'
					? item.extractedFromTurnId
					: turnNumber,
			timestamp: new Date().toISOString(), // Always use real timestamp — LLMs hallucinate dates
		};
	});
}

/**
 * Parse a string item into id + text.
 * Handles formats like:
 *   "[REQ-1] Full description..."
 *   "[R-1] Description..."
 *   "Just plain text without an ID prefix"
 */
function parseStringItem(
	str: string,
	defaultType: string,
	index: number
): { id: string; text: string } {
	const trimmed = str.trim();

	// Try to extract [ID] prefix: matches [REQ-1], [R-1], [DEC-2], [Q-3], etc.
	const match = /^\[([A-Z][\w-]*)\]\s*(.*)$/s.exec(trimmed);
	if (match) {
		return {
			id: match[1],
			text: match[2].trim(),
		};
	}

	// No ID prefix — generate one and use the whole string as text
	return {
		id: `${defaultType.charAt(0)}-${index + 1}`,
		text: trimmed,
	};
}

/**
 * Validate IntakeTurnResponse for guardrail compliance and quality.
 * Returns warnings but does not block — validation is advisory.
 */
function validateIntakeTurnResponse(response: IntakeTurnResponse): Result<void> {
	const warnings: string[] = [];

	// Check for feasibility verdicts in conversational response
	const text = response.conversationalResponse.toLowerCase();
	const feasibilityPatterns = [
		/this (will|won't|should|shouldn't) work/i,
		/i (recommend|suggest|advise) (that you|we)/i,
		/(proceed|go ahead) with (implementation|building|coding)/i,
		/this is (feasible|infeasible|viable|not viable)/i,
	];

	for (const pattern of feasibilityPatterns) {
		if (pattern.test(text)) {
			warnings.push(
				`Response may contain feasibility verdict (forbidden): "${pattern.source}"`
			);
		}
	}

	// Check plan quality
	const plan = response.updatedPlan;
	if (!plan.title) {
		warnings.push('Plan is missing a title');
	}
	if (!plan.summary) {
		warnings.push('Plan is missing a summary');
	}

	if (warnings.length > 0) {
		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'role:technicalExpertIntake' })
				.warn('INTAKE Technical Expert response warnings', { warnings });
		}
		return {
			success: false,
			error: new Error(`INTAKE response warnings:\n${warnings.join('\n')}`),
		};
	}

	return { success: true, value: undefined };
}

// ==================== PROPOSER-VALIDATOR PROMPTS & INVOCATIONS ====================

/**
 * Proposer invocation options — shared across all 4 proposer rounds.
 */

/** Extract source attribution from rationale text as fallback when LLM doesn't provide a separate source field. */
function extractSourceFromRationale(rationale: string): string {
	const lower = rationale.toLowerCase();
	if (lower.includes('user-specified') || lower.includes('user specified')) { return 'user-specified'; }
	if (lower.includes('document-specified') || lower.includes('document specified')) { return 'document-specified'; }
	if (lower.includes('domain-standard') || lower.includes('domain standard')) { return 'domain-standard'; }
	return 'ai-proposed';
}

export interface ProposerOptions {
	dialogueId: string;
	humanMessage: string;
	provider: RoleCLIProvider;
	draftPlan: IntakePlanDocument;
	onEvent?: (event: CLIActivityEvent) => void;
}

// ── DOMAIN PROPOSER ──

const BUSINESS_DOMAIN_PROPOSER_PROMPT = `You are a PRODUCT DOMAIN PROPOSER in an autonomous software engineering system.

# Your Task

The user has described a product they want to build. Your job is to propose ALL business domains and personas that this product should encompass.

This is a PRODUCT VISION phase — your goal is comprehensive domain coverage, not MVP scoping.
The user will prune domains via Accept/Reject decisions. Do NOT pre-filter by importance.

You must:
1. Review the validated product intent provided in the context (personas, journeys, vision, requirements from INTENT DISCOVERY).
2. Propose ALL business domains that the product should encompass. Use the validated intent as your foundation and supplement with standard domains for this industry.
3. For each domain, provide a name, description, why it's relevant, and preview of typical entities and workflows.
4. Review the validated personas from INTENT DISCOVERY. Confirm they are complete, add any missing personas, and include all in your output.

# Seed + Expand
- Start from the validated personas and journeys from INTENT DISCOVERY — these are the user's confirmed intent.
- Extract ALL domains implied by those journeys and personas.
- Supplement with additional domains standard for this industry that the user may not have mentioned.
- If source documents describe implementation phases or pillars, note that in the rationale.
- Mark each domain's source: "user-specified" or "ai-proposed".

# Critical Rules
- PROPOSE EXPANSIVELY. The user will Accept/Reject each domain individually.
- Do NOT exclude domains because they seem low priority or future scope. Propose them ALL.
- If source documents describe implementation phases or pillars, note that in the rationale but still propose every domain.

# Context
The INTENT DISCOVERY phase has already read the source documents and produced findings. Those findings are included below as context. Use them to inform your proposals.

# Processing Prior Decisions

If the input contains [MMP Decisions], these are the user's verdicts on items from a previous round.
You MUST process them:
- ACCEPTED items: Keep these as-is in your output. They are your foundation — do not regenerate them.
- REJECTED items: Exclude these from your output entirely.
- EDITED items: Use the user's edited text instead of the original.
- DEFERRED items: Include in output but note as deferred in the rationale.
Build your proposal ON TOP OF the accepted items. Do not start from scratch.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "domains": [
    {
      "id": "BUS-DM-<SHORT-NAME>",
      "name": "Domain Name",
      "description": "What this domain covers",
      "rationale": "Why this domain is relevant. Source: user-specified|ai-proposed",
      "entityPreview": ["Entity1", "Entity2", "Entity3"],
      "workflowPreview": ["Workflow1", "Workflow2"]
    }
  ],
  "personas": [
    {
      "id": "P-1",
      "name": "Persona Name",
      "description": "Who they are and their context",
      "goals": ["What they want"],
      "painPoints": ["What frustrates them"]
    }
  ]
}`;

/**
 * Invoke the domain proposer — Round 1.
 */
export async function invokeProposerBusinessDomains(
	options: ProposerOptions
): Promise<Result<{ domains: BusinessDomainProposal[]; personas: PersonaDefinition[] }>> {
	try {
		// Build context from draft plan findings
		const contextParts: string[] = [];
		if (options.humanMessage.startsWith('[MMP Decisions]')) {
			contextParts.push(`# Prior MMP Decisions (from user review)\n\n${options.humanMessage}`);
		} else if (options.humanMessage.trim()) {
			contextParts.push(`# User Request\n\n${options.humanMessage}`);
		}

		// Include human feedback if this is a re-run with refinement
		const humanFeedback = (options.draftPlan as unknown as Record<string, unknown>).humanFeedback;
		if (humanFeedback && typeof humanFeedback === 'string') {
			contextParts.push(`# Human Feedback (MUST incorporate this guidance)\n\n${humanFeedback}`);
		}

		// Product vision & description from Intent Discovery
		if (options.draftPlan.productVision) {
			contextParts.push(`# Product Vision\n\n${options.draftPlan.productVision}`);
		}
		if (options.draftPlan.productDescription) {
			contextParts.push(`# Product Description\n\n${options.draftPlan.productDescription}`);
		}

		// Personas from Intent Discovery
		const discoveredPersonas = options.draftPlan.personas ?? [];
		if (discoveredPersonas.length > 0) {
			const personaLines = discoveredPersonas.map(p =>
				`- **${p.id}**: ${p.name} — ${p.description}` +
				(p.goals?.length ? `\n  Goals: ${p.goals.join('; ')}` : '') +
				(p.painPoints?.length ? `\n  Pain points: ${p.painPoints.join('; ')}` : '')
			);
			contextParts.push(`# Validated Personas (from Intent Discovery)\n\n${personaLines.join('\n')}`);
		}

		// User journeys from Intent Discovery (compact — no step-by-step)
		const journeys = options.draftPlan.userJourneys ?? [];
		if (journeys.length > 0) {
			const journeyLines = journeys.map(j =>
				`- **${j.id}** [${j.implementationPhase ?? 'TBD'}] ${j.title} (${j.personaId}): ${j.scenario}`
			);
			contextParts.push(`# Validated User Journeys (from Intent Discovery)\n\n${journeyLines.join('\n')}`);
		}

		// Phasing strategy
		const phasing = options.draftPlan.phasingStrategy ?? [];
		if (phasing.length > 0) {
			const phasingLines = phasing.map(ph => `- **${ph.phase}**: ${ph.description}`);
			contextParts.push(`# Validated Phasing Strategy\n\n${phasingLines.join('\n')}`);
		}

		// Requirements
		const requirements = options.draftPlan.requirements ?? [];
		if (requirements.length > 0) {
			const reqLines = requirements.slice(0, 15).map(r => `- ${r.text}`);
			contextParts.push(`# Requirements\n\n${reqLines.join('\n')}`);
		}

		if (options.draftPlan.proposedApproach) {
			contextParts.push(`# Technical Approach Notes\n\n${options.draftPlan.proposedApproach}`);
		}
		const techNotes = options.draftPlan.technicalNotes ?? [];
		if (techNotes.length > 0) {
			contextParts.push(`# Codebase Observations\n\n${techNotes.join('\n')}`);
		}

		const stdinContent = buildStdinContent(BUSINESS_DOMAIN_PROPOSER_PROMPT, contextParts.join('\n\n---\n\n'));

		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {return cliResult;}

		const jsonStr = extractJsonFromIntakeResponse(cliResult.value.response);
		const parsed = JSON.parse(jsonStr);

		const domains: BusinessDomainProposal[] = (parsed.domains ?? []).map((d: Record<string, unknown>, i: number) => ({
			id: (d.id as string) || `BUS-DM-${i + 1}`,
			name: (d.name as string) || '',
			description: (d.description as string) || '',
			rationale: (d.rationale as string) || '',
			entityPreview: Array.isArray(d.entityPreview) ? d.entityPreview as string[] : [],
			workflowPreview: Array.isArray(d.workflowPreview) ? d.workflowPreview as string[] : [],
			source: (d.source as string) || extractSourceFromRationale((d.rationale as string) || ''),
		}));

		const personas: PersonaDefinition[] = (parsed.personas ?? []).map((p: Record<string, unknown>, i: number) => ({
			id: (p.id as string) || `P-${i + 1}`,
			name: (p.name as string) || '',
			description: (p.description as string) || '',
			goals: Array.isArray(p.goals) ? p.goals as string[] : [],
			painPoints: Array.isArray(p.painPoints) ? p.painPoints as string[] : [],
		}));

		return { success: true, value: { domains, personas } };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ── JOURNEY/WORKFLOW PROPOSER ──

const JOURNEY_WORKFLOW_PROPOSER_PROMPT = `You are a PRODUCT JOURNEY & WORKFLOW PROPOSER in an autonomous software engineering system.

# Your Task

You have accepted business domains and personas. Your job is to propose ALL user journeys
and system workflows that these domains could encompass.

# Approach: Research Then Generate

Step 1 — REVIEW VALIDATED INTENT: Study your inputs thoroughly before generating anything:
- Review the validated personas and journeys from INTENT DISCOVERY (these are the user's confirmed product intent)
- Read the accepted domains' descriptions, entity previews, and workflow previews
- Draw on your knowledge of standard journeys for each domain type (e.g., an Accounting domain
  typically has: invoice processing, payment reconciliation, reporting, audit trail, etc.)
- Identify ALL personas and how they interact with each domain

Step 2 — GENERATE: For each accepted domain, propose:
- User journeys: end-to-end flows from a persona's perspective
- System workflows: internal process automations

# Critical Rules

- PROPOSE EXPANSIVELY. Include every journey the product could reasonably support.
  The user will prune via Accept/Reject decisions. Do NOT pre-filter.
- Do NOT apply MVP thinking. Do NOT exclude journeys because they seem "low priority"
  or "future scope." Propose them ALL and let the user decide.
- Cover EVERY accepted domain. If a domain has no journeys, explain why.
- Cover EVERY persona. Each persona should appear in their relevant journeys.
- Tag each item with its source: "document-specified" (found in source docs),
  "domain-standard" (typical for this domain type), or "ai-proposed" (your inference).

# Phasing (BINDING — from validated strategy)

The context includes a "Validated Phasing Strategy" section. You MUST use those phase definitions
to tag each journey's implementationPhase field. Match journeys to phases based on which domains
and pillars each phase covers:
- If a journey belongs to a domain covered by Phase 1, tag it "Phase 1"
- If a journey belongs to a domain covered by Phase 2, tag it "Phase 2"
- And so on for Phase 3+

IMPORTANT: Phasing is metadata for the user's reference. It must NOT cause you to exclude
any item. A "Phase 3" journey is still proposed — just tagged as Phase 3.

# Processing Prior Decisions

If the input contains [MMP Decisions], these are the user's verdicts on items from a previous round.
You MUST process them:
- ACCEPTED items: Keep these as-is in your output. They are your foundation — do not regenerate them.
- REJECTED items: Exclude these from your output entirely.
- EDITED items: Use the user's edited text instead of the original.
- DEFERRED items: Include in output but note as deferred in the implementationPhase field.
Build your proposal ON TOP OF the accepted items. Do not start from scratch.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "userJourneys": [
    {
      "id": "UJ-1",
      "personaId": "P-1",
      "title": "Journey title",
      "scenario": "When/where/why this journey happens",
      "steps": [
        { "stepNumber": 1, "actor": "Persona or System", "action": "What happens", "expectedOutcome": "Result" }
      ],
      "acceptanceCriteria": ["Measurable success condition"],
      "implementationPhase": "Source document phasing if specified, otherwise suggested phase",
      "source": "document-specified | domain-standard | ai-proposed"
    }
  ],
  "workflows": [
    {
      "id": "WF-1",
      "businessDomainId": "BUS-DM-X",
      "name": "Workflow name",
      "description": "What this workflow accomplishes",
      "steps": ["Step 1 description", "Step 2 description"],
      "triggers": ["What starts this workflow"],
      "actors": ["Who participates"],
      "source": "document-specified | domain-standard | ai-proposed"
    }
  ]
}`;

/**
 * Invoke the journey/workflow proposer — Round 2.
 */
export async function invokeProposerJourneys(
	options: ProposerOptions
): Promise<Result<{ userJourneys: UserJourney[]; workflows: WorkflowProposal[] }>> {
	try {
		const contextParts: string[] = [];
		if (options.humanMessage.startsWith('[MMP Decisions]')) {
			contextParts.push(`# Prior MMP Decisions (from user review)\n\n${options.humanMessage}`);
		} else if (options.humanMessage.trim()) {
			contextParts.push(`# User Request\n\n${options.humanMessage}`);
		}

		// Include human feedback if present
		const humanFeedback = (options.draftPlan as unknown as Record<string, unknown>).humanFeedback;
		if (humanFeedback && typeof humanFeedback === 'string') {
			contextParts.push(`# Human Feedback (MUST incorporate this guidance)\n\n${humanFeedback}`);
		}

		// Include accepted domains
		const domains = options.draftPlan.businessDomainProposals ?? [];
		if (domains.length > 0) {
			contextParts.push(`# Accepted Domains\n\n${domains.map(d => `- **${d.id}**: ${d.name} — ${d.description}`).join('\n')}`);
		}

		// Include personas
		const personas = options.draftPlan.personas ?? [];
		if (personas.length > 0) {
			contextParts.push(`# Personas\n\n${personas.map(p => `- **${p.id}**: ${p.name} — ${p.description}`).join('\n')}`);
		}

		// Include validated phasing strategy — CRITICAL for correct phase tagging
		const phasing = options.draftPlan.phasingStrategy ?? [];
		if (phasing.length > 0) {
			contextParts.push(
				`# Validated Phasing Strategy (BINDING — use these phases for tagging)\n\n` +
				`The user has validated this phasing strategy. You MUST tag each journey with the correct phase based on which pillar/phase it belongs to.\n\n` +
				phasing.map(ph => {
					const journeyIds = (ph.journeyIds ?? []).length > 0 ? ` (journeys: ${ph.journeyIds.join(', ')})` : '';
					return `- **${ph.phase}**: ${ph.description}${journeyIds}\n  Rationale: ${ph.rationale ?? ''}`;
				}).join('\n')
			);
		}

		const stdinContent = buildStdinContent(JOURNEY_WORKFLOW_PROPOSER_PROMPT, contextParts.join('\n\n---\n\n'));

		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {return cliResult;}

		const jsonStr = extractJsonFromIntakeResponse(cliResult.value.response);
		const parsed = JSON.parse(jsonStr);

		const userJourneys = normalizeUserJourneys(parsed.userJourneys ?? []);

		const workflows: WorkflowProposal[] = (parsed.workflows ?? []).map((w: Record<string, unknown>, i: number) => ({
			id: (w.id as string) || `WF-${i + 1}`,
			businessDomainId: (w.businessDomainId as string) || '',
			name: (w.name as string) || '',
			description: (w.description as string) || '',
			steps: Array.isArray(w.steps) ? w.steps as string[] : [],
			triggers: Array.isArray(w.triggers) ? w.triggers as string[] : [],
			actors: Array.isArray(w.actors) ? w.actors as string[] : [],
			source: (w.source as string) || 'ai-proposed',
		}));

		return { success: true, value: { userJourneys, workflows } };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ── ENTITY PROPOSER ──

const ENTITY_PROPOSER_PROMPT = `You are a PRODUCT DATA MODEL PROPOSER in an autonomous software engineering system.

# Your Task

The user's product has accepted business domains and workflows. Your job is to propose ALL data entities needed by these domains.

# Approach: Research Then Generate

Step 1 — REVIEW VALIDATED CONTEXT:
- Study the accepted domains, their workflows, and user journeys
- Review the validated product intent from INTENT DISCOVERY (personas, journeys, requirements)
- Identify every data object that flows through the accepted workflows
- Draw on domain knowledge for standard entities in each domain type

Step 2 — GENERATE:
- Propose entities needed by the accepted domains and workflows
- Include core entities, junction/relationship tables, audit/history entities, and configuration entities
- Tag each entity with its source: "document-specified", "domain-standard", or "ai-proposed"

# Critical Rules

- PROPOSE EXPANSIVELY. Include all entities the product would need across all accepted domains.
  The user will prune via Accept/Reject. Do NOT pre-filter by MVP or priority.
- Cover EVERY accepted domain with its relevant entities.
- If a workflow involves data flow between domains, propose the junction entities.

# Processing Prior Decisions

If the input contains [MMP Decisions], these are the user's verdicts on items from a previous round.
You MUST process them:
- ACCEPTED items: Keep these as-is in your output. They are your foundation — do not regenerate them.
- REJECTED items: Exclude these from your output entirely.
- EDITED items: Use the user's edited text instead of the original.
- DEFERRED items: Include in output but note as deferred.
Build your proposal ON TOP OF the accepted items. Do not start from scratch.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "entities": [
    {
      "id": "ENT-<NAME>",
      "businessDomainId": "BUS-DM-X",
      "name": "Entity Name",
      "description": "What this entity represents",
      "keyAttributes": ["attribute1", "attribute2"],
      "relationships": ["belongs_to OtherEntity", "has_many Items"],
      "source": "document-specified | domain-standard | ai-proposed"
    }
  ]
}`;

/**
 * Invoke the entity proposer — Round 3.
 */
export async function invokeProposerEntities(
	options: ProposerOptions
): Promise<Result<{ entities: EntityProposal[] }>> {
	try {
		const contextParts: string[] = [];
		if (options.humanMessage.startsWith('[MMP Decisions]')) {
			contextParts.push(`# Prior MMP Decisions (from user review)\n\n${options.humanMessage}`);
		} else if (options.humanMessage.trim()) {
			contextParts.push(`# User Request\n\n${options.humanMessage}`);
		}

		const humanFeedback = (options.draftPlan as unknown as Record<string, unknown>).humanFeedback;
		if (humanFeedback && typeof humanFeedback === 'string') {
			contextParts.push(`# Human Feedback (MUST incorporate this guidance)\n\n${humanFeedback}`);
		}

		const domains = options.draftPlan.businessDomainProposals ?? [];
		if (domains.length > 0) {
			contextParts.push(`# Accepted Domains\n\n${domains.map(d => `- **${d.id}**: ${d.name} — ${d.description}`).join('\n')}`);
		}

		const workflows = options.draftPlan.workflowProposals ?? [];
		if (workflows.length > 0) {
			contextParts.push(`# Accepted Workflows\n\n${workflows.map(w => `- **${w.id}**: ${w.name} — ${w.description}`).join('\n')}`);
		}

		const personas = options.draftPlan.personas ?? [];
		if (personas.length > 0) {
			contextParts.push(`# Validated Personas\n\n${personas.map(p => `- **${p.id}**: ${p.name} — ${p.description}`).join('\n')}`);
		}

		const journeys = options.draftPlan.userJourneys ?? [];
		if (journeys.length > 0) {
			contextParts.push(`# Validated User Journeys\n\n${journeys.map(j => `- **${j.id}**: ${j.title} — ${j.scenario}`).join('\n')}`);
		}

		const stdinContent = buildStdinContent(ENTITY_PROPOSER_PROMPT, contextParts.join('\n\n---\n\n'));

		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {return cliResult;}

		const jsonStr = extractJsonFromIntakeResponse(cliResult.value.response);
		const parsed = JSON.parse(jsonStr);

		const entities: EntityProposal[] = (parsed.entities ?? []).map((e: Record<string, unknown>, i: number) => ({
			id: (e.id as string) || `ENT-${i + 1}`,
			businessDomainId: (e.businessDomainId as string) || '',
			name: (e.name as string) || '',
			description: (e.description as string) || '',
			keyAttributes: Array.isArray(e.keyAttributes) ? e.keyAttributes as string[] : [],
			relationships: Array.isArray(e.relationships) ? e.relationships as string[] : [],
			source: (e.source as string) || 'ai-proposed',
		}));

		return { success: true, value: { entities } };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ── INTEGRATION PROPOSER ──

const INTEGRATION_PROPOSER_PROMPT = `You are a PRODUCT INTEGRATION & QUALITY PROPOSER in an autonomous software engineering system.

# Your Task

The user's product has accepted business domains, entities, and workflows. Your job is to propose ALL integrations with external systems and quality attributes.

# Approach: Research Then Generate

Step 1 — REVIEW VALIDATED CONTEXT:
- Study the accepted domains, entities, and workflows
- Review the validated product intent and requirements from prior rounds
- For each domain, identify what external systems it would interact with
- Draw on domain knowledge for standard integration patterns

Step 2 — GENERATE:
- Propose ALL integration points: internal (between domains) and external (third-party APIs, services)
- For each integration, suggest providers, ownership model, and rationale
- Propose quality attributes (performance, security, compliance, scalability, etc.)
- Tag each with its source: "document-specified", "domain-standard", or "ai-proposed"

# Critical Rules

- PROPOSE EXPANSIVELY. Include all integrations the product could need.
  The user will prune via Accept/Reject. Do NOT pre-filter by MVP or priority.
- Cover EVERY accepted domain with its relevant integration points.
- Include both obvious integrations (payment, auth) and domain-specific ones.

# Processing Prior Decisions

If the input contains [MMP Decisions], these are the user's verdicts on items from a previous round.
You MUST process them:
- ACCEPTED items: Keep these as-is in your output. They are your foundation — do not regenerate them.
- REJECTED items: Exclude these from your output entirely.
- EDITED items: Use the user's edited text instead of the original.
- DEFERRED items: Include in output but note as deferred.
Build your proposal ON TOP OF the accepted items. Do not start from scratch.

# Response Format
Your ENTIRE response must be a single JSON object. Do NOT write files. Do NOT include
explanatory text before or after the JSON. Do NOT use markdown code fences.
Return ONLY the JSON object:

{
  "integrations": [
    {
      "id": "INT-<NAME>",
      "name": "Integration Name",
      "category": "payment|communication|iot|erp|identity|storage|other",
      "description": "What this integration provides",
      "standardProviders": ["Provider1", "Provider2"],
      "ownershipModel": "owned|synced|delegated",
      "rationale": "Why this integration is needed",
      "source": "document-specified | domain-standard | ai-proposed"
    }
  ],
  "qualityAttributes": [
    "Specific quality requirement or constraint"
  ]
}`;

/**
 * Invoke the integration proposer — Round 4.
 */
export async function invokeProposerIntegrations(
	options: ProposerOptions
): Promise<Result<{ integrations: IntegrationProposal[]; qualityAttributes: string[] }>> {
	try {
		const contextParts: string[] = [];
		if (options.humanMessage.startsWith('[MMP Decisions]')) {
			contextParts.push(`# Prior MMP Decisions (from user review)\n\n${options.humanMessage}`);
		} else if (options.humanMessage.trim()) {
			contextParts.push(`# User Request\n\n${options.humanMessage}`);
		}

		const humanFeedback = (options.draftPlan as unknown as Record<string, unknown>).humanFeedback;
		if (humanFeedback && typeof humanFeedback === 'string') {
			contextParts.push(`# Human Feedback (MUST incorporate this guidance)\n\n${humanFeedback}`);
		}

		const domains = options.draftPlan.businessDomainProposals ?? [];
		if (domains.length > 0) {
			contextParts.push(`# Accepted Domains\n\n${domains.map(d => `- **${d.id}**: ${d.name}`).join('\n')}`);
		}

		const entities = options.draftPlan.entityProposals ?? [];
		if (entities.length > 0) {
			contextParts.push(`# Accepted Entities\n\n${entities.map(e => `- **${e.id}**: ${e.name} (${e.businessDomainId})`).join('\n')}`);
		}

		const workflows = options.draftPlan.workflowProposals ?? [];
		if (workflows.length > 0) {
			contextParts.push(`# Accepted Workflows\n\n${workflows.map(w => `- **${w.id}**: ${w.name}`).join('\n')}`);
		}

		const personas = options.draftPlan.personas ?? [];
		if (personas.length > 0) {
			contextParts.push(`# Validated Personas\n\n${personas.map(p => `- **${p.id}**: ${p.name} — ${p.description}`).join('\n')}`);
		}

		const journeys = options.draftPlan.userJourneys ?? [];
		if (journeys.length > 0) {
			contextParts.push(`# Validated User Journeys\n\n${journeys.map(j => `- **${j.id}**: ${j.title} — ${j.scenario}`).join('\n')}`);
		}

		const stdinContent = buildStdinContent(INTEGRATION_PROPOSER_PROMPT, contextParts.join('\n\n---\n\n'));

		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {return cliResult;}

		const jsonStr = extractJsonFromIntakeResponse(cliResult.value.response);
		const parsed = JSON.parse(jsonStr);

		const integrations: IntegrationProposal[] = (parsed.integrations ?? []).map((int: Record<string, unknown>, i: number) => ({
			id: (int.id as string) || `INT-${i + 1}`,
			name: (int.name as string) || '',
			category: (int.category as IntegrationProposal['category']) || 'other',
			description: (int.description as string) || '',
			standardProviders: Array.isArray(int.standardProviders) ? int.standardProviders as string[] : [],
			ownershipModel: (int.ownershipModel as IntegrationProposal['ownershipModel']) || 'owned',
			rationale: (int.rationale as string) || '',
			source: (int.source as string) || extractSourceFromRationale((int.rationale as string) || ''),
		}));

		const qualityAttributes: string[] = Array.isArray(parsed.qualityAttributes)
			? parsed.qualityAttributes as string[]
			: [];

		return { success: true, value: { integrations, qualityAttributes } };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
