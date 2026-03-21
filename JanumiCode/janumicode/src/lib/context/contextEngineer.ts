/**
 * Context Engineer — Agentic Context Assembly
 *
 * CLI-backed agent that assembles optimally budgeted context briefings
 * for downstream LLM agents. Replaces the legacy compiler.ts.
 *
 * The Context Engineer:
 * - Consumes handoff documents produced at phase boundaries
 * - Applies declarative context policies (required/optional blocks, shedding priority)
 * - Can autonomously query the SQLite database via crafted SQL
 * - Performs abstractive summarization, conflict resolution, and semantic relevance filtering
 * - Returns a HandoffPacket with audit manifest, token accounting, and sufficiency assessment
 */

import type { Result, Role, Phase } from '../types';
import type {
	AssembleContextOptions,
	HandoffPacket,
	HandoffDocument,
	ContextPolicy,
	SectionManifestEntry,
	OmissionEntry,
	TokenAccounting,
	SufficiencyAssessment,
	ContextDiagnostics,
} from './engineTypes';
import { ContextSufficiencyError } from './engineTypes';
import { getPolicy } from './policyRegistry';
import { getHandoffDocuments } from './handoffDocStore';
import { computeFingerprint, getCachedPacket, cachePacket } from './contextCache';
import { buildSchemaPrompt } from '../database/schemaPrompt';
import { resolveProviderForRole } from '../cli/providerResolver';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { buildStdinContent } from '../cli/types';
import { getLogger, isLoggerInitialized } from '../logging';
import { Role as RoleEnum } from '../types';
import { randomUUID } from 'node:crypto';
import { emitWorkflowCommand } from '../integration/eventBus';

// ==================== SYSTEM PROMPT ====================

const CONTEXT_ENGINEER_SYSTEM_PROMPT = `You are the CONTEXT ENGINEER in the JanumiCode governed workflow system.

Your job is to assemble an optimally budgeted context briefing for a downstream LLM agent.
You receive a POLICY that specifies required and optional context blocks, budget constraints,
and shedding priorities. You also receive handoff documents (canonical phase-boundary artifacts)
and database schema information.

## Your Process

1. Read the POLICY to understand what blocks are required vs optional
2. Check available HANDOFF DOCUMENTS for pre-synthesized context
3. For required blocks not covered by handoff docs, craft SQL queries against the database
4. For optional blocks, include them in priority order until the token budget is exhausted
5. Summarize verbose content to fit within section budget caps
6. Detect conflicts between sources and resolve them:
   - Human decisions supersede automated verdicts
   - Later decisions supersede earlier ones
   - Explicit overrides supersede implicit assumptions
7. For any data you must omit due to budget constraints, leave retrieval pointers
   (e.g., "[Omitted: 15 historical verdicts, query: SELECT * FROM verdicts WHERE ...]")

## Database Access

You have READ-ONLY access to the SQLite database. The schema is provided below.
You can execute SELECT queries to retrieve data not covered by handoff documents.
All queries MUST be scoped to the current dialogue_id.

## Output Format

Respond with ONLY valid JSON (no markdown fences, no explanation outside the JSON):

{
  "briefing": "# Context for [role]\\n\\n## [Section 1]\\n...\\n## [Section 2]\\n...",
  "sectionManifest": [
    { "blockId": "...", "label": "...", "source": "handoff_doc|db_query|static|agent_synthesized", "tokenCount": 0, "retrievalPointer": "..." }
  ],
  "omissions": [
    { "blockId": "...", "reason": "budget_exceeded|not_available|policy_excluded", "impact": "low|medium|high", "retrievalHint": "..." }
  ],
  "tokenAccounting": {
    "budget": 0,
    "used": 0,
    "remaining": 0,
    "perSection": { "blockId": 0 }
  },
  "sufficiency": {
    "sufficient": true,
    "missingRequired": [],
    "warnings": [],
    "confidenceLevel": "high|medium|low"
  }
}

## Key Rules

- NEVER fabricate data. Only include information from handoff docs or database queries.
- If a required block has no data available, set sufficient=false and list it in missingRequired.
- Token counts should be approximate (estimate ~4 chars per token for English text).
- The briefing MUST be formatted as clean markdown with clear section headers.
- Prioritize clarity and completeness for the receiving agent over compression.
`;

// ==================== MAIN ENTRY POINT ====================

/**
 * Assemble context for a downstream LLM agent invocation.
 *
 * This is the main entry point replacing `compileContextPack()`.
 * It looks up the policy, checks the cache, and if necessary invokes
 * the Context Engineer agent to produce a HandoffPacket.
 */
export async function assembleContext(
	options: AssembleContextOptions
): Promise<Result<HandoffPacket>> {
	const startTime = Date.now();

	// 1. Look up policy
	const policy = getPolicy(options.role, options.phase, options.subPhase, options.intent);
	if (!policy) {
		return {
			success: false,
			error: new Error(
				`No context policy found for ${options.role}:${options.phase}:${options.subPhase ?? '*'}:${options.intent ?? '*'}`
			),
		};
	}

	// 2. Check cache
	const fingerprint = computeFingerprint(
		options.role,
		options.phase,
		options.subPhase,
		options.intent,
		options.tokenBudget,
		policy.version,
		options.dialogueId,
		options.extras,
	);

	const cached = getCachedPacket(fingerprint);
	if (cached) {
		if (isLoggerInitialized()) {
			getLogger().child({ component: 'context-engineer' }).debug('Cache hit', {
				policyKey: policy.policyKey,
				fingerprint: fingerprint.substring(0, 12),
			});
		}
		return { success: true, value: cached };
	}

	// 3. Gather available handoff documents
	const docsResult = getHandoffDocuments(options.dialogueId);
	const handoffDocs = docsResult.success ? docsResult.value : [];

	// 4. Build agent stdin
	const agentStdin = buildAgentStdin(
		policy,
		handoffDocs,
		options.dialogueId,
		options.tokenBudget,
		options.extras,
	);

	// 5. Resolve CLI provider (use TECHNICAL_EXPERT as the Context Engineer needs strong reasoning)
	const providerResult = await resolveProviderForRole(RoleEnum.TECHNICAL_EXPERT);
	if (!providerResult.success) {
		return {
			success: false,
			error: new Error(`Failed to resolve CLI provider for Context Engineer: ${providerResult.error.message}`),
		};
	}

	// 6. Invoke Context Engineer agent as its own command block
	const stdinContent = buildStdinContent(CONTEXT_ENGINEER_SYSTEM_PROMPT, agentStdin);
	const contextCommandId = randomUUID();

	emitWorkflowCommand({
		dialogueId: options.dialogueId,
		commandId: contextCommandId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Context Engineer — ${options.role}:${options.phase}`,
		summary: `Assembling context for ${options.role} (${options.phase})`,
		status: 'running',
		timestamp: new Date().toISOString(),
	});

	const cliResult = await invokeRoleStreaming({
		provider: providerResult.value,
		stdinContent,
		onEvent: (event) => {
			// Route Context Engineer CLI events through its own command block
			options.onEvent?.(event);
		},
		sandboxMode: 'read-only',
		signal: options.signal,
		timeout: 120_000, // 2 minute timeout for context assembly
		dialogueId: options.dialogueId,
	});

	emitWorkflowCommand({
		dialogueId: options.dialogueId,
		commandId: contextCommandId,
		action: cliResult.success ? 'complete' : 'error',
		commandType: 'role_invocation',
		label: `Context Engineer — ${options.role}:${options.phase}`,
		summary: cliResult.success
			? `Context assembled (${Date.now() - startTime}ms)`
			: `Context assembly failed: ${cliResult.error?.message ?? 'unknown'}`,
		status: cliResult.success ? 'success' : 'error',
		timestamp: new Date().toISOString(),
	});

	if (!cliResult.success) {
		return {
			success: false,
			error: new Error(`Context Engineer agent failed: ${cliResult.error.message}`),
		};
	}

	// 7. Parse response — cache raw output for adopt/retry on parse failure
	const response = cliResult.value.response ?? '';
	const parseResult = parseAgentResponse(response, policy, fingerprint, startTime);

	if (!parseResult.success) {
		// Cache the raw CLI output so "adopt" / "use output" can re-attempt parsing
		try {
			const { updateWorkflowMetadata } = require('../workflow/stateMachine');
			updateWorkflowMetadata(options.dialogueId, { cachedRawCliOutput: response });
		} catch { /* non-critical */ }
		return parseResult;
	}

	const packet = parseResult.value;

	// 8. Validate sufficiency
	const sufficiencyResult = validateSufficiency(packet, policy);
	if (!sufficiencyResult.success) {
		return sufficiencyResult;
	}

	// 9. Cache and return
	cachePacket(fingerprint, packet);

	if (isLoggerInitialized()) {
		getLogger().child({ component: 'context-engineer' }).info('Context assembled', {
			policyKey: policy.policyKey,
			tokensUsed: packet.tokenAccounting.used,
			tokenBudget: packet.tokenAccounting.budget,
			sections: packet.sectionManifest.length,
			omissions: packet.omissions.length,
			sufficient: packet.sufficiency.sufficient,
			wallClockMs: Date.now() - startTime,
		});
	}

	return { success: true, value: packet };
}

// ==================== AGENT STDIN BUILDER ====================

function buildAgentStdin(
	policy: ContextPolicy,
	handoffDocs: HandoffDocument[],
	dialogueId: string,
	tokenBudget: number,
	extras?: Record<string, unknown>,
): string {
	const sections: string[] = [];

	// Policy specification
	sections.push('# CONTEXT POLICY');
	sections.push(`Policy Key: ${policy.policyKey}`);
	sections.push(`Target Role: ${policy.role}`);
	sections.push(`Phase: ${policy.phase}, SubPhase: ${policy.subPhase}, Intent: ${policy.intent}`);
	sections.push(`Token Budget: ${tokenBudget}`);
	sections.push('');

	sections.push('## Required Blocks');
	for (const block of policy.requiredBlocks) {
		sections.push(`- **${block.blockId}** (${block.label}): source=${block.source}${block.queryHint ? `, hint: ${block.queryHint}` : ''}${block.maxTokens ? `, maxTokens: ${block.maxTokens}` : ''}`);
	}
	sections.push('');

	sections.push('## Optional Blocks (in priority order, highest first)');
	// Reverse shedding priority = highest priority first
	const optionalByPriority = [...policy.optionalBlocks].sort((a, b) => {
		const aPrio = policy.sheddingPriority.indexOf(a.blockId);
		const bPrio = policy.sheddingPriority.indexOf(b.blockId);
		// Higher index in shedding = shed later = higher priority to keep
		return bPrio - aPrio;
	});
	for (const block of optionalByPriority) {
		sections.push(`- **${block.blockId}** (${block.label}): source=${block.source}${block.queryHint ? `, hint: ${block.queryHint}` : ''}`);
	}
	sections.push('');

	sections.push('## Section Budgets (fraction of total)');
	for (const [blockId, fraction] of Object.entries(policy.sectionBudgets)) {
		sections.push(`- ${blockId}: ${Math.round(fraction * tokenBudget)} tokens (${(fraction * 100).toFixed(0)}%)`);
	}
	sections.push('');

	// Database schema
	sections.push('# DATABASE SCHEMA');
	sections.push(buildSchemaPrompt('handoff context claims verdicts decisions events intake architecture', dialogueId));
	sections.push('');

	// Available handoff documents
	sections.push('# AVAILABLE HANDOFF DOCUMENTS');
	if (handoffDocs.length === 0) {
		sections.push('No handoff documents available. Use database queries to retrieve data.');
	} else {
		for (const doc of handoffDocs) {
			sections.push(`## ${doc.doc_type} (${doc.doc_id})`);
			sections.push(`Source Phase: ${doc.source_phase}, Tokens: ${doc.token_count}, Event Watermark: ${doc.event_watermark}`);
			sections.push('Content:');
			sections.push('```json');
			sections.push(JSON.stringify(doc.content, null, 2));
			sections.push('```');
			sections.push('');
		}
	}

	// Role-specific extras
	if (extras && Object.keys(extras).length > 0) {
		sections.push('# ROLE-SPECIFIC CONTEXT (extras)');
		sections.push('These are additional inputs provided by the calling role. Include them in the briefing as appropriate.');
		sections.push('```json');
		sections.push(JSON.stringify(extras, null, 2));
		sections.push('```');
		sections.push('');
	}

	sections.push(`# DIALOGUE ID: ${dialogueId}`);

	return sections.join('\n');
}

// ==================== RESPONSE PARSING ====================

function parseAgentResponse(
	response: string,
	policy: ContextPolicy,
	fingerprint: string,
	startTime: number,
): Result<HandoffPacket> {
	// Try to extract JSON from the response
	let parsed: Record<string, unknown>;

	try {
		// Try direct parse first
		parsed = JSON.parse(response);
	} catch {
		// Strategy 1: Extract JSON from markdown code blocks (greedy — matches last closing fence)
		const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*)\n?```\s*$/);
		if (jsonMatch) {
			try {
				parsed = JSON.parse(jsonMatch[1]);
			} catch {
				// Code fence content wasn't valid JSON — fall through to brace extraction
			}
		}

		// Strategy 2: Extract outermost { ... } from the response
		if (!parsed!) {
			const braceStart = response.indexOf('{');
			const braceEnd = response.lastIndexOf('}');
			if (braceStart !== -1 && braceEnd > braceStart) {
				try {
					parsed = JSON.parse(response.substring(braceStart, braceEnd + 1));
				} catch {
					return {
						success: false,
						error: new Error(`Context Engineer returned unparseable JSON: ${response.substring(0, 500)}`),
					};
				}
			} else {
				return {
					success: false,
					error: new Error(`Context Engineer returned no JSON: ${response.substring(0, 500)}`),
				};
			}
		}
	}

	// Extract fields with defaults
	const briefing = typeof parsed.briefing === 'string' ? parsed.briefing : '';

	const sectionManifest: SectionManifestEntry[] = Array.isArray(parsed.sectionManifest)
		? (parsed.sectionManifest as SectionManifestEntry[])
		: [];

	const omissions: OmissionEntry[] = Array.isArray(parsed.omissions)
		? (parsed.omissions as OmissionEntry[])
		: [];

	const rawAccounting = parsed.tokenAccounting as Record<string, unknown> | undefined;
	const tokenAccounting: TokenAccounting = {
		budget: typeof rawAccounting?.budget === 'number' ? rawAccounting.budget : 0,
		used: typeof rawAccounting?.used === 'number' ? rawAccounting.used : Math.round(briefing.length / 4),
		remaining: typeof rawAccounting?.remaining === 'number' ? rawAccounting.remaining : 0,
		perSection: (rawAccounting?.perSection as Record<string, number>) ?? {},
	};

	const rawSufficiency = parsed.sufficiency as Record<string, unknown> | undefined;
	const sufficiency: SufficiencyAssessment = {
		sufficient: rawSufficiency?.sufficient !== false,
		missingRequired: Array.isArray(rawSufficiency?.missingRequired) ? rawSufficiency.missingRequired as string[] : [],
		warnings: Array.isArray(rawSufficiency?.warnings) ? rawSufficiency.warnings as string[] : [],
		confidenceLevel: ['high', 'medium', 'low'].includes(rawSufficiency?.confidenceLevel as string)
			? (rawSufficiency!.confidenceLevel as 'high' | 'medium' | 'low')
			: 'medium',
	};

	const diagnostics: ContextDiagnostics = {
		policyKey: policy.policyKey,
		policyVersion: policy.version,
		handoffDocsConsumed: sectionManifest
			.filter(s => s.source === 'handoff_doc')
			.map(s => s.retrievalPointer),
		sqlQueriesExecuted: sectionManifest.filter(s => s.source === 'db_query').length,
		agentReasoningTokens: 0, // Not tracked at this level
		wallClockMs: Date.now() - startTime,
	};

	const packet: HandoffPacket = {
		briefing,
		sectionManifest,
		omissions,
		tokenAccounting,
		sufficiency,
		fingerprint,
		diagnostics,
	};

	return { success: true, value: packet };
}

// ==================== SUFFICIENCY VALIDATION ====================

function validateSufficiency(
	packet: HandoffPacket,
	policy: ContextPolicy,
): Result<HandoffPacket> {
	// Check that all required blocks have entries in the manifest
	const includedBlockIds = new Set(packet.sectionManifest.map(s => s.blockId));
	const missingRequired: string[] = [];

	for (const block of policy.requiredBlocks) {
		if (!includedBlockIds.has(block.blockId)) {
			// Check if it's in the sufficiency.missingRequired already
			if (!packet.sufficiency.missingRequired.includes(block.blockId)) {
				missingRequired.push(block.blockId);
			}
		}
	}

	if (missingRequired.length > 0) {
		// Update the packet's sufficiency assessment
		packet.sufficiency.missingRequired = [
			...packet.sufficiency.missingRequired,
			...missingRequired,
		];
		packet.sufficiency.sufficient = false;

		if (policy.omissionStrategy === 'fail') {
			return {
				success: false,
				error: new ContextSufficiencyError(
					packet.sufficiency.missingRequired,
					policy.policyKey,
				),
			};
		}

		// degrade_with_warning — add warnings and continue
		for (const blockId of missingRequired) {
			packet.sufficiency.warnings.push(
				`Required block '${blockId}' is missing from the assembled context`
			);
		}
	}

	return { success: true, value: packet };
}
