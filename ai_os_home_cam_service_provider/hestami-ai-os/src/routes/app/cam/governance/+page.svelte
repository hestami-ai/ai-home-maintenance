<script lang="ts">
	import { Gavel, Users, Calendar, FileCheck, BookOpen } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface GovernanceSection {
		title: string;
		description: string;
		href: string;
		icon: typeof Gavel;
		color: string;
	}

	const sections: GovernanceSection[] = [
		{
			title: 'Board',
			description: 'Manage board members and terms',
			href: '/app/cam/governance/board',
			icon: Users,
			color: 'bg-primary-500/10 text-primary-500'
		},
		{
			title: 'Meetings',
			description: 'Schedule meetings and manage minutes',
			href: '/app/cam/governance/meetings',
			icon: Calendar,
			color: 'bg-secondary-500/10 text-secondary-500'
		},
		{
			title: 'Resolutions',
			description: 'Track board resolutions and voting',
			href: '/app/cam/governance/resolutions',
			icon: FileCheck,
			color: 'bg-success-500/10 text-success-500'
		},
		{
			title: 'Policies',
			description: 'Manage community policies and rules',
			href: '/app/cam/governance/policies',
			icon: BookOpen,
			color: 'bg-warning-500/10 text-warning-500'
		}
	];
</script>

<svelte:head>
	<title>Governance | CAM | Hestami AI</title>
</svelte:head>

<div class="p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Governance</h1>
		<p class="mt-1 text-surface-500">
			Board management and governance for {$currentAssociation?.name || 'your association'}
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
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

	<div class="mt-8 grid gap-6 lg:grid-cols-2">
		<Card variant="outlined" padding="lg">
			<h2 class="font-semibold">Current Board</h2>
			<p class="mt-2 text-sm text-surface-500">
				Board member information will be displayed here.
			</p>
			<div class="mt-4 rounded-lg bg-surface-200-800 p-4 text-center">
				<p class="text-surface-500">No board members configured</p>
			</div>
		</Card>

		<Card variant="outlined" padding="lg">
			<h2 class="font-semibold">Upcoming Meetings</h2>
			<p class="mt-2 text-sm text-surface-500">
				Scheduled meetings will be displayed here.
			</p>
			<div class="mt-4 rounded-lg bg-surface-200-800 p-4 text-center">
				<p class="text-surface-500">No upcoming meetings</p>
			</div>
		</Card>
	</div>
</div>
