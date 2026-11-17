/**
 * `sonar:compare` (JAN-SONARCM D-1, J2, J3; roadmap S1): two runs of the Sonar runner are compared only when each
 * records its engine, rule set and census, and both ran the same engine and rule set. Each refusal is a fixture that
 * fails alone, with its own message. The comparison matches findings per file as a multiset of (rule, message), and a
 * file either run did not analyse is listed as not compared, never as clean (J4).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { comparabilityProblems, compareRuns, loadRun, main, type FileResult, type RunRecord } from '../scripts/sonar/compare.js';

const scratch = mkdtempSync(join(tmpdir(), 'jpwb-sonar-compare-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const ENGINE = { extension: '6.3.0', languageServer: '6.3.0.79979', sonarjs: '14.4.0.46458', jre: '21.0.12.1' };
const RECORD: RunRecord = { status: 'complete', engine: ENGINE, ruleSet: { sha256: 'rules' }, census: { sha256: 'census' } };

let n = 0;
function runFolder(record: RunRecord, results: Record<string, FileResult>): string {
	const dir = join(scratch, `run-${++n}`);
	mkdirSync(dir);
	writeFileSync(join(dir, 'run.json'), JSON.stringify(record));
	writeFileSync(join(dir, 'results.json'), JSON.stringify(results));
	return dir;
}

const f = (rule: string, message: string, line = 1) => ({ rule, message, line });
const BEFORE = {
	'a.ts': { status: 'ok', findings: [f('typescript:S3776', 'from 21 to the 15 allowed', 3), f('typescript:S1', 'one', 9)] },
	'b.ts': { status: 'ok', findings: [] },
	'c.ts': { status: 'ok', findings: [f('typescript:S2', 'two')] }
};
const AFTER = {
	'a.ts': { status: 'ok', findings: [f('typescript:S3776', 'from 17 to the 15 allowed', 4), f('typescript:S1', 'one', 12)] },
	'b.ts': { status: 'ok', findings: [f('typescript:S107', 'too many', 7)] },
	'c.ts': { status: 'timeout', findings: [] }
};

describe('two comparable runs', () => {
	it('matches findings by rule and message, not by line, and lists a lower complexity as cleared and introduced', () => {
		const c = compareRuns(loadRun(runFolder(RECORD, BEFORE)), loadRun(runFolder(RECORD, AFTER)));
		expect(c.files).toEqual([
			{
				file: 'a.ts',
				before: 2,
				after: 2,
				cleared: [{ rule: 'S3776', message: 'from 21 to the 15 allowed', count: 1 }],
				introduced: [{ rule: 'S3776', message: 'from 17 to the 15 allowed', count: 1, lines: [4] }]
			},
			{ file: 'b.ts', before: 0, after: 1, cleared: [], introduced: [{ rule: 'S107', message: 'too many', count: 1, lines: [7] }] }
		]);
		expect([c.cleared, c.introduced]).toEqual([1, 2]);
	});

	it('lists a file a run did not analyse as not compared, never as clean (J4)', () => {
		const c = compareRuns(loadRun(runFolder(RECORD, BEFORE)), loadRun(runFolder(RECORD, AFTER)));
		expect(c.notCompared).toEqual([{ file: 'c.ts', why: 'the after run did not analyse it (timeout)' }]);
	});

	it('compares runs whose censuses differ, and says so', () => {
		const c = compareRuns(loadRun(runFolder(RECORD, BEFORE)), loadRun(runFolder({ ...RECORD, census: { sha256: 'grown' } }, AFTER)));
		expect(c.censusChanged).toBe(true);
	});
});

describe('runs that cannot be compared (J2, J3; V-15)', () => {
	const ok = () => loadRun(runFolder(RECORD, BEFORE));

	it('PREDICTED RED: two runs under different engines', () => {
		const other = loadRun(runFolder({ ...RECORD, engine: { ...ENGINE, sonarjs: '14.5.0.1' } }, AFTER));
		expect(comparabilityProblems(ok(), other)).toEqual(['the runs used different engines: sonarjs 14.4.0.46458 before, 14.5.0.1 after (J3)']);
	});

	it('PREDICTED RED: a run without its engine version', () => {
		const dir = runFolder({ ...RECORD, engine: { ...ENGINE, sonarjs: undefined } }, AFTER);
		expect(comparabilityProblems(ok(), loadRun(dir))).toEqual([`${dir}: no engine version recorded`]);
	});

	it("PREDICTED RED: a run without its rule set's hash", () => {
		const dir = runFolder({ ...RECORD, ruleSet: {} }, AFTER);
		expect(comparabilityProblems(ok(), loadRun(dir))).toEqual([`${dir}: no rule-set hash recorded`]);
	});

	it("PREDICTED RED: a run without its census's hash", () => {
		const dir = runFolder({ ...RECORD, census: {} }, AFTER);
		expect(comparabilityProblems(ok(), loadRun(dir))).toEqual([`${dir}: no census hash recorded`]);
	});

	it('refuses a refused run, and two runs under different rule sets', () => {
		const refused = runFolder({ ...RECORD, status: 'refused', refusal: 'the server applied other rule settings' }, {});
		expect(comparabilityProblems(ok(), loadRun(refused))).toEqual([`${refused}: the runner refused this run (the server applied other rule settings)`]);
		const control = loadRun(runFolder({ ...RECORD, ruleSet: { sha256: 'control' } }, AFTER));
		expect(comparabilityProblems(ok(), control)).toEqual(['the runs used different rule sets: a finding a dropped rule no longer reports is not cleared']);
	});
});

describe('the command', () => {
	const capture = () => {
		const out: string[] = [];
		const err: string[] = [];
		return { out, err, o: (s: string) => out.push(s), e: (s: string) => err.push(s) };
	};

	it('exits 0 with the comparison, 1 with --fail-on-introduced when something was introduced, 2 when refused', () => {
		const before = runFolder(RECORD, BEFORE);
		const after = runFolder(RECORD, AFTER);
		const a = capture();
		expect(main([before, after], a.o, a.e)).toBe(0);
		expect(a.out.join('')).toContain('TOTAL cleared 1 | introduced 2 | not compared 1');
		expect(main([before, after, '--fail-on-introduced'], capture().o, capture().e)).toBe(1);
		const b = capture();
		expect(main([before, runFolder({ ...RECORD, engine: { ...ENGINE, extension: '6.4.0' } }, AFTER)], b.o, b.e)).toBe(2);
		expect(b.err.join('')).toContain('sonar:compare refused: the runs used different engines: extension 6.3.0 before, 6.4.0 after (J3)');
	});

	it('limits the comparison to the files named', () => {
		const list = join(scratch, 'files.txt');
		writeFileSync(list, 'b.ts\n');
		const a = capture();
		expect(main([runFolder(RECORD, BEFORE), runFolder(RECORD, AFTER), '--files', list], a.o, a.e)).toBe(0);
		expect(a.out.join('')).toContain('TOTAL cleared 0 | introduced 1 | not compared 0');
	});
});
