<script lang="ts">
	import { FileText, AlertTriangle, Wrench, ScrollText, Search, X, Check } from 'lucide-svelte';
	import { Button, Input } from 'flowbite-svelte';

	type EntityType = 'arc' | 'violation' | 'workOrder' | 'policy';

	interface LinkedEntity {
		type: EntityType;
		id: string;
		label: string;
		number?: string;
	}

	interface Props {
		open: boolean;
		onSelect: (entity: LinkedEntity) => void;
		onCancel: () => void;
		excludeIds?: string[];
	}

	let { open, onSelect, onCancel, excludeIds = [] }: Props = $props();

	let activeTab = $state<EntityType>('arc');
	let searchQuery = $state('');
	let isLoading = $state(false);

	// Mock data - in production, these would be fetched from API
	const mockData: Record<EntityType, LinkedEntity[]> = {
		arc: [
			{ type: 'arc', id: 'arc-1', number: 'ARC-2024-001', label: 'Fence Installation Request' },
			{ type: 'arc', id: 'arc-2', number: 'ARC-2024-002', label: 'Solar Panel Installation' },
			{ type: 'arc', id: 'arc-3', number: 'ARC-2024-003', label: 'Exterior Paint Change' }
		],
		violation: [
			{ type: 'violation', id: 'vio-1', number: 'VIO-2024-015', label: 'Parking Violation - Unit 101' },
			{ type: 'violation', id: 'vio-2', number: 'VIO-2024-016', label: 'Noise Complaint - Unit 205' },
			{ type: 'violation', id: 'vio-3', number: 'VIO-2024-017', label: 'Landscaping Non-Compliance' }
		],
		workOrder: [
			{ type: 'workOrder', id: 'wo-1', number: 'WO-2024-042', label: 'Pool Pump Repair' },
			{ type: 'workOrder', id: 'wo-2', number: 'WO-2024-043', label: 'Clubhouse HVAC Maintenance' },
			{ type: 'workOrder', id: 'wo-3', number: 'WO-2024-044', label: 'Gate Motor Replacement' }
		],
		policy: [
			{ type: 'policy', id: 'pol-1', number: 'POL-001', label: 'Parking Policy v2.1' },
			{ type: 'policy', id: 'pol-2', number: 'POL-002', label: 'Pet Policy v1.3' },
			{ type: 'policy', id: 'pol-3', number: 'POL-003', label: 'Architectural Guidelines v3.0' }
		]
	};

	const tabs: { type: EntityType; label: string; icon: typeof FileText }[] = [
		{ type: 'arc', label: 'ARC Requests', icon: FileText },
		{ type: 'violation', label: 'Violations', icon: AlertTriangle },
		{ type: 'workOrder', label: 'Work Orders', icon: Wrench },
		{ type: 'policy', label: 'Policies', icon: ScrollText }
	];

	const filteredItems = $derived(() => {
		const items = mockData[activeTab] || [];
		const query = searchQuery.toLowerCase();
		return items
			.filter(item => !excludeIds.includes(item.id))
			.filter(item => 
				!query || 
				item.label.toLowerCase().includes(query) || 
				item.number?.toLowerCase().includes(query)
			);
	});

	function handleSelect(entity: LinkedEntity) {
		onSelect(entity);
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
			<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
				<h3 class="font-semibold text-lg">Link Related Item</h3>
				<button
					type="button"
					class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={onCancel}
				>
					<X size={20} />
				</button>
			</div>

			<!-- Tabs -->
			<div class="flex border-b border-gray-200 dark:border-gray-700">
				{#each tabs as tab}
					<button
						type="button"
						class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === tab.type ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 hover:text-gray-700'}"
						onclick={() => { activeTab = tab.type; searchQuery = ''; }}
					>
						<tab.icon size={16} />
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- Search -->
			<div class="p-4 border-b border-gray-200 dark:border-gray-700">
				<div class="relative">
					<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
					<input
						type="text"
						placeholder="Search {tabs.find(t => t.type === activeTab)?.label.toLowerCase()}..."
						bind:value={searchQuery}
						class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:border-primary-500 focus:outline-none"
					/>
				</div>
			</div>

			<!-- Items List -->
			<div class="flex-1 overflow-y-auto p-2">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
					</div>
				{:else if filteredItems().length === 0}
					<div class="text-center py-8 text-gray-500">
						<p class="text-sm">No items found</p>
					</div>
				{:else}
					<div class="space-y-1">
						{#each filteredItems() as item (item.id)}
							<button
								type="button"
								class="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								onclick={() => handleSelect(item)}
							>
								<div class="flex items-center justify-between">
									<div>
										<p class="text-xs text-gray-500 font-mono">{item.number}</p>
										<p class="font-medium text-sm">{item.label}</p>
									</div>
									<Check size={16} class="text-gray-300" />
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-4 border-t border-gray-200 dark:border-gray-700">
				<Button color="alternative" class="w-full" onclick={onCancel}>
					Cancel
				</Button>
			</div>
		</div>
	</div>
{/if}
