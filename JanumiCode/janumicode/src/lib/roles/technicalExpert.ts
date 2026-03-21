/**
 * Technical Expert Role (Agent)
 * Implements Phase 6.3: Evidence packet generation, API/spec/standard explanation
 * This is an LLM-backed agent that provides authoritative technical evidence
 */

import { type Result, Role, Phase } from '../types';
import { assembleContext } from '../context';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { nanoid } from 'nanoid';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Technical Expert invocation options
 */
export interface TechnicalExpertInvocationOptions {
	dialogueId: string;
	question: string;
	relatedClaimIds?: string[];
	tokenBudget: number;
	provider: RoleCLIProvider;
	temperature?: number;
	includeHistoricalEvidence?: boolean;
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * Evidence reference
 */
export interface EvidenceReference {
	reference_id: string;
	type: 'API_DOC' | 'SPECIFICATION' | 'STANDARD' | 'RFC' | 'EXAMPLE' | 'OTHER';
	url?: string;
	description: string;
	relevance_score: number;
}

/**
 * Evidence packet
 */
export interface EvidencePacket {
	packet_id: string;
	question: string;
	answer: string;
	evidence_references: EvidenceReference[];
	confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
	caveats: string[];
	raw_response: string;
}

/**
 * System prompt template for Technical Expert
 */
const TECHNICAL_EXPERT_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT role in the JanumiCode autonomous system.

# Your Responsibilities

1. **Provide Authoritative Evidence**: Answer technical questions with evidence-backed explanations
2. **Cite References**: Always cite API docs, specs, standards, RFCs, or examples
3. **Explain Precisely**: Provide narrowly-scoped, accurate technical explanations
4. **Surface Caveats**: Identify edge cases, limitations, or conditions
5. **Assess Confidence**: Rate your confidence based on evidence quality

# Critical Guardrails

## NEVER Make Feasibility Verdicts
- You provide EVIDENCE ONLY - not judgments about feasibility
- Do NOT say whether something "will work" or "won't work"
- Do NOT make recommendations about what to do
- Focus on "what is" not "what should be"

## NEVER Authorize Execution
- You have NO authority to approve or authorize actions
- Do NOT suggest proceeding with implementation
- Do NOT override verification or governance decisions
- Your role is purely informational

## ALWAYS Cite Evidence
- Every technical claim MUST have a reference
- If you cannot find authoritative evidence, say so explicitly
- Confidence level should reflect evidence quality:
  - HIGH: Multiple authoritative sources (official docs, specs, standards)
  - MEDIUM: Single authoritative source or well-documented examples
  - LOW: Inferred from general knowledge or limited sources

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "answer": "Detailed technical explanation...",
  "evidence_references": [
    {
      "type": "API_DOC" | "SPECIFICATION" | "STANDARD" | "RFC" | "EXAMPLE" | "OTHER",
      "url": "https://...",
      "description": "What this reference shows",
      "relevance_score": 0.0-1.0
    }
  ],
  "confidence_level": "HIGH" | "MEDIUM" | "LOW",
  "caveats": [
    "Edge case or limitation to be aware of...",
    "Condition under which this may not apply..."
  ]
}
\`\`\`

# Context

You will receive:
- **Technical Question**: The specific question you need to answer
- **Available Evidence**: Existing verdicts and historical evidence
- **Related Claims**: Claims that may be relevant to the question
- **Artifacts**: Code, designs, or other artifacts for context

Process this context carefully and generate your response in the required JSON format.
Focus on providing evidence-backed technical information without making judgments or recommendations.`;

/**
 * Invoke Technical Expert agent
 * Generates evidence packets for technical questions
 *
 * @param options Invocation options
 * @returns Result containing evidence packet
 */
export async function invokeTechnicalExpert(
	options: TechnicalExpertInvocationOptions
): Promise<Result<EvidencePacket>> {
	try {
		// Assemble context via Context Engineer
		const contextResult = await assembleContext({
			dialogueId: options.dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: Phase.PROPOSE,
			tokenBudget: options.tokenBudget,
			extras: { question: options.question, relatedClaimIds: options.relatedClaimIds },
			onEvent: options.onEvent,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		const formattedContext = contextResult.value.briefing;

		// Build stdin content: system prompt + formatted context
		const stdinContent = buildStdinContent(TECHNICAL_EXPERT_SYSTEM_PROMPT, formattedContext);

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
		const parseResult = parseTechnicalExpertResponse(rawResponse, options.question);

		if (!parseResult.success) {
			return parseResult;
		}

		// Validate response
		const validationResult = validateTechnicalExpertResponse(parseResult.value);

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
					: new Error('Failed to invoke Technical Expert'),
		};
	}
}

/**
 * Parse Technical Expert response from LLM
 */
function parseTechnicalExpertResponse(
	rawResponse: string,
	question: string
): Result<EvidencePacket> {
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
		if (!parsed.answer || typeof parsed.answer !== 'string') {
			return {
				success: false,
				error: new Error('Technical Expert response missing or invalid answer'),
			};
		}

		if (!Array.isArray(parsed.evidence_references)) {
			return {
				success: false,
				error: new Error(
					'Technical Expert response missing or invalid evidence_references'
				),
			};
		}

		if (!parsed.confidence_level) {
			return {
				success: false,
				error: new Error(
					'Technical Expert response missing confidence_level'
				),
			};
		}

		if (!Array.isArray(parsed.caveats)) {
			return {
				success: false,
				error: new Error(
					'Technical Expert response missing or invalid caveats'
				),
			};
		}

		// Add IDs to evidence references
		const evidenceReferences: EvidenceReference[] =
			parsed.evidence_references.map((ref: Partial<EvidenceReference>) => ({
				reference_id: nanoid(),
				type: ref.type || 'OTHER',
				url: ref.url,
				description: ref.description || '',
				relevance_score: ref.relevance_score || 0.5,
			}));

		const packet: EvidencePacket = {
			packet_id: nanoid(),
			question,
			answer: parsed.answer,
			evidence_references: evidenceReferences,
			confidence_level: parsed.confidence_level,
			caveats: parsed.caveats,
			raw_response: rawResponse,
		};

		return { success: true, value: packet };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to parse Technical Expert response'),
		};
	}
}

/**
 * Validate Technical Expert response
 * Ensure guardrails are not violated
 */
function validateTechnicalExpertResponse(
	packet: EvidencePacket
): Result<void> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check confidence level
	const validConfidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];
	if (!validConfidenceLevels.includes(packet.confidence_level)) {
		errors.push(`Invalid confidence level: ${packet.confidence_level}`);
	}

	// Check evidence references
	for (const ref of packet.evidence_references) {
		const validTypes = [
			'API_DOC',
			'SPECIFICATION',
			'STANDARD',
			'RFC',
			'EXAMPLE',
			'OTHER',
		];
		if (!validTypes.includes(ref.type)) {
			errors.push(`Invalid evidence reference type: ${ref.type}`);
		}

		if (ref.relevance_score < 0 || ref.relevance_score > 1) {
			errors.push(
				`Invalid relevance score: ${ref.relevance_score} (must be 0-1)`
			);
		}

		if (!ref.description) {
			warnings.push(`Evidence reference ${ref.reference_id} lacks description`);
		}
	}

	// Check for guardrail violations in answer
	const answer = packet.answer.toLowerCase();

	// Check for feasibility verdicts (forbidden)
	const feasibilityPatterns = [
		/this (will|won't|should|shouldn't) work/i,
		/you (should|shouldn't|must|can't) (use|do|implement)/i,
		/i (recommend|suggest|advise)/i,
		/(proceed|go ahead) with/i,
		/this is (feasible|infeasible|viable|not viable)/i,
	];

	for (const pattern of feasibilityPatterns) {
		if (pattern.test(answer)) {
			warnings.push(
				`Answer may contain feasibility verdict (forbidden): "${pattern.source}"`
			);
		}
	}

	// Warn if high confidence but no references
	if (
		packet.confidence_level === 'HIGH' &&
		packet.evidence_references.length === 0
	) {
		warnings.push(
			'HIGH confidence claimed but no evidence references provided'
		);
	}

	// Warn if no caveats provided
	if (packet.caveats.length === 0) {
		warnings.push('No caveats provided - consider edge cases and limitations');
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Technical Expert response validation failed:\n${errors.join('\n')}\n\nWarnings:\n${warnings.join('\n')}`
			),
		};
	}

	if (warnings.length > 0 && isLoggerInitialized()) {
		getLogger().child({ component: 'role:technicalExpert' }).warn('Technical Expert response warnings', { warnings });
	}

	return { success: true, value: undefined };
}

/**
 * Extract evidence references from an evidence packet
 * Useful for storing references in the database
 *
 * @param packet Evidence packet
 * @returns Array of evidence reference IDs
 */
export function extractEvidenceReferences(packet: EvidencePacket): string[] {
	return packet.evidence_references.map((ref) => ref.reference_id);
}
