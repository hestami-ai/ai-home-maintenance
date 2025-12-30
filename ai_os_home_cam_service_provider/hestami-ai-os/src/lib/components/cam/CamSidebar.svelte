<script lang="ts">
	import { page } from '$app/stores';
	import {
		LayoutDashboard,
		Building2,
		Home,
		AlertTriangle,
		ClipboardCheck,
		Wrench,
		Users,
		FileText,
		DollarSign,
		Gavel,
		BarChart3,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';

	interface BadgeCounts {
		violations: number;
		arcRequests: number;
		workOrders: number;
	}

	interface NavItem {
		label: string;
		href: string;
		icon: typeof LayoutDashboard;
		badgeKey?: keyof BadgeCounts;
	}

	interface Props {
		badgeCounts: BadgeCounts;
	}

	let { badgeCounts }: Props = $props();
	let isSidebarCollapsed = $state(false);

	const navItems: NavItem[] = [
		{ label: 'Dashboard', href: '/app/cam', icon: LayoutDashboard },
		{ label: 'Associations', href: '/app/cam/associations', icon: Building2 },
		{ label: 'Units & Properties', href: '/app/cam/units', icon: Home },
		{ label: 'Violations', href: '/app/cam/violations', icon: AlertTriangle, badgeKey: 'violations' },
		{ label: 'ARC Requests', href: '/app/cam/arc', icon: ClipboardCheck, badgeKey: 'arcRequests' },
		{ label: 'Work Orders', href: '/app/cam/work-orders', icon: Wrench, badgeKey: 'workOrders' },
		{ label: 'Vendors', href: '/app/cam/vendors', icon: Users },
		{ label: 'Documents & Records', href: '/app/cam/documents', icon: FileText },
		{ label: 'Accounting', href: '/app/cam/accounting', icon: DollarSign },
		{ label: 'Governance', href: '/app/cam/governance', icon: Gavel },
		{ label: 'Reports', href: '/app/cam/reports', icon: BarChart3 }
	];

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/app/cam') {
			return currentPath === '/app/cam';
		}
		return currentPath.startsWith(href);
	}

	function toggleSidebar() {
		isSidebarCollapsed = !isSidebarCollapsed;
	}
</script>

<aside
	class="flex h-full flex-col border-r border-surface-300-700 bg-surface-50-950 transition-all duration-300"
	class:w-64={!isSidebarCollapsed}
	class:w-16={isSidebarCollapsed}
>
	<nav class="flex-1 overflow-y-auto px-2 py-4">
		<ul class="space-y-1">
			{#each navItems as item}
				{@const active = isActive(item.href)}
				{@const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0}
				<li>
					<a
						href={item.href}
						class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
						class:bg-primary-500={active}
						class:text-white={active}
						class:hover:bg-surface-200-800={!active}
						class:text-surface-700-300={!active}
						title={isSidebarCollapsed ? item.label : undefined}
					>
						<item.icon class="h-5 w-5 flex-shrink-0" />
						{#if !isSidebarCollapsed}
							<span class="flex-1 truncate">{item.label}</span>
							{#if badge > 0}
								<span
									class="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold"
									class:bg-white={active}
									class:text-primary-500={active}
									class:bg-error-500={!active}
									class:text-white={!active}
								>
									{badge > 99 ? '99+' : badge}
								</span>
							{/if}
						{:else if badge > 0}
							<span
								class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-semibold text-white"
							>
								{badge > 9 ? '9+' : badge}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="border-t border-surface-300-700 p-2">
		<button
			type="button"
			onclick={toggleSidebar}
			class="flex w-full items-center justify-center rounded-lg p-2 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
			title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			{#if isSidebarCollapsed}
				<ChevronRight class="h-5 w-5" />
			{:else}
				<ChevronLeft class="h-5 w-5" />
			{/if}
		</button>
	</div>
</aside>
