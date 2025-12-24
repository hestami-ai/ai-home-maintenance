import { DBOS } from '@dbos-inc/dbos-sdk';

// DBOS initialization - called once at server startup
let initialized = false;

export async function initDBOS(): Promise<void> {
	if (initialized) return;

	// IMPORTANT: Import all workflows BEFORE calling DBOS.launch()
	// This ensures all DBOS.registerWorkflow() calls happen before launch
	// Workflows use DBOS.registerWorkflow() at module load time
	await import('./workflows/index.js');

	// Configure DBOS with OpenTelemetry integration
	// When OTEL_EXPORTER_OTLP_ENDPOINT is set, enable DBOS's built-in OTLP export
	// This ensures DBOS workflow spans are correlated with HTTP request spans
	const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
	
	DBOS.setConfig({
		name: 'hestami-ai-os',
		systemDatabaseUrl: process.env.DBOS_SYSTEM_DATABASE_URL,
		adminPort: 3001,
		// Enable DBOS OpenTelemetry when endpoint is configured
		enableOTLP: !!otlpEndpoint,
		otlpTracesEndpoints: otlpEndpoint ? [`${otlpEndpoint}/v1/traces`] : undefined,
		otlpLogsEndpoints: otlpEndpoint ? [`${otlpEndpoint}/v1/logs`] : undefined
	});

	await DBOS.launch();
	initialized = true;

	console.log('[DBOS] Workflow engine initialized', otlpEndpoint ? '(OTLP enabled)' : '(OTLP disabled)');
}

export { DBOS };
