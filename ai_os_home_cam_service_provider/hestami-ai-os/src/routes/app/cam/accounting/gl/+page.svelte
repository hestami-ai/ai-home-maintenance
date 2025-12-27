<script lang="ts">
	import { ArrowLeft, BookOpen, Search, Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { accountingApi } from '$lib/api/cam';

	interface GLAccount {
		id: string;
		accountNumber: string;
		name: string;
		type: string;
		balance: number;
		isActive: boolean;
	}

	interface JournalEntry {
		id: string;
		entryNumber: string;
		date: string;
		description: string;
		debitTotal: number;
		creditTotal: number;
		status: string;
		createdBy: string;
	}

	let accounts = $state<GLAccount[]>([]);
	let journalEntries = $state<JournalEntry[]>([]);
	let isLoading = $state(true);
	let activeTab = $state<'chart' | 'journal'>('chart');
	let searchQuery = $state('');

	async function loadData() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const [accountsRes, journalRes] = await Promise.all([
				accountingApi.glAccounts.list({}),
				accountingApi.journalEntries.list({})
			]);

			if (accountsRes.ok && accountsRes.data?.accounts) {
				accounts = accountsRes.data.accounts as any;
			}

			if (journalRes.ok && journalRes.data?.entries) {
				journalEntries = journalRes.data.entries as any;
			}
		} catch (e) {
			console.error('Failed to load GL data:', e);
		} finally {
			isLoading = false;
		}
	}

	function getTypeColor(type: string): string {
		switch (type) {
			case 'ASSET': return 'text-primary-500 bg-primary-500/10';
			case 'LIABILITY': return 'text-error-500 bg-error-500/10';
			case 'EQUITY': return 'text-success-500 bg-success-500/10';
			case 'REVENUE': return 'text-success-600 bg-success-500/20';
			case 'EXPENSE': return 'text-warning-500 bg-warning-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'POSTED': return 'text-success-500 bg-success-500/10';
			case 'DRAFT': return 'text-warning-500 bg-warning-500/10';
			case 'VOIDED': return 'text-error-500 bg-error-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const filteredAccounts = $derived(
		accounts.filter(a =>
			a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			a.accountNumber.includes(searchQuery)
		)
	);

	const accountsByType = $derived({
		ASSET: filteredAccounts.filter(a => a.type === 'ASSET'),
		LIABILITY: filteredAccounts.filter(a => a.type === 'LIABILITY'),
		EQUITY: filteredAccounts.filter(a => a.type === 'EQUITY'),
		REVENUE: filteredAccounts.filter(a => a.type === 'REVENUE'),
		EXPENSE: filteredAccounts.filter(a => a.type === 'EXPENSE')
	});

	$effect(() => {
		if ($currentAssociation?.id) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>General Ledger | Accounting | CAM | Hestami AI</title>
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
				<h1 class="text-xl font-semibold">General Ledger</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
			<button class="btn btn-sm preset-filled-primary-500">
				<Plus class="mr-1 h-4 w-4" />
				New Entry
			</button>
		</div>
	</div>

	<div class="border-b border-surface-300-700">
		<div class="flex gap-1 px-6">
			<button
				type="button"
				onclick={() => activeTab = 'chart'}
				class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'chart' ? 'border-primary-500 text-primary-500' : 'border-transparent text-surface-500 hover:text-surface-700'}"
			>
				Chart of Accounts
			</button>
			<button
				type="button"
				onclick={() => activeTab = 'journal'}
				class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'journal' ? 'border-primary-500 text-primary-500' : 'border-transparent text-surface-500 hover:text-surface-700'}"
			>
				Journal Entries
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if activeTab === 'chart'}
			<div class="space-y-6">
				<div class="flex items-center gap-4">
					<div class="relative flex-1 max-w-md">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search accounts..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
						/>
					</div>
				</div>

				{#each Object.entries(accountsByType) as [type, typeAccounts]}
					{#if typeAccounts.length > 0}
						<Card variant="outlined" padding="lg">
							<h3 class="mb-4 font-semibold">{type}</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-sm">
									<thead>
										<tr class="border-b border-surface-300-700 text-left">
											<th class="pb-3 font-medium">Account #</th>
											<th class="pb-3 font-medium">Name</th>
											<th class="pb-3 text-right font-medium">Balance</th>
											<th class="pb-3 text-center font-medium">Status</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-surface-300-700">
										{#each typeAccounts as account}
											<tr class="hover:bg-surface-200-800">
												<td class="py-3 font-mono">{account.accountNumber}</td>
												<td class="py-3">{account.name}</td>
												<td class="py-3 text-right font-medium">{formatCurrency(account.balance)}</td>
												<td class="py-3 text-center">
													<span class="rounded-full px-2 py-0.5 text-xs {account.isActive ? 'text-success-500 bg-success-500/10' : 'text-surface-500 bg-surface-500/10'}">
														{account.isActive ? 'Active' : 'Inactive'}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</Card>
					{/if}
				{/each}

				{#if filteredAccounts.length === 0}
					<EmptyState
						title="No accounts found"
						description={searchQuery ? 'Try a different search term.' : 'Chart of accounts will appear here.'}
					/>
				{/if}
			</div>
		{:else}
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Recent Journal Entries</h3>

				{#if journalEntries.length === 0}
					<EmptyState
						title="No journal entries"
						description="Journal entries will appear here."
					/>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-surface-300-700 text-left">
									<th class="pb-3 font-medium">Entry #</th>
									<th class="pb-3 font-medium">Date</th>
									<th class="pb-3 font-medium">Description</th>
									<th class="pb-3 text-right font-medium">Debit</th>
									<th class="pb-3 text-right font-medium">Credit</th>
									<th class="pb-3 text-center font-medium">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-300-700">
								{#each journalEntries as entry}
									<tr class="hover:bg-surface-200-800">
										<td class="py-3 font-mono">{entry.entryNumber}</td>
										<td class="py-3">{formatDate(entry.date)}</td>
										<td class="py-3">{entry.description}</td>
										<td class="py-3 text-right">{formatCurrency(entry.debitTotal)}</td>
										<td class="py-3 text-right">{formatCurrency(entry.creditTotal)}</td>
										<td class="py-3 text-center">
											<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(entry.status)}">
												{entry.status}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Card>
		{/if}
	</div>
</div>
