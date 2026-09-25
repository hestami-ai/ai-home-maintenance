import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
	test,
	acceptAgentCandidate,
	resetEngine,
	introspect,
	gotoHydrated,
	registerStipulation,
	type EngineSnapshot,
	type ObjectRow
} from './support/harness';

// The de minimis assurance floor (guide §8.4), driven by the DECLARED STAND-IN Reasoning-Review Validator
// (RPH_DEMO_MODE=test selects it — no network): the structural checker's real judgements, plus the remainder a test
// stipulates, recorded as NOT JUDGED (`JAN-CRITREAD` J1-2; `REG-D-071`). Proves the whole rebuilt loop over the real stack:
// an authoring turn RUNS the floor inside its isolated candidate. A satisfied exact candidate can be accepted and
// atomically records the floor with the graph; a rejected candidate remains preview-only and is safely discarded.
test.describe('Assurance floor (mock) — staged binding and guarded admission', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	async function createDraft(
		page: Page,
		request: APIRequestContext,
		name: string
	): Promise<string> {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill(name);
		await page.getByRole('button', { name: 'Create draft' }).click();
		await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
		return (await introspect(request)).pwas[0]!.id;
	}

	async function scaffold(
		request: APIRequestContext,
		pwaId: string,
		types: Record<string, unknown>[]
	): Promise<string> {
		const res = await request.post(`/pwa/${pwaId}/agent`, {
			data: { instruction: JSON.stringify({ plan: [{ tool: 'scaffold_graph', args: { types } }] }) }
		});
		expect(res.ok(), 'agent SSE endpoint responds').toBeTruthy();
		return await res.text();
	}

	/** The reasoning-review criterion rows of one assessment, as `[criterionId, result, stipulation or null]`, the LATEST
	 *  recording of each — Gate E's own fold — sorted by criterion. */
	const rowsOf = (
		events: ReadonlyArray<Record<string, unknown>>,
		assessmentId: string
	): [string, string, string | null][] => {
		const latest = new Map<string, [string, string, string | null]>();
		for (const e of events) {
			if (e.eventType !== 'AssuranceCriterionEvaluated') continue;
			const p = e.payload as { assessmentId: string; criterionId: string; result: string; stipulated?: string };
			if (p.assessmentId === assessmentId) latest.set(p.criterionId, [p.criterionId, p.result, p.stipulated ?? null]);
		}
		return [...latest.values()].sort((a, b) => a[0].localeCompare(b[0]));
	};

	/** The criteria the reasoning-review POLICY declares, read from the store — never hand-listed. */
	const policyCriteria = (snap: EngineSnapshot): string[] =>
		(snap.assurancePolicies.find((p) => p.id === 'floor.reasoning-review')!.state.criteria as { id: string }[])
			.map((c) => c.id)
			.sort((a, b) => a.localeCompare(b));

	const reviewOf = (assessments: ObjectRow[], pwaId: string) =>
		assessments.find(
			(a) =>
				(a.state.subjectObjectIds as string[] | undefined)?.includes(pwaId) &&
				a.state.assurancePolicyId === 'floor.reasoning-review'
		)!;

	const floorFor = (snap: { assessments: ObjectRow[] }, pwaId: string) =>
		new Map(
			snap.assessments
				.filter(
					(a) =>
						(a.state.subjectObjectIds as string[] | undefined)?.includes(pwaId) &&
						String(a.state.assurancePolicyId).startsWith('floor.')
				)
				.map((a) => [String(a.state.assurancePolicyId), String(a.state.assessmentState)])
		);

	test('a clean graph with a stipulated remainder is SATISFIED in a test engine, recorded canonically, and publishes', async ({
		page,
		request
	}) => {
		// ⭐⭐ RESTATED (`JAN-CRITREAD` J1-3; `REG-D-071` Q6b). This test was titled "a clean graph yields a SATISFIED
		// floor, recorded canonically, and publishes" and was written to claim that a REVIEWER can satisfy the floor. On
		// this lane nobody judges seven of the nine criteria: the declared stand-in records the structural checker's two
		// real judgements, and the remainder THIS TEST stipulates, each `UNABLE_TO_DETERMINE` with `stipulated: 'MET'`
		// beside it — counted as met only because this engine was built for tests. So it now claims what it can prove:
		// the product carries a STIPULATED SATISFIED through — staged, accepted, recorded canonically, published — and
		// says, on the record and in its status line, that the pass rests on a stipulation. Whether a reviewer can EARN
		// it moved to reviewer qualification (`reviewer:qual:check`; `docs/tracking/reviewer-qualification/`).
		const pwaId = await createDraft(page, request, 'Floor Happy');
		// The stipulation: in the test body, after the reset, with the PWA id read from the store (§4.5).
		await registerStipulation(request, pwaId, 'PWA_GRAPH');
		const body = await scaffold(request, pwaId, [
			{
				tempKey: 'root',
				name: 'Product Realization',
				pwuKind: 'PRODUCT_REALIZATION',
				isRoot: true,
				childTempKeys: ['arch']
			},
			{ tempKey: 'arch', name: 'Architecture Definition', pwuKind: 'ARCHITECTURE' }
		]);
		expect(body).toContain('Assurance floor SATISFIED');
		// ⭐ AND THE STATUS LINE SAYS WHAT THE PASS RESTS ON (§4.4) — the prefix above is kept; what follows it is true.
		expect(body).toContain('reasoning review: 2 criteria evaluated, 7 stipulated by the test, not reviewed');
		expect((await introspect(request)).assessments).toEqual([]);
		await acceptAgentCandidate(request, pwaId, body);

		// TRUTH after exact acceptance: three floor assessments commit with the graph, all SATISFIED.
		const snap = await introspect(request);
		const floor = floorFor(snap, pwaId);
		expect(floor.get('floor.schema-invariant')).toBe('SATISFIED');
		expect(floor.get('floor.identity-provenance')).toBe('SATISFIED');
		expect(floor.get('floor.reasoning-review')).toBe('SATISFIED');

		// ⭐ WHAT THAT SATISFIED RESTS ON, CRITERION BY CRITERION, AS RECORDED CANONICALLY (§4.6). Every criterion of the
		// policy is recorded; the checker's two are EVALUATED `MET` with no stipulation beside them; the other seven are
		// `UNABLE_TO_DETERMINE` — nobody judged them — with the test's stipulation beside each. ⚠ NOT "ONCE": the handler
		// lets a criterion be recorded again and Gate E reads the latest (`undetermined-criterion-gate.test.ts`, "a later
		// determination SUPERSEDES…"), so the rows are folded the same way and no count of recordings is claimed.
		const rows = rowsOf(snap.events, reviewOf(snap.assessments, pwaId).id);
		expect(
			rows.map(([id]) => id),
			'every criterion of the policy is recorded (its latest recording read, as Gate E reads it)'
		).toEqual(policyCriteria(snap));
		expect(
			rows.filter(([, , claim]) => claim === null),
			'the structural checker judged RR-04 and RR-09 on this arm, and only those'
		).toEqual([
			['RR-04-no-proxy-satisfaction', 'MET', null],
			['RR-09-no-completeness-from-existence', 'MET', null]
		]);
		const stipulatedRows = rows.filter(([, , claim]) => claim !== null);
		expect(stipulatedRows, 'seven criteria the checker cannot judge').toHaveLength(7);
		expect(
			stipulatedRows.filter(([, result, claim]) => result !== 'UNABLE_TO_DETERMINE' || claim !== 'MET'),
			'a stipulated row must say nobody judged it, with the test’s answer BESIDE the result'
		).toEqual([]);

		// The panel renders the disposition read back from the canonical objects.
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-disposition')).toContainText('SATISFIED');

		// A SATISFIED floor lets PublishPwa through the gate.
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();
		await expect
			.poll(async () => (await introspect(request)).pwas[0]!.state.publicationStatus)
			.toBe('PUBLISHED');
	});

	test('a rejected dead-end candidate never mutates canonical state and can be discarded', async ({
		page,
		request
	}) => {
		const pwaId = await createDraft(page, request, 'Floor Blocked');
		// ⭐ THE CLEAN STIPULATION IS REGISTERED HERE TOO (`JAN-CRITREAD` J1-3; §4.6), and the review must STILL reject: a
		// stipulation covers only what the checker did NOT judge, so it can never overrule the checker's own fault. This
		// is the lane's one real discrimination check.
		await registerStipulation(request, pwaId, 'PWA_GRAPH');
		const body = await scaffold(request, pwaId, [
			{
				tempKey: 'root',
				name: 'Product Realization',
				pwuKind: 'PRODUCT_REALIZATION',
				isRoot: true,
				childTempKeys: ['arch']
			},
			{
				tempKey: 'arch',
				name: 'Architecture Definition',
				pwuKind: 'ARCHITECTURE',
				requiredOutputs: ['architecture-baseline']
			}
		]);
		// The dead-end output fails the mandatory RR-04 criterion → the reasoning review is REJECTED, so publish blocks.
		expect(body).toContain('Assurance floor REJECTED');
		expect(body).toContain('PublishPwa remains blocked');

		// All graph/floor/transcript Commands are still isolated; canonical truth has none of them.
		const canonical = await introspect(request);
		expect(canonical.pwuTypes).toEqual([]);
		expect(canonical.assessments).toEqual([]);

		// ⭐ AND RR-04 IS RECORDED AS THE CHECKER JUDGED IT — `NOT_MET`, with no stipulation beside it (§4.6, §9). The
		// REJECTED above comes from the open BLOCKING observation, so a stand-in whose remainder REPLACED the checker's
		// RR-04 row fails the verdict; one that APPENDED a stipulated RR-04 after it keeps the verdict — observations are
		// read from every failed finding — and changes only this row, because the mapper keys findings last-wins
		// (`REG-D-072` D4). This assertion is what catches that one.
		const staged = canonical.authoringCandidates.find((c) => c.pwaId === pwaId)!;
		expect(
			rowsOf(staged.criterionEvents, reviewOf(staged.assessments, pwaId).id).filter(
				([id]) => id === 'RR-04-no-proxy-satisfaction'
			),
			'the checker’s own RR-04 fault must be recorded as it judged it, never stipulated over'
		).toEqual([['RR-04-no-proxy-satisfaction', 'NOT_MET', null]]);

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('REVISION_REQUIRED');
		await expect(page.getByTestId('assurance-disposition')).toContainText('REJECTED');
		await expect(page.getByRole('button', { name: 'Accept exact candidate' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Discard candidate' }).click();
		await expect(page.getByTestId('authoring-candidate-banner')).toBeHidden();
		expect((await introspect(request)).pwuTypes).toEqual([]);
		expect((await introspect(request)).assessments).toEqual([]);
	});
});
