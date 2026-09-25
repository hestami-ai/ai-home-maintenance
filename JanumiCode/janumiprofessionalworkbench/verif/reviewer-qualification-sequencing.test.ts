// ⛔ THE SEQUENCING PIN — no browser test may lean on a stipulated answer until the reviewer is being MEASURED
// (`JAN-CRITREAD` J1-2; `DESIGN-what-the-tests-prove.md` §6; `REG-D-071` Q9 (a), Q7 (d) (iii); `REG-D-072` D10).
//
// The lane goes green by STIPULATING what the structural checker cannot judge. That is honest only while something
// else measures whether a reviewer can earn the verdict the stipulation stands in for — qualification (Job 2). So
// this is red whenever a spec REGISTERS a stipulation while either of these is missing:
//   · `reviewer:qual:check` reachable from `gate:fast` — resolved through every `bun run <script>` it names, `cd`
//     included, and through a step runner that exports its `GATE_STEPS`;
//   · a RUN line in `docs/tracking/reviewer-qualification/` marked `deployable: true` — a candidate the product
//     could actually deploy was measured at least once (Q7 (d) (iii)).
//
// ⚠ IT MUST BE ABLE TO FAIL BEFORE THE CHECK EXISTS, which is why it lives HERE and not inside the check: an earlier
// revision of the design put this rule in the check itself, where there is no limb to redden before the check
// exists and both conditions always hold after. It runs in `bun run test`, which does not depend on the check.
//
// ⭑ THE HARNESS MODULE IS EXEMPT BY PATH — it defines the helper, so it names it by construction. The scan reads
// every `.ts` under `e2e/` and `e2e-live/` (not only `*.e2e.ts`), so the harness IS in the population and dropping
// its exemption reddens this file today (`REG-D-072` D10: scanning only `*.e2e.ts`, the exemption's mutant could
// never fail).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const REPO = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const SCANNED = ['apps/rph-demo/e2e', 'apps/rph-demo/e2e-live', 'apps/rph-demo/e2e-live-exec'];
const HARNESS = 'apps/rph-demo/e2e/support/harness.ts';
const REGISTERS = ['registerStipulation', '/test-api/reviewer-script'];
const CHECK = 'reviewer:qual:check';
const RECORDS = 'docs/tracking/reviewer-qualification';

function tsFiles(dir: string, acc: string[] = []): string[] {
	if (!existsSync(dir)) return acc;
	for (const name of readdirSync(dir)) {
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) tsFiles(p, acc);
		else if (/\.[cm]?ts$/.test(name)) acc.push(p);
	}
	return acc;
}

/** Every file under the scanned trees that registers a stipulation, repo-relative. */
export function registeringFiles(root: string): string[] {
	return SCANNED.flatMap((d) => tsFiles(`${root}/${d}`))
		.map((f) => f.slice(root.length + 1))
		.filter((rel) => rel !== HARNESS)
		.filter((rel) => REGISTERS.some((needle) => readFileSync(`${root}/${rel}`, 'utf8').includes(needle)));
}

function scriptsOf(root: string, cwd: string): Record<string, string> {
	const pkg = `${root}/${cwd === '.' ? '' : `${cwd}/`}package.json`;
	return existsSync(pkg) ? ((JSON.parse(readFileSync(pkg, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {}) : {};
}

/**
 * Every script NAME `gate:fast` reaches, following `bun run <script>` into the package whose directory the chain has
 * `cd`'d into, and following a step RUNNER (`bun run <file>.ts`) through its exported `GATE_STEPS`.
 */
export async function reachedScripts(root: string): Promise<Set<string>> {
	const reached = new Set<string>();
	const visit = async (command: string, startCwd: string): Promise<void> => {
		let cwd = startCwd;
		for (const raw of command.split('&&').map((s) => s.trim())) {
			const cd = /^cd\s+(\S+)$/.exec(raw);
			if (cd) {
				cwd = join(cwd, cd[1]!).replace(/\\/g, '/');
				continue;
			}
			const run = /^bun run\s+(\S+)/.exec(raw);
			if (!run) continue;
			const target = run[1]!;
			if (/\.[cm]?ts$/.test(target)) {
				const file = `${root}/${cwd === '.' ? '' : `${cwd}/`}${target}`;
				// ⚠ ONLY A DECLARED STEP RUNNER IS FOLLOWED. Importing a script runs its top-level code, and most of
				// the files `gate:fast` names (`gen-freshness.ts`, `coverage-floor.ts`) are checks that do work when
				// loaded. A runner that exports `GATE_STEPS` keeps its work behind `import.meta.main`.
				if (!existsSync(file) || !readFileSync(file, 'utf8').includes('export const GATE_STEPS')) continue;
				const mod = (await import(pathToFileURL(file).href)) as {
					GATE_STEPS?: readonly { cwd: string; script: string }[];
				};
				for (const step of mod.GATE_STEPS ?? []) {
					const key = `${step.cwd}:${step.script}`;
					if (reached.has(key)) continue;
					reached.add(step.script);
					reached.add(key);
					const body = scriptsOf(root, step.cwd)[step.script];
					if (body !== undefined) await visit(body, step.cwd);
				}
				continue;
			}
			const key = `${cwd}:${target}`;
			if (reached.has(key)) continue;
			reached.add(target);
			reached.add(key);
			const body = scriptsOf(root, cwd)[target];
			if (body !== undefined) await visit(body, cwd);
		}
	};
	await visit(`bun run gate:fast`, '.');
	return reached;
}

/** Whether a RUN line marked deployable exists in the qualification record. */
export function deployableRunExists(root: string): boolean {
	const dir = `${root}/${RECORDS}`;
	if (!existsSync(dir)) return false;
	return readdirSync(dir)
		.filter((f) => f.endsWith('.ndjson'))
		.flatMap((f) => readFileSync(`${dir}/${f}`, 'utf8').split('\n'))
		.filter((l) => l.trim() !== '')
		.some((l) => {
			try {
				const o = JSON.parse(l) as { kind?: unknown; deployable?: unknown };
				return o.kind === 'RUN' && o.deployable === true;
			} catch {
				return false;
			}
		});
}

/** The pin: empty when nothing registers, or when both conditions hold; otherwise, what is missing. */
export async function sequencingViolations(root: string): Promise<string[]> {
	const registering = registeringFiles(root);
	if (registering.length === 0) return [];
	const out: string[] = [];
	if (!(await reachedScripts(root)).has(CHECK))
		out.push(`${registering.join(', ')} register a stipulation, but gate:fast does not reach ${CHECK}`);
	if (!deployableRunExists(root))
		out.push(`${registering.join(', ')} register a stipulation, but ${RECORDS} holds no RUN marked deployable`);
	return out;
}

describe('⛔ no spec leans on a stipulated answer before the reviewer is measured', () => {
	it('⛔ THIS REPOSITORY — every registration is preceded by the check in gate:fast and a deployable run', async () => {
		expect(await sequencingViolations(REPO)).toEqual([]);
	});

	it('⭐ CONTROL — the resolver reaches through gate:fast today: the check and the browser tests, through gate:tail’s exported steps', async () => {
		const reached = await reachedScripts(REPO);
		expect(reached.has('coverage:floor:check')).toBe(true);
		// ⭐ `JAN-CRITREAD` J2-3: both now sit behind a step RUNNER (`scripts/gate-tail.ts`), so these two hold only while
		// the resolver follows its exported `GATE_STEPS` — the branch that, before J2-3, only a fixture could reach.
		expect(reached.has('.:reviewer:qual:check'), 'gate:tail → reviewer:qual:check, from the root').toBe(true);
		expect(reached.has('apps/rph-demo:e2e'), 'gate:tail → e2e, in apps/rph-demo').toBe(true);
	});
});

describe('⭐ CONTROL — the pin reddens on a fixture repository, and clears only when both conditions hold', () => {
	const roots: string[] = [];
	afterAll(() => {
		for (const r of roots)
			try {
				rmSync(r, { recursive: true, force: true });
			} catch {
				/* temp is the backstop */
			}
	});
	function fixture(opts: { gateReachesCheck: boolean; deployableRun: boolean; registers: boolean }): string {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-seqpin-')).replace(/\\/g, '/');
		roots.push(root);
		const gate = opts.gateReachesCheck ? 'bun run test && cd apps/rph-demo && bun run tail' : 'bun run test';
		writeFileSync(`${root}/package.json`, JSON.stringify({ scripts: { 'gate:fast': gate, test: 'vitest run' } }));
		mkdirSync(`${root}/apps/rph-demo/e2e/support`, { recursive: true });
		writeFileSync(
			`${root}/apps/rph-demo/package.json`,
			JSON.stringify({ scripts: { tail: 'bun run e2e && bun run reviewer:qual:check', e2e: 'playwright test' } })
		);
		writeFileSync(`${root}/${HARNESS}`, 'export async function registerStipulation() {}\n');
		writeFileSync(
			`${root}/apps/rph-demo/e2e/probe.e2e.ts`,
			opts.registers ? "await registerStipulation(request, pwaId, 'PWA_GRAPH');\n" : '// registers nothing\n'
		);
		if (opts.deployableRun) {
			mkdirSync(`${root}/${RECORDS}`, { recursive: true });
			writeFileSync(`${root}/${RECORDS}/runs.ndjson`, JSON.stringify({ kind: 'RUN', deployable: true }) + '\n');
		}
		return root;
	}

	it('⛔ a spec that registers before the check exists is red, and so is one with no deployable run', async () => {
		expect(await sequencingViolations(fixture({ registers: true, gateReachesCheck: false, deployableRun: false }))).toHaveLength(2);
		expect(await sequencingViolations(fixture({ registers: true, gateReachesCheck: true, deployableRun: false }))).toHaveLength(1);
		expect(await sequencingViolations(fixture({ registers: true, gateReachesCheck: false, deployableRun: true }))).toHaveLength(1);
	});

	it('⭐ both conditions — the check reached through a `cd` and a nested script, and a deployable run — clear it', async () => {
		expect(await sequencingViolations(fixture({ registers: true, gateReachesCheck: true, deployableRun: true }))).toEqual([]);
	});

	it('⭐ and nothing registering is never red — the harness that DEFINES the helper does not count', async () => {
		expect(await sequencingViolations(fixture({ registers: false, gateReachesCheck: false, deployableRun: false }))).toEqual([]);
	});

	/** The gate's tail as this repository now has it: a step RUNNER, its steps exported — or the same runner hiding them. */
	function tailFixture(steps: 'exported' | 'hidden'): string {
		const root = fixture({ registers: true, gateReachesCheck: false, deployableRun: true });
		writeFileSync(
			`${root}/package.json`,
			JSON.stringify({
				scripts: {
					'gate:fast': 'bun run test && cd apps/rph-demo && bun run check && cd ../.. && bun run gate:tail',
					test: 'vitest run',
					'gate:tail': 'bun run scripts/tail.ts',
					'reviewer:qual:check': 'bun --conditions=source scripts/check.ts'
				}
			})
		);
		mkdirSync(`${root}/scripts`, { recursive: true });
		const list = "[{ cwd: '.', script: 'reviewer:qual:check' }, { cwd: 'apps/rph-demo', script: 'e2e' }]";
		writeFileSync(
			`${root}/scripts/tail.ts`,
			steps === 'exported' ? `export const GATE_STEPS = ${list};\n` : `const steps = ${list};\nexport const run = () => steps;\n`
		);
		return root;
	}

	it('⭐ J2-3 — the check reached only through a step runner that EXPORTS its steps clears the pin; one that hides them does not', async () => {
		expect(await sequencingViolations(tailFixture('exported'))).toEqual([]);
		const hidden = await sequencingViolations(tailFixture('hidden'));
		expect(hidden).toHaveLength(1);
		expect(hidden[0]).toContain('gate:fast does not reach reviewer:qual:check');
	});
});
