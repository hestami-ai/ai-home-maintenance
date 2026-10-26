import { expect } from '@playwright/test';
import {
	test,
	resetEngine,
	introspect,
	gotoHydrated,
	declareRisk
} from './support/harness';
import { publishPwaThroughDesigner, unitRow } from './support/phase7-pwa';

// S-1b of ROADMAP-decision-subject-scope (REG-F-104) — REJECTION, the third act JPWB-DOC-001 §5.2 reserves to
// Governance, and the one that was unreachable for a reason worth stating.
//
// ⚠ WHAT WAS MISSING WAS NOT THE BUTTON. `RejectPwu` demands BOTH an EFFECTIVE REJECTION Decision naming the PWU
// AND a stored ASSURANCE_OBSERVATION of BLOCKING/CRITICAL severity whose subjectObjectIds include it — severity
// read off the STORED object, never off the payload. Measured before this spec: `RecordAssuranceObservation` was
// dispatched ZERO times anywhere in this app. **The workbench could sign work off and could not fault it.**
//
// The tempting fix was to let `rejectPwu` mint its own observation in the same batch. That is MANUFACTURING THE
// GUARD'S OWN INPUT (REG-F-022 Gate A: "the logic is right and its population is supplied by the party it
// judges") — green, reachable, and worth nothing. So this spec asserts the SEPARATION as much as the outcome:
// the finding is an ASSURANCE act recorded first, and the GOVERNANCE act later cites what already stands.
test.describe('Undertaking Workbench — rejection cites a finding it did not make', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
		// ~~⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3)) — the sign-off REVIEWS each declared policy now; in
		// this lane the declared stand-in answers it only where the test stipulated it (`declared-policy-review.ts`).~~
		// ⭐ `REG-F-569` (`REG-D-121` Q18) — no test here asks a declared review: the one sign-off, the CONTROL's, is of a unit
		// whose type declares no policy, so no stipulation is registered.
	});

	test('a PWU cannot be rejected until a blocking finding stands, and then it can', async ({
		page,
		request
	}) => {
		// ⛔ MOVED BY `JAN-EXEC` Phase 7, package M (`REG-D-135` (2); design D1, D2, D3): ~~the reference seed's PWA
		// (`selectOption({ index: 1 })`)~~. Each of its types declares its inputs in prose — "requirements", "originating
		// expression" — that no instantiated type lists as an output, so every unit its Undertaking instantiates records them
		// unproduced and none is startable (measured 2026-10-26: 8 units, each with 5 to 10 unproduced inputs, and the root
		// waiting for its 7 children). So the Undertaking is of a PWA of this test's own, as the CONTROL's is: a root a person
		// does and one leaf, neither declaring an input or a policy, and the leaf the unit faulted.
		const pwaId = await publishPwaThroughDesigner(page, request, {
			name: 'Rejection Pilot PWA',
			domain: 'software product',
			types: [
				{
					name: 'Rejection Leaf',
					pwuKind: 'REJECTION_LEAF',
					purpose: 'Do the work a finding may name.',
					workDischarge: 'HUMAN',
					policyIds: []
				},
				{
					name: 'Rejection Root',
					pwuKind: 'REJECTION_ROOT',
					purpose: 'Hold the work under one Undertaking.',
					workDischarge: 'HUMAN',
					isRoot: true,
					children: ['Rejection Leaf'],
					policyIds: []
				}
			]
		});
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Rejection Pilot');
		await page.getByPlaceholder(/Objective/i).fill('Prove a finding precedes its rejection');
		await page.getByPlaceholder(/Intended product/i).fill('Rejection Pilot App');
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption(pwaId);
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();

		const row = page.getByRole('link', { name: /Rejection Pilot/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		let snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Rejection Pilot')!;
		// ⛔ MOVED BY `JAN-EXEC` Phase 7, package M (`REG-D-135` (2); design D2, D3): ~~the first PROPOSED unit~~ — that was the
		// root, which now waits for its children to be accepted, so its row offers no Begin & Execute. The unit faulted here
		// is the first PROPOSED one the engine would start: it waits for no unit and requires nothing no unit produces.
		const empty = (v: unknown) => !Array.isArray(v) || v.length === 0;
		const target = snap.pwus.find(
			(p) =>
				p.state.undertakingId === undertaking.id &&
				p.state.workLifecycleState === 'PROPOSED' &&
				empty(p.state.dependencyIds) &&
				empty(p.state.inputRequirements)
		)!;
		expect(target, 'a PWU to fault').toBeTruthy();
		// ⛔ Package M (design D3) — ~~`new RegExp(title)` over each row's whole text~~: a waiting unit's row names the units it
		// waits for (`start-withheld`), so the root's row now holds this unit's title too. The row is the one whose title CELL
		// is this unit's (`unitRow`).
		const title = String(target.state.title);

		// ── 1. THE ENGINE REFUSES A REJECTION WITH NO FINDING, and says which limb failed ───────────────────────
		// Posted at the command bus — the SAME bus the UI uses — because the surface (correctly) never offers this
		// shape. A REJECTION decision alone is not enough: §8.2's trigger is "Blocking finding".
		const noFinding = await request.post('/test-api/dispatch', {
			data: {
				steps: [
					[
						'RejectPwu',
						'PROFESSIONAL_WORK_UNIT',
						target.id,
						{ rejectionDecisionId: 'dec_does_not_exist', blockingObservationIds: [] }
					]
				]
			}
		});
		const refused = (await noFinding.json()) as {
			ok: boolean;
			results: { status: string; message?: string }[];
		};
		expect(refused.ok, 'an unevidenced rejection must not be accepted').toBe(false);
		snap = await introspect(request);
		expect(snap.pwus.find((p) => p.id === target.id)!.state.workLifecycleState).toBe('PROPOSED');

		// ── 2. THE SURFACE OFFERS NO REJECTION YET ──────────────────────────────────────────────────────────────
		await page.getByRole('button', { name: 'overview' }).click();
		await unitRow(page, title).getByRole('button', { name: 'Begin & Execute' }).click();
		await expect(unitRow(page, title).getByTestId('record-finding')).toBeVisible();
		await expect(
			unitRow(page, title).getByTestId('reject-pwu'),
			'no finding stands, so the act is not offered'
		).toHaveCount(0);

		// ── 3. THE ASSURANCE ACT: record the blocking finding ───────────────────────────────────────────────────
		await unitRow(page, title)
			.getByTestId('finding-statement')
			.fill('The expected output is absent.');
		await unitRow(page, title).getByTestId('record-finding').click();

		// TRUTH: a real ASSURANCE_OBSERVATION exists, BLOCKING, naming this PWU — and the PWU has NOT been
		// rejected by recording it. The assurance act and the governance act are separate, which is the point.
		snap = await introspect(request);
		const findings = snap.observations.filter(
			(o) =>
				o.state.severity === 'BLOCKING' &&
				(o.state.subjectObjectIds as string[] | undefined)?.includes(target.id)
		);
		expect(findings, 'exactly one blocking finding, recorded as its own act').toHaveLength(1);
		expect(String(findings[0]!.state.statement)).toContain('expected output is absent');
		expect(
			snap.pwus.find((p) => p.id === target.id)!.state.workLifecycleState,
			'recording a finding is NOT rejecting — that is a governance act'
		).toBe('UNDER_ASSURANCE');

		// ── 4. THE GOVERNANCE ACT: reject, citing the finding that already stands ───────────────────────────────
		await unitRow(page, title).getByTestId('reject-pwu').click();

		snap = await introspect(request);
		expect(snap.pwus.find((p) => p.id === target.id)!.state.workLifecycleState).toBe('REJECTED');
		const authorizations = snap.decisions.filter((d) => d.state.decisionType === 'REJECTION');
		expect(authorizations).toHaveLength(1);
		expect(authorizations[0]!.state.status).toBe('EFFECTIVE');
		expect(authorizations[0]!.state.subjectObjectIds).toEqual([target.id]);
		// THE TRACE THAT MAKES IT AUDITABLE: the decision names the observation it rests on, so "why was this
		// rejected" is answerable from the record rather than from the rejecting party's memory.
		expect(authorizations[0]!.state.consideredObservationIds).toEqual([findings[0]!.id]);

		// ── CONTROL: exactly ONE observation was created in the whole run ───────────────────────────────────────
		// If `rejectPwu` had minted its own finding — the shortcut this increment exists to refuse — there would
		// be two, and every assertion above would still pass.
		expect(
			snap.observations.filter((o) =>
				(o.state.subjectObjectIds as string[] | undefined)?.includes(target.id)
			),
			'rejection must CITE a finding, never create one'
		).toHaveLength(1);
	});

	// CONTROL — a blocking finding on a DIFFERENT PWU does not license this one's rejection. Without it, the
	// affordance could be offered on any PWU once any finding existed anywhere, and the happy path above would
	// still be green.
	test('CONTROL — a finding against another PWU offers no rejection here', async ({
		page,
		request
	}) => {
		// ⛔ `REG-F-569` (`REG-D-121` Q18) — THE TWO UNITS ARE OF A PWA OF THIS TEST'S OWN, whose types declare no policy, so
		// the innocent's sign-off reaches UNDER_ASSURANCE. A unit of the reference seed's PWA declares policies and no model
		// runs it: its step completes with no work product and no command, so its sign-off is refused before any declared
		// review is asked, and its row stays EXECUTING. ⚠ Suspending its policies is no way around it, driven: its row still
		// did not reach UNDER_ASSURANCE, and in S-01's S-e the same arrangement's sign-off was refused by the kernel's fold,
		// which composes UNASSESSED over declared policies none of which governs (`unsupportedSatisfaction`; `REG-F-524`). The
		// declared review is not this control's subject; the reject affordance's subject scope is. ~~A root a person does and
		// one mandatory child, so the Undertaking instantiates two.~~
		// ⛔ MOVED BY `JAN-EXEC` Phase 7, package M (`REG-D-135` (2); design D2): a root now waits for its children to be
		// ACCEPTED before it starts, so a root and its one child can never both be UNDER_ASSURANCE — the child must be
		// SATISFIED first. So the two units this control compares are two SIBLING leaves, neither waiting for the other: a root
		// a person does and two mandatory children, so the Undertaking instantiates three, and the two compared are the leaves.
		const pwaId = await publishPwaThroughDesigner(page, request, {
			name: 'Scope Pilot PWA',
			domain: 'software product',
			types: [
				{
					name: 'Scoped Leaf',
					pwuKind: 'SCOPED_LEAF',
					purpose: 'Do the work a finding may name.',
					workDischarge: 'HUMAN',
					policyIds: []
				},
				{
					name: 'Sibling Leaf',
					pwuKind: 'SIBLING_LEAF',
					purpose: 'Do the work beside it that no finding names.',
					workDischarge: 'HUMAN',
					policyIds: []
				},
				{
					name: 'Scoped Root',
					pwuKind: 'SCOPED_ROOT',
					purpose: 'Hold the scoped work under one Undertaking.',
					workDischarge: 'HUMAN',
					isRoot: true,
					children: ['Scoped Leaf', 'Sibling Leaf'],
					policyIds: []
				}
			]
		});
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Scope Pilot');
		await page.getByPlaceholder(/Objective/i).fill('Prove findings are subject-scoped');
		await page.getByPlaceholder(/Intended product/i).fill('Scope Pilot App');
		// ⚠ BY ITS ID, the option's value: the reference seed's PWA is published too, so an index would name either.
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption(pwaId);
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /Scope Pilot/ });
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		const snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Scope Pilot')!;
		const pwus = snap.pwus.filter(
			(p) => p.state.undertakingId === undertaking.id && p.state.workLifecycleState === 'PROPOSED'
		);
		expect(pwus.length, 'this control needs two PWUs to distinguish').toBeGreaterThan(1);
		// ⛔ Package M — ~~`pwus[0]` and `pwus[1]`~~, the first of which was the root: the two leaves, by their titles.
		const leaves = pwus.filter((p) => ['Scoped Leaf', 'Sibling Leaf'].includes(String(p.state.title)));
		expect(leaves.map((p) => p.state.title).sort(), 'this control compares the two leaves').toEqual([
			'Scoped Leaf',
			'Sibling Leaf'
		]);
		const faulted = 'Scoped Leaf';
		const innocent = 'Sibling Leaf';

		await page.getByRole('button', { name: 'overview' }).click();
		await unitRow(page, faulted).getByRole('button', { name: 'Begin & Execute' }).click();
		await unitRow(page, faulted)
			.getByTestId('finding-statement')
			.fill('This one is broken.');
		await unitRow(page, faulted).getByTestId('record-finding').click();

		// ⚠ THE INNOCENT PWU MUST REACH THE SAME LIFECYCLE STATE, AND MY FIRST VERSION OF THIS CONTROL DID NOT
		// BOTHER. It left the other PWU at PROPOSED — where the reject affordance is not rendered AT ALL, because
		// the template only offers it in the UNDER_ASSURANCE branch. So `toHaveCount(0)` passed on the LIFECYCLE
		// STATE and asserted nothing about subject scope, and the mutation runner said so:
		// `B3-rejection-stops-checking-the-subject` SURVIVED against it. A control that passes for a reason other
		// than the one in its name is the defect this repository has now recorded four times.
		//
		// Signing this one off puts it at UNDER_ASSURANCE with NO blocking finding — the same branch, the same
		// buttons, differing ONLY in whether a finding names it.
		await unitRow(page, innocent).getByRole('button', { name: 'Begin & Execute' }).click();
		await unitRow(page, innocent)
			.getByRole('button', { name: 'Record Assurance' })
			.click();

		// ⚠ ASSERTED AGAINST THE ENGINE, NOT AGAINST A BUTTON — and the second attempt at this control is why.
		// I first asserted "Mark Satisfied" was visible and called that proof of UNDER_ASSURANCE. It is not:
		// `markSatisfied` is offered in BOTH the EXECUTING and UNDER_ASSURANCE branches, so the assertion held
		// while the PWU sat in the wrong one, the reject block never rendered for either reason, and
		// `B3-rejection-stops-checking-the-subject` SURVIVED a SECOND time. Two rounds of a control that could
		// not fail, each fixed by looking at what the mutation runner said rather than at what I expected.
		// ⚠ WAITED FOR ON THE ROW, NOT READ FROM THE ENGINE. My second attempt asserted `introspect()` said
		// UNDER_ASSURANCE and moved on — and it DID, while the row still rendered EXECUTING. The affordance
		// is a function of what the PAGE shows, so a server-side truth-check cannot establish that the branch
		// under test is even on screen. `B3-rejection-stops-checking-the-subject` SURVIVED twice on that gap.
		await expect(unitRow(page, faulted)).toContainText('UNDER_ASSURANCE');
		await expect(
			unitRow(page, innocent),
			'the innocent PWU must reach the SAME branch, or this control proves nothing about subject scope'
		).toContainText('UNDER_ASSURANCE');

		// Both are UNDER_ASSURANCE. A blocking finding exists in this undertaking. Only one of them is its subject.
		await expect(unitRow(page, faulted).getByTestId('reject-pwu')).toHaveCount(1);
		await expect(
			unitRow(page, innocent).getByTestId('reject-pwu'),
			'a finding against another PWU must not license rejecting this one'
		).toHaveCount(0);
	});
});
