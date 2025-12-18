<script lang="ts">
	import { DollarSign, AlertCircle, ChevronRight, PiggyBank } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import type { DashboardFinancialAttention } from '$lib/api/cam';

	interface Props {
		data: DashboardFinancialAttention;
	}

	let { data }: Props = $props();

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
		<!-- Overdue Assessments -->
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
					<p class="text-2xl font-bold">{formatCurrency(data.overdueAssessments.totalAmount)}</p>
					<span class="text-sm text-surface-500">({data.overdueAssessments.count} accounts)</span>
				</div>
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>

		<!-- Work Orders Exceeding Budget -->
		<a
			href="/app/cam/work-orders?budgetExceeded=true"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10 text-warning-500">
				<AlertCircle class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Work Orders Exceeding Budget</p>
				<p class="text-2xl font-bold">{data.workOrdersExceedingBudget}</p>
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>

		<!-- Reserve-Funded Work Pending -->
		<a
			href="/app/cam/work-orders?budgetSource=RESERVE&status=SUBMITTED"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10 text-secondary-500">
				<PiggyBank class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Reserve-Funded Work Pending</p>
				<p class="text-2xl font-bold">{data.reserveFundedWorkPending}</p>
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>
	</div>
</Card>
