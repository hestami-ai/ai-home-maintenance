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
		expect(prompt).toMatch(/link_types cardinality/);
		expect(prompt).toMatch(/ID_COLLISION.*not a stale-read conflict/);
		expect(prompt).toMatch(/do not refresh and retry the same unchanged create\/scaffold/);
		expect(prompt).toMatch(/obtain the user's explicit acceptance first/);
		expect(prompt).toContain(
			'There is no staged preview, whole-turn transaction, semantic undo, or rollback'
		);
	});

	// JAN-PRPWA-DS-001 SPEC-1 / DR-001 DWP-01: the agnostic core states the STD-1 leaf criterion (both branches),
	// comprehensive-by-default (P-1), the D-3 negative platform rule + substrate list, and the three named planes.
	it('states the STD-1 leaf criterion (irreducible OR delegated), comprehensive-by-default, the platform/content rule, and the three planes', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});

		// STD-1 — both leaf branches present.
		expect(prompt).toContain('IRREDUCIBLE within scope');
		expect(prompt).toContain('DELEGATED across an organizational boundary');
		// P-1 — comprehensive-by-default.
		expect(prompt).toContain('COMPREHENSIVE BY DEFAULT');
		// D-3 — negative platform rule + the substrate the agent must NOT author.
		expect(prompt).toContain('MUST NOT be created as PWU Types');
		expect(prompt).toContain('event ledger / governed stream');
		expect(prompt).toContain('universal assurance floor');
		// D-1a — the three planes named and kept distinct.
		expect(prompt).toContain('THREE distinct planes');
		expect(prompt).toContain('COMPOSITION ARCHITECTURE');
		expect(prompt).toContain('ARTIFACT HAND-OFF');
		expect(prompt).toContain('PWU LIFECYCLE');
	});

	// JAN-PRPWA-DS-001 STD-3 / DR-001 DWP-04: the agnostic core teaches how to AUTHOR a delegated leaf — the
	// contract in lieu of children, the attested policies as the counterparty's claim (INV-2), the hand-off via
	// requiredInputs/requiredOutputs.
	it('states how to author a DELEGATED_EXTERNAL leaf (STD-3): contract in lieu of children, attested claim, hand-off', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});

		expect(prompt).toContain('AUTHORING A DELEGATED LEAF');
		expect(prompt).toContain('executionBoundary = DELEGATED_EXTERNAL');
		expect(prompt).toContain('attestedAssurancePolicyIds');
		expect(prompt).toContain('disclosure is not verification');
		expect(prompt).toMatch(/requiredInputs\/requiredOutputs/);
	});
});
