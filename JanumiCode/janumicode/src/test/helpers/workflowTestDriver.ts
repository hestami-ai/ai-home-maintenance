/**
 * WorkflowTestDriver — Scriptable INTAKE flow testing without VS Code.
 *
 * Replaces the GovernedStreamPanel UI layer with direct function calls.
 * Uses real LLM APIs, real database, real workflow engine.
 * Exercises the exact same code paths as the extension UI.
 *
 * Usage:
 *   const driver = await WorkflowTestDriver.create({ goal: '...' });
 *   const step1 = await driver.runUntilInput();
 *   await driver.submitMmpAcceptAll(step1.mmpPayload!);
 *   const step2 = await driver.runUntilInput();
 *   driver.cleanup();
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { createTempDatabase, type TempDbContext } from './tempDatabase';
import { initTestLogger, teardownTestLogger } from './fakeLogger';
import {
	startDialogueWithWorkflow,
	executeWorkflowCycle,
} from '../../lib/integration/dialogueOrchestrator';
import {
	getWorkflowState,
	updateWorkflowMetadata,
} from '../../lib/workflow/stateMachine';
import { getOrCreateIntakeConversation } from '../../lib/events/reader';
import { writeDialogueEvent } from '../../lib/events/writer';
import { aggregateStreamState } from '../../lib/ui/governedStream/dataAggregator';
import type { RoleLLMConfig, LLMModelConfig } from '../../lib/types';
import { ProposerPhase } from '../../lib/types';
import {
	registerRoleCLIProvider,
	clearRoleCLIRegistry,
	type RoleCLIProvider,
} from '../../lib/cli/roleCLIProvider';
import { ClaudeCodeRoleCLIProvider } from '../../lib/cli/providers/claudeCode';
import { GeminiCLIProvider } from '../../lib/cli/providers/geminiCli';
import { CodexCLIProvider } from '../../lib/cli/providers/codexCli';
import { wrapProviderForCapture } from './artifactCapture';
import { MockReplayCLIProvider } from './mockReplayCLIProvider';
import type { ResumableSnapshot } from './scenarioCheckpoint';
import { IntakeSubState } from '../../lib/types/intake';
import { ArchitectureSubState } from '../../lib/types/architecture';

// ─── Types ────────────────────────────────────────────────────────────

export type DriverMode = 'real' | 'real-capture' | 'replay';

export type CliRoleKey = 'executor' | 'technicalExpert' | 'verifier' | 'historianInterpreter';

export interface DriverOptions {
	/** The user's initial goal/prompt. Required when starting fresh; ignored when resuming. */
	goal: string;
	/** LLM config — if omitted, reads from process.env */
	llmConfig?: RoleLLMConfig;
	/** Max phases per cycle (default 50) */
	maxPhases?: number;
	/**
	 * Persistent database file path. When provided, the DB is opened at this
	 * exact location and the file is preserved across runs. Used by resumable
	 * scenario tests to checkpoint progress between `it()` cases.
	 */
	dbPath?: string;
	/**
	 * Resume an existing dialogue from the persistent DB instead of creating a
	 * fresh one. When set, `startDialogueWithWorkflow` is skipped and the
	 * initial human-message write is suppressed. The dialogue must already
	 * exist in the DB at `dbPath`.
	 */
	resumeDialogueId?: string;
	/**
	 * Override the CLI provider id for one or more roles. Applied via the
	 * existing `janumicode.cli.roles.<role>` config key (which the production
	 * `resolveProviderForRole` already reads), so this composes naturally with
	 * the real resolution path. Example: `{ technicalExpert: 'gemini-cli' }`
	 * to redirect technicalExpert away from the default `codex-cli`.
	 */
	cliRoleOverrides?: Partial<Record<CliRoleKey, string>>;
	/**
	 * Driver mode:
	 *  - `'real'` (default): real CLI providers, no artifact capture
	 *  - `'real-capture'`: real CLI providers wrapped to write artifacts on every call
	 *  - `'replay'`: mock providers that read recorded artifacts from disk
	 */
	mode?: DriverMode;
	/**
	 * Scenario name — used by capture/replay modes to compute the artifact
	 * directory and to set `JANUMICODE_TEST_SCENARIO` so the orchestrator
	 * activates the artifact context. Required when `mode` is not `'real'`.
	 */
	scenario?: string;
}

/** Snapshot of the workflow state after a cycle completes */
export interface WorkflowStep {
	/** Whether the cycle succeeded */
	success: boolean;
	/** Error message if failed */
	error?: string;
	/** Current workflow phase (INTAKE, ARCHITECTURE, etc.) */
	phase: string;
	/** INTAKE sub-state if in INTAKE phase */
	subState?: string;
	/** Proposer phase if in PRODUCT_REVIEW */
	proposerPhase?: ProposerPhase | null;
	/** Whether preProposerReview is set */
	preProposerReview?: boolean;
	/** Whether the cycle is awaiting user input */
	awaitingInput: boolean;
	/** Whether a gate was triggered */
	gateTriggered: boolean;
	/** Whether the workflow completed */
	completed: boolean;
	/** Number of phases executed in this cycle */
	phasesExecuted: number;
	/** The MMP payload from the latest stream item that has one (null if none) */
	mmpPayload: MmpSnapshot | null;
	/** The pending intake input in metadata (for debugging) */
	pendingIntakeInput?: string;
	/** The raw stream items array (for inspection) */
	streamItemTypes: string[];
}

export interface MmpSnapshot {
	/** The raw MMP JSON string */
	raw: string;
	/** Parsed payload (mirror, menu, preMortem fields) */
	parsed: Record<string, unknown>;
	/** Card ID for this MMP (e.g., 'PD-REVIEW-2', 'PV-DOMAINS-4') */
	cardId: string;
	/** Count of mirror items */
	mirrorCount: number;
	/** Count of menu items */
	menuCount: number;
	/** Count of pre-mortem items */
	preMortemCount: number;
}

// ─── Driver ───────────────────────────────────────────────────────────

export class WorkflowTestDriver {
	readonly dialogueId: string;
	private readonly _tempDb: TempDbContext;
	private readonly _llmConfig: RoleLLMConfig;
	private readonly _maxPhases: number;
	private _cleaned = false;

	private constructor(
		dialogueId: string,
		tempDb: TempDbContext,
		llmConfig: RoleLLMConfig,
		maxPhases: number,
	) {
		this.dialogueId = dialogueId;
		this._tempDb = tempDb;
		this._llmConfig = llmConfig;
		this._maxPhases = maxPhases;
	}

	/**
	 * Create a new driver: initializes DB, creates dialogue, sets up workflow.
	 *
	 * Three modes determined by `options`:
	 *  - Fresh real (default): temp DB, real CLI providers, new dialogue.
	 *  - Resume real: persistent `dbPath` + `resumeDialogueId`, real providers.
	 *  - Replay mock: temp DB, MockReplayCLIProvider, fresh dialogue or resume.
	 *  - Capture (`mode: 'real-capture'`): real providers wrapped to record artifacts.
	 */
	static async create(options: DriverOptions): Promise<WorkflowTestDriver> {
		initTestLogger();

		const mode: DriverMode = options.mode ?? 'real';
		if (mode !== 'real' && !options.scenario) {
			throw new Error(`WorkflowTestDriver: mode='${mode}' requires options.scenario`);
		}

		// Apply CLI role overrides via the mock workspace config setter so
		// production `resolveProviderForRole` picks them up naturally.
		if (options.cliRoleOverrides) {
			const vscodeMock = await import('./__mocks__/vscode');
			for (const [role, providerId] of Object.entries(options.cliRoleOverrides)) {
				vscodeMock.setMockConfig(`janumicode.cli.roles.${role}`, providerId);
			}
		}

		// In capture/replay modes, set the scenario env var so the orchestrator
		// activates the artifact context for this cycle.
		if (mode !== 'real' && options.scenario) {
			process.env.JANUMICODE_TEST_SCENARIO = options.scenario;
		} else {
			delete process.env.JANUMICODE_TEST_SCENARIO;
		}

		const tempDb = options.dbPath
			? createTempDatabase({ path: options.dbPath, persist: true })
			: createTempDatabase();

		const llmConfig = options.llmConfig ?? buildLlmConfigFromEnv();
		const maxPhases = options.maxPhases ?? 50;

		// Point the mock workspace to a real directory so CLI spawns have a valid cwd.
		// Must mutate the existing array in-place since modules cache the reference.
		try {
			const vscode = await import('vscode');
			const testWorkspace = path.resolve(__dirname, '..', '..', '..', 'test-workspace');
			if (fs.existsSync(testWorkspace) && vscode.workspace.workspaceFolders) {
				const newUri = vscode.Uri.file(testWorkspace);
				(vscode.workspace.workspaceFolders as Array<{ uri: typeof newUri; name: string; index: number }>)[0] = {
					uri: newUri,
					name: 'test-workspace',
					index: 0,
				};
				console.warn(`[WorkflowTestDriver] Set workspace cwd to: ${newUri.fsPath}`);
			}
		} catch (e) { console.error('[WorkflowTestDriver] Failed to set workspace:', e); }

		// Register CLI providers per mode. Always clear the registry first to
		// avoid leftover state from prior tests in the same vitest worker.
		clearRoleCLIRegistry();
		if (mode === 'replay') {
			// One mock per real provider id. The mock's `id` matches the recorded
			// provider id in the artifact filename.
			for (const providerId of ['claude-code', 'gemini-cli', 'codex-cli']) {
				registerRoleCLIProvider(new MockReplayCLIProvider(providerId));
			}
		} else {
			const providers: RoleCLIProvider[] = [
				new ClaudeCodeRoleCLIProvider(),
				new GeminiCLIProvider(),
				new CodexCLIProvider(),
			];
			for (const p of providers) {
				registerRoleCLIProvider(mode === 'real-capture' ? wrapProviderForCapture(p) : p);
			}
		}

		let dialogueId: string;
		if (options.resumeDialogueId) {
			// Resume mode — caller has verified the dialogue exists in the persistent DB.
			dialogueId = options.resumeDialogueId;
			const stateCheck = getWorkflowState(dialogueId);
			if (!stateCheck.success) {
				tempDb.cleanup();
				teardownTestLogger();
				throw new Error(
					`Failed to resume dialogue ${dialogueId}: ${stateCheck.error.message}`,
				);
			}
		} else {
			const startResult = startDialogueWithWorkflow({ goal: options.goal, llmConfig });
			if (!startResult.success) {
				tempDb.cleanup();
				teardownTestLogger();
				throw new Error(`Failed to start dialogue: ${startResult.error.message}`);
			}
			dialogueId = startResult.value.dialogue.dialogue_id;
			// Write the initial human message (same as GovernedStreamPanel does)
			writeDialogueEvent({
				dialogue_id: dialogueId,
				event_type: 'human_message',
				role: 'HUMAN',
				phase: 'INTAKE',
				speech_act: 'INSTRUCT',
				summary: options.goal.slice(0, 100),
				content: options.goal,
			});
		}

		return new WorkflowTestDriver(dialogueId, tempDb, llmConfig, maxPhases);
	}

	/**
	 * Open the persistent DB at `dbPath` read-only and return a snapshot of the
	 * most recent dialogue's workflow state. Returns null if the file is missing
	 * or contains no dialogues. Used by resumable test scenarios to decide
	 * whether a checkpoint has already been reached.
	 *
	 * This uses a direct better-sqlite3 connection (not the singleton) so it
	 * does not interfere with a subsequent `create()` that opens the same file.
	 */
	static findResumableDialogue(dbPath: string): ResumableSnapshot | null {
		if (!fs.existsSync(dbPath)) { return null; }
		let db: Database.Database | null = null;
		try {
			db = new Database(dbPath, { readonly: true, fileMustExist: true });

			const dialogueRow = db
				.prepare(
					`SELECT dialogue_id FROM dialogues ORDER BY created_at DESC LIMIT 1`,
				)
				.get() as { dialogue_id: string } | undefined;
			if (!dialogueRow) { return null; }

			const stateRow = db
				.prepare(
					`SELECT current_phase, metadata FROM workflow_states WHERE dialogue_id = ?`,
				)
				.get(dialogueRow.dialogue_id) as
				| { current_phase: string; metadata: string }
				| undefined;
			if (!stateRow) { return null; }

			let architectureSubState: ArchitectureSubState | null = null;
			let intakeSubStateMeta: IntakeSubState | null = null;
			try {
				const meta = JSON.parse(stateRow.metadata ?? '{}');
				if (typeof meta.architectureSubState === 'string') {
					architectureSubState = meta.architectureSubState as ArchitectureSubState;
				}
				if (typeof meta.intakeSubState === 'string') {
					intakeSubStateMeta = meta.intakeSubState as IntakeSubState;
				}
			} catch { /* malformed metadata */ }

			// Intake conversation table holds the authoritative intake sub-state
			// and the proposer phase from the draft plan.
			let intakeSubState: IntakeSubState | null = intakeSubStateMeta;
			let proposerPhase: ProposerPhase | null = null;
			let awaitingInput = false;
			try {
				const convRow = db
					.prepare(
						`SELECT sub_state, draft_plan FROM intake_conversations WHERE dialogue_id = ?`,
					)
					.get(dialogueRow.dialogue_id) as
					| { sub_state: string | null; draft_plan: string | null }
					| undefined;
				if (convRow?.sub_state) {
					intakeSubState = convRow.sub_state as IntakeSubState;
					awaitingInput = convRow.sub_state === IntakeSubState.PRODUCT_REVIEW
						|| convRow.sub_state === IntakeSubState.AWAITING_APPROVAL;
				}
				if (convRow?.draft_plan) {
					try {
						const plan = JSON.parse(convRow.draft_plan);
						if (typeof plan.proposerPhase === 'number') {
							proposerPhase = plan.proposerPhase as ProposerPhase;
						}
					} catch { /* malformed draft_plan */ }
				}
			} catch { /* table may not exist on a fresh DB */ }

			return {
				dialogueId: dialogueRow.dialogue_id,
				currentPhase: stateRow.current_phase,
				intakeSubState,
				proposerPhase,
				architectureSubState,
				awaitingInput,
			};
		} catch (err) {
			console.warn(`[WorkflowTestDriver.findResumableDialogue] failed for ${dbPath}:`, err);
			return null;
		} finally {
			try { db?.close(); } catch { /* ignore */ }
		}
	}

	/**
	 * Run the workflow cycle and return a snapshot when it stops (awaiting input, gate, or complete).
	 */
	async runUntilInput(): Promise<WorkflowStep> {
		const result = await executeWorkflowCycle(
			this.dialogueId,
			this._llmConfig,
			this._maxPhases,
		);

		return this._snapshot(result);
	}

	/**
	 * Submit MMP decisions (accept all mirrors, select first option on menus, accept all risks).
	 * Then run the workflow cycle.
	 */
	async submitMmpAcceptAll(mmp: MmpSnapshot): Promise<WorkflowStep> {
		const text = formatMmpAcceptAll(mmp);
		return this._submitAndRun(text);
	}

	/**
	 * Submit custom MMP decisions text and run the workflow cycle.
	 */
	async submitMmpText(text: string): Promise<WorkflowStep> {
		return this._submitAndRun(text);
	}

	/**
	 * Submit free-text user input (not MMP) and run the workflow cycle.
	 */
	async submitText(text: string): Promise<WorkflowStep> {
		return this._submitAndRun(text);
	}

	/**
	 * Get the current state without running a cycle.
	 */
	getState(): WorkflowStep {
		return this._currentState();
	}

	/**
	 * Clean up temp database and logger. For persistent (`dbPath`) DBs the
	 * file is preserved — only the connection is closed.
	 */
	cleanup(): void {
		if (this._cleaned) { return; }
		this._cleaned = true;
		this._tempDb.cleanup();
		teardownTestLogger();
		// Clear scenario env var so it doesn't leak into subsequent tests in
		// the same vitest worker. Reset CLI registry for the same reason.
		delete process.env.JANUMICODE_TEST_SCENARIO;
		clearRoleCLIRegistry();
	}

	// ── Private ────────────────────────────────────────────────────────

	private async _submitAndRun(text: string): Promise<WorkflowStep> {
		// Same as panelMmp.handleMMPSubmit: store input, write event, run cycle
		updateWorkflowMetadata(this.dialogueId, {
			pendingIntakeInput: text,
		});

		writeDialogueEvent({
			dialogue_id: this.dialogueId,
			event_type: 'human_message',
			role: 'HUMAN',
			phase: 'INTAKE',
			speech_act: 'DECISION',
			summary: `User input: ${text.slice(0, 80)}`,
			content: text,
		});

		return this.runUntilInput();
	}

	private _snapshot(
		cycleResult: Awaited<ReturnType<typeof executeWorkflowCycle>>,
	): WorkflowStep {
		if (!cycleResult.success) {
			return {
				success: false,
				error: cycleResult.error.message,
				phase: 'UNKNOWN',
				awaitingInput: false,
				gateTriggered: false,
				completed: false,
				phasesExecuted: 0,
				mmpPayload: null,
				streamItemTypes: [],
			};
		}

		const v = cycleResult.value;
		return this._enrichStep({
			success: true,
			phase: v.finalPhase,
			awaitingInput: v.awaitingInput,
			gateTriggered: v.gateTriggered,
			completed: v.completed,
			phasesExecuted: v.phasesExecuted,
		});
	}

	private _currentState(): WorkflowStep {
		const ws = getWorkflowState(this.dialogueId);
		const phase = ws.success ? ws.value.current_phase : 'UNKNOWN';
		return this._enrichStep({
			success: true,
			phase,
			awaitingInput: true,
			gateTriggered: false,
			completed: false,
			phasesExecuted: 0,
		});
	}

	private _enrichStep(base: Partial<WorkflowStep> & { phase: string; success: boolean }): WorkflowStep {
		// Intake state
		const conv = getOrCreateIntakeConversation(this.dialogueId);
		const subState = conv.success ? conv.value.subState : undefined;
		const plan = conv.success ? conv.value.draftPlan : undefined;
		const proposerPhase = plan?.proposerPhase as ProposerPhase | null | undefined;
		const preProposerReview = plan?.preProposerReview === true;

		// Metadata
		const ws = getWorkflowState(this.dialogueId);
		const meta = ws.success ? JSON.parse(ws.value.metadata) : {};

		// Stream items + MMP
		let mmpPayload: MmpSnapshot | null = null;
		let streamItemTypes: string[] = [];
		try {
			const state = aggregateStreamState(this.dialogueId);
			streamItemTypes = state.streamItems.map((i: { type: string }) => i.type);

			// Find the last stream item with mmpJson
			for (let i = state.streamItems.length - 1; i >= 0; i--) {
				const item = state.streamItems[i] as Record<string, unknown>;
				if (item.mmpJson && typeof item.mmpJson === 'string') {
					mmpPayload = parseMmpFromStreamItem(item);
					break;
				}
			}
		} catch {
			// aggregateStreamState may fail if not fully initialized
		}

		return {
			success: base.success,
			error: (base as { error?: string }).error,
			phase: base.phase,
			subState,
			proposerPhase: proposerPhase ?? null,
			preProposerReview,
			awaitingInput: base.awaitingInput ?? false,
			gateTriggered: base.gateTriggered ?? false,
			completed: base.completed ?? false,
			phasesExecuted: base.phasesExecuted ?? 0,
			mmpPayload,
			pendingIntakeInput: meta.pendingIntakeInput,
			streamItemTypes,
		};
	}
}

// ─── MMP Helpers ──────────────────────────────────────────────────────

function parseMmpFromStreamItem(item: Record<string, unknown>): MmpSnapshot | null {
	try {
		const raw = item.mmpJson as string;
		const parsed = JSON.parse(raw);
		const mirror = parsed.mirror ?? parsed.Mirror;
		const menu = parsed.menu ?? parsed.Menu;
		const preMortem = parsed.preMortem ?? parsed.PreMortem;

		// Derive cardId from the stream item
		const itemType = item.type as string;
		const eventId = (item.eventId ?? item.event_id ?? 0) as number;
		let cardId = `MMP-${eventId}`;
		if (itemType === 'intake_product_discovery') {
			cardId = `PD-REVIEW-${eventId}`;
		} else if (itemType === 'intake_proposer_business_domains') {
			cardId = `PV-DOMAINS-${eventId}`;
		} else if (itemType === 'intake_proposer_journeys') {
			cardId = `PV-JOURNEYS-${eventId}`;
		} else if (itemType === 'intake_proposer_entities') {
			cardId = `PV-ENTITIES-${eventId}`;
		} else if (itemType === 'intake_proposer_integrations') {
			cardId = `PV-INTEGRATIONS-${eventId}`;
		}

		return {
			raw,
			parsed,
			cardId,
			mirrorCount: mirror?.items?.length ?? 0,
			menuCount: menu?.items?.length ?? 0,
			preMortemCount: preMortem?.items?.length ?? 0,
		};
	} catch {
		return null;
	}
}

/**
 * Format MMP decisions as the text that panelMmp.handleMMPSubmit produces
 * when the user clicks "Accept All" and submits.
 */
function formatMmpAcceptAll(mmp: MmpSnapshot): string {
	const lines: string[] = ['[MMP Decisions]'];
	const p = mmp.parsed as Record<string, unknown>;

	// Mirror items — accept all
	const mirror = (p.mirror ?? p.Mirror) as { items?: Array<{ id: string; text: string }> } | undefined;
	if (mirror?.items) {
		for (const item of mirror.items) {
			lines.push(`ACCEPTED: "${item.text}"`);
		}
	}

	// Menu items — select first option
	const menu = (p.menu ?? p.Menu) as { items?: Array<{ id: string; question: string; options?: Array<{ optionId: string; label: string }> }> } | undefined;
	if (menu?.items) {
		for (const item of menu.items) {
			const firstOpt = item.options?.[0];
			if (firstOpt) {
				lines.push(`SELECTED: "${item.question}" → "${firstOpt.label}"`);
			}
		}
	}

	// Pre-mortem items — accept all risks
	const pm = (p.preMortem ?? p.PreMortem) as { items?: Array<{ id: string; assumption: string }> } | undefined;
	if (pm?.items) {
		for (const item of pm.items) {
			lines.push(`RISK_ACCEPTED: "${item.assumption}"`);
		}
	}

	return lines.join('\n');
}

// ─── Config from environment ──────────────────────────────────────────

/** Load .env from the project root (same as extension.ts loadDotenv) */
function loadDotenvIfNeeded(): void {
	const envPath = path.join(__dirname, '..', '..', '..', '.env');
	try {
		if (!fs.existsSync(envPath)) { return; }
		const content = fs.readFileSync(envPath, 'utf-8');
		for (const raw of content.split('\n')) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) { continue; }
			const stripped = line.startsWith('export ') ? line.slice(7) : line;
			const eqIdx = stripped.indexOf('=');
			if (eqIdx === -1) { continue; }
			const key = stripped.slice(0, eqIdx).trim();
			const value = stripped.slice(eqIdx + 1).trim();
			if (key && !(key in process.env)) {
				process.env[key] = value;
			}
		}
	} catch { /* .env is optional */ }
}

function buildLlmConfigFromEnv(): RoleLLMConfig {
	loadDotenvIfNeeded();
	// Read API keys from environment variables (same as .env file)
	const claudeKey = process.env.ANTHROPIC_API_KEY ?? '';
	const openaiKey = process.env.OPENAI_API_KEY ?? '';
	const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';

	const claude: LLMModelConfig = {
		provider: 'CLAUDE' as never,
		model: 'claude-sonnet-4-20250514',
		apiKey: claudeKey,
	};

	const openai: LLMModelConfig = {
		provider: 'OPENAI' as never,
		model: 'gpt-4.1',
		apiKey: openaiKey,
	};

	const gemini: LLMModelConfig = {
		provider: 'GEMINI' as never,
		model: 'gemini-2.5-flash',
		apiKey: geminiKey,
	};

	return {
		executor: claude,
		technicalExpert: openai,
		verifier: gemini,
		historianInterpreter: gemini,
	};
}
