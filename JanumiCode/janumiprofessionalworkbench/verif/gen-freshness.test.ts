// ⭐⭐ WHAT GATES THE CHECKER? — the freshness gate's own gate (JAN-EXEC `R11`, 2026-09-15).
//
// `REG-005` records a standing ratchet dying silently inside `verif/` for two days because nothing gated the
// gate. `gen:check` is a new instrument of exactly that kind: it reports a PASS, and the shape of its failure —
// a population that quietly becomes empty, a step it silently skips, a comparison that reads no files — is
// indistinguishable from success. Every assertion here exists because the corresponding failure would be
// invisible in the gate's own output.
//
// ⚠ IT IMPORTS THE CORE, NEVER THE DRIVER. `scripts/gen-freshness.ts` copies packages and runs generators at
// module scope; importing it would perform the work under test and every assertion would pass by construction.
// That is the `N-14` defect — `emit.ts` rewrites `schemas/` at import, which is why `schema-manifest.ts` exists
// beside it — and this split is the same repair applied before the defect could happen.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareTrees, genPackages, parseGen } from '../scripts/gen-freshness-core.js';

const ROOT = `${dirname(dirname(fileURLToPath(import.meta.url))).split('\\').join('/')}/`;

const rootScripts = (): Record<string, string> =>
	(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> })
		.scripts;

describe('R11 · the gen freshness gate is itself gated', () => {
	// ── THE POPULATION. A gate over nothing reports the same words as a gate over everything. ──────────────
	it('⛔ covers every workspace package that declares a `gen` script — DERIVED, not listed', () => {
		// THE MUTANT: make `genPackages` return `[]` (or filter on a name that matches nothing). The driver
		// prints "every generated artifact matches its source" and exits 0, which is a PASS over an empty set.
		// ⭑ The driver has its own floor for this too — it refuses an empty population — but a floor of ZERO and
		// a population of THREE are different claims, and only this test can tell them apart.
		const packages = genPackages(ROOT);
		expect(packages.map((p) => p.dir).sort((a, b) => Number(a > b) - Number(a < b))).toEqual([
			'packages/rph-contracts',
			'packages/rph-domain',
			'packages/rph-product-realization-pwa'
		]);
	});

	it('⛔ parses every generator step out of each package’s own `gen` script', () => {
		// The steps are DERIVED from `package.json`, so a generator added there is covered with no edit to the
		// gate. THE MUTANT: stop pushing into `generators`. Every package then runs zero generators, the copy is
		// byte-identical to the source because nothing regenerated it, and the comparison passes over a tree
		// that was never rebuilt — a green light produced by doing no work at all.
		const contracts = genPackages(ROOT).find((p) => p.dir === 'packages/rph-contracts')!;
		expect(contracts.generators).toEqual([
			'src/gen/gen-enums.ts',
			'src/gen/gen-objects.ts',
			'src/gen/gen-messages.ts',
			'src/gen/emit.ts'
		]);
		expect(contracts.formatted, 'and the formatter’s file list comes from gen:format, not from here').toEqual(
			['src/enums.ts', 'src/messages.ts', 'src/objects.ts']
		);
	});

	it('⛔ REFUSES a `gen` step it does not recognise, rather than skipping it', () => {
		// ⭐ THE HARD FAILURE IS THE DESIGN. A step silently skipped is a generated artifact silently uncompared,
		// which is precisely the false-record shape `N-14` records: a header claiming 107 artifacts over code
		// that read one. THE MUTANT: `continue` instead of throwing — a package could then add
		// `node tools/gen-extra.js` and its output would never be compared, with the gate still green.
		expect(() =>
			parseGen('packages/made-up', { gen: 'bun run src/gen/a.ts && node tools/other.js' })
		).toThrow(/does not recognise/);
		expect(() => parseGen('packages/made-up', { gen: '' })).toThrow(/runs no generator/);
		expect(
			() => parseGen('packages/made-up', { gen: 'bun run src/gen/a.ts && bun run gen:format', 'gen:format': 'biome format' }),
			'a formatter this gate cannot reproduce must stop it, not be approximated'
		).toThrow(/cannot reproduce/);
	});

	// ── THE COMPARISON. It must actually read bytes, in both directions. ───────────────────────────────────
	it('⛔ compares in BOTH directions — a file the generators stop emitting is caught too', () => {
		// A one-way loop over the regenerated tree cannot see a committed file the generators no longer produce;
		// it simply stays, describing a contract that no longer exists, and clients generated from it keep
		// honouring it. THE MUTANT: delete the second loop in `compareTrees`.
		const drifted = compareTrees(
			'packages/made-up',
			join(ROOT, 'packages/rph-contracts/vocab'),
			join(ROOT, 'packages/rph-contracts/schemas')
		);
		expect(drifted.some((d) => d.includes('NOT COMMITTED')), 'the regenerated-only direction').toBe(true);
		expect(drifted.some((d) => d.includes('the generators DELETE it')), 'the committed-only direction').toBe(
			true
		);
	});

	it('⛔ compares BYTES of the same-named file in each tree — ONE byte apart is drift', () => {
		// ⭐⭐ THE ASSERTION THIS SUITE'S FIRST DRAFT DID NOT HAVE, AND THE GAP IS THE FINDING. It checked both
		// MISSING-FILE directions and stopped there — so a `compareTrees` that read the committed file TWICE and
		// never opened the copy at all would have passed every test here while reporting "every generated
		// artifact matches its source" for a tree that was never regenerated. A broken instrument returning the
		// same answer for the subject and the control reads as agreement; that is the shape this register
		// records more than any other, and it was sitting in the instrument built to prevent it.
		//
		// ⚠ ONE BYTE, AND UTF-8 vs UTF-16 IS WHY. `compareTrees` uses `Buffer.equals` and never a text read,
		// because a line-ending difference is exactly one byte and a text comparison would report these two
		// files as identical — the failure mode that makes an instrument agree with the thing it is checking.
		const scratch = mkdtempSync(join(tmpdir(), 'jpwb-gen-freshness-spec-'));
		try {
			const committed = join(scratch, 'committed');
			const regenerated = join(scratch, 'regenerated');
			mkdirSync(committed);
			mkdirSync(regenerated);
			writeFileSync(join(committed, 'generated.ts'), 'export const N = 1;\n');
			writeFileSync(join(regenerated, 'generated.ts'), 'export const N = 2;\n');

			const drifted = compareTrees('packages/made-up', committed, regenerated);
			expect(drifted).toHaveLength(1);
			expect(drifted[0], 'and the message must name the file a reader has to go and look at').toContain(
				'packages/made-up/generated.ts'
			);
			expect(drifted[0], 'with both sizes, so a reader can see whether it is a rewrite or a nudge').toContain(
				'they differ'
			);

			// ⭐ THE CONTROL, WITH ITS OWN MUTANT. Without it, "compareTrees reports drift" is satisfied by a
			// function that reports drift for EVERYTHING — the `MU-FRESH-18-B` shape, a guard that refuses all
			// input and therefore proves nothing. THE MUTANT for this half: make `compareTrees` always push.
			// This line reddens and the assertions above stay green.
			writeFileSync(join(regenerated, 'generated.ts'), 'export const N = 1;\n');
			expect(compareTrees('packages/made-up', committed, regenerated)).toEqual([]);
		} finally {
			// ⚠ NOTHING IN HERE MAY THROW — the same rule the driver obeys, for the same reason.
			try {
				rmSync(scratch, { recursive: true, force: true });
			} catch {
				/* a leaked scratch directory is a smaller harm than a lost verdict */
			}
		}
	});

	// ── THE WIRING. An instrument nothing runs is a file. ──────────────────────────────────────────────────
	it('⛔ is wired into gate:fast, and the script it names exists', () => {
		const scripts = rootScripts();
		expect(scripts['gen:check'], 'the root command itself').toBe('bun run scripts/gen-freshness.ts');
		expect(scripts['gate:fast'], 'and the gate must actually run it').toContain('bun run gen:check');
		// ⚠ Read from disk: a command naming a script that is not there fails only when the gate is run, which
		// on a 14-step gate is minutes later and attributed to whatever ran last.
		expect(readFileSync(join(ROOT, 'scripts/gen-freshness.ts'), 'utf8')).toContain('compareTrees');
	});

	it('⛔ hands prettier the repository’s OWN config, not whatever it finds beside a scratch copy', () => {
		// ⭐ THE INSTRUMENT FAILURE THIS PREVENTS IS THE LOUD KIND, WHICH IS WHY IT IS EASY TO MISREAD. Prettier
		// resolves config by walking up from each FILE; from inside a scratch copy it may find a different one,
		// or none, and then formats with library defaults — spaces, double quotes — so EVERY generated file
		// reports drift. That reads as a catastrophic finding about the repository and is a fault in the
		// measuring device. THE MUTANT: drop `--config`.
		const driver = readFileSync(join(ROOT, 'scripts/gen-freshness.ts'), 'utf8');
		expect(driver).toContain("PRETTIER_CONFIG = `${ROOT}.prettierrc.json`");
		expect(driver).toContain("'--config',");
		// And the file it names is the one the repository actually formats with.
		expect(JSON.parse(readFileSync(join(ROOT, '.prettierrc.json'), 'utf8'))).toMatchObject({
			useTabs: true,
			singleQuote: true
		});
	});

	it('⛔ never regenerates inside the tree it is measuring', () => {
		// ⭐ `finally` DOES NOT RUN ON A KILL. The tempting implementation — snapshot, run `bun run gen`, diff,
		// restore — leaves regenerated files in the working tree when the run is interrupted, and the next commit
		// carries them as though someone authored them. The driver must write ONLY into a directory it made.
		const driver = readFileSync(join(ROOT, 'scripts/gen-freshness.ts'), 'utf8');
		expect(driver, 'the generators run against a copy, never the package').toContain('mkdtempSync');
		expect(driver, 'and the scratch root is the only thing removed').toContain('rmSync(scratch');
		expect(
			driver.includes("run(process.execPath, [generator], copy)"),
			'the generator is spawned with the COPY as its cwd'
		).toBe(true);
	});
});
