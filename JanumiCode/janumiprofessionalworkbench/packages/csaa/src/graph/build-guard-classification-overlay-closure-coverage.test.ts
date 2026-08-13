import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GuardClassificationOverlayBuildInputs } from '../contracts/guard-classification-overlay.js';
import {
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerRawEvidence
} from '../contracts/guard-enforcement-ledger.js';
import { normalizeGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.js';
import { buildGuardClassificationOverlay } from './build-guard-classification-overlay.js';
import {
	createGuardClassificationOverlayPredecessorFixture,
	type GuardClassificationOverlayPredecessorFixture
} from './guard-classification-overlay-fixture.test-support.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';

let fixture: GuardClassificationOverlayPredecessorFixture;

beforeAll(() => {
	fixture = createGuardClassificationOverlayPredecessorFixture();
});

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

function additionalEnforcedRow(anchor: string, guardText: string) {
	return {
		disposition: 'ENFORCED' as const,
		enforcingAnchor: anchor,
		enforcingSite: 'packages/rph-application/src/handlers/work.ts:999',
		evidence: 'A second retained classification cites frozen source evidence.',
		guardText
	};
}

describe('guard-classification overlay builder closure coverage', { timeout: 30_000 }, () => {
	it('keeps shared-anchor frontiers scoped to their own retained classification', () => {
		const evidence = structuredClone(fixture.guardObservation.rawEvidence);
		const secondText = 'retired duplicate citation';
		Object.assign(evidence, {
			audit: { ...evidence.audit, stale: [secondText] },
			ledgerRows: [
				...evidence.ledgerRows,
				additionalEnforcedRow(evidence.ledgerRows[0]!.enforcingAnchor!, secondText)
			].sort((left, right) => left.guardText.localeCompare(right.guardText))
		});

		const inputs = withGuardEvidence(evidence);
		const outcome = buildGuardClassificationOverlay(inputs);
		expect(outcome).toMatchObject({ diagnostics: [], outcome: 'partial' });
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(validateGuardClassificationOverlay(outcome.overlay, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(outcome.overlay.anchorSites).toHaveLength(1);
		const active = outcome.overlay.forwardIndex.find((entry) => entry.key !== secondText)!;
		const stale = outcome.overlay.forwardIndex.find((entry) => entry.key === secondText)!;
		expect(active.frontierIds).toEqual([]);
		expect(stale.frontierIds).toHaveLength(2);
		expect(
			outcome.overlay.frontiers
				.filter((frontier) => stale.frontierIds.includes(frontier.id))
				.map((frontier) => frontier.frontierKind)
				.sort()
		).toEqual(['HELPER_CALL_FLOW_UNRESOLVED', 'STALE_LEDGER_ROW']);
		expect(outcome.overlay.anchorSites[0]!.frontierIds).toEqual([
			outcome.overlay.frontiers.find(
				(frontier) => frontier.frontierKind === 'HELPER_CALL_FLOW_UNRESOLVED'
			)!.id
		]);
	});

	it('enforces the anchor-site budget after binding two distinct retained anchors', () => {
		const evidence = structuredClone(fixture.guardObservation.rawEvidence);
		const secondText = 'retired distinct citation';
		Object.assign(evidence, {
			audit: { ...evidence.audit, stale: [secondText] },
			ledgerRows: [
				...evidence.ledgerRows,
				additionalEnforcedRow(
					"advanceStatus({ machine: 'Work.status', target: 'STARTED' })",
					secondText
				)
			].sort((left, right) => left.guardText.localeCompare(right.guardText))
		});
		const inputs = withGuardEvidence(evidence);

		const outcome = buildGuardClassificationOverlay({
			...inputs,
			request: {
				...inputs.request,
				budgets: { ...inputs.request.budgets, maxAnchorSites: 1 }
			}
		});
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
	});

	it('fails closed when valid ledger evidence has no exact guarded-transition join', () => {
		const evidence = structuredClone(fixture.guardObservation.rawEvidence);
		const mismatched = 'operator authorization differs from the state source';
		Object.assign(evidence, {
			guardTexts: [mismatched],
			guardedArrows: evidence.guardedArrows.map((arrow) => ({
				...arrow,
				guard: mismatched
			})),
			ledgerRows: evidence.ledgerRows.map((row) => ({ ...row, guardText: mismatched }))
		});

		const outcome = buildGuardClassificationOverlay(withGuardEvidence(evidence));
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'UNSUPPORTED_TRANSITION_JOIN' })],
			outcome: 'unavailable'
		});
	});
});
