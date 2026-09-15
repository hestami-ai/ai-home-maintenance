// MXR-05 — turn the exchange records a floor run produced into durable MODEL_EXCHANGE objects.
//
// ── WHY THIS IS A SEPARATE MODULE AT THE ASYNC LAYER ─────────────────────────────────────────────────────────
// `CommandHandler` is SYNCHRONOUS and `ArtifactStore` is async, so the bytes cannot be stored from inside a
// handler. `REG-F-341` filed that as an architectural blocker and `REG-F-342` corrected it: it is a PLACEMENT
// constraint, not a blocker. The bytes are stored at the async layer (during the try, by `captureTry`) and the
// record is then dispatched as a SYNCHRONOUS command carrying only the resulting reference — plain data. This
// is the placement `REG-F-328` recorded: *"the consumer belongs one layer out, where the engine is."*
//
// ── ⭑ AND IT DISPATCHES ON THE CANONICAL HANDLE, NOT THE CANDIDATE ONE ───────────────────────────────────────
// A `MODEL_EXCHANGE` records an act that HAPPENED. It is not candidate state, so it must not live or die with
// the authoring fork: a try that was made, cost money and produced a bad answer is exactly the try PER-9 wants
// recorded, and discarding the turn must not erase it. That property is why the record is its own aggregate —
// neither of the rejected designs could deliver it (`REG-D-055`).
import { OmittedRegionSchema, type RecordModelExchangePayload } from '@janumipwb/rph-contracts';

import type {
	ContentRef,
	ExchangeRecord,
	ExchangeRole,
	ResolvedModelIdentity,
	TruncationState
} from '../agent/exchange-record.js';

/** What the RUN knows and a single try cannot: which plane, whose policy, and about what. */
export interface ExchangeRunContext {
	readonly runToken: string;
	readonly plane: 'WORK' | 'ASSURANCE' | 'GOVERNANCE' | 'BASELINE' | 'EXECUTION' | 'AUTHORING';
	readonly invokerId: string;
	readonly assurancePolicyId?: string;
	readonly subjectObjectId: string;
	/**
	 * ⭐ THE CONTRACT'S OWN TYPE, NOT `string`. It was `string`, and the widening was invisible because the
	 * mapper below ended in `as RecordModelExchangePayload` — so the one cast that made a `string` assignable
	 * ALSO made a newly REQUIRED payload field assignable by absence. `R11` added two required fields and
	 * `check-types` stayed green; that is what a trailing cast on a return value buys, and it is why this is
	 * typed from the payload rather than beside it.
	 */
	readonly subjectObjectType: RecordModelExchangePayload['subjectObjectType'];
	readonly subjectSemanticVersion: number;
	/** Mints the `mex_…` aggregate id for each try. */
	readonly newId: (prefix: string) => string;
}

const ROLE: Record<ExchangeRole, 'INITIAL' | 'RETRY' | 'REFORMAT' | 'REPAIR'> = {
	initial: 'INITIAL',
	retry: 'RETRY',
	reformat: 'REFORMAT',
	repair: 'REPAIR'
};

const TRUNCATION: Record<TruncationState, 'NONE_DECLARED' | 'DECLARED' | 'DETECTED' | 'UNKNOWN'> = {
	'none-declared': 'NONE_DECLARED',
	declared: 'DECLARED',
	detected: 'DETECTED',
	unknown: 'UNKNOWN'
};

const DISPOSITION = {
	accepted: 'ACCEPTED',
	rejected: 'REJECTED',
	quarantined: 'QUARANTINED',
	'repair-requested': 'REPAIR_REQUESTED'
} as const;

/**
 * The closed role vocabulary an omitted region may claim — DERIVED FROM THE CONTRACT, never re-listed.
 *
 * ⚠ THE FALLBACK IS `OTHER` AND IT IS NOT A CONVENIENCE. The app-local shape types `role` as a free string,
 * the contract does not, and inventing a member to fit an unrecognised value would put an untyped
 * discriminator inside a record whose whole warrant is typed relationships. `OTHER` says "a region was
 * omitted and its role is not one we name", which is true; a guessed member would not be.
 *
 * ⭐ IT WAS A HAND-WRITTEN LIST OF EIGHT STRINGS, AND THAT WAS A LATENT DRIFT. A ninth member added to the
 * vocabulary would have been emitted by the generator, accepted by the contract, produced by a future splitter
 * — and silently downgraded to `OTHER` right here, because this copy of the list would not have grown with it.
 * Reading the members off `OmittedRegionSchema` makes the two the same list. ⛔ `find` rather than `has`,
 * deliberately: it NARROWS, so the mapping needs no cast, and the cast is what hid `R11`'s required fields.
 */
function regionRole(role: string): RecordModelExchangePayload['omittedRegions'][number]['role'] {
	return OmittedRegionSchema.shape.role.options.find((known) => known === role) ?? 'OTHER';
}


function contentRef(ref: ContentRef) {
	return ref.status === 'STORED'
		? {
				status: 'STORED' as const,
				storageProvider: ref.storageProvider ?? '',
				storageKey: ref.storageKey ?? '',
				contentHash: ref.contentHash ?? '',
				byteSize: ref.byteSize ?? 0,
				purgeability: ref.purgeability ?? ('RETAINED_BY_PARTICIPATION' as const),
				contentDurability: ref.contentDurability ?? ('PROCESS_LOCAL' as const)
			}
		: {
				status: 'PENDING_CONTENT_PLANE' as const,
				reason: ref.reason ?? 'No reason was recorded, which is itself a defect — see PER-9.'
			};
}

/**
 * E-3, split into three facts.
 *
 * ⭑ THE VERSION ARM IS ALWAYS UNREPORTED, AND THAT IS A MEASUREMENT RATHER THAN A PLACEHOLDER. Every backing
 * tool this host drives returns a model LABEL and none returns a version: `agy --print` prints nothing on
 * stdout, Pi's JSON stream carries `model: "gpt-5.4-mini"`, and Devin's ATIF export carries
 * `generation_model: "glm-5-2"`. Saying `UNREPORTED` with that rationale is the disclosed absence `PER-9`
 * permits; writing a label into the version field would be the substitution it forbids.
 *
 * ⚠ THE PROVIDER AND MODEL ARMS ARE A DIFFERENT MATTER, and conflating them is what kept `PROVIDER_REPORTED`
 * dead. Whether a model VERSION exists is a fact about the provider's API; whether the tool CONFIRMED the
 * model it ran is a fact about the tool. agy confirms nothing, so its grade is `HOST_CONFIGURED`. Pi and Devin
 * both echo the resolved model back, so theirs is `PROVIDER_REPORTED` — a stronger grade on the same field,
 * and the caller supplies it because only the caller knows which tool answered.
 */
function identityFacts(id: ResolvedModelIdentity) {
	if (id.kind === 'resolved')
		return {
			resolvedProvider: {
				availability: 'REPORTED' as const,
				// ⭑ THE GRADE COMES FROM THE TOOL, NOT FROM THIS FUNCTION. It was hardcoded `HOST_CONFIGURED`
				// because agy is the only tool that ever reached here and agy confirms nothing about itself —
				// so the ratified `PROVIDER_REPORTED` member had ZERO producers since the day it was authored.
				// Pi and Devin both echo back which model answered, which is a stronger fact and now records as one.
				evidence: id.evidence ?? ('HOST_CONFIGURED' as const),
				value: id.providerId
			},
			resolvedModel: {
				availability: 'REPORTED' as const,
				evidence: id.evidence ?? ('HOST_CONFIGURED' as const),
				value: id.modelId
			},
			resolvedModelVersion: {
				availability: 'UNREPORTED' as const,
				evidence: 'NONE' as const,
				// ⚠ THE RATIONALE IS NOW TOOL-NEUTRAL, AND THAT IS A CORRECTION RATHER THAN A TIDY-UP. It read
				// "agy --print reports no model version", which is FALSE about Pi and Devin — a record that
				// explains an absence by naming a tool that was not used states something untrue.
				// ⭑ The absence itself still holds for all three: they report a model LABEL (`gpt-5.4-mini`,
				// `glm-5-2`), and a label is not a version. Writing one into the version field is the
				// substitution `PER-9` forbids, so the arm stays UNREPORTED.
				rationale:
					'No backing tool this host drives reports a resolved model VERSION: each returns a model label, ' +
					'and a label is not a version.'
			}
		};
	const arm = {
		availability: id.kind === 'unreported' ? ('UNREPORTED' as const) : ('UNRESOLVABLE' as const),
		evidence: 'NONE' as const,
		rationale: id.rationale
	};
	return { resolvedProvider: arm, resolvedModel: arm, resolvedModelVersion: arm };
}

/**
 * One exchange record becomes one `RecordModelExchange` payload.
 *
 * `mintedFor` maps the run-local try label (`exch-1`) onto the aggregate id already minted for it, so a
 * repair's predecessor link points at the DURABLE record rather than a label that restarts every floor run —
 * the collision `REG-D-055` records (`tryCounter` restarts per validator instance, and two floor runs per turn
 * both emitted `exch-1`).
 */
export function toRecordModelExchange(
	rec: ExchangeRecord,
	ctx: ExchangeRunContext,
	mintedFor: ReadonlyMap<string, string>
): RecordModelExchangePayload {
	const exchangeId = mintedFor.get(rec.exchangeId);
	if (!exchangeId)
		throw new Error(
			`exchange-recorder: no aggregate id was minted for try '${rec.exchangeId}'. Mint ids for the whole drain BEFORE mapping, or a repair's predecessor link cannot be resolved.`
		);

	const predecessor = rec.predecessorExchangeId
		? mintedFor.get(rec.predecessorExchangeId)
		: undefined;
	if (rec.predecessorExchangeId && !predecessor)
		throw new Error(
			`exchange-recorder: try '${rec.exchangeId}' names predecessor '${rec.predecessorExchangeId}', which was not minted in this drain. Recording it with a dangling link would put a hole in the chain PER-9 requires.`
		);

	return {
		exchangeId,
		exchangeRole: ROLE[rec.exchangeRole],
		...(predecessor ? { predecessorExchangeId: predecessor } : {}),
		attemptOrdinal: rec.attemptOrdinal,
		runToken: ctx.runToken,
		plane: ctx.plane,
		invokerId: ctx.invokerId,
		...(ctx.assurancePolicyId ? { assurancePolicyId: ctx.assurancePolicyId } : {}),
		subjectObjectId: ctx.subjectObjectId,
		subjectObjectType: ctx.subjectObjectType,
		subjectSemanticVersion: ctx.subjectSemanticVersion,
		...identityFacts(rec.resolvedModelIdentity),
		materializedInputRef: contentRef(rec.materializedInputRef),
		// ⭑ E-2 NOW PASSES THROUGH AS CAPTURED. REG-D-056 permits retention; captureTry performs the §9.7 split
		// and decides per blob whether the whole output was storable, so the mapping must not second-guess it.
		// The handler independently refuses the one unlawful combination (a stored blob beside a stored
		// reasoning span), so a bug here is caught rather than committed.
		rawOutputBeforeCoercionRef: contentRef(rec.rawOutputBeforeCoercionRef),
		answerSpanRef: contentRef(rec.answerSpanRef),
		volunteeredReasoningRef: contentRef(rec.volunteeredReasoningRef),
		inputRedactionManifestRef: contentRef(rec.inputRedactionManifestRef),
		// No redaction exists anywhere in this codebase (finding #60). Saying NOT_IMPLEMENTED is the disclosed
		// absence; NONE_APPLIED would claim a decision that was never made.
		redactionState: 'NOT_IMPLEMENTED',
		inputTruncation: TRUNCATION[rec.truncationState],
		// The app-local record carries ONE truncation state, so the same measurement answers both questions
		// until something distinguishes them. Recorded here rather than silently duplicated at the call site.
		outputTruncation: TRUNCATION[rec.truncationState],
		// ⚠ `byteSize` USED TO BE HARDCODED `0` HERE, because the app-local region carried no size and the
		// contract required one. It was harmless only because nothing ever produced a region — the first
		// producer would have silently recorded "0 bytes omitted" (`REG-F-345`). Both numbers are now real,
		// measured in UTF-8 bytes at the split, and passed through rather than invented.
		omittedRegions: rec.omittedRegions.map((r) => ({
			role: regionRole(r.role),
			reason: r.reason,
			byteSize: r.byteSize,
			byteOffset: r.byteOffset
		})),
		disposition: rec.disposition ? DISPOSITION[rec.disposition] : 'NO_RESPONSE',
		parseOutcome: rec.parseOutcome,
		...(rec.promptTemplateFingerprint
			? { promptTemplateFingerprint: rec.promptTemplateFingerprint }
			: {}),
		requestedAt: rec.requestedAt,
		respondedAt: rec.respondedAt,
		// ⭐ R11 — BOTH PASS THROUGH AS THE CAPTURE SET THEM. This mapper translates the app-local vocabulary
		// into the contract's; these two ARE the contract's shape already, so translating them would be
		// inventing a round trip for a value that never left.
		workProductDerivation: rec.workProductDerivation,
		observedToolCalls: rec.observedToolCalls
	};
	// ⛔⛔ THE TRAILING `as RecordModelExchangePayload` IS GONE, AND ITS REMOVAL IS HALF OF WHAT `R11` BOUGHT.
	//
	// The cast sat on the returned literal to paper over two genuine widenings — `subjectObjectType: string`
	// and `omittedRegions[].role: string`, both now fixed at their source above. ⚠ WHAT IT ALSO DID, silently,
	// was make a MISSING REQUIRED FIELD assignable: `R11` added two required fields to the payload and
	// `bun run check-types` passed across all 21 projects with this function emitting neither. The ledger's own
	// header names that mutation trap — *"adding a field to an exported type breaks callers"* — and a cast on
	// the return value is precisely what disarms it. The compiler is the guard here; a cast is a waiver of it.
}

/** Mint one aggregate id per try, before mapping, so predecessor links resolve within the drain. */
export function mintIdsFor(
	records: readonly ExchangeRecord[],
	newId: (prefix: string) => string
): Map<string, string> {
	const minted = new Map<string, string>();
	for (const r of records) minted.set(r.exchangeId, newId('mex'));
	return minted;
}

/**
 * Dispatch one `RecordModelExchange` per try, on the CANONICAL handle.
 *
 * ⛔ THE HANDLE IS AN ARGUMENT AND IT MUST NOT BE THE ONE THE FLOOR RAN ON. `runPwaFloor` is called with
 * `turn.engine` — the authoring fork's CANDIDATE engine — so dispatching there would make every exchange
 * record live or die with the turn. A try that was made, cost money and produced a bad answer is precisely
 * the try `PER-9` wants kept, and discarding the draft must not erase it. That property is the reason
 * `REG-D-055` made this record its own aggregate; routing it through the fork would silently give it back.
 *
 * Failures are collected rather than thrown: a retention fault must not fail an assurance run that already
 * reached its conclusion, and a partial record set with a stated shortfall is the disclosed absence `PER-9`
 * permits. The caller decides what to do with them.
 */
export function recordExchanges(
	dispatch: (payload: RecordModelExchangePayload, aggregateId: string) => { status: string },
	records: readonly ExchangeRecord[],
	ctx: ExchangeRunContext
): { recorded: number; failures: string[] } {
	const minted = mintIdsFor(records, ctx.newId);
	const failures: string[] = [];
	let recorded = 0;
	for (const rec of records) {
		try {
			const payload = toRecordModelExchange(rec, ctx, minted);
			const r = dispatch(payload, payload.exchangeId);
			if (r.status === 'ACCEPTED' || r.status === 'DUPLICATE') recorded += 1;
			else failures.push(`${rec.exchangeId}: dispatch returned ${r.status}`);
		} catch (e) {
			failures.push(`${rec.exchangeId}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	return { recorded, failures };
}
