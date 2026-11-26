// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189` (3); the lead's rulings r1 on `d84/d84-facts.md` §3.7) — THE PROBES (T12): up
// to six small devin calls, each prepared, shown, approved and checked at its seam as a role's is, and counted apart; and the paid flag before each (T11).
// ⛔ HERMETIC: devin's version and its program are this file's fakes; no process is started.
import { createHash } from 'node:crypto';
// ⭐ L17b4 (the lead's §15.5 (d), (e)) — ~~`import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync }
// from 'node:fs';`~~: and links, planted and read, and a folder copied.
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
// ⭐ L17b4 (design D93; the lead's L4-Q1) — ~~`import { HISTORIAN_PROJECT_CONFIG, HISTORIAN_USER_CONFIG } from '../tools/devin-historian.js';`~~: the
// Historian, and so each probe, is given no user configuration (REG-D-197).
import { HISTORIAN_PROJECT_CONFIG } from '../tools/devin-historian.js';
import { D84_LAYOUT, readJson, recordApproval, writeOnce, type Manifest } from './d84-files.js';
import { callProbe, prepareProbe, type ProbeCallRecord, type ProbeExec, type ProbeHost } from './d84-probes.js';
import { gatherReport } from './d84-report.js';

// ⭐ L17b4 (design D93; the lead's L4-Q6) — every folder `mkdtempSync` is asked to make, by its prefix: node's own, passed through, so a refused
// definition can be seen to make no probe folder at all. Hoisted: the mock's factory runs before this file's body.
// ⭐ L17b4 (the lead's §15.5 (e)) — and, by path, a lookup the test makes fail with a code of its own (`lstatFails`), so a lookup that fails for any
// reason but absence can be driven.
// ⭐ L17b4 (round 3, l17b4-facts.md §16.6) — ~~`lstatFails: new Map<string, string>()`~~: or `null`, an error whose code throws when read.
const made = vi.hoisted(() => ({ prefixes: [] as string[], lstatFails: new Map<string, string | null>() }));
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	return {
		...actual,
		mkdtempSync: ((prefix: string, options?: unknown) => {
			made.prefixes.push(prefix);
			return (actual.mkdtempSync as (p: string, o?: unknown) => string)(prefix, options);
		}) as typeof actual.mkdtempSync,
		// ⭐ L17b4 (§15.5 (e)) — node's own `lstatSync`, passed through, but for a path the test names, which fails with the code it names.
		lstatSync: ((path: string, options?: unknown) => {
			const code = made.lstatFails.get(String(path));
			// ⭐ L17b4 (round 3, §16.6) — `null`: an error whose `code` throws when read.
			if (code === null)
				throw Object.defineProperty(new Error('planted by the test'), 'code', {
					get: () => {
						throw new Error('its code cannot be read: planted by the test');
					}
				});
			if (code !== undefined) throw Object.assign(new Error(`${code}: planted by the test`), { code });
			return (actual.lstatSync as (p: string, o?: unknown) => unknown)(path, options);
		}) as typeof actual.lstatSync,
		// ⭐ L17b4 (§15.5 (d)) — node's own `cpSync`, passed through, but for a planted LINK, copied as `cpSync` copies one on a host that allows links: as a
		// link, its target verbatim (`verbatimSymlinks`). ⚠ On this host a file link and a folder link each need a privilege, and `cpSync` makes a folder link
		// of a junction (both EPERM, measured at round 3, l17b4-facts.md §16), so a junction is made here, which needs none.
		cpSync: ((source: string, destination: string, options?: unknown) => {
			if (!actual.lstatSync(source).isSymbolicLink()) return (actual.cpSync as (s: string, d: string, o?: unknown) => void)(source, destination, options);
			if (actual.existsSync(destination)) throw Object.assign(new Error('EEXIST: planted by the test'), { code: 'EEXIST' });
			actual.symlinkSync(actual.readlinkSync(source), destination, 'junction');
		}) as typeof actual.cpSync
	};
});
/** How many probe folders were made so far (`probeFolderFrom`'s own prefix). */
const probeFoldersMade = (): number => made.prefixes.filter((p) => p.includes('jpwb-d84-probe-')).length;

const TMP = mkdtempSync(join(tmpdir(), 'jpwb-d84-probes-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const fresh = (name: string): string => mkdtempSync(join(TMP, `${name}-`));
const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const VERSION = 'devin 3000.11.234 (92c83011d113)';
const flagOf = (args: readonly string[], flag: string): string => args[args.indexOf(flag) + 1] ?? '';

/** A probe's definition, as the lead writes one: its prompt, its bound, and optionally a project configuration and planted files. */
function defined(folder: string, name: string, o: { readonly prompt?: string; readonly listChildren?: boolean; readonly project?: string; readonly planted?: Readonly<Record<string, string>> } = {}): string {
	const definition = join(folder, D84_LAYOUT.probes, name, D84_LAYOUT.definition);
	mkdirSync(join(definition, 'files'), { recursive: true });
	writeFileSync(join(definition, 'prompt.txt'), o.prompt ?? `Probe ${name}: say what you can read.`);
	writeFileSync(join(definition, 'probe.json'), JSON.stringify({ boundMs: 120_000, ...(o.listChildren === undefined ? {} : { listChildren: o.listChildren }) }));
	if (o.project !== undefined) writeFileSync(join(definition, 'project-config.json'), o.project);
	for (const [path, text] of Object.entries(o.planted ?? {})) writeFileSync(join(definition, 'files', path), text);
	return definition;
}

/** The probes' host: devin's version, faked, and its children listed by a fake. */
const hostOf = (version: string = VERSION): ProbeHost => ({
	devinVersion: async () => version,
	model: 'fixture-assurance-model',
	childrenOf: async (pid) => [{ pid: pid + 1, name: 'node.exe' }]
});

/** A fake devin, as a probe's call runs it: what it was sent kept, its export written, its answer the case's; the process id it "started" told. */
function fakeDevin(answer: string) {
	const sent: { readonly program: string; readonly args: readonly string[]; readonly prompt: string; readonly folder: readonly string[] }[] = [];
	const exec: ProbeExec = async (file, args, options, started) => {
		started(4242);
		sent.push({ program: file, args: [...args], prompt: readFileSync(flagOf(args, '--prompt-file'), 'utf8'), folder: readdirSync(options.cwd).sort() });
		writeFileSync(flagOf(args, '--export'), JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [] }));
		return { stdout: answer };
	};
	return { exec, sent };
}

describe('⭐⭐ D84 (T12; `REG-D-189` (3)) — a probe, prepared and shown, approved, then called once through devin as the Historian’s call runs, counted apart', () => {
	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q10): ~~'⛔ RED FIRST — shown as the Historian’s call would be made: its folder (the prompt, its
	// configurations, its planted files), its user configuration, its argv and devin’s version, with their manifest; approved; called once through the
	// program, its answer and export kept beside it, its call’s children listed; counted apart from the roles’ calls'~~ — the Historian's launch passes
	// no user configuration (REG-D-197), so a probe in its form is shown none.
	it('⛔ RED FIRST — shown as the Historian’s call would be made: its folder (the prompt, its project configuration, its planted files), its argv, which names no user configuration, and devin’s version, with their manifest; approved; called once through the program, its answer and export kept beside it, its call’s children listed; counted apart from the roles’ calls', async () => {
		const folder = fresh('probe');
		defined(folder, '01-tilde', { prompt: 'Read ~/notes.txt and say what it holds.', listChildren: true, planted: { 'notes.txt': 'planted' } });
		const shown = await prepareProbe(folder, '01-tilde', hostOf());
		if ('refusedBecause' in shown) throw new Error(`the probe was not shown: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-tilde');
		const files = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name).slice(dir.length + 1).split('\\').join('/')).sort() : []);
		expect(files(join(at, D84_LAYOUT.shown)), 'the probe is not shown as its call would be made').toEqual([
			'argv.json',
			'devin-version.txt',
			'folder/.devin/config.json',
			'folder/notes.txt',
			'folder/prompt.txt'
			// ⭐ L17b4 (D93) — ~~`'host/config.json'`~~
		]);
		expect(readFileSync(join(at, D84_LAYOUT.shown, 'folder', 'prompt.txt'), 'utf8')).toBe('Read ~/notes.txt and say what it holds.');
		expect(readFileSync(join(at, D84_LAYOUT.shown, 'folder', '.devin', 'config.json'), 'utf8'), 'its project configuration is not the Historian’s, absent its own').toBe(HISTORIAN_PROJECT_CONFIG);
		// ⭐ L17b4 (D93) — ~~`expect(readFileSync(join(at, D84_LAYOUT.shown, 'host', 'config.json'), 'utf8'), 'its user configuration is not the Historian’s, absent
		// its own').toBe(HISTORIAN_USER_CONFIG);`~~ — nothing of the host folder is shown: it holds the export alone, which devin writes.
		expect(existsSync(join(at, D84_LAYOUT.shown, 'host')), 'something of the host folder is shown').toBe(false);
		const argv = JSON.parse(readFileSync(join(at, D84_LAYOUT.shown, 'argv.json'), 'utf8')) as { args: string[] };
		expect(argv.args, 'its argv is not the Historian’s call, its folders held').toEqual([
			'--print',
			'--model',
			'fixture-assurance-model',
			'--prompt-file',
			expect.stringMatching(/^<folder>[\\/]prompt\.txt$/),
			'--export',
			expect.stringMatching(/^<host>[\\/]export\.json$/),
			'--respect-workspace-trust',
			'false'
			// ⭐ L17b4 (D93) — ~~`'--config',`~~ ~~`expect.stringMatching(/^<host>[\\/]config\.json$/)`~~
		]);
		expect(readJson<Manifest>(join(at, D84_LAYOUT.manifest)), 'its manifest is not what it shows').toEqual(shown.shown);
		const unpaid = fakeDevin('unpaid');
		expect(await callProbe(folder, '01-tilde', hostOf(), unpaid.exec, {}), 'a probe was called without the flag').toEqual({
			refusedBecause: `JPWB_D84_PAID is not set, and D84 makes no call unless it is exactly "1" (REG-D-189; the lead's rulings r1, Q5)`
		});
		expect(await callProbe(folder, '01-tilde', hostOf(), unpaid.exec, { JPWB_D84_PAID: '1' }), 'a probe was called without its approval').toEqual({
			refusedBecause: 'no approval is recorded (approval.json): no call runs without its approval record (REG-D-189 (1))'
		});
		expect(unpaid.sent.length, 'devin ran for a refused probe').toBe(0);
		expect(recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved as shown.', approvedAt: 'now' })).toHaveProperty('recorded');

		const devin = fakeDevin('The file says: planted');
		const called = await callProbe(folder, '01-tilde', hostOf(), devin.exec, { JPWB_D84_PAID: '1' });

		if ('refusedBecause' in called) throw new Error(`the probe was not called: ${called.refusedBecause}`);
		expect(devin.sent.length, 'devin was not run once').toBe(1);
		expect(devin.sent[0]?.prompt, 'devin was not sent the prompt shown').toBe('Read ~/notes.txt and say what it holds.');
		expect(devin.sent[0]?.folder, 'devin did not start in the folder shown').toEqual(['.devin', 'notes.txt', 'prompt.txt']);
		expect(readFileSync(join(at, 'answer.txt'), 'utf8'), 'its answer is not kept beside it').toBe('The file says: planted');
		expect(existsSync(join(at, 'export.json')), 'its export is not kept beside it').toBe(true);
		const record = readJson<ProbeCallRecord>(join(at, D84_LAYOUT.call));
		expect([record?.outcome, record?.answerSha256, record?.pid, record?.childrenAfter], 'its call record does not say what came of it').toEqual([
			{ ran: true },
			sha256('The file says: planted'),
			4242,
			[{ pid: 4243, name: 'node.exe' }]
		]);
		const twice = await callProbe(folder, '01-tilde', hostOf(), devin.exec, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({
			threw: e instanceof Error ? e.message : String(e)
		}));
		expect(twice, 'a probe was called twice').toEqual({
			refusedBecause: 'the probe 01-tilde has been called: a probe is called once'
		});
		expect(gatherReport(folder).calls, 'the probe is not counted apart from the roles’ calls').toEqual({ reviewer: 0, executor: 0, probes: 1 });
	});

	it('⛔ RED FIRST — at most six: a seventh is refused before anything of it is made; a name not <NN>-<name>, a probe shown twice, a definition not whole and a devin at another version are each refused', async () => {
		const folder = fresh('six');
		for (let n = 1; n <= 6; n += 1) {
			const name = `0${n}-probe`;
			defined(folder, name);
			expect(await prepareProbe(folder, name, hostOf()), `arrangement: probe ${name} shown`).toHaveProperty('shown');
		}
		defined(folder, '07-probe');
		expect(await prepareProbe(folder, '07-probe', hostOf()), 'a seventh probe was shown').toEqual({
			refusedBecause: '6 probes are shown already, and D84 makes at most 6 (REG-D-189 (3))'
		});
		expect(existsSync(join(folder, D84_LAYOUT.probes, '07-probe', D84_LAYOUT.shown)), 'a refused probe was made').toBe(false);
		expect(await prepareProbe(folder, '01-probe', hostOf()), 'a probe was shown twice').toEqual({ refusedBecause: 'the probe 01-probe is shown already: a probe is shown once' });

		const other = fresh('names');
		expect(await prepareProbe(other, '../01-out', hostOf()), 'a name that leaves the probes’ folder was taken').toEqual({
			refusedBecause: 'a probe is named <NN>-<name>, and "../01-out" is not'
		});
		mkdirSync(join(other, D84_LAYOUT.probes, '01-empty', D84_LAYOUT.definition), { recursive: true });
		expect(await prepareProbe(other, '01-empty', hostOf()), 'a definition with no prompt was shown').toEqual({
			refusedBecause: 'the probe 01-empty\'s definition needs prompt.txt and a probe.json with a positive whole boundMs'
		});
		defined(other, '02-version');
		const versioned = await prepareProbe(other, '02-version', hostOf('devin 3000.12.1 (other)'));
		expect('refusedBecause' in versioned ? versioned.refusedBecause : 'it was not refused', 'a probe was shown for a devin at another version').toMatch(/^devin is at version 3000\.12\.1, and the Historian's two tool lists were measured at 3000\.11\.234/);
	});

	it('⛔ RED FIRST — r2 (`D84R-A01`): a probe whose call’s children cannot be listed after its call leaves no call record, and is not called again: its attempt, made before its program, refuses the second call with no program run', async () => {
		const folder = fresh('children');
		defined(folder, '01-children', { listChildren: true });
		const shown = await prepareProbe(folder, '01-children', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-children');
		recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		const devin = fakeDevin('the answer');
		const failing: ProbeHost = { ...hostOf(), childrenOf: async () => Promise.reject(new Error('the process table could not be read')) };
		const first = await callProbe(folder, '01-children', failing, devin.exec, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({ threw: e instanceof Error ? e.message : String(e) }));
		expect([first, existsSync(join(at, D84_LAYOUT.call)), devin.sent.length], 'arrangement: the listing threw after the paid call, and no call record was written').toEqual([
			{ threw: 'the process table could not be read' },
			false,
			1
		]);

		const again = await callProbe(folder, '01-children', hostOf(), devin.exec, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({ threw: e instanceof Error ? e.message : String(e) }));

		expect('refusedBecause' in again ? again.refusedBecause : JSON.stringify(again), 'a probe whose call left no record was called again').toContain(
			'an attempt was made on this copy and its record was never written: it is not called again here'
		);
		expect(devin.sent.length, 'devin ran a second time for one probe').toBe(1);
	});

	it('⛔ RED FIRST — r2 (`D84R-A01`): a probe holding an attempt and no call record is refused by its attempt before anything of its call is made again — its definition, gone since, never read; devin never run', async () => {
		const folder = fresh('attempted');
		const definition = defined(folder, '01-attempted');
		const shown = await prepareProbe(folder, '01-attempted', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-attempted');
		recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		// ⭑ The attempt a call writes before its program, and no record after it (a kill during the call, staged by the test); its definition gone since.
		writeOnce(join(at, 'attempt.json'), { manifestSha256: shown.shown.sha256, at: '2026-11-21T20:00:00.000Z' });
		rmSync(definition, { recursive: true, force: true });
		const devin = fakeDevin('never');

		const again = await callProbe(folder, '01-attempted', hostOf(), devin.exec, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({ threw: e instanceof Error ? e.message : String(e) }));

		expect(again, 'a probe holding an attempt was not refused by it first').toEqual({
			refusedBecause: "the probe 01-attempted: an attempt was made on this copy and its record was never written: it is not called again here (attempt.json, made at 2026-11-21T20:00:00.000Z; the lead's rulings r2, D84R-A01)"
		});
		expect(devin.sent.length, 'devin ran for a probe holding an attempt').toBe(0);
	});

	// ⭐ RESTATED (the lead's rulings r3): ~~'⛔ RED FIRST — r2 (`D84R-A02`): the six-probe count read again at the call — a seventh probe forced into
	// the folder, its manifest and approval written by the test, is refused at its call, devin never run; ⭑ CONTROL: the sixth is called'~~, whose
	// first expectation was ~~`{ refusedBecause: 'the probe 07-probe is the 7th of 7 probes shown, and D84 makes at most 6 (REG-D-189 (3)): it is not
	// called' }`~~. That count was by place among the probes shown, in name order, so a probe forced in by hand with a name before six already
	// called passed it (d84-facts.md §9.3, reading 2). The probes are counted by what is spent now: each holding an attempt, recorded or not.
	it('⛔ RED FIRST — r3: the probes counted at a call by what is spent — six called, then a probe forced in by hand and named before them all (`00-early`), its definition, manifest and approval written by the test, refused at its call, naming the six, devin never run and no attempt reserved; ⭑ CONTROL: with five attempted, the sixth is called once', async () => {
		const folder = fresh('spent');
		for (let n = 1; n <= 6; n += 1) {
			defined(folder, `0${n}-probe`);
			const shown = await prepareProbe(folder, `0${n}-probe`, hostOf());
			if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
			recordApproval(join(folder, D84_LAYOUT.probes, `0${n}-probe`), { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		}
		const devin = fakeDevin('an answer');
		for (let n = 1; n <= 5; n += 1) {
			const called = await callProbe(folder, `0${n}-probe`, hostOf(), devin.exec, { JPWB_D84_PAID: '1' });
			if (!('called' in called)) throw new Error(`arrangement: the probe 0${n}-probe is called — ${called.refusedBecause}`);
		}
		// ⭑ CONTROL: with five attempted, the sixth is called, once — devin run for it one time.
		const sixth = await callProbe(folder, '06-probe', hostOf(), devin.exec, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({ threw: e instanceof Error ? e.message : String(e) }));
		expect(['called' in sixth && sixth.called.outcome, devin.sent.length], '⭑ CONTROL: with five attempted, the sixth probe was not called once').toEqual([{ ran: true }, 6]);
		// ⭑ The probe forced in by hand: probe 01's definition and what it showed, copied in by name, and an approval of its manifest written by the test.
		const first = join(folder, D84_LAYOUT.probes, '01-probe');
		const early = join(folder, D84_LAYOUT.probes, '00-early');
		mkdirSync(join(early, D84_LAYOUT.definition), { recursive: true });
		for (const f of ['prompt.txt', 'probe.json']) copyFileSync(join(first, D84_LAYOUT.definition, f), join(early, D84_LAYOUT.definition, f));
		copyFileSync(join(first, D84_LAYOUT.manifest), join(early, D84_LAYOUT.manifest));
		writeOnce(join(early, D84_LAYOUT.approval), { ...readJson<Record<string, unknown>>(join(first, D84_LAYOUT.approval)) });

		const refused = await callProbe(folder, '00-early', hostOf(), devin.exec, { JPWB_D84_PAID: '1' }).catch((e: unknown) => ({ threw: e instanceof Error ? e.message : String(e) }));

		expect(refused, 'a probe was called with six attempted already').toEqual({
			refusedBecause:
				"the probe 00-early is not called: 6 probes hold an attempt already (01-probe, 02-probe, 03-probe, 04-probe, 05-probe, 06-probe), each a call made or begun, and D84 makes at most 6 (REG-D-189 (3); the lead's rulings r3)"
		});
		expect([devin.sent.length, existsSync(join(early, 'attempt.json'))], 'a probe called with six attempted ran devin, or reserved an attempt').toEqual([6, false]);
	});

	it('⛔ RED FIRST — checked at its seam: a definition changed after its approval refuses the call at the transport, devin never run, the refusal recorded; and a flag not exactly 1 refuses before anything', async () => {
		const folder = fresh('seam');
		const definition = defined(folder, '01-config');
		const shown = await prepareProbe(folder, '01-config', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-config');
		recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		const devin = fakeDevin('never');
		for (const value of ['0', 'true', ' 1', '1 ']) {
			const unpaid = await callProbe(folder, '01-config', hostOf(), devin.exec, { JPWB_D84_PAID: value });
			expect('refusedBecause' in unpaid ? unpaid.refusedBecause : 'it was called', `the flag ${JSON.stringify(value)} admitted a probe`).toContain(`JPWB_D84_PAID is ${JSON.stringify(value)}`);
		}
		writeFileSync(join(definition, 'prompt.txt'), 'Another prompt, never approved.');

		const called = await callProbe(folder, '01-config', hostOf(), devin.exec, { JPWB_D84_PAID: '1' });

		if ('refusedBecause' in called) throw new Error(`the call was refused before its seam: ${called.refusedBecause}`);
		expect(devin.sent.length, 'devin ran past its seam’s refusal').toBe(0);
		expect(called.called.outcome.failure ?? '', 'the seam’s refusal is not recorded').toMatch(/^D84 refused the probe at its transport: folder\/prompt\.txt: its bytes differ from what was approved/);
		expect(existsSync(join(at, 'answer.txt')), 'an answer was kept for a refused probe').toBe(false);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b4 — round 4 (the lead's §18 on `l17b4-facts.md`; `L4D-01`; `REG-F-685`) — A PROBE IS SHOWN devin's VERSION REPLY
	// BY ITS PARTS ALONE: its version (`<n>.<n>.<n>`), the build in the parentheses right after it (hex digits) and the reply's length, a part not found
	// named so; none of devin's words. ⛔ Before, its `devin-version.txt` was the reply whole.
	it('⛔ RED FIRST — L17b4 (§18; L4D-01): a probe is shown devin’s version reply by its parts alone — its version, the build in the parentheses right after it and its length — a part not found named so, and none of its words', async () => {
		/** A home folder named `fixture`, its parts joined here, so that no line of this file holds an absolute path. */
		const HOME = ['C:', 'Users', 'fixture'].join('\\');
		const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
		/** devin's version reply by its parts, as D84 shows it (the lead's §18), written out here in the ruling's words. */
		const partsShown = (version: string, build: string, length: number): string =>
			`devin --version, by its parts alone (REG-F-685): version ${version}; build ${build}; ${length} characters\n`;
		const cases: readonly (readonly [string, string, string])[] = [
			['its version, its build and words of its own', `${VERSION}\n ✓ Logged in as fixture@example.invalid.\n cache: ${HOME}\\.devin\n`, '92c83011d113'],
			['no build', 'devin 3000.11.234\n', 'not found'],
			['a build that is not hex digits', 'devin 3000.11.234 (built for fixture@example.invalid)\n', 'not found'],
			['hex digits in parentheses, not right after the version', 'devin 3000.11.234\n(92c83011d113)\n', 'not found']
		];
		for (const [what, reply, build] of cases) {
			const folder = fresh(`version-${what.replace(/\W+/g, '-')}`);
			defined(folder, '01-version');
			const shown = await prepareProbe(folder, '01-version', hostOf(reply));
			if ('refusedBecause' in shown) throw new Error(`${what}: the probe was not shown: ${shown.refusedBecause}`);
			const text = readFileSync(join(folder, D84_LAYOUT.probes, '01-version', D84_LAYOUT.shown, 'devin-version.txt'), 'utf8');
			expect.soft(text, `${what}: the shown version is not devin’s reply by its parts alone`).toBe(partsShown('3000.11.234', build, reply.length));
			expect.soft(text, `${what}: the shown version holds an e-mail address`).not.toMatch(EMAIL);
			expect.soft(text, `${what}: the shown version holds the home folder`).not.toContain(HOME);
		}
	});

	// ⭑ CONTROL — L17b4 round 4 (§18) — THE CHECK AT THE CALL COMPARES THE SAME PARTS: devin at another build than the one shown, its version and its
	// reply's length the same, is refused at the probe's seam, devin never run (as D84's T8 holds the Historian's).
	it('⭑ CONTROL — L17b4 (§18; L4D-01): at a probe’s call, devin at another build than the one shown, its version and its reply’s length the same, is refused at the seam, devin never run', async () => {
		const folder = fresh('version-build');
		defined(folder, '01-build');
		const shown = await prepareProbe(folder, '01-build', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-build');
		recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		const other = 'devin 3000.11.234 (0123456789ab)';
		expect(other.length, 'arrangement: the other build’s reply is as long as the one shown').toBe(VERSION.length);
		const devin = fakeDevin('never');
		const called = await callProbe(folder, '01-build', hostOf(other), devin.exec, { JPWB_D84_PAID: '1' });
		if ('refusedBecause' in called) throw new Error(`the call was refused before its seam: ${called.refusedBecause}`);
		expect(devin.sent.length, 'devin ran at another build than the one shown').toBe(0);
		expect(called.called.outcome.failure ?? '', 'the seam’s refusal does not name devin’s version').toMatch(
			/^D84 refused the probe at its transport: devin-version\.txt: its bytes differ from what was approved/
		);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b4 — round 5 (the lead's §20 on `l17b4-facts.md`; `L4E-01`) — THE BUILD IS READ WHOLE: the hex digits in the
	// parentheses, with no upper bound, compared exactly. ⛔ Before, a build of more than 64 hex digits read as "not found", so two such builds of the same
	// length, the version the measured one, showed the same line and passed the seam.
	it('⛔ RED FIRST — L17b4 (§20; L4E-01): a probe is shown a build of more than 64 hex digits whole, and at its call devin at another build of the same length is refused at the seam, devin never run', async () => {
		/** devin's version reply with a build of 65 of one hex digit: 85 characters. */
		const long = (digit: string): string => `devin 3000.11.234 (${digit.repeat(65)})`;
		const folder = fresh('version-long-build');
		defined(folder, '01-long');
		const shown = await prepareProbe(folder, '01-long', hostOf(long('a')));
		if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-long');
		expect
			.soft(readFileSync(join(at, D84_LAYOUT.shown, 'devin-version.txt'), 'utf8'), 'the build of more than 64 hex digits is not shown whole')
			.toBe(`devin --version, by its parts alone (REG-F-685): version 3000.11.234; build ${'a'.repeat(65)}; ${long('a').length} characters\n`);
		recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		expect(long('b').length, 'arrangement: the other build’s reply is as long as the one shown').toBe(long('a').length);
		const devin = fakeDevin('never');
		const called = await callProbe(folder, '01-long', hostOf(long('b')), devin.exec, { JPWB_D84_PAID: '1' });
		if ('refusedBecause' in called) throw new Error(`the call was refused before its seam: ${called.refusedBecause}`);
		expect.soft(devin.sent.length, 'devin ran at another build of more than 64 hex digits than the one shown').toBe(0);
		expect
			.soft(called.called.outcome.failure ?? '', 'the seam’s refusal does not name devin’s version')
			.toMatch(/^D84 refused the probe at its transport: devin-version\.txt: its bytes differ from what was approved/);
	});

	// ⭐⭐ L17b4 — design D93 (the lead's L4-Q6) — A PROBE RUNS AS THE HISTORIAN'S CALL RUNS, WHICH PASSES NO USER CONFIGURATION (`REG-D-197`), so a
	// definition's `user-config.json` would mean nothing: it is refused, naming the file, before any probe folder is made — at prepare, and at the call,
	// before its attempt is reserved.
	it('⛔ RED FIRST — L17b4 (D93; the lead’s L4-Q6): a probe definition holding user-config.json is refused as meaningless, naming the file — at prepare nothing shown, and at call, after a showing and an approval made without it, no attempt reserved and devin never run; no probe folder made either time', async () => {
		const folder = fresh('user-config');
		const first = defined(folder, '01-user');
		writeFileSync(join(first, 'user-config.json'), '{}');
		const before = probeFoldersMade();
		const refused = await prepareProbe(folder, '01-user', hostOf());
		const atFirst = join(folder, D84_LAYOUT.probes, '01-user');
		expect.soft('refusedBecause' in refused ? refused.refusedBecause : 'it was shown', 'a definition holding user-config.json was shown').toMatch(/user-config\.json/);
		expect.soft(existsSync(join(atFirst, D84_LAYOUT.shown)) || existsSync(join(atFirst, D84_LAYOUT.manifest)), 'something of it was shown').toBe(false);
		expect.soft(probeFoldersMade() - before, 'a probe folder was made at prepare for a refused definition').toBe(0);

		// ⭑ At the call: a probe shown and approved without the file, then given it before its call.
		const second = defined(folder, '02-user');
		const shown = await prepareProbe(folder, '02-user', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: a probe without user-config.json is shown — ${shown.refusedBecause}`);
		const atSecond = join(folder, D84_LAYOUT.probes, '02-user');
		recordApproval(atSecond, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		writeFileSync(join(second, 'user-config.json'), '{}');
		const devin = fakeDevin('never');
		const beforeCall = probeFoldersMade();
		const atCall = await callProbe(folder, '02-user', hostOf(), devin.exec, { JPWB_D84_PAID: '1' });
		expect.soft('refusedBecause' in atCall ? atCall.refusedBecause : 'it was called', 'a definition holding user-config.json was called').toMatch(/user-config\.json/);
		expect.soft([existsSync(join(atSecond, 'attempt.json')), existsSync(join(atSecond, D84_LAYOUT.call)), devin.sent.length], 'an attempt was reserved, a call recorded, or devin run').toEqual([
			false,
			false,
			0
		]);
		expect.soft(probeFoldersMade() - beforeCall, 'a probe folder was made at the call of a refused definition').toBe(0);
	});

	// ⭐⭐ L17b4 — the lead's §15.5 (e) (`L4C-A04`) — `user-config.json` IS FOUND BY `lstat`, WHICH FOLLOWS NO LINK: a dangling link of that name is refused as
	// the file is (`existsSync` follows it, and finds nothing). ⚠ A junction pointing nowhere: Windows makes one with no privilege.
	it('⛔ RED FIRST — L17b4 (§15.5 (e); L4C-A04): a definition whose user-config.json is a dangling link is refused as the file is — at prepare nothing shown, and at call no attempt and no devin; no probe folder made either time', async () => {
		const folder = fresh('dangling');
		const first = defined(folder, '01-dangling');
		symlinkSync(join(folder, 'nowhere'), join(first, 'user-config.json'), 'junction');
		expect(existsSync(join(first, 'user-config.json')), 'arrangement: the link points nowhere, so a lookup that follows it finds nothing').toBe(false);
		const before = probeFoldersMade();
		const refused = await prepareProbe(folder, '01-dangling', hostOf());
		const atFirst = join(folder, D84_LAYOUT.probes, '01-dangling');
		expect.soft('refusedBecause' in refused ? refused.refusedBecause : 'it was shown', 'a definition holding a dangling user-config.json link was shown').toMatch(/user-config\.json/);
		expect.soft(existsSync(join(atFirst, D84_LAYOUT.manifest)), 'something of it was shown').toBe(false);
		expect.soft(probeFoldersMade() - before, 'a probe folder was made at prepare for a refused definition').toBe(0);

		// ⭑ At the call: a probe shown and approved without the link, then given it before its call.
		const second = defined(folder, '02-dangling');
		const shown = await prepareProbe(folder, '02-dangling', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: a probe without user-config.json is shown — ${shown.refusedBecause}`);
		const atSecond = join(folder, D84_LAYOUT.probes, '02-dangling');
		recordApproval(atSecond, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		symlinkSync(join(folder, 'nowhere'), join(second, 'user-config.json'), 'junction');
		const devin = fakeDevin('never');
		const beforeCall = probeFoldersMade();
		const atCall = await callProbe(folder, '02-dangling', hostOf(), devin.exec, { JPWB_D84_PAID: '1' });
		expect.soft('refusedBecause' in atCall ? atCall.refusedBecause : 'it was called', 'a definition holding a dangling user-config.json link was called').toMatch(/user-config\.json/);
		expect.soft([existsSync(join(atSecond, 'attempt.json')), existsSync(join(atSecond, D84_LAYOUT.call)), devin.sent.length], 'an attempt was reserved, a call recorded, or devin run').toEqual([
			false,
			false,
			0
		]);
		expect.soft(probeFoldersMade() - beforeCall, 'a probe folder was made at the call of a refused definition').toBe(0);
	});

	// ⭐⭐ L17b4 — the lead's §15.5 (e) — A LOOKUP THAT FAILS FOR ANY REASON BUT ABSENCE REFUSES THE PROBE, naming the file and the error's code: a definition
	// that may hold the file is never taken for one that does not. The failure is this file's own (`lstatFails`): `EACCES`, for the definition's file alone.
	it('⛔ RED FIRST — L17b4 (§15.5 (e); L4C-A04): a lookup of user-config.json that fails for a reason but its absence refuses the probe, naming the file and the error’s code — no probe folder made', async () => {
		const folder = fresh('lookup');
		const definition = defined(folder, '01-lookup');
		made.lstatFails.set(join(definition, 'user-config.json'), 'EACCES');
		try {
			const before = probeFoldersMade();
			const refused = await prepareProbe(folder, '01-lookup', hostOf());
			expect
				.soft('refusedBecause' in refused ? refused.refusedBecause : 'it was shown', 'a definition whose user-config.json could not be looked up was shown')
				.toMatch(/user-config\.json[^]*EACCES/);
			expect.soft(probeFoldersMade() - before, 'a probe folder was made for a definition that could not be looked up').toBe(0);
		} finally {
			made.lstatFails.clear();
		}
	});

	// ⭐⭐ L17b4 — the lead's §15.5 (e) (round 3, l17b4-facts.md §16.6) — A LOOKUP ERROR'S CODE IS NAMED ONLY IN A NAME'S SHAPE, and a code that cannot be read
	// is no code: the refusal never carries free text, and nothing the lookup throws escapes (`userConfigLookup`, "It cannot throw").
	it('⛔ RED FIRST — L17b4 (§15.5 (e); L4C-A04): a lookup of user-config.json whose error’s code is free text, or cannot be read, refuses the probe naming no code — no free text rides in, and nothing the lookup throws escapes', async () => {
		const cases: readonly (readonly [string, string | null])[] = [
			['a code of free text', 'EACCES; and the prompt was: Judge'],
			['a code that throws when read', null]
		];
		for (const [what, code] of cases) {
			const folder = fresh(`lookup-${what.replace(/ /g, '-')}`);
			const definition = defined(folder, '01-lookup');
			made.lstatFails.set(join(definition, 'user-config.json'), code);
			try {
				const refused = await prepareProbe(folder, '01-lookup', hostOf()).catch((e: unknown) => ({ threw: e instanceof Error ? e.message : String(e) }));
				expect.soft('threw' in refused ? refused.threw : '(nothing escaped)', `${what}: what the lookup threw escaped`).toBe('(nothing escaped)');
				const said = 'refusedBecause' in refused ? refused.refusedBecause : 'it was shown';
				expect.soft(said, `${what}: the definition was shown, or its refusal named a code`).toMatch(/user-config\.json \(an error with no code\)/);
				expect.soft(said, `${what}: free text rode into the refusal`).not.toContain('the prompt was');
			} finally {
				made.lstatFails.clear();
			}
		}
	});

	// ⭐⭐ L17b4 — the lead's §15.5 (d) (`L4C-A03`, older than this package: D84's driver, in lines this package changed) — A PROBE'S PLANTED LINK IS SHOWN AND
	// CHECKED AS A LINK, by its kind and its target, never by the bytes it points to; its shown copy holds its target's text, as its manifest entry does.
	// ⚠ A junction, copied as a junction by this file's `node:fs` (above): this host gives a file link and a folder link no privilege.
	it('⛔ RED FIRST — L17b4 (§15.5 (d); L4C-A03): a probe’s planted link is shown as a link, by its kind and its target, and nothing it points to is shown', async () => {
		const folder = fresh('link');
		const definition = defined(folder, '01-link', { planted: { 'notes.txt': 'planted' } });
		const pointed = join(folder, 'pointed');
		mkdirSync(pointed);
		writeFileSync(join(pointed, 'inside.txt'), 'what the link points to');
		symlinkSync(pointed, join(definition, 'files', 'linked'), 'junction');
		const target = readlinkSync(join(definition, 'files', 'linked'));
		const shown = await prepareProbe(folder, '01-link', hostOf());
		if ('refusedBecause' in shown) throw new Error(`the probe was not shown: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-link');
		expect.soft(shown.shown.entries.filter((e) => e.path.startsWith('folder/linked')), 'the planted link is not shown as a link, by its kind and its target alone').toEqual([
			{ path: 'folder/linked', kind: 'link', bytes: Buffer.byteLength(target, 'utf8'), sha256: sha256(target), target }
		]);
		expect.soft(readFileSync(join(at, D84_LAYOUT.shown, 'folder', 'linked'), 'utf8'), 'the shown copy of the link does not hold its target, as its manifest entry does').toBe(target);
		expect.soft(JSON.stringify(shown.shown), 'what the link points to is shown').not.toContain('inside.txt');
	});

	// ⭐⭐ L17b4 — the lead's §15.5 (d) — AT THE CALL, A PLANTED LINK WHOSE KIND OR TARGET CHANGED IS REFUSED BEFORE devin RUNS AND BEFORE THE ATTEMPT IS
	// RESERVED, naming the link: retargeted at a folder with the same bytes, or a folder now with the same bytes, each passed a check by bytes alone.
	it('⛔ RED FIRST — L17b4 (§15.5 (d); L4C-A03): at the call, a planted link whose target changed, or that is a folder now, is refused before devin runs and before the attempt is reserved, naming the link', async () => {
		const changes: readonly (readonly [string, (link: string, other: string) => void])[] = [
			[
				'retargeted',
				(link, other) => {
					rmSync(link);
					symlinkSync(other, link, 'junction');
				}
			],
			[
				'a folder now',
				(link, other) => {
					rmSync(link);
					cpSync(other, link, { recursive: true });
				}
			]
		];
		for (const [what, change] of changes) {
			const folder = fresh(`link-${what.replace(/ /g, '-')}`);
			const definition = defined(folder, '01-link');
			const pointed = join(folder, 'pointed');
			const other = join(folder, 'other');
			for (const dir of [pointed, other]) {
				mkdirSync(dir);
				writeFileSync(join(dir, 'inside.txt'), 'the same bytes');
			}
			const link = join(definition, 'files', 'linked');
			symlinkSync(pointed, link, 'junction');
			const shown = await prepareProbe(folder, '01-link', hostOf());
			if ('refusedBecause' in shown) throw new Error(`${what}: the probe was not shown: ${shown.refusedBecause}`);
			const at = join(folder, D84_LAYOUT.probes, '01-link');
			recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
			change(link, other);
			const devin = fakeDevin('never');
			const called = await callProbe(folder, '01-link', hostOf(), devin.exec, { JPWB_D84_PAID: '1' });
			expect.soft('refusedBecause' in called ? called.refusedBecause : 'it was called', `${what}: the changed link was not refused, named`).toMatch(/folder\/linked: approved as a link to /);
			expect.soft([existsSync(join(at, 'attempt.json')), existsSync(join(at, D84_LAYOUT.call)), devin.sent.length], `${what}: an attempt was reserved, a call recorded, or devin run`).toEqual([
				false,
				false,
				0
			]);
		}
	});

	// ⭐⭐ L17b4 — the lead's §15.5 (d) (round 3, l17b4-facts.md §16.6) — AND THE OTHER CHANGES OF KIND, each refused before devin runs and before the attempt
	// is reserved, naming the path: a planted file that is a link now; a link where nothing was planted; and a planted link that is a file now, holding its
	// target's text, so a check by bytes alone passes. ⭑ The two whose probe holds no link at its showing come first.
	it('⛔ RED FIRST — L17b4 (§15.5 (d); L4C-A03): at the call, a planted file that is a link now, a link where nothing was planted, and a planted link that is a file now are each refused before devin runs and before the attempt is reserved, naming the path', async () => {
		const changes: readonly (readonly [string, Readonly<Record<string, string>>, boolean, (files: string, other: string) => void, RegExp])[] = [
			[
				'a link now, where a file was approved',
				{ 'notes.txt': 'planted' },
				false,
				(files, other) => {
					rmSync(join(files, 'notes.txt'));
					symlinkSync(other, join(files, 'notes.txt'), 'junction');
				},
				/folder\/notes\.txt: a link to .+ now, and approved as a file/
			],
			[
				'a link added, where nothing was approved',
				{},
				false,
				(files, other) => symlinkSync(other, join(files, 'extra'), 'junction'),
				/folder\/extra: a link to .+ now, and not in what was approved/
			],
			[
				'a file now',
				{},
				true,
				(files) => {
					const target = readlinkSync(join(files, 'linked'));
					rmSync(join(files, 'linked'));
					writeFileSync(join(files, 'linked'), target);
				},
				/folder\/linked: approved as a link to .+, and a file now/
			]
		];
		for (const [what, planted, linked, change, named] of changes) {
			const folder = fresh(`kind-${what.replace(/\W+/g, '-')}`);
			const definition = defined(folder, '01-kind', { planted });
			const other = join(folder, 'other');
			mkdirSync(other);
			writeFileSync(join(other, 'inside.txt'), 'the same bytes');
			if (linked) symlinkSync(other, join(definition, 'files', 'linked'), 'junction');
			const shown = await prepareProbe(folder, '01-kind', hostOf());
			if ('refusedBecause' in shown) throw new Error(`${what}: the probe was not shown: ${shown.refusedBecause}`);
			const at = join(folder, D84_LAYOUT.probes, '01-kind');
			recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
			change(join(definition, 'files'), other);
			const devin = fakeDevin('never');
			const called = await callProbe(folder, '01-kind', hostOf(), devin.exec, { JPWB_D84_PAID: '1' });
			expect.soft('refusedBecause' in called ? called.refusedBecause : 'it was called', `${what}: the changed path was not refused, named`).toMatch(named);
			expect.soft([existsSync(join(at, 'attempt.json')), existsSync(join(at, D84_LAYOUT.call)), devin.sent.length], `${what}: an attempt was reserved, a call recorded, or devin run`).toEqual([
				false,
				false,
				0
			]);
		}
	});

	// ⭐⭐ L17b4 — design D93 (`REG-F-685`) — A PROBE'S FAILED CALL IS RECORDED AS THE HISTORIAN'S IS: by its kind alone, never devin's words.
	it('⛔ RED FIRST — L17b4 (D93; REG-F-685): a probe whose devin fails, its error holding a command line under a home folder and a login banner, records its kind alone in its call record', async () => {
		const folder = fresh('failed');
		defined(folder, '01-failed');
		const shown = await prepareProbe(folder, '01-failed', hostOf());
		if ('refusedBecause' in shown) throw new Error(`arrangement: ${shown.refusedBecause}`);
		const at = join(folder, D84_LAYOUT.probes, '01-failed');
		recordApproval(at, { manifestSha256: shown.shown.sha256, words: 'Approved.', approvedAt: 'now' });
		const home = ['C:', 'Users', 'fixture'].join('\\');
		const stderr = ' ✓ Logged in as fixture@example.invalid.\n ✓ Organization: Your Organization\n';
		const email = /[^\s@]+@[^\s@]+\.[^\s@]+/;
		const rejection = Object.assign(
			new Error(`Command failed: devin --print --prompt-file ${[home, 'AppData', 'Local', 'Temp', 'jpwb-d84-probe-fixture', 'prompt.txt'].join('\\')}\n${stderr}`),
			{ code: 1, killed: false, signal: null, stdout: '', stderr }
		);
		expect([rejection.message.includes('Command failed'), rejection.message.includes(home), email.test(rejection.message)], 'arrangement: the error holds all three').toEqual([true, true, true]);
		const failing: ProbeExec = async (_file, _args, _options, started) => {
			started(4242);
			throw rejection;
		};

		const called = await callProbe(folder, '01-failed', hostOf(), failing, { JPWB_D84_PAID: '1' });

		if ('refusedBecause' in called) throw new Error(`the probe was refused before its call: ${called.refusedBecause}`);
		const record = readJson<ProbeCallRecord>(join(at, D84_LAYOUT.call));
		expect.soft(record?.outcome.failure, 'the probe’s failure is not recorded by its kind alone').toBe(
			"devin invocation failed (exited with code 1). Its diagnostic is not recorded (PER-12): execFile's message holds devin's command line, which " +
				"names the call's folder, and devin's stderr, which holds its login banner (REG-F-685)."
		);
		const text = JSON.stringify(record);
		expect.soft(text, 'its call record holds execFile’s words').not.toContain('Command failed');
		expect.soft(text, 'its call record holds the home folder').not.toContain(JSON.stringify(home).slice(1, -1));
		expect.soft(text, 'its call record holds an e-mail address').not.toMatch(email);
	});
});
