<script lang="ts">
	interface Props {
		data: {
			session: any;
			memberships: any[];
			organization: any;
			staff: any;
		};
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// Note: Authentication is enforced server-side in +layout.server.ts
	// Data is passed via SSR - no client-side store loading needed
</script>

{@render children()}
