/**
 * Event Bus Logging Subscriber
 *
 * Auto-logs key event bus events at DEBUG level via the structured logger.
 * Wired during extension activation — invisible at default INFO level,
 * visible when the user sets janumicode.logLevel to "debug".
 */

import { getLogger } from './logger';
import { getEventBus } from '../integration/eventBus';

/**
 * Subscribe to key event bus events and log them.
 * Returns an unsubscribe function for cleanup.
 */
export function wireLoggingSubscriber(): () => void {
	const log = getLogger().child({ component: 'eventBus' });
	const bus = getEventBus();

	const unsubs = [
		// Workflow lifecycle
		bus.on('workflow:phase_changed', (p) => log.debug('Phase changed', p as Record<string, unknown>)),
		bus.on('workflow:gate_triggered', (p) => log.debug('Gate triggered', p as Record<string, unknown>)),
		bus.on('workflow:gate_resolved', (p) => log.debug('Gate resolved', p as Record<string, unknown>)),
		bus.on('workflow:completed', (p) => log.debug('Workflow completed', p as Record<string, unknown>)),
		bus.on('workflow:phase_failed', (p) => log.debug('Phase failed', p as Record<string, unknown>)),
		bus.on('workflow:command', (p) => log.debug('Command', p as Record<string, unknown>)),

		// Dialogue lifecycle
		bus.on('dialogue:started', (p) => log.debug('Dialogue started', p as Record<string, unknown>)),
		bus.on('dialogue:resumed', (p) => log.debug('Dialogue resumed', p as Record<string, unknown>)),
		bus.on('dialogue:title_updated', (p) => log.debug('Title updated', p as Record<string, unknown>)),

		// INTAKE events
		bus.on('intake:turn_completed', (p) => log.debug('Intake turn completed', p as Record<string, unknown>)),
		bus.on('intake:mode_selected', (p) => log.debug('Intake mode selected', p as Record<string, unknown>)),
		bus.on('intake:plan_finalized', (p) => log.debug('Plan finalized', p as Record<string, unknown>)),
		bus.on('intake:plan_approved', (p) => log.debug('Plan approved', p as Record<string, unknown>)),
		bus.on('intake:analysis_complete', (p) => log.debug('Analysis complete', p as Record<string, unknown>)),
		bus.on('intake:checkpoint_triggered', (p) => log.debug('Checkpoint triggered', p as Record<string, unknown>)),

		// CLI activity
		bus.on('cli:activity', (p) => log.debug('CLI activity', p as Record<string, unknown>)),

		// Claims & verdicts
		bus.on('claim:created', (p) => log.debug('Claim created', p as Record<string, unknown>)),
		bus.on('claim:verified', (p) => log.debug('Claim verified', p as Record<string, unknown>)),
		bus.on('claim:disproved', (p) => log.debug('Claim disproved', p as Record<string, unknown>)),

		// Errors
		bus.on('error:occurred', (p) => log.warn('Error event', p as Record<string, unknown>)),
	];

	return () => unsubs.forEach(fn => fn());
}
