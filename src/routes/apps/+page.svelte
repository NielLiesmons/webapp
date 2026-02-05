<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import AppSmallCard from '$lib/components/cards/AppSmallCard.svelte';
	import SkeletonLoader from '$lib/components/common/SkeletonLoader.svelte';
	import type { App } from '$lib/nostr';
	import { encodeAppNaddr } from '$lib/nostr/models';
	import {
		getApps,
		getHasMore,
		isRefreshing,
		isLoadingMore,
		isStoreInitialized,
		initWithPrerenderedData,
		scheduleRefresh,
		loadMore
	} from '$lib/stores/nostr.svelte';
	import type { PageData } from './$types';

	const SCROLL_THRESHOLD = 800; // pixels from bottom to trigger load

	let { data }: { data: PageData } = $props();

	// Reactive getters from store
	const storeApps = $derived(getApps());
	const storeInitialized = $derived(isStoreInitialized());
	const hasMore = $derived(getHasMore());
	const refreshing = $derived(isRefreshing());
	const loadingMore = $derived(isLoadingMore());

	// Search query from URL (?q=...); simple client-side filter by name, description, or tags
	const searchQ = $derived(get(page).url.searchParams.get('q')?.trim() ?? '');

	function appMatchesSearch(app: App, q: string): boolean {
		if (!q) return true;
		const lower = q.toLowerCase();
		const inName = app.name?.toLowerCase().includes(lower);
		const inDesc = app.description?.toLowerCase().includes(lower);
		let inTags = false;
		const raw = app.rawEvent as { tags?: string[][] } | undefined;
		if (raw?.tags) {
			for (const tag of raw.tags) {
				for (let i = 1; i < tag.length; i++) {
					if (typeof tag[i] === 'string' && (tag[i] as string).toLowerCase().includes(lower)) {
						inTags = true;
						break;
					}
				}
				if (inTags) break;
			}
		}
		return inName || inDesc || inTags;
	}

	// SSR-safe display logic, then apply search filter when q is present
	const baseApps = $derived(storeInitialized ? storeApps : (data.apps ?? []));
	const displayApps = $derived(
		searchQ ? baseApps.filter((app) => appMatchesSearch(app, searchQ)) : baseApps
	);

	// Navigate to app detail page route (/apps/[naddr])
	function getAppUrl(app: App): string {
		const naddr = app.naddr || encodeAppNaddr(app.pubkey, app.dTag);
		return `/apps/${naddr}`;
	}

	// Infinite scroll: check if near bottom
	function shouldLoadMore(): boolean {
		if (!browser) return false;
		const scrollTop = window.scrollY || document.documentElement.scrollTop;
		const scrollHeight = document.documentElement.scrollHeight;
		const clientHeight = window.innerHeight;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
		return distanceFromBottom < SCROLL_THRESHOLD;
	}

	function handleScroll() {
		if (hasMore && !loadingMore && shouldLoadMore()) {
			loadMore();
		}
	}

	onMount(() => {
		if (!browser) return;

		// Use cached apps when coming from discover (or elsewhere): don't overwrite with empty.
		// Only init when we have server data to show, or when store was never initialized.
		if (!isStoreInitialized() || (data.apps?.length ?? 0) > 0) {
			initWithPrerenderedData(data.apps ?? [], data.nextCursor ?? null);
		}

		// Add scroll listener for infinite scroll
		window.addEventListener('scroll', handleScroll, { passive: true });

		// Always schedule background refresh so we can load/update in the meantime
		scheduleRefresh();
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('scroll', handleScroll);
		}
	});
</script>

<svelte:head>
	<title>Browse Apps — Zapstore</title>
	<meta name="description" content="Browse all apps available on Zapstore" />
</svelte:head>

<section class="apps-page">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="page-header">
			<h1>{searchQ ? `Search: “${searchQ}”` : 'All Apps'}</h1>
		</div>

		<div class="app-grid">
			{#if displayApps.length === 0 && !refreshing}
				<p class="empty-state">{searchQ ? `No apps match “${searchQ}”` : 'No apps found'}</p>
			{:else if displayApps.length > 0}
				{#each displayApps as app (app.id)}
					<div class="app-item">
						<AppSmallCard {app} href={getAppUrl(app)} />
					</div>
				{/each}
			{:else}
				<!-- Loading: 3 skeleton cards that mimic AppSmallCard -->
				{#each [1, 2, 3] as _}
					<div class="app-item skeleton-item">
						<div class="skeleton-card">
							<div class="skeleton-icon">
								<SkeletonLoader />
							</div>
							<div class="skeleton-info">
								<div class="skeleton-name">
									<SkeletonLoader />
								</div>
								<div class="skeleton-desc-lines">
									<div class="skeleton-desc skeleton-desc-1"></div>
									<div class="skeleton-desc skeleton-desc-2 desktop-only"></div>
								</div>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		{#if loadingMore}
			<div class="loader">
				<span class="loading-spinner"></span>
				<span>Loading more...</span>
			</div>
		{/if}

		{#if !hasMore && displayApps.length > 0}
			<p class="end-message">You've reached the end</p>
		{/if}
	</div>
</section>

<style>
	.apps-page {
		padding: 1.5rem 0;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		color: hsl(var(--foreground));
	}

	@media (min-width: 768px) {
		.page-header h1 {
			font-size: 2rem;
		}
	}

	/* 3-column grid for apps */
	.app-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}

	@media (min-width: 640px) {
		.app-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 1.5rem;
		}
	}

	@media (min-width: 1024px) {
		.app-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 2rem;
		}
	}

	.app-item {
		padding: 0.75rem 0;
		border-bottom: 1px solid hsl(var(--border) / 0.5);
	}

	.app-item:last-child {
		border-bottom: none;
	}

	@media (min-width: 640px) {
		.app-item {
			padding: 0;
			border-bottom: none;
		}
	}

	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		color: hsl(var(--muted-foreground));
		padding: 3rem;
	}

	/* Skeleton cards (mimic AppSmallCard) when loading */
	.skeleton-item {
		padding: 0.75rem 0;
		border-bottom: 1px solid hsl(var(--border) / 0.5);
	}
	@media (min-width: 640px) {
		.skeleton-item {
			padding: 0;
			border-bottom: none;
		}
	}
	.skeleton-card {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 4px 0;
	}
	@media (min-width: 768px) {
		.skeleton-card {
			gap: 20px;
		}
	}
	.skeleton-icon {
		width: 56px;
		height: 56px;
		border-radius: 16px;
		overflow: hidden;
		flex-shrink: 0;
	}
	@media (min-width: 768px) {
		.skeleton-icon {
			width: 72px;
			height: 72px;
			border-radius: 24px;
		}
	}
	.skeleton-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 6px;
		min-width: 0;
	}
	.skeleton-name {
		width: 100px;
		height: 18px;
		border-radius: 12px;
		overflow: hidden;
	}
	@media (min-width: 768px) {
		.skeleton-name {
			width: 140px;
			height: 20px;
		}
	}
	.skeleton-desc-lines {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.skeleton-desc {
		height: 10px;
		border-radius: 12px;
		background: hsl(var(--gray33));
	}
	.skeleton-desc-1 {
		width: 180px;
	}
	.skeleton-desc-2 {
		width: 120px;
	}
	.skeleton-desc-2.desktop-only {
		display: none;
	}
	@media (min-width: 768px) {
		.skeleton-desc {
			height: 12px;
		}
		.skeleton-desc-1 {
			width: 220px;
		}
		.skeleton-desc-2 {
			width: 160px;
		}
		.skeleton-desc-2.desktop-only {
			display: block;
		}
	}

	.loader {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
	}

	.loading-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid hsl(var(--border));
		border-top-color: hsl(var(--primary));
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.end-message {
		text-align: center;
		padding: 2rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
	}
</style>
