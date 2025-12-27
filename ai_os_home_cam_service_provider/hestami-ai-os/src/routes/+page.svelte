<script lang="ts">
	import { Home, Building2, Wrench, ArrowRight } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { auth } from '$lib/stores';
	import { fade } from 'svelte/transition';

	let activeTab = $state('owner');

	const tabs = [
		{
			id: 'owner',
			label: 'Property Owner',
			description: 'Manage your home, requests, and maintenance.',
			icon: Home,
			image: '/brian-zajac-40fiwxjjlaQ-unsplash.jpg'
		},
		{
			id: 'community',
			label: 'Community Association',
			description: 'Streamline governance and operations.',
			icon: Building2,
			image: '/jakub-zerdzicki-sQMNLkUJi-g-unsplash.jpg'
		},
		{
			id: 'provider',
			label: 'Service Provider',
			description: 'Grow your business and manage jobs.',
			icon: Wrench,
			image: '/Gemini_Generated_Image_bqxi3ibqxi3ibqxi.png'
		}
	];
</script>

<svelte:head>
	<title>Hestami AI OS | Intelligent Integrated Property Management</title>
	<meta name="description" content="The unified operating system for property management, community associations, and service providers. Streamline operations with AI-driven automation." />
	<meta name="keywords" content="property management software, HOA management, community association, service provider tools, AI property management" />
	
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://hestami.ai/" />
	<meta property="og:title" content="Hestami AI OS | Intelligent Integrated Property Management" />
	<meta property="og:description" content="The unified operating system for property management, community associations, and service providers." />
	<meta property="og:image" content="/hestami-ai-company-logo-transparent.png" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content="https://hestami.ai/" />
	<meta property="twitter:title" content="Hestami AI OS | Intelligent Integrated Property Management" />
	<meta property="twitter:description" content="The unified operating system for property management, community associations, and service providers." />
	<meta property="twitter:image" content="/hestami-ai-company-logo-transparent.png" />
</svelte:head>

<PageContainer>
	<div class="py-12 sm:py-20">
		<!-- Hero Section -->
		<div class="mb-24 grid gap-12 lg:grid-cols-2 lg:items-center">
			<!-- Left Column: Content -->
			<div>
				<h1 class="mb-6 text-4xl font-bold tracking-tight text-surface-900 dark:text-surface-50 sm:text-5xl">
					<span class="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
						Hestami AI OS
					</span>
				</h1>
				<p class="mb-8 text-lg text-surface-600 dark:text-surface-400">
					The intelligent integrated operating system for property management, community associations, and service providers.
				</p>

				<div class="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-500">I am a...</div>
				
				<div class="space-y-3">
					{#each tabs as tab (tab.id)}
						<button
							class="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary-500/50 hover:bg-surface-50 dark:hover:bg-surface-800
							{activeTab === tab.id 
								? 'border-primary-500 bg-surface-50 shadow-sm ring-1 ring-primary-500 dark:bg-surface-800' 
								: 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900'}"
							onclick={() => activeTab = tab.id}
						>
							<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full 
								{activeTab === tab.id ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-500 dark:bg-surface-800'}">
								<tab.icon class="h-6 w-6" />
							</div>
							<div>
								<div class="font-semibold text-surface-900 dark:text-surface-50 {activeTab === tab.id ? 'text-primary-600 dark:text-primary-400' : ''}">
									{tab.label}
								</div>
								<div class="text-sm text-surface-600 dark:text-surface-400">
									{tab.description}
								</div>
							</div>
							{#if activeTab === tab.id}
								<ArrowRight class="ml-auto h-5 w-5 text-primary-500" />
							{/if}
						</button>
					{/each}
				</div>

				<div class="mt-8">
					<a href="/register" class="btn preset-filled-primary-500 px-8 py-3 font-semibold">
						Get Started as {tabs.find(t => t.id === activeTab)?.label}
						<ArrowRight class="ml-2 h-4 w-4" />
					</a>
				</div>
			</div>

			<!-- Right Column: Image -->
			<div class="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-surface-100 shadow-xl dark:bg-surface-800 lg:aspect-square lg:h-auto">
				{#each tabs as tab (tab.id)}
					{#if activeTab === tab.id}
						<div 
							class="absolute inset-0 h-full w-full"
							transition:fade={{ duration: 400 }}
						>
							<img 
								src={tab.image} 
								alt={tab.label}
								class="h-full w-full object-cover"
							/>
							<div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
							<div class="absolute bottom-6 left-6 right-6 text-white">
								<p class="font-medium text-white/90">{tab.label} Experience</p>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Features Section -->
		<div class="mt-20">
			<h2 class="text-center text-2xl font-semibold">Built for Everyone in the Property Ecosystem</h2>
			<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				<!-- Property Owners -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500/10">
							<Home class="h-6 w-6 text-secondary-500" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">Property Owners</h3>
						<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							Manage your property, find trusted service providers, and track maintenance with AI-powered assistance.
						</p>
					</div>
				</Card>

				<!-- Community Associations -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
							<Building2 class="h-6 w-6 text-primary-500" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">HOAs & Communities</h3>
						<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							Streamline governance, compliance, and community management with powerful tools and automation.
						</p>
					</div>
				</Card>

				<!-- Service Providers -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10">
							<Wrench class="h-6 w-6 text-success-500" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">Service Providers</h3>
						<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							Run your contracting business efficiently with job management, scheduling, and invoicing.
						</p>
					</div>
				</Card>
			</div>
		</div>

		<!-- Comparison Section -->
		<div class="mt-20">
			<h2 class="mb-10 text-center text-3xl font-bold tracking-tight">The Old Way vs. The Integrated Way</h2>
			<div class="overflow-hidden rounded-2xl border border-surface-200 bg-surface-50/50 shadow-sm dark:border-surface-800 dark:bg-surface-900/50">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b border-surface-200 bg-surface-100/50 dark:border-surface-800 dark:bg-surface-800/50">
								<th class="whitespace-nowrap px-6 py-4 font-semibold text-surface-900 dark:text-surface-100">Feature</th>
								<th class="whitespace-nowrap px-6 py-4 font-medium text-surface-500">The Old Status Quo</th>
								<th class="whitespace-nowrap px-6 py-4 font-bold text-primary-600 dark:text-primary-400">Your Integrated Platform</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-200 dark:divide-surface-800">
							<tr class="group transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50">
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Estimates</td>
								<td class="px-6 py-4 text-surface-600 dark:text-surface-400">"4-hour 'Wait Windows' for on-site visits."</td>
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Instant: AI-driven bids from photos.</td>
							</tr>
							<tr class="group transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50">
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">HOA Approvals</td>
								<td class="px-6 py-4 text-surface-600 dark:text-surface-400">30-day manual email & paper chains.</td>
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Autonomous: Logic-based ARC routing.</td>
							</tr>
							<tr class="group transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50">
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Data Flow</td>
								<td class="px-6 py-4 text-surface-600 dark:text-surface-400">Manually re-typing data into three apps.</td>
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Unified: Data flows via a central pillar.</td>
							</tr>
							<tr class="group transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50">
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Communication</td>
								<td class="px-6 py-4 text-surface-600 dark:text-surface-400">"He said, she said" phone tag.</td>
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Audit Trail: Every photo & bid is logged.</td>
							</tr>
							<tr class="group transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50">
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Visibility</td>
								<td class="px-6 py-4 text-surface-600 dark:text-surface-400">Homeowners left in the dark.</td>
								<td class="px-6 py-4 font-medium text-surface-900 dark:text-surface-100">Live Tracker: Real-time project status.</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</PageContainer>
