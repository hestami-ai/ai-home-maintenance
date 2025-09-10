<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { FileUp, Send, X, Loader2, User } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { searchUsers } from '$lib/services/userService';
    import type { User as UserType } from '$lib/services/userService';
    import { apiPost } from '$lib/client/api';
    
    // Use type assertion for Quill instead of global declaration
    type QuillType = any;
    
    // Mention module for Quill
    interface MentionModule {
        mentionDenotationChars: string[];
        source: (searchTerm: string, renderList: (users: any[], searchTerm: string) => void) => void;
        renderItem: (item: any) => string;
        onSelect: (item: any, insertItem: any) => void;
        allowedChars: RegExp;
    }
    
    // Component props
    export let serviceRequestId = '';
    export let isEditing: boolean = false;
    
    const dispatch = createEventDispatcher();
    
    let quill: any;
    let quillContainer: HTMLElement;
    let content: string = '';
    let attachments: any[] = [];
    let uploading = false;
    let uploadError: string | null = null;
    let fileInput: HTMLInputElement;
    let mentionUsers: UserType[] = [];
    let mentionLoading = false;
    
    // Initialize Quill editor
    async function initQuill() {
        if (typeof window !== 'undefined') {
            // Dynamically import Quill - using browser global if available
            let Quill: QuillType;
            if (typeof window !== 'undefined' && (window as any).Quill) {
                Quill = (window as any).Quill;
            } else {
                try {
                    // Try dynamic import
                    Quill = (await import('quill')).default;
                } catch (e) {
                    console.error('Failed to load Quill:', e);
                    // Fallback to CDN if module import fails
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
                        script.onload = () => {
                            Quill = (window as any).Quill;
                            resolve();
                        };
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
            }
            
            // Import Quill CSS
            if (!document.querySelector('link[href*="quill.snow.css"]')) {
                const quillCssLink = document.createElement('link');
                quillCssLink.rel = 'stylesheet';
                quillCssLink.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
                document.head.appendChild(quillCssLink);
            }
            
            // Make sure Quill is globally available before loading the mention plugin
            (window as any).Quill = Quill;
            
            // Import mention module if needed
            if (!(window as any).QuillMention) {
                try {
                    // Add mention CSS first
                    if (!document.querySelector('link[href*="quill.mention.min.css"]')) {
                        const mentionCssLink = document.createElement('link');
                        mentionCssLink.rel = 'stylesheet';
                        mentionCssLink.href = 'https://cdn.jsdelivr.net/npm/quill-mention@3.1.0/dist/quill.mention.min.css';
                        document.head.appendChild(mentionCssLink);
                    }
                    
                    // Then load the mention script
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/quill-mention@3.1.0/dist/quill.mention.min.js';
                        script.onload = () => resolve();
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                } catch (e) {
                    console.error('Failed to load QuillMention:', e);
                }
            }
            
            // Configure mention module
            const mentionModule: MentionModule = {
                mentionDenotationChars: ['@'],
                source: async function(searchTerm: string, renderList: (users: any[], searchTerm: string) => void) {
                    if (searchTerm.length === 0) {
                        renderList([], searchTerm);
                        return;
                    }
                    
                    mentionLoading = true;
                    try {
                        const users = await searchUsers(searchTerm);
                        mentionUsers = users;
                        renderList(users, searchTerm);
                    } catch (error) {
                        console.error('Error fetching users for mention:', error);
                        renderList([], searchTerm);
                    } finally {
                        mentionLoading = false;
                    }
                },
                renderItem: function(item: UserType) {
                    return `
                        <div class="mention-item flex items-center p-2">
                            <div class="mention-icon flex-shrink-0 mr-2 bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                                <span>${item.display_name?.[0] || item.username[0]}</span>
                            </div>
                            <div class="mention-info">
                                <div class="mention-name font-medium">${item.display_name || item.username}</div>
                                <div class="mention-username text-xs text-surface-600-300-token">@${item.username}</div>
                            </div>
                        </div>
                    `;
                },
                onSelect: function(item: UserType, insertItem: any) {
                    insertItem(item);
                },
                allowedChars: /^[A-Za-z0-9_\-\.]*$/
            };
            
            // Initialize Quill
            quill = new Quill(quillContainer, {
                theme: 'snow',
                placeholder: 'Add a comment... Use @ to mention users',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                        ['link'],
                        ['clean']
                    ],
                    mention: mentionModule
                }
            });
            
            // Listen for content changes
            quill.on('text-change', () => {
                content = quill.root.innerHTML;
            });
            
            // Listen for edit-comment events
            const handleEditComment = (event: CustomEvent) => {
                const { content: editContent, attachments: editAttachments } = event.detail;
                quill.root.innerHTML = editContent;
                content = editContent;
                attachments = editAttachments || [];
            };
            
            document.addEventListener('edit-comment', handleEditComment as EventListener);
            
            // Store reference to the CSS links for cleanup
            const cssLinks = [
                document.querySelector('link[href*="quill.snow.css"]'),
                document.querySelector('link[href*="quill.mention.min.css"]')
            ];
            
            return () => {
                document.removeEventListener('edit-comment', handleEditComment as EventListener);
                cssLinks.forEach(link => link?.remove());
            };
        }
    }
    
    // Handle file upload
    async function handleFileUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;
        
        uploading = true;
        uploadError = null;
        
        try {
            const files = Array.from(target.files);
            
            // Check file types - both by MIME type and extension
            const allowedTypes = [
                'application/pdf', 
                'application/msword', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/markdown',
                'text/plain'
            ];
            
            // Also check file extensions for markdown files since browsers often don't recognize the MIME type correctly
            const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.md', '.txt'];
            
            const invalidFiles = files.filter(file => {
                // Check if the file type is directly allowed
                if (allowedTypes.includes(file.type)) {
                    return false; // File is valid
                }
                
                // If file type is not recognized, check the extension
                const fileName = file.name.toLowerCase();
                return !allowedExtensions.some(ext => fileName.endsWith(ext));
            });
            
            if (invalidFiles.length > 0) {
                throw new Error(`Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Only PDF, Word, Excel, and Markdown files are allowed.`);
            }
            
            // Upload each file
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('media_type', 'FILE');
                
                // Use apiPost with FormData - the Content-Type will be automatically set by the browser
                const result = await apiPost(
                    `/api/media/services/requests/${serviceRequestId}/upload/`, 
                    formData
                );
                
                // Add to attachments
                attachments = [...attachments, {
                    id: result.id,
                    filename: file.name,
                    url: result.file_url,
                    media_type: 'FILE',
                    size: file.size
                }];
            }
            
            // Clear file input
            if (fileInput) {
                fileInput.value = '';
            }
        } catch (err) {
            console.error('Error uploading files:', err);
            uploadError = err instanceof Error ? err.message : 'Failed to upload files';
        } finally {
            uploading = false;
        }
    }
    
    // Remove attachment
    function removeAttachment(index: number) {
        attachments = attachments.filter((_, i) => i !== index);
    }
    
    // Submit comment
    function submitComment() {
        if (!content.trim() && attachments.length === 0) {
            return;
        }
        
        dispatch('submit', {
            content,
            attachments
        });
        
        // Reset form
        quill.root.innerHTML = '';
        content = '';
        attachments = [];
    }
    
    // Cancel editing
    function cancelEdit() {
        quill.root.innerHTML = '';
        content = '';
        attachments = [];
        dispatch('cancel');
    }
    
    // Format file size
    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    let cleanup: (() => void) | undefined;
    
    onMount(async () => {
        cleanup = await initQuill();
    });
    
    onDestroy(() => {
        if (cleanup) cleanup();
    });
</script>

<div class="comment-form bg-surface-100-800-token rounded-lg p-4">
    <h4 class="h4 mb-2">{isEditing ? 'Edit Comment' : 'Add Comment'}</h4>
    
    <!-- Quill Editor -->
    <div class="mb-4">
        <div bind:this={quillContainer} class="bg-white dark:bg-surface-900 rounded"></div>
    </div>
    
    <!-- Upload Error -->
    {#if uploadError}
        <div class="alert variant-filled-error mb-4">
            <p>{uploadError}</p>
        </div>
    {/if}
    
    <!-- File Attachments -->
    {#if attachments.length > 0}
        <div class="mb-4">
            <p class="text-sm font-semibold mb-2">Attachments:</p>
            <div class="flex flex-wrap gap-2">
                {#each attachments as attachment, i}
                    <div class="flex items-center gap-1 bg-surface-200-700-token rounded px-2 py-1">
                        <span class="text-xs truncate max-w-[150px]">{attachment.filename}</span>
                        <span class="text-xs text-surface-600-300-token">({formatFileSize(attachment.size)})</span>
                        <button 
                            class="btn-icon btn-icon-sm variant-soft-error ml-1" 
                            on:click={() => removeAttachment(i)}
                            title="Remove attachment"
                        >
                            <X class="h-3 w-3" />
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
    
    <!-- Actions -->
    <div class="flex justify-between">
        <div>
            <input 
                type="file" 
                bind:this={fileInput}
                on:change={handleFileUpload} 
                accept=".pdf,.doc,.docx,.xls,.xlsx,.md,.txt"
                multiple
                class="hidden"
            />
            <button 
                class="btn variant-soft-secondary btn-sm" 
                on:click={() => fileInput.click()}
                disabled={uploading}
            >
                {#if uploading}
                    <Loader2 class="h-4 w-4 animate-spin mr-1" />
                    Uploading...
                {:else}
                    <FileUp class="h-4 w-4 mr-1" />
                    Attach Files
                {/if}
            </button>
        </div>
        
        <div class="flex gap-2">
            {#if isEditing}
                <button class="btn variant-soft btn-sm" on:click={cancelEdit}>
                    Cancel
                </button>
            {/if}
            <button 
                class="btn variant-filled-primary btn-sm" 
                on:click={submitComment}
                disabled={!content.trim() && attachments.length === 0}
            >
                <Send class="h-4 w-4 mr-1" />
                {isEditing ? 'Update' : 'Send'}
            </button>
        </div>
    </div>
</div>
