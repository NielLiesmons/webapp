<script lang="ts">
  /**
   * SignedSection - Two columns: codeblock panels showing tail of signed event (left),
   * and large "Signed. Yours. Truly." text (right). Section height clips top of code so only sig part visible.
   */
  const eventTail = {
    created_at: 1734567890,
    sig: "a1b2c3d4e5f6789...",
  };

  const formattedJson = JSON.stringify(eventTail, null, 2);

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderJson(value: unknown, indent: number): string {
    const indentStr = "  ".repeat(indent);
    const nextIndent = "  ".repeat(indent + 1);

    if (value === null) return `<span class="hl-value">null</span>`;
    if (typeof value === "boolean") return `<span class="hl-value">${value}</span>`;
    if (typeof value === "number") return `<span class="hl-value">${value}</span>`;
    if (typeof value === "string")
      return `<span class="hl-punct">"</span><span class="hl-value">${escapeHtml(value)}</span><span class="hl-punct">"</span>`;

    if (Array.isArray(value)) {
      if (value.length === 0) return `<span class="hl-bracket">[</span><span class="hl-bracket">]</span>`;
      const items = (value as unknown[]).map((item, i) => {
        const comma = i < (value as unknown[]).length - 1 ? `<span class="hl-punct">,</span>` : "";
        return `${nextIndent}${renderJson(item, indent + 1)}${comma}`;
      });
      return `<span class="hl-bracket">[</span>\n${items.join("\n")}\n${indentStr}<span class="hl-bracket">]</span>`;
    }

    if (typeof value === "object" && value !== null) {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return `<span class="hl-brace">{</span><span class="hl-brace">}</span>`;
      const entries = keys.map((key, i) => {
        const comma = i < keys.length - 1 ? `<span class="hl-punct">,</span>` : "";
        const keyHtml = `<span class="hl-punct">"</span><span class="hl-key">${escapeHtml(key)}</span><span class="hl-punct">"</span>`;
        const colonHtml = `<span class="hl-punct">:</span>`;
        return `${nextIndent}${keyHtml}${colonHtml} ${renderJson((value as Record<string, unknown>)[key], indent + 1)}${comma}`;
      });
      return `<span class="hl-brace">{</span>\n${entries.join("\n")}\n${indentStr}<span class="hl-brace">}</span>`;
    }

    return escapeHtml(String(value));
  }

  function highlightJson(json: string): string {
    if (!json) return "";
    try {
      return renderJson(JSON.parse(json), 0);
    } catch {
      return escapeHtml(json);
    }
  }

  const highlightedJson = highlightJson(formattedJson);
</script>

<section class="signed-section">
  <div class="signed-container">
    <!-- Left: codeblock panel(s) – bottom of event visible, top clipped -->
    <div class="signed-code-col">
      <div class="signed-code-panel">
        <span class="signed-code-label">JSON</span>
        <div class="signed-code-clip">
          <div class="signed-code-top-spacer" aria-hidden="true"></div>
          <pre><code>{@html highlightedJson}</code></pre>
        </div>
      </div>
    </div>

    <!-- Right: large text on three lines -->
    <div class="signed-text-col">
      <p class="signed-line">Signed.</p>
      <p class="signed-line">Yours.</p>
      <p class="signed-line">Truly.</p>
    </div>
  </div>
</section>

<style>
  .signed-section {
    overflow: hidden;
    padding: 3rem 1rem;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
  }

  @media (min-width: 768px) {
    .signed-section {
      padding: 4rem 1.5rem;
      min-height: 320px;
    }
  }

  .signed-container {
    max-width: 1000px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    align-items: center;
  }

  @media (min-width: 768px) {
    .signed-container {
      grid-template-columns: 1fr auto;
      gap: 3rem;
    }
  }

  /* Code column: panel with clipped top so only bottom (sig) shows */
  .signed-code-col {
    min-width: 0;
    order: 2;
  }

  @media (min-width: 768px) {
    .signed-code-col {
      order: 1;
    }
  }

  .signed-code-panel {
    position: relative;
    background-color: hsl(var(--gray33));
    border-radius: 16px;
    border: 0.33px solid hsl(var(--white16));
    padding: 10px 14px;
    max-height: 200px;
    overflow: hidden;
  }

  @media (min-width: 768px) {
    .signed-code-panel {
      max-height: 240px;
      padding: 12px 16px;
    }
  }

  .signed-code-label {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: hsl(var(--white33));
    display: block;
    margin-bottom: 4px;
  }

  .signed-code-clip {
    overflow: hidden;
    height: 160px;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .signed-code-clip {
      height: 200px;
    }
  }

  .signed-code-top-spacer {
    flex: 1;
    min-height: 120px;
  }

  .signed-code-clip pre {
    margin: 0;
    width: 100%;
    flex-shrink: 0;
  }

  .signed-code-clip code {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0.15px;
    color: hsl(var(--foreground));
    white-space: pre;
    display: block;
  }

  @media (min-width: 768px) {
    .signed-code-clip code {
      font-size: 1.125rem;
    }
  }

  .signed-code-clip :global(.hl-key) {
    color: hsl(var(--blurpleLightColor));
  }

  .signed-code-clip :global(.hl-value) {
    color: hsl(0 0% 100% / 0.9);
  }

  .signed-code-clip :global(.hl-punct) {
    color: hsl(var(--white66));
  }

  .signed-code-clip :global(.hl-brace) {
    color: hsl(var(--goldColor));
  }

  .signed-code-clip :global(.hl-bracket) {
    color: hsl(var(--goldColor66));
  }

  /* Text column: three lines, large */
  .signed-text-col {
    text-align: center;
    order: 1;
  }

  @media (min-width: 768px) {
    .signed-text-col {
      text-align: right;
      order: 2;
    }
  }

  .signed-line {
    margin: 0;
    font-size: 2.5rem;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0.02em;
    background: var(--gradient-gray);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  @media (min-width: 640px) {
    .signed-line {
      font-size: 3.25rem;
    }
  }

  @media (min-width: 768px) {
    .signed-line {
      font-size: 3.5rem;
    }
  }

  @media (min-width: 1024px) {
    .signed-line {
      font-size: 4rem;
    }
  }
</style>
