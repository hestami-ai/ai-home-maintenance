import { describe, expect, it } from 'vitest';

import {
	GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION,
	GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID,
	type ArtifactPrimaryClass,
	type FrozenSubject,
	type GeneratedContextEvidenceRecord,
	type GeneratedContextExecutionManifest,
	type GeneratedContextGeneratorIdentity
} from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import {
	assessGeneratedContextFreshness,
	createGeneratedContextEvidenceRecord,
	generatedContextInputManifest,
	generatedContextInputManifestDigest,
	generatedContextOutputManifest,
	generatedContextOutputManifestDigest,
	parseGeneratedContextEvidenceRecord
} from './generated-context.js';
import { generatedContextExecutionManifestDigest } from './svelte-kit-execution-closure.js';

const GENERATED_CONTEXT_PATH = 'apps/demo/.svelte-kit/tsconfig.json';
const EVIDENCE_SOURCE = 'verif/generated-context.json';

function artifact(path: string, primaryClass: ArtifactPrimaryClass, source = path) {
	return {
		bytes: Buffer.byteLength(source),
		canonicalPathKey: path,
		path,
		primaryClass,
		roles: primaryClass === 'TOOL_CONFIGURATION' ? ['CONFIGURATION'] : [],
		sha256: sha256(source)
	};
}

function mutableRecord(value: unknown): Record<string, unknown> {
	return value as Record<string, unknown>;
}

function fixture(): {
	readonly executionManifest: GeneratedContextExecutionManifest;
	readonly generator: GeneratedContextGeneratorIdentity;
	readonly record: GeneratedContextEvidenceRecord;
	readonly subject: FrozenSubject;
} {
	const artifacts = [
		artifact('package.json', 'MANIFEST'),
		artifact('bun.lock', 'LOCKFILE'),
		artifact('apps/demo/package.json', 'MANIFEST'),
		artifact('apps/demo/svelte.config.js', 'TOOL_CONFIGURATION'),
		artifact('apps/demo/tsconfig.json', 'PROJECT_CONFIGURATION'),
		artifact('apps/demo/src/index.ts', 'PRODUCTION_SOURCE'),
		artifact(GENERATED_CONTEXT_PATH, 'GENERATED_CONFIGURATION'),
		artifact('apps/demo/.svelte-kit/types/route/$types.d.ts', 'GENERATED_SOURCE')
	] as const;
	const subject = { artifacts } as unknown as FrozenSubject;
	const executionManifest: GeneratedContextExecutionManifest = {
		containmentPolicy:
			'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0',
		configurationEntrypoints: [
			{
				imports: [],
				path: 'apps/demo/svelte.config.js',
				sha256: artifacts[3].sha256
			}
		],
		environment: [
			{ name: 'CI', value: '1' },
			{ name: 'FORCE_COLOR', value: '0' },
			{ name: 'MODE', value: 'production' },
			{ name: 'NODE_ENV', value: 'production' },
			{ name: 'NODE_NO_WARNINGS', value: '1' },
			{ name: 'NO_COLOR', value: '1' },
			{ name: 'TZ', value: 'UTC' }
		].sort((left, right) => compareText(left.name, right.name)),
		environmentPolicy: 'closed-svelte-kit-sync-environment/1.0.0',
		executionLimitations: [
			'CHILD_PROCESS_EXECUTABLE_IDENTITY_AND_EFFECTS_NOT_BOUND_OR_OS_SANDBOXED',
			'NATIVE_ADDON_EFFECTS_NOT_FILESYSTEM_NETWORK_MEMORY_OR_OS_SANDBOXED',
			'NETWORK_DENIAL_NOT_ENFORCED_BY_NODE_PERMISSION_MODEL'
		],
		generatedOutputRoot: {
			access: 'READ_WRITE',
			baseline: 'EMPTY_PHYSICAL_DIRECTORY',
			path: 'apps/demo/.svelte-kit',
			replay: 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION'
		},
		invocation: ['svelte-kit.js', 'sync', '--mode', 'production'],
		lockfile: { path: 'bun.lock', sha256: artifacts[1].sha256 },
		missingOptionalPackages: [],
		packages: [
			{
				bytes: 1,
				fileCount: 1,
				integrity: `sha512-${'A'.repeat(86)}==`,
				locator: 'node_modules/@sveltejs/kit',
				lockKey: '@sveltejs/kit',
				manifestSha256: '1'.repeat(64),
				name: '@sveltejs/kit',
				treeSha256: '2'.repeat(64),
				version: '2.69.2'
			},
			{
				bytes: 1,
				fileCount: 1,
				integrity: `sha512-${'A'.repeat(86)}==`,
				locator: 'node_modules/typescript',
				lockKey: 'typescript',
				manifestSha256: '3'.repeat(64),
				name: 'typescript',
				treeSha256: '4'.repeat(64),
				version: '5.9.2'
			},
			{
				bytes: 1,
				fileCount: 1,
				integrity: `sha512-${'A'.repeat(86)}==`,
				locator: 'node_modules/vite',
				lockKey: 'vite',
				manifestSha256: '5'.repeat(64),
				name: 'vite',
				treeSha256: '6'.repeat(64),
				version: '7.1.5'
			}
		],
		readGrantProfile: 'svelte-kit-sync-project-defaults/1.0.0',
		repositoryReadGrants: [
			...[
				'apps/demo/.env',
				'apps/demo/.env.local',
				'apps/demo/.env.production',
				'apps/demo/.env.production.local',
				'apps/demo/static',
				'apps/demo/svelte.config.ts',
				'apps/demo/vite.config.cjs',
				'apps/demo/vite.config.cts',
				'apps/demo/vite.config.js',
				'apps/demo/vite.config.mjs',
				'apps/demo/vite.config.mts',
				'apps/demo/vite.config.ts'
			].map((path) => ({ kind: 'ABSENT_PATH' as const, path })),
			...[
				'apps/demo/package.json',
				'apps/demo/svelte.config.js',
				'apps/demo/tsconfig.json',
				'bun.lock',
				'package.json'
			].map((path) => ({ kind: 'FILE' as const, path })),
			{ kind: 'DIRECTORY' as const, path: 'apps/demo/src' },
			{ kind: 'DIRECTORY' as const, path: 'node_modules/@sveltejs/kit' },
			{ kind: 'DIRECTORY' as const, path: 'node_modules/typescript' },
			{ kind: 'DIRECTORY' as const, path: 'node_modules/vite' }
		].sort((left, right) => compareText(left.path, right.path)),
		runtime: {
			architecture: 'x64',
			engine: 'node',
			executableBytes: 1,
			executableSha256: '7'.repeat(64),
			platform: 'linux',
			version: 'v24.0.0',
			versionsDigest: '8'.repeat(64)
		},
		scratchRoots: [
			{
				access: 'READ_WRITE',
				baseline: 'EMPTY_PHYSICAL_DIRECTORY',
				lifecycle: 'RESET_BEFORE_EACH_SYNCHRONIZATION_AND_RESTORE_AFTER_OPERATION',
				path: 'node_modules/.vite-temp'
			}
		],
		schemaVersion: GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION
	};
	const generator = {
		id: GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID,
		implementationDigest: generatedContextExecutionManifestDigest(executionManifest),
		version: '2.69.2'
	} as const;
	return {
		executionManifest,
		generator,
		record: createGeneratedContextEvidenceRecord({
			evidenceSource: EVIDENCE_SOURCE,
			executionManifest,
			generatedContextPath: GENERATED_CONTEXT_PATH,
			generator,
			subject
		}),
		subject
	};
}

function bytes(value: unknown): Uint8Array {
	return new TextEncoder().encode(canonicalJson(value));
}

function reboundRecord(
	record: GeneratedContextEvidenceRecord,
	mutate: (candidate: Record<string, unknown>) => void
): Record<string, unknown> {
	const candidate = structuredClone(record) as unknown as Record<string, unknown>;
	mutate(candidate);
	const manifest = candidate.executionManifest as GeneratedContextExecutionManifest;
	const digest = generatedContextExecutionManifestDigest(manifest);
	candidate.executionManifestDigest = digest;
	mutableRecord(candidate.generator).implementationDigest = digest;
	return candidate;
}

describe('generated context governed evidence', () => {
	it('selects exact sorted input and output populations and rejects invalid anchors', () => {
		const current = fixture();
		const inputs = generatedContextInputManifest(
			current.subject.artifacts,
			GENERATED_CONTEXT_PATH,
			EVIDENCE_SOURCE
		);
		expect(inputs.map((entry) => entry.path)).toEqual([
			'apps/demo/package.json',
			'apps/demo/src/index.ts',
			'apps/demo/svelte.config.js',
			'apps/demo/tsconfig.json',
			'bun.lock',
			'package.json'
		]);
		expect(generatedContextInputManifestDigest(inputs)).toBe(current.record.inputManifestDigest);
		const outputs = generatedContextOutputManifest(
			current.subject.artifacts,
			GENERATED_CONTEXT_PATH
		);
		expect(outputs.map((entry) => entry.path)).toEqual([
			'apps/demo/.svelte-kit/tsconfig.json',
			'apps/demo/.svelte-kit/types/route/$types.d.ts'
		]);
		expect(generatedContextOutputManifestDigest(outputs)).toBe(
			current.record.generatedOutputManifestDigest
		);
		expect(() =>
			generatedContextInputManifest(
				current.subject.artifacts,
				'apps/demo/tsconfig.json',
				EVIDENCE_SOURCE
			)
		).toThrow(/not beneath a workspace/u);
		expect(() =>
			generatedContextOutputManifest(current.subject.artifacts, 'apps/demo/tsconfig.json')
		).toThrow(/not beneath a workspace/u);
		expect(() =>
			generatedContextOutputManifest(
				current.subject.artifacts.filter((entry) => entry.path !== GENERATED_CONTEXT_PATH),
				GENERATED_CONTEXT_PATH
			)
		).toThrow(/does not contain its generated-context anchor/u);
	});

	it('validates generator identity, manifest binding, subject presence, and freshness', () => {
		const current = fixture();
		expect(Object.isFrozen(parseGeneratedContextEvidenceRecord(bytes(current.record)))).toBe(true);
		expect(
			assessGeneratedContextFreshness({
				actualInputManifestDigest: current.record.inputManifestDigest,
				actualOutputManifestDigest: current.record.generatedOutputManifestDigest,
				record: current.record,
				source: EVIDENCE_SOURCE
			})
		).toMatchObject({ freshness: 'CURRENT' });
		expect(
			assessGeneratedContextFreshness({
				actualInputManifestDigest: 'f'.repeat(64),
				actualOutputManifestDigest: current.record.generatedOutputManifestDigest,
				record: current.record,
				source: EVIDENCE_SOURCE
			})
		).toMatchObject({ freshness: 'STALE' });

		expect(() =>
			createGeneratedContextEvidenceRecord({
				evidenceSource: EVIDENCE_SOURCE,
				executionManifest: current.executionManifest,
				generatedContextPath: GENERATED_CONTEXT_PATH,
				generator: { ...current.generator, id: '' },
				subject: current.subject
			})
		).toThrow(/generator identity is invalid/u);
		expect(() =>
			createGeneratedContextEvidenceRecord({
				evidenceSource: EVIDENCE_SOURCE,
				executionManifest: current.executionManifest,
				generatedContextPath: GENERATED_CONTEXT_PATH,
				generator: { ...current.generator, implementationDigest: 'f'.repeat(64) },
				subject: current.subject
			})
		).toThrow(/does not bind its generator identity/u);
		expect(() =>
			createGeneratedContextEvidenceRecord({
				evidenceSource: EVIDENCE_SOURCE,
				executionManifest: current.executionManifest,
				generatedContextPath: GENERATED_CONTEXT_PATH,
				generator: current.generator,
				subject: {
					...current.subject,
					artifacts: current.subject.artifacts.filter(
						(entry) => entry.path !== GENERATED_CONTEXT_PATH
					)
				}
			})
		).toThrow(/artifact is absent/u);
	});

	it('rejects every incoherent execution-to-input binding through the public creator', () => {
		const current = fixture();
		const expectProblem = (
			mutateManifest: (manifest: GeneratedContextExecutionManifest) => void,
			message: RegExp,
			generatorOverrides: Partial<GeneratedContextGeneratorIdentity> = {}
		): void => {
			const executionManifest = structuredClone(current.executionManifest);
			mutateManifest(executionManifest);
			const generator = {
				...current.generator,
				...generatorOverrides,
				implementationDigest: generatedContextExecutionManifestDigest(executionManifest)
			};
			expect(() =>
				createGeneratedContextEvidenceRecord({
					evidenceSource: EVIDENCE_SOURCE,
					executionManifest,
					generatedContextPath: GENERATED_CONTEXT_PATH,
					generator,
					subject: current.subject
				})
			).toThrow(message);
		};

		expectProblem(() => undefined, /generator incompatible/u, { id: 'other-generator' });
		expectProblem(() => undefined, /version does not reconcile/u, { version: '0.0.0' });
		expectProblem(
			(manifest) =>
				void (mutableRecord(manifest.generatedOutputRoot).path = 'apps/other/.svelte-kit'),
			/empty generated-output root/u
		);
		expectProblem(
			(manifest) =>
				void ((manifest.repositoryReadGrants as Array<{ kind: string; path: string }>).find(
					(grant) => grant.kind === 'FILE' && grant.path === 'apps/demo/package.json'
				)!.path = 'apps/demo/missing.json'),
			/file-read grant is absent/u
		);
		expectProblem(
			(manifest) =>
				void ((manifest.repositoryReadGrants as Array<{ kind: string; path: string }>).find(
					(grant) => grant.kind === 'ABSENT_PATH'
				)!.path = 'apps/demo/package.json'),
			/absent-path grant conflicts/u
		);
		expectProblem(
			(manifest) =>
				void ((manifest.repositoryReadGrants as Array<{ kind: string; path: string }>).find(
					(grant) => grant.kind === 'DIRECTORY' && grant.path === 'apps/demo/src'
				)!.path = 'apps/demo/empty'),
			/directory-read grant has no bound input/u
		);
		expectProblem(
			(manifest) =>
				void (mutableRecord(manifest.configurationEntrypoints[0]).imports = ['./relative.js']),
			/unsupported package import/u
		);
		expectProblem(
			(manifest) => void (mutableRecord(manifest.packages[0]).lockKey = 'wrong-lock-key'),
			/does not use its exact bun.lock key/u
		);
		expectProblem(
			(manifest) =>
				void (mutableRecord(manifest).repositoryReadGrants = manifest.repositoryReadGrants.filter(
					(grant) => grant.path !== 'node_modules/vite'
				)),
			/does not have an exact directory-read grant/u
		);
		expectProblem(
			(manifest) =>
				void (mutableRecord(manifest).repositoryReadGrants = manifest.repositoryReadGrants.filter(
					(grant) => grant.path !== 'apps/demo/src'
				)),
			/source population does not have/u
		);
		expectProblem(
			(manifest) =>
				void (mutableRecord(manifest).repositoryReadGrants = manifest.repositoryReadGrants.filter(
					(grant) => grant.path !== 'bun.lock'
				)),
			/lockfile does not have an exact file-read grant/u
		);
		expectProblem(
			(manifest) => void (mutableRecord(manifest.lockfile).sha256 = 'f'.repeat(64)),
			/lockfile does not reconcile/u
		);
	});

	it('rejects malformed canonical evidence records at every bounded parser layer', () => {
		const current = fixture();
		expect(() => parseGeneratedContextEvidenceRecord(new TextEncoder().encode('{'))).toThrow(
			/not valid JSON/u
		);
		expect(() =>
			parseGeneratedContextEvidenceRecord(
				new TextEncoder().encode(`${canonicalJson(current.record)}\n`)
			)
		).toThrow(/not canonical JSON/u);

		const cases: readonly {
			readonly message: RegExp;
			readonly mutate: (candidate: Record<string, unknown>) => void;
			readonly rebindExecution?: boolean;
		}[] = [
			{
				message: /invalid closed shape/u,
				mutate: (candidate) => void (candidate.schemaVersion = 'unsupported')
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) =>
					void (mutableRecord(candidate.executionManifest).environmentPolicy = 'unsupported'),
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) =>
					void ((mutableRecord(candidate.executionManifest).configurationEntrypoints as unknown[]) =
						[
							...(mutableRecord(candidate.executionManifest).configurationEntrypoints as unknown[]),
							...(mutableRecord(candidate.executionManifest).configurationEntrypoints as unknown[])
						]),
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) => {
					const environment = mutableRecord(candidate.executionManifest).environment as Array<
						Record<string, unknown>
					>;
					environment[0]!.name = 'UNDECLARED';
				},
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) => {
					const manifest = mutableRecord(candidate.executionManifest);
					mutableRecord(manifest.runtime).platform = 'win32';
					const environment = manifest.environment as Array<Record<string, unknown>>;
					environment.push({ name: 'SystemRoot', value: 'C:\\Windows' });
					environment.push({ name: 'WINDIR', value: 'D:\\Windows' });
					environment.sort((left, right) => compareText(String(left.name), String(right.name)));
				},
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) =>
					void ((
						mutableRecord(candidate.executionManifest).repositoryReadGrants as Array<
							Record<string, unknown>
						>
					)[0]!.kind = 'UNSUPPORTED'),
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) => {
					const grants = mutableRecord(candidate.executionManifest)
						.repositoryReadGrants as unknown[];
					grants.splice(1, 0, structuredClone(grants[0]));
				},
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) =>
					void (mutableRecord(candidate.executionManifest).missingOptionalPackages = [
						{ issuer: '../outside', name: 'optional' }
					]),
				rebindExecution: true
			},
			{
				message: /invalid execution manifest/u,
				mutate: (candidate) =>
					void (mutableRecord(candidate.executionManifest).missingOptionalPackages = [
						{ issuer: 'node_modules/a', name: 'optional' },
						{ issuer: 'node_modules/a', name: 'optional' }
					]),
				rebindExecution: true
			},
			{
				message: /invalid input entry/u,
				mutate: (candidate) =>
					void ((candidate.inputManifest as Array<Record<string, unknown>>)[0]!.artifactClass =
						'UNSUPPORTED')
			},
			{
				message: /invalid input entry/u,
				mutate: (candidate) =>
					void ((candidate.inputManifest as Array<Record<string, unknown>>)[0]!.path = '../outside')
			},
			{
				message: /input paths are not unique/u,
				mutate: (candidate) => {
					const input = candidate.inputManifest as unknown[];
					input.splice(1, 0, structuredClone(input[0]));
				}
			},
			{
				message: /input-manifest digest is invalid/u,
				mutate: (candidate) => void (candidate.inputManifestDigest = 'f'.repeat(64))
			},
			{
				message: /invalid output entry/u,
				mutate: (candidate) =>
					void ((
						candidate.generatedOutputManifest as Array<Record<string, unknown>>
					)[0]!.artifactClass = 'PRODUCTION_SOURCE')
			},
			{
				message: /output paths are not unique/u,
				mutate: (candidate) => {
					const output = candidate.generatedOutputManifest as unknown[];
					output.splice(1, 0, structuredClone(output[0]));
				}
			},
			{
				message: /output-manifest digest is invalid/u,
				mutate: (candidate) => void (candidate.generatedOutputManifestDigest = 'f'.repeat(64))
			},
			{
				message: /anchor does not reconcile/u,
				mutate: (candidate) =>
					void (mutableRecord(candidate.generatedContext).sha256 = 'f'.repeat(64))
			}
		];

		for (const candidateCase of cases) {
			const candidate = candidateCase.rebindExecution
				? reboundRecord(current.record, candidateCase.mutate)
				: (structuredClone(current.record) as unknown as Record<string, unknown>);
			if (!candidateCase.rebindExecution) candidateCase.mutate(candidate);
			expect(() => parseGeneratedContextEvidenceRecord(bytes(candidate))).toThrow(
				candidateCase.message
			);
		}
	});

	it('rejects noncanonical context paths and incompatible execution profiles after parsing', () => {
		const current = fixture();
		const invalidPath = structuredClone(current.record) as unknown as Record<string, unknown>;
		mutableRecord(invalidPath.generatedContext).path = '../outside';
		expect(() => parseGeneratedContextEvidenceRecord(bytes(invalidPath))).toThrow(
			/invalid generated-context path/u
		);

		const incompatibleRoot = reboundRecord(current.record, (candidate) => {
			mutableRecord(mutableRecord(candidate.executionManifest).generatedOutputRoot).path =
				'apps/demo/generated';
			mutableRecord(candidate.generatedContext).path = 'apps/demo/generated/tsconfig.json';
			const outputs = candidate.generatedOutputManifest as Array<Record<string, unknown>>;
			outputs[0]!.path = 'apps/demo/generated/tsconfig.json';
			outputs.sort((left, right) => compareText(String(left.path), String(right.path)));
			candidate.generatedOutputManifestDigest = generatedContextOutputManifestDigest(
				outputs as never
			);
		});
		expect(() => parseGeneratedContextEvidenceRecord(bytes(incompatibleRoot))).toThrow(
			/generated-output root is incompatible/u
		);

		const incompatibleConfiguration = reboundRecord(current.record, (candidate) => {
			const manifest = candidate.executionManifest as GeneratedContextExecutionManifest;
			mutableRecord(manifest.configurationEntrypoints[0]).path = 'apps/demo/other.config.js';
			const inputs = candidate.inputManifest as Array<Record<string, unknown>>;
			const configInput = inputs.find((entry) => entry.path === 'apps/demo/svelte.config.js')!;
			configInput.path = 'apps/demo/other.config.js';
			mutableRecord(manifest.configurationEntrypoints[0]).sha256 = configInput.sha256;
			inputs.sort((left, right) => compareText(String(left.path), String(right.path)));
			candidate.inputManifestDigest = generatedContextInputManifestDigest(inputs as never);
			const grant = manifest.repositoryReadGrants.find(
				(entry) => entry.kind === 'FILE' && entry.path === 'apps/demo/svelte.config.js'
			)!;
			mutableRecord(grant).path = 'apps/demo/other.config.js';
			(manifest.repositoryReadGrants as unknown as Array<{ path: string }>).sort((left, right) =>
				compareText(left.path, right.path)
			);
		});
		expect(() => parseGeneratedContextEvidenceRecord(bytes(incompatibleConfiguration))).toThrow(
			/configuration entrypoints are incompatible/u
		);
	});
});
