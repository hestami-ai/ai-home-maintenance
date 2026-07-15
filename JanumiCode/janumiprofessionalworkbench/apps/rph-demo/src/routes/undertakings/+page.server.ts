// Undertaking Portfolio (Undertaking context) — active Undertakings, each showing its PWA-version binding, plus the
// authoring surface to instantiate a NEW Undertaking from a PUBLISHED PWA. Creating an Undertaking first establishes
// and approves its originating Intent (PWU-002 requires an existing intent before any PWU can be proposed), then
// instantiates the Undertaking with the PWA version bound as a fixed literal (no auto-propagation — §7/§8).
import { fail } from '@sveltejs/kit';
import { getObject, listPwas, listPwus, listUndertakings } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId, registerUndertakingIntent } from '$lib/server/workbench';
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
		return { created: undertakingId };
	}
};
