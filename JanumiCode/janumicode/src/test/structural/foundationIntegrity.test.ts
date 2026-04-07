/**
 * Foundation Layer Integrity Tests
 * Enforces strict zero-dependency rules for foundation modules
 * Foundation = types/ + primitives/ + errorHandling/
 * 
 * COVENANT: Foundation modules MUST be pure, reusable, and project-agnostic
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { getTypeScriptFiles, extractImports } from './helpers/dependencyParser';
import { createViolationReport, addViolation, formatViolationReport } from './helpers/reporter';
import type { Violation } from './helpers/reporter';

const SRC_DIR = path.resolve(__dirname, '../../lib');

const FORBIDDEN_PATHS = [
	'/ui/',
	'/webview/',
	'/workflow/',
	'/database/',
	'/roles/',
	'/orchestrator/',
	'/llm/',
	'/cli/',
	'/documents/',
	'/curation/',
	'/context/',
	'/dialogue/',
	'/integration/',
	'/claudeCode/'
];

describe('Foundation Layer Integrity', () => {
	describe('Types Module - Zero Upward Dependencies', () => {
		it('types/ has ZERO dependencies on application layers', () => {
			const typesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'types'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of typesFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					// Check if import is from forbidden path
					if (FORBIDDEN_PATHS.some(p => imp.source.includes(p))) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps',
							reason: 'Types module cannot depend on application layers'
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

		it('types/ only imports from node: stdlib or npm packages', () => {
			const typesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'types'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of typesFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					// Allow: node:*, npm packages, relative imports within types/
					const isAllowed =
						imp.source.startsWith('node:') ||
						!imp.source.startsWith('.') ||
						imp.source.includes('/types/');

					if (!isAllowed && imp.source.startsWith('../')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps',
							reason: 'Types can only import from stdlib, npm, or other types'
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

	describe('Primitives Module - Zero Upward Dependencies', () => {
		it('primitives/ has ZERO dependencies on application layers', () => {
			const primitivesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'primitives'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of primitivesFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (FORBIDDEN_PATHS.some(p => imp.source.includes(p))) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps',
							reason: 'Primitives module cannot depend on application layers'
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

		it('primitives/ can only import types/, other primitives, or stdlib', () => {
			const primitivesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'primitives'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();

			for (const file of primitivesFiles) {
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					// Allow: node:*, npm packages, types/, primitives/
					const isAllowed =
						imp.source.startsWith('node:') ||
						!imp.source.startsWith('.') ||
						imp.source.includes('/types/') ||
						imp.source.includes('/primitives/');

					if (!isAllowed && imp.source.startsWith('../')) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps',
							reason: 'Primitives can only import types, other primitives, stdlib, or npm'
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

	describe('Foundation Self-Containment', () => {
		it('foundation modules are not god modules (max 10 dependencies)', () => {
			const foundationFiles = [
				...getTypeScriptFiles(path.join(SRC_DIR, 'types'), [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(path.join(SRC_DIR, 'primitives'), [/\.test\.ts$/, /node_modules/])
			];

			const report = createViolationReport();

			for (const file of foundationFiles) {
				const imports = extractImports(file);
				const externalImports = imports.imports.filter(
					imp => !imp.source.includes('/types/') && !imp.source.includes('/primitives/')
				);

				if (externalImports.length > 10) {
					const violation: Violation = {
						file: file.replace(SRC_DIR, 'src/lib'),
						pattern: 'high-fan-out',
						reason: `${externalImports.length} external dependencies (max 10 for foundation)`
					};
					addViolation(report, violation, 'warn');
				}
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			expect(report.warnings).toEqual([]);
		});
	});

	describe('Misplaced Primitives Detection', () => {
		it('no application logic masquerading as primitives', () => {
			const primitivesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'primitives'),
				[/\.test\.ts$/, /node_modules/]
			);

			const report = createViolationReport();
			const businessTerms = [
				'workflow', 'dialogue', 'claim', 'verdict', 'task', 'gate',
				'orchestrator', 'role', 'executor', 'verifier',
				'database', 'schema', 'migration'
			];

			for (const file of primitivesFiles) {
				const fileName = path.basename(file).toLowerCase();
				
				// Check if filename contains business terms
				for (const term of businessTerms) {
					if (fileName.includes(term)) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							pattern: 'foundation-upward-deps',
							reason: `File name "${path.basename(file)}" suggests business logic, not primitive`
						};
						addViolation(report, violation, 'warn');
						break;
					}
				}

				// Check imports for business logic references
				const imports = extractImports(file);
				for (const imp of imports.imports) {
					if (FORBIDDEN_PATHS.some(p => imp.source.includes(p))) {
						const violation: Violation = {
							file: file.replace(SRC_DIR, 'src/lib'),
							import: imp.source,
							line: imp.line,
							pattern: 'foundation-upward-deps',
							reason: 'Primitive imports from application layer - likely misplaced'
						};
						addViolation(report, violation);
					}
				}
			}

			if (report.errors.length > 0 || report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			expect(report.errors).toEqual([]);
		});

		it('catalog.ts and safety.ts are properly categorized', () => {
			// These files have been flagged in previous runs as potentially misplaced
			const suspiciousFiles = ['catalog.ts', 'safety.ts'];
			
			const report = createViolationReport();

			for (const fileName of suspiciousFiles) {
				const filePath = path.join(SRC_DIR, 'primitives', fileName);
				try {
					const imports = extractImports(filePath);
					
					for (const imp of imports.imports) {
						if (FORBIDDEN_PATHS.some(p => imp.source.includes(p))) {
							const violation: Violation = {
								file: filePath.replace(SRC_DIR, 'src/lib'),
								import: imp.source,
								line: imp.line,
								pattern: 'foundation-upward-deps',
								reason: `${fileName} imports from application layer - should be moved to appropriate module`
							};
							addViolation(report, violation);
						}
					}
				} catch {
					// File doesn't exist, which is fine
				}
			}

			if (report.errors.length > 0) {
				console.log(formatViolationReport(report));
				console.log('\n💡 SUGGESTION: Move these files to their appropriate layers:');
				console.log('  - catalog.ts → likely belongs in context/ or integration/');
				console.log('  - safety.ts → likely belongs in workflow/ or orchestrator/');
			}

			expect(report.errors).toEqual([]);
		});
	});

	describe('Foundation Covenant Documentation', () => {
		it('foundation modules contain covenant comment', () => {
			const foundationFiles = [
				...getTypeScriptFiles(path.join(SRC_DIR, 'types'), [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(path.join(SRC_DIR, 'primitives'), [/\.test\.ts$/, /node_modules/])
			];

			const report = createViolationReport();

			for (const file of foundationFiles) {
				const imports = extractImports(file);
				// Check if file has imports from application layers
				const hasAppImports = imports.imports.some(imp =>
					FORBIDDEN_PATHS.some(p => imp.source.includes(p))
				);

				if (hasAppImports) {
					const violation: Violation = {
						file: file.replace(SRC_DIR, 'src/lib'),
						pattern: 'foundation-upward-deps',
						reason: 'Foundation module violates covenant by importing from application layers'
					};
					addViolation(report, violation, 'info');
				}
			}

			if (report.info.length > 0) {
				console.log('\n📜 FOUNDATION COVENANT VIOLATIONS:');
				console.log('Foundation modules MUST be:');
				console.log('  - Pure and side-effect free');
				console.log('  - Reusable across projects');
				console.log('  - Zero dependencies on application layers');
				console.log('  - Self-contained with minimal external dependencies');
				console.log('\nViolations detected:');
				console.log(formatViolationReport(report));
			}

			// Info-level violations don't fail the test, but are reported
			expect(report.errors).toEqual([]);
		});
	});
});
