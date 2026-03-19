/**
 * Context Cache — State-Fingerprint Based
 *
 * Replaces the old TTL-based cache with a deterministic fingerprint approach.
 * Cache keys are computed from workflow state (phase, subPhase, intent, budget,
 * policy version, latest event ID, handoff doc ID, and extras hash).
 * The cache is invalidated structurally when any of these components change.
 */

import { createHash } from 'node:crypto';
import { getDatabase } from '../database/init';
import type { Role, Phase } from '../types';
import type { HandoffPacket, CacheFingerprint } from './engineTypes';

// ==================== CACHE STORE ====================

interface CacheEntry {
	packet: HandoffPacket;
	cachedAt: number;
}

/** LRU-style cache with max size. */
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 50;

// ==================== PUBLIC API ====================

/**
 * Compute a state fingerprint for the given context target.
 * If any component of the fingerprint changes, the cache misses.
 */
export function computeFingerprint(
	role: Role,
	phase: Phase,
	subPhase: string | undefined,
	intent: string | undefined,
	tokenBudget: number,
	policyVersion: number,
	dialogueId: string,
	extras?: Record<string, unknown>,
): string {
	// Get latest event ID and handoff doc ID from DB
	let latestEventId = 0;
	let latestHandoffDocId: string | null = null;

	try {
		const db = getDatabase();
		if (db) {
			const eventRow = db.prepare(
				'SELECT MAX(event_id) as max_id FROM dialogue_events WHERE dialogue_id = ?'
			).get(dialogueId) as { max_id: number | null } | undefined;
			latestEventId = eventRow?.max_id ?? 0;

			const docRow = db.prepare(
				'SELECT doc_id FROM handoff_documents WHERE dialogue_id = ? ORDER BY created_at DESC LIMIT 1'
			).get(dialogueId) as { doc_id: string } | undefined;
			latestHandoffDocId = docRow?.doc_id ?? null;
		}
	} catch {
		// DB not available — fingerprint will use defaults
	}

	// Hash extras for stable cache key
	const extrasHash = extras && Object.keys(extras).length > 0
		? createHash('sha256').update(JSON.stringify(sortKeys(extras))).digest('hex').substring(0, 12)
		: '';

	const fingerprint: CacheFingerprint = {
		role,
		phase,
		subPhase: subPhase ?? '*',
		intent: intent ?? '*',
		tokenBudget,
		policyVersion,
		latestEventId,
		latestHandoffDocId,
		extrasHash,
	};

	// Hash the fingerprint into a compact key
	return createHash('sha256')
		.update(JSON.stringify(fingerprint))
		.digest('hex');
}

/**
 * Get a cached HandoffPacket for the given fingerprint.
 * Returns a deep copy to prevent cache mutation.
 */
export function getCachedPacket(fingerprint: string): HandoffPacket | null {
	const entry = cache.get(fingerprint);
	if (!entry) { return null; }

	// Move to front (LRU touch)
	cache.delete(fingerprint);
	cache.set(fingerprint, entry);

	return deepCopy(entry.packet);
}

/**
 * Cache a HandoffPacket under the given fingerprint.
 */
export function cachePacket(fingerprint: string, packet: HandoffPacket): void {
	// Evict oldest entries if at capacity
	while (cache.size >= MAX_CACHE_SIZE) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) {
			cache.delete(oldestKey);
		} else {
			break;
		}
	}

	cache.set(fingerprint, {
		packet: deepCopy(packet),
		cachedAt: Date.now(),
	});
}

/**
 * Invalidate all cached entries for a given dialogue.
 * Call this on navigation, phase transitions, or when handoff docs are updated.
 */
export function invalidateForDialogue(dialogueId: string): void {
	// Since fingerprints include dialogueId-derived data (event IDs, handoff doc IDs),
	// we can't directly map dialogueId → cache key. Clear all entries.
	// With MAX_CACHE_SIZE=50, this is cheap.
	cache.clear();
}

/**
 * Clear the entire cache.
 */
export function clearContextCache(): void {
	cache.clear();
}

/**
 * Get cache size (for diagnostics).
 */
export function getCacheSize(): number {
	return cache.size;
}

// ==================== INTERNAL ====================

function deepCopy<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/** Sort object keys for deterministic hashing. */
function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(obj).sort()) {
		sorted[key] = obj[key];
	}
	return sorted;
}
