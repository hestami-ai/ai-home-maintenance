// The CapabilityBroker driven WITHOUT any LLM: a plain in-memory engine, a DRAFT PWA, and direct method calls.
// Proves every READ + PROPOSE path and the governance guards — this is the surface the Pi agent will call, so if
// these pass, the agent's tools are exercising a verified layer and only the LLM wiring remains to test live.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { createEngine, type EngineHandle } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { monotonicFactory } from 'ulid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

	it('allows only ACTIVE non-floor policies as new declarations while preserving an existing inactive reference', () => {
		const policy = broker.createPolicy({ name: 'Tenant Review' });
		expect(policy.ok).toBe(true);
		expect(
			broker.defineType({
				name: 'Rejected Draft Reference',
				pwuKind: 'REJECTED',
				requiredAssurancePolicyIds: [policy.id!]
			}).error
		).toMatch(/is DRAFT/);
		expect(
			broker.defineType({
				name: 'Rejected Floor Reference',
				pwuKind: 'REJECTED',
				requiredAssurancePolicyIds: ['floor.reasoning-review']
			}).error
		).toMatch(/must not be referenced explicitly/);
		expect(
			broker.defineType({
				name: 'Rejected Missing Reference',
				pwuKind: 'REJECTED',
				requiredAssurancePolicyIds: ['pol_missing']
			}).error
		).toMatch(/does not exist/);

		expect(
			raw('ActivateAssurancePolicy', policy.id!, 'ASSURANCE_POLICY', { policyId: policy.id! })
				.status
		).toBe('ACCEPTED');
		const type = broker.defineType({
			name: 'Governed Work',
			pwuKind: 'GOVERNED',
			requiredAssurancePolicyIds: [policy.id!]
		});
		expect(type.ok, type.error).toBe(true);
		expect(
			raw('SuspendAssurancePolicy', policy.id!, 'ASSURANCE_POLICY', { policyId: policy.id! }).status
		).toBe('ACCEPTED');

		// An edit can retain or remove the declaration after suspension; it just cannot newly add one.
		expect(
			broker.editType(type.id!, {
				purpose: 'Updated without erasing its prior declaration.',
				requiredAssurancePolicyIds: [policy.id!]
			}).ok
		).toBe(true);
		expect(broker.getType(type.id!)!.requiredAssurancePolicyIds).toEqual([policy.id]);

		const draft = broker.createPolicy({ name: 'Still Draft' });
		expect(
			broker.editType(type.id!, {
				requiredAssurancePolicyIds: [policy.id!, draft.id!]
			}).error
		).toMatch(/is DRAFT/);
	});

	// JAN-PRPWA-DS-001 STD-2/STD-3/INV-1 (DWP-02): the broker's friendly pre-check mirrors the handler's coherence
	// gate (the engine remains authoritative — C-5) and, per D-C Option 1, validates attestedAssurancePolicyIds
	// exactly like requiredAssurancePolicyIds.
	it('defineType pre-checks INV-1/STD-3 for a delegated leaf (contract, named counterparty, no children)', () => {
		expect(
			broker.defineType({
				name: 'Bloodwork',
				pwuKind: 'DELEGATED',
				executionBoundary: 'DELEGATED_EXTERNAL'
			}).error
		).toMatch(/must declare a boundaryContract/);
		expect(
			broker.defineType({
				name: 'Bloodwork',
				pwuKind: 'DELEGATED',
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: { counterpartyLabel: '  ', attestedAssurancePolicyIds: [] }
			}).error
		).toMatch(/counterpartyLabel must name/);
		expect(
			broker.defineType({
				name: 'Bloodwork',
				pwuKind: 'DELEGATED',
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: { counterpartyLabel: 'Lab', attestedAssurancePolicyIds: [] },
				permittedChildTypeIds: ['pwut_x']
			}).error
		).toMatch(/terminal \(INV-1\)/);
		expect(
			broker.defineType({
				name: 'Internal',
				pwuKind: 'X',
				boundaryContract: { counterpartyLabel: 'Lab', attestedAssurancePolicyIds: [] }
			}).error
		).toMatch(/Only a DELEGATED_EXTERNAL/);
	});

	it('defineType accepts a valid delegated leaf; the view resolves executionBoundary + exposes the contract', () => {
		const r = broker.defineType({
			name: 'Bloodwork',
			pwuKind: 'DELEGATED',
			executionBoundary: 'DELEGATED_EXTERNAL',
			boundaryContract: { counterpartyLabel: 'Contract Lab', attestedAssurancePolicyIds: [] }
		});
		expect(r.ok, r.error).toBe(true);
		const view = broker.getType(r.id!)!;
		expect(view.executionBoundary).toBe('DELEGATED_EXTERNAL');
		expect(view.boundaryContract).toMatchObject({ counterpartyLabel: 'Contract Lab' });
		const internal = broker.defineType({ name: 'Internal', pwuKind: 'X' });
		expect(broker.getType(internal.id!)!.executionBoundary).toBe('INTERNAL');
		expect(broker.getType(internal.id!)!.boundaryContract).toBeUndefined();
	});

	it('validates attestedAssurancePolicyIds exactly like requiredAssurancePolicyIds (R-10, D-C Option 1 parity)', () => {
		const contract = (ids: string[]) => ({ counterpartyLabel: 'Lab', attestedAssurancePolicyIds: ids });
		const del = (name: string, ids: string[]) =>
			broker.defineType({
				name,
				pwuKind: 'DELEGATED',
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: contract(ids)
			});
		expect(del('Floor', ['floor.reasoning-review']).error).toMatch(/must not be referenced explicitly/);
		expect(del('Missing', ['pol_missing']).error).toMatch(/does not exist/);
		const policy = broker.createPolicy({ name: 'Lab Accreditation' });
		expect(del('Draft', [policy.id!]).error).toMatch(/is DRAFT/);
		expect(
			raw('ActivateAssurancePolicy', policy.id!, 'ASSURANCE_POLICY', { policyId: policy.id! }).status
		).toBe('ACCEPTED');
		const ok = del('Governed', [policy.id!]);
		expect(ok.ok, ok.error).toBe(true);
		// After suspension an UNRELATED edit retains the pre-existing attested declaration (never erased).
		expect(
			raw('SuspendAssurancePolicy', policy.id!, 'ASSURANCE_POLICY', { policyId: policy.id! }).status
		).toBe('ACCEPTED');
		expect(broker.editType(ok.id!, { purpose: 'clarified scope' }).ok).toBe(true);
		expect(broker.getType(ok.id!)!.boundaryContract?.attestedAssurancePolicyIds).toEqual([policy.id]);
	});

	it('scaffold builds a delegated leaf under an internal root and rejects a delegated node that names children', () => {
		const ok = broker.scaffold([
			{ tempKey: 'root', name: 'Encounter', pwuKind: 'ROOT', isRoot: true, childTempKeys: ['bloodwork'] },
			{
				tempKey: 'bloodwork',
				name: 'Bloodwork',
				pwuKind: 'DELEGATED',
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: { counterpartyLabel: 'Contract Lab', attestedAssurancePolicyIds: [] }
			}
		]);
		expect(ok.ok, ok.error).toBe(true);
		expect(broker.getType(ok.ids!.bloodwork!)!.executionBoundary).toBe('DELEGATED_EXTERNAL');
		const bad = broker.scaffold([
			{
				tempKey: 'a',
				name: 'A',
				pwuKind: 'DELEGATED',
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: { counterpartyLabel: 'Lab', attestedAssurancePolicyIds: [] },
				childTempKeys: ['b']
			},
			{ tempKey: 'b', name: 'B', pwuKind: 'X' }
		]);
		expect(bad.ok).toBe(false);
		expect(bad.error).toMatch(/terminal \(INV-1\)/);
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

	it('adds and updates link cardinality/applicability without dropping sibling child rules', () => {
		const parent = broker.defineType({ name: 'Root', pwuKind: 'ROOT', isRoot: true }).id!;
		const delivery = broker.defineType({ name: 'Delivery', pwuKind: 'DELIVERY' }).id!;
		const compliance = broker.defineType({ name: 'Compliance', pwuKind: 'COMPLIANCE' }).id!;

		expect(broker.linkTypes(parent, delivery, { cardinality: 'M+' }).ok).toBe(true);
		expect(
			broker.linkTypes(parent, compliance, {
				cardinality: 'C1',
				applicabilityNote: 'Only for regulated products.'
			}).ok
		).toBe(true);
		expect(
			broker.linkTypes(parent, delivery, {
				cardinality: 'C+',
				applicabilityNote: 'When more than one deployment train is required.'
			}).ok
		).toBe(true);

		const updated = broker.getType(parent)!;
		expect(updated.permittedChildTypeIds).toEqual([delivery, compliance]);
		expect(updated.permittedChildren).toEqual([
			{
				typeId: delivery,
				cardinality: 'C+',
				applicabilityNote: 'When more than one deployment train is required.'
			},
			{
				typeId: compliance,
				cardinality: 'C1',
				applicabilityNote: 'Only for regulated products.'
			}
		]);

		// Omission preserves an existing rule; an unchanged explicit update is also a no-op.
		expect(broker.linkTypes(parent, delivery).status).toBe('DUPLICATE');
		expect(
			broker.linkTypes(parent, compliance, {
				cardinality: 'C1',
				applicabilityNote: 'Only for regulated products.'
			}).status
		).toBe('DUPLICATE');

		expect(broker.unlinkTypes(parent, delivery).ok).toBe(true);
		expect(broker.getType(parent)!.permittedChildren).toEqual([
			{
				typeId: compliance,
				cardinality: 'C1',
				applicabilityNote: 'Only for regulated products.'
			}
		]);
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

	it('atomically scaffolds a full SDLC graph with unique ULIDs during a same-millisecond burst', () => {
		const frozenTime = Date.parse(TS);
		const sameMillisecondUlid = monotonicFactory();
		const fullBroker = new PwaAuthoringBroker({
			engine,
			pwaId: PWA,
			mintId: (prefix) => `${prefix}_${sameMillisecondUlid(frozenTime)}`,
			now: () => TS,
			sessionId: 'full-sdlc-scaffold'
		});
		const dispatchBatch = vi.spyOn(engine, 'dispatchBatch');

		const r = fullBroker.scaffold([
			{
				tempKey: 'sdlc',
				name: 'Full Software Development Lifecycle',
				pwuKind: 'SDLC',
				isRoot: true,
				childTempKeys: [
					'discovery',
					'planning',
					'requirements',
					'architecture',
					'implementation',
					'verification',
					'release',
					'operations'
				],
				childCardinalities: [
					{ tempKey: 'implementation', cardinality: 'M+' },
					{ tempKey: 'operations', cardinality: 'M+' }
				]
			},
			{
				tempKey: 'discovery',
				name: 'Product Discovery',
				pwuKind: 'DISCOVERY',
				childTempKeys: ['feasibility'],
				childCardinalities: [
					{
						tempKey: 'feasibility',
						cardinality: 'C1',
						applicabilityNote: 'Required when material technical or commercial uncertainty exists.'
					}
				]
			},
			{ tempKey: 'feasibility', name: 'Feasibility Assessment', pwuKind: 'FEASIBILITY' },
			{ tempKey: 'planning', name: 'Delivery Planning', pwuKind: 'PLANNING' },
			{
				tempKey: 'requirements',
				name: 'Requirements Definition',
				pwuKind: 'REQUIREMENTS',
				childTempKeys: ['ux']
			},
			{ tempKey: 'ux', name: 'User Experience Definition', pwuKind: 'UX_DEFINITION' },
			{
				tempKey: 'architecture',
				name: 'Architecture Definition',
				pwuKind: 'ARCHITECTURE',
				childTempKeys: ['security']
			},
			{ tempKey: 'security', name: 'Security Design', pwuKind: 'SECURITY_DESIGN' },
			{
				tempKey: 'implementation',
				name: 'Product Implementation',
				pwuKind: 'IMPLEMENTATION',
				childTempKeys: ['integration']
			},
			{ tempKey: 'integration', name: 'Continuous Integration', pwuKind: 'INTEGRATION' },
			{ tempKey: 'verification', name: 'Verification and Validation', pwuKind: 'VERIFICATION' },
			{ tempKey: 'release', name: 'Release and Deployment', pwuKind: 'RELEASE' },
			{
				tempKey: 'operations',
				name: 'Operations and Maintenance',
				pwuKind: 'OPERATIONS',
				childTempKeys: ['improvement']
			},
			{ tempKey: 'improvement', name: 'Continuous Improvement', pwuKind: 'IMPROVEMENT' }
		]);

		expect(r.ok, r.error).toBe(true);
		expect(dispatchBatch).toHaveBeenCalledTimes(1);
		expect(dispatchBatch.mock.calls[0]![0]).toHaveLength(14);

		const ids = Object.values(r.ids!);
		expect(ids).toHaveLength(14);
		expect(new Set(ids).size).toBe(14);
		for (const id of ids) expect(id).toMatch(/^pwut_[0-9A-HJKMNP-TV-Z]{26}$/);

		const types = fullBroker.listTypes();
		expect(types).toHaveLength(14);
		expect(new Set(types.map((type) => type.id))).toEqual(new Set(ids));
		expect(types.reduce((count, type) => count + type.permittedChildTypeIds.length, 0)).toBe(13);

		const root = fullBroker.getType(r.ids!.sdlc!)!;
		expect(root.permittedChildTypeIds).toEqual([
			r.ids!.discovery,
			r.ids!.planning,
			r.ids!.requirements,
			r.ids!.architecture,
			r.ids!.implementation,
			r.ids!.verification,
			r.ids!.release,
			r.ids!.operations
		]);
		expect(
			root.permittedChildren.find((rule) => rule.typeId === r.ids!.implementation)
		).toMatchObject({
			cardinality: 'M+'
		});
		expect(fullBroker.getType(r.ids!.discovery!)!.permittedChildren).toEqual([
			{
				typeId: r.ids!.feasibility,
				cardinality: 'C1',
				applicabilityNote: 'Required when material technical or commercial uncertainty exists.'
			}
		]);
		expect(fullBroker.getType(r.ids!.operations!)!.permittedChildTypeIds).toEqual([
			r.ids!.improvement
		]);
	});

	it('scaffold is all-or-nothing: one bad spec rolls back the whole batch', () => {
		const r = broker.scaffold([
			{ tempKey: 'ok', name: 'Fine', pwuKind: 'FINE' },
			{ tempKey: 'bad', name: '', pwuKind: 'X' } // missing name -> whole batch aborts
		]);
		expect(r.ok).toBe(false);
		expect(broker.listTypes()).toEqual([]); // nothing committed
	});

	it('scaffold rejects duplicate host-minted ids before dispatching any command', () => {
		const duplicateId = 'pwut_00000000000000000000000000';
		const dispatchBatch = vi.spyOn(engine, 'dispatchBatch');
		const collisionBroker = new PwaAuthoringBroker({
			engine,
			pwaId: PWA,
			mintId: () => duplicateId,
			now: () => TS,
			sessionId: 'collision-test'
		});
		const r = collisionBroker.scaffold([
			{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT', isRoot: true },
			{ tempKey: 'child', name: 'Child', pwuKind: 'CHILD' }
		]);

		expect(r).toMatchObject({ ok: false, status: 'ID_COLLISION' });
		expect(r.error).toContain(duplicateId);
		expect(r.error).toMatch(/No commands were dispatched/);
		expect(dispatchBatch).not.toHaveBeenCalled();
		expect(collisionBroker.listTypes()).toEqual([]);
	});

	it('scaffold rejects an unknown child temp key without committing', () => {
		const r = broker.scaffold([
			{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT', childTempKeys: ['ghost'] }
		]);
		expect(r.ok).toBe(false);
		expect(broker.listTypes()).toEqual([]);
	});

	it('scaffold rejects a DRAFT policy reference before committing any type', () => {
		const policy = broker.createPolicy({ name: 'Draft Treatment' });
		const r = broker.scaffold([
			{
				tempKey: 'root',
				name: 'Root',
				pwuKind: 'ROOT',
				requiredAssurancePolicyIds: [policy.id!]
			}
		]);
		expect(r.error).toMatch(/is DRAFT/);
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
