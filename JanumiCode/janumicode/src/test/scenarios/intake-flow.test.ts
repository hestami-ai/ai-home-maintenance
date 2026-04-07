/**
 * Integration Test: INTAKE Flow — Product Discovery → Domain Mapping → Journeys
 *
 * Exercises the full INTAKE workflow with real LLM calls.
 * This tests the exact code path that broke in the UI:
 * - Product Discovery MMP is generated
 * - User accepts all and submits
 * - Domain Mapping proposer runs (not twice!)
 * - User accepts all and submits
 * - Journey Workflow proposer runs (not domain mapping again!)
 *
 * Requires API keys in environment: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { WorkflowTestDriver } from '../helpers/workflowTestDriver';
import { IntakeSubState, ProposerPhase } from '../../lib/types';

// Load .env before the skip check so API keys are available
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

// Skip if no API keys (CI without secrets)
const hasApiKeys = !!(
	process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
);

const describeIf = hasApiKeys ? describe : describe.skip;

describeIf('INTAKE Flow: Product Discovery → Proposer Rounds', () => {
	let driver: WorkflowTestDriver | null = null;

	afterEach(() => {
		driver?.cleanup();
		driver = null;
	});

	// Single test that chains all steps with ONE driver (shared state, no redundant LLM calls).
	// Each LLM call takes ~2-4 minutes. Running 3 steps sequentially in one test.
	it('full flow: Discovery → Domain Mapping → Journeys (no double execution)', async () => {
		driver = await WorkflowTestDriver.create({
			goal: 'Build a property management SaaS platform for residential and commercial real estate. Core features: tenant portal, maintenance requests, lease management, payment processing, and owner reporting dashboard.',
		});

		// ── Step 1: Intent Discovery → Product Discovery MMP ──
		const step1 = await driver.runUntilInput();

		console.log('[TEST] Step 1 (Intent Discovery):', {
			phase: step1.phase,
			subState: step1.subState,
			awaitingInput: step1.awaitingInput,
			preProposerReview: step1.preProposerReview,
			hasMmp: !!step1.mmpPayload,
			mirrorCount: step1.mmpPayload?.mirrorCount,
			phasesExecuted: step1.phasesExecuted,
		});

		expect(step1.phasesExecuted, 'CLI provider likely failed — 0 phases executed').toBeGreaterThan(0);
		expect(step1.success).toBe(true);
		expect(step1.phase).toBe('INTAKE');
		expect(step1.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(step1.preProposerReview).toBe(true);
		expect(step1.awaitingInput).toBe(true);
		expect(step1.mmpPayload).not.toBeNull();
		expect(step1.mmpPayload!.mirrorCount).toBeGreaterThan(0);

		// ── Step 2: Submit Product Discovery MMP → Domain Mapping ──
		const step2 = await driver.submitMmpAcceptAll(step1.mmpPayload!);

		console.log('[TEST] Step 2 (Domain Mapping):', {
			phase: step2.phase,
			subState: step2.subState,
			proposerPhase: step2.proposerPhase,
			preProposerReview: step2.preProposerReview,
			awaitingInput: step2.awaitingInput,
			hasMmp: !!step2.mmpPayload,
			mirrorCount: step2.mmpPayload?.mirrorCount,
			pendingIntakeInput: step2.pendingIntakeInput ? 'SET' : 'NONE',
		});

		expect(step2.success).toBe(true);
		expect(step2.phase).toBe('INTAKE');
		expect(step2.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(step2.proposerPhase).toBe(ProposerPhase.BUSINESS_DOMAIN_MAPPING);
		expect(step2.preProposerReview).toBe(false);
		expect(step2.awaitingInput).toBe(true);
		expect(step2.mmpPayload).not.toBeNull();
		expect(step2.pendingIntakeInput).toBeUndefined();

		// ── Step 3: Submit Domain Mapping MMP → Journeys (THE KEY ASSERTION) ──
		const step3 = await driver.submitMmpAcceptAll(step2.mmpPayload!);

		console.log('[TEST] Step 3 (Journeys):', {
			phase: step3.phase,
			subState: step3.subState,
			proposerPhase: step3.proposerPhase,
			preProposerReview: step3.preProposerReview,
			awaitingInput: step3.awaitingInput,
			hasMmp: !!step3.mmpPayload,
			mirrorCount: step3.mmpPayload?.mirrorCount,
		});

		expect(step3.success).toBe(true);
		expect(step3.phase).toBe('INTAKE');
		expect(step3.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		// THIS IS THE KEY ASSERTION: proposerPhase should be JOURNEY_WORKFLOW, not BUSINESS_DOMAIN_MAPPING
		expect(step3.proposerPhase).toBe(ProposerPhase.JOURNEY_WORKFLOW);
		expect(step3.preProposerReview).toBe(false);
		expect(step3.awaitingInput).toBe(true);
	}, 1_200_000); // 20 min timeout for 3 sequential LLM calls (~3-5 min each)
});
