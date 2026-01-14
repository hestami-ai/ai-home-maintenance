import { Project, type SourceFile, SyntaxKind, type CallExpression } from 'ts-morph';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';

export async function verifyTypes(config: Config): Promise<Violation[]> {
    const project = new Project();
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    const globPath = path.join(projectRoot, 'src/**/*.{ts,svelte}').replace(/\\/g, '/');
    const files = project.addSourceFilesAtPaths(globPath);

    for (const file of files) {
        const relativePath = path.relative(projectRoot, file.getFilePath()).replace(/\\/g, '/');

        // R8: No hardcoded z.enum([...])
        const zEnumCalls = file.getDescendantsOfKind(SyntaxKind.CallExpression)
            .filter(call => {
                const expr = call.getExpression();
                return expr.getText() === 'z.enum';
            });

        for (const call of zEnumCalls) {
            // Check if it's in a generated file or a schema barrel
            if (!isAllowedEnumDefinition(file, relativePath, config)) {
                violations.push({
                    rule: 'R8',
                    file: relativePath,
                    reason: 'Hardcoded z.enum([...]) detected.',
                    suggestion: 'Import the generated enum schema from the barrel file (src/lib/server/api/schemas.ts) instead of hardcoding values.',
                    line: call.getStartLineNumber()
                });
            }
        }
    }

    return violations;
}

function isAllowedEnumDefinition(file: SourceFile, relativePath: string, config: Config): boolean {
    if (relativePath.includes('generated/zod')) return true;
    if (relativePath === config.paths.apiBarrel) return true;
    if (relativePath === config.paths.workflowBarrel) return true;

    // Also allow it in test files maybe? For now, be strict.
    return false;
}
