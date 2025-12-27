<script lang="ts">
	import { ArrowLeft, Loader2 } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import { orpc } from '$lib/api';
	import { v4 as uuidv4 } from 'uuid';

	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let employeeId = $state('');
	let hireDate = $state('');
	let timezone = $state('America/New_York');

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	const timezones = [
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'America/Phoenix',
		'America/Anchorage',
		'Pacific/Honolulu'
	];

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		isSubmitting = true;

		try {
			const response = await orpc.technician.upsert({
				firstName,
				lastName,
				email: email || undefined,
				phone: phone || undefined,
				employeeId: employeeId || undefined,
				hireDate: hireDate || undefined,
				timezone,
				isActive: true,
				idempotencyKey: uuidv4()
			});

			if (!response.ok) {
				error = 'Failed to create technician. Please try again.';
				return;
			}
			goto(`/app/contractor/technicians/${response.data.technician.id}`);
		} catch (err) {
			console.error('Failed to create technician:', err);
			error = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Add Technician | Contractor | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="2xl">
	<div class="py-6">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/contractor/technicians')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div>
				<h1 class="text-2xl font-bold">Add Technician</h1>
				<p class="mt-1 text-surface-500">Create a new technician profile</p>
			</div>
		</div>

		<form onsubmit={handleSubmit} class="mt-8">
			<Card variant="outlined" padding="lg">
				{#if error}
					<div class="mb-6 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{error}
					</div>
				{/if}

				<div class="space-y-6">
					<div class="grid gap-6 sm:grid-cols-2">
						<div>
							<label for="firstName" class="block text-sm font-medium">
								First Name <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="firstName"
								bind:value={firstName}
								required
								class="input mt-1 w-full"
								placeholder="John"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label for="lastName" class="block text-sm font-medium">
								Last Name <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="lastName"
								bind:value={lastName}
								required
								class="input mt-1 w-full"
								placeholder="Smith"
								disabled={isSubmitting}
							/>
						</div>
					</div>

					<div class="grid gap-6 sm:grid-cols-2">
						<div>
							<label for="email" class="block text-sm font-medium">Email</label>
							<input
								type="email"
								id="email"
								bind:value={email}
								class="input mt-1 w-full"
								placeholder="john.smith@example.com"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label for="phone" class="block text-sm font-medium">Phone</label>
							<input
								type="tel"
								id="phone"
								bind:value={phone}
								class="input mt-1 w-full"
								placeholder="(555) 123-4567"
								disabled={isSubmitting}
							/>
						</div>
					</div>

					<div class="grid gap-6 sm:grid-cols-2">
						<div>
							<label for="employeeId" class="block text-sm font-medium">Employee ID</label>
							<input
								type="text"
								id="employeeId"
								bind:value={employeeId}
								class="input mt-1 w-full"
								placeholder="EMP-001"
								disabled={isSubmitting}
							/>
							<p class="mt-1 text-xs text-surface-400">Optional internal identifier</p>
						</div>

						<div>
							<label for="hireDate" class="block text-sm font-medium">Hire Date</label>
							<input
								type="date"
								id="hireDate"
								bind:value={hireDate}
								class="input mt-1 w-full"
								disabled={isSubmitting}
							/>
						</div>
					</div>

					<div>
						<label for="timezone" class="block text-sm font-medium">Timezone</label>
						<select
							id="timezone"
							bind:value={timezone}
							class="select mt-1 w-full"
							disabled={isSubmitting}
						>
							{#each timezones as tz}
								<option value={tz}>{tz.replace(/_/g, ' ')}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="mt-8 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => goto('/app/contractor/technicians')}
						class="btn preset-tonal-surface"
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button type="submit" class="btn preset-filled-primary-500" disabled={isSubmitting}>
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Creating...
						{:else}
							Create Technician
						{/if}
					</button>
				</div>
			</Card>
		</form>
	</div>
</PageContainer>
