<script lang="ts">
	import { ArrowLeft, Users, Plus, Mail, Phone, Trash2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { Card, EmptyState } from '$lib/components/ui';
	import { AddBoardMemberModal } from '$lib/components/cam';
	import { currentAssociation } from '$lib/stores';

	interface BoardMember {
		id: string;
		userId: string;
		name: string;
		email?: string;
		phone?: string;
		position: string;
		termStart: string;
		termEnd?: string;
		isActive: boolean;
	}

	let boardMembers = $state<BoardMember[]>([]);
	let isLoading = $state(true);
	let showAddMemberModal = $state(false);
	let isAddingMember = $state(false);

	async function loadBoardMembers() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await fetch(`/api/governance/board?associationId=${$currentAssociation.id}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data?.items) {
					boardMembers = data.data.items;
				}
			}
		} catch (e) {
			console.error('Failed to load board members:', e);
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const activeMembers = $derived(boardMembers.filter(m => m.isActive));
	const pastMembers = $derived(boardMembers.filter(m => !m.isActive));

	async function handleAddMember(data: { 
		name: string; 
		email?: string; 
		phone?: string; 
		position: string; 
		termStart: string; 
		termEnd?: string 
	}) {
		if (!$currentAssociation?.id) return;

		isAddingMember = true;
		try {
			const response = await fetch('/api/governance/board/member', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					associationId: $currentAssociation.id,
					...data
				})
			});

			if (response.ok) {
				await loadBoardMembers();
				showAddMemberModal = false;
			}
		} catch (e) {
			console.error('Failed to add board member:', e);
		} finally {
			isAddingMember = false;
		}
	}

	async function handleRemoveMember(memberId: string) {
		if (!confirm('Are you sure you want to remove this board member?')) return;

		try {
			const response = await fetch(`/api/governance/board/member/${memberId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadBoardMembers();
			}
		} catch (e) {
			console.error('Failed to remove board member:', e);
		}
	}

	$effect(() => {
		if ($currentAssociation?.id) {
			loadBoardMembers();
		}
	});
</script>

<svelte:head>
	<title>Board | Governance | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/governance')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Board of Directors</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
			<button 
				class="btn btn-sm preset-filled-primary-500"
				onclick={() => showAddMemberModal = true}
			>
				<Plus class="mr-1 h-4 w-4" />
				Add Member
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else}
			<div class="space-y-6">
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Current Board Members</h3>

					{#if activeMembers.length === 0}
						<EmptyState
							title="No board members"
							description="Add board members to get started."
						/>
					{:else}
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each activeMembers as member}
								<div class="rounded-lg border border-surface-300-700 p-4">
									<div class="flex items-start gap-3">
										<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
											<Users class="h-6 w-6 text-primary-500" />
										</div>
										<div class="flex-1">
											<h4 class="font-semibold">{member.name}</h4>
											<p class="text-sm text-primary-500">{member.position}</p>
										</div>
									</div>

									<div class="mt-4 space-y-2 text-sm">
										{#if member.email}
											<div class="flex items-center gap-2 text-surface-500">
												<Mail class="h-4 w-4" />
												<a href="mailto:{member.email}" class="hover:text-primary-500">
													{member.email}
												</a>
											</div>
										{/if}
										{#if member.phone}
											<div class="flex items-center gap-2 text-surface-500">
												<Phone class="h-4 w-4" />
												<a href="tel:{member.phone}" class="hover:text-primary-500">
													{member.phone}
												</a>
											</div>
										{/if}
									</div>

									<div class="mt-4 flex items-center justify-between border-t border-surface-300-700 pt-3">
										<p class="text-xs text-surface-400">
											Term: {formatDate(member.termStart)}
											{#if member.termEnd}
												- {formatDate(member.termEnd)}
											{:else}
												- Present
											{/if}
										</p>
										<button
											type="button"
											onclick={() => handleRemoveMember(member.id)}
											class="rounded p-1 text-surface-400 transition-colors hover:bg-error-500/10 hover:text-error-500"
											title="Remove member"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card>

				{#if pastMembers.length > 0}
					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Past Board Members</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-surface-300-700 text-left">
										<th class="pb-3 font-medium">Name</th>
										<th class="pb-3 font-medium">Position</th>
										<th class="pb-3 font-medium">Term</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-surface-300-700">
									{#each pastMembers as member}
										<tr class="text-surface-500">
											<td class="py-3">{member.name}</td>
											<td class="py-3">{member.position}</td>
											<td class="py-3">
												{formatDate(member.termStart)} - {member.termEnd ? formatDate(member.termEnd) : 'N/A'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</Card>
				{/if}
			</div>
		{/if}
	</div>
</div>

<AddBoardMemberModal
	open={showAddMemberModal}
	loading={isAddingMember}
	onConfirm={handleAddMember}
	onCancel={() => showAddMemberModal = false}
/>
