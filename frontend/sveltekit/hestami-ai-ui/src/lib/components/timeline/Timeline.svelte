<script lang="ts">
    import { onMount } from 'svelte';
    import TimelineEntry from './TimelineEntry.svelte';
    import TimelineCommentForm from './TimelineCommentForm.svelte';
    import { apiGet, apiPost, apiPut, apiDelete } from '$lib/client/api';
    
    // Define TimelineEntry type directly here until we fix the types export
    interface TimelineEntryType {
        id: string;
        service_request: string;
        entry_type: string;
        content: string;
        metadata?: any;
        created_at: string;
        updated_at: string;
        created_by?: {
            id: string;
            username: string;
            email?: string;
            first_name?: string;
            last_name?: string;
        };
        read_status?: {
            is_read: boolean;
            read_at: string | null;
        };
        is_read: boolean;
        is_deleted: boolean;
    }
    
    export let serviceRequestId: string;
    export let refreshData: () => void = () => {};
    
    let entries: TimelineEntryType[] = [];
    let loading = true;
    let error: string | null = null;
    let editingEntryId: string | null = null;
    
    // Fetch timeline entries
    async function fetchTimelineEntries() {
        loading = true;
        error = null;
        
        try {
            const data = await apiGet(`/api/services/requests/${serviceRequestId}/timeline/`);
            
            // Handle both direct array response and paginated response with results property
            if (Array.isArray(data)) {
                entries = data;
            } else if (data && typeof data === 'object') {
                // Handle paginated response or direct object
                entries = data.results || (data.id ? [data] : []);
            } else {
                entries = [];
            }
            
            // Process entries to map read_status to is_read property
            entries = entries.map(entry => {
                // If the entry has a read_status object, use its is_read property
                if (entry.read_status && typeof entry.read_status.is_read === 'boolean') {
                    return {
                        ...entry,
                        is_read: entry.read_status.is_read
                    };
                }
                // Otherwise keep the entry as is
                return entry;
            });
            
            // Filter out deleted entries
            entries = entries.filter(entry => !entry.is_deleted);
            
            // Sort entries by created_at in descending order (newest first)
            entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } catch (err) {
            console.error('Error fetching timeline entries:', err);
            error = err instanceof Error ? err.message : 'Failed to fetch timeline entries';
        } finally {
            loading = false;
        }
    }
    
    // Handle comment submission
    async function handleCommentSubmit(event: CustomEvent) {
        try {
            const { content, attachments } = event.detail;
            const payload = {
                service_request: serviceRequestId,
                content,
                metadata: { attachments },
                entry_type: 'COMMENT'
            };
            
            console.log('Submitting comment with payload:', payload);
            
            // If editing an existing comment
            if (editingEntryId) {
                const response = await apiPut(
                    `/api/services/requests/${serviceRequestId}/timeline/${editingEntryId}/`, 
                    payload
                );
                console.log('Comment update response:', response);
                editingEntryId = null;
            } else {
                // Creating a new comment
                const response = await apiPost(
                    `/api/services/requests/${serviceRequestId}/timeline/comment/`, 
                    payload
                );
                console.log('New comment response:', response);
            }
            
            // Clear any previous errors
            error = null;
            
            // Refresh timeline entries with a small delay to ensure backend processing is complete
            setTimeout(async () => {
                await fetchTimelineEntries();
                // Refresh parent data if needed
                refreshData();
            }, 500);
        } catch (err) {
            console.error('Error submitting comment:', err);
            error = err instanceof Error ? err.message : 'Failed to submit comment';
        }
    }
    
    // Handle comment edit
    function handleEdit(entryId: string) {
        editingEntryId = entryId;
        const entry = entries.find(e => e.id === entryId);
        
        if (entry) {
            // Dispatch event to populate the comment form
            const event = new CustomEvent('edit-comment', {
                detail: {
                    content: entry.content,
                    attachments: entry.metadata?.attachments || []
                }
            });
            document.dispatchEvent(event);
            
            // Scroll to comment form
            document.getElementById('timeline-comment-form')?.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // Handle comment deletion (soft delete)
    async function handleDelete(entryId: string) {
        if (!confirm('Are you sure you want to delete this comment?')) {
            return;
        }
        
        try {
            await apiDelete(`/api/services/requests/${serviceRequestId}/timeline/${entryId}/`);
            
            // Refresh timeline entries
            await fetchTimelineEntries();
            
            // Refresh parent data if needed
            refreshData();
        } catch (err) {
            console.error('Error deleting comment:', err);
            error = err instanceof Error ? err.message : 'Failed to delete comment';
        }
    }
    
    // Cancel editing
    function handleCancelEdit() {
        editingEntryId = null;
    }
    
    onMount(() => {
        fetchTimelineEntries();
    });
</script>

<div class="timeline-container">
    <h3 class="h3 mb-4">Activity Timeline</h3>
    
    {#if error}
        <div class="alert variant-filled-error mb-4">
            <p>{error}</p>
        </div>
    {/if}
    
    <!-- Comment Form -->
    <div id="timeline-comment-form" class="mb-8">
        <TimelineCommentForm 
            {serviceRequestId} 
            on:submit={handleCommentSubmit}
            on:cancel={handleCancelEdit}
            isEditing={!!editingEntryId}
        />
    </div>
    
    <!-- Timeline Entries -->
    {#if loading && entries.length === 0}
        <div class="flex justify-center py-8">
            <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" role="status" aria-label="Loading">
                <span class="sr-only">Loading...</span>
            </div>
        </div>
    {:else if entries.length === 0}
        <div class="bg-surface-100-800-token rounded-lg p-4 text-center">
            <p>No activity yet. Add a comment to get started.</p>
        </div>
    {:else}
        <div class="timeline-entries-container bg-surface-50-900-token rounded-lg p-4">
            <div class="timeline-entries pl-4 max-h-[500px] overflow-y-auto pr-2">
                {#each entries as entry, i}
                    <TimelineEntry 
                        {entry} 
                        isLast={i === entries.length - 1}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        on:entryRead={() => fetchTimelineEntries()}
                    />
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .timeline-container {
        position: relative;
        padding: 1rem 0;
    }
    
    .timeline-entries {
        position: relative;
        border-left: 2px solid transparent; /* Will be overridden by the lines in TimelineEntry */
    }
</style>
