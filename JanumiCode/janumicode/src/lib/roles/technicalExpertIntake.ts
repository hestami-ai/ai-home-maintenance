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
} from '../types/intake';
import { EngineeringDomain } from '../types/intake';
import type { RoleCLIResult, CLIActivityEvent } from '../cli/types';
import { buildStdinContent } from '../cli/types';
import { getLogger, isLoggerInitialized } from '../logging';
import {
	buildIntakeTechnicalExpertContext,
	formatIntakeTechnicalExpertContext,
} from '../context';

/**
 * INTAKE Technical Expert invocation options
 */
export interface IntakeTechnicalExpertOptions {
	dialogueId: string;
	humanMessage: string;
	currentPlan: IntakePlanDocument;
	turnNumber: number;
	provider: RoleCLIProvider;
	tokenBudget: number;
	/** Optional streaming callback — when provided, uses invokeStreaming() for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
	/** Optional domain coverage context to inject into system prompt (Adaptive Deep INTAKE) */
	domainCoverageContext?: string;
	/** Current sub-state — used to dispatch CLARIFYING prompt */
	subState?: string;
	/** Current clarification round (1-based) — used by CLARIFYING prompt */
	clarificationRound?: number;
}

/**
 * INTAKE plan synthesis invocation options
 */
export interface IntakePlanSynthesisOptions {
	dialogueId: string;
	currentPlan: IntakePlanDocument;
	provider: RoleCLIProvider;
	tokenBudget: number;
	/** Optional streaming callback — when provided, uses invokeStreaming() for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
	/** Optional domain coverage context for synthesis (Adaptive Deep INTAKE) */
	domainCoverageContext?: string;
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
6. **Suggest Next Steps**: Propose questions the Human should consider

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
      { "id": "REQ-1", "type": "REQUIREMENT", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "decisions": [
      { "id": "DEC-1", "type": "DECISION", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "constraints": [
      { "id": "CON-1", "type": "CONSTRAINT", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "openQuestions": [
      { "id": "Q-1", "type": "OPEN_QUESTION", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "technicalNotes": ["Observation about the codebase..."],
    "proposedApproach": "High-level implementation approach based on discussion so far",
    "lastUpdatedAt": "<ISO-8601>"
  },
  "suggestedQuestions": ["Question the Human might want to consider..."],
  "codebaseFindings": ["path/to/relevant/file - description of what was found"]
}
\`\`\`

# Plan Evolution Rules

- **Carry forward** all items from the previous plan version — do NOT drop items
- **Increment version** by 1 each turn
- **Add new items** as you identify them from the Human's latest message
- **Move items** between sections if the conversation changes their nature (e.g., open question → decision)
- **Update summary and approach** as the picture becomes clearer
- **Use sequential IDs**: REQ-1, REQ-2, DEC-1, CON-1, Q-1, etc.

# Conversation Style

- Be conversational but focused — you're a technical partner in planning
- Ask clarifying questions when requirements are ambiguous
- Proactively surface things the Human may not have considered
- Keep responses concise but thorough
- When you find relevant codebase patterns, explain their implications`;

/**
 * System prompt for plan synthesis (finalization)
 */
const INTAKE_SYNTHESIS_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT role in the JanumiCode autonomous system, performing PLAN SYNTHESIS.

# Your Task

You are synthesizing a conversation between a Human and yourself into a **final structured implementation plan**. You have the full conversation history and the current draft plan. Your job is to:

1. **Consolidate** all requirements, decisions, constraints, and notes into a clean final plan
2. **Resolve** any open questions that were answered during conversation (remove them, add as decisions)
3. **Flag** any truly unresolved open questions that remain
4. **Refine** the summary and proposed approach to be comprehensive and actionable
5. **Ensure completeness** — nothing discussed should be lost

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Summary of what was synthesized and any remaining concerns...",
  "updatedPlan": {
    "version": <number>,
    "title": "Final plan title",
    "summary": "Comprehensive summary of what will be built",
    "requirements": [
      { "id": "REQ-1", "type": "REQUIREMENT", "text": "Full requirement description...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "decisions": [
      { "id": "DEC-1", "type": "DECISION", "text": "Decision description with rationale...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "constraints": [
      { "id": "CON-1", "type": "CONSTRAINT", "text": "Constraint description...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "openQuestions": [
      { "id": "Q-1", "type": "OPEN_QUESTION", "text": "Unresolved question...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "technicalNotes": [...],
    "proposedApproach": "Detailed implementation approach",
    "lastUpdatedAt": "<ISO-8601>"
  },
  "suggestedQuestions": [],
  "codebaseFindings": []
}
\`\`\`

# Synthesis Rules

- The finalized plan should be **self-contained** — readable without the conversation
- **Every item MUST be an object** with id, type, text, extractedFromTurnId, and timestamp fields — NOT a plain string
- The "text" field MUST contain the **full human-readable description** — never omit it
- Preserve the REQ-/DEC-/CON-/Q- ID prefixes from the draft plan; do NOT renumber to R-/D-/C-
- Requirements should be specific and testable where possible
- Decisions should include the rationale (or reference the turn where it was discussed)
- Constraints should distinguish between technical and business constraints
- The proposed approach should be detailed enough to guide the PROPOSE phase
- Open questions should ONLY contain genuinely unresolved items`;

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
		// Build INTAKE-specific context
		const contextResult = await buildIntakeTechnicalExpertContext({
			dialogueId: options.dialogueId,
			humanMessage: options.humanMessage,
			currentPlan: options.currentPlan,
			turnNumber: options.turnNumber,
			tokenBudget: options.tokenBudget,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		// Format context for CLI consumption
		const formattedContext = formatIntakeTechnicalExpertContext(contextResult.value);

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
		let cliResult: Result<RoleCLIResult>;
		if (options.onEvent) {
			cliResult = await options.provider.invokeStreaming(
				{ stdinContent, outputFormat: 'stream-json', autoApprove: true },
				options.onEvent
			);
			// Extract final model response from JSONL stream output
			if (cliResult.success) {
				cliResult.value.response = extractFinalResponseFromStream(cliResult.value.rawOutput);
			}
		} else {
			cliResult = await options.provider.invoke({
				stdinContent,
				outputFormat: 'json',
				autoApprove: true,
			});
		}

		if (!cliResult.success) {
			return cliResult;
		}

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
		// Build context with full conversation history for synthesis
		const contextResult = await buildIntakeTechnicalExpertContext({
			dialogueId: options.dialogueId,
			humanMessage: '[SYSTEM] Synthesize the conversation into a final structured plan.',
			currentPlan: options.currentPlan,
			turnNumber: -1, // Sentinel: synthesis mode
			tokenBudget: options.tokenBudget,
			synthesisMode: true,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		const formattedContext = formatIntakeTechnicalExpertContext(contextResult.value);

		const synthesisPrompt = options.domainCoverageContext
			? `${INTAKE_SYNTHESIS_SYSTEM_PROMPT}\n\n# Domain Coverage Analysis\n\n${options.domainCoverageContext}\n\nEnsure the finalized plan addresses coverage gaps. For domains that were not discussed, add explicit open questions tagged with [Domain Gap: DomainName].`
			: INTAKE_SYNTHESIS_SYSTEM_PROMPT;

		const stdinContent = buildStdinContent(
			synthesisPrompt,
			formattedContext
		);

		// CLI invocation — streaming when onEvent callback provided, one-shot otherwise
		// autoApprove for synthesis too (same read-only sandbox safety)
		let cliResult: Result<RoleCLIResult>;
		if (options.onEvent) {
			cliResult = await options.provider.invokeStreaming(
				{ stdinContent, outputFormat: 'stream-json', autoApprove: true },
				options.onEvent
			);
			if (cliResult.success) {
				cliResult.value.response = extractFinalResponseFromStream(cliResult.value.rawOutput);
			}
		} else {
			cliResult = await options.provider.invoke({
				stdinContent,
				outputFormat: 'json',
				autoApprove: true,
			});
		}

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

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Your interviewer-style response — findings from codebase + targeted questions...",
  "focusDomain": "DOMAIN_ENUM_VALUE",
  "domainNotes": ["Key fact 1...", "Key fact 2...", "Constraint discovered..."],
  "codebaseFindings": ["path/to/file - relevant finding"],
  "followUpQuestions": ["Specific question 1?", "Specific question 2?"]
}
\`\`\`

The "domainNotes" array should capture structured observations:
- Facts the Human stated about this domain
- Constraints or requirements you identified
- Codebase patterns relevant to this domain
- Open questions specific to this domain

The "followUpQuestions" array should contain 2-4 questions that would help deepen understanding of this domain.`;

/**
 * INTAKE gathering mode invocation options
 */
export interface IntakeGatheringExpertOptions {
	dialogueId: string;
	humanMessage: string;
	currentDomain: EngineeringDomain;
	turnNumber: number;
	provider: RoleCLIProvider;
	tokenBudget: number;
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
		let cliResult: Result<RoleCLIResult>;
		if (options.onEvent) {
			cliResult = await options.provider.invokeStreaming(
				{ stdinContent, outputFormat: 'stream-json', autoApprove: true },
				options.onEvent
			);
			if (cliResult.success) {
				cliResult.value.response = extractFinalResponseFromStream(cliResult.value.rawOutput);
			}
		} else {
			cliResult = await options.provider.invoke({
				stdinContent,
				outputFormat: 'json',
				autoApprove: true,
			});
		}

		if (!cliResult.success) {
			return cliResult;
		}

		return parseGatheringTurnResponse(
			cliResult.value.response,
			options.currentDomain
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
					focusDomain: expectedDomain,
					domainNotes: [],
					codebaseFindings: [],
					followUpQuestions: [],
				},
			};
		}

		return {
			success: true,
			value: {
				conversationalResponse: parsed.conversationalResponse,
				focusDomain: isValidEngineeringDomain(parsed.focusDomain) ? parsed.focusDomain : expectedDomain,
				domainNotes: Array.isArray(parsed.domainNotes) ? parsed.domainNotes : [],
				codebaseFindings: Array.isArray(parsed.codebaseFindings) ? parsed.codebaseFindings : [],
				followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
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
				focusDomain: expectedDomain,
				domainNotes: [],
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

// ==================== ANALYZING MODE (SILENT ANALYSIS) ====================

/**
 * System prompt for Technical Expert in ANALYZING mode.
 * Expert silently reads all docs/codebase and produces a comprehensive analysis.
 * NO questions to the user — this is a silent homework phase.
 */
const INTAKE_ANALYZING_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT in the JanumiCode autonomous system, performing SILENT ANALYSIS for the INTAKE phase.

# Your Task

You have received a user's project request. Your job is to perform COMPREHENSIVE analysis BEFORE engaging the user in any conversation. You must:

1. **Read everything referenced**: If the user mentions specs, docs, folders, or files — read them ALL. Leave no referenced document unread.
2. **Investigate the codebase**: Explore the workspace structure, existing patterns, technology choices, configurations, and dependencies.
3. **Assess all 12 engineering domains**: For each domain, determine what you can already infer from the available information.
4. **Identify what ONLY the user can answer**: Distinguish between things you CAN determine from docs/code vs. business decisions that ONLY the user can make.

# Critical Rules

## DO NOT ASK ANY QUESTIONS
This is a SILENT ANALYSIS phase. You produce a comprehensive report. You do NOT ask the user anything. Questions come later, in a separate phase.

## DO YOUR HOMEWORK
- If a spec file is referenced, READ IT completely
- If a directory is mentioned, LIST and READ its contents
- If there is existing code, EXAMINE the relevant patterns
- Do NOT speculate about what a file might contain — READ IT

## ASSESS ALL 12 DOMAINS
For each engineering domain, report what you found (or did not find):
1. PROBLEM_MISSION — Problem statement, mission, vision, value proposition
2. STAKEHOLDERS — Users, personas, roles, organizational stakeholders
3. SCOPE — In-scope vs out-of-scope boundaries, MVP definition, phasing
4. CAPABILITIES — Functional capabilities, features, behaviors
5. WORKFLOWS_USE_CASES — End-to-end workflows, use cases, user journeys
6. DATA_INFORMATION — Data models, storage, schemas, data lifecycle, privacy
7. INTEGRATION_INTERFACES — APIs, third-party services, protocols
8. SECURITY_COMPLIANCE — Authentication, authorization, encryption, compliance
9. QUALITY_ATTRIBUTES — Performance, reliability, scalability, accessibility
10. ENVIRONMENT_OPERATIONS — Deployment, infrastructure, monitoring, CI/CD
11. ARCHITECTURE — System architecture, component structure, design patterns
12. VERIFICATION_DELIVERY — Testing strategy, acceptance criteria, delivery process

## NEVER:
- Ask the user any questions (analysis is silent)
- Make feasibility verdicts ("will work" / "won't work")
- Authorize or suggest starting implementation
- Skip reading referenced documents
- Ask about implementation details like schema formats, field names, or config syntax

# Response Format

Your response MUST be valid JSON:

\`\`\`json
{
  "analysisSummary": "A comprehensive 2-5 paragraph summary of your findings. What the project is about, what you found in the codebase/docs, what the current state is, and what the key technical considerations are.",
  "initialPlan": {
    "version": 1,
    "title": "Plan title based on analysis",
    "summary": "Executive summary synthesized from your analysis",
    "requirements": [{ "id": "REQ-1", "type": "REQUIREMENT", "text": "...", "extractedFromTurnId": 0, "timestamp": "..." }],
    "decisions": [{ "id": "DEC-1", "type": "DECISION", "text": "...", "extractedFromTurnId": 0, "timestamp": "..." }],
    "constraints": [{ "id": "CON-1", "type": "CONSTRAINT", "text": "...", "extractedFromTurnId": 0, "timestamp": "..." }],
    "openQuestions": [{ "id": "Q-1", "type": "OPEN_QUESTION", "text": "...", "extractedFromTurnId": 0, "timestamp": "..." }],
    "technicalNotes": ["Observation from codebase analysis..."],
    "proposedApproach": "Technical approach based on what you found",
    "lastUpdatedAt": "<ISO-8601>"
  },
  "codebaseFindings": ["path/to/file - what was found and why it matters"],
  "domainAssessment": [
    { "domain": "PROBLEM_MISSION", "level": "ADEQUATE", "evidence": "The specs clearly define..." },
    { "domain": "DATA_INFORMATION", "level": "PARTIAL", "evidence": "Schema mentioned but no migration strategy..." },
    { "domain": "SECURITY_COMPLIANCE", "level": "NONE", "evidence": "No security requirements found in any document." }
  ]
}
\`\`\`

# Analysis Quality

Your analysis summary should be the kind of briefing a senior architect would give after spending a day reading all the docs and exploring the codebase. It should demonstrate that you did the work, not just skimmed.

The initialPlan's openQuestions should ONLY contain questions that the USER uniquely can answer:
- Business priorities and scope decisions
- Stakeholder preferences
- Significant technical tradeoffs where different paths have meaningfully different consequences
- NOT implementation details, schema designs, config formats, or things you can determine yourself`;

/**
 * INTAKE analysis mode invocation options
 */
export interface IntakeAnalysisExpertOptions {
	dialogueId: string;
	humanMessage: string;
	provider: RoleCLIProvider;
	tokenBudget: number;
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * Invoke Technical Expert in ANALYZING mode.
 * The Expert silently reads all docs/codebase and produces a comprehensive analysis.
 * Returns IntakeAnalysisTurnResponse with analysis summary + initial plan.
 */
export async function invokeAnalyzingTechnicalExpert(
	options: IntakeAnalysisExpertOptions
): Promise<Result<IntakeAnalysisTurnResponse>> {
	try {
		const stdinContent = buildStdinContent(
			INTAKE_ANALYZING_SYSTEM_PROMPT,
			'# User Request\n\n' + options.humanMessage
		);

		let cliResult: Result<RoleCLIResult>;
		if (options.onEvent) {
			cliResult = await options.provider.invokeStreaming(
				{ stdinContent, outputFormat: 'stream-json', autoApprove: true },
				options.onEvent
			);
			if (cliResult.success) {
				cliResult.value.response = extractFinalResponseFromStream(cliResult.value.rawOutput);
			}
		} else {
			cliResult = await options.provider.invoke({
				stdinContent,
				outputFormat: 'json',
				autoApprove: true,
			});
		}

		if (!cliResult.success) {
			return cliResult;
		}

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
		};

		return {
			success: true,
			value: {
				analysisSummary: parsed.analysisSummary ?? rawResponse,
				initialPlan,
				codebaseFindings: Array.isArray(parsed.codebaseFindings) ? parsed.codebaseFindings : [],
				domainAssessment: Array.isArray(parsed.domainAssessment) ? parsed.domainAssessment : [],
			},
		};
	} catch {
		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'role:technicalExpertIntake:analyzing' })
				.warn('Failed to parse analysis response as JSON, using graceful degradation', {
					rawResponseLength: rawResponse.length,
				});
		}

		const cleanedResponse = extractReadableContent(rawResponse);
		const now = new Date().toISOString();

		return {
			success: true,
			value: {
				analysisSummary: cleanedResponse,
				initialPlan: {
					version: 1,
					title: 'Analysis Draft',
					summary: cleanedResponse.substring(0, 500),
					requirements: [],
					decisions: [],
					constraints: [],
					openQuestions: [],
					technicalNotes: [],
					proposedApproach: '',
					lastUpdatedAt: now,
				},
				codebaseFindings: [],
				domainAssessment: [],
			},
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

You have already completed your analysis and presented your findings and proposed approach to the user. Now you are asking ONLY the questions that the user uniquely needs to answer. ${roundNote}

# What Questions Are Allowed

You may ONLY ask about:

## 1. Business Gaps
Questions about business intent, priorities, and scope that cannot be determined from documents or code.

GOOD examples:
- "The specs mention both residential and commercial properties. Should V1 support both, or should we start with residential only?"
- "I see three possible user roles (resident, property manager, admin). Which role's experience should we prioritize for the initial release?"
- "The design doc mentions a notification system but doesn't specify channels. Do you need email, SMS, push notifications, or some combination?"

BAD examples (NEVER ask these):
- "What database schema should we use for properties?" (YOU decide this)
- "Should we use REST or GraphQL?" (YOU decide this unless consequences are material to the user)
- "What format should the config file be in?" (Implementation detail)

## 2. Significant Technical Tradeoffs
Questions where different technical choices lead to meaningfully different outcomes that the user cares about (cost, timeline, capability).

GOOD examples:
- "We could build real-time updates using WebSockets (faster but more complex to deploy) or polling (simpler but 30-second delay). Real-time matters for [specific feature]. Which tradeoff do you prefer?"
- "Supporting offline mode would add roughly 2-3 weeks to the timeline but would let field inspectors work without connectivity. Is that worth it?"

BAD examples (NEVER ask these):
- "Should we use Redux or Zustand for state management?" (Not consequential to the user)
- "Should the API return JSON or protobuf?" (You decide)
- "What OpenTelemetry fields should we track?" (Implementation detail)

## 3. For Each Question, Explain WHY
Every question MUST include a brief explanation of why the user needs to decide this (not the Expert). Format each question as:
"[Question text] — **Why this matters:** [1-sentence explanation of the consequence of different answers]"

# Constraints

- Ask a MAXIMUM of ${MAX_CLARIFICATION_QUESTIONS} questions per round
- Group questions by theme (business scope, user experience, technical tradeoffs)
- If you have no genuine business questions remaining, say so explicitly and include ${CLARIFICATION_COMPLETE_TAG} at the end of your conversationalResponse
- NEVER ask about: schema designs, field names, file formats, config syntax, library choices, naming conventions, test framework selection, or any detail you can determine yourself
- Carry forward all previous plan items — do NOT drop anything

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Brief context + your questions, grouped by theme. Each question explains WHY the user needs to decide.",
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
    "lastUpdatedAt": "<ISO-8601>"
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
 * For other modes (DOMAIN_GUIDED, HYBRID_CHECKPOINTS), it appends advisory
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

	// DOMAIN_GUIDED and HYBRID_CHECKPOINTS: append coverage context as advisory
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
				}
			: {
					...previousPlan,
					version: previousPlan.version + 1,
					lastUpdatedAt: new Date().toISOString(),
				};

		const response: IntakeTurnResponse = {
			conversationalResponse: parsed.conversationalResponse,
			updatedPlan,
			suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
				? parsed.suggestedQuestions
				: undefined,
			codebaseFindings: Array.isArray(parsed.codebaseFindings)
				? parsed.codebaseFindings
				: undefined,
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

		const cleanedResponse = extractReadableContent(rawResponse);

		return {
			success: true,
			value: {
				conversationalResponse: cleanedResponse,
				updatedPlan: {
					...previousPlan,
					version: previousPlan.version + 1,
					lastUpdatedAt: new Date().toISOString(),
				},
			},
		};
	}
}

/**
 * Extract the final model response from JSONL stream output.
 * Walks backward through lines looking for a result event.
 * Falls back to extractReadableContent() if no result event found.
 */
function extractFinalResponseFromStream(rawOutput: string): string {
	const lines = rawOutput.split('\n').filter((l) => l.trim());
	// Walk backward to find a result event (emitted last by most CLIs)
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const event = JSON.parse(lines[i]);
			// Claude Code result event
			if (event.type === 'result' && typeof event.result === 'string') {
				return event.result;
			}
			// Codex result event
			if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
				return event.item.text;
			}
			// Generic response field
			if (event.type === 'result' && typeof event.response === 'string') {
				return event.response;
			}
		} catch { /* skip non-JSON lines */ }
	}
	// Fallback: delegate to existing readable content extractor
	return extractReadableContent(rawOutput);
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
	const m = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
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
			timestamp: (item.timestamp as string) ?? new Date().toISOString(),
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
