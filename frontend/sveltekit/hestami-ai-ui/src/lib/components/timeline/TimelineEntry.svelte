<script lang="ts">
    import { format } from 'date-fns';
    import { MessageSquare, AlertCircle, FileText, Clock, Check, Edit, Trash2 } from 'lucide-svelte';
    import { page } from '$app/stores';
    
    // Define TimelineEntry type inline
    interface TimelineEntry {
        id: string;
        service_request: string;
        entry_type: string;
        content: string;
        metadata?: {
            attachments?: Array<{
                id: string;
                filename: string;
                url: string;
                media_type: string;
                size: number;
            }>;
            new_status?: string;
            reason?: string;
            document_url?: string;
            document_name?: string;
            [key: string]: any;
        };
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

    export let entry: TimelineEntry;
    export let isLast: boolean = false;
    export let onEdit: (entryId: string) => void = () => {};
    export let onDelete: (entryId: string) => void = () => {};

    // Format date for display
    function formatDate(dateString: string): string {
        return format(new Date(dateString), 'MMM d, yyyy');
    }

    // Format time for display
    function formatTime(dateString: string): string {
        return format(new Date(dateString), 'h:mm a');
    }

    // Determine if the current user can edit this entry
    $: canEdit = entry.created_by?.id === $page.data.user?.id || $page.data.user?.user_role === 'STAFF';

    // Get icon based on entry type
    function getEntryIcon(type: string) {
        switch (type) {
            case 'COMMENT':
                return MessageSquare;
            case 'STATUS_CHANGE':
                return Clock;
            case 'DOCUMENT':
                return FileText;
            default:
                return AlertCircle;
        }
    }

    // Get entry class based on type
    function getEntryClass(type: string): string {
        switch (type) {
            case 'COMMENT':
                return 'bg-primary-500';
            case 'STATUS_CHANGE':
                return 'bg-secondary-500';
            case 'DOCUMENT':
                return 'bg-tertiary-500';
            default:
                return 'bg-surface-500';
        }
    }

    import { apiPost } from '$lib/client/api';
    import { createEventDispatcher } from 'svelte';
    
    // Create event dispatcher
    const dispatch = createEventDispatcher();
    
    // Handle marking as read
    async function markAsRead() {
        try {
            // The server endpoint uses entry_id instead of id in the path
            const response = await apiPost(`/api/services/requests/${entry.service_request}/timeline/${entry.id}/read/`, {});
            console.log('Mark as read response:', response);
            
            // Update local state to reflect read status
            entry.is_read = true;
            
            // Also update the read_status object if it exists
            if (entry.read_status) {
                entry.read_status.is_read = true;
                entry.read_status.read_at = new Date().toISOString();
            }
            
            console.log('Updated entry read status:', { is_read: entry.is_read, read_status: entry.read_status });
            
            // Dispatch event to notify parent that entry was marked as read
            dispatch('entryRead', { entryId: entry.id });
        } catch (error) {
            console.error('Error marking entry as read:', error);
        }
    }

    // Mark as read when component is mounted
    import { onMount } from 'svelte';
    onMount(() => {
        // Check both the flat is_read property and the nested read_status object
        const isAlreadyRead = entry.is_read || (entry.read_status && entry.read_status.is_read);
        
        if (!isAlreadyRead) {
            markAsRead();
        }
    });
</script>

<div class="relative {isLast ? 'mb-0' : 'mb-6'}">
    <!-- Timeline line -->
    {#if !isLast}
        <div class="bg-surface-300-600-token absolute top-2 left-0 h-full w-0.5"></div>
    {/if}
    
    <!-- Timeline dot 
    <div class="{getEntryClass(entry.entry_type)} absolute top-1 left-[-0.3125rem] h-3 w-3 rounded-full"></div>
    -->
    <!-- Content -->
    <div class="ml-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <svelte:component this={getEntryIcon(entry.entry_type)} class="h-4 w-4 text-primary-500" />
                <p class="font-semibold">
                    {#if entry.entry_type === 'COMMENT'}
                        Comment by {entry.created_by ? (entry.created_by.first_name && entry.created_by.last_name ? `${entry.created_by.first_name} ${entry.created_by.last_name}` : entry.created_by.email || 'Unknown') : 'Unknown'}
                    {:else if entry.entry_type === 'STATUS_CHANGE'}
                        Status Changed
                    {:else if entry.entry_type === 'DOCUMENT'}
                        Document Added
                    {:else}
                        {entry.entry_type}
                    {/if}
                </p>
                
                <!-- Unread indicator -->
                {#if !(entry.is_read || (entry.read_status && entry.read_status.is_read))}
                    <span class="badge variant-filled-primary text-xs">New</span>
                {/if}
            </div>
            
            <!-- Actions if user can edit -->
            {#if canEdit && entry.entry_type === 'COMMENT'}
                <div class="flex gap-1">
                    <button 
                        class="btn-icon btn-icon-sm variant-soft" 
                        on:click={() => onEdit(entry.id)}
                        title="Edit comment"
                    >
                        <Edit class="h-3 w-3" />
                    </button>
                    <button 
                        class="btn-icon btn-icon-sm variant-soft-error" 
                        on:click={() => onDelete(entry.id)}
                        title="Delete comment"
                    >
                        <Trash2 class="h-3 w-3" />
                    </button>
                </div>
            {/if}
        </div>
        
        <p class="text-surface-600-300-token text-sm">
            {formatDate(entry.created_at)} at {formatTime(entry.created_at)}
        </p>
        
        <!-- Content based on entry type -->
        <div class="mt-2">
            {#if entry.entry_type === 'COMMENT'}
                <div class="bg-surface-100-800-token rounded-lg p-3">
                    <!-- Comment content - using innerHTML for rich text -->
                    <div class="prose prose-sm dark:prose-invert max-w-none">
                        {@html entry.content}
                    </div>
                    
                    <!-- Attached files if any -->
                    {#if entry.metadata?.attachments && entry.metadata.attachments.length > 0}
                        <div class="mt-3 border-t border-surface-300-600-token pt-2">
                            <p class="text-xs font-semibold mb-2">Attachments:</p>
                            <div class="flex flex-wrap gap-2">
                                {#each entry.metadata.attachments as attachment}
                                    <a 
                                        href={attachment.url} 
                                        target="_blank" 
                                        class="flex items-center gap-1 text-xs bg-surface-200-700-token hover:bg-surface-300-600-token rounded px-2 py-1"
                                    >
                                        <FileText class="h-3 w-3" />
                                        <span class="truncate max-w-[150px]">{attachment.filename}</span>
                                    </a>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {:else if entry.entry_type === 'STATUS_CHANGE'}
                <div class="bg-surface-100-800-token rounded-lg p-3">
                    <p>Status changed to <span class="font-semibold">{entry.metadata?.new_status || 'Unknown'}</span></p>
                    {#if entry.metadata?.reason}
                        <p class="text-sm mt-1">Reason: {entry.metadata.reason}</p>
                    {/if}
                </div>
            {:else if entry.entry_type === 'DOCUMENT'}
                <div class="bg-surface-100-800-token rounded-lg p-3">
                    <a 
                        href={entry.metadata?.document_url} 
                        target="_blank" 
                        class="flex items-center gap-2 hover:underline"
                    >
                        <FileText class="h-4 w-4" />
                        <span>{entry.metadata?.document_name || 'Document'}</span>
                    </a>
                    {#if entry.content}
                        <p class="text-sm mt-2">{entry.content}</p>
                    {/if}
                </div>
            {:else}
                <div class="bg-surface-100-800-token rounded-lg p-3">
                    <p>{entry.content}</p>
                </div>
            {/if}
        </div>
    </div>
</div>
