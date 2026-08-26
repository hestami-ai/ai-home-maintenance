import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../packages/csaa/src/inventory/canonical.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface TechnicalCompletionStep {
	readonly args: readonly string[];
	readonly command: string;
	readonly label: string;
}

export interface TechnicalCompletionRecord {
	readonly analysisAuthority: 'NONE';
	readonly gateEffect: 'NONE';
	readonly state: 'TECHNICAL_IMPLEMENTATION_CHECKS_COMPLETED';
	readonly steps: readonly string[];
}

export type TechnicalCompletionStepExecutor = (step: TechnicalCompletionStep) => void;

function completionStep(
	label: string,
	command: string,
	args: readonly string[]
): TechnicalCompletionStep {
	return Object.freeze({ args: Object.freeze([...args]), command, label });
}

export const CSAA_TECHNICAL_COMPLETION_STEPS: readonly TechnicalCompletionStep[] = Object.freeze([
	completionStep('PATCH_WHITESPACE', 'git', ['diff', '--check', 'HEAD', '--']),
	completionStep('GENERATED_CONTEXT_EVIDENCE', process.execPath, [
		'run',
		'csaa:generated-context:check'
	]),
	completionStep('GENERATED_INVENTORY', process.execPath, ['run', 'csaa:inventory:check']),
	completionStep('DWP_007_PERSISTENCE_SELECTION', process.execPath, [
		'run',
		'csaa:persistence-selection:check'
	]),
	completionStep('DWP_004_BROAD_DIFFERENTIAL', process.execPath, [
		'run',
		'csaa:dependency-cruiser-differential:check'
	]),
	completionStep('G4_SAME_PERIMETER_DIFFERENTIAL', process.execPath, [
		'run',
		'csaa:dependency-cruiser-g4:check'
	]),
	completionStep('CURRENT_JPWB_CODING_AGENT_WORKFLOW', process.execPath, [
		'run',
		'csaa:agent:current-jpwb:smoke'
	]),
	completionStep('FULL_REPOSITORY_GATE', process.execPath, ['run', 'gate'])
]);

function runProcessStep(step: TechnicalCompletionStep): void {
	process.stderr.write(`[csaa:completion:check] ${step.label}\n`);
	const outcome = spawnSync(step.command, [...step.args], {
		cwd: ROOT,
		env: process.env,
		stdio: 'inherit',
		windowsHide: true
	});
	if (outcome.error !== undefined) throw outcome.error;
	if (outcome.signal !== null)
		throw new Error(`${step.label} terminated by signal ${outcome.signal}.`);
	if (outcome.status !== 0)
		throw new Error(`${step.label} failed with exit code ${outcome.status ?? 'unknown'}.`);
}

export function runTechnicalCompletion(
	executeStep: TechnicalCompletionStepExecutor
): TechnicalCompletionRecord {
	for (const step of CSAA_TECHNICAL_COMPLETION_STEPS) executeStep(step);
	return Object.freeze({
		analysisAuthority: 'NONE',
		gateEffect: 'NONE',
		state: 'TECHNICAL_IMPLEMENTATION_CHECKS_COMPLETED',
		steps: Object.freeze(CSAA_TECHNICAL_COMPLETION_STEPS.map((step) => step.label))
	});
}

function main(): void {
	if (process.argv.length !== 2) throw new Error('Usage: bun scripts/csaa-technical-completion.ts');
	process.stdout.write(`${canonicalJson(runTechnicalCompletion(runProcessStep))}\n`);
}

if ((import.meta as ImportMeta & { readonly main?: boolean }).main === true) {
	try {
		main();
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	}
}
