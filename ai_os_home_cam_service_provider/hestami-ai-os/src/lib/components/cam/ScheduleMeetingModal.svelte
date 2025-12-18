<script lang="ts">
	import { X, Loader2, Calendar, Users, FileText, Check, ChevronLeft, ChevronRight, Video, MapPin } from 'lucide-svelte';

	interface Props {
		open: boolean;
		loading?: boolean;
		onConfirm: (data: { 
			title: string;
			meetingType: string;
			scheduledDate: string;
			scheduledTime: string;
			location?: string;
			virtualLink?: string;
			agenda?: string;
			quorumRequired?: number;
		}) => void;
		onCancel: () => void;
	}

	let {
		open,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let currentStep = $state(1);
	let title = $state('');
	let meetingType = $state('');
	let scheduledDate = $state('');
	let scheduledTime = $state('');
	let location = $state('');
	let virtualLink = $state('');
	let agenda = $state('');
	let quorumRequired = $state<number | undefined>(undefined);
	let error = $state('');

	const totalSteps = 4;

	const meetingTypes = [
		{ value: 'BOARD', label: 'Board Meeting', description: 'Regular board of directors meeting', icon: Users },
		{ value: 'ANNUAL', label: 'Annual Meeting', description: 'Annual homeowner meeting', icon: Calendar },
		{ value: 'SPECIAL', label: 'Special Meeting', description: 'Special purpose meeting', icon: FileText },
		{ value: 'COMMITTEE', label: 'Committee Meeting', description: 'Committee or subcommittee meeting', icon: Users },
		{ value: 'BUDGET', label: 'Budget Meeting', description: 'Budget review and approval', icon: FileText },
		{ value: 'EXECUTIVE', label: 'Executive Session', description: 'Closed session for sensitive matters', icon: Users }
	];

	const steps = [
		{ number: 1, label: 'Type' },
		{ number: 2, label: 'Schedule' },
		{ number: 3, label: 'Details' },
		{ number: 4, label: 'Review' }
	];

	const canProceed = $derived(() => {
		switch (currentStep) {
			case 1: return !!meetingType;
			case 2: return !!scheduledDate && !!scheduledTime;
			case 3: return !!title.trim();
			case 4: return true;
			default: return false;
		}
	});

	function handleConfirm() {
		if (!title.trim()) {
			error = 'Title is required.';
			return;
		}
		if (!meetingType) {
			error = 'Meeting type is required.';
			return;
		}
		if (!scheduledDate) {
			error = 'Date is required.';
			return;
		}
		if (!scheduledTime) {
			error = 'Time is required.';
			return;
		}
		error = '';
		onConfirm({
			title: title.trim(),
			meetingType,
			scheduledDate,
			scheduledTime,
			location: location.trim() || undefined,
			virtualLink: virtualLink.trim() || undefined,
			agenda: agenda.trim() || undefined,
			quorumRequired
		});
	}

	function handleCancel() {
		currentStep = 1;
		title = '';
		meetingType = '';
		scheduledDate = '';
		scheduledTime = '';
		location = '';
		virtualLink = '';
		agenda = '';
		quorumRequired = undefined;
		error = '';
		onCancel();
	}

	function nextStep() {
		if (currentStep < totalSteps && canProceed()) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function getSelectedType() {
		return meetingTypes.find(t => t.value === meetingType);
	}

	$effect(() => {
		if (!open) {
			currentStep = 1;
			title = '';
			meetingType = '';
			scheduledDate = '';
			scheduledTime = '';
			location = '';
			virtualLink = '';
			agenda = '';
			quorumRequired = undefined;
			error = '';
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={handleCancel}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-2xl rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">Schedule Meeting</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Step Indicator -->
			<div class="px-6 py-4 border-b border-surface-300-700">
				<div class="flex items-center justify-between">
					{#each steps as step, idx}
						<div class="flex items-center {idx < steps.length - 1 ? 'flex-1' : ''}">
							<div class="flex items-center gap-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium {currentStep > step.number ? 'bg-primary-500 text-white' : currentStep === step.number ? 'bg-primary-500 text-white' : 'bg-surface-200-800 text-surface-500'}">
									{#if currentStep > step.number}
										<Check class="h-4 w-4" />
									{:else}
										{step.number}
									{/if}
								</div>
								<span class="text-sm font-medium {currentStep >= step.number ? 'text-surface-900-100' : 'text-surface-500'}">{step.label}</span>
							</div>
							{#if idx < steps.length - 1}
								<div class="mx-4 h-0.5 flex-1 {currentStep > step.number ? 'bg-primary-500' : 'bg-surface-200-800'}"></div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="max-h-[60vh] overflow-y-auto p-6">
				{#if currentStep === 1}
					<!-- Step 1: Meeting Type -->
					<div class="space-y-4">
						<p class="text-sm text-surface-500">Select the type of meeting you want to schedule.</p>
						<div class="grid grid-cols-2 gap-3">
							{#each meetingTypes as type}
								<button
									type="button"
									onclick={() => meetingType = type.value}
									class="flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors {meetingType === type.value ? 'border-primary-500 bg-primary-500/10' : 'border-surface-300-700 hover:border-surface-400'}"
								>
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
										<type.icon class="h-5 w-5 text-surface-500" />
									</div>
									<div>
										<p class="font-medium">{type.label}</p>
										<p class="text-xs text-surface-500">{type.description}</p>
									</div>
								</button>
							{/each}
						</div>
					</div>

				{:else if currentStep === 2}
					<!-- Step 2: Schedule -->
					<div class="space-y-4">
						<p class="text-sm text-surface-500">Set the date, time, and location for the meeting.</p>
						
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="scheduled-date" class="block text-sm font-medium">
									Date <span class="text-error-500">*</span>
								</label>
								<input
									id="scheduled-date"
									type="date"
									bind:value={scheduledDate}
									class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
							<div>
								<label for="scheduled-time" class="block text-sm font-medium">
									Time <span class="text-error-500">*</span>
								</label>
								<input
									id="scheduled-time"
									type="time"
									bind:value={scheduledTime}
									class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>

						<div>
							<label for="location" class="block text-sm font-medium">
								<MapPin class="inline h-4 w-4 mr-1" />
								Physical Location
							</label>
							<input
								id="location"
								type="text"
								bind:value={location}
								placeholder="e.g., Community Clubhouse, Room 101"
								class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
						</div>

						<div>
							<label for="virtual-link" class="block text-sm font-medium">
								<Video class="inline h-4 w-4 mr-1" />
								Virtual Meeting Link
							</label>
							<input
								id="virtual-link"
								type="url"
								bind:value={virtualLink}
								placeholder="https://zoom.us/j/..."
								class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
						</div>
					</div>

				{:else if currentStep === 3}
					<!-- Step 3: Details -->
					<div class="space-y-4">
						<p class="text-sm text-surface-500">Provide meeting details and quorum requirements.</p>
						
						<div>
							<label for="title" class="block text-sm font-medium">
								Meeting Title <span class="text-error-500">*</span>
							</label>
							<input
								id="title"
								type="text"
								bind:value={title}
								placeholder="e.g., Monthly Board Meeting - January 2025"
								class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
						</div>

						<div>
							<label for="quorum" class="block text-sm font-medium">
								<Users class="inline h-4 w-4 mr-1" />
								Quorum Required
							</label>
							<input
								id="quorum"
								type="number"
								min="0"
								bind:value={quorumRequired}
								placeholder="Minimum attendees for quorum"
								class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
							<p class="mt-1 text-xs text-surface-500">Leave blank if no quorum is required.</p>
						</div>

						<div>
							<label for="agenda" class="block text-sm font-medium">
								<FileText class="inline h-4 w-4 mr-1" />
								Draft Agenda
							</label>
							<textarea
								id="agenda"
								bind:value={agenda}
								rows={5}
								placeholder="1. Call to Order&#10;2. Roll Call&#10;3. Approval of Previous Minutes&#10;4. Old Business&#10;5. New Business&#10;6. Adjournment"
								class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
							></textarea>
						</div>
					</div>

				{:else if currentStep === 4}
					<!-- Step 4: Review -->
					<div class="space-y-4">
						<p class="text-sm text-surface-500">Review the meeting details before scheduling.</p>
						
						<div class="rounded-lg border border-surface-300-700 divide-y divide-surface-300-700">
							<div class="p-4">
								<p class="text-xs text-surface-500 uppercase tracking-wide">Meeting Type</p>
								<p class="mt-1 font-medium">{getSelectedType()?.label || meetingType}</p>
							</div>
							<div class="p-4">
								<p class="text-xs text-surface-500 uppercase tracking-wide">Title</p>
								<p class="mt-1 font-medium">{title}</p>
							</div>
							<div class="p-4 grid grid-cols-2 gap-4">
								<div>
									<p class="text-xs text-surface-500 uppercase tracking-wide">Date</p>
									<p class="mt-1 font-medium">{scheduledDate ? new Date(scheduledDate).toLocaleDateString() : '-'}</p>
								</div>
								<div>
									<p class="text-xs text-surface-500 uppercase tracking-wide">Time</p>
									<p class="mt-1 font-medium">{scheduledTime || '-'}</p>
								</div>
							</div>
							{#if location || virtualLink}
								<div class="p-4 grid grid-cols-2 gap-4">
									{#if location}
										<div>
											<p class="text-xs text-surface-500 uppercase tracking-wide">Location</p>
											<p class="mt-1">{location}</p>
										</div>
									{/if}
									{#if virtualLink}
										<div>
											<p class="text-xs text-surface-500 uppercase tracking-wide">Virtual Link</p>
											<p class="mt-1 text-primary-500 truncate">{virtualLink}</p>
										</div>
									{/if}
								</div>
							{/if}
							{#if quorumRequired}
								<div class="p-4">
									<p class="text-xs text-surface-500 uppercase tracking-wide">Quorum Required</p>
									<p class="mt-1">{quorumRequired} attendees</p>
								</div>
							{/if}
							{#if agenda}
								<div class="p-4">
									<p class="text-xs text-surface-500 uppercase tracking-wide">Agenda</p>
									<pre class="mt-1 text-sm whitespace-pre-wrap font-sans">{agenda}</pre>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if error}
					<p class="mt-4 text-sm text-error-500">{error}</p>
				{/if}
			</div>

			<div class="flex justify-between gap-3 border-t border-surface-300-700 px-6 py-4">
				<button
					type="button"
					onclick={currentStep === 1 ? handleCancel : prevStep}
					disabled={loading}
					class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
				>
					{#if currentStep > 1}
						<ChevronLeft class="h-4 w-4" />
						Back
					{:else}
						Cancel
					{/if}
				</button>
				
				{#if currentStep < totalSteps}
					<button
						type="button"
						onclick={nextStep}
						disabled={!canProceed()}
						class="inline-flex items-center gap-1 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Next
						<ChevronRight class="h-4 w-4" />
					</button>
				{:else}
					<button
						type="button"
						onclick={handleConfirm}
						disabled={loading}
						class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<Loader2 class="h-4 w-4 animate-spin" />
						{/if}
						Schedule Meeting
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
