// ⭐⭐ `JAN-EXEC` Phase 7 — design D84; the lead's rulings r2 (`D84R-A01` (b)) — ONE STEP AT A TIME IN A MEASUREMENT FOLDER: each step of the launcher
// (`runD84Step`) takes the folder's lock (`d84.lock`, written exclusively, holding its process id and the time) at its start and removes it at its end;
// a held lock refuses every other step, naming it, and a lock a kill left refuses too, with the words that tell the lead how to clear it — the driver
// never clears it itself.
// ⛔ HERMETIC: every folder is a temporary one this file makes; devin's version is this file's fake; no program runs.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D84_LAYOUT, writeOnce } from './d84-files.js';
import { nodeMeasurementHost, type MeasurementHost } from './d84-folder.js';
import { runD84Step, type StepHost } from './d84-steps.js';

const TMP = mkdtempSync(join(tmpdir(), 'jpwb-d84-steps-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const fresh = (name: string): string => mkdtempSync(join(TMP, `${name}-`));
const VERSION = 'devin 3000.11.234 (92c83011d113)';
const LOCK_WORDS = 'only one step runs at a time in a measurement folder';

/** A measurement folder begun as the begin step begins one (its record written by this test: the temporary folder is no place the begin step admits). */
function begun(): string {
	const folder = fresh('m');
	writeOnce(join(folder, D84_LAYOUT.state), { begunAt: 'then', checkoutHead: 'fixture', source: join(TMP, 'source'), unitId: 'pwu_x', earlierFolders: [] });
	return folder;
}

/** A host whose devin version waits on `gate` (a step then holds the folder while it waits); every other program this file never runs. */
function hostWith(gate: Promise<void> = Promise.resolve()): StepHost {
	return {
		deps: () => {
			throw new Error('arrangement: no step here opens the copy');
		},
		transports: {
			devinExec: async () => {
				throw new Error('arrangement: no program here');
			},
			openPi: async () => {
				throw new Error('arrangement: no program here');
			},
			devinVersion: async () => {
				await gate;
				return VERSION;
			}
		},
		probeExec: async () => {
			throw new Error('arrangement: no program here');
		},
		childrenOf: async () => [],
		folderHost: nodeMeasurementHost(),
		now: () => '2026-11-21T21:00:00.000Z',
		checkoutHead: () => 'fixture'
	};
}
const env = (folder: string, step: string, more: Readonly<Record<string, string>> = {}) => ({ JPWB_D84_FOLDER: folder, JPWB_D84_STEP: step, ...more });

/** Does `child` lie inside `parent`, or name it? */
const inside = (child: string, parent: string): boolean => {
	const rel = relative(resolve(parent), resolve(child));
	return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`) && !/^[A-Za-z]:/.test(rel));
};

/**
 * ⭑ A SANDBOX HOST, as `d84-folder.test.ts` makes one: the run folder's host over `root` alone — `root/repo` a repository, `root/tmp` the temporary
 * folder — and nothing outside `root` seen, so a folder in `root` is one the begin step's rules admit.
 */
function sandboxHost(root: string): MeasurementHost {
	mkdirSync(join(root, 'repo', '.git'), { recursive: true });
	mkdirSync(join(root, 'tmp'), { recursive: true });
	const seen = (p: string) => inside(p, root);
	return {
		platform: process.platform,
		configFile: join(root, 'repo', 'playwright.live-exec.config.ts'),
		tmpdir: () => join(root, 'tmp'),
		exists: (p) => seen(p) && existsSync(p),
		isDirectory: (p) => seen(p) && statSync(p, { throwIfNoEntry: false })?.isDirectory() === true,
		realpath: (p) => resolve(p),
		list: (p) => (seen(p) && existsSync(p) ? readdirSync(p) : []),
		mkdtemp: (prefix) => mkdtempSync(prefix)
	};
}

beforeEach(() => {
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐⭐ D84 (r2, `D84R-A01` (b)) — one step at a time in a measurement folder, by its lock', () => {
	it('⛔ RED FIRST — a lock held, or left by a kill, refuses a step, naming its process and time and how the lead clears it; the step does nothing, and the lock is never cleared by the driver', async () => {
		const folder = begun();
		writeFileSync(join(folder, 'd84.lock'), `${JSON.stringify({ pid: 424242, at: '2026-11-21T20:00:00.000Z', step: 'call' })}\n`);

		const refused = await runD84Step(env(folder, 'report'), hostWith());

		expect(refused.ok, 'a step ran in a folder another step holds').toBe(false);
		const said = refused.said.join('\n');
		for (const words of [LOCK_WORDS, '424242', '2026-11-21T20:00:00.000Z', 'delete', 'no driver process runs'])
			expect.soft(said, `the refusal does not say ${JSON.stringify(words)}`).toContain(words);
		expect([existsSync(join(folder, D84_LAYOUT.report)), existsSync(join(folder, 'd84.lock'))], 'a refused step wrote, or the driver cleared the lock').toEqual([false, true]);
	});

	it('⛔ RED FIRST — a second step while one runs is refused by the lock the first holds; ⭑ CONTROL: once the first ends, its lock is gone and the next step runs', async () => {
		const folder = begun();
		const definition = join(folder, D84_LAYOUT.probes, '01-held', D84_LAYOUT.definition);
		mkdirSync(definition, { recursive: true });
		writeFileSync(join(definition, 'prompt.txt'), 'Probe 01-held: say what you can read.');
		writeFileSync(join(definition, 'probe.json'), JSON.stringify({ boundMs: 120_000 }));
		let open: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		// ⭑ The first step: a probe's showing, held at devin's version, its lock taken.
		const first = runD84Step(env(folder, 'probe-prepare', { JPWB_D84_PROBE: '01-held' }), hostWith(gate));
		// ⭐ Its message a claim, no arrangement's: the first step takes the folder's lock at its start (`P6X-D84-M58` reddens it).
		await vi.waitFor(() => expect(existsSync(join(folder, 'd84.lock')), 'the first step did not take the folder’s lock at its start').toBe(true), { timeout: 10_000 });
		const lock = JSON.parse(readFileSync(join(folder, 'd84.lock'), 'utf8')) as { pid?: unknown; at?: unknown };

		const second = await runD84Step(env(folder, 'report'), hostWith());

		expect([second.ok, second.said.join('\n').includes(LOCK_WORDS)], 'a second step ran beside the first').toEqual([false, true]);
		expect([lock.pid, typeof lock.at], 'the lock does not hold the process id and the time').toEqual([process.pid, 'string']);
		expect(existsSync(join(folder, D84_LAYOUT.report)), 'the refused step wrote its report').toBe(false);
		open();
		const done = await first;
		expect(done.ok, `arrangement: the first step ran — ${done.said.join('\n')}`).toBe(true);
		expect(existsSync(join(folder, 'd84.lock')), '⭑ CONTROL: the first step’s lock was left after it ended').toBe(false);
		const next = await runD84Step(env(folder, 'report'), hostWith());
		expect(next.ok, `⭑ CONTROL: the step after a finished one did not run — ${next.said.join('\n')}`).toBe(true);
		expect(existsSync(join(folder, 'd84.lock')), '⭑ CONTROL: the second step’s lock was left after it ended').toBe(false);
	});

	it('⛔ RED FIRST — a refused step still removes its own lock; a folder not begun takes no lock; and a begin is refused before any lock where the folder is refused', async () => {
		const folder = begun();
		const refused = await runD84Step(env(folder, 'approve', { JPWB_D84_ROLE: 'nobody' }), hostWith());
		expect([refused.ok, existsSync(join(folder, 'd84.lock'))], 'a refused step left its lock').toEqual([false, false]);
		const bare = fresh('bare');
		expect(await runD84Step(env(bare, 'report'), hostWith()), 'a step ran in a folder not begun').toEqual({
			ok: false,
			said: ['the measurement folder is not begun (d84.json): run the begin step first']
		});
		expect(existsSync(join(bare, 'd84.lock')), 'a folder not begun was locked').toBe(false);
		const inTmp = fresh('begin-in-tmp');
		const begin = await runD84Step(env(inTmp, 'begin', { JPWB_D84_SOURCE: join(TMP, 'nowhere'), JPWB_D84_UNIT: 'pwu_x' }), hostWith());
		expect([begin.ok, existsSync(join(inTmp, 'd84.lock')), existsSync(join(inTmp, D84_LAYOUT.state))], 'a refused begin locked, or began, its folder').toEqual([false, false, false]);
	});

	it('⛔ RED FIRST — a step that throws still removes its lock, in its `finally`', async () => {
		const folder = begun();
		// ⭑ A record that is not JSON: the report step's reading of it throws (`readJson` never reads such a record as absent).
		writeFileSync(join(folder, D84_LAYOUT.case), 'not JSON');

		const thrown = await runD84Step(env(folder, 'report'), hostWith()).then(
			(o) => `it did not throw: ${o.said.join('\n')}`,
			(e: unknown) => (e instanceof Error ? e.name : String(e))
		);

		expect(thrown, 'arrangement: the step threw').toBe('SyntaxError');
		expect(existsSync(join(folder, 'd84.lock')), 'a step that threw left its lock').toBe(false);
	});

	it('⛔ RED FIRST — the begin step takes the lock too: a lock left by a kill in a folder the rules admit refuses its begin, naming it, its record not written; ⭑ CONTROL: a begin in an empty folder is begun, no lock left', async () => {
		const root = fresh('sandbox');
		const host: StepHost = { ...hostWith(), folderHost: sandboxHost(root) };
		const beginIn = (folder: string) => runD84Step(env(folder, 'begin', { JPWB_D84_SOURCE: join(root, 'archive', '06-final'), JPWB_D84_UNIT: 'pwu_x' }), host);
		// ⭑ The CONTROL first: the begin's own lock, held as its record is written, is no name of the folder's.
		const empty = join(root, 'empty');
		mkdirSync(empty);
		const control = await beginIn(empty);
		expect([control.ok, existsSync(join(empty, D84_LAYOUT.state)), existsSync(join(empty, 'd84.lock'))], `⭑ CONTROL: a begin in an empty folder was refused, or left its lock — ${control.said.join('\n')}`).toEqual([
			true,
			true,
			false
		]);
		const held = join(root, 'held');
		mkdirSync(held);
		writeFileSync(join(held, 'd84.lock'), `${JSON.stringify({ pid: 434343, at: '2026-11-21T20:00:00.000Z', step: 'begin' })}\n`);

		const refused = await beginIn(held);

		expect([refused.ok, refused.said.join('\n').includes(LOCK_WORDS), existsSync(join(held, D84_LAYOUT.state))], 'a begin ran in a folder another step holds').toEqual([false, true, false]);
		expect(existsSync(join(held, 'd84.lock')), 'the driver cleared a lock it did not take').toBe(true);
	});
});
