<script>
  const docsHref = "/docs";
</script>

<section class="studio-tools-section">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
    <div class="tools-grid">
      <!-- Tools panel (GetTheAppSection-style) -->
      <div class="section-panel" style="background-color: hsl(var(--gray33)); border-radius: var(--radius-32);">
        <h2 class="panel-title">Tools</h2>
        <div class="option-cards">
          <a href="/docs" class="option-card" rel="noopener">
            <div class="option-card-inner">
              <span class="option-name">ZSP CLI</span>
              <span class="option-desc">Command-line tool for publishing and managing apps</span>
              <span class="option-cta btn-primary-small">Get It</span>
            </div>
          </a>
          <div class="option-card option-card-disabled">
            <div class="option-card-inner">
              <span class="option-name">Studio Apps</span>
              <span class="option-desc">Desktop and web apps for Zapstore Studio</span>
              <span class="pill-coming">Coming soon</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Docs panel (GetTheAppSection-style) -->
      <div class="section-panel" style="background-color: hsl(var(--gray33)); border-radius: var(--radius-32);">
        <h2 class="panel-title">Docs</h2>
        <div class="option-cards">
          <a href="/docs" class="option-card" rel="noopener">
            <div class="option-card-inner">
              <span class="option-name">Quickstart</span>
              <span class="option-desc">Get up and running with Zapstore</span>
            </div>
          </a>
          <a href="/docs/faq" class="option-card" rel="noopener">
            <div class="option-card-inner">
              <span class="option-name">FAQ</span>
              <span class="option-desc">Common questions and answers</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .studio-tools-section {
    border-top: 0.33px solid hsl(var(--border));
  }

  .tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .section-panel {
    padding: 1.5rem 1.25rem;
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--white));
    margin: 0 0 1rem 0;
  }

  .option-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-card {
    display: block;
    text-decoration: none;
    border-radius: var(--radius-16);
    background-color: hsl(var(--white8));
    border: 0.33px solid hsl(var(--white11));
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .option-card:hover {
    background-color: hsl(var(--white11));
    border-color: hsl(var(--white16));
  }

  .option-card-disabled {
    cursor: default;
    pointer-events: none;
    opacity: 0.9;
  }

  .option-card-disabled:hover {
    background-color: hsl(var(--white8));
    border-color: hsl(var(--white11));
  }

  .option-card-inner {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1.25rem;
    align-items: flex-start;
  }

  .option-name {
    font-weight: 600;
    color: hsl(var(--white));
    font-size: 0.9375rem;
  }

  .option-desc {
    font-size: 0.8125rem;
    color: hsl(var(--white33));
  }

  .option-cta {
    margin-top: 0.5rem;
  }

  .pill-coming {
    font-size: 0.75rem;
    font-weight: 500;
    color: hsl(var(--white33));
    background: hsl(var(--white11));
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    white-space: nowrap;
    margin-top: 0.5rem;
  }

  @media (max-width: 639px) {
    .tools-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
