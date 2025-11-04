<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Image from '@tiptap/extension-image';
	
	// Props
	let { value = $bindable(''), placeholder = 'Start typing...' }: { value?: string; placeholder?: string } = $props();
	
	let element: HTMLDivElement;
	let editor: Editor | null = null;
	
	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				StarterKit,
				Image.configure({
					inline: true,
					allowBase64: true,
					HTMLAttributes: {
						class: 'max-w-full h-auto'
					}
				})
			],
			content: value,
			editorProps: {
				attributes: {
					class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4'
				}
			},
			onTransaction: () => {
				// Force re-render on every transaction
				editor = editor;
			},
			onUpdate: ({ editor }) => {
				// Update the bound value with HTML content
				value = editor.getHTML();
			}
		});
	});
	
	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});
	
	// Update editor content when value changes externally
	$effect(() => {
		if (editor && value !== editor.getHTML()) {
			editor.commands.setContent(value, { emitUpdate: false });
		}
	});
</script>

<div class="border border-surface-300-600-token rounded-lg overflow-hidden">
	<!-- Toolbar -->
	<div class="bg-surface-100-800-token border-b border-surface-300-600-token p-2 flex gap-1 flex-wrap">
		<button
			type="button"
			onclick={() => editor?.chain().focus().toggleBold().run()}
			disabled={!editor?.can().chain().focus().toggleBold().run()}
			class="btn btn-sm variant-ghost-surface"
			class:variant-filled-primary={editor?.isActive('bold')}
		>
			<strong>B</strong>
		</button>
		<button
			type="button"
			onclick={() => editor?.chain().focus().toggleItalic().run()}
			disabled={!editor?.can().chain().focus().toggleItalic().run()}
			class="btn btn-sm variant-ghost-surface"
			class:variant-filled-primary={editor?.isActive('italic')}
		>
			<em>I</em>
		</button>
		<button
			type="button"
			onclick={() => editor?.chain().focus().toggleStrike().run()}
			disabled={!editor?.can().chain().focus().toggleStrike().run()}
			class="btn btn-sm variant-ghost-surface"
			class:variant-filled-primary={editor?.isActive('strike')}
		>
			<s>S</s>
		</button>
		<div class="border-l border-surface-300-600-token mx-1"></div>
		<button
			type="button"
			onclick={() => editor?.chain().focus().toggleBulletList().run()}
			class="btn btn-sm variant-ghost-surface"
			class:variant-filled-primary={editor?.isActive('bulletList')}
		>
			• List
		</button>
		<button
			type="button"
			onclick={() => editor?.chain().focus().toggleOrderedList().run()}
			class="btn btn-sm variant-ghost-surface"
			class:variant-filled-primary={editor?.isActive('orderedList')}
		>
			1. List
		</button>
		<div class="border-l border-surface-300-600-token mx-1"></div>
		<button
			type="button"
			onclick={() => editor?.chain().focus().undo().run()}
			disabled={!editor?.can().chain().focus().undo().run()}
			class="btn btn-sm variant-ghost-surface"
		>
			Undo
		</button>
		<button
			type="button"
			onclick={() => editor?.chain().focus().redo().run()}
			disabled={!editor?.can().chain().focus().redo().run()}
			class="btn btn-sm variant-ghost-surface"
		>
			Redo
		</button>
	</div>
	
	<!-- Editor -->
	<div bind:this={element} class="bg-surface-50-900-token"></div>
</div>

<style>
	:global(.ProseMirror) {
		min-height: 200px;
	}
	
	:global(.ProseMirror:focus) {
		outline: none;
	}
	
	:global(.ProseMirror img) {
		max-width: 100%;
		height: auto;
	}
	
	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: rgb(var(--color-surface-400));
		pointer-events: none;
		height: 0;
	}
</style>
