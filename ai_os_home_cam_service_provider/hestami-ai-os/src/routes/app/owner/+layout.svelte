<script lang="ts">
	import { page } from '$app/stores';
	import { Home, FileText, Briefcase, MessageSquare } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	const navItems = [
		{ href: '/app/owner', label: 'Dashboard', icon: Home, exact: true },
		{ href: '/app/owner/cases', label: 'My Cases', icon: Briefcase },
		{ href: '/app/owner/documents', label: 'Documents', icon: FileText },
		{ href: '/app/owner/messages', label: 'Messages', icon: MessageSquare }
	];

	function isActive(href: string, exact: boolean = false): boolean {
		if (exact) {
			return $page.url.pathname === href;
		}
		return $page.url.pathname.startsWith(href);
	}
</script>

<div class="flex min-h-screen">
	<!-- Sidebar Navigation -->
	<aside class="hidden w-64 border-r border-surface-300-700 bg-surface-50-950 lg:block">
		<div class="flex h-full flex-col">
			<div class="border-b border-surface-300-700 p-4">
				<h2 class="text-lg font-semibold">Owner Portal</h2>
			</div>
			<nav class="flex-1 space-y-1 p-4">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
							item.href,
							item.exact
						)
							? 'bg-primary-500/10 text-primary-500'
							: 'text-surface-600 hover:bg-surface-200-800 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100'}"
					>
						<item.icon class="h-5 w-5" />
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="flex-1">
		{@render children()}
	</main>
</div>
