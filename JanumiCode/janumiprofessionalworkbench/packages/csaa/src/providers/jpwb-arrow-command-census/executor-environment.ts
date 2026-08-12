import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	openSync,
	readSync,
	readdirSync,
	realpathSync
} from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
	ArrowCommandCensusExecutorIdentity,
	ArrowCommandCensusExternalModuleIdentity,
	ArrowCommandCensusExternalModuleName
} from '../../contracts/arrow-command-census.js';
import { compareText } from '../../inventory/canonical.js';
import { canonicalSemanticJsonWitness } from '../../semantic/canonical.js';

export const ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_NAMES = ['typescript', 'ulid', 'zod'] as const;

export const ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_CONTENT_PROFILE =
	'jan-csaa-arrow-command-census-external-module-content/1.0.0' as const;

export interface ResolveArrowCommandCensusExecutorEnvironmentRequest {
	/** Cumulative operation budget across exactly TypeScript, ULID, and Zod. */
	readonly maxExternalModuleBytes: number;
	/** Cumulative operation budget across exactly TypeScript, ULID, and Zod. */
	readonly maxExternalModuleFiles: number;
	/** Absolute path of the provider worker source that will be executed. */
	readonly workerPath: string;
}

export type ArrowCommandCensusExecutorEnvironmentIdentity = Pick<
	ArrowCommandCensusExecutorIdentity,
	| 'executableBytes'
	| 'executableSha256'
	| 'externalModules'
	| 'runtime'
	| 'runtimeVersion'
	| 'worker'
>;

/**
 * Absolute locators are execution-private materialization inputs. They are
 * deliberately separate from identity so they cannot be serialized as
 * observation evidence or make canonical identities machine-specific.
 */
export interface ArrowCommandCensusExecutorEnvironmentResolution {
	readonly executable: string;
	readonly identity: ArrowCommandCensusExecutorEnvironmentIdentity;
	readonly moduleRoots: Readonly<Record<ArrowCommandCensusExternalModuleName, string>>;
	readonly workerPath: string;
}

export type ArrowCommandCensusExecutorEnvironmentErrorCode =
	| 'BUDGET_EXHAUSTED'
	| 'BUN_REQUIRED'
	| 'ENVIRONMENT_CAPTURE_FAILED'
	| 'EXECUTABLE_INVALID'
	| 'EXTERNAL_MODULE_MANIFEST_INVALID'
	| 'EXTERNAL_MODULE_RESOLUTION_FAILED'
	| 'EXTERNAL_MODULE_TREE_INVALID'
	| 'IDENTITY_CHANGED_DURING_CAPTURE'
	| 'REQUEST_INVALID'
	| 'WORKER_INVALID';

export class ArrowCommandCensusExecutorEnvironmentError extends Error {
	constructor(
		readonly code: ArrowCommandCensusExecutorEnvironmentErrorCode,
		readonly path: string | null,
		readonly moduleName: ArrowCommandCensusExternalModuleName | null,
		message: string
	) {
		super(message);
		this.name = 'ArrowCommandCensusExecutorEnvironmentError';
	}
}

interface BunRuntime {
	readonly executable: string;
	readonly version: string;
	resolveSync(specifier: string, from: string): string;
}

interface FileIdentity {
	readonly bytes: number;
	readonly path: string;
	readonly sha256: string;
}

interface CapturedFileIdentity extends FileIdentity {
	readonly content?: Uint8Array;
}

interface ExternalModuleBudgetLedger {
	bytes: number;
	files: number;
	readonly maxBytes: number;
	readonly maxFiles: number;
}

function fail(
	code: ArrowCommandCensusExecutorEnvironmentErrorCode,
	message: string,
	path: string | null = null,
	moduleName: ArrowCommandCensusExternalModuleName | null = null
): never {
	throw new ArrowCommandCensusExecutorEnvironmentError(code, path, moduleName, message);
}

function requirePositiveBudget(value: unknown, field: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) {
		fail('REQUEST_INVALID', `${field} must be a positive safe integer operation budget.`);
	}
	return value as number;
}

function pathBunExecutable(): string | null {
	for (const directory of (process.env.PATH ?? '').split(delimiter)) {
		if (directory.length === 0) continue;
		for (const name of process.platform === 'win32' ? ['bun.exe'] : ['bun']) {
			const candidate = join(directory, name);
			try {
				if (lstatSync(candidate).isFile()) return realpathSync.native(candidate);
			} catch {
				// Continue to the next PATH entry.
			}
		}
	}
	return null;
}

function requireBun(workerPath: string): BunRuntime {
	const candidate = (globalThis as { Bun?: unknown }).Bun;
	if (
		candidate !== null &&
		typeof candidate === 'object' &&
		typeof (candidate as { version?: unknown }).version === 'string' &&
		(candidate as { version: string }).version.length > 0 &&
		typeof (candidate as { resolveSync?: unknown }).resolveSync === 'function'
	) {
		return {
			executable: process.execPath,
			resolveSync: (candidate as BunRuntime).resolveSync.bind(candidate),
			version: (candidate as BunRuntime).version
		};
	}
	const executable = pathBunExecutable();
	if (executable === null) {
		fail('BUN_REQUIRED', 'The arrow-command census executor environment requires Bun.');
	}
	const versionResult = spawnSync(executable, ['--version'], {
		encoding: 'utf8',
		timeout: 10_000,
		windowsHide: true
	});
	const version = versionResult.status === 0 ? versionResult.stdout.trim() : '';
	if (
		version.length === 0 ||
		versionResult.stderr.length !== 0 ||
		versionResult.error !== undefined
	) {
		fail('BUN_REQUIRED', 'The Bun executable could not report a stable version.', executable);
	}
	const require = createRequire(workerPath);
	return {
		executable,
		resolveSync(specifier: string): string {
			return require.resolve(specifier);
		},
		version
	};
}

function canonicalRegularFile(
	inputPath: string,
	code: 'EXECUTABLE_INVALID' | 'WORKER_INVALID',
	label: string
): string {
	let path: string;
	try {
		path = realpathSync.native(inputPath);
	} catch {
		return fail(code, `${label} must resolve to an existing regular file.`, inputPath);
	}
	try {
		if (!lstatSync(path).isFile()) {
			fail(code, `${label} must resolve to an existing regular file.`, path);
		}
	} catch (error) {
		if (error instanceof ArrowCommandCensusExecutorEnvironmentError) throw error;
		return fail(code, `${label} must resolve to an existing regular file.`, path);
	}
	return path;
}

function sameStableFile(
	left: ReturnType<typeof fstatSync>,
	right: ReturnType<typeof fstatSync>
): boolean {
	return (
		left.dev === right.dev &&
		left.ino === right.ino &&
		left.mode === right.mode &&
		left.size === right.size &&
		left.mtimeMs === right.mtimeMs &&
		left.ctimeMs === right.ctimeMs
	);
}

function captureFile(
	path: string,
	label: string,
	moduleName: ArrowCommandCensusExternalModuleName | null,
	ledger?: ExternalModuleBudgetLedger,
	collectContent = false
): CapturedFileIdentity {
	let descriptor: number | undefined;
	try {
		const lexical = lstatSync(path);
		if (!lexical.isFile()) {
			fail(
				moduleName === null ? 'ENVIRONMENT_CAPTURE_FAILED' : 'EXTERNAL_MODULE_TREE_INVALID',
				`${label} must be a regular file.`,
				path,
				moduleName
			);
		}
		descriptor = openSync(path, constants.O_RDONLY);
		const before = fstatSync(descriptor);
		if (!before.isFile() || !Number.isSafeInteger(before.size) || before.size < 0) {
			fail(
				moduleName === null ? 'ENVIRONMENT_CAPTURE_FAILED' : 'EXTERNAL_MODULE_TREE_INVALID',
				`${label} has an unsupported file identity or size.`,
				path,
				moduleName
			);
		}
		if (ledger !== undefined && ledger.bytes + before.size > ledger.maxBytes) {
			fail(
				'BUDGET_EXHAUSTED',
				`External module bytes exceed the caller budget of ${ledger.maxBytes}.`,
				path,
				moduleName
			);
		}

		const hash = createHash('sha256');
		const chunks = collectContent ? ([] as Uint8Array[]) : null;
		const buffer = Buffer.allocUnsafe(64 * 1024);
		let bytes = 0;
		while (bytes < before.size) {
			const count = readSync(
				descriptor,
				buffer,
				0,
				Math.min(buffer.byteLength, before.size - bytes),
				bytes
			);
			if (count === 0) {
				fail(
					'IDENTITY_CHANGED_DURING_CAPTURE',
					`${label} changed while its bytes were captured.`,
					path,
					moduleName
				);
			}
			const chunk = buffer.subarray(0, count);
			hash.update(chunk);
			if (chunks !== null) chunks.push(Uint8Array.from(chunk));
			bytes += count;
		}
		if (readSync(descriptor, buffer, 0, 1, bytes) !== 0) {
			fail(
				'IDENTITY_CHANGED_DURING_CAPTURE',
				`${label} changed while its bytes were captured.`,
				path,
				moduleName
			);
		}
		const after = fstatSync(descriptor);
		if (!sameStableFile(before, after)) {
			fail(
				'IDENTITY_CHANGED_DURING_CAPTURE',
				`${label} changed while its identity was captured.`,
				path,
				moduleName
			);
		}
		if (ledger !== undefined) ledger.bytes += bytes;
		const content =
			chunks === null
				? undefined
				: Uint8Array.from(
						Buffer.concat(
							chunks.map((chunk) => Buffer.from(chunk)),
							bytes
						)
					);
		return {
			bytes,
			...(content === undefined ? {} : { content }),
			path,
			sha256: hash.digest('hex')
		};
	} catch (error) {
		if (error instanceof ArrowCommandCensusExecutorEnvironmentError) throw error;
		return fail(
			moduleName === null ? 'ENVIRONMENT_CAPTURE_FAILED' : 'EXTERNAL_MODULE_TREE_INVALID',
			`${label} could not be captured as a stable regular file.`,
			path,
			moduleName
		);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
}

function canonicalRelativePath(root: string, absolutePath: string): string {
	const fromRoot = relative(root, absolutePath);
	if (
		fromRoot.length === 0 ||
		isAbsolute(fromRoot) ||
		fromRoot === '..' ||
		fromRoot.startsWith(`..${sep}`)
	) {
		fail(
			'EXTERNAL_MODULE_TREE_INVALID',
			'External module enumeration escaped its package root.',
			absolutePath
		);
	}
	return fromRoot.replaceAll('\\', '/');
}

function enumerateRegularFiles(
	root: string,
	moduleName: ArrowCommandCensusExternalModuleName
): readonly { readonly absolutePath: string; readonly relativePath: string }[] {
	const files: { absolutePath: string; relativePath: string }[] = [];
	const visit = (directory: string): void => {
		let names: string[];
		try {
			names = readdirSync(directory).sort(compareText);
		} catch {
			return fail(
				'EXTERNAL_MODULE_TREE_INVALID',
				`External module ${moduleName} contains an unreadable directory.`,
				directory,
				moduleName
			);
		}
		for (const name of names) {
			const absolutePath = join(directory, name);
			let entry;
			try {
				entry = lstatSync(absolutePath);
			} catch {
				return fail(
					'EXTERNAL_MODULE_TREE_INVALID',
					`External module ${moduleName} changed during enumeration.`,
					absolutePath,
					moduleName
				);
			}
			if (entry.isSymbolicLink()) {
				fail(
					'EXTERNAL_MODULE_TREE_INVALID',
					`External module ${moduleName} contains a symbolic link; links are not followed.`,
					absolutePath,
					moduleName
				);
			}
			if (entry.isDirectory()) {
				visit(absolutePath);
				continue;
			}
			if (!entry.isFile()) {
				fail(
					'EXTERNAL_MODULE_TREE_INVALID',
					`External module ${moduleName} contains a non-regular filesystem entry.`,
					absolutePath,
					moduleName
				);
			}
			files.push({ absolutePath, relativePath: canonicalRelativePath(root, absolutePath) });
		}
	};
	visit(root);
	return files.sort((left, right) => compareText(left.relativePath, right.relativePath));
}

function decodeManifest(
	bytes: Uint8Array,
	path: string,
	moduleName: ArrowCommandCensusExternalModuleName
) {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return fail(
			'EXTERNAL_MODULE_MANIFEST_INVALID',
			`External module ${moduleName} package.json is not valid UTF-8.`,
			path,
			moduleName
		);
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return fail(
			'EXTERNAL_MODULE_MANIFEST_INVALID',
			`External module ${moduleName} package.json is not valid JSON.`,
			path,
			moduleName
		);
	}
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		fail(
			'EXTERNAL_MODULE_MANIFEST_INVALID',
			`External module ${moduleName} package.json must be an object.`,
			path,
			moduleName
		);
	}
	const manifest = value as Record<string, unknown>;
	if (manifest.name !== moduleName) {
		fail(
			'EXTERNAL_MODULE_MANIFEST_INVALID',
			`External module manifest name must be exactly ${moduleName}.`,
			path,
			moduleName
		);
	}
	if (
		typeof manifest.version !== 'string' ||
		manifest.version.length === 0 ||
		manifest.version.includes('\0')
	) {
		fail(
			'EXTERNAL_MODULE_MANIFEST_INVALID',
			`External module ${moduleName} must declare a non-empty string version.`,
			path,
			moduleName
		);
	}
	return manifest.version;
}

function resolvedPackageManifest(
	bun: BunRuntime,
	moduleName: ArrowCommandCensusExternalModuleName,
	resolveFrom: string
): { readonly manifestPath: string; readonly packageRoot: string } {
	let resolution: string;
	try {
		resolution = bun.resolveSync(`${moduleName}/package.json`, resolveFrom);
	} catch {
		return fail(
			'EXTERNAL_MODULE_RESOLUTION_FAILED',
			`Bun could not resolve ${moduleName}/package.json from the census worker.`,
			null,
			moduleName
		);
	}
	let lexicalManifestPath: string;
	try {
		lexicalManifestPath = resolution.startsWith('file:') ? fileURLToPath(resolution) : resolution;
	} catch {
		return fail(
			'EXTERNAL_MODULE_RESOLUTION_FAILED',
			`Bun returned an invalid resolution for ${moduleName}/package.json.`,
			resolution,
			moduleName
		);
	}
	if (!isAbsolute(lexicalManifestPath)) {
		fail(
			'EXTERNAL_MODULE_RESOLUTION_FAILED',
			`Bun must return an absolute resolution for ${moduleName}/package.json.`,
			lexicalManifestPath,
			moduleName
		);
	}
	const lexicalPackageRoot = dirname(lexicalManifestPath);
	try {
		if (
			lstatSync(lexicalManifestPath).isSymbolicLink() ||
			lstatSync(lexicalPackageRoot).isSymbolicLink()
		) {
			fail(
				'EXTERNAL_MODULE_TREE_INVALID',
				`External module ${moduleName} package root or manifest is a symbolic link.`,
				lexicalPackageRoot,
				moduleName
			);
		}
		if (!lstatSync(lexicalManifestPath).isFile() || !lstatSync(lexicalPackageRoot).isDirectory()) {
			fail(
				'EXTERNAL_MODULE_RESOLUTION_FAILED',
				`Bun resolution for ${moduleName} does not identify a regular package manifest.`,
				lexicalManifestPath,
				moduleName
			);
		}
		const manifestPath = realpathSync.native(lexicalManifestPath);
		const packageRoot = realpathSync.native(lexicalPackageRoot);
		if (dirname(manifestPath) !== packageRoot) {
			fail(
				'EXTERNAL_MODULE_RESOLUTION_FAILED',
				`Bun resolution for ${moduleName} is not rooted by its package.json parent.`,
				manifestPath,
				moduleName
			);
		}
		return { manifestPath, packageRoot };
	} catch (error) {
		if (error instanceof ArrowCommandCensusExecutorEnvironmentError) throw error;
		return fail(
			'EXTERNAL_MODULE_RESOLUTION_FAILED',
			`Bun resolution for ${moduleName} could not be inspected.`,
			lexicalManifestPath,
			moduleName
		);
	}
}

function captureExternalModule(
	bun: BunRuntime,
	moduleName: ArrowCommandCensusExternalModuleName,
	resolveFrom: string,
	ledger: ExternalModuleBudgetLedger
): { readonly identity: ArrowCommandCensusExternalModuleIdentity; readonly packageRoot: string } {
	const { manifestPath, packageRoot } = resolvedPackageManifest(bun, moduleName, resolveFrom);
	const enumerated = enumerateRegularFiles(packageRoot, moduleName);
	if (ledger.files + enumerated.length > ledger.maxFiles) {
		fail(
			'BUDGET_EXHAUSTED',
			`External module files exceed the caller budget of ${ledger.maxFiles}.`,
			packageRoot,
			moduleName
		);
	}
	ledger.files += enumerated.length;

	const files: FileIdentity[] = [];
	let manifestBytes: Uint8Array | undefined;
	let bytes = 0;
	for (const file of enumerated) {
		const captured = captureFile(
			file.absolutePath,
			`${moduleName}/${file.relativePath}`,
			moduleName,
			ledger,
			file.absolutePath === manifestPath
		);
		files.push({ bytes: captured.bytes, path: file.relativePath, sha256: captured.sha256 });
		bytes += captured.bytes;
		if (file.absolutePath === manifestPath) manifestBytes = captured.content;
	}
	if (manifestBytes === undefined) {
		fail(
			'EXTERNAL_MODULE_MANIFEST_INVALID',
			`External module ${moduleName} enumeration did not contain its resolved package.json.`,
			manifestPath,
			moduleName
		);
	}
	const version = decodeManifest(manifestBytes, manifestPath, moduleName);
	const contentDigest = canonicalSemanticJsonWitness({
		canonicalProfile: ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_CONTENT_PROFILE,
		files,
		name: moduleName,
		version
	}).sha256;
	return {
		identity: {
			bytes,
			contentDigest,
			files: files.length,
			name: moduleName,
			version
		},
		packageRoot
	};
}

function resolveEnvironmentUnsafe(
	request: ResolveArrowCommandCensusExecutorEnvironmentRequest
): ArrowCommandCensusExecutorEnvironmentResolution {
	if (request === null || typeof request !== 'object' || Array.isArray(request)) {
		fail('REQUEST_INVALID', 'Executor environment request must be an object.');
	}
	const maxExternalModuleBytes = requirePositiveBudget(
		request.maxExternalModuleBytes,
		'maxExternalModuleBytes'
	);
	const maxExternalModuleFiles = requirePositiveBudget(
		request.maxExternalModuleFiles,
		'maxExternalModuleFiles'
	);
	if (typeof request.workerPath !== 'string' || !isAbsolute(request.workerPath)) {
		fail('REQUEST_INVALID', 'workerPath must be an absolute path.');
	}

	const bun = requireBun(request.workerPath);
	const executable = canonicalRegularFile(bun.executable, 'EXECUTABLE_INVALID', 'Bun executable');
	const workerPath = canonicalRegularFile(request.workerPath, 'WORKER_INVALID', 'Census worker');
	const executableIdentity = captureFile(executable, 'Bun executable', null);
	const workerIdentity = captureFile(workerPath, 'Census worker', null);
	const ledger: ExternalModuleBudgetLedger = {
		bytes: 0,
		files: 0,
		maxBytes: maxExternalModuleBytes,
		maxFiles: maxExternalModuleFiles
	};
	const externalModules: ArrowCommandCensusExternalModuleIdentity[] = [];
	const moduleRoots = {} as Record<ArrowCommandCensusExternalModuleName, string>;
	for (const moduleName of ARROW_COMMAND_CENSUS_EXTERNAL_MODULE_NAMES) {
		const captured = captureExternalModule(bun, moduleName, workerPath, ledger);
		externalModules.push(captured.identity);
		moduleRoots[moduleName] = captured.packageRoot;
	}
	return {
		executable,
		identity: {
			executableBytes: executableIdentity.bytes,
			executableSha256: executableIdentity.sha256,
			externalModules,
			runtime: 'bun',
			runtimeVersion: bun.version,
			worker: {
				bytes: workerIdentity.bytes,
				sha256: workerIdentity.sha256
			}
		},
		moduleRoots,
		workerPath
	};
}

export function resolveArrowCommandCensusExecutorEnvironment(
	request: ResolveArrowCommandCensusExecutorEnvironmentRequest
): ArrowCommandCensusExecutorEnvironmentResolution {
	try {
		return resolveEnvironmentUnsafe(request);
	} catch (error) {
		if (error instanceof ArrowCommandCensusExecutorEnvironmentError) throw error;
		throw new ArrowCommandCensusExecutorEnvironmentError(
			'ENVIRONMENT_CAPTURE_FAILED',
			null,
			null,
			`Arrow-command census executor environment capture failed: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}
