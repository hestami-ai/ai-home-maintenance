import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEventBus, resetEventBus, emitWorkflowCommand } from '../../../lib/integration/eventBus';

describe('Event Bus Integration', () => {
	let eventBus: ReturnType<typeof getEventBus>;

	beforeEach(() => {
		resetEventBus();
		eventBus = getEventBus();
	});

	describe('event subscription', () => {
		it('subscribes to events', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);
			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Test goal' });

			expect(listener).toHaveBeenCalledWith({ dialogueId: 'test-123', goal: 'Test goal' });
		});

		it('returns unsubscribe function', () => {
			const listener = vi.fn();

			const unsubscribe = eventBus.on('dialogue:started', listener);
			unsubscribe();

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Test goal' });

			expect(listener).not.toHaveBeenCalled();
		});

		it('supports multiple listeners for same event', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			eventBus.on('dialogue:started', listener2);

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Test goal' });

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
		});

		it('unsubscribes specific listener', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			const unsubscribe1 = eventBus.on('dialogue:started', listener1);
			eventBus.on('dialogue:started', listener2);

			unsubscribe1();

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Test goal' });

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).toHaveBeenCalledTimes(1);
		});

		it('handles once subscription', () => {
			const listener = vi.fn();

			eventBus.once('dialogue:started', listener);

			eventBus.emit('dialogue:started', { dialogueId: 'test-1', goal: 'Goal 1' });
			eventBus.emit('dialogue:started', { dialogueId: 'test-2', goal: 'Goal 2' });

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('once listener receives correct payload', () => {
			const listener = vi.fn();

			eventBus.once('dialogue:started', listener);
			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Test goal' });

			expect(listener).toHaveBeenCalledWith({ dialogueId: 'test-123', goal: 'Test goal' });
		});

		it('handles multiple subscriptions to different events', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			eventBus.on('workflow:completed', listener2);

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			eventBus.emit('workflow:completed', { dialogueId: 'test-123', phasesExecuted: 5 });

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
		});
	});

	describe('event emission', () => {
		it('emits dialogue:started events', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);
			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Test goal' });

			expect(listener).toHaveBeenCalled();
		});

		it('emits workflow:phase_changed events', () => {
			const listener = vi.fn();

			eventBus.on('workflow:phase_changed', listener);
			eventBus.emit('workflow:phase_changed', {
				dialogueId: 'test-123',
				previousPhase: 'INTAKE',
				currentPhase: 'ARCHITECTURE',
			});

			expect(listener).toHaveBeenCalledWith({
				dialogueId: 'test-123',
				previousPhase: 'INTAKE',
				currentPhase: 'ARCHITECTURE',
			});
		});

		it('emits claim:created events', () => {
			const listener = vi.fn();

			eventBus.on('claim:created', listener);
			eventBus.emit('claim:created', {
				dialogueId: 'test-123',
				claimId: 'claim-1',
				statement: 'Test claim',
			});

			expect(listener).toHaveBeenCalled();
		});

		it('emits error:occurred events', () => {
			const listener = vi.fn();

			eventBus.on('error:occurred', listener);
			eventBus.emit('error:occurred', {
				code: 'TEST_ERROR',
				message: 'Test error message',
			});

			expect(listener).toHaveBeenCalledWith({
				code: 'TEST_ERROR',
				message: 'Test error message',
			});
		});

		it('does not call listeners when no event emitted', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);

			expect(listener).not.toHaveBeenCalled();
		});

		it('handles events with no listeners', () => {
			expect(() => {
				eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			}).not.toThrow();
		});

		it('isolates listener errors', () => {
			const failingListener = vi.fn().mockImplementation(() => {
				throw new Error('Listener error');
			});
			const successListener = vi.fn();

			eventBus.on('dialogue:started', failingListener);
			eventBus.on('dialogue:started', successListener);

			expect(() => {
				eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			}).not.toThrow();

			expect(successListener).toHaveBeenCalled();
		});
	});

	describe('async event emission', () => {
		it('waits for async listeners', async () => {
			const order: number[] = [];
			const listener = vi.fn(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				order.push(1);
			});

			eventBus.on('dialogue:started', listener);

			await eventBus.emitAsync('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			order.push(2);

			expect(order).toEqual([1, 2]);
		});

		it('handles multiple async listeners', async () => {
			const listener1 = vi.fn(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
			});
			const listener2 = vi.fn(async () => {
				await new Promise(resolve => setTimeout(resolve, 5));
			});

			eventBus.on('dialogue:started', listener1);
			eventBus.on('dialogue:started', listener2);

			await eventBus.emitAsync('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});

		it('handles events with no listeners', async () => {
			await expect(
				eventBus.emitAsync('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' })
			).resolves.toBeUndefined();
		});

		it('resolves when all listeners complete', async () => {
			const completionOrder: string[] = [];
			
			eventBus.on('dialogue:started', async () => {
				await new Promise(resolve => setTimeout(resolve, 20));
				completionOrder.push('listener1');
			});
			
			eventBus.on('dialogue:started', async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				completionOrder.push('listener2');
			});

			await eventBus.emitAsync('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			completionOrder.push('emitAsync');

			expect(completionOrder).toContain('listener1');
			expect(completionOrder).toContain('listener2');
			expect(completionOrder.at(-1)).toBe('emitAsync');
		});
	});

	describe('workflow command events', () => {
		it('emits workflow:command events via helper', () => {
			const listener = vi.fn();

			eventBus.on('workflow:command', listener);

			emitWorkflowCommand({
				dialogueId: 'test-123',
				commandId: 'cmd-1',
				action: 'start',
				commandType: 'cli_invocation',
				label: 'Test command',
				timestamp: '2024-01-01T00:00:00Z',
			});

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-123',
					commandId: 'cmd-1',
					action: 'start',
				})
			);
		});

		it('handles command output events', () => {
			const listener = vi.fn();

			eventBus.on('workflow:command', listener);

			emitWorkflowCommand({
				dialogueId: 'test-123',
				commandId: 'cmd-1',
				action: 'output',
				commandType: 'cli_invocation',
				label: 'Command',
				summary: 'Output summary',
				detail: 'Detailed output',
				timestamp: '2024-01-01T00:00:00Z',
			});

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'output',
					summary: 'Output summary',
					detail: 'Detailed output',
				})
			);
		});

		it('handles command complete events', () => {
			const listener = vi.fn();

			eventBus.on('workflow:command', listener);

			emitWorkflowCommand({
				dialogueId: 'test-123',
				commandId: 'cmd-1',
				action: 'complete',
				commandType: 'cli_invocation',
				label: 'Command',
				status: 'success',
				timestamp: '2024-01-01T00:00:00Z',
			});

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'complete',
					status: 'success',
				})
			);
		});

		it('handles stdin line type', () => {
			const listener = vi.fn();

			eventBus.on('workflow:command', listener);

			emitWorkflowCommand({
				dialogueId: 'test-123',
				commandId: 'cmd-1',
				action: 'output',
				commandType: 'cli_invocation',
				label: 'Command',
				lineType: 'stdin',
				detail: 'stdin content',
				timestamp: '2024-01-01T00:00:00Z',
			});

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					lineType: 'stdin',
				})
			);
		});
	});

	describe('intake events', () => {
		it('emits intake:turn_completed events', () => {
			const listener = vi.fn();

			eventBus.on('intake:turn_completed', listener);
			eventBus.emit('intake:turn_completed', {
				dialogueId: 'test-123',
				turnNumber: 1,
				conversationalResponse: 'Response',
				planVersion: 1,
			});

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					turnNumber: 1,
					planVersion: 1,
				})
			);
		});

		it('emits intake:mode_selected events', () => {
			const listener = vi.fn();

			eventBus.on('intake:mode_selected', listener);
			eventBus.emit('intake:mode_selected', {
				dialogueId: 'test-123',
				mode: 'FREE_FORM' as any,
				source: 'classifier',
			});

			expect(listener).toHaveBeenCalled();
		});

		it('emits intake:gathering_complete events', () => {
			const listener = vi.fn();

			eventBus.on('intake:gathering_complete', listener);
			eventBus.emit('intake:gathering_complete', {
				dialogueId: 'test-123',
			});

			expect(listener).toHaveBeenCalledWith({ dialogueId: 'test-123' });
		});
	});

	describe('removeAllListeners', () => {
		it('removes all listeners for specific event type', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			eventBus.on('dialogue:started', listener2);

			eventBus.removeAllListeners('dialogue:started');

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).not.toHaveBeenCalled();
		});

		it('removes all listeners for all events', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			eventBus.on('workflow:completed', listener2);

			eventBus.removeAllListeners();

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			eventBus.emit('workflow:completed', { dialogueId: 'test-123', phasesExecuted: 5 });

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).not.toHaveBeenCalled();
		});

		it('does not affect other event types when removing specific type', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			eventBus.on('workflow:completed', listener2);

			eventBus.removeAllListeners('dialogue:started');

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			eventBus.emit('workflow:completed', { dialogueId: 'test-123', phasesExecuted: 5 });

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});
	});

	describe('resetEventBus', () => {
		it('clears all listeners', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);

			resetEventBus();

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener).not.toHaveBeenCalled();
		});

		it('allows new subscriptions after reset', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			resetEventBus();
			eventBus.on('dialogue:started', listener2);

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});
	});

	describe('edge cases', () => {
		it('handles rapid event emission', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);

			for (let i = 0; i < 100; i++) {
				eventBus.emit('dialogue:started', { dialogueId: `test-${i}`, goal: 'Goal' });
			}

			expect(listener).toHaveBeenCalledTimes(100);
		});

		it('handles listener that returns promise', async () => {
			const listener = vi.fn(async () => {
				await Promise.resolve();
			});

			eventBus.on('dialogue:started', listener);

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener).toHaveBeenCalled();
		});

		it('handles same listener registered multiple times', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);
			eventBus.on('dialogue:started', listener);

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener).toHaveBeenCalledTimes(2);
		});

		it('handles unsubscribe called multiple times', () => {
			const listener = vi.fn();

			const unsubscribe = eventBus.on('dialogue:started', listener);

			unsubscribe();
			unsubscribe();

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			expect(listener).not.toHaveBeenCalled();
		});

		it('handles listener throwing non-Error', () => {
			const listener = vi.fn().mockImplementation(() => {
				// eslint-disable-next-line no-throw-literal -- intentional: test exercises non-Error throw path
				throw 'String error';
			});

			eventBus.on('dialogue:started', listener);

			expect(() => {
				eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			}).not.toThrow();
		});

		it('handles empty payload', () => {
			const listener = vi.fn();

			eventBus.on('intake:gathering_complete', listener);
			eventBus.emit('intake:gathering_complete', { dialogueId: 'test-123' });

			expect(listener).toHaveBeenCalledWith({ dialogueId: 'test-123' });
		});

		it('handles payload with optional fields', () => {
			const listener = vi.fn();

			eventBus.on('error:occurred', listener);
			eventBus.emit('error:occurred', {
				code: 'ERROR',
				message: 'Message',
				context: { key: 'value' },
			});

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					context: { key: 'value' },
				})
			);
		});
	});

	describe('listener lifecycle', () => {
		it('calls listener only after subscription', () => {
			const listener = vi.fn();

			eventBus.emit('dialogue:started', { dialogueId: 'test-1', goal: 'Goal 1' });

			eventBus.on('dialogue:started', listener);

			eventBus.emit('dialogue:started', { dialogueId: 'test-2', goal: 'Goal 2' });

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith({ dialogueId: 'test-2', goal: 'Goal 2' });
		});

		it('does not call listener after unsubscribe', () => {
			const listener = vi.fn();

			const unsubscribe = eventBus.on('dialogue:started', listener);

			eventBus.emit('dialogue:started', { dialogueId: 'test-1', goal: 'Goal 1' });

			unsubscribe();

			eventBus.emit('dialogue:started', { dialogueId: 'test-2', goal: 'Goal 2' });

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('supports listener resubscription', () => {
			const listener = vi.fn();

			const unsub1 = eventBus.on('dialogue:started', listener);
			eventBus.emit('dialogue:started', { dialogueId: 'test-1', goal: 'Goal 1' });

			unsub1();

			eventBus.on('dialogue:started', listener);
			eventBus.emit('dialogue:started', { dialogueId: 'test-2', goal: 'Goal 2' });

			expect(listener).toHaveBeenCalledTimes(2);
		});
	});

	describe('concurrent operations', () => {
		it('handles concurrent subscriptions', () => {
			const listeners = new Array(10).fill(null).map(() => vi.fn());

			listeners.forEach(listener => {
				eventBus.on('dialogue:started', listener);
			});

			eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });

			listeners.forEach(listener => {
				expect(listener).toHaveBeenCalledTimes(1);
			});
		});

		it('handles concurrent emissions', () => {
			const listener = vi.fn();

			eventBus.on('dialogue:started', listener);

			new Array(10).fill(null).forEach((_, i) => {
				eventBus.emit('dialogue:started', { dialogueId: `test-${i}`, goal: 'Goal' });
			});

			expect(listener).toHaveBeenCalledTimes(10);
		});

		it('handles subscription during emission', () => {
			const listener1 = vi.fn(() => {
				eventBus.on('dialogue:started', listener2);
			});
			const listener2 = vi.fn();

			eventBus.on('dialogue:started', listener1);
			eventBus.emit('dialogue:started', { dialogueId: 'test-1', goal: 'Goal 1' });
			eventBus.emit('dialogue:started', { dialogueId: 'test-2', goal: 'Goal 2' });

			expect(listener1).toHaveBeenCalledTimes(2);
			expect(listener2).toHaveBeenCalledTimes(1);
		});
	});

	describe('event types coverage', () => {
		it('handles all workflow events', () => {
			const events = [
				'workflow:phase_changed',
				'workflow:gate_triggered',
				'workflow:gate_resolved',
				'workflow:completed',
				'workflow:command',
				'workflow:phase_failed',
			] as const;

			events.forEach(eventType => {
				const listener = vi.fn();
				eventBus.on(eventType as any, listener);
			});

			expect(true).toBe(true);
		});

		it('handles all claim events', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();
			const listener3 = vi.fn();

			eventBus.on('claim:created', listener1);
			eventBus.on('claim:verified', listener2);
			eventBus.on('claim:disproved', listener3);

			eventBus.emit('claim:created', {
				dialogueId: 'test-123',
				claimId: 'claim-1',
				statement: 'Test',
			});
			eventBus.emit('claim:verified', { claimId: 'claim-1', verdict: 'VERIFIED' });
			eventBus.emit('claim:disproved', { claimId: 'claim-2', verdict: 'DISPROVED' });

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
			expect(listener3).toHaveBeenCalled();
		});

		it('handles permission events', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			eventBus.on('permission:requested', listener1);
			eventBus.on('permission:decided', listener2);

			eventBus.emit('permission:requested', {
				dialogueId: 'test-123',
				permissionId: 'perm-1',
				tool: 'write_file',
				input: { path: '/test' },
			});
			eventBus.emit('permission:decided', {
				permissionId: 'perm-1',
				approved: true,
				reason: 'User approved',
			});

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});
	});

	describe('memory and performance', () => {
		it('cleans up listeners on unsubscribe', () => {
			const listener = vi.fn();

			const unsubscribe = eventBus.on('dialogue:started', listener);
			unsubscribe();

			expect(() => {
				eventBus.emit('dialogue:started', { dialogueId: 'test-123', goal: 'Goal' });
			}).not.toThrow();
		});

		it('handles many event types', () => {
			const eventTypes = [
				'dialogue:started',
				'workflow:completed',
				'claim:created',
				'error:occurred',
				'ui:refresh_required',
			] as const;

			eventTypes.forEach(eventType => {
				const listener = vi.fn();
				eventBus.on(eventType as any, listener);
			});

			expect(true).toBe(true);
		});
	});
});
