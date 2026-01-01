<script lang="ts">
	import { page } from '$app/stores';
	import {
		Users,
		Settings,
		Shield,
		Activity,
		ChevronRight,
		Inbox,
		Briefcase,
		Building2,
		FileText,
		Home,
		Truck,
		LayoutDashboard
	} from 'lucide-svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	interface NavSection {
		title: string;
		items: { label: string; href: string; icon: typeof Inbox }[];
	}

	const navSections: NavSection[] = [
		{
			title: 'Operations',
			items: [
				{ label: 'Work Queue', href: '/app/admin/work-queue', icon: Inbox },
				{ label: 'Document Processing', href: '/app/admin/document-processing', icon: Activity },
				{ label: 'Cases', href: '/app/admin/cases', icon: Briefcase },
				{ label: 'Vendors', href: '/app/admin/vendors', icon: Truck }
			]
		},
		{
			title: 'Management',
			items: [
				{ label: 'Properties', href: '/app/admin/properties', icon: Home },
				{ label: 'Customers', href: '/app/admin/customers', icon: Users },
				{ label: 'Documents', href: '/app/admin/documents', icon: FileText }
			]
		},
		{
			title: 'Administration',
			items: [
				{ label: 'Staff', href: '/app/admin/staff', icon: Users },
				{ label: 'Activity Log', href: '/app/admin/activity', icon: Activity },
				{ label: 'Permissions', href: '/app/admin/permissions', icon: Shield },
				{ label: 'Settings', href: '/app/admin/settings', icon: Settings }
			]
		}
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>System Administration | Hestami AI</title>
</svelte:head>

<div class="flex h-[calc(100vh-4rem)]">
	<!-- Sidebar -->
	<aside class="w-64 flex-shrink-0 border-r border-surface-300-700 bg-surface-50-950 overflow-y-auto">
		<div class="p-4 border-b border-surface-300-700">
			<h2 class="text-lg font-semibold">Staff Portal</h2>
			<p class="text-sm text-surface-500">Hestami Operations</p>
		</div>
		<nav class="p-2">
			{#each navSections as section, sectionIndex}
				<div class="{sectionIndex > 0 ? 'mt-4 pt-4 border-t border-surface-200-800' : ''}">
					<h3 class="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-surface-400">
						{section.title}
					</h3>
					<div class="mt-1 space-y-0.5">
						{#each section.items as item}
							<a
								href={item.href}
								class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive(item.href)
									? 'bg-primary-500/10 text-primary-500 font-medium'
									: 'text-surface-600 hover:bg-surface-200-800 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100'}"
							>
								<item.icon class="h-4 w-4" />
								<span>{item.label}</span>
								{#if isActive(item.href)}
									<ChevronRight class="ml-auto h-4 w-4" />
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
