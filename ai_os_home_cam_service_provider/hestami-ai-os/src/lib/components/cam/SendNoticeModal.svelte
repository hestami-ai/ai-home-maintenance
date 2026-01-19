<script lang="ts">
	import { CaseNoteTypeValues, NoticeTypeValues } from '$lib/api/cam';
	import { X, Loader2, Send } from 'lucide-svelte';

	interface NoticeTemplate {
		id: string;
		name: string;
		type: string;
	}

	interface Props {
		open: boolean;
		violationId: string;
		violationNumber: string;
		loading?: boolean;
		onConfirm: (data: { templateId: string; noticeType: string; curePeriodDays: number; notes: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		violationId,
		violationNumber,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let noticeType = $state(NoticeTypeValues.FIRST_NOTICE);
	let templateId = $state('');
	let curePeriodDays = $state(14);
	let notes = $state('');
	let error = $state('');

	const noticeTypeOptions = [
		{ value: NoticeTypeValues.FIRST_NOTICE, label: 'First Notice', defaultDays: 14 },
		{ value: NoticeTypeValues.SECOND_NOTICE, label: 'Second Notice', defaultDays: 7 },
		{ value: NoticeTypeValues.FINAL_NOTICE, label: 'Final Notice', defaultDays: 3 },
		{ value: NoticeTypeValues.HEARING_NOTICE, label: 'Hearing Notice', defaultDays: 14 }
	];

	const templates: NoticeTemplate[] = [
		{ id: 'tpl-1', name: 'Standard First Notice', type: NoticeTypeValues.FIRST_NOTICE },
		{ id: 'tpl-2', name: 'Standard Second Notice', type: NoticeTypeValues.SECOND_NOTICE },
		{ id: 'tpl-3', name: 'Final Warning Notice', type: NoticeTypeValues.FINAL_NOTICE },
		{ id: 'tpl-4', name: 'Hearing Notification', type: NoticeTypeValues.HEARING_NOTICE }
	];

	const filteredTemplates = $derived(
		templates.filter(t => t.type === noticeType || t.type === CaseNoteTypeValues.GENERAL)
	);

	function handleNoticeTypeChange() {
		const option = noticeTypeOptions.find(o => o.value === noticeType);
		if (option) {
			curePeriodDays = option.defaultDays;
		}
		templateId = '';
	}

	function handleConfirm() {
		if (!templateId) {
			error = 'Please select a notice template.';
			return;
		}
		error = '';
		onConfirm({
			templateId,
			noticeType,
			curePeriodDays,
			notes: notes.trim()
		});
	}

	function handleCancel() {
		noticeType = NoticeTypeValues.FIRST_NOTICE;
		templateId = '';
		curePeriodDays = 14;
		notes = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (!open) {
			noticeType = NoticeTypeValues.FIRST_NOTICE;
			templateId = '';
			curePeriodDays = 14;
			notes = '';
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
				<div>
					<h2 class="text-lg font-semibold">Send Notice</h2>
					<p class="text-sm text-surface-500">{violationNumber}</p>
				</div>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{error}
					</div>
				{/if}

				<div>
					<label for="noticeType" class="mb-1 block text-sm font-medium">
						Notice Type <span class="text-error-500">*</span>
					</label>
					<select
						id="noticeType"
						bind:value={noticeType}
						onchange={handleNoticeTypeChange}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each noticeTypeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="templateId" class="mb-1 block text-sm font-medium">
						Notice Template <span class="text-error-500">*</span>
					</label>
					<select
						id="templateId"
						bind:value={templateId}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="">Select a template</option>
						{#each filteredTemplates as template}
							<option value={template.id}>{template.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="curePeriodDays" class="mb-1 block text-sm font-medium">
						Cure Period (Days)
					</label>
					<input
						id="curePeriodDays"
						type="number"
						min="1"
						max="90"
						bind:value={curePeriodDays}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
					<p class="mt-1 text-xs text-surface-500">
						Owner will have {curePeriodDays} days to cure the violation.
					</p>
				</div>

				<div>
					<label for="notes" class="mb-1 block text-sm font-medium">
						Additional Notes
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={3}
						placeholder="Any additional notes to include..."
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</div>
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
					disabled={loading || !templateId}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						<Send class="h-4 w-4" />
					{/if}
					Send Notice
				</button>
			</div>
		</div>
	</div>
{/if}
