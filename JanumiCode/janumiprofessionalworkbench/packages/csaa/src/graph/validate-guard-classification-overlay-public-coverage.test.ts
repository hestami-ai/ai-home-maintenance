import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerRawEvidence
} from '../contracts/guard-enforcement-ledger.js';
import type {
	GuardClassificationOverlayBuildInputs,
	GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import { normalizeGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.js';
import { buildGuardClassificationOverlay } from './build-guard-classification-overlay.js';
import {
	createGuardClassificationOverlayPredecessorFixture,
	type GuardClassificationOverlayPredecessorFixture
} from './guard-classification-overlay-fixture.test-support.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';

let fixture: GuardClassificationOverlayPredecessorFixture;
let baseline: GuardClassificationOverlaySnapshot;

beforeAll(() => {
	fixture = createGuardClassificationOverlayPredecessorFixture();
	const outcome = buildGuardClassificationOverlay(fixture.inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	baseline = outcome.overlay;
}, 120_000);

afterAll(() => fixture.cleanup());

function withGuardEvidence(
	evidence: GuardEnforcementLedgerRawEvidence
): GuardClassificationOverlayBuildInputs {
	const guardObservation = normalizeGuardEnforcementLedgerObservation({
		artifactSet: fixture.guardObservation.artifactSet,
		evidence,
		executor: fixture.guardObservation.executor,
		request: {
			artifactSetId: fixture.guardObservation.artifactSet.id,
			budgets: fixture.guardObservation.budgets,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: fixture.guardObservation.subjectId
		},
		transportOutputBytes: new Uint8Array([1])
	});
	return {
		...fixture.inputs,
		guardObservation,
		request: { ...fixture.request, guardObservationId: guardObservation.id }
	};
}

function expectPopulationMismatch(inputs: GuardClassificationOverlayBuildInputs): void {
	expect(validateGuardClassificationOverlay(baseline, inputs)).toMatchObject({
		issues: [expect.objectContaining({ code: 'POPULATION_MISMATCH' })],
		state: 'INVALID'
	});
}

describe('guard-classification overlay public fail-closed defenses', { timeout: 30_000 }, () => {
	it('independently rejects a normalized guard tuple without an exact legal-transition join', () => {
		const evidence = structuredClone(fixture.guardObservation.rawEvidence);
		const mismatched = 'operator authorization differs from the retained state source';
		Object.assign(evidence, {
			guardTexts: [mismatched],
			guardedArrows: evidence.guardedArrows.map((arrow) => ({
				...arrow,
				guard: mismatched
			})),
			ledgerRows: evidence.ledgerRows.map((row) => ({ ...row, guardText: mismatched }))
		});
		expectPopulationMismatch(withGuardEvidence(evidence));
	});

	it('rejects normalized incomplete and syntactically unsupported enforcement citations', () => {
		const missingSite = structuredClone(fixture.guardObservation.rawEvidence);
		const guardText = missingSite.guardTexts[0]!;
		Object.assign(missingSite, {
			audit: { ...missingSite.audit, enforcedWithoutSite: [guardText] },
			ledgerRows: missingSite.ledgerRows.map((row) => ({ ...row, enforcingSite: null }))
		});
		const missingSiteInputs = withGuardEvidence(missingSite);
		expect(buildGuardClassificationOverlay(missingSiteInputs)).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'UNSUPPORTED_HANDLER_CORRELATION' })],
			outcome: 'unavailable'
		});
		expectPopulationMismatch(missingSiteInputs);

		const unsupportedSite = structuredClone(fixture.guardObservation.rawEvidence);
		Object.assign(unsupportedSite, {
			ledgerRows: unsupportedSite.ledgerRows.map((row) => ({
				...row,
				enforcingSite: 'not-a-site'
			}))
		});
		expectPopulationMismatch(withGuardEvidence(unsupportedSite));
	});

	it('rejects a unique top-level anchor that has no callable ancestor', () => {
		const evidence = structuredClone(fixture.guardObservation.rawEvidence);
		Object.assign(evidence, {
			ledgerRows: evidence.ledgerRows.map((row) => ({
				...row,
				enforcingAnchor: 'export const startWork'
			}))
		});
		const inputs = withGuardEvidence(evidence);
		expect(buildGuardClassificationOverlay(inputs)).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'UNSUPPORTED_HANDLER_CORRELATION' })],
			outcome: 'unavailable'
		});
		expectPopulationMismatch(inputs);
	});

	it('bounds a repeated plain-data subgraph without treating it as a cycle', () => {
		const shared = { leaf: null };
		const candidate = { left: shared, right: shared };
		expect(
			validateGuardClassificationOverlay(candidate, fixture.inputs, { maxRecords: 3 })
		).toEqual({
			issues: [
				{
					code: 'BUDGET_EXHAUSTED',
					message: 'Structural record budget exceeded: 4 > 3.',
					path: '$.left'
				}
			],
			state: 'BUDGET_EXHAUSTED'
		});
	});
});
