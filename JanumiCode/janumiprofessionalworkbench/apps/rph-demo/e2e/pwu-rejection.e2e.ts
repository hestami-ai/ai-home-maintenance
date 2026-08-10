import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from './support/harness';

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
	});

	test('a PWU cannot be rejected until a blocking finding stands, and then it can', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Rejection Pilot');
		await page.getByPlaceholder(/Objective/i).fill('Prove a finding precedes its rejection');
		await page.getByPlaceholder(/Intended product/i).fill('Rejection Pilot App');
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();

		const row = page.getByRole('link', { name: /Rejection Pilot/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		let snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Rejection Pilot')!;
		const target = snap.pwus.find(
			(p) => p.state.undertakingId === undertaking.id && p.state.workLifecycleState === 'PROPOSED'
		)!;
		expect(target, 'a PWU to fault').toBeTruthy();
		const title = new RegExp(String(target.state.title));

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
		await page.getByRole('row', { name: title }).getByRole('button', { name: 'Begin & Execute' }).click();
		await expect(page.getByRole('row', { name: title }).getByTestId('record-finding')).toBeVisible();
		await expect(
			page.getByRole('row', { name: title }).getByTestId('reject-pwu'),
			'no finding stands, so the act is not offered'
		).toHaveCount(0);

		// ── 3. THE ASSURANCE ACT: record the blocking finding ───────────────────────────────────────────────────
		await page
			.getByRole('row', { name: title })
			.getByTestId('finding-statement')
			.fill('The expected output is absent.');
		await page.getByRole('row', { name: title }).getByTestId('record-finding').click();

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
		await page.getByRole('row', { name: title }).getByTestId('reject-pwu').click();

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
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Scope Pilot');
		await page.getByPlaceholder(/Objective/i).fill('Prove findings are subject-scoped');
		await page.getByPlaceholder(/Intended product/i).fill('Scope Pilot App');
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption({ index: 1 });
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
		const faulted = new RegExp(String(pwus[0]!.state.title));
		const innocent = new RegExp(String(pwus[1]!.state.title));

		await page.getByRole('button', { name: 'overview' }).click();
		await page.getByRole('row', { name: faulted }).getByRole('button', { name: 'Begin & Execute' }).click();
		await page
			.getByRole('row', { name: faulted })
			.getByTestId('finding-statement')
			.fill('This one is broken.');
		await page.getByRole('row', { name: faulted }).getByTestId('record-finding').click();

		// ⚠ THE INNOCENT PWU MUST REACH THE SAME LIFECYCLE STATE, AND MY FIRST VERSION OF THIS CONTROL DID NOT
		// BOTHER. It left the other PWU at PROPOSED — where the reject affordance is not rendered AT ALL, because
		// the template only offers it in the UNDER_ASSURANCE branch. So `toHaveCount(0)` passed on the LIFECYCLE
		// STATE and asserted nothing about subject scope, and the mutation runner said so:
		// `B3-rejection-stops-checking-the-subject` SURVIVED against it. A control that passes for a reason other
		// than the one in its name is the defect this repository has now recorded four times.
		//
		// Signing this one off puts it at UNDER_ASSURANCE with NO blocking finding — the same branch, the same
		// buttons, differing ONLY in whether a finding names it.
		await page.getByRole('row', { name: innocent }).getByRole('button', { name: 'Begin & Execute' }).click();
		await page
			.getByRole('row', { name: innocent })
			.getByRole('button', { name: 'Record Assurance' })
			.click();
		await expect(
			page.getByRole('row', { name: innocent }).getByRole('button', { name: 'Mark Satisfied' })
		).toBeVisible();

		// Both are UNDER_ASSURANCE. A blocking finding exists in this undertaking. Only one of them is its subject.
		await expect(page.getByRole('row', { name: faulted }).getByTestId('reject-pwu')).toHaveCount(1);
		await expect(
			page.getByRole('row', { name: innocent }).getByTestId('reject-pwu'),
			'a finding against another PWU must not license rejecting this one'
		).toHaveCount(0);
	});
});
