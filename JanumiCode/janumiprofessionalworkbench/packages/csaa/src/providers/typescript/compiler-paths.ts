import { lstatSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { TYPESCRIPT_PROVIDER_VERSION, type SourceOrigin } from '../../contracts/semantic.js';
import type { CapturedArtifactRecord, FrozenSubject } from '../../contracts/subject.js';

function slash(path: string): string {
	return path.replaceAll('\\', '/');
}

function inside(root: string, candidate: string): boolean {
	const fromRoot = relative(root, candidate);
	return (
		fromRoot === '' ||
		(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
	);
}

function declarationPath(path: string): boolean {
	return /\.d\.[cm]?ts$/iu.test(path);
}

function selectedOrigin(artifact: CapturedArtifactRecord): SourceOrigin {
	switch (artifact.primaryClass) {
		case 'TEST_SOURCE':
			return 'TEST';
		case 'VERIFICATION':
			return 'VERIFICATION';
		case 'SCRIPT':
			return 'SCRIPT';
		case 'GENERATOR_SOURCE':
			return 'GENERATOR';
		case 'GENERATED_SOURCE':
			return declarationPath(artifact.path) ? 'GENERATED_DECLARATION' : 'GENERATED';
		case 'GENERATED_CONFIGURATION':
		case 'PROJECT_CONFIGURATION':
		case 'TOOL_CONFIGURATION':
		case 'MANIFEST':
		case 'LOCKFILE':
			return 'CONFIGURATION';
		default:
			return 'AUTHORED';
	}
}

export class CompilerPathError extends Error {
	constructor(
		readonly code: 'CONTEXT_FORBIDDEN' | 'PATH_ESCAPE',
		message: string
	) {
		super(message);
		this.name = 'CompilerPathError';
	}
}

function failPath(message: string): never {
	throw new CompilerPathError('PATH_ESCAPE', message);
}

function canonicalLogicalSyntax(value: string, allowRoot = true): string {
	if (
		value.length === 0 ||
		value.includes('\\') ||
		value.startsWith('/') ||
		/^[A-Za-z]:/u.test(value) ||
		(value === '.' && !allowRoot) ||
		(value !== '.' && value.split('/').some((part) => part === '' || part === '.' || part === '..'))
	) {
		failPath('Compiler logical path is not canonical.');
	}
	return value;
}

function existingDirectoryRoot(value: string, field: string): string {
	if (!isAbsolute(value)) failPath(`${field} must be absolute.`);
	try {
		if (!statSync(value).isDirectory()) failPath(`${field} must identify an existing directory.`);
		return realpathSync.native(value);
	} catch (error) {
		if (error instanceof CompilerPathError) throw error;
		failPath(`${field} must identify an existing canonical directory.`);
	}
}

function canonicalizeCandidate(
	authorizationRoot: string,
	lexicalCandidate: string,
	field: string
): string {
	if (!inside(authorizationRoot, lexicalCandidate))
		failPath(`${field} escaped its physical authorization root.`);
	let existingAncestor = lexicalCandidate;
	const tail: string[] = [];
	while (existingAncestor !== authorizationRoot) {
		try {
			lstatSync(existingAncestor);
			break;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTDIR')
				failPath(`${field} could not be inspected for physical confinement.`);
			tail.unshift(basename(existingAncestor));
			existingAncestor = dirname(existingAncestor);
		}
	}
	let canonicalAncestor: string;
	try {
		canonicalAncestor = realpathSync.native(existingAncestor);
	} catch {
		failPath(`${field} is dangling or could not be canonicalized for physical confinement.`);
	}
	const canonicalCandidate = resolve(canonicalAncestor, ...tail);
	if (!inside(authorizationRoot, canonicalCandidate))
		failPath(`${field} escaped its physical authorization root through filesystem indirection.`);
	return canonicalCandidate;
}

function parentDirectories(path: string): string[] {
	const parts = path.split('/');
	const directories = ['.'];
	for (let index = 1; index < parts.length; index += 1)
		directories.push(parts.slice(0, index).join('/'));
	return directories;
}

interface WorkspaceAliasState {
	readonly aliasPath: string;
	readonly name: string;
	readonly path: string;
	readonly present: boolean;
	readonly targetAbsolute: string;
}

export interface AuthorizedCompilerPath {
	readonly absolutePath: string;
	readonly logicalPath: string;
	readonly observedLogicalPath: string;
}

export interface CompilerEnumeratedPathIdentity {
	readonly logicalPath: string;
	readonly observedLogicalPath: string;
}

export interface VirtualCompilerPathChild {
	readonly kind: 'DIRECTORY' | 'FILE';
	readonly logicalPath: string;
}

export class FrozenCompilerPathResolver {
	readonly repositoryRoot: string;
	readonly typescriptLibraryRoot: string;
	readonly typescriptPackageRoot: string;
	private readonly typescriptPackageLocatorRoot: string;
	private readonly artifactsByKey = new Map<string, CapturedArtifactRecord>();
	private readonly buildOutputPrefixes: readonly string[];
	private readonly explicitContextFiles = new Map<
		string,
		{ readonly path: string; readonly sha256: string }
	>();
	private readonly explicitContextDirectoryKeys = new Set<string>();
	private readonly virtualDirectoriesByKey = new Map<string, string>();
	private readonly virtualFilesByKey = new Map<string, string>();
	private readonly virtualChildrenByDirectoryKey = new Map<
		string,
		Map<string, VirtualCompilerPathChild>
	>();
	private readonly workspaceAliases: readonly WorkspaceAliasState[];

	constructor(
		readonly subject: FrozenSubject,
		repositoryRoot: string,
		readonly caseSensitive: boolean
	) {
		if (ts.version !== TYPESCRIPT_PROVIDER_VERSION)
			failPath(
				`TypeScript provider version ${ts.version} does not match the pinned ${TYPESCRIPT_PROVIDER_VERSION} authority.`
			);
		this.repositoryRoot = existingDirectoryRoot(repositoryRoot, 'Compiler repository root');
		this.typescriptPackageLocatorRoot = resolve(dirname(dirname(ts.getDefaultLibFilePath({}))));
		this.typescriptPackageRoot = existingDirectoryRoot(
			this.typescriptPackageLocatorRoot,
			'Pinned TypeScript package root'
		);
		this.typescriptLibraryRoot = existingDirectoryRoot(
			resolve(this.typescriptPackageRoot, 'lib'),
			'Pinned TypeScript library root'
		);
		this.addVirtualDirectory('.');
		for (const artifact of subject.artifacts) {
			canonicalLogicalSyntax(artifact.path, false);
			const key = this.pathKey(artifact.path);
			if (this.artifactsByKey.has(key))
				failPath(`Frozen artifacts collide under the compiler case policy: ${artifact.path}.`);
			this.artifactsByKey.set(key, artifact);
			this.addVirtualFile(artifact.path);
		}
		for (const record of subject.generatedContexts) {
			if (record.selectedInput) continue;
			const path = canonicalLogicalSyntax(record.path, false);
			if (!/^[a-f0-9]{64}$/u.test(record.sha256))
				failPath(`Generated compiler context digest is invalid: ${path}.`);
			const key = this.pathKey(path);
			if (this.artifactsByKey.has(key))
				failPath(`Unselected generated compiler context overlaps a frozen artifact: ${path}.`);
			if (this.explicitContextFiles.has(key))
				failPath(`Generated compiler contexts collide under the compiler case policy: ${path}.`);
			this.explicitContextFiles.set(key, { path, sha256: record.sha256 });
			this.addVirtualFile(path);
			for (const directory of parentDirectories(path))
				this.explicitContextDirectoryKeys.add(this.pathKey(directory));
		}
		const aliasDefinitions = subject.workspaces
			.map((workspace) => {
				const workspacePath = canonicalLogicalSyntax(workspace.path, false);
				const aliasPath = canonicalLogicalSyntax(`node_modules/${workspace.name}`, false);
				return { aliasPath, name: workspace.name, path: workspacePath };
			})
			.sort(
				(left, right) => right.name.length - left.name.length || (left.name < right.name ? -1 : 1)
			);
		const aliasKeys = new Set<string>();
		this.workspaceAliases = aliasDefinitions.map((alias) => {
			const key = this.pathKey(alias.aliasPath);
			if (aliasKeys.has(key))
				failPath(`Workspace aliases collide under the compiler case policy: ${alias.name}.`);
			aliasKeys.add(key);
			return this.captureWorkspaceAliasState(alias);
		});
		for (const alias of this.workspaceAliases)
			if (alias.present) this.addWorkspaceAliasVirtualView(alias);
		const outputRoots = new Set<string>();
		for (const project of subject.projects) {
			for (const key of ['declarationDir', 'outDir'] as const) {
				const value = project.programRecipe.compilerOptions[key];
				if (typeof value === 'string' && value !== '.')
					outputRoots.add(canonicalLogicalSyntax(value, false));
			}
		}
		for (const workspace of subject.workspaces) {
			for (const record of workspace.exports) {
				if (
					record.target === null ||
					record.target.length === 0 ||
					record.target.includes('\\') ||
					record.target.startsWith('/') ||
					/^[A-Za-z]:/u.test(record.target)
				)
					continue;
				if (!record.conditions.includes('types') && !declarationPath(record.target)) continue;
				const target = posix.normalize(posix.join(workspace.path, record.target));
				if (target === '.' || target === '..' || target.startsWith('../')) continue;
				const directory = posix.dirname(target);
				if (directory !== '.') outputRoots.add(canonicalLogicalSyntax(directory, false));
			}
		}
		this.buildOutputPrefixes = [...outputRoots].sort();
	}

	private pathKey(path: string): string {
		return this.caseSensitive ? path : path.toLowerCase();
	}

	private addVirtualChild(parent: string, child: VirtualCompilerPathChild): void {
		const parentKey = this.pathKey(parent);
		const children =
			this.virtualChildrenByDirectoryKey.get(parentKey) ??
			new Map<string, VirtualCompilerPathChild>();
		children.set(this.pathKey(child.logicalPath), Object.freeze(child));
		this.virtualChildrenByDirectoryKey.set(parentKey, children);
	}

	private addVirtualDirectory(path: string): void {
		for (const directory of path === '.' ? ['.'] : parentDirectories(`${path}/_`)) {
			const normalized = directory.endsWith('/_') ? directory.slice(0, -2) : directory;
			if (normalized.length === 0) continue;
			const key = this.pathKey(normalized);
			if (!this.virtualDirectoriesByKey.has(key)) {
				this.virtualDirectoriesByKey.set(key, normalized);
				if (normalized !== '.')
					this.addVirtualChild(posix.dirname(normalized), {
						kind: 'DIRECTORY',
						logicalPath: normalized
					});
			}
		}
	}

	private addVirtualFile(path: string): void {
		this.addVirtualDirectory(posix.dirname(path));
		this.virtualFilesByKey.set(this.pathKey(path), path);
		this.addVirtualChild(posix.dirname(path), { kind: 'FILE', logicalPath: path });
	}

	private addWorkspaceAliasVirtualView(alias: WorkspaceAliasState): void {
		this.addVirtualDirectory(alias.aliasPath);
		const prefix = `${alias.path}/`;
		for (const path of [...this.virtualFilesByKey.values()]) {
			if (!path.startsWith(prefix)) continue;
			this.addVirtualFile(`${alias.aliasPath}/${path.slice(prefix.length)}`);
		}
		for (const directory of [...this.virtualDirectoriesByKey.values()]) {
			if (directory !== alias.path && !directory.startsWith(prefix)) continue;
			const tail = directory === alias.path ? '' : `/${directory.slice(prefix.length)}`;
			this.addVirtualDirectory(`${alias.aliasPath}${tail}`);
		}
	}

	private inspectWorkspaceAlias(alias: {
		readonly aliasPath: string;
		readonly name: string;
		readonly path: string;
	}): { readonly present: boolean; readonly targetAbsolute: string } {
		const targetAbsolute = canonicalizeCandidate(
			this.repositoryRoot,
			resolve(this.repositoryRoot, ...alias.path.split('/')),
			`Workspace ${alias.name}`
		);
		const absoluteAlias = resolve(this.repositoryRoot, ...alias.aliasPath.split('/'));
		try {
			lstatSync(absoluteAlias);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code === 'ENOENT' || code === 'ENOTDIR') return { present: false, targetAbsolute };
			failPath(`Workspace alias ${alias.name} could not be inspected.`);
		}
		let actual: string;
		try {
			actual = realpathSync.native(absoluteAlias);
		} catch {
			failPath(`Workspace alias ${alias.name} is dangling or could not be canonicalized.`);
		}
		if (
			!inside(this.repositoryRoot, actual) ||
			this.pathKey(actual) !== this.pathKey(targetAbsolute)
		)
			failPath(`Workspace alias ${alias.name} does not resolve to its frozen workspace target.`);
		return { present: true, targetAbsolute };
	}

	private captureWorkspaceAliasState(alias: {
		readonly aliasPath: string;
		readonly name: string;
		readonly path: string;
	}): WorkspaceAliasState {
		return Object.freeze({ ...alias, ...this.inspectWorkspaceAlias(alias) });
	}

	private workspaceAlias(
		repositoryPath: string
	): (WorkspaceAliasState & { readonly tail: string }) | undefined {
		if (!repositoryPath.startsWith('node_modules/')) return undefined;
		const tail = repositoryPath.slice('node_modules/'.length);
		for (const workspace of this.workspaceAliases) {
			const matches = this.caseSensitive
				? tail === workspace.name || tail.startsWith(`${workspace.name}/`)
				: tail.toLowerCase() === workspace.name.toLowerCase() ||
					tail.toLowerCase().startsWith(`${workspace.name.toLowerCase()}/`);
			if (matches) return { ...workspace, tail: tail.slice(workspace.name.length) };
		}
		return undefined;
	}

	private canonicalWorkspaceAlias(repositoryPath: string): string {
		const alias = this.workspaceAlias(repositoryPath);
		return alias === undefined ? repositoryPath : `${alias.aliasPath}${alias.tail}`;
	}

	private workspaceTarget(repositoryPath: string): string | undefined {
		const alias = this.workspaceAlias(repositoryPath);
		return alias === undefined ? undefined : `${alias.path}${alias.tail}`;
	}

	private canonicalCase(path: string): string {
		const artifact = this.artifactsByKey.get(this.pathKey(path));
		if (artifact !== undefined) return artifact.path;
		const context = this.explicitContextFiles.get(this.pathKey(path));
		if (context !== undefined) return context.path;
		const file = this.virtualFilesByKey.get(this.pathKey(path));
		if (file !== undefined) return file;
		const directory = this.virtualDirectoriesByKey.get(this.pathKey(path));
		if (directory !== undefined) return directory;
		return this.caseSensitive ? path : path.toLowerCase();
	}

	private toolchainLogical(relativePath: string): string {
		if (relativePath === '') return '@toolchain/typescript';
		canonicalLogicalSyntax(relativePath, false);
		return `@toolchain/typescript/${relativePath}`;
	}

	private boundaryLogical(absolutePath: string): string | undefined {
		let ancestor = dirname(this.repositoryRoot);
		let level = 1;
		while (true) {
			if (inside(ancestor, absolutePath)) {
				const tail = slash(relative(ancestor, absolutePath));
				if (tail === 'node_modules' || tail.startsWith('node_modules/'))
					return this.canonicalCase(`@boundary/ancestor-${level}/${tail}`);
			}
			const parent = dirname(ancestor);
			if (parent === ancestor) break;
			ancestor = parent;
			level += 1;
		}
		return undefined;
	}

	isBoundaryPath(logicalPath: string): boolean {
		return /^@boundary\/ancestor-[1-9][0-9]*\/node_modules(?:\/|$)/u.test(logicalPath);
	}

	workspaceAliasRoots(): readonly string[] {
		return Object.freeze(this.workspaceAliases.map((alias) => alias.aliasPath).sort());
	}

	workspaceAliasResolvedTarget(logicalPath: string): string | undefined {
		const alias = this.workspaceAlias(logicalPath);
		if (alias === undefined || alias.tail !== '' || !alias.present) return undefined;
		return alias.path;
	}

	assertWorkspaceAliasTopologyUnchanged(): boolean {
		for (const expected of this.workspaceAliases) {
			const actual = this.inspectWorkspaceAlias(expected);
			if (
				actual.present !== expected.present ||
				this.pathKey(actual.targetAbsolute) !== this.pathKey(expected.targetAbsolute)
			)
				return false;
		}
		return true;
	}

	toLogical(path: string): string {
		const lexical = isAbsolute(path) ? resolve(path) : resolve(this.repositoryRoot, path);
		if (inside(this.typescriptPackageLocatorRoot, lexical)) {
			const relativePath = slash(relative(this.typescriptPackageLocatorRoot, lexical));
			const physical = canonicalizeCandidate(
				this.typescriptPackageRoot,
				resolve(this.typescriptPackageRoot, ...relativePath.split('/')),
				'TypeScript package query'
			);
			return this.toolchainLogical(slash(relative(this.typescriptPackageRoot, physical)));
		}
		if (inside(this.typescriptPackageRoot, lexical)) {
			const physical = canonicalizeCandidate(
				this.typescriptPackageRoot,
				lexical,
				'TypeScript package query'
			);
			return this.toolchainLogical(slash(relative(this.typescriptPackageRoot, physical)));
		}
		if (inside(this.repositoryRoot, lexical)) {
			const repositoryPath = slash(relative(this.repositoryRoot, lexical));
			if (repositoryPath === '') return '.';
			canonicalizeCandidate(this.repositoryRoot, lexical, 'Repository compiler query');
			return this.canonicalCase(this.canonicalWorkspaceAlias(repositoryPath));
		}
		const boundary = this.boundaryLogical(lexical);
		if (boundary !== undefined) return boundary;
		failPath(
			'Compiler filesystem query escaped the repository and pinned TypeScript package roots.'
		);
	}

	toAbsolute(logicalPath: string): string {
		if (logicalPath === '@toolchain/typescript') return this.typescriptPackageRoot;
		const toolchainPrefix = '@toolchain/typescript/';
		if (logicalPath.startsWith(toolchainPrefix)) {
			const suffix = canonicalLogicalSyntax(logicalPath.slice(toolchainPrefix.length), false);
			return canonicalizeCandidate(
				this.typescriptPackageRoot,
				resolve(this.typescriptPackageRoot, ...suffix.split('/')),
				'Recorded TypeScript package path'
			);
		}
		const canonical = canonicalLogicalSyntax(logicalPath);
		if (canonical === '.') return this.repositoryRoot;
		const alias = this.workspaceAlias(canonical);
		const lexical = alias?.present
			? resolve(alias.targetAbsolute, ...alias.tail.replace(/^\//u, '').split('/').filter(Boolean))
			: resolve(this.repositoryRoot, ...canonical.split('/'));
		return canonicalizeCandidate(this.repositoryRoot, lexical, 'Recorded repository compiler path');
	}

	canonicalLogical(logicalPath: string): string {
		if (this.isBoundaryPath(logicalPath)) return this.canonicalCase(logicalPath);
		if (logicalPath === '@toolchain/typescript' || logicalPath.startsWith('@toolchain/typescript/'))
			return this.toLogical(this.toAbsolute(logicalPath));
		const canonical = canonicalLogicalSyntax(logicalPath);
		if (canonical === '.') return '.';
		return this.canonicalCase(this.canonicalWorkspaceAlias(canonical));
	}

	toRecordedLogical(path: string): string {
		const lexical = isAbsolute(path) ? resolve(path) : resolve(this.repositoryRoot, path);
		if (inside(this.typescriptPackageLocatorRoot, lexical))
			return this.toolchainLogical(slash(relative(this.typescriptPackageLocatorRoot, lexical)));
		if (inside(this.typescriptPackageRoot, lexical))
			return this.toolchainLogical(slash(relative(this.typescriptPackageRoot, lexical)));
		if (!inside(this.repositoryRoot, lexical)) {
			const boundary = this.boundaryLogical(lexical);
			if (boundary !== undefined) return boundary;
			failPath(
				'Recorded compiler path escaped the repository and pinned TypeScript package roots.'
			);
		}
		const repositoryPath = slash(relative(this.repositoryRoot, lexical));
		return repositoryPath === ''
			? '.'
			: this.canonicalCase(this.canonicalWorkspaceAlias(repositoryPath));
	}

	toRecordedAbsolute(logicalPath: string): string {
		if (logicalPath === '@toolchain/typescript') return this.typescriptPackageRoot;
		const toolchainPrefix = '@toolchain/typescript/';
		if (logicalPath.startsWith(toolchainPrefix)) {
			const suffix = canonicalLogicalSyntax(logicalPath.slice(toolchainPrefix.length), false);
			const lexical = resolve(this.typescriptPackageRoot, ...suffix.split('/'));
			if (!inside(this.typescriptPackageRoot, lexical))
				failPath('Recorded TypeScript path escaped its pinned package root.');
			return lexical;
		}
		const canonical = canonicalLogicalSyntax(logicalPath);
		if (canonical === '.') return this.repositoryRoot;
		const alias = this.workspaceAlias(canonical);
		const lexical = alias?.present
			? resolve(alias.targetAbsolute, ...alias.tail.replace(/^\//u, '').split('/').filter(Boolean))
			: resolve(this.repositoryRoot, ...canonical.split('/'));
		if (!inside(this.repositoryRoot, lexical))
			failPath('Recorded repository path escaped its root.');
		return lexical;
	}

	canonicalRecordedLogical(logicalPath: string): string {
		if (this.isBoundaryPath(logicalPath)) return this.canonicalCase(logicalPath);
		if (logicalPath === '@toolchain/typescript' || logicalPath.startsWith('@toolchain/typescript/'))
			return this.toRecordedLogical(this.toRecordedAbsolute(logicalPath));
		const canonical = canonicalLogicalSyntax(logicalPath);
		return canonical === '.' ? '.' : this.canonicalCase(this.canonicalWorkspaceAlias(canonical));
	}

	authorizeEnumeratedChild(parentLogicalPath: string, entryName: string): AuthorizedCompilerPath {
		const identity = this.enumeratedChildIdentity(parentLogicalPath, entryName);
		const parentAbsolute = this.toAbsolute(parentLogicalPath);
		const authorizationRoot =
			parentLogicalPath === '@toolchain/typescript' ||
			parentLogicalPath.startsWith('@toolchain/typescript/')
				? this.typescriptPackageRoot
				: this.repositoryRoot;
		const lexicalChild = resolve(parentAbsolute, entryName);
		const absolutePath = canonicalizeCandidate(
			authorizationRoot,
			lexicalChild,
			'Enumerated compiler child'
		);
		return Object.freeze({ absolutePath, ...identity });
	}

	enumeratedChildIdentity(
		parentLogicalPath: string,
		entryName: string
	): CompilerEnumeratedPathIdentity {
		if (
			entryName.length === 0 ||
			entryName === '.' ||
			entryName === '..' ||
			entryName.includes('/') ||
			entryName.includes('\\')
		)
			failPath('Compiler directory enumeration produced a non-canonical child name.');
		const joinedLogicalPath = canonicalLogicalSyntax(
			parentLogicalPath === '.' ? entryName : `${parentLogicalPath}/${entryName}`,
			false
		);
		const observedLogicalPath = this.canonicalWorkspaceAlias(joinedLogicalPath);
		const logicalPath = this.canonicalCase(observedLogicalPath);
		return Object.freeze({ logicalPath, observedLogicalPath });
	}

	artifact(logicalPath: string): CapturedArtifactRecord | undefined {
		return this.artifactsByKey.get(this.pathKey(logicalPath));
	}

	frozenArtifact(logicalPath: string): CapturedArtifactRecord | undefined {
		const direct = this.artifact(logicalPath);
		if (direct !== undefined) return direct;
		const alias = this.workspaceAlias(logicalPath);
		if (alias === undefined || !alias.present) return undefined;
		const target = this.workspaceTarget(logicalPath);
		return target === undefined ? undefined : this.artifactsByKey.get(this.pathKey(target));
	}

	resolvedFrozenLogical(logicalPath: string): string | undefined {
		const aliasTarget = this.workspaceAliasResolvedTarget(logicalPath);
		if (aliasTarget !== undefined) return this.canonicalCase(aliasTarget);
		if (
			this.virtualFilesByKey.has(this.pathKey(logicalPath)) ||
			this.virtualDirectoriesByKey.has(this.pathKey(logicalPath))
		) {
			const alias = this.workspaceAlias(logicalPath);
			const target = alias?.present ? this.workspaceTarget(logicalPath) : undefined;
			return target === undefined ? this.canonicalCase(logicalPath) : this.canonicalCase(target);
		}
		return undefined;
	}

	private pathWithinWorkspace(logicalPath: string): boolean {
		const key = this.pathKey(logicalPath);
		return this.subject.workspaces.some((workspace) => {
			const workspaceKey = this.pathKey(workspace.path);
			return key === workspaceKey || key.startsWith(`${workspaceKey}/`);
		});
	}

	private originForPath(logicalPath: string): SourceOrigin {
		const artifact = this.artifact(logicalPath);
		if (artifact !== undefined) return selectedOrigin(artifact);
		if (logicalPath === '@toolchain/typescript' || logicalPath.startsWith('@toolchain/typescript/'))
			return 'TOOLCHAIN_LIBRARY';
		if (this.isExplicitContextFile(logicalPath))
			return declarationPath(logicalPath) ? 'GENERATED_DECLARATION' : 'GENERATED';
		if (this.isWorkspaceBuildOutput(logicalPath) && declarationPath(logicalPath))
			return this.pathWithinWorkspace(logicalPath)
				? 'WORKSPACE_BUILD_DECLARATION'
				: 'GENERATED_DECLARATION';
		if (logicalPath.startsWith('node_modules/') && declarationPath(logicalPath))
			return 'EXTERNAL_DECLARATION';
		if (
			logicalPath.endsWith('/package.json') ||
			logicalPath === 'package.json' ||
			logicalPath.endsWith('.json')
		)
			return 'CONFIGURATION';
		return 'UNKNOWN';
	}

	origin(logicalPath: string): SourceOrigin {
		const alias = this.workspaceAlias(logicalPath);
		return alias?.present
			? this.originForPath(this.workspaceTarget(logicalPath)!)
			: this.originForPath(logicalPath);
	}

	recordedOrigin(logicalPath: string): SourceOrigin {
		return this.origin(logicalPath);
	}

	isWorkspaceBuildOutput(logicalPath: string): boolean {
		const target = this.workspaceAlias(logicalPath)?.present
			? (this.workspaceTarget(logicalPath) ?? logicalPath)
			: logicalPath;
		const key = this.pathKey(target);
		return this.buildOutputPrefixes.some(
			(prefix) => key === this.pathKey(prefix) || key.startsWith(`${this.pathKey(prefix)}/`)
		);
	}

	isExplicitContextFile(logicalPath: string): boolean {
		const target = this.workspaceAlias(logicalPath)?.present
			? (this.workspaceTarget(logicalPath) ?? logicalPath)
			: logicalPath;
		return this.explicitContextFiles.has(this.pathKey(target));
	}

	explicitContextDigest(logicalPath: string): string | undefined {
		const target = this.workspaceAlias(logicalPath)?.present
			? (this.workspaceTarget(logicalPath) ?? logicalPath)
			: logicalPath;
		return this.explicitContextFiles.get(this.pathKey(target))?.sha256;
	}

	isLiveDirectoryPermitted(logicalPath: string): boolean {
		if (logicalPath === '@toolchain/typescript' || logicalPath.startsWith('@toolchain/typescript/'))
			return true;
		if (logicalPath === 'node_modules' || logicalPath.startsWith('node_modules/')) return true;
		if (this.isWorkspaceBuildOutput(logicalPath) || this.isExplicitContextFile(logicalPath))
			return true;
		return this.explicitContextDirectoryKeys.has(this.pathKey(logicalPath));
	}

	isLiveScanPermitted(logicalPath: string): boolean {
		return (
			logicalPath === '@toolchain/typescript' ||
			logicalPath.startsWith('@toolchain/typescript/') ||
			logicalPath === 'node_modules' ||
			logicalPath.startsWith('node_modules/') ||
			this.isWorkspaceBuildOutput(logicalPath)
		);
	}

	isLiveFilePermitted(logicalPath: string): boolean {
		if (
			logicalPath.startsWith('@toolchain/typescript/') &&
			(declarationPath(logicalPath) || logicalPath.endsWith('/package.json'))
		)
			return true;
		if (
			logicalPath.startsWith('node_modules/') &&
			(declarationPath(logicalPath) || logicalPath.endsWith('/package.json'))
		)
			return true;
		if (
			this.isWorkspaceBuildOutput(logicalPath) &&
			(declarationPath(logicalPath) || logicalPath.endsWith('/package.json'))
		)
			return true;
		return this.isExplicitContextFile(logicalPath);
	}

	isLiveRealpathPermitted(logicalPath: string): boolean {
		if (this.isLiveFilePermitted(logicalPath)) return true;
		return (
			logicalPath === 'node_modules' ||
			logicalPath === '@toolchain/typescript' ||
			this.isVirtualDirectory(logicalPath)
		);
	}

	isVirtualDirectory(logicalPath: string): boolean {
		return this.virtualDirectoriesByKey.has(this.pathKey(logicalPath));
	}

	virtualViewPath(logicalPath: string): string | undefined {
		return this.virtualDirectoriesByKey.get(this.pathKey(logicalPath));
	}

	virtualChildren(logicalPath: string): readonly VirtualCompilerPathChild[] {
		const viewPath = this.virtualViewPath(logicalPath);
		if (viewPath === undefined) return Object.freeze([]);
		const children = this.virtualChildrenByDirectoryKey.get(this.pathKey(viewPath));
		if (children === undefined) return Object.freeze([]);
		return Object.freeze(
			[...children.values()]
				.sort((left, right) =>
					left.logicalPath < right.logicalPath ? -1 : left.logicalPath > right.logicalPath ? 1 : 0
				)
				.map((child) => Object.freeze({ ...child }))
		);
	}

	*virtualDirectoryCandidates(logicalPath: string): Iterable<string> {
		const viewPath = this.virtualViewPath(logicalPath);
		if (viewPath === undefined) return;
		const prefix = viewPath === '.' ? '' : `${viewPath}/`;
		for (const directory of this.virtualDirectoriesByKey.values()) {
			if (directory === viewPath || !directory.startsWith(prefix)) continue;
			yield directory;
		}
	}

	*virtualFileCandidates(logicalPath: string): Iterable<string> {
		const viewPath = this.virtualViewPath(logicalPath);
		if (viewPath === undefined) return;
		const prefix = viewPath === '.' ? '' : `${viewPath}/`;
		for (const file of this.virtualFilesByKey.values()) if (file.startsWith(prefix)) yield file;
	}

	assertLiveFilePermitted(logicalPath: string): void {
		if (this.isLiveFilePermitted(logicalPath)) return;
		throw new CompilerPathError(
			'CONTEXT_FORBIDDEN',
			`Present unselected compiler file is outside the bounded declaration/configuration context: ${logicalPath}.`
		);
	}
}
