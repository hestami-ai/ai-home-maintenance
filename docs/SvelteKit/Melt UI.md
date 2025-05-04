
# Instructions

You are developing a modal (dialog) component in a SvelteKit 2.16 application that uses Skeleton UI for design and theme styling. This project intentionally avoids React. Your task is to implement an accessible, focus-trapped modal dialog that works seamlessly across desktop and mobile browsers.

Skeleton UI does not provide modal logic out of the box, but it supports integration with headless UI libraries like Melt UI, Bits UI, and Radix UI (ported to Svelte).

Melt UI has already been installed with NPM.

Use Melt UI’s createDialog() to implement the modal because it:

Supports full accessibility (ARIA roles, keyboard navigation, focus trap)

Is idiomatic Svelte

Integrates cleanly with Skeleton UI's Tailwind-based styling

Requirements:

Create a reusable Modal.svelte component that:

Uses Melt UI’s createDialog()

Includes an overlay with a semi-transparent background

Is centered and responsive (mobile-first with max-width for desktop)

Supports ESC key and click-outside to close

Uses TailwindCSS classes consistent with Skeleton UI themes

Ensure that the modal works correctly in both light and dark mode.

Do not use any React, React-based libraries, or external modal packages outside of Melt UI.

# Melt UI
An open-source Svelte library for building high-quality, accessible design systems and web apps.

Melt UI empowers developers to create accessible UIs that embody their unique style. With a strong focus on accessibility, limitless customization options, and an overall delightful developer experience, Melt UI strives to be the de-facto headless UI library for Svelte.

# Melt UI Docs

At minimum, we recommend you read the following documentation before you start this integration guide.

Styling
How to Use
Requirements
Tooling	Minimum Supported
Svelte	5
Skeleton	3
Tailwind	4
Melt UI	(Svelte 5 version)
Introduction
In this guide we’ll implement the following Melt UI <Accordion> component. This will showcase the bare minimum requirements for integrating Skeleton with Melt UI.

banner
Accordion Documentation

Get Started
1
Create a SvelteKit Project
To begin, we’ll setup a new SvelteKit project, including Skeleton v3 and Tailwind v4.

Setup SvelteKit App
2
Install Melt UI
Install the Melt UI package via your package manager of choice.

Terminal window
npm install melt

3
Component Boilerplate
Create a new component in /lib/components/Accordion/Accordion.svelte and insert the following markup. This will generate an unstyled version of the component.

<script lang="ts">
  import { Accordion, type AccordionItem } from "melt/builders";

  type Item = AccordionItem<{
    title: string;
    description: string;
  }>;

  const items: Item[] = [
    { id: "item-1", title: "What is it?", description: "..."},
    { id: "item-2", title: "Can I customize it?", description: "..."},
  ];

  const accordion = new Accordion();
</script>

<div {...accordion.root}>
  {#each items as i}
    {@const item = accordion.getItem(i)}
    <h2 {...item.heading}>
      <button {...item.trigger}>
        {item.item.title}
      </button>
    </h2>
    <div {...item.content}>
      {item.item.description}
    </div>
  {/each}
</div>

Add the Component
Finally, let’s add our new component to the root +page.svelte so that we may preview it.

<script lang="ts">
  import Accordion from '$lib/components/Accordion/Accordion.svelte';
</script>

<main class="p-10">
  <Accordion />
</main>

Styling
Melt UI builders are made up of native HTML elements, meaning you can implement classes directly. Use this to provide Tailwind and Skeleton utility classes.

Basic Styles
Styling the root element.

<div {...accordion.root} class="card overflow-hidden">
  <!-- ... -->
</div>

Styling the trigger button element.

<button {...item.trigger} class="preset-filled-surface-200-800 hover:preset-filled-primary-500 w-full cursor-pointer p-4 text-left">
  <!-- ... -->
</button>

Styling content element, including animations based on the data-state value.

<div
  {...item.content}
  class="preset-filled-surface-100-900 cursor-pointer p-4 transition-all duration-200 data-[state=closed]:h-0 data-[state=closed]:py-0"
>
  <!-- ... -->
</div>

Before the close of the #each block, insert the follow to insert a <hr /> divider.

{#if index < items.length - 1}<hr class="hr border-surface-50-950" />{/if}

Complete Example
Below is a complete example showing the entire component with styles, transitions, and some basic configuration.

<script lang="ts">
  import { slide } from 'svelte/transition';
  import { Accordion, type AccordionItem } from 'melt/builders';

  type Item = AccordionItem<{
    title: string;
    description: string;
  }>;

  const items: Item[] = [
    {
      id: 'item-1',
      title: 'Bulbasaur',
      description: 'For some time after its birth, it uses the nutrients that are packed into the seed on its back in order to grow.'
    },
    {
      id: 'item-2',
      title: 'Charmander',
      description: 'The flame on its tail shows the strength of its life-force. If Charmander is weak, the flame also burns weakly.'
    },
    {
      id: 'item-3',
      title: 'Squirtle',
      description: 'After birth, its back swells and hardens into a shell. It sprays a potent foam from its mouth.'
    }
  ];

  const accordion = new Accordion({ multiple: true });
</script>

<div {...accordion.root} class="card w-full max-w-xl overflow-hidden">
  {#each items as i, index}
    {@const item = accordion.getItem(i)}
    <h2 {...item.heading}>
      <button {...item.trigger} class="preset-filled-surface-200-800 hover:preset-filled-primary-500 w-full cursor-pointer p-4 text-left">
        {item.item.title}
      </button>
    </h2>
    {#if item.isExpanded}
      <div {...item.content} class="preset-filled-surface-100-900 cursor-pointer p-4" transition:slide={{ duration: 100 }}>
        {item.item.description}
      </div>
    {/if}
    {#if index < items.length - 1}<hr class="hr border-surface-50-950" />{/if}
  {/each}
</div>


