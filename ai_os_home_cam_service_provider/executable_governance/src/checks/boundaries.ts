import { Project, type SourceFile } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.js';
import { minimatch } from 'minimatch';
import path from 'node:path';

export async function verifyBoundaries(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // Load all relevant files
    for (const ruleId in config.rules) {
        const rule = config.rules[ruleId];
        if (!rule?.boundaries) continue;

        for (const boundary of rule.boundaries) {
            const globPath = path.join(projectRoot, boundary.path).replaceAll('\\', '/');
            const files = project.addSourceFilesAtPaths(globPath);

            for (const file of files) {
                violations.push(...checkFileImports(file, ruleId, boundary, projectRoot));
            }
        }
    }

    return violations;
}

function checkFileImports(
    file: SourceFile,
    ruleId: string,
    boundary: any,
    projectRoot: string
): Violation[] {
    const violations: Violation[] = [];
    const relativeFilePath = path.relative(projectRoot, file.getFilePath()).replaceAll('\\', '/');
    const imports = file.getImportDeclarations();

    for (const imp of imports) {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        // Check if module specifier matches any forbidden patterns
        for (const forbidden of boundary.forbiddenImports) {
            if (isForbidden(moduleSpecifier, forbidden, relativeFilePath, boundary.allowedImportsFromMassiveFiles)) {
                violations.push({
                    rule: ruleId,
                    file: relativeFilePath,
                    reason: boundary.reason,
                    suggestion: `Remove import of '${moduleSpecifier}' matching forbidden pattern '${forbidden}'.`,
                    line: imp.getStartLineNumber()
                });
            }
        }
    }

    // Also check for dynamic imports if necessary, but this is a good start.

    return violations;
}

function isForbidden(
    specifier: string,
    pattern: string,
    currentFile: string,
    exceptions: string[] = []
): boolean {
    // If specifier is in exceptions, it's NOT forbidden
    if (exceptions.some(ex => specifier.includes(ex) || minimatch(specifier, ex))) {
        return false;
    }

    // Handle alias or direct match
    if (specifier === pattern || minimatch(specifier, pattern)) {
        return true;
    }

    // Handle paths relative to project root or aliases
    // In a real SvelteKit project, aliases like $lib are common.
    // We might need to resolve aliases, but for now, we'll check substrings as well.
    if (pattern.includes('*') && minimatch(specifier, pattern)) {
        return true;
    }

    return false;
}
