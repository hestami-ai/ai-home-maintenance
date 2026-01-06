/**
 * OpenTelemetry preload script for Bun runtime
 * Loaded via BUN_PRELOAD="./telemetry.ts" or --preload flag
 * Must load BEFORE the app starts.
 *
 * This script initializes the OTel SDK with a trace provider and exporter BEFORE
 * DBOS SDK loads. DBOS will detect the existing provider and skip its own registration.
 *
 * This ensures that:
 * 1. HTTP spans from hooks.server.ts are exported
 * 2. DBOS workflow spans are exported (DBOS uses the global provider)
 * 3. Auto-instrumentations (pg, http) create spans that get exported
 *
 * Note: Log export is handled by Winston's OpenTelemetryTransportV3, not here.
 */

// Make this a module for top-level await support
export {};

const isEnabled = process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

console.log(
	`[OTel Preload] OTEL_EXPORTER_OTLP_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'NOT SET'}`
);
console.log(`[OTel Preload] OTEL_SERVICE_NAME: ${process.env.OTEL_SERVICE_NAME || 'NOT SET'}`);

if (isEnabled) {
	const { NodeSDK } = await import('@opentelemetry/sdk-node');
	const { getNodeAutoInstrumentations } = await import(
		'@opentelemetry/auto-instrumentations-node'
	);
	const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto');
	const { resourceFromAttributes } = await import('@opentelemetry/resources');

	const serviceName = process.env.OTEL_SERVICE_NAME || 'hestami-ai-os';
	const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
	const traceExporterUrl = `${baseEndpoint}/v1/traces`;

	console.log(`[OTel Preload] Service: ${serviceName}`);
	console.log(`[OTel Preload] Trace Exporter: ${traceExporterUrl}`);

	const resource = resourceFromAttributes({
		'service.name': serviceName,
		'service.version': process.env.npm_package_version || '0.0.1'
	});

	const traceExporter = new OTLPTraceExporter({
		url: traceExporterUrl
	});

	// Note: No log exporter here - Winston's OpenTelemetryTransportV3 handles log export
	// to avoid duplicate logs in SigNoz
	const sdk = new NodeSDK({
		resource,
		traceExporter,
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-fs': { enabled: false },
				'@opentelemetry/instrumentation-http': {
					enabled: true,
					ignoreIncomingRequestHook: (request) => {
						const url = request.url || '';
						return url.includes('/_app/') || url.includes('/favicon') || url === '/health';
					}
				},
				'@opentelemetry/instrumentation-pg': {
					enabled: true,
					enhancedDatabaseReporting: true
				}
			})
		]
	});

	sdk.start();
	console.log('[OTel Preload] SDK initialized - trace provider registered');

	// Graceful shutdown handlers
	const shutdown = () => {
		sdk
			.shutdown()
			.then(() => console.log('[OTel Preload] SDK shut down'))
			.catch((err) => console.error('[OTel Preload] Shutdown error', err));
	};

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
} else {
	console.log('[OTel Preload] Disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}
