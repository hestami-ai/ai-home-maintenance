// WHAT AN AUTHORING PROPOSAL REPORTS BACK — `ProposalResult` is the WHOLE of what the caller learns.
//
// WHY THIS PROPERTY, AND WHY THE HAPPY PATHS NEXT DOOR DO NOT REACH IT. The broker is driven by an LLM through
// the demo's tool layer. That caller cannot read the event log, cannot see a rejected `CommandResult`, and cannot
// inspect the store: the four fields of `ProposalResult` are its ENTIRE channel. Three failures follow directly,
// and each has a test below:
//
//   • a refusal carrying no reason (`ok: false`, `error: undefined`) is one the agent cannot act on — it will
//     retry the identical proposal, because nothing told it what to change;
//   • a refusal phrased in the BROKER's words where the DOMAIN refused (or the reverse) hides which gate fired,
//     and the two are not interchangeable — one is a friendly pre-check, the other is authoritative (C-5);
//   • an `ok: true` whose state did not move is a save the surface reports and the store never made.
//
// `broker.test.ts` proves the READ + PROPOSE paths and the DRAFT/PUBLISHED seam. It asserts `.ok` on most
// refusals and the MESSAGE on almost none, so nearly every pre-check in this layer is currently satisfiable by
// ANY refusal at all. This file takes that half: the exact words, whose words they are, whether a command was
// wasted reaching them, and the fields a patch actually moves.
//
// WHAT IT DELIBERATELY DOES NOT CLOSE. It says nothing about the domain invariants themselves — that a delegated
// node must be terminal is the handler's rule and is proved there; the only claim here is what the caller is told
// and what the store then holds. It also does not close `toTypeView`'s and `getPwa`'s defensive fallbacks for a
// state missing a required field: `definePwuType` normalises every array and `completionRule` before it commits,
// and `CreatePwa` requires all five fields it reads back, so no state this engine can produce reaches them.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { createEngine, getObject, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaAuthoringBroker, type PromptTemplate } from './broker.js';

const TS = '2026-07-12T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';

const TENANCY = { tenantId: 'tenant-test', organizationId: 'org-test' } as const;
const SETUP = { actorId: 'setup', actorType: 'HUMAN' as const, displayName: 'Setup', ...TENANCY };
/** The broker's own default identity — it writes `issuedBy` itself, so the session must be exactly this actor. */
const AUTHORING_AGENT = {
	actorId: 'jpwb-authoring-agent',
	actorType: 'AGENT' as const,
	displayName: 'JPWB Authoring Agent',
	...TENANCY
};
const DIR = testDirectory([SETUP, AUTHORING_AGENT]);

/** An ACTIVE prompt template with no MODEL discharge: the one authoring request that passes every broker
 *  pre-check and is refused by the DOMAIN, which is what makes it the probe for "whose words came back". */
const ARMED_PROMPT: PromptTemplate = {
	templateText: 'Assess {subject}.',
	templateVersion: 1,
	declaredPlaceholders: ['subject'],
	status: 'ACTIVE'
};

describe('ProposalResult fidelity — the refusal, its author, and the state behind an ok', () => {
	let engine: AuthedEngineHandle;
	let setup: AuthedEngineHandle;
	let broker: PwaAuthoringBroker;
	let mintSeq: number;
	let evtSeq: number;

	function mint(prefix: string): string {
		mintSeq += 1;
		return `${prefix}_${String(mintSeq).padStart(26, '0')}`;
	}

	/** Dispatch as the HUMAN — used only to stand up the DRAFT PWA the broker authors. */
	function raw(commandType: string, id: string, type: string, payload: unknown) {
		evtSeq += 1;
		const command: DomainCommand = {
			commandId: `setup-${evtSeq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'setup',
			idempotencyKey: `setup-idem-${evtSeq}`,
			payload
		};
		return setup.dispatch(command);
	}

	/** A live PWU Type id, defined through the broker (the ordinary path). */
	function define(name: string, kind: string, extra: Record<string, unknown> = {}): string {
		const r = broker.defineType({ name, pwuKind: kind, ...extra });
		expect(r.ok, r.error).toBe(true);
		return r.id!;
	}

	beforeEach(() => {
		mintSeq = 0;
		evtSeq = 0;
		const core = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			now: () => TS,
			newEventId: () => `e${++evtSeq}`
		});
		setup = core.as(DIR.credentialFor(SETUP.actorId));
		engine = core.as(DIR.credentialFor(AUTHORING_AGENT.actorId));
		expect(
			raw('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
				pwaId: PWA,
				name: 'Ops PWA',
				description: 'ops',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		broker = new PwaAuthoringBroker({ engine, pwaId: PWA, mintId: mint, now: () => TS });
	});

	// ---- WHICH SUBJECT THE REFUSAL NAMES ----

	it('names the missing PWA on every proposal that needs a DRAFT one, and wastes no command', () => {
		const orphan = new PwaAuthoringBroker({
			engine,
			pwaId: 'pwa_absent',
			mintId: mint,
			now: () => TS,
			sessionId: 'orphan'
		});
		const dispatch = vi.spyOn(engine, 'dispatch');
		const missing = { ok: false, error: 'PWA pwa_absent does not exist.' };

		expect(orphan.getPwa()).toBeUndefined();
		// Five entry points, five chances to have forgotten the guard — each fails on its own.
		expect(orphan.setPwaDetails({ name: 'Renamed' })).toEqual(missing);
		expect(orphan.defineType({ name: 'A', pwuKind: 'A' })).toEqual(missing);
		expect(orphan.editType('pwut_anything', { purpose: 'p' })).toEqual(missing);
		expect(orphan.removeType('pwut_anything')).toEqual(missing);
		expect(orphan.scaffold([{ tempKey: 'a', name: 'A', pwuKind: 'A' }])).toEqual(missing);
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('will not read a non-PWA object as a PWA, so publicationStatus is never fabricated (REG-F-201)', () => {
		// The CONTROL for the assertions below: this id resolves to a real object, so an UNTYPED read finds it and
		// `String(s.publicationStatus ?? 'DRAFT')` reports a DRAFT PWA that does not exist. The agent endpoint admits
		// exactly 'DRAFT', so that fabrication INVERTS the lifecycle guard rather than merely blurring it.
		const typeId = define('Not A PWA', 'ANY');
		expect(getObject(engine, typeId)).toBeDefined();

		const misbound = new PwaAuthoringBroker({
			engine,
			pwaId: typeId,
			mintId: mint,
			now: () => TS,
			sessionId: 'misbound'
		});
		expect(misbound.getPwa()).toBeUndefined();
		expect(misbound.defineType({ name: 'X', pwuKind: 'X' })).toEqual({
			ok: false,
			error: `PWA ${typeId} does not exist.`
		});
	});

	it('names the PWU Type an edit cannot find, before touching the engine', () => {
		const dispatch = vi.spyOn(engine, 'dispatch');
		expect(broker.editType('pwut_ghost', { purpose: 'revised' })).toEqual({
			ok: false,
			error: 'PWU Type pwut_ghost does not exist on this PWA.'
		});
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('names the unknown parent on unlink, and reports an absent edge as DUPLICATE without dispatching', () => {
		const parent = define('Parent', 'PARENT');
		const stranger = define('Stranger', 'STRANGER');
		expect(broker.unlinkTypes('pwut_ghost', stranger)).toEqual({
			ok: false,
			error: 'Parent PWU Type pwut_ghost does not exist.'
		});
		const dispatch = vi.spyOn(engine, 'dispatch');
		// Idempotent no-op: unlinking an edge that is not there must not append a PwuTypeRedefined nor bump the
		// PWA's semanticVersion, which an EditPwuType round-trip would do for a removal that did not happen.
		expect(broker.unlinkTypes(parent, stranger)).toEqual({
			ok: true,
			id: parent,
			status: 'DUPLICATE'
		});
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('names the catalog key it does not recognise and defines nothing', () => {
		expect(broker.defineFromTemplate('product-realisation')).toEqual({
			ok: false,
			error: 'Unknown catalog template: product-realisation'
		});
		expect(broker.listTypes()).toEqual([]);
	});

	it('refuses a blank policy name before minting an id', () => {
		expect(broker.createPolicy({ name: '   ' })).toEqual({
			ok: false,
			error: 'A policy name is required.'
		});
		expect(mintSeq).toBe(0);
		expect(broker.listPolicies()).toEqual([]);
	});

	it('refuses an empty scaffold and one whose temp keys collide, before minting any id', () => {
		expect(broker.scaffold([])).toEqual({
			ok: false,
			error: 'scaffold requires at least one type.'
		});
		expect(
			broker.scaffold([
				{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT' },
				{ tempKey: 'root', name: 'Second Root', pwuKind: 'ROOT' }
			])
		).toEqual({ ok: false, error: 'scaffold temp keys must be unique.' });
		expect(mintSeq).toBe(0);
		expect(broker.listTypes()).toEqual([]);
	});

	it('refuses a scaffold whose minted id is already taken, naming the id and dispatching no batch', () => {
		const taken = define('Already Here', 'TAKEN');
		const dispatchBatch = vi.spyOn(engine, 'dispatchBatch');
		const colliding = new PwaAuthoringBroker({
			engine,
			pwaId: PWA,
			mintId: () => taken,
			now: () => TS,
			sessionId: 'collide'
		});
		expect(colliding.scaffold([{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT' }])).toEqual({
			ok: false,
			status: 'ID_COLLISION',
			error: `ID_COLLISION: the host minted PWU Type id ${taken}, which already exists. No commands were dispatched; correct the id generator before retrying.`
		});
		expect(dispatchBatch).not.toHaveBeenCalled();
		expect(broker.listTypes()).toHaveLength(1);
	});

	// ---- WHOSE WORDS CAME BACK: the friendly pre-check, or the authoritative domain gate ----

	it('resolves an edit boundary against the MERGED next state, so existing children refuse the flip', () => {
		const child = define('Child', 'CHILD');
		const parent = define('Parent', 'PARENT', { permittedChildTypeIds: [child] });
		const dispatch = vi.spyOn(engine, 'dispatch');
		// The patch names no children at all, so a pre-check reading only the PATCH sees a clean delegated leaf. The
		// broker must resolve against the EXISTING type — and the message is the broker's own: the handler's wording
		// for the same invariant ends "it must declare no permitted child types", so this pins WHICH gate fired.
		expect(
			broker.editType(parent, {
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: { counterpartyLabel: 'Acme Labs', attestedAssurancePolicyIds: [] }
			})
		).toEqual({
			ok: false,
			error:
				'A DELEGATED_EXTERNAL PWU Type is terminal (INV-1): it cannot declare permitted child types. Delegate the whole unit across the boundary, or keep it INTERNAL and decompose.'
		});
		expect(dispatch).not.toHaveBeenCalled();
		expect(broker.getType(parent)!.executionBoundary).toBe('INTERNAL');
	});

	it('returns the DOMAIN words, and its status, when the engine refuses a define the pre-checks passed', () => {
		const r = broker.defineType({ name: 'Armed', pwuKind: 'ARMED', promptTemplate: ARMED_PROMPT });
		expect(r.ok).toBe(false);
		expect(r.status).toBe('REJECTED');
		expect(r.error).toContain(
			'carries an ACTIVE prompt template but declares workDischarge (none)'
		);
		expect(r.error).toContain('Declare MODEL, or leave the template DRAFT.');
		expect(broker.listTypes()).toEqual([]);
	});

	it('relays the same refusal when an EDIT arms a prompt on a type that declares no MODEL', () => {
		// The define path above and this one build their payloads SEPARATELY — the handler's own comment records
		// that as the drift ("two write paths for one field"), and it runs in the broker too. A rejection reaching
		// the caller from one and being swallowed by the other is the asymmetry this pins.
		const id = define('Unarmed', 'UNARMED');
		const r = broker.editType(id, { promptTemplate: ARMED_PROMPT });
		expect(r.ok).toBe(false);
		expect(r.status).toBe('REJECTED');
		expect(r.error).toContain(
			'carries an ACTIVE prompt template but declares workDischarge (none)'
		);
		expect(broker.getType(id)).not.toHaveProperty('promptTemplate');
	});

	it('relays the referential-integrity refusal rather than tombstoning a referenced type', () => {
		const child = define('Child', 'CHILD');
		define('Parent', 'PARENT', { permittedChildTypeIds: [child] });
		const r = broker.removeType(child);
		expect(r.ok).toBe(false);
		expect(r.error).toBe(
			`Cannot remove PWU Type ${child}: 1 other type(s) reference it as a permitted parent/child; clear those references first`
		);
		expect(broker.getType(child)).toBeDefined();
	});

	it('relays "changes nothing" rather than reporting a save the store never made', () => {
		const r = broker.setPwaDetails({ domain: 'software' }); // already the current value
		expect(r.ok).toBe(false);
		expect(r.status).toBe('REJECTED');
		expect(r.error).toContain(
			'EditPwa changes nothing: every field present in the payload already'
		);
		expect(r.error).toContain('Re-issuing would append a second edit event');
		expect(broker.getPwa()!.domain).toBe('software');
	});

	it('rolls a scaffold back whole and reports the refused command own words', () => {
		const r = broker.scaffold([
			{ tempKey: 'fine', name: 'Fine', pwuKind: 'FINE' },
			{ tempKey: 'armed', name: 'Armed', pwuKind: 'ARMED', promptTemplate: ARMED_PROMPT }
		]);
		expect(r.ok).toBe(false);
		expect(r.status).toBe('REJECTED');
		expect(r.error).toContain(
			'carries an ACTIVE prompt template but declares workDischarge (none)'
		);
		// The ATOMICITY half: the first spec was accepted INSIDE the batch and must not survive it.
		expect(broker.listTypes()).toEqual([]);
	});

	it('still gives a reason when a batch refusal identifies no failing command', () => {
		// A guarded batch refuses with `{ ok: false, results: [] }` and no failedIndex. Whatever produced it, a
		// refusal with `error: undefined` is one the agent cannot act on — the unread-refusal shape with the arrow
		// reversed: unreadABLE rather than unread.
		vi.spyOn(engine, 'dispatchBatch').mockReturnValue({ ok: false, results: [] });
		expect(broker.scaffold([{ tempKey: 'a', name: 'A', pwuKind: 'A' }])).toEqual({
			ok: false,
			error: 'scaffold batch was rejected (rolled back).'
		});
	});

	it('falls back to the STATUS as the reason when a refusal carries no message', () => {
		const id = define('Doomed', 'DOOMED');
		vi.spyOn(engine, 'dispatch').mockReturnValue({
			commandId: 'stub-1',
			status: 'REJECTED',
			producedEventIds: []
		});
		expect(broker.removeType(id)).toEqual({ ok: false, status: 'REJECTED', error: 'REJECTED' });
	});

	// ---- WHAT AN `ok` MEANS: the state moved, and only where the caller said ----

	it('reports a replayed proposal as DUPLICATE and does not define the type twice', () => {
		// Two brokers over one engine with the SAME sessionId mint the same commandId and idempotency key — the
		// collision `BrokerDeps.sessionId` exists to prevent. The engine answers DUPLICATE, and `accepted()` counts
		// it as success: the proposal HAS happened, so a caller told otherwise would author it a second time.
		const fixed = 'pwut_00000000000000000000000042';
		const deps = { engine, pwaId: PWA, mintId: () => fixed, now: () => TS, sessionId: 'replay' };
		expect(new PwaAuthoringBroker(deps).defineType({ name: 'Once', pwuKind: 'ONCE' })).toEqual({
			ok: true,
			id: fixed,
			status: 'ACCEPTED'
		});
		expect(new PwaAuthoringBroker(deps).defineType({ name: 'Once', pwuKind: 'ONCE' })).toEqual({
			ok: true,
			id: fixed,
			status: 'DUPLICATE'
		});
		expect(broker.listTypes()).toHaveLength(1);
	});

	it('moves every field an edit names, and leaves the rest of the type alone', () => {
		const id = define('Before', 'BEFORE', {
			purpose: 'unchanged purpose',
			completionRule: 'rule-1',
			requiredInputs: ['in-0'],
			requiredOutputs: ['out-0']
		});
		expect(
			broker.editType(id, {
				name: 'After',
				pwuKind: 'AFTER',
				isRoot: true,
				completionRule: 'rule-2',
				requiredInputs: ['in-1', 'in-2'],
				requiredOutputs: ['out-1'],
				workDischarge: 'MODEL',
				promptTemplate: {
					templateText: 'Assess {subject} against {baseline}.',
					templateVersion: 2,
					declaredPlaceholders: ['subject', 'baseline'],
					status: 'ACTIVE'
				}
			})
		).toEqual({ ok: true, id, status: 'ACCEPTED' });
		expect(broker.getType(id)).toMatchObject({
			name: 'After',
			pwuKind: 'AFTER',
			isRoot: true,
			completionRule: 'rule-2',
			requiredInputs: ['in-1', 'in-2'],
			requiredOutputs: ['out-1'],
			workDischarge: 'MODEL',
			promptTemplate: { templateVersion: 2, declaredPlaceholders: ['subject', 'baseline'] },
			purpose: 'unchanged purpose'
		});
	});

	it('flips a childless type to DELEGATED_EXTERNAL and reads the contract back', () => {
		const id = define('Leaf', 'LEAF');
		const boundaryContract = {
			counterpartyLabel: 'Acme Labs',
			attestedAssurancePolicyIds: [],
			applicabilityNote: 'Statutory audit only.'
		};
		expect(
			broker.editType(id, { executionBoundary: 'DELEGATED_EXTERNAL', boundaryContract })
		).toEqual({ ok: true, id, status: 'ACCEPTED' });
		expect(broker.getType(id)).toMatchObject({
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract
		});
	});

	it('changes only the PWA details the patch names', () => {
		expect(broker.setPwaDetails({ name: 'Renamed PWA', description: 'revised' })).toEqual({
			ok: true,
			id: PWA,
			status: 'ACCEPTED'
		});
		expect(broker.getPwa()).toMatchObject({
			name: 'Renamed PWA',
			description: 'revised',
			domain: 'software' // untouched, because the patch did not name it
		});
	});

	it('carries a scaffolded node declared discharge and completion rule into the stored type', () => {
		// THE THIRD WRITER. `scaffoldCommandFor` builds its own DefinePwuType payload rather than routing through
		// `defineType`, so a field forwarded by the other two can still be dropped on the agent's most-used path —
		// generating a whole graph in one act. The completion rule differs from the handler's default, so the
		// assertion cannot be satisfied by the default.
		const r = broker.scaffold([
			{
				tempKey: 'root',
				name: 'Root',
				pwuKind: 'ROOT',
				isRoot: true,
				workDischarge: 'HUMAN',
				completionRule: 'Signed off by the accountable professional.'
			}
		]);
		expect(r.ok, r.error).toBe(true);
		expect(broker.getType(r.ids!.root!)).toMatchObject({
			workDischarge: 'HUMAN',
			completionRule: 'Signed off by the accountable professional.'
		});
	});

	it('carries per-child cardinality rules through a DEFINE, not only through a link', () => {
		const child = define('Child', 'CHILD');
		const parent = define('Parent', 'PARENT', {
			permittedChildTypeIds: [child],
			permittedChildren: [
				{ typeId: child, cardinality: 'C+', applicabilityNote: 'Per deployment train.' }
			]
		});
		expect(broker.getType(parent)!.permittedChildren).toEqual([
			{ typeId: child, cardinality: 'C+', applicabilityNote: 'Per deployment train.' }
		]);
	});

	it('clears an applicability note when the link passes an empty one, and keeps it when the link omits it', () => {
		const parent = define('Parent', 'PARENT');
		const child = define('Child', 'CHILD');
		expect(
			broker.linkTypes(parent, child, {
				cardinality: 'C1',
				applicabilityNote: 'Only for regulated products.'
			}).ok
		).toBe(true);

		// CONTROL — omitting the key PRESERVES the note. Without it, "an empty note clears it" is satisfiable by an
		// implementation that drops the note on every edit.
		expect(broker.linkTypes(parent, child, { cardinality: 'C+' }).ok).toBe(true);
		expect(broker.getType(parent)!.permittedChildren).toEqual([
			{ typeId: child, cardinality: 'C+', applicabilityNote: 'Only for regulated products.' }
		]);

		// An empty (or whitespace) note is the documented way to CLEAR it, and the cardinality survives the clearing.
		expect(broker.linkTypes(parent, child, { applicabilityNote: '   ' }).ok).toBe(true);
		expect(broker.getType(parent)!.permittedChildren).toEqual([
			{ typeId: child, cardinality: 'C+' }
		]);
	});

	it('annotates an unruled sibling M1 rather than dropping it when an edge is rewritten', () => {
		// A type whose flat edge list was authored WITHOUT cardinality rules is a real shape: `definePwuType` stores
		// `permittedChildren: []` whenever the caller supplies only `permittedChildTypeIds`. Both rewrite paths
		// rebuild the whole rule list, so a missing rule must become M1 — not `undefined`, and not a lost edge.
		const a = define('A', 'A');
		const b = define('B', 'B');
		const c = define('C', 'C');
		const linkParent = define('Link Parent', 'LINK_PARENT', { permittedChildTypeIds: [a, b] });
		const unlinkParent = define('Unlink Parent', 'UNLINK_PARENT', {
			permittedChildTypeIds: [a, b]
		});
		expect(broker.getType(linkParent)!.permittedChildren).toEqual([]);

		expect(broker.linkTypes(linkParent, c, { cardinality: 'C+' }).ok).toBe(true);
		expect(broker.getType(linkParent)!.permittedChildren).toEqual([
			{ typeId: a, cardinality: 'M1' },
			{ typeId: b, cardinality: 'M1' },
			{ typeId: c, cardinality: 'C+' }
		]);

		expect(broker.unlinkTypes(unlinkParent, a).ok).toBe(true);
		expect(broker.getType(unlinkParent)!.permittedChildTypeIds).toEqual([b]);
		expect(broker.getType(unlinkParent)!.permittedChildren).toEqual([
			{ typeId: b, cardinality: 'M1' }
		]);
	});

	it('carries authored claim types and control actions onto a policy, and defaults only when unasked', () => {
		const authored = broker.createPolicy({
			name: 'Tenant Isolation Review',
			evaluatedClaimTypes: ['SECURITY', 'COMPLIANCE'],
			permittedControlActions: ['REQUEST_HUMAN_DECISION', 'ESCALATE']
		});
		expect(authored.ok, authored.error).toBe(true);
		expect(getObject(engine, authored.id!)).toMatchObject({
			evaluatedClaimTypes: ['SECURITY', 'COMPLIANCE'],
			permittedControlActions: ['REQUEST_HUMAN_DECISION', 'ESCALATE']
		});

		// CONTROL — the defaults are what an UNASKED policy gets, so the assertion above is about the forward and
		// not about two spellings of one constant.
		const unasked = broker.createPolicy({ name: 'Unasked' });
		expect(unasked.ok, unasked.error).toBe(true);
		expect(getObject(engine, unasked.id!)).toMatchObject({
			evaluatedClaimTypes: ['CORRECTNESS'],
			permittedControlActions: ['ESCALATE']
		});
	});

	it('stamps wall-clock time on its commands when the host supplies no clock', () => {
		const dispatch = vi.spyOn(engine, 'dispatch');
		const wall = new PwaAuthoringBroker({ engine, pwaId: PWA, mintId: mint, sessionId: 'wall' });
		expect(wall.defineType({ name: 'Now', pwuKind: 'NOW' }).ok).toBe(true);
		const issuedAt = dispatch.mock.calls[0]![0].issuedAt;
		expect(issuedAt).not.toBe(TS); // the engine's injected clock is NOT the broker's default
		expect(Date.parse(issuedAt)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00Z'));
	});
});
