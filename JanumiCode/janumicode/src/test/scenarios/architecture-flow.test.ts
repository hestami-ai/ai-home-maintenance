/**
 * Integration Test: ARCHITECTURE Flow — Resumable, per-checkpoint
 *
 * Drives a real INTAKE → ARCHITECTURE pipeline end-to-end against real LLMs,
 * but checkpoints progress to a persistent on-disk SQLite database after every
 * `it()` case. Re-running this file resumes from the highest checkpoint
 * already reached — making it possible to debug a single failing checkpoint
 * (e.g., DESIGNING) in ~5 minutes instead of restarting the full ~60-minute
 * INTAKE+ARCHITECTURE flow from scratch.
 *
 * To start from scratch, delete `test-output/checkpoints/url-shortener.db`.
 *
 * Mode: `real-capture` — every CLI invocation is also recorded as a JSON
 * artifact under `test-output/artifacts/url-shortener/`. Those artifacts power
 * the deterministic `architecture-flow.replay.test.ts` test, which runs the
 * same scripted flow against `MockReplayCLIProvider` in seconds, with no
 * outbound API calls.
 *
 * Cost: ~25-60 minutes for the FIRST run that captures all artifacts. Resumed
 * runs cost only the checkpoints not yet reached.
 *
 * Requires: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY in environment.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { WorkflowTestDriver } from '../helpers/workflowTestDriver';
import { IntakeSubState, ProposerPhase } from '../../lib/types';
import { getArchitectureDocumentForDialogue } from '../../lib/database/architectureStore';
import {
	ArchScenarioCheckpoint,
	checkpointDbPath,
	checkpointName,
	describeCheckpoint,
	ensureCheckpointDirs,
	isCheckpointPast,
	type ResumableSnapshot,
} from '../helpers/scenarioCheckpoint';

// ─── Constants ────────────────────────────────────────────────────────

const SCENARIO = 'url-shortener';
const GOAL =
	'Build a simple URL shortener service. Users paste a long URL and get a ' +
	'short alias they can share. Aliases redirect to the original URL when ' +
	'visited and we track click counts.';

// Per-checkpoint timeout: each it() runs at most ~2 LLM calls (one cycle of
// max 2 phases), so 10 minutes is comfortable headroom for slow CLI providers.
const CHECKPOINT_TIMEOUT_MS = 10 * 60 * 1000;

// ─── Live log + .env loading (preserved from prior version) ───────────

const LIVE_LOG_PATH = path.join(__dirname, '..', '..', '..', 'test-output', 'architecture-flow.log');
beforeAll(() => {
	try { fs.mkdirSync(path.dirname(LIVE_LOG_PATH), { recursive: true }); } catch { /* exists */ }
	try { fs.writeFileSync(LIVE_LOG_PATH, ''); } catch { /* ignore */ }
	process.env.JANUMICODE_TEST_LOG_FILE = LIVE_LOG_PATH;
	process.env.JANUMICODE_TEST_LOGGER = 'stdout';
	ensureCheckpointDirs();
	process.stderr.write(`\n[ARCH-TEST] live log: ${LIVE_LOG_PATH}\n`);
	process.stderr.write(`[ARCH-TEST] persistent DB: ${checkpointDbPath(SCENARIO)}\n`);
});

(function loadDotenv() {
	const envPath = path.join(__dirname, '..', '..', '..', '.env');
	try {
		if (!fs.existsSync(envPath)) { return; }
		for (const raw of fs.readFileSync(envPath, 'utf-8').split('\n')) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) { continue; }
			const stripped = line.startsWith('export ') ? line.slice(7) : line;
			const eqIdx = stripped.indexOf('=');
			if (eqIdx === -1) { continue; }
			const key = stripped.slice(0, eqIdx).trim();
			const value = stripped.slice(eqIdx + 1).trim();
			if (key && !(key in process.env)) { process.env[key] = value; }
		}
	} catch { /* optional */ }
})();

const hasApiKeys = !!(
	process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY && process.env.GEMINI_API_KEY
);
const describeIf = hasApiKeys ? describe : describe.skip;

// ─── Test suite ───────────────────────────────────────────────────────

describeIf('ARCHITECTURE Flow (resumable, per-checkpoint)', () => {
	const dbPath = checkpointDbPath(SCENARIO);
	let driver: WorkflowTestDriver | null = null;

	afterEach(() => {
		driver?.cleanup();
		driver = null;
	});

	/**
	 * Open the driver in resume mode if a persistent dialogue exists, otherwise
	 * fresh. Always uses real-capture so artifacts are recorded.
	 */
	async function openDriver(): Promise<{ driver: WorkflowTestDriver; snap: ResumableSnapshot | null }> {
		const snap = WorkflowTestDriver.findResumableDialogue(dbPath);
		const d = await WorkflowTestDriver.create({
			goal: GOAL,
			dbPath,
			resumeDialogueId: snap?.dialogueId,
			mode: 'real-capture',
			scenario: SCENARIO,
			// Redirect technicalExpert from default codex-cli to gemini-cli.
			cliRoleOverrides: { technicalExpert: 'gemini-cli' },
			// Cap each cycle at 2 phases for incremental checkpoints.
			maxPhases: 2,
		});
		return { driver: d, snap };
	}

	/**
	 * Read the persistent DB and decide whether the requested checkpoint has
	 * already been reached. Returns true (and logs) when the test should skip.
	 */
	function shouldSkip(target: ArchScenarioCheckpoint): boolean {
		const snap = WorkflowTestDriver.findResumableDialogue(dbPath);
		if (isCheckpointPast(snap, target)) {
			const at = checkpointName(describeCheckpoint(snap));
			console.log(`[ARCH-TEST] ⏭  skipping ${checkpointName(target)} — DB already at ${at}`);
			return true;
		}
		return false;
	}

	/**
	 * Standard flow for an INTAKE checkpoint that requires submitting the
	 * current PRODUCT_REVIEW MMP. Resumes the driver, ensures the latest MMP
	 * is visible (running an idempotent cycle if needed), then submits it.
	 */
	async function advanceByMmpSubmit(
		target: ArchScenarioCheckpoint,
		expectedProposerPhase: ProposerPhase | null,
	): Promise<void> {
		const { driver: d } = await openDriver();
		driver = d;
		// Try to read the current MMP from the resumed state. If the in-memory
		// stream aggregator hasn't been primed yet, run one cycle (no LLM call —
		// the workflow is already awaiting input) to populate it.
		let snapshot = d.getState();
		if (!snapshot.mmpPayload) {
			snapshot = await d.runUntilInput();
		}
		expect(
			snapshot.mmpPayload,
			`MMP must be present before submitting at checkpoint ${checkpointName(target)}`,
		).not.toBeNull();
		const next = await d.submitMmpAcceptAll(snapshot.mmpPayload!);
		console.log(`[ARCH-TEST] ${checkpointName(target)}:`, {
			phase: next.phase,
			subState: next.subState,
			proposerPhase: next.proposerPhase,
			mirrorCount: next.mmpPayload?.mirrorCount,
		});
		expect(next.success).toBe(true);
		if (expectedProposerPhase !== null) {
			expect(next.proposerPhase).toBe(expectedProposerPhase);
		}
	}

	// ── Checkpoint 1: INTAKE_PRODUCT_REVIEW (Intent Discovery) ──
	it('reaches INTAKE_PRODUCT_REVIEW (intent discovery MMP)', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.INTAKE_PRODUCT_REVIEW)) { return; }
		const { driver: d } = await openDriver();
		driver = d;
		const step = await d.runUntilInput();
		console.log('[ARCH-TEST] INTAKE_PRODUCT_REVIEW:', {
			phase: step.phase,
			subState: step.subState,
			preProposerReview: step.preProposerReview,
			mirrorCount: step.mmpPayload?.mirrorCount,
		});
		expect(step.phase).toBe('INTAKE');
		expect(step.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(step.preProposerReview).toBe(true);
		expect(step.mmpPayload).not.toBeNull();
	}, CHECKPOINT_TIMEOUT_MS);

	// ── Checkpoint 2: INTAKE_BUSINESS_DOMAINS (Proposer round 1) ──
	it('reaches INTAKE_BUSINESS_DOMAINS (proposer round 1)', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.INTAKE_BUSINESS_DOMAINS)) { return; }
		await advanceByMmpSubmit(
			ArchScenarioCheckpoint.INTAKE_BUSINESS_DOMAINS,
			ProposerPhase.BUSINESS_DOMAIN_MAPPING,
		);
	}, CHECKPOINT_TIMEOUT_MS);

	// ── Checkpoint 3: INTAKE_JOURNEYS (Proposer round 2) ──
	it('reaches INTAKE_JOURNEYS (proposer round 2)', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.INTAKE_JOURNEYS)) { return; }
		await advanceByMmpSubmit(
			ArchScenarioCheckpoint.INTAKE_JOURNEYS,
			ProposerPhase.JOURNEY_WORKFLOW,
		);
	}, CHECKPOINT_TIMEOUT_MS);

	// ── Checkpoint 4: INTAKE_ENTITIES (Proposer round 3) ──
	it('reaches INTAKE_ENTITIES (proposer round 3)', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.INTAKE_ENTITIES)) { return; }
		await advanceByMmpSubmit(
			ArchScenarioCheckpoint.INTAKE_ENTITIES,
			ProposerPhase.ENTITY_DATA_MODEL,
		);
	}, CHECKPOINT_TIMEOUT_MS);

	// ── Checkpoint 5: INTAKE_INTEGRATIONS (Proposer round 4) ──
	it('reaches INTAKE_INTEGRATIONS (proposer round 4)', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.INTAKE_INTEGRATIONS)) { return; }
		await advanceByMmpSubmit(
			ArchScenarioCheckpoint.INTAKE_INTEGRATIONS,
			ProposerPhase.INTEGRATION_QUALITY,
		);
	}, CHECKPOINT_TIMEOUT_MS);

	// ── Checkpoint 6: INTAKE_AWAITING_APPROVAL (Synthesis) ──
	it('reaches INTAKE_AWAITING_APPROVAL (synthesis)', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.INTAKE_AWAITING_APPROVAL)) { return; }
		const { driver: d } = await openDriver();
		driver = d;
		// Submit the integrations MMP to trigger synthesis.
		let snapshot = d.getState();
		if (!snapshot.mmpPayload) { snapshot = await d.runUntilInput(); }
		expect(snapshot.mmpPayload).not.toBeNull();
		const synth = await d.submitMmpAcceptAll(snapshot.mmpPayload!);
		console.log('[ARCH-TEST] INTAKE_AWAITING_APPROVAL:', {
			phase: synth.phase,
			subState: synth.subState,
			gateTriggered: synth.gateTriggered,
		});
		expect(synth.subState).toBe(IntakeSubState.AWAITING_APPROVAL);
	}, CHECKPOINT_TIMEOUT_MS);

	// ── Checkpoint 7-11: ARCHITECTURE pipeline ──
	// The architecture phase advances incrementally with maxPhases=2 per cycle.
	// Each architecture checkpoint may require multiple driver cycles before the
	// sub-state advances. The shared helper drives one cycle per call until the
	// requested target is reached or the iteration cap is hit.
	async function advanceArchitecture(
		target: ArchScenarioCheckpoint,
		maxCycles: number,
	): Promise<void> {
		const { driver: d } = await openDriver();
		driver = d;

		// First, if INTAKE is still in AWAITING_APPROVAL, approve it now.
		// (Approval submits "approve" text and triggers the INTAKE→ARCHITECTURE transition.)
		let cur = d.getState();
		if (cur.subState === IntakeSubState.AWAITING_APPROVAL) {
			cur = await d.submitText('approve');
			console.log('[ARCH-TEST] approved plan:', {
				phase: cur.phase,
				gateTriggered: cur.gateTriggered,
			});
		}

		for (let i = 0; i < maxCycles; i++) {
			const snap = WorkflowTestDriver.findResumableDialogue(dbPath);
			if (isCheckpointPast(snap, target)) {
				console.log(`[ARCH-TEST] reached ${checkpointName(target)} after ${i} cycles`);
				return;
			}
			if (cur.completed) {
				console.log(`[ARCH-TEST] workflow completed before ${checkpointName(target)}`);
				break;
			}
			console.log(`[ARCH-TEST] cycle ${i} (target=${checkpointName(target)}, current=${cur.phase})`);
			cur = await d.runUntilInput();
			if (!cur.success) {
				throw new Error(`cycle ${i} failed: ${cur.error}`);
			}
		}
		const finalSnap = WorkflowTestDriver.findResumableDialogue(dbPath);
		expect(
			isCheckpointPast(finalSnap, target),
			`failed to reach ${checkpointName(target)} after ${maxCycles} cycles`,
		).toBe(true);
	}

	it('reaches ARCH_TECHNICAL_ANALYSIS', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.ARCH_TECHNICAL_ANALYSIS)) { return; }
		await advanceArchitecture(ArchScenarioCheckpoint.ARCH_TECHNICAL_ANALYSIS, 5);
	}, CHECKPOINT_TIMEOUT_MS);

	it('reaches ARCH_DECOMPOSING', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.ARCH_DECOMPOSING)) { return; }
		await advanceArchitecture(ArchScenarioCheckpoint.ARCH_DECOMPOSING, 5);
	}, CHECKPOINT_TIMEOUT_MS);

	it('reaches ARCH_MODELING', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.ARCH_MODELING)) { return; }
		await advanceArchitecture(ArchScenarioCheckpoint.ARCH_MODELING, 5);
	}, CHECKPOINT_TIMEOUT_MS);

	it('reaches ARCH_DESIGNING', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.ARCH_DESIGNING)) { return; }
		await advanceArchitecture(ArchScenarioCheckpoint.ARCH_DESIGNING, 8);
	}, CHECKPOINT_TIMEOUT_MS * 2);

	it('reaches ARCH_PRESENTING and validates the architecture document', async () => {
		if (shouldSkip(ArchScenarioCheckpoint.ARCH_PRESENTING)) {
			// Even when the checkpoint is past, we still want to run the
			// invariant assertions on the persisted architecture document.
		} else {
			await advanceArchitecture(ArchScenarioCheckpoint.ARCH_PRESENTING, 8);
		}

		// ── Inspect the persisted architecture document ──
		const { driver: d } = await openDriver();
		driver = d;
		const archDocResult = getArchitectureDocumentForDialogue(d.dialogueId);
		expect(archDocResult.success, 'architecture document query should succeed').toBe(true);
		if (!archDocResult.success) { return; }
		expect(archDocResult.value, 'architecture document should exist').not.toBeNull();
		const doc = archDocResult.value!;
		console.log('[ARCH-TEST] architecture document:', {
			doc_id: doc.doc_id,
			version: doc.version,
			capabilities: doc.capabilities.length,
			workflows: doc.workflow_graph?.length ?? 0,
			data_models: doc.data_models.length,
			components: doc.components.length,
			interfaces: doc.interfaces.length,
		});

		// ── RAD invariant assertions (preserved from original test) ──
		expect(doc.components.length).toBeGreaterThan(0);

		// M5: every component's workflows_served must reference real workflow IDs
		const realWorkflowIds = new Set(doc.workflow_graph.map(w => w.workflow_id));
		for (const comp of doc.components) {
			for (const wfId of comp.workflows_served) {
				expect(
					realWorkflowIds.has(wfId),
					`component ${comp.component_id} references unknown workflow ${wfId}`,
				).toBe(true);
			}
		}

		// M4: no orphan components (empty workflows + no parent)
		for (const comp of doc.components) {
			const isOrphan = comp.workflows_served.length === 0 && !comp.parent_component_id;
			expect(
				isOrphan,
				`component ${comp.component_id} (${comp.label}) is orphan-shaped`,
			).toBe(false);
		}

		// parent_component_id integrity
		const componentIds = new Set(doc.components.map(c => c.component_id));
		for (const comp of doc.components) {
			if (comp.parent_component_id) {
				expect(
					componentIds.has(comp.parent_component_id),
					`component ${comp.component_id} has parent ${comp.parent_component_id} that doesn't exist`,
				).toBe(true);
			}
		}

		// Dependency edge integrity
		for (const comp of doc.components) {
			for (const dep of comp.dependencies) {
				expect(
					componentIds.has(dep),
					`component ${comp.component_id} depends on ${dep} that doesn't exist`,
				).toBe(true);
			}
		}

		// Interface edge integrity
		for (const iface of doc.interfaces) {
			expect(
				componentIds.has(iface.provider_component),
				`interface ${iface.interface_id} has unknown provider ${iface.provider_component}`,
			).toBe(true);
			for (const consumer of iface.consumer_components) {
				expect(
					componentIds.has(consumer),
					`interface ${iface.interface_id} has unknown consumer ${consumer}`,
				).toBe(true);
			}
		}

		// No duplicate component IDs
		expect(new Set(doc.components.map(c => c.component_id)).size).toBe(doc.components.length);
	}, CHECKPOINT_TIMEOUT_MS * 2);
});
