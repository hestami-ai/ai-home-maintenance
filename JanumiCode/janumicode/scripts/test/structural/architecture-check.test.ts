/**
 * Structural Architecture Checks
 * Validates file size limits and import boundary rules.
 * These tests enforce architectural constraints that prevent
 * accidental complexity creep.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../../src');

function countLines(filePath: string): number {
	const content = fs.readFileSync(filePath, 'utf-8');
	return content.split('\n').length;
}

function getImports(filePath: string): string[] {
	const content = fs.readFileSync(filePath, 'utf-8');
	const imports: string[] = [];
	const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
	let match;
	while ((match = importRegex.exec(content)) !== null) {
		imports.push(match[1]);
	}
	return imports;
}

function getFilesRecursive(dir: string, ext: string): string[] {
	const files: string[] = [];
	if (!fs.existsSync(dir)) { return files; }

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...getFilesRecursive(fullPath, ext));
		} else if (entry.name.endsWith(ext)) {
			files.push(fullPath);
		}
	}
	return files;
}

describe('Architecture Checks', () => {
	it('orchestrator.ts does not exceed 3000 lines', () => {
		const filePath = path.join(SRC_ROOT, 'lib/workflow/orchestrator.ts');
		if (fs.existsSync(filePath)) {
			const lines = countLines(filePath);
			expect(lines, `orchestrator.ts has ${lines} lines, limit is 3000`).toBeLessThanOrEqual(3000);
		}
	});

	it('GovernedStreamPanel.ts does not exceed 2000 lines', () => {
		const filePath = path.join(SRC_ROOT, 'lib/ui/governedStream/GovernedStreamPanel.ts');
		if (fs.existsSync(filePath)) {
			const lines = countLines(filePath);
			expect(lines, `GovernedStreamPanel.ts has ${lines} lines, limit is 2000`).toBeLessThanOrEqual(2000);
		}
	});

	it('no direct vscode imports in workflow layer', () => {
		// Known exceptions: files that import vscode for types only
		// TODO: Refactor responseEvaluator.ts to remove vscode dependency
		const KNOWN_EXCEPTIONS = new Set([
			'responseEvaluator.ts',
		]);

		const workflowDir = path.join(SRC_ROOT, 'lib/workflow');
		const files = getFilesRecursive(workflowDir, '.ts');

		for (const file of files) {
			const basename = path.basename(file);
			if (KNOWN_EXCEPTIONS.has(basename)) { continue; }

			const imports = getImports(file);
			const vsCodeImports = imports.filter(i => i === 'vscode');
			const relPath = path.relative(SRC_ROOT, file);
			expect(
				vsCodeImports,
				`${relPath} should not import 'vscode' directly`
			).toHaveLength(0);
		}
	});

	it('no direct vscode imports in events layer', () => {
		const eventsDir = path.join(SRC_ROOT, 'lib/events');
		const files = getFilesRecursive(eventsDir, '.ts');

		for (const file of files) {
			const imports = getImports(file);
			const vsCodeImports = imports.filter(i => i === 'vscode');
			const relPath = path.relative(SRC_ROOT, file);
			expect(
				vsCodeImports,
				`${relPath} should not import 'vscode' directly`
			).toHaveLength(0);
		}
	});
});
