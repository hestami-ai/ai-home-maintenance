/**
 * Cross-platform launcher for the Ollama-backed prompt-regression probes.
 * Sets OLLAMA_PROBE=1 and forwards any extra args to vitest.
 *
 *   node scripts/runOllamaProbes.js
 *   node scripts/runOllamaProbes.js src/test/scenarios/ollama/decomposing.ollama.test.ts
 */

'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
// Probes chain by reading prior probes' saved outputs from
// test-output/ollama-probes/. Vitest's default parallel file execution
// starts downstream probes before their upstream files exist, so the
// downstream probes throw "Upstream probe output missing". To avoid that
// without depending on test ordering, we run each probe file as its own
// vitest invocation in a fixed dependency order. Each invocation only
// kicks off after the previous one finishes.
//
// If the user passes explicit targets, we run those (still serially) and
// skip the default chain.
const PROBE_CHAIN = [
	'src/test/scenarios/ollama/technicalAnalysis.ollama.test.ts',
	'src/test/scenarios/ollama/decomposing.ollama.test.ts',
	'src/test/scenarios/ollama/modeling.ollama.test.ts',
	'src/test/scenarios/ollama/designing.ollama.test.ts',
	'src/test/scenarios/ollama/rad.ollama.test.ts',
	'src/test/scenarios/ollama/sequencing.ollama.test.ts',
	'src/test/scenarios/ollama/goalAlignment.ollama.test.ts',
	// Self-contained probes — no upstream dependency, but kept serial to
	// keep the Ollama server doing one thing at a time.
	'src/test/scenarios/ollama/designJsonRepair.ollama.test.ts',
];
const targets = args.length > 0 ? args : PROBE_CHAIN;

const env = { ...process.env, OLLAMA_PROBE: '1' };
const isWindows = process.platform === 'win32';
const vitestBin = path.join(
	'node_modules',
	'.bin',
	isWindows ? 'vitest.cmd' : 'vitest'
);

const failures = [];
for (const target of targets) {
	console.log(`\n[runOllamaProbes] → ${target}`);
	const result = spawnSync(vitestBin, ['run', target], {
		stdio: 'inherit',
		env,
		shell: isWindows,
	});
	if ((result.status ?? 1) !== 0) {
		failures.push(target);
		// Continue running downstream probes anyway — a missing upstream
		// will be reported clearly, and other probes (e.g. designJsonRepair)
		// don't need any upstream.
	}
}

console.log(`\n[runOllamaProbes] done. ${targets.length - failures.length}/${targets.length} probes passed.`);
if (failures.length > 0) {
	console.log('[runOllamaProbes] failed probes:');
	for (const f of failures) console.log(`  - ${f}`);
	process.exit(1);
}
process.exit(0);
