/**
 * Integration Test: ARCHITECTURE Flow — Deterministic Mock Replay
 *
 * Replays the captured artifact corpus from `test-output/artifacts/url-shortener/`
 * through the same workflow engine that produced them — but without making any
 * real LLM calls. Every CLI invocation is served from disk by
 * `MockReplayCLIProvider`.
 *
 * Prerequisite: `architecture-flow.test.ts` must have been run at least once
 * in `real-capture` mode against fresh sources, producing the artifact corpus.
 *
 * This test runs in seconds and exists to give every PR a regression net for
 * the full INTAKE → ARCHITECTURE flow without burning real tokens. If you
 * tweak prompt templates and want to refresh the corpus, delete the artifact
 * directory and re-run the capture test.
 */

import * as fs from 'node:fs';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { WorkflowTestDriver } from '../helpers/workflowTestDriver';
import { IntakeSubState, ProposerPhase } from '../../lib/types';
import { getArchitectureDocumentForDialogue } from '../../lib/database/architectureStore';
import { scenarioArtifactDir } from '../helpers/scenarioCheckpoint';

const SCENARIO = 'url-shortener';
const GOAL =
	'Build a simple URL shortener service. Users paste a long URL and get a ' +
	'short alias they can share. Aliases redirect to the original URL when ' +
	'visited and we track click counts.';

const artifactDir = scenarioArtifactDir(SCENARIO);
const hasCorpus = fs.existsSync(artifactDir) && fs.readdirSync(artifactDir).some(f => f.endsWith('.json'));
const describeIf = hasCorpus ? describe : describe.skip;

beforeAll(() => {
	if (!hasCorpus) {
		process.stderr.write(
			`\n[REPLAY-TEST] skipping — no captured artifacts at ${artifactDir}\n` +
				`[REPLAY-TEST] run architecture-flow.test.ts in real-capture mode first.\n`,
		);
	} else {
		process.stderr.write(`\n[REPLAY-TEST] using artifacts from ${artifactDir}\n`);
	}
});

describeIf('ARCHITECTURE Flow (deterministic replay)', () => {
	let driver: WorkflowTestDriver | null = null;

	afterEach(() => {
		driver?.cleanup();
		driver = null;
	});

	it('replays the full INTAKE → ARCHITECTURE flow from captured artifacts', async () => {
		// Replay always uses a fresh temp DB. The persistent checkpoint DB is
		// NOT used here — we want the replay to walk the full state machine
		// from scratch, hitting every recorded LLM call in order.
		driver = await WorkflowTestDriver.create({
			goal: GOAL,
			mode: 'replay',
			scenario: SCENARIO,
			cliRoleOverrides: { technicalExpert: 'gemini-cli' },
			maxPhases: 50,
		});

		// ── INTAKE: 6 turns ──
		const intake1 = await driver.runUntilInput();
		expect(intake1.phase).toBe('INTAKE');
		expect(intake1.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(intake1.mmpPayload).not.toBeNull();

		const intake2 = await driver.submitMmpAcceptAll(intake1.mmpPayload!);
		expect(intake2.proposerPhase).toBe(ProposerPhase.BUSINESS_DOMAIN_MAPPING);

		const intake3 = await driver.submitMmpAcceptAll(intake2.mmpPayload!);
		expect(intake3.proposerPhase).toBe(ProposerPhase.JOURNEY_WORKFLOW);

		const intake4 = await driver.submitMmpAcceptAll(intake3.mmpPayload!);
		expect(intake4.proposerPhase).toBe(ProposerPhase.ENTITY_DATA_MODEL);

		const intake5 = await driver.submitMmpAcceptAll(intake4.mmpPayload!);
		expect(intake5.proposerPhase).toBe(ProposerPhase.INTEGRATION_QUALITY);

		const intake6 = await driver.submitMmpAcceptAll(intake5.mmpPayload!);
		expect(intake6.subState).toBe(IntakeSubState.AWAITING_APPROVAL);

		// ── Approval → ARCHITECTURE ──
		const approveStep = await driver.submitText('approve');
		expect(approveStep.success).toBe(true);

		// ── ARCHITECTURE: drive to completion ──
		// With maxPhases=50, a single cycle should be able to walk the entire
		// architecture pipeline since replay calls return instantly.
		let archStep = approveStep;
		const MAX_REPLAY_CYCLES = 5;
		for (let i = 0; i < MAX_REPLAY_CYCLES; i++) {
			if (archStep.completed) { break; }
			if (archStep.phase === 'ARCHITECTURE' && archStep.gateTriggered) { break; }
			archStep = await driver.runUntilInput();
			expect(archStep.success, `replay cycle ${i} failed: ${archStep.error}`).toBe(true);
		}
		expect(archStep.phase).toBe('ARCHITECTURE');

		// ── Inspect persisted architecture document ──
		const archDocResult = getArchitectureDocumentForDialogue(driver.dialogueId);
		expect(archDocResult.success).toBe(true);
		if (!archDocResult.success) { return; }
		expect(archDocResult.value).not.toBeNull();
		const doc = archDocResult.value!;
		expect(doc.components.length).toBeGreaterThan(0);

		// RAD invariant assertions (the same set as the capture test)
		const realWorkflowIds = new Set(doc.workflow_graph.map(w => w.workflow_id));
		for (const comp of doc.components) {
			for (const wfId of comp.workflows_served) {
				expect(realWorkflowIds.has(wfId)).toBe(true);
			}
		}
		const componentIds = new Set(doc.components.map(c => c.component_id));
		for (const comp of doc.components) {
			const isOrphan = comp.workflows_served.length === 0 && !comp.parent_component_id;
			expect(isOrphan).toBe(false);
			if (comp.parent_component_id) {
				expect(componentIds.has(comp.parent_component_id)).toBe(true);
			}
			for (const dep of comp.dependencies) {
				expect(componentIds.has(dep)).toBe(true);
			}
		}
		for (const iface of doc.interfaces) {
			expect(componentIds.has(iface.provider_component)).toBe(true);
			for (const consumer of iface.consumer_components) {
				expect(componentIds.has(consumer)).toBe(true);
			}
		}
		expect(new Set(doc.components.map(c => c.component_id)).size).toBe(doc.components.length);
	}, 60_000); // 60s — replay should be sub-second; allow headroom for I/O.
});
