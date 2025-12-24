<script lang="ts">
	import { DollarSign, FileText, CreditCard, Building2, BookOpen } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface AccountingSection {
		title: string;
		description: string;
		href: string;
		icon: typeof DollarSign;
		color: string;
	}

	const sections: AccountingSection[] = [
		{
			title: 'Assessments',
			description: 'Manage assessment charges and payment schedules',
			href: '/app/cam/accounting/assessments',
			icon: FileText,
			color: 'bg-primary-500/10 text-primary-500'
		},
		{
			title: 'Receivables',
			description: 'Track outstanding balances and delinquencies',
			href: '/app/cam/accounting/receivables',
			icon: DollarSign,
			color: 'bg-success-500/10 text-success-500'
		},
		{
			title: 'Payables',
			description: 'Manage vendor invoices and payments',
			href: '/app/cam/accounting/payables',
			icon: CreditCard,
			color: 'bg-warning-500/10 text-warning-500'
		},
		{
			title: 'General Ledger',
			description: 'Chart of accounts and journal entries',
			href: '/app/cam/accounting/gl',
			icon: BookOpen,
			color: 'bg-secondary-500/10 text-secondary-500'
		},
		{
			title: 'Bank Accounts',
			description: 'Manage bank accounts and reconciliation',
			href: '/app/cam/accounting/bank',
			icon: Building2,
			color: 'bg-surface-500/10 text-surface-500'
		}
	];
</script>

<svelte:head>
	<title>Accounting | CAM | Hestami AI</title>
</svelte:head>

<div class="p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Accounting</h1>
		<p class="mt-1 text-surface-500">
			Financial management for {$currentAssociation?.name || 'your association'}
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each sections as section}
			<a href={section.href} class="group">
				<Card variant="outlined" padding="lg" class="h-full transition-colors group-hover:border-primary-500">
					<div class="flex items-start gap-4">
						<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg {section.color}">
							<section.icon class="h-6 w-6" />
						</div>
						<div>
							<h2 class="font-semibold group-hover:text-primary-500">{section.title}</h2>
							<p class="mt-1 text-sm text-surface-500">{section.description}</p>
						</div>
					</div>
				</Card>
			</a>
		{/each}
	</div>

	<div class="mt-8">
		<Card variant="outlined" padding="lg">
			<h2 class="font-semibold">Financial Summary</h2>
			<p class="mt-2 text-sm text-surface-500">
				Financial summary and quick stats will be displayed here once data is available.
			</p>
			<div class="mt-4 grid gap-4 sm:grid-cols-3">
				<div class="rounded-lg bg-surface-200-800 p-4 text-center">
					<p class="text-2xl font-bold">$0</p>
					<p class="text-sm text-surface-500">Total Receivables</p>
				</div>
				<div class="rounded-lg bg-surface-200-800 p-4 text-center">
					<p class="text-2xl font-bold">$0</p>
					<p class="text-sm text-surface-500">Total Payables</p>
				</div>
				<div class="rounded-lg bg-surface-200-800 p-4 text-center">
					<p class="text-2xl font-bold">$0</p>
					<p class="text-sm text-surface-500">Operating Balance</p>
				</div>
			</div>
		</Card>
	</div>
</div>
