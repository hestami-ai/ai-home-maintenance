<script lang="ts">
	import { UserRoleValues } from '$lib/api/cam';
	import { Plus, Mail, Copy, RefreshCw, XCircle, CheckCircle, Users, UserPlus } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		invitationApi,
		type InvitationListItem,
		INVITATION_STATUS_LABELS,
		INVITATION_STATUS_COLORS,
		InvitationStatusValues
	} from '$lib/api/invitation.js';

	let invitations = $state<InvitationListItem[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let showCreateModal = $state(false);
	let showCodeModal = $state(false);
	let generatedCode = $state<string | null>(null);
	let createdInvitationEmail = $state<string | null>(null);

	// Create form state
	let newEmail = $state('');
	let newRole = $state('FAMILY_MEMBER');
	let isCreating = $state(false);
	let createError = $state<string | null>(null);

	const roleOptions = [
		{ value: 'FAMILY_MEMBER', label: 'Family Member', description: 'Full access to property information and service requests' },
		{ value: 'PROPERTY_MANAGER', label: 'Property Manager', description: 'Manage property on your behalf' },
		{ value: UserRoleValues.TENANT, label: 'Tenant', description: 'Limited access for current tenants' },
		{ value: 'CARETAKER', label: 'Caretaker', description: 'Access for property caretakers' }
	];

	async function loadInvitations() {
		isLoading = true;
		error = null;
		try {
			const response = await invitationApi.list();
			if (response.ok) {
				invitations = response.data.invitations;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load invitations';
		} finally {
			isLoading = false;
		}
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (!newEmail) return;

		isCreating = true;
		createError = null;

		try {
			const response = await invitationApi.create({
				email: newEmail,
				role: newRole,
				deliveryMethod: 'CODE'
			});

			if (response.ok) {
				generatedCode = response.data.activationCode ?? null;
				createdInvitationEmail = newEmail;
				showCreateModal = false;
				showCodeModal = true;
				newEmail = '';
				newRole = 'FAMILY_MEMBER';
				await loadInvitations();
			}
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Failed to create invitation';
		} finally {
			isCreating = false;
		}
	}

	async function handleResend(invitationId: string) {
		try {
			const response = await invitationApi.resend(invitationId);
			if (response.ok && response.data.activationCode) {
				const inv = invitations.find(i => i.id === invitationId);
				generatedCode = response.data.activationCode;
				createdInvitationEmail = inv?.email ?? null;
				showCodeModal = true;
			}
			await loadInvitations();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to resend invitation';
		}
	}

	async function handleRevoke(invitationId: string) {
		if (!confirm('Are you sure you want to revoke this invitation?')) return;

		try {
			await invitationApi.revoke(invitationId);
			await loadInvitations();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to revoke invitation';
		}
	}

	function copyCode() {
		if (generatedCode) {
			navigator.clipboard.writeText(generatedCode);
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function isExpired(expiresAt: string): boolean {
		return new Date(expiresAt) < new Date();
	}

	$effect(() => {
		loadInvitations();
	});
</script>

<svelte:head>
	<title>Access Sharing | Concierge</title>
</svelte:head>

<PageContainer>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Access Sharing</h1>
			<p class="mt-1 text-surface-500">Share access to your properties with family members, tenants, or property managers</p>
		</div>
		<button
			class="btn preset-filled-primary-500"
			onclick={() => showCreateModal = true}
		>
			<UserPlus class="h-4 w-4" />
			Share Access
		</button>
	</div>

	{#if error}
		<div class="mt-4 rounded-lg bg-error-50 p-4 text-error-700 dark:bg-error-900/20 dark:text-error-400">
			{error}
		</div>
	{/if}

	<div class="mt-6">
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="loading loading-spinner loading-lg"></div>
			</div>
		{:else if invitations.length === 0}
			<EmptyState
				icon={Users}
				title="No shared access yet"
				description="Share access to your properties with family members, tenants, or property managers."
			/>
		{:else}
			<Card variant="outlined" padding="none">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800">
							<tr>
								<th class="px-4 py-3 text-left text-sm font-medium text-surface-600 dark:text-surface-400">Email</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-surface-600 dark:text-surface-400">Access Level</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-surface-600 dark:text-surface-400">Status</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-surface-600 dark:text-surface-400">Expires</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-surface-600 dark:text-surface-400">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-200 dark:divide-surface-700">
							{#each invitations as invitation}
								<tr class="hover:bg-surface-50 dark:hover:bg-surface-800/50">
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<Mail class="h-4 w-4 text-surface-400" />
											<span class="font-medium">{invitation.email}</span>
										</div>
									</td>
									<td class="px-4 py-3 text-sm">{invitation.role}</td>
									<td class="px-4 py-3">
										{#if invitation.status === InvitationStatusValues.PENDING && isExpired(invitation.expiresAt)}
											<span class="badge preset-filled-surface-500">Expired</span>
										{:else}
											<span class="badge preset-filled-{INVITATION_STATUS_COLORS[invitation.status]}-500">
												{INVITATION_STATUS_LABELS[invitation.status]}
											</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-sm text-surface-500">
										{formatDate(invitation.expiresAt)}
									</td>
									<td class="px-4 py-3 text-right">
										{#if invitation.status === InvitationStatusValues.PENDING}
											<div class="flex items-center justify-end gap-2">
												<button
													class="btn btn-sm preset-tonal"
													title="Resend invitation"
													onclick={() => handleResend(invitation.id)}
												>
													<RefreshCw class="h-4 w-4" />
												</button>
												<button
													class="btn btn-sm preset-tonal-error"
													title="Revoke invitation"
													onclick={() => handleRevoke(invitation.id)}
												>
													<XCircle class="h-4 w-4" />
												</button>
											</div>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/if}
	</div>
</PageContainer>

<!-- Create Invitation Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card variant="filled" padding="lg" class="w-full max-w-md">
			<h2 class="text-xl font-semibold">Share Property Access</h2>
			<p class="mt-1 text-sm text-surface-500">
				Invite someone to access your property information
			</p>

			<form onsubmit={handleCreate} class="mt-6 space-y-4">
				<div>
					<label for="email" class="block text-sm font-medium">Email Address</label>
					<input
						type="email"
						id="email"
						bind:value={newEmail}
						placeholder="family@example.com"
						class="input mt-1 w-full"
						required
					/>
				</div>

				<fieldset>
					<legend class="block text-sm font-medium mb-2">Access Level</legend>
					<div class="space-y-2">
						{#each roleOptions as option}
							<button
								type="button"
								onclick={() => newRole = option.value}
								class="w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left {newRole === option.value
									? 'border-primary-500 bg-primary-500/10'
									: 'border-surface-300 dark:border-surface-600 hover:border-surface-400'}"
							>
								<div class="flex-shrink-0 mt-0.5">
									<div
										class="h-4 w-4 rounded-full border-2 flex items-center justify-center {newRole === option.value
											? 'border-primary-500 bg-primary-500'
											: 'border-surface-400'}"
									>
										{#if newRole === option.value}
											<div class="h-1.5 w-1.5 rounded-full bg-white"></div>
										{/if}
									</div>
								</div>
								<div>
									<p class="font-medium text-sm">{option.label}</p>
									<p class="text-xs text-surface-500">{option.description}</p>
								</div>
							</button>
						{/each}
					</div>
				</fieldset>

				{#if createError}
					<div class="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">
						{createError}
					</div>
				{/if}

				<div class="flex justify-end gap-3 pt-4">
					<button
						type="button"
						class="btn preset-tonal"
						onclick={() => showCreateModal = false}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn preset-filled-primary-500"
						disabled={isCreating || !newEmail}
					>
						{#if isCreating}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Send Invitation
					</button>
				</div>
			</form>
		</Card>
	</div>
{/if}

<!-- Activation Code Modal -->
{#if showCodeModal && generatedCode}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card variant="filled" padding="lg" class="w-full max-w-md text-center">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-500/20">
				<CheckCircle class="h-6 w-6 text-success-500" />
			</div>
			<h2 class="mt-4 text-xl font-semibold">Invitation Sent!</h2>
			<p class="mt-2 text-sm text-surface-500">
				Share this code with <strong>{createdInvitationEmail}</strong>
			</p>

			<div class="mt-6 rounded-lg bg-surface-100 p-4 dark:bg-surface-800">
				<p class="text-3xl font-mono font-bold tracking-widest">{generatedCode}</p>
			</div>

			<button
				class="btn preset-tonal mt-4 w-full"
				onclick={copyCode}
			>
				<Copy class="h-4 w-4" />
				Copy Code
			</button>

			<p class="mt-4 text-xs text-surface-500">
				This code expires in 72 hours. They can use it at the "Join Organization" page after signing up.
			</p>

			<button
				class="btn preset-filled-primary-500 mt-6 w-full"
				onclick={() => { showCodeModal = false; generatedCode = null; }}
			>
				Done
			</button>
		</Card>
	</div>
{/if}
