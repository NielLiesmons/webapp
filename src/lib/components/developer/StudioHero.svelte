<script>
  import { onMount } from "svelte";
  import { assets } from "$app/paths";

  let mounted = false;

  onMount(() => {
    requestAnimationFrame(() => {
      mounted = true;
    });
  });
</script>

<section class="studio-hero relative studio-hero-no-clip">
  <!-- Header Content - tighter spacing -->
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12">
    <h1
      class="text-display-lg text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight mb-3 sm:mb-4"
    >
      <span
        style="background: var(--gradient-gray); -webkit-background-clip: text; background-clip: text; color: transparent;"
      >
        A purpose-built
      </span>
      <br />
      <span
        style="background: var(--gradient-blurple-light); -webkit-background-clip: text; background-clip: text; color: transparent;"
      >
        developer suite
      </span>
    </h1>
    <p class="text-lg sm:text-xl text-muted-foreground max-w-lg mb-6 sm:mb-8">
      Reliable tools for shipping apps and interacting with communities of users.
    </p>
  </div>

  <!-- Screenshots: same 3D layout as DeveloperHero (absolute positioning, all with 3D transforms) -->
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative studio-screenshots-container">
    <div class="studio-screenshots-wrapper">
      <!-- Desktop - full width, 3D tilt, real image, no border/clip -->
      <div class="screenshot-desktop {mounted ? 'screenshot-visible' : ''}">
        <img
          src={`${assets}/images/studio-screenshot.png`}
          alt="Zapstore Studio desktop preview"
          class="studio-desktop-img"
          loading="lazy"
        />
      </div>

      <!-- CLI - custom terminal, 3D tilt -->
      <div class="screenshot-cli {mounted ? 'screenshot-visible' : ''}">
        <div class="terminal-window">
          <div class="terminal-header">
            <span class="terminal-dot terminal-dot-red"></span>
            <span class="terminal-dot terminal-dot-yellow"></span>
            <span class="terminal-dot terminal-dot-green"></span>
            <span class="terminal-title">zsp</span>
          </div>
          <div class="terminal-body">
            <div class="terminal-line">
              <span class="terminal-prompt">$</span>
              <span class="terminal-cmd">zsp publish ./my-app</span>
            </div>
            <div class="terminal-line terminal-output">
              <span class="terminal-success">✓</span> Building app...
            </div>
            <div class="terminal-line terminal-output">
              <span class="terminal-success">✓</span> Pushing to Zapstore...
            </div>
            <div class="terminal-line terminal-output">
              <span class="terminal-success">✓</span> Published
              <span class="terminal-muted">naddr1qq...</span>
            </div>
            <div class="terminal-line">
              <span class="terminal-prompt">$</span>
              <span class="terminal-cursor">_</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile - placeholder, 3D tilt -->
      <div class="screenshot-mobile {mounted ? 'screenshot-visible' : ''}">
        <div class="screenshot-placeholder screenshot-placeholder-mobile">
          <span class="placeholder-label">Mobile</span>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .studio-hero {
    padding-bottom: 2rem;
  }

  /* Allow 3D to extend without clipping; section expands to fit */
  .studio-hero-no-clip {
    overflow: visible;
  }

  .studio-screenshots-container {
    perspective: 800px;
    overflow: visible;
  }

  /* Wrapper: tall enough so 16:9 desktop image + 3D tilt isn't clipped (no max-height) */
  .studio-screenshots-wrapper {
    position: relative;
    min-height: 280px;
    transform-style: preserve-3d;
    overflow: visible;
  }

  /* ~16/9 of typical container width so image fits without clipping */
  @media (min-width: 640px) {
    .studio-screenshots-wrapper {
      min-height: 360px;
    }
  }

  @media (min-width: 768px) {
    .studio-screenshots-wrapper {
      min-height: 432px; /* 768 * 9/16 */
    }
  }

  @media (min-width: 1024px) {
    .studio-screenshots-wrapper {
      min-height: 576px; /* 1024 * 9/16 */
    }
  }

  @media (min-width: 1280px) {
    .studio-screenshots-wrapper {
      min-height: 720px; /* 1280 * 9/16 */
    }
  }

  /* Base: absolute positioning + 3D like DeveloperHero */
  .screenshot-desktop,
  .screenshot-mobile,
  .screenshot-cli {
    position: absolute;
    opacity: 0;
    transition: opacity 0.6s ease-out, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
    transform-style: preserve-3d;
  }

  .screenshot-visible {
    opacity: 1;
  }

  /* Desktop - full width, 3D tilt, no border/clip on image */
  .screenshot-desktop {
    left: 0;
    right: 0;
    top: 0;
    z-index: 3;
    transform: rotateY(15deg) rotateX(5deg) rotateZ(-20deg);
    transform-origin: left center;
  }

  .studio-desktop-img {
    width: 100%;
    height: auto;
    max-height: none;
    display: block;
    aspect-ratio: 16 / 9;
    object-fit: contain;
  }

  /* Mobile - left-of-right side, 3D tilt; starts higher for fall-in */
  .screenshot-mobile {
    right: 22%;
    top: 10%;
    z-index: 4;
    width: 140px;
    transition-delay: 100ms;
    transform: rotateY(10deg) rotateX(3deg) rotateZ(-20deg) translateY(-48px);
    transform-origin: right center;
  }

  .screenshot-mobile.screenshot-visible {
    transform: rotateY(10deg) rotateX(3deg) rotateZ(-20deg) translateY(0);
  }

  /* CLI - right side lower, 3D tilt; starts higher for fall-in */
  .screenshot-cli {
    right: 15%;
    top: 40%;
    z-index: 2;
    width: 260px;
    transition-delay: 200ms;
    transform: rotateY(8deg) rotateX(4deg) rotateZ(-20deg) translateY(-48px);
    transform-origin: right center;
  }

  .screenshot-cli.screenshot-visible {
    transform: rotateY(8deg) rotateX(4deg) rotateZ(-20deg) translateY(0);
  }

  .terminal-window {
    background: hsl(240, 8%, 12%);
    border-radius: 10px;
    border: 0.33px solid hsl(var(--white16));
    overflow: hidden;
    box-shadow: 0 8px 24px hsl(var(--black33));
  }

  .terminal-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: hsl(240, 6%, 16%);
    border-bottom: 0.33px solid hsl(var(--white11));
  }

  .terminal-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .terminal-dot-red {
    background: #ff5f56;
  }

  .terminal-dot-yellow {
    background: #ffbd2e;
  }

  .terminal-dot-green {
    background: #27c93f;
  }

  .terminal-title {
    margin-left: 8px;
    font-size: 12px;
    color: hsl(var(--white33));
  }

  .terminal-body {
    padding: 12px 14px;
    font-family: ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace;
    font-size: 13px;
    line-height: 1.6;
  }

  .terminal-line {
    margin-bottom: 2px;
  }

  .terminal-prompt {
    color: hsl(var(--blurpleColor));
    margin-right: 6px;
  }

  .terminal-cmd {
    color: hsl(var(--white));
  }

  .terminal-output {
    color: hsl(var(--white66));
    padding-left: 1.2em;
  }

  .terminal-success {
    color: #27c93f;
    margin-right: 6px;
  }

  .terminal-muted {
    color: hsl(var(--white33));
  }

  .terminal-cursor {
    color: hsl(var(--white));
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  .screenshot-placeholder {
    background: hsl(var(--gray33));
    border: 1px dashed hsl(var(--white22));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .screenshot-placeholder-mobile {
    width: 100%;
    height: 240px;
    border-radius: 20px;
  }

  .placeholder-label {
    font-size: 11px;
    color: hsl(var(--white33));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* Responsive - match DeveloperHero breakpoints */
  @media (min-width: 640px) {
    .screenshot-mobile {
      width: 160px;
    }

    .screenshot-placeholder-mobile {
      height: 280px;
    }

    .screenshot-cli {
      width: 300px;
    }
  }

  @media (min-width: 1024px) {
    .screenshot-mobile {
      width: 180px;
      right: 12%;
    }

    .screenshot-placeholder-mobile {
      height: 320px;
    }

    .screenshot-cli {
      width: 340px;
      right: 12%;
    }
  }

  /* Mobile: show all three with smaller CLI and mobile, adjusted positions */
  @media (max-width: 639px) {
    .screenshot-desktop {
      transform: rotateY(12deg) rotateX(4deg) rotateZ(-20deg);
    }

    .screenshot-mobile {
      width: 100px;
      right: 8%;
      top: 6%;
      transform: rotateY(8deg) rotateX(2deg) rotateZ(-20deg) translateY(-36px);
    }

    .screenshot-mobile.screenshot-visible {
      transform: rotateY(8deg) rotateX(2deg) rotateZ(-20deg) translateY(0);
    }

    .screenshot-placeholder-mobile {
      height: 160px;
    }

    .screenshot-cli {
      width: 180px;
      right: 4%;
      top: 32%;
      transform: rotateY(6deg) rotateX(3deg) rotateZ(-20deg) translateY(-36px);
    }

    .screenshot-cli.screenshot-visible {
      transform: rotateY(6deg) rotateX(3deg) rotateZ(-20deg) translateY(0);
    }
  }
</style>
