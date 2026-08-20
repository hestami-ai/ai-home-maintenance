// REG-F-199 residue (3) — a decomposition validated INVALID must not keep its edges in the Professional Work Graph.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { createEngine, professionalWorkGraph } from './index.js';

const TS = '2026-08-20T00:00:00Z';
const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69JD100';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69JD200';
const KEPT_CHILD = 'pwu_01ARZ3NDEKTSV4RRFFQ69JD300';
const WITHDRAWN_CHILD = 'pwu_01ARZ3NDEKTSV4RRFFQ69JD400';
const DC_VALID = 'dcp_01ARZ3NDEKTSV4RRFFQ69JD500';
const DC_INVALID = 'dcp_01ARZ3NDEKTSV4RRFFQ69JD600';

describe('the Professional Work Graph withdraws the edges of a REJECTED decomposition', () => {
	function build(reviseInvalid = false) {
		let s = 0;
		const engine = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++s}`
		}).as(OWNER);
		let n = 0;
		const cmd = (
			commandType: string,
			targetAggregateType: string,
			targetAggregateId: string,
			payload: unknown
		): DomainCommand => {
			const i = ++n;
			return {
				commandId: `c-${i}`,
				commandType,
				commandSchemaVersion: 1,
				targetAggregateType,
				targetAggregateId,
				issuedAt: TS,
				correlationId: 'edge-withdrawal',
				idempotencyKey: `k-${i}`,
				payload
			};
		};
		const ok = (c: DomainCommand): void => {
			const r = engine.dispatch(c);
			if (r.status !== 'ACCEPTED') throw new Error(`${c.commandType}: ${JSON.stringify(r.error)}`);
		};
		ok(
			cmd('CaptureIntent', 'INTENT', INTENT, {
				intentId: INTENT,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			})
		);
		// NO `parentWorkUnitId` on any PWU: `collectPwuProposed` also emits DECOMPOSES_TO from that field, and an
		// edge from a second source would make this test silent about the one under examination.
		const pwu = (id: string, title: string): void =>
			ok(
				cmd('ProposePwu', 'PROFESSIONAL_WORK_UNIT', id, {
					pwuId: id,
					pwuKind: 'PRODUCT_REALIZATION',
					title,
					description: 'd',
					intentId: INTENT,
					boundaries: {
						inScope: ['the work'],
						outOfScope: ['not yet known'],
						permittedChanges: [],
						prohibitedChanges: []
					},
					obligationIds: [],
					constraintIds: [],
					assumptionIds: [],
					expectedOutputs: [{ outputId: `out_${id}`, kind: 'DOCUMENT' }],
					assurancePolicyIds: [],
					riskProfile: {
						consequence: 'HIGH',
						uncertainty: 'MEDIUM',
						irreversibility: 'MEDIUM',
						securitySensitivity: 'HIGH',
						regulatoryExposure: 'MEDIUM'
					}
				})
			);
		pwu(PARENT, 'Parent');
		pwu(KEPT_CHILD, 'Kept child');
		pwu(WITHDRAWN_CHILD, 'Withdrawn child');

		const decompose = (dc: string, child: string, disposition: string): void => {
			ok(
				cmd('ProposeDecomposition', 'DECOMPOSITION_CONTRACT', dc, {
					parentWorkUnitId: PARENT,
					childWorkUnitIds: [child],
					rationale: 'split by concern'
				})
			);
			ok(cmd('ValidateDecomposition', 'DECOMPOSITION_CONTRACT', dc, { disposition }));
		};
		decompose(DC_VALID, KEPT_CHILD, 'VALID');
		decompose(DC_INVALID, WITHDRAWN_CHILD, 'INVALID');
		if (reviseInvalid) {
			// The ESCAPE, and the reason this guard keys on the EVENT and not on the status:
			// DecompositionContract.status admits INVALID as an in-arrow to SUPERSEDED
			// (decomposition.ts:491), the child set cannot change on a revise, and the contract can never
			// be re-validated (validateDecomposition requires UNDER_REVIEW, written only at birth). So one
			// accepted ReviseDecomposition moves the contract off INVALID forever while the refusal it
			// recorded still stands.
			ok(
				cmd('ReviseDecomposition', 'DECOMPOSITION_CONTRACT', DC_INVALID, { rationale: 'reworded' })
			);
		}
		return { engine, graph: professionalWorkGraph(engine) };
	}

	it('ARRANGEMENT: the INVALID verdict really landed on the contract', () => {
		const { engine } = build();
		const contract = engine.loadObject(DC_INVALID)?.state as { status?: string } | undefined;
		expect(contract?.status).toBe('INVALID');
		expect(engine.readAllEvents().some((e) => e.eventType === 'DecompositionRejected')).toBe(true);
	});

	it('drops the parent->child edge of a decomposition validated INVALID', () => {
		const { graph } = build();
		expect(graph.edges.map((e) => `${e.from}->${e.to}`)).not.toContain(
			`${PARENT}->${WITHDRAWN_CHILD}`
		);
	});

	it('CONTROL: the VALID decomposition keeps its edge, so the filter is not emptying the graph', () => {
		const { graph } = build();
		expect(graph.edges.map((e) => `${e.from}->${e.to}`)).toContain(`${PARENT}->${KEPT_CHILD}`);
	});

	it('ESCAPE: revising the INVALID contract must NOT resurrect the withdrawn edge', () => {
		// This is the test that DISCRIMINATES the two candidate fixes. A status-keyed guard
		// (`status === 'INVALID'`) passes the test above and FAILS here, because the revise moved the
		// contract to SUPERSEDED. Keying on the DecompositionRejected event is immune: the log keeps it.
		const { engine, graph } = build(true);
		expect((engine.loadObject(DC_INVALID)?.state as { status?: string }).status).toBe('SUPERSEDED');
		expect(graph.edges.map((e) => `${e.from}->${e.to}`)).not.toContain(
			`${PARENT}->${WITHDRAWN_CHILD}`
		);
	});
});
