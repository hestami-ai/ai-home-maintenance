import { describe, expect, it } from 'vitest';

import {
	evaluateHybridRuntimeRows,
	hybridRuntimeEvaluationDigest,
	type HybridStaticPrerequisite
} from './evaluate-hybrid-runtime.js';

const SUBJECT_ID = 'subject:hybrid-runtime-fixture';
const FINDINGS = [9, 19, 45, 54, 55] as const;
const CAPABILITIES = {
	9: 'TAINT',
	19: 'DFG',
	45: 'DFG',
	54: 'TAINT',
	55: 'TAINT'
} as const;

function prerequisites(): HybridStaticPrerequisite[] {
	return FINDINGS.map((findingId) => ({
		capability: CAPABILITIES[findingId],
		evidenceIds: [`evidence:${findingId}`],
		findingId,
		freshness: 'CURRENT',
		observedAt: '2026-08-25T12:00:01.000Z',
		providerId: 'native-static',
		state: 'SATISFIED',
		subjectId: SUBJECT_ID
	}));
}

function trace(endedAt = '2026-08-25T12:00:01.500Z') {
	return {
		availability: 'PRESENT',
		conflicts: [],
		coverage: { state: 'COMPLETE' },
		freshness: { state: 'CURRENT' },
		health: 'HEALTHY',
		observations: [
			{
				coveredFindingIds: [...FINDINGS],
				events: [],
				missingFindingIds: []
			}
		],
		run: { endedAt },
		subject: { id: SUBJECT_ID }
	} as unknown as Parameters<typeof evaluateHybridRuntimeRows>[0]['trace'];
}

function evaluate(staticPrerequisites: readonly HybridStaticPrerequisite[] = prerequisites()) {
	return evaluateHybridRuntimeRows({
		assessedAt: '2026-08-25T12:00:02.000Z',
		staticPrerequisites,
		trace: trace()
	});
}

describe('hybrid runtime evaluation admission', () => {
	it('rejects every independently malformed static prerequisite boundary', () => {
		const cases: Array<(values: Array<Record<string, unknown>>) => void> = [
			(values) => {
				values.pop();
			},
			(values) => {
				values[0]!.findingId = 999;
			},
			(values) => {
				values[1]!.findingId = 9;
			},
			(values) => {
				values[0]!.capability = 'DFG';
			},
			(values) => {
				values[0]!.state = 'UNKNOWN';
			},
			(values) => {
				values[0]!.subjectId = 'subject:other';
			},
			(values) => {
				values[0]!.providerId = 'provider with spaces';
			},
			(values) => {
				values[0]!.observedAt = '2026-08-25T12:00:03.000Z';
			},
			(values) => {
				values[0]!.evidenceIds = ['evidence:9', 'evidence:9'];
			},
			(values) => {
				values[0]!.evidenceIds = ['invalid evidence'];
			},
			(values) => {
				values[0]!.evidenceIds = [];
			}
		];

		for (const mutate of cases) {
			const values = structuredClone(prerequisites()) as unknown as Array<Record<string, unknown>>;
			mutate(values);
			expect(() => evaluate(values as unknown as HybridStaticPrerequisite[])).toThrow(TypeError);
		}
	});

	it('rejects noncanonical assessment time and runtime evidence from the future', () => {
		expect(() =>
			evaluateHybridRuntimeRows({
				assessedAt: '2026-08-25T12:00:02.00Z',
				staticPrerequisites: prerequisites(),
				trace: trace()
			})
		).toThrow(/canonical/u);
		expect(() =>
			evaluateHybridRuntimeRows({
				assessedAt: '2026-08-25T12:00:02.000Z',
				staticPrerequisites: prerequisites(),
				trace: trace('2026-08-25T12:00:03.000Z')
			})
		).toThrow(/predates/u);
	});

	it('projects unsupported and conflicting rows and exposes canonical result identity', () => {
		const values = prerequisites();
		values[0] = { ...values[0]!, evidenceIds: [], state: 'UNSUPPORTED' };
		values[1] = { ...values[1]!, state: 'CONFLICTING' };

		const result = evaluate(values);
		expect(result.rows.slice(0, 2).map(({ status }) => status)).toEqual(['UNSUPPORTED', 'NOT_RUN']);
		expect(hybridRuntimeEvaluationDigest(result)).toMatch(/^[a-f0-9]{64}$/u);
	});
});
