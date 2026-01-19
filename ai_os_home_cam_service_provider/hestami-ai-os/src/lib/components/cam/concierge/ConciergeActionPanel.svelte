<script lang="ts">
	import {
		HelpCircle,
		Link,
		Scale,
		CheckCircle,
		XCircle,
		UserPlus,
		Settings,
		Send,
		FileText,
		Wrench
	} from 'lucide-svelte';
	import { conciergeCaseApi, ConciergeCaseStatusValues, type ConciergeCaseDetail, type ConciergeCaseStatus } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
		onRequestClarification?: (question: string) => Promise<void>;
		onLinkArc?: (arcRequestId: string) => Promise<void>;
		onLinkWorkOrder?: (workOrderId: string) => Promise<void>;
		onRecordDecision?: (decision: { title: string; description: string; rationale: string }) => Promise<void>;
		onUpdateStatus?: (status: ConciergeCaseStatus, reason?: string) => Promise<void>;
		onAssignConcierge?: (conciergeId: string) => Promise<void>;
		onCloseCase?: (resolution: string) => Promise<void>;
	}

	let {
		caseDetail,
		onRequestClarification,
		onLinkArc,
		onLinkWorkOrder,
		onRecordDecision,
		onUpdateStatus,
		onAssignConcierge,
		onCloseCase
	}: Props = $props();

	let activeAction = $state<string | null>(null);
	let isSubmitting = $state(false);

	let clarificationQuestion = $state('');
	let arcRequestId = $state('');
	let workOrderId = $state('');
	let decisionTitle = $state('');
	let decisionDescription = $state('');
	let decisionRationale = $state('');
	let closeResolution = $state('');
	let newStatus = $state<ConciergeCaseStatus | ''>('');
	let statusReason = $state('');
	let selectedConciergeId = $state('');
	let concierges = $state<Array<{ id: string; name: string; email: string }>>([]);
	let isLoadingConcierges = $state(false);

	function resetForms() {
		clarificationQuestion = '';
		arcRequestId = '';
		workOrderId = '';
		decisionTitle = '';
		decisionDescription = '';
		decisionRationale = '';
		closeResolution = '';
		newStatus = '';
		statusReason = '';
		selectedConciergeId = '';
		activeAction = null;
	}

	async function handleRequestClarification() {
		if (!onRequestClarification || !clarificationQuestion.trim()) return;
		isSubmitting = true;
		try {
			await onRequestClarification(clarificationQuestion.trim());
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	async function handleLinkArc() {
		if (!onLinkArc || !arcRequestId.trim()) return;
		isSubmitting = true;
		try {
			await onLinkArc(arcRequestId.trim());
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	async function handleLinkWorkOrder() {
		if (!onLinkWorkOrder || !workOrderId.trim()) return;
		isSubmitting = true;
		try {
			await onLinkWorkOrder(workOrderId.trim());
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	async function handleRecordDecision() {
		if (!onRecordDecision || !decisionTitle.trim() || !decisionRationale.trim()) return;
		isSubmitting = true;
		try {
			await onRecordDecision({
				title: decisionTitle.trim(),
				description: decisionDescription.trim(),
				rationale: decisionRationale.trim()
			});
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	async function handleUpdateStatus() {
		if (!onUpdateStatus || !newStatus) return;
		isSubmitting = true;
		try {
			await onUpdateStatus(newStatus, statusReason || undefined);
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	async function handleCloseCase() {
		if (!onCloseCase || !closeResolution.trim()) return;
		isSubmitting = true;
		try {
			await onCloseCase(closeResolution.trim());
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	async function loadConcierges() {
		if (concierges.length > 0) return;
		isLoadingConcierges = true;
		try {
			const response = await conciergeCaseApi.listConcierges();
			if (response.ok && response.data) {
				concierges = response.data.concierges;
			}
		} catch (err) {
			console.error('Failed to load concierges:', err);
		} finally {
			isLoadingConcierges = false;
		}
	}

	async function handleAssignConcierge() {
		if (!onAssignConcierge || !selectedConciergeId) return;
		isSubmitting = true;
		try {
			await onAssignConcierge(selectedConciergeId);
			resetForms();
		} finally {
			isSubmitting = false;
		}
	}

	const statusOptions: ConciergeCaseStatus[] = [
		ConciergeCaseStatusValues.INTAKE,
		ConciergeCaseStatusValues.ASSESSMENT,
		ConciergeCaseStatusValues.IN_PROGRESS,
		ConciergeCaseStatusValues.PENDING_EXTERNAL,
		ConciergeCaseStatusValues.PENDING_OWNER,
		ConciergeCaseStatusValues.ON_HOLD,
		ConciergeCaseStatusValues.RESOLVED,
		ConciergeCaseStatusValues.CLOSED,
		ConciergeCaseStatusValues.CANCELLED
	];

	function getActions() {
		const status = caseDetail.case.status;
		const canRequestClarification = status !== ConciergeCaseStatusValues.CLOSED && status !== ConciergeCaseStatusValues.CANCELLED && status !== ConciergeCaseStatusValues.PENDING_OWNER;
		const canClose = status === ConciergeCaseStatusValues.RESOLVED || status === ConciergeCaseStatusValues.IN_PROGRESS;

		return [
			{
				id: 'clarification',
				label: 'Request Clarification',
				icon: HelpCircle,
				color: 'text-amber-500',
				enabled: canRequestClarification
			},
			{
				id: 'link_arc',
				label: 'Link ARC Request',
				icon: FileText,
				color: 'text-blue-500',
				enabled: !caseDetail.case.linkedArcRequestId
			},
			{
				id: 'link_work_order',
				label: 'Link Work Order',
				icon: Wrench,
				color: 'text-amber-500',
				enabled: !caseDetail.case.linkedWorkOrderId
			},
			{
				id: 'decision',
				label: 'Record Decision',
				icon: Scale,
				color: 'text-purple-500',
				enabled: true
			},
			{
				id: 'status',
				label: 'Change Status',
				icon: Settings,
				color: 'text-surface-500',
				enabled: true
			},
			{
				id: 'close',
				label: 'Close Case',
				icon: CheckCircle,
				color: 'text-green-500',
				enabled: canClose
			},
			{
				id: 'assign',
				label: 'Assign Concierge',
				icon: UserPlus,
				color: 'text-blue-500',
				enabled: status !== ConciergeCaseStatusValues.CLOSED && status !== ConciergeCaseStatusValues.CANCELLED
			}
		];
	}

	const actions = $derived(getActions());

	$effect(() => {
		if (activeAction === 'assign') {
			loadConcierges();
		}
	});
</script>

<div class="space-y-4">
	<h3 class="font-semibold text-sm text-surface-500 uppercase tracking-wide">Actions</h3>

	<!-- Action Buttons -->
	<div class="grid grid-cols-2 gap-2">
		{#each actions as action}
			{@const ActionIcon = action.icon}
			<button
				type="button"
				class="flex items-center gap-2 rounded-lg border border-surface-300-700 p-3 text-left text-sm transition-colors hover:bg-surface-100-900 disabled:opacity-50 disabled:cursor-not-allowed {activeAction === action.id ? 'bg-surface-100-900 border-primary-500' : ''}"
				disabled={!action.enabled}
				onclick={() => (activeAction = activeAction === action.id ? null : action.id)}
			>
				<ActionIcon size={16} class={action.color} />
				<span class="font-medium">{action.label}</span>
			</button>
		{/each}
	</div>

	<!-- Action Forms -->
	{#if activeAction === 'clarification'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Request Clarification from Owner</h4>
			<textarea
				bind:value={clarificationQuestion}
				placeholder="What information do you need from the owner?"
				class="textarea w-full"
				rows="3"
			></textarea>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleRequestClarification}
					disabled={isSubmitting || !clarificationQuestion.trim()}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<Send size={14} class="mr-1" />
						Send Request
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if activeAction === 'link_arc'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Link ARC Request</h4>
			<input
				type="text"
				bind:value={arcRequestId}
				placeholder="Enter ARC Request ID"
				class="input w-full"
			/>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleLinkArc}
					disabled={isSubmitting || !arcRequestId.trim()}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<Link size={14} class="mr-1" />
						Link
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if activeAction === 'link_work_order'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Link Work Order</h4>
			<input
				type="text"
				bind:value={workOrderId}
				placeholder="Enter Work Order ID"
				class="input w-full"
			/>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleLinkWorkOrder}
					disabled={isSubmitting || !workOrderId.trim()}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<Link size={14} class="mr-1" />
						Link
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if activeAction === 'decision'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Record Decision</h4>
			<div>
				<label for="decisionTitle" class="block text-sm font-medium">Title</label>
				<input
					id="decisionTitle"
					type="text"
					bind:value={decisionTitle}
					placeholder="Decision title"
					class="input mt-1 w-full"
				/>
			</div>
			<div>
				<label for="decisionDescription" class="block text-sm font-medium">Description (optional)</label>
				<textarea
					id="decisionDescription"
					bind:value={decisionDescription}
					placeholder="Brief description"
					class="textarea mt-1 w-full"
					rows="2"
				></textarea>
			</div>
			<div>
				<label for="decisionRationale" class="block text-sm font-medium">
					Rationale <span class="text-red-500">*</span>
				</label>
				<textarea
					id="decisionRationale"
					bind:value={decisionRationale}
					placeholder="Explain the reasoning behind this decision..."
					class="textarea mt-1 w-full"
					rows="3"
				></textarea>
			</div>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleRecordDecision}
					disabled={isSubmitting || !decisionTitle.trim() || !decisionRationale.trim()}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<Scale size={14} class="mr-1" />
						Record Decision
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if activeAction === 'status'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Change Status</h4>
			<div>
				<label for="newStatus" class="block text-sm font-medium">New Status</label>
				<select id="newStatus" bind:value={newStatus} class="select mt-1 w-full">
					<option value="">Select a status</option>
					{#each statusOptions as status}
						{#if status !== caseDetail.case.status}
							<option value={status}>{status.replace(/_/g, ' ')}</option>
						{/if}
					{/each}
				</select>
			</div>
			<div>
				<label for="statusReason" class="block text-sm font-medium">Reason (optional)</label>
				<textarea
					id="statusReason"
					bind:value={statusReason}
					placeholder="Explain why you're changing the status..."
					class="textarea mt-1 w-full"
					rows="2"
				></textarea>
			</div>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleUpdateStatus}
					disabled={isSubmitting || !newStatus}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<Settings size={14} class="mr-1" />
						Update Status
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if activeAction === 'close'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Close Case</h4>
			<div>
				<label for="closeResolution" class="block text-sm font-medium">
					Resolution Summary <span class="text-red-500">*</span>
				</label>
				<textarea
					id="closeResolution"
					bind:value={closeResolution}
					placeholder="Summarize how this case was resolved..."
					class="textarea mt-1 w-full"
					rows="3"
				></textarea>
			</div>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-success-500 btn-sm"
					onclick={handleCloseCase}
					disabled={isSubmitting || !closeResolution.trim()}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<CheckCircle size={14} class="mr-1" />
						Close Case
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if activeAction === 'assign'}
		<div class="rounded-lg border border-surface-300-700 p-4 space-y-4">
			<h4 class="font-medium">Assign Concierge</h4>
			{#if caseDetail.case.assignedConciergeName}
				<p class="text-sm text-surface-500">
					Currently assigned to: <span class="font-medium">{caseDetail.case.assignedConciergeName}</span>
				</p>
			{/if}
			<div>
				<label for="conciergeSelect" class="block text-sm font-medium">Select Concierge</label>
				{#if isLoadingConcierges}
					<div class="mt-2 flex items-center gap-2 text-sm text-surface-500">
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></span>
						Loading concierges...
					</div>
				{:else}
					<select id="conciergeSelect" bind:value={selectedConciergeId} class="select mt-1 w-full">
						<option value="">Select a concierge</option>
						{#each concierges as concierge}
							<option value={concierge.id}>{concierge.name} ({concierge.email})</option>
						{/each}
					</select>
				{/if}
			</div>
			<div class="flex justify-end gap-2">
				<button class="btn preset-outlined-surface-500 btn-sm" onclick={resetForms}>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleAssignConcierge}
					disabled={isSubmitting || !selectedConciergeId || isLoadingConcierges}
				>
					{#if isSubmitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<UserPlus size={14} class="mr-1" />
						Assign
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
