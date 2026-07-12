// The ApplicabilityExpression DSL (DOC-007 §18) — a code-free, deterministic boolean expression evaluated
// against a subject object. No arbitrary JS/SQL: only the 8 fixed ops. Drives policy applicability,
// disposition conditions, waiver revalidation, and escalation triggers, and is serializable to a JSON column.

export type RiskDimension =
	| 'CONSEQUENCE'
	| 'UNCERTAINTY'
	| 'IRREVERSIBILITY'
	| 'SECURITY_SENSITIVITY'
	| 'REGULATORY_EXPOSURE';

export type ApplicabilityExpression =
	| { readonly op: 'ALL'; readonly operands: readonly ApplicabilityExpression[] }
	| { readonly op: 'ANY'; readonly operands: readonly ApplicabilityExpression[] }
	| { readonly op: 'NOT'; readonly operand: ApplicabilityExpression }
	| { readonly op: 'EQUALS'; readonly path: string; readonly value: string | number | boolean }
	| { readonly op: 'IN'; readonly path: string; readonly values: ReadonlyArray<string | number> }
	| { readonly op: 'CONTAINS'; readonly path: string; readonly value: string }
	| { readonly op: 'EXISTS'; readonly path: string }
	| { readonly op: 'RISK_AT_LEAST'; readonly dimension: RiskDimension; readonly level: string };

// Unified risk ladder covering both the LOW-based (consequence/uncertainty/irreversibility) and NONE-based
// (security/regulatory) dimensions. Higher index = stronger.
const RISK_ORDER = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const DIMENSION_FIELD: Readonly<Record<RiskDimension, string>> = {
	CONSEQUENCE: 'consequence',
	UNCERTAINTY: 'uncertainty',
	IRREVERSIBILITY: 'irreversibility',
	SECURITY_SENSITIVITY: 'securitySensitivity',
	REGULATORY_EXPOSURE: 'regulatoryExposure'
};

/** Resolve a JSONPath-like `$.a.b` against a subject; returns undefined for any missing segment. */
export function resolvePath(subject: unknown, path: string): unknown {
	const segments = path
		.replace(/^\$\.?/, '')
		.split('.')
		.filter(Boolean);
	let current: unknown = subject;
	for (const seg of segments) {
		if (current === null || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[seg];
	}
	return current;
}

/** Deterministically evaluate an ApplicabilityExpression against a subject object. */
export function evaluateApplicability(expr: ApplicabilityExpression, subject: unknown): boolean {
	switch (expr.op) {
		case 'ALL':
			return expr.operands.every((o) => evaluateApplicability(o, subject));
		case 'ANY':
			return expr.operands.some((o) => evaluateApplicability(o, subject));
		case 'NOT':
			return !evaluateApplicability(expr.operand, subject);
		case 'EQUALS':
			return resolvePath(subject, expr.path) === expr.value;
		case 'IN': {
			const v = resolvePath(subject, expr.path);
			return (expr.values as ReadonlyArray<unknown>).includes(v);
		}
		case 'CONTAINS': {
			const v = resolvePath(subject, expr.path);
			if (Array.isArray(v)) return (v as unknown[]).includes(expr.value);
			if (typeof v === 'string') return v.includes(expr.value);
			return false;
		}
		case 'EXISTS':
			return resolvePath(subject, expr.path) !== undefined;
		case 'RISK_AT_LEAST': {
			const profile = resolvePath(subject, '$.riskProfile');
			if (profile === null || typeof profile !== 'object') return false;
			const actual = (profile as Record<string, unknown>)[DIMENSION_FIELD[expr.dimension]];
			const actualIdx = RISK_ORDER.indexOf(String(actual));
			const requiredIdx = RISK_ORDER.indexOf(expr.level);
			return actualIdx >= 0 && requiredIdx >= 0 && actualIdx >= requiredIdx;
		}
		default: {
			// Exhaustiveness guard: an unknown op is a fail-loud error, never a silent true/false.
			const _never: never = expr;
			throw new Error(`Unknown ApplicabilityExpression op: ${JSON.stringify(_never)}`);
		}
	}
}
