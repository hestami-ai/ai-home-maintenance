/**
 * OpenTelemetry preload script - loaded via NODE_OPTIONS="--require ./telemetry.cjs"
 * Must be CommonJS and load BEFORE the app starts
 */

const isEnabled = process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

if (isEnabled) {
	const { NodeSDK } = require('@opentelemetry/sdk-node');
	const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
	const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
	const resources = require('@opentelemetry/resources');

	// Handle ESM/CommonJS compatibility - resourceFromAttributes is the newer API
	const resourceFromAttributes = resources.resourceFromAttributes || resources.default?.resourceFromAttributes;
	
	const resource = resourceFromAttributes({
		'service.name': process.env.OTEL_SERVICE_NAME || 'hestami-ai-os',
		'service.version': process.env.npm_package_version || '0.0.1'
	});

	const traceExporter = new OTLPTraceExporter({
		url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
	});

	const sdk = new NodeSDK({
		resource,
		traceExporter,
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-fs': { enabled: false },
				// Ensure HTTP instrumentation captures incoming requests
				'@opentelemetry/instrumentation-http': {
					enabled: true,
					ignoreIncomingRequestHook: (request) => {
						// Ignore health checks and static assets
						const url = request.url || '';
						return url.includes('/_app/') || url.includes('/favicon') || url === '/health';
					}
				},
				// Ensure pg instrumentation is enabled for database queries
				'@opentelemetry/instrumentation-pg': {
					enabled: true,
					enhancedDatabaseReporting: true
				}
			})
		]
	});

	sdk.start();
	console.log('OpenTelemetry initialized (preload)');

	process.on('SIGTERM', () => {
		sdk.shutdown()
			.then(() => console.log('OpenTelemetry shut down'))
			.catch((err) => console.error('OpenTelemetry shutdown error', err));
	});
} else {
	console.log('OpenTelemetry disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}
