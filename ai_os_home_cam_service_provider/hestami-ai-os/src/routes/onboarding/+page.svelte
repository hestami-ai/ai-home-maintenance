<script lang="ts">
	import { Home, Building2, Wrench, ArrowRight } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { auth, organizationStore } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect if not authenticated
	onMount(() => {
		if (!$auth.isAuthenticated && !$auth.isLoading) {
			goto('/login');
		}
	});

	interface EntryVector {
		id: string;
		title: string;
		subtitle: string;
		description: string;
		icon: typeof Home;
		href: string;
		color: string;
		bgColor: string;
	}

	const entryVectors: EntryVector[] = [
		{
			id: 'property-owner',
			title: 'I own a property',
			subtitle: 'Property Owner',
			description: 'Manage your property, find trusted service providers, and track maintenance with AI-powered assistance.',
			icon: Home,
			href: '/onboarding/property-owner',
			color: 'text-secondary-500',
			bgColor: 'bg-secondary-500/10'
		},
		{
			id: 'community',
			title: 'I manage a community or HOA',
			subtitle: 'Community Association',
			description: 'Streamline governance, compliance, and community management with powerful tools and automation.',
			icon: Building2,
			href: '/onboarding/community',
			color: 'text-primary-500',
			bgColor: 'bg-primary-500/10'
		},
		{
			id: 'service-provider',
			title: 'I run a service or contracting business',
			subtitle: 'Service Provider',
			description: 'Run your contracting business efficiently with job management, scheduling, and invoicing.',
			icon: Wrench,
			href: '/onboarding/service-provider',
			color: 'text-success-500',
			bgColor: 'bg-success-500/10'
		}
	];
</script>

<svelte:head>
	<title>Get Started | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="lg">
	<div class="py-12">
		<div class="text-center">
			<h1 class="text-3xl font-bold">Welcome to Hestami AI</h1>
			<p class="mt-2 text-lg text-surface-500">
				Tell us about yourself so we can personalize your experience
			</p>
		</div>

		<!-- Existing Organizations -->
		{#if $organizationStore.memberships.length > 0}
			<div class="mt-8">
				<h2 class="text-lg font-semibold">Your Organizations</h2>
				<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each $organizationStore.memberships as membership}
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex-1">
									<p class="font-medium">{membership.organization.name}</p>
									<p class="text-sm text-surface-500">{membership.role}</p>
								</div>
								<a
									href="/app"
									class="btn btn-sm preset-tonal-primary"
								>
									Open
								</a>
							</div>
						</Card>
					{/each}
				</div>
				<hr class="my-8 border-surface-300-700" />
				<p class="text-center text-surface-500">Or add another organization:</p>
			</div>
		{/if}

		<!-- Entry Vectors -->
		<div class="mt-8 grid gap-6 md:grid-cols-3">
			{#each entryVectors as vector}
				<a
					href={vector.href}
					class="group relative block overflow-hidden rounded-xl border border-surface-300-700 bg-surface-100-900 p-6 transition-all hover:border-primary-500 hover:shadow-lg"
				>
					<div class="flex flex-col items-center text-center">
						<div class="flex h-16 w-16 items-center justify-center rounded-full {vector.bgColor} transition-transform group-hover:scale-110">
							<vector.icon class="h-8 w-8 {vector.color}" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">{vector.title}</h3>
						<p class="mt-1 text-sm font-medium {vector.color}">{vector.subtitle}</p>
						<p class="mt-3 text-sm text-surface-500">{vector.description}</p>
						<div class="mt-4 flex items-center gap-1 text-sm font-medium text-primary-500 opacity-0 transition-opacity group-hover:opacity-100">
							Get started
							<ArrowRight class="h-4 w-4" />
						</div>
					</div>
				</a>
			{/each}
		</div>

		<p class="mt-8 text-center text-sm text-surface-500">
			You can always add more organizations later from your account settings.
		</p>
	</div>
</PageContainer>
