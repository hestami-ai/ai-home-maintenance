// The CapabilityBroker driven WITHOUT any LLM: a plain in-memory engine, a DRAFT PWA, and direct method calls.
// Proves every READ + PROPOSE path and the governance guards — this is the surface the Pi agent will call, so if
// these pass, the agent's tools are exercising a verified layer and only the LLM wiring remains to test live.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { createEngine, type EngineHandle } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeEach, describe, expect, it } from 'vitest';
import { PwaAuthoringBroker } from './broker.js';

const TS = '2026-07-12T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';

describe('PwaAuthoringBroker — the LLM-agnostic PWA-authoring capability layer', () => {
	let engine: EngineHandle;
	let broker: PwaAuthoringBroker;
	let mintSeq: number;
	let evtSeq: number;

	/** Deterministic id minter (padded so ids sort) — the host owns id policy; here it is a simple counter. */
	function mint(prefix: string): string {
		mintSeq += 1;
		return `${prefix}_${String(mintSeq).padStart(26, '0')}`;
	}

	/** Dispatch a raw command (used to set up a DRAFT PWA and to drive the publication FSM the broker won't). */
	function raw(commandType: string, id: string, type: string, payload: unknown) {
		evtSeq += 1;
		const command: DomainCommand = {
			commandId: `setup-${evtSeq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: { actorId: 'setup', actorType: 'HUMAN', displayName: 'Setup' },
			correlationId: 'setup',
			idempotencyKey: `setup-idem-${evtSeq}`,
			payload
		};
		return engine.dispatch(command);
	}

	beforeEach(() => {
		mintSeq = 0;
		evtSeq = 0;
		engine = createEngine({ ontology, now: () => TS, newEventId: () => `e${++evtSeq}` });
		raw('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA,
			name: 'Ops PWA',
			description: 'ops',
			domain: 'software',
			version: '1.0.0'
		});
		broker = new PwaAuthoringBroker({ engine, pwaId: PWA, mintId: mint, now: () => TS });
	});

	// ---- READ ----

	it('reads the DRAFT PWA and starts with no PWU Types', () => {
		expect(broker.getPwa()).toMatchObject({ id: PWA, name: 'Ops PWA', publicationStatus: 'DRAFT' });
		expect(broker.listTypes()).toEqual([]);
	});

	it('exposes the catalog + field help (the single source the agent tool schemas reuse)', () => {
		expect(broker.catalog().length).toBeGreaterThan(0);
		expect(broker.help().pwuKind).toMatch(/SCREAMING_SNAKE/);
		expect(broker.help().requiredOutputs).toMatch(/PRODUCES/);
	});

	it('creates an Assurance Policy (workbench-wide) and lists it in the library', () => {
		const r = broker.createPolicy({
			name: 'Tenant Isolation Review',
			purpose: 'Every tenant boundary is enforced.',
			criteria: ['Tenant data is isolated', 'Cross-tenant access is denied']
		});
		expect(r.ok, r.error).toBe(true);
		const created = broker.listPolicies().find((p) => p.id === r.id);
		expect(created).toMatchObject({
			name: 'Tenant Isolation Review',
			version: '1.0.0',
			// A newly authored (non-floor) policy is born DRAFT — the ratified AssurancePolicy.status initial state
			// (DOC-002 §18). Activation to put it in force is a separate, deliberate governance step.
			status: 'DRAFT',
			isFloor: false
		});
	});

	// ---- PROPOSE: define / edit / remove ----

	it('defines a PWU Type with the rich fields and returns its minted id', () => {
		const r = broker.defineType({
			name: 'Architecture Definition',
			pwuKind: 'ARCHITECTURE',
			isRoot: false,
			requiredInputs: ['approved-behavior'],
			requiredOutputs: ['architecture-baseline']
		});
		expect(r.ok).toBe(true);
		const t = broker.getType(r.id!);
		expect(t).toMatchObject({
			name: 'Architecture Definition',
			pwuKind: 'ARCHITECTURE',
			requiredInputs: ['approved-behavior'],
			requiredOutputs: ['architecture-baseline']
		});
	});

	it('rejects a define missing name or kind before touching the engine', () => {
		expect(broker.defineType({ name: '', pwuKind: 'X' }).ok).toBe(false);
		expect(broker.defineType({ name: 'X', pwuKind: '' }).ok).toBe(false);
		expect(broker.listTypes()).toEqual([]);
	});

	it('defines from a catalog template, carrying the blueprint fields (copy-on-use)', () => {
		const r = broker.defineFromTemplate('architecture');
		expect(r.ok).toBe(true);
		expect(broker.getType(r.id!)).toMatchObject({
			pwuKind: 'ARCHITECTURE',
			requiredInputs: ['approved-behavior'],
			requiredOutputs: ['architecture-baseline']
		});
	});

	it('edits a PWU Type in place, changing only the present fields', () => {
		const id = broker.defineType({ name: 'A', pwuKind: 'ARCH', completionRule: 'rule-1' }).id!;
		const r = broker.editType(id, { purpose: 'revised purpose' });
		expect(r.ok).toBe(true);
		const t = broker.getType(id)!;
		expect(t.purpose).toBe('revised purpose');
		expect(t.completionRule).toBe('rule-1'); // untouched field preserved
	});

	it('removes (tombstones) a PWU Type so it leaves the live set', () => {
		const id = broker.defineType({ name: 'Throwaway', pwuKind: 'TMP' }).id!;
		expect(broker.removeType(id).ok).toBe(true);
		expect(broker.getType(id)).toBeUndefined();
		expect(broker.listTypes()).toEqual([]);
	});

	// ---- PROPOSE: link / unlink ----

	it('links parent -> child (permits edge), is idempotent, and unlinks', () => {
		const parent = broker.defineType({ name: 'Root', pwuKind: 'ROOT', isRoot: true }).id!;
		const child = broker.defineType({ name: 'Child', pwuKind: 'CHILD' }).id!;
		expect(broker.linkTypes(parent, child).ok).toBe(true);
		expect(broker.getType(parent)!.permittedChildTypeIds).toEqual([child]);
		// idempotent: re-link does not duplicate
		expect(broker.linkTypes(parent, child).status).toBe('DUPLICATE');
		expect(broker.getType(parent)!.permittedChildTypeIds).toEqual([child]);
		// unlink
		expect(broker.unlinkTypes(parent, child).ok).toBe(true);
		expect(broker.getType(parent)!.permittedChildTypeIds).toEqual([]);
	});

	it('refuses to link unknown types or a type to itself', () => {
		const a = broker.defineType({ name: 'A', pwuKind: 'A' }).id!;
		expect(broker.linkTypes(a, a).ok).toBe(false);
		expect(broker.linkTypes(a, 'pwut_missing').ok).toBe(false);
		expect(broker.linkTypes('pwut_missing', a).ok).toBe(false);
	});

	// ---- PROPOSE: setPwaDetails ----

	it('edits the PWA’s own details', () => {
		expect(broker.setPwaDetails({ domain: 'logistics' }).ok).toBe(true);
		expect(broker.getPwa()!.domain).toBe('logistics');
	});

	// ---- BATCH: scaffold (atomic) ----

	it('scaffolds a whole graph atomically, wiring permits edges by temp key', () => {
		const r = broker.scaffold([
			{
				tempKey: 'root',
				name: 'Realization',
				pwuKind: 'REAL',
				isRoot: true,
				childTempKeys: ['arch']
			},
			{
				tempKey: 'arch',
				name: 'Architecture',
				pwuKind: 'ARCH',
				requiredInputs: ['approved-behavior'],
				requiredOutputs: ['architecture-baseline']
			}
		]);
		expect(r.ok).toBe(true);
		expect(broker.listTypes()).toHaveLength(2);
		const root = broker.getType(r.ids!.root!)!;
		expect(root.isRoot).toBe(true);
		expect(root.permittedChildTypeIds).toEqual([r.ids!.arch!]);
	});

	it('scaffold is all-or-nothing: one bad spec rolls back the whole batch', () => {
		const r = broker.scaffold([
			{ tempKey: 'ok', name: 'Fine', pwuKind: 'FINE' },
			{ tempKey: 'bad', name: '', pwuKind: 'X' } // missing name -> whole batch aborts
		]);
		expect(r.ok).toBe(false);
		expect(broker.listTypes()).toEqual([]); // nothing committed
	});

	it('scaffold rejects an unknown child temp key without committing', () => {
		const r = broker.scaffold([
			{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT', childTempKeys: ['ghost'] }
		]);
		expect(r.ok).toBe(false);
		expect(broker.listTypes()).toEqual([]);
	});

	// ---- GOVERNANCE: authoring is closed once the PWA leaves DRAFT ----

	it('refuses every PROPOSE once the PWA is PUBLISHED (agent proposes, human publishes; published is immutable)', () => {
		const root = broker.defineType({ name: 'Root', pwuKind: 'ROOT', isRoot: true }).id!;
		// Drive the publication FSM directly (the broker deliberately does not expose it).
		expect(raw('SubmitPwaForReview', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {}).status).toBe(
			'ACCEPTED'
		);
		expect(raw('ValidatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {}).status).toBe('ACCEPTED');
		expect(
			raw('PublishPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { rootPwuTypeId: root }).status
		).toBe('ACCEPTED');
		expect(broker.getPwa()!.publicationStatus).toBe('PUBLISHED');

		// Now every authoring proposal is refused (friendly pre-check) and nothing changes.
		expect(broker.defineType({ name: 'Late', pwuKind: 'LATE' }).ok).toBe(false);
		expect(broker.editType(root, { purpose: 'nope' }).ok).toBe(false);
		expect(broker.setPwaDetails({ domain: 'nope' }).ok).toBe(false);
		expect(broker.scaffold([{ tempKey: 'x', name: 'X', pwuKind: 'X' }]).ok).toBe(false);
		expect(broker.listTypes()).toHaveLength(1); // only the pre-publish root remains
	});
});
