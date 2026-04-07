/**
 * Dependency Parser - Extract imports from TypeScript files
 * Uses simple regex parsing to extract import statements
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ImportInfo {
	source: string;
	specifiers: string[];
	isTypeOnly: boolean;
	line: number;
}

export interface FileImports {
	filePath: string;
	imports: ImportInfo[];
	resolvedPaths: string[];
}

const IMPORT_REGEX = /^\s*import\s+(?:type\s+)?(?:{[^}]*}|[\w*\s,]+)\s+from\s+['"]([^'"]+)['"]/gm;
const TYPE_IMPORT_REGEX = /^\s*import\s+type\s+/;

/**
 * Extract all imports from a TypeScript file
 */
export function extractImports(filePath: string): FileImports {
	const content = fs.readFileSync(filePath, 'utf-8');
	const imports: ImportInfo[] = [];
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		const match = line.match(/^\s*import\s+(?:type\s+)?(?:{([^}]*)}|([\w*\s,]+))\s+from\s+['"]([^'"]+)['"]/);
		if (match) {
			const specifiers = match[1] 
				? match[1].split(',').map(s => s.trim())
				: match[2] ? [match[2].trim()] : [];
			
			imports.push({
				source: match[3],
				specifiers,
				isTypeOnly: TYPE_IMPORT_REGEX.test(line),
				line: index + 1
			});
		}
	});

	const resolvedPaths = imports
		.map(imp => resolveImportPath(filePath, imp.source))
		.filter((p): p is string => p !== null);

	return {
		filePath,
		imports,
		resolvedPaths
	};
}

/**
 * Resolve relative import path to absolute module path
 */
export function resolveImportPath(fromFile: string, importSource: string): string | null {
	// Skip external dependencies (npm packages)
	if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
		return null;
	}

	const fromDir = path.dirname(fromFile);
	const resolved = path.resolve(fromDir, importSource);
	
	// Normalize path separators to forward slashes
	return resolved.replace(/\\/g, '/');
}

/**
 * Get module path from file path (e.g., src/lib/database/init.ts -> lib/database)
 */
export function getModulePath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	
	// Extract module from src/lib/... or src/webview/...
	const match = normalized.match(/src\/(lib\/[^\/]+|webview|test)/);
	return match ? match[1] : '';
}

/**
 * Check if an import crosses a module boundary
 */
export function crossesModuleBoundary(fromFile: string, toFile: string): boolean {
	const fromModule = getModulePath(fromFile);
	const toModule = getModulePath(toFile);
	
	if (!fromModule || !toModule) {return false;}
	
	return fromModule !== toModule;
}

/**
 * Get all TypeScript files in a directory recursively
 */
export function getTypeScriptFiles(dir: string, exclude: RegExp[] = []): string[] {
	const results: string[] = [];
	
	function walk(currentPath: string): void {
		const entries = fs.readdirSync(currentPath, { withFileTypes: true });
		
		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			const normalizedPath = fullPath.replace(/\\/g, '/');
			
			// Check exclusions
			if (exclude.some(pattern => pattern.test(normalizedPath))) {
				continue;
			}
			
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith('.ts')) {
				results.push(normalizedPath);
			}
		}
	}
	
	walk(dir);
	return results;
}

/**
 * Check if import violates a forbidden pattern
 */
export function violatesForbiddenPattern(
	fromFile: string,
	toFile: string,
	pattern: { from: RegExp; to: RegExp }
): boolean {
	const normalizedFrom = fromFile.replace(/\\/g, '/');
	const normalizedTo = toFile.replace(/\\/g, '/');
	
	return pattern.from.test(normalizedFrom) && pattern.to.test(normalizedTo);
}
