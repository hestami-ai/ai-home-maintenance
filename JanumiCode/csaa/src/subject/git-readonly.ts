import { spawnSync } from 'node:child_process';
import { accessSync, constants, lstatSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, sep } from 'node:path';

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface GitCommandOptions {
	readonly allowExitCodes?: readonly number[];
	readonly input?: Uint8Array;
	readonly maxOutputBytes?: number;
	readonly timeoutMs?: number;
}

function insidePhysicalRoot(root: string, candidate: string): boolean {
	const fromRoot = relative(root, candidate);
	return (
		fromRoot === '' ||
		(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
	);
}

function lexicalGitBoundary(cwd: string): string | null {
	let candidate = realpathSync.native(cwd);
	while (true) {
		try {
			lstatSync(join(candidate, '.git'));
			return candidate;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTDIR')
				throw new Error('Git worktree marker could not be safely inspected.');
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

function resolveGitExecutable(cwd: string): string {
	const physicalCwd = realpathSync.native(cwd);
	const boundary = lexicalGitBoundary(physicalCwd);
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
		if (insidePhysicalRoot(physicalCwd, directory)) continue;
		if (boundary !== null && insidePhysicalRoot(boundary, directory)) continue;
		const candidate = join(directory, process.platform === 'win32' ? 'git.exe' : 'git');
		try {
			const executable = realpathSync.native(candidate);
			if (!statSync(executable).isFile()) continue;
			accessSync(executable, constants.X_OK);
			if (insidePhysicalRoot(physicalCwd, executable)) continue;
			if (boundary !== null && insidePhysicalRoot(boundary, executable)) continue;
			return executable;
		} catch {
			// The PATH entry does not contain a directly executable native Git binary.
		}
	}
	throw new Error('No safe absolute Git executable could be resolved from PATH.');
}

function gitEnvironment(safePath: string): NodeJS.ProcessEnv {
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
		GCM_INTERACTIVE: 'Never',
		GIT_ATTR_NOSYSTEM: '1',
		GIT_CONFIG_GLOBAL: nullDevice,
		GIT_CONFIG_NOSYSTEM: '1',
		GIT_LFS_SKIP_SMUDGE: '1',
		GIT_LITERAL_PATHSPECS: '1',
		GIT_NO_LAZY_FETCH: '1',
		GIT_NO_REPLACE_OBJECTS: '1',
		GIT_OPTIONAL_LOCKS: '0',
		GIT_PAGER: 'cat',
		GIT_PROTOCOL_FROM_USER: '0',
		GIT_TERMINAL_PROMPT: '0',
		LANG: 'C',
		LC_ALL: 'C',
		NO_COLOR: '1',
		PAGER: 'cat',
		PATH: safePath
	};
}

export function runGitReadOnly(
	cwd: string,
	args: readonly string[],
	options: GitCommandOptions = {}
): Buffer {
	const allowExitCodes = options.allowExitCodes ?? [0];
	const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
	const executable = resolveGitExecutable(cwd);
	const result = spawnSync(
		executable,
		[
			'--no-optional-locks',
			'-c',
			'core.fsmonitor=false',
			'-c',
			'submodule.recurse=false',
			'-C',
			cwd,
			...args
		],
		{
			cwd: dirname(executable),
			encoding: null,
			env: gitEnvironment(dirname(executable)),
			input: options.input,
			maxBuffer: maxOutputBytes,
			shell: false,
			timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			windowsHide: true
		}
	);
	if (result.error !== undefined)
		throw new Error(`Git observation failed: ${result.error.message}`);
	const status = result.status ?? -1;
	if (!allowExitCodes.includes(status))
		throw new Error(`Git observation command failed with exit code ${status}.`);
	const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? '');
	const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? '');
	if (stdout.byteLength > maxOutputBytes || stderr.byteLength > maxOutputBytes)
		throw new Error('Git observation command exceeded its output budget.');
	return stdout;
}
