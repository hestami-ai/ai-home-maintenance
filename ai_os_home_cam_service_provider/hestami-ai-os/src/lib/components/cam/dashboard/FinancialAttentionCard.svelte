<script lang="ts">
	import { DollarSign, AlertCircle, ChevronRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface Props {
		overdueAssessmentsCount: number;
		overdueAssessmentsAmount: number;
		budgetExceptionsCount: number;
	}

	let {
		overdueAssessmentsCount = 0,
		overdueAssessmentsAmount = 0,
		budgetExceptionsCount = 0
	}: Props = $props();

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}
</script>

<Card variant="outlined" padding="none">
	<div class="border-b border-surface-300-700 px-6 py-4">
		<h2 class="font-semibold">Financial Attention</h2>
	</div>

	<div class="divide-y divide-surface-300-700">
		<a
			href="/app/cam/accounting/receivables?status=overdue"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-500/10 text-error-500">
				<DollarSign class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Overdue Assessments</p>
				<div class="flex items-baseline gap-2">
					<p class="text-2xl font-bold">{formatCurrency(overdueAssessmentsAmount)}</p>
					<span class="text-sm text-surface-500">({overdueAssessmentsCount} accounts)</span>
				</div>
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>

		<a
			href="/app/cam/accounting?view=budget-exceptions"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10 text-warning-500">
				<AlertCircle class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Budget Exceptions</p>
				<p class="text-2xl font-bold">{budgetExceptionsCount}</p>
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>
	</div>
</Card>
