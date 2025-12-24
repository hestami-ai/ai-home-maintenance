<script lang="ts">
	import { X, Scale } from 'lucide-svelte';

	interface Props {
		open: boolean;
		violationNumber: string;
		onclose: () => void;
		onsubmit: (data: { reason: string; requestBoardReview: boolean; supportingInfo: string }) => void;
	}

	let { open, violationNumber, onclose, onsubmit }: Props = $props();

	let reason = $state('');
	let requestBoardReview = $state(false);
	let supportingInfo = $state('');
	let isSubmitting = $state(false);

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!reason.trim()) return;

		isSubmitting = true;
		onsubmit({
			reason: reason.trim(),
			requestBoardReview,
			supportingInfo: supportingInfo.trim()
		});
	}

	function handleClose() {
		reason = '';
		requestBoardReview = false;
		supportingInfo = '';
		isSubmitting = false;
		onclose();
	}

	$effect(() => {
		if (!open) {
			reason = '';
			requestBoardReview = false;
			supportingInfo = '';
			isSubmitting = false;
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
		<div class="w-full max-w-lg rounded-xl bg-surface-50-950 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<div class="flex items-center gap-3">
					<Scale class="h-5 w-5 text-primary-500" />
					<div>
						<h2 class="text-lg font-semibold">File Appeal</h2>
						<p class="text-sm text-surface-500">{violationNumber}</p>
					</div>
				</div>
				<button
					type="button"
					onclick={handleClose}
					class="rounded-lg p-1 hover:bg-surface-200-800"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="p-6">
				<div class="space-y-4">
					<div>
						<label for="appeal-reason" class="mb-1 block text-sm font-medium">
							Reason for Appeal <span class="text-error-500">*</span>
						</label>
						<textarea
							id="appeal-reason"
							bind:value={reason}
							required
							rows="4"
							placeholder="Explain why you believe this violation should be reconsidered..."
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						></textarea>
					</div>

					<div>
						<label for="supporting-info" class="mb-1 block text-sm font-medium">
							Supporting Information
						</label>
						<textarea
							id="supporting-info"
							bind:value={supportingInfo}
							rows="2"
							placeholder="Any additional context, evidence references, or documentation..."
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						></textarea>
					</div>

					<div class="flex items-start gap-3 rounded-lg border border-surface-300-700 p-3">
						<input
							type="checkbox"
							id="board-review"
							bind:checked={requestBoardReview}
							class="mt-0.5 h-4 w-4 rounded border-surface-300-700 text-primary-500 focus:ring-primary-500"
						/>
						<label for="board-review" class="text-sm">
							<span class="font-medium">Request Board Review</span>
							<p class="mt-0.5 text-surface-500">
								Check this box to escalate the appeal to the Board of Directors for formal review.
							</p>
						</label>
					</div>

					<div class="rounded-lg bg-warning-500/10 p-3 text-sm text-warning-700 dark:text-warning-300">
						<p class="font-medium">Important:</p>
						<ul class="mt-1 list-inside list-disc space-y-1 text-xs">
							<li>Filing an appeal does not pause enforcement actions</li>
							<li>You will be notified of the appeal decision</li>
							<li>Board review requests may take 2-4 weeks</li>
						</ul>
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={handleClose}
						class="btn preset-tonal-surface"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!reason.trim() || isSubmitting}
						class="btn preset-filled-primary-500"
					>
						{#if isSubmitting}
							<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
						{/if}
						Submit Appeal
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
