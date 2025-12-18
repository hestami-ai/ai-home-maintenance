<script lang="ts">
	import { Save, FileText, Sparkles, Clock } from 'lucide-svelte';
	import { Textarea, Button } from 'flowbite-svelte';

	interface Props {
		meetingId: string;
		initialContent?: string;
		status: 'draft' | 'submitted' | 'approved';
		lastSavedAt?: string | null;
		onSave?: (content: string) => void;
		onSubmit?: (content: string) => void;
		readonly?: boolean;
	}

	let { 
		meetingId, 
		initialContent = '', 
		status,
		lastSavedAt,
		onSave,
		onSubmit,
		readonly = false
	}: Props = $props();

	let content = $state(initialContent);
	let isSaving = $state(false);
	let hasChanges = $derived(content !== initialContent);

	async function handleSave() {
		if (!onSave || isSaving) return;
		isSaving = true;
		try {
			await onSave(content);
		} finally {
			isSaving = false;
		}
	}

	async function handleSubmit() {
		if (!onSubmit || isSaving) return;
		isSaving = true;
		try {
			await onSubmit(content);
		} finally {
			isSaving = false;
		}
	}

	function handleAiAssist() {
		// Placeholder for AI-assisted minutes generation
		// Will be implemented when LLM integration is ready
		console.log('AI assist requested for meeting:', meetingId);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<FileText size={20} class="text-gray-500" />
			<h3 class="font-semibold">Meeting Minutes</h3>
			<span class="badge px-2 py-1 rounded text-xs font-medium" 
				class:bg-yellow-100={status === 'draft'}
				class:text-yellow-800={status === 'draft'}
				class:bg-blue-100={status === 'submitted'}
				class:text-blue-800={status === 'submitted'}
				class:bg-green-100={status === 'approved'}
				class:text-green-800={status === 'approved'}
			>
				{status === 'draft' ? 'Draft' : status === 'submitted' ? 'Pending Approval' : 'Approved'}
			</span>
		</div>

		{#if lastSavedAt}
			<div class="flex items-center gap-1 text-xs text-gray-500">
				<Clock size={12} />
				<span>Last saved: {new Date(lastSavedAt).toLocaleString()}</span>
			</div>
		{/if}
	</div>

	<div class="relative">
		<Textarea
			bind:value={content}
			placeholder="Enter meeting minutes here...

Suggested sections:
• Call to Order
• Roll Call / Attendance
• Approval of Previous Minutes
• Reports
• Old Business
• New Business
• Motions & Votes
• Announcements
• Adjournment"
			rows={15}
			disabled={readonly || status === 'approved'}
			class="font-mono text-sm"
		/>

		{#if hasChanges && !readonly}
			<div class="absolute top-2 right-2">
				<span class="text-xs text-orange-500 font-medium">Unsaved changes</span>
			</div>
		{/if}
	</div>

	{#if !readonly && status !== 'approved'}
		<div class="flex items-center justify-between">
			<Button 
				color="alternative" 
				size="sm"
				onclick={handleAiAssist}
				disabled={true}
				title="AI-assisted minutes generation (coming soon)"
			>
				<Sparkles size={16} class="mr-2" />
				AI Assist
			</Button>

			<div class="flex items-center gap-2">
				<Button 
					color="light" 
					size="sm"
					onclick={handleSave}
					disabled={!hasChanges || isSaving}
				>
					<Save size={16} class="mr-2" />
					{isSaving ? 'Saving...' : 'Save Draft'}
				</Button>

				{#if status === 'draft'}
					<Button 
						color="primary" 
						size="sm"
						onclick={handleSubmit}
						disabled={!content.trim() || isSaving}
					>
						Submit for Approval
					</Button>
				{/if}
			</div>
		</div>
	{/if}

	{#if status === 'approved'}
		<div class="text-center py-2 text-sm text-gray-500">
			These minutes have been approved and cannot be edited.
		</div>
	{/if}
</div>
