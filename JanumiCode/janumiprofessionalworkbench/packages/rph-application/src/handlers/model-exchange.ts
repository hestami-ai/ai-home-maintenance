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
//
// ── ⛔ WHERE THIS HANDLER'S REFUSALS STOP, AND WHERE THE CONTRACT'S BEGIN (R11 REVIEW, W1–W3) ────────────────
// Every check below is RELATIONAL — a field against its discriminator, a count against another count. ⛔ NONE
// of them looks at a value's CONTENT, and R11's commit said one of them did: *"a minted name is drawn from a
// closed set the HOST authored and cannot carry model-chosen content."* An independent review DROVE a host
// absolute path, a credentials string, a NUL byte and a 200KB blob into `toolName` as `MINTED_BY_HOST` and all
// four were ACCEPTED, because what this handler checks is that the discriminator and the field AGREE.
//
// ⭐ THE CONTENT BOUNDS THEREFORE LIVE IN THE CONTRACT, NOT HERE — `rph-contracts/src/record-plane-bounds.ts`,
// reached through the generated `ObservedToolCallSchema` / `WorkProductDerivationSchema`. That is not tidiness:
// a check in this file governs ONE write path (the command payload), while a bound on the schema governs three
// — the command payload in `command-bus.ts`, the materialized object state in `kit.ts`, and the ratified event
// payload beside it. `B8`'s verdict in this same programme was that a convention with no call site is not a
// control; enforcing at the producer and calling it enforced at the boundary is the same error one layer up.
import { OBSERVED_TOOL_CALL_LIMIT, type RecordModelExchangePayload } from '@janumipwb/rph-contracts';

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

/**
 * ⭐⭐ R11 — THE DERIVATION'S OPTIONALS, DETERMINED BY ITS DISCRIMINATOR, OFF ONE TABLE.
 *
 * Two arms RETAIN a work product and carry an address; two do not and carry a reason instead. ⛔ The refusals
 * below are keyed on this ONE map rather than written out per arm, so a fifth member added to the vocabulary
 * cannot quietly acquire "anything goes": it would be absent from the map and refused BY NAME.
 */
const DERIVATION_ADDRESS = ['storageProvider', 'storageKey', 'contentHash', 'byteSize'] as const;
/**
 * ⭐⭐ `Record<Union, boolean>` IS EXHAUSTIVE, AND THAT IS THE GUARD — not a runtime arm.
 *
 * The first version of this carried a `Record<string, boolean>` plus a runtime refusal for a member it did not
 * classify. ⛔ That arm was UNREACHABLE: the payload is strict-parsed against `z.enum([...])` before the handler
 * sees it, so no unclassified member can arrive — and an unreachable refusal is a guard that cannot fail, which
 * this repository records as its own defect class. Keyed on the CONTRACT's union instead, a member added to the
 * vocabulary makes this object a COMPILE ERROR, and a defect the compiler makes unexpressible is guarded more
 * strongly than one a test catches.
 */
const DERIVATION_RETAINS: Record<
	RecordModelExchangePayload['workProductDerivation']['relation'],
	boolean
> = {
	ENVELOPE_FIELD: true,
	WHOLE_ANSWER_SPAN: true,
	NO_WORK_PRODUCT_EXPECTED: false,
	EXPECTED_BUT_UNRETAINED: false
};

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

	// ⛔ AND THE ONE `REG-D-057` REQUIRES, WHICH IS THE SAME SPLIT SEEN FROM THE OTHER SIDE.
	//
	// A separation is only lawful under Guide §9.7 if it is LOSSLESS. When the answer was cut out of the
	// retained reasoning, the record must say WHERE — otherwise the two stored objects reassemble in two
	// orders and the reply that actually arrived is unrecoverable. `REG-F-345` drove that: two replies
	// differing only in whether the model reasoned BEFORE or AFTER answering produced byte-identical records.
	//
	// ⭑ THIS IS FAIL-CLOSED BY CHOICE. The producer already declares the region; without this guard the
	// invariant would be a convention one refactor away from silence, and its failure is invisible — the
	// record still looks complete. Refusing here makes reversibility a property of the CONTRACT.
	const answer = (p as unknown as Record<string, Ref>).answerSpanRef!;
	const separated =
		answer.status === 'STORED' && reasoning.status === 'STORED' && raw.status !== 'STORED';
	if (separated) {
		const cut = p.omittedRegions.filter((r) => r.role === 'MODEL_ANSWER');
		if (cut.length !== 1)
			return bad(
				`a separated exchange must declare exactly one MODEL_ANSWER omitted region and this one declares ${cut.length}. The answer span was cut out of the retained reasoning, so PER-9's "declared truncation or omission" is owed for it — and without the region's byteOffset the retained halves cannot be put back in the order they arrived (REG-D-057).`
			);
		if (cut[0]!.byteSize <= 0)
			return bad(
				`the MODEL_ANSWER omitted region reports byteSize ${cut[0]!.byteSize}, but a span was separated out and stored, so its size is not zero. A fabricated size is worse than an absent one: it reads as a measurement.`
			);
	}

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

	// ── ⭐⭐ R11 (a) — THE DERIVATION. `relation` is the discriminator and every optional is determined by
	//    it, on exactly the standard the content refs above are held to. ⛔ The point of a TYPED field is that
	//    it can be REFUSED; a declaration nothing checks is the free-text fragment it replaced, with extra steps.
	const derivation = p.workProductDerivation;
	const retains = DERIVATION_RETAINS[derivation.relation];
	const address = derivation as unknown as Record<string, unknown>;
	const declared = DERIVATION_ADDRESS.filter((f) => address[f] !== undefined);
	if (retains) {
		if (declared.length !== DERIVATION_ADDRESS.length)
			return bad(
				`workProductDerivation is ${derivation.relation} but omits ${DERIVATION_ADDRESS.filter((f) => address[f] === undefined).join(', ')}. A work product was separated out of the answer span and retained, so the record must say WHERE — and the WHOLE address, not just the key: a reference that cannot be verified is a reference that cannot be challenged.`
			);
		if (derivation.reason !== undefined)
			return bad(
				`workProductDerivation is ${derivation.relation} and must not carry a reason — a reason explains an ABSENCE, and this arm declares a presence.`
			);
	} else {
		if (!derivation.reason || derivation.reason.trim() === '')
			return bad(
				`workProductDerivation is ${derivation.relation} and must state why. PER-9 permits a DISCLOSED absence and forbids a silent one, and the two absent arms are different facts: one says this try owed no work product at all, the other that it owed one and none was retained.`
			);
		if (declared.length > 0)
			return bad(
				`workProductDerivation is ${derivation.relation} but carries ${declared.join(', ')} — a derivation cannot both disclaim a retained work product and address one.`
			);
	}
	// ⛔ `sourceField` IS NARROWER THAN THE ADDRESS AND IS CHECKED SEPARATELY. Only ENVELOPE_FIELD has a field
	//    to name; WHOLE_ANSWER_SPAN retains a work product and has none, because the envelope was not honoured
	//    and the whole answer IS the product. A pseudo-name there is the fabricated value that arm exists to avoid.
	const named = derivation.sourceField !== undefined && derivation.sourceField.trim() !== '';
	if (derivation.relation === 'ENVELOPE_FIELD' && !named)
		return bad(
			`workProductDerivation is ENVELOPE_FIELD and must name the sourceField the work product was taken from. A derivation carrying an address but not what was taken out of the span cannot be re-performed by a reader.`
		);
	if (derivation.relation !== 'ENVELOPE_FIELD' && derivation.sourceField !== undefined)
		return bad(
			`workProductDerivation is ${derivation.relation} and must not name a sourceField — there is no envelope field to name, and inventing one asserts a structure the answer did not have.`
		);

	// ── ⭐⭐ R11 (b) — THE OBSERVED TOOL-CALL RECORD. Section 22.1 makes model output UNTRUSTED EXTERNAL
	//    INPUT, so the ADAPTER's observation is the fact and the model's word is not. The three members are three
	//    states of the INSTRUMENT, and this handler's job is to stop one being written while wearing another's
	//    evidence — an OBSERVED report naming no calls would read as a measurement of nothing.
	const tools = p.observedToolCalls;
	if (tools.observation === 'OBSERVED') {
		if (tools.reason !== undefined)
			return bad(
				`observedToolCalls is OBSERVED and must not carry a reason — a reason explains why there is nothing to report, and this arm reports something.`
			);
		if (!tools.calls || tools.calls.length === 0)
			return bad(
				`observedToolCalls is OBSERVED but names no calls. An OBSERVED report with an empty list is NONE_OBSERVED wearing the wrong member, and the two are different facts: one says a call was seen, the other that a watching adapter saw none.`
			);
		if (tools.recordedLimit === undefined || tools.observedCount === undefined)
			return bad(
				`observedToolCalls is OBSERVED and must declare observedCount and recordedLimit. The list is BOUNDED because an untrusted party decides how many calls to make, and a truncated list that does not say so reads exactly like a complete one.`
			);
		if (tools.calls.length > tools.recordedLimit)
			return bad(
				`observedToolCalls names ${tools.calls.length} calls but declares a recordedLimit of ${tools.recordedLimit}. The declared bound must be the one actually applied, or it describes a record other than this one.`
			);
		// ⛔ AND THE DECLARED BOUND MAY NOT EXCEED THE ONE THE CONTRACT ENFORCES (R11 REVIEW, W1). The check
		//    above compares the list against a number THE CALLER WROTE, so on its own it proves only internal
		//    consistency: 64 calls declaring a recordedLimit of 64 satisfied it, and the cap R11 announced was a
		//    producer guarantee wearing a contract's words. `calls` is now capped by the SCHEMA, which makes the
		//    list itself unable to exceed 32 — and this refusal closes the remaining half, where a short list
		//    declares a bound nothing ever applied. A reader uses `recordedLimit` to decide whether truncation
		//    happened; a declared bound larger than the enforced one tells them about a record that cannot exist.
		if (tools.recordedLimit > OBSERVED_TOOL_CALL_LIMIT)
			return bad(
				`observedToolCalls declares a recordedLimit of ${tools.recordedLimit}, above the ${OBSERVED_TOOL_CALL_LIMIT} this contract enforces on calls. A producer may apply a TIGHTER bound and say so; it may not declare a looser one, because the number a reader uses to judge whether the list was truncated would then describe a record this plane cannot hold.`
			);
		if (tools.observedCount < tools.calls.length)
			return bad(
				`observedToolCalls declares observedCount ${tools.observedCount} while naming ${tools.calls.length} calls. The count is the TOTAL observed, so it can only equal or exceed what was kept.`
			);
		for (const [index, call] of tools.calls.entries()) {
			if (call.ordinal !== index + 1)
				return bad(
					`observedToolCalls call at position ${index + 1} declares ordinal ${call.ordinal}. Ordinals are 1-based and in observation order; without that a BOUNDED list cannot say which calls it kept.`
				);
			// ⛔⛔ THE R11 RETENTION RULING'S *PROVENANCE* LIMB, AT THE BOUNDARY AND NOT ONLY AT THE PRODUCER.
			//    A tool NAME may be recorded only where the caller declares the HOST MINTED it; an unminted one
			//    is an arbitrary MODEL-CHOSEN string heading for a record that is PERMANENT under PER-8 (R10)
			//    and that no redaction can ever reach — PER-9 makes record-plane omission illegal, which is
			//    exactly why the CONTENT plane may hold such text and this plane may not.
			//
			// ⚠ THESE TWO CONJUNCTS CHECK THE DECLARATION, NOT THE NAME (R11 REVIEW, W2). `nameProvenance` is
			//    the CALLER's word and nothing here verifies it: the host's minted set is session-scoped, lives
			//    in the adapter, and cannot reach this boundary without either a kernel-to-app dependency or the
			//    caller declaring the set beside the name — self-consistency again. What bounds the VALUE is
			//    `RecordPlaneNameSchema` on the contract, one layer out, and it does so on every write path.
			//    ⭑ THE TWO ARE NOT REDUNDANT: a shape-legal name on a NOT_MINTED call passes the schema and is
			//    refused here, and an unnamed MINTED_BY_HOST call is invisible to a schema that only constrains
			//    a value that is present.
			if (call.nameProvenance === 'MINTED_BY_HOST' && (!call.toolName || call.toolName.trim() === ''))
				return bad(
					`observedToolCalls call ${call.ordinal} claims MINTED_BY_HOST but names no tool. The provenance is the whole warrant for recording a name at all.`
				);
			if (call.nameProvenance === 'NOT_MINTED' && call.toolName !== undefined)
				return bad(
					`observedToolCalls call ${call.ordinal} is NOT_MINTED and must not carry a toolName. An unminted name is an arbitrary model-chosen string, and this record is permanent and unredactable — the FACT that an unminted call was attempted is what is kept, never the model's spelling of it.`
				);
		}
	} else {
		if (!tools.reason || tools.reason.trim() === '')
			return bad(
				`observedToolCalls is ${tools.observation} and must state why. NONE_OBSERVED and NOT_OBSERVABLE are different facts — a measurement, against an absence of any instrument — and a reader deciding what this record is worth acts on the difference.`
			);
		const describes = (['calls', 'observedCount', 'recordedLimit'] as const).filter(
			(f) => tools[f] !== undefined
		);
		if (describes.length > 0)
			return bad(
				`observedToolCalls is ${tools.observation} but carries ${describes.join(', ')} — a report cannot both say it has no calls to name and then describe them.`
			);
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
