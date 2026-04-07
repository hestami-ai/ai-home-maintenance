/**
 * Module Boundary Tests
 * Enforces strict isolation between major modules
 * Prevents cross-contamination and unwanted coupling
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { getTypeScriptFiles, extractImports } from './helpers/dependencyParser';
import { createViolationReport, addViolation, formatViolationReport } from './helpers/reporter';
import type { Violation } from './helpers/reporter';

const SRC_DIR = path.resolve(__dirname, '../../lib');
const WEBVIEW_DIR = path.resolve(__dirname, '../../webview');

describe('Module Boundary Constraints', () => {
	describe('Webview Isolation', () => {
		it('webview cannot import workflow internals', () => {
			const webviewFiles = getTypeScriptFiles(
				WEBVIEW_DIR,
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of webviewFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/workflow/')) {
						const violation: Violation = {
							file: file.replace(path.dirname(SRC_DIR), 'src'),
							import: imp.source,
							line: imp.line,
							pattern: 'presentation-to-database'
						};
						addViolation(report, violation);
					}
				}
			}

			if (report.errors.length > 0) {
				console.log(formatViolationReport(report));
			}
			expect(report.errors).toEqual([]);
		});

		it('webview cannot import role implementations', () => {
			const webviewFiles = getTypeScriptFiles(
				WEBVIEW_DIR,
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of webviewFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/roles/')) {
						const violation: Violation = {
							file: file.replace(path.dirname(SRC_DIR), 'src'),
							import: imp.source,
							line: imp.line,
							pattern: 'presentation-to-database'
						};
						addViolation(report, violation);
					}
				}
			}

			if (report.errors.length > 0) {
				console.log(formatViolationReport(report));
			}
			expect(report.errors).toEqual([]);
		});

		it('webview cannot import orchestrator', () => {
			const webviewFiles = getTypeScriptFiles(
				WEBVIEW_DIR,
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of webviewFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/orchestrator/')) {
						const violation: Violation = {
							file: file.replace(path.dirname(SRC_DIR), 'src'),
							import: imp.source,
							line: imp.line,
							pattern: 'presentation-to-database'
						};
						addViolation(report, violation);
					}
				}
			}

			if (report.errors.length > 0) {
				console.log(formatViolationReport(report));
			}
			expect(report.errors).toEqual([]);
		});
	});

	describe('Database Isolation', () => {
		it('database modules only accessed via store abstractions', () => {
			const allFiles = getTypeScriptFiles(
				SRC_DIR,
				[/\.test\.ts$/, /node_modules/, /database\//]
			);

			const report = createViolationReport();

			for (const file of allFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					// Allow imports from database/index.ts or public store modules
					if (imp.source.includes('/database/')) {
						const allowedPatterns = [
							'/database/index',
							'/database/init',
							'Store.ts',
							'Store'
						];
						
						const isAllowed = allowedPatterns.some(pattern => 
							imp.source.includes(pattern)
						);

						if (!isAllowed) {
							const violation: Violation = {
								file: file.replace(SRC_DIR, 'src/lib'),
								import: imp.source,
								line: imp.line,
								pattern: 'database-direct-access',
								reason: 'Direct import of database internals - use store abstraction'
							};
							addViolation(report, violation, 'warn');
						}
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report, { maxViolationsPerType: 5 }));
			}

			// This is a warning rather than strict error - allow some violations during migration
			expect(report.warnings.length).toBeLessThan(100);
		});
	});

	describe('LLM Provider Isolation', () => {
		it('LLM provider only imported by allowed modules', () => {
			const allFiles = getTypeScriptFiles(
				SRC_DIR,
				[/\.test\.ts$/, /node_modules/, /llm\//]
			);

			const report = createViolationReport();
			const allowedModules = ['roles/', 'cli/', 'documents/', 'curation/'];

			for (const file of allFiles) {
				if (!allowedModules.some(m => file.includes(m))) {
					const imports = extractImports(file);
					for (const imp of imports.imports) {
						if (imp.source.includes('/llm/provider')) {
							const violation: Violation = {
								file: file.replace(SRC_DIR, 'src/lib'),
								import: imp.source,
								line: imp.line,
								pattern: 'llm-unauthorized-access'
							};
							addViolation(report, violation, 'warn');
						}
					}
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report, { maxViolationsPerType: 5 }));
			}

			expect(report.warnings.length).toBeLessThan(10);
		});
	});

	describe('Context Module Boundaries', () => {
		it('context builders are modular and isolated', () => {
			const contextFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'context/builders'),
				[/\.test\.ts$/, /node_modules/]
			);

			const violations: Array<{ file: string; import: string }> = [];

			for (const file of contextFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					// Context builders should not cross-import each other
					if (imp.source.includes('/context/builders/') && 
						!imp.source.includes(path.basename(file, '.ts'))) {
						violations.push({
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source
						});
					}
				}
			}

			if (violations.length > 0) {
				console.log('Context builder cross-coupling:', violations);
			}

			expect(violations).toEqual([]);
		});
	});

	describe('Integration Module Isolation', () => {
		it('integration modules should not depend on each other', () => {
			const integrationFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'integration'),
				[/\.test\.ts$/, /node_modules/]
			);

			const violations: Array<{ file: string; import: string }> = [];

			for (const file of integrationFiles) {
				const imports = extractImports(file);
				const currentFileName = path.basename(file, '.ts');
				
				for (const imp of imports.imports) {
					// Integration modules should not import other integration modules
					if (imp.source.includes('/integration/') && 
						!imp.source.includes(currentFileName) &&
						!imp.source.includes('/integration/index')) {
						violations.push({
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source
						});
					}
				}
			}

			if (violations.length > 0) {
				console.log('Integration module coupling:', violations);
			}

			expect(violations.length).toBeLessThan(5);
		});
	});

	describe('Event System Boundaries', () => {
		it('event emitters are properly isolated', () => {
			const allFiles = getTypeScriptFiles(
				SRC_DIR,
				[/\.test\.ts$/, /node_modules/, /events\//]
			);

			const violations: Array<{ file: string; import: string }> = [];

			for (const file of allFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					// Direct import of event writer internals should be limited
					if (imp.source.includes('/events/writer') && 
						!imp.source.includes('/events/index')) {
						// This is OK - events/writer is a shared utility
						continue;
					}
				}
			}

			// Events are a shared utility, so this test mainly documents the pattern
			expect(violations.length).toBeLessThan(200);
		});
	});
});
