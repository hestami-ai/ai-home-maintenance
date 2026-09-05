// JAN-EXECRAT — the EXECUTION CONTRACT: what the harness requires of any model executing a work unit.
//
// ⭑ SPONSOR RULING (2026-09-05): *"An execution step should declare a rationale."* With the reasoning —
// *"if not the actual thinking tokens then some sort of explanation is probably key."*
//
// ⭑⭑ THE DISTINCTION THAT RULING TURNS ON IS ALREADY CANON, AND HAD SIMPLY NEVER BEEN DRAWN ON THIS PLANE:
//
//   VOLUNTEERED REASONING (thinking tokens)      | PROFESSIONAL RATIONALE SUMMARY (§9.7)
//   emitted unbidden                             | CONTRACTED — asked for, part of the deliverable
//   PURGEABLE_AT_EXPIRY (PER-12)                 | RETAINED_BY_PARTICIPATION — it participates
//   ⛔ an evaluator may NEVER see it              | ⭑ it is what the evaluator is FOR
//   no obligation to produce one                 | required by this contract
//
// So `thinkingLevel: 'off'` STAYS. We still do not solicit chain-of-thought. What changes is that we now
// require the contracted account that was always meant to stand in its place — the authoring agent's own
// instruction has said so all along: *"An independent reviewer reads this and nothing else about your
// reasoning."*
//
// ⛔ AND IT LIVES HERE, NOT IN THE TYPE'S PROMPT TEMPLATE. `REG-D-058` ruled the template is OWNED by the
// work-unit type and authored by a professional. The type says WHAT work; the harness says the EXECUTION
// CONTRACT. Injecting this into the template would silently edit someone else's contract.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';

/**
 * The executor's system prompt.
 *
 * ⚠ IT FORBIDS NARRATION AND REQUIRES AN ACCOUNT, AND THOSE ARE SAID AS TWO DIFFERENT THINGS. The previous
 * version said only *"Do not narrate, do not explain your reasoning"* — and a live reviewer then REJECTED the
 * work product for *"omitting the Section 9.7 professional rationale summary entirely"*. We had instructed the
 * producer not to do the thing we then faulted it for omitting. Collapsing the two again reintroduces that.
 */
export const EXECUTION_CONTRACT_PROMPT = [
	'You are executing one professional work unit. You will be given an instruction that states the work and the',
	'exact output it requires.',
	'',
	'Return ONLY a single minified JSON object with exactly two top-level fields and no other text:',
	'',
	'  "workProduct": exactly what the instruction asks for, in the shape the instruction specifies. Do not',
	'                 restate the instruction, and do not wrap it in commentary.',
	'',
	'  "rationale":   your PROFESSIONAL RATIONALE SUMMARY — your own account of HOW the work product discharges',
	'                 the obligation in the instruction. Not a list of what you did, and NOT your step-by-step',
	'                 thinking: the professional judgement behind the result, and where it is weak. An',
	'                 independent reviewer reads this and nothing else about your reasoning. Shaped as:',
	'                   { "rationale": "...",',
	'                     "assumptions": ["..."],        // what you relied on but could not verify',
	'                     "limitations": ["..."],        // what you knowingly did NOT do',
	'                     "residualUncertainty": ["..."] // what remains unsettled }',
	'',
	'Declaring a real limitation is not a failure; concealing one is.'
].join('\n');

/** What the contract asked for, and what actually came back. */
export interface ExecutionEnvelope {
	/** The work product alone — what becomes the ARTIFACT, in the shape the TYPE's contract specifies. */
	readonly workProduct: string;
	/** ⭑ Undefined means NOT DECLARED, which is a recorded shortfall — never a fabricated summary. */
	readonly rationale?: ProfessionalRationaleSummary;
	/** Set when the contract was not honoured, so the record can say so in the producer's own terms. */
	readonly shortfall?: string;
}

/** Coerce one field to a string array without inventing entries. An absent list means the producer declared
 *  none, which is a different fact from a list we made up. */
function list(v: unknown): readonly string[] {
	if (!Array.isArray(v)) return [];
	return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

/**
 * Split an executing model's answer into the work product and its declared rationale.
 *
 * ⛔ NON-COMPLIANCE IS A RECORDED SHORTFALL, NOT A FABRICATION AND NOT A FAILURE. The authoring seam already
 * states the rule this follows: a missing rationale is *"a contract shortfall to record, never an absence to
 * infer from (§9.7)."* So when no envelope arrives, the WHOLE ANSWER IS THE WORK PRODUCT — the professional's
 * work is not discarded because the harness's wrapper was ignored — and the rationale is recorded as not
 * declared. A reviewer may then legitimately make a finding of that absence, which is exactly the verdict
 * `GLM-5.2` already reached in `JAN-LIVEEXEC`, arrived at lawfully rather than by accident.
 */
export function splitExecutionEnvelope(answer: string): ExecutionEnvelope {
	let parsed: unknown;
	try {
		parsed = JSON.parse(answer);
	} catch {
		return {
			workProduct: answer,
			shortfall: 'The answer is not a JSON object, so the execution contract’s envelope could not be read.'
		};
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
		return { workProduct: answer, shortfall: 'The answer is not a JSON object.' };

	const obj = parsed as Record<string, unknown>;
	if (!('workProduct' in obj))
		return {
			workProduct: answer,
			shortfall:
				'The answer carries no `workProduct` field, so the execution contract’s envelope was not used. ' +
				'The whole answer is treated as the work product.'
		};

	// ⚠ RE-SERIALIZED, NOT RE-SHAPED. Whatever the professional's own `outputContract` asked for is what the
	// artifact holds; the harness's envelope is unwrapped and then forgotten.
	const wp = obj.workProduct;
	const workProduct = typeof wp === 'string' ? wp : JSON.stringify(wp);

	const r = obj.rationale;
	if (r === null || typeof r !== 'object' || Array.isArray(r))
		return {
			workProduct,
			shortfall: 'The envelope declared no `rationale`, which the execution contract requires.'
		};
	const ro = r as Record<string, unknown>;
	const account = typeof ro.rationale === 'string' ? ro.rationale.trim() : '';
	if (account === '')
		return {
			workProduct,
			shortfall: 'A `rationale` object was returned with no account in it.'
		};

	return {
		workProduct,
		rationale: {
			rationale: account,
			assumptions: list(ro.assumptions),
			limitations: list(ro.limitations),
			residualUncertainty: list(ro.residualUncertainty)
		}
	};
}
