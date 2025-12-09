/**
 * OpenTelemetry initialization using dynamic imports to handle ESM/CommonJS compatibility
 */

const isEnabled = process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any = null;

export async function initTelemetry(): Promise<void> {
	if (!isEnabled) {
		console.log('OpenTelemetry disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
		return;
	}

	try {
		// Dynamic imports to handle ESM/CommonJS compatibility
		const [
			{ NodeSDK },
			{ getNodeAutoInstrumentations },
			{ OTLPTraceExporter },
			{ resourceFromAttributes }
		] = await Promise.all([
			import('@opentelemetry/sdk-node'),
			import('@opentelemetry/auto-instrumentations-node'),
			import('@opentelemetry/exporter-trace-otlp-http'),
			import('@opentelemetry/resources')
		]);

		// Use resourceFromAttributes (newer API) instead of Resource class
		const resource = resourceFromAttributes({
			'service.name': process.env.OTEL_SERVICE_NAME || 'hestami-ai-os',
			'service.version': process.env.npm_package_version || '0.0.1'
		});

		const traceExporter = new OTLPTraceExporter({
			url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
		});

		sdk = new NodeSDK({
			resource,
			traceExporter,
			instrumentations: [
				getNodeAutoInstrumentations({
					'@opentelemetry/instrumentation-fs': { enabled: false }
				})
			]
		});

		sdk.start();
		console.log('OpenTelemetry initialized');

		// Graceful shutdown
		process.on('SIGTERM', () => {
			sdk
				?.shutdown()
				.then(() => console.log('OpenTelemetry shut down'))
				.catch((err: Error) => console.error('OpenTelemetry shutdown error', err));
		});
	} catch (error) {
		console.error('Failed to initialize OpenTelemetry:', error);
	}
}

export async function shutdownTelemetry(): Promise<void> {
	if (sdk) {
		return sdk.shutdown();
	}
}
