<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Edge, FitViewOptions, Node } from '@xyflow/svelte';
	import { tick, setContext } from 'svelte';
	import {
		toPwaFlow,
		type DataFlowEdgeData,
		type PwaLayoutDirection
	} from '$lib/pwaFlow';
	import PwuTypeCard from '$lib/PwuTypeCard.svelte';
	import PwuBehaviorPanel from '$lib/behavior/PwuBehaviorPanel.svelte';
	import WalkthroughPanel from '$lib/WalkthroughPanel.svelte';
	import {
		stepNumbersByNode,
		WALKTHROUGH_CONTEXT_KEY,
		type WalkthroughContext
	} from '$lib/walkthrough';
	import {
		EMPTY_CANVAS_HISTORY,
		recordCanvasMove,
		redoCanvasMove,
		undoCanvasMove,
		type CanvasHistory
	} from '$lib/canvasHistory';
	import { draggable } from '$lib/actions/draggable';
	import {
		analyzePwaGraph,
		buildPwaGraphExport,
		buildPwuBehaviorProjection,
		handoffFindings,
		layerHandoff,
		leafKind,
		leafKindLabel
	} from '@janumipwb/rph-projections';
	import {
		PWU_TYPE_CATALOG,
		PWU_TYPE_HELP,
		ASSURANCE_FLOOR,
		assurancePolicyLabel
	} from '$lib/authoring/pwuType';
	import type { PageData } from './$types';
	let {
		data,
		form
	}: {
		data: PageData;
		form: {
			error?: string;
			definedType?: string;
			editedType?: string;
			removedType?: string;
			editedPwa?: string;
			advanced?: string;
			createdPolicy?: string;
			editedPolicy?: string;
			newVersion?: string;
			suspendedPolicy?: string;
			activatedPolicy?: string;
			acceptedCandidate?: string;
			discardedCandidate?: boolean;
			candidateStatus?: string;
		} | null;
	} = $props();

	// Selection = an explicit user/agent override, falling back to the root (or first) type. Deriving it from `data`
	// keeps it correct when the graph changes and self-heals when the selected type is removed.
	let selectedOverride = $state<string | null>(null);
	let selectionRevision = 0;
	let mutationSelectionRevision = 0;
	function selectNode(id: string) {
		selectionRevision += 1;
		selectedOverride = id;
	}
	const selected = $derived(
		selectedOverride && data.types.some((t) => t.id === selectedOverride)
			? selectedOverride
			: (data.types.find((t) => t.isRoot)?.id ?? data.types[0]?.id ?? '')
	);
	const current = $derived(data.types.find((t) => t.id === selected));
	let running = $state(false);
	const isDraft = $derived(data.pwa.publicationStatus === 'DRAFT');
	const hasStagedCandidate = $derived(Boolean(data.authoringTurn));
	// A recoverable staged candidate can be ADDRESSED in place — a substantive revision request, or a transient/
	// operational reviewer failure (e.g. an outage) that is NOT a graph rejection. The server reopens the same fork.
	const candidateResumable = $derived(
		data.authoringTurn?.status === 'REVISION_REQUIRED' ||
			data.authoringTurn?.status === 'BLOCKED_EXTERNAL'
	);
	// A live run needs its candidate preview to stay visible as tool invalidations arrive. Once the run finishes,
	// canonical/manual controls lock until the exact candidate is accepted or discarded.
	const editable = $derived(isDraft && (!hasStagedCandidate || running));
	// The chat stays open in MORE cases than manual canonical editing: a recoverable staged candidate can be refined
	// via chat (routed into the same fork) without discarding — while manual canonical edits stay locked so they can
	// never diverge from the staged fork.
	const chatOpen = $derived(editable || (isDraft && candidateResumable));
	const panelAwareFitViewOptions: FitViewOptions = $derived({
		padding: {
			top: '24px',
			right: '360px',
			bottom: '150px',
			left: chatOpen ? '328px' : '24px'
		},
		minZoom: 0.2
	});
	// A floor waiver is a pre-publication override — offer it through the publish FSM up to (not incl.) PUBLISHED.
	const canWaive = $derived(
		['DRAFT', 'UNDER_REVIEW', 'VALIDATED'].includes(data.pwa.publicationStatus)
	);
	const hasRoot = $derived(data.types.some((t) => t.isRoot));
	const RANK: Record<string, number> = {
		DRAFT: 1,
		UNDER_REVIEW: 2,
		VALIDATED: 3,
		PUBLISHED: 4,
		DEPRECATED: 5,
		RETIRED: 6
	};
	const rank = $derived(RANK[data.pwa.publicationStatus] ?? 0);

	// Node graph: PWU Types are nodes rendered by the PwuTypeCard custom node. The BASE view is the composition
	// ("permits") tree, projected through @statelyai/graph and laid out by ELK. Data-flow
	// (requiredOutputs→requiredInputs) is a SEPARATE overlay, off by default (§11.7.2: composition ≠ order).
	// Collapsing a non-leaf hides its subtree. Canvas position history is presentation-only and never reverses a
	// Command, PWU Type edit, deletion, or agent turn.
	const nodeTypes = { pwuType: PwuTypeCard };
	let collapsed = $state<Set<string>>(new Set());
	let showDataFlow = $state(false);
	let layoutDirection = $state<PwaLayoutDirection>('RIGHT');
	let layoutPending = $state(true);
	let layoutError = $state('');
	let layoutEngine = $state<'ELK' | 'DAGRE' | null>(null);
	function toggleCollapse(id: string) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
	}
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	let canvasHistory = $state<CanvasHistory>(EMPTY_CANVAS_HISTORY);
	let dragStartNodes: Node[] | null = null;
	let keyboardStartNodes: Node[] | null = null;
	let layoutRequest = 0;
	let appliedLayoutKey = '';
	// The layout DIRECTION the current node positions were computed in. Manual/prior positions are only valid to keep
	// when the direction is unchanged (positions are direction-specific), which is what lets an agent turn preserve
	// the user's arrangement while a direction switch still re-lays-out from scratch.
	let appliedDirection: PwaLayoutDirection | null = null;
	let behaviorRun = $state(0);
	const behaviorTopology = buildPwuBehaviorProjection();

	type NodeDragEvent = { readonly targetNode: Node | null; readonly nodes: Node[] };
	function copyNodePositions(source: readonly Node[]): Node[] {
		return source.map((node) => ({ ...node, position: { ...node.position } }));
	}
	function beginCanvasMove() {
		dragStartNodes = copyNodePositions(nodes);
	}
	function finishCanvasMove(event: NodeDragEvent) {
		if (!dragStartNodes) return;
		const movedPositions = new Map(event.nodes.map((node) => [node.id, node.position]));
		const after = nodes.map((node) => {
			const position = movedPositions.get(node.id);
			return position ? { ...node, position: { ...position } } : node;
		});
		canvasHistory = recordCanvasMove(canvasHistory, dragStartNodes, after);
		nodes = after;
		dragStartNodes = null;
	}
	const CANVAS_MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
	function isCanvasKeyboardMove(event: KeyboardEvent): boolean {
		if (!CANVAS_MOVE_KEYS.has(event.key) || !nodes.some((node) => node.selected)) return false;
		const target = event.target;
		return !(
			target instanceof HTMLElement &&
			target.closest(
				'input, textarea, select, button, [contenteditable="true"], [data-canvas-move-ignore]'
			)
		);
	}
	// Svelte Flow moves selected nodes in its own keydown handler. Capture the pre-keydown state, then record the
	// bound post-keydown positions during bubbling so keyboard accessibility shares the same chronological history.
	function beginKeyboardCanvasMove(event: KeyboardEvent) {
		keyboardStartNodes = isCanvasKeyboardMove(event) ? copyNodePositions(nodes) : null;
	}
	function finishKeyboardCanvasMove(event: KeyboardEvent) {
		if (!keyboardStartNodes || !CANVAS_MOVE_KEYS.has(event.key)) return;
		canvasHistory = recordCanvasMove(canvasHistory, keyboardStartNodes, nodes);
		keyboardStartNodes = null;
	}
	function undoCanvasPosition() {
		const result = undoCanvasMove(canvasHistory, nodes);
		canvasHistory = result.history;
		nodes = result.nodes;
	}
	function redoCanvasPosition() {
		const result = redoCanvasMove(canvasHistory, nodes);
		canvasHistory = result.history;
		nodes = result.nodes;
	}

	// Clicking a data-flow edge (its ⤳ label or its line) selects it (xyflow native `selected`); the detail panel
	// then reveals the configured hand-off it carries in `data` — which artifacts flow, and between which types.
	// Driving off native selection (not just onedgeclick) means clicking the label chip works too.
	const selectedFlow = $derived.by((): DataFlowEdgeData | null => {
		const e = edges.find(
			(x) => x.selected && typeof x.id === 'string' && x.id.startsWith('flow:')
		);
		const d = e?.data as DataFlowEdgeData | undefined;
		return d && d.kind === 'dataflow' ? d : null;
	});
	function dismissFlow() {
		edges = edges.map((e) => (e.selected ? { ...e, selected: false } : e));
	}

	// Structural health of the graph — the same queryable report the harness asserts on (single root, acyclic,
	// connected; advisory findings for dangling data-flow / fan-out). Surfaced as a chip so the author sees issues.
	const graphExport = $derived(
		buildPwaGraphExport(
			{
				id: data.pwa.id,
				name: data.pwa.name,
				domain: data.pwa.domain,
				version: data.pwa.version,
				publicationStatus: data.pwa.publicationStatus
			},
			data.types.map((t) => ({
				id: t.id,
				name: t.name,
				pwuKind: t.pwuKind,
				isRoot: t.isRoot,
				permittedChildTypeIds: t.permittedChildTypeIds,
				requiredInputs: t.requiredInputs,
				requiredOutputs: t.requiredOutputs,
				executionBoundary: t.executionBoundary
			}))
		)
	);
	const graphReport = $derived(analyzePwaGraph(graphExport));
	// JAN-PWADESIGNER — the hand-off dependency layering (4-way partition) + node-keyed findings for the walkthrough.
	const handoffOrder = $derived(layerHandoff(graphExport));
	const handoffFindingsByNode = $derived(
		new Map(handoffFindings(graphExport).map((f) => [f.nodeId, f]))
	);
	const graphIssues = $derived(
		graphReport.invariants.filter((i) => !i.ok).length + graphReport.findings.length
	);
	const graphHealthTitle = $derived(
		[
			...graphReport.invariants.map((i) => `${i.ok ? '✓' : '✗'} ${i.name}: ${i.detail}`),
			...graphReport.findings.map((f) => `• ${f}`)
		].join('\n')
	);

	// ── Walkthrough mode (JAN-PWADESIGNER) ───────────────────────────────────────────────────────────────────────
	// A READ-ONLY hand-off DEPENDENCY walk: step the graph in hand-off dependency order and inspect each node. Off by
	// default; ephemeral $state; writes NOTHING to the engine. The badges are DEPENDENCY steps, NOT execution order (§9.1).
	let showWalkthrough = $state(false);
	let walkStep = $state(0);
	let walkPickedId = $state<string | null>(null);
	let savedOverlay: { showDataFlow: boolean; collapsed: Set<string> } | null = null;

	const walkCount = $derived(handoffOrder.layers.length);
	const walkClampedStep = $derived(Math.min(walkStep, Math.max(0, walkCount - 1)));
	const currentWalkLayer = $derived(
		showWalkthrough ? (handoffOrder.layers[walkClampedStep] ?? []) : []
	);
	const walkStepByNode = $derived(stepNumbersByNode(handoffOrder));
	const walkLit = $derived(new Set(currentWalkLayer));
	const walkDimmed = $derived(
		showWalkthrough
			? new Set(data.types.map((t) => t.id).filter((id) => !walkLit.has(id)))
			: new Set<string>()
	);
	const walkPicked = $derived(
		currentWalkLayer.includes(walkPickedId ?? '') ? walkPickedId : (currentWalkLayer[0] ?? null)
	);
	const walkPickedNode = $derived(data.types.find((t) => t.id === walkPicked));
	const walkPickedFinding = $derived(
		walkPicked ? handoffFindingsByNode.get(walkPicked) : undefined
	);

	function enterWalkthrough() {
		savedOverlay = { showDataFlow, collapsed };
		collapsed = new Set(); // auto-expand so a step never targets a hidden node
		showDataFlow = true; // the walk IS over the hand-off plane
		walkStep = 0;
		walkPickedId = null;
		showWalkthrough = true;
	}
	function exitWalkthrough() {
		showWalkthrough = false;
		if (savedOverlay) {
			showDataFlow = savedOverlay.showDataFlow;
			collapsed = savedOverlay.collapsed;
			savedOverlay = null;
		}
	}
	function walkNext() {
		if (walkClampedStep < walkCount - 1) {
			walkStep = walkClampedStep + 1;
			walkPickedId = null;
		}
	}
	function walkPrev() {
		if (walkClampedStep > 0) {
			walkStep = walkClampedStep - 1;
			walkPickedId = null;
		}
	}

	// The badge/dim reach PwuTypeCard via CONTEXT (reactive getters), so the layout `$effect` that owns `nodes` is
	// never a second writer — no re-layout on step change, no reactive self-loop (JAN-PWADESIGNER-DR-001 §19 dim-10).
	setContext<WalkthroughContext>(WALKTHROUGH_CONTEXT_KEY, {
		get active() {
			return showWalkthrough;
		},
		stepOf(id: string): number | undefined {
			return showWalkthrough ? walkStepByNode.get(id) : undefined;
		},
		isDimmed(id: string): boolean {
			return showWalkthrough && walkDimmed.has(id);
		}
	});

	$effect(() => {
		// Capture every reactive input synchronously. ELK resolves asynchronously, so a generation token prevents an
		// older layout from overwriting a newer structure, collapse state, overlay, or lens selection.
		const types = data.types;
		const collapsedSnapshot = new Set(collapsed);
		const overlay = showDataFlow;
		const direction = layoutDirection;
		const layoutKey = JSON.stringify({
			direction,
			collapsed: [...collapsedSnapshot].sort(),
			composition: types.map((type) => [type.id, ...type.permittedChildTypeIds])
		});
		const request = ++layoutRequest;
		layoutPending = true;
		layoutError = '';

		void toPwaFlow(types, {
			collapsed: collapsedSnapshot,
			showDataFlow: overlay,
			layoutDirection: direction,
			onToggleCollapse: toggleCollapse
		})
			.then((flow) => {
				if (request !== layoutRequest) return;

				// Preserve the user's arrangement across BOTH an overlay toggle AND a structural agent re-layout — as
				// long as the layout DIRECTION is unchanged (positions are direction-specific). Surviving nodes keep
				// their place; only a genuinely new node takes ELK's computed position. A direction switch re-arranges.
				const prior = new Map(nodes.map((node) => [node.id, node]));
				const preservePresentation = appliedLayoutKey === layoutKey;
				const sameDirection = appliedDirection === direction;
				nodes = flow.nodes.map((node) => {
					const previous = sameDirection ? prior.get(node.id) : undefined;
					return previous
						? { ...node, position: previous.position, selected: previous.selected }
						: node;
				});
				edges = flow.edges;
				layoutEngine = flow.layoutEngine;
				if (!preservePresentation) {
					// The node set or direction changed, so canvas undo/redo history no longer maps cleanly onto it;
					// surviving-node positions are still preserved above when the direction is unchanged.
					canvasHistory = EMPTY_CANVAS_HISTORY;
					dragStartNodes = null;
				}
				appliedLayoutKey = layoutKey;
				appliedDirection = direction;
				layoutPending = false;
			})
			.catch((error) => {
				if (request !== layoutRequest) return;
				layoutPending = false;
				layoutError = error instanceof Error ? error.message : String(error);
			});

		return () => {
			if (request === layoutRequest) layoutRequest += 1;
		};
	});

	// Shared define/edit PWU Type form: formMode is null (inspector shows the selected node) | 'define' | { editId }.
	type FormMode = null | 'define' | { editId: string };
	let formMode = $state<FormMode>(null);
	let typeMutationPending = $state(false);
	let showPwaEdit = $state(false);
	let agentCollapsed = $state(false);
	let inspectorCollapsed = $state(false);
	let floorCollapsed = $state(false);
	const f = $state({
		name: '',
		pwuKind: '',
		purpose: '',
		completionRule: '',
		isRoot: false,
		requiredInputs: '',
		requiredOutputs: '',
		// STD-2/STD-3 (DWP-05): where this type's work is discharged, and (when DELEGATED_EXTERNAL) the boundary
		// contract's scalar parts. attestedAssurancePolicyIds is a separate checkbox-selection state below.
		executionBoundary: 'INTERNAL',
		counterpartyLabel: '',
		boundaryApplicabilityNote: ''
	});
	let children = $state<string[]>([]);
	// Selected declared assurance policy ids for the type being authored (distinct from data.policies, the library).
	let selectedPolicyIds = $state<string[]>([]);
	// Attested assurance policy ids for a DELEGATED_EXTERNAL type's boundary contract (the counterparty's claim).
	let attestedPolicyIds = $state<string[]>([]);
	// Per-child cardinality being authored, keyed by child type id (only meaningful for checked children).
	let childRules = $state<Record<string, { cardinality: string; note: string }>>({});
	const editingId = $derived(typeof formMode === 'object' && formMode ? formMode.editId : '');

	$effect(() => {
		if (form?.definedType) {
			// Auto-select the new type only if the human did not make a newer selection while the action was in
			// flight. A late invalidation must not overwrite an intentional node click.
			if (selectionRevision === mutationSelectionRevision) selectedOverride = form.definedType;
			formMode = null;
		} else if (form?.editedType || form?.removedType) {
			formMode = null;
		}
	});

	// Keep another Define/Edit transition from overtaking an enhanced form action that is still invalidating page
	// data. Otherwise a fast second click can open a fresh form just before the first action result closes it.
	const enhanceTypeMutation: SubmitFunction = () => {
		typeMutationPending = true;
		mutationSelectionRevision = selectionRevision;
		return async ({ update }) => {
			try {
				await update();
				await tick();
			} finally {
				typeMutationPending = false;
			}
		};
	};

	function openDefine() {
		if (typeMutationPending) return;
		showPolicyManager = false;
		inspectorCollapsed = false;
		Object.assign(f, {
			name: '',
			pwuKind: '',
			purpose: '',
			completionRule: '',
			isRoot: false,
			requiredInputs: '',
			requiredOutputs: '',
			executionBoundary: 'INTERNAL',
			counterpartyLabel: '',
			boundaryApplicabilityNote: ''
		});
		children = [];
		selectedPolicyIds = [];
		attestedPolicyIds = [];
		childRules = {};
		formMode = 'define';
		focusTypeForm();
	}
	function openEdit(id: string) {
		if (typeMutationPending) return;
		const t = data.types.find((x) => x.id === id);
		if (!t) return;
		showPolicyManager = false;
		inspectorCollapsed = false;
		Object.assign(f, {
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			completionRule: t.completionRule,
			isRoot: t.isRoot,
			requiredInputs: t.requiredInputs.join(', '),
			requiredOutputs: t.requiredOutputs.join(', '),
			executionBoundary: t.executionBoundary,
			counterpartyLabel: t.boundaryContract?.counterpartyLabel ?? '',
			boundaryApplicabilityNote: t.boundaryContract?.applicabilityNote ?? ''
		});
		children = [...t.permittedChildTypeIds];
		selectedPolicyIds = [...t.requiredAssurancePolicyIds];
		attestedPolicyIds = [...(t.boundaryContract?.attestedAssurancePolicyIds ?? [])];
		childRules = Object.fromEntries(
			t.permittedChildren.map((r) => [
				r.typeId,
				{ cardinality: r.cardinality, note: r.applicabilityNote ?? '' }
			])
		);
		formMode = { editId: id };
		focusTypeForm();
	}
	function applyTemplate(key: string) {
		const t = PWU_TYPE_CATALOG.find((x) => x.key === key);
		if (!t) return;
		// Catalog blueprints are all INTERNAL work areas — a template never carries a delegation boundary.
		Object.assign(f, {
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			isRoot: t.isRoot,
			requiredInputs: (t.requiredInputs ?? []).join(', '),
			requiredOutputs: (t.requiredOutputs ?? []).join(', '),
			executionBoundary: 'INTERNAL',
			counterpartyLabel: '',
			boundaryApplicabilityNote: ''
		});
		attestedPolicyIds = [];
	}
	function toggleChild(id: string, on: boolean) {
		children = on ? [...children, id] : children.filter((c) => c !== id);
		if (on && !childRules[id]) childRules = { ...childRules, [id]: { cardinality: 'M1', note: '' } };
	}
	function togglePolicy(id: string, on: boolean) {
		selectedPolicyIds = on
			? [...selectedPolicyIds, id]
			: selectedPolicyIds.filter((p) => p !== id);
	}
	function toggleAttested(id: string, on: boolean) {
		attestedPolicyIds = on
			? [...attestedPolicyIds, id]
			: attestedPolicyIds.filter((p) => p !== id);
	}

	// ---- Assurance Policy library manager (engine-backed): list all policies, create / edit / version / suspend /
	// activate. The 3 de minimis floor policies are shown LOCKED (read-only). Opened from the pub-action bar.
	type PolicyView = PageData['policies'][number];
	let showPolicyManager = $state(false);
	let policyFormMode = $state<null | 'create' | { editId: string }>(null);
	const pf = $state({
		name: '',
		purpose: '',
		rationale: '',
		evaluatedClaimTypes: 'CORRECTNESS',
		evaluatorRole: '',
		independenceRequirement: 'DIFFERENT_AGENT',
		permittedControlActions: 'ESCALATE',
		criteria: ''
	});
	const policyEditingId = $derived(
		typeof policyFormMode === 'object' && policyFormMode ? policyFormMode.editId : ''
	);
	// Option lists for the policy form (subset of the ASSURANCE_POLICY object contract enums; the engine validates).
	const CLAIM_TYPES = [
		'CORRECTNESS',
		'COMPLETENESS',
		'COVERAGE',
		'PRESERVATION',
		'CONSISTENCY',
		'FITNESS',
		'FEASIBILITY',
		'COMPLIANCE',
		'SECURITY',
		'PERFORMANCE'
	];
	const INDEPENDENCE = [
		'NONE',
		'DIFFERENT_INVOCATION',
		'DIFFERENT_CONTEXT_INSTANCE',
		'DIFFERENT_AGENT',
		'DIFFERENT_MODEL',
		'DIFFERENT_PROVIDER',
		'HUMAN',
		'ORGANIZATIONALLY_INDEPENDENT'
	];
	const CONTROL_ACTIONS = [
		'CLARIFY',
		'GATHER_CONTEXT',
		'GATHER_EVIDENCE',
		'REVISE_CONTEXT',
		'RETRY',
		'RESHAPE_PWU',
		'REVISE_DECOMPOSITION',
		'REPLAN_EXECUTION',
		'REQUEST_HUMAN_DECISION',
		'REQUEST_WAIVER',
		'ESCALATE',
		'REJECT'
	];
	// Sort: locked floor first, then ACTIVE, SUSPENDED, DRAFT, SUPERSEDED last; alphabetical within a group.
	const POLICY_STATUS_ORDER: Record<string, number> = {
		ACTIVE: 1,
		SUSPENDED: 2,
		DRAFT: 3,
		SUPERSEDED: 4
	};
	const sortedPolicies = $derived(
		[...data.policies].sort((a, b) => {
			if (a.isFloor !== b.isFloor) return a.isFloor ? -1 : 1;
			const s = (POLICY_STATUS_ORDER[a.status] ?? 9) - (POLICY_STATUS_ORDER[b.status] ?? 9);
			return s !== 0 ? s : a.name.localeCompare(b.name);
		})
	);
	// The policies a PWU Type may declare: ACTIVE and non-floor (the floor always applies and is never declared).
	const pickablePolicies = $derived(
		data.policies.filter((p) => p.status === 'ACTIVE' && !p.isFloor)
	);
	// Existing references can outlive a policy's ACTIVE state. Keep them visible and explicitly removable during an
	// unrelated edit instead of silently dropping them because they are absent from the ACTIVE-only picker.
	const inactiveSelectedPolicyIds = $derived(
		selectedPolicyIds.filter((id) => !pickablePolicies.some((policy) => policy.id === id))
	);
	// Same retain-visible discipline for a delegated type's ATTESTED ids (the boundary contract).
	const inactiveAttestedPolicyIds = $derived(
		attestedPolicyIds.filter((id) => !pickablePolicies.some((policy) => policy.id === id))
	);
	// Resolve a policy id to its human name: engine library first, then the locked-floor labels, then the id.
	const policyNameById = $derived(new Map(data.policies.map((p) => [p.id, p.name])));
	function policyDisplayName(id: string): string {
		return policyNameById.get(id) ?? assurancePolicyLabel(id);
	}
	function focusTypeForm() {
		void tick().then(() => document.getElementById('pwu-type-form-heading')?.focus());
	}
	function openPolicyManager() {
		showPolicyManager = true;
		inspectorCollapsed = false;
		policyFormMode = null;
	}
	function resetPf() {
		Object.assign(pf, {
			name: '',
			purpose: '',
			rationale: '',
			evaluatedClaimTypes: 'CORRECTNESS',
			evaluatorRole: '',
			independenceRequirement: 'DIFFERENT_AGENT',
			permittedControlActions: 'ESCALATE',
			criteria: ''
		});
	}
	function openCreatePolicy() {
		resetPf();
		policyFormMode = 'create';
	}
	function openEditPolicy(p: PolicyView) {
		Object.assign(pf, {
			name: p.name,
			purpose: p.purpose,
			rationale: p.rationale,
			evaluatedClaimTypes: p.evaluatedClaimTypes || 'CORRECTNESS',
			evaluatorRole: p.evaluatorRole,
			independenceRequirement: p.independenceRequirement || 'DIFFERENT_AGENT',
			permittedControlActions: p.permittedControlActions || 'ESCALATE',
			criteria: p.criteria.join('\n')
		});
		policyFormMode = { editId: p.id };
	}
	// After any policy mutation succeeds, return to the manager list (the graph reloaded via enhance/invalidateAll).
	$effect(() => {
		if (
			form?.createdPolicy ||
			form?.editedPolicy ||
			form?.newVersion ||
			form?.suspendedPolicy ||
			form?.activatedPolicy
		) {
			policyFormMode = null;
		}
	});

	// ---- The authoring agent: chat + reasoning log over an isolated engine fork. The graph re-renders the staged
	// preview as tools land; canonical state changes only through the explicit accept action below.
	type LogEntry = {
		kind: 'status' | 'text' | 'thinking' | 'tool' | 'toolend' | 'error';
		text: string;
		ok?: boolean;
	};
	function policyLabel(id: string): string {
		return policyDisplayName(id);
	}

	const MUTATING = new Set([
		'set_pwa_details',
		'define_pwu_type',
		'define_from_template',
		'edit_pwu_type',
		'remove_pwu_type',
		'link_types',
		'unlink_types',
		'scaffold_graph'
	]);
	let chatInput = $state('');
	let log = $state<LogEntry[]>([]);

	// Hydrate from whichever authority the load explicitly selected: canonical conversation, or an in-process staged
	// candidate. A staged transcript becomes durable only if that exact candidate is accepted.
	let hydratedFor = $state('');
	$effect(() => {
		const source = data.authoringTurn
			? `${data.pwa.id}:${data.authoringTurn.id}:${data.authoringTurn.status}:${data.authoringTurn.commandCount}`
			: `${data.pwa.id}:canonical`;
		if (source !== hydratedFor && !running) {
			log = data.conversation ?? [];
			hydratedFor = source;
		}
	});

	function push(entry: LogEntry) {
		log = [...log, entry];
	}
	function appendText(kind: 'text' | 'thinking', t: string) {
		const last = log[log.length - 1];
		if (last && last.kind === kind) {
			last.text += t;
			log = [...log];
		} else push({ kind, text: t });
	}

	// Chat autoscroll: follow new streamed output only while the user is at the bottom; a scroll-to-bottom control
	// appears when they have scrolled up. No-op while the log panel is collapsed (its container is not in the DOM).
	let agentLogEl = $state<HTMLDivElement>();
	let stickToBottom = $state(true);
	function onAgentLogScroll() {
		const el = agentLogEl;
		if (el) stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
	}
	function scrollAgentLogToBottom() {
		if (agentLogEl) agentLogEl.scrollTop = agentLogEl.scrollHeight;
		stickToBottom = true;
	}
	$effect(() => {
		// Depend on the log length AND the tail text length so BOTH new entries and streamed text deltas re-run this.
		const tick = log.length + (log.at(-1)?.text.length ?? 0);
		if (agentLogEl && !agentCollapsed && stickToBottom && tick >= 0) {
			agentLogEl.scrollTop = agentLogEl.scrollHeight;
		}
	});

	async function sendToAgent(e: SubmitEvent) {
		e.preventDefault();
		const instruction = chatInput.trim();
		if (!instruction || running) return;
		running = true;
		agentCollapsed = false;
		push({ kind: 'text', text: `You: ${instruction}` });
		chatInput = '';
		try {
			const res = await fetch(`/pwa/${data.pwa.id}/agent`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ instruction })
			});
			if (!res.ok || !res.body) {
				push({ kind: 'error', text: `Agent request failed (${res.status}).` });
				return;
			}
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let idx: number;
				while ((idx = buf.indexOf('\n\n')) >= 0) {
					const line = buf
						.slice(0, idx)
						.split('\n')
						.find((l) => l.startsWith('data:'));
					buf = buf.slice(idx + 2);
					if (!line) continue;
					await handleEvent(JSON.parse(line.slice(5).trim()));
				}
			}
		} catch (err) {
			push({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
		} finally {
			// Keep hydration suppressed until the final candidate load (including transcript/floor/hash) has landed.
			// Flipping `running` first lets the effect hydrate an earlier tool-time snapshot with no transcript.
			try {
				await invalidateAll();
			} finally {
				running = false;
			}
		}
	}

	async function handleEvent(ev: {
		kind: string;
		text?: string;
		tool?: string;
		args?: Record<string, unknown>;
		ok?: boolean;
		summary?: string;
		message?: string;
	}) {
		switch (ev.kind) {
			case 'status':
				push({ kind: 'status', text: ev.text ?? '' });
				break;
			case 'text':
				appendText('text', ev.text ?? '');
				break;
			case 'thinking':
				appendText('thinking', ev.text ?? '');
				break;
			case 'tool_start':
				push({ kind: 'tool', text: `${ev.tool}(${compactArgs(ev.args)})` });
				break;
			case 'tool_end':
				push({ kind: 'toolend', text: `${ev.tool}: ${ev.summary ?? ''}`, ok: ev.ok });
				if (ev.ok && ev.tool && MUTATING.has(ev.tool)) await invalidateAll();
				break;
			case 'error':
				push({ kind: 'error', text: ev.message ?? 'error' });
				break;
			default:
				break;
		}
	}
	function compactArgs(args: Record<string, unknown> | undefined): string {
		if (!args) return '';
		return Object.entries(args)
			.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
			.join(', ');
	}
</script>

{#snippet fhead(label: string, help: string, forId?: string)}
	<div class="fld">
		{#if forId}<label class="flabel" for={forId}>{label}</label>{:else}<span class="flabel"
				>{label}</span
			>{/if}
		<span class="fhelp">{help}</span>
	</div>
{/snippet}

<svelte:head><title>{data.pwa.name} — Work Architecture</title></svelte:head>

<div class="designer">
	<header class="topbar">
		<div class="tbmain">
			<nav class="crumbs"><a href="/">PWA Library</a> › <span>{data.pwa.name}</span></nav>
			<div class="titlerow">
				<h1>{data.pwa.name}</h1>
				<span class="pill" class:pub={data.pwa.publicationStatus === 'PUBLISHED'}
					>{data.pwa.publicationStatus}</span
				>
				<span class="tbmeta">v{data.pwa.version} · {data.pwa.domain}</span>
				{#if data.types.length}
					<span
						class="health"
						class:bad={!graphReport.valid}
						class:warn={graphReport.valid && graphReport.findings.length > 0}
						title={graphHealthTitle}
						data-testid="graph-health"
						data-graph-valid={String(graphReport.valid)}
						data-root-count={String(graphReport.metrics.rootCount)}
						data-orphan-count={String(graphReport.metrics.orphanCount)}
						data-cycle-count={String(graphReport.metrics.cycleCount)}
						data-max-depth={String(graphReport.metrics.maxDepth)}
					>
						{graphReport.valid
							? graphReport.findings.length
								? `⚠ ${graphIssues} note(s)`
								: '✓ well-formed'
							: `✗ ${graphIssues} issue(s)`}
					</span>
				{/if}

				{#if data.floor}
					<span
						class="floorchip"
						class:bad={data.floor.aggregate === 'REJECTED'}
						class:warn={!data.floor.satisfied && data.floor.aggregate !== 'REJECTED'}
						class:ok={data.floor.satisfied}
						title="Required assurance policies (mandatory) — schema, provenance, and an independent reasoning review (exec ≠ assurance)"
						data-testid="assurance-chip"
					>
						⚖ {data.floor.satisfied ? 'floor satisfied' : `floor ${data.floor.aggregate.toLowerCase()}`}
					</span>
				{/if}
				{#if editable}
					<button class="ghost small" onclick={() => (showPwaEdit = !showPwaEdit)}>Edit details</button>
				{/if}
			</div>
			{#if editable && showPwaEdit}
				<form method="POST" action="?/editDetails" use:enhance class="detailform">
					<input name="name" value={data.pwa.name} placeholder="PWA name" required />
					<input name="domain" value={data.pwa.domain} placeholder="Domain" />
					<input name="description" value={data.pwa.description} placeholder="Description" />
					<button class="primary small" type="submit">Save</button>
					<button type="button" class="ghost small" onclick={() => (showPwaEdit = false)}>Cancel</button>
				</form>
			{/if}
			{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
		</div>

		<div class="tbpub">
			<ol class="steps">
				<li class:done={rank > 1} class:active={data.pwa.publicationStatus === 'DRAFT'}>Draft</li>
				<li class:done={rank > 2} class:active={data.pwa.publicationStatus === 'UNDER_REVIEW'}>Review</li>
				<li class:done={rank > 3} class:active={data.pwa.publicationStatus === 'VALIDATED'}>Valid.</li>
				<li class:done={rank > 4} class:active={data.pwa.publicationStatus === 'PUBLISHED'}>Pub.</li>
				<li class:done={rank > 5} class:active={data.pwa.publicationStatus === 'DEPRECATED'}>Deprec.</li>
				<li class:done={rank > 6} class:active={data.pwa.publicationStatus === 'RETIRED'}>Retired</li>
			</ol>
			<div class="pubact">
				<button class="ghost small" onclick={openPolicyManager}>⚖ Policies</button>
				{#if editable}
					<button class="ghost small" onclick={openDefine} disabled={typeMutationPending}
						>+ Define PWU Type</button
					>
				{/if}
				{#if data.pwa.publicationStatus === 'DRAFT'}
					<form method="POST" action="?/submitForReview" use:enhance>
						<button class="ghost small" type="submit" disabled={!hasRoot || hasStagedCandidate}
							>Submit for Review →</button
						>
					</form>
				{:else if data.pwa.publicationStatus === 'UNDER_REVIEW'}
					<form method="POST" action="?/validate" use:enhance>
						<button class="ghost small" type="submit">Validate →</button>
					</form>
				{:else if data.pwa.publicationStatus === 'VALIDATED'}
					<form method="POST" action="?/publish" use:enhance>
						<button class="primary small" type="submit">Publish</button>
					</form>
				{:else if data.pwa.publicationStatus === 'PUBLISHED'}
					<span class="immutable">🔒 Published versions are immutable</span>
					<form method="POST" action="?/deprecate" use:enhance>
						<button class="ghost small" type="submit">Deprecate</button>
					</form>
				{:else if data.pwa.publicationStatus === 'DEPRECATED'}
					<form method="POST" action="?/retire" use:enhance>
						<button class="ghost small" type="submit">Retire</button>
					</form>
				{:else if data.pwa.publicationStatus === 'RETIRED'}
					<span class="retired">retired</span>
				{/if}
			</div>
		</div>
	</header>
	{#if data.authoringTurn}
		<section class="candidatebanner" data-testid="authoring-candidate-banner" aria-live="polite">
			<div class="candidatecopy">
				<strong>Staged agent candidate — canonical DRAFT unchanged</strong>
				<span class="candidatemeta">
					{data.authoringTurn.status} · {data.authoringTurn.commandCount} accepted command{data
						.authoringTurn.commandCount === 1
						? ''
						: 's'}
				</span>
				{#if data.authoringTurn.candidateHash}
					<code title={data.authoringTurn.candidateHash}>{data.authoringTurn.candidateHash}</code>
				{/if}
				{#if candidateResumable}
					<span class="candidatehint" data-testid="candidate-resume-hint">
						{data.authoringTurn.status === 'BLOCKED_EXTERNAL'
							? 'The reviewer call failed (external/operational) — this candidate is preserved.'
							: 'Revision requested — this candidate is preserved.'} Refine it in the chat below (it continues on the same candidate), or Discard.
					</span>
				{/if}
			</div>
			<div class="candidateactions">
				{#if data.authoringTurn.status === 'READY_TO_COMMIT' && data.authoringTurn.candidateHash}
					<form method="POST" action="?/acceptAgentCandidate" use:enhance>
						<input type="hidden" name="candidateHash" value={data.authoringTurn.candidateHash} />
						<button class="primary small" type="submit" disabled={running}>Accept exact candidate</button>
					</form>
				{/if}
				<form method="POST" action="?/discardAgentCandidate" use:enhance>
					<button class="ghost small danger" type="submit" disabled={running}>Discard candidate</button>
				</form>
			</div>
		</section>
	{/if}

	<div class="canvas">
		<div class="flowarea">
			<SvelteFlow
				bind:nodes
				bind:edges
				{nodeTypes}
				onnodeclick={(e) => selectNode(e.node.id)}
				onnodedragstart={beginCanvasMove}
				onnodedragstop={finishCanvasMove}
				onkeydowncapture={beginKeyboardCanvasMove}
				onkeydown={finishKeyboardCanvasMove}
				deleteKey={null}
				fitView
				fitViewOptions={panelAwareFitViewOptions}
			>
			<Background />
			<Controls position="bottom-right" fitViewOptions={panelAwareFitViewOptions} />

			<!-- Bottom-CENTER control cluster: overlay toggle + legend, and the data-flow hand-off detail. Kept out
			     of the left/right columns so the tall, draggable agent/inspector/floor panels never cover it. -->
			<Panel position="bottom-center">
				<div class="controlcluster">
					{#if selectedFlow}
						<aside class="flowdetail" data-testid="dataflow-detail">
							<header class="flowdetailhead">
								<span class="itag">DATA FLOW</span>
								<button
									class="collapsebtn"
									onclick={dismissFlow}
									aria-label="Dismiss data-flow detail">✕</button
								>
							</header>
							<p class="flowroute">
								<strong>{selectedFlow.sourceName}</strong>
								<span class="flowarrow">⤳</span>
								<strong>{selectedFlow.targetName}</strong>
							</p>
							<span class="flabel">Artifacts configured to flow</span>
							<ul class="flowartifacts">
								{#each selectedFlow.artifacts as a (a)}
									<li class="artifactchip">{a}</li>
								{/each}
							</ul>
						</aside>
					{/if}
					<div class="overlaytoggle" data-testid="overlay-toggle" use:draggable={{ handle: '.layoutscope' }}>
						<div class="viewrow">
							<label class="viewlabel">
								<span>Composition lens</span>
								<select bind:value={layoutDirection} aria-label="PWA composition layout">
									<option value="RIGHT">Left to right</option>
									<option value="DOWN">Top down</option>
								</select>
							</label>
							<div class="canvasundo" aria-label="Canvas position history">
								<button
									class="ghost xs"
									type="button"
									disabled={canvasHistory.past.length === 0}
									onclick={undoCanvasPosition}
									aria-label="Undo canvas move"
									title="Undo the last node move (canvas layout only)">↶ Position</button
								>
								<button
									class="ghost xs"
									type="button"
									disabled={canvasHistory.future.length === 0}
									onclick={redoCanvasPosition}
									aria-label="Redo canvas move"
									title="Redo the last node move (canvas layout only)">↷ Position</button
								>
							</div>
						</div>
						<p class="layoutscope" title="Drag here to move the Composition Lens">
							<span data-testid="layout-engine"
								>{layoutPending ? 'Arranging…' : `Layout: ${layoutEngine ?? 'unavailable'}`}</span
							>
							· Position is local presentation, never execution order or professional state.
						</p>
						{#if layoutEngine === 'DAGRE' && !layoutPending}
							<p class="layoutfallback">ELK was unavailable; showing the explicit Dagre fallback.</p>
						{/if}
						{#if layoutError}<p class="layouterror">Layout failed: {layoutError}</p>{/if}
						<div class="ovrow">
							<label class="ovlabel">
								<input type="checkbox" bind:checked={showDataFlow} />
								Data-flow overlay
							</label>
							<label class="ovlabel" data-testid="walkthrough-toggle">
								<input
									type="checkbox"
									checked={showWalkthrough}
									onchange={(e) =>
										e.currentTarget.checked ? enterWalkthrough() : exitWalkthrough()}
								/>
								Walkthrough
							</label>
							{#if collapsed.size}
								<button class="ghost small" onclick={() => (collapsed = new Set())}>Expand all</button>
							{/if}
						</div>
						<div class="legend">
							<span class="legitem"><span class="legline permits"></span> permits (composition)</span>
							{#if showDataFlow}
								<span class="legitem"
									><span class="legline flow"></span> data-flow (hand-off · click a link)</span
								>
							{/if}
						</div>
						{#if showWalkthrough}
							<div class="walkcontroller" data-testid="walkthrough-controller">
								<div class="walknav">
									<button
										class="ghost xs"
										onclick={walkPrev}
										disabled={walkCount === 0 || walkClampedStep === 0}
										aria-label="Previous dependency step">◀</button
									>
									<span class="walkstep" data-testid="walk-stepcount">
										{#if walkCount === 0}No dependency layers{:else}Dependency step {walkClampedStep +
												1} of {walkCount}{/if}
									</span>
									<button
										class="ghost xs"
										onclick={walkNext}
										disabled={walkCount === 0 || walkClampedStep >= walkCount - 1}
										aria-label="Next dependency step">▶</button
									>
								</div>
								{#if handoffOrder.cycles.length || handoffOrder.blocked.length || handoffOrder.unordered.length}
									<p class="walkflags" data-testid="walk-flags">
										{#if handoffOrder.cycles.length}<span class="warn"
												>⟲ {handoffOrder.cycles.length} hand-off cycle{handoffOrder.cycles.length > 1
													? 's'
													: ''}</span
											>{/if}
										{#if handoffOrder.blocked.length}<span class="warn"
												>⊘ {handoffOrder.blocked.length} blocked</span
											>{/if}
										{#if handoffOrder.unordered.length}<span class="muted"
												>◇ {handoffOrder.unordered.length} no hand-off</span
											>{/if}
									</p>
								{/if}
								{#if currentWalkLayer.length > 1}
									<div class="walkpicker" data-testid="walk-picker">
										<span class="fhelp">Concurrent in this step:</span>
										{#each currentWalkLayer as id (id)}
											<button
												class="ghost xs"
												class:active={walkPicked === id}
												onclick={() => (walkPickedId = id)}
												>{data.types.find((t) => t.id === id)?.name ?? id}</button
											>
										{/each}
									</div>
								{/if}
								<p class="fhelp walkcaveat" data-testid="walk-caveat">
									Hand-off dependency order — what must be produced before what can be consumed. NOT an
									execution schedule.
								</p>
							</div>
						{/if}
					</div>
				</div>
			</Panel>

			{#if isDraft}
				<Panel position="top-left">
					<section
						class="agentpanel"
						class:collapsed={agentCollapsed}
						data-testid="agent-panel"
						use:draggable={{ handle: '.paneldrag' }}
					>
						<header class="ppanelhead paneldrag">
							<span class="itag">AI AGENT</span>
							<div class="pheadright">
								{#if running}<span class="livedot">● working…</span>{/if}
								<button
									class="collapsebtn"
									onclick={() => (agentCollapsed = !agentCollapsed)}
									aria-label={agentCollapsed ? 'Expand agent panel' : 'Collapse agent panel'}
									>{agentCollapsed ? '▸' : '▾'}</button
								>
							</div>
						</header>
						{#if !agentCollapsed}
							<div
								class="agentlog"
								data-testid="agent-log"
								bind:this={agentLogEl}
								onscroll={onAgentLogScroll}
							>
								{#if log.length === 0}
									<p class="logempty">
										Describe what you want and the JPWB agent proposes the PWU Types + links onto this
										DRAFT. You review and publish.
									</p>
								{/if}
								{#each log as entry, i (i)}
									<div
										class="logentry {entry.kind}"
										class:bad={entry.kind === 'toolend' && entry.ok === false}
									>
										{#if entry.kind === 'tool'}<span class="logmark">▶</span>{:else if entry.kind === 'toolend'}<span
												class="logmark">{entry.ok === false ? '✗' : '✓'}</span
											>{:else if entry.kind === 'thinking'}<span class="logmark">…</span>{:else if entry.kind === 'error'}<span
												class="logmark">!</span
											>{/if}<span class="logtext">{entry.text}</span>
									</div>
								{/each}
							</div>
							{#if !stickToBottom}
								<button
									class="scrolldown"
									type="button"
									onclick={scrollAgentLogToBottom}
									title="Scroll to the latest message"
									aria-label="Scroll to latest">↓ Latest</button
								>
							{/if}
						{/if}
					</section>
				</Panel>
			{/if}

			<Panel position="top-right">
				<aside
					class="inspectorpanel"
					class:collapsed={inspectorCollapsed}
					data-testid="inspector-panel"
					use:draggable={{ handle: '.paneldrag' }}
				>
					<header class="ppanelhead paneldrag">
						<span class="itag"
							>{showWalkthrough
								? 'WALKTHROUGH'
								: showPolicyManager
									? 'ASSURANCE POLICIES'
									: 'PWU TYPE'}</span
						>
						<button
							class="collapsebtn"
							onclick={() => (inspectorCollapsed = !inspectorCollapsed)}
							aria-label={inspectorCollapsed ? 'Expand inspector' : 'Collapse inspector'}
							>{inspectorCollapsed ? '▸' : '▾'}</button
						>
					</header>
					{#if !inspectorCollapsed}
						<div class="panelbody">
							{#if showWalkthrough}
								{#if walkPickedNode}
									<WalkthroughPanel
										node={walkPickedNode}
										types={data.types}
										behavior={behaviorTopology}
										finding={walkPickedFinding}
										stepNumber={walkStepByNode.get(walkPickedNode.id)}
									/>
								{:else}
									<p class="hint" data-testid="walk-empty">
										No node at this dependency step.{#if handoffOrder.unordered.length}
											This PWA has no hand-off edges — all nodes are in the “no hand-off” bucket.{/if}
									</p>
								{/if}
							{:else if showPolicyManager}
								<div class="pmgrhead">
									<span class="fhelp"
										>Workbench assurance-policy library — the locked mandatory policies (always apply) plus your
										declarable policies. New shared policies start DRAFT and become declarable only after activation.
										Reference them on a PWU Type from the Declared assurance policies field.</span
									>
									<button
										class="collapsebtn"
										onclick={() => (showPolicyManager = false)}
										aria-label="Close policy manager">✕</button
									>
								</div>
								{#if policyFormMode !== null}
									{@const pediting = policyEditingId !== ''}
									<div class="itag">{pediting ? 'EDIT POLICY' : 'NEW POLICY'}</div>
									<form
										method="POST"
										action={pediting ? '?/editPolicy' : '?/createPolicy'}
										use:enhance
										class="typeform"
									>
										{#if pediting}<input type="hidden" name="policyId" value={policyEditingId} />{/if}
										<div class="ffield">
											<span class="flabel">Name</span>
											<input name="name" bind:value={pf.name} required />
										</div>
										<div class="ffield">
											<span class="flabel">Purpose</span>
											<textarea name="purpose" bind:value={pf.purpose} rows="2"></textarea>
										</div>
										<div class="ffield">
											<span class="flabel">Rationale</span>
											<textarea name="rationale" bind:value={pf.rationale} rows="2"></textarea>
										</div>
										<div class="ffield">
											<span class="flabel">Evaluated claim type</span>
											<select name="evaluatedClaimTypes" bind:value={pf.evaluatedClaimTypes}>
												{#each CLAIM_TYPES as c (c)}<option value={c}>{c}</option>{/each}
											</select>
										</div>
										<div class="ffield">
											<span class="flabel">Evaluator role</span>
											<input name="evaluatorRole" bind:value={pf.evaluatorRole} placeholder="reviewer" />
										</div>
										<div class="ffield">
											<span class="flabel">Independence requirement</span>
											<select name="independenceRequirement" bind:value={pf.independenceRequirement}>
												{#each INDEPENDENCE as i (i)}<option value={i}>{i}</option>{/each}
											</select>
										</div>
										<div class="ffield">
											<span class="flabel">Permitted control action</span>
											<select name="permittedControlActions" bind:value={pf.permittedControlActions}>
												{#each CONTROL_ACTIONS as a (a)}<option value={a}>{a}</option>{/each}
											</select>
										</div>
										<div class="ffield">
											<span class="flabel">Criteria (one per line)</span>
											<textarea
												name="criteria"
												bind:value={pf.criteria}
												rows="4"
												placeholder="Each non-empty line becomes a mandatory assessment criterion"
											></textarea>
										</div>
										<div class="formactions">
											<button class="primary small" type="submit"
												>{pediting ? 'Save changes' : 'Create policy'}</button
											>
											<button type="button" class="ghost small" onclick={() => (policyFormMode = null)}
												>Cancel</button
											>
										</div>
									</form>
								{:else}
									<div class="pmgractions">
										<button class="ghost small" onclick={openCreatePolicy}>＋ New policy</button>
									</div>
									<ul class="policylistmgr">
										{#each sortedPolicies as p (p.id)}
											<li
												class="policycard"
												class:floorcard={p.isFloor}
												class:supersededcard={p.status === 'SUPERSEDED'}
												data-policy-id={p.id}
												data-policy-status={p.status}
											>
												<div class="pchead">
													<span class="pcname">{p.name}</span>
													{#if p.isFloor}
														<span class="pclock" title="Mandatory — always applies, non-editable"
															>🔒 mandatory</span
														>
													{:else}
														<span class="pcstatus {p.status.toLowerCase()}">{p.status}</span>
													{/if}
												</div>
												<div class="pcmeta">
													v{p.version} · {p.evaluatedClaimTypes || '—'} · {p.criteria.length} criteria
												</div>
												<p class="pcpurpose">{p.purpose}</p>
												{#if !p.isFloor && p.status !== 'SUPERSEDED'}
													<div class="pcactions">
														<button class="ghost xs" onclick={() => openEditPolicy(p)}>Edit</button>
														{#if p.status === 'ACTIVE' || p.status === 'SUSPENDED'}
															<form method="POST" action="?/newPolicyVersion" use:enhance>
																<input type="hidden" name="policyId" value={p.id} />
																<button class="ghost xs" type="submit">Create & activate version</button>
															</form>
														{/if}
														{#if p.status === 'ACTIVE'}
															<form method="POST" action="?/suspendPolicy" use:enhance>
																<input type="hidden" name="policyId" value={p.id} />
																<button class="ghost xs" type="submit">Suspend</button>
															</form>
														{:else if p.status === 'SUSPENDED' || p.status === 'DRAFT'}
															<form method="POST" action="?/activatePolicy" use:enhance>
																<input type="hidden" name="policyId" value={p.id} />
																<button class="ghost xs" type="submit">Activate</button>
															</form>
														{/if}
													</div>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							{:else if editable && formMode !== null}
						{@const editing = editingId !== ''}
						<div class="itag" id="pwu-type-form-heading" tabindex="-1">
							{editing ? 'EDIT PWU TYPE' : 'NEW PWU TYPE'}
						</div>
						<form
							method="POST"
							action={editing ? '?/editType' : '?/defineType'}
							use:enhance={enhanceTypeMutation}
							class="typeform"
						>
							{#if editing}<input type="hidden" name="pwuTypeId" value={editingId} />{/if}
							{#if !editing}
								<div class="ffield">
									<label class="flabel" for="pwu-type-template">Start from template</label>
									<span class="fhelp">Copy a reusable blueprint from the catalog, then edit it freely.</span>
									<select
										id="pwu-type-template"
										class="tplsel"
										onchange={(e) => applyTemplate(e.currentTarget.value)}
									>
										<option value="">— blank —</option>
										{#each PWU_TYPE_CATALOG as t (t.key)}<option value={t.key}>{t.name}</option>{/each}
									</select>
								</div>
							{/if}
							<div class="ffield">
								{@render fhead('Name', PWU_TYPE_HELP.name, 'pwu-type-name')}
								<input id="pwu-type-name" name="name" bind:value={f.name} required />
							</div>
							<div class="ffield">
								{@render fhead('Kind', PWU_TYPE_HELP.pwuKind, 'pwu-type-kind')}
								<input
									id="pwu-type-kind"
									name="pwuKind"
									bind:value={f.pwuKind}
									placeholder="ARCHITECTURE"
									required
								/>
							</div>
							<div class="ffield">
								{@render fhead('Purpose', PWU_TYPE_HELP.purpose, 'pwu-type-purpose')}
								<textarea id="pwu-type-purpose" name="purpose" bind:value={f.purpose} rows="2"></textarea>
							</div>
							<div class="ffield">
								{@render fhead(
									'Completion rule',
									PWU_TYPE_HELP.completionRule,
									'pwu-type-completion-rule'
								)}
								<input
									id="pwu-type-completion-rule"
									name="completionRule"
									bind:value={f.completionRule}
									placeholder="(defaults to the RPH rule)"
								/>
							</div>
							<div class="ffield">
								{@render fhead('Required inputs', PWU_TYPE_HELP.requiredInputs, 'pwu-type-inputs')}
								<input
									id="pwu-type-inputs"
									name="requiredInputs"
									bind:value={f.requiredInputs}
									placeholder="approved-behavior"
								/>
							</div>
							<div class="ffield">
								{@render fhead('Required outputs', PWU_TYPE_HELP.requiredOutputs, 'pwu-type-outputs')}
								<input
									id="pwu-type-outputs"
									name="requiredOutputs"
									bind:value={f.requiredOutputs}
									placeholder="architecture-baseline"
								/>
							</div>
							<div class="ffield">
								<label class="rootcheck"
									><input type="checkbox" name="isRoot" bind:checked={f.isRoot} /> Root type</label
								>
								<span class="fhelp">{PWU_TYPE_HELP.isRoot}</span>
							</div>
							<div class="ffield">
								{@render fhead('Execution boundary', PWU_TYPE_HELP.executionBoundary, 'pwu-type-boundary')}
								<select id="pwu-type-boundary" name="executionBoundary" bind:value={f.executionBoundary}>
									<option value="INTERNAL">INTERNAL · we decompose &amp; execute this</option>
									<option value="DELEGATED_EXTERNAL">DELEGATED_EXTERNAL · handed to an external party</option>
								</select>
							</div>
							{#if f.executionBoundary !== 'DELEGATED_EXTERNAL'}
							<div class="ffield">
								{@render fhead('Permitted child types + cardinality', PWU_TYPE_HELP.permittedChildren)}
								<div class="childlist">
									{#each data.types.filter((t) => t.id !== editingId) as t (t.id)}
										{@const rule = childRules[t.id] ?? { cardinality: 'M1', note: '' }}
										<div class="childrow">
											<label class="childopt">
												<input
													type="checkbox"
													name="permittedChildTypeIds"
													value={t.id}
													checked={children.includes(t.id)}
													onchange={(e) => toggleChild(t.id, e.currentTarget.checked)}
												/>
												{t.name}
											</label>
											{#if children.includes(t.id)}
												<select
													class="cardsel"
													name={`cardinality:${t.id}`}
													value={rule.cardinality}
													onchange={(e) =>
														(childRules = {
															...childRules,
															[t.id]: { ...rule, cardinality: e.currentTarget.value }
														})}
													aria-label={`Cardinality for ${t.name}`}
												>
													<option value="M1">M1 · exactly one</option>
													<option value="M+">M+ · one or more</option>
													<option value="C1">C1 · conditional, 0 or 1</option>
													<option value="C+">C+ · conditional, 0 or more</option>
												</select>
												{#if rule.cardinality === 'C1' || rule.cardinality === 'C+'}
													<input
														class="cardnote"
														name={`applicability:${t.id}`}
														value={rule.note}
														oninput={(e) =>
															(childRules = {
																...childRules,
																[t.id]: { ...rule, note: e.currentTarget.value }
															})}
														placeholder="when does this child apply?"
														aria-label={`Applicability for ${t.name}`}
													/>
												{/if}
											{/if}
										</div>
									{/each}
									{#if data.types.filter((t) => t.id !== editingId).length === 0}
										<span class="fhelp">Define more types to allow composition.</span>
									{/if}
								</div>
							</div>
							{:else}
							<div class="ffield" data-testid="boundary-contract">
								{@render fhead('Counterparty', PWU_TYPE_HELP.counterpartyLabel, 'pwu-type-counterparty')}
								<input
									id="pwu-type-counterparty"
									name="counterpartyLabel"
									bind:value={f.counterpartyLabel}
									placeholder="Contract Lab — Hematology"
								/>
							</div>
							<div class="ffield">
								{@render fhead('Attested assurance policies', PWU_TYPE_HELP.attestedAssurancePolicyIds)}
								<div class="policylist">
									<div class="floornote">The counterparty’s CLAIM · not our review (disclosure is not verification)</div>
									{#each pickablePolicies as p (p.id)}
										<label class="childopt" title={p.purpose}>
											<input
												type="checkbox"
												name="attestedAssurancePolicyIds"
												value={p.id}
												checked={attestedPolicyIds.includes(p.id)}
												onchange={(e) => toggleAttested(p.id, e.currentTarget.checked)}
											/>
											{p.name}
										</label>
									{/each}
									{#each inactiveAttestedPolicyIds as policyId (policyId)}
										{@const retained = data.policies.find((policy) => policy.id === policyId)}
										<label
											class="childopt inactivepolicy"
											title="Existing inactive attestation — retained unless you uncheck it"
										>
											<input
												type="checkbox"
												name="attestedAssurancePolicyIds"
												value={policyId}
												checked={attestedPolicyIds.includes(policyId)}
												onchange={(e) => toggleAttested(policyId, e.currentTarget.checked)}
											/>
											{policyDisplayName(policyId)}
											<span class="policyrefstatus"
												>{retained?.isFloor ? 'LOCKED FLOOR' : (retained?.status ?? 'MISSING')}</span
											>
										</label>
									{/each}
									{#if pickablePolicies.length === 0}
										<span class="fhelp">No active policies yet — create and activate one in ⚖ Policies.</span>
									{/if}
								</div>
							</div>
							<div class="ffield">
								{@render fhead('Applicability note', PWU_TYPE_HELP.boundaryApplicabilityNote, 'pwu-type-boundary-note')}
								<input
									id="pwu-type-boundary-note"
									name="boundaryApplicabilityNote"
									bind:value={f.boundaryApplicabilityNote}
									placeholder="STAT panels only; routine handled internally"
								/>
							</div>
							{/if}
							<div class="ffield">
								{@render fhead('Declared assurance policies', PWU_TYPE_HELP.requiredAssurancePolicyIds)}
								<div class="policylist">
									<div class="floornote">🔒 Mandatory policies always apply · not listed here</div>
									{#each pickablePolicies as p (p.id)}
										<label class="childopt" title={p.purpose}>
											<input
												type="checkbox"
												name="requiredAssurancePolicyIds"
												value={p.id}
												checked={selectedPolicyIds.includes(p.id)}
												onchange={(e) => togglePolicy(p.id, e.currentTarget.checked)}
											/>
											{p.name}
										</label>
									{/each}
									{#each inactiveSelectedPolicyIds as policyId (policyId)}
										{@const retained = data.policies.find((policy) => policy.id === policyId)}
										<label
											class="childopt inactivepolicy"
											title="Existing inactive reference — retained unless you uncheck it"
										>
											<input
												type="checkbox"
												name="requiredAssurancePolicyIds"
												value={policyId}
												checked={selectedPolicyIds.includes(policyId)}
												onchange={(e) => togglePolicy(policyId, e.currentTarget.checked)}
											/>
											{policyDisplayName(policyId)}
											<span class="policyrefstatus"
												>{retained?.isFloor ? 'LOCKED FLOOR' : (retained?.status ?? 'MISSING')}</span
											>
										</label>
									{/each}
									{#if pickablePolicies.length === 0}
										<span class="fhelp">No active policies yet — create and activate one in ⚖ Policies.</span>
									{/if}
									<button type="button" class="linkbtn" onclick={openPolicyManager}
										>⚖ Manage policies…</button
									>
								</div>
							</div>
							<div class="formactions">
								<button class="primary small" type="submit" disabled={typeMutationPending}
									>{typeMutationPending ? 'Saving…' : editing ? 'Save changes' : 'Add type'}</button
								>
								<button
									type="button"
									class="ghost small"
									onclick={() => (formMode = null)}
									disabled={typeMutationPending}>Cancel</button
								>
							</div>
						</form>
					{:else if current}
						<h3>{current.name}</h3>
						<div class="field"><span class="flabel">Kind</span><p class="mono">{current.pwuKind}</p></div>
						<div class="field" data-testid="inspector-boundary">
							<span class="flabel">Boundary</span>
							<p>
								<span class={current.executionBoundary === 'DELEGATED_EXTERNAL'
									? 'boundarybadge delegated'
									: 'boundarybadge internal'}>
									{current.executionBoundary === 'DELEGATED_EXTERNAL' ? 'DELEGATED · external' : 'INTERNAL'}
								</span>
								<span class="leafkind">{leafKindLabel(leafKind(current))}</span>
							</p>
						</div>
						<div class="field"><span class="flabel">Purpose</span><p>{current.purpose}</p></div>
						<div class="field">
							<span class="flabel">Completion rule</span><p class="mono">{current.completionRule || '—'}</p>
						</div>
						<div class="field">
							<span class="flabel">Required inputs</span>
							<p>{current.requiredInputs.length ? current.requiredInputs.join(', ') : '—'}</p>
						</div>
						<div class="field">
							<span class="flabel">Required outputs</span>
							<p>{current.requiredOutputs.length ? current.requiredOutputs.join(', ') : '—'}</p>
						</div>
						{#if current.executionBoundary === 'DELEGATED_EXTERNAL'}
						<div class="field" data-testid="inspector-boundary-contract">
							<span class="flabel">Boundary contract</span>
							<p>Counterparty: <strong>{current.boundaryContract?.counterpartyLabel || '—'}</strong></p>
							<p class="fhelp">Attested policies — the counterparty’s claim, not verified by us:</p>
							{#if current.boundaryContract?.attestedAssurancePolicyIds.length}
								<ul class="childcards">
									{#each current.boundaryContract.attestedAssurancePolicyIds as pid (pid)}
										<li><span class="cardbadge">attested</span> {policyDisplayName(pid)}</li>
									{/each}
								</ul>
							{:else}
								<p>— (none attested)</p>
							{/if}
							{#if current.boundaryContract?.applicabilityNote}
								<p><em class="applic">· {current.boundaryContract.applicabilityNote}</em></p>
							{/if}
						</div>
						{:else}
						<div class="field">
							<span class="flabel">Permitted children</span>
							{#if current.permittedChildTypeIds.length === 0}
								<p>— (leaf)</p>
							{:else}
								<ul class="childcards">
									{#each current.permittedChildTypeIds as cid (cid)}
										{@const rule = current.permittedChildren.find((r) => r.typeId === cid)}
										{@const child = data.types.find((t) => t.id === cid)}
										<li>
											<span class="cardbadge">{rule?.cardinality ?? 'M1'}</span>
											{child?.name ?? cid}
											{#if rule?.applicabilityNote}<em class="applic">· {rule.applicabilityNote}</em
												>{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						{/if}
						<div class="field assurancerail">
							<span class="flabel">Required assurance policies</span>
							<div class="railfloor">
								<div class="raillocked">🔒 Mandatory · always applies · non-removable</div>
								{#each ASSURANCE_FLOOR as p (p.id)}
									<div class="railitem" title={p.blurb}>{p.label}</div>
								{/each}
							</div>
							{#if current.requiredAssurancePolicyIds.length}
								<div class="railadd">
									{#each current.requiredAssurancePolicyIds as pid (pid)}
										<div class="railitem plus">+ {policyLabel(pid)}</div>
									{/each}
								</div>
							{:else}
								<span class="fhelp"
									>No additional policies declared (the mandatory policies still apply).</span
								>
							{/if}
						</div>
						{#if editable}
							<div class="inspactions">
								<button
									class="ghost small"
									onclick={() => openEdit(current.id)}
									disabled={typeMutationPending}>Edit</button
								>
								<form method="POST" action="?/removeType" use:enhance={enhanceTypeMutation}>
									<input type="hidden" name="pwuTypeId" value={current.id} />
									<button class="ghost small danger" type="submit" disabled={typeMutationPending}
										>{typeMutationPending ? 'Removing…' : 'Remove'}</button
									>
								</form>
							</div>
						{/if}
						<div class="behaviorlens">
							<div class="behaviorlenshead">
								<span class="flabel">PWU work-lifecycle axis</span>
								<button class="ghost xs" type="button" onclick={() => (behaviorRun += 1)}
									>Restart simulation</button
								>
							</div>
							<p class="fhelp">
								This explores only the declared <code>PWU.workLifecycleState</code> topology for future
								instances of {current.name}. It does not assign state to this reusable PWU Type.
								<code>executionState</code>, <code>assuranceState</code>, and
								<code>shapeIntegrityState</code> remain independent and are not simulated.
							</p>
							{#key `${current.id}:${behaviorRun}`}
								<PwuBehaviorPanel
									behavior={behaviorTopology}
									title="Declared PWU work-lifecycle topology"
								/>
							{/key}
						</div>
					{:else}
						<div class="itag">INSPECTOR</div>
						<p class="hint">Select a node to inspect it{#if editable}, or “+ Define PWU Type”.{/if}</p>
					{/if}

					{#if !showPolicyManager && data.fixtures.length}
						<div class="fixtures">
							<span class="flabel">Conformance fixtures</span>
							{#each data.fixtures as fx (fx.id)}
								<a class="fixture" href={`/undertakings/${fx.id}`}>
									{#if fx.isReferenceFixture}<span class="fxbadge">REFERENCE FIXTURE</span>{/if}
									{fx.name} ↗
								</a>
							{/each}
						</div>
					{/if}
						</div>
					{/if}
				</aside>
			</Panel>

			{#if data.types.length === 0}
				<Panel position="top-center">
					<div class="emptyhint">
						No PWU Types yet — use “+ Define PWU Type”{#if editable}, or ask the agent below{/if}.
					</div>
				</Panel>
			{/if}
			{#if data.floor}
				<Panel position="bottom-right">
					<div
						class="floorpanel"
						class:collapsed={floorCollapsed}
						data-testid="assurance-panel"
						use:draggable={{ handle: '.paneldrag' }}
					>
						<header class="ppanelhead paneldrag">
							<span class="itag">REQUIRED ASSURANCE</span>
							<button
								class="collapsebtn"
								onclick={() => (floorCollapsed = !floorCollapsed)}
								aria-label={floorCollapsed ? 'Expand floor' : 'Collapse floor'}
								>{floorCollapsed ? '▸' : '▾'}</button
							>
						</header>
						{#if !floorCollapsed}
							<div class="panelbody">
						<div class="floorhead">
							<span
								class="floortag"
								class:ok={data.floor.satisfied}
								class:bad={data.floor.aggregate === 'REJECTED'}
								data-testid="assurance-disposition">⚖ {data.floor.aggregate}</span
							>
							<span class="floorsub">mandatory assurance policies · always applies</span>
							{#if data.floor.waived}
								<span class="waivedbadge" data-testid="assurance-waived">waiver in force</span>
							{/if}
						</div>
						<ul class="floorpolicies">
							{#each data.floor.policies as pol (pol.policyId)}
								<li class:ok={pol.disposition === 'SATISFIED'} class:bad={pol.disposition === 'REJECTED'}>
									<span class="pdisp"
										>{pol.disposition === 'SATISFIED' ? '✓' : pol.disposition === 'REJECTED' ? '✗' : '•'}</span
									>
									{policyLabel(pol.policyId)}
								</li>
							{/each}
						</ul>
						{#if data.floor.reasoningGaps.length}
							<p class="floorgapshdr">Reasoning-review findings</p>
							<ul class="floorgaps">
								{#each data.floor.reasoningGaps.slice(0, 5) as g}<li>{g}</li>{/each}
							</ul>
						{/if}
						{#if !data.floor.satisfied && data.floor.waived}
							<p class="floorhint">
								A governance waiver is in force — publishing is permitted despite the floor (an auditable,
								recorded override).
							</p>
						{:else if !data.floor.satisfied}
							<p class="floorhint">
								Publishing is blocked until the floor is SATISFIED — revise the graph and re-run, or record a
								waiver.
							</p>
							{#if canWaive}
								<form method="POST" action="?/recordWaiver" use:enhance class="floorwaiver">
									<input
										name="rationale"
										placeholder="Waiver rationale — why publish despite the floor"
										required
									/>
									<button class="ghost small danger" type="submit">Record waiver + allow publish</button>
								</form>
							{/if}
						{/if}
							</div>
						{/if}
					</div>
				</Panel>
			{/if}
			</SvelteFlow>
		</div>
		{#if chatOpen}
			<form class="chatbar" onsubmit={sendToAgent}>
				<textarea
					bind:value={chatInput}
					placeholder="Ask the agent to build or modify the graph — e.g. “Draft a product realization architecture with the standard work areas.”"
					rows="1"
					data-testid="agent-input"
					onkeydown={(e) => {
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendToAgent(e as unknown as SubmitEvent);
					}}
				></textarea>
				<button class="primary" type="submit" disabled={running || !chatInput.trim()}>
					{running ? 'Working…' : 'Send'}
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.designer {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.candidatebanner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid rgba(250, 204, 21, 0.42);
		background: rgba(113, 63, 18, 0.36);
		color: #fef3c7;
	}
	.candidatecopy {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 0.7rem;
	}
	.candidatemeta {
		color: #fde68a;
		font-size: 0.78rem;
		white-space: nowrap;
	}
	.candidatehint {
		min-width: 0;
		overflow: hidden;
		color: #fde68a;
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.candidatecopy code {
		overflow: hidden;
		max-width: 21rem;
		color: #fef9c3;
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.candidateactions {
		display: flex;
		flex: none;
		gap: 0.45rem;
	}
	.topbar {
		flex: 0 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 18px;
		padding: 12px 20px;
		border-bottom: 1px solid var(--sc);
		background: var(--surface);
	}
	.tbmain {
		min-width: 0;
	}
	.crumbs {
		font-size: 11px;
		color: var(--outline);
		margin-bottom: 4px;
	}
	.titlerow {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.titlerow h1 {
		margin: 0;
		font-size: 20px;
		letter-spacing: -0.01em;
	}
	.tbmeta {
		font-size: 12px;
		color: var(--on-variant);
	}
	.pill {
		font-size: 10px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 5px;
		background: rgba(159, 202, 255, 0.15);
		color: var(--primary);
	}
	.pill.pub {
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.health {
		font-size: 10px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 5px;
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
		cursor: help;
		white-space: nowrap;
	}
	.health.warn {
		background: rgba(230, 181, 102, 0.15);
		color: var(--amber);
	}
	.health.bad {
		background: rgba(255, 180, 171, 0.15);
		color: var(--error);
	}
	.detailform {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 10px;
	}
	.detailform input {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 7px 10px;
		font-size: 12.5px;
	}
	.tbpub {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		flex-shrink: 0;
	}
	.steps {
		display: flex;
		gap: 5px;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 10px;
		color: var(--outline);
	}
	.steps li {
		padding: 3px 8px;
		border-radius: 20px;
		background: var(--sc);
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.steps li.done {
		color: var(--tertiary);
	}
	.steps li.active {
		background: var(--sc-highest);
		color: var(--primary);
		font-weight: 700;
	}
	.pubact {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pubact form {
		margin: 0;
	}
	.immutable {
		font-size: 11px;
		color: var(--tertiary);
		font-weight: 600;
	}
	.retired {
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--outline);
		font-weight: 700;
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 8px 0 0;
	}
	.canvas {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface);
	}
	.flowarea {
		flex: 1;
		min-height: 0;
		position: relative;
	}
	.canvas :global(.svelte-flow) {
		background: var(--surface);
	}
	.canvas :global(.svelte-flow__node) {
		cursor: pointer;
	}
	/* The zoom / fit / lock toolbar ships light-on-white and washes out on the dark canvas — retheme it. */
	.canvas :global(.svelte-flow__controls) {
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
		border-radius: 8px;
		overflow: hidden;
	}
	.canvas :global(.svelte-flow__controls-button) {
		background: #26282c;
		border-bottom: 1px solid #35383d;
		fill: #d7dde5;
		color: #d7dde5;
	}
	.canvas :global(.svelte-flow__controls-button:hover) {
		background: #34373c;
	}
	.canvas :global(.svelte-flow__controls-button svg) {
		fill: #d7dde5;
	}
	/* Edge label chips render as HTML .svelte-flow__edge-label divs themed by CSS variables (the default white-bg /
	   light-text washed out on the dark canvas). Give them a legible dark pill. */
	.canvas :global(.svelte-flow) {
		--xy-edge-label-background-color: #1b1c1f;
		--xy-edge-label-color: #cdd6df;
	}
	.canvas :global(.svelte-flow__edge-label) {
		padding: 2px 7px;
		border-radius: 5px;
		font-size: 10px;
		font-weight: 600;
		border: 1px solid #33383f;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
	}
	/* Floating panels overlaid on the canvas (Svelte Flow <Panel>) */
	.agentpanel,
	.inspectorpanel {
		background: rgba(20, 20, 21, 0.94);
		border: 1px solid var(--outline-faint);
		border-radius: 12px;
		backdrop-filter: blur(6px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
	}
	.agentpanel {
		position: relative;
		width: 288px;
		/* Fits inside the flow area (which sits above the chat bar), scrolling internally. */
		max-height: calc(100vh - 235px);
		display: flex;
		flex-direction: column;
		padding: 12px;
	}
	.scrolldown {
		position: absolute;
		right: 14px;
		bottom: 12px;
		padding: 3px 9px;
		border: 1px solid rgba(148, 163, 184, 0.5);
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.92);
		color: #e2e8f0;
		font-size: 0.72rem;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
	}
	.scrolldown:hover {
		border-color: rgba(148, 163, 184, 0.85);
	}
	.layoutscope {
		cursor: grab;
	}
	.layoutscope:active {
		cursor: grabbing;
	}
	.agentpanel.collapsed {
		width: 200px;
	}
	.ppanelhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.pheadright {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.livedot {
		font-size: 11px;
		color: var(--tertiary);
		font-weight: 600;
	}
	.collapsebtn {
		background: var(--sc-high);
		border: 1px solid var(--outline-faint);
		color: var(--on-variant);
		border-radius: 5px;
		width: 22px;
		height: 22px;
		font-size: 11px;
		cursor: pointer;
	}
	/* The header of each side panel is the drag handle: grab-to-move, and NOT text-selectable. */
	.paneldrag {
		cursor: grab;
		user-select: none;
		touch-action: none;
	}
	.paneldrag:active {
		cursor: grabbing;
	}
	/* Svelte Flow disables text selection across the canvas; re-enable it on the side panels (their bodies), so a
	   user can select + copy the content. Nodes deliberately stay non-selectable (they are drag-to-move). */
	.agentpanel,
	.inspectorpanel,
	.floorpanel {
		user-select: text;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.panelbody {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.agentlog {
		margin-top: 10px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 120px;
	}
	.logempty {
		color: var(--outline);
		font-size: 11.5px;
		line-height: 1.5;
		margin: 0;
	}
	.logentry {
		font-size: 12px;
		line-height: 1.45;
		color: var(--on-variant);
		display: flex;
		gap: 6px;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.logentry.tool,
	.logentry.toolend {
		font-family: 'Source Code Pro', monospace;
		font-size: 11px;
	}
	.logentry.toolend {
		color: var(--tertiary);
	}
	.logentry.toolend.bad {
		color: var(--error);
	}
	.logentry.thinking {
		color: var(--outline);
		font-style: italic;
	}
	.logentry.status {
		color: var(--outline);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.logentry.error {
		color: var(--error);
	}
	.logmark {
		flex-shrink: 0;
		font-weight: 700;
	}
	.inspectorpanel {
		width: 320px;
		/* Capped to under half the flow area (≈100vh − topbar − chatbar) so the top-right inspector and the
		   bottom-right floor never overlap by default; the body scrolls internally (.panelbody). */
		max-height: calc(50vh - 96px);
		padding: 0;
	}
	.inspectorpanel .panelbody {
		padding: 4px 16px 14px;
	}
	.inspectorpanel .ppanelhead {
		padding: 12px 12px 6px 16px;
	}
	.inspectorpanel h3 {
		margin: 6px 0 14px;
		font-size: 18px;
	}
	.chatbar {
		flex: 0 0 auto;
		display: flex;
		gap: 10px;
		align-items: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--sc);
		background: var(--surface);
	}
	.chatbar textarea {
		flex: 1;
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 8px;
		padding: 9px 11px;
		font-size: 13px;
		font-family: inherit;
		resize: none;
		max-height: 96px;
	}
	.emptyhint {
		background: rgba(20, 20, 21, 0.9);
		border: 1px dashed var(--outline-faint);
		border-radius: 10px;
		padding: 10px 14px;
		font-size: 12px;
		color: var(--on-variant);
	}
	.itag {
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--primary);
		font-weight: 700;
	}
	.hint {
		color: var(--outline);
		font-size: 12px;
		margin: 8px 0 0;
	}
	.typeform {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 10px;
	}
	.ffield {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.fld {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.fhelp {
		font-size: 11px;
		color: var(--outline);
		line-height: 1.4;
	}
	.typeform input,
	.typeform textarea,
	.tplsel {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
		font-family: inherit;
	}
	.rootcheck {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		color: var(--on-variant);
	}
	.childlist {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.childopt {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--on-variant);
	}
	.inactivepolicy {
		color: var(--amber);
	}
	.policyrefstatus {
		margin-left: auto;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.04em;
	}
	.childrow {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.childrow .childopt {
		flex: 1 1 auto;
		min-width: 90px;
	}
	.cardsel {
		font-size: 10px;
		padding: 1px 2px;
		background: #232324;
		color: var(--on-variant);
		border: 1px solid var(--outline);
		border-radius: 4px;
	}
	.cardnote {
		flex: 1 1 100%;
		font-size: 11px;
		padding: 2px 5px;
		background: #232324;
		color: var(--on-variant);
		border: 1px solid var(--outline);
		border-radius: 4px;
	}
	.policylist {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.floornote {
		font-size: 10.5px;
		color: var(--outline);
		padding-bottom: 2px;
	}
	.linkbtn {
		align-self: flex-start;
		background: none;
		border: none;
		color: var(--primary);
		font-size: 11px;
		cursor: pointer;
		padding: 4px 0 0;
	}
	/* ── Assurance-policy manager ─────────────────────────────────────────────────────────────────────────── */
	.pmgrhead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
	}
	.pmgractions {
		margin-bottom: 8px;
	}
	.policylistmgr {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.policycard {
		border: 1px solid var(--outline-faint);
		border-radius: 8px;
		padding: 8px 10px;
		background: var(--sc);
	}
	.policycard.floorcard {
		border-color: #4a4a2a;
		background: #201f16;
	}
	.policycard.supersededcard {
		opacity: 0.6;
	}
	.pchead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.pcname {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--on);
	}
	.pclock {
		font-size: 9.5px;
		font-weight: 700;
		color: #d8c56a;
		white-space: nowrap;
	}
	.pcstatus {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--sc-highest);
		color: var(--outline);
		white-space: nowrap;
	}
	.pcstatus.active {
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.pcstatus.suspended {
		background: rgba(230, 181, 102, 0.15);
		color: var(--amber);
	}
	.pcstatus.superseded {
		background: var(--sc-highest);
		color: var(--outline);
	}
	.pcmeta {
		font-size: 10px;
		color: var(--outline);
		margin-top: 2px;
		font-family: 'Source Code Pro', monospace;
	}
	.pcpurpose {
		font-size: 11.5px;
		color: var(--on-variant);
		line-height: 1.4;
		margin: 5px 0 0;
	}
	.pcactions {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 7px;
	}
	.pcactions form {
		margin: 0;
	}
	button.ghost.xs {
		padding: 3px 8px;
		font-size: 10.5px;
		border-radius: 6px;
	}
	.childcards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.childcards li {
		font-size: 12.5px;
		color: var(--on-variant);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.cardbadge {
		font-family: 'Source Code Pro', monospace;
		font-size: 10px;
		font-weight: 600;
		color: #9fcaff;
		border: 1px solid #345;
		border-radius: 4px;
		padding: 0 4px;
		flex: 0 0 auto;
	}
	.applic {
		color: var(--outline);
		font-size: 11px;
	}
	.boundarybadge {
		font-family: 'Source Code Pro', monospace;
		font-size: 10px;
		font-weight: 600;
		border-radius: 4px;
		padding: 0 5px;
		margin-right: 6px;
	}
	.boundarybadge.internal {
		color: #9fcaff;
		border: 1px solid #345;
	}
	.boundarybadge.delegated {
		color: #ffd08a;
		border: 1px solid #6a5320;
		background: #2a220f;
	}
	.leafkind {
		color: var(--outline);
		font-size: 11px;
	}
	.assurancerail {
		border-left: 2px solid #4a4a2a;
		padding-left: 8px;
	}
	.railfloor {
		border-radius: 6px;
		background: #201f16;
		border: 1px solid #4a4a2a;
		padding: 6px 8px;
		margin-bottom: 4px;
	}
	.raillocked {
		font-size: 10.5px;
		font-weight: 600;
		color: #d8c56a;
		margin-bottom: 3px;
	}
	.railitem {
		font-size: 11.5px;
		color: var(--on-variant);
		line-height: 1.5;
	}
	.railitem.plus {
		color: #61dac1;
	}
	.railadd {
		padding: 2px 0 0 2px;
	}
	.controlcluster {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.overlaytoggle {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 330px;
		background: rgba(24, 24, 26, 0.85);
		border: 1px solid var(--outline);
		border-radius: 8px;
		padding: 6px 9px;
	}
	.viewrow {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
	}
	.viewlabel {
		display: grid;
		gap: 2px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--outline);
	}
	.viewlabel select {
		min-width: 128px;
		padding: 3px 6px;
		border: 1px solid var(--outline-faint);
		border-radius: 5px;
		background: var(--sc-highest);
		color: var(--on-variant);
		font-size: 10.5px;
		text-transform: none;
		letter-spacing: normal;
	}
	.canvasundo {
		display: flex;
		gap: 5px;
	}
	.canvasundo button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.layoutscope,
	.layoutfallback,
	.layouterror {
		margin: 0;
		font-size: 9.5px;
		line-height: 1.35;
		color: var(--outline);
	}
	.layouterror {
		color: var(--error);
	}
	.layoutfallback {
		color: var(--amber);
	}
	.ovrow {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.legend {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.legitem {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: var(--outline);
	}
	.legline {
		display: inline-block;
		width: 18px;
		height: 0;
		border-top-width: 2px;
		border-top-style: solid;
		flex: 0 0 auto;
	}
	.legline.permits {
		border-top-color: #6a717b;
	}
	.legline.flow {
		border-top-style: dashed;
		border-top-color: #61dac1;
	}
	/* Data-flow hand-off detail (opens on clicking a ⤳ link). */
	.flowdetail {
		background: rgba(20, 20, 21, 0.96);
		border: 1px solid #2f5c53;
		border-radius: 10px;
		padding: 10px 12px 12px;
		width: 300px;
		max-width: 60vw;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
		user-select: text;
	}
	.flowdetailhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.flowroute {
		margin: 0 0 8px;
		font-size: 12.5px;
		color: var(--on);
		line-height: 1.4;
	}
	.flowarrow {
		color: #61dac1;
		margin: 0 4px;
		font-weight: 700;
	}
	.flowartifacts {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.artifactchip {
		font-family: 'Source Code Pro', monospace;
		font-size: 11px;
		color: #061; /* fallback */
		color: #06110d;
		background: #61dac1;
		border-radius: 5px;
		padding: 2px 7px;
	}
	.ovlabel {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--on-variant);
		cursor: pointer;
	}
	.formactions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.field {
		margin-bottom: 12px;
	}
	.flabel {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--outline);
		display: block;
		margin-bottom: 4px;
	}
	.field p {
		margin: 0;
		font-size: 13px;
		color: var(--on-variant);
		line-height: 1.5;
	}
	.mono {
		font-family: 'Source Code Pro', monospace;
		font-size: 11.5px !important;
	}
	.inspactions {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 4px;
	}
	.behaviorlens {
		display: grid;
		gap: 7px;
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--sc);
	}
	.behaviorlens > .fhelp {
		margin: 0;
		line-height: 1.4;
	}
	.behaviorlenshead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.behaviorlenshead .flabel {
		margin: 0;
	}
	.fixtures {
		margin-top: 18px;
		border-top: 1px solid var(--sc);
		padding-top: 12px;
	}
	.fixture {
		display: block;
		background: var(--sc);
		border-radius: 8px;
		padding: 9px 11px;
		font-size: 12px;
		margin-bottom: 6px;
		color: var(--on);
	}
	.fxbadge {
		display: inline-block;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		background: var(--primary-container);
		color: #fff;
		padding: 1px 6px;
		border-radius: 4px;
		margin-right: 6px;
	}
	/* Buttons */
	button.ghost {
		background: var(--sc-highest);
		color: var(--on);
		border: 1px solid var(--outline-faint);
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	button.ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button.ghost.small,
	button.primary.small {
		padding: 6px 11px;
		font-size: 12px;
	}
	button.ghost.danger {
		color: var(--error);
		border-color: rgba(255, 180, 171, 0.4);
	}
	button.primary {
		background: var(--primary);
		color: #00263f;
		border: none;
		border-radius: 8px;
		padding: 8px 16px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
	}
	button.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	/* De minimis assurance floor — chip + panel */
	.floorchip { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px; border: 1px solid transparent; white-space: nowrap; cursor: help; }
	.floorchip.ok { background: rgba(97, 218, 193, 0.15); color: var(--tertiary); }
	.floorchip.warn { background: rgba(230, 181, 102, 0.15); color: var(--amber); }
	.floorchip.bad { background: rgba(255, 180, 171, 0.15); color: var(--error); }
	.floorpanel { width: 280px; max-width: 32vw; max-height: calc(50vh - 96px); padding: 0; border: 1px solid var(--sc); border-radius: 10px; background: var(--surface); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); font-size: 12px; }
	.floorpanel .panelbody { padding: 4px 14px 12px; }
	.floorpanel .ppanelhead { padding: 10px 12px 6px 14px; }
	.floorhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.floortag { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 5px; background: rgba(230, 181, 102, 0.15); color: var(--amber); }
	.floortag.ok { background: rgba(97, 218, 193, 0.15); color: var(--tertiary); }
	.floortag.bad { background: rgba(255, 180, 171, 0.15); color: var(--error); }
	.floorsub { font-size: 10px; color: var(--outline); }
	.floorpolicies { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
	.floorpolicies li { display: flex; gap: 6px; align-items: baseline; color: var(--on-variant); }
	.floorpolicies li.ok { color: var(--on-surface); }
	.floorpolicies .pdisp { color: var(--amber); font-weight: 800; }
	.floorpolicies li.ok .pdisp { color: var(--tertiary); }
	.floorpolicies li.bad .pdisp { color: var(--error); }
	.floorgapshdr { margin: 10px 0 4px; font-weight: 700; color: var(--on-variant); }
	.floorgaps { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 3px; }
	.floorgaps li { line-height: 1.35; }
	.floorhint { margin: 10px 0 0; color: var(--on-variant); line-height: 1.4; }
	.floorwaiver { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sc); padding-top: 10px; }
	.floorwaiver input { padding: 6px 8px; border: 1px solid var(--sc); border-radius: 6px; background: var(--surface); color: inherit; font-size: 11px; }
	.waivedbadge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; background: rgba(97, 218, 193, 0.15); color: var(--tertiary); }
</style>
