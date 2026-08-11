import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { collectInventory } from './collect-inventory.js';
import { projectSubjectForInventory } from './project-subject-for-inventory.js';
import {
	GENERATED_REGION_BEGIN,
	GENERATED_REGION_END,
	replaceGeneratedRegion,
	runInventory
} from './run-inventory.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const temporaryRoots: string[] = [];

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-inventory-'));
	temporaryRoots.push(root);
	write(
		root,
		'package.json',
		JSON.stringify({
			name: 'fixture-workbench',
			private: true,
			scripts: { 'check-types': 'tsc --noEmit', test: 'vitest run' },
			workspaces: ['packages/*', 'apps/*']
		})
	);
	write(
		root,
		'packages/demo/package.json',
		JSON.stringify({
			name: '@fixture/demo',
			private: true,
			scripts: { build: 'tsc' },
			version: '0.0.0'
		})
	);
	write(root, 'packages/demo/src/index.ts', 'export const value = 1;\n');
	write(
		root,
		'packages/demo/tsconfig.json',
		'{ "compilerOptions": { "strict": true }, "include": ["src"] }\n'
	);
	write(
		root,
		'apps/demo/package.json',
		JSON.stringify({ name: '@fixture/app', private: true, version: '0.0.0' })
	);
	write(root, 'apps/demo/src/index.ts', 'export const app = true;\n');
	write(root, 'verif/example.test.ts', 'export const verification = true;\n');
	write(root, 'scripts/tool.ts', 'export const tool = true;\n');
	write(root, 'tsconfig.json', '{ "include": [] }\n');
	write(root, 'bun.lock', '    "typescript": ["typescript@5.9.3", ""],\n');
	write(
		root,
		'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md',
		`before\r\n${GENERATED_REGION_BEGIN}\r\nold\r\n${GENERATED_REGION_END}\r\nafter\r\n`
	);
	return root;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('inventory discovery and identity', () => {
	it('derives a non-empty inventory and exact domain-separated subject identity', () => {
		const root = fixture();
		const inventory = collectInventory({ repositoryRoot: root });
		expect(inventory.workspaces.map((workspace) => workspace.name)).toEqual([
			'@fixture/app',
			'@fixture/demo'
		]);
		expect(inventory.typescriptProjects.map((project) => project.path)).toEqual([
			'packages/demo/tsconfig.json',
			'tsconfig.json'
		]);
		expect(inventory.verificationAssets).toHaveLength(2);
		expect(inventory.subject.selectedFileCount).toBeGreaterThan(0);
		expect(inventory.subject.subjectId).toBe(projectSubjectForInventory(root).descriptor.subjectId);
	});

	it('distinguishes a locked tool from configuration, gate wiring, and a CSAA adapter', () => {
		const inventory = collectInventory({ repositoryRoot: fixture() });
		const typescript = inventory.providers.find((provider) => provider.name === 'typescript');
		const dependencyCruiser = inventory.providers.find(
			(provider) => provider.name === 'dependency-cruiser'
		);
		expect(typescript).toMatchObject({
			adapterState: 'INVENTORY_INTEGRATED',
			configurationState: 'CONFIGURED',
			gateState: 'NOT_GATE_WIRED',
			installationState: 'LOCKED',
			version: '5.9.3'
		});
		expect(dependencyCruiser).toMatchObject({
			adapterState: 'UNIMPLEMENTED',
			configurationState: 'NOT_CONFIGURED',
			gateState: 'NOT_GATE_WIRED',
			installationState: 'NOT_LOCKED'
		});
	});

	it('rejects malformed and duplicate workspace manifests', () => {
		const malformed = fixture();
		write(malformed, 'packages/demo/package.json', '{ not-json');
		expect(() => collectInventory({ repositoryRoot: malformed })).toThrow(
			'Workspace manifest is malformed'
		);

		const duplicate = fixture();
		write(
			duplicate,
			'packages/other/package.json',
			JSON.stringify({ name: '@fixture/demo', private: true, version: '0.0.0' })
		);
		expect(() => collectInventory({ repositoryRoot: duplicate })).toThrow(
			'Workspace name @fixture/demo is ambiguous'
		);
	});

	it('fails closed on malformed root-manifest and coverage configuration shapes', () => {
		const unreadable = fixture();
		write(unreadable, 'package.json', '{ not-json');
		expect(() => collectInventory({ repositoryRoot: unreadable })).toThrow(
			'CSAA subject resolution incompatible: CONFIG_MALFORMED: Root package.json is not valid JSON.'
		);

		const nonObject = fixture();
		write(nonObject, 'package.json', '[]');
		expect(() => collectInventory({ repositoryRoot: nonObject })).toThrow(
			'root manifest package.json must be a JSON object'
		);

		const invalidScript = fixture();
		write(
			invalidScript,
			'package.json',
			JSON.stringify({
				name: 'fixture-workbench',
				private: true,
				scripts: { test: true },
				workspaces: ['packages/*', 'apps/*']
			})
		);
		expect(() => collectInventory({ repositoryRoot: invalidScript })).toThrow(
			'package.json#/scripts.test must be a string'
		);

		const invalidInclude = fixture();
		write(
			invalidInclude,
			'vitest.config.ts',
			'export default { test: { coverage: { include: [true] } } };\n'
		);
		expect(() => collectInventory({ repositoryRoot: invalidInclude })).toThrow(
			'vitest coverage include must be an array of strings'
		);

		const invalidThresholds = fixture();
		write(
			invalidThresholds,
			'vitest.config.ts',
			'export default { test: { coverage: { thresholds: [95] } } };\n'
		);
		expect(() => collectInventory({ repositoryRoot: invalidThresholds })).toThrow(
			'coverage thresholds must be a JSON object'
		);
	});

	it('reads only closed literal coverage configuration from the TypeScript AST', () => {
		const root = fixture();
		write(
			root,
			'vitest.config.ts',
			[
				'export default {',
				'  test: { coverage: {',
				'    provider: `v8`,',
				"    include: ['packages/*/src/**/*.ts'],",
				'    exclude: [],',
				'    thresholds: { statements: 95, branches: 83 },',
				'    1: true,',
				'    disabled: false',
				'  } }',
				'};'
			].join('\n')
		);
		const literal = collectInventory({ repositoryRoot: root });
		expect(literal.assuranceSurfaces.coverage).toMatchObject({
			exclude: [],
			include: ['packages/*/src/**/*.ts'],
			provider: 'v8',
			thresholds: { branches: 83, statements: 95 }
		});

		write(
			root,
			'vitest.config.ts',
			'const inherited = {}; export default { test: { coverage: { ...inherited } } };\n'
		);
		expect(collectInventory({ repositoryRoot: root }).assuranceSurfaces.coverage).toMatchObject({
			include: [],
			provider: null,
			thresholds: {}
		});

		write(
			root,
			'vitest.config.ts',
			"const key = 'coverage'; export default { test: { [key]: {} } };\n"
		);
		expect(
			collectInventory({ repositoryRoot: root }).assuranceSurfaces.coverage.provider
		).toBeNull();

		write(
			root,
			'vitest.config.ts',
			"const provider = 'v8'; export default { test: { coverage: { provider } } };\n"
		);
		expect(
			collectInventory({ repositoryRoot: root }).assuranceSurfaces.coverage.provider
		).toBeNull();
	});

	it('excludes derived output while responding to a synthetic workspace mutation', () => {
		const root = fixture();
		const before = collectInventory({ repositoryRoot: root });
		write(root, 'packages/demo/dist/ignored.ts', 'export const ignored = true;\n');
		write(root, 'apps/demo/e2e-results/trace.zip', 'sensitive derived trace\n');
		write(root, 'apps/demo/test-results/result.json', '{"derived":true}\n');
		write(root, 'apps/demo/playwright-report/index.html', '<p>derived</p>\n');
		write(root, 'scripts/mutants/.harvest.json', '{"transient":true}\n');
		write(root, 'scripts/mutants/.harvest-run.json', '{"transient":true}\n');
		write(root, 'scripts/mutants/.in-flight', 'transient journal\n');
		write(root, 'packages/demo/.env', 'TOKEN=secret-one\n');
		write(root, 'apps/demo/.env.local', 'TOKEN=secret-two\n');
		write(root, 'apps/demo/package/derived.js', 'export const derived = true;\n');
		write(root, 'apps/demo/vite.config.ts.timestamp-123.mjs', 'export default {};\n');
		write(root, 'packages/demo/tsconfig.tsbuildinfo', 'derived compiler state\n');
		const withExcluded = collectInventory({ repositoryRoot: root });
		expect(withExcluded.subject.fileManifestDigest).toBe(before.subject.fileManifestDigest);
		expect(
			withExcluded.subject.selectedFiles.some((file) =>
				/(?:\/dist\/|\/e2e-results\/|\/test-results\/|\/playwright-report\/)/.test(file.path)
			)
		).toBe(false);
		expect(
			withExcluded.subject.selectedFiles.some((file) =>
				/scripts\/mutants\/\.(?:harvest|in-flight)/.test(file.path)
			)
		).toBe(false);
		expect(
			withExcluded.subject.selectedFiles.some((file) => /(?:^|\/)\.env(?:\.|$)/.test(file.path))
		).toBe(false);
		expect(
			withExcluded.subject.selectedFiles.some((file) =>
				/(?:\/package\/|\.tsbuildinfo$|vite\.config\.(?:js|ts)\.timestamp-)/.test(file.path)
			)
		).toBe(false);

		write(
			root,
			'packages/new/package.json',
			JSON.stringify({ name: '@fixture/new', private: true, version: '0.0.0' })
		);
		write(root, 'packages/new/src/index.ts', 'export const added = true;\n');
		const changed = collectInventory({ repositoryRoot: root });
		expect(changed.workspaces).toHaveLength(before.workspaces.length + 1);
		expect(changed.subject.subjectId).not.toBe(before.subject.subjectId);
	});

	it('changes corresponding facts for tsconfig, tool-configuration, and analyzer mutations', () => {
		const root = fixture();
		const initial = collectInventory({ repositoryRoot: root });

		write(
			root,
			'packages/demo/tsconfig.json',
			'{ "compilerOptions": { "strict": false }, "include": ["src"] }\n'
		);
		const tsconfigChanged = collectInventory({ repositoryRoot: root });
		expect(
			tsconfigChanged.typescriptProjects.find(
				(project) => project.path === 'packages/demo/tsconfig.json'
			)?.compilerOptions.strict
		).toBe(false);
		expect(tsconfigChanged.subject.configurationDigest).not.toBe(
			initial.subject.configurationDigest
		);

		write(
			root,
			'vitest.config.ts',
			"export default { test: { coverage: { provider: 'v8', include: ['packages/*/src/**/*.ts'] } } };\n"
		);
		const toolChanged = collectInventory({ repositoryRoot: root });
		expect(toolChanged.assuranceSurfaces.coverage).toMatchObject({
			configurationPath: 'vitest.config.ts',
			include: ['packages/*/src/**/*.ts'],
			provider: 'v8'
		});
		expect(toolChanged.subject.subjectId).not.toBe(tsconfigChanged.subject.subjectId);

		const analyzerBefore = toolChanged.verificationAssets.find(
			(asset) => asset.path === 'verif/example.test.ts'
		)?.contentSha256;
		write(root, 'verif/example.test.ts', 'export const verification = false;\n');
		const analyzerChanged = collectInventory({ repositoryRoot: root });
		expect(
			analyzerChanged.verificationAssets.find((asset) => asset.path === 'verif/example.test.ts')
				?.contentSha256
		).not.toBe(analyzerBefore);
		expect(analyzerChanged.subject.subjectId).not.toBe(toolChanged.subject.subjectId);
	});
});

describe('generated product safety', () => {
	it('requires unique markers and preserves every byte outside them', () => {
		const source = `prefix\r\n${GENERATED_REGION_BEGIN}\r\nold\r\n${GENERATED_REGION_END}\r\nsuffix\r\n`;
		const rendered = replaceGeneratedRegion(source, 'new\nrows\n');
		expect(rendered).toBe(
			`prefix\r\n${GENERATED_REGION_BEGIN}\r\nnew\r\nrows\r\n${GENERATED_REGION_END}\r\nsuffix\r\n`
		);
		expect(() => replaceGeneratedRegion('no markers', 'new')).toThrow('exactly one begin marker');
		expect(() =>
			replaceGeneratedRegion(
				`${GENERATED_REGION_BEGIN}\n${GENERATED_REGION_BEGIN}\n${GENERATED_REGION_END}\n`,
				'new'
			)
		).toThrow('exactly one begin marker');
		expect(() =>
			replaceGeneratedRegion(`${GENERATED_REGION_END}\n${GENERATED_REGION_BEGIN}\n`, 'new')
		).toThrow('generated-region markers are reversed');
		expect(() =>
			replaceGeneratedRegion(`prefix${GENERATED_REGION_BEGIN}\n${GENERATED_REGION_END}\n`, 'new')
		).toThrow(`Generated-region marker is not on its own line: ${GENERATED_REGION_BEGIN}`);
		expect(() =>
			replaceGeneratedRegion(`${GENERATED_REGION_BEGIN}suffix\n${GENERATED_REGION_END}\n`, 'new')
		).toThrow(`Generated-region marker is not on its own line: ${GENERATED_REGION_BEGIN}`);
	});

	it('supports an in-memory JSON result and rejects publication without its controlled document', () => {
		const root = fixture();
		const result = runInventory({ mode: 'json', repositoryRoot: root });
		expect(result).toMatchObject({
			differences: [],
			mode: 'json',
			ok: true,
			subjectId: result.inventory.subject.subjectId
		});
		expect(JSON.parse(result.json).subject.subjectId).toBe(result.subjectId);
		const missingBaseline = runInventory({ mode: 'check', repositoryRoot: root });
		expect(missingBaseline.ok).toBe(false);
		expect(missingBaseline.differences).toEqual([
			expect.objectContaining({
				actualBytes: null,
				actualSha256: null,
				path: 'verif/csaa/jan-csaa-005.inventory.baseline.json'
			}),
			expect.objectContaining({
				path: 'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md'
			})
		]);
		expect(existsSync(join(root, 'verif', 'csaa', 'jan-csaa-005.inventory.baseline.json'))).toBe(
			false
		);

		rmSync(
			join(
				root,
				'docs',
				'ASTs and Code Analysis',
				'JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md'
			)
		);
		expect(() => runInventory({ mode: 'check', repositoryRoot: root })).toThrow(
			'JAN-CSAA-005 document is absent'
		);
	});

	it('writes byte-identical products, detects drift read-only, and rolls back an interrupted pair', () => {
		const root = fixture();
		const documentPath =
			'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md';
		const baselinePath = 'verif/csaa/jan-csaa-005.inventory.baseline.json';
		const first = runInventory({ mode: 'write', repositoryRoot: root });
		const firstDocument = readFileSync(join(root, ...documentPath.split('/')), 'utf8');
		const firstBaseline = readFileSync(join(root, ...baselinePath.split('/')), 'utf8');
		expect(firstDocument).toContain(first.subjectId);
		expect(JSON.parse(firstBaseline).subject.subjectId).toBe(first.subjectId);
		expect(runInventory({ mode: 'write', repositoryRoot: root }).subjectId).toBe(first.subjectId);
		expect(readFileSync(join(root, ...documentPath.split('/')), 'utf8')).toBe(firstDocument);
		expect(readFileSync(join(root, ...baselinePath.split('/')), 'utf8')).toBe(firstBaseline);
		expect(runInventory({ mode: 'check', repositoryRoot: root }).ok).toBe(true);

		write(root, 'packages/demo/src/index.ts', 'export const value = 2;\n');
		const beforeCheckDocument = readFileSync(join(root, ...documentPath.split('/')), 'utf8');
		const beforeCheckBaseline = readFileSync(join(root, ...baselinePath.split('/')), 'utf8');
		const stale = runInventory({ mode: 'check', repositoryRoot: root });
		expect(stale.ok).toBe(false);
		expect(stale.differences.map((entry) => entry.path)).toEqual([baselinePath, documentPath]);
		expect(readFileSync(join(root, ...documentPath.split('/')), 'utf8')).toBe(beforeCheckDocument);
		expect(readFileSync(join(root, ...baselinePath.split('/')), 'utf8')).toBe(beforeCheckBaseline);

		expect(() =>
			runInventory({
				afterFirstCommit: () => {
					throw new Error('injected interruption');
				},
				mode: 'write',
				repositoryRoot: root
			})
		).toThrow('injected interruption');
		expect(readFileSync(join(root, ...documentPath.split('/')), 'utf8')).toBe(beforeCheckDocument);
		expect(readFileSync(join(root, ...baselinePath.split('/')), 'utf8')).toBe(beforeCheckBaseline);
		expect(readdirSync(join(root, 'verif', 'csaa')).some((name) => name.endsWith('.tmp'))).toBe(
			false
		);
		expect(
			readdirSync(join(root, 'docs', 'ASTs and Code Analysis')).some((name) =>
				name.endsWith('.tmp')
			)
		).toBe(false);
	});

	it('keeps generated outputs outside their own subject preimage', () => {
		const root = fixture();
		const before = collectInventory({ repositoryRoot: root });
		write(root, 'verif/csaa/jan-csaa-005.inventory.baseline.json', '{"self":"different"}\n');
		const after = collectInventory({ repositoryRoot: root });
		expect(after.subject.fileManifestDigest).toBe(before.subject.fileManifestDigest);
		expect(
			after.subject.selectedFiles.some((file) => file.path.includes('jan-csaa-005.inventory'))
		).toBe(false);
	});
});

describe('JPWB population non-vacuity', () => {
	it('rejects each vacuous required JPWB population independently', () => {
		const completeScripts = Object.fromEntries(
			['boundary', 'check-types', 'gate', 'gate:fast', 'lint', 'test', 'test:coverage'].map(
				(name) => [name, 'true']
			)
		);
		const manifest = (workspaces: readonly string[] | undefined, scripts = completeScripts) =>
			JSON.stringify({
				name: 'janumi-professional-workbench',
				private: true,
				scripts,
				...(workspaces ? { workspaces } : {})
			});

		const wrongIdentity = fixture();
		expect(() =>
			collectInventory({ repositoryRoot: wrongIdentity, requireJpwbPopulations: true })
		).toThrow('JPWB inventory root manifest identity is absent or incompatible');

		const noWorkspaces = fixture();
		write(noWorkspaces, 'package.json', manifest(undefined));
		expect(() =>
			collectInventory({ repositoryRoot: noWorkspaces, requireJpwbPopulations: true })
		).toThrow('JPWB workspace population is empty');

		const noVerification = fixture();
		write(noVerification, 'package.json', manifest(['packages/*', 'apps/*']));
		rmSync(join(noVerification, 'verif', 'example.test.ts'));
		expect(() =>
			collectInventory({ repositoryRoot: noVerification, requireJpwbPopulations: true })
		).toThrow('JPWB top-level verif TypeScript population is empty');

		const noScripts = fixture();
		write(noScripts, 'package.json', manifest(['packages/*', 'apps/*']));
		rmSync(join(noScripts, 'scripts', 'tool.ts'));
		expect(() =>
			collectInventory({ repositoryRoot: noScripts, requireJpwbPopulations: true })
		).toThrow('JPWB scripts TypeScript population is empty');

		const missingCommand = fixture();
		write(
			missingCommand,
			'package.json',
			manifest(['packages/*', 'apps/*'], { 'check-types': 'true', test: 'true' })
		);
		expect(() =>
			collectInventory({ repositoryRoot: missingCommand, requireJpwbPopulations: true })
		).toThrow('Required JPWB assurance command is absent: boundary');
	});

	it('discovers every current workspace manifest and every top-level verif TypeScript asset', () => {
		const inventory = collectInventory({ repositoryRoot: ROOT, requireJpwbPopulations: true });
		const manifestCount = ['packages', 'apps'].reduce(
			(total, base) =>
				total +
				readdirSync(join(ROOT, base), { withFileTypes: true }).filter(
					(entry) => entry.isDirectory() && existsSync(join(ROOT, base, entry.name, 'package.json'))
				).length,
			0
		);
		const verificationAssetCount = readdirSync(join(ROOT, 'verif'), { withFileTypes: true }).filter(
			(entry) => entry.isFile() && entry.name.endsWith('.ts')
		).length;
		expect(inventory.workspaces).toHaveLength(manifestCount);
		const verificationAssets = inventory.verificationAssets.filter((asset) =>
			asset.path.startsWith('verif/')
		);
		expect(verificationAssetCount).toBeGreaterThan(0);
		expect(verificationAssets).toHaveLength(verificationAssetCount);
		expect(verificationAssets.every((asset) => asset.disposition.length > 0)).toBe(true);
		expect(inventory.dependencyBoundary.analyzedPerimeter).toEqual(['packages']);
		expect(inventory.dependencyBoundary.enforcementPerimeter).toEqual(['apps', 'packages']);
	}, 30_000);
});
