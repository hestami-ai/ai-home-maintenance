// MODEL_EXCHANGE — PER-9's durable exchange record, one per bounded model or agent try.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────────
// `PER-9` (`JPWB-DOC-003:369`): *"Every bounded model or agent try — each retry, reformat, and repair request
// included — is its own durable exchange record capturing the exact materialized input presented to the model,
// the returned output before schema coercion or repair, the resolved provider, model, and version actually
// invoked, declared truncation or omission, and the parse/validation/repair outcome."*
//
// Nothing in this engine could hold one. Every candidate carrier was enumerated and each failed
// (`DESIGN-durable-exchange-record.md` §2); the single untyped route — an open `z.record` reachable through
// `ProposeEvidence` — is precisely `PER-9`'s forbidden *"hide core relationships in one generic JSON document"*.
// `REG-D-054` resolved §16 item 23 for this limb and `REG-D-055` made the carrier a STORED OBJECT.
//
// ── BORN TERMINAL, AND THAT IS LOAD-BEARING ──────────────────────────────────────────────────────────────────
// The record is created once at revision 0 with `lifecycleStatus: 'RECORDED'` and there is no second command.
// So `PER-8` immutability is STRUCTURAL rather than disciplinary — there is no act that can rewrite a recorded
// try, which makes CSAA-007's *"repair never rewrites predecessor raw output"* unbreakable rather than merely
// observed. It also keeps this type out of `STATE_MACHINES`, so the arrow censuses are untouched.
//
// ── ⭑ WHY THE GUARDS ARE DERIVED AND NOT HAND-LISTED ─────────────────────────────────────────────────────────
// The content-ref and identity-fact groups are derived from the payload's own field names. A hand-listed group
// is a claim that the list matches the shape, unverified — and a field added later would silently escape every
// guard below. Deriving makes that impossible rather than unlikely. `model-exchange.test.ts` additionally pins
// the derived sets, so a RENAME that empties one is a red rather than a silent no-op.
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';

import { createObject, newEnvelope, reject, type CommandHandler } from './kit.js';

const MODEL_EXCHANGE = 'MODEL_EXCHANGE';

/** Roles that MUST name what they followed. `INITIAL` is the only try with nothing before it. */
const FOLLOW_ON_ROLES = new Set(['RETRY', 'REFORMAT', 'REPAIR']);

/**
 * ⛔ THE ONE E-2 COMBINATION THAT STAYS REFUSED.
 *
 * `REG-D-056` (sponsor): *"Yes, save raw answer."* So the answer span and the volunteered reasoning are now
 * retainable — SEPARATELY, under their own classes, which is what Guide §9.7 requires: *"separate it at
 * retention so that only the answer span binds under Section 8.4."*
 *
 * ⚠ WHAT THE RULING DOES NOT LIFT IS THE MIXED WHOLE-BLOB WRITE. If a reasoning span was separated out, then
 * the whole blob demonstrably CONTAINS reasoning, and storing it whole classifies that reasoning as
 * participating — permanent under `PER-8`, when `PER-12` requires it purgeable. That is the `rawOutput` field
 * item 23 drafted, defended as *"retained whole"*, and WITHDREW. The handler cannot see bytes, but it can see
 * this: a stored whole blob ALONGSIDE a stored reasoning span is that write, and nothing else is.
 */

type Ref = { status: string; reason?: string } & Record<string, unknown>;
type Fact = { availability: string; evidence: string; value?: string; rationale?: string };

/** Field names ending `Ref` — the content-reference group, read off the payload rather than listed. */
function refFields(p: RecordModelExchangePayload): string[] {
	return Object.keys(p).filter((k) => k.endsWith('Ref'));
}

/** Field names beginning `resolved` — the E-3 identity-fact group, likewise derived. */
function factFields(p: RecordModelExchangePayload): string[] {
	return Object.keys(p).filter((k) => k.startsWith('resolved'));
}

/** The six fields a STORED ref must carry and a PENDING ref must not. */
const STORED_ONLY = [
	'storageProvider',
	'storageKey',
	'contentHash',
	'byteSize',
	'purgeability',
	'contentDurability'
] as const;

export const recordModelExchange: CommandHandler = (ctx, command, payload) => {
	const p = payload as RecordModelExchangePayload;
	const bad = (why: string) => reject(command, 'RPH_INVARIANT_VIOLATION', why, [p.exchangeId]);

	// ── THE CHAIN. A follow-on try that names no predecessor leaves a hole PER-9's "each retry, reformat, and
	//    repair request included" exists to prevent; an INITIAL that names one asserts a predecessor that, by
	//    definition, is not there.
	const follows = FOLLOW_ON_ROLES.has(p.exchangeRole);
	if (follows && !p.predecessorExchangeId)
		return bad(
			`exchangeRole ${p.exchangeRole} is a follow-on try and must name its predecessorExchangeId. Without it the per-try chain has a hole, and PER-9 requires each retry, reformat and repair to be its own record IN SEQUENCE.`
		);
	if (!follows && p.predecessorExchangeId)
		return bad(
			`exchangeRole INITIAL cannot name a predecessorExchangeId — an initial try is the first, so a predecessor here asserts a record that does not exist.`
		);
	if (!Number.isInteger(p.attemptOrdinal) || p.attemptOrdinal < 1)
		return bad(`attemptOrdinal must be a positive integer; got ${String(p.attemptOrdinal)}.`);
	if (p.runToken.trim() === '')
		return bad(
			`runToken must be non-empty: it is what orders tries within one run, and revision cannot do it because each try is its own aggregate.`
		);

	// ── SCOPE. `assurancePolicyId` is determined by `plane`, so both disagreements are refused rather than
	//    leaving a reader to guess whether an absent policy means "not assurance" or "nobody recorded it".
	if (p.plane === 'ASSURANCE' && !p.assurancePolicyId)
		return bad(`plane ASSURANCE requires assurancePolicyId — the policy under which the try was made.`);
	if (p.plane !== 'ASSURANCE' && p.assurancePolicyId)
		return bad(`assurancePolicyId is meaningful only when plane is ASSURANCE; got plane ${p.plane}.`);

	// ── E-1..E-6 CONTENT REFS. `status` is the discriminator and every optional is determined by it.
	for (const name of refFields(p)) {
		const r = (p as unknown as Record<string, Ref>)[name]!;
		const present = STORED_ONLY.filter((f) => r[f] !== undefined);
		if (r.status === 'STORED') {
			if (present.length !== STORED_ONLY.length)
				return bad(
					`${name} is STORED but omits ${STORED_ONLY.filter((f) => r[f] === undefined).join(', ')}. A stored ref that cannot say where the bytes are, what they hash to, or which retention class they carry is a reference to nothing.`
				);
			if (r.reason !== undefined)
				return bad(`${name} is STORED and must not carry a reason — reason explains an ABSENCE.`);
		} else {
			if (!r.reason || r.reason.trim() === '')
				return bad(
					`${name} is PENDING_CONTENT_PLANE and must state why. PER-9 permits a DISCLOSED absence and forbids a silent one: "record-plane omission is not legal".`
				);
			if (present.length > 0)
				return bad(
					`${name} is PENDING_CONTENT_PLANE but carries ${present.join(', ')} — a ref cannot both disclaim its bytes and describe them.`
				);
		}
	}

	// ⛔ THE ONE COMBINATION REG-D-056 DOES NOT PERMIT.
	const raw = (p as unknown as Record<string, Ref>).rawOutputBeforeCoercionRef!;
	const reasoning = (p as unknown as Record<string, Ref>).volunteeredReasoningRef!;
	if (raw.status === 'STORED' && reasoning.status === 'STORED')
		return bad(
			'rawOutputBeforeCoercionRef may not be STORED while volunteeredReasoningRef is also STORED. A ' +
				'reasoning span was separated out, so the whole blob demonstrably contains reasoning, and storing ' +
				'it whole would classify that reasoning as participating — permanent under PER-8, when PER-12 ' +
				'requires it purgeable at expiry. Guide §9.7: separate it at retention. Store the spans, not the ' +
				'blob. (REG-D-056 permits the spans; it does not lift this.)'
		);

	// ── E-3 IDENTITY FACTS. Per-fact, so "the provider reported nothing" stays distinguishable from
	//    "nobody looked" — the distinction an optional string cannot carry.
	for (const name of factFields(p)) {
		const f = (p as unknown as Record<string, Fact>)[name]!;
		const reported = f.availability === 'REPORTED';
		if (reported && (!f.value || f.value.trim() === ''))
			return bad(`${name} is REPORTED and must carry a non-empty value.`);
		if (!reported && f.value !== undefined)
			return bad(`${name} is ${f.availability} and must not carry a value.`);
		if (!reported && (!f.rationale || f.rationale.trim() === ''))
			return bad(`${name} is ${f.availability} and must say why, or the absence is unexplained.`);
		if (reported && f.rationale !== undefined)
			return bad(`${name} is REPORTED and must not carry a rationale.`);
		if (reported && f.evidence === 'NONE')
			return bad(`${name} is REPORTED but claims evidence NONE — a reported value came from somewhere.`);
	}

	// ── PER-11 TIME. Both are occurrence-time facts the drain cannot reconstruct: `makeEvent` stamps its own
	//    times when the record is written, up to two round-trips later, so latency is otherwise unrecoverable
	//    and a timeout is permanently indistinguishable from a bad answer.
	if (Date.parse(p.respondedAt) < Date.parse(p.requestedAt))
		return bad(`respondedAt (${p.respondedAt}) precedes requestedAt (${p.requestedAt}).`);

	const { exchangeId, ...fields } = p;
	const state: Record<string, unknown> = {
		...newEnvelope(command, MODEL_EXCHANGE, exchangeId, {
			// Born terminal. There is no second status because there is no second command.
			lifecycleStatus: 'RECORDED',
			// The try is ABOUT its subject and FOLLOWS its predecessor; both reach traceability through the
			// envelope rather than a bespoke projection.
			sourceObjectIds: [p.subjectObjectId, ...(p.predecessorExchangeId ? [p.predecessorExchangeId] : [])]
		}),
		...fields
	};

	return createObject(ctx, command, {
		objectType: MODEL_EXCHANGE,
		aggregateId: exchangeId,
		state,
		eventType: 'ModelExchangeRecorded',
		// ⭑ THE FULL FIELD SET, DELIBERATELY. PER-2: "authoritative history remains reconstructable" and
		// "materialized current state is a cache of this history, not a second authority." A partial event
		// payload would make the state row the authority, which is the inversion PER-2 names.
		eventPayload: { exchangeId, ...fields }
	});
};
