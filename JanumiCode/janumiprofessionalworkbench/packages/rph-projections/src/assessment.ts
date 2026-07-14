// Pure assessment-loop analytics — the convergence stop-mechanism and the score-domain conversion, kept here (a
// browser-safe, unit-tested read-model package) rather than in the server so the trickiest logic has real coverage.
// No engine, no child_process, no framework.

/** Convert a 0..1 assessor score to the integer percent (0..100) the domain persists. The canonical content-hash
 *  forbids non-integer numbers, so scores are stored as integer percents; assessors reason in the 0..1 space. */
export function toPercent(score01: number): number {
	const x = Number.isFinite(score01) ? score01 : 0;
	const clamped = x < 0 ? 0 : x > 1 ? 1 : x;
	return Math.round(clamped * 100);
}

export interface ConvergenceInput {
	/** Overall faithfulness score in 0..1 space. */
	readonly overallScore: number;
	readonly gaps: readonly string[];
}

export interface ConvergenceSignal {
	/** cur - prev, in 0..1 space (may be negative). */
	readonly scoreDelta: number;
	readonly converging: boolean;
	/** Gaps from the current assessment that closely match a gap from the previous one. */
	readonly recurringGaps: string[];
}

const CONVERGENCE_EPS = 0.05;
const GAP_SIMILARITY = 0.6;

function tokens(s: string): Set<string> {
	return new Set(
		s
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, ' ')
			.split(/\s+/)
			.filter((t) => t.length > 2)
	);
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1;
	let inter = 0;
	for (const t of a) if (b.has(t)) inter++;
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
}

/**
 * Compare a new assessment to its predecessor: is the assess/refine loop CONVERGING, or is it stuck (a flat/worse
 * score, or the SAME gaps recurring)? This drives the stop mechanism — a non-converging iteration escalates to a
 * human rather than churning. Converging iff the score improved beyond `eps` AND not every current gap is merely a
 * recurrence of a prior one. Pure + deterministic (token-Jaccard gap matching, no LLM, no regex-for-resolution).
 */
export function detectConvergence(
	prev: ConvergenceInput,
	cur: ConvergenceInput,
	opts: { eps?: number; gapSimilarity?: number } = {}
): ConvergenceSignal {
	const eps = opts.eps ?? CONVERGENCE_EPS;
	const sim = opts.gapSimilarity ?? GAP_SIMILARITY;
	const scoreDelta = cur.overallScore - prev.overallScore;
	const prevTokens = prev.gaps.map(tokens);
	const recurringGaps: string[] = [];
	for (const g of cur.gaps) {
		const gt = tokens(g);
		if (prevTokens.some((pt) => jaccard(pt, gt) >= sim)) recurringGaps.push(g);
	}
	const improved = scoreDelta > eps;
	const allRecur = cur.gaps.length > 0 && recurringGaps.length >= cur.gaps.length;
	return { scoreDelta, converging: improved && !allRecur, recurringGaps };
}
