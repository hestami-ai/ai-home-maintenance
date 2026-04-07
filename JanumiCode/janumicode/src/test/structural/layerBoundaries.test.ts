/**
 * Layer Boundary Tests
 * Enforces clean architecture layer separation:
 * - Presentation (UI/webview) → Business Logic → Infrastructure → Foundation
 * - No reverse dependencies allowed
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { getTypeScriptFiles, extractImports } from './helpers/dependencyParser';
import { createViolationReport, addViolation, formatViolationReport } from './helpers/reporter';
import type { Violation } from './helpers/reporter';

const SRC_DIR = path.resolve(__dirname, '../../lib');
const WEBVIEW_DIR = path.resolve(__dirname, '../../webview');

describe('Layer Architecture Constraints', () => {
	describe('Presentation Layer → Cannot access Database', () => {
		it('UI modules cannot import from database layer', () => {
			const uiFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'ui'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of uiFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/database/') || imp.source.includes('database/')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
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

		it('Webview modules cannot import from database layer', () => {
			const webviewFiles = getTypeScriptFiles(
				WEBVIEW_DIR,
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of webviewFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/database/') || imp.source.includes('database/')) {
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

	describe('Presentation Layer → Cannot access CLI internals', () => {
		it('UI modules cannot import from CLI layer', () => {
			const uiFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'ui'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of uiFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/cli/') || imp.source.includes('cli/')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'presentation-to-cli'
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

	describe('Business Logic → Cannot access Presentation', () => {
		it('Workflow modules cannot import from UI layer', () => {
			const workflowFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'workflow'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of workflowFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/ui/') || imp.source.includes('webview/')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'business-to-ui'
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

		it('Orchestrator modules cannot import from UI layer', () => {
			const orchestratorFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'orchestrator'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of orchestratorFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/ui/') || imp.source.includes('webview/')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'business-to-ui'
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

		it('Role modules cannot import from UI layer', () => {
			const roleFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'roles'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of roleFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/ui/') || imp.source.includes('webview/')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'business-to-ui'
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

	describe('Infrastructure → Cannot access Business Logic', () => {
		it('Database modules cannot import from workflow layer', () => {
			const databaseFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'database'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of databaseFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (
						imp.source.includes('/workflow/') ||
						imp.source.includes('/orchestrator/') ||
						imp.source.includes('/roles/')
					) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'infrastructure-to-business'
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

		it('Database modules cannot import from UI layer', () => {
			const databaseFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'database'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of databaseFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (imp.source.includes('/ui/') || imp.source.includes('webview/')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'infrastructure-to-business'
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

	describe('Foundation → No upward dependencies', () => {
		it('Types module has no dependencies on upper layers', () => {
			const typesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'types'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();
			const forbiddenPaths = [
				'/ui/',
				'/webview/',
				'/workflow/',
				'/database/',
				'/roles/',
				'/orchestrator/',
				'/llm/',
				'/cli/'
			];

			for (const file of typesFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (forbiddenPaths.some(p => imp.source.includes(p))) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps'
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

		it('Primitives module has no dependencies on upper layers', () => {
			const primitivesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'primitives'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();
			const forbiddenPaths = [
				'/ui/',
				'/webview/',
				'/workflow/',
				'/database/',
				'/roles/',
				'/orchestrator/',
				'/llm/',
				'/cli/'
			];

			for (const file of primitivesFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (forbiddenPaths.some(p => imp.source.includes(p))) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps'
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
});
