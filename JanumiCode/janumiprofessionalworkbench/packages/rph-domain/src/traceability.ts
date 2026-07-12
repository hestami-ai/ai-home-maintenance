// The traceability + impact/invalidation engine (M6). TraceLinks are IMMUTABLE typed edges; corrections
// create a SUPERSEDES link, never mutate (§25.1). Directionality per relation is grounded in DOC-002 §25 /
// vocab/m6-traceability.json. Invalidation walks the typed graph and classifies each affected object; the
// flagship rule is evidence-invalidation -> dependent SUPPORTED claims must be revalidated (CT-10 / P4).

/** The 7 closed impact classifications (DOC-002 §29.3). */
export const IMPACT_CLASSIFICATIONS = [
	'UNAFFECTED',
	'NEEDS_REVIEW',
	'EVIDENCE_REFRESH',
	'REVALIDATION',
	'REPLANNING',
	'RESHAPING',
	'INVALIDATED'
] as const;
export type ImpactClassification = (typeof IMPACT_CLASSIFICATIONS)[number];

/** Sentinel for relations (SUPERSEDES) whose source/target may be any object type. */
export const ANY_TYPE = '*';

export interface Directionality {
	readonly source: readonly string[];
	readonly target: readonly string[];
}

/** Relation -> {allowed source object types, allowed target object types} (DOC-002 §25 / §25.1). */
export const TRACE_DIRECTIONALITY: Readonly<Record<string, Directionality>> = {
	DERIVED_FROM: {
		source: ['PROFESSIONAL_WORK_UNIT', 'INTENT', 'ARTIFACT', 'CLAIM', 'OBLIGATION'],
		target: ['INTENT', 'OBLIGATION', 'PROFESSIONAL_WORK_UNIT']
	},
	REFINES: {
		source: ['INTENT', 'PROFESSIONAL_WORK_UNIT'],
		target: ['INTENT', 'PROFESSIONAL_WORK_UNIT']
	},
	DECOMPOSES: { source: ['PROFESSIONAL_WORK_UNIT'], target: ['PROFESSIONAL_WORK_UNIT'] },
	SATISFIES: {
		source: ['PROFESSIONAL_WORK_UNIT', 'CLAIM'],
		target: ['OBLIGATION', 'CONSTRAINT', 'INTENT']
	},
	DEPENDS_ON: {
		source: ['PROFESSIONAL_WORK_UNIT', 'EXECUTION_STEP'],
		target: ['PROFESSIONAL_WORK_UNIT', 'ARTIFACT']
	},
	CONSTRAINED_BY: { source: ['PROFESSIONAL_WORK_UNIT', 'INTENT'], target: ['CONSTRAINT'] },
	ASSUMES: { source: ['PROFESSIONAL_WORK_UNIT'], target: ['ASSUMPTION'] },
	PRODUCES: {
		source: ['PROFESSIONAL_WORK_UNIT', 'EXECUTION_STEP'],
		target: ['ARTIFACT', 'EVIDENCE']
	},
	SUPPORTS: { source: ['EVIDENCE', 'ASSURANCE_ASSESSMENT'], target: ['CLAIM'] },
	CONTRADICTS: { source: ['EVIDENCE', 'ASSURANCE_OBSERVATION'], target: ['CLAIM'] },
	VERIFIES: {
		source: ['ASSURANCE_ASSESSMENT'],
		target: ['CLAIM', 'PROFESSIONAL_WORK_UNIT', 'BASELINE']
	},
	INVALIDATES: {
		source: [
			'INTENT',
			'CONSTRAINT',
			'ASSUMPTION',
			'EVIDENCE',
			'DECISION',
			'BASELINE',
			'PROFESSIONAL_WORK_UNIT',
			'ASSURANCE_POLICY'
		],
		target: [
			'CLAIM',
			'PROFESSIONAL_WORK_UNIT',
			'EVIDENCE',
			'BASELINE',
			'OBLIGATION',
			'CONSTRAINT',
			'DECISION'
		]
	},
	SUPERSEDES: { source: [ANY_TYPE], target: [ANY_TYPE] },
	PROMOTES: { source: ['DECISION'], target: ['BASELINE', 'BASELINE_ITEM'] },
	ALLOCATES: {
		source: ['OBLIGATION', 'DECOMPOSITION_CONTRACT'],
		target: ['PROFESSIONAL_WORK_UNIT']
	},
	PROPAGATES: {
		source: ['CONSTRAINT', 'ASSUMPTION'],
		target: ['PROFESSIONAL_WORK_UNIT', 'CONSTRAINT']
	},
	GOVERNS: {
		source: ['DECISION', 'ASSURANCE_POLICY', 'AUTHORITY'],
		target: ['PROFESSIONAL_WORK_UNIT', 'ASSURANCE_ASSESSMENT', 'BASELINE', 'EXECUTION_PLAN']
	}
};

export interface DirectionalityCheck {
	readonly ok: boolean;
	readonly reason?: string;
}

/** Validate a link's direction against the registry (unknown relations pass — vocabulary is open at the edges). */
export function validateLinkDirectionality(
	relation: string,
	sourceType: string,
	targetType: string
): DirectionalityCheck {
	const dir = TRACE_DIRECTIONALITY[relation];
	if (!dir) return { ok: true };
	if (!dir.source.includes(ANY_TYPE) && !dir.source.includes(sourceType)) {
		return {
			ok: false,
			reason: `${relation} source must be one of ${dir.source.join('|')}, got ${sourceType}`
		};
	}
	if (!dir.target.includes(ANY_TYPE) && !dir.target.includes(targetType)) {
		return {
			ok: false,
			reason: `${relation} target must be one of ${dir.target.join('|')}, got ${targetType}`
		};
	}
	return { ok: true };
}

export interface TraceNode {
	readonly id: string;
	readonly objectType: string;
}
export interface TraceLink {
	readonly id: string;
	readonly relation: string;
	readonly from: string;
	readonly to: string;
	/** Immutable: a correction adds a SUPERSEDES link and marks the prior link superseded — never mutated. */
	readonly superseded?: boolean;
}

export class TraceGraph {
	private readonly nodes = new Map<string, TraceNode>();
	private readonly links: TraceLink[] = [];

	addNode(node: TraceNode): void {
		this.nodes.set(node.id, node);
	}
	getNode(id: string): TraceNode | undefined {
		return this.nodes.get(id);
	}

	/** Add an immutable link, validating directionality against the known object types. Throws on bad direction. */
	addLink(link: TraceLink): void {
		const s = this.nodes.get(link.from)?.objectType;
		const t = this.nodes.get(link.to)?.objectType;
		if (s && t) {
			const check = validateLinkDirectionality(link.relation, s, t);
			if (!check.ok) throw new Error(`Invalid trace link: ${check.reason}`);
		}
		this.links.push(link);
	}

	outgoing(id: string, relation?: string): TraceLink[] {
		return this.links.filter(
			(l) => l.from === id && !l.superseded && (relation === undefined || l.relation === relation)
		);
	}
	incoming(id: string, relation?: string): TraceLink[] {
		return this.links.filter(
			(l) => l.to === id && !l.superseded && (relation === undefined || l.relation === relation)
		);
	}

	/** BFS for a directed relation-path from -> to over active links. Returns the link chain, or null. */
	findPath(fromId: string, toId: string): TraceLink[] | null {
		const queue: Array<{ id: string; path: TraceLink[] }> = [{ id: fromId, path: [] }];
		const seen = new Set<string>([fromId]);
		while (queue.length > 0) {
			const { id, path } = queue.shift()!;
			if (id === toId && path.length > 0) return path;
			for (const link of this.outgoing(id)) {
				if (seen.has(link.to)) continue;
				seen.add(link.to);
				queue.push({ id: link.to, path: [...path, link] });
			}
		}
		return null;
	}
}

export interface Impact {
	readonly objectId: string;
	readonly classification: ImpactClassification;
	readonly reason: string;
}

/**
 * The flagship invalidation rule (CT-10 / property P4): when an Evidence object is invalidated, every Claim it
 * SUPPORTS must be re-examined — classified REVALIDATION, never left silently SUPPORTED.
 */
export function classifyEvidenceInvalidation(graph: TraceGraph, evidenceId: string): Impact[] {
	return graph.outgoing(evidenceId, 'SUPPORTS').map((link) => ({
		objectId: link.to,
		classification: 'REVALIDATION' as const,
		reason: `Evidence ${evidenceId} invalidated; supported claim ${link.to} must be revalidated`
	}));
}

/**
 * Conservative downstream impact: everything reachable from the changed object along active trace links is
 * at least NEEDS_REVIEW (never silently unaffected). Per-trigger rules (evidence, constraint, assumption, …)
 * refine specific classifications; this is the safe default the controller starts from.
 */
export function impactedObjects(graph: TraceGraph, changedId: string): Impact[] {
	const impacts: Impact[] = [];
	const seen = new Set<string>([changedId]);
	const queue = [changedId];
	while (queue.length > 0) {
		const id = queue.shift()!;
		for (const link of graph.outgoing(id)) {
			if (seen.has(link.to)) continue;
			seen.add(link.to);
			impacts.push({
				objectId: link.to,
				classification: 'NEEDS_REVIEW',
				reason: `reachable from changed object ${changedId} via ${link.relation}`
			});
			queue.push(link.to);
		}
	}
	return impacts;
}
