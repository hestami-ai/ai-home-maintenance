<script lang="ts">
	import { ArrowLeft, TrendingDown, Search } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { accountingApi } from '$lib/api/cam';

	interface AgedReceivable {
		unitId: string;
		unitNumber: string;
		ownerName: string;
		current: number;
		days30: number;
		days60: number;
		days90: number;
		days90Plus: number;
		total: number;
	}

	interface ReceivablesSummary {
		totalOutstanding: number;
		current: number;
		days30: number;
		days60: number;
		days90: number;
		days90Plus: number;
		delinquentUnits: number;
	}

	let receivables = $state<AgedReceivable[]>([]);
	let summary = $state<ReceivablesSummary | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');

	async function loadReceivables() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await accountingApi.receivables.list({});
			if (response.ok && response.data) {
				receivables = response.data.receivables || [];
				summary = response.data.summary || null;
			}
		} catch (e) {
			console.error('Failed to load receivables:', e);
		} finally {
			isLoading = false;
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	$effect(() => {
		if ($currentAssociation?.id) {
			loadReceivables();
		}
	});
</script>

<svelte:head>
	<title>Receivables | Accounting | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/accounting')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Aged Receivables</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else}
			<div class="space-y-6">
				{#if summary}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card variant="outlined" padding="lg">
							<h3 class="text-sm font-medium text-surface-500">Total Outstanding</h3>
							<p class="mt-2 text-2xl font-bold">{formatCurrency(summary.totalOutstanding)}</p>
						</Card>
						<Card variant="outlined" padding="lg">
							<h3 class="text-sm font-medium text-surface-500">Current</h3>
							<p class="mt-2 text-2xl font-bold text-success-500">{formatCurrency(summary.current)}</p>
						</Card>
						<Card variant="outlined" padding="lg">
							<h3 class="text-sm font-medium text-surface-500">30-60 Days</h3>
							<p class="mt-2 text-2xl font-bold text-warning-500">{formatCurrency(summary.days30 + summary.days60)}</p>
						</Card>
						<Card variant="outlined" padding="lg">
							<h3 class="text-sm font-medium text-surface-500">90+ Days</h3>
							<p class="mt-2 text-2xl font-bold text-error-500">{formatCurrency(summary.days90 + summary.days90Plus)}</p>
						</Card>
					</div>
				{/if}

				<Card variant="outlined" padding="lg">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-semibold">Aged Receivables by Unit</h3>
						<div class="relative">
							<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
							<input
								type="text"
								placeholder="Search..."
								bind:value={searchQuery}
								oninput={() => loadReceivables()}
								class="rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
							/>
						</div>
					</div>

					{#if receivables.length === 0}
						<EmptyState
							title="No outstanding receivables"
							description="All accounts are current."
						/>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-surface-300-700 text-left">
										<th class="pb-3 font-medium">Unit</th>
										<th class="pb-3 font-medium">Owner</th>
										<th class="pb-3 text-right font-medium">Current</th>
										<th class="pb-3 text-right font-medium">30 Days</th>
										<th class="pb-3 text-right font-medium">60 Days</th>
										<th class="pb-3 text-right font-medium">90 Days</th>
										<th class="pb-3 text-right font-medium">90+ Days</th>
										<th class="pb-3 text-right font-medium">Total</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-surface-300-700">
									{#each receivables as item}
										<tr class="hover:bg-surface-200-800">
											<td class="py-3">
												<a href="/app/cam/units/{item.unitId}" class="text-primary-500 hover:underline">
													{item.unitNumber}
												</a>
											</td>
											<td class="py-3">{item.ownerName}</td>
											<td class="py-3 text-right">{formatCurrency(item.current)}</td>
											<td class="py-3 text-right {item.days30 > 0 ? 'text-warning-500' : ''}">{formatCurrency(item.days30)}</td>
											<td class="py-3 text-right {item.days60 > 0 ? 'text-warning-600' : ''}">{formatCurrency(item.days60)}</td>
											<td class="py-3 text-right {item.days90 > 0 ? 'text-error-500' : ''}">{formatCurrency(item.days90)}</td>
											<td class="py-3 text-right {item.days90Plus > 0 ? 'text-error-600 font-medium' : ''}">{formatCurrency(item.days90Plus)}</td>
											<td class="py-3 text-right font-medium">{formatCurrency(item.total)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</Card>
			</div>
		{/if}
	</div>
</div>
