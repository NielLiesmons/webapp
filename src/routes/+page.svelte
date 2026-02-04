<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import DownloadModal from "$lib/components/common/DownloadModal.svelte";
  import ParallaxHero from "$lib/components/landing/ParallaxHero.svelte";
  import GetTheAppSection from "$lib/components/landing/GetTheAppSection.svelte";
  import TestimonialsSection from "$lib/components/landing/TestimonialsSection.svelte";
  import ZapTheAppSection from "$lib/components/landing/ZapTheAppSection.svelte";
  import ReleaseYourAppsSection from "$lib/components/landing/ReleaseYourAppsSection.svelte";
  import DifferenceSection from "$lib/components/landing/DifferenceSection.svelte";
  import RoadmapSection from "$lib/components/landing/RoadmapSection.svelte";
  import TeamSection from "$lib/components/landing/TeamSection.svelte";
  import { initNostrService, queryStoreOne, fetchProfile } from "$lib/nostr";

  let { data } = $props();

  type TestimonialRow = {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    npub?: string;
    nevent?: string;
    profile?: { displayName?: string; name?: string; picture?: string | null; nip05?: string | null };
  };
  const initialTestimonials = $derived(data?.testimonials ?? []);
  let testimonials = $state<TestimonialRow[]>([]);

  let showDownloadModal = $state(false);

  if (browser) {
    onMount(async () => {
      const raw: TestimonialRow[] = Array.isArray(initialTestimonials) ? initialTestimonials : [];
      testimonials = raw;
      await initNostrService();
      if (raw.length === 0) return;

      type ProfileShape = { displayName?: string; name?: string; picture?: string; nip05?: string };
      const profilesByPubkey = new Map<string, ProfileShape>();

      for (const t of raw) {
        const pubkey = t.pubkey;
        if (!pubkey || profilesByPubkey.has(pubkey)) continue;

        const ev = queryStoreOne({ kinds: [0], authors: [pubkey] });
        if (ev?.content) {
          try {
            const c = JSON.parse(ev.content) as Record<string, unknown>;
            profilesByPubkey.set(pubkey, {
              displayName: (c.display_name as string) ?? (c.name as string),
              name: c.name as string,
              picture: c.picture as string,
              nip05: c.nip05 as string,
            });
          } catch {
            /* ignore */
          }
        }
      }

      const missing = raw.filter((t) => t.pubkey && !profilesByPubkey.has(t.pubkey));
      await Promise.all(
        missing.slice(0, 30).map(async (t) => {
          const pubkey = t.pubkey!;
          try {
            const event = await fetchProfile(pubkey);
            if (event?.content) {
              const content = JSON.parse(event.content) as Record<string, unknown>;
              profilesByPubkey.set(pubkey, {
                displayName: (content.display_name as string) ?? (content.name as string),
                name: content.name as string,
                picture: content.picture as string,
                nip05: content.nip05 as string,
              });
            }
          } catch {
            /* ignore */
          }
        })
      );

      testimonials = raw.map((t) => ({
        ...t,
        profile: profilesByPubkey.get(t.pubkey) ?? t.profile,
      }));
    });
  }

  $effect(() => {
    if (!browser) return;
    if (testimonials.length > 0) return;
    if (initialTestimonials.length > 0) testimonials = initialTestimonials;
  });
</script>

<svelte:head>
  <title>Zapstore</title>
  <meta name="description" content="Discover apps on Nostr. Open source, decentralized app store." />
</svelte:head>

<DownloadModal bind:open={showDownloadModal} isZapstore={true} />

<!-- Hero Section -->
<ParallaxHero />

<!-- Get The App Section -->
<GetTheAppSection showDownloadModal={() => (showDownloadModal = true)} />

<!-- Release with ease Section -->
<ReleaseYourAppsSection />

<!-- Testimonials Section -->
<TestimonialsSection {testimonials} />

<!-- What's the difference Section -->
<DifferenceSection />

<!-- Zap The App Section -->
<ZapTheAppSection />

<!-- Roadmap Section -->
<RoadmapSection />

<!-- Team Section -->
<TeamSection />
