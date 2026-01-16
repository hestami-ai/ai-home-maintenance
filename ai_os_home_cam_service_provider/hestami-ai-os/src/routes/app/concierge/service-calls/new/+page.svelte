<script lang="ts">
	import {
		ArrowLeft,
		Loader2,
		Check,
		Home,
		Droplets,
		Zap,
		Wind,
		Hammer,
		Bug,
		Leaf,
		Shield,
		Wrench,
		AlertTriangle,
		Calendar,
		Clock,
		Plus,
		X
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		SERVICE_CALL_CATEGORY_LABELS,
		SERVICE_CALL_CATEGORY_DESCRIPTIONS,
		SERVICE_CALL_URGENCY_LABELS,
		SERVICE_CALL_URGENCY_DESCRIPTIONS,
		SERVICE_CALL_URGENCY_COLORS,
		urgencyToPriority,
		type ServiceCallCategory,
		type ServiceCallUrgency
	} from '$lib/utils/serviceCallTerminology';
	import ServiceCallMediaUpload from '$lib/components/concierge/ServiceCallMediaUpload.svelte';

	type AvailabilityType = 'FLEXIBLE' | 'SPECIFIC';

	interface AvailabilitySlot {
		id: string;
		date: string;
		startTime: string;
		endTime: string;
		notes?: string;
	}

	interface Property {
		id: string;
		name: string;
		addressLine1: string;
		city: string;
		state: string;
		postalCode: string;
	}

	interface Organization {
		id: string;
		name: string;
		slug: string;
		type: string;
		status: string;
	}

	interface Props {
		data: {
			properties: Property[];
			organization: Organization | null;
		};
	}

	let { data }: Props = $props();

	let isSubmitting = $state(false);
	let isUploadingMedia = $state(false);
	let isLoadingProperties = $state(false);
	let error = $state<string | null>(null);
	let properties = $derived(data.properties);

	// Reference to media upload component
	let mediaUploadComponent: ServiceCallMediaUpload | undefined = $state();

	// Form state
	let selectedPropertyId = $state('');
	let category = $state<ServiceCallCategory>('GENERAL_REPAIRS');
	let urgency = $state<ServiceCallUrgency>('ROUTINE');
	let title = $state('');
	let description = $state('');

	// Availability state
	let availabilityType = $state<AvailabilityType>('FLEXIBLE');
	let availabilityNotes = $state('');
	let availabilitySlots = $state<AvailabilitySlot[]>([]);

	// Get pre-selected values from URL
	const urlPropertyId = $page.url.searchParams.get('propertyId');
	const urlCategory = $page.url.searchParams.get('category');

	const categoryIcons: Record<ServiceCallCategory, typeof Wrench> = {
		PLUMBING: Droplets,
		ELECTRICAL: Zap,
		HVAC: Wind,
		GENERAL_REPAIRS: Hammer,
		PEST_CONTROL: Bug,
		LANDSCAPING: Leaf,
		SECURITY: Shield,
		ROOFING: Home,
		APPLIANCES: Wrench,
		OTHER: Wrench
	};

	const categories: ServiceCallCategory[] = [
		'PLUMBING',
		'ELECTRICAL',
		'HVAC',
		'GENERAL_REPAIRS',
		'PEST_CONTROL',
		'LANDSCAPING',
		'SECURITY',
		'ROOFING',
		'APPLIANCES',
		'OTHER'
	];

	const urgencies: ServiceCallUrgency[] = ['ROUTINE', 'SOON', 'URGENT', 'EMERGENCY'];

	const isValid = $derived(
		selectedPropertyId !== '' &&
			title.trim() !== '' &&
			description.trim().length >= 10 &&
			(availabilityType === 'FLEXIBLE' || availabilitySlots.length > 0)
	);

	// Helper to add a new availability slot
	function addAvailabilitySlot() {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const dateStr = tomorrow.toISOString().split('T')[0];

		availabilitySlots = [
			...availabilitySlots,
			{
				id: crypto.randomUUID(),
				date: dateStr,
				startTime: '09:00',
				endTime: '17:00'
			}
		];
	}

	// Helper to remove an availability slot
	function removeAvailabilitySlot(id: string) {
		availabilitySlots = availabilitySlots.filter((s) => s.id !== id);
	}

	// Convert local date/time to ISO datetime string
	function toISODateTime(date: string, time: string): string {
		return new Date(`${date}T${time}:00`).toISOString();
	}

	// Synchronize pre-selected values from URL
	$effect(() => {
		if (urlPropertyId) {
			selectedPropertyId = urlPropertyId;
		}
		if (urlCategory) {
			const upperCategory = urlCategory.toUpperCase() as ServiceCallCategory;
			if (categories.includes(upperCategory)) {
				category = upperCategory;
			}
		}

		// If only one property, auto-select it
		if (properties.length === 1 && !urlPropertyId && !selectedPropertyId) {
			selectedPropertyId = properties[0].id;
		}
	});


	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!isValid || isSubmitting) return;

		isSubmitting = true;
		error = null;

		try {
			// Prepare availability slots for API
			const slotsForApi =
				availabilityType === 'SPECIFIC'
					? availabilitySlots.map((slot) => ({
							startTime: toISODateTime(slot.date, slot.startTime),
							endTime: toISODateTime(slot.date, slot.endTime),
							notes: slot.notes
						}))
					: undefined;

			// Create the concierge case (service call)
			const result = await orpc.conciergeCase.create({
				idempotencyKey: crypto.randomUUID(),
				propertyId: selectedPropertyId,
				title: title.trim(),
				description: `**Category:** ${SERVICE_CALL_CATEGORY_LABELS[category]}\n**Urgency:** ${SERVICE_CALL_URGENCY_LABELS[urgency]}\n\n${description.trim()}`,
				priority: urgencyToPriority(urgency),
				availabilityType,
				availabilityNotes: availabilityNotes.trim() || undefined,
				availabilitySlots: slotsForApi
			});

			const caseId = result.data.case.id;

			// Upload media files if any are selected
			if (mediaUploadComponent?.hasPendingFiles()) {
				isUploadingMedia = true;
				const uploadResult = await mediaUploadComponent.uploadFilesForCase(caseId);

				if (!uploadResult.success) {
					// Some uploads failed, but case was created - continue to detail page
					console.warn('Some media uploads failed:', uploadResult);
				}
				isUploadingMedia = false;
			}

			// Redirect to the service call detail page
			goto(`/app/concierge/service-calls/${caseId}`);
		} catch (err) {
			console.error('Failed to create service call:', err);
			error = err instanceof Error ? err.message : 'Failed to create service call';
			isSubmitting = false;
			isUploadingMedia = false;
		}
	}

	const selectedProperty = $derived(properties.find((p) => p.id === selectedPropertyId));
</script>

<svelte:head>
	<title>New Service Call | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/concierge/service-calls"
				class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back
			</a>
			<h1 class="text-2xl font-bold">New Service Call</h1>
			<p class="mt-1 text-surface-500">Tell us about the issue you're experiencing</p>
		</div>

		{#if error}
			<div class="mb-6 rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit}>
			<div class="space-y-6">
				<!-- Property Selection -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Property</h2>
					{#if isLoadingProperties}
						<div class="flex items-center gap-2 text-surface-500">
							<Loader2 class="h-4 w-4 animate-spin" />
							Loading properties...
						</div>
					{:else if properties.length === 0}
						<div class="rounded-lg bg-warning-500/10 p-4">
							<p class="font-medium text-warning-600 dark:text-warning-400">No properties found</p>
							<p class="mt-1 text-sm text-surface-500">
								You need to add a property before creating a service call.
							</p>
							<a href="/app/concierge/properties/new" class="btn preset-filled-primary-500 mt-3">
								Add Property
							</a>
						</div>
					{:else}
						<select
							id="property"
							bind:value={selectedPropertyId}
							class="select w-full"
							required
						>
							<option value="">Select a property</option>
							{#each properties as prop}
								<option value={prop.id}>
									{prop.name} - {prop.addressLine1}, {prop.city}, {prop.state}
								</option>
							{/each}
						</select>
						{#if selectedProperty}
							<p class="mt-2 text-sm text-surface-500">
								{selectedProperty.addressLine1}, {selectedProperty.city}, {selectedProperty.state}{' '}
								{selectedProperty.postalCode}
							</p>
						{/if}
					{/if}
				</Card>

				<!-- Category Selection -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Service Category</h2>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{#each categories as cat}
							{@const Icon = categoryIcons[cat]}
							<button
								type="button"
								onclick={() => (category = cat)}
								class="rounded-lg border p-3 text-left transition-all {category === cat
									? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
									: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
							>
								<div class="flex items-center gap-2">
									<Icon
										class="h-5 w-5 {category === cat ? 'text-primary-500' : 'text-surface-500'}"
									/>
									<span class="text-sm font-medium">{SERVICE_CALL_CATEGORY_LABELS[cat]}</span>
								</div>
							</button>
						{/each}
					</div>
					<p class="mt-3 text-sm text-surface-500">{SERVICE_CALL_CATEGORY_DESCRIPTIONS[category]}</p>
				</Card>

				<!-- Urgency Selection -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">How urgent is this?</h2>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{#each urgencies as urg}
							<button
								type="button"
								onclick={() => (urgency = urg)}
								class="rounded-lg border p-4 text-left transition-all {urgency === urg
									? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
									: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
							>
								<p class="font-medium {SERVICE_CALL_URGENCY_COLORS[urg]}">
									{SERVICE_CALL_URGENCY_LABELS[urg]}
								</p>
								<p class="mt-1 text-sm text-surface-500">{SERVICE_CALL_URGENCY_DESCRIPTIONS[urg]}</p>
							</button>
						{/each}
					</div>
					{#if urgency === 'EMERGENCY'}
						<div class="mt-4 flex items-start gap-3 rounded-lg bg-error-500/10 p-4">
							<AlertTriangle class="h-5 w-5 shrink-0 text-error-500" />
							<div>
								<p class="font-medium text-error-600 dark:text-error-400">Emergency Service</p>
								<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">
									If there's immediate danger to life or property (gas leak, flooding, fire damage),
									please also call emergency services (911).
								</p>
							</div>
						</div>
					{/if}
				</Card>

				<!-- Availability Section -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Your Availability</h2>
					<p class="mb-4 text-sm text-surface-500">
						When can a service provider visit your property?
					</p>

					<div class="grid gap-3 sm:grid-cols-2">
						<button
							type="button"
							onclick={() => {
								availabilityType = 'FLEXIBLE';
								availabilitySlots = [];
							}}
							class="rounded-lg border p-4 text-left transition-all {availabilityType === 'FLEXIBLE'
								? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
								: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
						>
							<div class="flex items-center gap-2">
								<Clock
									class="h-5 w-5 {availabilityType === 'FLEXIBLE'
										? 'text-primary-500'
										: 'text-surface-500'}"
								/>
								<span class="font-medium">Flexible / ASAP</span>
							</div>
							<p class="mt-2 text-sm text-surface-500">
								I'm flexible with scheduling. Contact me to arrange a convenient time.
							</p>
						</button>

						<button
							type="button"
							onclick={() => {
								availabilityType = 'SPECIFIC';
								if (availabilitySlots.length === 0) {
									addAvailabilitySlot();
								}
							}}
							class="rounded-lg border p-4 text-left transition-all {availabilityType === 'SPECIFIC'
								? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
								: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
						>
							<div class="flex items-center gap-2">
								<Calendar
									class="h-5 w-5 {availabilityType === 'SPECIFIC'
										? 'text-primary-500'
										: 'text-surface-500'}"
								/>
								<span class="font-medium">Specific Times</span>
							</div>
							<p class="mt-2 text-sm text-surface-500">
								I have specific dates and times when I'm available.
							</p>
						</button>
					</div>

					{#if availabilityType === 'SPECIFIC'}
						<div class="mt-4 space-y-3">
							<p class="text-sm font-medium">Available Time Slots</p>

							{#each availabilitySlots as slot, index (slot.id)}
								<div
									class="flex flex-wrap items-start gap-3 rounded-lg border border-surface-300 p-3 dark:border-surface-700"
								>
									<div class="flex-1 min-w-[200px]">
										<label for="slot-date-{index}" class="label mb-1 block text-xs">Date</label>
										<input
											type="date"
											id="slot-date-{index}"
											bind:value={slot.date}
											min={new Date().toISOString().split('T')[0]}
											class="input w-full"
											required
										/>
									</div>
									<div class="w-28">
										<label for="slot-start-{index}" class="label mb-1 block text-xs">From</label>
										<input
											type="time"
											id="slot-start-{index}"
											bind:value={slot.startTime}
											class="input w-full"
											required
										/>
									</div>
									<div class="w-28">
										<label for="slot-end-{index}" class="label mb-1 block text-xs">To</label>
										<input
											type="time"
											id="slot-end-{index}"
											bind:value={slot.endTime}
											class="input w-full"
											required
										/>
									</div>
									<div class="flex items-end">
										<button
											type="button"
											onclick={() => removeAvailabilitySlot(slot.id)}
											class="btn btn-sm preset-tonal-error mt-5"
											aria-label="Remove time slot"
										>
											<X class="h-4 w-4" />
										</button>
									</div>
								</div>
							{/each}

							<button
								type="button"
								onclick={addAvailabilitySlot}
								class="btn btn-sm preset-tonal-primary"
							>
								<Plus class="mr-1 h-4 w-4" />
								Add Another Time Slot
							</button>

							{#if availabilitySlots.length === 0}
								<p class="text-sm text-warning-500">
									Please add at least one available time slot.
								</p>
							{/if}
						</div>
					{/if}

					<div class="mt-4">
						<label for="availability-notes" class="label mb-1 block text-sm">
							Additional Notes (optional)
						</label>
						<textarea
							id="availability-notes"
							bind:value={availabilityNotes}
							placeholder="e.g., Please call before arriving, gate code is 1234, dog in backyard..."
							class="textarea w-full"
							rows="2"
						></textarea>
					</div>
				</Card>

				<!-- Issue Details -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Issue Details</h2>
					<div class="space-y-4">
						<div>
							<label for="title" class="label mb-1 block">
								Brief Summary <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="title"
								bind:value={title}
								placeholder="e.g., Kitchen sink leaking under cabinet"
								class="input w-full"
								required
								maxlength="255"
							/>
						</div>

						<div>
							<label for="description" class="label mb-1 block">
								Detailed Description <span class="text-error-500">*</span>
							</label>
							<textarea
								id="description"
								bind:value={description}
								placeholder="Please describe the issue in detail. Include when it started, what you've noticed, and any relevant information that might help us understand the problem."
								class="textarea w-full"
								rows="5"
								required
								minlength="10"
							></textarea>
							<p class="mt-1 text-xs text-surface-500">
								Minimum 10 characters. The more detail you provide, the better we can help.
							</p>
						</div>
					</div>
				</Card>

				<!-- Supporting Media -->
				{#if data.organization}
					<Card variant="outlined" padding="md">
						<ServiceCallMediaUpload
							bind:this={mediaUploadComponent}
							organizationId={data.organization.id}
							disabled={isSubmitting}
						/>
					</Card>
				{/if}

				<!-- Actions -->
				<div class="flex justify-end gap-3">
					<a href="/app/concierge/service-calls" class="btn preset-tonal-surface">Cancel</a>
					<button
						type="submit"
						class="btn preset-filled-primary-500"
						disabled={!isValid || isSubmitting || properties.length === 0}
					>
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{#if isUploadingMedia}
								Uploading media...
							{:else}
								Creating service call...
							{/if}
						{:else}
							<Check class="mr-2 h-4 w-4" />
							Submit Service Call
						{/if}
					</button>
				</div>
			</div>
		</form>
	</div>
</PageContainer>
