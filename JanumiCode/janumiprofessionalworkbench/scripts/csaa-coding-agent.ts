import { fileURLToPath } from 'node:url';

import { runCodingAgentProcessHost } from '../packages/csaa/src/cli/run-coding-agent-process-host.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../', import.meta.url));

process.stdout.on('error', () => {
	// A closed consumer cannot receive the already-determined versioned result.
});
process.stderr.on('error', () => {
	// Diagnostics are best effort after a downstream pipe closes.
});

process.exitCode = await runCodingAgentProcessHost({ repositoryRoot: REPOSITORY_ROOT });
