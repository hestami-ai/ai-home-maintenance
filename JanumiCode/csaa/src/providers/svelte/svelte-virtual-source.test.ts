import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
	SVELTE2TSX_PROVIDER_VERSION,
	SVELTE_PROVIDER_VERSION,
	SVELTE_TYPESCRIPT_PROVIDER_VERSION,
	SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION,
	SVELTE_VIRTUAL_SOURCE_ID_PROFILE,
	SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS,
	SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION,
	SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE,
	SvelteVirtualSourceError,
	svelteVirtualLogicalPath,
	transformSvelteVirtualSource,
	type SvelteVirtualSourceLimits,
	type SvelteVirtualSourceTransformInput
} from './svelte-virtual-source.js';

const encoder = new TextEncoder();

function limits(overrides: Partial<SvelteVirtualSourceLimits> = {}): SvelteVirtualSourceLimits {
	return {
		...SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS,
		...overrides
	};
}

function input(
	text: string,
	path = 'apps/demo/src/Counter.svelte',
	limitOverrides: Partial<SvelteVirtualSourceLimits> = {}
): SvelteVirtualSourceTransformInput {
	return {
		authoredBytes: encoder.encode(text),
		authoredLogicalPath: path,
		limits: limits(limitOverrides)
	};
}

function failure(
	action: () => unknown,
	code: SvelteVirtualSourceError['code']
): SvelteVirtualSourceError {
	try {
		action();
	} catch (error) {
		expect(error).toBeInstanceOf(SvelteVirtualSourceError);
		const typed = error as SvelteVirtualSourceError;
		expect(typed.code).toBe(code);
		return typed;
	}
	throw new Error('Expected SvelteVirtualSourceError.');
}

const TYPESCRIPT_COMPONENT = `<script lang="ts">
	let { count = 0 }: { count?: number } = $props();
	const doubled: number = count * 2;
</script>

<button onclick={() => count += 1}>{count} / {doubled}</button>
`;

describe('Svelte virtual-source adapter', () => {
	it('produces deterministic, version-bound virtual TypeScript and strict point mappings', () => {
		const first = transformSvelteVirtualSource(input(TYPESCRIPT_COMPONENT));
		const second = transformSvelteVirtualSource(input(TYPESCRIPT_COMPONENT));

		expect(second).toEqual(first);
		expect(first.evidence).toMatchObject({
			adapter: {
				adapter: 'svelte2tsx',
				adapterVersion: SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION,
				svelte2tsxVersion: SVELTE2TSX_PROVIDER_VERSION,
				svelteVersion: SVELTE_PROVIDER_VERSION,
				typescriptVersion: SVELTE_TYPESCRIPT_PROVIDER_VERSION
			},
			authored: {
				encoding: 'UTF8_WITHOUT_BOM',
				logicalPath: 'apps/demo/src/Counter.svelte',
				origin: 'AUTHORED'
			},
			idProfile: SVELTE_VIRTUAL_SOURCE_ID_PROFILE,
			schemaVersion: SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION,
			sourceMap: { mappingState: 'EXACT_SEGMENT_POINTS_ONLY' },
			transformProfile: SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE,
			virtual: {
				logicalPath: '.csaa-virtual/svelte2tsx/apps/demo/src/Counter.svelte.ts',
				origin: 'VIRTUAL',
				scriptKind: 'TS'
			}
		});
		expect(first.evidence.id).toMatch(/^[a-f0-9]{64}$/u);
		expect(first.evidence.authored.contentSha256).not.toBe(first.evidence.virtual.contentSha256);
		expect(first.sourceMap).toMatchObject({
			file: first.evidence.virtual.logicalPath,
			source: first.evidence.authored.logicalPath,
			sourceRoot: '',
			version: 3
		});
		expect(first.sourceMap.segmentCount).toBeGreaterThan(0);
		expect(first.sourceMap.segments).toHaveLength(first.evidence.sourceMap.segmentCount);
		expect(first.virtualSourceText).toContain('doubled');
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.evidence)).toBe(true);
		expect(Object.isFrozen(first.sourceMap)).toBe(true);
	});

	it('selects JavaScript or TypeScript from parsed script attributes, including module scripts', () => {
		const javascript = transformSvelteVirtualSource(
			input('<script>let count = 0;</script><p>{count}</p>', 'apps/demo/src/Js.svelte')
		);
		const templateOnly = transformSvelteVirtualSource(
			input('<p>Hello</p>', 'apps/demo/src/Template.svelte')
		);
		const moduleTypescript = transformSvelteVirtualSource(
			input(
				'<script context="module" lang="ts">export const answer: number = 42;</script><p>Hello</p>',
				'apps/demo/src/Module.svelte'
			)
		);

		expect(javascript.evidence.virtual).toMatchObject({
			logicalPath: '.csaa-virtual/svelte2tsx/apps/demo/src/Js.svelte.js',
			scriptKind: 'JS'
		});
		expect(templateOnly.evidence.virtual.scriptKind).toBe('JS');
		expect(moduleTypescript.evidence.virtual).toMatchObject({
			logicalPath: '.csaa-virtual/svelte2tsx/apps/demo/src/Module.svelte.ts',
			scriptKind: 'TS'
		});
	});

	it('changes transform identity and virtual bytes for a semantic source mutation', () => {
		const original = transformSvelteVirtualSource(input(TYPESCRIPT_COMPONENT));
		const mutated = transformSvelteVirtualSource(
			input(TYPESCRIPT_COMPONENT.replace('count * 2', 'count * 3'))
		);

		expect(mutated.evidence.id).not.toBe(original.evidence.id);
		expect(mutated.evidence.authored.contentSha256).not.toBe(
			original.evidence.authored.contentSha256
		);
		expect(mutated.evidence.virtual.contentSha256).not.toBe(
			original.evidence.virtual.contentSha256
		);
		expect(mutated.evidence.virtual.logicalPath).toBe(original.evidence.virtual.logicalPath);
	});

	it('emits public-TypeScript-parseable virtual code without executing the component', () => {
		const transformed = transformSvelteVirtualSource(input(TYPESCRIPT_COMPONENT));
		const virtualPath = resolve('C:/virtual-repository', transformed.evidence.virtual.logicalPath);
		const options: ts.CompilerOptions = {
			allowJs: false,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			noLib: true,
			target: ts.ScriptTarget.ESNext
		};
		const host = ts.createCompilerHost(options);
		host.getSourceFile = (fileName, languageVersion) =>
			fileName === virtualPath
				? ts.createSourceFile(
						fileName,
						transformed.virtualSourceText,
						languageVersion,
						true,
						ts.ScriptKind.TS
					)
				: undefined;
		host.fileExists = (fileName) => fileName === virtualPath;
		host.readFile = (fileName) =>
			fileName === virtualPath ? transformed.virtualSourceText : undefined;
		const program = ts.createProgram([virtualPath], options, host);

		expect(program.getSyntacticDiagnostics()).toEqual([]);
	});

	it('deep-indexes transformed bytes at the authored .svelte Program identity', () => {
		const authoredLogicalPath = 'apps/demo/src/Counter.svelte';
		const transformed = transformSvelteVirtualSource(
			input(TYPESCRIPT_COMPONENT, authoredLogicalPath)
		);
		const authoredPath = resolve('C:/virtual-repository', authoredLogicalPath).replaceAll(
			'\\',
			'/'
		);
		const options: ts.CompilerOptions = {
			allowNonTsExtensions: true,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			noLib: true,
			target: ts.ScriptTarget.ESNext
		};
		const host = ts.createCompilerHost(options);
		host.getSourceFile = (fileName, languageVersion) =>
			fileName === authoredPath
				? ts.createSourceFile(
						authoredPath,
						transformed.virtualSourceText,
						languageVersion,
						true,
						ts.ScriptKind.TS
					)
				: undefined;
		host.fileExists = (fileName) => fileName === authoredPath;
		host.readFile = (fileName) =>
			fileName === authoredPath ? transformed.virtualSourceText : undefined;
		const program = ts.createProgram({ host, options, rootNames: [authoredPath] });
		const source = program.getSourceFile(authoredPath);

		expect(source?.fileName).toBe(authoredPath);
		expect(program.getRootFileNames()).toEqual([authoredPath]);
		expect(program.getSyntacticDiagnostics(source)).toEqual([]);
		expect(source?.statements.length).toBeGreaterThan(0);
		expect(program.getTypeChecker()).toBeDefined();
	});

	it('canonicalizes maps to exactly the existing strict flat-v3 shape', () => {
		const transformed = transformSvelteVirtualSource(input(TYPESCRIPT_COMPONENT));
		const raw = JSON.parse(transformed.sourceMapJson) as Record<string, unknown>;

		expect(Object.keys(raw).sort()).toEqual([
			'file',
			'mappings',
			'names',
			'sourceRoot',
			'sources',
			'version'
		]);
		expect(raw).toMatchObject({
			file: transformed.evidence.virtual.logicalPath,
			names: [],
			sourceRoot: '',
			sources: [transformed.evidence.authored.logicalPath],
			version: 3
		});
		expect(raw).not.toHaveProperty('sourcesContent');
		expect(raw).not.toHaveProperty('sections');
	});

	it('fails closed on malformed Svelte without echoing source content', () => {
		const secret = 'JPWB_PRIVATE_DO_NOT_ECHO';
		const error = failure(
			() =>
				transformSvelteVirtualSource(
					input(`<script lang="ts">const secret = '${secret}';</script>{#if}`)
				),
			'TRANSFORM_FAILED'
		);
		expect(error.message).not.toContain(secret);
		expect(error.logicalPath).toBe('apps/demo/src/Counter.svelte');
	});

	it.each([
		['absolute path', { ...input('<p />'), authoredLogicalPath: 'C:/escape.svelte' }],
		['dot-segment path', { ...input('<p />'), authoredLogicalPath: 'apps/../escape.svelte' }],
		['wrong extension', { ...input('<p />'), authoredLogicalPath: 'apps/demo/View.ts' }],
		[
			'UTF-8 BOM',
			{
				...input('<p />'),
				authoredBytes: new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('<p />')])
			}
		],
		['invalid UTF-8', { ...input('<p />'), authoredBytes: new Uint8Array([0xc3, 0x28]) }]
	] as const)('rejects invalid selected-profile input: %s', (_label, value) => {
		failure(
			() => transformSvelteVirtualSource(value as SvelteVirtualSourceTransformInput),
			'INPUT_INVALID'
		);
	});

	it('rejects proxies, typed-array subclasses, accessors, and extra keys before transformation', () => {
		const ordinary = input('<p />');
		failure(
			() =>
				transformSvelteVirtualSource(new Proxy(ordinary, {}) as SvelteVirtualSourceTransformInput),
			'INPUT_INVALID'
		);
		class Bytes extends Uint8Array {}
		failure(
			() =>
				transformSvelteVirtualSource({
					...ordinary,
					authoredBytes: new Bytes(encoder.encode('<p />'))
				}),
			'INPUT_INVALID'
		);
		failure(
			() =>
				transformSvelteVirtualSource({
					...ordinary,
					get limits(): SvelteVirtualSourceLimits {
						throw new Error('must not execute');
					}
				}),
			'INPUT_INVALID'
		);
		failure(
			() =>
				transformSvelteVirtualSource({
					...ordinary,
					extra: true
				} as unknown as SvelteVirtualSourceTransformInput),
			'INPUT_INVALID'
		);
	});

	it.each([
		['authored bytes', { maxAuthoredBytes: 1 }],
		['authored characters', { maxAuthoredCharacters: 1 }],
		['generated bytes', { maxGeneratedBytes: 1 }],
		['generated characters', { maxGeneratedCharacters: 1 }],
		['generated lines', { maxGeneratedLines: 0 }],
		['map characters', { maxMapCharacters: 1 }],
		['map segments', { maxMapSegments: 0 }],
		['path characters', { maxPathCharacters: 1 }]
	] as const)('fails closed on the %s budget', (_label, constrained) => {
		failure(
			() => transformSvelteVirtualSource(input(TYPESCRIPT_COMPONENT, undefined, constrained)),
			'BUDGET_EXCEEDED'
		);
	});

	it('requires exact nonnegative inert limit fields beneath hard ceilings', () => {
		const ordinary = input('<p />');
		failure(
			() =>
				transformSvelteVirtualSource({
					...ordinary,
					limits: { ...ordinary.limits, extra: 1 }
				} as unknown as SvelteVirtualSourceTransformInput),
			'INPUT_INVALID'
		);
		failure(
			() =>
				transformSvelteVirtualSource({
					...ordinary,
					limits: { ...ordinary.limits, maxMapSegments: -1 }
				}),
			'INPUT_INVALID'
		);
		failure(
			() =>
				transformSvelteVirtualSource({
					...ordinary,
					limits: {
						...ordinary.limits,
						maxGeneratedBytes: SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxGeneratedBytes + 1
					}
				}),
			'INPUT_INVALID'
		);
	});

	it('derives canonical virtual paths without consulting the filesystem', () => {
		expect(svelteVirtualLogicalPath('apps/demo/src/View.svelte', 'TS')).toBe(
			'.csaa-virtual/svelte2tsx/apps/demo/src/View.svelte.ts'
		);
		expect(svelteVirtualLogicalPath('apps/demo/src/View.svelte', 'JS')).toBe(
			'.csaa-virtual/svelte2tsx/apps/demo/src/View.svelte.js'
		);
		failure(() => svelteVirtualLogicalPath('../escape.svelte', 'TS'), 'INPUT_INVALID');
		failure(() => svelteVirtualLogicalPath('apps/demo/src/View.ts', 'TS'), 'INPUT_INVALID');
		failure(
			() => svelteVirtualLogicalPath('apps/demo/src/View.svelte', 'INVALID' as never),
			'INPUT_INVALID'
		);
		failure(() => svelteVirtualLogicalPath('apps/demo/src/View.svelte', 'TS', -1), 'INPUT_INVALID');
		failure(
			() =>
				svelteVirtualLogicalPath(
					'apps/demo/src/View.svelte',
					'TS',
					SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxPathCharacters + 1
				),
			'INPUT_INVALID'
		);
		failure(
			() => svelteVirtualLogicalPath('apps/demo/src/View.svelte', 'TS', 5),
			'BUDGET_EXCEEDED'
		);
	});

	it('transforms the complete current eleven-file rph-demo Svelte population', () => {
		const paths = [
			'apps/rph-demo/src/lib/PwuTypeCard.svelte',
			'apps/rph-demo/src/lib/ThemeToggle.svelte',
			'apps/rph-demo/src/lib/WalkthroughPanel.svelte',
			'apps/rph-demo/src/lib/behavior/PwuBehaviorPanel.svelte',
			'apps/rph-demo/src/routes/+layout.svelte',
			'apps/rph-demo/src/routes/+page.svelte',
			'apps/rph-demo/src/routes/baselines/+page.svelte',
			'apps/rph-demo/src/routes/decisions/+page.svelte',
			'apps/rph-demo/src/routes/pwa/[id]/+page.svelte',
			'apps/rph-demo/src/routes/undertakings/+page.svelte',
			'apps/rph-demo/src/routes/undertakings/[id]/+page.svelte'
		] as const;
		const transformed = paths.map((logicalPath) =>
			transformSvelteVirtualSource({
				authoredBytes: readFileSync(resolve(logicalPath)),
				authoredLogicalPath: logicalPath,
				limits: limits()
			})
		);

		expect(transformed).toHaveLength(11);
		expect(new Set(transformed.map((entry) => entry.evidence.id))).toHaveProperty('size', 11);
		expect(transformed.every((entry) => entry.evidence.virtual.scriptKind === 'TS')).toBe(true);
		expect(transformed.every((entry) => entry.sourceMap.segmentCount > 0)).toBe(true);
		expect(transformed.map((entry) => entry.evidence.authored.logicalPath).sort()).toEqual(
			[...paths].sort()
		);
	});
});
