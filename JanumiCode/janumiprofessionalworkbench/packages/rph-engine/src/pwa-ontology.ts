// The published-PWA → EngineOntology seam. A PWA authored + published through the PWA Design context produces a
// versioned ontology; this turns that ontology data into the minimal structural EngineOntology that createEngine
// loads (the engine is PWA-agnostic mechanism — see engine.ts). This closes the loop: author a PWA, publish it,
// build its ontology, and stand up an engine bound to it to run Undertakings.
import type { EngineHandle, EngineOntology } from './engine.js';

interface PwaLike {
	readonly version: string;
	readonly rootPwuTypeId?: string;
}
interface PwuTypeLike {
	readonly pwuKind: string;
	readonly isRoot?: boolean;
}

/** Project a PWA + its PWU Types into the structural EngineOntology createEngine requires (exactly one root). */
export function pwaToEngineOntology(
	pwa: PwaLike,
	pwuTypes: readonly PwuTypeLike[]
): EngineOntology {
	return {
		version: pwa.version,
		pwuTemplates: pwuTypes.map((t) => ({ pwuKind: t.pwuKind, isRoot: t.isRoot ?? false })),
		seedPolicies: [],
		conformanceProfiles: []
	};
}

/** Read a PUBLISHED PWA + all its PWU Types out of a live engine and build the EngineOntology for it. The PWU
 * Types are collected from the PwuTypeDefined event log and loaded for their current state. */
export function engineOntologyForPwa(handle: EngineHandle, pwaId: string): EngineOntology {
	const pwa = handle.loadObject(pwaId)?.state as PwaLike | undefined;
	if (!pwa) throw new Error(`engineOntologyForPwa: PWA ${pwaId} not found`);
	const typeIds: string[] = [];
	for (const e of handle.readAllEvents()) {
		if (e.eventType === 'PwuTypeDefined') {
			const p = e.payload as { pwuTypeId?: string; pwaId?: string };
			if (p.pwuTypeId && p.pwaId === pwaId) typeIds.push(p.pwuTypeId);
		}
	}
	const pwuTypes = typeIds
		.map((id) => handle.loadObject(id)?.state as PwuTypeLike | undefined)
		.filter((t): t is PwuTypeLike => Boolean(t));
	return pwaToEngineOntology(pwa, pwuTypes);
}
