import { statSync, existsSync, readdirSync } from 'fs';
import { type Config, getAbsolutePath } from '../config/index.js';
import type { Violation } from '../reporting/index.ts';
import path from 'path';

/**
 * R4: Pipeline Integrity
 * Detects drift between Prisma schemas, Zod models, OpenAPI specs, and generated frontend types.
 */
export async function verifyPipelines(config: Config): Promise<Violation[]> {
    const violations: Violation[] = [];
    const projectRoot = getAbsolutePath(config.projectRoot, '.');

    // 1. Prisma -> ZodGen drift
    const prismaSchema = path.join(projectRoot, config.paths.prismaSchema);
    const zodGenerated = path.join(projectRoot, config.paths.zodGenerated);

    if (isNewer(prismaSchema, zodGenerated)) {
        violations.push({
            rule: 'R4',
            file: 'prisma/schema.prisma',
            reason: 'Prisma schema is newer than generated Zod schemas.',
            suggestion: 'Run `bunx prisma generate` to update artifacts.'
        });
    }

    // 2. oRPC -> OpenAPI drift
    // This one is harder because routes are many files. 
    // We could check the most recent change in src/routes/api.
    const apiRoutesDir = path.join(projectRoot, 'src/routes/api');
    const openApiSpec = path.join(projectRoot, config.paths.openApiSpec);

    if (isDirNewerThanFile(apiRoutesDir, openApiSpec)) {
        violations.push({
            rule: 'R4',
            file: 'src/routes/api',
            reason: 'API routes have changed since last OpenAPI generation.',
            suggestion: 'Run `bun run openapi:generate` to update openapi.json.'
        });
    }

    // 3. OpenAPI -> API Types drift
    const generatedTypes = path.join(projectRoot, config.paths.generatedTypes);
    if (isNewer(openApiSpec, generatedTypes)) {
        violations.push({
            rule: 'R4',
            file: config.paths.openApiSpec,
            reason: 'OpenAPI spec is newer than generated API types.',
            suggestion: 'Run `bun run types:generate` to update src/lib/api/types.generated.ts.'
        });
    }

    return violations;
}

function isNewer(fileA: string, fileB: string): boolean {
    if (!existsSync(fileA) || !existsSync(fileB)) return false;
    const statA = statSync(fileA);
    const statB = statSync(fileB);
    return statA.mtime > statB.mtime;
}

function isDirNewerThanFile(dir: string, file: string): boolean {
    if (!existsSync(dir) || !existsSync(file)) return false;
    const fileStat = statSync(file);
    const fileMtime = fileStat.mtime;

    return checkDirMtimeRecursive(dir, fileMtime);
}

function checkDirMtimeRecursive(dir: string, fileMtime: Date): boolean {
    const items = readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            if (checkDirMtimeRecursive(fullPath, fileMtime)) return true;
        } else {
            if (stat.mtime > fileMtime) return true;
        }
    }
    return false;
}
