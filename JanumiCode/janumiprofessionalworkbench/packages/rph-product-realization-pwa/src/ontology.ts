// The Product Realization PWA ontology — typed accessors + integrity (OVR) validation over the generated dataset.
// Policies are versioned data; every assessment cites a policy version (INV-11). Templates reference policies
// by their versioned id (e.g. pol_intent_fidelity_v1) while the policy record's id may be unversioned — the
// resolver normalizes the `_vN` suffix.
import { PRODUCT_REALIZATION_PWA_ONTOLOGY } from './ontology.data.js';

export interface Criterion {
	readonly id: string;
	readonly statement: string;
	readonly mandatory?: boolean;
}
export interface SeedPolicy {
	readonly policyId: string;
	readonly name?: string;
	readonly evaluatedClaimTypes?: readonly string[];
	readonly appliesToPwuKinds?: readonly string[];
	readonly requiredEvidenceTypes?: readonly string[];
	readonly criteria?: readonly Criterion[];
	readonly findingTypes?: readonly string[];
	readonly independenceRequirement?: string;
	readonly failureSeverity?: string;
}
export interface PwuTemplate {
	readonly pwuKind: string;
	readonly isRoot?: boolean;
	readonly purpose?: string;
	readonly candidateChildren?: readonly string[];
	readonly defaultPolicyIds?: readonly string[];
}
export interface ConformanceProfile {
	readonly profile: string;
	readonly minIndependence?: string;
	readonly mandatoryPolicyIds?: readonly string[];
}

export const ontology = PRODUCT_REALIZATION_PWA_ONTOLOGY;
export const ontologyVersion: string = PRODUCT_REALIZATION_PWA_ONTOLOGY.version;

export const pwuTemplates = PRODUCT_REALIZATION_PWA_ONTOLOGY.pwuTemplates as readonly PwuTemplate[];
export const seedPolicies = PRODUCT_REALIZATION_PWA_ONTOLOGY.seedPolicies as readonly SeedPolicy[];
export const conformanceProfiles =
	PRODUCT_REALIZATION_PWA_ONTOLOGY.conformanceProfiles as readonly ConformanceProfile[];

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

/** Ontology validation (DOC-003 OVR-1..10). Structural integrity the engine relies on before loading a PWA. */
export function validateOntology(): OntologyIssue[] {
	const issues: OntologyIssue[] = [];

	// OVR: exactly one root PWU template.
	const roots = pwuTemplates.filter((t) => t.isRoot);
	if (roots.length !== 1)
		issues.push({
			kind: 'ROOT_CARDINALITY',
			detail: `expected exactly 1 root template, found ${roots.length}`
		});

	// OVR: every seed policy has criteria + an independence requirement + a failure severity.
	for (const p of seedPolicies) {
		if (!p.criteria || p.criteria.length === 0)
			issues.push({ kind: 'POLICY_NO_CRITERIA', detail: p.policyId });
		if (!p.independenceRequirement)
			issues.push({ kind: 'POLICY_NO_INDEPENDENCE', detail: p.policyId });
		if (!p.failureSeverity) issues.push({ kind: 'POLICY_NO_SEVERITY', detail: p.policyId });
	}

	// OVR: every template default policy resolves to a known seed policy.
	for (const t of pwuTemplates) {
		for (const pid of t.defaultPolicyIds ?? []) {
			if (!getSeedPolicy(pid))
				issues.push({ kind: 'TEMPLATE_UNKNOWN_POLICY', detail: `${t.pwuKind} -> ${pid}` });
		}
	}

	// OVR: every conformance-profile mandatory policy resolves.
	for (const c of conformanceProfiles) {
		for (const pid of c.mandatoryPolicyIds ?? []) {
			if (!getSeedPolicy(pid))
				issues.push({ kind: 'PROFILE_UNKNOWN_POLICY', detail: `${c.profile} -> ${pid}` });
		}
	}

	return issues;
}
