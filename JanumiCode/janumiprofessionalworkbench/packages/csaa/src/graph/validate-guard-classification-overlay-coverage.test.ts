import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
	GuardClassificationOverlayBuildInputs,
	GuardClassificationOverlaySnapshot,
	GuardClassificationOverlayValidationOptions
} from '../contracts/guard-classification-overlay.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { buildGuardClassificationOverlay } from './build-guard-classification-overlay.js';
import {
	createGuardClassificationOverlayPredecessorFixture,
	type GuardClassificationOverlayPredecessorFixture
} from './guard-classification-overlay-fixture.test-support.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';

let value: GuardClassificationOverlayPredecessorFixture;
let baseline: GuardClassificationOverlaySnapshot;

beforeAll(() => {
	value = createGuardClassificationOverlayPredecessorFixture();
	const outcome = buildGuardClassificationOverlay(value.inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	baseline = outcome.overlay;
}, 120_000);

afterAll(() => value.cleanup());

function snapshotInputs(
	mutate: (snapshot: StaticSemanticSnapshot) => void
): GuardClassificationOverlayBuildInputs {
	const semanticSnapshot = structuredClone(value.snapshot) as StaticSemanticSnapshot;
	mutate(semanticSnapshot);
	return { ...value.inputs, semanticSnapshot };
}

describe(
	'guard-classification overlay validator public defensive coverage',
	{ timeout: 30_000 },
	() => {
		it('charges string values independently from property names', () => {
			expect(
				validateGuardClassificationOverlay({ '': 'xx' }, value.inputs, {
					maxStringCharacters: 1
				})
			).toMatchObject({
				issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});
		});

		it('rejects an array whose population cannot fit the candidate record budget', () => {
			expect(
				validateGuardClassificationOverlay([null, null], value.inputs, { maxRecords: 2 })
			).toMatchObject({
				issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});
		});

		it('rejects an input shell without the opaque FrozenSubject bytes capability', () => {
			const unavailableSubject = {
				...value.inputs,
				subject: structuredClone(value.subject)
			} as GuardClassificationOverlayBuildInputs;
			expect(validateGuardClassificationOverlay(baseline, unavailableSubject)).toMatchObject({
				issues: [
					expect.objectContaining({
						code: 'INPUT_INVALID',
						path: '$inputs.subject'
					})
				],
				state: 'INVALID'
			});
		});

		it('rejects non-array and over-budget semantic population shells before reading records', () => {
			const nonArray = snapshotInputs((snapshot) => {
				(snapshot as unknown as { sources: unknown }).sources = null;
			});
			expect(validateGuardClassificationOverlay(baseline, nonArray)).toMatchObject({
				issues: [
					expect.objectContaining({
						code: 'SHAPE_INVALID',
						path: '$inputs.semanticSnapshot.sources'
					})
				],
				state: 'INVALID'
			});

			const overPopulation = snapshotInputs((snapshot) => {
				(snapshot as unknown as { capabilities: unknown[] }).capabilities = new Array(3_001).fill(
					null
				);
			});
			expect(
				validateGuardClassificationOverlay(baseline, overPopulation, {
					maxInputRecords: 3_000
				})
			).toMatchObject({
				issues: [
					expect.objectContaining({
						code: 'BUDGET_EXHAUSTED',
						path: '$inputs.semanticSnapshot.capabilities'
					})
				],
				state: 'BUDGET_EXHAUSTED'
			});
		});

		it('rejects a semantic array with a replaced index and an extra property', () => {
			const malformedIndex = snapshotInputs((snapshot) => {
				const sources = [...snapshot.sources] as unknown[] & { replacement?: unknown };
				delete sources[sources.length - 1];
				sources.replacement = null;
				(snapshot as unknown as { sources: unknown[] }).sources = sources;
			});
			expect(validateGuardClassificationOverlay(baseline, malformedIndex)).toMatchObject({
				issues: [
					expect.objectContaining({
						code: 'SHAPE_INVALID',
						path: '$inputs.semanticSnapshot.sources'
					})
				],
				state: 'INVALID'
			});
		});

		it('rejects hidden and non-integer option values without invoking accessors', () => {
			let invoked = false;
			const hidden = Object.defineProperty({}, 'maxIssues', {
				enumerable: false,
				value: 1
			});
			const accessor = Object.defineProperty({}, 'maxIssues', {
				enumerable: true,
				get: () => {
					invoked = true;
					return 1;
				}
			});
			for (const options of [hidden, accessor, { maxIssues: 1.5 }])
				expect(
					validateGuardClassificationOverlay(
						baseline,
						value.inputs,
						options as GuardClassificationOverlayValidationOptions
					)
				).toMatchObject({
					issues: [expect.objectContaining({ code: 'SHAPE_INVALID', path: '$options' })],
					state: 'INVALID'
				});
			expect(invoked).toBe(false);
		});
	}
);
