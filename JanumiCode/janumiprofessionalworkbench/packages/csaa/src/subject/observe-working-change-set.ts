import { existsSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import type { FrozenWorkingChangeSet } from '../contracts/working-change-set.js';
import { canonicalPathKey, assertCanonicalRelativePath } from './paths.js';
import { runGitReadOnly } from './git-readonly.js';
import { WorkingChangeSetIncompatibleError } from './working-change-set-error.js';

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MODE_PATTERN = /^(?:100644|100755|120000|160000)$/u;
const VERSION_PREFIX = 'git version ';
const VERSION_VALUE_PATTERN = /^[0-9A-Za-z][\x20-\x7E]{0,255}$/u;

export function parseGitProviderVersion(line: string): string | null {
	if (!line.startsWith(VERSION_PREFIX)) return null;
	const value = line.slice(VERSION_PREFIX.length);
	const match = VERSION_VALUE_PATTERN.exec(value);
	return match?.[0] === value ? value : null;
}

export interface GitTreeEntry {
	readonly mode: '100644' | '100755';
	readonly oid: string;
	readonly path: string;
}

export interface GitIndexEntry extends GitTreeEntry {
	readonly stage: 0;
}

export interface GitStatusRecord {
	readonly kind: 'ORDINARY' | 'RENAMED_OR_COPIED' | 'UNMERGED' | 'UNTRACKED';
	readonly originalPath: string | null;
	readonly path: string;
}

export interface GitWorkingObservation {
	readonly baseRevision: string;
	readonly baseTree: readonly GitTreeEntry[];
	readonly baseTreeDigest: string;
	readonly checkoutId: string;
	readonly coreAutoCrlf: 'false' | 'input' | 'true' | 'unset';
	readonly fileMode: boolean;
	readonly gitVersion: string;
	readonly index: readonly GitIndexEntry[];
	readonly indexDigest: string;
	readonly objectFormat: 'sha1' | 'sha256';
	readonly observationDigest: string;
	readonly repositoryPrefix: string;
	readonly repositoryRoot: string;
	readonly statusDigest: string;
	readonly statusRecords: readonly GitStatusRecord[];
	readonly subjectRoot: string;
}

export interface GitObservationBudgetSession {
	readonly deadlineMs: number;
	remainingOutputBytes: number;
}

const observationBudgetSessions = new WeakMap<GitWorkingObservation, GitObservationBudgetSession>();

export function createGitObservationBudgetSession(budgets: {
	readonly maxBytes: number;
	readonly maxDurationMs: number;
}): GitObservationBudgetSession {
	return {
		deadlineMs: Date.now() + budgets.maxDurationMs,
		remainingOutputBytes: budgets.maxBytes
	};
}

function runObservedGit(
	session: GitObservationBudgetSession,
	cwd: string,
	args: readonly string[],
	options: { readonly allowExitCodes?: readonly number[]; readonly input?: Uint8Array } = {}
): Buffer {
	const remainingMs = session.deadlineMs - Date.now();
	if (remainingMs <= 0) throw new Error('Git observation exceeded its duration budget.');
	if (session.remainingOutputBytes <= 0)
		throw new Error('Git observation exceeded its aggregate output-byte budget.');
	if ((options.input?.byteLength ?? 0) > session.remainingOutputBytes)
		throw new Error('Git observation exceeded its aggregate input/output-byte budget.');
	session.remainingOutputBytes -= options.input?.byteLength ?? 0;
	let safeDirectory = realpathSync(cwd);
	while (!existsSync(resolve(safeDirectory, '.git'))) {
		const parent = dirname(safeDirectory);
		if (parent === safeDirectory)
			throw new WorkingChangeSetIncompatibleError(
				'The requested subject is not inside a non-bare Git worktree.'
			);
		safeDirectory = parent;
	}
	const output = runGitReadOnly(
		cwd,
		['-c', `safe.directory=${safeDirectory.replaceAll('\\', '/')}`, ...args],
		{
			allowExitCodes: options.allowExitCodes,
			input: options.input,
			maxOutputBytes: session.remainingOutputBytes,
			timeoutMs: remainingMs
		}
	);
	session.remainingOutputBytes -= output.byteLength;
	return output;
}

function text(bytes: Buffer, label: string): string {
	try {
		return decoder.decode(bytes);
	} catch {
		throw new Error(`${label} is not valid UTF-8.`);
	}
}

function line(bytes: Buffer, label: string, allowEmpty = false): string {
	const value = text(bytes, label).replace(/\r?\n$/u, '');
	if (value.includes('\n') || value.includes('\r') || (!allowEmpty && value.length === 0))
		throw new Error(`${label} is not one valid line.`);
	return value;
}

function nulRecords(bytes: Buffer, label: string): string[] {
	if (bytes.byteLength === 0) return [];
	if (bytes[bytes.byteLength - 1] !== 0) throw new Error(`${label} is not NUL terminated.`);
	const records: string[] = [];
	let start = 0;
	for (let index = 0; index < bytes.byteLength; index += 1) {
		if (bytes[index] !== 0) continue;
		if (index === start) throw new Error(`${label} contains an empty record.`);
		records.push(text(bytes.subarray(start, index), label));
		start = index + 1;
	}
	return records;
}

function oidPattern(objectFormat: 'sha1' | 'sha256'): RegExp {
	return objectFormat === 'sha1' ? /^[0-9a-f]{40}$/u : /^[0-9a-f]{64}$/u;
}

function pathFromRepository(path: string, repositoryPrefix: string): string | null {
	assertCanonicalRelativePath(path);
	if (repositoryPrefix === '') return path;
	const prefix = `${repositoryPrefix}/`;
	return path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

function uniquePaths<T extends { readonly path: string }>(
	records: readonly T[],
	label: string
): void {
	const identities = new Set<string>();
	for (const record of records) {
		const identity = canonicalPathKey(record.path);
		if (identities.has(identity)) throw new Error(`${label} contains a canonical path collision.`);
		identities.add(identity);
	}
}

function parseBaseTree(
	bytes: Buffer,
	repositoryPrefix: string,
	objectFormat: 'sha1' | 'sha256',
	maxFiles: number
): readonly GitTreeEntry[] {
	const records = nulRecords(bytes, 'Git base-tree output');
	if (records.length > maxFiles)
		throw new Error('Git base-tree population exceeds the file budget.');
	const entries = records.map((record): GitTreeEntry => {
		const tab = record.indexOf('\t');
		if (tab <= 0) throw new Error('Git base-tree record is malformed.');
		const [mode, type, oid, ...extra] = record.slice(0, tab).split(' ');
		if (
			extra.length !== 0 ||
			!MODE_PATTERN.test(mode ?? '') ||
			type !== 'blob' ||
			!oidPattern(objectFormat).test(oid ?? '')
		)
			throw new Error('Git base-tree record has an unsupported identity or object kind.');
		if (mode === '120000')
			throw new WorkingChangeSetIncompatibleError(
				'Git symlink entries are unsupported by Working Change Set.'
			);
		if (mode === '160000')
			throw new WorkingChangeSetIncompatibleError(
				'Gitlink entries are unsupported by Working Change Set.'
			);
		const path = pathFromRepository(record.slice(tab + 1), repositoryPrefix);
		if (path === null) throw new Error('Git base-tree record escaped the subject prefix.');
		return { mode: mode as GitTreeEntry['mode'], oid: oid!, path };
	});
	entries.sort((left, right) => compareText(left.path, right.path));
	uniquePaths(entries, 'Git base tree');
	return entries;
}

function parseIndex(
	bytes: Buffer,
	repositoryPrefix: string,
	objectFormat: 'sha1' | 'sha256',
	maxFiles: number
): readonly GitIndexEntry[] {
	const records = nulRecords(bytes, 'Git index output');
	if (records.length > maxFiles) throw new Error('Git index population exceeds the file budget.');
	const entries = records.map((record): GitIndexEntry => {
		const tab = record.indexOf('\t');
		if (tab <= 0) throw new Error('Git index record is malformed.');
		const [mode, oid, stage, ...extra] = record.slice(0, tab).split(' ');
		if (extra.length !== 0 || stage !== '0')
			throw new WorkingChangeSetIncompatibleError(
				'Unmerged Git index stages are unsupported by Working Change Set.'
			);
		if (!MODE_PATTERN.test(mode ?? '') || !oidPattern(objectFormat).test(oid ?? ''))
			throw new Error('Git index record has an unsupported identity or mode.');
		if (mode === '120000')
			throw new WorkingChangeSetIncompatibleError(
				'Git symlink entries are unsupported by Working Change Set.'
			);
		if (mode === '160000')
			throw new WorkingChangeSetIncompatibleError(
				'Gitlink entries are unsupported by Working Change Set.'
			);
		const path = pathFromRepository(record.slice(tab + 1), repositoryPrefix);
		if (path === null) throw new Error('Git index record escaped the subject prefix.');
		return { mode: mode as GitIndexEntry['mode'], oid: oid!, path, stage: 0 };
	});
	entries.sort((left, right) => compareText(left.path, right.path));
	uniquePaths(entries, 'Git index');
	return entries;
}

function fieldRemainder(record: string, spaces: number, label: string): string {
	let offset = 0;
	for (let count = 0; count < spaces; count += 1) {
		offset = record.indexOf(' ', offset);
		if (offset < 0) throw new Error(`${label} record is malformed.`);
		offset += 1;
	}
	const path = record.slice(offset);
	if (path.length === 0) throw new Error(`${label} record has an empty path.`);
	assertCanonicalRelativePath(path);
	return path;
}

function parseStatus(bytes: Buffer, maxFiles: number): readonly GitStatusRecord[] {
	const records = nulRecords(bytes, 'Git status output');
	const status: GitStatusRecord[] = [];
	for (let index = 0; index < records.length; index += 1) {
		const record = records[index]!;
		if (record.startsWith('1 ')) {
			status.push({
				kind: 'ORDINARY',
				originalPath: null,
				path: fieldRemainder(record, 8, 'Git status')
			});
			continue;
		}
		if (record.startsWith('2 ')) {
			const path = fieldRemainder(record, 9, 'Git status');
			const originalPath = records[index + 1];
			if (originalPath === undefined) throw new Error('Git rename status lacks its original path.');
			assertCanonicalRelativePath(originalPath);
			status.push({ kind: 'RENAMED_OR_COPIED', originalPath, path });
			index += 1;
			continue;
		}
		if (record.startsWith('u ')) {
			status.push({
				kind: 'UNMERGED',
				originalPath: null,
				path: fieldRemainder(record, 10, 'Git status')
			});
			continue;
		}
		if (record.startsWith('? ')) {
			const path = record.slice(2);
			assertCanonicalRelativePath(path);
			status.push({ kind: 'UNTRACKED', originalPath: null, path });
			continue;
		}
		throw new Error('Git status contains an unsupported record kind.');
	}
	if (status.length > maxFiles) throw new Error('Git status population exceeds the file budget.');
	if (status.some((record) => record.kind === 'UNMERGED'))
		throw new WorkingChangeSetIncompatibleError(
			'Unmerged Git status is unsupported by Working Change Set.'
		);
	return status;
}

function assertIndexFlags(
	session: GitObservationBudgetSession,
	subjectRoot: string,
	repositoryPrefix: string,
	maxFiles: number
): void {
	const pathspec = repositoryPrefix === '' ? [] : [repositoryPrefix];
	const records = nulRecords(
		runObservedGit(session, subjectRoot, [
			'ls-files',
			'-v',
			'-z',
			'--full-name',
			'--',
			...pathspec
		]),
		'Git index-flag output'
	);
	if (records.length > maxFiles)
		throw new Error('Git index-flag population exceeds the file budget.');
	for (const record of records) {
		const marker = record[0];
		if (marker === undefined || record[1] !== ' ')
			throw new Error('Git index-flag record is malformed.');
		if (marker === 'S')
			throw new WorkingChangeSetIncompatibleError(
				'Sparse or skip-worktree Git entries are unsupported.'
			);
		if (marker >= 'a' && marker <= 'z')
			throw new WorkingChangeSetIncompatibleError('Assume-unchanged Git entries are unsupported.');
	}
}

function samePhysicalPath(left: string, right: string): boolean {
	const leftIdentity = realpathSync(left).replaceAll('\\', '/');
	const rightIdentity = realpathSync(right).replaceAll('\\', '/');
	return process.platform === 'win32'
		? leftIdentity.toLowerCase() === rightIdentity.toLowerCase()
		: leftIdentity === rightIdentity;
}

export function observeGitWorkingState(
	subjectRoot: string,
	budgets: { readonly maxBytes: number; readonly maxDurationMs: number; readonly maxFiles: number },
	session: GitObservationBudgetSession = createGitObservationBudgetSession(budgets)
): GitWorkingObservation {
	const root = resolve(subjectRoot);
	const repositoryRoot = line(
		runObservedGit(session, root, ['rev-parse', '--show-toplevel']),
		'Git repository root'
	);
	let repositoryPrefix = line(
		runObservedGit(session, root, ['rev-parse', '--show-prefix']),
		'Git repository prefix',
		true
	);
	repositoryPrefix = repositoryPrefix.replace(/\/$/u, '');
	if (repositoryPrefix !== '') assertCanonicalRelativePath(repositoryPrefix);
	if (!samePhysicalPath(root, resolve(repositoryRoot, repositoryPrefix)))
		throw new WorkingChangeSetIncompatibleError(
			'Git repository prefix does not identify the requested subject root.'
		);
	const objectFormat = line(
		runObservedGit(session, root, ['rev-parse', '--show-object-format']),
		'Git object format'
	);
	if (objectFormat !== 'sha1' && objectFormat !== 'sha256')
		throw new WorkingChangeSetIncompatibleError('Git object format is unsupported.');
	const baseRevision = line(
		runObservedGit(session, root, ['rev-parse', '--verify', 'HEAD^{commit}']),
		'Git base revision'
	);
	if (!oidPattern(objectFormat).test(baseRevision))
		throw new WorkingChangeSetIncompatibleError('Git base revision is malformed or abbreviated.');
	const versionLine = line(runObservedGit(session, root, ['--version']), 'Git provider version');
	const version = parseGitProviderVersion(versionLine);
	if (version === null) throw new Error('Git provider version is malformed.');
	const sparse = text(
		runObservedGit(session, root, ['config', '--bool', '--get', 'core.sparseCheckout'], {
			allowExitCodes: [0, 1]
		}),
		'Git sparse-checkout configuration'
	).trim();
	if (sparse === 'true')
		throw new WorkingChangeSetIncompatibleError(
			'Sparse Git checkout is unsupported by Working Change Set.'
		);
	if (sparse !== '' && sparse !== 'false')
		throw new Error('Git sparse-checkout configuration is malformed.');
	const fileModeValue = text(
		runObservedGit(session, root, ['config', '--bool', '--get', 'core.filemode'], {
			allowExitCodes: [0, 1]
		}),
		'Git file-mode configuration'
	).trim();
	if (fileModeValue !== '' && fileModeValue !== 'false' && fileModeValue !== 'true')
		throw new Error('Git file-mode configuration is malformed.');
	const fileMode = fileModeValue !== 'false';
	const coreAutoCrlfValue = text(
		runObservedGit(session, root, ['config', '--get', 'core.autocrlf'], {
			allowExitCodes: [0, 1]
		}),
		'Git automatic line-ending configuration'
	)
		.trim()
		.toLowerCase();
	if (!['', 'false', 'input', 'true'].includes(coreAutoCrlfValue))
		throw new WorkingChangeSetIncompatibleError(
			'Git automatic line-ending configuration is unsupported.'
		);
	const coreAutoCrlf = (coreAutoCrlfValue === '' ? 'unset' : coreAutoCrlfValue) as
		'false' | 'input' | 'true' | 'unset';
	const gitDirectory = line(
		runObservedGit(session, root, ['rev-parse', '--path-format=absolute', '--git-dir']),
		'Git administration directory'
	);
	const commonDirectory = line(
		runObservedGit(session, root, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
		'Git common directory'
	);
	let checkoutId = relative(commonDirectory, gitDirectory).replaceAll('\\', '/');
	if (checkoutId === '') checkoutId = '.';
	if (checkoutId === '..' || checkoutId.startsWith('../') || checkoutId.startsWith('/'))
		throw new WorkingChangeSetIncompatibleError(
			'Git checkout identity escaped its common administration directory.'
		);
	const pathspec = repositoryPrefix === '' ? [] : [repositoryPrefix];
	assertIndexFlags(session, repositoryRoot, repositoryPrefix, budgets.maxFiles);
	const baseTreeBytes = runObservedGit(session, repositoryRoot, [
		'ls-tree',
		'-r',
		'-z',
		'--full-tree',
		baseRevision,
		'--',
		...pathspec
	]);
	const indexBytes = runObservedGit(session, repositoryRoot, [
		'ls-files',
		'--stage',
		'-z',
		'--full-name',
		'--',
		...pathspec
	]);
	const statusBytes = runObservedGit(session, repositoryRoot, [
		'status',
		'--porcelain=v2',
		'-z',
		'--untracked-files=all',
		'--ignored=no'
	]);
	const baseTree = parseBaseTree(baseTreeBytes, repositoryPrefix, objectFormat, budgets.maxFiles);
	const index = parseIndex(indexBytes, repositoryPrefix, objectFormat, budgets.maxFiles);
	const statusRecords = parseStatus(statusBytes, budgets.maxFiles * 4);
	const baseTreeDigest = sha256(baseTreeBytes);
	const indexDigest = sha256(indexBytes);
	const statusDigest = sha256(statusBytes);
	const observationDigest = sha256(
		canonicalJson({
			baseRevision,
			baseTreeDigest,
			checkoutId,
			coreAutoCrlf,
			fileMode,
			gitVersion: version,
			indexDigest,
			objectFormat,
			repositoryPrefix,
			statusDigest
		})
	);
	const observation: GitWorkingObservation = {
		baseRevision,
		baseTree,
		baseTreeDigest,
		checkoutId,
		coreAutoCrlf,
		fileMode,
		gitVersion: version,
		index,
		indexDigest,
		objectFormat,
		observationDigest,
		repositoryPrefix,
		repositoryRoot: resolve(repositoryRoot),
		statusDigest,
		statusRecords,
		subjectRoot: root
	};
	observationBudgetSessions.set(observation, session);
	return observation;
}

export function readObservedGitBlob(observation: GitWorkingObservation, oid: string): Uint8Array {
	if (!oidPattern(observation.objectFormat).test(oid))
		throw new Error('Git blob identity is invalid.');
	const session = observationBudgetSessions.get(observation);
	if (session === undefined) throw new Error('Git observation budget capability is unavailable.');
	return runObservedGit(session, observation.subjectRoot, ['cat-file', 'blob', oid]);
}

const RAW_BYTE_ATTRIBUTES = ['text', 'eol', 'ident', 'filter', 'working-tree-encoding'] as const;

export function observeRawByteComparisonPolicy(
	observation: GitWorkingObservation,
	subjectPaths: readonly string[]
): FrozenWorkingChangeSet['git']['rawByteComparison'] {
	if (observation.coreAutoCrlf === 'true')
		throw new WorkingChangeSetIncompatibleError(
			'core.autocrlf=true is unsupported because raw working bytes can differ from Git blobs.'
		);
	const session = observationBudgetSessions.get(observation);
	if (session === undefined) throw new Error('Git observation budget capability is unavailable.');
	const paths = [...subjectPaths].sort(compareText);
	for (let index = 1; index < paths.length; index += 1)
		if (paths[index - 1] === paths[index])
			throw new WorkingChangeSetIncompatibleError(
				'Raw-byte attribute population contains duplicate subject paths.'
			);
	const repositoryPaths = paths.map((path) =>
		observation.repositoryPrefix === '' ? path : `${observation.repositoryPrefix}/${path}`
	);
	const input = Buffer.from(repositoryPaths.length === 0 ? '' : `${repositoryPaths.join('\0')}\0`);
	const output =
		repositoryPaths.length === 0
			? Buffer.alloc(0)
			: runObservedGit(
					session,
					observation.repositoryRoot,
					['check-attr', '-z', '--stdin', ...RAW_BYTE_ATTRIBUTES],
					{ input }
				);
	const records = nulRecords(output, 'Git attribute output');
	const expectedRecordCount = repositoryPaths.length * RAW_BYTE_ATTRIBUTES.length * 3;
	if (records.length !== expectedRecordCount)
		throw new Error('Git attribute output population does not reconcile.');
	const manifest: { readonly attribute: string; readonly path: string; readonly value: string }[] =
		[];
	let offset = 0;
	for (let pathIndex = 0; pathIndex < repositoryPaths.length; pathIndex += 1) {
		for (const attribute of RAW_BYTE_ATTRIBUTES) {
			const observedPath = records[offset++]!;
			const observedAttribute = records[offset++]!;
			const value = records[offset++]!;
			if (observedPath !== repositoryPaths[pathIndex] || observedAttribute !== attribute)
				throw new Error('Git attribute output order or identity is malformed.');
			manifest.push({ attribute, path: paths[pathIndex]!, value });
			if (value !== 'unspecified' && value !== 'unset')
				throw new WorkingChangeSetIncompatibleError(
					`Git attribute ${attribute} applies a working-tree transformation to a selected path.`
				);
		}
	}
	return {
		attributeManifestDigest: sha256(canonicalJson(manifest)),
		coreAutoCrlf: observation.coreAutoCrlf,
		method: 'git-check-attr-transform-refusal/1.0.0',
		state: 'RAW_WORKTREE_BYTES_COMPARABLE'
	};
}
