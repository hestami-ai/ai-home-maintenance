import { DBOS } from '@dbos-inc/dbos-sdk';

// DBOS initialization - called once at server startup
let initialized = false;

export async function initDBOS(): Promise<void> {
	if (initialized) return;

	// IMPORTANT: Import all workflows BEFORE calling DBOS.launch()
	// This ensures all DBOS.registerWorkflow() calls happen before launch
	// Workflows use DBOS.registerWorkflow() at module load time
	// We must access the exports to prevent tree-shaking/code-splitting
	const workflows = await import('./workflows/index.js');
	// Force evaluation of all workflow registrations by accessing each _v1 export
	// This prevents the bundler from lazy-loading workflow modules
	const workflowKeys = Object.keys(workflows).filter(k => k.endsWith('_v1'));
	for (const key of workflowKeys) {
		// Access each workflow to force module evaluation
		const wf = (workflows as Record<string, unknown>)[key];
		if (typeof wf !== 'function') {
			console.warn(`[DBOS] Workflow ${key} is not a function:`, typeof wf);
		}
	}
	console.log(`[DBOS] Loaded ${workflowKeys.length} workflow versions`);

	// Configure DBOS
	// NOTE: We disable DBOS's built-in OTLP because the preload script (telemetry.cjs)
	// already registers a global trace provider. DBOS would cause a "duplicate registration"
	// error if it tried to register its own. DBOS workflows will still create spans using
	// the global provider registered by our preload, and those spans will be exported.
	DBOS.setConfig({
		name: 'hestami-ai-os',
		systemDatabaseUrl: process.env.DBOS_SYSTEM_DATABASE_URL,
		adminPort: 3001,
		// Disable DBOS OTLP - preload script handles trace export
		enableOTLP: false
	});

	await DBOS.launch();
	initialized = true;

	console.log('[DBOS] Workflow engine initialized (OTLP handled by preload)');
}

export { DBOS };
