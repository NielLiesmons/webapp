<script lang="ts">
  /**
   * Spinner - A 3/4 circle spinning indicator.
   * Configurable color and size for use in buttons, tabs, inline loading.
   */
  interface Props {
    /** CSS color (default: blurple) */
    color?: string;
    /** Size in pixels (default: 14) */
    size?: number;
    className?: string;
  }

  let {
    color = "hsl(var(--blurpleColor))",
    size = 14,
    className = "",
  }: Props = $props();
</script>

<svg
  class="spinner {className}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2.8"
  stroke-linecap="round"
  aria-hidden="true"
>
  <!-- 3/4 circle: dash 3/4 of circumference, gap 1/4 (2*pi*10 ≈ 62.83) -->
  <circle
    cx="12"
    cy="12"
    r="10"
    stroke-dasharray="47.12 15.71"
    class="spinner-arc"
  />
</svg>

<style>
  .spinner {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .spinner-arc {
    transform-origin: 12px 12px;
    animation: spinner-rotate 0.8s linear infinite;
  }

  @keyframes spinner-rotate {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner-arc {
      animation-duration: 1.5s;
    }
  }
</style>
