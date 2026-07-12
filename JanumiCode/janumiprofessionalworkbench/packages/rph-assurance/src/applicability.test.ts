import { describe, expect, it } from 'vitest';
import {
	evaluateApplicability,
	resolvePath,
	type ApplicabilityExpression
} from './applicability.js';

const subject = {
	objectType: 'PROFESSIONAL_WORK_UNIT',
	pwuKind: 'ARCHITECTURE_DEFINITION',
	tags: ['security', 'multitenant'],
	riskProfile: { consequence: 'HIGH', uncertainty: 'MEDIUM', securitySensitivity: 'NONE' }
};

describe('resolvePath', () => {
	it('resolves JSONPath-like paths and returns undefined for missing segments', () => {
		expect(resolvePath(subject, '$.objectType')).toBe('PROFESSIONAL_WORK_UNIT');
		expect(resolvePath(subject, '$.riskProfile.consequence')).toBe('HIGH');
		expect(resolvePath(subject, '$.missing.deep')).toBeUndefined();
	});
});

describe('ApplicabilityExpression DSL', () => {
	const ev = (e: ApplicabilityExpression) => evaluateApplicability(e, subject);

	it('EQUALS / IN / CONTAINS / EXISTS', () => {
		expect(ev({ op: 'EQUALS', path: '$.objectType', value: 'PROFESSIONAL_WORK_UNIT' })).toBe(true);
		expect(ev({ op: 'EQUALS', path: '$.pwuKind', value: 'INTENT_DEFINITION' })).toBe(false);
		expect(ev({ op: 'IN', path: '$.pwuKind', values: ['ARCHITECTURE_DEFINITION', 'X'] })).toBe(
			true
		);
		expect(ev({ op: 'CONTAINS', path: '$.tags', value: 'security' })).toBe(true);
		expect(ev({ op: 'CONTAINS', path: '$.tags', value: 'absent' })).toBe(false);
		expect(ev({ op: 'EXISTS', path: '$.riskProfile' })).toBe(true);
		expect(ev({ op: 'EXISTS', path: '$.nope' })).toBe(false);
	});

	it('ALL / ANY / NOT compose recursively', () => {
		expect(
			ev({
				op: 'ALL',
				operands: [
					{ op: 'EQUALS', path: '$.objectType', value: 'PROFESSIONAL_WORK_UNIT' },
					{ op: 'EXISTS', path: '$.riskProfile' }
				]
			})
		).toBe(true);
		expect(
			ev({
				op: 'ANY',
				operands: [
					{ op: 'EQUALS', path: '$.pwuKind', value: 'X' },
					{ op: 'EQUALS', path: '$.pwuKind', value: 'ARCHITECTURE_DEFINITION' }
				]
			})
		).toBe(true);
		expect(ev({ op: 'NOT', operand: { op: 'EXISTS', path: '$.nope' } })).toBe(true);
	});

	it('RISK_AT_LEAST compares up the risk ladder', () => {
		expect(ev({ op: 'RISK_AT_LEAST', dimension: 'CONSEQUENCE', level: 'MEDIUM' })).toBe(true); // HIGH >= MEDIUM
		expect(ev({ op: 'RISK_AT_LEAST', dimension: 'CONSEQUENCE', level: 'CRITICAL' })).toBe(false); // HIGH < CRITICAL
		expect(ev({ op: 'RISK_AT_LEAST', dimension: 'SECURITY_SENSITIVITY', level: 'LOW' })).toBe(
			false
		); // NONE < LOW
	});
});
