import { spawnSync } from 'node:child_process';
import {
	closeSync,
	accessSync,
	constants,
	fstatSync,
	lstatSync,
	openSync,
	readSync,
	realpathSync,
	statSync,
	type BigIntStats
} from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import {
	WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD,
	WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS,
	WORKING_SOURCE_EDIT_OBSERVATION_METHOD,
	WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD,
	type WorkingSourceEditGitObjectFormat,
	type WorkingSourceEditObservation,
	type WorkingSourceEditObservationBudgets,
	type WorkingSourceEditObservedText,
	type WorkingSourceEditRegularFileMode,
	type WorkingSourceEditTextRange
} from '../contracts/working-source-edit-impact-candidate-report.js';
import type { CapturedArtifactRecord } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJsonWitness, isUnicodeScalarString } from '../semantic/canonical.js';
import {
	createMonotonicOperationClock,
	type MonotonicOperationClock,
	type MonotonicOperationClockSources
} from '../semantic/monotonic-operation-clock.js';
import { assertCanonicalRelativePath } from '../subject/paths.js';

const GIT_PROVIDER_ID = 'git' as const;
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const REGULAR_MODE_PATTERN = /^(?:100644|100755)$/u;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)$/u;
const READ_CHUNK_BYTES = 64 * 1024;

export type WorkingSourceEditObservationStage =
	| 'GIT_PROVIDER'
	| 'BASE_REVISION'
	| 'HEAD_TREE'
	| 'INDEX'
	| 'CURRENT_SOURCE'
	| 'TEXTUAL_CHANGE'
	| 'CURRENTNESS';

export type WorkingSourceEditObservationFailureState =
	'failed' | 'incompatible' | 'resource-refused' | 'stale';

/** Safe, implementation-local failure surfaced to the composing report facade. */
export class WorkingSourceEditObservationError extends Error {
	constructor(
		readonly code: string,
		readonly stage: WorkingSourceEditObservationStage,
		readonly state: WorkingSourceEditObservationFailureState,
		message: string,
		readonly path: string | null = null
	) {
		super(message);
		this.name = 'WorkingSourceEditObservationError';
	}
}

export function isWorkingSourceEditObservationError(
	value: unknown
): value is WorkingSourceEditObservationError {
	return value instanceof WorkingSourceEditObservationError;
}

export interface ObserveWorkingSourceEditOptions {
	readonly budgets: WorkingSourceEditObservationBudgets;
	readonly expectedHeadOid: string;
	/** Repository root or a verified nested directory from which `logicalPath` is resolved. */
	readonly rootLocator: string;
	readonly logicalPath: string;
}

/** Implementation-local seams used only by focused race and clock regressions. */
export interface ObserveWorkingSourceEditDependencies {
	readonly beforeCurrentnessRecheck?: () => void;
	readonly clockSources?: MonotonicOperationClockSources;
}

interface RawWorkingSourceEditSource {
	readonly after: WorkingSourceEditObservedText;
	readonly before: WorkingSourceEditObservedText & {
		readonly binding: 'RAW_IMMUTABLE_HEAD_TREE_BLOB';
	};
	readonly encoding: 'UTF-8';
	readonly logicalPath: string;
	readonly repositoryPath: string;
}

/**
 * Pre-FrozenSubject observation. Its digest deliberately excludes the later subject-only artifact
 * binding, as pinned by WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE.
 */
export interface RawWorkingSourceEditObservation {
	readonly change: WorkingSourceEditObservation['change'];
	readonly evidenceDigestMethod: typeof WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD;
	readonly evidenceDigestScope: typeof WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE;
	readonly evidenceSha256: string;
	readonly exclusions: typeof WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS;
	readonly git: WorkingSourceEditObservation['git'];
	readonly method: typeof WORKING_SOURCE_EDIT_OBSERVATION_METHOD;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION;
	readonly source: RawWorkingSourceEditSource;
}

export interface WorkingSourceEditCapture {
	/** Mutable byte capability; never place it in a JSON report. */
	readonly currentBytes: Uint8Array;
	readonly observation: RawWorkingSourceEditObservation;
	/** Private physical current-root identity used only for exact re-observation. */
	readonly repositoryRoot: string;
	/** Private physical Git top-level identity used only for exact re-observation. */
	readonly gitTopLevel: string;
	readonly budgets: WorkingSourceEditObservationBudgets;
}

interface GitContext {
	readonly budgets: WorkingSourceEditObservationBudgets;
	readonly clock: MonotonicOperationClock;
	readonly deadlineMs: number;
	readonly environment: NodeJS.ProcessEnv;
	readonly executable: string;
}

interface GitRepositoryIdentity {
	readonly commonDirectory: string;
	readonly gitDirectory: string;
	readonly objectFormat: WorkingSourceEditGitObjectFormat;
	readonly prefix: string;
	readonly providerVersion: string;
	readonly repositoryRoot: string;
	readonly topLevel: string;
}

interface GitTreeEntry {
	readonly blobOid: string;
	readonly mode: WorkingSourceEditRegularFileMode;
}

interface StableSourceRead {
	readonly bytes: Uint8Array;
	readonly text: string;
}

function fail(
	code: string,
	stage: WorkingSourceEditObservationStage,
	state: WorkingSourceEditObservationFailureState,
	message: string,
	path: string | null = null
): never {
	throw new WorkingSourceEditObservationError(code, stage, state, message, path);
}

function physicalPathKey(path: string): string {
	const normalized = resolve(path).replace(/[\\/]+$/u, '');
	return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function samePhysicalPath(left: string, right: string): boolean {
	return physicalPathKey(left) === physicalPathKey(right);
}

function insidePhysicalRoot(root: string, candidate: string): boolean {
	const fromRoot = relative(root, candidate);
	return (
		fromRoot === '' ||
		(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
	);
}

function slash(path: string): string {
	return path.replaceAll('\\', '/');
}

function lexicalGitBoundary(repositoryRoot: string): string | null {
	let candidate = repositoryRoot;
	while (true) {
		try {
			lstatSync(join(candidate, '.git'));
			return realpathSync.native(candidate);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTDIR')
				fail(
					'GIT_REPOSITORY_IDENTITY_INVALID',
					'GIT_PROVIDER',
					'failed',
					'Git worktree marker could not be safely inspected.'
				);
		}
		const parent = dirname(candidate);
		if (parent === candidate) return null;
		candidate = parent;
	}
}

function pathEnvironmentValue(): string {
	for (const [key, value] of Object.entries(process.env))
		if (key.toUpperCase() === 'PATH' && value !== undefined) return value;
	return '';
}

function resolveGitExecutable(repositoryRoot: string): {
	readonly executable: string;
	readonly safePath: string;
} {
	const boundary = lexicalGitBoundary(repositoryRoot);
	let executable: string | null = null;
	for (const rawEntry of pathEnvironmentValue().split(delimiter)) {
		const unquoted =
			rawEntry.startsWith('"') && rawEntry.endsWith('"') ? rawEntry.slice(1, -1) : rawEntry;
		if (unquoted.length === 0 || !isAbsolute(unquoted)) continue;
		let directory: string;
		try {
			directory = realpathSync.native(unquoted);
			if (!statSync(directory).isDirectory()) continue;
		} catch {
			continue;
		}
		if (insidePhysicalRoot(repositoryRoot, directory)) continue;
		if (boundary !== null && insidePhysicalRoot(boundary, directory)) continue;
		const candidate = join(directory, process.platform === 'win32' ? 'git.exe' : 'git');
		try {
			const realCandidate = realpathSync.native(candidate);
			if (!statSync(realCandidate).isFile()) continue;
			accessSync(realCandidate, constants.X_OK);
			if (insidePhysicalRoot(repositoryRoot, realCandidate)) continue;
			if (boundary !== null && insidePhysicalRoot(boundary, realCandidate)) continue;
			executable = realCandidate;
			break;
		} catch {
			// This PATH entry does not contain a directly executable native Git binary.
		}
	}
	if (executable === null)
		fail(
			'GIT_PROVIDER_UNAVAILABLE',
			'GIT_PROVIDER',
			'failed',
			'No safe absolute Git executable could be resolved from nonempty absolute PATH entries.'
		);
	return Object.freeze({ executable, safePath: dirname(executable) });
}

function safeGitEnvironment(safePath: string): NodeJS.ProcessEnv {
	const inherited = new Map(
		Object.entries(process.env).map(([key, value]) => [key.toUpperCase(), value] as const)
	);
	const environment: NodeJS.ProcessEnv = {};
	for (const key of process.platform === 'win32'
		? ['COMSPEC', 'PATHEXT', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'TMP', 'WINDIR']
		: ['TMPDIR']) {
		const value = inherited.get(key);
		if (value !== undefined) environment[key] = value;
	}
	const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
	return {
		...environment,
		GIT_ATTR_NOSYSTEM: '1',
		GIT_CONFIG_GLOBAL: nullDevice,
		GIT_CONFIG_NOSYSTEM: '1',
		GIT_LITERAL_PATHSPECS: '1',
		GIT_NO_LAZY_FETCH: '1',
		GIT_NO_REPLACE_OBJECTS: '1',
		GIT_OPTIONAL_LOCKS: '0',
		GIT_PAGER: 'cat',
		GIT_PROTOCOL_FROM_USER: '0',
		GIT_TERMINAL_PROMPT: '0',
		LANG: 'C',
		LC_ALL: 'C',
		PAGER: 'cat',
		PATH: safePath
	};
}

function gitDurationRemaining(
	context: GitContext,
	stage: WorkingSourceEditObservationStage
): number {
	let now: number;
	try {
		now = context.clock.now();
	} catch {
		fail(
			'GIT_OBSERVATION_CLOCK_FAILED',
			stage,
			'resource-refused',
			'Git observation monotonic duration accounting failed closed.'
		);
	}
	const remaining = context.deadlineMs - now;
	if (remaining <= 0)
		fail(
			'GIT_OBSERVATION_TIMEOUT',
			stage,
			'resource-refused',
			'Git observation exceeded the admitted aggregate duration budget.'
		);
	return Math.max(1, remaining);
}

function validateBudgets(budgets: WorkingSourceEditObservationBudgets): void {
	const ceiling = WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.observation;
	for (const [name, value, maximum] of [
		['maxGitMetadataBytes', budgets.maxGitMetadataBytes, ceiling.maxGitMetadataBytes],
		[
			'maxGitOperationDurationMs',
			budgets.maxGitOperationDurationMs,
			ceiling.maxGitOperationDurationMs
		],
		['maxSourceBytes', budgets.maxSourceBytes, ceiling.maxSourceBytes],
		['maxPathCharacters', budgets.maxPathCharacters, ceiling.maxPathCharacters]
	] as const) {
		if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
			fail(
				'OBSERVATION_BUDGET_INVALID',
				'GIT_PROVIDER',
				'incompatible',
				`${name} must be a positive safe integer within the absolute observation ceiling.`
			);
	}
}

function validateOptions(options: ObserveWorkingSourceEditOptions): {
	readonly expectedHeadOid: string;
	readonly logicalPath: string;
	readonly repositoryRoot: string;
} {
	validateBudgets(options.budgets);
	if (!isAbsolute(options.rootLocator))
		fail(
			'REPOSITORY_ROOT_INVALID',
			'GIT_PROVIDER',
			'incompatible',
			'Repository root locator must be an existing absolute directory.'
		);
	let repositoryRoot: string;
	try {
		repositoryRoot = realpathSync.native(options.rootLocator);
		if (!statSync(repositoryRoot).isDirectory()) throw new Error('not a directory');
	} catch {
		fail(
			'REPOSITORY_ROOT_INVALID',
			'GIT_PROVIDER',
			'incompatible',
			'Repository root locator must be an existing canonical directory.'
		);
	}
	if (
		typeof options.logicalPath !== 'string' ||
		options.logicalPath.length > options.budgets.maxPathCharacters ||
		options.logicalPath.includes('\0') ||
		!isUnicodeScalarString(options.logicalPath)
	)
		fail(
			'SOURCE_PATH_INVALID',
			'CURRENT_SOURCE',
			options.logicalPath.length > options.budgets.maxPathCharacters
				? 'resource-refused'
				: 'incompatible',
			options.logicalPath.length > options.budgets.maxPathCharacters
				? 'Selected source path exceeds its character budget.'
				: 'Selected source path is not canonical Unicode repository-relative text.',
			options.logicalPath.length <= options.budgets.maxPathCharacters ? options.logicalPath : null
		);
	let logicalPath: string;
	try {
		logicalPath = assertCanonicalRelativePath(options.logicalPath);
	} catch {
		fail(
			'SOURCE_PATH_INVALID',
			'CURRENT_SOURCE',
			'incompatible',
			'Selected source path must be canonical and repository-relative.',
			options.logicalPath
		);
	}
	if (
		typeof options.expectedHeadOid !== 'string' ||
		(!SHA1_PATTERN.test(options.expectedHeadOid) && !SHA256_PATTERN.test(options.expectedHeadOid))
	)
		fail(
			'BASE_COMMIT_OID_INVALID',
			'BASE_REVISION',
			'incompatible',
			'Immutable base commit must be an exact full lowercase Git object ID.'
		);
	return { expectedHeadOid: options.expectedHeadOid, logicalPath, repositoryRoot };
}

function gitArgv(cwd: string, command: readonly string[]): string[] {
	const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
	return [
		'--no-pager',
		'--no-optional-locks',
		'--no-replace-objects',
		'--literal-pathspecs',
		'-c',
		'core.fsmonitor=false',
		'-c',
		'core.untrackedCache=false',
		'-c',
		`core.hooksPath=${nullDevice}`,
		'-c',
		'color.ui=false',
		'-c',
		'submodule.recurse=false',
		'-c',
		'maintenance.auto=false',
		'-C',
		cwd,
		...command
	];
}

function runGit(
	context: GitContext,
	cwd: string,
	command: readonly string[],
	stage: WorkingSourceEditObservationStage,
	stdoutLimit = context.budgets.maxGitMetadataBytes
): Uint8Array {
	const timeout = gitDurationRemaining(context, stage);
	const result = spawnSync(context.executable, gitArgv(cwd, command), {
		cwd: dirname(context.executable),
		encoding: 'buffer',
		env: context.environment,
		input: Buffer.alloc(0),
		killSignal: 'SIGKILL',
		maxBuffer: Math.max(stdoutLimit, context.budgets.maxGitMetadataBytes) + 1,
		shell: false,
		timeout,
		windowsHide: true
	});
	gitDurationRemaining(context, stage);
	const stdout = result.stdout ?? Buffer.alloc(0);
	const stderr = result.stderr ?? Buffer.alloc(0);
	if (stdout.byteLength > stdoutLimit || stderr.byteLength > context.budgets.maxGitMetadataBytes)
		fail(
			'GIT_OUTPUT_BUDGET_EXCEEDED',
			stage,
			'resource-refused',
			'Git output exceeded the admitted byte budget.'
		);
	if (result.error !== undefined) {
		const code = (result.error as NodeJS.ErrnoException).code;
		fail(
			code === 'ETIMEDOUT' ? 'GIT_OPERATION_TIMEOUT' : 'GIT_PROVIDER_UNAVAILABLE',
			stage,
			code === 'ETIMEDOUT' || code === 'ENOBUFS' ? 'resource-refused' : 'failed',
			code === 'ETIMEDOUT'
				? 'Git operation exceeded the admitted duration budget.'
				: 'Git provider could not complete the bounded read-only operation.'
		);
	}
	if (result.signal !== null || result.status !== 0)
		fail(
			'GIT_OPERATION_FAILED',
			stage,
			'failed',
			'Git provider refused or failed the bounded read-only operation.'
		);
	if (stderr.byteLength !== 0)
		fail(
			'GIT_OUTPUT_INVALID',
			stage,
			'failed',
			'Git provider emitted unexpected diagnostic output for a successful read-only operation.'
		);
	return Uint8Array.from(stdout);
}

function decodeGitText(bytes: Uint8Array, stage: WorkingSourceEditObservationStage): string {
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		fail(
			'GIT_OUTPUT_INVALID',
			stage,
			'failed',
			'Git provider metadata output was not valid UTF-8.'
		);
	}
}

function singleGitLine(bytes: Uint8Array, stage: WorkingSourceEditObservationStage): string {
	const text = decodeGitText(bytes, stage);
	const line = text.endsWith('\r\n')
		? text.slice(0, -2)
		: text.endsWith('\n')
			? text.slice(0, -1)
			: text;
	if (
		line.includes('\r') ||
		line.includes('\n') ||
		line.includes('\0') ||
		!isUnicodeScalarString(line)
	)
		fail(
			'GIT_OUTPUT_INVALID',
			stage,
			'failed',
			'Git provider returned malformed single-value metadata.'
		);
	return line;
}

function verifiedDirectory(pathText: string): string {
	if (!isAbsolute(pathText))
		fail(
			'GIT_REPOSITORY_IDENTITY_INVALID',
			'GIT_PROVIDER',
			'failed',
			'Git provider returned a non-absolute repository identity path.'
		);
	try {
		const path = realpathSync.native(pathText);
		if (!statSync(path).isDirectory()) throw new Error('not a directory');
		return path;
	} catch {
		fail(
			'GIT_REPOSITORY_IDENTITY_INVALID',
			'GIT_PROVIDER',
			'failed',
			'Git repository identity directory could not be verified.'
		);
	}
}

function discoverRepository(context: GitContext, repositoryRoot: string): GitRepositoryIdentity {
	const inside = singleGitLine(
		runGit(context, repositoryRoot, ['rev-parse', '--is-inside-work-tree'], 'GIT_PROVIDER'),
		'GIT_PROVIDER'
	);
	if (inside !== 'true')
		fail(
			'GIT_WORKTREE_REQUIRED',
			'GIT_PROVIDER',
			'incompatible',
			'Selected root must be inside a non-bare Git worktree.'
		);
	const providerLine = singleGitLine(
		runGit(context, repositoryRoot, ['--version'], 'GIT_PROVIDER'),
		'GIT_PROVIDER'
	);
	if (!providerLine.startsWith('git version ') || providerLine.length > 256)
		fail(
			'GIT_PROVIDER_VERSION_INVALID',
			'GIT_PROVIDER',
			'failed',
			'Git provider version identity was malformed.'
		);
	const providerVersion = providerLine.slice('git version '.length);
	if (providerVersion.length === 0 || !isUnicodeScalarString(providerVersion))
		fail(
			'GIT_PROVIDER_VERSION_INVALID',
			'GIT_PROVIDER',
			'failed',
			'Git provider version identity was malformed.'
		);
	const topLevel = verifiedDirectory(
		singleGitLine(
			runGit(
				context,
				repositoryRoot,
				['rev-parse', '--path-format=absolute', '--show-toplevel'],
				'GIT_PROVIDER'
			),
			'GIT_PROVIDER'
		)
	);
	if (insidePhysicalRoot(topLevel, context.executable))
		fail(
			'GIT_EXECUTABLE_INSIDE_WORKTREE',
			'GIT_PROVIDER',
			'failed',
			'Git executable must be outside the discovered worktree.'
		);
	if (!insidePhysicalRoot(topLevel, repositoryRoot))
		fail(
			'GIT_REPOSITORY_IDENTITY_INVALID',
			'GIT_PROVIDER',
			'failed',
			'Selected root is outside the discovered Git top-level directory.'
		);
	const prefix = singleGitLine(
		runGit(context, repositoryRoot, ['rev-parse', '--show-prefix'], 'GIT_PROVIDER'),
		'GIT_PROVIDER'
	);
	const relativeRoot = slash(relative(topLevel, repositoryRoot));
	const expectedPrefix = relativeRoot === '' ? '' : `${relativeRoot}/`;
	if (prefix !== expectedPrefix)
		fail(
			'GIT_REPOSITORY_IDENTITY_INVALID',
			'GIT_PROVIDER',
			'failed',
			'Git top-level and nested-prefix identities do not agree.'
		);
	const gitDirectory = verifiedDirectory(
		singleGitLine(
			runGit(context, repositoryRoot, ['rev-parse', '--absolute-git-dir'], 'GIT_PROVIDER'),
			'GIT_PROVIDER'
		)
	);
	const commonDirectory = verifiedDirectory(
		singleGitLine(
			runGit(
				context,
				repositoryRoot,
				['rev-parse', '--path-format=absolute', '--git-common-dir'],
				'GIT_PROVIDER'
			),
			'GIT_PROVIDER'
		)
	);
	if (
		insidePhysicalRoot(gitDirectory, context.executable) ||
		insidePhysicalRoot(commonDirectory, context.executable)
	)
		fail(
			'GIT_EXECUTABLE_INSIDE_REPOSITORY_METADATA',
			'GIT_PROVIDER',
			'failed',
			'Git executable must be outside the repository metadata directories.'
		);
	const objectFormatText = singleGitLine(
		runGit(context, topLevel, ['rev-parse', '--show-object-format=storage'], 'GIT_PROVIDER'),
		'GIT_PROVIDER'
	);
	if (objectFormatText !== 'sha1' && objectFormatText !== 'sha256')
		fail(
			'GIT_OBJECT_FORMAT_UNSUPPORTED',
			'GIT_PROVIDER',
			'incompatible',
			'Git repository object format is unsupported.'
		);
	return Object.freeze({
		commonDirectory,
		gitDirectory,
		objectFormat: objectFormatText,
		prefix,
		providerVersion,
		repositoryRoot,
		topLevel
	});
}

function sameRepositoryIdentity(
	left: GitRepositoryIdentity,
	right: GitRepositoryIdentity
): boolean {
	return (
		left.objectFormat === right.objectFormat &&
		left.prefix === right.prefix &&
		left.providerVersion === right.providerVersion &&
		samePhysicalPath(left.repositoryRoot, right.repositoryRoot) &&
		samePhysicalPath(left.topLevel, right.topLevel) &&
		samePhysicalPath(left.gitDirectory, right.gitDirectory) &&
		samePhysicalPath(left.commonDirectory, right.commonDirectory)
	);
}

function snapshotHead(
	context: GitContext,
	topLevel: string,
	expectedHeadOid: string,
	objectFormat: WorkingSourceEditGitObjectFormat,
	stage: 'BASE_REVISION' | 'CURRENTNESS'
): string {
	const headOid = singleGitLine(
		runGit(
			context,
			topLevel,
			['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'],
			stage
		),
		stage
	);
	const pattern = objectFormat === 'sha1' ? SHA1_PATTERN : SHA256_PATTERN;
	if (!pattern.test(headOid))
		fail(
			'GIT_HEAD_OID_INVALID',
			stage,
			'failed',
			'Git HEAD did not resolve to an exact full object ID.'
		);
	if (headOid !== expectedHeadOid)
		fail(
			stage === 'CURRENTNESS' ? 'GIT_HEAD_CHANGED' : 'GIT_HEAD_MISMATCH',
			stage,
			'stale',
			stage === 'CURRENTNESS'
				? 'Git HEAD changed during or after the selected edit observation.'
				: 'Git HEAD does not exactly match the requested immutable base commit.'
		);
	return headOid;
}

function oneNulRecord(
	bytes: Uint8Array,
	stage: 'HEAD_TREE' | 'INDEX' | 'CURRENTNESS',
	missingCode: string
): Uint8Array {
	if (bytes.byteLength === 0)
		fail(
			stage === 'CURRENTNESS' ? 'INDEX_ENTRY_CHANGED' : missingCode,
			stage,
			stage === 'CURRENTNESS' ? 'stale' : 'incompatible',
			stage === 'CURRENTNESS'
				? 'Selected index entry disappeared during the observation currentness window.'
				: 'Selected source is not represented by one exact Git entry.'
		);
	if (bytes[bytes.byteLength - 1] !== 0)
		fail('GIT_OUTPUT_INVALID', stage, 'failed', 'Git entry output was not NUL terminated.');
	let terminators = 0;
	for (const byte of bytes) if (byte === 0) terminators += 1;
	if (terminators !== 1)
		fail(
			stage === 'CURRENTNESS'
				? 'INDEX_ENTRY_CHANGED'
				: stage === 'INDEX'
					? 'INDEX_ENTRY_AMBIGUOUS'
					: 'HEAD_TREE_ENTRY_AMBIGUOUS',
			stage,
			stage === 'CURRENTNESS' ? 'stale' : 'incompatible',
			stage === 'CURRENTNESS'
				? 'Selected index entry became ambiguous during the observation currentness window.'
				: 'Selected source did not resolve to exactly one Git entry.'
		);
	return bytes.subarray(0, -1);
}

function splitEntry(
	record: Uint8Array,
	stage: 'HEAD_TREE' | 'INDEX' | 'CURRENTNESS'
): {
	readonly metadata: string;
	readonly pathBytes: Uint8Array;
} {
	const tab = record.indexOf(0x09);
	if (tab <= 0) fail('GIT_OUTPUT_INVALID', stage, 'failed', 'Git entry metadata was malformed.');
	const metadata = decodeGitText(record.subarray(0, tab), stage);
	return { metadata, pathBytes: record.subarray(tab + 1) };
}

function exactPathBytes(
	actual: Uint8Array,
	repositoryPath: string,
	stage: 'HEAD_TREE' | 'INDEX' | 'CURRENTNESS'
): void {
	const expected = Buffer.from(repositoryPath, 'utf8');
	if (!Buffer.from(actual).equals(expected))
		fail(
			stage === 'CURRENTNESS' ? 'INDEX_ENTRY_CHANGED' : 'GIT_PATH_IDENTITY_MISMATCH',
			stage,
			stage === 'CURRENTNESS' ? 'stale' : 'incompatible',
			stage === 'CURRENTNESS'
				? 'Selected index path identity changed during the observation currentness window.'
				: 'Git entry path did not exactly match the selected literal repository path.',
			repositoryPath
		);
}

function readTreeEntry(
	context: GitContext,
	topLevel: string,
	headOid: string,
	repositoryPath: string,
	objectFormat: WorkingSourceEditGitObjectFormat
): GitTreeEntry {
	const record = oneNulRecord(
		runGit(
			context,
			topLevel,
			['ls-tree', '-z', '--full-tree', headOid, '--', repositoryPath],
			'HEAD_TREE'
		),
		'HEAD_TREE',
		'HEAD_TREE_ENTRY_MISSING'
	);
	const { metadata, pathBytes } = splitEntry(record, 'HEAD_TREE');
	exactPathBytes(pathBytes, repositoryPath, 'HEAD_TREE');
	const match = /^(\d{6}) ([a-z]+) ([0-9a-f]+)$/u.exec(metadata);
	if (match === null)
		fail('GIT_OUTPUT_INVALID', 'HEAD_TREE', 'failed', 'Git tree entry metadata was malformed.');
	const [, mode, type, blobOid] = match;
	if (type !== 'blob' || mode === undefined || !REGULAR_MODE_PATTERN.test(mode))
		fail(
			'HEAD_TREE_ENTRY_NOT_REGULAR',
			'HEAD_TREE',
			'incompatible',
			'Selected immutable tree entry is not a supported regular file.',
			repositoryPath
		);
	const oidPattern = objectFormat === 'sha1' ? SHA1_PATTERN : SHA256_PATTERN;
	if (blobOid === undefined || !oidPattern.test(blobOid))
		fail('GIT_OUTPUT_INVALID', 'HEAD_TREE', 'failed', 'Git tree blob identity was malformed.');
	return Object.freeze({
		blobOid,
		mode: mode as WorkingSourceEditRegularFileMode
	});
}

function readAndMatchIndexEntry(
	context: GitContext,
	topLevel: string,
	repositoryPath: string,
	tree: GitTreeEntry,
	objectFormat: WorkingSourceEditGitObjectFormat,
	stage: 'INDEX' | 'CURRENTNESS'
): void {
	const output = runGit(
		context,
		topLevel,
		['ls-files', '--stage', '-z', '--', repositoryPath],
		stage
	);
	const record = oneNulRecord(output, stage, 'INDEX_ENTRY_MISSING');
	const { metadata, pathBytes } = splitEntry(record, stage);
	exactPathBytes(pathBytes, repositoryPath, stage);
	const match = /^(\d{6}) ([0-9a-f]+) ([0-3])$/u.exec(metadata);
	if (match === null)
		fail('GIT_OUTPUT_INVALID', stage, 'failed', 'Git index entry metadata was malformed.');
	const [, mode, blobOid, indexStage] = match;
	const oidPattern = objectFormat === 'sha1' ? SHA1_PATTERN : SHA256_PATTERN;
	if (
		mode === undefined ||
		!REGULAR_MODE_PATTERN.test(mode) ||
		blobOid === undefined ||
		!oidPattern.test(blobOid)
	)
		fail(
			stage === 'CURRENTNESS' ? 'INDEX_ENTRY_CHANGED' : 'INDEX_ENTRY_NOT_REGULAR',
			stage,
			stage === 'CURRENTNESS' ? 'stale' : 'incompatible',
			stage === 'CURRENTNESS'
				? 'Selected index entry identity changed during the observation currentness window.'
				: 'Selected index entry is not one supported regular file.',
			repositoryPath
		);
	if (indexStage !== '0' || mode !== tree.mode || blobOid !== tree.blobOid)
		fail(
			stage === 'CURRENTNESS' ? 'INDEX_ENTRY_CHANGED' : 'INDEX_DIVERGES_FROM_HEAD',
			stage,
			stage === 'CURRENTNESS' ? 'stale' : 'incompatible',
			stage === 'CURRENTNESS'
				? 'Selected stage-zero index entry changed during or after observation.'
				: 'Selected stage-zero index entry does not exactly match the immutable HEAD tree entry.',
			repositoryPath
		);
}

function parseObjectSize(bytes: Uint8Array): number {
	const text = singleGitLine(bytes, 'HEAD_TREE');
	if (!DECIMAL_PATTERN.test(text))
		fail('GIT_OUTPUT_INVALID', 'HEAD_TREE', 'failed', 'Git blob size metadata was malformed.');
	const size = Number(text);
	if (!Number.isSafeInteger(size))
		fail(
			'SOURCE_SIZE_UNSUPPORTED',
			'HEAD_TREE',
			'resource-refused',
			'Immutable source blob size exceeds the supported integer range.'
		);
	return size;
}

function readBaseBlob(context: GitContext, topLevel: string, tree: GitTreeEntry): Uint8Array {
	const size = parseObjectSize(
		runGit(context, topLevel, ['cat-file', '-s', tree.blobOid], 'HEAD_TREE')
	);
	if (size > context.budgets.maxSourceBytes)
		fail(
			'SOURCE_SIZE_BUDGET_EXCEEDED',
			'HEAD_TREE',
			'resource-refused',
			'Immutable source blob exceeds the admitted byte budget.'
		);
	const bytes = runGit(
		context,
		topLevel,
		['cat-file', 'blob', tree.blobOid],
		'HEAD_TREE',
		context.budgets.maxSourceBytes
	);
	if (bytes.byteLength !== size)
		fail(
			'GIT_BLOB_SIZE_MISMATCH',
			'HEAD_TREE',
			'failed',
			'Immutable source blob bytes did not match their declared object size.'
		);
	return bytes;
}

function sameStableFile(left: BigIntStats, right: BigIntStats): boolean {
	return (
		left.isFile() &&
		right.isFile() &&
		left.dev === right.dev &&
		left.ino === right.ino &&
		left.mode === right.mode &&
		left.size === right.size &&
		left.mtimeNs === right.mtimeNs &&
		left.ctimeNs === right.ctimeNs &&
		left.birthtimeNs === right.birthtimeNs
	);
}

function assertCurrentMode(
	stat: BigIntStats,
	expectedMode: WorkingSourceEditRegularFileMode,
	logicalPath: string
): void {
	if (process.platform === 'win32') return;
	const currentMode: WorkingSourceEditRegularFileMode =
		(stat.mode & 0o111n) === 0n ? '100644' : '100755';
	if (currentMode !== expectedMode)
		fail(
			'SOURCE_MODE_DIVERGES_FROM_HEAD',
			'CURRENT_SOURCE',
			'incompatible',
			'Selected current source executable mode does not match the immutable tree and index.',
			logicalPath
		);
}

function boundedDescriptorRead(descriptor: number, size: number): Uint8Array {
	const bytes = Buffer.allocUnsafe(size);
	let offset = 0;
	while (offset < size) {
		const count = readSync(
			descriptor,
			bytes,
			offset,
			Math.min(READ_CHUNK_BYTES, size - offset),
			offset
		);
		if (count === 0)
			fail(
				'SOURCE_CHANGED_DURING_CAPTURE',
				'CURRENT_SOURCE',
				'stale',
				'Selected source changed while its bytes were captured.'
			);
		offset += count;
	}
	const extra = Buffer.allocUnsafe(1);
	if (readSync(descriptor, extra, 0, 1, offset) !== 0)
		fail(
			'SOURCE_CHANGED_DURING_CAPTURE',
			'CURRENT_SOURCE',
			'stale',
			'Selected source changed while its bytes were captured.'
		);
	return Uint8Array.from(bytes);
}

function decodeSource(bytes: Uint8Array, path: string, label: 'immutable' | 'current'): string {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		fail(
			'SOURCE_INVALID_UTF8',
			label === 'immutable' ? 'HEAD_TREE' : 'CURRENT_SOURCE',
			'incompatible',
			`Selected ${label} source bytes are not valid UTF-8.`,
			path
		);
	}
	if (text.includes('\0'))
		fail(
			'SOURCE_BINARY_UNSUPPORTED',
			label === 'immutable' ? 'HEAD_TREE' : 'CURRENT_SOURCE',
			'incompatible',
			`Selected ${label} source contains a binary NUL code unit.`,
			path
		);
	return text;
}

function readCurrentSource(
	repositoryRoot: string,
	gitTopLevel: string,
	logicalPath: string,
	repositoryPath: string,
	maximumBytes: number,
	expectedMode: WorkingSourceEditRegularFileMode
): StableSourceRead {
	const lexicalFromRoot = resolve(repositoryRoot, ...logicalPath.split('/'));
	const lexicalFromTop = resolve(gitTopLevel, ...repositoryPath.split('/'));
	if (
		!insidePhysicalRoot(repositoryRoot, lexicalFromRoot) ||
		!insidePhysicalRoot(gitTopLevel, lexicalFromTop) ||
		!samePhysicalPath(lexicalFromRoot, lexicalFromTop)
	)
		fail(
			'SOURCE_PATH_ESCAPE',
			'CURRENT_SOURCE',
			'incompatible',
			'Selected source path escaped its verified repository roots.',
			logicalPath
		);
	let descriptor: number | undefined;
	try {
		const lexicalStat = lstatSync(lexicalFromRoot, { bigint: true });
		if (!lexicalStat.isFile() || lexicalStat.isSymbolicLink())
			fail(
				'SOURCE_NOT_REGULAR',
				'CURRENT_SOURCE',
				'incompatible',
				'Selected current source is not an existing regular file.',
				logicalPath
			);
		assertCurrentMode(lexicalStat, expectedMode, logicalPath);
		const realSource = realpathSync.native(lexicalFromRoot);
		if (
			!samePhysicalPath(realSource, lexicalFromRoot) ||
			!insidePhysicalRoot(gitTopLevel, realSource)
		)
			fail(
				'SOURCE_PATH_INDIRECTION_UNSUPPORTED',
				'CURRENT_SOURCE',
				'incompatible',
				'Selected current source uses unsupported filesystem indirection.',
				logicalPath
			);
		if (lexicalStat.size > BigInt(maximumBytes))
			fail(
				'SOURCE_SIZE_BUDGET_EXCEEDED',
				'CURRENT_SOURCE',
				'resource-refused',
				'Selected current source exceeds the admitted byte budget.',
				logicalPath
			);
		descriptor = openSync(lexicalFromRoot, 'r');
		const openedStat = fstatSync(descriptor, { bigint: true });
		if (!sameStableFile(lexicalStat, openedStat))
			fail(
				'SOURCE_CHANGED_DURING_CAPTURE',
				'CURRENT_SOURCE',
				'stale',
				'Selected source changed while it was opened.',
				logicalPath
			);
		const bytes = boundedDescriptorRead(descriptor, Number(openedStat.size));
		const afterHandle = fstatSync(descriptor, { bigint: true });
		const afterPath = lstatSync(lexicalFromRoot, { bigint: true });
		if (!sameStableFile(openedStat, afterHandle) || !sameStableFile(openedStat, afterPath))
			fail(
				'SOURCE_CHANGED_DURING_CAPTURE',
				'CURRENT_SOURCE',
				'stale',
				'Selected source changed while its bytes were captured.',
				logicalPath
			);
		assertCurrentMode(afterPath, expectedMode, logicalPath);
		return Object.freeze({ bytes, text: decodeSource(bytes, logicalPath, 'current') });
	} catch (error) {
		if (isWorkingSourceEditObservationError(error)) throw error;
		return fail(
			'SOURCE_READ_FAILED',
			'CURRENT_SOURCE',
			'incompatible',
			'Selected current source could not be read as one stable regular file.',
			logicalPath
		);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
}

function boundarySplitsSurrogate(text: string, boundary: number): boolean {
	if (boundary <= 0 || boundary >= text.length) return false;
	const left = text.charCodeAt(boundary - 1);
	const right = text.charCodeAt(boundary);
	return left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff;
}

/** Deterministic one-envelope UTF-16 range; it is not a minimal edit script. */
export function workingSourceEditTextRanges(
	before: string,
	after: string
): {
	readonly afterRange: WorkingSourceEditTextRange;
	readonly beforeRange: WorkingSourceEditTextRange;
} {
	let prefix = 0;
	const maximumPrefix = Math.min(before.length, after.length);
	while (prefix < maximumPrefix && before.charCodeAt(prefix) === after.charCodeAt(prefix))
		prefix += 1;
	if (boundarySplitsSurrogate(before, prefix) || boundarySplitsSurrogate(after, prefix))
		prefix -= 1;
	let suffix = 0;
	const maximumSuffix = Math.min(before.length - prefix, after.length - prefix);
	while (
		suffix < maximumSuffix &&
		before.charCodeAt(before.length - suffix - 1) === after.charCodeAt(after.length - suffix - 1)
	)
		suffix += 1;
	if (
		boundarySplitsSurrogate(before, before.length - suffix) ||
		boundarySplitsSurrogate(after, after.length - suffix)
	)
		suffix -= 1;
	return Object.freeze({
		afterRange: Object.freeze({ startUtf16: prefix, endUtf16: after.length - suffix }),
		beforeRange: Object.freeze({ startUtf16: prefix, endUtf16: before.length - suffix })
	});
}

function frozenObservedText(bytes: Uint8Array, text: string): WorkingSourceEditObservedText {
	return Object.freeze({
		bytes: bytes.byteLength,
		sha256: sha256(bytes),
		utf16CodeUnits: text.length
	});
}

function rawObservationDigest(
	observation: Omit<RawWorkingSourceEditObservation, 'evidenceSha256'>
): string {
	return canonicalSemanticJsonWitness(observation).sha256;
}

function createRawObservation(
	repository: GitRepositoryIdentity,
	expectedHeadOid: string,
	headOid: string,
	tree: GitTreeEntry,
	logicalPath: string,
	repositoryPath: string,
	baseBytes: Uint8Array,
	baseText: string,
	current: StableSourceRead
): RawWorkingSourceEditObservation {
	const ranges = workingSourceEditTextRanges(baseText, current.text);
	const core = Object.freeze({
		change: Object.freeze({
			afterRange: ranges.afterRange,
			beforeRange: ranges.beforeRange,
			coordinateSystem: 'UTF16_CODE_UNIT_OFFSET' as const,
			operation: 'EDIT' as const,
			scope: 'WHOLE_SOURCE' as const,
			textualDifference: 'OBSERVED' as const,
			textualMethod: WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD
		}),
		evidenceDigestMethod: WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD,
		evidenceDigestScope: WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE,
		exclusions: WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS,
		git: Object.freeze({
			headMatch: 'EXACT_FULL_OID_MATCH_TO_REQUESTED_IMMUTABLE_BASE' as const,
			headOid,
			indexBlobOid: tree.blobOid,
			indexMatch: 'EXACT_STAGE_ZERO_BLOB_AND_MODE_MATCH_TO_HEAD_TREE_ENTRY' as const,
			indexMode: tree.mode,
			indexStage: 0 as const,
			objectFormat: repository.objectFormat,
			providerId: GIT_PROVIDER_ID,
			providerQualification: 'NOT_CLAIMED' as const,
			providerVersion: repository.providerVersion,
			requestedBaseCommitOid: expectedHeadOid,
			treeBlobOid: tree.blobOid,
			treeMode: tree.mode
		}),
		method: WORKING_SOURCE_EDIT_OBSERVATION_METHOD,
		schemaVersion: WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION,
		source: Object.freeze({
			after: frozenObservedText(current.bytes, current.text),
			before: Object.freeze({
				...frozenObservedText(baseBytes, baseText),
				binding: 'RAW_IMMUTABLE_HEAD_TREE_BLOB' as const
			}),
			encoding: 'UTF-8' as const,
			logicalPath,
			repositoryPath
		})
	});
	return Object.freeze({ ...core, evidenceSha256: rawObservationDigest(core) });
}

export function observeWorkingSourceEdit(
	options: ObserveWorkingSourceEditOptions,
	dependencies: ObserveWorkingSourceEditDependencies = {}
): WorkingSourceEditCapture {
	const admitted = validateOptions(options);
	const budgets = Object.freeze({ ...options.budgets });
	let clock: MonotonicOperationClock;
	try {
		clock = createMonotonicOperationClock(dependencies.clockSources);
	} catch {
		fail(
			'GIT_OBSERVATION_CLOCK_FAILED',
			'GIT_PROVIDER',
			'resource-refused',
			'Git observation monotonic duration accounting failed closed.'
		);
	}
	const deadlineMs = clock.startedAtMs + budgets.maxGitOperationDurationMs;
	if (!Number.isSafeInteger(deadlineMs))
		fail(
			'GIT_OBSERVATION_CLOCK_FAILED',
			'GIT_PROVIDER',
			'resource-refused',
			'Git observation duration deadline could not be represented safely.'
		);
	const provider = resolveGitExecutable(admitted.repositoryRoot);
	const context: GitContext = Object.freeze({
		budgets,
		clock,
		deadlineMs,
		environment: safeGitEnvironment(provider.safePath),
		executable: provider.executable
	});
	const repository = discoverRepository(context, admitted.repositoryRoot);
	const repositoryPath = `${repository.prefix}${admitted.logicalPath}`;
	if (repositoryPath.length > budgets.maxPathCharacters)
		fail(
			'SOURCE_PATH_BUDGET_EXCEEDED',
			'CURRENT_SOURCE',
			'resource-refused',
			'Selected repository path exceeds the admitted character budget.'
		);
	assertCanonicalRelativePath(repositoryPath);
	const expectedLength = repository.objectFormat === 'sha1' ? 40 : 64;
	if (admitted.expectedHeadOid.length !== expectedLength)
		fail(
			'BASE_COMMIT_OBJECT_FORMAT_MISMATCH',
			'BASE_REVISION',
			'incompatible',
			'Immutable base commit object ID does not match the repository object format.'
		);
	const headOid = snapshotHead(
		context,
		repository.topLevel,
		admitted.expectedHeadOid,
		repository.objectFormat,
		'BASE_REVISION'
	);
	const tree = readTreeEntry(
		context,
		repository.topLevel,
		headOid,
		repositoryPath,
		repository.objectFormat
	);
	readAndMatchIndexEntry(
		context,
		repository.topLevel,
		repositoryPath,
		tree,
		repository.objectFormat,
		'INDEX'
	);
	const baseBytes = readBaseBlob(context, repository.topLevel, tree);
	const baseText = decodeSource(baseBytes, admitted.logicalPath, 'immutable');
	const current = readCurrentSource(
		repository.repositoryRoot,
		repository.topLevel,
		admitted.logicalPath,
		repositoryPath,
		budgets.maxSourceBytes,
		tree.mode
	);
	if (Buffer.from(baseBytes).equals(Buffer.from(current.bytes)))
		fail(
			'SOURCE_UNCHANGED',
			'TEXTUAL_CHANGE',
			'incompatible',
			'Selected current raw source bytes do not differ from the immutable HEAD blob.',
			admitted.logicalPath
		);
	const observation = createRawObservation(
		repository,
		admitted.expectedHeadOid,
		headOid,
		tree,
		admitted.logicalPath,
		repositoryPath,
		baseBytes,
		baseText,
		current
	);
	// Close the initial observation window with exact HEAD, index and raw-byte rechecks.
	try {
		dependencies.beforeCurrentnessRecheck?.();
	} catch {
		fail(
			'CURRENTNESS_RECHECK_SETUP_FAILED',
			'CURRENTNESS',
			'failed',
			'Git observation currentness recheck could not be prepared safely.'
		);
	}
	const finalRepository = discoverRepository(context, admitted.repositoryRoot);
	if (!sameRepositoryIdentity(repository, finalRepository))
		fail(
			'GIT_REPOSITORY_IDENTITY_CHANGED',
			'CURRENTNESS',
			'stale',
			'Git repository identity changed during the selected edit observation.'
		);
	snapshotHead(
		context,
		repository.topLevel,
		admitted.expectedHeadOid,
		repository.objectFormat,
		'CURRENTNESS'
	);
	readAndMatchIndexEntry(
		context,
		repository.topLevel,
		repositoryPath,
		tree,
		repository.objectFormat,
		'CURRENTNESS'
	);
	const finalCurrent = readCurrentSource(
		repository.repositoryRoot,
		repository.topLevel,
		admitted.logicalPath,
		repositoryPath,
		budgets.maxSourceBytes,
		tree.mode
	);
	if (!Buffer.from(current.bytes).equals(Buffer.from(finalCurrent.bytes)))
		fail(
			'SOURCE_CHANGED_DURING_CAPTURE',
			'CURRENTNESS',
			'stale',
			'Selected current raw source bytes changed during observation.',
			admitted.logicalPath
		);
	return Object.freeze({
		budgets,
		currentBytes: Uint8Array.from(current.bytes),
		gitTopLevel: repository.topLevel,
		observation,
		repositoryRoot: repository.repositoryRoot
	});
}

export function sameWorkingSourceEditCapture(
	left: WorkingSourceEditCapture,
	right: WorkingSourceEditCapture
): boolean {
	return (
		left.observation.evidenceSha256 === right.observation.evidenceSha256 &&
		samePhysicalPath(left.repositoryRoot, right.repositoryRoot) &&
		samePhysicalPath(left.gitTopLevel, right.gitTopLevel) &&
		Buffer.from(left.currentBytes).equals(Buffer.from(right.currentBytes))
	);
}

/** Fully re-runs discovery and observation; no Git or filesystem metadata is trusted from capture. */
export function verifyWorkingSourceEditObservation(
	capture: WorkingSourceEditCapture
): WorkingSourceEditCapture {
	let fresh: WorkingSourceEditCapture;
	try {
		fresh = observeWorkingSourceEdit({
			budgets: capture.budgets,
			expectedHeadOid: capture.observation.git.requestedBaseCommitOid,
			logicalPath: capture.observation.source.logicalPath,
			rootLocator: capture.repositoryRoot
		});
	} catch (error) {
		if (
			isWorkingSourceEditObservationError(error) &&
			(error.state === 'resource-refused' || error.code === 'GIT_PROVIDER_UNAVAILABLE')
		)
			throw error;
		fail(
			'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
			'CURRENTNESS',
			'stale',
			'Selected working-source edit could not be reproduced during final currentness verification.',
			capture.observation.source.logicalPath
		);
	}
	if (!sameWorkingSourceEditCapture(capture, fresh))
		fail(
			'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
			'CURRENTNESS',
			'stale',
			'Selected working-source edit evidence changed before final currentness verification.',
			capture.observation.source.logicalPath
		);
	return fresh;
}

function frozenArtifactCopy(artifact: CapturedArtifactRecord): CapturedArtifactRecord {
	return Object.freeze({ ...artifact, roles: Object.freeze([...artifact.roles]) });
}

/** Adds the later FrozenSubject binding without changing the pre-subject raw-evidence digest. */
export function bindWorkingSourceEditObservation(
	capture: WorkingSourceEditCapture,
	artifact: CapturedArtifactRecord
): WorkingSourceEditObservation {
	if (
		artifact.path !== capture.observation.source.logicalPath ||
		artifact.bytes !== capture.currentBytes.byteLength ||
		artifact.bytes !== capture.observation.source.after.bytes ||
		artifact.sha256 !== capture.observation.source.after.sha256 ||
		sha256(capture.currentBytes) !== artifact.sha256
	)
		fail(
			'FROZEN_SUBJECT_ARTIFACT_MISMATCH',
			'CURRENTNESS',
			'stale',
			'FrozenSubject artifact does not exactly bind the observed current raw source bytes.',
			capture.observation.source.logicalPath
		);
	return Object.freeze({
		...capture.observation,
		source: Object.freeze({
			...capture.observation.source,
			after: Object.freeze({
				...capture.observation.source.after,
				artifact: frozenArtifactCopy(artifact),
				binding: 'RAW_CURRENT_BYTES_MATCH_FROZEN_SUBJECT_ARTIFACT' as const
			})
		})
	});
}
