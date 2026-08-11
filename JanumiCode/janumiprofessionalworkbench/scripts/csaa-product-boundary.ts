import { fileURLToPath } from 'node:url';
import { inspectProductBoundary } from '../packages/csaa/src/subject/product-boundary.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

try {
	const result = inspectProductBoundary(ROOT);
	const ok = result.inspectedFiles > 0 && result.violations.length === 0;
	process.stdout.write(`${JSON.stringify({ ...result, ok })}\n`);
	if (!ok) process.exitCode = 1;
} catch (error) {
	process.stderr.write(
		`${JSON.stringify({ error: 'product-boundary-failed', message: String(error) })}\n`
	);
	process.exitCode = 1;
}
