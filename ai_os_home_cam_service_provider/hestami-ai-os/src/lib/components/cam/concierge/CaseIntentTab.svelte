<script lang="ts">
	import { MessageSquare, Sparkles } from 'lucide-svelte';
	import ClarificationThread from './ClarificationThread.svelte';
	import type { ConciergeCaseDetail } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
	}

	let { caseDetail }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Original Request -->
	<div>
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">Original Request</h3>
		<div class="mt-2 rounded-lg bg-surface-100-900 p-4">
			<p class="font-medium">{caseDetail.case.title}</p>
			<p class="mt-2 text-sm whitespace-pre-wrap text-surface-600 dark:text-surface-400">
				{caseDetail.case.description}
			</p>
		</div>
	</div>

	<!-- AI Summary Placeholder -->
	<div class="rounded-lg border border-dashed border-surface-300-700 p-4">
		<div class="flex items-center gap-2 text-surface-500">
			<Sparkles size={16} />
			<span class="text-sm font-medium">AI-Generated Summary</span>
		</div>
		<p class="mt-2 text-sm text-surface-500 italic">
			AI-generated summaries will be available in a future update.
		</p>
	</div>

	<!-- Clarification Thread -->
	<div>
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide mb-4">
			Clarifications
		</h3>
		<ClarificationThread notes={caseDetail.notes} />
	</div>
</div>
