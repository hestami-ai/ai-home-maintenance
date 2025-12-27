/**
 * OpenTelemetry initialization
 * 
 * NOTE: This module is NOT used in production. DBOS SDK handles trace export.
 * The preload script (telemetry.cjs) registers auto-instrumentations.
 * 
 * This file is kept for potential future use in non-DBOS contexts.
 */

const isEnabled = process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

export async function initTelemetry(): Promise<void> {
	if (!isEnabled) {
		console.log('[Telemetry] Disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
		return;
	}

	// DBOS SDK handles OpenTelemetry trace export
	// See src/lib/server/dbos.ts for configuration
	console.log('[Telemetry] DBOS SDK handles trace export. No additional initialization needed.');
}

export async function shutdownTelemetry(): Promise<void> {
	// DBOS SDK handles shutdown
}
