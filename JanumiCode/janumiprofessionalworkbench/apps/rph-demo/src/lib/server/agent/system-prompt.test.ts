import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt.js';

describe('buildSystemPrompt authoring-backbone boundaries', () => {
	it('keeps layout, lifecycle simulation, data-flow, and proposal timing in their proper authority domains', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});

		expect(prompt).toContain('human presentation controls only');
		expect(prompt).toContain('list_pwu_types returns semantic PWA/PWU Type fields');
		expect(prompt).toContain('get_pwu_lifecycle_topology');
		expect(prompt).toContain('SIMULATE.PWU.* events are browser-local simulation events');
		expect(prompt).toContain('cannot be fixed by moving nodes or changing layout');
		expect(prompt).toMatch(/does NOT by itself establish execution order/);
		expect(prompt).toContain('Do not encode "then"');
		expect(prompt).not.toContain('data-flow = "then"');
		expect(prompt).not.toContain('for the ordering');
		expect(prompt).toMatch(/commits to the DRAFT immediately/);
		expect(prompt).toMatch(/workbench-wide shared-library entry/);
		expect(prompt).toMatch(/requires explicit user authorization/);
		expect(prompt).toMatch(/REUSE only ACTIVE non-floor ids/);
		expect(prompt).toMatch(/has no policy-activation tool/);
		expect(prompt).toMatch(/authoring tools reject any newly added DRAFT/);
		expect(prompt).toMatch(/do not reference its id until then/);
		expect(prompt).toMatch(/reverting the PWA DRAFT removes a shared policy/);
		expect(prompt).toMatch(/reviews the resulting DRAFT after the fact/);
		expect(prompt).toMatch(/not through a per-tool preview\/accept step/);
		expect(prompt).toMatch(/scaffold_graph is atomic only within that one invocation/);
		expect(prompt).toContain(
			'There is no staged preview, whole-turn transaction, semantic undo, or rollback'
		);
	});
});
