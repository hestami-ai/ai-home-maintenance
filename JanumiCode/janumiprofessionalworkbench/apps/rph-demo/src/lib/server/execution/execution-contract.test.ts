// JAN-EXECRAT — the execution contract: a work unit returns its work AND an account of it.
//
// ⭑ THE SPONSOR RULING THIS IMPLEMENTS: *"An execution step should declare a rationale."* It came from a LIVE
// run in which GLM-5.2 rejected a real work product for *"omitting the Section 9.7 professional rationale
// summary entirely"* — a rejection that landed on an incoherence in our own executor prompt, which had told
// the producer *"do not explain your reasoning."*
import { describe, expect, it } from 'vitest';
import { EXECUTION_CONTRACT_PROMPT, splitExecutionEnvelope } from './execution-contract.js';

const RATIONALE = {
	rationale: 'The northern leg dominates the risk, so the reroute is the load-bearing recommendation.',
	assumptions: ['Winter closure dates are as published.'],
	limitations: ['No traffic data after 2026-06.'],
	residualUncertainty: ['Whether the coastal road is gritted.']
};

describe('JAN-EXECRAT — the envelope is split, and the type’s own contract survives it', () => {
	it('⭑ CONTROL — a compliant envelope yields the work product AND the rationale', () => {
		// Without this control every assertion below is satisfiable by "always report a shortfall", which would
		// make the contract unmeetable rather than required.
		const out = splitExecutionEnvelope(
			JSON.stringify({ workProduct: { finding: 'viable' }, rationale: RATIONALE })
		);
		expect(out.shortfall).toBeUndefined();
		expect(out.rationale?.rationale).toContain('northern leg');
		expect(out.rationale?.assumptions).toHaveLength(1);
	});

	it('⭑ the work product is RE-SERIALIZED, so the professional’s output contract still means what it says', () => {
		// THE MUTANT: store the whole envelope as the work product. A downstream step or an assurance policy
		// reading the artifact would then find the harness's wrapper where the TYPE's declared shape should be —
		// and `REG-D-058` ruled that shape is the type's to own.
		const out = splitExecutionEnvelope(
			JSON.stringify({ workProduct: { finding: 'viable' }, rationale: RATIONALE })
		);
		expect(JSON.parse(out.workProduct)).toEqual({ finding: 'viable' });
		expect(out.workProduct).not.toContain('rationale');
	});

	it('⛔ NO ENVELOPE — the whole answer is still the work product, and the shortfall is RECORDED', () => {
		// ⭑⭑ THE RULE THE AUTHORING SEAM ALREADY STATES: a missing rationale is "a contract shortfall to record,
		// never an absence to infer from (§9.7)".
		//
		// THE MUTANT (1): synthesize a rationale. The record would then carry an account no producer ever gave —
		// the fabricated-measurement defect, applied to the one field whose whole purpose is to be the
		// producer's OWN words.
		// THE MUTANT (2): refuse the step. A professional's work would be discarded because the harness's
		// wrapper was ignored.
		const out = splitExecutionEnvelope('{"finding":"the route is viable"}');
		expect(out.rationale, 'a rationale must NEVER be fabricated').toBeUndefined();
		expect(out.workProduct, 'the work is not discarded').toContain('the route is viable');
		expect(out.shortfall).toMatch(/workProduct/);
	});

	it('⛔ an envelope with no rationale is a shortfall, and the work product still lands', () => {
		const out = splitExecutionEnvelope(JSON.stringify({ workProduct: { finding: 'viable' } }));
		expect(out.rationale).toBeUndefined();
		expect(JSON.parse(out.workProduct)).toEqual({ finding: 'viable' });
		expect(out.shortfall).toMatch(/rationale/);
	});

	it('⛔ a rationale object with an EMPTY account is a shortfall, not a rationale', () => {
		// THE MUTANT: accept any object as a rationale. `{}` would then satisfy §9.7 — the proxy-satisfaction
		// failure class, inside the very field that exists to prevent it.
		const out = splitExecutionEnvelope(
			JSON.stringify({ workProduct: 'x', rationale: { rationale: '   ', assumptions: [] } })
		);
		expect(out.rationale).toBeUndefined();
		expect(out.shortfall).toMatch(/no account/i);
	});

	it('⚠ unparseable output is a shortfall, and the bytes are still treated as the work product', () => {
		const out = splitExecutionEnvelope('The route is fine, broadly speaking.');
		expect(out.workProduct).toBe('The route is fine, broadly speaking.');
		expect(out.shortfall).toMatch(/not a JSON object/);
	});

	it('⭑ missing sub-lists are EMPTY, not invented', () => {
		// An absent list means the producer declared none — a different fact from a list we made up. This is the
		// same distinction `PER-12` draws between "reported nothing" and "nobody looked".
		const out = splitExecutionEnvelope(
			JSON.stringify({ workProduct: 'x', rationale: { rationale: 'because' } })
		);
		expect(out.rationale?.assumptions).toEqual([]);
		expect(out.rationale?.limitations).toEqual([]);
	});
});

describe('JAN-EXECRAT — the prompt requires an ACCOUNT and still refuses to solicit THINKING', () => {
	it('⭑ it asks for a professional rationale summary', () => {
		// THE MUTANT: keep the old prompt ("Do not narrate, do not explain your reasoning"). That is the exact
		// text that produced a live REJECTION for omitting the §9.7 summary.
		expect(EXECUTION_CONTRACT_PROMPT).toMatch(/PROFESSIONAL RATIONALE SUMMARY/);
		expect(EXECUTION_CONTRACT_PROMPT).toMatch(/assumptions/);
		expect(EXECUTION_CONTRACT_PROMPT).toMatch(/limitations/);
		expect(EXECUTION_CONTRACT_PROMPT).toMatch(/residualUncertainty/);
	});

	it('⛔ and it does NOT solicit chain-of-thought — PER-12 is unchanged by this ruling', () => {
		// ⚠ THE TWO ARE DIFFERENT THINGS AND THE PROMPT MUST SAY SO. `PER-12`: volunteered reasoning in an
		// evaluator's context is a hidden-context independence violation. Requiring an ACCOUNT must not become
		// asking for the producer's INTERIOR — which is the easy mistake when relaxing "do not explain".
		expect(EXECUTION_CONTRACT_PROMPT).toMatch(/NOT your step-by-step/i);
		expect(EXECUTION_CONTRACT_PROMPT).not.toMatch(/chain.of.thought|show your (thinking|work)/i);
	});
});
