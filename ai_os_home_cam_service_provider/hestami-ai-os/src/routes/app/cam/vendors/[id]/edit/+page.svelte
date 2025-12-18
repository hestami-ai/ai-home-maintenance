<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save, Plus, X } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface Vendor {
		id: string;
		name: string;
		contactName?: string;
		email?: string;
		phone?: string;
		address?: string;
		licenseNumber?: string;
		insuranceExpiry?: string;
		trades: string[];
		status: string;
	}

	let vendor = $state<Vendor | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		contactName: '',
		email: '',
		phone: '',
		address: '',
		licenseNumber: '',
		insuranceExpiry: '',
		trades: [] as string[],
		status: 'PENDING'
	});

	let newTrade = $state('');

	const tradeOptions = [
		'Plumbing',
		'Electrical',
		'HVAC',
		'Landscaping',
		'Roofing',
		'Painting',
		'Flooring',
		'General Maintenance',
		'Pool Service',
		'Pest Control',
		'Security',
		'Cleaning',
		'Other'
	];

	const statusOptions = [
		{ value: 'PENDING', label: 'Pending Approval' },
		{ value: 'APPROVED', label: 'Approved' },
		{ value: 'SUSPENDED', label: 'Suspended' },
		{ value: 'INACTIVE', label: 'Inactive' }
	];

	const vendorId = $derived(($page.params as Record<string, string>).id);

	function addTrade() {
		if (newTrade && !formData.trades.includes(newTrade)) {
			formData.trades = [...formData.trades, newTrade];
			newTrade = '';
		}
	}

	function removeTrade(trade: string) {
		formData.trades = formData.trades.filter(t => t !== trade);
	}

	async function loadData() {
		if (!vendorId) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/vendor/${vendorId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data) {
					vendor = data.data;
					formData = {
						name: data.data.name || '',
						contactName: data.data.contactName || '',
						email: data.data.email || '',
						phone: data.data.phone || '',
						address: data.data.address || '',
						licenseNumber: data.data.licenseNumber || '',
						insuranceExpiry: data.data.insuranceExpiry?.split('T')[0] || '',
						trades: data.data.trades || [],
						status: data.data.status || 'PENDING'
					};
				} else {
					error = 'Vendor not found';
				}
			} else {
				error = 'Failed to load vendor';
			}
		} catch (e) {
			error = 'Failed to load data';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!vendor) return;

		if (!formData.name) {
			error = 'Please enter a vendor name';
			return;
		}

		if (formData.trades.length === 0) {
			error = 'Please select at least one trade';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await fetch(`/api/vendor/${vendor.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formData.name,
					contactName: formData.contactName || undefined,
					email: formData.email || undefined,
					phone: formData.phone || undefined,
					address: formData.address || undefined,
					licenseNumber: formData.licenseNumber || undefined,
					insuranceExpiry: formData.insuranceExpiry || undefined,
					trades: formData.trades,
					status: formData.status
				})
			});

			if (response.ok) {
				goto(`/app/cam/vendors/${vendor.id}`);
			} else {
				const data = await response.json();
				error = data.error?.message || 'Failed to update vendor';
			}
		} catch (e) {
			error = 'Failed to update vendor';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (vendorId) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Edit Vendor | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/vendors/${vendorId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Edit Vendor</h1>
				{#if vendor}
					<p class="mt-0.5 text-sm text-surface-500">{vendor.name}</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl">
			{#if isLoading}
				<div class="flex h-64 items-center justify-center">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
				</div>
			{:else if error && !vendor}
				<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
					{error}
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					{#if error}
						<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
							{error}
						</div>
					{/if}

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Business Information</h3>
						<div class="space-y-4">
							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="name" class="mb-1 block text-sm font-medium">
										Business Name <span class="text-error-500">*</span>
									</label>
									<input
										id="name"
										type="text"
										bind:value={formData.name}
										required
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>

								<div>
									<label for="status" class="mb-1 block text-sm font-medium">
										Status
									</label>
									<select
										id="status"
										bind:value={formData.status}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each statusOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
							</div>

							<div>
								<label for="contactName" class="mb-1 block text-sm font-medium">
									Contact Name
								</label>
								<input
									id="contactName"
									type="text"
									bind:value={formData.contactName}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="email" class="mb-1 block text-sm font-medium">
										Email
									</label>
									<input
										id="email"
										type="email"
										bind:value={formData.email}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>

								<div>
									<label for="phone" class="mb-1 block text-sm font-medium">
										Phone
									</label>
									<input
										id="phone"
										type="tel"
										bind:value={formData.phone}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							</div>

							<div>
								<label for="address" class="mb-1 block text-sm font-medium">
									Address
								</label>
								<textarea
									id="address"
									bind:value={formData.address}
									rows={2}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								></textarea>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Trades & Services <span class="text-error-500">*</span></h3>
						<div class="space-y-4">
							<div class="flex gap-2">
								<select
									bind:value={newTrade}
									class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									<option value="">Select a trade</option>
									{#each tradeOptions.filter(t => !formData.trades.includes(t)) as trade}
										<option value={trade}>{trade}</option>
									{/each}
								</select>
								<button
									type="button"
									onclick={addTrade}
									disabled={!newTrade}
									class="btn preset-filled-primary-500"
								>
									<Plus class="h-4 w-4" />
								</button>
							</div>

							{#if formData.trades.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each formData.trades as trade}
										<span class="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-3 py-1 text-sm text-primary-500">
											{trade}
											<button
												type="button"
												onclick={() => removeTrade(trade)}
												class="ml-1 rounded-full p-0.5 hover:bg-primary-500/20"
											>
												<X class="h-3 w-3" />
											</button>
										</span>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-surface-500">No trades selected</p>
							{/if}
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Licensing & Insurance</h3>
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="licenseNumber" class="mb-1 block text-sm font-medium">
									License Number
								</label>
								<input
									id="licenseNumber"
									type="text"
									bind:value={formData.licenseNumber}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div>
								<label for="insuranceExpiry" class="mb-1 block text-sm font-medium">
									Insurance Expiry Date
								</label>
								<input
									id="insuranceExpiry"
									type="date"
									bind:value={formData.insuranceExpiry}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/vendors/${vendorId}`)}
							class="btn preset-tonal-surface"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSaving}
							class="btn preset-filled-primary-500"
						>
							{#if isSaving}
								<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
							{:else}
								<Save class="mr-2 h-4 w-4" />
							{/if}
							Save Changes
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
