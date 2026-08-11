import { fileURLToPath } from 'node:url';
import { runInventory, type InventoryMode } from '../packages/csaa/src/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const flags = process.argv.slice(2);
const selected = flags.filter((flag) => ['--write', '--check', '--json'].includes(flag));

if (selected.length !== 1 || selected.length !== flags.length) {
	process.stderr.write(
		`${JSON.stringify({ error: 'usage', message: 'Use exactly one of --write, --check, or --json.' })}\n`
	);
	process.exitCode = 2;
} else {
	const mode = selected[0]!.slice(2) as InventoryMode;
	try {
		const result = runInventory({ mode, repositoryRoot: ROOT, requireJpwbPopulations: true });
		if (mode === 'json') {
			process.stdout.write(result.json);
		} else {
			process.stdout.write(
				`${JSON.stringify({
					differences: result.differences,
					mode: result.mode,
					ok: result.ok,
					subjectId: result.subjectId
				})}\n`
			);
			if (!result.ok) process.exitCode = 1;
		}
	} catch (error) {
		process.stderr.write(`${JSON.stringify({ error: 'inventory-failed', message: String(error) })}\n`);
		process.exitCode = 1;
	}
}
