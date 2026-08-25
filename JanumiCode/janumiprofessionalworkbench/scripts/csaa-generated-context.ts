import { fileURLToPath } from 'node:url';
import {
	runGeneratedContextEvidence,
	type GeneratedContextEvidenceMode
} from '../packages/csaa/src/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const flags = process.argv.slice(2);
const selected = flags.filter((flag) => flag === '--write' || flag === '--check');

if (selected.length !== 1 || selected.length !== flags.length) {
	process.stderr.write(
		`${JSON.stringify({ error: 'usage', message: 'Use exactly one of --write or --check.' })}\n`
	);
	process.exitCode = 2;
} else {
	const mode = selected[0]!.slice(2) as GeneratedContextEvidenceMode;
	try {
		const result = runGeneratedContextEvidence({ mode, repositoryRoot: ROOT });
		process.stdout.write(
			`${JSON.stringify({
				difference: result.difference,
				mode: result.mode,
				ok: result.ok,
				subjectId: result.subjectId
			})}\n`
		);
		if (!result.ok) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(
			`${JSON.stringify({ error: 'generated-context-failed', message: String(error) })}\n`
		);
		process.exitCode = 1;
	}
}
