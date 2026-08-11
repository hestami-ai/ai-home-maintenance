import { isAbsolute, posix, relative, resolve } from 'node:path';
import ts from 'typescript';
import type {
	ConfigurationClosureRecord,
	ProjectReferenceRecord,
	ProjectSubjectRecord,
	ResolveSubjectRequest,
	SubjectDiagnostic,
	WorkspaceSubjectRecord
} from '../contracts/subject.js';
import type { SubjectCapture } from './capture-model.js';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import { canonicalPathKey, isInsideRoot, repositoryRelativePath } from './paths.js';
import { workspacePathByName } from './workspaces.js';

export interface ProjectDiscovery {
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly references: readonly ProjectReferenceRecord[];
	readonly projects: readonly ProjectSubjectRecord[];
}

export class ProjectDiscoveryFailure extends Error {
	constructor(
		readonly diagnostic: SubjectDiagnostic,
		readonly outcome:
			'ambiguous' | 'forbidden' | 'incompatible' | 'not-found' | 'unavailable' = 'incompatible'
	) {
		super(diagnostic.message);
	}
}

function slash(path: string): string {
	return path.replaceAll('\\', '/');
}

function projectDiagnostic(
	code: SubjectDiagnostic['code'],
	message: string,
	path: string | null,
	severity: SubjectDiagnostic['severity'] = 'ERROR'
): SubjectDiagnostic {
	return { code, message, path, phase: 'RESOLVE', severity };
}

function fail(
	code: SubjectDiagnostic['code'],
	message: string,
	path: string | null,
	outcome?: ProjectDiscoveryFailure['outcome']
): never {
	throw new ProjectDiscoveryFailure(projectDiagnostic(code, message, path), outcome);
}

function capturedText(capture: SubjectCapture, path: string): string | undefined {
	const bytes = capture.bytesByPath.get(path);
	return bytes === undefined ? undefined : Buffer.from(bytes).toString('utf8');
}

function normalizeWireValue(value: unknown, realRoot: string): unknown {
	if (Array.isArray(value)) return value.map((child) => normalizeWireValue(child, realRoot));
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, child]) => child !== undefined)
				.map(([key, child]) => [key, normalizeWireValue(child, realRoot)])
		);
	}
	if (typeof value === 'string' && isAbsolute(value)) {
		const absolute = resolve(value);
		if (!isInsideRoot(realRoot, absolute))
			fail(
				'PATH_ESCAPE',
				'Compiler options require an external absolute path that DWP-002 cannot freeze.',
				null,
				'forbidden'
			);
		return repositoryRelativePath(realRoot, absolute);
	}
	return value;
}

function rawStringArray(value: unknown, field: string, configPath: string): string[] | null {
	if (value === undefined) return null;
	if (!Array.isArray(value) || !value.every((child) => typeof child === 'string'))
		fail('CONFIG_MALFORMED', `${configPath}#/${field} must be an array of strings.`, configPath);
	return value as string[];
}

function rawExtends(value: unknown, configPath: string): string | readonly string[] | null {
	if (value === undefined) return null;
	if (typeof value === 'string') return value;
	if (Array.isArray(value) && value.every((child) => typeof child === 'string')) return value;
	fail(
		'CONFIG_MALFORMED',
		`${configPath}#/extends must be a string or array of strings.`,
		configPath
	);
}

function referenceConfigPath(capture: SubjectCapture, absolute: string): string {
	if (!isInsideRoot(capture.realRoot, resolve(absolute)))
		fail('PATH_ESCAPE', 'Project reference escapes the repository.', null, 'forbidden');
	let candidate = repositoryRelativePath(capture.realRoot, absolute);
	if (!candidate.endsWith('.json')) {
		const nested = `${candidate}/tsconfig.json`;
		if (capture.bytesByPath.has(nested)) candidate = nested;
		else candidate = `${candidate}.json`;
	}
	return candidate;
}

function assertExtendsDepth(
	capture: SubjectCapture,
	rootConfigPath: string,
	workspaces: readonly WorkspaceSubjectRecord[],
	maxDepth: number
): void {
	const workspaceNames = workspacePathByName(workspaces);
	const actualPaths = new Map(
		capture.artifacts.map((artifact) => [artifact.canonicalPathKey, artifact.path])
	);
	const actualPath = (candidate: string): string =>
		actualPaths.get(canonicalPathKey(candidate)) ?? candidate;
	const configCandidate = (candidate: string): string => {
		const normalized = posix.normalize(candidate);
		if (normalized === '..' || normalized.startsWith('../') || posix.isAbsolute(normalized))
			fail(
				'PATH_ESCAPE',
				'Configuration extends target escapes the repository.',
				candidate,
				'forbidden'
			);
		const exact = actualPath(normalized);
		if (capture.bytesByPath.has(exact) || normalized.endsWith('.json')) return exact;
		return actualPath(`${normalized}.json`);
	};
	const resolveExtends = (from: string, specifier: string): string | null => {
		if (specifier.includes('\\') || posix.isAbsolute(specifier) || /^[A-Za-z]:/u.test(specifier))
			fail(
				'PATH_ESCAPE',
				`Configuration extends target is not repository-relative: ${specifier}.`,
				from,
				'forbidden'
			);
		let path: string | undefined;
		if (specifier.startsWith('.')) path = posix.join(posix.dirname(from), specifier);
		else {
			for (const [name, workspacePath] of [...workspaceNames].sort(
				(left, right) => right[0].length - left[0].length
			)) {
				if (specifier !== name && !specifier.startsWith(`${name}/`)) continue;
				const suffix = specifier.slice(name.length);
				if (suffix !== '') {
					path = `${workspacePath}${suffix}`;
					break;
				}
				const manifestPath = `${workspacePath}/package.json`;
				const manifestText = capturedText(capture, manifestPath);
				if (manifestText === undefined)
					fail(
						'CONFIG_REQUIRED_MISSING',
						`Workspace package manifest is absent while resolving ${specifier}.`,
						manifestPath
					);
				let manifest: { tsconfig?: unknown };
				try {
					manifest = JSON.parse(manifestText) as { tsconfig?: unknown };
				} catch {
					fail(
						'CONFIG_MALFORMED',
						`Workspace package manifest is malformed: ${manifestPath}.`,
						manifestPath
					);
				}
				if (manifest.tsconfig !== undefined && typeof manifest.tsconfig !== 'string')
					fail('CONFIG_MALFORMED', `${manifestPath}#/tsconfig must be a string.`, manifestPath);
				path = posix.join(workspacePath, manifest.tsconfig ?? 'tsconfig.json');
				break;
			}
		}
		if (path === undefined) return null;
		return configCandidate(path);
	};
	const active: string[] = [];
	const visit = (path: string, depth: number): void => {
		if (depth > maxDepth)
			fail(
				'BUDGET_EXCEEDED',
				`Configuration extends depth exceeded at ${path}.`,
				path,
				'unavailable'
			);
		if (active.includes(path))
			fail(
				'CONFIG_CLOSURE_CYCLE',
				`Configuration extends cycle: ${[...active, path].join(' -> ')}.`,
				path
			);
		const text = capturedText(capture, path);
		if (text === undefined) {
			if (path.includes('/.svelte-kit/tsconfig.json')) return;
			fail('CONFIG_REQUIRED_MISSING', `Required extended configuration is absent: ${path}.`, path);
		}
		const parsed = ts.parseConfigFileTextToJson(path, text);
		if (parsed.error !== undefined)
			fail(
				'CONFIG_MALFORMED',
				`Malformed captured configuration ${path}: TS${parsed.error.code}.`,
				path
			);
		const raw = parsed.config as Record<string, unknown>;
		const declarations = rawExtends(raw.extends, path);
		active.push(path);
		for (const specifier of typeof declarations === 'string'
			? [declarations]
			: (declarations ?? [])) {
			const target = resolveExtends(path, specifier);
			if (target === null)
				fail(
					'CONFIG_REQUIRED_MISSING',
					`Required extended configuration package is unavailable: ${specifier}.`,
					path
				);
			visit(target, depth + 1);
		}
		active.pop();
	};
	visit(rootConfigPath, 0);
}

function createCapturedHost(
	capture: SubjectCapture,
	workspaces: readonly WorkspaceSubjectRecord[],
	mode: 'RECORD' | 'REPLAY',
	directoryRecordings: Map<string, readonly string[]>,
	recordingReadDirectory?: typeof ts.sys.readDirectory
) {
	const names = workspacePathByName(workspaces);
	const actualByAbsolute = new Map<string, string>();
	for (const artifact of capture.artifacts) {
		actualByAbsolute.set(
			canonicalAbsolute(resolve(capture.realRoot, ...artifact.path.split('/'))),
			artifact.path
		);
	}

	function canonicalAbsolute(path: string): string {
		const normalized = slash(resolve(path));
		return ts.sys.useCaseSensitiveFileNames ? normalized : normalized.toLowerCase();
	}

	function aliasPath(absolute: string): string | undefined {
		const normalized = slash(resolve(absolute));
		const repositoryNodeModules = `${slash(resolve(capture.realRoot, 'node_modules'))}/`;
		if (
			!(ts.sys.useCaseSensitiveFileNames
				? normalized.startsWith(repositoryNodeModules)
				: normalized.toLowerCase().startsWith(repositoryNodeModules.toLowerCase()))
		)
			return undefined;
		const marker = '/node_modules/';
		const markerIndex = normalized.lastIndexOf(marker);
		if (markerIndex < 0) return undefined;
		const tail = normalized.slice(markerIndex + marker.length);
		for (const [name, workspacePath] of [...names.entries()].sort(
			(left, right) => right[0].length - left[0].length
		)) {
			if (tail === name || tail.startsWith(`${name}/`)) {
				return `${workspacePath}${tail.slice(name.length)}`;
			}
		}
		return undefined;
	}

	function toCapturedPath(absolute: string): string | undefined {
		return actualByAbsolute.get(canonicalAbsolute(absolute)) ?? aliasPath(absolute);
	}

	function directoryPrefix(absolute: string): string | undefined {
		const resolved = resolve(absolute);
		if (isInsideRoot(capture.realRoot, resolved)) {
			const rel = slash(relative(capture.realRoot, resolved));
			return rel === '' ? '' : rel;
		}
		return aliasPath(absolute);
	}

	const accessed = new Set<string>();
	const unrecoverable: ts.Diagnostic[] = [];
	const directoryKey = (
		rootDir: string,
		extensions: readonly string[],
		excludes: readonly string[] | undefined,
		includes: readonly string[],
		depth: number | undefined
	): string =>
		canonicalJson({
			depth: depth ?? null,
			excludes: excludes ?? [],
			extensions,
			includes,
			rootDir: slash(rootDir).replaceAll(slash(capture.realRoot), '<root>')
		});
	const host: ts.ParseConfigFileHost = {
		fileExists(fileName) {
			const path = toCapturedPath(fileName);
			return path !== undefined && capture.bytesByPath.has(path);
		},
		getCurrentDirectory: () => capture.realRoot,
		onUnRecoverableConfigFileDiagnostic(value) {
			unrecoverable.push(value);
		},
		readDirectory(rootDir, extensions, excludes, includes, depth) {
			const prefix = directoryPrefix(rootDir);
			if (prefix === undefined) return [];
			for (const pattern of [...(excludes ?? []), ...includes]) {
				const normalized = slash(pattern);
				const wildcard = normalized.search(/[?*]/u);
				if (wildcard >= 0 && normalized.slice(wildcard).split('/').includes('..'))
					fail(
						'PATH_ESCAPE',
						'TypeScript include/exclude pattern traverses outside its bounded directory.',
						null,
						'forbidden'
					);
				const base = wildcard < 0 ? normalized : normalized.slice(0, wildcard);
				const absoluteBase = resolve(rootDir, base === '' ? '.' : base);
				if (!isInsideRoot(capture.realRoot, absoluteBase))
					fail(
						'PATH_ESCAPE',
						'TypeScript include/exclude pattern escapes the repository.',
						null,
						'forbidden'
					);
			}
			const key = directoryKey(rootDir, extensions, excludes, includes, depth);
			if (mode === 'REPLAY') {
				const recorded = directoryRecordings.get(key);
				if (recorded === undefined)
					fail(
						'CONFIG_DIAGNOSTIC',
						'Captured TypeScript host attempted an unrecorded directory query.',
						null
					);
				return recorded;
			}
			const actualRoot = resolve(capture.realRoot, ...prefix.split('/').filter(Boolean));
			if (!isInsideRoot(capture.realRoot, resolve(actualRoot)))
				fail(
					'PATH_ESCAPE',
					'TypeScript directory query escapes the repository.',
					null,
					'forbidden'
				);
			if (recordingReadDirectory === undefined)
				fail('RECONCILIATION_FAILED', 'Capture-owned TypeScript directory reader is absent.', null);
			const results = recordingReadDirectory(actualRoot, extensions, excludes, includes, depth)
				.map((fileName) => {
					if (!isInsideRoot(capture.realRoot, resolve(fileName)))
						fail(
							'PATH_ESCAPE',
							'TypeScript directory result escapes the repository.',
							null,
							'forbidden'
						);
					const path = repositoryRelativePath(capture.realRoot, fileName);
					const known =
						capture.bytesByPath.has(path) ||
						capture.excludedArtifacts.some(
							(artifact) =>
								artifact.path === path && artifact.policyId.startsWith('jan-csaa-filter/1:')
						);
					if (!known)
						fail(
							'SUBJECT_CHANGED_DURING_RESOLUTION',
							`TypeScript discovered an uncaptured repository artifact: ${path}.`,
							path,
							'unavailable'
						);
					return resolve(capture.realRoot, ...path.split('/'));
				})
				.sort();
			directoryRecordings.set(key, results);
			return results;
		},
		readFile(fileName) {
			const path = toCapturedPath(fileName);
			if (path === undefined) return undefined;
			const text = capturedText(capture, path);
			if (text !== undefined) accessed.add(path);
			return text;
		},
		useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames
	};
	return { accessed, host, unrecoverable };
}

function convertDiagnostic(capture: SubjectCapture, value: ts.Diagnostic): SubjectDiagnostic {
	let path: string | null = null;
	if (value.file !== undefined && isInsideRoot(capture.realRoot, resolve(value.file.fileName)))
		path = repositoryRelativePath(capture.realRoot, value.file.fileName);
	const message = ts
		.flattenDiagnosticMessageText(value.messageText, '\n')
		.replaceAll(capture.realRoot, '<root>')
		.replaceAll(slash(capture.realRoot), '<root>')
		.replaceAll('\\', '/');
	return projectDiagnostic(
		'CONFIG_DIAGNOSTIC',
		`TS${value.code}: ${message}`,
		path,
		value.category === ts.DiagnosticCategory.Error ? 'ERROR' : 'WARNING'
	);
}

export function recordProjectDirectoryQueries(
	capture: SubjectCapture,
	request: ResolveSubjectRequest,
	workspaces: readonly WorkspaceSubjectRecord[],
	recordingReadDirectory: typeof ts.sys.readDirectory
): ReadonlyMap<string, readonly string[]> {
	const recordings = new Map<string, readonly string[]>();
	const actualPaths = new Map(
		capture.artifacts.map((artifact) => [artifact.canonicalPathKey, artifact.path])
	);
	const pending =
		request.scope.kind === 'EXPLICIT_PROJECTS'
			? request.scope.projects.map((path) => actualPaths.get(canonicalPathKey(path)) ?? path)
			: capture.artifacts
					.filter((artifact) => artifact.primaryClass === 'PROJECT_CONFIGURATION')
					.map((artifact) => artifact.path);
	const visited = new Set<string>();
	while (pending.length > 0) {
		if (visited.size >= request.budgets.maxProjects)
			fail(
				'BUDGET_EXCEEDED',
				'Project count exceeded while capturing TypeScript directory queries.',
				null,
				'unavailable'
			);
		const configPath = pending.shift()!;
		if (visited.has(configPath) || !capture.bytesByPath.has(configPath)) continue;
		visited.add(configPath);
		const text = capturedText(capture, configPath)!;
		if (ts.parseConfigFileTextToJson(configPath, text).error !== undefined) continue;
		const recording = createCapturedHost(
			capture,
			workspaces,
			'RECORD',
			recordings,
			recordingReadDirectory
		);
		const parsed = ts.getParsedCommandLineOfConfigFile(
			resolve(capture.realRoot, ...configPath.split('/')),
			{},
			recording.host
		);
		for (const reference of parsed?.projectReferences ?? []) {
			const target = referenceConfigPath(capture, ts.resolveProjectReferencePath(reference));
			if (!visited.has(target)) pending.push(target);
		}
	}
	return recordings;
}

export function discoverProjects(
	capture: SubjectCapture,
	request: ResolveSubjectRequest,
	workspaces: readonly WorkspaceSubjectRecord[]
): ProjectDiscovery {
	if (ts.versionMajorMinor !== '5.9')
		fail(
			'CONFIG_DIAGNOSTIC',
			`TypeScript 5.9 is required; captured resolver is running ${ts.versionMajorMinor}.`,
			null
		);
	const actualPaths = new Map(
		capture.artifacts.map((artifact) => [artifact.canonicalPathKey, artifact.path])
	);
	const candidates =
		request.scope.kind === 'EXPLICIT_PROJECTS'
			? request.scope.projects.map((path) => actualPaths.get(canonicalPathKey(path)) ?? path)
			: capture.artifacts
					.filter((artifact) => artifact.primaryClass === 'PROJECT_CONFIGURATION')
					.map((artifact) => artifact.path);
	for (const candidate of candidates) {
		if (!capture.bytesByPath.has(candidate))
			fail(
				'PROJECT_NOT_FOUND',
				`Requested TypeScript project was not captured: ${candidate}.`,
				candidate,
				'not-found'
			);
	}
	const projects = new Map<string, ProjectSubjectRecord>();
	const references: ProjectReferenceRecord[] = [];
	const visiting: string[] = [];
	const diagnostics: SubjectDiagnostic[] = [];

	const visit = (configPath: string, depth: number): void => {
		const cycleAt = visiting.indexOf(configPath);
		if (cycleAt >= 0)
			fail(
				'REFERENCE_CYCLE',
				`Project-reference cycle: ${[...visiting.slice(cycleAt), configPath].join(' -> ')}.`,
				configPath
			);
		if (projects.has(configPath)) return;
		if (depth > request.budgets.maxConfigDepth)
			fail(
				'BUDGET_EXCEEDED',
				`Project/config depth exceeded at ${configPath}.`,
				configPath,
				'unavailable'
			);
		if (projects.size + visiting.length >= request.budgets.maxProjects)
			fail(
				'BUDGET_EXCEEDED',
				'Project count exceeded the request budget.',
				configPath,
				'unavailable'
			);
		const leafText = capturedText(capture, configPath);
		if (leafText === undefined)
			fail(
				'REFERENCE_REQUIRED_MISSING',
				`Required project configuration is absent: ${configPath}.`,
				configPath,
				'incompatible'
			);
		const literal = ts.parseConfigFileTextToJson(configPath, leafText);
		if (literal.error !== undefined)
			fail(
				'CONFIG_MALFORMED',
				`TS${literal.error.code}: ${ts.flattenDiagnosticMessageText(literal.error.messageText, '\n')}`,
				configPath
			);
		const raw = literal.config as Record<string, unknown>;
		assertExtendsDepth(capture, configPath, workspaces, request.budgets.maxConfigDepth);
		const literalExtends = rawExtends(raw.extends, configPath);
		if (
			raw.compilerOptions !== undefined &&
			(raw.compilerOptions === null ||
				Array.isArray(raw.compilerOptions) ||
				typeof raw.compilerOptions !== 'object')
		)
			fail('CONFIG_MALFORMED', `${configPath}#/compilerOptions must be an object.`, configPath);
		const generatedExtendsAbsent = (
			typeof literalExtends === 'string' ? [literalExtends] : (literalExtends ?? [])
		).some((value) => value.includes('.svelte-kit'));
		const absoluteConfig = resolve(capture.realRoot, ...configPath.split('/'));
		const replay = createCapturedHost(
			capture,
			workspaces,
			'REPLAY',
			new Map(capture.typescriptDirectoryRecordings)
		);
		const parsed = ts.getParsedCommandLineOfConfigFile(absoluteConfig, {}, replay.host);
		if (parsed === undefined)
			fail('CONFIG_MALFORMED', `TypeScript could not parse ${configPath}.`, configPath);
		const accessed = replay.accessed;
		const unrecoverable = replay.unrecoverable;
		const allTsDiagnostics = [...unrecoverable, ...parsed.errors];
		for (const value of allTsDiagnostics) {
			const converted = convertDiagnostic(capture, value);
			diagnostics.push(converted);
			const exactAbsentGeneratedConfig =
				value.code === 5083 &&
				generatedExtendsAbsent &&
				converted.message.includes('.svelte-kit/tsconfig.json');
			if ((value.code === 5083 || value.code === 6053) && !exactAbsentGeneratedConfig)
				fail('CONFIG_REQUIRED_MISSING', converted.message, configPath, 'incompatible');
			if (value.code === 18000) fail('CONFIG_CLOSURE_CYCLE', converted.message, configPath);
			if (
				value.category === ts.DiagnosticCategory.Error &&
				!exactAbsentGeneratedConfig &&
				(converted.path?.includes('/.svelte-kit/tsconfig.json') === true ||
					converted.message.includes('.svelte-kit/tsconfig.json'))
			)
				fail('CONFIG_MALFORMED', converted.message, converted.path ?? configPath);
		}
		for (const path of accessed) {
			if (!path.endsWith('.json')) continue;
			const text = capturedText(capture, path)!;
			const parsedClosure = ts.parseConfigFileTextToJson(path, text);
			if (parsedClosure.error !== undefined)
				fail(
					'CONFIG_MALFORMED',
					`Malformed captured configuration ${path}: TS${parsedClosure.error.code}.`,
					path
				);
		}
		if (diagnostics.length > request.budgets.maxDiagnostics)
			fail(
				'BUDGET_EXCEEDED',
				'TypeScript diagnostics exceeded the request budget.',
				configPath,
				'unavailable'
			);
		const fileNames: string[] = [];
		let incompleteRoots = false;
		for (const fileName of parsed.fileNames) {
			if (!isInsideRoot(capture.realRoot, resolve(fileName)))
				fail('PATH_ESCAPE', `Compiler root escapes repository.`, configPath, 'forbidden');
			const path = repositoryRelativePath(capture.realRoot, fileName);
			if (!capture.bytesByPath.has(path)) {
				const filtered = capture.excludedArtifacts.some(
					(artifact) => artifact.path === path && artifact.policyId.startsWith('jan-csaa-filter/1:')
				);
				if (!filtered)
					fail(
						'CONFIG_REQUIRED_MISSING',
						`TypeScript returned an unreadable or uncaptured compiler root: ${path}.`,
						path,
						'incompatible'
					);
				incompleteRoots = true;
				diagnostics.push(
					projectDiagnostic(
						'TYPESCRIPT_PROJECT_PARTIAL',
						`Compiler root was excluded by the request filter: ${path}.`,
						path,
						'WARNING'
					)
				);
			}
			fileNames.push(path);
		}
		const referencePaths = (parsed.projectReferences ?? []).map((reference) =>
			referenceConfigPath(capture, ts.resolveProjectReferencePath(reference))
		);
		const explicitEmpty =
			Array.isArray(raw.files) &&
			raw.files.length === 0 &&
			(raw.include === undefined || (Array.isArray(raw.include) && raw.include.length === 0));
		const kind: ProjectSubjectRecord['kind'] = /tsconfig\.build\.json$/u.test(configPath)
			? 'BUILD'
			: explicitEmpty
				? 'SOLUTION'
				: 'PROJECT';
		const rootDisposition: ProjectSubjectRecord['rootDisposition'] =
			fileNames.length > 0
				? 'COMPILER_ROOTS'
				: explicitEmpty
					? 'INTENTIONAL_EMPTY_SOLUTION'
					: 'INCOMPLETE';
		const workspace = workspaces
			.filter(
				(item) =>
					configPath === `${item.path}/tsconfig.json` || configPath.startsWith(`${item.path}/`)
			)
			.sort((left, right) => right.path.length - left.path.length)[0];
		const frameworkCandidates =
			workspace === undefined
				? []
				: capture.artifacts
						.filter(
							(artifact) =>
								artifact.roles.includes('FRAMEWORK_CANDIDATE') &&
								artifact.path.startsWith(`${workspace.path}/`)
						)
						.map((artifact) => artifact.path);
		const configDiagnostics = allTsDiagnostics.map((value) => convertDiagnostic(capture, value));
		const status: ProjectSubjectRecord['status'] =
			incompleteRoots ||
			rootDisposition === 'INCOMPLETE' ||
			configDiagnostics.some((item) => item.severity === 'ERROR') ||
			frameworkCandidates.length > 0
				? 'PARTIAL'
				: 'COMPLETE';
		const closure: ConfigurationClosureRecord[] = [...accessed]
			.map((path) => {
				const artifact = capture.artifacts.find((item) => item.path === path);
				if (artifact === undefined)
					fail(
						'CONFIG_REQUIRED_MISSING',
						`Configuration closure read was not content-bound: ${path}.`,
						path
					);
				return { path, requiredBy: [configPath], sha256: artifact.sha256 };
			})
			.sort((left, right) => (left.path < right.path ? -1 : 1));
		const configClosureDigest = sha256(
			canonicalJson(closure.map(({ path, sha256: digest }) => ({ path, sha256: digest })))
		);
		const nativeCompilerOptions = normalizeWireValue(parsed.options, capture.realRoot) as Readonly<
			Record<string, unknown>
		>;
		const programRecipeBase = {
			compilerOptions: nativeCompilerOptions,
			configClosureDigest,
			configPath,
			kind,
			projectReferences: [...new Set(referencePaths)].sort(),
			provider: { id: 'typescript' as const, version: ts.version },
			rootNames: [...new Set(fileNames)].sort()
		};
		const record: ProjectSubjectRecord = {
			configClosure: closure,
			configPath,
			effectiveCompilerOptions: nativeCompilerOptions,
			fileNames: [...new Set(fileNames)].sort(),
			frameworkCandidates: [...new Set(frameworkCandidates)].sort(),
			kind,
			projectReferences: [...new Set(referencePaths)].sort(),
			programRecipe: {
				...programRecipeBase,
				projectResolutionDigest: sha256(canonicalJson(programRecipeBase))
			},
			rawCompilerOptions:
				raw.compilerOptions !== null && typeof raw.compilerOptions === 'object'
					? (raw.compilerOptions as Readonly<Record<string, unknown>>)
					: {},
			rawExclude: rawStringArray(raw.exclude, 'exclude', configPath),
			rawExtends: literalExtends,
			rawFiles: rawStringArray(raw.files, 'files', configPath),
			rawInclude: rawStringArray(raw.include, 'include', configPath),
			rootDisposition,
			status,
			typescriptDiagnostics: configDiagnostics
		};
		visiting.push(configPath);
		for (const target of [...new Set(referencePaths)].sort()) {
			if (!capture.bytesByPath.has(target))
				fail(
					'REFERENCE_REQUIRED_MISSING',
					`Required referenced project is absent: ${target}.`,
					target,
					'incompatible'
				);
			references.push({ fromProject: configPath, toProject: target });
			visit(target, depth + 1);
		}
		visiting.pop();
		projects.set(configPath, record);
	};

	for (const candidate of [...new Set(candidates)].sort()) visit(candidate, 0);
	return {
		diagnostics: diagnostics.sort((left, right) =>
			`${left.path ?? ''}:${left.message}` < `${right.path ?? ''}:${right.message}` ? -1 : 1
		),
		references: references.sort((left, right) =>
			`${left.fromProject}:${left.toProject}` < `${right.fromProject}:${right.toProject}` ? -1 : 1
		),
		projects: [...projects.values()].sort((left, right) =>
			left.configPath < right.configPath ? -1 : 1
		)
	};
}
