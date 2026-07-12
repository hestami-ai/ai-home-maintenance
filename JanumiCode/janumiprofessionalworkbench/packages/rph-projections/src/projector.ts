// The projection framework. A Projector folds the event stream (in global order) into a read-model VIEW.
// Views are DATA, never a write target, never rendered, and always rebuildable from events — commands never
// validate against them and projection lag never affects canonical validation (RPH-PER-009). The engine
// emits events; surfaces render these views.
import type { DomainEvent } from '@janumipwb/rph-contracts';

export interface Projector<V> {
	readonly name: string;
	/** Bump when the fold logic changes so stale checkpoints trigger a rebuild. */
	readonly handlerVersion: number;
	initial(): V;
	/** Pure fold: view + event -> next view. */
	apply(view: V, event: DomainEvent): V;
}

/** Deterministically rebuild a view by folding events from empty. Rebuild-from-empty reproduces the view
 *  exactly (RPH-PER-007) — projections are disposable. */
export function rebuildProjection<V>(projector: Projector<V>, events: readonly DomainEvent[]): V {
	let view = projector.initial();
	for (const event of events) view = projector.apply(view, event);
	return view;
}

/**
 * Incremental projection with idempotency (by eventId) and a checkpoint (count of applied events). Applying
 * the same event twice is a no-op; `rebuild` drops all state and re-folds — the incremental result and the
 * full rebuild are identical.
 */
export class IncrementalProjection<V> {
	private view: V;
	private readonly appliedEventIds = new Set<string>();
	private appliedCount = 0;

	constructor(private readonly projector: Projector<V>) {
		this.view = projector.initial();
	}

	get handlerVersion(): number {
		return this.projector.handlerVersion;
	}
	get checkpoint(): number {
		return this.appliedCount;
	}
	current(): V {
		return this.view;
	}

	/** Apply an event once (idempotent by eventId). */
	apply(event: DomainEvent): void {
		if (this.appliedEventIds.has(event.eventId)) return;
		this.appliedEventIds.add(event.eventId);
		this.view = this.projector.apply(this.view, event);
		this.appliedCount += 1;
	}

	/** Full rebuild from an event stream (drops all prior state first). */
	rebuild(events: readonly DomainEvent[]): void {
		this.view = this.projector.initial();
		this.appliedEventIds.clear();
		this.appliedCount = 0;
		for (const event of events) this.apply(event);
	}
}
