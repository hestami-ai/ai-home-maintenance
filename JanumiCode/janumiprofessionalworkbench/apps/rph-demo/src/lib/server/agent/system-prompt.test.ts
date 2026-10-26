import { markersIn, WORK_UNIT_MARKERS } from '@janumipwb/rph-application';
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
		// ⛔ MOVED 2026-10-26 (`JAN-EXEC` Phase 7, package O; design D25, revision 3) — ~~`toMatch(/does NOT by itself establish
		// execution order/)`~~: the statement is reconciled, by striking it in place, with the start rule the engine enforces — a
		// matching artifact name is a dependency the engine enforces for readiness, not a schedule.
		expect(prompt).toContain('it is a dependency the engine enforces for readiness, not a schedule');
		expect(prompt).not.toMatch(/does NOT by itself establish execution order/);
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

		// ⭐ `REG-D-122` Q22 (§4b E5) — this pinned "a type a model is to execute declares …"; the default now says
		// which types those are.
		expect(howToWork).toContain(
			'A type whose work the workbench carries out declares workDischarge MODEL and carries an ACTIVE prompt'
		);
		expect(howToWork).toContain('armed with promptActive true');
		expect(howToWork).toContain('using only the markers a work unit supplies');
		expect(howToWork).toContain('a DRAFT prompt, or a marker no work unit supplies, refuses');
		expect(howToWork).toContain('Catalog blueprints leave the discharge choice open');
		expect(howToWork).toContain('decide it, with edit_pwu_type, for every type you copy');
	});

	// ⭐ `REG-F-507` remedy 2 (`DESIGN-phase-7-completion.md` §4a E2): the instructions name the markers a work unit
	// supplies, read from the one render map, as the shared help names them.
	it('⭐ HOW TO WORK names the markers a work unit supplies — {subject}, {title}, {description} and {purpose} — and no other', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});
		expect(markersIn(prompt), 'the markers the instructions name').toEqual([
			'subject',
			'title',
			'description',
			'purpose'
		]);
		expect(markersIn(prompt), 'read from the render map').toEqual([...WORK_UNIT_MARKERS]);
		expect(prompt).toContain(
			'A work unit supplies {subject}, {title}, {description} and {purpose}, and no other marker.'
		);
	});

	// ⭐ `REG-D-122` Q22 (`DESIGN-phase-7-completion.md` §4b E5): run-10's accepted PWA declared 15 of 15 types HUMAN
	// with no prompt, its request leaving who does the work unstated. In a PWA the agent authors, a type that reviews or
	// decides an escalation declares HUMAN, MODEL is the default for every other INTERNAL type, a request that says a
	// person does the work overrides it, and ordinary assurance reviews are policies, not types.
	// ⭐ The check of E5: its default covered every type the request is silent about, so read literally it also told a
	// type that reviews or decides an escalation, and a leaf the agent judges DELEGATED_EXTERNAL, to declare MODEL; the
	// engine refuses any workDischarge on a delegated type (rph-application, handlers/pwa-authoring.ts). So the default
	// is pinned with its limit, and the escalation rule as the exception its "every other" names, just before it.
	it("⭐ HOW TO WORK: a type that reviews or decides an escalation declares HUMAN, MODEL is the default for every other INTERNAL type in a PWA the agent authors, the request's words override it, and ordinary assurance reviews stay with the reviewer model", () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});
		const howToWork = prompt.slice(prompt.indexOf('HOW TO WORK'), prompt.indexOf('GOVERNANCE'));
		expect(howToWork, 'arrangement: the HOW TO WORK section').toMatch(/^HOW TO WORK\n1\. /);

		expect(howToWork, 'the default').toContain(
			"For every other INTERNAL type in a PWA you author, MODEL is the default: when the request does not say who does that type's work, the workbench carries it out."
		);
		expect(howToWork, "the request's exception").toContain(
			"The request's words override that default: when the request says a person does a type's work, that type declares HUMAN."
		);
		expect(howToWork, 'the escalation review').toContain(
			'A type that reviews or decides an escalation declares HUMAN.'
		);
		expect(howToWork, "the exception the default's 'every other' names").toContain(
			'A type that reviews or decides an escalation declares HUMAN. For every other INTERNAL type'
		);
		expect(howToWork, 'ordinary assurance reviews').toContain(
			'Ordinary assurance reviews stay with the reviewer model: they are policies, not types.'
		);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package O — D25 (design revision 3; the lead's decision, flagged for the sponsor): THE AUTHOR IS TOLD THE
	// START RULE THE ENGINE ENFORCES (`REG-D-135` (2), D21) — all four parts, together, in the data-flow section the agent reads
	// when it declares requiredInputs and requiredOutputs. This informs the author of what the engine does; it dodges no defect
	// (`REG-D-110` (4)).
	it('⭐ D25 — WHAT YOU ARE AUTHORING states the start rule the engine enforces, all four parts: a producer’s unit accepted first, a parent after its children, only originating-intent from the Intent, and any other input nothing produces expected from outside', () => {
		const prompt = buildSystemPrompt({
			id: 'PWA-TEST',
			name: 'Test PWA',
			domain: 'testing',
			publicationStatus: 'DRAFT'
		});
		const authoring = prompt.slice(prompt.indexOf('WHAT YOU ARE AUTHORING'), prompt.indexOf('GRAPH STRUCTURE'));
		expect(authoring, 'arrangement: the WHAT YOU ARE AUTHORING section').toMatch(/^WHAT YOU ARE AUTHORING\n- /);

		expect(authoring, 'the producer').toContain(
			"a type whose required input matches another type's required output waits until that producer's unit is accepted (signed off)"
		);
		expect(authoring, 'the children').toContain('a parent waits for its children');
		expect(authoring, 'the Intent').toContain("only originating-intent comes from the Undertaking's Intent");
		expect(authoring, 'the outside input').toContain(
			'any other required input that no unit of the Undertaking produces is expected from outside the Undertaking and does not hold its unit back'
		);
		// ⭑ And what follows from the fourth: a misspelt name is an outside input, never a hand-off, so the author spells each alike.
		expect(authoring).toContain('a misspelt artifact name becomes an outside input, never a hand-off');
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
