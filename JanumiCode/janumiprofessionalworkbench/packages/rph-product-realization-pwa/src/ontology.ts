// The Product Realization PWA ontology — typed accessors + integrity (OVR) validation over the generated dataset.
// Policies are versioned data; every assessment cites a policy version (INV-11). Templates reference policies
// by their versioned id (e.g. pol_intent_fidelity_v1) while the policy record's id may be unversioned — the
// resolver normalizes the `_vN` suffix.
import { PRODUCT_REALIZATION_PWA_ONTOLOGY } from './ontology.data.js';

// The dataset's shape lives in ontology.types.ts and is enforced AT THE LITERAL in ontology.data.ts
// (`as const satisfies OntologyData`). Re-exported here so consumers still import it all from `ontology`.
export type {
	Criterion,
	SeedPolicy,
	PwuTemplate,
	ConformanceProfile,
	CompatibilityPhase,
	OntologyData
} from './ontology.types.js';
import type { SeedPolicy, PwuTemplate, ConformanceProfile } from './ontology.types.js';

export { PRODUCT_REALIZATION_PWA_ONTOLOGY as ontology } from './ontology.data.js';
export const ontologyVersion: string = PRODUCT_REALIZATION_PWA_ONTOLOGY.version;

// NO `as readonly X[]` ASSERTIONS. These read `... as readonly SeedPolicy[]`, and that assertion is precisely
// why the dataset was unchecked: an assertion only requires comparability and verifies nothing structurally.
// Mutation-proven 2026-07-16 — re-adding the invented `statement` field to a criterion passed check-types AND
// the full 21/21 gate. The literal is now `satisfies`-checked at its source, so these are plain reads and the
// drift fails the build for real. Do NOT reintroduce an assertion here: it would re-hide exactly what it hid.
export const pwuTemplates: readonly PwuTemplate[] = PRODUCT_REALIZATION_PWA_ONTOLOGY.pwuTemplates;
export const seedPolicies: readonly SeedPolicy[] = PRODUCT_REALIZATION_PWA_ONTOLOGY.seedPolicies;
export const conformanceProfiles: readonly ConformanceProfile[] =
	PRODUCT_REALIZATION_PWA_ONTOLOGY.conformanceProfiles;

const stripVersion = (id: string): string => id.replace(/_v\d+$/, '');

export function getPwuTemplate(pwuKind: string): PwuTemplate | undefined {
	return pwuTemplates.find((t) => t.pwuKind === pwuKind);
}
export function rootTemplate(): PwuTemplate | undefined {
	return pwuTemplates.find((t) => t.isRoot);
}
export function getSeedPolicy(policyId: string): SeedPolicy | undefined {
	const target = stripVersion(policyId);
	return seedPolicies.find((p) => stripVersion(p.policyId) === target);
}
export function getConformanceProfile(name: string): ConformanceProfile | undefined {
	return conformanceProfiles.find((c) => c.profile === name);
}

export interface OntologyIssue {
	readonly kind: string;
	readonly detail: string;
}

/**
 * The ontology a validation pass runs against — SUPPLIED rather than read from module scope (JAN-VERIF V-2d).
 *
 * WHY THIS IS A PARAMETER NOW. Every check below closed over the module-level `pwuTemplates`, `seedPolicies` and
 * `conformanceProfiles`, so the only ontology it could ever validate was the shipped one — which is well-formed.
 * Its five issue kinds had therefore **never been observed to fire**: the suite asserts `validateOntology()`
 * returns no structural issues, and that is satisfied equally by a working validator and by one that always
 * returns `[]`.
 *
 * That is this programme's recurring defect one layer out — an instrument only ever observed green is
 * unfalsifiable — and V-2d surfaced it by asking why this file's BRANCH coverage sat at 55%. The uncovered
 * branches were the validator's negative arms, and they were uncoverable BY CONSTRUCTION.
 *
 * The zero-argument call still means "validate what ships"; the parameter exists so a test can hand it a
 * deliberately broken ontology and watch each kind fire.
 */
export interface OntologySubject {
	readonly pwuTemplates: readonly PwuTemplate[];
	readonly seedPolicies: readonly SeedPolicy[];
	readonly conformanceProfiles: readonly ConformanceProfile[];
}

/** What ships — the default subject, so `validateOntology()` keeps its meaning and every caller is unchanged. */
const SHIPPED: OntologySubject = { pwuTemplates, seedPolicies, conformanceProfiles };

/** Resolve a policy id WITHIN a given subject (version-stripped) rather than against the shipped set. Using the
 *  module-level `getSeedPolicy` here would have made the reference checks validate the subject's templates against
 *  the SHIPPED policies — a broken ontology would then look partly fine, which is worse than not checking. */
const policyIn = (subject: OntologySubject, policyId: string): SeedPolicy | undefined => {
	const target = stripVersion(policyId);
	return subject.seedPolicies.find((p) => stripVersion(p.policyId) === target);
};

// OVR: exactly one root PWU template.
function checkRootCardinality(subject: OntologySubject, issues: OntologyIssue[]): void {
	const roots = subject.pwuTemplates.filter((t) => t.isRoot);
	if (roots.length !== 1)
		issues.push({
			kind: 'ROOT_CARDINALITY',
			detail: `expected exactly 1 root template, found ${roots.length}`
		});
}

// OVR: every seed policy has criteria + an independence requirement + a failure severity.
function checkSeedPolicies(subject: OntologySubject, issues: OntologyIssue[]): void {
	for (const p of subject.seedPolicies) {
		if (!p.criteria || p.criteria.length === 0)
			issues.push({ kind: 'POLICY_NO_CRITERIA', detail: p.policyId });
		if (!p.independenceRequirement)
			issues.push({ kind: 'POLICY_NO_INDEPENDENCE', detail: p.policyId });
		if (!p.failureSeverity) issues.push({ kind: 'POLICY_NO_SEVERITY', detail: p.policyId });
	}
}

// OVR: every template default policy resolves to a known seed policy.
function checkTemplatePolicies(subject: OntologySubject, issues: OntologyIssue[]): void {
	for (const t of subject.pwuTemplates) {
		for (const pid of t.defaultPolicyIds ?? []) {
			if (!policyIn(subject, pid))
				issues.push({ kind: 'TEMPLATE_UNKNOWN_POLICY', detail: `${t.pwuKind} -> ${pid}` });
		}
	}
}

// OVR: every conformance-profile mandatory policy resolves.
function checkProfilePolicies(subject: OntologySubject, issues: OntologyIssue[]): void {
	for (const c of subject.conformanceProfiles) {
		for (const pid of c.mandatoryPolicyIds ?? []) {
			if (!policyIn(subject, pid))
				issues.push({ kind: 'PROFILE_UNKNOWN_POLICY', detail: `${c.profile} -> ${pid}` });
		}
	}
}

/** Ontology validation (DOC-003 OVR-1..10). Structural integrity the engine relies on before loading a PWA. */
export function validateOntology(subject: OntologySubject = SHIPPED): OntologyIssue[] {
	const issues: OntologyIssue[] = [];
	checkRootCardinality(subject, issues);
	checkSeedPolicies(subject, issues);
	checkTemplatePolicies(subject, issues);
	checkProfilePolicies(subject, issues);
	return issues;
}
