<!--
  VirtualScroll — renders only visible items + buffer.
  Based on JanumiCode Spec v2.3, §17.5 (scroll and navigation).

  Keeps the DOM small regardless of Governed Stream size.
  Estimates item heights and only renders items within the viewport + buffer.
-->
<script lang="ts" generics="T">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    items: T[];
    estimatedItemHeight?: number;
    bufferCount?: number;
    children: Snippet<[{ item: T; index: number }]>;
  }

  const {
    items,
    estimatedItemHeight = 80,
    bufferCount = 5,
    children,
  }: Props = $props();

  let containerEl = $state<HTMLElement | null>(null);
  let scrollTop = $state(0);
  let containerHeight = $state(0);

  const totalHeight = $derived(items.length * estimatedItemHeight);
  const startIndex = $derived(
    Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - bufferCount),
  );
  const endIndex = $derived(
    Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / estimatedItemHeight) + bufferCount,
    ),
  );
  const visibleItems = $derived(items.slice(startIndex, endIndex));
  const offsetY = $derived(startIndex * estimatedItemHeight);

  function handleScroll() {
    if (containerEl) {
      scrollTop = containerEl.scrollTop;
    }
  }

  onMount(() => {
    if (!containerEl) return;
    containerHeight = containerEl.clientHeight;
    const observer = new ResizeObserver(() => {
      if (containerEl) containerHeight = containerEl.clientHeight;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div class="virtual-scroll" bind:this={containerEl} onscroll={handleScroll}>
  <div class="virtual-scroll-spacer" style="height: {totalHeight}px;">
    <div class="virtual-scroll-content" style="transform: translateY({offsetY}px);">
      {#each visibleItems as item, i (startIndex + i)}
        {@render children({ item, index: startIndex + i })}
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-scroll {
    height: 100%;
    overflow-y: auto;
  }

  .virtual-scroll-spacer {
    position: relative;
  }

  .virtual-scroll-content {
    position: absolute;
    width: 100%;
  }
</style>
