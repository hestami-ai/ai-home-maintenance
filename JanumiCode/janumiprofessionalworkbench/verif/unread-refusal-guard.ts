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
	// The message is scanned too — `.stack` starts `Error: <message>` — so it must never look like a test frame.
	const frames = (new Error('stack probe').stack ?? '').match(/[^\s()]+\.test\.ts:\d+:\d+/g);
	if (!frames) return '(no test frame)';
	return frames
		.slice(0, 2)
		.map((f) => /([\w.-]+\.test\.ts:\d+)/.exec(f)?.[1] ?? f)
		.join(' <- ');
}

/** Wrap one refused result so the first property read marks it seen. ACCEPTED results are returned untouched. */
function watch(result: CommandResult, command: DomainCommand): CommandResult {
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
}

// ⚠ THE SEAM IS `as`, NOT `dispatch`, AND THIS GUARD WAS DEAD FOR TWO DAYS BECAUSE IT WAS THE OTHER WAY ROUND.
//
// As written on 2026-08-03 this file patched `Engine.prototype.dispatch`. On 2026-08-07 the D-1 trust boundary
// (REG-D-027/REG-D-028) made the SESSION the only thing that can dispatch: `Engine` no longer has a public
// `dispatch` at all — `as(credential)` returns a handle whose `dispatch` is a CLOSURE over the private
// `dispatchAs`. So the prototype patch became an assignment to a property nobody calls, `original` became
// `undefined`, and the ratchet caught nothing while every test stayed green. Measured, not inferred: a probe that
// left a refusal wholly unread PASSED.
//
// AND THE ALARM EXISTED AND NOBODY HEARD IT. `Engine.prototype.dispatch` is a TYPE ERROR after that refactor —
// *"Property 'dispatch' does not exist on type 'Engine'"* — sitting in this file the whole time. `verif/` was
// outside `check-types` (no tsconfig included it; the root one has `include: []`), and vitest transpiles without
// typechecking. See REG-F-097: the missing type gate is what let a standing ratchet die silently.
//
// Wrapping `as` is also the more durable seam: it is PUBLIC and it is the documented way to obtain a dispatcher,
// so a further refactor of the internals cannot silently detach the guard again — and if `as` itself moves, the
// type gate now reddens.
const originalAs = Engine.prototype.as;

Engine.prototype.as = function patchedAs(this: Engine, credential: Parameters<Engine['as']>[0]) {
	const session = originalAs.call(this, credential);
	const dispatch = session.dispatch;
	return {
		...session,
		dispatch: (command: DomainCommand): CommandResult => watch(dispatch(command), command)
	};
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
