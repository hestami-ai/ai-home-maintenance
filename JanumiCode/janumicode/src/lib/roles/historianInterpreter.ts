/**
 * Historian-Interpreter Role (Agent)
 * Implements Phase 6.5: Contradiction detection, invariant violation detection, precedent surfacing
 * This is an LLM-backed agent that analyzes historical context without modifying it
 */

import type { Result, Claim } from '../types';
import {
	buildHistorianInterpreterContext,
	formatHistorianInterpreterContext,
	HistorianQueryType,
} from '../context';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { buildStdinContent } from '../cli/types';
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
	tokenBudget: number;
	provider: RoleCLIProvider;
	temperature?: number;
	timeWindowDays?: number;
	commandId?: string;
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
		// Build Historian-Interpreter context pack
		const contextResult = await buildHistorianInterpreterContext({
			dialogueId: options.dialogueId,
			query: options.query,
			queryType: options.queryType,
			relatedClaimIds: options.relatedClaimIds,
			tokenBudget: options.tokenBudget,
			timeWindowDays: options.timeWindowDays,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		const context = contextResult.value;

		// Format context for CLI invocation
		const formattedContext = formatHistorianInterpreterContext(context);

		// Build stdin content: system prompt + formatted context
		const stdinContent = buildStdinContent(HISTORIAN_INTERPRETER_SYSTEM_PROMPT, formattedContext);

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

		// Invoke via RoleCLIProvider (CLI tool or API adapter)
		const cliResult = await options.provider.invoke({
			stdinContent,
			outputFormat: 'json',
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
		const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
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
 * Check for contradictions between a claim and historical claims
 * Convenience wrapper for CONTRADICTION_CHECK query type
 *
 * @param dialogueId Dialogue ID
 * @param claim Claim to check
 * @param provider LLM provider
 * @param tokenBudget Token budget
 * @returns Result containing contradiction findings
 */
export async function checkForContradictions(
	dialogueId: string,
	claim: Claim,
	provider: RoleCLIProvider,
	tokenBudget: number
): Promise<Result<ContradictionFinding[]>> {
	const result = await invokeHistorianInterpreter({
		dialogueId,
		query: `Check for contradictions with: ${claim.statement}`,
		queryType: HistorianQueryType.CONTRADICTION_CHECK,
		relatedClaimIds: [claim.claim_id],
		tokenBudget,
		provider,
	});

	if (!result.success) {
		return result;
	}

	return { success: true, value: result.value.contradictions };
}

/**
 * Search for precedents related to a query
 * Convenience wrapper for PRECEDENT_SEARCH query type
 *
 * @param dialogueId Dialogue ID
 * @param query Query describing the decision context
 * @param provider LLM provider
 * @param tokenBudget Token budget
 * @returns Result containing precedent findings
 */
export async function searchPrecedents(
	dialogueId: string,
	query: string,
	provider: RoleCLIProvider,
	tokenBudget: number
): Promise<Result<PrecedentFinding[]>> {
	const result = await invokeHistorianInterpreter({
		dialogueId,
		query,
		queryType: HistorianQueryType.PRECEDENT_SEARCH,
		tokenBudget,
		provider,
	});

	if (!result.success) {
		return result;
	}

	return { success: true, value: result.value.precedents };
}
