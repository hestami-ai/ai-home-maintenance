import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
	it('wires both package and app subjects into the executing boundary command', () => {
		const rootManifest = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(rootManifest.scripts.boundary).toMatch(
			/^depcruise packages --config .* && bun run scripts\/csaa-product-boundary\.ts$/
		);
		expect(rootManifest.scripts['gate:fast']).toMatch(
			/^bun run csaa:generated-context:check && bun run csaa:inventory:check && /
		);
	});

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
