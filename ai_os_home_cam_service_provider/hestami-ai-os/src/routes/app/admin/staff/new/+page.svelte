<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Loader2, UserPlus, Info } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import {
		staffApi,
		STAFF_ROLE_LABELS,
		STAFF_ROLE_DESCRIPTIONS,
		PILLAR_ACCESS_LABELS,
		type StaffRole,
		type PillarAccess
	} from '$lib/api/staff';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let userSearchQuery = $state('');
	let selectedUserId = $state<string | null>(null);
	let selectedUserEmail = $state<string | null>(null);

	// Form fields
	let displayName = $state('');
	let title = $state('');
	let selectedRoles = $state<StaffRole[]>([]);
	let selectedPillars = $state<PillarAccess[]>([]);
	let canBeAssignedCases = $state(true);

	const allRoles: StaffRole[] = [
		'CONCIERGE_OPERATOR',
		'OPERATIONS_COORDINATOR',
		'CAM_SPECIALIST',
		'VENDOR_LIAISON',
		'PLATFORM_ADMIN'
	];

	const allPillars: PillarAccess[] = ['CONCIERGE', 'CAM', 'CONTRACTOR', 'VENDOR', 'ADMIN'];

	function toggleRole(role: StaffRole) {
		if (selectedRoles.includes(role)) {
			selectedRoles = selectedRoles.filter((r) => r !== role);
		} else {
			selectedRoles = [...selectedRoles, role];
		}
	}

	function togglePillar(pillar: PillarAccess) {
		if (selectedPillars.includes(pillar)) {
			selectedPillars = selectedPillars.filter((p) => p !== pillar);
		} else {
			selectedPillars = [...selectedPillars, pillar];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		if (!selectedUserId) {
			error = 'Please select a user to add as staff';
			return;
		}

		if (selectedRoles.length === 0) {
			error = 'Please select at least one role';
			return;
		}

		if (selectedPillars.length === 0) {
			error = 'Please select at least one pillar access';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await staffApi.create({
				userId: selectedUserId,
				displayName: displayName.trim(),
				title: title.trim() || undefined,
				roles: selectedRoles,
				pillarAccess: selectedPillars,
				canBeAssignedCases
			});

			if (response.ok && response.data) {
				goto(`/app/admin/staff/${response.data.staff.id}`);
			} else {
				error = response.error?.message || 'Failed to create staff member';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create staff member';
		} finally {
			isSubmitting = false;
		}
	}

	// For now, we'll use a simple text input for user ID
	// In production, this would be a user search/select component
	function handleUserIdInput(e: Event) {
		const target = e.target as HTMLInputElement;
		selectedUserId = target.value.trim() || null;
	}
</script>

<svelte:head>
	<title>Add Staff Member | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/admin/staff"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Staff List
			</a>
			<h1 class="mt-4 text-2xl font-bold">Add Staff Member</h1>
			<p class="mt-1 text-surface-500">Create a new Hestami platform staff member</p>
		</div>

		<form onsubmit={handleSubmit} class="max-w-2xl space-y-6">
			{#if error}
				<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
					{error}
				</div>
			{/if}

			<!-- User Selection -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">User Account</h2>
				<p class="mt-1 text-sm text-surface-500">
					Select an existing user account to add as staff
				</p>

				<div class="mt-4 space-y-4">
					<div>
						<label for="userId" class="label">User ID</label>
						<input
							type="text"
							id="userId"
							placeholder="Enter user ID (e.g., clx...)"
							oninput={handleUserIdInput}
							class="input w-full"
							required
						/>
						<p class="mt-1 text-xs text-surface-400">
							Enter the ID of an existing platform user
						</p>
					</div>
				</div>
			</Card>

			<!-- Staff Details -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Staff Details</h2>
				<p class="mt-1 text-sm text-surface-500">
					Basic information about the staff member
				</p>

				<div class="mt-4 space-y-4">
					<div>
						<label for="displayName" class="label">Display Name *</label>
						<input
							type="text"
							id="displayName"
							bind:value={displayName}
							placeholder="e.g., John Smith"
							class="input w-full"
							required
						/>
					</div>

					<div>
						<label for="title" class="label">Title</label>
						<input
							type="text"
							id="title"
							bind:value={title}
							placeholder="e.g., Senior Concierge Operator"
							class="input w-full"
						/>
					</div>
				</div>
			</Card>

			<!-- Roles -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Roles *</h2>
				<p class="mt-1 text-sm text-surface-500">
					Select one or more roles for this staff member
				</p>

				<div class="mt-4 space-y-3">
					{#each allRoles as role}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-300-700 p-4 transition-colors hover:bg-surface-100-900 {selectedRoles.includes(role) ? 'border-primary-500 bg-primary-500/5' : ''}"
						>
							<input
								type="checkbox"
								checked={selectedRoles.includes(role)}
								onchange={() => toggleRole(role)}
								class="checkbox mt-0.5"
							/>
							<div class="flex-1">
								<span class="font-medium">{STAFF_ROLE_LABELS[role]}</span>
								<p class="text-sm text-surface-500">{STAFF_ROLE_DESCRIPTIONS[role]}</p>
							</div>
						</label>
					{/each}
				</div>
			</Card>

			<!-- Pillar Access -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Pillar Access *</h2>
				<p class="mt-1 text-sm text-surface-500">
					Select which platform pillars this staff member can access
				</p>

				<div class="mt-4 grid gap-3 sm:grid-cols-2">
					{#each allPillars as pillar}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-300-700 p-3 transition-colors hover:bg-surface-100-900 {selectedPillars.includes(pillar) ? 'border-primary-500 bg-primary-500/5' : ''}"
						>
							<input
								type="checkbox"
								checked={selectedPillars.includes(pillar)}
								onchange={() => togglePillar(pillar)}
								class="checkbox"
							/>
							<span class="font-medium">{PILLAR_ACCESS_LABELS[pillar]}</span>
						</label>
					{/each}
				</div>
			</Card>

			<!-- Case Assignment -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Case Assignment</h2>
				<p class="mt-1 text-sm text-surface-500">
					Configure case assignment eligibility
				</p>

				<div class="mt-4">
					<label class="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							bind:checked={canBeAssignedCases}
							class="checkbox"
						/>
						<div>
							<span class="font-medium">Can be assigned cases</span>
							<p class="text-sm text-surface-500">
								Allow this staff member to be assigned as primary owner of cases
							</p>
						</div>
					</label>
				</div>
			</Card>

			<!-- Info Box -->
			<div class="flex items-start gap-3 rounded-lg bg-primary-500/10 p-4">
				<Info class="h-5 w-5 flex-shrink-0 text-primary-500" />
				<div class="text-sm">
					<p class="font-medium text-primary-700 dark:text-primary-300">
						Staff member will be created with "Pending" status
					</p>
					<p class="mt-1 text-primary-600 dark:text-primary-400">
						After creation, you'll need to activate the staff member before they can access the platform.
						An invitation email will be sent to the user.
					</p>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex items-center justify-end gap-4">
				<a href="/app/admin/staff" class="btn preset-outlined-surface-500">
					Cancel
				</a>
				<button
					type="submit"
					disabled={isSubmitting}
					class="btn preset-filled-primary-500"
				>
					{#if isSubmitting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Creating...
					{:else}
						<UserPlus class="mr-2 h-4 w-4" />
						Create Staff Member
					{/if}
				</button>
			</div>
		</form>
	</div>
</PageContainer>
