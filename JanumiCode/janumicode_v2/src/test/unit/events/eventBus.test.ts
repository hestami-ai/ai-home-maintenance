import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../lib/events/eventBus';

describe('EventBus', () => {
  it('emits and receives events', () => {
    const bus = new EventBus();
    let received = false;

    bus.on('workflow:started', () => { received = true; });
    bus.emit('workflow:started', { workflowRunId: 'run-1' });

    expect(received).toBe(true);
  });

  it('passes payload to handlers', () => {
    const bus = new EventBus();
    let payload: unknown;

    bus.on('phase:started', (p) => { payload = p; });
    bus.emit('phase:started', { phaseId: '1', phaseName: 'Intent Capture' });

    expect(payload).toEqual({ phaseId: '1', phaseName: 'Intent Capture' });
  });

  it('supports multiple handlers for same event', () => {
    const bus = new EventBus();
    let count = 0;

    bus.on('workflow:started', () => { count++; });
    bus.on('workflow:started', () => { count++; });
    bus.emit('workflow:started', { workflowRunId: 'run-1' });

    expect(count).toBe(2);
  });

  it('returns unsubscribe function', () => {
    const bus = new EventBus();
    let count = 0;

    const unsub = bus.on('workflow:started', () => { count++; });
    bus.emit('workflow:started', { workflowRunId: 'run-1' });
    expect(count).toBe(1);

    unsub();
    bus.emit('workflow:started', { workflowRunId: 'run-2' });
    expect(count).toBe(1); // Not incremented after unsubscribe
  });

  it('does not crash on emit with no handlers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('workflow:started', { workflowRunId: 'run-1' })).not.toThrow();
  });

  it('handles errors in handlers gracefully', () => {
    const bus = new EventBus();
    let secondCalled = false;

    bus.on('workflow:started', () => { throw new Error('handler error'); });
    bus.on('workflow:started', () => { secondCalled = true; });

    // Should not throw — error is caught
    bus.emit('workflow:started', { workflowRunId: 'run-1' });
    expect(secondCalled).toBe(true);
  });

  it('clears all handlers', () => {
    const bus = new EventBus();
    let count = 0;

    bus.on('workflow:started', () => { count++; });
    bus.on('phase:started', () => { count++; });
    bus.clear();

    bus.emit('workflow:started', { workflowRunId: 'run-1' });
    bus.emit('phase:started', { phaseId: '1', phaseName: 'test' });

    expect(count).toBe(0);
  });
});
