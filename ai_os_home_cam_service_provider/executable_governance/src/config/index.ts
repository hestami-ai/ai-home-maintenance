import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const BoundaryRuleSchema = z.object({
    path: z.string(),
    forbiddenImports: z.array(z.string()),
    allowedImportsFromMassiveFiles: z.array(z.string()).optional(),
    reason: z.string()
});

const RuleSchema = z.object({
    name: z.string(),
    description: z.string(),
    boundaries: z.array(BoundaryRuleSchema).optional(),
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
        throw new Error(`Invalid configuration: ${JSON.stringify(result.error.format(), null, 2)}`);
    }

    return result.data;
}

export function getAbsolutePath(projectRoot: string, relativePath: string): string {
    return path.resolve(process.cwd(), projectRoot, relativePath);
}
