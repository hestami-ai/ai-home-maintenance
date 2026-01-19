<script lang="ts">
	import {
		Bell,
		Check,
		CheckCheck,
		Wrench,
		FileText,
		MessageSquare,
		DollarSign,
		Home,
		Loader2,
		Settings,
		Filter
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { invalidateAll } from '$app/navigation';

	interface Notification {
		id: string;
		type: 'service_call' | 'quote' | 'message' | 'document' | 'property';
		title: string;
		message: string;
		isRead: boolean;
		createdAt: string;
		linkUrl?: string;
		entityId?: string;
	}

	interface Props {
		data: {
			notifications: Notification[];
		};
	}

	let { data }: Props = $props();

	let notifications = $state<Notification[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let filterType = $state<string>('all');

	// Synchronize server data to local state for reactive mark-as-read
	$effect(() => {
		if (!data) return;
		if (data.notifications) {
			notifications = [...data.notifications];
		}
	});

	const notificationTypes = [
		{ value: 'all', label: 'All Notifications' },
		{ value: 'service_call', label: 'Service Calls' },
		{ value: 'quote', label: 'Quotes' },
		{ value: 'message', label: 'Messages' },
		{ value: 'document', label: 'Documents' }
	];

	const filteredNotifications = $derived(
		filterType === 'all'
			? notifications
			: notifications.filter((n) => n.type === filterType)
	);

	const unreadCount = $derived(notifications.filter((n) => !n.isRead).length);



	function getStatusNotificationTitle(status: string): string {
		const titles: Record<string, string> = {
			INTAKE: 'Service Call Submitted',
			TRIAGE: 'Service Call Under Review',
			QUOTE_REQUESTED: 'Quotes Requested',
			QUOTE_RECEIVED: 'Quote Received',
			QUOTE_APPROVED: 'Quote Approved',
			SCHEDULED: 'Service Scheduled',
			IN_PROGRESS: 'Work In Progress',
			COMPLETED: 'Service Completed',
			CLOSED: 'Service Call Closed'
		};
		return titles[status] || 'Service Call Update';
	}

	function getStatusMessage(status: string): string {
		const messages: Record<string, string> = {
			INTAKE: 'Your service call has been received and is being reviewed.',
			TRIAGE: 'Our team is reviewing your request.',
			QUOTE_REQUESTED: 'We are gathering quotes from service providers.',
			QUOTE_RECEIVED: 'A quote is ready for your review.',
			QUOTE_APPROVED: 'The quote has been approved. Work will be scheduled.',
			SCHEDULED: 'Your service has been scheduled.',
			IN_PROGRESS: 'Work is currently in progress.',
			COMPLETED: 'The work has been completed.',
			CLOSED: 'This service call has been closed.'
		};
		return messages[status] || 'Status has been updated.';
	}

	function getNotificationIcon(type: string) {
		switch (type) {
			case 'service_call':
				return Wrench;
			case 'quote':
				return DollarSign;
			case 'message':
				return MessageSquare;
			case 'document':
				return FileText;
			case 'property':
				return Home;
			default:
				return Bell;
		}
	}

	function formatDate(dateString: string): string {
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

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function markAsRead(id: string) {
		notifications = notifications.map((n) =>
			n.id === id ? { ...n, isRead: true } : n
		);
	}

	function markAllAsRead() {
		notifications = notifications.map((n) => ({ ...n, isRead: true }));
	}

</script>

<svelte:head>
	<title>Notifications | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Notifications</h1>
				<p class="mt-1 text-surface-500">
					{#if unreadCount > 0}
						You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
					{:else}
						All caught up!
					{/if}
				</p>
			</div>
			<div class="flex gap-2">
				{#if unreadCount > 0}
					<button type="button" onclick={markAllAsRead} class="btn preset-tonal-surface">
						<CheckCheck class="mr-2 h-4 w-4" />
						Mark All Read
					</button>
				{/if}
				<a href="/app/concierge/settings/notifications" class="btn preset-tonal-surface">
					<Settings class="mr-2 h-4 w-4" />
					Settings
				</a>
			</div>
		</div>

		<!-- Filter -->
		<div class="mt-6">
			<select bind:value={filterType} class="select w-full sm:w-48">
				{#each notificationTypes as type}
					<option value={type.value}>{type.label}</option>
				{/each}
			</select>
		</div>

		<!-- Notifications List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="md">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={() => invalidateAll()} class="btn preset-tonal-primary mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if notifications.length === 0}
				<Card variant="outlined" padding="none">
					<div class="p-6">
						<EmptyState
							title="No notifications yet"
							description="You'll receive notifications when there are updates to your service calls, quotes, and more."
						>
							{#snippet actions()}
								<a href="/app/concierge" class="btn preset-filled-primary-500">
									Go to Dashboard
								</a>
							{/snippet}
						</EmptyState>
					</div>
				</Card>
			{:else if filteredNotifications.length === 0}
				<Card variant="outlined" padding="md">
					<p class="text-center text-surface-500">No notifications match this filter.</p>
				</Card>
			{:else}
				<div class="space-y-2">
					{#each filteredNotifications as notification (notification.id)}
						{@const Icon = getNotificationIcon(notification.type)}
						<a
							href={notification.linkUrl || '#'}
							onclick={() => markAsRead(notification.id)}
							class="flex items-start gap-4 rounded-lg border p-4 transition-all hover:border-primary-500 hover:bg-surface-500/5 {notification.isRead
								? 'border-surface-300-700 bg-transparent'
								: 'border-primary-500/30 bg-primary-500/5'}"
						>
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {notification.isRead
									? 'bg-surface-500/10'
									: 'bg-primary-500/10'}"
							>
								<Icon
									class="h-5 w-5 {notification.isRead
										? 'text-surface-500'
										: 'text-primary-500'}"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-2">
									<h3
										class="font-medium {notification.isRead
											? 'text-surface-600 dark:text-surface-400'
											: ''}"
									>
										{notification.title}
									</h3>
									<span class="shrink-0 text-xs text-surface-500">
										{formatDate(notification.createdAt)}
									</span>
								</div>
								<p class="mt-1 text-sm text-surface-500">{notification.message}</p>
							</div>
							{#if !notification.isRead}
								<div class="shrink-0">
									<span class="h-2 w-2 rounded-full bg-primary-500 block"></span>
								</div>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
