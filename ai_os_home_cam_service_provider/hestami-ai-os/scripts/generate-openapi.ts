#!/usr/bin/env tsx
/**
 * Generate OpenAPI specification to a static JSON file
 * 
 * Usage: npm run openapi:generate
 * Output: ./openapi.json
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config'; // Load env vars

// Dynamic import to handle ESM
async function main() {
	const { generateOpenAPISpec } = await import('../src/lib/server/api/openapi.js');

	const spec = await generateOpenAPISpec();
	const outputPath = resolve(process.cwd(), 'openapi.json');

	writeFileSync(outputPath, JSON.stringify(spec, null, 2));

	console.log(`✅ OpenAPI spec generated: ${outputPath}`);
	console.log(`   Version: ${spec.info?.version ?? 'unknown'}`);
	console.log(`   Paths: ${Object.keys(spec.paths ?? {}).length}`);
}

main().catch((err) => {
	console.error('❌ Failed to generate OpenAPI spec:', err);
	process.exit(1);
});
