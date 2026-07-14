// The bounded assess -> auto-refine -> converge-check -> escalate loop, run after each authoring turn. It promotes the
// virtuous-cycle harness into the product: a judge distinct from the executor scores the DRAFT PWA (exec != assurance);
// if unfaithful, ONE automatic refinement is applied (the executor re-runs against the gaps); if still unfaithful, it
// ESCALATES to a human (answer: iteration-1 auto, iteration-2 human-in-the-loop). The convergence detector is the
// stop mechanism — a stuck loop (flat/worse score, recurring gaps) escalates with that diagnosis rather than churning.
import { detectConvergence, toPercent, type ConvergenceSignal } from '@janumipwb/rph-projections';
import {
	buildPwaExport,
	escalateAssessment,
	makeAssessor,
	recordAssessment
} from '../workbench.js';
import type { AssessmentResult, FaithfulnessAssessor } from './types.js';

/** How many AUTOMATIC refinements to attempt before escalating to a human. 1 → assess, refine once, re-assess, escalate. */
const AUTO_REFINE_ITERATIONS = 1;

/** Assessment-phase events multiplexed onto the same SSE stream as the agent events (discriminated by `type`). */
export type AssessmentStreamEvent =
	| { kind: 'assessment_started'; iteration: number }
	| {
			kind: 'assessment_recorded';
			iteration: number;
			assessmentId: string;
			verdict: string;
			overallScore: number;
			criteria: { name: string; score: number; rationale?: string }[];
			gaps: string[];
			recommendation: string;
			scoreDelta?: number;
			converging?: boolean;
	  }
	| { kind: 'revision_started'; iteration: number; directive: string }
	| {
			kind: 'assessment_escalated';
			assessmentId: string;
			reason: string;
			context: string;
			verdict: string;
			gaps: string[];
			recommendation: string;
	  }
	| { kind: 'assessment_error'; message: string };

/** Build the assessor's ActorReference identity — the separation-of-duties record (a different vendor than the executor). */
function assessorIdentity(assessor: FaithfulnessAssessor, result: AssessmentResult) {
	if (assessor.kind === 'agy') {
		return {
			actorId: 'agy',
			displayName: `agy faithfulness judge${result.assessorModel ? ` (${result.assessorModel})` : ''}`,
			modelId: result.assessorModel,
			providerId: 'google'
		};
	}
	return {
		actorId: 'mock-assessor',
		displayName: 'structural assessor (mock)',
		modelId: result.assessorModel ?? 'mock:layer-a',
		providerId: 'jpwb'
	};
}

/** Turn the judge's gaps + recommendation into a refinement directive the executor re-runs against. */
function refinementDirective(result: AssessmentResult): string {
	const gaps = result.gaps.length
		? result.gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')
		: '(no specific gaps listed)';
	return [
		`An independent reviewer assessed the current PWA as ${result.verdict} against the original prompt.`,
		'Revise the PWA graph to close these gaps — edit the existing PWU Types and their permits / data-flow rather than starting over:',
		gaps,
		result.recommendation ? `\nReviewer recommendation: ${result.recommendation}` : ''
	]
		.filter(Boolean)
		.join('\n');
}

/** Compose the human-readable context handed to the human on escalation. `refined` = an automatic refinement ran. */
function escalationContext(
	result: AssessmentResult,
	refined: boolean,
	conv?: ConvergenceSignal
): string {
	const pts = conv ? Math.round(conv.scoreDelta * 100) : 0;
	const trend = conv
		? conv.converging
			? `improved by ${pts} pts but is still ${result.verdict}`
			: `did not converge (${pts >= 0 ? '+' : ''}${pts} pts; ${conv.recurringGaps.length} gap(s) recurred)`
		: `is still ${result.verdict}`;
	const gaps = result.gaps.length
		? `Remaining gaps:\n- ${result.gaps.join('\n- ')}`
		: 'No specific gaps listed.';
	const lead = refined
		? `After one automatic refinement the PWA ${trend}.`
		: `The graph was assessed as ${result.verdict} and needs your review.`;
	return [lead, gaps, result.recommendation ? `Recommendation: ${result.recommendation}` : '']
		.filter(Boolean)
		.join('\n\n');
}

export interface AssessmentLoopOptions {
	readonly pwaId: string;
	/** The original NL prompt (the intent judged against — held constant across refinements). */
	readonly prompt: string;
	/** The authoring agent's current narration/plan (for the judge). */
	readonly planText: () => string;
	/** Re-run the executor with a refinement directive (streams through the same channel as the first turn). */
	readonly runExecutor: (directive: string) => Promise<void>;
	/** Whether to attempt an automatic refinement before escalating. Requires a REAL executor that can revise the
	 *  graph — the deterministic mock cannot, so a non-faithful mock turn escalates directly (and never mutates the
	 *  graph as a side effect). */
	readonly autoRefine: boolean;
	readonly emit: (ev: AssessmentStreamEvent) => void;
	readonly signal?: AbortSignal;
}

/** Run the bounded assess/refine/escalate cycle for one authoring turn. Best-effort: an assessor failure degrades to
 *  an `assessment_error` event and does NOT break the turn. */
export async function runAssessmentLoop(opts: AssessmentLoopOptions): Promise<void> {
	const assessor = makeAssessor();
	const MAX = AUTO_REFINE_ITERATIONS + 1; // total assessments this turn (default 2)
	let prior: { assessmentId: string; result: AssessmentResult } | undefined;

	for (let iteration = 1; iteration <= MAX; iteration += 1) {
		if (opts.signal?.aborted) return;
		const graphExport = buildPwaExport(opts.pwaId);
		if (!graphExport) return;
		// Nothing was built this turn (e.g. the instruction was a question) — there is nothing to assess.
		if (iteration === 1 && graphExport.nodes.length === 0) return;

		opts.emit({ kind: 'assessment_started', iteration });
		let result: AssessmentResult;
		try {
			result = await assessor.assess({
				pwaId: opts.pwaId,
				prompt: opts.prompt,
				graphExport,
				plan: opts.planText(),
				iteration,
				prior: prior
					? { overallScore: prior.result.overallScore, gaps: prior.result.gaps }
					: undefined
			});
		} catch (e) {
			opts.emit({ kind: 'assessment_error', message: e instanceof Error ? e.message : String(e) });
			return;
		}

		const conv = prior
			? detectConvergence(
					{ overallScore: prior.result.overallScore, gaps: prior.result.gaps },
					{ overallScore: result.overallScore, gaps: result.gaps }
				)
			: undefined;

		const assessmentId = recordAssessment({
			pwaId: opts.pwaId,
			promptText: opts.prompt,
			iteration,
			priorAssessmentId: prior?.assessmentId,
			result,
			assessor: assessorIdentity(assessor, result),
			scoreDelta01: conv?.scoreDelta,
			converging: conv?.converging
		});

		opts.emit({
			kind: 'assessment_recorded',
			iteration,
			assessmentId,
			verdict: result.verdict,
			overallScore: toPercent(result.overallScore),
			criteria: result.criteria.map((c) => ({
				name: c.name,
				score: toPercent(c.score),
				...(c.rationale ? { rationale: c.rationale } : {})
			})),
			gaps: result.gaps,
			recommendation: result.recommendation,
			...(conv
				? { scoreDelta: Math.round(conv.scoreDelta * 100), converging: conv.converging }
				: {})
		});

		if (result.verdict === 'FAITHFUL') return; // done — faithful

		// Refine only when a real executor can revise AND a refinement budget remains; otherwise escalate to a human.
		const willRefine = opts.autoRefine && iteration < MAX;
		if (!willRefine) {
			const refined = iteration > 1;
			const reason = !opts.autoRefine
				? 'needs-review'
				: conv && !conv.converging
					? 'not-converging'
					: 'partial-after-refine';
			const context = escalationContext(result, refined, conv);
			escalateAssessment(assessmentId, reason, context);
			opts.emit({
				kind: 'assessment_escalated',
				assessmentId,
				reason,
				context,
				verdict: result.verdict,
				gaps: result.gaps,
				recommendation: result.recommendation
			});
			return;
		}

		// Not faithful and a refinement remains → apply one automatic refinement, then re-assess.
		const directive = refinementDirective(result);
		opts.emit({ kind: 'revision_started', iteration: iteration + 1, directive });
		prior = { assessmentId, result };
		await opts.runExecutor(directive);
	}
}
