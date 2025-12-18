<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';

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
		}) => void;
		onCancel: () => void;
	}

	let {
		open,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let title = $state('');
	let meetingType = $state('');
	let scheduledDate = $state('');
	let scheduledTime = $state('');
	let location = $state('');
	let virtualLink = $state('');
	let agenda = $state('');
	let error = $state('');

	const meetingTypes = [
		{ value: 'BOARD', label: 'Board Meeting' },
		{ value: 'ANNUAL', label: 'Annual Meeting' },
		{ value: 'SPECIAL', label: 'Special Meeting' },
		{ value: 'COMMITTEE', label: 'Committee Meeting' },
		{ value: 'BUDGET', label: 'Budget Meeting' },
		{ value: 'EXECUTIVE', label: 'Executive Session' }
	];

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
			agenda: agenda.trim() || undefined
		});
	}

	function handleCancel() {
		title = '';
		meetingType = '';
		scheduledDate = '';
		scheduledTime = '';
		location = '';
		virtualLink = '';
		agenda = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (!open) {
			title = '';
			meetingType = '';
			scheduledDate = '';
			scheduledTime = '';
			location = '';
			virtualLink = '';
			agenda = '';
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

		<div class="relative z-10 w-full max-w-lg rounded-lg bg-surface-100-900 shadow-xl">
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

			<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
				<div>
					<label for="title" class="block text-sm font-medium">
						Meeting Title <span class="text-error-500">*</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={title}
						placeholder="e.g., Monthly Board Meeting"
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !title.trim()}
					/>
				</div>

				<div>
					<label for="meeting-type" class="block text-sm font-medium">
						Meeting Type <span class="text-error-500">*</span>
					</label>
					<select
						id="meeting-type"
						bind:value={meetingType}
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !meetingType}
					>
						<option value="">Select meeting type</option>
						{#each meetingTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>

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
							class:border-error-500={error && !scheduledDate}
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
							class:border-error-500={error && !scheduledTime}
						/>
					</div>
				</div>

				<div>
					<label for="location" class="block text-sm font-medium">
						Location
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

				<div>
					<label for="agenda" class="block text-sm font-medium">
						Agenda
					</label>
					<textarea
						id="agenda"
						bind:value={agenda}
						rows={4}
						placeholder="Enter meeting agenda items..."
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</div>

				{#if error}
					<p class="text-sm text-error-500">{error}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-3 border-t border-surface-300-700 px-6 py-4">
				<button
					type="button"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={loading || !title.trim() || !meetingType || !scheduledDate || !scheduledTime}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Schedule Meeting
				</button>
			</div>
		</div>
	</div>
{/if}
