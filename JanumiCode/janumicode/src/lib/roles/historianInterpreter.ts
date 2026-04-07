/**
 * Historian-Interpreter Role (Agent)
 * Implements Phase 6.5: Contradiction detection, invariant violation detection, precedent surfacing
 * This is an LLM-backed agent that analyzes historical context without modifying it
 */

import { Role, Phase } from '../types';
import type { Result, Claim, Verdict } from '../types';
import { assembleContext, HistorianQueryType } from '../context';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { nanoid } from 'nanoid';
import { getLogger, isLoggerInitialized } from '../logging';
import { emitWorkflowCommand } from '../integration/eventBus';

/**
 * Historian-Interpreter invocation options
 */
export interface HistorianInterpreterInvocationOptions {
	dialogueId: string;
	query: string;
	queryType: HistorianQueryType;
	relatedClaimIds?: string[];
	provider: RoleCLIProvider;
	temperature?: number;
	timeWindowDays?: number;
	commandId?: string;
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * Contradiction finding
 */
export interface ContradictionFinding {
	finding_id: string;
	current_claim_id: string;
	historical_claim_id: string;
	contradiction_summary: string;
	severity: 'HIGH' | 'MEDIUM' | 'LOW';
	resolution_suggestion?: string;
}

/**
 * Invariant violation
 */
export interface InvariantViolation {
	violation_id: string;
	invariant_description: string;
	violating_claim_id?: string;
	violating_decision_id?: string;
	violation_summary: string;
	severity: 'CRITICAL' | 'WARNING';
}

/**
 * Precedent finding
 */
export interface PrecedentFinding {
	finding_id: string;
	precedent_decision_id: string;
	relevance_score: number;
	summary: string;
	applicable_context: string;
}

/**
 * Historian-Interpreter response
 */
export interface HistorianInterpreterResponse {
	query_type: HistorianQueryType;
	findings: string[];
	contradictions: ContradictionFinding[];
	invariant_violations: InvariantViolation[];
	precedents: PrecedentFinding[];
	summary: string;
	raw_response: string;
}

// ==================== ADJUDICATION TYPES ====================

/**
 * Per-claim adjudication verdict (distinct from Verifier verdicts).
 * - CONSISTENT: Claim aligns with specs, historical decisions, and project constraints
 * - INCONSISTENT: Claim contradicts established specs/decisions/patterns
 * - CONDITIONAL: Claim is consistent IF certain conditions hold
 * - UNKNOWN: Insufficient historical data to adjudicate
 */
export type AdjudicationVerdict = 'CONSISTENT' | 'INCONSISTENT' | 'CONDITIONAL' | 'UNKNOWN';

/**
 * Per-claim adjudication result from the Historian
 */
export interface ClaimAdjudication {
	claim_id: string;
	verdict: AdjudicationVerdict;
	rationale: string;
	citations: string[];
	conflicts?: string[];
	conditions?: string[];
	verification_queries?: string[];
}

/**
 * Historian adjudication response — per-claim consistency check against historical record
 */
export interface HistorianAdjudicationResponse {
	claim_adjudications: ClaimAdjudication[];
	general_findings: string[];
	contradictions: ContradictionFinding[];
	invariant_violations: InvariantViolation[];
	precedents: PrecedentFinding[];
	summary: string;
	raw_response: string;
}

const VALID_ADJUDICATION_VERDICTS: AdjudicationVerdict[] = ['CONSISTENT', 'INCONSISTENT', 'CONDITIONAL', 'UNKNOWN'];

/**
 * System prompt template for Historian-Interpreter
 */
const HISTORIAN_INTERPRETER_SYSTEM_PROMPT = `You are the HISTORIAN-INTERPRETER role in the JanumiCode autonomous system.

# Your Responsibilities

1. **Detect Contradictions**: Identify conflicts between current and historical state
2. **Detect Invariant Violations**: Flag violations of system invariants or governance rules
3. **Surface Precedents**: Find relevant historical decisions and patterns
4. **Provide Temporal Context**: Explain how current state relates to history
5. **Analyze Patterns**: Identify suspicious patterns or anomalies

# Critical Guardrails

## NEVER Modify History
- You are READ-ONLY - you CANNOT change historical events
- Do NOT suggest rewriting or undoing past decisions
- Do NOT propose ways to "fix" historical contradictions
- Your role is to REPORT, not to RESOLVE

## NEVER Override Verifier Verdicts
- You have NO authority to challenge verification results
- Do NOT re-verify claims or second-guess verdicts
- Do NOT propose alternative interpretations of evidence
- Focus on temporal patterns, not technical verification

## ALWAYS Respect Temporal Order
- Present events in chronological order
- Clearly distinguish past from present
- Note when historical precedents may no longer apply
- Track state evolution over time

# Query Types

## CONTRADICTION_CHECK
Identify conflicts between current claims and historical claims:
- Find claims that directly contradict each other
- Assess severity (HIGH: critical claims, MEDIUM: important claims, LOW: minor claims)
- Summarize the nature of the contradiction
- Do NOT suggest resolutions

## PRECEDENT_SEARCH
Find relevant historical decisions:
- Search for similar past decisions
- Score relevance to current context
- Summarize applicable lessons
- Note any changed circumstances

## INVARIANT_VIOLATION
Detect violations of system invariants:
- Check for broken governance rules
- Flag violations of established patterns
- Assess severity (CRITICAL: system integrity, WARNING: best practice)
- Identify violating events

## GENERAL_HISTORY
Provide temporal context:
- Timeline of relevant events
- Pattern analysis
- Anomaly detection
- Historical trends

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "findings": [
    "Finding 1: ...",
    "Finding 2: ..."
  ],
  "contradictions": [
    {
      "current_claim_id": "claim_xyz",
      "historical_claim_id": "claim_abc",
      "contradiction_summary": "Description of contradiction",
      "severity": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "invariant_violations": [
    {
      "invariant_description": "What invariant was violated",
      "violating_claim_id": "claim_xyz",
      "violation_summary": "Description of violation",
      "severity": "CRITICAL" | "WARNING"
    }
  ],
  "precedents": [
    {
      "precedent_decision_id": "decision_abc",
      "relevance_score": 0.0-1.0,
      "summary": "What this precedent shows",
      "applicable_context": "When/how this precedent applies"
    }
  ],
  "summary": "Overall historical analysis summary"
}
\`\`\`

# Context

You will receive:
- **Historical Query**: The specific question or check to perform
- **Current State Snapshot**: Current claims, verdicts, and decisions
- **Historical Findings**: Relevant historical events and patterns
- **Constraint Manifest**: Current system constraints

Process this context carefully and generate your response in the required JSON format.
Focus on identifying patterns and anomalies without attempting to resolve them.`;

/**
 * System prompt for per-claim consistency adjudication.
 * The Historian evaluates each claim against the historical record and specifications.
 */
const HISTORIAN_ADJUDICATION_SYSTEM_PROMPT = `You are the HISTORIAN-INTERPRETER role acting as a CONSISTENCY ADJUDICATOR in the JanumiCode autonomous system.

# Your Mission

You receive a set of claims (surfaced assumptions about the project) along with the Verifier's verdict on each. Your job is to evaluate each claim against the **historical record** — specifications, past decisions, decision traces, and established patterns — and produce a per-claim **consistency adjudication**.

You are NOT re-verifying claims (that is the Verifier's job). You are checking whether each claim is **consistent with what the project has already decided, documented, and established**.

# Adjudication Verdicts

For each claim, assign exactly ONE verdict:

## CONSISTENT
The claim aligns with specifications, historical decisions, and project constraints. Cite the specific evidence that supports consistency.

## INCONSISTENT
The claim contradicts established specs, past decisions, or documented patterns. List the specific conflicts with references (e.g., spec section, decision trace turn number, prior claim ID).

## CONDITIONAL
The claim is consistent IF certain conditions hold that are not yet established. List the specific conditions that must be true.

## UNKNOWN
There is insufficient historical data to determine consistency. List what evidence would be needed to adjudicate (verification queries).

# Critical Guardrails

## NEVER Modify History
- You are READ-ONLY — you CANNOT change historical events
- Do NOT suggest rewriting or undoing past decisions
- Your role is to REPORT consistency, not to RESOLVE conflicts

## NEVER Override Verifier Verdicts
- You have NO authority to challenge the Verifier's technical verdict
- Your adjudication is INDEPENDENT — a claim can be Verifier:VERIFIED but Historian:INCONSISTENT (e.g., technically true but contradicts a prior decision)
- Similarly, Verifier:DISPROVED + Historian:CONSISTENT is possible (e.g., claim is false, but is consistent with what was historically believed)

## Evidence-Based Only
- Every verdict MUST cite specific evidence
- CONSISTENT requires at least one supporting citation
- INCONSISTENT requires at least one conflict reference
- CONDITIONAL requires at least one condition
- UNKNOWN requires at least one verification query describing what's missing

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "claim_adjudications": [
    {
      "claim_id": "the_claim_id_from_input",
      "verdict": "CONSISTENT|INCONSISTENT|CONDITIONAL|UNKNOWN",
      "rationale": "Why this verdict — be specific and evidence-driven",
      "citations": ["spec: Document Name §Section", "decision: Turn N — what was decided"],
      "conflicts": ["Only for INCONSISTENT: specific conflict description"],
      "conditions": ["Only for CONDITIONAL: what must hold"],
      "verification_queries": ["Only for UNKNOWN: what evidence is missing"]
    }
  ],
  "general_findings": [
    "Cross-cutting pattern or observation that applies broadly"
  ],
  "contradictions": [
    {
      "current_claim_id": "claim_xyz",
      "historical_claim_id": "claim_abc",
      "contradiction_summary": "Description",
      "severity": "HIGH|MEDIUM|LOW"
    }
  ],
  "invariant_violations": [
    {
      "invariant_description": "What invariant was violated",
      "violating_claim_id": "claim_xyz",
      "violation_summary": "Description",
      "severity": "CRITICAL|WARNING"
    }
  ],
  "precedents": [
    {
      "precedent_decision_id": "decision_abc",
      "relevance_score": 0.0,
      "summary": "What this precedent shows",
      "applicable_context": "When/how it applies"
    }
  ],
  "summary": "Overall consistency assessment — how well do these claims align with the historical record?"
}
\`\`\`

# Important Notes

- You MUST produce an adjudication entry for EVERY claim provided in the input
- claim_id values in your output MUST exactly match the claim_id values from the input
- Prefer INCONSISTENT over UNKNOWN when there IS contradictory evidence
- Prefer CONDITIONAL over CONSISTENT when there are unresolved dependencies
- The "general_findings" array should capture cross-cutting observations that don't attach to a single claim
- Keep rationales concise but specific — cite document names, section numbers, turn numbers, or claim IDs`;

/**
 * Invoke Historian-Interpreter agent
 * Analyzes historical context and surfaces findings
 *
 * @param options Invocation options
 * @returns Result containing Historian-Interpreter response
 */
export async function invokeHistorianInterpreter(
	options: HistorianInterpreterInvocationOptions
): Promise<Result<HistorianInterpreterResponse>> {
	try {
		// Build Historian-Interpreter context via Context Engineer
		const contextResult = await assembleContext({
			dialogueId: options.dialogueId,
			role: Role.HISTORIAN,
			phase: Phase.HISTORICAL_CHECK,
			intent: options.queryType,
			extras: { query: options.query, queryType: options.queryType, relatedClaimIds: options.relatedClaimIds, timeWindowDays: options.timeWindowDays },
			onEvent: options.onEvent,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		// Build stdin content: system prompt + assembled briefing
		const stdinContent = buildStdinContent(HISTORIAN_INTERPRETER_SYSTEM_PROMPT, contextResult.value.briefing);

		// Emit full stdin content for observability (expandable in command block UI)
		if (options.commandId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Historian',
				summary: '── stdin ──',
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		// Invoke via RoleCLIProvider — streaming when onEvent provided
		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {
			return cliResult;
		}

		const rawResponse = cliResult.value.response;

		// Parse response
		const parseResult = parseHistorianInterpreterResponse(
			rawResponse,
			options.queryType
		);

		if (!parseResult.success) {
			return parseResult;
		}

		// Validate response
		const validationResult = validateHistorianInterpreterResponse(
			parseResult.value
		);

		if (!validationResult.success) {
			return validationResult;
		}

		return { success: true, value: parseResult.value };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke Historian-Interpreter'),
		};
	}
}

/**
 * Parse Historian-Interpreter response from LLM
 */
function parseHistorianInterpreterResponse(
	rawResponse: string,
	queryType: HistorianQueryType
): Result<HistorianInterpreterResponse> {
	try {
		// Extract JSON from response (handle markdown code blocks)
		let jsonStr = rawResponse.trim();

		// Remove markdown code blocks if present
		const jsonMatch = jsonStr.match(/```json\s*([\s\S]*)\s*```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1];
		} else {
			// Try to find JSON object
			const objMatch = jsonStr.match(/\{[\s\S]*\}/);
			if (objMatch) {
				jsonStr = objMatch[0];
			}
		}

		const parsed = JSON.parse(jsonStr);

		// Validate structure
		if (!Array.isArray(parsed.findings)) {
			return {
				success: false,
				error: new Error(
					'Historian-Interpreter response missing or invalid findings'
				),
			};
		}

		if (!Array.isArray(parsed.contradictions)) {
			return {
				success: false,
				error: new Error(
					'Historian-Interpreter response missing or invalid contradictions'
				),
			};
		}

		if (!Array.isArray(parsed.invariant_violations)) {
			return {
				success: false,
				error: new Error(
					'Historian-Interpreter response missing or invalid invariant_violations'
				),
			};
		}

		if (!Array.isArray(parsed.precedents)) {
			return {
				success: false,
				error: new Error(
					'Historian-Interpreter response missing or invalid precedents'
				),
			};
		}

		if (!parsed.summary || typeof parsed.summary !== 'string') {
			return {
				success: false,
				error: new Error(
					'Historian-Interpreter response missing or invalid summary'
				),
			};
		}

		// Add IDs to findings
		const contradictions: ContradictionFinding[] = parsed.contradictions.map(
			(c: Partial<ContradictionFinding>) => ({
				finding_id: nanoid(),
				current_claim_id: c.current_claim_id || '',
				historical_claim_id: c.historical_claim_id || '',
				contradiction_summary: c.contradiction_summary || '',
				severity: c.severity || 'MEDIUM',
				resolution_suggestion: c.resolution_suggestion,
			})
		);

		const invariantViolations: InvariantViolation[] =
			parsed.invariant_violations.map(
				(v: Partial<InvariantViolation>) => ({
					violation_id: nanoid(),
					invariant_description: v.invariant_description || '',
					violating_claim_id: v.violating_claim_id,
					violating_decision_id: v.violating_decision_id,
					violation_summary: v.violation_summary || '',
					severity: v.severity || 'WARNING',
				})
			);

		const precedents: PrecedentFinding[] = parsed.precedents.map(
			(p: Partial<PrecedentFinding>) => ({
				finding_id: nanoid(),
				precedent_decision_id: p.precedent_decision_id || '',
				relevance_score: p.relevance_score || 0.0,
				summary: p.summary || '',
				applicable_context: p.applicable_context || '',
			})
		);

		const response: HistorianInterpreterResponse = {
			query_type: queryType,
			findings: parsed.findings,
			contradictions,
			invariant_violations: invariantViolations,
			precedents,
			summary: parsed.summary,
			raw_response: rawResponse,
		};

		return { success: true, value: response };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to parse Historian-Interpreter response'),
		};
	}
}

/**
 * Validate Historian-Interpreter response
 * Ensure guardrails are not violated
 */
function validateHistorianInterpreterResponse(
	response: HistorianInterpreterResponse
): Result<void> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate contradictions
	for (const contradiction of response.contradictions) {
		const validSeverities = ['HIGH', 'MEDIUM', 'LOW'];
		if (!validSeverities.includes(contradiction.severity)) {
			errors.push(
				`Invalid contradiction severity: ${contradiction.severity}`
			);
		}

		// Check for resolution suggestions (forbidden)
		if (contradiction.resolution_suggestion) {
			warnings.push(
				`Contradiction finding includes resolution suggestion (discouraged): ${contradiction.finding_id}`
			);
		}
	}

	// Validate invariant violations
	for (const violation of response.invariant_violations) {
		const validSeverities = ['CRITICAL', 'WARNING'];
		if (!validSeverities.includes(violation.severity)) {
			errors.push(`Invalid violation severity: ${violation.severity}`);
		}
	}

	// Validate precedents
	for (const precedent of response.precedents) {
		if (
			precedent.relevance_score < 0 ||
			precedent.relevance_score > 1
		) {
			errors.push(
				`Invalid relevance score: ${precedent.relevance_score} (must be 0-1)`
			);
		}
	}

	// Check for history modification attempts (forbidden)
	const summary = response.summary.toLowerCase();
	const modificationPatterns = [
		/we should (rewrite|undo|reverse)/i,
		/(fix|correct|change) (the )?history/i,
		/remove (this|that|these) (decision|claim)/i,
		/override (the|this) (past|previous)/i,
	];

	for (const pattern of modificationPatterns) {
		if (pattern.test(summary)) {
			errors.push(
				`Summary contains history modification attempt (forbidden): "${pattern.source}"`
			);
		}
	}

	// Check for verdict override attempts (forbidden)
	const verdictOverridePatterns = [
		/this verdict is (wrong|incorrect|invalid)/i,
		/the verifier (should|must) (re-verify|reconsider)/i,
		/i (disagree|dispute) with (the|this) verdict/i,
	];

	for (const pattern of verdictOverridePatterns) {
		if (pattern.test(summary)) {
			errors.push(
				`Summary contains verdict override attempt (forbidden): "${pattern.source}"`
			);
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Historian-Interpreter response validation failed:\n${errors.join('\n')}\n\nWarnings:\n${warnings.join('\n')}`
			),
		};
	}

	if (warnings.length > 0 && isLoggerInitialized()) {
		getLogger().child({ component: 'role:historian' }).warn('Historian-Interpreter response warnings', { warnings });
	}

	return { success: true, value: undefined };
}

/**
 * Check for contradictions between a claim and historical claims.
 * Convenience wrapper for CONTRADICTION_CHECK query type.
 */
export async function checkForContradictions(
	dialogueId: string,
	claim: Claim,
	provider: RoleCLIProvider,
): Promise<Result<ContradictionFinding[]>> {
	const result = await invokeHistorianInterpreter({
		dialogueId,
		query: `Check for contradictions with: ${claim.statement}`,
		queryType: HistorianQueryType.CONTRADICTION_CHECK,
		relatedClaimIds: [claim.claim_id],
		provider,
	});

	if (!result.success) {
		return result;
	}

	return { success: true, value: result.value.contradictions };
}

/**
 * Search for precedents related to a query.
 * Convenience wrapper for PRECEDENT_SEARCH query type.
 */
export async function searchPrecedents(
	dialogueId: string,
	query: string,
	provider: RoleCLIProvider,
): Promise<Result<PrecedentFinding[]>> {
	const result = await invokeHistorianInterpreter({
		dialogueId,
		query,
		queryType: HistorianQueryType.PRECEDENT_SEARCH,
		provider,
	});

	if (!result.success) {
		return result;
	}

	return { success: true, value: result.value.precedents };
}

// ==================== ADJUDICATION INVOCATION ====================

/**
 * Adjudication invocation options
 */
export interface HistorianAdjudicationOptions {
	dialogueId: string;
	claims: Claim[];
	verdicts: Verdict[];
	provider: RoleCLIProvider;
	commandId?: string;
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * Invoke Historian for per-claim consistency adjudication.
 * Evaluates each claim against the historical record and specifications.
 * Single LLM call for all claims.
 */
export async function invokeHistorianAdjudication(
	options: HistorianAdjudicationOptions
): Promise<Result<HistorianAdjudicationResponse>> {
	try {
		// Build adjudication-specific context via Context Engineer
		const contextResult = await assembleContext({
			dialogueId: options.dialogueId,
			role: Role.HISTORIAN,
			phase: Phase.HISTORICAL_CHECK,
			subPhase: 'ADJUDICATION',
			extras: { conflictingVerdicts: options.verdicts, claims: options.claims },
			onEvent: options.onEvent,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		// Build stdin: adjudication prompt + assembled briefing
		const stdinContent = buildStdinContent(HISTORIAN_ADJUDICATION_SYSTEM_PROMPT, contextResult.value.briefing);

		// Emit stdin for observability
		if (options.commandId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Historian',
				summary: '── stdin (adjudication) ──',
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

		// Invoke via provider — streaming when onEvent provided
		const cliResult = await invokeRoleStreaming({
			provider: options.provider,
			stdinContent,
			onEvent: options.onEvent,
		});

		if (!cliResult.success) {
			return cliResult;
		}

		// Parse response
		const parseResult = parseAdjudicationResponse(
			cliResult.value.response,
			options.claims.map(c => c.claim_id),
		);

		if (!parseResult.success) {
			return parseResult;
		}

		// Validate response
		const validationResult = validateAdjudicationResponse(parseResult.value);
		if (!validationResult.success) {
			return validationResult;
		}

		return { success: true, value: parseResult.value };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error
				? error
				: new Error('Failed to invoke Historian adjudication'),
		};
	}
}

/**
 * Parse adjudication response from LLM
 */
function parseAdjudicationResponse(
	rawResponse: string,
	knownClaimIds: string[],
): Result<HistorianAdjudicationResponse> {
	try {
		// Extract JSON from response (handle markdown code blocks)
		let jsonStr = rawResponse.trim();
		const jsonMatch = jsonStr.match(/```json\s*([\s\S]*)\s*```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1];
		} else {
			const objMatch = jsonStr.match(/\{[\s\S]*\}/);
			if (objMatch) {
				jsonStr = objMatch[0];
			}
		}

		const parsed = JSON.parse(jsonStr);

		// Validate required top-level fields
		if (!Array.isArray(parsed.claim_adjudications)) {
			return {
				success: false,
				error: new Error('Adjudication response missing claim_adjudications array'),
			};
		}

		// Parse claim adjudications
		const adjudications: ClaimAdjudication[] = parsed.claim_adjudications.map((adj: any) => ({
			claim_id: String(adj.claim_id ?? ''),
			verdict: String(adj.verdict ?? 'UNKNOWN') as AdjudicationVerdict,
			rationale: String(adj.rationale ?? ''),
			citations: Array.isArray(adj.citations) ? adj.citations.map(String) : [],
			conflicts: Array.isArray(adj.conflicts) ? adj.conflicts.map(String) : undefined,
			conditions: Array.isArray(adj.conditions) ? adj.conditions.map(String) : undefined,
			verification_queries: Array.isArray(adj.verification_queries) ? adj.verification_queries.map(String) : undefined,
		}));

		// Parse structured findings (reuse existing parsing logic)
		const contradictions: ContradictionFinding[] = (parsed.contradictions ?? []).map((c: any) => ({
			finding_id: nanoid(),
			current_claim_id: String(c.current_claim_id ?? ''),
			historical_claim_id: String(c.historical_claim_id ?? ''),
			contradiction_summary: String(c.contradiction_summary ?? ''),
			severity: String(c.severity ?? 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
		}));

		const invariant_violations: InvariantViolation[] = (parsed.invariant_violations ?? []).map((v: any) => ({
			violation_id: nanoid(),
			invariant_description: String(v.invariant_description ?? ''),
			violating_claim_id: v.violating_claim_id ? String(v.violating_claim_id) : undefined,
			violating_decision_id: v.violating_decision_id ? String(v.violating_decision_id) : undefined,
			violation_summary: String(v.violation_summary ?? ''),
			severity: String(v.severity ?? 'WARNING') as 'CRITICAL' | 'WARNING',
		}));

		const precedents: PrecedentFinding[] = (parsed.precedents ?? []).map((p: any) => ({
			finding_id: nanoid(),
			precedent_decision_id: String(p.precedent_decision_id ?? ''),
			relevance_score: typeof p.relevance_score === 'number' ? p.relevance_score : 0,
			summary: String(p.summary ?? ''),
			applicable_context: String(p.applicable_context ?? ''),
		}));

		// Log claim_id mismatches (non-fatal — LLM may abbreviate or miss some)
		const returnedIds = new Set(adjudications.map(a => a.claim_id));
		const missingIds = knownClaimIds.filter(id => !returnedIds.has(id));
		if (missingIds.length > 0 && isLoggerInitialized()) {
			getLogger().child({ component: 'role:historian' }).warn(
				'Adjudication missing some claim_ids',
				{ missingIds, totalClaims: knownClaimIds.length, returnedCount: adjudications.length }
			);
		}

		return {
			success: true,
			value: {
				claim_adjudications: adjudications,
				general_findings: Array.isArray(parsed.general_findings)
					? parsed.general_findings.map(String)
					: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [],
				contradictions,
				invariant_violations,
				precedents,
				summary: String(parsed.summary ?? ''),
				raw_response: rawResponse,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error
				? error
				: new Error('Failed to parse adjudication response'),
		};
	}
}

/**
 * Validate adjudication response for guardrail compliance
 */
function validateAdjudicationResponse(
	response: HistorianAdjudicationResponse
): Result<void> {
	const errors: string[] = [];

	// Validate each adjudication has a valid verdict
	for (const adj of response.claim_adjudications) {
		if (!VALID_ADJUDICATION_VERDICTS.includes(adj.verdict)) {
			errors.push(`Invalid adjudication verdict "${adj.verdict}" for claim ${adj.claim_id}`);
		}
		if (!adj.rationale || adj.rationale.trim().length === 0) {
			errors.push(`Missing rationale for claim ${adj.claim_id}`);
		}
	}

	// Validate contradiction severities
	for (const c of response.contradictions) {
		if (!['HIGH', 'MEDIUM', 'LOW'].includes(c.severity)) {
			errors.push(`Invalid contradiction severity: ${c.severity}`);
		}
	}

	// Validate invariant violation severities
	for (const v of response.invariant_violations) {
		if (!['CRITICAL', 'WARNING'].includes(v.severity)) {
			errors.push(`Invalid invariant violation severity: ${v.severity}`);
		}
	}

	// Validate precedent relevance scores
	for (const p of response.precedents) {
		if (p.relevance_score < 0 || p.relevance_score > 1) {
			errors.push(`Invalid precedent relevance score: ${p.relevance_score}`);
		}
	}

	// Check summary for guardrail violations
	const summary = response.summary + ' ' + response.claim_adjudications.map(a => a.rationale).join(' ');

	const modificationPatterns = [
		/we should (rewrite|undo|reverse)/i,
		/(fix|correct|change) (the )?history/i,
	];
	for (const pattern of modificationPatterns) {
		if (pattern.test(summary)) {
			errors.push(`Response contains history modification attempt: "${pattern.source}"`);
		}
	}

	const verdictOverridePatterns = [
		/this verdict is (wrong|incorrect|invalid)/i,
		/the verifier (should|must) (re-verify|reconsider)/i,
	];
	for (const pattern of verdictOverridePatterns) {
		if (pattern.test(summary)) {
			errors.push(`Response contains verdict override attempt: "${pattern.source}"`);
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(`Adjudication validation failed:\n${errors.join('\n')}`),
		};
	}

	return { success: true, value: undefined };
}
