<script lang="ts">
  import PublishAppSection from '$lib/components/developer/PublishAppSection.svelte';
  import StudioHero from '$lib/components/developer/StudioHero.svelte';
  import StudioToolsSection from '$lib/components/developer/StudioToolsSection.svelte';
  import { getCurrentPubkey } from '$lib/stores/auth.svelte';

  // Check if user is signed in
  const isSignedIn = $derived(getCurrentPubkey() !== null);
</script>

<svelte:head>
  <title>Zapstore Studio — Developers</title>
  <meta
    name="description"
    content="A purpose-built developer suite. Reliable tools for shipping apps and interacting with communities of users"
  />
</svelte:head>

{#if isSignedIn}
  <!-- Dashboard for logged in users -->
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold mb-6">Developer Dashboard</h1>
    <div class="panel">
      <p class="text-muted-foreground">
        Developer dashboard coming soon. You'll be able to manage your apps, view analytics, and more.
      </p>
    </div>
  </div>
{:else}
  <!-- Studio hero: desktop screenshot + terminal CLI + mobile placeholder -->
  <StudioHero />

  <!-- Tools + Docs section -->
  <StudioToolsSection />

  <!-- Publish Without Permission Section -->
  <PublishAppSection />
{/if}
