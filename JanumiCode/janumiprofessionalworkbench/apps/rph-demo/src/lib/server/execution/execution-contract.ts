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
import type { StoredArtifactRef } from '@janumipwb/rph-ports';
import type { ExchangeParseOutcome } from '../agent/exchange-record.js';
import type { AdapterAnswer } from '../tools/backing-tool.js';
import type { WorkProductDerivation } from '@janumipwb/rph-contracts';

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
			shortfall:
				'The answer is not a JSON object, so the execution contract’s envelope could not be read.'
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

// ── ⭐⭐ JAN-EXEC PHASE 0 — THE ANSWER HALF IS THE ENVELOPE, SO THE ARTIFACT MUST BE DECLARED ───────────
//
// ⭐ SPONSOR RULING (2026-09-14): *"the ANSWER HALF is the ENVELOPE; the ARTIFACT keeps naming the WORK
// PRODUCT; and the RELATIONSHIP BETWEEN THEM MUST BE DECLARED"* — so a reader can still tell which bytes an
// assessment rested on.
//
// ⛔ WHAT THAT RULING COSTS, AND WHY THIS FUNCTION IS THE PRICE. Until it, the artifact and the exchange named
// ONE stored object and the relationship was IMPLICIT IN EQUAL BYTES: the same bytes under the same retention
// class ARE the same content-addressed key, so `art.storageKey === answerSpanRef.storageKey` held for free and
// `REG-F-345`'s one-object rule was satisfied by arithmetic. Passing the TRUE raw reply to `captureTry` — which
// is what lets Guide §9.7's lawful separation run at all — makes `splitAnswerSpan` locate the ENVELOPE, and the
// envelope is not the work product. Two objects, two hashes, and the free relationship is gone.
//
// ⚠ SO IT IS PAID FOR EXPLICITLY, IN THE RECORD, AND NOT LEFT TO THE READER TO INFER. `PER-9` permits a
// DISCLOSED absence and forbids a silent one; the same standard applies to a disclosed RELATION. E-5 is the
// element that carries *"what became of the bytes between the model and the judgement"*, and under this ruling
// what became of them is exactly this: the envelope was read, its `workProduct` field was taken out, and THOSE
// bytes — not the answer span's — are the ones every assessment is recorded over.
//
// ⛔ AND `NOT_ATTEMPTED` BECOMES FALSE HERE, WHICH IS A CONSEQUENCE OF THE RULING RATHER THAN A TIDY-UP. The
// old detail said *"An execution step answer is a work product; no schema coercion applies."* That was true
// while the answer half WAS the work product. Under the ruling the answer half is a structured envelope with a
// declared two-field shape, `splitExecutionEnvelope` coerces it, and saying nothing was attempted would assert
// an absence the step manufactured — the same defect one field over.

/**
 * ⭐⭐ R11 — DECLARE, AS A TYPED FIELD, WHERE THE WORK PRODUCT AN ASSESSMENT RESTS ON ACTUALLY WENT.
 *
 * ⚠⚠ THIS FUNCTION USED TO RETURN PROSE, AND THE MOVE IS THE SPONSOR'S RULING RATHER THAN A TIDY-UP. Phase 0
 * left the relation declared as a `WORK_PRODUCT_DERIVATION ` tag followed by embedded JSON INSIDE
 * `parseOutcome.detail` — a free-text string. That was the only carrier available: `MODEL_EXCHANGE` is a
 * `z.strictObject`, its object/command/event payloads are generated from the vocabulary, and `extensions[]` is
 * unreachable from the command surface (`REG-005`, driven). ⛔ But a typed record whose CENTRAL RELATIONSHIP
 * lives in a prose field is `PER-9`'s own *"hide core relationships in one generic JSON document"* with a
 * smaller container, and `R11` ruled it into the contract: vocab change, regeneration, ratification.
 *
 * ⭑ WHAT THE TYPED FORM BUYS THAT THE FRAGMENT COULD NOT. The fragment could be absent, malformed, duplicated
 * or contradicted by the prose around it and nothing would notice; a reader had to locate a tag and `JSON.parse`
 * a slice of a sentence. The field is validated at the dispatch boundary by `z.strictObject`, its optionals are
 * determined by `relation` in the handler, and both arms below are REACHABLE — which is why there are two.
 *
 * ⛔ IT NAMES THE WHOLE ADDRESS, NOT JUST THE KEY. `ContentRef`'s own docblock records why the short form was a
 * defect: *"a reference that cannot be verified is a reference that cannot be challenged"*. A declaration
 * carrying `contentHash` lets a reader re-hash the retained bytes and refuse this record if it lied; one
 * carrying only a key can only be believed.
 *
 * ⚠ THE SHORTFALL ARM IS NOT A FAILURE ARM. When the envelope was not honoured, `splitExecutionEnvelope` treats
 * the WHOLE ANSWER as the work product — the professional's work is not discarded because the harness's wrapper
 * was ignored — so a work product still exists, still has an address, and still must be declared. What changes
 * is that there is NO FIELD TO NAME, and `WHOLE_ANSWER_SPAN` says exactly that instead of inventing a
 * pseudo-field name for `sourceField` to hold.
 */
export function declareWorkProductDerivation(
	envelope: ExecutionEnvelope,
	workProduct: StoredArtifactRef
): WorkProductDerivation {
	const address = {
		storageProvider: workProduct.storageProvider,
		storageKey: workProduct.storageKey,
		contentHash: workProduct.contentHash,
		byteSize: workProduct.byteSize
	};
	return envelope.shortfall
		? { relation: 'WHOLE_ANSWER_SPAN', ...address }
		: { relation: 'ENVELOPE_FIELD', sourceField: 'workProduct', ...address };
}

/**
 * E-5's own account — what became of the bytes between the model and the judgement.
 *
 * ⛔ IT NO LONGER CARRIES THE ADDRESS, AND THAT IS THE POINT OF `R11` RATHER THAN A SIDE EFFECT. Two copies of
 * one relation drift; the typed field is the authority and this is the narrative beside it. What E-5 still owes
 * is the OUTCOME member and the producer's own shortfall quoted verbatim, which no typed field replaces.
 *
 * ⛔ AND `NOT_ATTEMPTED` IS STILL FALSE HERE, which is a consequence of the Phase 0 ruling rather than a
 * tidy-up. The old detail said *"An execution step answer is a work product; no schema coercion applies."* That
 * was true while the answer half WAS the work product. Under the ruling the answer half is a structured
 * envelope with a declared two-field shape, `splitExecutionEnvelope` coerces it, and saying nothing was
 * attempted would assert an absence the step manufactured.
 */
/**
 * ⭐⭐ `JAN-NOANS` — E-5 FOR A TRY THAT PRODUCED NO ANSWER (`REG-F-410`).
 *
 * ⛔ THE HARD PART IS NOT THE OUTCOME MEMBER; IT IS THE SENTENCE BESIDE IT. `EMPTY_RESPONSE` is right for all
 * three causes. But the assurance plane's existing detail — *"The model returned no bytes at all"* — is FALSE
 * when the provider refused the model, because then there was no model. Three independent adversarial passes
 * over three independent candidate designs each found that same defect first: a record that collapses
 * *"the provider refused"* into *"the producer said nothing"* commits `REG-F-410` inside `REG-F-410`'s fix.
 *
 * ⭑ SO THE DETAIL IS WRITTEN FROM WHAT THIS HOST ACTUALLY OBSERVED, and the reporter's own words are carried
 * verbatim rather than glossed — frequently that one sentence is the entire diagnosis, and a record without it
 * costs a human a CLI reproduction to learn what the host already knew.
 */
export function noAnswerOutcome(answer: AdapterAnswer & { arrived: false }): ExchangeParseOutcome {
	const preamble = 'No answer bytes reached this host on this try, so there is nothing to coerce. ';
	if (answer.cause === 'CALL_FAILED')
		return {
			outcome: 'EMPTY_RESPONSE',
			detail:
				preamble +
				`The ${answer.reportedBy === 'PROVIDER' ? 'provider' : 'backing tool'} reported the call failed, ` +
				`in its own words: “${answer.message}” ⛔ Nothing here is a finding about a PRODUCER — on this ` +
				'path a model may never have been invoked at all.'
		};
	if (answer.cause === 'CALL_ABORTED')
		return {
			outcome: 'EMPTY_RESPONSE',
			detail:
				preamble +
				'The turn was aborted or timed out before an answer arrived' +
				(answer.message ? `, reported as: “${answer.message}”` : ' and nothing further was reported') +
				'. ⛔ This is not a finding about a producer.'
		};
	return {
		outcome: 'EMPTY_RESPONSE',
		detail:
			preamble +
			'The turn ended and nothing reported a failure, so as far as this host can tell the producer ' +
			'completed its turn without saying anything. ⚠ That is the weakest of the three readings and it is ' +
			'the one used when no stronger signal was available.'
	};
}

/** Why the step refused, in the caller's terms. ⭑ Same three causes, same rule: never speak for a model that
 *  may not have run. */
export function noAnswerRefusal(answer: AdapterAnswer & { arrived: false }): string {
	const tail =
		'The try IS recorded (disposition `no-response`), but no work product exists, so no artifact is ' +
		'retained and no assurance floor is run — a reviewer asked to judge nothing produces findings about ' +
		'nothing, which is exactly what `REG-F-410` measured.';
	if (answer.cause === 'CALL_FAILED')
		return `The execution call failed and produced no answer: ${answer.message} ${tail}`;
	if (answer.cause === 'CALL_ABORTED')
		return `The execution call was aborted before any answer arrived${
			answer.message ? `: ${answer.message}` : '.'
		} ${tail}`;
	return `The execution turn ended without producing any answer. ${tail}`;
}

export function describeWorkProductDerivation(envelope: ExecutionEnvelope): ExchangeParseOutcome {
	return envelope.shortfall
		? {
				outcome: 'SCHEMA_COERCION_FAILED',
				detail:
					'E-2’s answer half is the execution ENVELOPE (JAN-EXEC Phase 0 ruling). This one did not honour ' +
					`the execution contract — ${envelope.shortfall} — so the whole answer is treated as the work ` +
					'product. It is retained SEPARATELY from the answer span, and the typed `workProductDerivation` ' +
					'field on this record addresses the bytes the assessment rests on (R11).'
			}
		: {
				outcome: 'PARSED',
				detail:
					'E-2’s answer half is the execution ENVELOPE (JAN-EXEC Phase 0 ruling: the ANSWER HALF is the ' +
					'ENVELOPE, the ARTIFACT keeps naming the WORK PRODUCT, and the relationship between them must be ' +
					'DECLARED). The envelope was read and its `workProduct` field extracted and retained SEPARATELY, ' +
					'so the artifact and the answer span are no longer the same stored object. The typed ' +
					'`workProductDerivation` field on this record addresses the bytes the assessment rests on (R11).'
			};
}
