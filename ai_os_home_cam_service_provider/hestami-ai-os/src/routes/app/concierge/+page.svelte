<script lang="ts">
	import { JobStatusValues, ViolationStatusValues } from '$lib/api/cam';
	import { Home, Plus, FileText, Wrench, Bell, Loader2, ArrowRight } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import type { operations } from '$lib/api/types.generated';

	// Extract types from OpenAPI spec (avoids importing massive Prisma types)
	type Organization = operations['organization.create']['responses']['200']['content']['application/json']['data']['organization'];
	import {
		getServiceCallStatusLabel,
		getServiceCallStatusColor,
		getServiceCallStatusDotColor
	} from '$lib/utils/serviceCallTerminology';
	import type { ConciergeCaseStatus, ConciergeCasePriority } from '$lib/api/cam';

	interface Property {
		id: string;
		name: string;
		addressLine1: string;
		city: string | null;
		state: string | null;
		postalCode: string | null;
	}

	interface ServiceCall {
		id: string;
		caseNumber: string;
		title: string;
		description: string;
		status: ConciergeCaseStatus;
		priority: ConciergeCasePriority;
		createdAt: string;
		updatedAt: string;
	}

	interface Props {
		data: {
			user: { id: string; email: string; name: string | null; image: string | null } | null;
			organization: Organization | null;
			properties: Property[];
			serviceCalls: ServiceCall[];
			documentCount: number;
		};
	}

	let { data }: Props = $props();

	// Use $state + $effect to sync data - track data reference but guard against undefined
	let properties = $state<Property[]>([]);
	let serviceCalls = $state<ServiceCall[]>([]);
	let isLoading = $state(false);

	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			properties = data.properties ?? [];
			serviceCalls = data.serviceCalls ?? [];
		}
	}); 

	const activeCallCount = $derived(serviceCalls.filter(c => c.status !== ViolationStatusValues.RESOLVED && c.status !== JobStatusValues.CLOSED).length);

	const quickActions = [
		{ label: 'Add Property', href: '/app/concierge/properties/new', icon: Home },
		{ label: 'Submit Service Call', href: '/app/concierge/service-calls/new', icon: Wrench },
		{ label: 'View Documents', href: '/app/concierge/documents', icon: FileText },
		{ label: 'Notifications', href: '/app/concierge/notifications', icon: Bell }
	];



	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}
</script>

<svelte:head>
	<title>Concierge Dashboard | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Welcome Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">
					Welcome back, {data?.user?.name?.split(' ')[0] || 'there'}!
				</h1>
				<p class="mt-1 text-surface-500">
					{data?.organization?.name || 'Your Property Dashboard'}
				</p>
			</div>
			<a href="/app/concierge/service-calls" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				New Service Call
			</a>
		</div>

		<!-- Quick Stats -->
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<a href="/app/concierge/properties" class="group">
				<Card variant="outlined" padding="md" class="transition-all group-hover:border-primary-500">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
							<Home class="h-5 w-5 text-primary-500" />
						</div>
						<div>
							{#if isLoading}
								<Loader2 class="h-6 w-6 animate-spin text-surface-400" />
							{:else}
								<p class="text-2xl font-bold">{properties.length}</p>
							{/if}
							<p class="text-sm text-surface-500">Properties</p>
						</div>
					</div>
				</Card>
			</a>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Wrench class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						{#if isLoading}
							<Loader2 class="h-6 w-6 animate-spin text-surface-400" />
						{:else}
							<p class="text-2xl font-bold">{activeCallCount}</p>
						{/if}
						<p class="text-sm text-surface-500">Active Calls</p>
					</div>
				</div>
			</Card>
			<a href="/app/concierge/documents" class="group">
				<Card variant="outlined" padding="md" class="transition-all group-hover:border-primary-500">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
							<FileText class="h-5 w-5 text-success-500" />
						</div>
						<div>
							{#if isLoading}
								<Loader2 class="h-6 w-6 animate-spin text-surface-400" />
							{:else}
								<p class="text-2xl font-bold">{data?.documentCount ?? 0}</p>
							{/if}
							<p class="text-sm text-surface-500">Documents</p>
						</div>
					</div>
				</Card>
			</a>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
						<Bell class="h-5 w-5 text-secondary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Notifications</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Main Content -->
		<div class="mt-8 grid gap-8 lg:grid-cols-3">
			<!-- Recent Service Calls -->
			<div class="lg:col-span-2">
				<Card variant="outlined" padding="none">
					<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Recent Service Calls</h2>
						{#if serviceCalls.length > 0}
							<a href="/app/concierge/service-calls" class="text-sm text-primary-500 hover:underline">
								View All
							</a>
						{/if}
					</div>
					<div class="p-6">
						{#if isLoading}
							<div class="flex items-center justify-center py-8">
								<Loader2 class="h-6 w-6 animate-spin text-surface-400" />
							</div>
						{:else if serviceCalls.length === 0}
							<EmptyState
								title="No service calls yet"
								description="Submit a service call when you need help with your property."
							>
								{#snippet actions()}
									<a href="/app/concierge/service-calls" class="btn preset-filled-primary-500">
										<Plus class="mr-2 h-4 w-4" />
										New Service Call
									</a>
								{/snippet}
							</EmptyState>
						{:else}
							<div class="space-y-3">
								{#each serviceCalls as call}
									<a
										href="/app/concierge/service-calls/{call.id}"
										class="flex items-center justify-between rounded-lg border border-surface-300-700 p-4 transition-all hover:border-primary-500 hover:bg-surface-500/5"
									>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="font-medium">{call.title}</span>
												<span
													class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {getServiceCallStatusColor(call.status)}"
												>
													<span class="h-1.5 w-1.5 rounded-full {getServiceCallStatusDotColor(call.status)}"></span>
													{getServiceCallStatusLabel(call.status)}
												</span>
											</div>
											<p class="mt-1 text-sm text-surface-500">
												{call.caseNumber} • {formatRelativeTime(call.createdAt)}
											</p>
										</div>
										<ArrowRight class="h-4 w-4 shrink-0 text-surface-400" />
									</a>
								{/each}
							</div>
						{/if}
					</div>
				</Card>
			</div>

			<!-- Quick Actions -->
			<div>
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Quick Actions</h2>
					</div>
					<div class="p-4">
						<div class="space-y-2">
							{#each quickActions as action}
								<a
									href={action.href}
									class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-200-800"
								>
									<action.icon class="h-5 w-5 text-surface-500" />
									<span class="text-sm font-medium">{action.label}</span>
								</a>
							{/each}
						</div>
					</div>
				</Card>
			</div>
		</div>
	</div>
</PageContainer>
