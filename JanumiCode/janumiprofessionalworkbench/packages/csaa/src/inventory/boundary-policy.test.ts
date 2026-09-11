import { createRequire } from 'node:module';
// `readFileSync` left with the two manifest assertions moved to JPWB in JAN-CSAAEXT S4 — see the note below.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectProductBoundary } from '../subject/product-boundary.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const require = createRequire(import.meta.url);
const temporaryRoots: string[] = [];

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('CSAA product dependency boundary', () => {
	// ⛔ THE TWO WIRING ASSERTIONS THAT STOOD HERE HAVE MOVED TO JPWB — JAN-CSAAEXT S4, 2026-09-11. They read:
	//     scripts.boundary      -> /^depcruise packages --config .* && bun run scripts\/csaa-product-boundary\.ts$/
	//     scripts['gate:fast']  -> /^bun run csaa:generated-context:check && bun run csaa:inventory:check && /
	// ⚠ MOVED, NOT DROPPED, AND BOTH REPLACEMENTS WERE GREEN BEFORE THESE WERE REMOVED — the programme's Rule 1,
	// SALVAGE BEFORE DECOUPLE. Their subject was JPWB's `package.json`, never CSAA's behaviour, and under
	// REG-D-061 `D-1` JPWB's gate no longer invokes CSAA, so both facts are false BY DESIGN.
	//   · the `boundary` shape  -> `verif/assurance-surface.test.ts` pins its EXACT value, and
	//     `verif/dependency-boundary-rules.test.ts:181-188` (JAN-CSAADEC `CD-01`) already pinned its prefix.
	//     ⚠ Note what that prefix pin could NOT see: it stayed green straight through the detachment, because a
	//     prefix match cannot notice a removed tail. The exact-value pin is what now owns the absence.
	//   · the `gate:fast` order -> `verif/assurance-surface.test.ts` pins the FULL ordered step list AND asserts
	//     no `csaa:` step appears anywhere in it. Strictly stronger: this one said CSAA came FIRST, the
	//     replacement says CSAA is ABSENT, so a re-added step reddens.
	// ⭑ `CD-02` deliberately declined to reproduce the `gate:fast` pin in JPWB because `CD-05` was going to make
	// it false. `CD-05` was withdrawn and `D-1` changed the composition instead, so the reason for that gap
	// expired and the pin was authored against the post-detachment shape rather than copied.

	it('rejects representative package and app imports of CSAA', () => {
		const config = require(`${ROOT}.dependency-cruiser.cjs`) as {
			forbidden: Array<{
				name: string;
				from: { path?: string };
				to: { path?: string };
			}>;
		};
		const rule = config.forbidden.find(
			(candidate) => candidate.name === 'product-does-not-import-csaa'
		);
		expect(rule).toBeDefined();
		const from = new RegExp(rule!.from.path!);
		const to = new RegExp(rule!.to.path!);
		expect(from.test('packages/rph-domain/src/index.ts')).toBe(true);
		expect(from.test('apps/rph-demo/src/lib/index.ts')).toBe(true);
		expect(to.test('packages/csaa/src/index.ts')).toBe(true);
		expect(from.test('packages/csaa/src/index.ts')).toBe(false);
	});

	it('excludes generated and ignored output trees from dependency observations', () => {
		const config = require(`${ROOT}.dependency-cruiser.cjs`) as {
			options: { exclude: { path: string } };
		};
		const exclude = new RegExp(config.options.exclude.path);
		for (const path of [
			'apps/rph-demo/.svelte-kit/generated/client/app.js',
			'apps/rph-demo/.turbo/cache.json',
			'packages/rph-domain/coverage/index.html',
			'packages/rph-domain/dist/index.js',
			'packages/rph-domain/node_modules/zod/index.js'
		]) {
			expect(exclude.test(path)).toBe(true);
		}
		expect(exclude.test('apps/rph-demo/src/lib/pwaFlow.ts')).toBe(false);
	});

	it('executes a non-vacuous focused scan over both product perimeters', () => {
		const result = inspectProductBoundary(ROOT);
		expect(result.perimeter).toEqual(['apps', 'packages']);
		expect(result.inspectedFiles).toBeGreaterThan(0);
		expect(result.violations).toEqual([]);
	});

	it('detects package-name and repository-relative CSAA imports in both product perimeters', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-boundary-'));
		temporaryRoots.push(root);
		write(root, 'packages/csaa/src/index.ts', 'export {};\n');
		write(root, 'packages/rph-fixture/src/index.ts', "import '@janumipwb/csaa';\n");
		write(root, 'apps/demo/src/index.ts', "import '../../../packages/csaa/src/index.js';\n");
		const result = inspectProductBoundary(root);
		expect(result.inspectedFiles).toBe(2);
		expect(result.violations).toEqual([
			{ moduleSpecifier: '../../../packages/csaa/src/index.js', path: 'apps/demo/src/index.ts' },
			{ moduleSpecifier: '@janumipwb/csaa', path: 'packages/rph-fixture/src/index.ts' }
		]);
	});

	it('follows repository-confined directory links and rejects perimeter links that escape', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-boundary-links-'));
		const outside = mkdtempSync(join(tmpdir(), 'csaa-boundary-outside-'));
		temporaryRoots.push(outside, root);
		write(root, 'packages/rph-fixture/src/index.ts', 'export {};\n');
		write(root, 'apps/demo/src/index.ts', 'export {};\n');
		write(root, 'shared/linked.ts', 'export const linked = true;\n');
		write(outside, 'escaped.ts', 'export const escaped = true;\n');
		symlinkSync(
			join(root, 'shared'),
			join(root, 'packages/rph-fixture/linked'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);

		expect(inspectProductBoundary(root)).toMatchObject({ inspectedFiles: 3, violations: [] });

		symlinkSync(
			outside,
			join(root, 'packages/rph-fixture/escape'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(() => inspectProductBoundary(root)).toThrow(
			'Product-boundary symlink escapes repository root: packages/rph-fixture/escape'
		);
	});
});
