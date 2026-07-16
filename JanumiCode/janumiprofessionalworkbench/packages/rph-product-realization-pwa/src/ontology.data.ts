// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:ontology`.
// Source: vocab/m8-ontology.json (grounded from DOC-003 + DOC-004 + DOC-006, reconciled).
//
// Checked at this literal with `satisfies OntologyData` — a drift in the ratified DOC-004 §7 criterion shape,
// or an extra/missing field anywhere in the dataset, fails THIS build. Do not weaken this to a bare `as const`
// or move the check to a type assertion in ontology.ts: an assertion verifies nothing (see gen-ontology.ts).
import type { OntologyData } from './ontology.types.js';

export const PRODUCT_REALIZATION_PWA_ONTOLOGY = {
	version: '1.0.0',
	pwuTemplates: [
		{
			pwuKind: 'PRODUCT_REALIZATION',
			isRoot: true,
			purpose:
				"Govern the full transformation from the user's originating expression through an approved Product Intent to an implemented and assured software baseline; produce justified confidence (not merely working code) that the user's authorized intent survives progressive formalization, decomposition, design, planning, implementation, integrated validation, and acceptance.",
			inputs: [
				'originating user expression',
				'workspace and repository context',
				'organizational policy',
				'applicable professional ontology version',
				'available runtime capabilities'
			],
			outputArtifactTypes: [
				'PRODUCT_INTENT',
				'PRODUCT_BOUNDARY',
				'USER_JOURNEY',
				'REQUIREMENT',
				'ARCHITECTURE_DESCRIPTION',
				'EXECUTION_PLAN',
				'PRODUCT_ARTIFACT',
				'EVIDENCE_PACKAGE',
				'BASELINE'
			],
			completionClaims: [
				'The promoted product baseline satisfies the approved Product Intent within its authorized boundaries and residual uncertainty. Recomposition rule (§8): satisfiable only when each mandatory child obligation is satisfied/waived/superseded, integrated validation supports the root completion claim, no unresolved blocking assurance observations remain, and an authorized baseline-promotion decision exists.'
			],
			requiredEvidenceTypes: ['APPROVAL', 'TRACE', 'ARTIFACT', 'TEST_RESULT', 'ANALYSIS', 'REVIEW'],
			candidateChildren: [
				'INTENT_AND_PRODUCT_DEFINITION',
				'PRODUCT_BEHAVIOR_DEFINITION',
				'ARCHITECTURE_DEFINITION',
				'IMPLEMENTATION_PLANNING',
				'PRODUCT_IMPLEMENTATION',
				'INTEGRATED_PRODUCT_VALIDATION',
				'PRODUCT_BASELINE_PROMOTION'
			],
			defaultPolicyIds: [
				'pol_intent_fidelity',
				'pol_intent_preservation',
				'pol_fitness_for_purpose',
				'pol_baseline_promotion'
			],
			sourceSection:
				"Spec(DOC-003) §7-§8, §44; Reference(DOC-006) §8 pwu_fsm_root — pwuKind PRODUCT_REALIZATION is a FIXTURE-CONFIRMED LITERAL. The 7 candidateChildren are the mandatory semantic decomposition (§7,§8). RECONCILED defaultPolicyIds to DOC-004's set; note only pol_intent_preservation is actually attached in the fixture root, and pol_fitness_for_purpose + pol_baseline_promotion are BEYOND-SEED core policies (not fully specified in this M8 dataset)."
		},
		{
			pwuKind: 'INTENT_AND_PRODUCT_DEFINITION',
			isRoot: false,
			purpose:
				"Convert the user's originating expression into an explicit, governable Product Intent: formalized objective, desired outcomes, boundary, non-goals, stakeholders, constraints, ambiguities, assumptions, and success conditions.",
			inputs: [
				'originating expression',
				'dialogue history',
				'supplied documents and links',
				'known organizational context',
				'existing product or repository context'
			],
			outputArtifactTypes: [
				'PRODUCT_INTENT',
				'PRODUCT_BOUNDARY',
				'CONSTRAINT_CATALOG',
				'STAKEHOLDER_CATALOG',
				'NON_GOAL_CATALOG',
				'AMBIGUITY_CATALOG',
				'INTENT_BASELINE'
			],
			completionClaims: [
				"The Product Intent faithfully represents the user's request.",
				'Material ambiguity has been surfaced.',
				'Major stakeholders and constraints have been identified.',
				'The product boundary is sufficiently clear for subsequent shaping.',
				'Success conditions are meaningful and testable where possible.'
			],
			requiredEvidenceTypes: ['SOURCE', 'ARTIFACT', 'APPROVAL', 'TRACE'],
			candidateChildren: [
				'INTENT_DISCOVERY',
				'PRODUCT_BOUNDARY',
				'STAKEHOLDER_DISCOVERY',
				'BUSINESS_DOMAIN_DISCOVERY',
				'DESIRED_OUTCOME_DEFINITION',
				'CONSTRAINT_DISCOVERY',
				'NON_GOAL_DEFINITION',
				'INTENT_BASELINE_ASSEMBLY'
			],
			defaultPolicyIds: [
				'pol_intent_fidelity',
				'pol_intent_completeness',
				'pol_assumption_disclosure'
			],
			sourceSection:
				'Spec §9; Reference §10 pwu_fsm_intent — pwuKind INTENT_AND_PRODUCT_DEFINITION is a FIXTURE-CONFIRMED LITERAL; fixture assurancePolicyIds = {pol_intent_fidelity_v1, pol_intent_complete_v1, pol_assumption_disclosure_v1} (all 3 seed policies here, canonical ids). Only INTENT_DISCOVERY and PRODUCT_BOUNDARY of the 8 candidateChildren are seeded as templates (§44).'
		},
		{
			pwuKind: 'INTENT_DISCOVERY',
			isRoot: false,
			purpose:
				'Discover what the user is actually trying to achieve, including needs not captured by the initial wording; distinguish user-stated facts, inferred needs, proposed interpretation, unresolved ambiguity, optional enhancement, and imposed technical solution without silently substituting an inferred solution for intent.',
			inputs: [
				'originating expression',
				'dialogue history',
				'provided files and links',
				'known organizational context',
				'existing product or repository context'
			],
			outputArtifactTypes: ['PRODUCT_INTENT', 'PRODUCT_BOUNDARY', 'AMBIGUITY_CATALOG'],
			completionClaims: [
				'The candidate intent distinguishes user-stated facts from inferred needs and imposed technical solutions.',
				'Open questions and competing interpretations are explicit.',
				"No inferred solution is silently substituted for the user's intent."
			],
			requiredEvidenceTypes: ['SOURCE', 'ARTIFACT', 'OBSERVATION'],
			candidateChildren: [],
			defaultPolicyIds: ['pol_intent_fidelity', 'pol_assumption_disclosure'],
			sourceSection:
				'Spec §10 (Required behavior + Assurance considerations: solution substitution, premature architecture, omitted constraints, preference-as-requirement, unsupported assumptions, scope expansion); DOC-005 §5.1 (INTAKE decomposition). pwuKind INFERRED UPPER_SNAKE (not a ratified literal).'
		},
		{
			pwuKind: 'PRODUCT_BOUNDARY',
			isRoot: false,
			purpose:
				'Define what the product or change explicitly includes and excludes so downstream shaping has a stable, sufficiently clear boundary that cannot silently expand or contract scope.',
			inputs: [
				'candidate or approved Product Intent',
				'desired outcomes',
				'non-goals',
				'known constraints'
			],
			outputArtifactTypes: ['PRODUCT_BOUNDARY', 'NON_GOAL_CATALOG'],
			completionClaims: [
				'In-scope and out-of-scope statements are explicit and consistent with user authority.',
				'The boundary is sufficient for the next authorized activity.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'SOURCE'],
			candidateChildren: [],
			defaultPolicyIds: ['pol_intent_completeness', 'pol_intent_fidelity'],
			sourceSection:
				'Spec §5.2 (Product Boundary concept), §9 (child of Intent and Product Definition), §44 (minimum template package); boundary-fidelity criterion IF-02 (Catalog §15.6). pwuKind CONFLICT: DOC-003/DOC-004 = PRODUCT_BOUNDARY; DOC-006 = PRODUCT_BOUNDARY_DEFINITION. RESOLVED to PRODUCT_BOUNDARY (2/3 + referenced by seed-policy appliesToPwuKinds); PRODUCT_BOUNDARY_DEFINITION retained as alias (open item).'
		},
		{
			pwuKind: 'PRODUCT_BEHAVIOR_DEFINITION',
			isRoot: false,
			purpose:
				'Define how actors, capabilities, journeys, scenarios, entities, and integrations collectively realize Product Intent, sufficient to guide architecture and implementation without losing the approved intent.',
			inputs: [
				'approved or provisional Product Intent',
				'product boundary',
				'desired outcomes',
				'constraints',
				'stakeholders'
			],
			outputArtifactTypes: [
				'ACTOR_CATALOG',
				'CAPABILITY_MAP',
				'USER_JOURNEY',
				'SCENARIO',
				'REQUIREMENT',
				'DOMAIN_MODEL',
				'INTEGRATION_CATALOG',
				'ACCEPTANCE_CRITERION'
			],
			completionClaims: [
				'The defined product behavior is sufficient to guide architecture and implementation without losing the approved Product Intent.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE', 'ANALYSIS'],
			candidateChildren: [
				'ACTOR_DEFINITION',
				'CAPABILITY_DEFINITION',
				'USER_JOURNEY_DEFINITION',
				'SCENARIO_DEFINITION',
				'REQUIREMENT_DEFINITION',
				'DOMAIN_ENTITY_DEFINITION',
				'INTEGRATION_REQUIREMENT',
				'ACCEPTANCE_MODEL_DEFINITION'
			],
			defaultPolicyIds: [
				'pol_requirement_coverage',
				'pol_intent_preservation',
				'pol_assumption_disclosure'
			],
			sourceSection:
				'Spec §11; Reference §11 pwu_fsm_behavior (PwuSatisfied event 28). Only USER_JOURNEY_DEFINITION and REQUIREMENT_DEFINITION are seeded templates (§44). pol_requirement_coverage is a BEYOND-SEED core policy. pwuKind INFERRED UPPER_SNAKE. NOTE: DOC-006 §27 places pwu_fsm_behavior (events 17-28) with NO distinct legacy phase — absorbed at the INTAKE/ARCHITECTURE boundary; ontology models it as its own PWU.'
		},
		{
			pwuKind: 'USER_JOURNEY_DEFINITION',
			isRoot: false,
			purpose:
				'Describe how an actor pursues an outcome through interaction with the product and related systems across normal, alternate, exceptional, and failure paths.',
			inputs: [
				'originating outcome',
				'primary and supporting actors',
				'required capabilities',
				'affected entities',
				'trigger and preconditions'
			],
			outputArtifactTypes: ['USER_JOURNEY', 'SCENARIO'],
			completionClaims: [
				'The journey traces to intent and preserves the originating outcome end-to-end.',
				'Applicable scenario classes (normal, alternate valid, user-error, system-failure, permission-denied, interrupted/resumed, data-unavailable, cancellation) are covered or their inapplicability is explicit.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE'],
			candidateChildren: ['SCENARIO_DEFINITION'],
			defaultPolicyIds: ['pol_intent_preservation', 'pol_requirement_coverage'],
			sourceSection:
				'Spec §12 (required fields + minimum scenario classes; policies Journey-to-Intent Traceability, Journey Outcome Preservation, Alternate/Failure-Path Coverage, Actor Authorization, State Continuity — recommended/non-seeded, Catalog §27.2); Reference §11.4 (Journey: Request to Completed Job). pwuKind INFERRED UPPER_SNAKE.'
		},
		{
			pwuKind: 'REQUIREMENT_DEFINITION',
			isRoot: false,
			purpose:
				'Convert approved intent and behavior into explicit, allocatable, verifiable obligations (functional, quality, security, data, interface, performance, operational, compliance).',
			inputs: ['approved intent', 'user journeys', 'capability map', 'constraints'],
			outputArtifactTypes: ['REQUIREMENT', 'ACCEPTANCE_CRITERION', 'TRACEABILITY_MATRIX'],
			completionClaims: [
				'Requirements are necessary, bounded, traceable, internally consistent, verifiable, and feasible-or-explicitly-exploratory.',
				'Requirements collectively cover approved capabilities, journeys, and constraints, or record governed exclusions.',
				'Each requirement traces to an intent or journey source.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE'],
			candidateChildren: [],
			defaultPolicyIds: ['pol_requirement_coverage', 'pol_intent_preservation'],
			sourceSection:
				'Spec §13 (requirement types, quality rules; policies Requirement Necessity/Atomicity/Ambiguity/Feasibility/Conflict/Verification-Readiness/Coverage/Over-Specification — Requirement Quality/Coverage are recommended/non-seeded, Catalog §27.1); Reference §11.5 (FSM-FUNC/SEC/AUD/QUAL). pwuKind INFERRED UPPER_SNAKE. pol_requirement_coverage is BEYOND-SEED (DOC-006 emitted empty defaultPolicyIds here).'
		},
		{
			pwuKind: 'ARCHITECTURE_DEFINITION',
			isRoot: false,
			purpose:
				'Define a coherent technical structure capable of realizing the approved product behavior within applicable constraints: system boundary, components, interfaces, data ownership, integration, security, deployment, operational assumptions, decisions, risks, and a baseline candidate.',
			inputs: [
				'approved Product Intent',
				'product behavior model',
				'requirements',
				'repository and existing-system context',
				'technical constraints',
				'organizational policies',
				'historical decisions',
				'runtime and deployment environment'
			],
			outputArtifactTypes: [
				'SYSTEM_CONTEXT',
				'COMPONENT_MODEL',
				'INTERFACE_SPECIFICATION',
				'DATA_ARCHITECTURE',
				'INTEGRATION_CATALOG',
				'SECURITY_ARCHITECTURE',
				'DEPLOYMENT_ARCHITECTURE',
				'OPERATIONAL_MODEL',
				'ARCHITECTURE_DECISION_RECORD',
				'ARCHITECTURE_DESCRIPTION'
			],
			completionClaims: [
				'Architecture covers applicable requirements.',
				'Major components have coherent responsibilities.',
				'Interfaces are sufficiently defined.',
				'Security and operational concerns are addressed proportionally.',
				'Dependencies are explicit.',
				'Architecture is feasible.',
				'Architecture preserves Product Intent.',
				'Known tradeoffs are explicit.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE', 'ANALYSIS', 'REVIEW'],
			candidateChildren: [
				'SYSTEM_CONTEXT',
				'ARCHITECTURE_DRIVER',
				'COMPONENT_ARCHITECTURE',
				'DATA_ARCHITECTURE',
				'INTEGRATION_ARCHITECTURE',
				'SECURITY_ARCHITECTURE',
				'DEPLOYMENT_ARCHITECTURE',
				'OBSERVABILITY_ARCHITECTURE',
				'OPERATIONAL_RESILIENCE',
				'ARCHITECTURE_DECISION_CONSOLIDATION'
			],
			defaultPolicyIds: [
				'pol_assumption_disclosure',
				'pol_decomposition_coverage',
				'pol_architecture_coverage',
				'pol_intent_preservation'
			],
			sourceSection:
				'Spec §14; Reference §12 pwu_fsm_arch — pwuKind ARCHITECTURE_DEFINITION is a FIXTURE-CONFIRMED LITERAL; fixture assurancePolicyIds = {pol_assumption_disclosure, pol_decomposition_coverage, pol_architecture_coverage, pol_intent_preservation} (the GROUND-TRUTH 4). RECONCILED defaultPolicyIds to this fixture-confirmed set; DOC-004 additionally listed pol_constraint_propagation + pol_historical_consistency (BEYOND-SEED, attach at their lifecycle points). The FSM fixture instantiates domain-specific children (System Context, Multi-Tenancy, Data, Mobile/Offline, Integration).'
		},
		{
			pwuKind: 'ARCHITECTURE_DECISION',
			isRoot: false,
			purpose:
				'Record a governed choice among materially different architectural alternatives as a first-class Professional Work Object (question, context, alternatives, criteria, selected/rejected options, tradeoffs, consequences, assumptions, evidence, authority, review conditions) — not left as prose embedded in an architecture document when it materially affects downstream work.',
			inputs: [
				'decision question and context',
				'alternatives',
				'constraints',
				'evaluation criteria',
				'relevant historical decisions'
			],
			outputArtifactTypes: ['ARCHITECTURE_DECISION_RECORD'],
			completionClaims: [
				'The selected option is justified against adequate alternatives.',
				'Rationale is sufficient and the choice is compatible with constraints.',
				'Reversibility was assessed; historical consistency holds; decision authority is valid.',
				'Tradeoffs, consequences, assumptions, evidence, and authority are explicit.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'ANALYSIS', 'REVIEW', 'APPROVAL'],
			candidateChildren: [],
			defaultPolicyIds: ['pol_assumption_disclosure', 'pol_historical_consistency'],
			sourceSection:
				'Spec §15 (policies Alternative Adequacy, Decision Rationale Sufficiency, Constraint Compatibility, Evidence Adequacy, Reversibility Assessment, Historical Consistency, Decision Authority — mostly non-seeded). pol_historical_consistency is BEYOND-SEED (Catalog §22). pwuKind INFERRED UPPER_SNAKE.'
		},
		{
			pwuKind: 'IMPLEMENTATION_PLANNING',
			isRoot: false,
			purpose:
				'Transform approved product and architecture shape into actionable implementation PWUs and execution strategies: increment definition, decomposition contract, dependency graph, candidate execution plans, runtime capability requests, and test/migration/rollback strategy.',
			inputs: [
				'approved architecture baseline',
				'requirements',
				'constraints',
				'repository impact',
				'risk profile',
				'runtime capability requests'
			],
			outputArtifactTypes: [
				'PRODUCT_INCREMENT',
				'WORK_DECOMPOSITION',
				'DECOMPOSITION_CONTRACT',
				'DEPENDENCY_GRAPH',
				'EXECUTION_PLAN',
				'TEST_STRATEGY',
				'MIGRATION_PLAN',
				'ROLLBACK_PLAN'
			],
			completionClaims: [
				'Proposed work covers the approved increment.',
				'Decomposition preserves parent obligations.',
				'Dependencies are explicit.',
				'Implementation is feasible.',
				'Assurance requirements are allocated.',
				'Rollback and recovery are sufficient for risk.',
				'Execution plans do not silently change product semantics.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE', 'ANALYSIS'],
			candidateChildren: [
				'PRODUCT_INCREMENT_DEFINITION',
				'WORK_DECOMPOSITION',
				'DEPENDENCY_ANALYSIS',
				'REPOSITORY_IMPACT_ANALYSIS',
				'RISK_AND_ASSUMPTION_ANALYSIS',
				'TEST_STRATEGY',
				'MIGRATION_STRATEGY',
				'ROLLBACK_STRATEGY',
				'EXECUTION_PLAN_DEFINITION'
			],
			defaultPolicyIds: [
				'pol_decomposition_coverage',
				'pol_constraint_propagation',
				'pol_assumption_disclosure',
				'pol_intent_preservation'
			],
			sourceSection:
				'Spec §16 (policies Decomposition Coverage, Constraint Propagation, Dependency Completeness, Assumption Disclosure, Plan Feasibility, Test-Strategy Adequacy, Migration Safety, Rollback Sufficiency, Scope Integrity, Architecture Conformance); DOC-005 §5.3 — maps to legacy PROPOSE. Only WORK_DECOMPOSITION is a seeded template (§44). pol_constraint_propagation + pol_test_adequacy are BEYOND-SEED. pwuKind INFERRED UPPER_SNAKE.'
		},
		{
			pwuKind: 'WORK_DECOMPOSITION',
			isRoot: false,
			purpose:
				'Create bounded child PWUs that collectively satisfy a parent obligation, with obligation/constraint/assumption allocation, sibling dependencies, retained parent obligations, coverage claims, and a recomposition contract.',
			inputs: ['parent PWU and parent intent', 'parent obligations', 'constraints', 'assumptions'],
			outputArtifactTypes: [
				'WORK_DECOMPOSITION',
				'DECOMPOSITION_CONTRACT',
				'RECOMPOSITION_CONTRACT',
				'DEPENDENCY_GRAPH'
			],
			completionClaims: [
				'Child PWUs collectively cover the parent obligation with coherent cohesion, minimized coupling, fit granularity, and clear boundaries.',
				'A feasible recomposition strategy exists and intent is preserved through decomposition.',
				'The decomposition is incomplete until it explains how child results establish the parent claim.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE', 'ANALYSIS'],
			candidateChildren: [],
			defaultPolicyIds: [
				'pol_decomposition_coverage',
				'pol_constraint_propagation',
				'pol_intent_preservation'
			],
			sourceSection:
				'Spec §17 (quality attributes Coverage/Cohesion/Coupling/Granularity/Boundary clarity/Recomposition feasibility/Traceability), §38 decomposition rules, §39 recomposition rules; Reference §13 dcp_fsm_arch_001 (obligation allocations + coverage claim). pol_constraint_propagation is BEYOND-SEED. pwuKind INFERRED UPPER_SNAKE.'
		},
		{
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			isRoot: false,
			purpose:
				'Produce source code, configuration, tests, documentation, migrations, and related product artifacts from the approved implementation decomposition; disclose newly discovered assumptions and deviations without silently changing authoritative intent, requirements, or architecture.',
			inputs: [
				'approved PWU shape',
				'requirements',
				'architecture',
				'constraints',
				'execution plan',
				'runtime bindings',
				'context policy',
				'test strategy'
			],
			outputArtifactTypes: [
				'SOURCE_CODE',
				'TESTS',
				'SCHEMAS',
				'CONFIGURATION',
				'MIGRATIONS',
				'DOCUMENTATION',
				'DEPLOYMENT_MANIFESTS',
				'PRODUCT_ARTIFACT'
			],
			completionClaims: [
				'Implemented artifacts satisfy allocated requirements and conform to the approved architecture within scope.',
				'Tests demonstrate applicable behavior.',
				'No undisclosed material assumption governs the result.',
				'Agents did not silently change authoritative intent, requirements, or architecture.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TEST_RESULT', 'TRACE', 'OBSERVATION'],
			candidateChildren: [
				'FEATURE_IMPLEMENTATION',
				'API_IMPLEMENTATION',
				'UI_IMPLEMENTATION',
				'DATA_MODEL_IMPLEMENTATION',
				'INTEGRATION_IMPLEMENTATION',
				'SECURITY_CONTROL_IMPLEMENTATION',
				'TEST_IMPLEMENTATION',
				'MIGRATION_IMPLEMENTATION',
				'DOCUMENTATION',
				'DEPLOYMENT_CONFIGURATION'
			],
			defaultPolicyIds: [
				'pol_assumption_disclosure',
				'pol_test_adequacy',
				'pol_intent_preservation'
			],
			sourceSection:
				'Spec §18 (children generated dynamically from the approved implementation decomposition, not fixed templates; policies Implementation Scope Conformance, Requirement Satisfaction, Architecture Conformance, Boundary Compliance, Code Quality, Test Evidence Sufficiency, Security Control Conformance, Migration Correctness, Documentation Adequacy, Unsupported-Assumption Detection); DOC-005 §5.8 — maps to legacy EXECUTE (NOT STARTED in fixture). pol_test_adequacy + pol_implementation_scope_conformance are BEYOND-SEED. pwuKind INFERRED UPPER_SNAKE.'
		},
		{
			pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
			isRoot: false,
			purpose:
				'Establish justified confidence that the implemented product satisfies Product Intent and is suitable for baseline promotion by evaluating whether the total body of evidence supports product-level claims — not reducible to test execution.',
			inputs: [
				'implemented artifacts',
				'requirements',
				'critical journeys',
				'architecture baseline',
				'integrated/end-to-end evidence',
				'known limitations',
				'open findings',
				'residual uncertainty'
			],
			outputArtifactTypes: [
				'EVIDENCE_PACKAGE',
				'TEST_STRATEGY',
				'COVERAGE_REPORTS',
				'RESIDUAL_RISK_RECORD',
				'PRODUCT_ARTIFACT'
			],
			completionClaims: [
				'Applicable requirements are satisfied.',
				'Critical journeys work as intended.',
				'Architecture constraints are preserved.',
				'Integrations behave correctly.',
				'Regressions are within acceptable bounds.',
				'Security and operational controls are adequate.',
				'Migration and rollback behavior are acceptable.',
				'Residual uncertainty is disclosed.',
				'The result serves the originating Product Intent.'
			],
			requiredEvidenceTypes: [
				'TEST_RESULT',
				'OBSERVATION',
				'TRACE',
				'REVIEW',
				'ANALYSIS',
				'MEASUREMENT'
			],
			candidateChildren: [
				'REQUIREMENT_VERIFICATION',
				'JOURNEY_VALIDATION',
				'ARCHITECTURE_CONFORMANCE',
				'INTEGRATION_VALIDATION',
				'REGRESSION_VALIDATION',
				'SECURITY_VALIDATION',
				'OPERATIONAL_VALIDATION',
				'MIGRATION_VALIDATION',
				'FITNESS_FOR_PURPOSE',
				'EVIDENCE_PACKAGE_ASSEMBLY'
			],
			defaultPolicyIds: ['pol_fitness_for_purpose', 'pol_test_adequacy', 'pol_intent_preservation'],
			sourceSection:
				'Spec §19 (validation evaluates whether TOTAL evidence supports product-level claims; policies Requirement Verification, Journey Outcome Validation, Integration Correctness, Regression Adequacy, Security Assurance, Operational Readiness, Migration Assurance, Evidence Completeness, Fitness for Purpose, Intent Preservation, Residual Uncertainty Disclosure); DOC-005 §5.9 — maps to legacy VALIDATE (PARTIAL in fixture). pol_fitness_for_purpose + pol_test_adequacy are BEYOND-SEED. pwuKind INFERRED UPPER_SNAKE.'
		},
		{
			pwuKind: 'PRODUCT_BASELINE_PROMOTION',
			isRoot: false,
			purpose:
				'Determine whether a candidate set of product artifacts should become an authoritative, immutable baseline, gated by evidence and governance authority; produce evidence package, promotion recommendation, governance decision, and residual-risk record.',
			inputs: [
				'candidate artifacts',
				'approved intent',
				'requirements',
				'architecture baseline',
				'implementation evidence',
				'validation assessments',
				'open observations',
				'waivers',
				'residual uncertainty',
				'release or deployment constraints'
			],
			outputArtifactTypes: [
				'EVIDENCE_PACKAGE',
				'PROMOTION_DECISION',
				'BASELINE',
				'RESIDUAL_RISK_RECORD'
			],
			completionClaims: [
				'The candidate baseline is sufficiently supported by evidence and governance to serve as the authoritative product state for its declared purpose. Conditions: no unresolved critical finding; blocking findings resolved or validly waived; required assessments complete; baseline items immutable; decision authority valid; promoted version matches reviewed version; rollback/recovery exists where required; residual uncertainty accepted.'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'APPROVAL', 'TRACE', 'REVIEW'],
			candidateChildren: [],
			defaultPolicyIds: [
				'pol_baseline_promotion',
				'pol_intent_preservation',
				'pol_fitness_for_purpose'
			],
			sourceSection:
				'Spec §20 (promotion conditions; policies Evidence Package Completeness, Version Integrity, Open-Finding Disposition, Waiver Validity, Decision Authority, Baseline Consistency, Promotion Readiness); Reference §22-§23 dec_fsm_arch_001 -> base_fsm_arch_001 (architecture-baseline-only; status AUTHORITATIVE). pol_baseline_promotion (Catalog §26) + pol_fitness_for_purpose are BEYOND-SEED. pwuKind INFERRED UPPER_SNAKE.'
		}
	],
	seedPolicies: [
		{
			policyId: 'pol_architecture_coverage',
			name: 'Architecture Coverage',
			evaluatedClaimTypes: ['COVERAGE', 'SECURITY', 'FEASIBILITY', 'CONSISTENCY'],
			appliesToPwuKinds: ['ARCHITECTURE_DEFINITION'],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE', 'ANALYSIS'],
			criteria: [
				{
					id: 'AC-01',
					name: 'AC-01',
					description: 'Applicable requirements are allocated to architecture.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-02',
					name: 'AC-02',
					description: 'System boundaries are explicit.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-03',
					name: 'AC-03',
					description: 'Major components have coherent responsibilities.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-04',
					name: 'AC-04',
					description: 'Interfaces are sufficiently defined.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-05',
					name: 'AC-05',
					description: 'Data ownership is explicit (data-integrity boundary).',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-06',
					name: 'AC-06',
					description: 'Security boundaries (incl. tenant isolation) are represented.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-07',
					name: 'AC-07',
					description: 'Operational and deployment concerns are proportionate.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-08',
					name: 'AC-08',
					description: 'Mandatory constraints are preserved.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-09',
					name: 'AC-09',
					description: 'Known architecture risks and assumptions are explicit.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'AC-10',
					name: 'AC-10',
					description: 'Architecture is feasible.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'UNCOVERED_REQUIREMENT',
				'UNCLEAR_SYSTEM_BOUNDARY',
				'UNCLEAR_COMPONENT_RESPONSIBILITY',
				'MISSING_INTERFACE_DEFINITION',
				'AMBIGUOUS_DATA_OWNERSHIP',
				'MISSING_SECURITY_BOUNDARY',
				'MISSING_OPERATIONAL_CONCERN',
				'ARCHITECTURE_CONSTRAINT_VIOLATION',
				'UNRESOLVED_ARCHITECTURE_CONFLICT',
				'UNSUPPORTED_FEASIBILITY_CLAIM',
				'ARCHITECTURE_OVERFIT',
				'ARCHITECTURE_UNDERFIT'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'CRITICAL',
			sourceSection:
				"CANONICAL id pol_architecture_coverage (Catalog §21); ALIAS = fixture pol_arch_coverage_v1 (Reference §18.5, §19). Spec §30. Criteria SYNTHESIZED from the ten §21.3 claims. Required-evidence prose (§21.4): approved intent, requirements, journeys, architecture artifacts, decision records, interface definitions, data model, deployment model, security analysis, traceability, assumption catalog. Applicability (§21.2): architecture PWU completes execution / architecture materially revised / implementation planning begins / baseline promotion requested. Disposition (§21.6): critical security, tenant-isolation, data-integrity, or mandatory-constraint failures are BLOCKING (drives failureSeverity CRITICAL; escalate finding severity to CRITICAL for security/isolation). FIXTURE: assess_fsm_arch_coverage_001 evaluated claims FSM-ARCH-001..006, evaluator agent_verifier_001 (distinct executionInstanceId => DIFFERENT_AGENT), disposition CONDITIONALLY_SATISFIED with 2 OPEN MATERIAL observations obs_fsm_arch_001 (offline ambiguity, EVIDENCE_DEFICIT) + obs_fsm_arch_002 (tenant-isolation, RECOMMENDATION) — proving EXECUTION!=ASSURANCE (INV-5). RECONCILED: failureSeverity CRITICAL (DOC-004/006) over DOC-003 BLOCKING; appliesToPwuKinds ARCHITECTURE_DEFINITION only (DOC-004/006) — DOC-003 also listed ARCHITECTURE_DECISION; evaluatedClaimTypes = agreed core 4 (DOC-003 added PRESERVATION, DOC-004 added CORRECTNESS); AC-03 mandatory=false (DOC-003/006). CRITERION-ID NOTE: kept AC- prefix (DOC-003/004) but DOC-006 used ARC- to avoid collision with Acceptance-Criterion 'AC-*' ids used elsewhere in the codebase — see conflicts/openItems."
		},
		{
			policyId: 'pol_assumption_disclosure',
			name: 'Assumption Disclosure',
			evaluatedClaimTypes: ['COMPLETENESS', 'CORRECTNESS'],
			appliesToPwuKinds: [
				'INTENT_AND_PRODUCT_DEFINITION',
				'PRODUCT_BEHAVIOR_DEFINITION',
				'ARCHITECTURE_DEFINITION',
				'ARCHITECTURE_DECISION',
				'IMPLEMENTATION_PLANNING',
				'WORK_DECOMPOSITION',
				'PRODUCT_IMPLEMENTATION',
				'INTEGRATED_PRODUCT_VALIDATION'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'SOURCE', 'ANALYSIS'],
			criteria: [
				{
					id: 'AD-01',
					name: 'AD-01',
					description:
						'Material assumptions have been surfaced as first-class Assumption Objects (not left in prose).',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AD-02',
					name: 'AD-02',
					description: 'Assumptions are distinguished from established facts.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AD-03',
					name: 'AD-03',
					description: 'Affected objects are identified for each assumption.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AD-04',
					name: 'AD-04',
					description: 'Materiality is classified (IMMATERIAL / MATERIAL / CRITICAL).',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AD-05',
					name: 'AD-05',
					description: 'Verification or authorized-acceptance needs are identified.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'AD-06',
					name: 'AD-06',
					description:
						'No critical assumption silently authorizes irreversible or high-impact work without verification or authorized acceptance.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'HIDDEN_MATERIAL_ASSUMPTION',
				'ASSUMPTION_PRESENTED_AS_FACT',
				'UNBOUNDED_ASSUMPTION_SCOPE',
				'MISSING_ASSUMPTION_BASIS',
				'UNASSESSED_CRITICAL_ASSUMPTION',
				'EXPIRED_ASSUMPTION',
				'CONFLICTING_ASSUMPTIONS'
			],
			independenceRequirement: 'DIFFERENT_INVOCATION',
			failureSeverity: 'MATERIAL',
			sourceSection:
				"CANONICAL id pol_assumption_disclosure (Catalog §17); ALIAS = fixture pol_assumption_disclosure_v1 (Reference §18.3). Spec §27. CROSS-CUTTING: applies to ALL model-produced professional artifacts (§17.2, §29.4) — the ONE policy attached to BOTH pwu_fsm_intent (§10) and pwu_fsm_arch (§12) in the fixture. Criteria SYNTHESIZED from §17.3. Required-evidence prose (§17.4): artifact under assessment, execution rationale, prompt/context provenance, known facts, constraints, decisions, external sources. Required output (§17.6): each material assumption becomes an Assumption Object (statement/basis/materiality/affectedObjects/status/verificationMethod). SATISFIED means disclosed, NOT verified (§17.7). Control actions: GATHER_EVIDENCE, CLARIFY, RESHAPE_PWU, INVALIDATE_DEPENDENTS, REQUEST_HUMAN_DECISION, ESCALATE. RECONCILED: appliesToPwuKinds = UNION (DOC-003's 8; includes ARCHITECTURE_DECISION + WORK_DECOMPOSITION dropped by DOC-004/006) per 'any model-produced artifact'; failureSeverity MATERIAL base (DOC-003/006) over DOC-004 BLOCKING — a critical unresolved assumption governing irreversible work ESCALATES to BLOCKING/CRITICAL (per-finding), yielding CONDITIONALLY_SATISFIED/REJECTED/ESCALATED; AD-05 mandatory=true (DOC-003/006)."
		},
		{
			policyId: 'pol_baseline_promotion',
			name: 'Baseline Promotion',
			evaluatedClaimTypes: ['COMPLIANCE', 'CORRECTNESS'],
			appliesToPwuKinds: ['PRODUCT_BASELINE_PROMOTION'],
			requiredEvidenceTypes: ['APPROVAL', 'ARTIFACT', 'TRACE'],
			criteria: [
				{
					id: 'BP-01',
					name: 'BP-01',
					description: 'candidate artifacts are exactly identified.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-02',
					name: 'BP-02',
					description: 'reviewed and promoted versions match.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-03',
					name: 'BP-03',
					description: 'required assessments are complete.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-04',
					name: 'BP-04',
					description: 'blocking findings are resolved or validly waived.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-05',
					name: 'BP-05',
					description: 'evidence remains valid.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-06',
					name: 'BP-06',
					description: 'decision authority is valid.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-07',
					name: 'BP-07',
					description: 'residual risk is disclosed and accepted.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-08',
					name: 'BP-08',
					description: 'rollback or recovery exists where required.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				},
				{
					id: 'BP-09',
					name: 'BP-09',
					description: 'the baseline has a declared purpose and scope.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'CRITICAL',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'CANDIDATE_VERSION_MISMATCH',
				'MISSING_REQUIRED_ASSESSMENT',
				'OPEN_BLOCKING_FINDING',
				'INVALID_OR_EXPIRED_WAIVER',
				'INVALIDATED_EVIDENCE',
				'MISSING_DECISION_AUTHORITY',
				'UNACCEPTED_RESIDUAL_RISK',
				'MISSING_RECOVERY_PLAN',
				'AMBIGUOUS_BASELINE_SCOPE'
			],
			independenceRequirement: 'HUMAN',
			failureSeverity: 'CRITICAL',
			sourceSection:
				'DOC-004 §26 (POL-BASELINE-PROMOTION) — seeded 2026-07-16 to complete the catalog: the ratified conformance profiles and PWU templates reference 12 policies and the ontology shipped 6, so validateOntology() reported 21 unresolved references and HIGH_ASSURANCE was unsatisfiable. RATIFIED: purpose (§26.1); the 9 criteria descriptions are §26.3\'s "Claims evaluated" items 1:1 verbatim; the 9 finding codes are §26.5 verbatim. PRECEDENTED DERIVATION: criterion ids minted BP-0N against §26.3\'s ordering — the same rule that produced the existing IC-01..IC-05 from §16.3; criterion `name` = the id, because §26 has no Criteria section (only §15.6/§19.5 ratify names). INDEPENDENCE: AUTHORED — §26 has NO Independence subsection (verified: only 26.1-26.7 exist). HUMAN chosen because §26.3 claim 6 ratifies "decision authority is valid" and §26.7 ratifies "Critical integrity failures cannot be waived by ordinary product authority" — a baseline promotion is a human governance act by the doc\'s own text. AUTHORED (no ratified source): evaluatedClaimTypes, appliesToPwuKinds, requiredEvidenceTypes, evaluatorRole, failureSeverity, and each criterion\'s criterionType/evaluationMethod. Extraction adversarially verified against the doc (6/6 faithful).',
			evaluatorRole: 'baseline-promotion-reviewer'
		},
		{
			policyId: 'pol_constraint_propagation',
			name: 'Constraint Propagation',
			evaluatedClaimTypes: ['PRESERVATION', 'CONSISTENCY'],
			appliesToPwuKinds: ['IMPLEMENTATION_PLANNING', 'WORK_DECOMPOSITION'],
			requiredEvidenceTypes: ['SOURCE', 'TRACE'],
			criteria: [
				{
					id: 'CP-01',
					name: 'CP-01',
					description: 'Every mandatory applicable parent constraint has an explicit disposition.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'CP-02',
					name: 'CP-02',
					description: 'propagated constraints retain authority and strength.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'CP-03',
					name: 'CP-03',
					description: 'inapplicability decisions have rationale.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'CP-04',
					name: 'CP-04',
					description: 'waivers are authorized and scoped.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'CP-05',
					name: 'CP-05',
					description: 'child artifacts do not contradict inherited constraints.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'SILENT_CONSTRAINT_DROP',
				'WEAKENED_CONSTRAINT',
				'UNAUTHORIZED_INAPPLICABILITY',
				'EXPIRED_CONSTRAINT_WAIVER',
				'CONSTRAINT_CONTRADICTION',
				'MISSING_CONSTRAINT_TRACE',
				'CONSTRAINT_SCOPE_ERROR'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'BLOCKING',
			sourceSection:
				"DOC-004 §20 (POL-CONSTRAINT-PROPAGATION) — seeded 2026-07-16 to complete the catalog: the ratified conformance profiles and PWU templates reference 12 policies and the ontology shipped 6, so validateOntology() reported 21 unresolved references and HIGH_ASSURANCE was unsatisfiable. RATIFIED: purpose (§20.1); the 5 criteria descriptions are §20.3's \"Claims evaluated\" items 1:1 verbatim; the 7 finding codes are §20.5 verbatim. PRECEDENTED DERIVATION: criterion ids minted CP-0N against §20.3's ordering — the same rule that produced the existing IC-01..IC-05 from §16.3; criterion `name` = the id, because §20 has no Criteria section (only §15.6/§19.5 ratify names). INDEPENDENCE: AUTHORED — §20 has NO Independence subsection (verified: only 20.1-20.5 exist). Falls back to the STANDARD conformance profile minIndependence, which is the profile this policy is mandatory for. AUTHORED (no ratified source): evaluatedClaimTypes, appliesToPwuKinds, requiredEvidenceTypes, evaluatorRole, failureSeverity, and each criterion's criterionType/evaluationMethod. Extraction adversarially verified against the doc (6/6 faithful).",
			evaluatorRole: 'constraint-propagation-reviewer'
		},
		{
			policyId: 'pol_decomposition_coverage',
			name: 'Decomposition Coverage',
			evaluatedClaimTypes: ['COVERAGE', 'PRESERVATION', 'FEASIBILITY'],
			appliesToPwuKinds: [
				'ARCHITECTURE_DEFINITION',
				'IMPLEMENTATION_PLANNING',
				'WORK_DECOMPOSITION',
				'PRODUCT_REALIZATION'
			],
			requiredEvidenceTypes: ['ARTIFACT', 'TRACE', 'ANALYSIS'],
			criteria: [
				{
					id: 'DC-01',
					name: 'Obligation coverage',
					description:
						'no mandatory parent obligation silently disappears (every one is allocated, retained, satisfied, or waived).',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'DC-02',
					name: 'Constraint preservation',
					description: 'applicable constraints are propagated or explicitly retained.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'DC-03',
					name: 'Cohesion',
					description: 'each child represents coherent professional work.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'DC-04',
					name: 'Boundary clarity',
					description: 'child responsibilities are distinguishable.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'DC-05',
					name: 'Dependency completeness',
					description: 'material sibling dependencies are explicit.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'DC-06',
					name: 'Recomposition feasibility',
					description: 'a credible parent-level integration strategy exists.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'DC-07',
					name: 'Intent continuity',
					description: 'child objectives remain subordinate to parent intent.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'MISSING_OBLIGATION_ALLOCATION',
				'DROPPED_CONSTRAINT',
				'ORPHAN_CHILD_PWU',
				'OVERLAPPING_CHILD_SCOPE',
				'EXCESSIVE_CHILD_COUPLING',
				'INVALID_GRANULARITY',
				'MISSING_SIBLING_DEPENDENCY',
				'MISSING_RECOMPOSITION_STRATEGY',
				'CHILD_INTENT_DIVERGENCE',
				'FALSE_COMPLETE_COVERAGE'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'BLOCKING',
			sourceSection:
				'CANONICAL id pol_decomposition_coverage (Catalog §19); ALIAS = fixture pol_decomposition_coverage_v1 (Reference §18.4, applied to DECOMPOSITION_CONTRACT dcp_fsm_arch_001; DecompositionValidated event 32 gates child execution). Spec §29. Criteria DC-01..DC-07 EXPLICIT/VERBATIM in §19.5. Required-evidence prose (§19.4): parent PWU/intent/obligations, constraints, assumptions, child PWUs, allocation map, dependency graph, recomposition contract. Applicability (§19.2): Decomposition Contract submitted / decomposition changes semantically / child removed / parent obligation changes. Disposition (§19.7): any missing mandatory obligation OR child intent divergence (OR no recomposition strategy / invalid authority) is BLOCKING. Control actions: REVISE_DECOMPOSITION, RESHAPE_PWU, CLARIFY, REQUEST_HUMAN_DECISION, REJECT. RECONCILED: evaluatedClaimTypes = [COVERAGE,PRESERVATION,FEASIBILITY] (FEASIBILITY in DOC-003/006); DOC-003 also had CONSISTENCY, DOC-004 had COMPLETENESS (divergent tail, see conflicts). Independence DIFFERENT_AGENT (DOC-004/006) over DOC-003 DIFFERENT_INVOCATION baseline; DC-05 mandatory=true (DOC-003/006).'
		},
		{
			policyId: 'pol_fitness_for_purpose',
			name: 'Fitness For Purpose',
			evaluatedClaimTypes: ['FITNESS'],
			appliesToPwuKinds: [
				'INTEGRATED_PRODUCT_VALIDATION',
				'PRODUCT_REALIZATION',
				'PRODUCT_BASELINE_PROMOTION'
			],
			requiredEvidenceTypes: ['OBSERVATION', 'REVIEW', 'TEST_RESULT'],
			criteria: [
				{
					id: 'FP-01',
					name: 'FP-01',
					description: 'intended actors can achieve critical outcomes.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'FP-02',
					name: 'FP-02',
					description: 'major journeys function coherently.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'FP-03',
					name: 'FP-03',
					description: 'the product addresses the originating problem.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'FP-04',
					name: 'FP-04',
					description: 'technical correctness has not obscured product failure.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'FP-05',
					name: 'FP-05',
					description: 'known limitations are compatible with declared use.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'FP-06',
					name: 'FP-06',
					description: 'residual uncertainty is acceptable.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'FP-07',
					name: 'FP-07',
					description: 'critical operational conditions are represented.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'PRODUCT_OUTCOME_NOT_ACHIEVABLE',
				'CRITICAL_JOURNEY_FAILURE',
				'TECHNICALLY_CORRECT_PRODUCT_FAILURE',
				'MISSING_OPERATIONAL_REALITY',
				'UNACCEPTABLE_LIMITATION',
				'UNRESOLVED_USER_VALUE_GAP',
				'FITNESS_EVIDENCE_INSUFFICIENT'
			],
			independenceRequirement: 'HUMAN',
			failureSeverity: 'BLOCKING',
			sourceSection:
				'DOC-004 §25 (POL-FITNESS-FOR-PURPOSE) — seeded 2026-07-16 to complete the catalog: the ratified conformance profiles and PWU templates reference 12 policies and the ontology shipped 6, so validateOntology() reported 21 unresolved references and HIGH_ASSURANCE was unsatisfiable. RATIFIED: purpose (§25.1); the 7 criteria descriptions are §25.3\'s "Claims evaluated" items 1:1 verbatim; the 7 finding codes are §25.5 verbatim. PRECEDENTED DERIVATION: criterion ids minted FP-0N against §25.3\'s ordering — the same rule that produced the existing IC-01..IC-05 from §16.3; criterion `name` = the id, because §25 has no Criteria section (only §15.6/§19.5 ratify names). INDEPENDENCE: RATIFIED §25.6 "Standard: independent validator implementation plus human product decision. High assurance: independent validation team or organizational authority." -> HUMAN (the Standard rung; the High-Assurance rung ORGANIZATIONALLY_INDEPENDENT is profile-escalated, not the policy default). AUTHORED (no ratified source): evaluatedClaimTypes, appliesToPwuKinds, requiredEvidenceTypes, evaluatorRole, failureSeverity, and each criterion\'s criterionType/evaluationMethod. Extraction adversarially verified against the doc (6/6 faithful).',
			evaluatorRole: 'fitness-for-purpose-reviewer'
		},
		{
			policyId: 'pol_historical_consistency',
			name: 'Historical Consistency',
			evaluatedClaimTypes: ['CONSISTENCY'],
			appliesToPwuKinds: ['ARCHITECTURE_DECISION'],
			requiredEvidenceTypes: ['SOURCE', 'TRACE', 'ANALYSIS'],
			criteria: [
				{
					id: 'HC-01',
					name: 'HC-01',
					description: 'relevant historical records were considered.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				},
				{
					id: 'HC-02',
					name: 'HC-02',
					description: 'known failure patterns are not repeated without justification.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				},
				{
					id: 'HC-03',
					name: 'HC-03',
					description: 'active decisions are not silently contradicted.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				},
				{
					id: 'HC-04',
					name: 'HC-04',
					description: 'recorded rationale is not ignored.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				},
				{
					id: 'HC-05',
					name: 'HC-05',
					description: 'divergence from precedent is explicit and justified.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'KNOWN_FAILURE_RECURRENCE',
				'ACTIVE_DECISION_CONFLICT',
				'UNEXPLAINED_PRECEDENT_DIVERGENCE',
				'STALE_PRECEDENT_APPLIED',
				'MISSING_DESIGN_RATIONALE',
				'HISTORICAL_CONTEXT_INSUFFICIENT',
				'CHESTERTONS_FENCE_RISK'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'MATERIAL',
			sourceSection:
				'DOC-004 §22 (POL-HISTORICAL-CONSISTENCY) — seeded 2026-07-16 to complete the catalog: the ratified conformance profiles and PWU templates reference 12 policies and the ontology shipped 6, so validateOntology() reported 21 unresolved references and HIGH_ASSURANCE was unsatisfiable. RATIFIED: purpose (§22.1); the 5 criteria descriptions are §22.3\'s "Claims evaluated" items 1:1 verbatim; the 7 finding codes are §22.5 verbatim. PRECEDENTED DERIVATION: criterion ids minted HC-0N against §22.3\'s ordering — the same rule that produced the existing IC-01..IC-05 from §16.3; criterion `name` = the id, because §22 has no Criteria section (only §15.6/§19.5 ratify names). INDEPENDENCE: AUTHORED — §22 has NO Independence subsection (verified: only 22.1-22.6 exist). Falls back to the HIGH_ASSURANCE profile minIndependence floor of DIFFERENT_AGENT; §22.2 marks the policy "Recommended", not Required. AUTHORED (no ratified source): evaluatedClaimTypes, appliesToPwuKinds, requiredEvidenceTypes, evaluatorRole, failureSeverity, and each criterion\'s criterionType/evaluationMethod. Extraction adversarially verified against the doc (6/6 faithful).',
			evaluatorRole: 'historical-consistency-reviewer'
		},
		{
			policyId: 'pol_intent_completeness',
			name: 'Intent Completeness',
			evaluatedClaimTypes: ['COMPLETENESS', 'COVERAGE'],
			appliesToPwuKinds: ['INTENT_AND_PRODUCT_DEFINITION', 'PRODUCT_BOUNDARY'],
			requiredEvidenceTypes: ['ARTIFACT', 'ANALYSIS'],
			criteria: [
				{
					id: 'IC-01',
					name: 'IC-01',
					description:
						'Desired outcomes are sufficiently explicit for the next authorized activity.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IC-02',
					name: 'IC-02',
					description: 'Product boundaries are sufficient for the next authorized activity.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IC-03',
					name: 'IC-03',
					description: 'Known stakeholders and actors are represented proportionally to risk.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'IC-04',
					name: 'IC-04',
					description: 'Mandatory constraints are recorded.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IC-05',
					name: 'IC-05',
					description: 'Success conditions exist, or the work is explicitly marked exploratory.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IC-06',
					name: 'IC-06',
					description: 'Major ambiguities have explicit dispositions.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'MISSING_DESIRED_OUTCOME',
				'UNBOUNDED_PRODUCT_SCOPE',
				'MISSING_MANDATORY_CONSTRAINT',
				'UNRESOLVED_CRITICAL_AMBIGUITY',
				'NO_SUCCESS_CONDITION',
				'PREMATURE_DOWNSTREAM_SHAPING',
				'FALSE_COMPLETENESS'
			],
			independenceRequirement: 'DIFFERENT_INVOCATION',
			failureSeverity: 'MATERIAL',
			sourceSection:
				'CANONICAL id pol_intent_completeness (Catalog §16); ALIAS = fixture pol_intent_complete_v1 (Reference §18.2, applied before architecture). Spec §26. Criteria SYNTHESIZED 1:1 from the §16.3 claim list (source has no lettered criteria). Required-evidence prose (§16.4): Product Intent, ambiguity catalog, constraint catalog, stakeholder/actor catalog, non-goals, risk profile. Completeness is RISK-RELATIVE (§16.1) — sufficiency for the next authorized activity, not exhaustive spec. Applicability (§16.2): REQUIRED before Product Behavior Definition, Architecture Definition, high-impact implementation planning (encode via ApplicabilityExpression, NOT via appliesToPwuKinds). Dispositions: SATISFIED/CONDITIONALLY_SATISFIED (exploratory when uncertainty explicit + downstream reversible)/INCONCLUSIVE/REJECTED. PREMATURE_DOWNSTREAM_SHAPING of irreversible/high-impact work escalates to BLOCKING. RECONCILED: evaluatedClaimTypes COVERAGE (DOC-003/004) over FITNESS (DOC-006); appliesToPwuKinds restricted to intent+boundary (DOC-004/006) — DOC-003 also listed behavior+architecture (that is its GATE relationship, modeled as applicability); IC-05 mandatory=true (DOC-003/006) over DOC-004 false; IC-03 mandatory=false (DOC-003/004) over DOC-006 true.'
		},
		{
			policyId: 'pol_intent_fidelity',
			name: 'Intent Fidelity',
			evaluatedClaimTypes: ['PRESERVATION', 'CORRECTNESS', 'COMPLETENESS'],
			appliesToPwuKinds: [
				'INTENT_AND_PRODUCT_DEFINITION',
				'INTENT_DISCOVERY',
				'PRODUCT_BOUNDARY',
				'PRODUCT_REALIZATION'
			],
			requiredEvidenceTypes: ['SOURCE', 'ARTIFACT', 'TRACE'],
			criteria: [
				{
					id: 'IF-01',
					name: 'Objective fidelity',
					description:
						"the formalized objective represents the user's need rather than substituting a preferred solution.",
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IF-02',
					name: 'Boundary fidelity',
					description:
						'in-scope and out-of-scope statements are consistent with user authority (no unauthorized scope expansion).',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IF-03',
					name: 'Constraint fidelity',
					description: 'explicit user constraints are preserved (not omitted or weakened).',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IF-04',
					name: 'Interpretation disclosure',
					description:
						'inferred elements are labeled as inferred or proposed, not presented as user fact/requirement.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IF-05',
					name: 'Ambiguity visibility',
					description: 'materially unresolved interpretations remain explicit.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'SOLUTION_SUBSTITUTION',
				'UNAUTHORIZED_SCOPE_EXPANSION',
				'MISSING_USER_CONSTRAINT',
				'FALSELY_CLOSED_AMBIGUITY',
				'INFERRED_NEED_PRESENTED_AS_FACT',
				'OUTCOME_EROSION',
				'NON_GOAL_CONFLICT'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'BLOCKING',
			sourceSection:
				"CANONICAL id pol_intent_fidelity (Catalog/DOC-004 §15.1, v1.0.0); ALIAS = fixture pol_intent_fidelity_v1 (Reference §18.1, attached to pwu_fsm_intent + Product Intent Baseline). Spec/DOC-003 §25. Criteria IF-01..IF-05 EXPLICIT in §15.6. Required-evidence prose (§15.5): originating expression, clarification dialogue, supplied documents, proposed Product Intent, constraints, recorded user corrections, prior intent version. Blocking (§25): objective contradicts user expression / mandatory constraint omitted / major ambiguity hidden / inferred solution presented as user requirement. Unauthorized intent alteration CANNOT be waived (§15.11); a user-approved revised intent is a governed intent revision. Control actions: CLARIFY, REVISE_CONTEXT, RESHAPE_PWU, REQUEST_HUMAN_DECISION, REJECT. RECONCILED: evaluatedClaimTypes CORRECTNESS (DOC-003/004) over CONSISTENCY (DOC-006); independence DIFFERENT_AGENT (DOC-004/006, = §15.8 Standard 'different invocation + agent role') over DOC-003 DIFFERENT_INVOCATION baseline — profile-escalates to DIFFERENT_MODEL+HUMAN at High-Assurance."
		},
		{
			policyId: 'pol_intent_preservation',
			name: 'Intent Preservation',
			evaluatedClaimTypes: ['PRESERVATION', 'FITNESS', 'CONSISTENCY'],
			appliesToPwuKinds: [
				'PRODUCT_BEHAVIOR_DEFINITION',
				'ARCHITECTURE_DEFINITION',
				'IMPLEMENTATION_PLANNING',
				'WORK_DECOMPOSITION',
				'PRODUCT_IMPLEMENTATION',
				'INTEGRATED_PRODUCT_VALIDATION',
				'PRODUCT_BASELINE_PROMOTION',
				'PRODUCT_REALIZATION'
			],
			requiredEvidenceTypes: ['SOURCE', 'ARTIFACT', 'TRACE'],
			criteria: [
				{
					id: 'IP-01',
					name: 'IP-01',
					description: 'Desired outcomes remain represented.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IP-02',
					name: 'IP-02',
					description: 'Scope has not expanded or contracted without authority.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IP-03',
					name: 'IP-03',
					description: 'Mandatory constraints remain active.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IP-04',
					name: 'IP-04',
					description: 'Descendant work continues to serve the parent objective.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IP-05',
					name: 'IP-05',
					description: 'Implementation choices have not replaced product need.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'IP-06',
					name: 'IP-06',
					description: 'Local success contributes to global success.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'ADVISORY',
					mayBeNotApplicable: false
				},
				{
					id: 'IP-07',
					name: 'IP-07',
					description: 'Authorized intent revisions are properly recorded.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'INTENT_EROSION',
				'INTENT_EXPANSION',
				'CHILD_OBJECTIVE_DRIFT',
				'IMPLEMENTATION_SUBSTITUTION',
				'LOCAL_SUCCESS_GLOBAL_FAILURE',
				'LOST_USER_OUTCOME',
				'UNAUTHORIZED_INTENT_REVISION',
				'TRACEABILITY_BREAK'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'BLOCKING',
			sourceSection:
				"CANONICAL id pol_intent_preservation (Catalog §23); ALIAS = fixture pol_intent_preservation_v1 (Reference §18.6, attached to pwu_fsm_arch; AssuranceAssessmentSatisfied: Intent Preservation event 62 compares originating expression -> approved intent -> product behavior -> architecture). Spec §32. Criteria SYNTHESIZED from §23.3; IP-01 (MET) and IP-04 (NOT_MET -> claim CONTESTED) corroborated as criterion IDs by the §33 ValidatorResult example. Required-evidence prose (§23.4): originating expression, approved intent, parent/child PWUs, constraints, transformation artifacts, decisions, trace links, completion claims. Applicability (§23.2): REQUIRED after decomposition, product behavior definition, architecture, implementation planning, implementation, integrated validation, and major semantic revision. Blocking (§23.6): any material unauthorized divergence from approved intent. Control actions: RESHAPE_PWU, REVISE_DECOMPOSITION, INVALIDATE_DEPENDENTS, REQUEST_HUMAN_DECISION, REJECT, ABANDON. RECONCILED: appliesToPwuKinds = UNION incl WORK_DECOMPOSITION (DOC-003/006; DOC-004 omitted it though §23.2 says 'after decomposition'); IP-06 mandatory=false (DOC-003/004) over DOC-006 true; 3rd evaluatedClaimType is a 3-WAY SPLIT (COMPLIANCE DOC-003 / CONSISTENCY DOC-004 / COVERAGE DOC-006) — resolved to CONSISTENCY via DOC-004 canonical-catalog tiebreak (see conflicts)."
		},
		{
			policyId: 'pol_requirement_coverage',
			name: 'Requirement Coverage',
			evaluatedClaimTypes: ['COVERAGE', 'COMPLETENESS'],
			appliesToPwuKinds: [
				'PRODUCT_BEHAVIOR_DEFINITION',
				'USER_JOURNEY_DEFINITION',
				'REQUIREMENT_DEFINITION'
			],
			requiredEvidenceTypes: ['SOURCE', 'ARTIFACT', 'TRACE'],
			criteria: [
				{
					id: 'RC-01',
					name: 'RC-01',
					description: 'Each mandatory outcome is represented.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'RC-02',
					name: 'RC-02',
					description: 'Each critical journey has applicable requirements.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'RC-03',
					name: 'RC-03',
					description: 'each mandatory constraint creates enforceable obligations.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'RC-04',
					name: 'RC-04',
					description: 'important failure paths are addressed.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'RC-05',
					name: 'RC-05',
					description: 'requirements without an authoritative source are identified.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'RC-06',
					name: 'RC-06',
					description: 'explicit exclusions are recorded.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'UNCOVERED_OUTCOME',
				'UNCOVERED_CAPABILITY',
				'UNCOVERED_JOURNEY_STEP',
				'MISSING_FAILURE_REQUIREMENT',
				'ORPHAN_REQUIREMENT',
				'CONSTRAINT_WITHOUT_OBLIGATION',
				'UNAUTHORIZED_REQUIREMENT',
				'DUPLICATE_REQUIREMENT'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'BLOCKING',
			sourceSection:
				'DOC-004 §18 (POL-REQUIREMENT-COVERAGE) — seeded 2026-07-16 to complete the catalog: the ratified conformance profiles and PWU templates reference 12 policies and the ontology shipped 6, so validateOntology() reported 21 unresolved references and HIGH_ASSURANCE was unsatisfiable. RATIFIED: purpose (§18.1); the 6 criteria descriptions are §18.3\'s "Claims evaluated" items 1:1 verbatim; the 8 finding codes are §18.5 verbatim. PRECEDENTED DERIVATION: criterion ids minted RC-0N against §18.3\'s ordering — the same rule that produced the existing IC-01..IC-05 from §16.3; criterion `name` = the id, because §18 has no Criteria section (only §15.6/§19.5 ratify names). INDEPENDENCE: RATIFIED §18.6 "Different role from primary requirement author for Standard and High-Assurance profiles." -> DIFFERENT_AGENT AUTHORED (no ratified source): evaluatedClaimTypes, appliesToPwuKinds, requiredEvidenceTypes, evaluatorRole, failureSeverity, and each criterion\'s criterionType/evaluationMethod. Extraction adversarially verified against the doc (6/6 faithful).',
			evaluatorRole: 'requirement-coverage-reviewer'
		},
		{
			policyId: 'pol_test_adequacy',
			name: 'Test Adequacy',
			evaluatedClaimTypes: ['COVERAGE', 'CORRECTNESS'],
			appliesToPwuKinds: ['PRODUCT_IMPLEMENTATION', 'INTEGRATED_PRODUCT_VALIDATION'],
			requiredEvidenceTypes: ['TEST_RESULT', 'TRACE', 'MEASUREMENT'],
			criteria: [
				{
					id: 'TA-01',
					name: 'TA-01',
					description: 'tests trace to requirements or risks.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-02',
					name: 'TA-02',
					description: 'critical journeys are covered.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-03',
					name: 'TA-03',
					description: 'failure and alternate paths are proportionately covered.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-04',
					name: 'TA-04',
					description: 'integrations are tested at appropriate boundaries.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-05',
					name: 'TA-05',
					description: 'regression scope is justified.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-06',
					name: 'TA-06',
					description: 'test environments are sufficiently representative.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-07',
					name: 'TA-07',
					description: 'results are current and reproducible where required.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				},
				{
					id: 'TA-08',
					name: 'TA-08',
					description: 'passing tests are not overclaimed.',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			findingTypes: [
				'UNTESTED_REQUIREMENT',
				'UNTESTED_CRITICAL_JOURNEY',
				'MISSING_FAILURE_PATH_TEST',
				'INADEQUATE_INTEGRATION_TEST',
				'UNJUSTIFIED_REGRESSION_SCOPE',
				'NONREPRESENTATIVE_TEST_ENVIRONMENT',
				'FLAKY_TEST_EVIDENCE',
				'STALE_TEST_RESULT',
				'TEST_CLAIM_OVERREACH',
				'TEST_ORACLE_WEAKNESS'
			],
			independenceRequirement: 'DIFFERENT_AGENT',
			failureSeverity: 'BLOCKING',
			sourceSection:
				'DOC-004 §24 (POL-TEST-ADEQUACY) — seeded 2026-07-16 to complete the catalog: the ratified conformance profiles and PWU templates reference 12 policies and the ontology shipped 6, so validateOntology() reported 21 unresolved references and HIGH_ASSURANCE was unsatisfiable. RATIFIED: purpose (§24.1); the 8 criteria descriptions are §24.3\'s "Claims evaluated" items 1:1 verbatim; the 10 finding codes are §24.5 verbatim. PRECEDENTED DERIVATION: criterion ids minted TA-0N against §24.3\'s ordering — the same rule that produced the existing IC-01..IC-05 from §16.3; criterion `name` = the id, because §24 has no Criteria section (only §15.6/§19.5 ratify names). INDEPENDENCE: AUTHORED — §24 has NO Independence subsection (verified: only 24.1-24.6 exist; 24.6 is "Important rule"). Falls back to the STANDARD profile minIndependence. AUTHORED (no ratified source): evaluatedClaimTypes, appliesToPwuKinds, requiredEvidenceTypes, evaluatorRole, failureSeverity, and each criterion\'s criterionType/evaluationMethod. Extraction adversarially verified against the doc (6/6 faithful).',
			evaluatorRole: 'test-adequacy-reviewer'
		}
	],
	conformanceProfiles: [
		{
			profile: 'LIGHTWEIGHT',
			appliesToRisk:
				'Small, reversible, well-understood changes; low-risk prototypes; local refactoring; exploratory spikes. Risk gate: RISK_AT_LEAST(CONSEQUENCE,MEDIUM)=FALSE AND RISK_AT_LEAST(IRREVERSIBILITY,MEDIUM)=FALSE AND RISK_AT_LEAST(SECURITY_SENSITIVITY,MEDIUM)=FALSE AND RISK_AT_LEAST(REGULATORY_EXPOSURE,MEDIUM)=FALSE (no dimension reaches MEDIUM). Minimum expectations (Spec §4.1, Catalog §36.1): explicit intent + bounded PWU + known constraints + expected output + local evidence + basic validation + no unresolved critical assumptions; mostly advisory findings; no human approval unless a material change emerges.',
			minIndependence: 'DIFFERENT_INVOCATION',
			mandatoryPolicyIds: ['pol_intent_fidelity', 'pol_assumption_disclosure']
		},
		{
			profile: 'STANDARD',
			appliesToRisk:
				'Ordinary product features; user-facing behavior; database/API changes; multi-component work; material architecture decisions. Risk gate: max{CONSEQUENCE,UNCERTAINTY,IRREVERSIBILITY,SECURITY_SENSITIVITY,REGULATORY_EXPOSURE} reaches MEDIUM but no dimension reaches HIGH (some RISK_AT_LEAST(*,MEDIUM)=TRUE and all RISK_AT_LEAST(*,HIGH)=FALSE). Adds journeys, acceptance criteria, architecture impact, decomposition contract, assumption disclosure, independent verification, integration evidence, human/delegated approval (Spec §4.2, Catalog §36.2). Different model preferred for material claims.',
			minIndependence: 'DIFFERENT_AGENT',
			mandatoryPolicyIds: [
				'pol_intent_fidelity',
				'pol_intent_completeness',
				'pol_assumption_disclosure',
				'pol_requirement_coverage',
				'pol_decomposition_coverage',
				'pol_constraint_propagation',
				'pol_architecture_coverage',
				'pol_intent_preservation'
			]
		},
		{
			profile: 'HIGH_ASSURANCE',
			appliesToRisk:
				'Security-sensitive features; enterprise governance; regulated environments; production migrations; high-impact architectural changes; difficult-to-reverse operations. Risk gate: RISK_AT_LEAST(CONSEQUENCE,HIGH) OR RISK_AT_LEAST(SECURITY_SENSITIVITY,HIGH) OR RISK_AT_LEAST(IRREVERSIBILITY,HIGH) OR RISK_AT_LEAST(REGULATORY_EXPOSURE,HIGH). Adds independent assurance, stronger evidence, explicit rollback/recovery, policy+security review, formal impact analysis, constraint-propagation verification, human approval, baseline package, residual-risk decision; restricted waivers; immutable assessment package (Spec §4.3, Catalog §14 twelve core, §36.3). The FSM reference undertaking (pwu_fsm_root riskProfile consequence=HIGH, uncertainty=HIGH, securitySensitivity=HIGH) selects this profile. Escalates to DIFFERENT_PROVIDER + HUMAN/ORGANIZATIONALLY_INDEPENDENT for critical claims.',
			minIndependence: 'DIFFERENT_MODEL',
			mandatoryPolicyIds: [
				'pol_intent_fidelity',
				'pol_intent_completeness',
				'pol_assumption_disclosure',
				'pol_requirement_coverage',
				'pol_decomposition_coverage',
				'pol_constraint_propagation',
				'pol_architecture_coverage',
				'pol_historical_consistency',
				'pol_intent_preservation',
				'pol_test_adequacy',
				'pol_fitness_for_purpose',
				'pol_baseline_promotion'
			]
		}
	],
	roleDefaults: [
		'Technical Expert — intent discovery, clarification, product reasoning, explanation, shaping support; may PROPOSE intent but may NOT approve user intent unless delegated (Spec §36).',
		'Product Modeler — actors, journeys, capabilities, requirements, domain entities, acceptance criteria (Spec §36).',
		'Architect — system structure, interfaces, decisions, technical constraints, architecture evidence (Spec §36).',
		'Planner — decomposition, dependencies, execution strategy, risk and rollback planning (Spec §36).',
		'Maker — implementation, code and artifact production, execution evidence, disclosure of discovered assumptions and deviations (Spec §36).',
		'Verifier — evidence gathering, claim evaluation, contradiction detection, assurance assessment (Spec §36). Default evaluatorRole for the seed assurance policies; independence is satisfied by a distinct executionInstanceId/agent (fixture agent_verifier_001).',
		'Historian-Interpreter — retrieve relevant precedent, evaluate historical applicability, identify unexplained divergence or recurrence (Spec §36).',
		'Hypothesizer — generate plausible failure hypotheses, challenge evidence, identify untested conditions, propose discriminating checks (Spec §36).',
		'Human Governor — approve intent, resolve ambiguity, accept risk, grant waiver, approve material shape changes, promote baseline (Spec §36). The only role that may approve user intent, grant waivers, and authorize baseline promotion.'
	],
	compatibilityPhaseMapping: [
		{
			phase: 'INTAKE',
			triggeredBy:
				'Events (Reference §26/§27 range 1-16): 1 IntentCaptured, 2-4 PwuProposed(Product Realization + Intent and Product Definition)/IntentDiscoveryStarted, 5-6 AssumptionDetected, 7 IntentFormalized, 8-11 Intent Fidelity assessment, 12-14 DecisionProposed/Effective/IntentApproved, 15-16 BaselineCreated/Promoted(Intent Baseline). Objects: int_fsm_001, pwu_fsm_intent (+ discovery children), dec_fsm_intent_001, base_fsm_intent_001.',
			note: 'Ontology interpretation: Intent and Product Definition PWU(s) (Spec §43). A shaping CONTAINER of multiple PWUs + interaction/control activity, not one PWU (DOC-005 §5.1). Fixture Compatibility View = COMPLETE (§32.4). DERIVED, NON-AUTHORITATIVE projection.'
		},
		{
			phase: 'ARCHITECTURE',
			triggeredBy:
				"Events (range 29-43): 29 PwuProposed(Architecture Definition), 30-32 DecompositionProposed/Decomposition Coverage/DecompositionValidated, 34-40 ExecutionPlan + ExecutionStep 'Generate architecture', 41-43 EvidenceProposed/AssumptionDetected(offline/payment). Objects: pwu_fsm_arch + children (System Context/Multi-Tenancy/Data/Mobile-Offline/Integration), dcp_fsm_arch_001, plan_fsm_arch_001, art_fsm_architecture_001.",
			note: 'Ontology interpretation: Architecture Definition PWU hierarchy (Spec §43). Recursively decomposable; child applicability set by ontology + risk profile (DOC-005 §5.2). Fixture View = COMPLETE (§32.4). IMPORTANT: Product Behavior Definition (events 17-28, pwu_fsm_behavior) has NO distinct legacy phase in the §27 table — it is absorbed at the INTAKE/ARCHITECTURE boundary; the ontology models it as its own PWU (Spec §11).'
		},
		{
			phase: 'PROPOSE',
			triggeredBy:
				'ExecutionPlanProposed for implementation / PwuProposed(Implementation Planning). Objects: Implementation Planning PWUs (Product Increment/Work Decomposition/Dependency/Repository Impact/Risk-Assumption/Test-Migration-Rollback Strategy/Execution Plan Definition) + candidate Execution Plan.',
			note: 'Ontology interpretation: Implementation Planning PWUs and the candidate Execution Plan (Spec §43; DOC-005 §5.3). NOT instantiated in the FSM fixture — Compatibility View = NOT STARTED (§32.4); implementation deferred (§2.2).'
		},
		{
			phase: 'ASSUMPTION_SURFACING',
			triggeredBy:
				'Events (range 42-45): 42-43 AssumptionDetected(offline behavior / payment-provider delegation), 44 AssuranceAssessmentRequested: Assumption Disclosure, 45 AssuranceAssessmentSatisfied. Objects: asm_fsm_001..004, pol_assumption_disclosure_v1.',
			note: 'Ontology interpretation: the Assumption Disclosure Assurance POLICY (Spec §43), a cross-cutting policy attached to material PWUs/execution outputs — NOT a mandatory sequential phase-gate (DOC-005 §5.4). Assumptions become first-class Assumption Objects. Fixture range 42-45 (§27).'
		},
		{
			phase: 'VERIFY',
			triggeredBy:
				'Events (range 46-62): 46 Architecture Coverage requested, 47-48 AssuranceObservationRecorded(offline ambiguity / tenant-isolation), 49 ConditionallySatisfied, 50-58 challenge/clarify/revise/re-evidence loop, 59-60 Architecture Coverage Satisfied, 61-62 Intent Preservation Satisfied. Objects: pol_arch_coverage_v1, pol_intent_preservation_v1, assess_fsm_arch_coverage_001/002, obs_fsm_arch_001/002.',
			note: 'Ontology interpretation: claim-specific Assurance Assessments and verification PWUs (Spec §43). Fixture View = COMPLETE FOR ARCHITECTURE (§32.4). Range 46-62 (§27).'
		},
		{
			phase: 'HISTORICAL_CHECK',
			triggeredBy:
				'Optional AssuranceAssessmentRequested/Satisfied: Historical Consistency (pol_historical_consistency) before event 63 PwuSatisfied. Objects: prior decisions, narrative memories, incident records, prior baselines.',
			note: 'Ontology interpretation: the Historical Consistency Assurance Policy (Spec §43; Catalog §22). Recommended (not required) for material decisions/structures; historical difference is not itself a defect (Spec §31, Catalog §22.2). NOT instantiated in the fixture; BEYOND the 6-policy seed set.'
		},
		{
			phase: 'REVIEW',
			triggeredBy:
				'Events (range 66-67): 66 DecisionProposed: Approve Architecture, 67 DecisionEffective. Objects: dec_fsm_arch_001 (version-bound approval referencing art_fsm_architecture_002 + base_fsm_arch_001), Human Review Package.',
			note: 'Ontology interpretation: policy-triggered Governance Decisions (Spec §42, §43) — NOT one universal REVIEW phase; governance points are policy-triggered. Decision binds a specific semantic version. Fixture View = APPROVED (§32.4). Range 66-67 (§27).'
		},
		{
			phase: 'EXECUTE',
			triggeredBy:
				'ExecutionPlanActivated + RuntimeBindingRequested/Authorized + ExecutionStepStarted/Succeeded(implementation) + EvidenceProposed(implementation artifacts). Objects: Product Implementation PWUs, Execution Plans, Runtime Bindings, product artifacts.',
			note: 'Ontology interpretation: Product Implementation PWUs and Execution Plans (Spec §43; DOC-005 §5.8). NOT instantiated in the FSM fixture — View = NOT STARTED (§32.4). NOTE: architecture-generation execution steps (events 39-40, 55-56) belong to ARCHITECTURE, not EXECUTE.'
		},
		{
			phase: 'VALIDATE',
			triggeredBy:
				'AssuranceAssessmentRequested/Satisfied over Integrated Product Validation PWUs (Fitness for Purpose, Test Adequacy, Intent Preservation). Objects: Integrated Product Validation PWUs (Requirement Verification/Journey/Architecture Conformance/Integration/Regression/Security/Operational/Migration/Fitness-for-Purpose/Evidence Package).',
			note: 'Ontology interpretation: Integrated Product Validation PWUs and Assurance Policies (Spec §43; DOC-005 §5.9). PARTIAL in the FSM fixture — architecture-scope assurance only; full integrated product validation deferred (§32.4).'
		},
		{
			phase: 'COMMIT',
			triggeredBy:
				'Events (range 68-72): 68 BaselineCreated(Architecture), 69 BaselineSubmittedForReview, 70 BaselineApproved, 71 BaselinePromoted, 72 PwuBaselined. Objects: base_fsm_arch_001 (status AUTHORITATIVE, promotionDecisionId dec_fsm_arch_001), rcp_fsm_arch_001.',
			note: 'Ontology interpretation: artifact commit PLUS Product Baseline Promotion — at least two distinct operations kept separate: source commit and baseline promotion/deploy (Spec §43; DOC-005 §5.10). Policy pol_baseline_promotion (Catalog §26, BEYOND-SEED). Fixture View = ARCHITECTURE BASELINE ONLY (§32.4). Range 68-72 (§27).'
		},
		{
			phase: 'REPLAN',
			triggeredBy:
				'Events/actions (range 50-56): 50 PwuChallenged, 51 TacticalChangeRequested, 52 ClarificationRequested, 53 IntentConstraintRefined(offline scope), 54 ExecutionPlanRevised, 55-56 ExecutionStepStarted(Revise architecture). Controller ControlActions: CLARIFY / REVISE_CONTEXT / RESHAPE_PWU / REVISE_DECOMPOSITION / REPLAN_EXECUTION.',
			note: "Ontology interpretation: a controller ACTION that revises shape or execution strategy (Spec §41, §43; DOC-005 §5.11) — NOT an authoritative/terminal work phase; a loop-control/reshaping response. Absent from the §27 event-range table but EXERCISED by the fixture's conditional-satisfaction remediation loop (Reference §21, §26). Present as the 11th CompatibilityMilestone enum value; DERIVED, never authoritative state."
		}
	]
} as const satisfies OntologyData;
