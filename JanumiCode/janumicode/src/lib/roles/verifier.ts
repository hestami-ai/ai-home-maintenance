/**
 * Verifier Role (Agent/Gate)
 * Implements Phase 6.4: Claim normalization, disconfirming query generation, verdict emission
 * This is an LLM-backed agent that verifies claims against authoritative evidence
 */

import type {
	Result,
	Claim,
	Verdict,
	VerdictStatus,
} from '../types';
import { VerdictType, Phase, Role as RoleEnum } from '../types';
import { assembleContext } from '../context';
import { getDatabase } from '../database';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import { getLogger, isLoggerInitialized } from '../logging';
import { emitWorkflowCommand } from '../integration/eventBus';

/**
 * Verifier invocation options
 */
export interface VerifierInvocationOptions {
	dialogueId: string;
	claimToVerify: Claim;
	tokenBudget: number;
	provider: RoleCLIProvider;
	temperature?: number;
	includeHistoricalVerdicts?: boolean;
	checkForContradictions?: boolean;
	commandId?: string;
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * Disconfirming query
 */
export interface DisconfirmingQuery {
	query_id: string;
	query: string;
	rationale: string;
}

/**
 * Evidence classification
 */
export interface EvidenceClassification {
	classification_id: string;
	source: string;
	type: 'AUTHORITATIVE' | 'SUPPORTING' | 'ANECDOTAL' | 'SPECULATIVE';
	confidence: number;
	summary: string;
}

/**
 * Claim scope classification (MAKER integration)
 * Indicates the granularity of a claim for decomposition quality assessment.
 */
export type ClaimScopeClassification = 'ATOMIC' | 'COMPOSITE' | 'VAGUE';

/**
 * Verifier response
 */
export interface VerifierResponse {
	normalized_claim: string;
	disconfirming_queries: DisconfirmingQuery[];
	evidence_classifications: EvidenceClassification[];
	verdict: VerdictStatus;
	rationale: string;
	constraints_ref?: string;
	evidence_ref?: string;
	/** Claim scope classification — how granular/specific the claim is */
	claim_scope?: ClaimScopeClassification;
	/** Whether the claim is too broad for verification and should be decomposed */
	decompose_required?: boolean;
	/** Whether this claim involves a technology/library not currently in the project */
	novel_dependency?: boolean;
	raw_response: string;
}

/**
 * System prompt template for Verifier
 */
const VERIFIER_SYSTEM_PROMPT = `You are the VERIFIER role in the JanumiCode autonomous system.

# Your Responsibilities

1. **Normalize Claims**: Rephrase claims into testable, unambiguous statements
2. **Generate Disconfirming Queries**: Create queries that could disprove the claim
3. **Classify Evidence**: Categorize available evidence by authority and confidence
4. **Emit Verdicts**: Issue one of four verdicts based on evidence
5. **Conservative Reasoning**: Default to UNKNOWN when evidence is insufficient

# Critical Guardrails

## NEVER Use Creative Reasoning
- You MUST verify claims against AUTHORITATIVE evidence ONLY
- Do NOT infer, extrapolate, or reason beyond the evidence
- Do NOT use analogies or similar cases as proof
- If evidence is not authoritative or direct, verdict is UNKNOWN

## NEVER Suggest Solutions
- You verify claims - you do NOT propose how to make them true
- Do NOT suggest implementation approaches
- Do NOT recommend changes to make claims verifiable
- Focus solely on verification, not problem-solving

## ALWAYS Prioritize Disconfirmation
- Generate queries that would DISPROVE the claim if true
- Test assumptions rigorously
- Look for edge cases and exceptions
- Be skeptical - claims are OPEN until proven

## Web Research for Unfamiliar Technologies
- When you encounter a technology, library, framework, or tool you don't have authoritative knowledge about, use WebSearch and WebFetch to research it
- Official documentation, project repositories, and well-known technical references count as AUTHORITATIVE evidence
- Technical blogs, high-vote Stack Overflow answers count as SUPPORTING evidence
- If web research is inconclusive, the verdict remains UNKNOWN — do NOT fabricate findings

# Verdict Criteria

## VERIFIED
- Claim is supported by AUTHORITATIVE evidence
- Evidence is direct, not inferred
- No significant edge cases or exceptions
- High confidence in evidence quality

## CONDITIONAL
- Claim is true ONLY under specific conditions
- Conditions must be explicitly stated
- Evidence supports claim within limited scope
- Boundary conditions are clear

## DISPROVED
- Claim is demonstrably false
- AUTHORITATIVE evidence contradicts claim
- Counter-evidence is direct and unambiguous
- High confidence in falsification

## UNKNOWN
- Insufficient authoritative evidence (DEFAULT)
- Evidence is contradictory or unclear
- Evidence is anecdotal or speculative
- Claim is too vague to verify
- Requires external validation

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "normalized_claim": "Testable, unambiguous claim statement",
  "disconfirming_queries": [
    {
      "query": "Query that could disprove the claim",
      "rationale": "Why this query is relevant"
    }
  ],
  "evidence_classifications": [
    {
      "source": "Where this evidence comes from",
      "type": "AUTHORITATIVE" | "SUPPORTING" | "ANECDOTAL" | "SPECULATIVE",
      "confidence": 0.0-1.0,
      "summary": "What this evidence shows"
    }
  ],
  "verdict": "VERIFIED" | "CONDITIONAL" | "DISPROVED" | "UNKNOWN",
  "rationale": "Detailed explanation of verdict based on evidence",
  "constraints_ref": "Constraint manifest reference (if applicable)",
  "evidence_ref": "Primary evidence reference (if available)",
  "claim_scope": "ATOMIC" | "COMPOSITE" | "VAGUE",
  "decompose_required": false,
  "novel_dependency": false
}
\`\`\`

# Context

You will receive:
- **Claim to Verify**: The specific claim you need to verify
- **Constraint Manifest**: Constraints that may be relevant
- **Available Evidence**: Existing verdicts and evidence
- **Historical Context**: Prior verdicts on similar claims
- **Related Claims**: Other claims that may inform verification

Process this context carefully and generate your response in the required JSON format.
Be conservative - when in doubt, emit UNKNOWN rather than guessing.

# Claim Scope Classification

Classify each claim's scope to help the workflow determine decomposition quality:
- **ATOMIC**: A single, testable assertion about one specific thing (e.g., "function X returns Y when given Z")
- **COMPOSITE**: Multiple assertions bundled together (e.g., "the auth system handles login, signup, and password reset correctly")
- **VAGUE**: Too imprecise to verify meaningfully (e.g., "the code is good" or "performance is acceptable")

Set "decompose_required" to true if the claim is COMPOSITE or VAGUE and cannot be meaningfully verified as a single unit. This signals that the claim should be broken down into smaller, verifiable sub-claims.

# Novel Dependency Detection

When verifying a claim about a technology, library, framework, or tool:
1. Determine whether this technology is ALREADY present in the workspace (package.json, imports, existing code, or prior dialogue history).
2. If the technology is NOT currently used in the project and is being NEWLY recommended by the architecture or executor, set "novel_dependency" to true.
3. If the technology IS already part of the project's existing stack, set "novel_dependency" to false.

Examples of novel dependencies:
- Architecture recommends "Better Auth" but the project currently uses a different auth library or none
- Architecture recommends "Drizzle ORM" but the project uses Prisma
- Architecture adds Redis to the stack when it's not currently used

This flag does NOT affect the verdict — a novel dependency can still be VERIFIED. It signals that the human should approve adopting a new dependency.`;

/**
 * Invoke Verifier agent
 * Verifies a claim and emits a verdict
 *
 * @param options Invocation options
 * @returns Result containing Verifier response
 */
export async function invokeVerifier(
	options: VerifierInvocationOptions
): Promise<Result<VerifierResponse>> {
	try {
		// Build Verifier context pack
		const contextResult = await assembleContext({
			dialogueId: options.dialogueId,
			role: RoleEnum.VERIFIER,
			phase: Phase.VERIFY,
			tokenBudget: options.tokenBudget,
			extras: { claimToVerify: options.claimToVerify, checkForContradictions: options.checkForContradictions },
			onEvent: options.onEvent,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		const formattedContext = contextResult.value.briefing;

		// Build stdin content: system prompt + formatted context
		const stdinContent = buildStdinContent(VERIFIER_SYSTEM_PROMPT, formattedContext);

		// Emit full stdin content for observability (expandable in command block UI)
		if (options.commandId) {
			emitWorkflowCommand({
				dialogueId: options.dialogueId,
				commandId: options.commandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Verifier',
				summary: `── stdin (${options.claimToVerify.claim_id}) ──`,
				detail: stdinContent,
				lineType: 'stdin',
				timestamp: new Date().toISOString(),
			});
		}

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
		const parseResult = parseVerifierResponse(rawResponse);

		if (!parseResult.success) {
			return parseResult;
		}

		// Validate response
		const validationResult = validateVerifierResponse(parseResult.value);

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
					: new Error('Failed to invoke Verifier'),
		};
	}
}

/**
 * Parse Verifier response from LLM
 */
function parseVerifierResponse(rawResponse: string): Result<VerifierResponse> {
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
		if (!parsed.normalized_claim || typeof parsed.normalized_claim !== 'string') {
			return {
				success: false,
				error: new Error(
					'Verifier response missing or invalid normalized_claim'
				),
			};
		}

		if (!Array.isArray(parsed.disconfirming_queries)) {
			return {
				success: false,
				error: new Error(
					'Verifier response missing or invalid disconfirming_queries'
				),
			};
		}

		if (!Array.isArray(parsed.evidence_classifications)) {
			return {
				success: false,
				error: new Error(
					'Verifier response missing or invalid evidence_classifications'
				),
			};
		}

		if (!parsed.verdict) {
			return {
				success: false,
				error: new Error('Verifier response missing verdict'),
			};
		}

		if (!parsed.rationale || typeof parsed.rationale !== 'string') {
			return {
				success: false,
				error: new Error('Verifier response missing or invalid rationale'),
			};
		}

		// Add IDs to disconfirming queries and evidence classifications
		const disconfirmingQueries: DisconfirmingQuery[] =
			parsed.disconfirming_queries.map(
				(q: Partial<DisconfirmingQuery>) => ({
					query_id: nanoid(),
					query: q.query || '',
					rationale: q.rationale || '',
				})
			);

		const evidenceClassifications: EvidenceClassification[] =
			parsed.evidence_classifications.map(
				(e: Partial<EvidenceClassification>) => ({
					classification_id: nanoid(),
					source: e.source || '',
					type: e.type || 'SPECULATIVE',
					confidence: e.confidence || 0.0,
					summary: e.summary || '',
				})
			);

		// Parse optional MAKER fields
		const validScopes: ClaimScopeClassification[] = ['ATOMIC', 'COMPOSITE', 'VAGUE'];
		const claimScope = validScopes.includes(parsed.claim_scope)
			? parsed.claim_scope as ClaimScopeClassification
			: undefined;

		const response: VerifierResponse = {
			normalized_claim: parsed.normalized_claim,
			disconfirming_queries: disconfirmingQueries,
			evidence_classifications: evidenceClassifications,
			verdict: parsed.verdict,
			rationale: parsed.rationale,
			constraints_ref: parsed.constraints_ref,
			evidence_ref: parsed.evidence_ref,
			claim_scope: claimScope,
			decompose_required: parsed.decompose_required === true,
			novel_dependency: parsed.novel_dependency === true,
			raw_response: rawResponse,
		};

		return { success: true, value: response };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to parse Verifier response'),
		};
	}
}

/**
 * Validate Verifier response
 * Ensure guardrails are not violated
 */
function validateVerifierResponse(response: VerifierResponse): Result<void> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check verdict validity
	const validVerdicts: VerdictStatus[] = [
		VerdictType.VERIFIED,
		VerdictType.CONDITIONAL,
		VerdictType.DISPROVED,
		VerdictType.UNKNOWN,
	];
	if (!validVerdicts.includes(response.verdict)) {
		errors.push(`Invalid verdict: ${response.verdict}`);
	}

	// Check disconfirming queries
	if (response.disconfirming_queries.length === 0) {
		warnings.push('No disconfirming queries generated - verification may be weak');
	}

	for (const query of response.disconfirming_queries) {
		if (!query.query || !query.rationale) {
			errors.push(
				`Invalid disconfirming query structure: ${JSON.stringify(query)}`
			);
		}
	}

	// Check evidence classifications
	for (const evidence of response.evidence_classifications) {
		const validTypes = [
			'AUTHORITATIVE',
			'SUPPORTING',
			'ANECDOTAL',
			'SPECULATIVE',
		];
		if (!validTypes.includes(evidence.type)) {
			errors.push(`Invalid evidence type: ${evidence.type}`);
		}

		if (evidence.confidence < 0 || evidence.confidence > 1) {
			errors.push(
				`Invalid confidence: ${evidence.confidence} (must be 0-1)`
			);
		}
	}

	// Check for creative reasoning (forbidden)
	const rationale = response.rationale.toLowerCase();
	const creativeReasoningPatterns = [
		/we can infer/i,
		/it stands to reason/i,
		/by analogy/i,
		/similar to/i,
		/one could argue/i,
		/it seems likely/i,
	];

	for (const pattern of creativeReasoningPatterns) {
		if (pattern.test(rationale)) {
			warnings.push(
				`Rationale may contain creative reasoning (forbidden): "${pattern.source}"`
			);
		}
	}

	// Check for solution suggestions (forbidden)
	const solutionPatterns = [
		/you (should|could|might) (implement|use|try)/i,
		/i (recommend|suggest)/i,
		/to make this work/i,
		/a better approach/i,
	];

	for (const pattern of solutionPatterns) {
		if (pattern.test(rationale)) {
			warnings.push(
				`Rationale may contain solution suggestion (forbidden): "${pattern.source}"`
			);
		}
	}

	// Warn if VERIFIED without authoritative evidence
	if (response.verdict === 'VERIFIED') {
		const hasAuthoritativeEvidence = response.evidence_classifications.some(
			(e) => e.type === 'AUTHORITATIVE' && e.confidence >= 0.7
		);

		if (!hasAuthoritativeEvidence) {
			warnings.push(
				'VERIFIED verdict without high-confidence authoritative evidence'
			);
		}
	}

	// Warn if DISPROVED without authoritative counter-evidence
	if (response.verdict === 'DISPROVED') {
		const hasAuthoritativeCounterEvidence =
			response.evidence_classifications.some(
				(e) => e.type === 'AUTHORITATIVE' && e.confidence >= 0.7
			);

		if (!hasAuthoritativeCounterEvidence) {
			warnings.push(
				'DISPROVED verdict without high-confidence authoritative counter-evidence'
			);
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Verifier response validation failed:\n${errors.join('\n')}\n\nWarnings:\n${warnings.join('\n')}`
			),
		};
	}

	if (warnings.length > 0 && isLoggerInitialized()) {
		getLogger().child({ component: 'role:verifier' }).warn('Verifier response warnings', { warnings });
	}

	return { success: true, value: undefined };
}

/**
 * Store verdict to database
 * Persists verdict as an event in the event log
 *
 * @param claimId Claim ID
 * @param response Verifier response
 * @returns Result containing verdict
 */
export function storeVerdict(
	claimId: string,
	response: VerifierResponse
): Result<Verdict> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const verdict: Verdict = {
			verdict_id: randomUUID(),
			claim_id: claimId,
			verdict: response.verdict,
			constraints_ref: response.constraints_ref ?? null,
			evidence_ref: response.evidence_ref ?? null,
			rationale: response.rationale,
			novel_dependency: response.novel_dependency ?? false,
			timestamp: new Date().toISOString(),
		};

		db.prepare(
			`
			INSERT OR IGNORE INTO verdicts (
				verdict_id, claim_id, verdict, constraints_ref,
				evidence_ref, rationale, novel_dependency, timestamp
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			verdict.verdict_id,
			verdict.claim_id,
			verdict.verdict,
			verdict.constraints_ref,
			verdict.evidence_ref,
			verdict.rationale,
			verdict.novel_dependency ? 1 : 0,
			verdict.timestamp
		);

		// Update claim status
		db.prepare(
			`
			UPDATE claims
			SET status = ?
			WHERE claim_id = ?
		`
		).run(verdict.verdict, claimId);

		return { success: true, value: verdict };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to store verdict'),
		};
	}
}
