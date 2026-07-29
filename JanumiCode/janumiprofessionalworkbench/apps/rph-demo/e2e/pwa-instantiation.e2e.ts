import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from './support/harness';

// JPWB-SPEC-001-DR-002 W-3 — a Professional Work Architecture is instantiated by the Undertaking that binds it.
//
// THE DEFECT THIS PINS. Creating an Undertaking drove the full Intent lifecycle and then `CreateUndertaking`, and
// created ZERO PWUs. The only way to populate one was `proposePwu`, one hand-picked type at a time. So the PWA's
// authored composition tree — the `permittedChildren` with the M1/M+/C1/C+ cardinality the Designer was rebuilt to
// author — was never instantiated into anything. A reusable Work Architecture that no Undertaking instantiates is
// not performing the role DOC-001 gives it.
//
// WHY THE ASSERTION IS A NUMBER AND NOT "NOT EMPTY". The seeded reference PWA is a DISCRIMINATING fixture, and
// that is the whole reason this spec can tell three wrong implementations apart:
//
//   - the seeded root permits SEVEN children, every one M1        (seed-workbench.ts:62-70)
//   - `Architecture Definition` permits ONE more, at C+           (seed-workbench.ts:92)
//
// Ratified semantics (canonical-vocabulary.json:65-75): "M1 mandatory-exactly-one; M+ mandatory-one-or-more; C1
// conditional-zero-or-one; C+ conditional-zero-or-more". The mandatory minimum is 1 for M1/M+ and 0 for C1/C+. So:
//
//   correct                                     -> root + 7 = 8
//   instantiates everything PERMITTED           -> 9   (the C+ child is created when it should be offered)
//   ignores cardinality entirely                -> 9   (same, by a different route)
//   does not instantiate at all (today)         -> 0
//
// `toBeGreaterThan(0)` would have passed the two wrong implementations. This is what the roadmap's original
// "fails today: the set is empty" could not have distinguished.
//
// SCOPING: `/test-api/introspect` returns `pwus: listPwus(e)` UNSCOPED and deliberately so — it is the harness's
// ground-truth read, and scoping it would blind the specs that prove the scoping fix. The filter on
// `state.undertakingId` is therefore this spec's job, not the endpoint's.
test.describe('Undertaking Workbench — the PWA is instantiated (DR-002 W-3)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('a new Undertaking instantiates its PWA composition tree, honouring cardinality', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Instantiation Probe');
		await page.getByPlaceholder(/Objective/i).fill('Prove the architecture is instantiated');
		await page.getByPlaceholder(/Intended product/i).fill('Probe Product');
		await page.getByRole('combobox', { name: 'Instantiate from published PWA' }).selectOption({ index: 1 }); // the one published PWA
		await declareRisk(page); // DR-002 W-4: the form refuses without a judgement
		await page.getByRole('button', { name: 'Create Undertaking' }).click();

		// Settle on the list re-render before reading engine truth: the row appearing is what proves the form
		// action completed. Reading introspect first would race the dispatch and report a stale count.
		const row = page.getByRole('link', { name: /Instantiation Probe/ });
		await expect(row).toBeVisible();

		const snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Instantiation Probe');
		expect(undertaking, 'the new Undertaking must exist before its PWUs mean anything').toBeTruthy();

		const pwus = snap.pwus.filter((p) => p.state.undertakingId === undertaking!.id);
		expect(
			pwus,
			'root + 7 mandatory children = 8; 9 means the C+ child was created rather than offered'
		).toHaveLength(8);

		// The root is instantiated exactly once, and it is the root — not merely "some PWU exists".
		const byType = new Map(snap.pwuTypes.map((t) => [t.id, t]));
		const roots = pwus.filter((p) => !p.state.parentWorkUnitId);
		expect(roots, 'exactly one PWU has no parent').toHaveLength(1);
		expect(byType.get(String(roots[0]!.state.pwuTypeId))?.state.isRoot).toBe(true);

		// Every non-root is a child OF the root, and each realizes a DISTINCT mandatory type — an implementation
		// that instantiated the same type seven times would otherwise satisfy the count.
		const children = pwus.filter((p) => p.state.parentWorkUnitId);
		expect(children).toHaveLength(7);
		for (const c of children) expect(c.state.parentWorkUnitId).toBe(roots[0]!.id);
		expect(new Set(children.map((c) => String(c.state.pwuTypeId))).size).toBe(7);

		// The C+ child is NOT created. Named by its type rather than by count, so this still holds if the seed's
		// mandatory set changes.
		const concernType = snap.pwuTypes.find((t) => t.state.name === 'Architecture Concern');
		if (concernType)
			expect(
				pwus.filter((p) => String(p.state.pwuTypeId) === concernType.id),
				'a C+ (conditional-zero-or-more) child is OFFERED, never instantiated'
			).toHaveLength(0);
	});

	// ── THE CONTROLS ────────────────────────────────────────────────────────────────────────────────────────────
	//
	// The seeded architecture is one shape: a root with seven M1 children and one C+ grandchild. It cannot tell
	// "handles M+" from "handles M1", cannot exercise depth, and cannot exercise a refusal. Each control authors
	// its own PWA through `/test-api/dispatch` — the same command bus the UI uses, no back door — and then creates
	// the Undertaking through the REAL form, so the path under test is the one a professional drives.

	/** Author and publish a fixture PWA whose root is `types[0]`. Ids are Crockford base32 (no I/L/O/U). */
	async function publishFixturePwa(
		request: import('@playwright/test').APIRequestContext,
		pwaId: string,
		name: string,
		types: readonly {
			id: string;
			isRoot?: boolean;
			children?: readonly { typeId: string; cardinality: 'M1' | 'M+' | 'C1' | 'C+' }[];
		}[]
	): Promise<void> {
		const steps: unknown[][] = [
			['CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { pwaId, name, description: name, domain: 'test', version: '0.1.0' }]
		];
		for (const t of types)
			steps.push([
				'DefinePwuType',
				'PWU_TYPE',
				t.id,
				{
					pwuTypeId: t.id,
					pwaId,
					pwuKind: 'WORK',
					name: t.id,
					purpose: t.id,
					isRoot: t.isRoot === true,
					permittedChildTypeIds: (t.children ?? []).map((c) => c.typeId),
					permittedChildren: t.children ?? [],
					requiredInputs: [],
					requiredOutputs: [],
					requiredAssurancePolicyIds: [],
					executionBoundary: 'INTERNAL'
				}
			]);
		steps.push(['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}]);
		steps.push(['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}]);
		steps.push(['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: types[0]!.id }]);
		const res = await request.post('/test-api/dispatch', { data: { steps } });
		const body = (await res.json()) as { ok: boolean; results: { commandType: string; message?: string }[] };
		// The fixture is ARRANGEMENT. If it fails to publish, every assertion below is about the fixture and not
		// about instantiation — so it fails here, loudly, naming the command that refused.
		expect(
			body.ok,
			`fixture PWA "${name}" must publish: ${body.results.map((r) => `${r.commandType}${r.message ? ` (${r.message})` : ''}`).join(', ')}`
		).toBe(true);
	}

	/** Create an Undertaking through the real form, selecting the fixture PWA by its option label. */
	async function createUndertakingFrom(
		page: import('@playwright/test').Page,
		pwaName: string,
		undertakingName: string
	): Promise<void> {
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill(undertakingName);
		// The option label is `name + ' v' + version`, NOT the bare name — a name-only match selects nothing and
		// the control would then fail on its selector rather than on what it is testing.
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption({ label: `${pwaName} v0.1.0` });
		await declareRisk(page); // DR-002 W-4: the form refuses without a judgement
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
	}

	const pwusOf = (snap: Awaited<ReturnType<typeof introspect>>, undertakingName: string) => {
		const u = snap.undertakings.find((x) => x.state.name === undertakingName);
		return u ? snap.pwus.filter((p) => p.state.undertakingId === u.id) : undefined;
	};

	test('CONTROL — a root permitting no children instantiates exactly one PWU, not zero', async ({
		page,
		request
	}) => {
		// Without this, "instantiate nothing at all" satisfies nothing above it: the main test would still fail,
		// but a walk that mints only CHILDREN and forgets the root would pass every parentage assertion it makes.
		const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GHW30';
		await publishFixturePwa(request, PWA, 'Solo Architecture', [
			{ id: 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW31', isRoot: true }
		]);
		await createUndertakingFrom(page, 'Solo Architecture', 'Solo Probe');
		await expect(page.getByRole('link', { name: /Solo Probe/ })).toBeVisible();

		const pwus = pwusOf(await introspect(request), 'Solo Probe');
		expect(pwus, 'the Undertaking must exist').toBeDefined();
		expect(pwus, 'a root that permits nothing still instantiates itself').toHaveLength(1);
		expect(pwus![0]!.state.parentWorkUnitId ?? '').toBe('');
	});

	test('CONTROL — the walk recurses, and M+ yields ONE while C1 yields none', async ({
		page,
		request
	}) => {
		// root ──M+──> mid ──M1──> leaf
		//   └───C1──> opt
		// Expected: root, mid, leaf = 3. A one-level walk reports 2. Instantiating everything permitted reports 4.
		const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GHW40';
		const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW41';
		const MID = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW42';
		const LEAF = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW43';
		const OPT = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW44';
		await publishFixturePwa(request, PWA, 'Depth Architecture', [
			{
				id: ROOT,
				isRoot: true,
				children: [
					{ typeId: MID, cardinality: 'M+' },
					{ typeId: OPT, cardinality: 'C1' }
				]
			},
			{ id: MID, children: [{ typeId: LEAF, cardinality: 'M1' }] },
			{ id: LEAF },
			{ id: OPT }
		]);
		await createUndertakingFrom(page, 'Depth Architecture', 'Depth Probe');
		await expect(page.getByRole('link', { name: /Depth Probe/ })).toBeVisible();

		const pwus = pwusOf(await introspect(request), 'Depth Probe')!;
		expect(pwus, 'root + M+ child + its M1 grandchild; the C1 is offered, not created').toHaveLength(3);
		const byType = new Map(pwus.map((p) => [String(p.state.pwuTypeId), p]));
		expect([...byType.keys()].sort()).toEqual([ROOT, MID, LEAF].sort());
		// Depth is the point: the leaf's parent is the MID instance, not the root.
		expect(byType.get(LEAF)!.state.parentWorkUnitId).toBe(byType.get(MID)!.id);
		expect(byType.get(MID)!.state.parentWorkUnitId).toBe(byType.get(ROOT)!.id);
	});

	test('CONTROL — an architecture naming an unresolvable child is REFUSED, and nothing partial is left', async ({
		page,
		request
	}) => {
		// This PWA PUBLISHES CLEANLY today: `definePwuType` never checks that `permittedChildTypeIds` resolve, and
		// the graph projection silently drops what it cannot resolve. So the refusal has to happen at
		// instantiation, and it has to leave NOTHING — a half-built architecture looks like a professional's
		// decomposition and is actually the residue of a failure.
		const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GHW50';
		const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW51';
		const GHOST = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHW5G';
		await publishFixturePwa(request, PWA, 'Broken Architecture', [
			{ id: ROOT, isRoot: true, children: [{ typeId: GHOST, cardinality: 'M1' }] }
		]);
		await createUndertakingFrom(page, 'Broken Architecture', 'Broken Probe');

		await expect(
			page.getByText(/permitted child type that does not resolve/i),
			'the refusal is surfaced to the professional, not swallowed'
		).toBeVisible();

		const snap = await introspect(request);
		expect(
			pwusOf(snap, 'Broken Probe') ?? [],
			'a refused instantiation leaves no PWUs behind'
		).toHaveLength(0);
	});
});
