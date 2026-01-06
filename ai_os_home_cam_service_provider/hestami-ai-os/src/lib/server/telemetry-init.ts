/**
 * OpenTelemetry SDK initialization for Bun runtime
 * 
 * IMPORTANT: This module MUST be imported FIRST in hooks.server.ts
 * before any other imports that might use @opentelemetry/api.
 * 
 * Uses lower-level OTel APIs instead of NodeSDK because NodeSDK
 * doesn't properly register the tracer provider globally under Bun.
 * 
 * This ensures:
 * 1. Manual spans created in hooks.server.ts are exported
 * 2. DBOS workflow spans are correlated (DBOS uses the global provider)
 * 3. Winston logs include trace context (via OpenTelemetryTransportV3)
 * 
 * Note: Node.js auto-instrumentations (http, pg) don't work in Bun
 * because Bun doesn't support Node.js module loading hooks.
 * Log export is handled by Winston's OpenTelemetryTransportV3, not here.
 */

import { trace, DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';

const isEnabled = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME || 'hestami-ai-os';
const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk: NodeSDK | null = null;

if (isEnabled && baseEndpoint) {
	// Enable diagnostic logging for debugging OTel issues
	if (process.env.OTEL_DEBUG === 'true') {
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
	}

	console.log(`[OTel Init] Initializing OpenTelemetry...`);
	console.log(`[OTel Init] Service: ${serviceName}`);
	console.log(`[OTel Init] OTLP Endpoint: ${baseEndpoint}`);

	// Create resource with service metadata
	const resource = resourceFromAttributes({
		'service.name': serviceName,
		'service.version': process.env.npm_package_version || '0.0.1',
		'deployment.environment': process.env.NODE_ENV || 'development'
	});

	// Create trace exporter
	const traceExporter = new OTLPTraceExporter({
		url: `${baseEndpoint}/v1/traces`
	});

	// Initialize SDK - no auto-instrumentations (don't work in Bun)
	sdk = new NodeSDK({
		resource,
		traceExporter
	});

	// Start the SDK synchronously
	sdk.start();

	console.log(`[OTel Init] SDK started`);

	// Verify registration by checking the tracer provider
	const provider = trace.getTracerProvider();
	// The ProxyTracerProvider wraps the actual provider
	const delegate = (provider as { _delegate?: unknown })._delegate;
	console.log(`[OTel Init] Provider: ${provider.constructor.name}`);
	console.log(`[OTel Init] Delegate: ${delegate ? (delegate as object).constructor.name : 'none'}`);

	// Test creating a span to verify it works
	const testTracer = trace.getTracer('otel-init-test');
	const testSpan = testTracer.startSpan('otel-init-verification');
	testSpan.setAttribute('test', true);
	testSpan.end();
	console.log(`[OTel Init] Test span created and ended`);

	// Graceful shutdown
	const shutdown = async () => {
		console.log('[OTel Init] Shutting down...');
		try {
			await sdk?.shutdown();
			console.log('[OTel Init] Shutdown complete');
		} catch (err) {
			console.error('[OTel Init] Shutdown error:', err);
		}
	};

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
} else {
	console.log('[OTel Init] Disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}

export { sdk };
