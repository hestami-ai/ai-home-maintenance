// ⭐⭐ `JAN-EXEC` Phase 8 (`REG-D-112` (c); the review of E4, findings 2 and 4) — THE PUBLISHED PWA, RE-CREATED FROM ITS
// RECORDING BEFORE THE UNDERTAKING, AND HELD TO THE RECORDING BEFORE THE FIRST CALL.
//
// ⛔ `REG-D-112` (c): THE REPLAY COVERS THE EXECUTION HALF FROM THE PUBLISHED PWA; THE AUTHORING TURN IS NOT REPLAYED. Half B
// authors its PWA live (Pi, with the authoring tools, its own calls recorded nowhere), so a replay cannot type the PWA the
// way half A's lane does, and must not author it: it re-creates the PUBLISHED result — `RecordedPwa`, which the recorder
// took off the final archive (`recordedPwaOf`) — through the engine's own commands, then the Undertaking runs on it.
// ⭑ IN ORDER:
//   1. each policy the PWA's types name is the host's, and its content hashes to the recording's (`policyContentSha256`):
//      a policy is not the PWA's to create (`seedPolicyLibrary` seeds it), so a host whose policy differs or is absent is
//      refused BY NAME — the policies decide what a review is asked, and a replay under another one would go stale later
//      for a reason this names now;
//   2. `CreatePwa`, each `DefinePwuType` (ids as recorded, so their links hold), `SubmitPwaForReview`, `ValidatePwa` and
//      `PublishPwa` with the recorded root — each refused command refuses the replay, naming it;
//   3. ⭐ the published PWA, digested, must be the recording's `pwaContentDigest` (`ReplayRun.checkPublishedPwa`) — the
//      field nothing read before (finding 4). Until it has passed, the replay serves no executor try.
// ⛔ NO FLOOR RUNS HERE, AND NO AGENT: the commands are the engine's, so nothing reaches `runPwaFloor` or an authoring
// agent — the recording holds no review of the PWA for either to ask (`recordsAsReviewerCall`).
// ⛔ EVERY REFUSAL POISONS THE REPLAY (`ReplayRun.stale`), so no later call of any arm answers from a recording whose PWA
// this host could not stand up.
import { policyContentSha256, type PwaObjectRow } from './recording.js';
import type { ReplayRun } from './replay-run.js';

/** What re-creating a PWA needs of the host: its command dispatch, and its rows of one object type. */
export interface PwaHost {
	dispatch(
		commandType: string,
		aggregateType: string,
		aggregateId: string,
		payload: Readonly<Record<string, unknown>>
	): { readonly status: string; readonly error?: { readonly message?: string } };
	/** The store's objects of one type (`listByType`), each its id and state. */
	rowsOf(
		objectType: string
	): readonly { readonly id: string; readonly state: Readonly<Record<string, unknown>> }[];
}

const PWA = 'PROFESSIONAL_WORK_ARCHITECTURE';

/**
 * ⭐ RE-CREATE THE RECORDING'S PUBLISHED PWA ON `host`, AND HOLD IT TO THE RECORDING — returns its id. ⛔ Throws the
 * replay's refusal (`ReplayRefusal`, the replay poisoned) when a policy is not the recorded one, a command is refused, or
 * the published PWA does not digest to the recording's.
 */
export function recreateRecordedPwa(run: ReplayRun, host: PwaHost): string {
	const pwa = run.recording.manifest.pwa;
	const policies = host.rowsOf('ASSURANCE_POLICY');
	for (const recorded of pwa.policies) {
		const held = policies.find((p) => p.id === recorded.policyId);
		if (held === undefined)
			throw run.stale(
				`the published PWA names the policy ${recorded.policyId}, which this host does not hold: a replay re-creates ` +
					'the PWA, never the host’s policy library (REG-D-112 (c)).'
			);
		const actual = policyContentSha256(held.state);
		if (actual !== recorded.contentSha256)
			throw run.stale(
				`the published PWA's policy ${recorded.policyId} hashes to ${actual} on this host, and the recording's to ` +
					`${recorded.contentSha256}: its reviews would be asked under another policy than the recorded ones were.`
			);
	}
	const commands: readonly (readonly [
		string,
		string,
		string,
		Readonly<Record<string, unknown>>
	])[] = [
		[
			'CreatePwa',
			PWA,
			pwa.id,
			{
				pwaId: pwa.id,
				name: pwa.name,
				description: pwa.description,
				domain: pwa.domain,
				version: pwa.version
			}
		],
		...pwa.types.map(
			(t) =>
				[
					'DefinePwuType',
					'PWU_TYPE',
					t.id,
					{ pwuTypeId: t.id, pwaId: pwa.id, ...t.declared }
				] as const
		),
		['SubmitPwaForReview', PWA, pwa.id, {}],
		['ValidatePwa', PWA, pwa.id, {}],
		['PublishPwa', PWA, pwa.id, { rootPwuTypeId: pwa.rootTypeId }]
	];
	for (const [commandType, aggregateType, aggregateId, payload] of commands) {
		const result = host.dispatch(commandType, aggregateType, aggregateId, payload);
		if (result.status !== 'ACCEPTED')
			throw run.stale(
				`the recorded PWA could not be re-created: ${commandType} on ${aggregateId} was ${result.status}` +
					`${result.error?.message ? ` — ${result.error.message}` : ''}.`
			);
	}
	const rows: PwaObjectRow[] = [PWA, 'PWU_TYPE'].flatMap((objectType) =>
		host.rowsOf(objectType).map((r) => ({ id: r.id, objectType, state: r.state }))
	);
	run.checkPublishedPwa(rows);
	return pwa.id;
}
