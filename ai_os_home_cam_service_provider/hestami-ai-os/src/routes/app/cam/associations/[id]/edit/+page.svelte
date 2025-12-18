<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface Association {
		id: string;
		name: string;
		legalName?: string;
		status: string;
		fiscalYearEnd: number;
		address?: string;
		phone?: string;
		email?: string;
		website?: string;
		taxId?: string;
	}

	let association = $state<Association | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		legalName: '',
		status: 'ACTIVE',
		fiscalYearEnd: '12',
		address: '',
		phone: '',
		email: '',
		website: '',
		taxId: ''
	});

	const statusOptions = [
		{ value: 'ACTIVE', label: 'Active' },
		{ value: 'INACTIVE', label: 'Inactive' },
		{ value: 'PENDING', label: 'Pending' }
	];

	const monthOptions = [
		{ value: '1', label: 'January' },
		{ value: '2', label: 'February' },
		{ value: '3', label: 'March' },
		{ value: '4', label: 'April' },
		{ value: '5', label: 'May' },
		{ value: '6', label: 'June' },
		{ value: '7', label: 'July' },
		{ value: '8', label: 'August' },
		{ value: '9', label: 'September' },
		{ value: '10', label: 'October' },
		{ value: '11', label: 'November' },
		{ value: '12', label: 'December' }
	];

	const associationId = $derived(($page.params as Record<string, string>).id);

	async function loadData() {
		if (!associationId) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/association/${associationId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data) {
					association = data.data;
					formData = {
						name: data.data.name || '',
						legalName: data.data.legalName || '',
						status: data.data.status || 'ACTIVE',
						fiscalYearEnd: data.data.fiscalYearEnd?.toString() || '12',
						address: data.data.address || '',
						phone: data.data.phone || '',
						email: data.data.email || '',
						website: data.data.website || '',
						taxId: data.data.taxId || ''
					};
				} else {
					error = 'Association not found';
				}
			} else {
				error = 'Failed to load association';
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

		if (!association) return;

		if (!formData.name) {
			error = 'Please fill in all required fields';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await fetch(`/api/association/${association.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formData.name,
					legalName: formData.legalName || undefined,
					status: formData.status,
					fiscalYearEnd: parseInt(formData.fiscalYearEnd),
					address: formData.address || undefined,
					phone: formData.phone || undefined,
					email: formData.email || undefined,
					website: formData.website || undefined,
					taxId: formData.taxId || undefined
				})
			});

			if (response.ok) {
				goto(`/app/cam/associations/${association.id}`);
			} else {
				const data = await response.json();
				error = data.error?.message || 'Failed to update association';
			}
		} catch (e) {
			error = 'Failed to update association';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (associationId) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Edit Association | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/associations/${associationId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Edit Association</h1>
				{#if association}
					<p class="mt-0.5 text-sm text-surface-500">{association.name}</p>
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
			{:else if error && !association}
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
						<h3 class="mb-4 font-semibold">Basic Information</h3>
						<div class="space-y-4">
							<div>
								<label for="name" class="mb-1 block text-sm font-medium">
									Name <span class="text-error-500">*</span>
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
								<label for="legalName" class="mb-1 block text-sm font-medium">
									Legal Name
								</label>
								<input
									id="legalName"
									type="text"
									bind:value={formData.legalName}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
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

								<div>
									<label for="fiscalYearEnd" class="mb-1 block text-sm font-medium">
										Fiscal Year End
									</label>
									<select
										id="fiscalYearEnd"
										bind:value={formData.fiscalYearEnd}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each monthOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
							</div>

							<div>
								<label for="taxId" class="mb-1 block text-sm font-medium">
									Tax ID / EIN
								</label>
								<input
									id="taxId"
									type="text"
									bind:value={formData.taxId}
									placeholder="XX-XXXXXXX"
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Contact Information</h3>
						<div class="space-y-4">
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

							<div class="grid gap-4 sm:grid-cols-2">
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
							</div>

							<div>
								<label for="website" class="mb-1 block text-sm font-medium">
									Website
								</label>
								<input
									id="website"
									type="url"
									bind:value={formData.website}
									placeholder="https://"
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/associations/${associationId}`)}
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
