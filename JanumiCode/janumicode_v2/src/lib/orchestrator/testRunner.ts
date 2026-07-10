/**
 * TestRunner - executes Vitest test suites for Phase 9.2.
 * Based on JanumiCode Spec v2.3, §4 Phase 9.2.
 *
 * Runs test suites in dependency order (unit -> integration -> e2e),
 * captures results, and records them in the Governed Stream.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Database } from '../database/init';
import { GovernedStreamWriter } from './governedStreamWriter';
import { EventBus } from '../events/eventBus';
import { getLogger } from '../logging';
import { emit as aoddEmit } from '../aodd';

// Types

export interface TestSuite {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'end_to_end';
  testFilePaths: string[];
  /** IDs of implementation tasks this suite validates */
  validatesTaskIds: string[];
  /** IDs of acceptance criteria this suite covers */
  coversCriteriaIds: string[];
}

export interface TestCaseResult {
  id: string;
  suiteId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface SuiteResult {
  suiteId: string;
  suiteName: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: TestCaseResult[];
}

export interface TestRunResult {
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  suiteResults: SuiteResult[];
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface TestRunnerConfig {
  vitestPath: string;
  timeoutSeconds: number;
  coverageEnabled: boolean;
  parallelSuites: boolean;
}

// Default config
const DEFAULT_CONFIG: TestRunnerConfig = {
  vitestPath: 'npx vitest run',
  timeoutSeconds: 300,
  coverageEnabled: false,
  parallelSuites: false,
};

// Structured Vitest/Jest JSON report shapes (subset consumed here).
interface VitestAssertionResult {
  status?: string;
  fullName?: string;
  title?: string;
  duration?: number;
  failureMessages?: string[];
}

interface VitestFileResult {
  assertionResults?: VitestAssertionResult[];
}

// Uniform parsed shape returned by the output parser and its branches.
interface ParsedVitestOutput {
  passed: number;
  failed: number;
  skipped: number;
  testCases: TestCaseResult[];
}

// TestRunner class

export class TestRunner {
  constructor(
    private readonly db: Database,
    private readonly writer: GovernedStreamWriter,
    private readonly eventBus: EventBus,
    private readonly generateId: () => string,
    private readonly config: TestRunnerConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * Run test suites in dependency order.
   */
  async runSuites(
    suites: TestSuite[],
    cwd: string,
    workflowRunId: string,
    janumiCodeVersionSha: string,
  ): Promise<TestRunResult> {
    const startTime = Date.now();
    const suiteResults: SuiteResult[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Sort suites by type order: unit -> integration -> e2e
    const orderedSuites = this.orderSuitesByType(suites);

    // Emit test run started event
    this.eventBus.emit('test:run_started', {
      workflowRunId,
      suiteCount: orderedSuites.length,
    });
    aoddEmit('test.run_started', { suite_count: orderedSuites.length });

    for (const suite of orderedSuites) {
      getLogger().info('workflow', 'Running test suite', {
        suiteId: suite.id,
        suiteName: suite.name,
        type: suite.type,
      });

      const result = await this.runSuite(suite, cwd);
      suiteResults.push(result);

      totalPassed += result.passed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;

      // Record suite result
      this.recordSuiteResult(
        result,
        workflowRunId,
        janumiCodeVersionSha,
      );

      // Emit real-time event
      this.eventBus.emit('test:suite_completed', {
        workflowRunId,
        suiteId: suite.id,
        suiteName: suite.name,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
      });
      aoddEmit('test.suite_completed', {
        suite_id: suite.id,
        suite_name: suite.name,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
      });

      // Stop on first failure if configured
      if (result.failed > 0 && !this.config.parallelSuites) {
        getLogger().warn('workflow', 'Test suite failed, stopping', {
          suiteId: suite.id,
          failedCount: result.failed,
        });
        break;
      }
    }

    const durationMs = Date.now() - startTime;
    const success = totalFailed === 0;

    this.eventBus.emit('test:run_completed', {
      workflowRunId,
      totalPassed,
      totalFailed,
      totalSkipped,
      durationMs,
      success,
    });
    aoddEmit('test.run_completed', {
      total_passed: totalPassed,
      total_failed: totalFailed,
      total_skipped: totalSkipped,
      duration_ms: durationMs,
      success,
    });

    return {
      totalPassed,
      totalFailed,
      totalSkipped,
      suiteResults,
      durationMs,
      success,
    };
  }

  /**
   * Run a single test suite via Vitest.
   */
  private async runSuite(suite: TestSuite, cwd: string): Promise<SuiteResult> {
    const startTime = Date.now();
    const testCases: TestCaseResult[] = [];

    try {
      const vitestOutput = await this.invokeVitest(suite, cwd);
      const parsed = this.parseVitestOutput(vitestOutput, suite.id);

      return {
        suiteId: suite.id,
        suiteName: suite.name,
        passed: parsed.passed,
        failed: parsed.failed,
        skipped: parsed.skipped,
        durationMs: Date.now() - startTime,
        testCases: parsed.testCases,
      };
    } catch (err) {
      getLogger().error('workflow', 'Test suite invocation failed', {
        suiteId: suite.id,
        error: err instanceof Error ? err.message : String(err),
      });

      return {
        suiteId: suite.id,
        suiteName: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: Date.now() - startTime,
        testCases: [{
          id: this.generateId(),
          suiteId: suite.id,
          name: 'Suite Invocation',
          status: 'failed',
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        }],
      };
    }
  }

  /**
   * Invoke a test framework for a suite.
   *
   * Resolution order for the test command:
   *   1. `package.json scripts.test` — whatever the workspace declared.
   *      Run via `npm test` so the script's own assumptions hold.
   *   2. Vitest (legacy default for JanumiCode's own internal suites).
   *
   * Earlier code hardcoded `npx vitest run` regardless of the
   * workspace contents. cal-22b's Phase 9 executor wrote a Node.js
   * project with `node:test`, the runner tried to invoke vitest
   * against the test files, vitest wasn't installed in that
   * workspace, the spawn failed, and the suite was reported as
   * failed-with-error rather than running the actual tests. Detecting
   * the workspace's declared test command makes the runner agnostic
   * to whether Phase 9 generated a vitest / node:test / pytest /
   * jest project.
   *
   * Returning the parsed shape uniformly is left to the framework
   * detector — the parser walks well-known JSON shapes (vitest /
   * jest) when present, and falls back to a coarse regex over plain
   * text output otherwise.
   */
  private invokeVitest(suite: TestSuite, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutMs = this.config.timeoutSeconds * 1000;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const cmd = this.resolveTestCommand(cwd, suite);
      const child: ChildProcess = spawn(cmd.command, cmd.args, {
        cwd,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...cmd.env },
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new Error(`Test suite timed out after ${this.config.timeoutSeconds}s`));
        } else if (code !== 0 && code !== 1) {
          // Vitest exits 0 for pass, 1 for test failures, >1 for errors
          reject(new Error(`Vitest exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Pick the test command based on what the workspace actually
   * declares. Falls back to vitest for backward compat when no
   * package.json or no `scripts.test` is present.
   *
   * Wave R will replace this whole layer with per-leaf test execution
   * inside the executor loop. This method is the minimal interim fix
   * to stop hardcoding `vitest` against workspaces that use
   * `node:test`, jest, mocha, pytest, etc.
   */
  private resolveTestCommand(cwd: string, suite: TestSuite): {
    command: string; args: string[]; env: Record<string, string>;
  } {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
        if (pkg.scripts?.test) {
          // Use the workspace's declared `test` script. We don't pass
          // testFilePaths here — `npm test` runs whatever the script
          // says to run, which is what calibration wants when the
          // executor authored both the tests and the script.
          return { command: 'npm', args: ['test', '--silent'], env: {} };
        }
      } catch {
        // Malformed package.json — fall through to vitest default.
      }
    }
    // Backward-compat default: vitest with the suite's declared file
    // paths. Used by JanumiCode's own internal test infrastructure.
    return {
      command: 'npx',
      args: ['vitest', 'run', '--reporter=json', '--reporter=default', ...suite.testFilePaths],
      env: {},
    };
  }

  /**
   * Parse test-runner output into counts + per-case results.
   *
   * Prefers the structured Vitest/Jest JSON report; when that yields no
   * test cases (absent / unparseable / empty), falls back to scraping
   * the plain-text summary.
   */
  private parseVitestOutput(output: string, suiteId: string): ParsedVitestOutput {
    const fromJson = this.parseVitestJson(output, suiteId);
    if (fromJson && fromJson.testCases.length > 0) {
      return fromJson;
    }
    return this.parseVitestTextFallback(output, suiteId);
  }

  /**
   * Extract the JSON blob Vitest/Jest emit after the default reporter.
   *
   * Linear scan for the first '{' .. last '}' span that contains
   * "testResults"; byte-identical to /\{[\s\S]*"testResults"[\s\S]*\}/
   * but without its super-linear backtracking on inputs that lack a
   * closing brace. Returns null when no such span exists.
   */
  private extractTestResultsJson(output: string): string | null {
    const firstBrace = output.indexOf('{');
    const lastBrace = output.lastIndexOf('}');
    const jsonCandidate =
      firstBrace !== -1 && lastBrace > firstBrace ? output.slice(firstBrace, lastBrace + 1) : null;
    return jsonCandidate?.includes('"testResults"') ? jsonCandidate : null;
  }

  /**
   * Parse the structured Vitest/Jest JSON report. Returns null when no
   * JSON blob is present, it fails to parse, or it carries no
   * `testResults`, so the caller can fall back to text parsing.
   */
  private parseVitestJson(output: string, suiteId: string): ParsedVitestOutput | null {
    const candidate = this.extractTestResultsJson(output);
    if (!candidate) return null;

    // Wrap the ENTIRE parse+iteration in one try/catch (as the original did): any
    // error — JSON.parse failure OR a malformed-but-parseable report (non-iterable
    // testResults, null file/assertion entries) — degrades gracefully to text
    // parsing rather than throwing out to runSuite's catch (which would report a
    // bogus failed=1 'Suite Invocation' and discard the real text-summary counts).
    try {
      const json: { testResults?: VitestFileResult[] } = JSON.parse(candidate);
      if (!json.testResults) return null;

      const testCases: TestCaseResult[] = [];
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      for (const fileResult of json.testResults) {
        for (const test of fileResult.assertionResults ?? []) {
          const testCase = this.buildTestCaseFromAssertion(test, suiteId);
          testCases.push(testCase);

          if (testCase.status === 'passed') passed++;
          else if (testCase.status === 'failed') failed++;
          else skipped++;
        }
      }

      return { passed, failed, skipped, testCases };
    } catch {
      // Malformed JSON report — caller falls back to text parsing.
      return null;
    }
  }

  /**
   * Build a single TestCaseResult from a Vitest/Jest assertion record.
   * error/stack carry the joined failure messages only for failures.
   */
  private buildTestCaseFromAssertion(test: VitestAssertionResult, suiteId: string): TestCaseResult {
    const status = this.mapVitestStatus(test.status as string);
    const failureText = status === 'failed' ? test.failureMessages?.join('\n') : undefined;
    return {
      id: this.generateId(),
      suiteId,
      name: (test.fullName ?? test.title) as string,
      status,
      durationMs: test.duration ?? 0,
      error: failureText,
      stack: failureText,
    };
  }

  /**
   * Fallback: parse plain-text summary output. Handles three common
   * shapes — vitest's "N passed / N failed / N skipped", node:test's
   * "ℹ pass N / ℹ fail N / ℹ skipped N", and pytest's
   * "N passed, M failed in...". Whichever matches first wins.
   * Synthesizes test cases from the passed + failed counts only.
   */
  private parseVitestTextFallback(output: string, suiteId: string): ParsedVitestOutput {
    const passMatch = /(?<!\d)(\d+) passed/.exec(output) ?? /[ℹi]\s*pass(?:ed)?\s+(\d+)/i.exec(output);
    const failMatch = /(?<!\d)(\d+) failed/.exec(output) ?? /[ℹi]\s*fail(?:ed)?\s+(\d+)/i.exec(output);
    const skipMatch = /(?<!\d)(\d+) skipped/.exec(output) ?? /[ℹi]\s*skipped\s+(\d+)/i.exec(output);

    const passed = passMatch ? Number.parseInt(passMatch[1], 10) : 0;
    const failed = failMatch ? Number.parseInt(failMatch[1], 10) : 0;
    const skipped = skipMatch ? Number.parseInt(skipMatch[1], 10) : 0;

    const testCases: TestCaseResult[] = [];
    // Create synthetic test cases from summary
    for (let i = 0; i < passed; i++) {
      testCases.push({
        id: this.generateId(),
        suiteId,
        name: `Test ${i + 1}`,
        status: 'passed',
        durationMs: 0,
      });
    }
    for (let i = 0; i < failed; i++) {
      testCases.push({
        id: this.generateId(),
        suiteId,
        name: `Failed Test ${i + 1}`,
        status: 'failed',
        durationMs: 0,
        error: 'Test failed (details in Vitest output)',
      });
    }

    return { passed, failed, skipped, testCases };
  }

  /**
   * Map Vitest status to our status type.
   */
  private mapVitestStatus(status: string): 'passed' | 'failed' | 'skipped' {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'skipped':
      case 'pending':
      case 'todo':
        return 'skipped';
      default:
        return 'failed';
    }
  }

  /**
   * Order suites by type: unit -> integration -> e2e.
   */
  private orderSuitesByType(suites: TestSuite[]): TestSuite[] {
    const typeOrder: Record<string, number> = {
      unit: 0,
      integration: 1,
      end_to_end: 2,
    };

    return [...suites].sort((a, b) => {
      const orderA = typeOrder[a.type] ?? 99;
      const orderB = typeOrder[b.type] ?? 99;
      return orderA - orderB;
    });
  }

  /**
   * Record suite result in the Governed Stream.
   */
  private recordSuiteResult(
    result: SuiteResult,
    workflowRunId: string,
    janumiCodeVersionSha: string,
  ): void {
    this.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.2',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: janumiCodeVersionSha,
      content: {
        suite_id: result.suiteId,
        suite_name: result.suiteName,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration_ms: result.durationMs,
        test_cases: result.testCases.map(tc => ({
          id: tc.id,
          name: tc.name,
          status: tc.status,
          duration_ms: tc.durationMs,
          error: tc.error,
        })),
      },
    });
  }
}
