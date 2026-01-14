import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';
import { glob } from 'glob';

/**
 * R9: Timestamps
 * Use TIMESTAMPTZ(3) for all timestamps in Prisma schema and SQL functions.
 */
export async function verifyTimestamps(config: Config): Promise<Violation[]> {
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // 1. Check Prisma Schema
    const prismaFile = path.join(projectRoot, config.paths.prismaSchema);
    if (existsSync(prismaFile)) {
        const prismaViolations = verifyPrismaTimestamps(prismaFile, config.paths.prismaSchema);
        violations.push(...prismaViolations);
    }

    // 2. Check SQL files for function definitions
    const sqlGlobs = [
        'src/**/*.sql',
        'scripts/**/*.sql',
        'prisma/migrations/**/*.sql'
    ];

    for (const pattern of sqlGlobs) {
        const matches = await glob(pattern, { cwd: projectRoot, absolute: true });
        for (const sqlFile of matches) {
            const relativePath = path.relative(projectRoot, sqlFile).replace(/\\/g, '/');
            const sqlViolations = verifySqlTimestamps(sqlFile, relativePath);
            violations.push(...sqlViolations);
        }
    }

    return violations;
}

function verifyPrismaTimestamps(filePath: string, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let currentModel = '';
    for (const [index, rawLine] of lines.entries()) {
        const line = rawLine.trim();

        if (line.startsWith('//') || line.startsWith('///')) continue;

        const modelMatch = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
        if (modelMatch) {
            currentModel = modelMatch[1] ?? '';
            continue;
        }

        if (line === '}') {
            currentModel = '';
            continue;
        }

        if (currentModel) {
            const fieldMatch = line.match(/^([A-Za-z0-9_]+)\s+DateTime\??/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1] ?? '';
                if (!line.includes('@db.Timestamptz(3)')) {
                    violations.push({
                        rule: 'R9',
                        file: relativePath,
                        reason: `Field '${fieldName}' in model '${currentModel}' is a DateTime but missing '@db.Timestamptz(3)'.`,
                        suggestion: 'Add @db.Timestamptz(3) to the field definition to ensure consistent high-precision time storage (R9).',
                        line: index + 1
                    });
                }
            }
        }
    }
    return violations;
}

function verifySqlTimestamps(filePath: string, relativePath: string): Violation[] {
    const violations: Violation[] = [];
    // We only care about new or updated scripts, but for now we scan all
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const [index, line] of lines.entries()) {
        // Look for TIMESTAMP or TIMESTAMPTZ patterns missing (3)
        // SQL is case-insensitive, so we check both
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes('timestamp') && !lowerLine.includes('timestamptz(3)') && !lowerLine.includes('timestamp(3)')) {
            // Check if it's a column definition or variable declaration
            // Avoid false positives in comments
            if (line.trim().startsWith('--')) continue;

            // Simple heuristic for "TIMESTAMP" as a type
            if (/\b(TIMESTAMPTZ|TIMESTAMP)\b/i.test(line)) {
                violations.push({
                    rule: 'R9',
                    file: relativePath,
                    reason: `SQL file contains a timestamp type without (3) precision.`,
                    suggestion: 'Use TIMESTAMPTZ(3) for all timestamp columns and variables to maintain millisecond precision (R9).',
                    line: index + 1
                });
            }
        }
    }
    return violations;
}
