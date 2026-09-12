import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type ResolveSubjectRequest
} from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { resolveSubject } from '../../subject/resolve-subject.js';
import type { ProviderImportContext, ProviderRunInput } from './provider-evidence.js';

const roots: string[] = [];

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

export function providerFixture(
	files: Readonly<Record<string, string>> = {
		'packages/demo/src/index.ts': 'export const value = 1;\n',
		'packages/demo/src/index.test.ts':
			"import { expect, it } from 'vitest';\nit('works', () => expect(1).toBe(1));\n"
	}
): { readonly root: string; readonly subject: FrozenSubject } {
	const root = mkdtempSync(join(tmpdir(), 'csaa-provider-'));
	roots.push(root);
	write(
		root,
		'package.json',
		JSON.stringify({ name: 'provider-fixture', private: true, workspaces: ['packages/*'] })
	);
	write(root, 'bun.lock', '{}\n');
	write(root, 'tsconfig.json', JSON.stringify({ files: [], include: [] }));
	write(
		root,
		'packages/demo/package.json',
		JSON.stringify({ name: '@fixture/demo', private: true, version: '0.0.0' })
	);
	write(root, 'packages/demo/tsconfig.json', JSON.stringify({ include: ['src'] }));
	for (const [path, content] of Object.entries(files)) write(root, path, content);
	const request: ResolveSubjectRequest = {
		budgets: {
			maxBytes: 32 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 100,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 100
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'provider-fixture/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE'
	};
	const outcome = resolveSubject(request);
	if (outcome.outcome !== 'resolved')
		throw new Error(`Provider fixture did not resolve: ${outcome.outcome}`);
	return { root, subject: outcome.subject };
}

export function providerContext(
	root: string,
	subject: FrozenSubject,
	providerId: string,
	overrides: Partial<ProviderRunInput> & {
		readonly assessedAt?: string;
		readonly freshnessWindowMs?: number;
	} = {}
): ProviderImportContext {
	const { assessedAt, freshnessWindowMs, ...runOverrides } = overrides;
	const providerVersion =
		providerId === 'eslint'
			? '9.39.5'
			: providerId === 'vitest' || providerId === 'vitest-v8-coverage'
				? '4.1.10'
				: '1.0.0';
	const run: ProviderRunInput = {
		command: ['provider', '--json'],
		endedAt: '2026-08-25T12:00:01.000Z',
		environmentSha256: sha256('closed-environment'),
		outputComplete: true,
		profile: 'deterministic-test',
		provider: {
			configurationSha256: sha256('configuration'),
			dependencyClosureSha256: sha256('dependency-closure'),
			executableSha256: sha256('executable'),
			id: providerId,
			version: providerVersion
		},
		runId: 'provider-run-1',
		startedAt: '2026-08-25T12:00:00.000Z',
		subjectId: subject.descriptor.subjectId,
		subjectManifestSha256: subject.descriptor.fileManifestDigest,
		termination: { exitCode: 0, kind: 'EXITED' },
		...runOverrides
	};
	return {
		assessedAt: assessedAt ?? '2026-08-25T12:00:02.000Z',
		freshnessWindowMs: freshnessWindowMs ?? 60_000,
		repositoryRoot: root,
		run,
		subject
	};
}

export function cleanupProviderFixtures(): void {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
}
