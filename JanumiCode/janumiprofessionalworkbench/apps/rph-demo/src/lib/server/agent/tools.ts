// The agent's tool surface — READ + PROPOSE descriptors over the shared PwaAuthoringBroker. This is the ONLY thing
// the agent can do to the workbench: every proposal is a real domain command, so the engine's fail-loud validation
// is the guardrail (an illegal proposal comes back as ok:false with the domain's message, which the agent sees and
// can correct). Field descriptions are pulled from the broker's shared help (concern 1) so the form and the agent
// explain the fields identically. The Pi adapter and the mock both consume these descriptors unchanged.
import {
	lintComposition,
	type CardinalityCode,
	type PwaAuthoringBroker,
	type ProposalResult
} from '@janumipwb/rph-authoring';
import type { RationaleSink } from './rationale.js';
import type { AuthoringToolDescriptor, ToolRunResult } from './types.js';

const CARDINALITY_CODES: ReadonlySet<CardinalityCode> = new Set(['M1', 'M+', 'C1', 'C+']);

function str(v: unknown): string {
	return typeof v === 'string' ? v : '';
}
/** Coerce an agent-supplied cardinality string to a valid code, defaulting anything else to M1 (mandatory-one). */
function asCardinality(v: unknown): CardinalityCode {
	return CARDINALITY_CODES.has(v as CardinalityCode) ? (v as CardinalityCode) : 'M1';
}
function bool(v: unknown): boolean {
	return v === true || v === 'true';
}
function strArr(v: unknown): string[] {
	if (Array.isArray(v)) return v.map(String).filter(Boolean);
	if (typeof v === 'string' && v.trim())
		return v
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	return [];
}

/** Map a broker ProposalResult onto the normalized tool result the agent + log read. */
function fromProposal(r: ProposalResult, okSummary: string): ToolRunResult {
	if (r.ok) return { ok: true, summary: okSummary, data: { id: r.id, ids: r.ids } };
	return { ok: false, summary: `Rejected: ${r.error ?? r.status ?? 'unknown error'}` };
}

/** Build the tool descriptors for a broker scoped to one DRAFT PWA. `rationale` collects the §9.7 professional
 *  rationale summary the producer returns — see ./rationale for why it is a tool and not scraped narration. */
export function buildAuthoringTools(
	broker: PwaAuthoringBroker,
	rationale: RationaleSink
): AuthoringToolDescriptor[] {
	const help = broker.help();

	return [
		// ---- RETURN (§9.7 execution contract) ----
		{
			name: 'declare_rationale',
			description:
				'REQUIRED before you finish a turn, after your proposals are in. Return your professional rationale summary: your own account of HOW the graph you built discharges the professional obligation in the intent — not a list of what you did (the tool calls already record that), but WHY this decomposition is the right one, and where it is weak. An independent reviewer reads this and nothing else about your reasoning. State assumptions you relied on, limitations you know about, and what remains uncertain. Declaring a real limitation is not a failure; concealing one is. Call this exactly once, last.',
			parameters: {
				rationale: {
					type: 'string',
					required: true,
					description:
						'Your account of how the graph discharges the intent: the professional judgment behind the decomposition, in your own words.'
				},
				assumptions: {
					type: 'string[]',
					description:
						'Assumptions you relied on that the intent did not settle (e.g. "assumed a regulated domain, so a Compliance area is warranted"). Disclosure is not verification — state them even when you think they are safe.'
				},
				limitations: {
					type: 'string[]',
					description:
						'What you did NOT do, or could not establish (e.g. "did not model the data-flow between Validation and Promotion").'
				},
				residualUncertainty: {
					type: 'string[]',
					description:
						'What remains genuinely uncertain after your work (e.g. "unsure whether Concern should be conditional rather than mandatory").'
				}
			},
			mutates: false,
			run: (args) => {
				const account = str(args.rationale).trim();
				if (!account) return { ok: false, summary: 'Rejected: rationale is required and must be non-empty.' };
				rationale.declare({
					rationale: account,
					assumptions: strArr(args.assumptions),
					limitations: strArr(args.limitations),
					residualUncertainty: strArr(args.residualUncertainty)
				});
				return { ok: true, summary: 'Professional rationale summary recorded for the independent review.' };
			}
		},

		// ---- READ ----
		{
			name: 'get_pwa',
			description:
				'Read the DRAFT Professional Work Architecture (PWA) being authored: its name, description, domain, and publication status. Call this first to orient yourself.',
			parameters: {},
			mutates: false,
			run: () => {
				const pwa = broker.getPwa();
				if (!pwa) return { ok: false, summary: 'PWA not found.' };
				return {
					ok: true,
					summary: `PWA "${pwa.name}" (${pwa.publicationStatus}), domain: ${pwa.domain || '—'}.`,
					data: pwa
				};
			}
		},
		{
			name: 'list_pwu_types',
			description:
				'List the PWU Types already defined on this PWA (the nodes of the Work Architecture graph), with their kind, whether each is the root, and the permitted child links + data-flow inputs/outputs.',
			parameters: {},
			mutates: false,
			run: () => {
				const types = broker.listTypes();
				return {
					ok: true,
					summary:
						types.length === 0
							? 'No PWU Types defined yet.'
							: types
									.map(
										(t) =>
											`${t.id} — ${t.name} [${t.pwuKind}]${t.isRoot ? ' (root)' : ''}${
												t.permittedChildTypeIds.length
													? ` permits→ ${t.permittedChildTypeIds.join(', ')}`
													: ''
											}`
									)
									.join('\n'),
					data: types
				};
			}
		},
		{
			name: 'get_catalog',
			description:
				'List the reusable PWU Type blueprints in the catalog (the seed "PWU library"). Use define_from_template with a blueprint key to copy one onto this PWA. Prefer these for standard product-realization work areas.',
			parameters: {},
			mutates: false,
			run: () => {
				const cat = broker.catalog();
				return {
					ok: true,
					summary: cat.map((t) => `${t.key} — ${t.name} [${t.pwuKind}]`).join('\n'),
					data: cat
				};
			}
		},
		{
			name: 'list_assurance_policies',
			description:
				'List the workbench Assurance Policies a PWU Type may require via requiredAssurancePolicyIds. Includes the LOCKED mandatory floor policies (schema/invariant, identity/provenance, reasoning review — these always apply, never declare them) and the additive ACTIVE policies you can reference. Use create_assurance_policy only for a genuinely new required treatment.',
			parameters: {},
			mutates: false,
			run: () => {
				const pols = broker.listPolicies();
				return {
					ok: true,
					summary: pols
						.map((p) => `${p.id} — ${p.name} [${p.isFloor ? 'MANDATORY/locked' : p.status}]`)
						.join('\n'),
					data: pols
				};
			}
		},
		{
			name: 'review_composition',
			description:
				'Review the current graph STRUCTURE for problems: over-broad fan-out (a type permitting too many children — a flat "star" instead of a real decomposition hierarchy), types unreachable from the root, or a missing/duplicate root. Call this after building and FIX any findings before finishing.',
			parameters: {},
			mutates: false,
			run: () => {
				const findings = lintComposition(broker.listTypes());
				return {
					ok: true,
					summary:
						findings.length === 0
							? 'No structural issues — the decomposition looks clean.'
							: findings.map((f) => `- [${f.severity}] ${f.message}`).join('\n'),
					data: findings
				};
			}
		},

		// ---- PROPOSE ----
		{
			name: 'scaffold_graph',
			description:
				'Build a WHOLE PWU Type graph in ONE atomic step: define several types and wire their permitted-child (composition) edges together. All are created or none are (a single failure rolls back the batch — no half-built graph). Give each type a short `tempKey` and reference children by their tempKeys. Prefer this when creating a multi-node architecture at once; use define_pwu_type + link_types for incremental edits.',
			parameters: {
				types: {
					type: 'object[]',
					required: true,
					description: 'The PWU Types to create together (exactly one should be the root).',
					items: {
						tempKey: {
							type: 'string',
							required: true,
							description:
								'A short handle (e.g. "root", "arch") used to reference this type as another type’s child IN THIS BATCH. Not persisted.'
						},
						name: { type: 'string', required: true, description: help.name },
						pwuKind: { type: 'string', required: true, description: help.pwuKind },
						purpose: { type: 'string', description: help.purpose },
						isRoot: { type: 'boolean', description: help.isRoot },
						completionRule: { type: 'string', description: help.completionRule },
						requiredInputs: { type: 'string[]', description: help.requiredInputs },
						requiredOutputs: { type: 'string[]', description: help.requiredOutputs },
						requiredAssurancePolicyIds: {
							type: 'string[]',
							description: help.requiredAssurancePolicyIds
						},
						childTempKeys: {
							type: 'string[]',
							description:
								'tempKeys of other types in THIS batch that this type permits as children (composition edges).'
						},
						childCardinalities: {
							type: 'object[]',
							description:
								'Optional per-child cardinality for childTempKeys. Children with no entry default to M1.',
							items: {
								tempKey: {
									type: 'string',
									required: true,
									description: 'A tempKey that also appears in childTempKeys.'
								},
								cardinality: {
									type: 'string',
									required: true,
									description:
										'M1 mandatory-exactly-one, M+ mandatory-one-or-more, C1 conditional-zero-or-one, C+ conditional-zero-or-more.'
								},
								applicabilityNote: {
									type: 'string',
									description: 'For conditional (C*) children: free-text WHEN this child applies.'
								}
							}
						}
					}
				}
			},
			mutates: true,
			run: (a) => {
				const rawTypes = Array.isArray(a.types) ? (a.types as Record<string, unknown>[]) : [];
				const specs = rawTypes.map((o) => ({
					tempKey: str(o.tempKey),
					name: str(o.name),
					pwuKind: str(o.pwuKind),
					purpose: str(o.purpose) || undefined,
					isRoot: bool(o.isRoot),
					completionRule: str(o.completionRule) || undefined,
					requiredInputs: strArr(o.requiredInputs),
					requiredOutputs: strArr(o.requiredOutputs),
					requiredAssurancePolicyIds: strArr(o.requiredAssurancePolicyIds),
					childTempKeys: strArr(o.childTempKeys),
					childCardinalities: Array.isArray(o.childCardinalities)
						? (o.childCardinalities as Record<string, unknown>[]).map((c) => ({
								tempKey: str(c.tempKey),
								cardinality: asCardinality(c.cardinality),
								applicabilityNote: str(c.applicabilityNote) || undefined
							}))
						: undefined
				}));
				return fromProposal(
					broker.scaffold(specs),
					`Scaffolded ${specs.length} PWU Type(s) atomically.`
				);
			}
		},
		{
			name: 'set_pwa_details',
			description:
				'Edit the DRAFT PWA’s own metadata. Only the fields you pass are changed. (The PWA must be DRAFT — a published version is immutable.)',
			parameters: {
				name: { type: 'string', description: 'New PWA name.' },
				description: { type: 'string', description: 'New PWA description.' },
				domain: { type: 'string', description: 'New PWA domain (e.g. logistics, healthcare).' }
			},
			mutates: true,
			run: (a) => {
				const patch: { name?: string; description?: string; domain?: string } = {};
				if ('name' in a) patch.name = str(a.name);
				if ('description' in a) patch.description = str(a.description);
				if ('domain' in a) patch.domain = str(a.domain);
				return fromProposal(broker.setPwaDetails(patch), 'Updated PWA details.');
			}
		},
		{
			name: 'create_assurance_policy',
			description:
				'Create a NEW authorable Assurance Policy in the workbench library (on top of the seeded ones), then reference its returned id from a PWU Type’s requiredAssurancePolicyIds. Only for a genuinely new required treatment not covered by an existing policy — prefer reusing what list_assurance_policies already offers. Never recreate the mandatory floor (schema/invariant, identity/provenance, reasoning review): it always applies.',
			parameters: {
				name: {
					type: 'string',
					required: true,
					description: 'Human name (e.g. "Tenant Isolation Review").'
				},
				purpose: { type: 'string', description: 'What this policy assures.' },
				rationale: { type: 'string', description: 'Why future instances must satisfy it.' },
				evaluatedClaimType: {
					type: 'string',
					description:
						'The claim type it evaluates: CORRECTNESS, COMPLETENESS, COVERAGE, PRESERVATION, CONSISTENCY, FITNESS, FEASIBILITY, COMPLIANCE, SECURITY, or PERFORMANCE.'
				},
				evaluatorRole: {
					type: 'string',
					description: 'The evaluator role (e.g. "security-reviewer").'
				},
				independenceRequirement: {
					type: 'string',
					description:
						'Evaluator independence: NONE, DIFFERENT_INVOCATION, DIFFERENT_AGENT, DIFFERENT_MODEL, HUMAN, etc.'
				},
				criteria: {
					type: 'string[]',
					description: 'One statement per criterion (each becomes a mandatory assessment criterion).'
				}
			},
			mutates: true,
			run: (a) => {
				const r = broker.createPolicy({
					name: str(a.name),
					purpose: str(a.purpose) || undefined,
					rationale: str(a.rationale) || undefined,
					evaluatedClaimType: str(a.evaluatedClaimType) || undefined,
					evaluatorRole: str(a.evaluatorRole) || undefined,
					independenceRequirement: str(a.independenceRequirement) || undefined,
					criteria: strArr(a.criteria)
				});
				return fromProposal(r, `Created Assurance Policy "${str(a.name)}" as ${r.id}.`);
			}
		},
		{
			name: 'define_pwu_type',
			description:
				'Define a NEW PWU Type (a node in the Work Architecture graph). Returns the minted id you use to link it. Exactly one type in the PWA must be the root.',
			parameters: {
				name: { type: 'string', description: help.name, required: true },
				pwuKind: { type: 'string', description: help.pwuKind, required: true },
				purpose: { type: 'string', description: help.purpose },
				isRoot: { type: 'boolean', description: help.isRoot },
				completionRule: { type: 'string', description: help.completionRule },
				requiredInputs: { type: 'string[]', description: help.requiredInputs },
				requiredOutputs: { type: 'string[]', description: help.requiredOutputs },
				requiredAssurancePolicyIds: {
					type: 'string[]',
					description: help.requiredAssurancePolicyIds
				}
			},
			mutates: true,
			run: (a) => {
				const r = broker.defineType({
					name: str(a.name),
					pwuKind: str(a.pwuKind),
					purpose: str(a.purpose) || undefined,
					isRoot: bool(a.isRoot),
					completionRule: str(a.completionRule) || undefined,
					requiredInputs: strArr(a.requiredInputs),
					requiredOutputs: strArr(a.requiredOutputs),
					requiredAssurancePolicyIds: strArr(a.requiredAssurancePolicyIds)
				});
				return fromProposal(r, `Defined PWU Type "${str(a.name)}" as ${r.id}.`);
			}
		},
		{
			name: 'define_from_template',
			description:
				'Define a new PWU Type by COPYING a catalog blueprint (see get_catalog), optionally overriding its name / root flag. The copy is fully editable and has no coupling to the catalog. Returns the minted id.',
			parameters: {
				templateKey: {
					type: 'string',
					description: 'The catalog blueprint key (from get_catalog), e.g. "architecture".',
					required: true
				},
				name: { type: 'string', description: 'Override the blueprint name (optional).' },
				isRoot: { type: 'boolean', description: help.isRoot }
			},
			mutates: true,
			run: (a) => {
				const overrides: { name?: string; isRoot?: boolean } = {};
				if ('name' in a && str(a.name)) overrides.name = str(a.name);
				if ('isRoot' in a) overrides.isRoot = bool(a.isRoot);
				const r = broker.defineFromTemplate(str(a.templateKey), overrides);
				return fromProposal(r, `Defined "${str(a.templateKey)}" from template as ${r.id}.`);
			}
		},
		{
			name: 'edit_pwu_type',
			description:
				'Edit an existing PWU Type in place. Only the fields you pass change. Use the id returned by define_pwu_type / list_pwu_types.',
			parameters: {
				pwuTypeId: {
					type: 'string',
					description: 'The id of the PWU Type to edit.',
					required: true
				},
				name: { type: 'string', description: help.name },
				pwuKind: { type: 'string', description: help.pwuKind },
				purpose: { type: 'string', description: help.purpose },
				isRoot: { type: 'boolean', description: help.isRoot },
				completionRule: { type: 'string', description: help.completionRule },
				requiredInputs: { type: 'string[]', description: help.requiredInputs },
				requiredOutputs: { type: 'string[]', description: help.requiredOutputs },
				requiredAssurancePolicyIds: {
					type: 'string[]',
					description: help.requiredAssurancePolicyIds
				}
			},
			mutates: true,
			run: (a) => {
				const patch: Record<string, unknown> = {};
				if ('name' in a) patch.name = str(a.name);
				if ('pwuKind' in a) patch.pwuKind = str(a.pwuKind);
				if ('purpose' in a) patch.purpose = str(a.purpose);
				if ('isRoot' in a) patch.isRoot = bool(a.isRoot);
				if ('completionRule' in a) patch.completionRule = str(a.completionRule);
				if ('requiredInputs' in a) patch.requiredInputs = strArr(a.requiredInputs);
				if ('requiredOutputs' in a) patch.requiredOutputs = strArr(a.requiredOutputs);
				if ('requiredAssurancePolicyIds' in a)
					patch.requiredAssurancePolicyIds = strArr(a.requiredAssurancePolicyIds);
				return fromProposal(
					broker.editType(str(a.pwuTypeId), patch),
					`Edited ${str(a.pwuTypeId)}.`
				);
			}
		},
		{
			name: 'remove_pwu_type',
			description:
				'Remove (tombstone) a PWU Type. Fails if another type still references it as a permitted parent/child — clear those links first.',
			parameters: {
				pwuTypeId: {
					type: 'string',
					description: 'The id of the PWU Type to remove.',
					required: true
				}
			},
			mutates: true,
			run: (a) => fromProposal(broker.removeType(str(a.pwuTypeId)), `Removed ${str(a.pwuTypeId)}.`)
		},
		{
			name: 'link_types',
			description:
				'Add a "permits" (composition) edge parent → child: declare that the child type may be decomposed UNDER the parent in the graph. Idempotent.',
			parameters: {
				parentPwuTypeId: { type: 'string', description: 'The parent type id.', required: true },
				childPwuTypeId: { type: 'string', description: 'The child type id.', required: true }
			},
			mutates: true,
			run: (a) =>
				fromProposal(
					broker.linkTypes(str(a.parentPwuTypeId), str(a.childPwuTypeId)),
					`Linked ${str(a.parentPwuTypeId)} → ${str(a.childPwuTypeId)}.`
				)
		},
		{
			name: 'unlink_types',
			description: 'Remove a "permits" edge parent → child. Idempotent.',
			parameters: {
				parentPwuTypeId: { type: 'string', description: 'The parent type id.', required: true },
				childPwuTypeId: { type: 'string', description: 'The child type id.', required: true }
			},
			mutates: true,
			run: (a) =>
				fromProposal(
					broker.unlinkTypes(str(a.parentPwuTypeId), str(a.childPwuTypeId)),
					`Unlinked ${str(a.parentPwuTypeId)} → ${str(a.childPwuTypeId)}.`
				)
		}
	];
}
