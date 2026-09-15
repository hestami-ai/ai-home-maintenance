// JAN-EXECGOV EG-02 — which steps need a RUNTIME_BINDING, and what it asks for.
//
// ⭑⭑ `STA-8` (`DOC-003:203`): *"Execution requires an approved plan and AUTHORIZED Runtime Bindings."*
// `REG-F-365` measured the breach: `RequestRuntimeBinding` had ZERO production dispatch sites (positive control,
// same form: `ApproveExecutionPlan` → 4), so `bindingAuthorityVerdict` returned `OUT_OF_SCOPE` for every step
// and four live, tested checks were unreachable on real work.
//
// ⭐⭐ JAN-EXEC PHASE 3 — AND THE REQUEST IS NO LONGER ONE HARDCODED CAPABILITY. It is derived from the step
// type's REQUIRES/USES table, which is how `RPH-EXE-004`'s operation-level wording and this code's step-level
// refusal are reconciled rather than one being chosen. The cases below assert the DERIVATION, not a list this
// suite retypes: a test that restated the table would go green on a table that had drifted.
import { describe, expect, it } from 'vitest';
import {
	STEP_CAPABILITY_VOCABULARY,
	stepBindingFor,
	stepCapabilityRefusal
} from './step-binding.js';

const req = (stepType: string, discharge: string | undefined) =>
	stepBindingFor(stepType, discharge, 'bind_1', 'step_1');

const MODEL_STEP = () => req('MODEL_INVOCATION', 'MODEL')!;

/**
 * The status a live, usable binding carries.
 *
 * ⛔ NAMED, so every capability arrangement below differs from the REVOKED arrangements by exactly ONE token.
 * An arrangement that changed two things would leave a refusal attributable to either, which this repository
 * files as *an arrangement that trips two guards proves neither*.
 */
const AUTHORIZED = 'AUTHORIZED';

describe('EG-02 — the binding a step needs', () => {
	it('⭑⭑ a MODEL_INVOCATION on a MODEL-discharged type is bound, and REQUIRES `network`', () => {
		// ⛔ `network` IS NOT COINED. `RPH-EXE-004`, ratified conformance: *"When a binding requests file-system
		// and network access but only file-system is granted, network operations fail authorization."* A model
		// invocation reaches a provider over the network; the rule's own example names the capability. THE
		// MUTANT: invent `model.invoke` — a governed name nothing in the corpus supports.
		//
		// ⚠ AND `REQUIRES` IS THE ASSERTION, not merely presence. A `network` that had drifted to USES would
		// leave a step with no way to reach a provider running anyway, with its tools quietly narrowed instead.
		const binding = MODEL_STEP();
		expect(binding.request.runtimeBindingId).toBe('bind_1');
		expect(binding.request.executionStepId).toBe('step_1');
		expect(binding.capabilityNeeds.find((n) => n.capability === 'network')?.need).toBe('REQUIRES');
	});

	it('⭑ the roleId is the TYPE’s own declaration, not a name invented here', () => {
		// ⭑ `PWU_TYPE.workDischarge` is a RATIFIED enum stating who discharges the work, and the authoring
		// handler REFUSES a type with an ACTIVE prompt template that declares anything but MODEL
		// (`pwa-authoring.ts:332`) — so for exactly the steps bound here the value is guaranteed by a gate.
		// THE MUTANT: hardcode `'role-executor'`, which exists in two TESTS and nowhere else, while the register
		// records `roleId`'s intended source as the principal (`D-3`, `REG-D-026`).
		expect(MODEL_STEP().request.roleId).toBe('MODEL');
	});

	it('⛔⛔ CONTROL — a TRANSFORMATION step gets NO binding, and that must stay true', () => {
		// ⚠ THE MOST IMPORTANT ASSERTION IN THIS FILE. `bindingAuthorityVerdict` returns `OUT_OF_SCOPE` for a
		// step naming no binding, and the kernel records why collapsing that *"would make every plan in the
		// reference seed — which authors no RuntimeBinding whatsoever — permanently unstartable"*. A step that
		// invokes no model needs no network. THE MUTANT: bind every step — every existing plan breaks.
		expect(req('TRANSFORMATION', 'HUMAN')).toBeUndefined();
		expect(req('TRANSFORMATION', 'MODEL')).toBeUndefined();
	});

	it('⚠ BOTH conditions are required — a MODEL_INVOCATION on a non-MODEL type is not bound', () => {
		// A step type that says "a model runs this" over a type that says a human does is a contradiction the
		// authoring gate already refuses. Binding it anyway would assert a role the type DENIES. THE MUTANT:
		// branch on `stepType` alone.
		expect(req('MODEL_INVOCATION', 'HUMAN')).toBeUndefined();
		expect(req('MODEL_INVOCATION', 'UNDECLARED')).toBeUndefined();
		expect(req('MODEL_INVOCATION', undefined)).toBeUndefined();
	});

	it('⚠ the request is EXACTLY the declared needs — not an inflated envelope, and not a second list', () => {
		// `RequestRuntimeBinding` refuses an EMPTY request (N-20) and nothing catches an INFLATED one, so the
		// over-request is the failure mode with no guard. §22.1: *"Requested capability is not granted
		// capability. Capability scope must be explicit."*
		//
		// ⭐ THIS USED TO READ `toHaveLength(1)`, AND KEEPING IT WOULD BE THE WEAKER CLAIM RATHER THAN MERELY A
		// STALE ONE: a count says nothing about WHICH capabilities, and Phase 3 made the request a derivation.
		// The assertion is therefore the derivation itself — the wire request is the needs table's capabilities,
		// in order, and nothing else. THE MUTANT: add `{capability:'secrets'}` "just in case"; or author the
		// request beside the needs instead of from them, so the two can drift.
		const binding = MODEL_STEP();
		expect(binding.request.requestedCapabilities).toEqual(
			binding.capabilityNeeds.map((n) => ({ capability: n.capability }))
		);
		expect(binding.request.requestedCapabilities.length).toBeGreaterThan(0);
	});

	it('⛔ every capability the step names is in the VOCABULARY, with its note', () => {
		// ⭑ `JAN-EXECGOV` `G-1`'s recorded form: *"one capability per step type that a model invocation actually
		// needs, named in the vocabulary with its note, exactly as `D-1` was handled."* A capability requested
		// on the wire that no vocabulary entry names is a name coined at the point of use — which is the act the
		// grant exists to constrain. THE MUTANT: request a fourth capability without adding it to the
		// vocabulary; the wire request grows and nothing anywhere says what it means.
		const named = new Set(STEP_CAPABILITY_VOCABULARY.map((v) => v.capability));
		for (const need of MODEL_STEP().capabilityNeeds) {
			expect(named.has(need.capability), `${need.capability} is not in the vocabulary`).toBe(true);
			expect(need.note.length, `${need.capability} has no note`).toBeGreaterThan(0);
		}
	});

	it('⛔⛔ `process-execution` is its OWN capability and is NOT `file-system`', () => {
		// ⭐ THE DISTINCTION THE LIVE PRECISION CONTROL TURNS ON. Starting a process is strictly larger than
		// writing a file, and a grant that could not tell them apart could not express "may write, may not run"
		// — the narrowest useful authorization this seam has, and the one case Phase 3 exists to be ABLE to
		// fail. THE MUTANT: collapse the two into `file-system`; `run_command` is then minted by a grant that
		// never mentioned running anything, and no arrangement anywhere can express the difference.
		const capabilities = MODEL_STEP().capabilityNeeds.map((n) => n.capability);
		expect(capabilities).toContain('file-system');
		expect(capabilities).toContain('process-execution');
		expect(new Set(capabilities).size, 'no capability is named twice').toBe(capabilities.length);
	});

	it('⭐⭐ R12 — the vocabulary SAYS that `process-execution` subsumes `file-system` and `network`', () => {
		// ⛔ SPONSOR RULING R12 (2026-09-15), DRIVEN RATHER THAN REASONED: with `file-system` WITHHELD the model
		// held only `run_command` and wrote a file OUTSIDE the workspace anyway, because a child process is not
		// confined by anything userspace can assert. The three entries are NOT independent, and a LIST of three
		// notes reads as though they were.
		//
		// ⚠ THIS ASSERTS THE DATA, NOT THE PROSE, and that is the whole point of the field: a subsumption stated
		// only in a note is a claim no gate can read, and this repository has twice found such a note outliving
		// the thing it described. THE MUTANT: empty `subsumes` on `process-execution` — the vocabulary goes back
		// to presenting three independent capabilities and nothing turns red.
		const byId = new Map(STEP_CAPABILITY_VOCABULARY.map((v) => [v.capability, v]));
		expect([...byId.get('process-execution')!.subsumes].sort()).toEqual(['file-system', 'network']);
		// ⭑ AND THE CONVERSE IS NOT CLAIMED. `file-system` subsuming `process-execution` would say writing a
		// file starts a process, which is false and would make "may write, may not run" meaningless.
		expect(byId.get('file-system')!.subsumes).toEqual([]);
		expect(byId.get('network')!.subsumes).toEqual([]);
	});

	it('⛔ R13 — the vocabulary records that `process-execution` means arbitrary code as the server user', () => {
		// ⭐ THE RULING'S OTHER HALF, AND IT IS A RECORD-PLANE OBLIGATION RATHER THAN A CODE ONE. `cmd.exe` and
		// `powershell.exe` as `argv[0]` were DRIVEN and work; a BLOCKLIST IS REFUSED BY RULING, because refusing
		// `cmd.exe` while permitting `node -e` is theatre a later reader would mistake for a containment
		// property. What is owed instead is that the note SAYS what granting it confers, and names R9's
		// deployment tier as the only claimed boundary. THE MUTANT: delete either sentence; the vocabulary then
		// describes a tool while implying a confinement nothing provides.
		const note = STEP_CAPABILITY_VOCABULARY.find((v) => v.capability === 'process-execution')!.note;
		expect(note).toMatch(/ARBITRARY CODE AS THE SERVER USER/);
		expect(note).toMatch(/blocklist is REFUSED BY RULING/);
		expect(note, 'and it names whose boundary it is').toMatch(/R9/);
	});
});

describe('EG-03 / Phase 3 — REQUIRES refuses the step, USES does not', () => {
	it('⛔ an ungranted REQUIRES capability refuses, and the message says which and why', () => {
		const refusal = stepCapabilityRefusal(
			MODEL_STEP(),
			['file-system', 'process-execution'],
			AUTHORIZED
		);
		expect(refusal).toMatch(/does not grant 'network'/);
		expect(refusal).toMatch(/REQUIRES/);
		expect(refusal).toMatch(/RPH_CAPABILITY_NOT_GRANTED/);
	});

	it('⭐⭐ an ungranted USES capability does NOT refuse — the tool is withheld instead', () => {
		// ⛔ THE RECONCILIATION, ASSERTED. `RPH-EXE-004` degrades an OPERATION; refusing the whole step here
		// would overturn that while appearing to enforce it. THE MUTANT: drop the `need !== 'REQUIRES'` guard —
		// both arrangements below start refusing and the degradation becomes unreachable.
		expect(stepCapabilityRefusal(MODEL_STEP(), ['network'], AUTHORIZED)).toBeUndefined();
		expect(
			stepCapabilityRefusal(MODEL_STEP(), ['network', 'file-system'], AUTHORIZED)
		).toBeUndefined();
	});

	// ── ⭐⭐ `B-1` — §22.1 IS RATIFIED AND WAS ENFORCED NOWHERE PER TRY ────────────────────────────────────────
	//
	// ⛔ THE ARRANGEMENT IS THE ONE THE STORE ACTUALLY HOLDS AFTER A REVOCATION, and that is what makes it a
	// test rather than a strawman: `RevokeRuntimeCapability` advances `authorizationStatus` and DELIBERATELY
	// leaves `grantedCapabilities` alone, because the revocation EVENT is derived from the set the binding held.
	// So the grant below is FULL — every capability the step needs is present, and the capability limbs CANNOT
	// fire. Only the status limb can explain a refusal.
	it('⭐⭐ a REVOKED binding refuses even on a FULL grant, and the message does not claim a missing capability', () => {
		const full = ['network', 'file-system', 'process-execution'];
		const refusal = stepCapabilityRefusal(MODEL_STEP(), full, 'REVOKED');
		expect(refusal, 'a revoked binding cannot back a new attempt (§22.1)').toBeDefined();
		expect(refusal).toMatch(/is REVOKED/);
		expect(refusal).toMatch(/cannot back a new attempt/);
		// ⛔ AND IT SAYS WHY THE SURVIVING LIST IS NOT AN AUTHORIZATION — the fact that made this defect
		// invisible for a whole phase, written into the refusal so the next reader does not have to rediscover it.
		expect(refusal).toMatch(/does not clear the set/);
		// ⚠ A MESSAGE THAT NAMED A MISSING CAPABILITY WOULD BE FALSE OF ITS INPUT, which this repository holds
		// to be worse than no refusal — see the over-folded workspace guard one plane over.
		expect(refusal).not.toMatch(/does not grant/);
	});

	it('⛔ DENIED refuses too, and the message names the state it was actually in', () => {
		const refusal = stepCapabilityRefusal(
			MODEL_STEP(),
			['network', 'file-system', 'process-execution'],
			'DENIED'
		);
		expect(refusal).toMatch(/is DENIED/);
	});

	it('⭑ CONTROL — the same FULL grant under AUTHORIZED proceeds, so the limb is not "refuse everything"', () => {
		// ⭐ ONE TOKEN OF DIFFERENCE FROM THE CASE ABOVE. Without it the limb is satisfied by an unconditional
		// refusal, which is *a control that cannot fail* and would silently kill every model step in the system.
		expect(
			stepCapabilityRefusal(
				MODEL_STEP(),
				['network', 'file-system', 'process-execution'],
				AUTHORIZED
			)
		).toBeUndefined();
	});

	it('⭑ CONTROL — PARTIALLY_AUTHORIZED is lawful, because a NARROWER grant is exactly what it means', () => {
		// ⚠ THE OVER-REFUSAL THIS LIMB IS MOST AT RISK OF. `grantedWithinRequest` exists because a grant
		// narrower than the request is legal — it is `RPH-EXE-004`'s own example — and refusing this state would
		// strand every least-privilege authorization the ratified machine has a state for.
		expect(
			stepCapabilityRefusal(MODEL_STEP(), ['network'], 'PARTIALLY_AUTHORIZED')
		).toBeUndefined();
	});

	it('⛔ the STATUS limb fires BEFORE the capability limbs, so the message describes the real reason', () => {
		// ⚠ BOTH WOULD REFUSE THIS ARRANGEMENT, AND THAT IS WHY THE ORDER IS ASSERTED RATHER THAN ASSUMED: an
		// arrangement that trips two conjuncts proves neither, so what is pinned is WHICH ONE SPOKE. A revoked
		// binding whose grant also lacks `network` is revoked first; reporting the capability would send a
		// reader to authorize a capability on a binding that can no longer authorize anything.
		const refusal = stepCapabilityRefusal(MODEL_STEP(), [], 'REVOKED');
		expect(refusal).toMatch(/is REVOKED/);
		expect(refusal).not.toMatch(/does not grant 'network'/);
	});

	it('⚠ EXACT membership, never a prefix and never a case fold — the kernel’s own predicate', () => {
		// ⭑ `capabilityAuthorized` is `granted.includes(required)`. Four near-misses, every one of which some
		// plausible normaliser would let through, and every one must refuse. THE MUTANT: `startsWith`, or a
		// `toLowerCase()` "for convenience"; each hands a step a capability nobody granted.
		for (const near of ['networ', 'networks', 'NETWORK', ' network'])
			expect(stepCapabilityRefusal(MODEL_STEP(), [near], AUTHORIZED), near).toMatch(
				/does not grant 'network'/
			);
	});
});
