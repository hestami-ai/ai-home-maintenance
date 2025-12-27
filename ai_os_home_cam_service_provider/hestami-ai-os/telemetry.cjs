/**
 * OpenTelemetry preload script - loaded via NODE_OPTIONS="--require ./telemetry.cjs"
 * Must be CommonJS and load BEFORE the app starts.
 * 
 * This script initializes the OTel SDK with a trace provider and exporter BEFORE
 * DBOS SDK loads. DBOS will detect the existing provider and skip its own registration.
 * 
 * This ensures that:
 * 1. HTTP spans from hooks.server.ts are exported
 * 2. DBOS workflow spans are exported (DBOS uses the global provider)
 * 3. Auto-instrumentations (pg, http) create spans that get exported
 * 4. Console output is captured and sent via OTel logs API
 */

const isEnabled = process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

// Store original console methods before any overrides
const originalConsole = {
	log: console.log.bind(console),
	info: console.info.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console)
};

originalConsole.log(`[OTel Preload] OTEL_EXPORTER_OTLP_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'NOT SET'}`);
originalConsole.log(`[OTel Preload] OTEL_SERVICE_NAME: ${process.env.OTEL_SERVICE_NAME || 'NOT SET'}`);

if (isEnabled) {
	const { NodeSDK } = require('@opentelemetry/sdk-node');
	const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
	const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
	const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
	const { resourceFromAttributes } = require('@opentelemetry/resources');
	const { SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');

	const serviceName = process.env.OTEL_SERVICE_NAME || 'hestami-ai-os';
	const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
	const traceExporterUrl = `${baseEndpoint}/v1/traces`;
	const logExporterUrl = `${baseEndpoint}/v1/logs`;

	console.log(`[OTel Preload] Service: ${serviceName}`);
	console.log(`[OTel Preload] Trace Exporter: ${traceExporterUrl}`);
	console.log(`[OTel Preload] Log Exporter: ${logExporterUrl}`);

	const resource = resourceFromAttributes({
		'service.name': serviceName,
		'service.version': process.env.npm_package_version || '0.0.1'
	});

	const traceExporter = new OTLPTraceExporter({
		url: traceExporterUrl
	});

	const logExporter = new OTLPLogExporter({
		url: logExporterUrl
	});

	const sdk = new NodeSDK({
		resource,
		traceExporter,
		logRecordProcessors: [new SimpleLogRecordProcessor(logExporter)],
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
	originalConsole.log('[OTel Preload] SDK initialized - trace and log providers registered');

	// Override console methods to also emit OTel log records
	// This captures DBOS SDK logs and any other console output
	const { logs, SeverityNumber } = require('@opentelemetry/api-logs');
	const otelLogger = logs.getLogger(serviceName);

	const severityMap = {
		debug: SeverityNumber.DEBUG,
		log: SeverityNumber.INFO,
		info: SeverityNumber.INFO,
		warn: SeverityNumber.WARN,
		error: SeverityNumber.ERROR
	};

	function createConsoleOverride(level) {
		return function(...args) {
			// Always call original console method
			originalConsole[level](...args);
			
			// Emit OTel log record
			try {
				const message = args.map(arg => 
					typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
				).join(' ');
				
				otelLogger.emit({
					severityNumber: severityMap[level],
					severityText: level.toUpperCase(),
					body: message,
					attributes: {
						'log.source': 'console',
						'service.name': serviceName
					}
				});
			} catch (e) {
				// Ignore errors in log emission to avoid infinite loops
			}
		};
	}

	console.log = createConsoleOverride('log');
	console.info = createConsoleOverride('info');
	console.warn = createConsoleOverride('warn');
	console.error = createConsoleOverride('error');
	console.debug = createConsoleOverride('debug');

	originalConsole.log('[OTel Preload] Console methods overridden for OTel log export');

	process.on('SIGTERM', () => {
		sdk.shutdown()
			.then(() => originalConsole.log('[OTel Preload] SDK shut down'))
			.catch((err) => originalConsole.error('[OTel Preload] Shutdown error', err));
	});
} else {
	console.log('[OTel Preload] Disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}
