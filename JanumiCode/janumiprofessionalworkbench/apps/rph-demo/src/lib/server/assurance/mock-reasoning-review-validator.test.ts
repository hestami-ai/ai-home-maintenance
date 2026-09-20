// The TEST_MODE Reasoning-Review Validator must FAIL CLOSED on a subject it cannot read.
//
// ── THE DEFECT THIS FILE EXISTS FOR ─────────────────────────────────────────────────────────────────────────
// `judge()` returned `{ findings: [], recommendation: 'SATISFIED' }` from BOTH its unreadable-subject arms — a
// JSON parse failure, and an export with no `nodes`. So the floor's mandatory Reasoning Review passed, with
// zero findings, on content it had never read.
//
// ⚠ AND IT IS A CONTROL THAT CANNOT FAIL, SITTING INSIDE THE ASSURANCE FLOOR, ON THE PATH THE GATE USES. Every
// e2e that "proves" the floor blocks was proving less than it appeared: the one validator the gate can run had
// an arm that returns a pass for anything it cannot parse.
//
// ⚠⚠ THE SAME FILE ALREADY FAILS CLOSED ONE FUNCTION LOWER, WITH A COMMENT EXPLAINING WHY. `evaluate` throws on
// a missing `reasoningReview` context and cites §13.3 "fail closed". So the module holds both postures at once
// — reasoned fail-closed on missing INPUT, silent fail-open on unreadable CONTENT — and its own header claims
// "an invalid one is REJECTED", which was a behaviour the code did not have.
import { describe, expect, it } from 'vitest';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
import { REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { buildPwaGraphExport, type PwaGraphNode } from '@janumipwb/rph-projections';

const SUBJECT = { id: 'pwa-1', semanticVersion: 1 };

async function judgeContent(content: string) {
	const v = createMockReasoningReviewValidator();
	return v.evaluate(SUBJECT as never, {
		reasoningReview: {
			content,
			criteria: REASONING_REVIEW_CRITERIA,
			framing: 'PWA_GRAPH',
			prompt: 'x'
		}
	} as never);
}

/** A well-formed export — the control that proves the fix did not simply block everything.
 *  ⚠ BUILT WITH THE REAL BUILDER, NOT HAND-WRITTEN JSON. The first version of this fixture invented a shape
 *  (`edges` instead of `permits`) and `analyzePwaGraph` threw — a control that fails for its OWN reason
 *  proves nothing about the subject, so the fixture is derived from the same function production uses. */
const ROOT: PwaGraphNode = {
	id: 'root',
	name: 'root',
	pwuKind: 'PRODUCT_REALIZATION',
	isRoot: true,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: []
} as PwaGraphNode;

const VALID_GRAPH = JSON.stringify(
	buildPwaGraphExport(
		{ id: 'pwa_t', name: 'T', domain: 'software', version: '0.1.0', publicationStatus: 'DRAFT' } as never,
		[ROOT]
	)
);

describe('mock Reasoning Review — fail CLOSED on an unreadable subject', () => {
	it('unparseable content is INCONCLUSIVE, never SATISFIED', async () => {
		const r = await judgeContent('}{ not json at all');

		// THE MUTANT: return SATISFIED, which is what shipped. floor.ts:333 — INCONCLUSIVE "leaves assurance
		// incomplete → blocks"; assurance-rules.ts:44 — undeterminable on a mandatory criterion is
		// "INCONCLUSIVE (never a pass)". A validator that cannot read its subject has not reviewed it.
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
		expect(r.dispositionRecommendation).not.toBe('SATISFIED');
	});

	it('a parsed object with no `nodes` is INCONCLUSIVE — malformed is not empty', async () => {
		// `{nodes: []}` is a legitimately EMPTY graph and stays reviewable; an export with no `nodes` key at all
		// is malformed. THE MUTANT: collapse the two and pass both.
		const r = await judgeContent(JSON.stringify({ notAGraph: true }));
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
	});

	it('the unreadability is RECORDED, not merely dispositioned', async () => {
		const r = await judgeContent('}{ not json at all');

		// THE MUTANT: return INCONCLUSIVE with empty limitations. PER-9 E-5 is "the parse/validation/repair
		// outcome"; a disposition alone says the review failed but not that it failed to READ. §8.9 requires a
		// valid result to identify its "residual uncertainty, limitations" — this is what that field is for.
		expect(r.limitations.length).toBeGreaterThan(0);
		expect(r.limitations.join(' ')).toMatch(/pars|read/i);
	});

	it('CONTROL — a well-formed graph is still SATISFIED', async () => {
		// Without this the fix could not be told apart from "block everything", which would pass all three
		// assertions above while destroying the gate.
		const r = await judgeContent(VALID_GRAPH);
		expect(r.dispositionRecommendation).toBe('SATISFIED');
	});
});


// ── ⭐⭐ `JAN-EXEC` PHASE 5 / `R14`+`R15` — THE PROCESS-RESULT ARM, AND THE BLOCK IT REPLACES ──────────────
//
// ⛔ WHAT THESE TESTS WOULD HAVE MEASURED BEFORE `R14`, AND IT IS WHY PHASE 5 WAS RE-SPECIFIED. The selector was
// `subject.objectType === 'ARTIFACT'` with the GRAPH as its false arm, so a command result took the graph arm,
// failed `JSON.parse`, and returned `unreadable()` → INCONCLUSIVE. INCONCLUSIVE BLOCKS. Every one of the tests
// below would have returned INCONCLUSIVE with a limitation naming a PWA graph export — a step that could never
// complete, arrived at by telling a reviewer it was reading something it was not.
//
// ⭑ AND THE ARM PERFORMS ONE CHECK, WHICH IS THE ONLY ONE §22.1 LICENSES OFFLINE: the agent's account is
// untrusted, the HOST's observation is not, and the review is the JOIN. It does NOT grade the command — there is
// no model reasoning in an exit code.
describe('⭐ JAN-EXEC Phase 5 — the PROCESS_RESULT arm joins the agent\'s result to the HOST\'s observation', () => {
	const RESULT = 'exit 0 in 89ms\n--- stdout ---\n12 passed\n--- stderr ---\n';

	async function judgeProcess(content: string, observed?: ObservedToolCallReport) {
		return createMockReasoningReviewValidator().evaluate(SUBJECT as never, {
			reasoningReview: {
				content,
				criteria: REASONING_REVIEW_CRITERIA,
				framing: 'PROCESS_RESULT',
				prompt: 'Build the CLI and run its tests',
				...(observed ? { observedToolCalls: observed } : {})
			}
		} as never);
	}

	const OBSERVED = (outcome: 'COMPLETED' | 'REFUSED' | 'FAILED' | 'UNKNOWN'): ObservedToolCallReport => ({
		observation: 'OBSERVED',
		calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome }],
		observedCount: 1,
		recordedLimit: 32
	});

	it('⭐ A COMMAND RESULT THE HOST WATCHED COMPLETE IS SATISFIED — and this is the red the phase turns on', async () => {
		// ⛔ BEFORE `R14` THIS RETURNED `INCONCLUSIVE`, because an EVIDENCE subject took the graph arm and a test
		// log is not a graph export. INCONCLUSIVE blocks, so the completion this phase exists to permit could
		// never have happened. THE MUTANT: restore the binary selector.
		const r = await judgeProcess(RESULT, OBSERVED('COMPLETED'));
		expect(r.dispositionRecommendation, JSON.stringify(r.limitations)).toBe('SATISFIED');
	});

	it('⚠ and it RECORDS what it did not check, so a structural join is not read as a semantic review', async () => {
		// THE MUTANT: return SATISFIED with empty limitations. The floor would then record that a build was
		// REASONING-REVIEWED when what happened is that two counts agreed. `ASR-11` requires a valid result to
		// identify its limitations, and this is the one that matters.
		const r = await judgeProcess(RESULT, OBSERVED('COMPLETED'));
		expect(r.limitations.length).toBeGreaterThan(0);
		expect(r.limitations.join(' ')).toMatch(/did NOT read the command/);
	});

	it('⛔ THE JOIN — a result exists while the host observed NO calls is a CONTRADICTION, and BLOCKS', async () => {
		// §22.1: the model's word is untrusted external input. A command result under review means a command
		// ran; if the party that DROVE the session watched and saw nothing, the two disagree and the result is
		// not evidence of anything. THE MUTANT: treat NONE_OBSERVED as "no information" and pass.
		const r = await judgeProcess(RESULT, { observation: 'NONE_OBSERVED' });
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.observations.map((o) => o.code)).toContain('RR-07-no-contradiction');
		expect(r.observations[0]?.severity).toBe('BLOCKING');
	});

	it('⛔ and a call the host saw REFUSE cannot have produced a result either', async () => {
		// The second limb of the same join, and it is separable: `NONE_OBSERVED` is an empty list, this is a
		// NON-empty list in which nothing completed. THE MUTANT: check only `calls.length > 0`, which passes a
		// turn where every call was refused — exactly the seam-working-correctly case, read as a success.
		const r = await judgeProcess(RESULT, OBSERVED('REFUSED'));
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.observations.map((o) => o.code)).toContain('RR-07-no-contradiction');
		expect(r.observations[0]?.statement).toMatch(/NONE completed/);
	});

	it('⭐⛔ NOT_OBSERVABLE is INCONCLUSIVE and NEVER a pass — the two absences do not collapse', async () => {
		// ⛔ THE DISTINCTION `R11` MINTED THE DISCRIMINATOR FOR. "Nothing could look" is not "something looked
		// and saw none": the first supplies no independent half, so the only check this arm performs could not
		// be performed. THE MUTANT: fold NOT_OBSERVABLE into NONE_OBSERVED — the review would then REJECT a
		// perfectly good command result because the adapter happened to be a one-shot seam.
		const r = await judgeProcess(RESULT, {
			observation: 'NOT_OBSERVABLE',
			reason: 'the backing tool returned only an answer string'
		});
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
		expect(r.limitations.join(' ')).toMatch(/not in a position to observe/i);
		expect(
			r.observations,
			'⛔ an unperformed check must record NO finding — a finding would attribute a failure to the subject'
		).toHaveLength(0);
	});

	it('⚠ an ABSENT observation is also INCONCLUSIVE — absence of observation is not observation of absence', async () => {
		const r = await judgeProcess(RESULT, undefined);
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
		expect(r.observations).toHaveLength(0);
	});

	it('⭑ a result that says NOTHING is BLOCKING, mirroring the work-product arm', async () => {
		// THE MUTANT: pass an empty result because the counts agreed. A passing verdict would then rest on the
		// result's EXISTENCE rather than on anything it says — `RR-04`, verbatim.
		const r = await judgeProcess('   \n  ', OBSERVED('COMPLETED'));
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.observations.map((o) => o.code)).toContain('RR-04-no-proxy-satisfaction');
	});

	it('⭐ CONTROL — the same bytes under the GRAPH framing are still INCONCLUSIVE, so this is ROUTING', async () => {
		// ⛔ WITHOUT THIS, "teach the offline reviewer to pass a test log" would satisfy every assertion above
		// while destroying the graph arm — and the graph arm is what the AUTHORING floor runs on. The same
		// content, one field different, must still reach the old verdict.
		const r = await createMockReasoningReviewValidator().evaluate(SUBJECT as never, {
			reasoningReview: {
				content: RESULT,
				criteria: REASONING_REVIEW_CRITERIA,
				framing: 'PWA_GRAPH',
				prompt: 'x'
			}
		} as never);
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
		expect(r.limitations.join(' ')).toMatch(/pars/i);
	});

	it('⭐ CONTROL — and a GRAPH under the PROCESS_RESULT framing does NOT get the graph verdict', async () => {
		// The converse routing control. A well-formed graph is SATISFIED on the graph arm; here it must be judged
		// by the JOIN instead, which with no observation is INCONCLUSIVE. THE MUTANT: fall back to the graph arm
		// whenever the content happens to parse — a content-sniffing selector, which is the inference `R14`
		// removed, re-entering through the back door.
		const r = await judgeProcess('{"nodes":[],"edges":[]}', undefined);
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
	});
});

// ── ⭐⭐ THE FIXTURE MAY DECLARE ONLY WHAT IT EXAMINED (`JAN-EXEC` `R26`, evidence in `REG-F-409`) ───────
//
// ⛔ THIS BLOCK EXISTS TO STOP A SPECIFIC, TEMPTING REPAIR THAT THE SPONSOR REJECTED BY NAME. With the mapper
// now reading ABSENCE as `UNABLE_TO_DETERMINE`, the gate's floor is INCONCLUSIVE — correctly, because this
// fixture faults four of the policy's nine criteria and evaluates only two per arm. The one-line way to make
// the gate green again is to have the fixture claim it evaluated all nine. That is a fixture asserting work it
// did not do, and it would BURY `REG-F-409` rather than close it.
//
// ⭑ A DETERMINISTIC CHECK CANNOT JUDGE *“sound inference”* OR *“no premature convergence”*. Nothing here is
// asked to. What it is asked to do is say so, which is all this test enforces.
describe('⛔ R26 — the deterministic fixture declares the criteria it examined, and no others', () => {
	const ALL_NINE = REASONING_REVIEW_CRITERIA.map((c) => c.id);

	it('⭐ the PWA-graph arm declares TWO of the policy\u2019s NINE, and stays silent on the rest', async () => {
		const r = await judgeContent(VALID_GRAPH);
		const declared = new Set(r.criteria.filter((c) => c.outcome !== 'UNABLE_TO_DETERMINE').map((c) => c.criterionId));
		expect(ALL_NINE, 'precondition: the policy declares nine').toHaveLength(9);
		expect(
			[...declared].sort(),
			'RR-09 is the well-formedness check and RR-04 the dead-end check; this arm runs no others'
		).toEqual(['RR-04-no-proxy-satisfaction', 'RR-09-no-completeness-from-existence']);
	});

	it('⛔ and the seven it did not examine arrive UNABLE_TO_DETERMINE, never MET', async () => {
		// ⚠ THE OBSERVABLE IS THE OUTCOME, NOT THE COUNT. Asserting “seven silences” would pass for a fixture
		// that claimed all nine and then faulted seven — the opposite defect, and a worse record.
		const r = await judgeContent(VALID_GRAPH);
		const unjudged = r.criteria.filter((c) => c.outcome === 'UNABLE_TO_DETERMINE').map((c) => c.criterionId);
		expect(unjudged.sort()).toEqual([
			'RR-01-no-problem-substitution',
			'RR-02-no-obligation-elision',
			'RR-03-no-unjustified-scope-reduction',
			'RR-05-no-premature-convergence',
			'RR-06-sound-inference',
			'RR-07-no-contradiction',
			'RR-08-evidence-integrity'
		]);
		expect(
			r.criteria.every((c) => c.outcome !== 'MET' || declaredByThisArm(c.criterionId)),
			'no criterion may read MET unless this arm actually examined it'
		).toBe(true);
	});
});

/** The two this arm runs — spelled here so the assertion above cannot drift with the fixture silently. */
function declaredByThisArm(id: string): boolean {
	return id === 'RR-04-no-proxy-satisfaction' || id === 'RR-09-no-completeness-from-existence';
}
