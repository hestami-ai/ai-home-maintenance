// ── THE TWO PREMISES THE DECLARED GROUPS REST ON, MEASURED ACROSS THE WHOLE SUITE (`JAN-CRITREAD` `DD-6`) ────────────
//
// `REG-D-070` refuses a draft when an event after its fork touched a MEMBER of a declared group. Two properties have
// to hold for "a member" to mean anything, and the design (§5.1) states both as premises to be GATED rather than
// assumed:
//
//   1. A GROUP'S KEY FIELDS NEVER CHANGE AFTER BIRTH. `pwaId` on a conversation and on a PWU Type,
//      `subjectObjectIds` and `assurancePolicyId` on an assessment, `subjectObjectId` on an exchange. If one could
//      be rewritten, membership would depend on WHEN it was read: an aggregate could leave the set between the fork
//      and the commit and be refused for nothing, or join it unseen and commit over a change that matters.
//   2. EVERY COMMITTED STATE CHANGE CARRIES AN EVENT ON ITS OWN AGGREGATE. The commit check reads EVENTS after the
//      fork; a state change committed without one, or with one on a different aggregate, is a change the rule
//      cannot see. The kit does this today, and the adapter does not enforce it (`REG-F-046`).
//
// ⭑ MEASURED, NOT ASSERTED IN PROSE, and measured the way `emitted-event-guard.ts` measures its own ledger: by
// wrapping `commit` on every StorageAdapter the repository ships, so the population is whatever the SUITE commits —
// every handler, every scenario, in every package and app — rather than what one drive happens to reach.
//
// ⚠ THE KEY FIELDS ARE READ FROM THE TURN'S OWN DECLARATION (`declaredGroups`), not transcribed here: a group whose
// key changes, or a fifth group, is measured the moment it is declared. If that function is renamed or reshaped, this
// guard throws rather than measuring nothing — the failure mode `unread-refusal-guard` and this file's sibling both
// record (a guard that silently stops guarding is worse than no guard).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CommitInput, CommitResult } from '@janumipwb/rph-ports';
import { SqliteStorageAdapter, SnapshotOverlayStorageAdapter } from '@janumipwb/rph-persistence';
import { afterAll } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The declared groups, read from the turn's own source: `aggregateType` -> the key fields of that group. */
function declaredGroupKeyFields(): Map<string, string[]> {
	const source = readFileSync(`${ROOT}apps/rph-demo/src/lib/server/authoring-turn.ts`, 'utf8');
	const start = source.indexOf('function declaredGroups(');
	if (start < 0)
		throw new Error(
			'draft-dependency-premises: `declaredGroups` is gone from authoring-turn.ts, so the group keys cannot be ' +
				'read. This guard measures nothing until it is pointed at wherever the groups are declared now.'
		);
	const body = source.slice(start, source.indexOf('\n}', start));
	const groups = new Map<string, string[]>();
	for (const group of body.split('aggregateType:').slice(1)) {
		const type = /^\s*'([A-Z_]+)'/.exec(group)?.[1];
		const key = group.slice(0, group.indexOf('\n\t\t}'));
		const fields = [...key.matchAll(/field: '([A-Za-z0-9_]+)'/g)].map((m) => m[1]!);
		if (type && fields.length > 0) groups.set(type, fields);
	}
	if (groups.size === 0)
		throw new Error('draft-dependency-premises: no group keys were read from `declaredGroups`.');
	return groups;
}

/** Exported so this guard's own test can prove the declaration was READ, not silently missed. */
export const GROUP_KEY_FIELDS = declaredGroupKeyFields();

/** Liveness, exported so this guard's own test can prove it RAN — a guard that measures nothing passes silently. */
export const premiseLiveness = {
	commits: 0,
	groupCommits: 0,
	skippedNonHandler: 0,
	typesSeen: new Set<string>()
};
export const keyFieldRewrites: string[] = [];
export const stateChangesWithoutTheirOwnEvent: string[] = [];

/**
 * The key-field values an aggregate was BORN with — per STORE, then per aggregate id. Per store because ids are
 * deterministic in test mode: `pwut_…01` is born in dozens of files against dozens of engines, and keying by id alone
 * would report every one of them as a rewrite of the last.
 */
const bornWith = new WeakMap<object, Map<string, Record<string, string>>>();
const asComparable = (value: unknown) => JSON.stringify(value ?? null);

function checkCommit(store: object, input: CommitInput): void {
	// ⭑ ONLY COMMITS A HANDLER MADE. `rph-application`'s own fixtures stage state STRAIGHT THROUGH the adapter to put
	// a PWU in a lifecycle state a real command sequence would take pages to reach (`__tests__/pwu-fixtures.ts`,
	// `plan-fixtures.ts`): `events: []`, and a receipt that says what it is (`commandType: 'FixtureSeed…'`). They are
	// test scaffolding, not state changes this system makes, and counting them would put a scaffold in a defect ledger
	// — the correction `emitted-event-guard.ts` had to make for the same reason.
	//
	// `receipt.payloadHash` IS THE DISCRIMINATOR, and it is sound rather than convenient: the kit sets it on EVERY
	// handler commit (REG-F-012 clause 3, recomputed there rather than threaded through), the kit's `ctx.store.commit`
	// is the ONLY production commit site in this repository, and a hand-built fixture receipt has no reason to carry
	// one. So this rests on a property another finding made true, exactly as its sibling guard does.
	if (typeof input.receipt.payloadHash !== 'string') {
		premiseLiveness.skippedNonHandler += 1;
		return;
	}
	premiseLiveness.commits += 1;
	// PREMISE 2 — every committed state change carries an event, and every event it carries is on ITS OWN aggregate.
	if (input.events.length === 0)
		stateChangesWithoutTheirOwnEvent.push(`${input.objectType} ${input.aggregateId}: no event`);
	for (const event of input.events)
		if (event.aggregateId !== input.aggregateId)
			stateChangesWithoutTheirOwnEvent.push(
				`${input.objectType} ${input.aggregateId}: ${event.eventType} on ${event.aggregateId}`
			);

	// PREMISE 1 — a group's key fields are what the aggregate was born with, for as long as it lives.
	const fields = GROUP_KEY_FIELDS.get(input.objectType);
	if (!fields) return;
	premiseLiveness.groupCommits += 1;
	premiseLiveness.typesSeen.add(input.objectType);
	const state = (input.currentState ?? {}) as Record<string, unknown>;
	const now: Record<string, string> = {};
	for (const field of fields) now[field] = asComparable(state[field]);
	const inStore = bornWith.get(store) ?? new Map<string, Record<string, string>>();
	bornWith.set(store, inStore);
	const birth = inStore.get(input.aggregateId);
	if (!birth) {
		inStore.set(input.aggregateId, now);
		return;
	}
	for (const field of fields)
		if (birth[field] !== now[field])
			keyFieldRewrites.push(
				`${input.objectType} ${input.aggregateId}.${field}: ${birth[field]} -> ${now[field]}`
			);
}

function instrument(proto: { commit: (input: CommitInput) => CommitResult }): void {
	const original = proto.commit;
	proto.commit = function patchedCommit(this: unknown, input: CommitInput): CommitResult {
		checkCommit(this as object, input);
		return original.call(this, input) as CommitResult;
	};
}

instrument(SqliteStorageAdapter.prototype);
instrument(SnapshotOverlayStorageAdapter.prototype);

afterAll(() => {
	const complaints = [
		...keyFieldRewrites.map(
			(rewrite) =>
				`KEY FIELD REWRITTEN AFTER BIRTH — ${rewrite}\n    A declared group keys on this field, so "a member" ` +
				'would depend on when it was read: an aggregate could leave the set between a fork and its commit and ' +
				'be refused for nothing, or join it unseen (REG-D-070 §5.1).'
		),
		...stateChangesWithoutTheirOwnEvent.map(
			(change) =>
				`STATE CHANGE WITHOUT ITS OWN EVENT — ${change}\n    The commit check reads the EVENTS after a fork, so ` +
				'a state change no event on that aggregate records is a change the dependency rule cannot see.'
		)
	];
	if (complaints.length > 0)
		throw new Error(
			`draft-dependency premises (REG-D-070 §5.1), measured over ${String(premiseLiveness.commits)} commit(s):\n  ` +
				complaints.join('\n  ')
		);
});
