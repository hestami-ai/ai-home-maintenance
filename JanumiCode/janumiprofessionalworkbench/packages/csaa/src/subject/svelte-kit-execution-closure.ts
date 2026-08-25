import { spawnSync } from 'node:child_process';
import {
	closeSync,
	existsSync,
	fstatSync,
	lstatSync,
	openSync,
	readFileSync,
	readdirSync,
	realpathSync
} from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import {
	GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION,
	GENERATED_CONTEXT_GENERATOR_IDENTITY_METHOD,
	type GeneratedContextExecutionConfigurationRecord,
	type GeneratedContextExecutionManifest,
	type GeneratedContextExecutionPackageRecord,
	type GeneratedContextExecutionRuntimeRecord
} from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';

export const SVELTE_KIT_SYNC_ENVIRONMENT_POLICY =
	'closed-svelte-kit-sync-environment/1.0.0' as const;
export const SVELTE_KIT_SYNC_INVOCATION = [
	'svelte-kit.js',
	'sync',
	'--mode',
	'production'
] as const;

const CONFIGURATION_PATHS = [
	'apps/rph-demo/svelte.config.js',
	'apps/rph-demo/vite.config.ts'
] as const;
const REQUIRED_ABSENT_PATHS = [
	'apps/rph-demo/.env',
	'apps/rph-demo/.env.local',
	'apps/rph-demo/.env.production',
	'apps/rph-demo/.env.production.local',
	'apps/rph-demo/svelte.config.ts',
	'apps/rph-demo/vite.config.cjs',
	'apps/rph-demo/vite.config.cts',
	'apps/rph-demo/vite.config.js',
	'apps/rph-demo/vite.config.mjs',
	'apps/rph-demo/vite.config.mts'
] as const;
const GENERATED_OUTPUT_ROOT = 'apps/rph-demo/.svelte-kit' as const;
const PROFILE_PACKAGE_SEEDS = ['@sveltejs/kit', 'typescript', 'vite'] as const;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_LOCK_BYTES = 16 * 1024 * 1024;
const MAX_RUNTIME_BYTES = 256 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const MAX_PACKAGE_FILES = 50_000;
const MAX_PACKAGE_DIRECTORIES = 20_000;
const MAX_PACKAGES = 500;
const MAX_DEPTH = 64;
const MAX_DURATION_MS = 60_000;
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,127}$/u;

interface PackageManifest {
	readonly dependencies: readonly string[];
	readonly name: string;
	readonly optionalDependencies: readonly string[];
	readonly version: string;
}

interface LockPackageEntry {
	readonly integrity: string | null;
	readonly key: string;
	readonly packageIdentity: string;
}

interface ClosureBudget {
	bytes: number;
	directories: number;
	files: number;
	readonly deadline: number;
}

interface PackageTreeIdentity {
	readonly bytes: number;
	readonly fileCount: number;
	readonly sha256: string;
}

interface PackageQueueEntry {
	readonly issuer: string;
	readonly issuerDirectory: string;
	readonly name: string;
	readonly optional: boolean;
}

export interface SvelteKitExecutionObservation {
	readonly implementationDigest: string;
	readonly manifest: GeneratedContextExecutionManifest;
	readonly nodeExecutable: string;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function directoryEntryExists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

function inside(root: string, path: string): boolean {
	const rel = relative(root, path);
	return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function logicalPath(root: string, path: string): string {
	const rel = relative(root, path).replaceAll('\\', '/');
	if (rel === '' || rel === '..' || rel.startsWith('../') || rel.startsWith('/'))
		throw new Error('Generated-context execution path escapes the repository.');
	return rel;
}

function stableRead(path: string, maxBytes: number, label: string): Buffer {
	const pathBefore = lstatSync(path, { bigint: true });
	if (!pathBefore.isFile() || pathBefore.isSymbolicLink())
		throw new Error(`${label} is not a regular file.`);
	if (pathBefore.size > BigInt(maxBytes)) throw new Error(`${label} exceeds its byte limit.`);
	const descriptor = openSync(path, 'r');
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (!before.isFile() || before.size > BigInt(maxBytes))
			throw new Error(`${label} exceeds its byte limit or changed type.`);
		const bytes = readFileSync(descriptor);
		const after = fstatSync(descriptor, { bigint: true });
		const pathAfter = lstatSync(path, { bigint: true });
		if (
			bytes.byteLength > maxBytes ||
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.mtimeNs !== after.mtimeNs ||
			pathBefore.dev !== pathAfter.dev ||
			pathBefore.ino !== pathAfter.ino ||
			pathBefore.size !== pathAfter.size ||
			pathBefore.mtimeNs !== pathAfter.mtimeNs ||
			pathAfter.dev !== after.dev ||
			pathAfter.ino !== after.ino
		)
			throw new Error(`${label} changed during its bounded read.`);
		return bytes;
	} finally {
		closeSync(descriptor);
	}
}

function environmentEntries(platform: NodeJS.Platform): readonly {
	readonly name: string;
	readonly value: string;
}[] {
	const environment = new Map<string, string>([
		['CI', '1'],
		['FORCE_COLOR', '0'],
		['MODE', 'production'],
		['NODE_ENV', 'production'],
		['NODE_NO_WARNINGS', '1'],
		['NO_COLOR', '1'],
		['TZ', 'UTC']
	]);
	if (platform === 'win32') {
		for (const name of ['SystemRoot', 'WINDIR'] as const) {
			const value = process.env[name];
			if (value === undefined || !isAbsolute(value))
				throw new Error(`Required Windows runtime environment ${name} is unavailable.`);
			environment.set(name, resolve(value));
		}
	}
	return [...environment]
		.map(([name, value]) => ({ name, value }))
		.sort((left, right) => compareText(left.name, right.name));
}

export function svelteKitSyncEnvironment(
	platform: NodeJS.Platform
): Readonly<Record<string, string>> {
	return Object.freeze(
		Object.fromEntries(environmentEntries(platform).map(({ name, value }) => [name, value]))
	);
}

function nodeCandidates(repositoryRoot: string): readonly string[] {
	const candidates: string[] = [];
	if (/^node(?:\.exe)?$/iu.test(process.execPath.split(/[\\/]/u).at(-1) ?? ''))
		candidates.push(process.execPath);
	if (process.platform === 'win32') {
		for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']])
			if (base !== undefined) candidates.push(resolve(base, 'nodejs/node.exe'));
	} else candidates.push('/usr/local/bin/node', '/usr/bin/node');
	for (const entry of (process.env.PATH ?? '').split(delimiter)) {
		if (entry.length === 0 || !isAbsolute(entry)) continue;
		candidates.push(resolve(entry, process.platform === 'win32' ? 'node.exe' : 'node'));
	}
	const root = realpathSync(repositoryRoot);
	return [...new Set(candidates)]
		.filter(existsSync)
		.map((candidate) => realpathSync(candidate))
		.filter((candidate) => !inside(root, candidate));
}

function observeNodeRuntime(repositoryRoot: string): {
	readonly executable: string;
	readonly record: GeneratedContextExecutionRuntimeRecord;
} {
	const problems: string[] = [];
	for (const executable of nodeCandidates(repositoryRoot)) {
		let before: Buffer;
		try {
			before = stableRead(executable, MAX_RUNTIME_BYTES, 'Node runtime executable');
		} catch (error) {
			problems.push(`${executable}: ${String(error)}`);
			continue;
		}
		const result = spawnSync(
			executable,
			[
				'--input-type=commonjs',
				'-e',
				'process.stdout.write(JSON.stringify({architecture:process.arch,engine:process.release.name,platform:process.platform,version:process.version,versions:process.versions}))'
			],
			{
				cwd: repositoryRoot,
				encoding: 'utf8',
				env: svelteKitSyncEnvironment(process.platform),
				maxBuffer: 1024 * 1024,
				shell: false,
				timeout: 30_000,
				windowsHide: true
			}
		);
		if (result.error !== undefined || result.status !== 0) {
			problems.push(
				`${executable}: handshake ${String(result.status)} ${result.error?.message ?? result.stderr.slice(0, 512)}`
			);
			continue;
		}
		let value: unknown;
		try {
			value = JSON.parse(result.stdout);
		} catch (error) {
			problems.push(`${executable}: invalid handshake JSON ${String(error)}`);
			continue;
		}
		if (
			!plainRecord(value) ||
			value.engine !== 'node' ||
			typeof value.version !== 'string' ||
			!/^v\d+\.\d+\.\d+/u.test(value.version) ||
			typeof value.platform !== 'string' ||
			typeof value.architecture !== 'string' ||
			!plainRecord(value.versions)
		) {
			problems.push(`${executable}: handshake did not identify Node.`);
			continue;
		}
		const after = stableRead(executable, MAX_RUNTIME_BYTES, 'Node runtime executable');
		if (!before.equals(after))
			throw new Error('Node runtime executable changed during identity observation.');
		return {
			executable,
			record: {
				architecture: value.architecture,
				engine: 'node',
				executableBytes: before.byteLength,
				executableSha256: sha256(before),
				platform: value.platform,
				version: value.version,
				versionsDigest: sha256(canonicalJson(value.versions))
			}
		};
	}
	throw new Error(
		`A bounded external Node runtime could not be resolved and verified: ${problems.join('; ')}`
	);
}

function packageName(specifier: string): string {
	if (
		specifier.length === 0 ||
		specifier.startsWith('.') ||
		specifier.startsWith('/') ||
		/^[A-Za-z]:[\\/]/u.test(specifier)
	)
		throw new Error('Generated-context configuration contains an unsupported module specifier.');
	if (specifier.startsWith('node:')) {
		if (specifier !== 'node:module')
			throw new Error(
				`Generated-context configuration imports forbidden runtime module ${specifier}.`
			);
		return specifier;
	}
	const segments = specifier.split('/');
	const name = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!;
	if (name.length > 214 || !PACKAGE_NAME_PATTERN.test(name) || name.split('/').includes('..'))
		throw new Error('Generated-context configuration contains an invalid package name.');
	return name;
}

function assertAdmittedConfigurationSyntax(
	sourceFile: ts.SourceFile,
	path: string,
	createRequireFactories: ReadonlySet<string>,
	requireAliases: ReadonlySet<string>,
	admittedCreateRequireCalls: ReadonlySet<ts.CallExpression>
): void {
	const importedBindings = new Set<string>();
	const localBindings = new Set<string>();
	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			const clause = statement.importClause;
			if (clause?.name !== undefined) importedBindings.add(clause.name.text);
			if (clause?.namedBindings !== undefined) {
				if (!ts.isNamedImports(clause.namedBindings))
					throw new Error(
						`Generated-context configuration ${path} uses a namespace import outside the admitted syntax profile.`
					);
				for (const element of clause.namedBindings.elements)
					importedBindings.add(element.name.text);
			}
		}
		if (ts.isVariableStatement(statement))
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name))
					throw new Error(
						`Generated-context configuration ${path} uses a binding pattern outside the admitted syntax profile.`
					);
				localBindings.add(declaration.name.text);
			}
	}
	const admittedIdentifier = (node: ts.Identifier): boolean =>
		importedBindings.has(node.text) || localBindings.has(node.text);
	const validateExpression = (node: ts.Expression): void => {
		if (
			ts.isStringLiteralLike(node) ||
			ts.isNumericLiteral(node) ||
			node.kind === ts.SyntaxKind.RegularExpressionLiteral ||
			node.kind === ts.SyntaxKind.TrueKeyword ||
			node.kind === ts.SyntaxKind.FalseKeyword ||
			node.kind === ts.SyntaxKind.NullKeyword
		)
			return;
		if (ts.isIdentifier(node)) {
			if (admittedIdentifier(node)) return;
			throw new Error(
				`Generated-context configuration ${path} uses ambient identifier ${node.text} outside the admitted syntax profile.`
			);
		}
		if (
			ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isSatisfiesExpression(node) ||
			ts.isNonNullExpression(node)
		) {
			validateExpression(node.expression);
			return;
		}
		if (ts.isArrayLiteralExpression(node)) {
			for (const element of node.elements) {
				if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
					throw new Error(
						`Generated-context configuration ${path} uses an array form outside the admitted syntax profile.`
					);
				validateExpression(element);
			}
			return;
		}
		if (ts.isObjectLiteralExpression(node)) {
			for (const property of node.properties) {
				if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name))
					validateExpression(property.initializer);
				else if (ts.isShorthandPropertyAssignment(property) && admittedIdentifier(property.name))
					continue;
				else
					throw new Error(
						`Generated-context configuration ${path} uses an object member outside the admitted syntax profile.`
					);
			}
			return;
		}
		if (ts.isCallExpression(node)) {
			if (admittedCreateRequireCalls.has(node)) return;
			const directBoundCall =
				ts.isIdentifier(node.expression) &&
				(importedBindings.has(node.expression.text) || requireAliases.has(node.expression.text));
			const requireResolveCall =
				ts.isPropertyAccessExpression(node.expression) &&
				ts.isIdentifier(node.expression.expression) &&
				requireAliases.has(node.expression.expression.text) &&
				node.expression.name.text === 'resolve';
			if (!directBoundCall && !requireResolveCall)
				throw new Error(
					`Generated-context configuration ${path} uses a call outside the admitted syntax profile.`
				);
			if (requireAliases.has((node.expression as ts.Identifier).text) || requireResolveCall) {
				if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0]!))
					throw new Error(`Generated-context configuration ${path} has a nonliteral module load.`);
				return;
			}
			for (const argument of node.arguments) {
				if (ts.isSpreadElement(argument))
					throw new Error(
						`Generated-context configuration ${path} uses a spread call outside the admitted syntax profile.`
					);
				validateExpression(argument);
			}
			return;
		}
		throw new Error(
			`Generated-context configuration ${path} uses syntax outside the admitted execution profile.`
		);
	};
	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) continue;
		if (ts.isVariableStatement(statement)) {
			if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0)
				throw new Error(
					`Generated-context configuration ${path} uses a mutable binding outside the admitted syntax profile.`
				);
			for (const declaration of statement.declarationList.declarations) {
				if (declaration.initializer === undefined)
					throw new Error(
						`Generated-context configuration ${path} has an uninitialized binding outside the admitted syntax profile.`
					);
				validateExpression(declaration.initializer);
			}
			continue;
		}
		if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
			validateExpression(statement.expression);
			continue;
		}
		throw new Error(
			`Generated-context configuration ${path} has a statement outside the admitted syntax profile.`
		);
	}
}

function configurationImports(source: string, path: string): readonly string[] {
	const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
	const parseDiagnostics = (
		sourceFile as unknown as { readonly parseDiagnostics?: readonly unknown[] }
	).parseDiagnostics;
	if ((parseDiagnostics?.length ?? 0) > 0)
		throw new Error(`Generated-context configuration ${path} is malformed.`);
	const imports = new Set<string>();
	const createRequireFactories = new Set<string>();
	const requireAliases = new Set<string>();
	const admittedCreateRequireCalls = new Set<ts.CallExpression>();
	for (const statement of sourceFile.statements) {
		if (
			ts.isImportDeclaration(statement) &&
			ts.isStringLiteral(statement.moduleSpecifier) &&
			statement.moduleSpecifier.text === 'node:module'
		) {
			const bindings = statement.importClause?.namedBindings;
			if (
				statement.importClause?.isTypeOnly ||
				statement.importClause?.name !== undefined ||
				bindings === undefined ||
				!ts.isNamedImports(bindings) ||
				bindings.elements.length !== 1 ||
				bindings.elements[0]!.isTypeOnly ||
				(bindings.elements[0]!.propertyName ?? bindings.elements[0]!.name).text !== 'createRequire'
			)
				throw new Error(
					`Generated-context configuration ${path} has an unsupported node:module binding.`
				);
			createRequireFactories.add(bindings.elements[0]!.name.text);
		}
	}
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (
				!ts.isIdentifier(declaration.name) ||
				declaration.initializer === undefined ||
				!ts.isCallExpression(declaration.initializer) ||
				!ts.isIdentifier(declaration.initializer.expression) ||
				!createRequireFactories.has(declaration.initializer.expression.text)
			)
				continue;
			const argument = declaration.initializer.arguments[0];
			const importMetaUrl =
				argument !== undefined &&
				ts.isPropertyAccessExpression(argument) &&
				argument.name.text === 'url' &&
				ts.isMetaProperty(argument.expression) &&
				argument.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
				argument.expression.name.text === 'meta';
			if (
				(statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
				declaration.initializer.arguments.length !== 1 ||
				!importMetaUrl
			)
				throw new Error(
					`Generated-context configuration ${path} has an unsupported createRequire binding.`
				);
			requireAliases.add(declaration.name.text);
			admittedCreateRequireCalls.add(declaration.initializer);
		}
	}
	const visit = (node: ts.Node): void => {
		if (ts.isIdentifier(node) && requireAliases.has(node.text)) {
			const parent = node.parent;
			const admittedDeclaration = ts.isVariableDeclaration(parent) && parent.name === node;
			const admittedDirectCall = ts.isCallExpression(parent) && parent.expression === node;
			const admittedResolveCall =
				ts.isPropertyAccessExpression(parent) &&
				parent.expression === node &&
				parent.name.text === 'resolve' &&
				ts.isCallExpression(parent.parent) &&
				parent.parent.expression === parent;
			if (!admittedDeclaration && !admittedDirectCall && !admittedResolveCall)
				throw new Error(
					`Generated-context configuration ${path} has an indirect createRequire alias flow.`
				);
		}
		if (ts.isIdentifier(node) && createRequireFactories.has(node.text)) {
			const parent = node.parent;
			const admittedImport = ts.isImportSpecifier(parent) && parent.name === node;
			const admittedCall =
				ts.isCallExpression(parent) &&
				parent.expression === node &&
				admittedCreateRequireCalls.has(parent);
			if (!admittedImport && !admittedCall)
				throw new Error(
					`Generated-context configuration ${path} has an indirect createRequire factory flow.`
				);
		}
		if (
			ts.isIdentifier(node) &&
			[
				'Bun',
				'Date',
				'Deno',
				'Function',
				'WebSocket',
				'XMLHttpRequest',
				'eval',
				'fetch',
				'global',
				'globalThis',
				'navigator',
				'performance',
				'process'
			].includes(node.text)
		)
			throw new Error(
				`Generated-context configuration ${path} uses forbidden ambient ${node.text}.`
			);
		if (ts.isElementAccessExpression(node) || ts.isComputedPropertyName(node))
			throw new Error(`Generated-context configuration ${path} uses unsupported computed access.`);
		if (ts.isPropertyAccessExpression(node) && node.name.text === 'constructor')
			throw new Error(`Generated-context configuration ${path} uses forbidden constructor access.`);
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier !== undefined
		) {
			if (!ts.isStringLiteral(node.moduleSpecifier))
				throw new Error(`Generated-context configuration ${path} has a nonliteral import.`);
			imports.add(node.moduleSpecifier.text);
		}
		if (ts.isCallExpression(node)) {
			const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
			const directRequire =
				ts.isIdentifier(node.expression) && requireAliases.has(node.expression.text);
			const requireResolve =
				ts.isPropertyAccessExpression(node.expression) &&
				ts.isIdentifier(node.expression.expression) &&
				requireAliases.has(node.expression.expression.text) &&
				node.expression.name.text === 'resolve';
			if (
				ts.isIdentifier(node.expression) &&
				createRequireFactories.has(node.expression.text) &&
				!admittedCreateRequireCalls.has(node)
			)
				throw new Error(
					`Generated-context configuration ${path} has an unsupported createRequire call.`
				);
			if (
				ts.isIdentifier(node.expression) &&
				node.expression.text === 'require' &&
				!requireAliases.has(node.expression.text)
			)
				throw new Error(`Generated-context configuration ${path} uses an unbound require loader.`);
			if (dynamicImport || directRequire || requireResolve) {
				if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0]!))
					throw new Error(`Generated-context configuration ${path} has a nonliteral module load.`);
				imports.add(node.arguments[0]!.text);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	assertAdmittedConfigurationSyntax(
		sourceFile,
		path,
		createRequireFactories,
		requireAliases,
		admittedCreateRequireCalls
	);
	for (const specifier of imports) {
		if (specifier.startsWith('.') || specifier.startsWith('/'))
			throw new Error(
				`Generated-context configuration ${path} has an unsupported relative import.`
			);
		packageName(specifier);
	}
	return [...imports].sort(compareText);
}

function observeConfigurations(
	repositoryRoot: string
): readonly GeneratedContextExecutionConfigurationRecord[] {
	return CONFIGURATION_PATHS.map((path) => {
		const bytes = stableRead(resolve(repositoryRoot, ...path.split('/')), MAX_CONFIG_BYTES, path);
		const source = bytes.toString('utf8');
		return { imports: configurationImports(source, path), path, sha256: sha256(bytes) };
	});
}

function assertRequiredPathsAbsent(repositoryRoot: string): void {
	for (const path of REQUIRED_ABSENT_PATHS)
		if (directoryEntryExists(resolve(repositoryRoot, ...path.split('/'))))
			throw new Error(`Generated-context synchronization requires path to be absent: ${path}`);
}

function assertNoEnvironmentFiles(repositoryRoot: string): void {
	const deadline = Date.now() + MAX_DURATION_MS;
	let directories = 0;
	const visit = (directory: string, depth: number): void => {
		if (Date.now() > deadline)
			throw new Error('Generated-context environment-file scan exceeded its duration limit.');
		if (depth > MAX_DEPTH)
			throw new Error('Generated-context environment-file scan exceeded its depth limit.');
		directories += 1;
		if (directories > MAX_PACKAGE_DIRECTORIES)
			throw new Error('Generated-context environment-file scan exceeded its directory limit.');
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (
				entry.isDirectory() &&
				[
					'.git',
					'.svelte-kit',
					'.turbo',
					'build',
					'coverage',
					'dist',
					'e2e-results',
					'node_modules'
				].includes(entry.name)
			)
				continue;
			if (/^\.env(?:\..+)?$/u.test(entry.name) && !/\.example$/u.test(entry.name))
				throw new Error('Generated-context synchronization refuses unbound .env input files.');
			if (entry.isDirectory()) visit(join(directory, entry.name), depth + 1);
		}
	};
	visit(repositoryRoot, 0);
}

function parseJsonObject(bytes: Buffer, path: string): Record<string, unknown> {
	const parsed = ts.parseConfigFileTextToJson(path, bytes.toString('utf8'));
	if (parsed.error !== undefined || !plainRecord(parsed.config))
		throw new Error(`${path} is not a valid JSON-with-comments object.`);
	return parsed.config;
}

function lockEntries(lockBytes: Buffer): readonly LockPackageEntry[] {
	const root = parseJsonObject(lockBytes, 'bun.lock');
	if (!plainRecord(root.packages)) throw new Error('bun.lock packages table is unavailable.');
	const entries: LockPackageEntry[] = [];
	for (const [key, value] of Object.entries(root.packages)) {
		if (!Array.isArray(value) || typeof value[0] !== 'string')
			throw new Error('bun.lock contains an invalid package tuple.');
		const candidateIntegrity = value[3];
		const integrity =
			typeof candidateIntegrity === 'string' && INTEGRITY_PATTERN.test(candidateIntegrity)
				? candidateIntegrity
				: null;
		entries.push({ integrity, key, packageIdentity: value[0] });
	}
	return entries.sort((left, right) => compareText(left.key, right.key));
}

function dependencyNames(value: unknown, label: string): readonly string[] {
	if (value === undefined) return [];
	if (!plainRecord(value)) throw new Error(`${label} has an invalid dependency table.`);
	for (const [name, version] of Object.entries(value))
		if (
			name.length === 0 ||
			name.length > 214 ||
			!PACKAGE_NAME_PATTERN.test(name) ||
			name.split('/').includes('..') ||
			typeof version !== 'string'
		)
			throw new Error(`${label} has an invalid dependency declaration.`);
	return Object.keys(value).sort(compareText);
}

function packageManifest(bytes: Buffer, expectedName: string): PackageManifest {
	const value = parseJsonObject(bytes, `${expectedName}/package.json`);
	if (
		value.name !== expectedName ||
		typeof value.version !== 'string' ||
		!VERSION_PATTERN.test(value.version)
	)
		throw new Error(`Installed package ${expectedName} has an invalid identity.`);
	const dependencies = new Set([
		...dependencyNames(value.dependencies, expectedName),
		...dependencyNames(value.peerDependencies, expectedName)
	]);
	const optionalDependencies = new Set(dependencyNames(value.optionalDependencies, expectedName));
	if (value.peerDependenciesMeta !== undefined) {
		if (!plainRecord(value.peerDependenciesMeta))
			throw new Error(`${expectedName} has invalid peer dependency metadata.`);
		for (const [name, metadata] of Object.entries(value.peerDependenciesMeta))
			if (plainRecord(metadata) && metadata.optional === true) dependencies.delete(name);
	}
	for (const name of optionalDependencies) dependencies.delete(name);
	return {
		dependencies: [...dependencies].sort(compareText),
		name: expectedName,
		optionalDependencies: [...optionalDependencies].sort(compareText),
		version: value.version
	};
}

function packageRootFor(
	repositoryRoot: string,
	issuerDirectory: string,
	name: string
): string | null {
	if (name.length > 214 || !PACKAGE_NAME_PATTERN.test(name) || name.split('/').includes('..'))
		throw new Error('Installed dependency closure contains an invalid package name.');
	let directory = resolve(issuerDirectory);
	const root = realpathSync(repositoryRoot);
	while (inside(root, directory)) {
		const candidate = resolve(directory, 'node_modules', ...name.split('/'));
		if (existsSync(candidate)) {
			const status = lstatSync(candidate);
			if (status.isSymbolicLink() || !status.isDirectory())
				throw new Error(`Installed package ${name} is not a regular directory.`);
			const physical = realpathSync(candidate);
			if (!inside(root, physical))
				throw new Error(`Installed package ${name} escapes the repository.`);
			return physical;
		}
		const parent = dirname(directory);
		if (parent === directory) break;
		directory = parent;
	}
	return null;
}

function packageTree(packageRoot: string, budget: ClosureBudget): PackageTreeIdentity {
	const files: Array<{ readonly bytes: number; readonly path: string; readonly sha256: string }> =
		[];
	let packageBytes = 0;
	const visit = (directory: string, depth: number): void => {
		if (Date.now() > budget.deadline)
			throw new Error('Installed dependency closure traversal exceeded its duration limit.');
		if (depth > MAX_DEPTH)
			throw new Error('Installed dependency package tree exceeded its depth limit.');
		budget.directories += 1;
		if (budget.directories > MAX_PACKAGE_DIRECTORIES)
			throw new Error('Installed dependency closure exceeded its directory limit.');
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
			compareText(left.name, right.name)
		)) {
			if (entry.name === 'node_modules' && entry.isDirectory())
				throw new Error(
					'Installed dependency closure contains an unbound nested node_modules directory.'
				);
			const absolute = join(directory, entry.name);
			if (entry.isSymbolicLink())
				throw new Error('Installed dependency closure contains a symbolic link.');
			if (entry.isDirectory()) {
				visit(absolute, depth + 1);
				continue;
			}
			if (!entry.isFile())
				throw new Error('Installed dependency closure contains an unsupported entry.');
			budget.files += 1;
			if (budget.files > MAX_PACKAGE_FILES)
				throw new Error('Installed dependency closure exceeded its file limit.');
			const bytes = stableRead(absolute, MAX_PACKAGE_BYTES, 'Installed dependency file');
			budget.bytes += bytes.byteLength;
			packageBytes += bytes.byteLength;
			if (budget.bytes > MAX_PACKAGE_BYTES)
				throw new Error('Installed dependency closure exceeded its byte limit.');
			files.push({
				bytes: bytes.byteLength,
				path: relative(packageRoot, absolute).replaceAll('\\', '/'),
				sha256: sha256(bytes)
			});
		}
	};
	visit(packageRoot, 0);
	return { bytes: packageBytes, fileCount: files.length, sha256: sha256(canonicalJson(files)) };
}

function expectedLockKey(locator: string): string {
	const segments = locator.split('/');
	const packages: string[] = [];
	for (let index = 0; index < segments.length; index += 1) {
		if (segments[index] !== 'node_modules') continue;
		const first = segments[index + 1];
		if (first === undefined) break;
		if (first.startsWith('@')) {
			const second = segments[index + 2];
			if (second === undefined) break;
			packages.push(`${first}/${second}`);
			index += 2;
		} else {
			packages.push(first);
			index += 1;
		}
	}
	return packages.join('/');
}

function selectLockEntry(
	entries: readonly LockPackageEntry[],
	name: string,
	version: string,
	locator: string
): LockPackageEntry & { readonly integrity: string } {
	const identity = `${name}@${version}`;
	const candidates = entries.filter((entry) => entry.packageIdentity === identity);
	const expected = expectedLockKey(locator);
	const exact = candidates.filter((entry) => entry.key === expected);
	const selected = exact.length === 1 ? exact[0] : undefined;
	if (selected !== undefined && selected.integrity !== null)
		return selected as LockPackageEntry & { readonly integrity: string };
	throw new Error(`Installed package ${identity} does not have an unambiguous bun.lock tuple.`);
}

function observePackageClosure(
	repositoryRoot: string,
	configurations: readonly GeneratedContextExecutionConfigurationRecord[],
	lock: readonly LockPackageEntry[]
): {
	readonly missingOptionalPackages: GeneratedContextExecutionManifest['missingOptionalPackages'];
	readonly packages: readonly GeneratedContextExecutionPackageRecord[];
} {
	const appRoot = resolve(repositoryRoot, 'apps/rph-demo');
	const seeds = new Set<string>(PROFILE_PACKAGE_SEEDS);
	for (const config of configurations)
		for (const specifier of config.imports) {
			const name = packageName(specifier);
			if (!name.startsWith('node:')) seeds.add(name);
		}
	const queue: PackageQueueEntry[] = [...seeds]
		.sort(compareText)
		.map((name) => ({ issuer: 'apps/rph-demo', issuerDirectory: appRoot, name, optional: false }));
	const budget: ClosureBudget = {
		bytes: 0,
		deadline: Date.now() + MAX_DURATION_MS,
		directories: 0,
		files: 0
	};
	const observedRoots = new Set<string>();
	const packages: GeneratedContextExecutionPackageRecord[] = [];
	const missingOptionalPackages: Array<{ readonly issuer: string; readonly name: string }> = [];
	while (queue.length > 0) {
		if (packages.length >= MAX_PACKAGES)
			throw new Error('Installed dependency closure exceeded its package limit.');
		const next = queue.shift()!;
		const packageRoot = packageRootFor(repositoryRoot, next.issuerDirectory, next.name);
		if (packageRoot === null) {
			if (next.optional) {
				missingOptionalPackages.push({ issuer: next.issuer, name: next.name });
				continue;
			}
			throw new Error(`Required generated-context package ${next.name} is not installed.`);
		}
		const physicalKey = process.platform === 'win32' ? packageRoot.toLowerCase() : packageRoot;
		if (observedRoots.has(physicalKey)) continue;
		observedRoots.add(physicalKey);
		const locator = logicalPath(repositoryRoot, packageRoot);
		const manifestBytes = stableRead(
			resolve(packageRoot, 'package.json'),
			MAX_CONFIG_BYTES,
			`${next.name} package manifest`
		);
		const manifest = packageManifest(manifestBytes, next.name);
		const tree = packageTree(packageRoot, budget);
		const lockEntry = selectLockEntry(lock, manifest.name, manifest.version, locator);
		packages.push({
			bytes: tree.bytes,
			fileCount: tree.fileCount,
			integrity: lockEntry.integrity,
			locator,
			lockKey: lockEntry.key,
			manifestSha256: sha256(manifestBytes),
			name: manifest.name,
			treeSha256: tree.sha256,
			version: manifest.version
		});
		for (const name of manifest.dependencies)
			queue.push({ issuer: locator, issuerDirectory: packageRoot, name, optional: false });
		for (const name of manifest.optionalDependencies)
			queue.push({ issuer: locator, issuerDirectory: packageRoot, name, optional: true });
		queue.sort((left, right) =>
			compareText(`${left.issuer}\0${left.name}`, `${right.issuer}\0${right.name}`)
		);
	}
	packages.sort((left, right) => compareText(left.locator, right.locator));
	missingOptionalPackages.sort((left, right) =>
		compareText(`${left.issuer}\0${left.name}`, `${right.issuer}\0${right.name}`)
	);
	return { missingOptionalPackages, packages };
}

export function generatedContextExecutionManifestDigest(
	manifest: GeneratedContextExecutionManifest
): string {
	return sha256(
		`JAN-CSAA-GENERATED-CONTEXT-EXECUTION\0${GENERATED_CONTEXT_GENERATOR_IDENTITY_METHOD}\0${canonicalJson(manifest)}`
	);
}

export function observeSvelteKitExecution(repositoryRoot: string): SvelteKitExecutionObservation {
	const root = realpathSync(resolve(repositoryRoot));
	assertNoEnvironmentFiles(root);
	assertRequiredPathsAbsent(root);
	const configurations = observeConfigurations(root);
	const lockBytes = stableRead(resolve(root, 'bun.lock'), MAX_LOCK_BYTES, 'bun.lock');
	const closure = observePackageClosure(root, configurations, lockEntries(lockBytes));
	const runtime = observeNodeRuntime(root);
	const repositoryReadGrants: GeneratedContextExecutionManifest['repositoryReadGrants'] = [
		...REQUIRED_ABSENT_PATHS.map((path) => ({ kind: 'ABSENT_PATH' as const, path })),
		...(existsSync(resolve(root, 'apps/rph-demo/static'))
			? []
			: [{ kind: 'ABSENT_PATH' as const, path: 'apps/rph-demo/static' }]),
		...[
			'apps/rph-demo/package.json',
			'apps/rph-demo/svelte.config.js',
			'apps/rph-demo/tsconfig.json',
			'apps/rph-demo/vite.config.ts',
			'bun.lock',
			'package.json'
		].map((path) => ({ kind: 'FILE' as const, path })),
		{ kind: 'DIRECTORY' as const, path: 'apps/rph-demo/src' },
		...(existsSync(resolve(root, 'apps/rph-demo/static'))
			? [{ kind: 'DIRECTORY' as const, path: 'apps/rph-demo/static' }]
			: []),
		...closure.packages.map((record) => ({ kind: 'DIRECTORY' as const, path: record.locator }))
	].sort((left, right) => compareText(left.path, right.path));
	const manifest: GeneratedContextExecutionManifest = {
		containmentPolicy:
			'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0',
		configurationEntrypoints: configurations,
		environment: environmentEntries(runtime.record.platform as NodeJS.Platform),
		environmentPolicy: SVELTE_KIT_SYNC_ENVIRONMENT_POLICY,
		executionLimitations: [
			'CHILD_PROCESS_EXECUTABLE_IDENTITY_AND_EFFECTS_NOT_BOUND_OR_OS_SANDBOXED',
			'NATIVE_ADDON_EFFECTS_NOT_FILESYSTEM_NETWORK_MEMORY_OR_OS_SANDBOXED',
			'NETWORK_DENIAL_NOT_ENFORCED_BY_NODE_PERMISSION_MODEL'
		],
		generatedOutputRoot: {
			access: 'READ_WRITE',
			baseline: 'EMPTY_PHYSICAL_DIRECTORY',
			path: GENERATED_OUTPUT_ROOT,
			replay: 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION'
		},
		invocation: SVELTE_KIT_SYNC_INVOCATION,
		lockfile: { path: 'bun.lock', sha256: sha256(lockBytes) },
		missingOptionalPackages: closure.missingOptionalPackages,
		packages: closure.packages,
		readGrantProfile: 'svelte-kit-sync-project-defaults/1.0.0',
		repositoryReadGrants,
		runtime: runtime.record,
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
	return {
		implementationDigest: generatedContextExecutionManifestDigest(manifest),
		manifest,
		nodeExecutable: runtime.executable
	};
}
