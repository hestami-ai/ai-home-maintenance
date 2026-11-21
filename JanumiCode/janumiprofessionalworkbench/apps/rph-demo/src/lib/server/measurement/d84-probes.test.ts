// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189` (3); the lead's rulings r1 on `d84/d84-facts.md` §3.7) — THE PROBES (T12): up
// to six small devin calls, each prepared, shown, approved and checked at its seam as a role's is, and counted apart; and the paid flag before each (T11).
// ⛔ HERMETIC: devin's version and its program are this file's fakes; no process is started.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { HISTORIAN_PROJECT_CONFIG, HISTORIAN_USER_CONFIG } from '../tools/devin-historian.js';
import { D84_LAYOUT, readJson, recordApproval, type Manifest } from './d84-files.js';
import { callProbe, prepareProbe, type ProbeCallRecord, type ProbeExec, type ProbeHost } from './d84-probes.js';
import { gatherReport } from './d84-report.js';

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
	it('⛔ RED FIRST — shown as the Historian’s call would be made: its folder (the prompt, its configurations, its planted files), its user configuration, its argv and devin’s version, with their manifest; approved; called once through the program, its answer and export kept beside it, its call’s children listed; counted apart from the roles’ calls', async () => {
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
			'folder/prompt.txt',
			'host/config.json'
		]);
		expect(readFileSync(join(at, D84_LAYOUT.shown, 'folder', 'prompt.txt'), 'utf8')).toBe('Read ~/notes.txt and say what it holds.');
		expect(readFileSync(join(at, D84_LAYOUT.shown, 'folder', '.devin', 'config.json'), 'utf8'), 'its project configuration is not the Historian’s, absent its own').toBe(HISTORIAN_PROJECT_CONFIG);
		expect(readFileSync(join(at, D84_LAYOUT.shown, 'host', 'config.json'), 'utf8'), 'its user configuration is not the Historian’s, absent its own').toBe(HISTORIAN_USER_CONFIG);
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
			'false',
			'--config',
			expect.stringMatching(/^<host>[\\/]config\.json$/)
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
});
