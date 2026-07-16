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

// OVR: exactly one root PWU template.
function checkRootCardinality(issues: OntologyIssue[]): void {
	const roots = pwuTemplates.filter((t) => t.isRoot);
	if (roots.length !== 1)
		issues.push({
			kind: 'ROOT_CARDINALITY',
			detail: `expected exactly 1 root template, found ${roots.length}`
		});
}

// OVR: every seed policy has criteria + an independence requirement + a failure severity.
function checkSeedPolicies(issues: OntologyIssue[]): void {
	for (const p of seedPolicies) {
		if (!p.criteria || p.criteria.length === 0)
			issues.push({ kind: 'POLICY_NO_CRITERIA', detail: p.policyId });
		if (!p.independenceRequirement)
			issues.push({ kind: 'POLICY_NO_INDEPENDENCE', detail: p.policyId });
		if (!p.failureSeverity) issues.push({ kind: 'POLICY_NO_SEVERITY', detail: p.policyId });
	}
}

// OVR: every template default policy resolves to a known seed policy.
function checkTemplatePolicies(issues: OntologyIssue[]): void {
	for (const t of pwuTemplates) {
		for (const pid of t.defaultPolicyIds ?? []) {
			if (!getSeedPolicy(pid))
				issues.push({ kind: 'TEMPLATE_UNKNOWN_POLICY', detail: `${t.pwuKind} -> ${pid}` });
		}
	}
}

// OVR: every conformance-profile mandatory policy resolves.
function checkProfilePolicies(issues: OntologyIssue[]): void {
	for (const c of conformanceProfiles) {
		for (const pid of c.mandatoryPolicyIds ?? []) {
			if (!getSeedPolicy(pid))
				issues.push({ kind: 'PROFILE_UNKNOWN_POLICY', detail: `${c.profile} -> ${pid}` });
		}
	}
}

/** Ontology validation (DOC-003 OVR-1..10). Structural integrity the engine relies on before loading a PWA. */
export function validateOntology(): OntologyIssue[] {
	const issues: OntologyIssue[] = [];
	checkRootCardinality(issues);
	checkSeedPolicies(issues);
	checkTemplatePolicies(issues);
	checkProfilePolicies(issues);
	return issues;
}
