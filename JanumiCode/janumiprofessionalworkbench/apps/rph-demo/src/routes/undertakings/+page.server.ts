// Undertaking Portfolio (Undertaking context) — active Undertakings, each showing its PWA-version binding, plus the
// authoring surface to instantiate a NEW Undertaking from a PUBLISHED PWA. Creating an Undertaking first establishes
// and approves its originating Intent (PWU-002 requires an existing intent before any PWU can be proposed), then
// instantiates the Undertaking with the PWA version bound as a fixed literal (no auto-propagation — §7/§8).
import { fail } from '@sveltejs/kit';
import {
	getObject,
	listPwas,
	listPwus,
	listPwuTypes,
	listUndertakings
} from '@janumipwb/rph-engine';
import { planComposition } from '@janumipwb/rph-projections';
import type { PermittedChildRule, WorkRiskProfile } from '@janumipwb/rph-contracts';
import { parseRiskProfile } from '$lib/authoring/riskProfile';
import {
	dispatch,
	dispatchBatch,
	getEngine,
	mintUiId,
	registerUndertakingIntent,
	type UiCommandInput
} from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const engine = getEngine();
	const undertakings = listUndertakings(engine).map((u) => {
		const pwa = getObject(engine, String(u.state.pwaId as string));
		return {
			id: u.id,
			name: String((u.state.name ?? u.id) as string),
			objective: String((u.state.objective ?? '') as string),
			intendedOutputProduct: String((u.state.intendedOutputProduct ?? '') as string),
			status: String((u.state.status ?? '') as string),
			pwaId: String((u.state.pwaId ?? '') as string),
			pwaName: String((pwa?.name ?? u.state.pwaId ?? '') as string),
			pwaVersion: String((u.state.pwaVersion ?? '') as string),
			pwuCount: listPwus(engine, u.id).length
		};
	});
	// A new Undertaking can only be instantiated from a PUBLISHED PWA (immutable, versioned).
	const pwaOptions = listPwas(engine)
		.filter((p) => p.state.publicationStatus === 'PUBLISHED')
		.map((p) => ({
			id: p.id,
			name: String((p.state.name ?? p.id) as string),
			version: String((p.state.version ?? '') as string)
		}));
	return { undertakings, pwaOptions };
};

/** Dispatch and return an error message on rejection (DUPLICATE is fine), or null on success. */
function drive(
	commandType: string,
	aggType: string,
	aggId: string,
	payload: unknown
): string | null {
	const r = dispatch(commandType, aggType, aggId, payload);
	return r.status === 'ACCEPTED' || r.status === 'DUPLICATE'
		? null
		: (r.error?.message ?? r.status);
}

export const actions: Actions = {
	create: async ({ request }) => {
		const engine = getEngine();
		const form = await request.formData();
		const name = String((form.get('name') ?? '') as string).trim();
		const objective = String((form.get('objective') ?? '') as string).trim();
		const product = String((form.get('product') ?? '') as string).trim();
		const pwaId = String((form.get('pwaId') ?? '') as string).trim();
		if (!name || !pwaId) return fail(400, { error: 'A name and a published PWA are required.' });
		// DR-002 W-4 — the risk judgement, refused when absent rather than defaulted. Read BEFORE anything is
		// dispatched: the Intent lifecycle below commits five commands, and discovering the missing judgement
		// afterwards would leave an approved Intent behind for an Undertaking that was never created.
		const risk = parseRiskProfile((field) => form.get(field) as string | null);
		if (!risk.ok) return fail(400, { error: risk.error });
		const pwa = getObject(engine, pwaId);
		if (pwa?.publicationStatus !== 'PUBLISHED')
			return fail(400, { error: 'Select a published PWA.' });
		const pwaVersion = String((pwa.version ?? '') as string);
		const obj = objective || `Deliver ${name}`;

		// 1. Establish + approve the originating Intent. Each step short-circuits on the first rejection (?? chain).
		const intentId = mintUiId('int');
		const di = (ct: string, pl: unknown): string | null => drive(ct, 'INTENT', intentId, pl);
		const intentErr =
			di('CaptureIntent', {
				intentId,
				originatingExpression: obj,
				ontologyId: pwaId,
				ontologyVersion: pwaVersion
			}) ??
			di('BeginIntentDiscovery', {}) ??
			di('ProvisionIntent', { ambiguityIds: [] }) ??
			di('FormalizeIntent', {
				formalizedObjective: obj,
				desiredOutcomes: [{ description: product || obj }],
				successConditions: [{ statement: `${name} achieves its objective` }],
				nonGoals: [],
				ambiguityIds: [],
				constraintIds: [],
				stakeholderIds: []
			}) ??
			di('ApproveIntent', {
				decisionId: mintUiId('dec'),
				approvedSemanticVersion: 1,
				approvalScope: 'full'
			});
		if (intentErr) return fail(400, { error: `Intent lifecycle failed: ${intentErr}` });

		// 2. Instantiate the Undertaking, bound to the PWA version as a fixed literal.
		const undertakingId = mintUiId('und');
		const err = drive('CreateUndertaking', 'UNDERTAKING', undertakingId, {
			undertakingId,
			name,
			description: obj,
			pwaId,
			pwaVersion,
			instantiationProfile: 'Standard',
			objective: obj,
			intendedOutputProduct: product || name
		});
		if (err) return fail(400, { error: `CreateUndertaking failed: ${err}` });
		registerUndertakingIntent(undertakingId, intentId);

		// 3. Instantiate the bound PWA's composition tree (DR-002 W-3).
		const instantiationError = instantiateComposition(
			undertakingId,
			intentId,
			pwaId,
			pwaVersion,
			risk.profile
		);
		if (instantiationError) return fail(400, { error: instantiationError });
		return { created: undertakingId };
	}
};

/**
 * Realize the bound PWA's composition tree as PWU Instances, atomically.
 *
 * ── WHY THE ORDER IS PWUs FIRST AND THE CONTRACT SECOND ─────────────────────────────────────────────────────
 *
 * `ProposeDecomposition` does NOT create children. It creates ONE `DECOMPOSITION_CONTRACT` over
 * `childWorkUnitIds` that must ALREADY EXIST — it even refuses unless the parent is already stored. So the
 * decomposition is a RECORD of a structure, not the act of building one. The children are built by `ProposePwu`,
 * each carrying its own `parentWorkUnitId`, and the contract is written afterwards over the ids that resulted.
 * DR-002 W-3 originally said the opposite; the correction is recorded in that roadmap.
 *
 * ── WHY ONE BATCH ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * A partially-instantiated architecture is worse than an un-instantiated one: it looks like a professional's
 * decomposition and is actually the residue of a failure. A PWA can publish today with a permitted child naming a
 * type that does not exist, so a mid-tree refusal is reachable, not hypothetical. `dispatchBatch` rolls the whole
 * thing back — the same envelope `runSteps` was moved onto when it had this defect.
 */
function instantiateComposition(
	undertakingId: string,
	intentId: string,
	pwaId: string,
	pwaVersion: string,
	riskProfile: WorkRiskProfile
): string | null {
	const engine = getEngine();
	// Scope to the BOUND version: a PWU_TYPE binds to a versioned PWA (RPH-CON-009), so a republished PWA has two
	// versions' types under one pwaId, and instantiating across both would build a tree the Undertaking never bound.
	const types = listPwuTypes(engine, pwaId).filter(
		(t) => String((t.state.pwaVersion ?? '') as string) === pwaVersion
	);
	const root = types.find((t) => t.state.isRoot === true);
	if (!root) return 'The bound PWA declares no root PWU Type, so there is nothing to instantiate.';

	const plan = planComposition(
		types.map((t) => ({
			id: t.id,
			isRoot: t.state.isRoot === true,
			permittedChildTypeIds: Array.isArray(t.state.permittedChildTypeIds)
				? (t.state.permittedChildTypeIds as string[])
				: [],
			permittedChildren: Array.isArray(t.state.permittedChildren)
				? (t.state.permittedChildren as PermittedChildRule[])
				: undefined
		})),
		root.id
	);
	// REFUSE rather than build a smaller tree than the architecture declares. `definePwuType` never checks that
	// `permittedChildTypeIds` resolve, so a PWA in this state publishes cleanly; instantiating it silently would
	// hand a professional a decomposition that is missing mandatory work and says nothing about it.
	if (plan.unresolved.length > 0) {
		const [first] = plan.unresolved;
		return `The bound PWA declares a permitted child type that does not resolve (${first!.parentTypeId} → ${first!.typeId}), so its architecture cannot be instantiated.`;
	}

	const typeById = new Map(types.map((t) => [t.id, t]));
	const pwuIdByKey = new Map(plan.instances.map((i) => [i.key, mintUiId('pwu')]));
	// Typed explicitly: inferring the element type from the first `map` narrows it to the ProposePwu payload
	// shape, and the decomposition commands below then fail to push.
	const commands: UiCommandInput[] = plan.instances.map((instance) => {
		const type = typeById.get(instance.typeId)!;
		const title = String((type.state.name ?? instance.typeId) as string);
		const pwuId = pwuIdByKey.get(instance.key)!;
		return {
			commandType: 'ProposePwu',
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: pwuId,
			payload: {
				pwuId,
				pwuKind: String((type.state.pwuKind ?? 'PWU') as string),
				title,
				description: String((type.state.purpose ?? title) as string),
				intentId,
				undertakingId,
				isLocalExtension: false,
				pwuTypeId: instance.typeId,
				...(instance.parentKey === undefined
					? {}
					: { parentWorkUnitId: pwuIdByKey.get(instance.parentKey)! }),
				// DOC-002 §9.1 permits "not yet known" for an unsettled boundary, and requires an in-scope
				// statement and an expected output before `MarkPwuReady` will pass. These are placeholders a
				// professional replaces — declared as such, not presented as a judgement.
				boundaries: {
					inScope: [`${title} for this Undertaking`],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
				assurancePolicyIds: Array.isArray(type.state.requiredAssurancePolicyIds)
					? (type.state.requiredAssurancePolicyIds as string[])
					: [],
				// THE PROFESSIONAL'S JUDGEMENT, not a constant (DR-002 W-4 closing finding F-D). Every PWU this
				// architecture instantiates carries the risk declared for the Undertaking, because they are all
				// the same body of work; a per-PWU judgement is a real refinement and belongs to whoever shapes
				// each PWU, not to a form that has never seen them.
				riskProfile
			}
		};
	});

	for (const decomposition of plan.decompositions) {
		const parentPwuId = pwuIdByKey.get(decomposition.parentKey)!;
		const contractId = mintUiId('dcp');
		commands.push(
			{
				commandType: 'ProposeDecomposition',
				targetAggregateType: 'DECOMPOSITION_CONTRACT',
				targetAggregateId: contractId,
				payload: {
					parentWorkUnitId: parentPwuId,
					childWorkUnitIds: decomposition.childKeys.map((k) => pwuIdByKey.get(k)!),
					rationale:
						'Instantiated from the bound Professional Work Architecture: every mandatory permitted child of this type.'
				}
			},
			{
				commandType: 'ValidateDecomposition',
				targetAggregateType: 'DECOMPOSITION_CONTRACT',
				targetAggregateId: contractId,
				// VALID, AND THE CHECK BEHIND IT IS CURRENTLY VACUOUS — say so rather than let the disposition imply
				// more than it establishes. The conservation guard reads the PARENT's obligationIds/constraintIds, and
				// every surface path sets both to `[]`, so nothing is allocated and nothing can fail to be allocated.
				// It becomes a real check when W-4 gives obligations an authoring moment.
				payload: { disposition: 'VALID' }
			}
		);
	}

	const batch = dispatchBatch(commands);
	if (batch.ok) return null;
	const at = batch.failedIndex ?? batch.results.length - 1;
	const failed = batch.results[at];
	return `Instantiating the Work Architecture failed at ${commands[at]?.commandType ?? 'an unknown command'}: ${failed?.error?.message ?? failed?.status ?? 'REJECTED'} — no part of it was applied.`;
}
