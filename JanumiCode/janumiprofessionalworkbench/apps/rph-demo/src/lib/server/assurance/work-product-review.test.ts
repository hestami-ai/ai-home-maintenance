// JAN-WPREVIEW — the offline reviewer's WORK PRODUCT arm.
//
// ⛔ THE SHORTCUT THIS SUITE EXISTS TO PREVENT IS NAMED IN `REG-F-355`'s e2e: *"teach the offline reviewer to
// pass any parseable work product, at which point 'assured' would mean a JSON parse."* And it is not
// hypothetical — the validator's own `unreadable()` docblock records that both of its arms once returned
// SATISFIED with zero findings, "a control that cannot fail, sitting inside the assurance floor".
import { describe, expect, it } from 'vitest';
import { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
import type {
	AssuranceSubject,
	ReviewFraming,
	ValidatorContext
} from '@janumipwb/rph-assurance';

const CRITERIA = [
	{ id: 'RR-01-no-problem-substitution', description: 'discharges its obligation' },
	{ id: 'RR-04-no-proxy-satisfaction', description: 'no surface satisfaction' }
] as never;

const ARTIFACT: AssuranceSubject = {
	subjectId: 'art_1',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'm' }
};

const PROMPT = 'Assess the northern delivery route against the safety rubric.';

async function review(
	content: string,
	subject: AssuranceSubject = ARTIFACT,
	prompt = PROMPT,
	// ⭐ `R14` — THE SELECTOR MOVED OFF THE SUBJECT AND ONTO THE INPUT, so this parameter is what used to be
	// `subject.objectType === 'ARTIFACT'`. The CONTROL below still proves the two arms are distinguishable; what
	// changed is that reaching the graph arm is now a DECLARATION rather than the false half of a boolean.
	framing: ReviewFraming = 'WORK_PRODUCT'
) {
	const ctx: ValidatorContext = {
		reasoningReview: { criteria: CRITERIA, framing, prompt, content }
	};
	return createMockReasoningReviewValidator().evaluate(subject, ctx);
}

describe('JAN-WPREVIEW — the offline reviewer judges a work product', () => {
	it('⭑ CONTROL — a substantive work product IS satisfied, so the checks below are not "reject everything"', async () => {
		// Without this, every refusal is satisfiable by an arm that never passes — which would make the floor
		// unreachable rather than rigorous, and is the mirror of the rubber stamp this suite exists to prevent.
		const r = await review('{"finding":"The northern leg carries the risk; reroute via the coast."}');
		expect(r.dispositionRecommendation).toBe('SATISFIED');
	});

	it('⚠ and its SATISFIED records what it did NOT check', async () => {
		// THE MUTANT: drop the limitation. A shape check is then recorded as a passed REASONING review, and
		// nothing on the record says otherwise. ASR-11 requires a valid result to identify its limitations;
		// this is the one that matters.
		const r = await review('{"finding":"The northern leg carries the risk; reroute via the coast."}');
		expect(r.limitations.join(' '), 'the pass must disclose that it judged structure only').toMatch(
			/STRUCTURE only/i
		);
		expect(r.limitations.join(' ')).toMatch(/did not assess professional quality/i);
	});

	it('⛔ REJECTS a work product that parses and says nothing — RR-04', async () => {
		// "No proxy or surface satisfaction that conceals the underlying problem." Something was produced and
		// nothing was said. THE MUTANT: pass anything parseable — `{}` then satisfies a reasoning review.
		const r = await review('{"finding":"","notes":[]}');
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.observations.map((o) => o.code)).toContain('RR-04-no-proxy-satisfaction');
	});

	it('⛔ REJECTS a work product that merely restates its prompt — RR-01', async () => {
		// "The result genuinely discharges its delegated obligation rather than substituting an easier
		// problem." Restating the question instead of answering it IS the substitution.
		const r = await review('{"restated":"Assess the northern delivery route against the safety rubric."}');
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.observations.map((o) => o.code)).toContain('RR-01-no-problem-substitution');
	});

	it('⭑ the echo rule fires on EVERY value, not ANY — pinned against the demo\'s own fixture shape', async () => {
		// ⚠ THE DEMO'S DETERMINISTIC BACKEND RETURNS EXACTLY THIS SHAPE: one value that quotes the prompt and
		// one that does not. THE MUTANT: fire on ANY echoing value. The demo's own work product is then
		// rejected, and the defect is discovered by breaking the demo rather than by reasoning about the rule.
		const r = await review(
			'{"workProduct":"Assessment complete.","basis":"Assess the northern delivery route"}'
		);
		expect(r.dispositionRecommendation, 'a partial echo is not a restatement').toBe('SATISFIED');
	});

	it('⛔ an unparseable work product is INCONCLUSIVE — a reviewer that could not read has not reviewed', async () => {
		// ASR-11 limb 1: a validator failure "neither rejects nor satisfies the subject". THE MUTANT: REJECTED.
		// The work would then be blamed for the reviewer's silence.
		const r = await review('The route is fine, broadly speaking.');
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
	});

	it('⭑ CONTROL — the GRAPH arm is untouched: a PWA subject still gets the graph judgement', async () => {
		// Without this, "route on objectType" could not be told apart from "always use the work-product arm",
		// which would silently replace the authoring floor's reviewer with one built for something else.
		const graph: AssuranceSubject = { ...ARTIFACT, objectType: 'PROFESSIONAL_WORK_ARCHITECTURE' };
		// ⚠ EVERY FIELD `PwaGraphExport` DECLARES, derived from the interface rather than added one at a time as
		// each `TypeError` arrived. Three rounds of guess-and-run is the instrument telling you to go and read
		// the type — and a fixture assembled from error messages is complete only by luck.
		const EMPTY_GRAPH = JSON.stringify({
			pwa: { id: 'pwa_1', name: 'T', version: '1.0.0' },
			nodes: [],
			permits: [],
			dataFlow: [],
			artifacts: [],
			roots: []
		});
		const r = await review(EMPTY_GRAPH, graph, PROMPT, 'PWA_GRAPH');

		// ⚠ MY FIRST EXPECTATION HERE WAS WRONG, AND THE CODE WAS RIGHT: I asserted SATISFIED on the theory
		// that an empty graph is "well-formed". `analyzePwaGraph` disagrees — a graph with no root is not
		// well-formed — and the graph arm REJECTS it. ⭑ That makes a SHARPER control than the one I intended:
		// the work-product arm, fed these same bytes, would find three string leaves none of which echo the
		// prompt and return SATISFIED. **So REJECTED here is only reachable through the graph arm**, which is
		// exactly what this control needs to prove.
		expect(r.dispositionRecommendation, 'a PWA subject must reach the GRAPH arm').toBe('REJECTED');
		expect(
			r.observations.map((o) => o.code),
			'and be judged by the graph criterion, not a work-product one'
		).toContain('RR-09-no-completeness-from-existence');
		// And the work-product limitation must NOT appear on a graph review.
		expect(r.limitations.join(' ')).not.toMatch(/STRUCTURE only/i);
	});
});
