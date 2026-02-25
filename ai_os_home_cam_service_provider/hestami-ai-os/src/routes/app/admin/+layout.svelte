<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		Users,
		Settings,
		Shield,
		Activity,
		ChevronRight,
		ChevronLeft,
		Inbox,
		Briefcase,
		Building2,
		FileText,
		Home,
		Truck,
		LayoutDashboard,
		PanelLeftClose,
		PanelLeft,
		Headphones,
		Gavel,
		Wrench
	} from 'lucide-svelte';
	import { getSidebarCollapsed, setSidebarCollapsed } from '$lib/stores/navigationState';
	import { PillarAccessValues } from '$lib/api/cam';

	interface Props {
		data: {
			staff: {
				pillarAccess: string[];
				roles: string[];
			} | null;
		};
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// Sidebar collapse state
	let sidebarCollapsed = $state(false);

	// Load persisted state on mount
	onMount(() => {
		sidebarCollapsed = getSidebarCollapsed();
	});

	// Toggle sidebar and persist
	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
		setSidebarCollapsed(sidebarCollapsed);
	}

	// Pillar access check helpers
	const staffPillars = $derived(data?.staff?.pillarAccess || []);
	const hasAdminAccess = $derived(staffPillars.includes(PillarAccessValues.ADMIN));
	const hasConcierge = $derived(hasAdminAccess || staffPillars.includes(PillarAccessValues.CONCIERGE));
	const hasCAM = $derived(hasAdminAccess || staffPillars.includes(PillarAccessValues.CAM));
	const hasContractor = $derived(hasAdminAccess || staffPillars.includes(PillarAccessValues.CONTRACTOR));
	const isAdmin = $derived(data?.staff?.roles?.includes('SUPER_ADMIN') || data?.staff?.roles?.includes('ADMIN'));

	interface NavItem {
		label: string;
		href: string;
		icon: typeof Inbox;
		requiredPillar?: string;
		adminOnly?: boolean;
	}

	interface NavSection {
		title: string;
		items: NavItem[];
	}

	const allNavSections: NavSection[] = [
		{
			title: 'Core Operations',
			items: [
				{ label: 'Work Queue', href: '/app/admin/work-queue', icon: Inbox },
				{ label: 'Document Processing', href: '/app/admin/document-processing', icon: Activity }
			]
		},
		{
			title: 'Concierge',
			items: [
				{ label: 'Cases', href: '/app/admin/cases', icon: Briefcase, requiredPillar: PillarAccessValues.CONCIERGE },
				{ label: 'Vendors', href: '/app/admin/vendors', icon: Truck, requiredPillar: PillarAccessValues.CONCIERGE },
				{ label: 'Properties', href: '/app/admin/properties', icon: Home, requiredPillar: PillarAccessValues.CONCIERGE }
			]
		},
		{
			title: 'CAM & Governance',
			items: [
				{ label: 'Organizations', href: '/app/admin/organizations', icon: Building2, requiredPillar: PillarAccessValues.CAM },
				{ label: 'Documents', href: '/app/admin/documents', icon: FileText, requiredPillar: PillarAccessValues.CAM }
			]
		},
		{
			title: 'Contractor',
			items: [
				{ label: 'Jobs', href: '/app/admin/jobs', icon: Wrench, requiredPillar: PillarAccessValues.CONTRACTOR }
			]
		},
		{
			title: 'Administration',
			items: [
				{ label: 'Staff', href: '/app/admin/staff', icon: Users, adminOnly: true },
				{ label: 'Activity Log', href: '/app/admin/activity', icon: Activity },
				{ label: 'Permissions', href: '/app/admin/permissions', icon: Shield, adminOnly: true },
				{ label: 'Settings', href: '/app/admin/settings', icon: Settings }
			]
		}
	];

	// Filter nav sections based on pillar access
	const navSections = $derived(() => {
		return allNavSections
			.map(section => ({
				...section,
				items: section.items.filter(item => {
					// Check admin-only items
					if (item.adminOnly && !isAdmin) return false;
					// Check pillar access
					if (!item.requiredPillar) return true;
					if (hasAdminAccess) return true;
					return staffPillars.includes(item.requiredPillar);
				})
			}))
			.filter(section => section.items.length > 0);
	});

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>System Administration | Hestami AI</title>
</svelte:head>

<div class="flex h-[calc(100vh-4rem)]">
	<!-- Sidebar -->
	<aside class="{sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-surface-300-700 bg-surface-50-950 overflow-y-auto transition-all duration-200">
		<div class="p-4 border-b border-surface-300-700 flex items-center justify-between">
			{#if !sidebarCollapsed}
				<div>
					<h2 class="text-lg font-semibold">Staff Portal</h2>
					<p class="text-sm text-surface-500">Hestami Operations</p>
				</div>
			{/if}
			<button
				onclick={toggleSidebar}
				class="p-1 rounded hover:bg-surface-200-800 text-surface-500"
				title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				{#if sidebarCollapsed}
					<PanelLeft class="h-5 w-5" />
				{:else}
					<PanelLeftClose class="h-5 w-5" />
				{/if}
			</button>
		</div>
		<nav class="p-2">
			{#each navSections() as section, sectionIndex}
				<div class="{sectionIndex > 0 ? 'mt-4 pt-4 border-t border-surface-200-800' : ''}">
					{#if !sidebarCollapsed}
						<h3 class="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-surface-400">
							{section.title}
						</h3>
					{/if}
					<div class="mt-1 space-y-0.5">
						{#each section.items as item}
							<a
								href={item.href}
								class="flex items-center {sidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-lg {sidebarCollapsed ? 'p-2' : 'px-3 py-2'} text-sm transition-colors {isActive(item.href)
									? 'bg-primary-500/10 text-primary-500 font-medium'
									: 'text-surface-600 hover:bg-surface-200-800 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100'}"
								title={sidebarCollapsed ? item.label : ''}
							>
								<item.icon class="h-4 w-4 flex-shrink-0" />
								{#if !sidebarCollapsed}
									<span>{item.label}</span>
									{#if isActive(item.href)}
										<ChevronRight class="ml-auto h-4 w-4" />
									{/if}
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="flex-1 overflow-auto bg-surface-100-900">
		{@render children()}
	</main>
</div>
