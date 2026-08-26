import { describe, expect, it } from 'vitest';

import {
	CSAA_TECHNICAL_COMPLETION_STEPS,
	runTechnicalCompletion
} from '../scripts/csaa-technical-completion.js';

const EXPECTED_STEPS = [
	{ args: ['diff', '--check', 'HEAD', '--'], command: 'git', label: 'PATCH_WHITESPACE' },
	{
		args: ['run', 'csaa:generated-context:check'],
		command: process.execPath,
		label: 'GENERATED_CONTEXT_EVIDENCE'
	},
	{
		args: ['run', 'csaa:inventory:check'],
		command: process.execPath,
		label: 'GENERATED_INVENTORY'
	},
	{
		args: ['run', 'csaa:persistence-selection:check'],
		command: process.execPath,
		label: 'DWP_007_PERSISTENCE_SELECTION'
	},
	{
		args: ['run', 'csaa:dependency-cruiser-differential:check'],
		command: process.execPath,
		label: 'DWP_004_BROAD_DIFFERENTIAL'
	},
	{
		args: ['run', 'csaa:dependency-cruiser-g4:check'],
		command: process.execPath,
		label: 'G4_SAME_PERIMETER_DIFFERENTIAL'
	},
	{
		args: ['run', 'csaa:agent:current-jpwb:smoke'],
		command: process.execPath,
		label: 'CURRENT_JPWB_CODING_AGENT_WORKFLOW'
	},
	{ args: ['run', 'gate'], command: process.execPath, label: 'FULL_REPOSITORY_GATE' }
] as const;

describe('CSAA technical completion orchestration', () => {
	it('exports and executes the exact deeply immutable completion sequence in order', () => {
		const observed: string[] = [];

		runTechnicalCompletion((step) => observed.push(step.label));

		expect(CSAA_TECHNICAL_COMPLETION_STEPS).toEqual(EXPECTED_STEPS);
		expect(observed).toEqual(EXPECTED_STEPS.map((step) => step.label));
		expect(Object.isFrozen(CSAA_TECHNICAL_COMPLETION_STEPS)).toBe(true);
		for (const step of CSAA_TECHNICAL_COMPLETION_STEPS) {
			expect(Object.isFrozen(step)).toBe(true);
			expect(Object.isFrozen(step.args)).toBe(true);
		}
	});

	it('records completion while granting neither analysis authority nor gate effect', () => {
		const record = runTechnicalCompletion(() => undefined);

		expect(record).toEqual({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			state: 'TECHNICAL_IMPLEMENTATION_CHECKS_COMPLETED',
			steps: EXPECTED_STEPS.map((step) => step.label)
		});
		expect(Object.isFrozen(record)).toBe(true);
		expect(Object.isFrozen(record.steps)).toBe(true);
	});

	it('stops at the first executor failure and preserves that failure', () => {
		const attempted: string[] = [];
		const failure = new Error('selected evidence check failed');
		let caught: unknown;

		try {
			runTechnicalCompletion((step) => {
				attempted.push(step.label);
				if (step.label === 'DWP_007_PERSISTENCE_SELECTION') throw failure;
			});
		} catch (cause) {
			caught = cause;
		}

		expect(caught).toBe(failure);
		expect(attempted).toEqual([
			'PATCH_WHITESPACE',
			'GENERATED_CONTEXT_EVIDENCE',
			'GENERATED_INVENTORY',
			'DWP_007_PERSISTENCE_SELECTION'
		]);
	});
});
