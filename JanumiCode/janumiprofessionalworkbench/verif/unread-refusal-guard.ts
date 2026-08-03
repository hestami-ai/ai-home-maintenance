// THE UNREAD-REFUSAL GUARD — REG-F-015's standing half.
//
// WHAT IT ENFORCES: a test may not dispatch a command, have the engine REFUSE it, and never look at the result.
// Such a dispatch is an arrangement whose failure the test could not possibly have noticed.
//
// WHY IT EXISTS. `floor-waiver-scope.test.ts` was written to prove RPH-GOV-005 at the call site. It seeded no
// assurance policies, so every `RequestAssuranceAssessment` it issued was refused, no assessment aggregate was
// ever created, and NO FLOOR WAS EVER RECORDED. Both its tests passed for months — because a PWA with no floor is
// refused publication for MISSING, which is also REJECTED with RPH_INVARIANT_VIOLATION. The assertions were TRUE,
// about a different refusal. That is not a weak assertion; it is a correct assertion about an arrangement that was
// never built, and no amount of strengthening the assertions would have caught it. Twelve refusals went unread in
// that one file.
//
// THE SWEEP THAT FOLLOWED found the corpus otherwise clean: of 409 refusals across rph-application and rph-engine,
// six were unread, and all six were DELIBERATE — a command expected to be refused, with the assertion placed on
// its effect ("no partial write", "exactly one ACTIVE plan"). Each of those six now asserts its refusal directly,
// which strengthened them anyway: an effect assertion alone cannot distinguish "refused" from "accepted and did
// nothing". So this guard lands with NO allowlist, which is the property that makes it a ratchet rather than a
// snapshot — a new unread refusal has nowhere to hide.
//
// HOW: `dispatch` is wrapped, and a REFUSAL is returned as a Proxy that records the first property read. Reading
// anything counts — `expect(r.status)`, `r.error?.code`, a spread — because any read means the test had the
// failure in hand. ACCEPTED results are returned untouched, so the common path is unwrapped and identity-safe.
//
// WHAT IT CANNOT SEE, stated because a guard whose limits are unstated gets read as covering more than it does:
// this catches an arrangement that was REFUSED and ignored. It does NOT catch one that was ACCEPTED and WRONG.
// The same file had two further shields of exactly that kind — the floor recorded against version 1 while the PWA
// had moved to 2, and no observations recorded so there was nothing to waive — and this guard would have been
// blind to both. It closes the shield that fired first, not the class.
import { afterEach, expect } from 'vitest';
import { Engine } from '@janumipwb/rph-application';
import type { CommandResult, DomainCommand } from '@janumipwb/rph-contracts';

interface PendingRefusal {
	read: boolean;
	readonly commandType: string;
	readonly aggregateId: string;
	readonly frame: string;
}

const pending: PendingRefusal[] = [];

/** The shallowest `*.test.ts` frame — the line that issued the command, or the helper that issued it for a test. */
function testFrame(): string {
	const frames = (new Error().stack ?? '').match(/[^\s()]+\.test\.ts:\d+:\d+/g);
	if (!frames) return '(no test frame)';
	return frames
		.slice(0, 2)
		.map((f) => /([\w.-]+\.test\.ts:\d+)/.exec(f)?.[1] ?? f)
		.join(' <- ');
}

const original = Engine.prototype.dispatch;

Engine.prototype.dispatch = function patchedDispatch(
	this: Engine,
	command: DomainCommand
): CommandResult {
	const result = original.call(this, command);
	if (result.status === 'ACCEPTED') return result;
	const entry: PendingRefusal = {
		read: false,
		commandType: String(command.commandType),
		aggregateId: String(command.targetAggregateId),
		frame: testFrame()
	};
	pending.push(entry);
	return new Proxy(result, {
		get(target, key, receiver) {
			entry.read = true;
			return Reflect.get(target, key, receiver);
		}
	}) as CommandResult;
};

afterEach(() => {
	const unread = pending.filter((e) => !e.read);
	pending.length = 0;
	expect(
		unread.map((e) => `${e.commandType} -> ${e.aggregateId}  at ${e.frame}`),
		'DISPATCH REFUSED AND NEVER READ. The engine rejected this command and the test never looked at the ' +
			'result, so if it was an arrangement, the arrangement did not happen and nothing here could tell. ' +
			'Assert the refusal (`expect(r.status).toBe(\'REJECTED\')`) if it is deliberate, or fix the arrangement. ' +
			'See REG-F-015.'
	).toEqual([]);
});
