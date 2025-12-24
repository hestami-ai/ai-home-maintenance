<script lang="ts">
	import {
		ArrowLeft,
		Bell,
		Mail,
		Smartphone,
		MessageSquare,
		Loader2,
		Check,
		Wrench,
		DollarSign,
		FileText,
		Calendar
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';

	interface NotificationCategory {
		id: string;
		label: string;
		description: string;
		icon: typeof Bell;
		email: boolean;
		push: boolean;
	}

	let isSaving = $state(false);
	let saveSuccess = $state(false);

	let categories = $state<NotificationCategory[]>([
		{
			id: 'service_calls',
			label: 'Service Call Updates',
			description: 'Status changes, scheduling updates, and completion notices',
			icon: Wrench,
			email: true,
			push: true
		},
		{
			id: 'quotes',
			label: 'Quote Notifications',
			description: 'New quotes received, quote approvals, and pricing updates',
			icon: DollarSign,
			email: true,
			push: true
		},
		{
			id: 'messages',
			label: 'Messages',
			description: 'Messages from your concierge team and service providers',
			icon: MessageSquare,
			email: true,
			push: true
		},
		{
			id: 'documents',
			label: 'Document Updates',
			description: 'New documents uploaded, processing complete, expiration reminders',
			icon: FileText,
			email: false,
			push: true
		},
		{
			id: 'reminders',
			label: 'Reminders',
			description: 'Scheduled maintenance reminders and appointment notifications',
			icon: Calendar,
			email: true,
			push: true
		}
	]);

	let emailDigest = $state<'instant' | 'daily' | 'weekly'>('daily');

	async function saveSettings() {
		isSaving = true;
		saveSuccess = false;

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));

		isSaving = false;
		saveSuccess = true;

		// Clear success message after 3 seconds
		setTimeout(() => {
			saveSuccess = false;
		}, 3000);
	}

	function toggleEmail(categoryId: string) {
		categories = categories.map((c) =>
			c.id === categoryId ? { ...c, email: !c.email } : c
		);
	}

	function togglePush(categoryId: string) {
		categories = categories.map((c) =>
			c.id === categoryId ? { ...c, push: !c.push } : c
		);
	}
</script>

<svelte:head>
	<title>Notification Settings | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/concierge/notifications"
				class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Notifications
			</a>
			<h1 class="text-2xl font-bold">Notification Settings</h1>
			<p class="mt-1 text-surface-500">
				Choose how and when you want to be notified
			</p>
		</div>

		{#if saveSuccess}
			<div
				class="mb-6 flex items-center gap-2 rounded-lg bg-success-500/10 p-4 text-success-600 dark:text-success-400"
			>
				<Check class="h-5 w-5" />
				<span>Settings saved successfully!</span>
			</div>
		{/if}

		<div class="space-y-6">
			<!-- Notification Categories -->
			<Card variant="outlined" padding="md">
				<h2 class="mb-4 font-semibold">Notification Categories</h2>
				<p class="mb-6 text-sm text-surface-500">
					Choose which types of notifications you want to receive and how.
				</p>

				<div class="space-y-4">
					<!-- Header Row -->
					<div class="hidden items-center gap-4 border-b border-surface-300-700 pb-3 sm:flex">
						<div class="flex-1"></div>
						<div class="flex w-32 items-center justify-center gap-2 text-sm font-medium">
							<Mail class="h-4 w-4" />
							Email
						</div>
						<div class="flex w-32 items-center justify-center gap-2 text-sm font-medium">
							<Smartphone class="h-4 w-4" />
							Push
						</div>
					</div>

					{#each categories as category (category.id)}
						{@const Icon = category.icon}
						<div
							class="flex flex-col gap-4 border-b border-surface-300-700 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center"
						>
							<div class="flex flex-1 items-start gap-3">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-500/10"
								>
									<Icon class="h-5 w-5 text-surface-500" />
								</div>
								<div>
									<h3 class="font-medium">{category.label}</h3>
									<p class="text-sm text-surface-500">{category.description}</p>
								</div>
							</div>

							<div class="flex gap-4 sm:gap-0">
								<!-- Email Toggle -->
								<div class="flex w-32 items-center justify-center">
									<label class="flex items-center gap-2 sm:hidden">
										<Mail class="h-4 w-4 text-surface-500" />
									</label>
									<button
										type="button"
										onclick={() => toggleEmail(category.id)}
										class="relative h-6 w-11 rounded-full transition-colors {category.email
											? 'bg-primary-500'
											: 'bg-surface-300 dark:bg-surface-600'}"
										role="switch"
										aria-checked={category.email}
										aria-label="Toggle email notifications for {category.label}"
									>
										<span
											class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {category.email
												? 'translate-x-5'
												: 'translate-x-0'}"
										></span>
									</button>
								</div>

								<!-- Push Toggle -->
								<div class="flex w-32 items-center justify-center">
									<label class="flex items-center gap-2 sm:hidden">
										<Smartphone class="h-4 w-4 text-surface-500" />
									</label>
									<button
										type="button"
										onclick={() => togglePush(category.id)}
										class="relative h-6 w-11 rounded-full transition-colors {category.push
											? 'bg-primary-500'
											: 'bg-surface-300 dark:bg-surface-600'}"
										role="switch"
										aria-checked={category.push}
										aria-label="Toggle push notifications for {category.label}"
									>
										<span
											class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {category.push
												? 'translate-x-5'
												: 'translate-x-0'}"
										></span>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</Card>

			<!-- Email Digest Frequency -->
			<Card variant="outlined" padding="md">
				<h2 class="mb-4 font-semibold">Email Digest</h2>
				<p class="mb-4 text-sm text-surface-500">
					How often would you like to receive email summaries?
				</p>

				<div class="space-y-3">
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="radio"
							name="emailDigest"
							value="instant"
							bind:group={emailDigest}
							class="radio"
						/>
						<div>
							<span class="font-medium">Instant</span>
							<p class="text-sm text-surface-500">Receive emails as events happen</p>
						</div>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="radio"
							name="emailDigest"
							value="daily"
							bind:group={emailDigest}
							class="radio"
						/>
						<div>
							<span class="font-medium">Daily Digest</span>
							<p class="text-sm text-surface-500">One email per day with all updates</p>
						</div>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="radio"
							name="emailDigest"
							value="weekly"
							bind:group={emailDigest}
							class="radio"
						/>
						<div>
							<span class="font-medium">Weekly Digest</span>
							<p class="text-sm text-surface-500">One email per week with all updates</p>
						</div>
					</label>
				</div>
			</Card>

			<!-- Save Button -->
			<div class="flex justify-end">
				<button
					type="button"
					onclick={saveSettings}
					class="btn preset-filled-primary-500"
					disabled={isSaving}
				>
					{#if isSaving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<Check class="mr-2 h-4 w-4" />
						Save Settings
					{/if}
				</button>
			</div>
		</div>
	</div>
</PageContainer>
