import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	detectToolchains,
	runValidationCheck,
	runUnitValidation,
	classifyFailureType,
} from '../../../lib/workflow/validationPipeline';
import { ValidationType, FailureType, TaskCategory, TaskUnitStatus } from '../../../lib/types/maker';
import type { TaskUnit, ValidationCheck, AcceptanceContract, ToolchainDetection } from '../../../lib/types/maker';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'node:os';

describe('ValidationPipeline', () => {
	let tempWorkspace: string;
	let taskUnit: TaskUnit;

	beforeEach(() => {
		initTestLogger();
		tempWorkspace = fs.mkdtempSync(path.join(tmpdir(), 'validation-test-'));

		taskUnit = {
			unit_id: randomUUID(),
			graph_id: randomUUID(),
			label: 'Test Unit',
			goal: 'Test goal',
			category: TaskCategory.IMPLEMENTATION,
			inputs: [],
			outputs: ['output.ts'],
			preconditions: [],
			postconditions: ['Code compiles'],
			allowed_tools: ['file_write'],
			preferred_provider: null,
			max_change_scope: '.',
			observables: ['File exists'],
			falsifiers: ['Compilation fails'],
			verification_method: 'tsc --noEmit',
			status: TaskUnitStatus.PENDING,
			parent_unit_id: null,
			sort_order: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
	});

	afterEach(() => {
		if (fs.existsSync(tempWorkspace)) {
			fs.rmSync(tempWorkspace, { recursive: true, force: true });
		}
		teardownTestLogger();
	});

	describe('detectToolchains', () => {
		it('detects Node.js project with package.json', async () => {
			const pkgPath = path.join(tempWorkspace, 'package.json');
			fs.writeFileSync(pkgPath, JSON.stringify({
				name: 'test-project',
				scripts: {
					lint: 'eslint .',
					test: 'vitest',
					build: 'tsc',
				},
			}));

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
				expect(result.value[0].project_type).toBe('node');
				expect(result.value[0].lint_command).toBeTruthy();
			}
		});

		it('detects Python project with pyproject.toml', async () => {
			const pyPath = path.join(tempWorkspace, 'pyproject.toml');
			fs.writeFileSync(pyPath, '[tool.poetry]\nname = "test"');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
				const pythonTC = result.value.find(tc => tc.project_type === 'python');
				expect(pythonTC).toBeDefined();
			}
		});

		it('detects Rust project with Cargo.toml', async () => {
			const cargoPath = path.join(tempWorkspace, 'Cargo.toml');
			fs.writeFileSync(cargoPath, '[package]\nname = "test"');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
				const rustTC = result.value.find(tc => tc.project_type === 'rust');
				expect(rustTC).toBeDefined();
			}
		});

		it('detects Go project with go.mod', async () => {
			const goPath = path.join(tempWorkspace, 'go.mod');
			fs.writeFileSync(goPath, 'module test\ngo 1.21');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
				const goTC = result.value.find(tc => tc.project_type === 'go');
				expect(goTC).toBeDefined();
			}
		});

		it('returns empty array for workspace without projects', async () => {
			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('detects multiple projects in subdirectories', async () => {
			const nodeDir = path.join(tempWorkspace, 'frontend');
			const pythonDir = path.join(tempWorkspace, 'backend');
			fs.mkdirSync(nodeDir);
			fs.mkdirSync(pythonDir);

			fs.writeFileSync(path.join(nodeDir, 'package.json'), JSON.stringify({ name: 'frontend' }));
			fs.writeFileSync(path.join(pythonDir, 'pyproject.toml'), '[tool.poetry]\nname = "backend"');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThanOrEqual(2);
			}
		});

		it('skips common non-project directories', async () => {
			const nodeModules = path.join(tempWorkspace, 'node_modules');
			fs.mkdirSync(nodeModules);
			fs.writeFileSync(path.join(nodeModules, 'package.json'), '{}');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('detects npm as default package manager', async () => {
			fs.writeFileSync(path.join(tempWorkspace, 'package.json'), JSON.stringify({ name: 'test' }));

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].package_manager).toBe('npm');
			}
		});

		it('detects pnpm from lockfile', async () => {
			fs.writeFileSync(path.join(tempWorkspace, 'package.json'), JSON.stringify({ name: 'test' }));
			fs.writeFileSync(path.join(tempWorkspace, 'pnpm-lock.yaml'), '');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].package_manager).toBe('pnpm');
			}
		});

		it('detects yarn from lockfile', async () => {
			fs.writeFileSync(path.join(tempWorkspace, 'package.json'), JSON.stringify({ name: 'test' }));
			fs.writeFileSync(path.join(tempWorkspace, 'yarn.lock'), '');

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].package_manager).toBe('yarn');
			}
		});

		it('detects TypeScript project with tsconfig.json', async () => {
			fs.writeFileSync(path.join(tempWorkspace, 'package.json'), JSON.stringify({ name: 'test' }));
			fs.writeFileSync(path.join(tempWorkspace, 'tsconfig.json'), JSON.stringify({}));

			const result = await detectToolchains(tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].type_check_command).toBeTruthy();
			}
		});
	});

	describe('runValidationCheck', () => {
		it('runs successful validation check', async () => {
			const result = await runValidationCheck(
				ValidationType.LINT,
				'echo "success"',
				tempWorkspace,
				5000
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.check_type).toBe(ValidationType.LINT);
				expect(result.value.exit_code).toBe(0);
				expect(result.value.passed).toBe(true);
			}
		});

		it('captures failure exit code', async () => {
			const result = await runValidationCheck(
				ValidationType.LINT,
				'exit 1',
				tempWorkspace,
				5000
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.exit_code).toBe(1);
				expect(result.value.passed).toBe(false);
			}
		});

		it('captures stdout excerpt', async () => {
			const result = await runValidationCheck(
				ValidationType.LINT,
				'echo "test output"',
				tempWorkspace,
				5000
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.stdout_excerpt).toContain('test output');
			}
		});

		it('truncates long output', async () => {
			const longOutput = 'x'.repeat(3000);
			const result = await runValidationCheck(
				ValidationType.LINT,
				`echo "${longOutput}"`,
				tempWorkspace,
				5000
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.stdout_excerpt.length).toBeLessThanOrEqual(2000);
			}
		});
	});

	describe('classifyFailureType', () => {
		it('classifies lint errors', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.LINT,
					command: 'eslint',
					exit_code: 1,
					stdout_excerpt: 'Missing semicolon at line 10',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.LINT_ERROR);
		});

		it('classifies format errors', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.LINT,
					command: 'prettier',
					exit_code: 1,
					stdout_excerpt: 'Format error: incorrect indentation',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.FORMAT_ERROR);
		});

		it('classifies import resolution errors', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.TYPE_CHECK,
					command: 'tsc',
					exit_code: 1,
					stdout_excerpt: 'Cannot find module "./utils"',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.IMPORT_RESOLUTION);
		});

		it('classifies local type errors', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.TYPE_CHECK,
					command: 'tsc',
					exit_code: 1,
					stdout_excerpt: 'Type string is not assignable to number',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.LOCAL_TYPE_ERROR);
		});

		it('classifies test failures', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.UNIT_TEST,
					command: 'vitest',
					exit_code: 1,
					stdout_excerpt: 'Expected 5 to equal 3',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.DETERMINISTIC_TEST_UPDATE);
		});

		it('classifies flaky test failures', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.UNIT_TEST,
					command: 'vitest',
					exit_code: 1,
					stdout_excerpt: 'Test timeout after 5000ms',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.FLAKY_TEST);
		});

		it('classifies security boundary violations', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.LINT,
					command: 'eslint',
					exit_code: 1,
					stdout_excerpt: 'Security vulnerability detected: SQL injection',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.SECURITY_BOUNDARY);
		});

		it('classifies data migration risks', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.BUILD,
					command: 'build',
					exit_code: 1,
					stdout_excerpt: 'Warning: destructive migration detected',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.DATA_MIGRATION_RISK);
		});

		it('classifies stale artifacts', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.BUILD,
					command: 'build',
					exit_code: 1,
					stdout_excerpt: 'Generated files are out of date, run codegen',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.GENERATED_ARTIFACT_STALE);
		});

		it('returns UNKNOWN for empty checks', () => {
			const result = classifyFailureType([]);
			expect(result).toBe(FailureType.UNKNOWN);
		});

		it('prioritizes security issues', () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.LINT,
					command: 'eslint',
					exit_code: 1,
					stdout_excerpt: 'Missing semicolon',
					passed: false,
				},
				{
					check_type: ValidationType.LINT,
					command: 'security-audit',
					exit_code: 1,
					stdout_excerpt: 'CVE-2024-1234 vulnerability found',
					passed: false,
				},
			];

			const result = classifyFailureType(checks);
			expect(result).toBe(FailureType.SECURITY_BOUNDARY);
		});
	});

	describe('runUnitValidation', () => {
		it('validates unit with detected toolchain', async () => {
			fs.writeFileSync(path.join(tempWorkspace, 'package.json'), JSON.stringify({
				name: 'test',
				scripts: { test: 'echo "tests pass"' },
			}));

			const toolchains: ToolchainDetection[] = [
				{
					detection_id: randomUUID(),
					workspace_root: tempWorkspace,
					project_type: 'node',
					package_manager: 'npm',
					lint_command: 'echo "lint pass"',
					type_check_command: 'echo "types pass"',
					test_command: 'npm run test',
					build_command: null,
					detected_at: new Date().toISOString(),
					confidence: 0.9,
				},
			];

			const result = await runUnitValidation(taskUnit, toolchains, null, tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.unit_id).toBe(taskUnit.unit_id);
				expect(result.value.checks.length).toBeGreaterThan(0);
			}
		});

		it('includes acceptance contract validations', async () => {
			const contract: AcceptanceContract = {
				contract_id: randomUUID(),
				dialogue_id: randomUUID(),
				intent_id: randomUUID(),
				success_conditions: ['Tests pass'],
				required_validations: [
					{
						type: ValidationType.INTEGRATION_TEST,
						description: 'Integration tests',
						command: 'echo "integration pass"',
						expected_exit_code: 0,
					},
				],
				non_goals: [],
				human_judgment_required: [],
				created_at: new Date().toISOString(),
			};

			const result = await runUnitValidation(taskUnit, [], contract, tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.checks.some(c => c.check_type === ValidationType.INTEGRATION_TEST)).toBe(true);
			}
		});

		it('handles no toolchains gracefully', async () => {
			const result = await runUnitValidation(taskUnit, [], null, tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.checks).toEqual([]);
			}
		});

		it('marks as PASS when all checks succeed', async () => {
			const toolchains: ToolchainDetection[] = [
				{
					detection_id: randomUUID(),
					workspace_root: tempWorkspace,
					project_type: 'node',
					package_manager: 'npm',
					lint_command: 'echo "pass"',
					type_check_command: null,
					test_command: null,
					build_command: null,
					detected_at: new Date().toISOString(),
					confidence: 0.9,
				},
			];

			const result = await runUnitValidation(taskUnit, toolchains, null, tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.pass_fail).toBe('PASS');
			}
		});

		it('marks as FAIL when any check fails', async () => {
			const toolchains: ToolchainDetection[] = [
				{
					detection_id: randomUUID(),
					workspace_root: tempWorkspace,
					project_type: 'node',
					package_manager: 'npm',
					lint_command: 'exit 1',
					type_check_command: null,
					test_command: null,
					build_command: null,
					detected_at: new Date().toISOString(),
					confidence: 0.9,
				},
			];

			const result = await runUnitValidation(taskUnit, toolchains, null, tempWorkspace);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.pass_fail).toBe('FAIL');
				expect(result.value.failure_type).toBeDefined();
			}
		});
	});

	describe('integration scenarios', () => {
		it('manages complete validation workflow', async () => {
			fs.writeFileSync(path.join(tempWorkspace, 'package.json'), JSON.stringify({
				name: 'test',
				scripts: {
					lint: 'echo "lint ok"',
					test: 'echo "tests ok"',
				},
			}));

			const detectResult = await detectToolchains(tempWorkspace);
			expect(detectResult.success).toBe(true);

			if (detectResult.success) {
				const validationResult = await runUnitValidation(
					taskUnit,
					detectResult.value,
					null,
					tempWorkspace
				);
				expect(validationResult.success).toBe(true);
			}
		});

		it('classifies failures for repair engine', async () => {
			const checks: ValidationCheck[] = [
				{
					check_type: ValidationType.LINT,
					command: 'eslint',
					exit_code: 1,
					stdout_excerpt: 'Missing semicolon',
					passed: false,
				},
			];

			const failureType = classifyFailureType(checks);
			expect(failureType).toBe(FailureType.LINT_ERROR);
		});
	});
});
