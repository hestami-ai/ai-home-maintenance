import type { ArtifactPrimaryClass, ResolveSubjectRequest } from '../contracts/subject.js';
import ts from 'typescript';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import {
	assertCanonicalRelativePath,
	assertNoCanonicalPathCollisions,
	canonicalPathKey
} from './paths.js';

export const SUBJECT_EXCLUSION_POLICY_IDS = [
	'jan-csaa-exclude-build/1',
	'jan-csaa-exclude-cache/1',
	'jan-csaa-exclude-external/1',
	'jan-csaa-exclude-local-state/1',
	'jan-csaa-exclude-output/1',
	'jan-csaa-exclude-perimeter/1',
	'jan-csaa-exclude-vcs/1'
] as const;

export interface ExclusionDecision {
	readonly policyId: string;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly reason: string;
}

const directoryRules = new Map<string, ExclusionDecision>([
	[
		'.git',
		{
			policyId: 'jan-csaa-exclude-vcs/1',
			primaryClass: 'VENDOR',
			reason: 'VCS administration is outside the source subject.'
		}
	],
	[
		'node_modules',
		{
			policyId: 'jan-csaa-exclude-external/1',
			primaryClass: 'EXTERNAL_DEPENDENCY',
			reason: 'Installed third-party dependencies are outside the authored subject.'
		}
	],
	[
		'dist',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'Compiled output is not an authored compiler input.'
		}
	],
	[
		'build',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'Build output is not an authored compiler input.'
		}
	],
	[
		'coverage',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'Coverage output is derived evidence, not a compiler input.'
		}
	],
	[
		'.turbo',
		{
			policyId: 'jan-csaa-exclude-cache/1',
			primaryClass: 'CACHE',
			reason: 'Tool cache is outside the source subject.'
		}
	],
	[
		'.csaa',
		{
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'CSAA local state cannot enter its own subject.'
		}
	],
	[
		'.janumicode',
		{
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'JanumiCode local state is not source input.'
		}
	],
	[
		'.sonar-remediation',
		{
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'Local remediation state is not source input.'
		}
	],
	[
		'.stryker-tmp',
		{
			policyId: 'jan-csaa-exclude-cache/1',
			primaryClass: 'CACHE',
			reason: 'Mutation-runner temporary state is not source input.'
		}
	],
	[
		'playwright-report',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'Playwright reports are derived outputs.'
		}
	],
	[
		'test-results',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'Test results are derived outputs.'
		}
	],
	[
		'e2e-results',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'E2E results are derived outputs.'
		}
	],
	[
		'package',
		{
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason: 'Packaged output is derived.'
		}
	]
]);

export function validateRequestPaths(request: ResolveSubjectRequest): void {
	for (const value of [...request.filters.include, ...request.filters.exclude]) {
		validateBoundedPattern(value);
	}
	for (const output of request.outputs) {
		assertCanonicalRelativePath(output);
		if (output.includes('*') || output.includes('?'))
			throw new Error(`Output must be an exact path: ${output}`);
	}
	assertNoCanonicalPathCollisions(request.outputs);
	for (const evidence of request.generatedContextEvidence ?? []) {
		assertCanonicalRelativePath(evidence.path);
		assertCanonicalRelativePath(evidence.source);
		if (
			[evidence.generatorInputDigest, evidence.recordedInputDigest, evidence.source].some(
				(value) => value.trim() === ''
			)
		)
			throw new Error(`Generated-context evidence is incomplete: ${evidence.path}`);
	}
	assertNoCanonicalPathCollisions(
		(request.generatedContextEvidence ?? []).map((evidence) => evidence.path)
	);
	if (request.scope.kind === 'EXPLICIT_PROJECTS') {
		if (request.scope.projects.length === 0)
			throw new Error('Explicit project scope must name at least one project.');
		for (const project of request.scope.projects) assertCanonicalRelativePath(project);
		assertNoCanonicalPathCollisions(request.scope.projects);
		for (const artifact of request.scope.additionalArtifacts ?? []) {
			assertCanonicalRelativePath(artifact);
			if (artifact.includes('*') || artifact.includes('?'))
				throw new Error(`Additional artifact must be an exact path: ${artifact}`);
		}
		assertNoCanonicalPathCollisions(request.scope.additionalArtifacts ?? []);
		assertNoCanonicalPathCollisions([
			...request.scope.projects,
			...(request.scope.additionalArtifacts ?? [])
		]);
	}
	if (request.operationVersion.trim() === '')
		throw new Error('Operation version must be nonempty.');
	for (const [name, budget] of Object.entries(request.budgets)) {
		if (!Number.isSafeInteger(budget) || budget <= 0)
			throw new Error(`Budget ${name} must be a positive safe integer.`);
	}
}

export function validateBoundedPattern(pattern: string): void {
	if (
		pattern.length === 0 ||
		pattern.includes('\\') ||
		pattern.startsWith('/') ||
		/^[A-Za-z]:/u.test(pattern)
	) {
		throw new Error(`Filter must be repository-relative and slash-normalized: ${pattern}`);
	}
	if (pattern.split('/').some((part) => part === '..' || part === '.')) {
		throw new Error(`Filter cannot traverse outside its repository perimeter: ${pattern}`);
	}
	if (['[', ']', '{', '}', '!'].some((character) => pattern.includes(character)))
		throw new Error(`Unsupported filter syntax: ${pattern}`);
}

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
}

export function globMatches(path: string, glob: string): boolean {
	let source = '';
	for (let index = 0; index < glob.length; index += 1) {
		const char = glob[index]!;
		if (char !== '*') {
			source += char === '?' ? '[^/]' : escapeRegex(char);
			continue;
		}
		if (glob[index + 1] === '*') {
			index += 1;
			if (glob[index + 1] === '/') {
				index += 1;
				source += '(?:.*/)?';
			} else source += '.*';
		} else source += '[^/]*';
	}
	return new RegExp(`^${source}$`, ts.sys.useCaseSensitiveFileNames ? 'u' : 'iu').test(path);
}

export function isRequestedPath(path: string, request: ResolveSubjectRequest): boolean {
	const included =
		request.filters.include.length === 0 ||
		request.filters.include.some((pattern) => globMatches(path, pattern));
	return included && !request.filters.exclude.some((pattern) => globMatches(path, pattern));
}

export function exclusionForDirectory(name: string, path: string): ExclusionDecision | null {
	if (name === '.svelte-kit')
		return {
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT',
			reason:
				'Generated framework output is excluded except consumed configuration and declaration roots.'
		};
	if (path === 'apps/rph-demo/harness')
		return {
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'RPH demo harness state is outside the accepted DWP-002 subject.'
		};
	return (
		directoryRules.get(name) ??
		(path === 'package'
			? {
					policyId: 'jan-csaa-exclude-build/1',
					primaryClass: 'BUILD_OUTPUT',
					reason: 'Packaged output is derived.'
				}
			: null)
	);
}

export function exactOutputExclusion(
	path: string,
	outputs: readonly string[]
): ExclusionDecision | null {
	for (const output of outputs) {
		if (
			canonicalPathKey(path) === canonicalPathKey(output) ||
			isReplacementTemporary(path, output)
		) {
			return {
				policyId: subjectOutputPolicyId(outputs),
				primaryClass: 'BUILD_OUTPUT',
				reason:
					canonicalPathKey(path) === canonicalPathKey(output)
						? 'Declared generated output is outside its own subject.'
						: 'Atomic replacement temporary for a declared generated output.'
			};
		}
	}
	return null;
}

export function sensitiveOrLocalStateExclusion(path: string): ExclusionDecision | null {
	if (
		[
			'scripts/mutants/.harvest-run.json',
			'scripts/mutants/.harvest.json',
			'scripts/mutants/.in-flight'
		].includes(path)
	) {
		return {
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'Known mutation-runner transient state is not a source input.'
		};
	}
	const name = path.split('/').at(-1)!;
	if (
		name === '.DS_Store' ||
		name.endsWith('.tsbuildinfo') ||
		/^vite\.config\.(?:js|ts)\.timestamp-/u.test(name)
	) {
		return {
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'Platform or tool-local transient state is not source input.'
		};
	}
	if ((name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example')) {
		return {
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'Environment/secrets files are never ingested.'
		};
	}
	if (/\.(?:pem|key|p12|pfx)$/iu.test(name) || /(?:^|[-_.])credentials?(?:[-_.]|$)/iu.test(name)) {
		return {
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'Credential or private-key material is never ingested.'
		};
	}
	if (path.startsWith('apps/rph-demo/harness/')) {
		return {
			policyId: 'jan-csaa-exclude-local-state/1',
			primaryClass: 'CACHE',
			reason: 'RPH demo harness state is outside the accepted DWP-002 subject.'
		};
	}
	return null;
}

export function subjectOutputPolicyId(outputs: readonly string[]): string {
	return `jan-csaa-exclude-output/1:${sha256(canonicalJson(outputs.map((path) => canonicalPathKey(path)).sort()))}`;
}

export function subjectFilterPolicyId(request: ResolveSubjectRequest): string {
	const normalize = (value: string): string =>
		ts.sys.useCaseSensitiveFileNames ? value : value.toLowerCase();
	const scope =
		request.scope.kind === 'REPOSITORY' ? request.scope : explicitScopePreimage(request);
	const canonicalPatterns = (values: readonly string[]): string[] =>
		[...new Set(values.map(normalize))].sort();
	return `jan-csaa-filter/1:${sha256(canonicalJson({ exclude: canonicalPatterns(request.filters.exclude), include: canonicalPatterns(request.filters.include), scope }))}`;
}

function explicitScopePreimage(request: ResolveSubjectRequest): {
	readonly additionalArtifacts?: readonly string[];
	readonly kind: 'EXPLICIT_PROJECTS';
	readonly projects: readonly string[];
} {
	if (request.scope.kind !== 'EXPLICIT_PROJECTS')
		throw new Error('Explicit scope preimage requires an explicit-project request.');
	const additionalArtifacts = (request.scope.additionalArtifacts ?? [])
		.map((path) => canonicalPathKey(path))
		.sort();
	return {
		...(additionalArtifacts.length > 0 ? { additionalArtifacts } : {}),
		kind: request.scope.kind,
		projects: request.scope.projects.map((path) => canonicalPathKey(path)).sort()
	};
}

function isReplacementTemporary(path: string, output: string): boolean {
	const escaped = output.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(
		`^${escaped}\\.csaa-[0-9]+-[0-9]+\\.tmp$`,
		ts.sys.useCaseSensitiveFileNames ? 'u' : 'iu'
	).test(path);
}

export function generatedDirectoryException(path: string): boolean {
	return /(^|\/)\.svelte-kit\/tsconfig\.json$/u.test(path);
}
