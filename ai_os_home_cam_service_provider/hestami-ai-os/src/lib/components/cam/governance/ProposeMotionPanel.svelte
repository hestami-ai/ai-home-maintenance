<script lang="ts">
	import { Gavel, FileText, Link, Upload, X } from 'lucide-svelte';
	import { Button, Textarea, Input, Label, Select } from 'flowbite-svelte';

	interface LinkedEntity {
		type: 'arc' | 'violation' | 'workOrder' | 'policy';
		id: string;
		label: string;
	}

	interface Props {
		meetingId: string;
		onSubmit?: (data: {
			title: string;
			description: string;
			category?: string;
			linkedEntities: LinkedEntity[];
		}) => void;
		onCancel?: () => void;
		loading?: boolean;
	}

	let { meetingId, onSubmit, onCancel, loading = false }: Props = $props();

	let title = $state('');
	let description = $state('');
	let category = $state('');
	let linkedEntities = $state<LinkedEntity[]>([]);
	let showLinkSelector = $state(false);

	const categoryOptions = [
		{ value: '', name: 'Select category...' },
		{ value: 'POLICY', name: 'Policy Change' },
		{ value: 'BUDGET', name: 'Budget/Financial' },
		{ value: 'ARC', name: 'ARC Decision' },
		{ value: 'VIOLATION', name: 'Violation Action' },
		{ value: 'MAINTENANCE', name: 'Maintenance/Repair' },
		{ value: 'PERSONNEL', name: 'Personnel' },
		{ value: 'OTHER', name: 'Other' }
	];

	const isValid = $derived(title.trim().length > 0 && description.trim().length > 0);

	function handleSubmit() {
		if (!isValid || !onSubmit) return;
		onSubmit({
			title: title.trim(),
			description: description.trim(),
			category: category || undefined,
			linkedEntities
		});
	}

	function removeLinkedEntity(id: string) {
		linkedEntities = linkedEntities.filter(e => e.id !== id);
	}

	function addLinkedEntity(entity: LinkedEntity) {
		if (!linkedEntities.find(e => e.id === entity.id)) {
			linkedEntities = [...linkedEntities, entity];
		}
		showLinkSelector = false;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
			<Gavel size={20} />
		</div>
		<div>
			<h3 class="font-semibold text-lg">Propose Motion</h3>
			<p class="text-sm text-gray-500">Submit a motion for board consideration</p>
		</div>
	</div>

	<div class="space-y-4">
		<div>
			<Label for="motion-title" class="mb-2">Motion Title <span class="text-red-500">*</span></Label>
			<Input
				id="motion-title"
				bind:value={title}
				placeholder="e.g., Approve landscaping contract renewal"
				disabled={loading}
			/>
		</div>

		<div>
			<Label for="motion-category" class="mb-2">Category</Label>
			<Select id="motion-category" bind:value={category} items={categoryOptions} disabled={loading} />
		</div>

		<div>
			<Label for="motion-description" class="mb-2">Motion Text <span class="text-red-500">*</span></Label>
			<Textarea
				id="motion-description"
				bind:value={description}
				placeholder="I move that the board approve..."
				rows={4}
				disabled={loading}
			/>
			<p class="mt-1 text-xs text-gray-500">
				Describe the motion in detail. This will be recorded in the minutes.
			</p>
		</div>

		<div>
			<Label class="mb-2">Related Items</Label>
			<div class="space-y-2">
				{#if linkedEntities.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each linkedEntities as entity (entity.id)}
							<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm">
								<Link size={12} />
								{entity.label}
								<button
									type="button"
									class="ml-1 text-gray-400 hover:text-gray-600"
									onclick={() => removeLinkedEntity(entity.id)}
									disabled={loading}
								>
									<X size={14} />
								</button>
							</span>
						{/each}
					</div>
				{/if}
				<Button color="alternative" size="sm" onclick={() => showLinkSelector = true} disabled={loading}>
					<Link size={14} class="mr-2" />
					Link Related Item
				</Button>
			</div>
		</div>

		<div>
			<Label class="mb-2">Supporting Documents</Label>
			<div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
				<Upload size={24} class="mx-auto text-gray-400 mb-2" />
				<p class="text-sm text-gray-500">Drag and drop files here, or click to browse</p>
				<p class="text-xs text-gray-400 mt-1">PDF, DOC, DOCX up to 10MB</p>
			</div>
		</div>
	</div>

	<div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
		<Button color="alternative" onclick={onCancel} disabled={loading}>
			Cancel
		</Button>
		<Button color="primary" onclick={handleSubmit} disabled={!isValid || loading}>
			{#if loading}
				Submitting...
			{:else}
				Submit for Seconding
			{/if}
		</Button>
	</div>
</div>

{#if showLinkSelector}
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
			<h4 class="font-semibold mb-4">Link Related Item</h4>
			<p class="text-sm text-gray-500 mb-4">
				Select an item to link to this motion. This helps track the context and outcomes.
			</p>
			
			<div class="space-y-2 mb-4">
				<button
					type="button"
					class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
					onclick={() => addLinkedEntity({ type: 'arc', id: 'demo-arc-1', label: 'ARC-2024-001: Fence Installation' })}
				>
					<p class="font-medium text-sm">ARC Requests</p>
					<p class="text-xs text-gray-500">Link to an architectural review request</p>
				</button>
				<button
					type="button"
					class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
					onclick={() => addLinkedEntity({ type: 'violation', id: 'demo-vio-1', label: 'VIO-2024-015: Parking Violation' })}
				>
					<p class="font-medium text-sm">Violations</p>
					<p class="text-xs text-gray-500">Link to a violation case</p>
				</button>
				<button
					type="button"
					class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
					onclick={() => addLinkedEntity({ type: 'workOrder', id: 'demo-wo-1', label: 'WO-2024-042: Pool Repair' })}
				>
					<p class="font-medium text-sm">Work Orders</p>
					<p class="text-xs text-gray-500">Link to a maintenance work order</p>
				</button>
				<button
					type="button"
					class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
					onclick={() => addLinkedEntity({ type: 'policy', id: 'demo-pol-1', label: 'Parking Policy v2.1' })}
				>
					<p class="font-medium text-sm">Policies</p>
					<p class="text-xs text-gray-500">Link to a governing document</p>
				</button>
			</div>

			<div class="flex justify-end">
				<Button color="alternative" onclick={() => showLinkSelector = false}>
					Cancel
				</Button>
			</div>
		</div>
	</div>
{/if}
