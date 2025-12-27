import { DBOS } from '@dbos-inc/dbos-sdk';

// DBOS initialization - called once at server startup
let initialized = false;

export async function initDBOS(): Promise<void> {
	if (initialized) return;

	// IMPORTANT: Import all workflows BEFORE calling DBOS.launch()
	// This ensures all DBOS.registerWorkflow() calls happen before launch
	// Workflows use DBOS.registerWorkflow() at module load time
	await import('./workflows/index.js');

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
