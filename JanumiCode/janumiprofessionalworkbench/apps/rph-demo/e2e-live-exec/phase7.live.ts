import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { gotoHydrated } from '../e2e/support/harness';
import {
	actionFields,
	createDraftPwa,
	createUndertakingThroughForm,
	publishThroughDesigner,
	typePwuTypes,
	unitRow
} from '../e2e/support/phase7-pwa';
import { PHASE7_PWA } from '../../../scripts/phase7/pwa-content';
import { archiveUnit } from '../../../scripts/phase7/run-archive';
import {
	LIVE_RUN_DIR_VARIABLE,
	PHASE7_PAID_VARIABLE,
	PHASE7_REVIEWED_COMMANDS,
	PHASE7_TEST_TIMEOUT_MS
} from './lane-config';
import {
	PHASE7_UI_MS,
	PHASE7_UNDERTAKING,
	beginExecute,
	bootOf,
	freshIntrospect,
	laneVerdict,
	logPosts,
	markSatisfied,
	openLane,
	recordAssurance,
	recover,
	recoveryOffers,
	runTheLane,
	screenshot,
	typesAsTyped,
	unitsOf,
	withFreshRequest
} from './phase7-operator';
import { STORE_FILE } from './run-folder';

// ⭐⭐ `JAN-EXEC` Phase 7 `P7-2` — THE RUN'S LANE: §3.2's PWA, typed into the designer as the operator, published, and run
// as an Undertaking of five units on the real executor and the real reviewer (`docs/_working/DESIGN-the-live-end-to-end-run.md`
// §4, §6 P7-2 and its build decisions D1 to D11; `REG-D-100`, `REG-D-101`, `REG-D-102`).
//
// Run alone, from `apps/rph-demo`, with `JPWB_LIVE_RUN_DIR` naming the run's own folder, set before Playwright starts:
//   `bun run e2e:live-exec -- e2e-live-exec/phase7.live.ts`
// The config then collects this spec alone, its server keeps the run in that folder, and it refuses a folder that is
// relative, missing, inside the repository or the temporary folder, already holds a store, or has Pi's context on its
// path (`run-folder.ts`, D1 and D2).
//
// ── ⛔ DRY UNLESS PAID (D1) ──────────────────────────────────────────────────────────────────────────────────────────
// A model is called only when `JPWB_PHASE7_PAID=1`, and then the reviewer calls spent before the run (P7-3a's) must be
// given in `JPWB_PHASE7_PRIOR_REVIEWER_CALLS`. Dry, the spec runs everything that calls no model — the boot record, the
// readiness check, typing and publishing the PWA, the Undertaking, the ROOT's Begin & Execute (no model), its saved
// response and one archive-and-check cycle, then the ROOT's sign-off by the paid run's own acts and the final archive
// (no model either; D11) — then stops, and PROVES the press and the sign-off: the press answered `success` and read from
// the store as completed; the root's row offering Record Assurance, Record Assurance and Mark Satisfied each answered
// `success`, and the store reading the root SATISFIED in lifecycle and in assurance; and no model exchange recorded,
// counted after the sign-off (D5, D11; `laneVerdict`). ⚠ A dry run and the paid run never share a folder: a store is
// seeded only when empty, and command ids restart at every boot (D2).
//
// ── ⭐ THE ORDER (D3, D4, D5, D8, D11) — `runTheLane`, in `phase7-operator.ts`, on the HANDS this spec builds below ────
//   1. BOOT (D3): the inherited `JPWB_*`, `RPH_*` and `PI_*` variables, the config's overlay, the node version, and
//      devin's readiness — its version, and the configured model in its model list, no model called — into
//      `lane/boot.json`. Refused at boot, with every reason at once, as `refused-at-boot`.
//   2. The PWA, typed and read back from the store, then published; the Undertaking created; its five units read.
//   3. Begin & Execute on the ROOT, then on each PHASE in order, each started only after the one before has answered
//      (`REG-F-535`). Before each phase, the LIMIT (D8): the calls spent before, those this store records, and four held
//      for the negative control must total under the sponsor's limit — ~~150~~ ⭐ 200 (`REG-D-105` (1)) — or the run ends
//      `paid-limit`. Each press waits on its own
//      response for up to one phase's allowance (D4); one with NO ANSWER — it outlasted that allowance, or its request
//      failed in transit — ends the run there, `allowance-exceeded` or `request-failed`, the root's included, and
//      nothing is started beside it. Each answer is kept raw (`lane/actions/`), and the unit's state READ FROM THE STORE
//      (`REG-F-540`), then the run archived and checked (`scripts/phase7/run-archive.ts`, D6 and D7).
//   4. ~~A phase that stops is left as found~~ ⭐ P7-6R R-1f — A PHASE THAT STOPS AT ITS REVIEW IS RECOVERED BY THE RUN
//      PLAN'S RULE, AS THE OPERATOR (`REG-D-105` (4); `recoverByRule`): its row read afresh; re-run the review if the row
//      offers it (a review that did not conclude), else re-run the work, with the findings; the LIMIT checked before the
//      re-run, as before a phase; and a re-run refused again is abandoned. Each act posts the page's own form with the
//      rule's rationale typed, so each choice is the operator's Decision, never the engine's. A stop the row offers no
//      re-run for is left as found. The later phases still run, each recorded as having an upstream nothing assured — a
//      field the store does not have (D5).
//   5. SIGN-OFF: Record Assurance, then Mark Satisfied, on each phase that completed, and the root's attempted LAST, the
//      page loaded afresh for each and the store read after every act, each refusal recorded, never asserted; then the
//      final archive, `06-final`. Dry, no phase was pressed, so the root's alone, by these same acts (D11).
//
// ── ⚠ WHAT THIS SPEC ASSERTS, AND WHAT IT ONLY RECORDS ────────────────────────────────────────────────────────────────
// It asserts its OWN machinery (`laneVerdict`): the boot, the PWA as typed, one unit per type, the dry run's proof of the
// root's press and of its sign-off (D11) and its absence of any model call, and an end the run was meant to reach —
// `complete` paid, `dry-run-stop` dry. Everything the run is FOR — which phase completed, what each review said, what
// each command did — is recorded, never asserted: the report reads it (`scripts/phase7/run-report.ts`, D9), because a
// lane that stopped at a product's first refusal would measure nothing after it. ⛔ The forbidden acts (P7-3) are never
// pressed here: no step is completed, skipped or retried by hand, no waiver is asked, Mark Satisfied follows an accepted
// Record Assurance only, nothing is proposed again — ⭐ and nothing is abandoned but by the run plan's rule (step 4). ⚠ It never resets the engine and stipulates nothing:
// the store is durable, and the reviewer is real.

test.describe('LIVE — JAN-EXEC Phase 7: §3.2’s PWA, published, run as an Undertaking on the real executor and reviewer', () => {
	test('the run’s lane: boot, publish, the root then each phase, sign-off — archived and checked after each unit', async ({
		page,
		baseURL
	}) => {
		test.setTimeout(PHASE7_TEST_TIMEOUT_MS);
		// ⛔ NO ACT WAITS UNBOUNDED: this lane sets no action timeout, so a click on a button that never came would wait out
		// the ~~43-hour~~ ⭐ 85-hour test (P7-6 B4). Begin & Execute and the sign-off acts pass bounds of their own ⭐ — and,
		// since P7-6 B3, every fill and click the lane makes.
		page.setDefaultTimeout(PHASE7_UI_MS);
		const paid = process.env[PHASE7_PAID_VARIABLE] === '1';
		const runFolder = process.env[LIVE_RUN_DIR_VARIABLE]?.trim() ?? '';
		expect(
			runFolder,
			`${LIVE_RUN_DIR_VARIABLE} names no run folder, so this run has nowhere to keep its record`
		).not.toBe('');
		expect(baseURL, 'the config gives the lane no base URL').toBeTruthy();
		const base = baseURL!;
		const lane = openLane(runFolder);
		const posts = logPosts(page, lane.posts);
		const store = join(runFolder, STORE_FILE);
		const boot = await bootOf({
			paid,
			env: process.env,
			serverEnv: test.info().config.webServer?.env,
			store
		});
		let undertakingPath = '';

		// ── THE HANDS: the page and the server, as `runTheLane` uses them ──────────────────────────────────────────────
		const record = await runTheLane({
			boot,
			lane,
			flushPosts: posts.flush,
			hands: {
				setUp: async (note) => {
					const pwaId = await withFreshRequest(base, (request) =>
						createDraftPwa(page, request, PHASE7_PWA)
					);
					await withFreshRequest(base, (request) => typePwuTypes(page, request, PHASE7_PWA.types));
					const asTyped = typesAsTyped(
						(await freshIntrospect(base)).snapshot,
						pwaId,
						PHASE7_PWA.types
					);
					expect(asTyped.typed, 'the designer did not record the PWA as declared (§3.2)').toEqual(
						asTyped.expected
					);
					await withFreshRequest(base, (request) => publishThroughDesigner(page, request, pwaId));
					note(await screenshot(page, join(lane.screenshots, '00-published.png')));
					await createUndertakingThroughForm(page, PHASE7_UNDERTAKING);
					undertakingPath = new URL(page.url()).pathname;
					return unitsOf((await freshIntrospect(base)).snapshot, PHASE7_UNDERTAKING.name);
				},
				beginExecute: (unit) => beginExecute(page, unitRow(page, unit.title), actionFields),
				// ⭐ P7-6 B3 — its click bounded by its own timeout: the run plan's rule calls this hand too.
				showOverview: async () => {
					await gotoHydrated(page, undertakingPath);
					await page.getByRole('button', { name: 'overview', exact: true }).click({ timeout: PHASE7_UI_MS });
				},
				recordAssurance: (unit) => recordAssurance(page, unitRow(page, unit.title), actionFields),
				markSatisfied: (unit) => markSatisfied(page, unitRow(page, unit.title), actionFields),
				// ⭐ P7-6R R-1f — the run plan's rule's two hands: the row's offers, and one act on the row (`REG-D-105` (4)).
				recoveryOffers: (unit) => recoveryOffers(unitRow(page, unit.title)),
				recover: (unit, act) => recover(page, unitRow(page, unit.title), act, actionFields),
				read: () => freshIntrospect(base),
				archive: async (call) =>
					(
						await archiveUnit({
							archiveDir: join(lane.archive, call.name),
							storePath: store,
							undertakingId: call.undertakingId,
							unitId: call.unitId,
							introspect: call.dump,
							capturesBefore: call.capturesBefore,
							refusal: call.refusal,
							reviewedRunLimit: PHASE7_REVIEWED_COMMANDS,
							env: process.env
						})
					).captures,
				screenshot: (name) => screenshot(page, join(lane.screenshots, `${name}.png`))
			}
		});
		expect(
			laneVerdict(record),
			'the run is not the run it was meant to be (lane/run.json)'
		).toEqual([]);
	});
});
