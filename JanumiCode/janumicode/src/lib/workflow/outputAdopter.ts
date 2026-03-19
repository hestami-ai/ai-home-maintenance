/**
 * Output Adopter
 *
 * Allows users to manually adopt cached CLI output that failed to process
 * (exit code errors, parse failures, timeouts with partial output).
 *
 * The adopter reads the cached raw output from workflow metadata or from
 * the most recent failed command block, parses it according to the current
 * phase/sub-phase, stores the results in the correct DB tables, and
 * advances the workflow state.
 */

import type { Result } from '../types';
import { Phase, Role, SpeechAct } from '../types';
import { getWorkflowState, updateWorkflowMetadata } from './stateMachine';
import { writeDialogueEvent } from '../events/writer';
import { updateIntakeConversation } from '../events/writer';
import { getDatabase } from '../database/init';
import { getLogger, isLoggerInitialized } from '../logging';

// ==================== TYPES ====================

export interface AdoptResult {
	phase: string;
	subPhase?: string;
	parsedType: string;
	fieldsAdopted: string[];
	warnings: string[];
}

// ==================== MAIN ENTRY POINT ====================

/**
 * Attempt to adopt cached CLI output for the current phase.
 *
 * 1. Reads cachedRawCliOutput from workflow metadata
 * 2. Falls back to reading the most recent failed command block output
 * 3. Dispatches to phase-specific handler
 * 4. Stores results in DB and clears cache
 */
export async function adoptCachedOutput(
	dialogueId: string,
): Promise<Result<AdoptResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'outputAdopter', dialogueId })
		: null;

	// 1. Get workflow state
	const wsResult = getWorkflowState(dialogueId);
	if (!wsResult.success) {
		return { success: false, error: new Error('Cannot read workflow state') };
	}

	const metadata = JSON.parse(wsResult.value.metadata ?? '{}');
	const currentPhase = wsResult.value.current_phase;

	// 2. Find cached raw output
	let rawOutput: string | null = metadata.cachedRawCliOutput ?? null;

	if (!rawOutput) {
		// Fallback: read from most recent failed command block
		rawOutput = getLastFailedCommandOutput(dialogueId);
	}

	if (!rawOutput || rawOutput.trim().length < 10) {
		return {
			success: false,
			error: new Error('No cached CLI output available to adopt. Run the phase first, then use "adopt" if it fails.'),
		};
	}

	log?.info('Adopting cached output', {
		phase: currentPhase,
		rawLength: rawOutput.length,
		source: metadata.cachedRawCliOutput ? 'metadata_cache' : 'command_block',
	});

	// 3. Extract JSON from raw output
	const jsonResult = extractJsonFromRawOutput(rawOutput);
	if (!jsonResult.success) {
		return {
			success: false,
			error: new Error(`Failed to extract JSON from cached output: ${jsonResult.error.message}`),
		};
	}

	const parsed = jsonResult.value;

	// 4. Dispatch to phase-specific handler
	let result: Result<AdoptResult>;

	// Determine sub-phase for INTAKE and ARCHITECTURE
	const subPhase = metadata.architectureSubState ?? metadata.intakeSubState;

	switch (currentPhase) {
		case 'INTAKE':
			result = adoptIntakeOutput(dialogueId, parsed, subPhase, metadata);
			break;
		case 'ARCHITECTURE':
			result = adoptArchitectureOutput(dialogueId, parsed, subPhase, metadata);
			break;
		case 'PROPOSE':
			result = adoptProposeOutput(dialogueId, parsed);
			break;
		case 'VERIFY':
			result = adoptVerifyOutput(dialogueId, parsed);
			break;
		default:
			return {
				success: false,
				error: new Error(`Output adoption not supported for phase: ${currentPhase}`),
			};
	}

	if (!result.success) {
		return result;
	}

	// 5. Clear cache flags
	updateWorkflowMetadata(dialogueId, {
		cachedRawCliOutput: undefined,
		lastFailedPhase: undefined,
		lastError: undefined,
	});

	log?.info('Output adopted successfully', {
		phase: currentPhase,
		parsedType: result.value.parsedType,
		fields: result.value.fieldsAdopted,
		warnings: result.value.warnings,
	});

	return result;
}

// ==================== ROBUST JSON EXTRACTION ====================

/**
 * Extract a JSON object from raw CLI output.
 * Handles markdown fences, surrounding prose, JSONL streams, and truncated JSON.
 */
export function extractJsonFromRawOutput(raw: string): Result<Record<string, unknown>> {
	const trimmed = raw.trim();

	// Strategy 1: Direct parse
	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === 'object' && parsed !== null) {
			return { success: true, value: parsed };
		}
	} catch { /* continue */ }

	// Strategy 2: Extract from markdown code fences
	const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (fenceMatch) {
		try {
			const parsed = JSON.parse(fenceMatch[1].trim());
			if (typeof parsed === 'object' && parsed !== null) {
				return { success: true, value: parsed };
			}
		} catch { /* continue */ }
	}

	// Strategy 3: Find balanced { ... } boundaries (largest match)
	const braceStart = trimmed.indexOf('{');
	if (braceStart !== -1) {
		// Try from the first { to the last }
		const braceEnd = trimmed.lastIndexOf('}');
		if (braceEnd > braceStart) {
			try {
				const parsed = JSON.parse(trimmed.substring(braceStart, braceEnd + 1));
				if (typeof parsed === 'object' && parsed !== null) {
					return { success: true, value: parsed };
				}
			} catch { /* continue */ }
		}

		// Strategy 4: Try to repair truncated JSON
		const partial = trimmed.substring(braceStart);
		const repaired = repairTruncatedJson(partial);
		if (repaired) {
			try {
				const parsed = JSON.parse(repaired);
				if (typeof parsed === 'object' && parsed !== null) {
					return { success: true, value: parsed };
				}
			} catch { /* continue */ }
		}
	}

	// Strategy 5: JSONL stream — look for the last complete JSON object
	const lines = trimmed.split('\n');
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (line.startsWith('{')) {
			try {
				const parsed = JSON.parse(line);
				if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 2) {
					return { success: true, value: parsed };
				}
			} catch { /* continue */ }
		}
	}

	return {
		success: false,
		error: new Error(`Could not extract JSON from output (${trimmed.length} chars)`),
	};
}

/**
 * Attempt to repair truncated JSON by adding missing closing brackets.
 */
function repairTruncatedJson(partial: string): string | null {
	let open = 0;
	let openArr = 0;
	let inString = false;
	let escape = false;

	for (const ch of partial) {
		if (escape) { escape = false; continue; }
		if (ch === '\\' && inString) { escape = true; continue; }
		if (ch === '"') { inString = !inString; continue; }
		if (inString) { continue; }

		if (ch === '{') { open++; }
		else if (ch === '}') { open--; }
		else if (ch === '[') { openArr++; }
		else if (ch === ']') { openArr--; }
	}

	if (open <= 0 && openArr <= 0) { return null; } // Not truncated

	// Add missing closers
	let repaired = partial;

	// Remove trailing comma or incomplete key-value
	repaired = repaired.replace(/,\s*$/, '');
	repaired = repaired.replace(/:\s*$/, ': null');
	repaired = repaired.replace(/"[^"]*$/, '"');

	for (let i = 0; i < openArr; i++) { repaired += ']'; }
	for (let i = 0; i < open; i++) { repaired += '}'; }

	return repaired;
}

// ==================== FALLBACK: COMMAND BLOCK OUTPUT ====================

function getLastFailedCommandOutput(dialogueId: string): string | null {
	try {
		const db = getDatabase();
		if (!db) { return null; }

		// Find most recent failed command
		const command = db.prepare(`
			SELECT command_id FROM workflow_commands
			WHERE dialogue_id = ? AND status = 'error'
			ORDER BY started_at DESC
			LIMIT 1
		`).get(dialogueId) as { command_id: string } | undefined;

		if (!command) { return null; }

		// Get detail output lines
		const outputs = db.prepare(`
			SELECT content FROM workflow_command_outputs
			WHERE command_id = ? AND line_type = 'detail'
			ORDER BY id ASC
		`).all(command.command_id) as Array<{ content: string }>;

		if (outputs.length === 0) { return null; }

		return outputs.map(o => o.content).join('\n');
	} catch {
		return null;
	}
}

// ==================== PHASE-SPECIFIC HANDLERS ====================

function adoptIntakeOutput(
	dialogueId: string,
	parsed: Record<string, unknown>,
	subPhase: string | undefined,
	metadata: Record<string, unknown>,
): Result<AdoptResult> {
	const warnings: string[] = [];
	const fieldsAdopted: string[] = [];

	// Determine if this is an analysis response or a conversation turn
	const isAnalysis = parsed.analysisSummary || parsed.initialPlan || parsed.codebaseFindings;

	if (isAnalysis) {
		// Adopt as intake_analysis
		const analysisSummary = (parsed.analysisSummary as string) ?? '';
		const initialPlan = (parsed.initialPlan as Record<string, unknown>) ?? {};
		const codebaseFindings = (parsed.codebaseFindings as string[]) ?? [];
		const domainAssessment = (parsed.domainAssessment as Array<Record<string, unknown>>) ?? [];

		if (analysisSummary) { fieldsAdopted.push('analysisSummary'); }
		if (Object.keys(initialPlan).length > 0) { fieldsAdopted.push('initialPlan'); }
		if (codebaseFindings.length > 0) { fieldsAdopted.push('codebaseFindings'); }
		if (domainAssessment.length > 0) { fieldsAdopted.push('domainAssessment'); }

		// Store as dialogue event
		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_analysis',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.EVIDENCE,
			summary: 'Analysis complete (adopted from cached output)',
			content: analysisSummary,
			detail: {
				humanMessage: metadata.pendingIntakeInput ?? '[adopted]',
				expertResponse: parsed,
				initialPlan,
				codebaseFindings,
				domainAssessment,
				turnNumber: 0,
			},
		});

		// Update intake conversation with the plan
		if (Object.keys(initialPlan).length > 0) {
			updateIntakeConversation(dialogueId, {
				draftPlan: initialPlan as unknown as import('../types/intake').IntakePlanDocument,
				turnCount: 1,
			});
		}

		return {
			success: true,
			value: {
				phase: 'INTAKE',
				subPhase: 'ANALYZING',
				parsedType: 'IntakeAnalysisResponse',
				fieldsAdopted,
				warnings,
			},
		};
	}

	// Conversation turn response
	const conversationalResponse = (parsed.conversationalResponse as string) ?? '';
	if (conversationalResponse) { fieldsAdopted.push('conversationalResponse'); }
	if (parsed.updatedPlan) { fieldsAdopted.push('updatedPlan'); }
	if (parsed.suggestedQuestions) { fieldsAdopted.push('suggestedQuestions'); }

	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'intake_turn',
		role: Role.TECHNICAL_EXPERT,
		phase: 'INTAKE',
		speech_act: SpeechAct.EVIDENCE,
		summary: conversationalResponse.substring(0, 120) || 'Adopted turn',
		content: conversationalResponse,
		detail: {
			humanMessage: metadata.pendingIntakeInput ?? '[adopted]',
			expertResponse: parsed,
			planSnapshot: parsed.updatedPlan ?? null,
			turnNumber: 0,
		},
	});

	if (parsed.updatedPlan) {
		updateIntakeConversation(dialogueId, {
			draftPlan: parsed.updatedPlan as unknown as import('../types/intake').IntakePlanDocument,
		});
	}

	return {
		success: true,
		value: {
			phase: 'INTAKE',
			subPhase: subPhase,
			parsedType: 'IntakeTurnResponse',
			fieldsAdopted,
			warnings,
		},
	};
}

function adoptArchitectureOutput(
	dialogueId: string,
	parsed: Record<string, unknown>,
	subPhase: string | undefined,
	_metadata: Record<string, unknown>,
): Result<AdoptResult> {
	const warnings: string[] = [];
	const fieldsAdopted: string[] = [];

	// Detect which sub-phase output this is
	const hasCapabilities = Array.isArray(parsed.capabilities);
	const hasComponents = Array.isArray(parsed.components);
	const hasDataModels = Array.isArray(parsed.data_models);
	const hasImplSequence = Array.isArray(parsed.implementation_sequence);

	let parsedType = 'unknown';

	if (hasCapabilities && !hasComponents && !hasDataModels) {
		parsedType = 'DecompositionResult';
		fieldsAdopted.push('capabilities');
		if (parsed.workflows) { fieldsAdopted.push('workflows'); }
	} else if (hasDataModels) {
		parsedType = 'ModelingResult';
		fieldsAdopted.push('data_models');
	} else if (hasComponents) {
		parsedType = 'DesignResult';
		fieldsAdopted.push('components');
		if (parsed.interfaces) { fieldsAdopted.push('interfaces'); }
	} else if (hasImplSequence) {
		parsedType = 'SequencingResult';
		fieldsAdopted.push('implementation_sequence');
	} else {
		return {
			success: false,
			error: new Error(
				'Cannot determine architecture sub-phase from output. ' +
				'Expected one of: capabilities[], data_models[], components[], implementation_sequence[]'
			),
		};
	}

	// Store the parsed output as a dialogue event for visibility
	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'architecture_output',
		role: Role.TECHNICAL_EXPERT,
		phase: 'ARCHITECTURE',
		speech_act: SpeechAct.EVIDENCE,
		summary: `Architecture ${parsedType} adopted from cached output`,
		content: JSON.stringify(parsed),
		detail: { adoptedType: parsedType, subPhase, fieldsAdopted },
	});

	// Store in architecture_documents table
	try {
		const db = getDatabase();
		if (db) {
			// Get or create architecture document
			const existingDoc = db.prepare(`
				SELECT doc_id, document, version FROM architecture_documents
				WHERE dialogue_id = ? ORDER BY version DESC LIMIT 1
			`).get(dialogueId) as { doc_id: string; document: string; version: number } | undefined;

			if (existingDoc) {
				// Merge adopted fields into existing document
				let doc: Record<string, unknown> = {};
				try { doc = JSON.parse(existingDoc.document); } catch { /* use empty */ }

				// Merge the parsed fields into the document
				for (const key of Object.keys(parsed)) {
					if (parsed[key] !== undefined && parsed[key] !== null) {
						doc[key] = parsed[key];
					}
				}

				db.prepare(`
					UPDATE architecture_documents SET document = ?, updated_at = datetime('now')
					WHERE doc_id = ?
				`).run(JSON.stringify(doc), existingDoc.doc_id);
			} else {
				// Create new architecture document
				const { randomUUID } = require('node:crypto');
				db.prepare(`
					INSERT INTO architecture_documents (doc_id, dialogue_id, version, document, status, created_at)
					VALUES (?, ?, 1, ?, 'DRAFT', datetime('now'))
				`).run(randomUUID(), dialogueId, JSON.stringify(parsed));
			}
		}
	} catch (err) {
		warnings.push(`Failed to store in architecture_documents: ${err instanceof Error ? err.message : String(err)}`);
	}

	return {
		success: true,
		value: {
			phase: 'ARCHITECTURE',
			subPhase: subPhase ?? parsedType,
			parsedType,
			fieldsAdopted,
			warnings,
		},
	};
}

function adoptProposeOutput(
	dialogueId: string,
	parsed: Record<string, unknown>,
): Result<AdoptResult> {
	const fieldsAdopted: string[] = [];

	const proposal = (parsed.proposal as string) ?? '';
	const assumptions = (parsed.assumptions as unknown[]) ?? [];
	const artifacts = (parsed.artifacts as unknown[]) ?? [];

	if (proposal) { fieldsAdopted.push('proposal'); }
	if (assumptions.length > 0) { fieldsAdopted.push(`assumptions(${assumptions.length})`); }
	if (artifacts.length > 0) { fieldsAdopted.push(`artifacts(${artifacts.length})`); }

	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'proposal',
		role: Role.EXECUTOR,
		phase: 'PROPOSE',
		speech_act: SpeechAct.CLAIM,
		summary: `Proposal adopted with ${assumptions.length} assumption(s)`,
		content: JSON.stringify(proposal),
		detail: { adopted: true, assumptions, artifacts },
	});

	return {
		success: true,
		value: {
			phase: 'PROPOSE',
			parsedType: 'ExecutorResponse',
			fieldsAdopted,
			warnings: [],
		},
	};
}

function adoptVerifyOutput(
	dialogueId: string,
	parsed: Record<string, unknown>,
): Result<AdoptResult> {
	const fieldsAdopted: string[] = [];

	const verdict = (parsed.verdict as string) ?? 'UNKNOWN';
	const rationale = (parsed.rationale as string) ?? '';

	fieldsAdopted.push('verdict');
	if (rationale) { fieldsAdopted.push('rationale'); }

	writeDialogueEvent({
		dialogue_id: dialogueId,
		event_type: 'verification',
		role: Role.VERIFIER,
		phase: 'VERIFY',
		speech_act: SpeechAct.VERDICT,
		summary: `Verdict: ${verdict} (adopted from cached output)`,
		content: rationale,
		detail: { adopted: true, verdict, ...parsed },
	});

	return {
		success: true,
		value: {
			phase: 'VERIFY',
			parsedType: 'VerifierResponse',
			fieldsAdopted,
			warnings: [],
		},
	};
}
