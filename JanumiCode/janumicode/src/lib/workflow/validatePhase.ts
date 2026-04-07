/**
 * VALIDATE Phase — Deep Validation Review Sub-State Machine
 *
 * Activated after MAKER contract validation passes. Runs a multi-stage
 * agentic code review pipeline:
 *
 *   INGESTING → HYPOTHESIZING → VALIDATING → GRADING → PRESENTING → COMMIT
 *
 * Each sub-state advances via the `validateSubState` field in workflow metadata.
 */

import type { Result } from '../types';
import { Phase, Role, SpeechAct } from '../types';
import type { PhaseExecutionResult } from './orchestrator';
import { updateWorkflowMetadata } from './stateMachine';
import { writeDialogueEvent } from '../events/writer';
import { getLogger, isLoggerInitialized } from '../logging';
import { scanWorkspaceFiles, getWorkspaceStructureSummary, formatWorkspaceFilesForContext } from '../context/workspaceReader';
import { getApprovedArchitectureDocument } from '../database/architectureStore';
import { runHypothesizers } from './validateHypothesizer';
import { gradeFindings } from './validateGrader';
import { insertFindings } from '../database/validationStore';
import type { ValidatePhaseMetadata, RawHypothesis, ValidatedHypothesis, GradedFinding } from '../types/validate';
import { ValidateSubState } from '../types/validate';
import { emitWorkflowCommand, emitCLIActivity } from '../integration/eventBus';
import { resolveProviderForRole } from '../cli/providerResolver';
import type { CLIActivityEvent } from '../cli/types';
import { randomUUID } from 'node:crypto';

// ==================== EVENT HELPERS ====================

/** Build an onEvent callback that routes CLI activity into the governed stream. */
function buildValidateOnEvent(dialogueId: string): (event: CLIActivityEvent) => void {
	return (event: CLIActivityEvent) => {
		emitCLIActivity(dialogueId, {
			...event,
			role: Role.TECHNICAL_EXPERT,
			phase: 'VALIDATE' as Phase,
		});
	};
}

/** Resolve the display name of the TECHNICAL_EXPERT CLI provider for command labels. */
async function resolveProviderName(): Promise<string> {
	try {
		const r = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		return r.success ? r.value.name : 'LLM';
	} catch {
		return 'LLM';
	}
}

// ==================== ENTRY POINT ====================

/**
 * Run the Deep Validation Review sub-state machine.
 * Called by executeValidatePhase() in orchestrator.ts after MAKER validation passes.
 */
export async function runValidatePhase(
	dialogueId: string,
	metadata: Record<string, unknown>,
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validatePhase', dialogueId })
		: null;

	const meta = metadata as ValidatePhaseMetadata;
	const subState = meta.validateSubState ?? ValidateSubState.INGESTING;

	log?.info('VALIDATE phase sub-state dispatch', { subState });

	switch (subState) {
		case ValidateSubState.INGESTING:
			return executeIngesting(dialogueId, meta);
		case ValidateSubState.HYPOTHESIZING:
			return executeHypothesizing(dialogueId, meta);
		case ValidateSubState.VALIDATING:
			return executeValidating(dialogueId, meta);
		case ValidateSubState.GRADING:
			return executeGrading(dialogueId, meta);
		case ValidateSubState.PRESENTING:
			return executePresenting(dialogueId, meta);
		default:
			return executeIngesting(dialogueId, meta);
	}
}

// ==================== SUB-STATE HANDLERS ====================

/**
 * INGESTING: Assemble code context from workspace + architecture doc.
 */
async function executeIngesting(
	dialogueId: string,
	meta: ValidatePhaseMetadata,
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validatePhase:ingesting', dialogueId })
		: null;

	const cmdId = randomUUID();
	const now = () => new Date().toISOString();

	emitWorkflowCommand({
		dialogueId,
		commandId: cmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: 'Validator — Context Ingestion',
		summary: 'Scanning workspace and assembling review context',
		status: 'running',
		timestamp: now(),
	});

	try {
		const contextParts: string[] = [];

		// 1. Workspace structure summary
		const structureSummary = await getWorkspaceStructureSummary();
		if (structureSummary) {
			contextParts.push('# Workspace Structure\n' + structureSummary);
		}

		// 2. Relevant source files (exclude generated/lock/dist)
		const scanResult = await scanWorkspaceFiles({
			excludePatterns: [
				'**/node_modules/**', '**/dist/**', '**/.git/**',
				'**/*.lock', '**/*.min.js', '**/generated/**',
				'**/__pycache__/**', '**/*.pyc',
			],
			maxFiles: meta.targetFiles?.length ? meta.targetFiles.length : 80,
			maxFileSizeBytes: 50_000,
			includePatterns: meta.targetFiles?.length
				? meta.targetFiles
				: ['**/*.ts', '**/*.js', '**/*.py', '**/*.go', '**/*.java', '**/*.cs'],
		});

		const fileCount = scanResult.success ? scanResult.value.files.length : 0;
		if (scanResult.success && fileCount > 0) {
			const filesContext = formatWorkspaceFilesForContext(scanResult.value.files);
			contextParts.push('\n# Source Files\n' + filesContext);
		}

		// 3. Architecture document (domain context)
		let hasArchDoc = false;
		const archResult = getApprovedArchitectureDocument(dialogueId);
		if (archResult.success && archResult.value) {
			hasArchDoc = true;
			const doc = archResult.value;
			const archSummary = [
				'# Architecture Context',
				`Goal: ${(doc as any).goal ?? 'N/A'}`,
				`Capabilities: ${doc.capabilities.map((c: any) => c.label).join(', ')}`,
				`Components (${doc.components.length}): ${doc.components.slice(0, 10).map((c: any) => c.label).join(', ')}`,
			].join('\n');
			contextParts.push(archSummary);
		}

		const assembledContext = contextParts.join('\n\n');
		log?.info('Context assembled', { contextLength: assembledContext.length });

		emitWorkflowCommand({
			dialogueId,
			commandId: cmdId,
			action: 'complete',
			commandType: 'role_invocation',
			label: 'Validator — Context Ingestion',
			summary: `Ingested ${fileCount} file${fileCount === 1 ? '' : 's'} (${Math.round(assembledContext.length / 1024)}KB)${hasArchDoc ? ' + architecture doc' : ''}`,
			timestamp: now(),
		});

		updateWorkflowMetadata(dialogueId, {
			validateSubState: ValidateSubState.HYPOTHESIZING,
			assembledContext,
			targetFiles: meta.targetFiles ?? [],
		});

		return continueInPhase();
	} catch (error) {
		emitWorkflowCommand({
			dialogueId,
			commandId: cmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: 'Validator — Context Ingestion',
			summary: `Failed: ${error instanceof Error ? error.message : String(error)}`,
			timestamp: now(),
		});
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * HYPOTHESIZING: Run 3 hypothesizer agents (sequential by default, parallel if configured).
 */
async function executeHypothesizing(
	dialogueId: string,
	meta: ValidatePhaseMetadata,
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validatePhase:hypothesizing', dialogueId })
		: null;

	const context = meta.assembledContext ?? '';
	if (!context.trim()) {
		log?.warn('No assembled context — skipping to PRESENTING with empty findings');
		updateWorkflowMetadata(dialogueId, {
			validateSubState: ValidateSubState.PRESENTING,
			hypotheses: [],
			validatedHypotheses: [],
			gradedFindings: [],
		});
		return continueInPhase();
	}

	const providerName = await resolveProviderName();
	const cmdId = randomUUID();
	const now = () => new Date().toISOString();

	emitWorkflowCommand({
		dialogueId,
		commandId: cmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Validator — Hypothesizing [${providerName}]`,
		summary: 'Running security, logic, and best-practices hypothesis agents',
		status: 'running',
		timestamp: now(),
	});

	try {
		const onEvent = buildValidateOnEvent(dialogueId);
		const hypotheses = await runHypothesizers(context, onEvent);
		log?.info('Hypotheses collected', { count: hypotheses.length });

		emitWorkflowCommand({
			dialogueId,
			commandId: cmdId,
			action: 'complete',
			commandType: 'role_invocation',
			label: `Validator — Hypothesizing [${providerName}]`,
			summary: `Generated ${hypotheses.length} hypothesis${hypotheses.length === 1 ? '' : 'es'} across security, logic, best-practices`,
			timestamp: now(),
		});

		updateWorkflowMetadata(dialogueId, {
			validateSubState: ValidateSubState.VALIDATING,
			hypotheses,
		});

		return continueInPhase();
	} catch (error) {
		emitWorkflowCommand({
			dialogueId,
			commandId: cmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: `Validator — Hypothesizing [${providerName}]`,
			summary: `Failed: ${error instanceof Error ? error.message : String(error)}`,
			timestamp: now(),
		});
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * VALIDATING: Attempt to prove/disprove each hypothesis.
 *
 * Phase 1: LLM-only (proof_status = 'probable', tool_used = 'llm_only').
 * Phase 2 will add Dafny/z3/micro_fuzz routing via validateSandbox.ts.
 */
async function executeValidating(
	dialogueId: string,
	meta: ValidatePhaseMetadata,
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validatePhase:validating', dialogueId })
		: null;

	try {
		const hypotheses: RawHypothesis[] = meta.hypotheses ?? [];

		if (hypotheses.length === 0) {
			updateWorkflowMetadata(dialogueId, {
				validateSubState: ValidateSubState.GRADING,
				validatedHypotheses: [],
			});
			return continueInPhase();
		}

		// Phase 1: all hypotheses treated as 'probable' via 'llm_only'
		// Phase 2: selectValidationTool() will route to dafny/z3/micro_fuzz/sandbox_poc
		const validatedHypotheses: ValidatedHypothesis[] = hypotheses.map(h => ({
			...h,
			tool_used: selectValidationTool(h),
			proof_status: 'probable' as const,
			proof_artifact: null,
		}));

		log?.info('Validation complete (llm_only)', { count: validatedHypotheses.length });

		updateWorkflowMetadata(dialogueId, {
			validateSubState: ValidateSubState.GRADING,
			validatedHypotheses,
		});

		return continueInPhase();
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * GRADING: LLM confidence grading + semantic deduplication.
 */
async function executeGrading(
	dialogueId: string,
	meta: ValidatePhaseMetadata,
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validatePhase:grading', dialogueId })
		: null;

	const providerName = await resolveProviderName();
	const cmdId = randomUUID();
	const now = () => new Date().toISOString();

	emitWorkflowCommand({
		dialogueId,
		commandId: cmdId,
		action: 'start',
		commandType: 'role_invocation',
		label: `Validator — Grading [${providerName}]`,
		summary: 'Scoring hypothesis confidence and merging duplicates',
		status: 'running',
		timestamp: now(),
	});

	try {
		const validated: ValidatedHypothesis[] = meta.validatedHypotheses ?? [];
		const onEvent = buildValidateOnEvent(dialogueId);
		const gradedFindings = await gradeFindings(validated, onEvent);
		log?.info('Grading complete', { surfaced: gradedFindings.length });

		emitWorkflowCommand({
			dialogueId,
			commandId: cmdId,
			action: 'complete',
			commandType: 'role_invocation',
			label: `Validator — Grading [${providerName}]`,
			summary: `Surfaced ${gradedFindings.length} finding${gradedFindings.length === 1 ? '' : 's'} (suppressed ${validated.length - gradedFindings.length} low-confidence)`,
			timestamp: now(),
		});

		// Persist to DB
		if (gradedFindings.length > 0) {
			const insertResult = insertFindings(dialogueId, gradedFindings);
			if (!insertResult.success) {
				log?.warn('Failed to persist findings', { error: insertResult.error?.message });
			}
		}

		updateWorkflowMetadata(dialogueId, {
			validateSubState: ValidateSubState.PRESENTING,
			gradedFindings,
		});

		return continueInPhase();
	} catch (error) {
		emitWorkflowCommand({
			dialogueId,
			commandId: cmdId,
			action: 'error',
			commandType: 'role_invocation',
			label: `Validator — Grading [${providerName}]`,
			summary: `Failed: ${error instanceof Error ? error.message : String(error)}`,
			timestamp: now(),
		});
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * PRESENTING: Emit stream events for each finding + summary, then advance to COMMIT.
 */
async function executePresenting(
	dialogueId: string,
	meta: ValidatePhaseMetadata,
): Promise<Result<PhaseExecutionResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validatePhase:presenting', dialogueId })
		: null;

	try {
		const findings: GradedFinding[] = meta.gradedFindings ?? [];
		const now = new Date().toISOString();

		log?.info('Presenting findings', { count: findings.length });

		// Emit one dialogue event per finding so dataAggregator can build stream items
		for (const finding of findings) {
			writeDialogueEvent({
				dialogue_id: dialogueId,
				event_type: 'validation_finding',
				role: Role.TECHNICAL_EXPERT,
				phase: 'VALIDATE',
				speech_act: SpeechAct.CLAIM,
				summary: `[${finding.category}/${finding.severity}] ${finding.text.slice(0, 120)}`,
				content: finding.text,
				detail: finding,
			});
		}

		// Emit summary event
		const provenCount = findings.filter(f => f.proof_status === 'proven').length;
		const probableCount = findings.filter(f => f.proof_status === 'probable').length;
		const categories: Record<string, number> = {};
		for (const f of findings) { categories[f.category] = (categories[f.category] ?? 0) + 1; }

		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'validation_summary',
			role: Role.TECHNICAL_EXPERT,
			phase: 'VALIDATE',
			speech_act: SpeechAct.EVIDENCE,
			summary: `Validation complete: ${findings.length} finding${findings.length === 1 ? '' : 's'} (${provenCount} proven, ${probableCount} probable)`,
			detail: { totalFindings: findings.length, provenCount, probableCount, categories },
		});

		// Advance to COMMIT
		return {
			success: true,
			value: {
				phase: 'VALIDATE' as Phase,
				success: true,
				nextPhase: 'COMMIT' as Phase,
				metadata: { validationPassed: true, findingCount: findings.length },
				timestamp: now,
			},
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== HELPERS ====================

/**
 * Return a result that keeps the workflow in VALIDATE phase (no nextPhase)
 * so the orchestrator re-enters on the next cycle to advance the sub-state.
 */
function continueInPhase(): Result<PhaseExecutionResult> {
	return {
		success: true,
		value: {
			phase: 'VALIDATE' as Phase,
			success: true,
			metadata: { continueValidation: true },
			timestamp: new Date().toISOString(),
		},
	};
}

/**
 * Select the validation tool for a hypothesis based on category and severity.
 *
 * Phase 1: always returns 'llm_only'.
 * Phase 2 (validateSandbox.ts): will uncomment the routing logic below.
 */
function selectValidationTool(h: RawHypothesis): ValidatedHypothesis['tool_used'] {
	// Phase 2 routing — uncomment when validateSandbox.ts is implemented:
	// if (h.severity === 'critical') { return 'sandbox_poc'; }
	// if (h.category === 'logic') { return 'dafny'; }
	// if (h.category === 'security') { return 'z3'; }
	// return 'micro_fuzz'; // default for I/O-bound best_practices
	return 'llm_only';
}
