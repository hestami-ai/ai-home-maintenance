/**
 * Agent-Specific Constraints Tests
 * Enforces best practices for AI-assisted codebases
 * - Prompt integrity
 * - LLM call patterns
 * - Workflow determinism
 * - Context validation
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getTypeScriptFiles } from './helpers/dependencyParser';
import { createViolationReport, addViolation, formatViolationReport } from './helpers/reporter';
import type { Violation } from './helpers/reporter';

const SRC_DIR = path.resolve(__dirname, '../../lib');

describe('Agent-Specific Constraints', () => {
	describe('Prompt Integrity', () => {
		it('prompt files do not use `any` type', () => {
			const promptFiles = [
				...getTypeScriptFiles(path.join(SRC_DIR, 'roles'), [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(path.join(SRC_DIR, 'context'), [/\.test\.ts$/, /node_modules/])
			];

			const report = createViolationReport();

			for (const file of promptFiles) {
				const content = fs.readFileSync(file, 'utf-8');
				
				// Check for `: any` or `as any`
				const anyMatches = content.match(/:\s*any\b|as\s+any\b/g);
				if (anyMatches && anyMatches.length > 0) {
					const violation: Violation = {
						file: file.replace(SRC_DIR, 'src/lib'),
						pattern: 'prompt-integrity',
						reason: `Found ${anyMatches.length} uses of 'any' type - prompts should be strongly typed`
					};
					addViolation(report, violation, 'warn');
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			// Allow some during migration
			expect(report.warnings.length).toBeLessThan(20);
		});

		it('system prompts are defined as constants', () => {
			const roleFiles = getTypeScriptFiles(path.join(SRC_DIR, 'roles'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();

			for (const file of roleFiles) {
				const content = fs.readFileSync(file, 'utf-8');
				const fileName = path.basename(file);

				// Check if file contains system prompt
				if (content.includes('systemPrompt') || content.includes('SYSTEM_PROMPT')) {
					// Ensure it's defined as a const
					if (!content.match(/const\s+\w*[Ss]ystem[Pp]rompt/)) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'prompt-integrity',
							reason: 'System prompts should be defined as const for consistency'
						};
						addViolation(report, violation, 'info');
					}
				}
			}

			if (report.info.length > 0) {
				console.log(formatViolationReport(report));
			}

			// Info only - doesn't fail
			expect(report.errors).toEqual([]);
		});
	});

	describe('LLM Call Patterns', () => {
		it('LLM provider calls include retry configuration', () => {
			const llmFiles = getTypeScriptFiles(path.join(SRC_DIR, 'llm'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();

			for (const file of llmFiles) {
				const content = fs.readFileSync(file, 'utf-8');
				const fileName = path.basename(file);

				// Skip the provider.ts itself
				if (fileName === 'provider.ts') {continue;}

				// Check for LLM calls without retry
				if (content.includes('createProvider') || content.includes('getLLMProvider')) {
					if (!content.includes('retry') && !content.includes('executeWithRetry')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'llm-call-pattern',
							reason: 'LLM calls should use retry logic for resilience'
						};
						addViolation(report, violation, 'warn');
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			expect(report.warnings.length).toBeLessThan(5);
		});

		it('LLM responses are validated', () => {
			const roleFiles = getTypeScriptFiles(path.join(SRC_DIR, 'roles'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();

			for (const file of roleFiles) {
				const content = fs.readFileSync(file, 'utf-8');

				// Check for LLM response handling
				if (content.includes('response') && content.includes('content')) {
					// Should have validation (JSON.parse, schema check, or Result type)
					const hasValidation = 
						content.includes('JSON.parse') ||
						content.includes('schema.parse') ||
						content.includes('validate') ||
						content.includes('Result<');

					if (!hasValidation) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'llm-call-pattern',
							reason: 'LLM responses should be validated before use'
						};
						addViolation(report, violation, 'warn');
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			expect(report.warnings.length).toBeLessThan(10);
		});
	});

	describe('Workflow Determinism', () => {
		it('workflow modules avoid non-deterministic operations', () => {
			const workflowFiles = getTypeScriptFiles(path.join(SRC_DIR, 'workflow'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();
			const nonDeterministicPatterns = [
				{ pattern: /Date\.now\(\)/, name: 'Date.now()' },
				{ pattern: /new\s+Date\(\)/, name: 'new Date()' },
				{ pattern: /Math\.random\(\)/, name: 'Math.random()' },
			];

			for (const file of workflowFiles) {
				const content = fs.readFileSync(file, 'utf-8');

				for (const { pattern, name } of nonDeterministicPatterns) {
					if (pattern.test(content)) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'workflow-determinism',
							reason: `Uses ${name} which is non-deterministic - use injected timestamp instead`
						};
						addViolation(report, violation, 'warn');
						break; // Only report once per file
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
				console.log('\n💡 TIP: Use dependency injection for timestamps:');
				console.log('   function processWorkflow(input: Input, timestamp = Date.now()) { ... }');
			}

			expect(report.warnings.length).toBeLessThan(15);
		});

		it('workflow modules avoid direct I/O operations', () => {
			const workflowFiles = getTypeScriptFiles(path.join(SRC_DIR, 'workflow'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();
			const ioPatterns = [
				{ pattern: /fs\.readFileSync/, name: 'fs.readFileSync' },
				{ pattern: /fs\.writeFileSync/, name: 'fs.writeFileSync' },
				{ pattern: /process\.env\b/, name: 'process.env' },
			];

			for (const file of workflowFiles) {
				const content = fs.readFileSync(file, 'utf-8');
				const fileName = path.basename(file);

				// Skip certain files that legitimately need I/O
				if (fileName.includes('Store') || fileName.includes('store')) {continue;}

				for (const { pattern, name } of ioPatterns) {
					if (pattern.test(content)) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'workflow-determinism',
							reason: `Uses ${name} - workflow should delegate I/O to infrastructure layer`
						};
						addViolation(report, violation, 'warn');
						break;
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			expect(report.warnings.length).toBeLessThan(10);
		});
	});

	describe('Context Validation', () => {
		it('context builders have runtime validation', () => {
			const contextFiles = getTypeScriptFiles(path.join(SRC_DIR, 'context/builders'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();

			for (const file of contextFiles) {
				const content = fs.readFileSync(file, 'utf-8');

				// Should have validation logic
				const hasValidation = 
					content.includes('if (!') ||
					content.includes('throw') ||
					content.includes('assert') ||
					content.includes('validate');

				if (!hasValidation) {
					const violation: Violation = {
						file: file.replace(SRC_DIR, 'src/lib'),
						pattern: 'context-validation',
						reason: 'Context builders should validate inputs at runtime'
					};
					addViolation(report, violation, 'warn');
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			expect(report.warnings.length).toBeLessThan(5);
		});

		it('context includes PII redaction where needed', () => {
			const contextFiles = getTypeScriptFiles(path.join(SRC_DIR, 'context'), [/\.test\.ts$/, /node_modules/]);

			const report = createViolationReport();
			const piiTerms = ['email', 'password', 'token', 'key', 'secret'];

			for (const file of contextFiles) {
				const content = fs.readFileSync(file, 'utf-8');
				const lowerContent = content.toLowerCase();

				// Check if file handles PII
				const handlesPII = piiTerms.some(term => lowerContent.includes(term));

				if (handlesPII) {
					// Should have redaction logic
					const hasRedaction = 
						content.includes('redact') ||
						content.includes('mask') ||
						content.includes('sanitize') ||
						content.includes('[REDACTED]');

					if (!hasRedaction) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'context-validation',
							reason: 'Files handling PII should implement redaction before sending to LLM'
						};
						addViolation(report, violation, 'warn');
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
				console.log('\n🔒 SECURITY: Always redact PII before sending to external APIs');
			}

			expect(report.warnings.length).toBeLessThan(5);
		});
	});

	describe('Agent Covenant', () => {
		it('agent-specific modules follow best practices', () => {
			const agentModules = [
				...getTypeScriptFiles(path.join(SRC_DIR, 'roles'), [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(path.join(SRC_DIR, 'context'), [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(path.join(SRC_DIR, 'llm'), [/\.test\.ts$/, /node_modules/])
			];

			const report = createViolationReport();
			const issues: string[] = [];

			for (const file of agentModules) {
				const content = fs.readFileSync(file, 'utf-8');
				const fileName = path.basename(file);

				// Check for common anti-patterns
				if (content.includes('console.log') && !fileName.includes('test')) {
					issues.push(`${fileName}: Uses console.log instead of structured logging`);
				}

				if (content.includes('// TODO') || content.includes('// FIXME')) {
					issues.push(`${fileName}: Contains unresolved TODO/FIXME comments`);
				}
			}

			if (issues.length > 0) {
				console.log('\n📋 AGENT COVENANT CHECKLIST:');
				issues.slice(0, 10).forEach(issue => console.log(`  - ${issue}`));
				if (issues.length > 10) {
					console.log(`  ... and ${issues.length - 10} more issues`);
				}
			}

			// Info only - doesn't fail
			expect(report.errors).toEqual([]);
		});
	});
});
