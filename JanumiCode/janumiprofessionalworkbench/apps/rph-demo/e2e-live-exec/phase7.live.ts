import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test, expect } from '@playwright/test';
import { gotoHydrated } from '../e2e/support/harness';
import {
	actionFields,
	createDraftPwa,
	createUndertakingThroughForm,
	publishThroughDesigner,
	typePwuTypes,
	unitRowById
} from '../e2e/support/phase7-pwa';
import { PHASE7_PWA } from '../../../scripts/phase7/pwa-content';
import { PHASE7_HALF_B_DRAFT } from '../../../scripts/phase7/half-b';
import { archiveAuthoring, archiveUnit, AUTHORING_ARCHIVE } from '../../../scripts/phase7/run-archive';
import {
	LIVE_RUN_DIR_VARIABLE,
	PHASE7_PAID_VARIABLE,
	PHASE7_REVIEWED_COMMANDS,
	PHASE7_TEST_TIMEOUT_MS
} from './lane-config';
import {
	PHASE7_UI_MS,
	PHASE7_UNDERTAKING,
	acceptCandidate,
	beginExecute,
	designerAct,
	bootOf,
	declaredRerunOffered,
	freshIntrospect,
	laneVerdict,
	logPosts,
	markSatisfied,
	openLane,
	recordAssurance,
	recordAssuranceOffered,
	recover,
	recoveryOffers,
	rerunDeclared,
	runTheLane,
	screenshot,
	agentTurnOn,
	turnRunning,
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
// response and one archive-and-check cycle, ~~then the ROOT's sign-off by the paid run's own acts and the final archive
// (no model either; D11)~~ ⛔ `E12F` F1: FALSE SINCE E2, whose Record Assurance asks the reviewer once per declared policy —
// then the ROOT's sign-off REHEARSED UP TO THE REVIEWER CALL (`REG-D-112` (b): a dry run calls no model): the page loaded
// afresh, the root's row waited for, Record Assurance found on it and NOT pressed, the sign-off recorded not reached in a
// dry run; and the final archive — then stops, and PROVES the press and the rehearsal: the press answered `success` and
// read from the store as completed; the root's row offering Record Assurance, nothing pressed; and no model exchange
// recorded, counted after the sign-off (D5, D11; `laneVerdict`). ⚠ A dry run and the paid run never share a folder: a store is
// seeded only when empty, and command ids restart at every boot (D2).
//
// ── ⭐ THE ORDER (D3, D4, D5, D8, D11) — `runTheLane`, in `phase7-operator.ts`, on the HANDS this spec builds below ────
//   1. BOOT (D3): the inherited `JPWB_*`, `RPH_*` and `PI_*` variables, the config's overlay, the node version, and
//      devin's readiness — its version, and the configured model in its model list, no model called — into
//      `lane/boot.json`. Refused at boot, with every reason at once, as `refused-at-boot`.
//   2. The PWA, typed and read back from the store, then published; the Undertaking created; its five units read.
//   3. Begin & Execute on the ROOT, then on each PHASE in order, each started only after the one before has answered
//      (`REG-F-535`). Before each phase, the LIMIT (D8): the calls spent before, those this store records, and four held
//      for the negative control must total ~~under~~ ⭐ with the phase's ~~first call~~ ⭐ worst case, a model unit's (R3-B's
//      fix round, F1), AT MOST (the one rule, the lead's delegated decision of 2026-10-16, to be registered as REG-D-114)
//      the sponsor's limit — ~~150~~ ~~200 (`REG-D-105`
//      (1))~~ ⭐ 450 (`REG-D-110` (1)), `lane-config.ts`'s `PHASE7_PAID_LIMIT` — or the run ends `paid-limit`. Each press waits on its own
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
//      final archive, `06-final`. ⭐ `E12F` F2 — the LIMIT before each, the sign-off's own declared reviews counted at
//      their bound: a sign-off that would cross it is not pressed, nor is any later one, and the run ends `paid-limit`.
//      ⭐ `E12F` F3 — a Record Assurance answered with a refusal, whose row then offers re-running the declared reviews that
//      did not conclude, has them re-run once by the rule (`REG-D-105` (4), `REG-D-112` (a)), the limit read first, then
//      Mark Satisfied if it was accepted. ⛔ E12's re-review F1 — a sign-off act with NO ANSWER ends the run there, as a
//      Begin & Execute with none does (D4): nothing is pressed beside it, and the final archive is taken. Dry, no phase was
//      pressed, so the root's alone — ~~by these same acts (D11)~~ rehearsed up to the reviewer call, and nothing pressed
//      (`REG-D-112` (b)).
//
// ── ⭐⭐ `JAN-EXEC` Phase 7 completion programme, E3 — HALF B, `JPWB_PHASE7_HALF=B` (`DESIGN-phase-7-completion.md` §4) ─────
// The same lane, the PWA AUTHORED BY THE LIVE AGENT instead of typed (C1): the draft created through the page; the
// request — the run plan's, naming `wordfreq` (`REG-D-110` (4)) — sent from the designer's chat, and the page HELD THERE
// while the turn runs, for a turn whose page leaves is discarded; the candidate's status waited on through the store;
// "Accept exact candidate" pressed; Submit, Validate and Publish; then the Undertaking, whose units are READ FROM THE
// PUBLISHED PWA, root first, then the tree's order (C2), and run as in steps 3 to 5. The candidate checks run before
// Submit and refuse nothing (C4). `JPWB_AGENT_MODEL` is required, and recorded (C3); the timeout is extended once the
// units are read (`phase7HalfBTestTimeoutMs`). Dry, half B stops before Send: authoring is a model call (C6). The order
// is the operator's (`authorThePwa`), on the `author` hands below. ⚠ Unset or blank, the half is A: everything above.
// ⭐⭐ `REG-D-112` (E3's review): the LIMIT is checked before Send, the authoring floor's worst case counted, and before the
// root's press, a MODEL root's counted (finding 2); the store is ARCHIVED into `lane/archive/00-authoring` however the
// authoring ends, so even a run that stopped there is reported (finding 1); and every unit's row is found BY ITS ID,
// since a title may repeat (finding 5).
//
// ── ⚠ WHAT THIS SPEC ASSERTS, AND WHAT IT ONLY RECORDS ────────────────────────────────────────────────────────────────
// It asserts its OWN machinery (`laneVerdict`): the boot, the PWA as typed, one unit per type, the dry run's proof of the
// root's press and of its sign-off ⭐ rehearsed up to the reviewer call (D11; `E12F` F1) and its absence of any model call,
// and an end the run was meant to reach —
// `complete` paid, `dry-run-stop` dry. Everything the run is FOR — which phase completed, what each review said, what
// each command did — is recorded, never asserted: the report reads it (`scripts/phase7/run-report.ts`, D9), because a
// lane that stopped at a product's first refusal would measure nothing after it. ⛔ The forbidden acts (P7-3) are never
// pressed here: no step is completed, skipped or retried by hand, no waiver is asked, Mark Satisfied follows an accepted
// Record Assurance only ⭐ — or the rule's accepted re-run of the declared reviews a refused one left (`E12F` F3) — nothing
// is proposed again — ⭐ and nothing is abandoned but by the run plan's rule (step 4). ⚠ It never resets the engine and stipulates nothing:
// the store is durable, and the reviewer is real.

test.describe('LIVE — JAN-EXEC Phase 7: §3.2’s PWA, published, run as an Undertaking on the real executor and reviewer', () => {
	test('the run’s lane: boot, publish, the root then each phase, sign-off — archived and checked after each unit', async ({
		page,
		baseURL
	}) => {
		test.setTimeout(PHASE7_TEST_TIMEOUT_MS);
		// ⛔ NO ACT WAITS UNBOUNDED: this lane sets no action timeout, so a click on a button that never came would wait out
		// the ~~43-hour~~ ~~85-hour~~ ~~103-hour~~ ⭐ 116.6-hour test (P7-6 B4; `P76F-C` C8; `E12F` F2, F3). Begin & Execute and the sign-off acts pass bounds of their own ⭐ — and,
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
		// ⭐ E3 (C1, C3) — half B's turn on the page: Send, and the turn's own stream kept for the producer it names.
		const turn = agentTurnOn(page);

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
				// ⭐ `REG-D-112` (E3's review, finding 5) — EVERY ACT ON A UNIT FINDS ITS ROW BY THE UNIT'S ID (`unitRowById`), never by
				// its title: a type more than one parent permits gives its title to a unit under each.
				beginExecute: (unit) => beginExecute(page, unitRowById(page, unit.unitId!), actionFields),
				// ⭐ P7-6 B3 — its click bounded by its own timeout: the run plan's rule calls this hand too.
				showOverview: async () => {
					await gotoHydrated(page, undertakingPath);
					await page.getByRole('button', { name: 'overview', exact: true }).click({ timeout: PHASE7_UI_MS });
				},
				// ⭐ Waited for up to the bound the lane gives it, for the unit's declared policies (the lead's delegated decision of
				// 2026-10-16, to be registered as REG-D-114).
				recordAssurance: (unit, timeoutMs) =>
					recordAssurance(page, unitRowById(page, unit.unitId!), actionFields, timeoutMs),
				// ⭐ `E12F` F1 — the dry run's rehearsal: the row read, Record Assurance found and never pressed (`REG-D-112` (b)).
				recordAssuranceOffered: (unit) => recordAssuranceOffered(unitRowById(page, unit.unitId!)),
				// ⭐ `E12F` F3 — the rule's re-run of the declared reviews that did not conclude: the row's offer, and the act.
				declaredRerunOffered: (unit) => declaredRerunOffered(unitRowById(page, unit.unitId!)),
				rerunDeclared: (unit, timeoutMs) =>
					rerunDeclared(page, unitRowById(page, unit.unitId!), actionFields, timeoutMs),
				markSatisfied: (unit) => markSatisfied(page, unitRowById(page, unit.unitId!), actionFields),
				// ⭐ P7-6R R-1f — the run plan's rule's two hands: the row's offers, and one act on the row (`REG-D-105` (4)).
				recoveryOffers: (unit) => recoveryOffers(unitRowById(page, unit.unitId!)),
				recover: (unit, act) => recover(page, unitRowById(page, unit.unitId!), act, actionFields),
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
				// ⭐ `REG-D-112` (finding 1) — half B's authoring, archived however it ended, into `lane/archive/00-authoring`.
				archiveAuthoring: async (dump) => {
					await archiveAuthoring({ archiveDir: join(lane.archive, AUTHORING_ARCHIVE), storePath: store, introspect: dump });
				},
				screenshot: (name) => screenshot(page, join(lane.screenshots, `${name}.png`)),
				// ⭐⭐ E3 (C1) — HALF B's HANDS: the designer page, held where the turn is, and the clock. Every read of the store
				// while the turn runs is a fresh request context (`read`), never the page: a turn is discarded when its page leaves.
				author: {
					createDraft: () =>
						withFreshRequest(base, (request) => createDraftPwa(page, request, PHASE7_HALF_B_DRAFT)),
					send: (request) => turn.send(request),
					turnRunning: () => turnRunning(page),
					producerLine: () => turn.producer(),
					accept: () => acceptCandidate(page, actionFields),
					lifecycle: (act) => designerAct(page, act, actionFields),
					createUndertaking: async () => {
						await createUndertakingThroughForm(page, PHASE7_UNDERTAKING);
						undertakingPath = new URL(page.url()).pathname;
					},
					pause: (ms) => sleep(ms),
					now: () => Date.now()
				},
				// ⭐ E3 (C3) — half B's timeout, once its units are read: set afresh on the running test, from its start.
				extendTimeout: (ms) => test.info().setTimeout(ms)
			}
		});
		expect(
			laneVerdict(record),
			'the run is not the run it was meant to be (lane/run.json)'
		).toEqual([]);
	});
});
