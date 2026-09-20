// JAN-NOANS `NA-06` — EVERY MEMBER OF THE EXCHANGE VOCABULARY IS EITHER DRIVEN OR DECLARED UNREACHABLE.
//
// ⛔ THE FINDING THIS EXISTS FOR IS NOT THAT A MEMBER WAS MISSING. `EMPTY_RESPONSE` has been in
// `ExchangeParseOutcomeSchema` since `JAN-MXR` shipped it, and `NO_RESPONSE` in the `MODEL_EXCHANGE`
// disposition enum. `REG-F-410` is that **nothing could reach them** — for months — while a live run recorded
// a provider refusal as an ACCEPTED try whose producer had answered badly. A ratified member with no producer
// is a promise the record cannot keep.
//
// ⭑ AND A TEST PER MEMBER WOULD BE THE SAME DEFECT ONE LEVEL UP. Hand-listing closes the members somebody
// remembered; it says nothing about the next one added. So the table below is keyed on the CONTRACT'S OWN
// UNION — `Record<Member, …>` — which makes a member added to the vocabulary a **compile error here**, not a
// silent gap discovered by the next live run. This is the idiom `model-exchange.ts` already argues for on the
// production side, applied to the test plane.
//
// ⚠ THE `unreachable` ARM IS AN ESCAPE HATCH AND IT IS NAMED AS ONE. A lazy author can close a new member by
// writing a sentence instead of a driver. That is a DISCLOSED absence rather than a silent one — it sits in
// this file where a reviewer reads it — but it is a hatch, and saying so here is better than having it found.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '@janumipwb/rph-application';
import { runModelInvocationStep } from '../execution/run-model-step.js';
import { oneShotSession } from '../execution/producer-session.js';

type Disposition = RecordModelExchangePayload['disposition'];
type ParseOutcome = RecordModelExchangePayload['parseOutcome']['outcome'];

/** A member is closed by a path that DRIVES it, or by a stated reason nothing in this repository produces it. */
type Coverage =
	| { readonly drive: () => Promise<RecordModelExchangePayload> }
	| { readonly unreachable: string };

const ACTIVE: PromptTemplate = {
	templateText: 'Assess {subject}.',
	templateVersion: 1,
	declaredPlaceholders: ['subject'],
	status: 'ACTIVE'
};

/** Drive one real execution step whose session behaves as `turn` says, and return the record it dispatched. */
async function stepRecording(
	turn: () => Promise<string>
): Promise<RecordModelExchangePayload> {
	const dispatched: RecordModelExchangePayload[] = [];
	let n = 0;
	await runModelInvocationStep({
		subject: { id: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X01', title: 'Route Assessment' },
		subjectSemanticVersion: 1,
		pwuTypeId: 'pwut_9',
		template: ACTIVE,
		session: oneShotSession(turn),
		store: createInMemoryArtifactStore(),
		tenantPrefix: 'tnt-test',
		dispatchExchange: (payload: RecordModelExchangePayload) => {
			dispatched.push(payload);
			return { status: 'ACCEPTED' };
		},
		newId: (prefix: string) => `${prefix}_${++n}`,
		now: () => '2026-09-20T10:00:00Z',
		modelId: 'test-model',
		providerId: 'test-provider',
		contextPolicy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
		binding: { kind: 'NONE' as const }
	});
	// ⛔ NOT `dispatched[0]` WITH A NON-NULL ASSERTION. A path that dispatched NOTHING is the failure mode this
	// whole suite is about — an absence read as a value — and it must announce itself here rather than throw a
	// TypeError three lines later.
	expect(dispatched, 'this path recorded no exchange at all').toHaveLength(1);
	return dispatched[0]!;
}

const ENVELOPE = JSON.stringify({
	workProduct: { finding: 'The route is viable.' },
	rationale: { rationale: 'The instruction asked for a finding and the work product states one.' }
});

const DISPOSITIONS: Record<Disposition, Coverage> = {
	ACCEPTED: { drive: () => stepRecording(async () => ENVELOPE) },
	NO_RESPONSE: { drive: () => stepRecording(async () => '') },
	REJECTED: {
		unreachable:
			'No caller in this repository disposes an execution try REJECTED any more. It was the `catch` arm ' +
			'until the JAN-NOANS sponsor ruling (2026-09-20) moved a THROWN call to `no-response`, on the ground ' +
			'that `rejected` asserts a producer fault the producer did not commit. The member stays in the ' +
			'contract because PER-2 makes persisted shapes permanent, and because a REPAIR loop may yet earn it.'
	},
	REPAIR_REQUESTED: {
		unreachable:
			'Produced on the ASSURANCE plane by `reasoning-review-validator`, which records a first try as ' +
			'`repair-requested` before its repair try. Reaching it needs a validator run rather than an ' +
			'execution step, and it is covered by that suite; no execution path produces it.'
	},
	QUARANTINED: {
		unreachable:
			'Nothing in this repository disposes a try QUARANTINED. `captureTry` accepts the member and no ' +
			'caller passes it. A DISCLOSED absence, not a passing test.'
	}
};

const PARSE_OUTCOMES: Record<ParseOutcome, Coverage> = {
	PARSED: { drive: () => stepRecording(async () => ENVELOPE) },
	EMPTY_RESPONSE: { drive: () => stepRecording(async () => '') },
	SCHEMA_COERCION_FAILED: { drive: () => stepRecording(async () => 'this is prose, not an envelope') },
	NOT_ATTEMPTED: {
		drive: () =>
			stepRecording(async () => {
				throw new Error('provider unreachable');
			})
	},
	JSON_EXTRACTION_FAILED: {
		unreachable:
			'Produced by the ASSURANCE plane’s `classifyParse` when no JSON object span can be located in a ' +
			'reviewer’s reply. The EXECUTION plane does not extract a span — `splitExecutionEnvelope` parses the ' +
			'whole answer — so no execution path produces it.'
	},
	JSON_PARSE_FAILED: {
		unreachable:
			'Also `classifyParse`’s, for a located span that fails `JSON.parse`. The execution plane reports a ' +
			'contract shortfall instead, because there the unparseable bytes are still the professional’s work.'
	}
};

describe('⭐ NA-06 — the exchange vocabulary has no member without a producer or a stated reason', () => {
	it('⛔ every DISPOSITION is driven by a real path, or declares why nothing produces it', async () => {
		for (const [member, coverage] of Object.entries(DISPOSITIONS) as [Disposition, Coverage][]) {
			if ('unreachable' in coverage) {
				// ⭑ THE REASON IS ASSERTED, NOT MERELY PRESENT. An empty string would close a member with nothing.
				expect(coverage.unreachable.length, `${member} declares no reason`).toBeGreaterThan(60);
				continue;
			}
			const rec = await coverage.drive();
			expect(rec.disposition, `${member} names a path that does not actually produce it`).toBe(member);
		}
	});

	it('⛔ every PARSE OUTCOME is driven by a real path, or declares why nothing produces it', async () => {
		for (const [member, coverage] of Object.entries(PARSE_OUTCOMES) as [ParseOutcome, Coverage][]) {
			if ('unreachable' in coverage) {
				expect(coverage.unreachable.length, `${member} declares no reason`).toBeGreaterThan(60);
				continue;
			}
			const rec = await coverage.drive();
			expect(rec.parseOutcome.outcome, `${member} names a path that does not produce it`).toBe(member);
		}
	});

	it('⭐ CONTROL — the two members REG-F-410 was about are DRIVEN, not declared unreachable', () => {
		// ⛔ WITHOUT THIS THE SUITE PASSES FOR A TABLE THAT CLOSED EVERYTHING WITH SENTENCES. That is the exact
		// shape of the hatch this file's header discloses, and the two members the whole programme exists for
		// are the ones that must never be closed that way.
		expect('drive' in DISPOSITIONS.NO_RESPONSE, 'NO_RESPONSE was closed with prose').toBe(true);
		expect('drive' in PARSE_OUTCOMES.EMPTY_RESPONSE, 'EMPTY_RESPONSE was closed with prose').toBe(true);
	});
});
