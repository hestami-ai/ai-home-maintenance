<script lang="ts">
	import { ServiceProviderRoleValues } from '$lib/api/cam';
	import { page } from '$app/stores';
	import {
		ArrowLeft,
		Loader2,
		Save,
		Shield,
		Check
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import {
		serviceProviderTeamApi,
		SERVICE_PROVIDER_ROLE_LABELS,
		SERVICE_PROVIDER_ROLE_DESCRIPTIONS,
		type ServiceProviderTeamMember,
		type ServiceProviderRole
	} from '$lib/api/serviceProviderTeam';

	const ALL_ROLES: ServiceProviderRole[] = [
		ServiceProviderRoleValues.OWNER,
		ServiceProviderRoleValues.ADMIN,
		ServiceProviderRoleValues.OFFICE_MANAGER,
		ServiceProviderRoleValues.DISPATCHER,
		ServiceProviderRoleValues.ESTIMATOR,
		ServiceProviderRoleValues.BOOKKEEPER,
		ServiceProviderRoleValues.TECHNICIAN
	];

	interface Props {
		data: {
			teamMember: ServiceProviderTeamMember | null;
			error: string | null;
		};
	}

	let { data }: Props = $props();

	let teamMember = $state<ServiceProviderTeamMember | null>(null);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);

	let selectedRoles = $state<Set<ServiceProviderRole>>(new Set());

	const teamMemberId = $derived($page.params.id ?? '');

	// Initialize and sync with server data
	$effect(() => {
		if (!data) return;
		if (data.teamMember !== teamMember) teamMember = data.teamMember;
		if (data.error !== error) error = data.error;
		if (data.teamMember) {
			selectedRoles = new Set(data.teamMember.roles);
		}
	});

	function toggleRole(role: ServiceProviderRole) {
		// Don't allow removing OWNER role if it's the only OWNER
		if (role === ServiceProviderRoleValues.OWNER && selectedRoles.has(ServiceProviderRoleValues.OWNER)) {
			// For now, allow it - the backend should validate
		}

		const newRoles = new Set(selectedRoles);
		if (newRoles.has(role)) {
			newRoles.delete(role);
		} else {
			newRoles.add(role);
		}
		selectedRoles = newRoles;
		saveSuccess = false;
	}

	async function handleSave() {
		if (!teamMember || selectedRoles.size === 0) return;

		isSaving = true;
		saveError = null;
		saveSuccess = false;

		try {
			const response = await serviceProviderTeamApi.updateRoles({
				teamMemberId: teamMember.id,
				roles: Array.from(selectedRoles)
			});
			if (response.ok) {
				teamMember = response.data.teamMember as ServiceProviderTeamMember;
				selectedRoles = new Set(teamMember.roles);
				saveSuccess = true;
			} else {
				saveError = 'Failed to update roles';
			}
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to update roles';
		} finally {
			isSaving = false;
		}
	}

	const hasChanges = $derived(() => {
		if (!teamMember) return false;
		const originalRoles = new Set(teamMember.roles);
		if (originalRoles.size !== selectedRoles.size) return true;
		for (const role of selectedRoles) {
			if (!originalRoles.has(role)) return true;
		}
		return false;
	});
</script>

<svelte:head>
	<title>Manage Roles - {teamMember?.displayName ?? 'Team Member'} | Contractor Portal</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<a
			href="/app/contractor/admin/team/{teamMemberId}"
			class="inline-flex items-center text-sm text-surface-500 hover:text-primary-500 mb-4"
		>
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Team Member
		</a>

		{#if error}
			<Card variant="outlined" padding="lg">
				<div class="text-center text-error-500">
					<p>{error}</p>
					<a href="/app/contractor/admin/team" class="btn preset-outlined-primary-500 mt-4">
						Back to Team
					</a>
				</div>
			</Card>
		{:else if teamMember}
			<!-- Header -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
				<div>
					<h1 class="text-2xl font-bold">Manage Roles</h1>
					<p class="text-surface-500">
						Configure roles for <span class="font-medium">{teamMember.displayName}</span>
					</p>
				</div>
				<button
					onclick={handleSave}
					disabled={isSaving || selectedRoles.size === 0}
					class="btn preset-filled-primary-500"
				>
					{#if isSaving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<Save class="mr-2 h-4 w-4" />
						Save Changes
					{/if}
				</button>
			</div>

			{#if saveError}
				<div class="mb-4 rounded-lg bg-error-500/10 p-4 text-error-500">
					{saveError}
				</div>
			{/if}

			{#if saveSuccess}
				<div class="mb-4 rounded-lg bg-success-500/10 p-4 text-success-500 flex items-center gap-2">
					<Check class="h-5 w-5" />
					Roles updated successfully
				</div>
			{/if}

			{#if selectedRoles.size === 0}
				<div class="mb-4 rounded-lg bg-warning-500/10 p-4 text-warning-500">
					At least one role must be selected
				</div>
			{/if}

			<!-- Roles Grid -->
			<div class="grid gap-4 md:grid-cols-2">
				{#each ALL_ROLES as role}
					{@const isSelected = selectedRoles.has(role)}
					{@const isOwner = role === ServiceProviderRoleValues.OWNER}
					<button
						type="button"
						onclick={() => toggleRole(role)}
						class="text-left p-4 rounded-lg border-2 transition-all {isSelected
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-300 dark:border-surface-600 hover:border-primary-300'}"
					>
						<div class="flex items-start gap-3">
							<div
								class="flex h-6 w-6 items-center justify-center rounded-md {isSelected
									? 'bg-primary-500 text-white'
									: 'bg-surface-200 dark:bg-surface-700'}"
							>
								{#if isSelected}
									<Check class="h-4 w-4" />
								{:else}
									<Shield class="h-4 w-4 text-surface-400" />
								{/if}
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">{SERVICE_PROVIDER_ROLE_LABELS[role]}</span>
									{#if isOwner}
										<span class="text-xs px-2 py-0.5 rounded-full bg-warning-500/20 text-warning-600 dark:text-warning-400">
											Owner
										</span>
									{/if}
								</div>
								<p class="text-sm text-surface-500 mt-1">
									{SERVICE_PROVIDER_ROLE_DESCRIPTIONS[role]}
								</p>
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Role Descriptions -->
			<Card variant="outlined" padding="lg" class="mt-6">
				<h2 class="text-lg font-semibold mb-4">Role Permissions</h2>
				<div class="space-y-4 text-sm">
					<div>
						<p class="font-medium text-warning-600 dark:text-warning-400">Owner</p>
						<p class="text-surface-500">
							Full access to all organization settings, billing, and team management. Cannot be removed by other admins.
						</p>
					</div>
					<div>
						<p class="font-medium">Administrator</p>
						<p class="text-surface-500">
							Can manage team members, settings, and view all data. Cannot modify owner or billing settings.
						</p>
					</div>
					<div>
						<p class="font-medium">Office Manager</p>
						<p class="text-surface-500">
							Manages day-to-day operations, scheduling, and customer communications.
						</p>
					</div>
					<div>
						<p class="font-medium">Dispatcher</p>
						<p class="text-surface-500">
							Assigns jobs to technicians and manages the dispatch board.
						</p>
					</div>
					<div>
						<p class="font-medium">Estimator</p>
						<p class="text-surface-500">
							Creates and manages estimates and proposals for customers.
						</p>
					</div>
					<div>
						<p class="font-medium">Bookkeeper</p>
						<p class="text-surface-500">
							Manages invoices, payments, and financial reports.
						</p>
					</div>
					<div>
						<p class="font-medium">Technician</p>
						<p class="text-surface-500">
							Field worker who completes jobs. Can be linked to a technician profile for scheduling.
						</p>
					</div>
				</div>
			</Card>
		{/if}
	</div>
</PageContainer>
