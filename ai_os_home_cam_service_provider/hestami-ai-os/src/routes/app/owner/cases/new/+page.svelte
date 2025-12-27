<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Send, Paperclip } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { conciergeCaseApi, type ConciergeCasePriority } from '$lib/api/cam';
	import { organizationStore } from '$lib/stores';

	let title = $state('');
	let description = $state('');
	let priority = $state<ConciergeCasePriority>('NORMAL');
	let propertyId = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	const priorityOptions: { value: ConciergeCasePriority; label: string; description: string }[] = [
		{ value: 'LOW', label: 'Low', description: 'Non-urgent, can wait' },
		{ value: 'NORMAL', label: 'Normal', description: 'Standard priority' },
		{ value: 'HIGH', label: 'High', description: 'Needs attention soon' },
		{ value: 'URGENT', label: 'Urgent', description: 'Requires prompt action' },
		{ value: 'EMERGENCY', label: 'Emergency', description: 'Immediate attention required' }
	];

	function generateIdempotencyKey(): string {
		return `case-create-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!title.trim()) {
			error = 'Please enter a title for your request';
			return;
		}

		if (!description.trim()) {
			error = 'Please describe your request';
			return;
		}

		if (!propertyId) {
			error = 'Please select a property';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await conciergeCaseApi.create({
				propertyId,
				title: title.trim(),
				description: description.trim(),
				priority,
				idempotencyKey: generateIdempotencyKey()
			});

			if (!response.ok) {
				error = 'Failed to create request. Please try again.';
				return;
			}
			goto(`/app/owner/cases/${response.data.case.id}`);
		} catch (err) {
			console.error('Failed to create case:', err);
			error = 'An error occurred. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Request | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/owner/cases"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Cases
			</a>
		</div>

		<div class="mx-auto max-w-2xl">
			<h1 class="text-2xl font-bold">Create New Request</h1>
			<p class="mt-2 text-surface-500">
				Describe what you need help with and our concierge team will assist you.
			</p>

			<form onsubmit={handleSubmit} class="mt-8 space-y-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
						{error}
					</div>
				{/if}

				<!-- Property Selection -->
				<div>
					<label for="property" class="block text-sm font-medium">
						Property <span class="text-error-500">*</span>
					</label>
					<select id="property" bind:value={propertyId} class="select mt-1 w-full" required>
						<option value="">Select a property</option>
						<!-- TODO: Load properties from API -->
						<option value="placeholder-property-id">My Property (123 Main St)</option>
					</select>
					<p class="mt-1 text-sm text-surface-500">
						Select the property this request is related to
					</p>
				</div>

				<!-- Title -->
				<div>
					<label for="title" class="block text-sm font-medium">
						Title <span class="text-error-500">*</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={title}
						placeholder="Brief summary of your request"
						class="input mt-1 w-full"
						required
						maxlength="200"
					/>
					<p class="mt-1 text-sm text-surface-500">
						{title.length}/200 characters
					</p>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="block text-sm font-medium">
						Description <span class="text-error-500">*</span>
					</label>
					<textarea
						id="description"
						bind:value={description}
						placeholder="Please provide details about your request. Include any relevant information that will help us assist you better."
						class="textarea mt-1 w-full"
						rows="6"
						required
					></textarea>
					<p class="mt-1 text-sm text-surface-500">
						Be as specific as possible to help us understand your needs
					</p>
				</div>

				<!-- Priority -->
				<div>
					<span class="block text-sm font-medium">Priority</span>
					<div class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each priorityOptions as option}
							<label
								class="relative flex cursor-pointer rounded-lg border p-4 transition-colors {priority ===
								option.value
									? 'border-primary-500 bg-primary-500/5'
									: 'border-surface-300-700 hover:bg-surface-100-900'}"
							>
								<input
									type="radio"
									name="priority"
									value={option.value}
									bind:group={priority}
									class="sr-only"
								/>
								<div>
									<p class="font-medium">{option.label}</p>
									<p class="text-sm text-surface-500">{option.description}</p>
								</div>
								{#if priority === option.value}
									<div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary-500"></div>
								{/if}
							</label>
						{/each}
					</div>
				</div>

				<!-- Attachments (placeholder) -->
				<Card variant="outlined" padding="md">
					<div class="flex items-center gap-3">
						<Paperclip class="h-5 w-5 text-surface-500" />
						<div>
							<p class="font-medium">Attachments</p>
							<p class="text-sm text-surface-500">
								File upload coming soon. You can add attachments after creating the request.
							</p>
						</div>
					</div>
				</Card>

				<!-- Submit -->
				<div class="flex items-center justify-end gap-4 border-t border-surface-300-700 pt-6">
					<a href="/app/owner/cases" class="btn preset-outlined-surface-500">
						Cancel
					</a>
					<button type="submit" class="btn preset-filled-primary-500" disabled={isSubmitting}>
						{#if isSubmitting}
							<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
							Creating...
						{:else}
							<Send class="mr-2 h-4 w-4" />
							Submit Request
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
</PageContainer>
