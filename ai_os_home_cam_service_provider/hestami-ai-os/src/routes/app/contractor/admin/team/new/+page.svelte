<script lang="ts">
	import { ServiceProviderRoleValues } from '$lib/api/cam';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Loader2, Plus, X } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import {
		serviceProviderTeamApi,
		SERVICE_PROVIDER_ROLE_LABELS,
		SERVICE_PROVIDER_ROLE_DESCRIPTIONS,
		type ServiceProviderRole
	} from '$lib/api/serviceProviderTeam';

	let email = $state('');
	let displayName = $state('');
	let title = $state('');
	let selectedRoles = $state<ServiceProviderRole[]>([]);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let showCodeModal = $state(false);
	let activationCode = $state('');
	let createdMemberId = $state('');

	const allRoles: ServiceProviderRole[] = [
		ServiceProviderRoleValues.OWNER,
		ServiceProviderRoleValues.ADMIN,
		ServiceProviderRoleValues.OFFICE_MANAGER,
		ServiceProviderRoleValues.DISPATCHER,
		ServiceProviderRoleValues.ESTIMATOR,
		ServiceProviderRoleValues.BOOKKEEPER,
		ServiceProviderRoleValues.TECHNICIAN
	];

	function toggleRole(role: ServiceProviderRole) {
		if (selectedRoles.includes(role)) {
			selectedRoles = selectedRoles.filter((r) => r !== role);
		} else {
			selectedRoles = [...selectedRoles, role];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email || !displayName || selectedRoles.length === 0) {
			error = 'Please fill in all required fields and select at least one role.';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await serviceProviderTeamApi.create({
				email,
				displayName,
				title: title || undefined,
				roles: selectedRoles
			});

			if (response.ok) {
				activationCode = response.data.activationCode;
				createdMemberId = response.data.teamMember.id;
				showCodeModal = true;
			} else {
				error = 'Failed to create team member';
			}
		} catch (e) {
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = 'Failed to create team member';
			}
		} finally {
			isSubmitting = false;
		}
	}

	function handleDone() {
		goto(`/app/contractor/admin/team/${createdMemberId}`);
	}
</script>

<svelte:head>
	<title>Add Team Member | Contractor Portal</title>
</svelte:head>

<PageContainer>
	<div class="py-6 max-w-2xl mx-auto">
		<!-- Back Link -->
		<a href="/app/contractor/admin/team" class="inline-flex items-center text-sm text-surface-500 hover:text-primary-500 mb-4">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Team
		</a>

		<h1 class="text-2xl font-bold mb-6">Add Team Member</h1>

		<form onsubmit={handleSubmit}>
			<Card variant="outlined" padding="lg">
				<div class="space-y-6">
					<!-- Email -->
					<div>
						<label for="email" class="label mb-2">
							Email Address <span class="text-error-500">*</span>
						</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							placeholder="team.member@company.com"
							class="input w-full"
							required
						/>
						<p class="text-sm text-surface-500 mt-1">
							The user must already have a Hestami AI account with this email.
						</p>
					</div>

					<!-- Display Name -->
					<div>
						<label for="displayName" class="label mb-2">
							Display Name <span class="text-error-500">*</span>
						</label>
						<input
							type="text"
							id="displayName"
							bind:value={displayName}
							placeholder="John Smith"
							class="input w-full"
							required
						/>
					</div>

					<!-- Title -->
					<div>
						<label for="title" class="label mb-2">Title</label>
						<input
							type="text"
							id="title"
							bind:value={title}
							placeholder="e.g., Senior Technician, Office Manager"
							class="input w-full"
						/>
					</div>

					<!-- Roles -->
					<fieldset>
						<legend class="label mb-2">
							Roles <span class="text-error-500">*</span>
						</legend>
						<p class="text-sm text-surface-500 mb-3">
							Select at least one role for this team member.
						</p>
						<div class="space-y-2" role="group" aria-label="Role selection">
							{#each allRoles as role}
								<button
									type="button"
									onclick={() => toggleRole(role)}
									class="w-full flex items-start gap-3 p-3 rounded-lg border transition-colors {selectedRoles.includes(role)
										? 'border-primary-500 bg-primary-500/10'
										: 'border-surface-300-700 hover:border-surface-400-600'}"
								>
									<div class="flex-shrink-0 mt-0.5">
										<div
											class="h-5 w-5 rounded border-2 flex items-center justify-center {selectedRoles.includes(role)
												? 'border-primary-500 bg-primary-500'
												: 'border-surface-400'}"
										>
											{#if selectedRoles.includes(role)}
												<svg class="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
													<path
														fill-rule="evenodd"
														d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
														clip-rule="evenodd"
													/>
												</svg>
											{/if}
										</div>
									</div>
									<div class="text-left">
										<p class="font-medium">{SERVICE_PROVIDER_ROLE_LABELS[role]}</p>
										<p class="text-sm text-surface-500">{SERVICE_PROVIDER_ROLE_DESCRIPTIONS[role]}</p>
									</div>
								</button>
							{/each}
						</div>
					</fieldset>

					{#if error}
						<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
							{error}
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex justify-end gap-3 pt-4 border-t border-surface-200-800">
						<a href="/app/contractor/admin/team" class="btn preset-outlined-surface-500">
							Cancel
						</a>
						<button
							type="submit"
							disabled={isSubmitting || !email || !displayName || selectedRoles.length === 0}
							class="btn preset-filled-primary-500"
						>
							{#if isSubmitting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<Plus class="mr-2 h-4 w-4" />
							{/if}
							Add Team Member
						</button>
					</div>
				</div>
			</Card>
		</form>
	</div>
</PageContainer>

<!-- Activation Code Modal -->
{#if showCodeModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card variant="outlined" padding="lg" class="w-full max-w-md">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold">Team Member Created</h3>
				<button onclick={handleDone} class="btn btn-sm preset-ghost">
					<X class="h-4 w-4" />
				</button>
			</div>
			<p class="text-surface-500 mb-4">
				Share this activation code with the team member. They will need it to activate their account. The code expires in 8 hours.
			</p>
			<div class="bg-surface-100-900 p-4 rounded-lg text-center mb-4">
				<p class="text-2xl font-mono font-bold tracking-wider">{activationCode}</p>
			</div>
			<div class="flex justify-end">
				<button onclick={handleDone} class="btn preset-filled-primary-500">
					View Team Member
				</button>
			</div>
		</Card>
	</div>
{/if}
