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
		// ⭐ `REG-F-505` remedy 1 — this pinned "commits to the DRAFT immediately"; each proposal lands in the turn's candidate.
		expect(prompt).toMatch(/Each successful mutating tool proposal is applied to the candidate at once/);
		expect(prompt).toMatch(/workbench-wide shared-library entry/);
		expect(prompt).toMatch(/requires explicit user authorization/);
		expect(prompt).toMatch(/REUSE only ACTIVE non-floor ids/);
		// ⭑ `DD-5` (`REG-D-070` Q3(c)): the listing itself is now ACTIVE-only, and the agent is told so — else it
		// would read the absence of a policy it just created as that policy having failed to exist.
		expect(prompt).toMatch(/it lists only ACTIVE policies/);
		expect(prompt).toMatch(/has no policy-activation tool/);
		expect(prompt).toMatch(/authoring tools reject any newly added DRAFT/);
		expect(prompt).toMatch(/do not reference its id until then/);
		expect(prompt).toMatch(/reverting the PWA DRAFT removes a shared policy/);
		// ⭐ `REG-F-505` remedy 1 — these pinned "reviews the resulting DRAFT after the fact, not through a per-tool
		// preview/accept step": the professional accepts the whole candidate, replayed in one transaction.
		expect(prompt).toMatch(/then the candidate waits for the professional/);
		expect(prompt).toMatch(
			/Acceptance replays the candidate's recorded changes, a created policy among them, onto the DRAFT and the shared library in one transaction/
		);
		expect(prompt).toMatch(/scaffold_graph is atomic only within that one invocation/);
		expect(prompt).toMatch(/link_types cardinality/);
		expect(prompt).toMatch(/ID_COLLISION.*not a stale-read conflict/);
		expect(prompt).toMatch(/do not refresh and retry the same unchanged create\/scaffold/);
		expect(prompt).toMatch(/obtain the user's explicit acceptance first/);
		// ⭐ `REG-F-505` remedy 1 — this pinned "There is no staged preview, whole-turn transaction, semantic undo, or
		// rollback"; the staging exists, and what is still absent is an undo after acceptance.
		expect(prompt).toContain('After acceptance there is no semantic undo or rollback');
	});

	// ⭐ `REG-F-505` remedy 1 (`REG-D-121` Q18; `DESIGN-phase-7-completion.md` §4a E1): each turn runs on a fork of
	// canonical and reaches the DRAFT only when the professional accepts the exact candidate, so GOVERNANCE says so.
	it('⭐ GOVERNANCE describes the staged turn: the fork, the floor, acceptance of the exact candidate hash, and discard', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});
		const governance = prompt.slice(prompt.indexOf('GOVERNANCE'), prompt.indexOf('CURRENT PWA'));
		expect(governance, 'arrangement: the GOVERNANCE section').toMatch(/^GOVERNANCE — read carefully/);

		expect(governance).toContain('It works on a candidate: an isolated fork of the workbench');
		expect(governance).toContain('Nothing you do reaches the DRAFT or the shared library during your turn.');
		expect(governance).toContain('the workbench runs the assurance floor over the candidate');
		expect(governance).toContain('only by the professional, who accepts the exact candidate by its hash');
		expect(governance).toContain('The professional may instead discard the candidate');
		expect(governance).toContain(
			'none of its changes, a created policy among them, ever reaches the DRAFT or the shared library'
		);
		// ⛔ The staging this prompt used to call absent.
		expect(governance).not.toMatch(/commits to the DRAFT immediately/);
		expect(governance).not.toMatch(/reviews the resulting DRAFT after the fact/);
		expect(governance).not.toContain('There is no staged preview');
	});

	// ⭐ `REG-F-505` remedy 2 (`DESIGN-phase-7-completion.md` §4a E1): a PWA meant to run needs MODEL and an ACTIVE
	// prompt on each type a model is to execute; the catalog's blueprints leave that question open.
	it('⭐ HOW TO WORK: a type a model is to run declares MODEL and an ACTIVE prompt, using only supplied markers, and blueprints leave the discharge open', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});
		const howToWork = prompt.slice(prompt.indexOf('HOW TO WORK'), prompt.indexOf('GOVERNANCE'));
		expect(howToWork, 'arrangement: the HOW TO WORK section').toMatch(/^HOW TO WORK\n1\. /);

		expect(howToWork).toContain(
			'a type a model is to execute declares workDischarge MODEL and carries an ACTIVE prompt'
		);
		expect(howToWork).toContain('armed with promptActive true');
		expect(howToWork).toContain('using only the markers a work unit supplies');
		expect(howToWork).toContain('a DRAFT prompt, or a marker no work unit supplies, refuses');
		expect(howToWork).toContain('Catalog blueprints leave the discharge choice open');
		expect(howToWork).toContain('decide it, with edit_pwu_type, for every type you copy');
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
		// D-1a — the trio SHALL NOT be conflated with platform/content NOR with STD-1-I(d)'s three-policy floor triad.
		expect(prompt).toContain('three PLANES, not three policies');
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
