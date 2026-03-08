/**
 * Validation Pipeline + Toolchain Detection
 *
 * Detects project toolchains by examining workspace files, runs validation
 * checks for task units, and classifies failure types for the repair engine.
 */

import { spawn } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../types';
import type {
	TaskUnit,
	AcceptanceContract,
	ToolchainDetection,
	ValidationPacket,
	ValidationCheck,
	ValidationRequirement,
} from '../types/maker';
import { ValidationType, FailureType } from '../types/maker';
import { randomUUID } from 'crypto';

const IS_WINDOWS = process.platform === 'win32';

// ==================== TOOLCHAIN DETECTION ====================

interface MarkerFile {
	file: string;
	projectType: string;
	packageManager: (root: string) => string;
	lintCommand: (root: string) => string | null;
	typeCheckCommand: (root: string) => string | null;
	testCommand: (root: string) => string | null;
	buildCommand: (root: string) => string | null;
}

/**
 * Detect toolchains present in the workspace by examining marker files.
 * Walks subdirectories up to 3 levels deep to support polyglot/multi-project repos.
 */
export async function detectToolchains(
	workspaceRoot: string
): Promise<Result<ToolchainDetection[]>> {
	try {
		const detections: ToolchainDetection[] = [];
		const visited = new Set<string>();

		// Walk directories up to 3 levels deep looking for marker files
		const dirsToCheck = collectProjectRoots(workspaceRoot, 3);

		for (const dir of dirsToCheck) {
			const normalizedDir = path.resolve(dir);
			if (visited.has(normalizedDir)) { continue; }
			visited.add(normalizedDir);

			const detection = detectToolchainInDirectory(normalizedDir);
			if (detection) {
				detections.push(detection);
			}
		}

		return { success: true, value: detections };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Toolchain detection failed'),
		};
	}
}

/**
 * Collect potential project root directories by walking up to `maxDepth` levels.
 * A directory is a candidate if it contains a known project marker file.
 */
function collectProjectRoots(root: string, maxDepth: number): string[] {
	const roots: string[] = [root];

	function walk(dir: string, depth: number): void {
		if (depth >= maxDepth) { return; }

		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (!entry.isDirectory()) { continue; }
			// Skip common non-project directories
			if (['node_modules', '.git', 'dist', 'build', 'out', '.next', '__pycache__', 'target', 'vendor'].includes(entry.name)) {
				continue;
			}
			const child = path.join(dir, entry.name);
			if (hasProjectMarker(child)) {
				roots.push(child);
			}
			walk(child, depth + 1);
		}
	}

	walk(root, 0);
	return roots;
}

const PROJECT_MARKERS = [
	'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
	'pom.xml', 'build.gradle', 'build.gradle.kts',
];

function hasProjectMarker(dir: string): boolean {
	return PROJECT_MARKERS.some((m) => fs.existsSync(path.join(dir, m)));
}

/**
 * Detect toolchain for a single directory.
 */
function detectToolchainInDirectory(dir: string): ToolchainDetection | null {
	// Check markers in priority order (first match wins)
	for (const marker of MARKER_DEFINITIONS) {
		if (fs.existsSync(path.join(dir, marker.file))) {
			return {
				detection_id: randomUUID(),
				workspace_root: dir,
				project_type: marker.projectType,
				package_manager: marker.packageManager(dir),
				lint_command: marker.lintCommand(dir),
				type_check_command: marker.typeCheckCommand(dir),
				test_command: marker.testCommand(dir),
				build_command: marker.buildCommand(dir),
				detected_at: new Date().toISOString(),
				confidence: 0.9,
			};
		}
	}
	return null;
}

/**
 * Determine the Node.js package manager by checking lockfiles.
 */
function detectNodePackageManager(dir: string): string {
	if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) { return 'pnpm'; }
	if (fs.existsSync(path.join(dir, 'yarn.lock'))) { return 'yarn'; }
	if (fs.existsSync(path.join(dir, 'bun.lockb')) || fs.existsSync(path.join(dir, 'bun.lock'))) { return 'bun'; }
	return 'npm';
}

/**
 * Read npm scripts from package.json to detect available commands.
 */
function readPackageJsonScripts(dir: string): Record<string, string> {
	try {
		const pkgPath = path.join(dir, 'package.json');
		const content = fs.readFileSync(pkgPath, 'utf-8');
		const pkg = JSON.parse(content);
		return pkg.scripts || {};
	} catch {
		return {};
	}
}

/**
 * Build a "run" command for the detected Node package manager.
 */
function nodeRunCmd(dir: string, script: string): string {
	const pm = detectNodePackageManager(dir);
	return `${pm} run ${script}`;
}

const MARKER_DEFINITIONS: MarkerFile[] = [
	{
		file: 'package.json',
		projectType: 'node',
		packageManager: detectNodePackageManager,
		lintCommand: (dir) => {
			const scripts = readPackageJsonScripts(dir);
			if (scripts.lint) { return nodeRunCmd(dir, 'lint'); }
			return null;
		},
		typeCheckCommand: (dir) => {
			const scripts = readPackageJsonScripts(dir);
			if (scripts['check-types']) { return nodeRunCmd(dir, 'check-types'); }
			// If tsconfig.json exists, assume tsc --noEmit works
			if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
				return 'npx tsc --noEmit';
			}
			return null;
		},
		testCommand: (dir) => {
			const scripts = readPackageJsonScripts(dir);
			if (scripts.test) { return nodeRunCmd(dir, 'test'); }
			return null;
		},
		buildCommand: (dir) => {
			const scripts = readPackageJsonScripts(dir);
			if (scripts.build) { return nodeRunCmd(dir, 'build'); }
			if (scripts.compile) { return nodeRunCmd(dir, 'compile'); }
			return null;
		},
	},
	{
		file: 'pyproject.toml',
		projectType: 'python',
		packageManager: (dir) => {
			if (fs.existsSync(path.join(dir, 'poetry.lock'))) { return 'poetry'; }
			if (fs.existsSync(path.join(dir, 'uv.lock'))) { return 'uv'; }
			return 'pip';
		},
		lintCommand: () => 'ruff check .',
		typeCheckCommand: () => 'mypy .',
		testCommand: () => 'pytest',
		buildCommand: () => null,
	},
	{
		file: 'Cargo.toml',
		projectType: 'rust',
		packageManager: () => 'cargo',
		lintCommand: () => 'cargo clippy -- -D warnings',
		typeCheckCommand: () => 'cargo check',
		testCommand: () => 'cargo test',
		buildCommand: () => 'cargo build',
	},
	{
		file: 'go.mod',
		projectType: 'go',
		packageManager: () => 'go',
		lintCommand: () => 'go vet ./...',
		typeCheckCommand: () => null, // go vet covers this
		testCommand: () => 'go test ./...',
		buildCommand: () => 'go build ./...',
	},
	{
		file: 'pom.xml',
		projectType: 'java',
		packageManager: () => 'maven',
		lintCommand: () => null,
		typeCheckCommand: () => 'mvn compile -q',
		testCommand: () => 'mvn test -q',
		buildCommand: () => 'mvn package -q',
	},
	{
		file: 'build.gradle',
		projectType: 'java',
		packageManager: () => 'gradle',
		lintCommand: () => null,
		typeCheckCommand: () => 'gradle compileJava -q',
		testCommand: () => 'gradle test -q',
		buildCommand: () => 'gradle build -q',
	},
	{
		file: 'build.gradle.kts',
		projectType: 'kotlin',
		packageManager: () => 'gradle',
		lintCommand: () => null,
		typeCheckCommand: () => 'gradle compileKotlin -q',
		testCommand: () => 'gradle test -q',
		buildCommand: () => 'gradle build -q',
	},
];

// ==================== VALIDATION EXECUTION ====================

/**
 * Run a single validation check command and return the result.
 */
export async function runValidationCheck(
	checkType: ValidationType,
	command: string,
	workspaceRoot: string,
	timeout = 120000
): Promise<Result<ValidationCheck>> {
	try {
		const result = await execCommand(command, workspaceRoot, timeout);

		return {
			success: true,
			value: {
				check_type: checkType,
				command,
				exit_code: result.exitCode,
				stdout_excerpt: result.stdout.substring(0, 2000),
				passed: result.exitCode === 0,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(`Validation check failed: ${command}`),
		};
	}
}

/**
 * Run validation checks for a task unit using detected toolchains and
 * the acceptance contract's required validations.
 */
export async function runUnitValidation(
	unit: TaskUnit,
	toolchains: ToolchainDetection[],
	contract: AcceptanceContract | null,
	workspaceRoot: string
): Promise<Result<ValidationPacket>> {
	try {
		// Determine the effective root for scoped validation
		const effectiveRoot = resolveEffectiveRoot(unit.max_change_scope, workspaceRoot);

		// Find applicable toolchain for this scope
		const toolchain = findApplicableToolchain(effectiveRoot, toolchains);

		// Build the list of checks to run
		const checksToRun = buildValidationChecks(toolchain, contract);

		// Run all checks
		const checks: ValidationCheck[] = [];
		for (const req of checksToRun) {
			if (!req.command) { continue; }
			const result = await runValidationCheck(
				req.type,
				req.command,
				effectiveRoot,
				120000
			);
			if (result.success) {
				checks.push(result.value);
			}
		}

		const allPassed = checks.length > 0 && checks.every((c) => c.passed);
		const failedChecks = checks.filter((c) => !c.passed);
		const failureType = failedChecks.length > 0 ? classifyFailureType(failedChecks) : null;

		const packet: ValidationPacket = {
			validation_id: randomUUID(),
			unit_id: unit.unit_id,
			checks,
			expected_observables: unit.observables,
			actual_observables: checks.filter((c) => c.passed).map((c) => `${c.check_type}: PASS`),
			pass_fail: allPassed ? 'PASS' : 'FAIL',
			failure_type: failureType,
			created_at: new Date().toISOString(),
		};

		return { success: true, value: packet };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Unit validation failed'),
		};
	}
}

/**
 * Resolve the effective root directory for scoped validation.
 * If max_change_scope is a relative path within workspaceRoot, use it.
 */
function resolveEffectiveRoot(maxChangeScope: string, workspaceRoot: string): string {
	if (!maxChangeScope || maxChangeScope === '.' || maxChangeScope === '/') {
		return workspaceRoot;
	}

	const candidate = path.isAbsolute(maxChangeScope)
		? maxChangeScope
		: path.join(workspaceRoot, maxChangeScope);

	// Only use the scoped root if it exists and is inside the workspace
	if (fs.existsSync(candidate) && candidate.startsWith(workspaceRoot)) {
		return candidate;
	}

	return workspaceRoot;
}

/**
 * Find the most specific toolchain that covers the effective root.
 */
function findApplicableToolchain(
	effectiveRoot: string,
	toolchains: ToolchainDetection[]
): ToolchainDetection | null {
	// Sort by specificity (deepest path first)
	const sorted = [...toolchains].sort(
		(a, b) => b.workspace_root.length - a.workspace_root.length
	);

	for (const tc of sorted) {
		if (effectiveRoot.startsWith(tc.workspace_root) || tc.workspace_root.startsWith(effectiveRoot)) {
			return tc;
		}
	}

	return toolchains[0] ?? null;
}

/**
 * Build the list of validation checks from toolchain detection + acceptance contract.
 */
function buildValidationChecks(
	toolchain: ToolchainDetection | null,
	contract: AcceptanceContract | null
): ValidationRequirement[] {
	const checks: ValidationRequirement[] = [];

	// From detected toolchain
	if (toolchain) {
		if (toolchain.lint_command) {
			checks.push({ type: ValidationType.LINT, command: toolchain.lint_command, description: 'Lint check' });
		}
		if (toolchain.type_check_command) {
			checks.push({ type: ValidationType.TYPE_CHECK, command: toolchain.type_check_command, description: 'Type check' });
		}
		if (toolchain.test_command) {
			checks.push({ type: ValidationType.UNIT_TEST, command: toolchain.test_command, description: 'Test suite' });
		}
	}

	// From acceptance contract (may add custom checks or override)
	if (contract) {
		for (const req of contract.required_validations) {
			// Skip duplicates already covered by toolchain
			const alreadyCovered = checks.some((c) => c.type === req.type);
			if (!alreadyCovered && req.command) {
				checks.push(req);
			}
		}
	}

	return checks;
}

// ==================== FAILURE CLASSIFICATION ====================

/**
 * Classify the primary failure type from failed validation checks.
 * Examines check types and stdout patterns to determine the most specific failure class.
 */
export function classifyFailureType(failedChecks: ValidationCheck[]): FailureType {
	if (failedChecks.length === 0) { return FailureType.UNKNOWN; }

	// Priority-ordered classification rules
	for (const check of failedChecks) {
		const out = check.stdout_excerpt.toLowerCase();

		// Check for security-related failures
		if (containsAny(out, ['security', 'vulnerability', 'cve', 'audit'])) {
			return FailureType.SECURITY_BOUNDARY;
		}

		// Check for migration/data risks
		if (containsAny(out, ['migration', 'data loss', 'destructive'])) {
			return FailureType.DATA_MIGRATION_RISK;
		}

		// Classify by check type
		switch (check.check_type) {
			case ValidationType.LINT:
				if (containsAny(out, ['format', 'prettier', 'indent', 'whitespace'])) {
					return FailureType.FORMAT_ERROR;
				}
				if (containsAny(out, ['import', 'require', 'module not found', 'cannot find module'])) {
					return FailureType.IMPORT_RESOLUTION;
				}
				return FailureType.LINT_ERROR;

			case ValidationType.TYPE_CHECK:
				if (containsAny(out, ['cannot find name', 'cannot find module', 'has no exported member'])) {
					return FailureType.IMPORT_RESOLUTION;
				}
				return FailureType.LOCAL_TYPE_ERROR;

			case ValidationType.UNIT_TEST:
				if (containsAny(out, ['expected', 'tobequal', 'tobe(', 'assert', 'snapshot'])) {
					return FailureType.DETERMINISTIC_TEST_UPDATE;
				}
				if (containsAny(out, ['timeout', 'flaky', 'intermittent'])) {
					return FailureType.FLAKY_TEST;
				}
				return FailureType.RUNTIME_ERROR;

			case ValidationType.BUILD:
				if (containsAny(out, ['generated', 'stale', 'out of date', 'regenerate'])) {
					return FailureType.GENERATED_ARTIFACT_STALE;
				}
				return FailureType.LOCAL_TYPE_ERROR;

			default:
				break;
		}
	}

	return FailureType.UNKNOWN;
}

function containsAny(text: string, patterns: string[]): boolean {
	return patterns.some((p) => text.includes(p));
}

// ==================== COMMAND EXECUTION ====================

/**
 * Execute a shell command and return stdout/stderr/exitCode.
 * Uses shell mode on Windows for .cmd/.bat compatibility.
 */
function execCommand(
	command: string,
	cwd: string,
	timeout: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, [], {
			cwd,
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout,
			...(IS_WINDOWS ? {} : {}),
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		proc.stdout!.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		proc.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		proc.on('close', (code) => {
			resolve({
				stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
				stderr: Buffer.concat(stderrChunks).toString('utf-8'),
				exitCode: code ?? 1,
			});
		});

		proc.on('error', (err) => reject(err));
	});
}
