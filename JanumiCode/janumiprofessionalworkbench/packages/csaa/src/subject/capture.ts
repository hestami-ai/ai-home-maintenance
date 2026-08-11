import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import type {
	CapturedArtifactRecord,
	ExcludedArtifactRecord,
	ResolveSubjectRequest,
	SubjectDiagnostic
} from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { classifyArtifact } from './artifacts.js';
import type { FileFingerprint, SubjectCapture } from './capture-model.js';
import {
	canonicalPathKey,
	isInsideRoot,
	resolveExistingRepositoryPath,
	resolveRepositoryRoot
} from './paths.js';
import {
	exactOutputExclusion,
	exclusionForDirectory,
	generatedDirectoryException,
	isRequestedPath,
	sensitiveOrLocalStateExclusion,
	subjectFilterPolicyId,
	validateRequestPaths
} from './policy.js';
import { recordProjectDirectoryQueries } from './projects.js';
import { discoverWorkspaces } from './workspaces.js';

export class CaptureFailure extends Error {
	constructor(
		readonly diagnostic: SubjectDiagnostic,
		readonly outcome: 'forbidden' | 'incompatible' | 'not-found' | 'unavailable'
	) {
		super(diagnostic.message);
	}
}

function diagnostic(
	code: SubjectDiagnostic['code'],
	message: string,
	path: string | null,
	phase: SubjectDiagnostic['phase'] = 'CAPTURE'
): SubjectDiagnostic {
	return { code, message, path, phase, severity: 'ERROR' };
}

function redactRoot(message: string, root: string, replacement: '<root>' | '<runtime>'): string {
	return message
		.replaceAll(root, replacement)
		.replaceAll(root.replaceAll('\\', '/'), replacement)
		.replaceAll('\\', '/');
}

function failure(
	code: SubjectDiagnostic['code'],
	message: string,
	path: string | null,
	outcome: CaptureFailure['outcome'] = 'incompatible'
): never {
	throw new CaptureFailure(diagnostic(code, message, path), outcome);
}

function rootFileCandidate(name: string): boolean {
	return (
		name === 'package.json' ||
		/^(?:bun\.lock|bunfig\.toml|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/u.test(name) ||
		/^(?:tsconfig|turbo|vitest|vite|eslint|prettier|sonar|\.dependency-cruiser)[^/]*\.(?:json|[cm]?[jt]s|toml|ya?ml|properties)$/u.test(
			name
		) ||
		/^\.(?:gitignore|prettierignore|prettierrc|eslintignore)/u.test(name)
	);
}

function workspaceBases(rootManifest: Uint8Array): string[] {
	try {
		const parsed = JSON.parse(Buffer.from(rootManifest).toString('utf8')) as {
			workspaces?: string[] | { packages?: string[] };
		};
		const patterns = Array.isArray(parsed.workspaces)
			? parsed.workspaces
			: (parsed.workspaces?.packages ?? []);
		return [
			...new Set(
				patterns
					.map((pattern) => pattern.split('/').find((part) => part !== '' && !part.includes('*')))
					.filter((part): part is string => part !== undefined)
			)
		];
	} catch {
		failure('CONFIG_MALFORMED', 'Root package.json is not valid JSON.', 'package.json');
	}
}

function nearestExistingAncestor(realRoot: string, repositoryPath: string): string {
	let candidate = resolve(realRoot, ...repositoryPath.split('/'));
	while (!existsSync(candidate)) {
		const parent = dirname(candidate);
		if (parent === candidate)
			failure(
				'PATH_ESCAPE',
				`No in-root ancestor exists for declared output ${repositoryPath}.`,
				repositoryPath,
				'forbidden'
			);
		candidate = parent;
	}
	const real = realpathSync(candidate);
	if (!isInsideRoot(realRoot, real))
		failure(
			'SYMLINK_ESCAPE',
			`Declared output parent escapes the repository: ${repositoryPath}.`,
			repositoryPath,
			'forbidden'
		);
	return real;
}

export function captureSubject(request: ResolveSubjectRequest): SubjectCapture {
	if (
		request.schemaVersion !== 'jan-csaa-subject-request/1.0.0' ||
		request.policyVersion !== 'jan-csaa-subject-policy/1.0.0' ||
		request.subjectKind !== 'WORKTREE'
	) {
		failure(
			'UNSUPPORTED_REQUEST_VERSION',
			'Unsupported subject request, policy, or subject-kind version.',
			null
		);
	}
	try {
		validateRequestPaths(request);
	} catch (error) {
		failure(
			'FILTER_INVALID',
			error instanceof Error ? error.message : String(error),
			null,
			'forbidden'
		);
	}
	let realRoot: string;
	try {
		realRoot = resolveRepositoryRoot(request.rootLocator);
	} catch (error) {
		failure(
			'REPOSITORY_ROOT_INVALID',
			error instanceof Error
				? redactRoot(error.message, request.rootLocator, '<runtime>')
				: 'Invalid repository root.',
			null,
			'not-found'
		);
	}
	const started = Date.now();
	const artifacts: CapturedArtifactRecord[] = [];
	const excludedArtifacts: ExcludedArtifactRecord[] = [];
	const bytesByPath = new Map<string, Uint8Array>();
	const fingerprints = new Map<string, FileFingerprint>();
	const pathKeys = new Map<string, string>();
	const realTargets = new Map<string, string>();
	const directoryPaths = new Set<string>();
	const realDirectoryTargets = new Map<string, string>();
	let capturedBytes = 0;
	let discoveredPhysicalFiles = 0;

	const checkBudget = (): void => {
		if (Date.now() - started > request.budgets.maxDurationMs)
			failure(
				'BUDGET_EXCEEDED',
				'Subject capture exceeded its duration budget.',
				null,
				'unavailable'
			);
		if (artifacts.length + excludedArtifacts.length > request.budgets.maxFiles)
			failure('BUDGET_EXCEEDED', 'Subject capture exceeded its file budget.', null, 'unavailable');
		if (capturedBytes > request.budgets.maxBytes)
			failure('BUDGET_EXCEEDED', 'Subject capture exceeded its byte budget.', null, 'unavailable');
	};

	const registerIdentity = (path: string, realPath: string): string => {
		const key = canonicalPathKey(path);
		const priorPath = pathKeys.get(key);
		if (priorPath !== undefined)
			failure(
				'CANONICAL_PATH_COLLISION',
				`Canonical path collision between ${priorPath} and ${path}.`,
				path
			);
		pathKeys.set(key, path);
		const realKey = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
		const priorTarget = realTargets.get(realKey);
		if (priorTarget !== undefined && priorTarget !== path)
			failure(
				'CANONICAL_PATH_COLLISION',
				`Repository aliases ${priorTarget} and ${path} resolve to the same target.`,
				path
			);
		realTargets.set(realKey, path);
		return key;
	};

	const exclude = (
		path: string,
		decision: {
			policyId: string;
			primaryClass: ExcludedArtifactRecord['primaryClass'];
			reason: string;
		},
		physicalFileCount: number | 'UNKNOWN' = 1
	): void => {
		const key = canonicalPathKey(path);
		const priorPath = pathKeys.get(key);
		if (priorPath !== undefined)
			failure(
				'CANONICAL_PATH_COLLISION',
				`Canonical path collision between ${priorPath} and ${path}.`,
				path
			);
		pathKeys.set(key, path);
		excludedArtifacts.push({
			canonicalPathKey: key,
			disposition: 'EXCLUDED',
			path,
			physicalFileCount,
			policyId: decision.policyId,
			primaryClass: decision.primaryClass,
			reason: decision.reason,
			roles: []
		});
		if (typeof physicalFileCount === 'number') discoveredPhysicalFiles += physicalFileCount;
		checkBudget();
	};

	const captureFile = (path: string): void => {
		checkBudget();
		let resolved;
		try {
			resolved = resolveExistingRepositoryPath(realRoot, path);
		} catch (error) {
			failure(
				'SYMLINK_ESCAPE',
				`Cannot safely resolve ${path}: ${error instanceof Error ? redactRoot(error.message, realRoot, '<root>') : String(error)}`,
				path,
				'forbidden'
			);
		}
		const key = registerIdentity(path, resolved.realPath);
		let before;
		let bytes: Uint8Array;
		let after;
		try {
			before = statSync(resolved.realPath);
			if (!before.isFile()) return;
			if (
				capturedBytes + before.size > request.budgets.maxBytes ||
				artifacts.length + excludedArtifacts.length + 1 > request.budgets.maxFiles
			)
				failure(
					'BUDGET_EXCEEDED',
					`Reading ${path} would exceed the capture budget.`,
					path,
					'unavailable'
				);
			bytes = new Uint8Array(readFileSync(resolved.realPath));
			after = statSync(resolved.realPath);
		} catch (error) {
			if (error instanceof CaptureFailure) throw error;
			failure(
				'READ_FAILED',
				`Cannot read selected artifact ${path}: ${error instanceof Error ? redactRoot(error.message, realRoot, '<root>') : String(error)}`,
				path,
				'unavailable'
			);
		}
		if (
			before.size !== after.size ||
			before.mtimeMs !== after.mtimeMs ||
			bytes.byteLength !== after.size
		)
			failure(
				'SUBJECT_CHANGED_DURING_RESOLUTION',
				`Artifact changed while it was captured: ${path}.`,
				path,
				'unavailable'
			);
		discoveredPhysicalFiles += 1;
		capturedBytes += bytes.byteLength;
		const classification = classifyArtifact(path, Buffer.from(bytes).toString('utf8'));
		const contentSha256 = sha256(bytes);
		artifacts.push({
			bytes: bytes.byteLength,
			canonicalPathKey: key,
			disposition: classification.disposition,
			path,
			primaryClass: classification.primaryClass,
			reason: classification.reason,
			roles: classification.roles,
			sha256: contentSha256
		});
		bytesByPath.set(path, bytes.slice());
		fingerprints.set(path, {
			bytes: bytes.byteLength,
			modifiedMs: after.mtimeMs,
			sha256: contentSha256
		});
		checkBudget();
	};

	const confineDirectory = (path: string): void => {
		let realDirectory: string;
		try {
			realDirectory = realpathSync(resolve(realRoot, ...path.split('/')));
		} catch {
			failure('READ_FAILED', `Cannot resolve directory ${path}.`, path, 'unavailable');
		}
		if (!isInsideRoot(realRoot, realDirectory))
			failure('SYMLINK_ESCAPE', `Directory escapes repository root: ${path}.`, path, 'forbidden');
		const key = process.platform === 'win32' ? realDirectory.toLowerCase() : realDirectory;
		const prior = realDirectoryTargets.get(key);
		if (prior !== undefined && prior !== path)
			failure(
				'CANONICAL_PATH_COLLISION',
				`Repository directory aliases ${prior} and ${path} resolve to the same target.`,
				path
			);
		realDirectoryTargets.set(key, path);
		directoryPaths.add(path);
	};

	const walkGeneratedContext = (directoryPath: string): void => {
		confineDirectory(directoryPath);
		const absolute = resolve(realRoot, ...directoryPath.split('/'));
		for (const entry of readdirSync(absolute, { withFileTypes: true })) {
			const path = `${directoryPath}/${entry.name}`;
			if (entry.isDirectory()) {
				confineDirectory(path);
				if (path.endsWith('/types')) walkGeneratedContext(path);
				else if (directoryPath.includes('/types')) walkGeneratedContext(path);
				else
					exclude(
						path,
						{
							policyId: 'jan-csaa-exclude-build/1',
							primaryClass: 'BUILD_OUTPUT',
							reason: 'Unconsumed generated framework output.'
						},
						'UNKNOWN'
					);
			} else if (entry.isFile() || entry.isSymbolicLink()) {
				if (
					generatedDirectoryException(path) ||
					/\/types\/.*\.d\.ts$/u.test(path) ||
					/\/(?:ambient|env|non-ambient)\.d\.ts$/u.test(path)
				)
					captureFile(path);
				else
					exclude(path, {
						policyId: 'jan-csaa-exclude-build/1',
						primaryClass: 'BUILD_OUTPUT',
						reason: 'Unconsumed generated framework output.'
					});
			}
		}
	};

	const walk = (directoryPath: string): void => {
		checkBudget();
		const absolute = resolve(realRoot, ...directoryPath.split('/'));
		let entries;
		try {
			confineDirectory(directoryPath);
			const realDirectory = realpathSync(absolute);
			entries = readdirSync(realDirectory, { withFileTypes: true });
		} catch (error) {
			if (error instanceof CaptureFailure) throw error;
			failure('READ_FAILED', `Cannot enumerate ${directoryPath}.`, directoryPath, 'unavailable');
		}
		for (const entry of entries.sort((left, right) =>
			left.name < right.name ? -1 : left.name > right.name ? 1 : 0
		)) {
			const path = `${directoryPath}/${entry.name}`;
			let symbolicTargetIsDirectory = false;
			if (entry.isSymbolicLink()) {
				let realTarget: string;
				try {
					realTarget = realpathSync(resolve(realRoot, ...path.split('/')));
				} catch {
					failure('READ_FAILED', `Cannot resolve repository link ${path}.`, path, 'unavailable');
				}
				if (!isInsideRoot(realRoot, realTarget))
					failure('SYMLINK_ESCAPE', `Repository link escapes root: ${path}.`, path, 'forbidden');
				symbolicTargetIsDirectory = statSync(realTarget).isDirectory();
			}
			const entryIsDirectory = entry.isDirectory() || symbolicTargetIsDirectory;
			if (entryIsDirectory) confineDirectory(path);
			const outputDecision = exactOutputExclusion(path, request.outputs);
			if (outputDecision !== null) {
				if (!pathKeys.has(canonicalPathKey(path))) exclude(path, outputDecision);
				continue;
			}
			if (entryIsDirectory) {
				const decision = exclusionForDirectory(entry.name, path);
				if (entry.name === '.svelte-kit') {
					walkGeneratedContext(path);
					continue;
				}
				if (decision !== null) {
					exclude(path, decision, 'UNKNOWN');
					continue;
				}
				walk(path);
				continue;
			}
			const localStateDecision = sensitiveOrLocalStateExclusion(path);
			if (localStateDecision !== null) {
				exclude(path, localStateDecision);
				continue;
			}
			const classification = classifyArtifact(path);
			const requiredConfiguration = [
				'MANIFEST',
				'LOCKFILE',
				'TOOL_CONFIGURATION',
				'PROJECT_CONFIGURATION',
				'GENERATED_CONFIGURATION'
			].includes(classification.primaryClass);
			if (!requiredConfiguration && !isRequestedPath(path, request)) {
				exclude(path, {
					policyId: subjectFilterPolicyId(request),
					primaryClass: classification.primaryClass,
					reason: 'Artifact excluded by bounded request filter.'
				});
				continue;
			}
			captureFile(path);
		}
	};

	for (const output of request.outputs) {
		nearestExistingAncestor(realRoot, output);
		exclude(output, exactOutputExclusion(output, request.outputs)!, 'UNKNOWN');
	}
	if (!existsSync(resolve(realRoot, 'package.json')))
		failure(
			'CONFIG_REQUIRED_MISSING',
			'Root package.json is required.',
			'package.json',
			'not-found'
		);
	captureFile('package.json');
	const bases = workspaceBases(bytesByPath.get('package.json')!);
	const rootEntries = readdirSync(realRoot, { withFileTypes: true }).sort((left, right) =>
		left.name < right.name ? -1 : 1
	);
	for (const entry of rootEntries) {
		const name = entry.name;
		if (
			rootFileCandidate(name) &&
			name !== 'package.json' &&
			(entry.isFile() || entry.isSymbolicLink())
		) {
			const outputDecision = exactOutputExclusion(name, request.outputs);
			if (outputDecision !== null) {
				if (!pathKeys.has(canonicalPathKey(name))) exclude(name, outputDecision);
			} else if (
				[
					'MANIFEST',
					'LOCKFILE',
					'TOOL_CONFIGURATION',
					'PROJECT_CONFIGURATION',
					'GENERATED_CONFIGURATION'
				].includes(classifyArtifact(name).primaryClass) ||
				isRequestedPath(name, request)
			)
				captureFile(name);
			else
				exclude(name, {
					policyId: subjectFilterPolicyId(request),
					primaryClass: classifyArtifact(name).primaryClass,
					reason: 'Artifact excluded by bounded request filter.'
				});
		}
	}
	const includedBases = [...new Set([...bases, 'scripts', 'verif', '.github'])].sort();
	for (const base of includedBases) {
		const absolute = resolve(realRoot, base);
		if (existsSync(absolute)) {
			const realBase = realpathSync(absolute);
			if (!isInsideRoot(realRoot, realBase))
				failure(
					'SYMLINK_ESCAPE',
					`Configured subject root escapes repository: ${base}.`,
					base,
					'forbidden'
				);
			if (statSync(realBase).isDirectory()) walk(base);
		}
	}
	for (const entry of rootEntries) {
		const path = entry.name;
		if (
			path === 'package.json' ||
			rootFileCandidate(path) ||
			includedBases.includes(path) ||
			pathKeys.has(canonicalPathKey(path))
		)
			continue;
		let symbolicDirectory = false;
		if (entry.isSymbolicLink()) {
			const target = realpathSync(resolve(realRoot, path));
			if (!isInsideRoot(realRoot, target))
				failure(
					'SYMLINK_ESCAPE',
					`Top-level repository link escapes root: ${path}.`,
					path,
					'forbidden'
				);
			symbolicDirectory = statSync(target).isDirectory();
		}
		if (entry.isDirectory() || symbolicDirectory) {
			confineDirectory(path);
			const decision = exclusionForDirectory(entry.name, path) ?? {
				policyId: 'jan-csaa-exclude-perimeter/1',
				primaryClass: 'OTHER' as const,
				reason: 'Top-level region lies outside the configured code-analysis perimeter.'
			};
			exclude(path, decision, 'UNKNOWN');
			continue;
		}
		const local = sensitiveOrLocalStateExclusion(path);
		exclude(
			path,
			local ?? {
				policyId: 'jan-csaa-exclude-perimeter/1',
				primaryClass: classifyArtifact(path).primaryClass,
				reason: 'Top-level artifact lies outside the configured code-analysis perimeter.'
			}
		);
	}
	if (artifacts.length === 0 && request.expectEmpty !== true)
		failure('EMPTY_SUBJECT', 'Subject discovery selected no artifacts.', null);
	const preliminary: SubjectCapture = {
		artifacts: artifacts.sort((left, right) => (left.path < right.path ? -1 : 1)),
		bytesByPath,
		diagnostics: [],
		directoryPaths: [...directoryPaths].sort(),
		discoveredArtifactCount: discoveredPhysicalFiles,
		excludedArtifacts: excludedArtifacts.sort((left, right) => (left.path < right.path ? -1 : 1)),
		fingerprints,
		realRoot,
		typescriptDirectoryRecordings: new Map()
	};
	const workspaces = discoverWorkspaces(preliminary).workspaces;
	const typescriptDirectoryRecordings = recordProjectDirectoryQueries(
		preliminary,
		request,
		workspaces,
		ts.sys.readDirectory
	);
	checkBudget();
	return { ...preliminary, typescriptDirectoryRecordings };
}
