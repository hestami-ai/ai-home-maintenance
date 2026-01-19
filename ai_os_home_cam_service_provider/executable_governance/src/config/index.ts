import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BoundaryRuleSchema = z.object({
    path: z.string(),
    forbiddenImports: z.array(z.string()),
    allowedImportsFromMassiveFiles: z.array(z.string()).optional(),
    reason: z.string()
});

const AllowListEntrySchema = z.object({
    file: z.string(),
    values: z.array(z.string()),
    reason: z.string().optional()
});

const R13OptionsSchema = z.object({
    skipCaseClauses: z.boolean().optional().default(false),
    allowList: z.array(AllowListEntrySchema).optional().default([])
}).optional();

const RuleSchema = z.object({
    name: z.string(),
    description: z.string(),
    boundaries: z.array(BoundaryRuleSchema).optional(),
    options: R13OptionsSchema.optional()
});

export const ConfigSchema = z.object({
    projectRoot: z.string().default('..'),
    rules: z.record(z.string(), RuleSchema),
    paths: z.object({
        prismaSchema: z.string(),
        zodGenerated: z.string(),
        openApiSpec: z.string(),
        generatedTypes: z.string(),
        apiBarrel: z.string(),
        workflowBarrel: z.string()
    })
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath: string): Config {
    if (!existsSync(configPath)) {
        throw new Error(`Config file not found at ${configPath}`);
    }

    const fileContent = readFileSync(configPath, 'utf-8');
    const json = JSON.parse(fileContent);
    const result = ConfigSchema.safeParse(json);

    if (!result.success) {
        throw new Error(`Invalid configuration: ${JSON.stringify(z.treeifyError(result.error), null, 2)}`);
    }

    return result.data;
}

export function getAbsolutePath(projectRoot: string, relativePath: string): string {
    return path.resolve(process.cwd(), projectRoot, relativePath);
}
