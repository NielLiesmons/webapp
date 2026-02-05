<script>
	import { ChevronRight } from '$lib/components/icons';
	import { assets } from '$app/paths';

	const docsHref = '/docs';
</script>

<section id="quickstart" class="studio-tools-section border-t border-b border-border/50">
  <div class="studio-tools-container">
		<h2 class="studio-quick-start-title">QUICKSTART</h2>

		<div class="studio-tools-grid">
			<!-- Left: Install panel (gray33) -->
			<div
				class="studio-panel"
				style="background-color: hsl(var(--gray33)); border-radius: var(--radius-32);"
			>
				<div class="studio-panel-inner">
					<div class="studio-panel-header">
						<img src={`${assets}/images/emoji/app.png`} alt="" class="studio-panel-header-img" />
						<h3 class="studio-panel-header-title">Install</h3>
					</div>
					<a href={docsHref} class="studio-panel-row studio-panel-row-link" rel="noopener">
						<div class="studio-panel-row-content">
							<span class="studio-panel-row-name">ZSP</span>
							<span class="studio-panel-row-desc">CLI for publishing and managing apps</span>
						</div>
						<span class="studio-panel-row-chevron"
							><ChevronRight size={16} color="hsl(var(--white33))" /></span
						>
					</a>
					<div class="studio-panel-row studio-panel-row-static">
						<div class="studio-panel-row-content">
							<span class="studio-panel-row-name">Studio Apps</span>
							<span class="studio-panel-row-desc"
								>Desktop and web apps for Zapstore. Coming soon.</span
							>
						</div>
					</div>
				</div>
			</div>

			<!-- Right: Documentation panel (gray33) -->
			<div
				class="studio-panel"
				style="background-color: hsl(var(--gray33)); border-radius: var(--radius-32);"
			>
				<div class="studio-panel-inner">
					<div class="studio-panel-header">
						<img
							src={`${assets}/images/emoji/documentation.png`}
							alt=""
							class="studio-panel-header-img"
						/>
						<h3 class="studio-panel-header-title">Documentation</h3>
					</div>
					<a href="/docs" class="studio-panel-row studio-panel-row-link" rel="noopener">
						<div class="studio-panel-row-content">
							<span class="studio-panel-row-name">Quickstart</span>
							<span class="studio-panel-row-desc">Get up and running with Zapstore</span>
						</div>
						<span class="studio-panel-row-chevron"
							><ChevronRight size={16} color="hsl(var(--white33))" /></span
						>
					</a>
					<a href="/docs/faq" class="studio-panel-row studio-panel-row-link" rel="noopener">
						<div class="studio-panel-row-content">
							<span class="studio-panel-row-name">FAQ</span>
							<span class="studio-panel-row-desc">Common questions and answers</span>
						</div>
						<span class="studio-panel-row-chevron"
							><ChevronRight size={16} color="hsl(var(--white33))" /></span
						>
					</a>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.studio-tools-section {
		padding: 0;
	}

	.studio-tools-container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1rem 2.5rem;
	}

	@media (min-width: 768px) {
		.studio-tools-container {
			padding: 3.75rem 1rem 4.75rem;
		}
	}

	/* Gray gradient at 33% opacity; mobile-friendly sizes */
	.studio-quick-start-title {
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.3;
		margin: 0 0 1.85rem 0;
		text-align: center;
		letter-spacing: 0.2em;
		background: var(--gradient-gray33);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	@media (min-width: 640px) {
		.studio-quick-start-title {
			font-size: 1.125rem;
		}
	}

	@media (min-width: 768px) {
		.studio-quick-start-title {
			font-size: 1.25rem;
		}
	}

	.studio-tools-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.studio-tools-grid {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}
	}

	.studio-panel-inner {
		padding: 0 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* Header: divider spans full width; more spacing emoji–title, more vertical padding */
	.studio-panel-header {
		display: flex;
		align-items: center;
		gap: 1.05rem;
		margin: 0 -1.5rem 0 -1.5rem;
		padding: 1.35rem 1.5rem 1rem 1.5rem;
		border-bottom: 1.4px solid hsl(var(--white11));
	}

	.studio-panel-header-img {
		width: 36px;
		height: 36px;
		object-fit: contain;
	}

	.studio-panel-header-title {
		font-size: 1.0625rem;
		font-weight: 600;
		color: hsl(var(--white));
		margin: 0;
	}

	@media (min-width: 640px) {
		.studio-panel-header-title {
			font-size: 1.2rem;
		}
	}

	@media (min-width: 768px) {
		.studio-panel-header-title {
			font-size: 1.35rem;
		}
	}

	/* Rows: divider spans full width; more horizontal padding */
	.studio-panel-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0 -1.5rem 0 -1.5rem;
		padding: 0.9rem 1.5rem;
		text-decoration: none;
		color: inherit;
		border-bottom: 1.4px solid hsl(var(--white11));
	}

	.studio-panel-row:last-child {
		border-bottom: none;
		padding-bottom: 1rem;
	}

	.studio-panel-row-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.studio-panel-row-name {
		font-weight: 600;
		font-size: 0.875rem;
		color: hsl(var(--white));
		display: block;
	}

	.studio-panel-row-desc {
		font-size: 0.8125rem;
		color: hsl(var(--white66));
		display: block;
	}

	@media (min-width: 640px) {
		.studio-panel-row-name {
			font-size: 0.9375rem;
		}

		.studio-panel-row-desc {
			font-size: 0.875rem;
		}
	}

	.studio-panel-row-chevron {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: hsl(var(--white33));
	}

	.studio-panel-row-static {
		cursor: default;
	}
</style>
