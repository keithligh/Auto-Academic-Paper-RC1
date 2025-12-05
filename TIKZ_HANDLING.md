# TikZ Handling Strategy: The "Sandbox & Silence" Protocol

This document details the specific engineering strategies used to render compiled TikZ diagrams in the browser within the Auto Academic Paper application.

Rendering TikZ in the browser is notoriously difficult because TikZ is a Turing-complete language that requires a full TeX engine. We use a **Hybrid Isolation Strategy** to achieve this without crashing the main application.

---

## 1. The Core Problem
Client-side LaTeX parsers (like `latex.js` and `KaTeX`) **cannot** render TikZ. They lack the logic engine required to calculate coordinates, paths, and nodes.

The only viable browser-based solution is **TikZJax**, a WebAssembly port of the TeX engine. However, TikZJax is heavy, fragile, and prone to crashing the main thread if mishandled.

## 2. The Solution: "Extraction, Isolation, Sanitation"

We treat TikZ code not as text, but as a **Hazardous Material** that must be handled in a controlled environment.

### Phase 0: The Filter (Detection & Rejection)
Not all TikZ code is safe for the browser. Specifically, `pgfplots` (plots based on datasets) are too computationally expensive and font-dependent for TikZJax.

-   **Trigger**: We check the captured TikZ code for `\begin{axis}` or `\addplot`.
-   **Action**: If found, we **ABORT** the rendering process for that specific block.
-   **Output**: We inject a warning placeholder: `⚠️ Complex diagram (pgfplots) - renders in PDF only`.
-   **Why**: Attemping to render these causes WebAssembly out-of-memory errors. The "Trojan Horse" philosophy relies on graceful degradation, not crashing.

### Phase 1: The Heist (Extraction)
Before the main document is parsed by `latex.js`, we steal the TikZ code.

- **Regex**: `content.match(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g)`
- **Placeholder**: We replace the entire block with a safe ID: `LATEXPREVIEWTIKZBLOCK1`.
- **Reason**: If `latex.js` sees even a single `\node` command, it will throw a syntax error and crash the entire preview.

### Phase 2: The Detox (Sanitization)
Raw LaTeX cannot be fed directly to TikZJax strings because of JavaScript encoding issues.

1.  **ASCII Enforcement (The `btoa` Fix)**
    -   **Problem**: TikZJax uses `btoa()` internally to encode the source. If the input contains Unicode characters (like em-dashes `—`, smart quotes `“”`, or CJK characters), `btoa` throws a `InvalidCharacterError` and crashes.
    -   **Solution**: We run a "Nuclear" regex pass on the extracted TikZ code: `.replace(/[^\x00-\x7F]/g, '')`. This strips everything that isn't standard ASCII.

2.  **Typography Denormalization (The Path Fix)**
    -   **Problem**: Our global text prettier converts double-hyphens `--` into en-dashes `–`.
    -   **Critical Failure**: In TikZ, `--` is a functional operator defining a path between coordinates (e.g., `(A) -- (B)`). Converting this to an en-dash `(A) – (B)` breaks the syntax, causing "Cannot parse coordinate" errors.
    -   **Solution**: We explicitly **SKIP** typography normalization for extracted TikZ blocks. We pass the raw `--` exactly as written.

### Phase 3: The Sandbox (Iframe Isolation)
We do not render TikZ in the main DOM. We inject it into a dedicated `<iframe>`.

-   **Why?**
    1.  **CSS Isolation**: TikZJax injects SVG styles that often conflict with Tailwind CSS.
    2.  **Error Containment**: If the WebAssembly engine crashes, it crashes the iframe, not the React app.
    3.  **Global Scope Protection**: TikZJax modifies global window objects; the iframe keeps this contained.

### Phase 4: The Context Injection (The Wrapping Fix)
Our regex extracts the *body* of the environment, stripping the `\begin{tikzpicture}` tags.

-   **Problem**: Passing just `\node {hi};` to TikZJax fails because the engine expects to be inside a picture environment for certain commands.
-   **Solution**: Inside the iframe's `<script type="text/tikz">` tag, we explicitly re-wrap the content:
    ```latex
    \begin{tikzpicture}
    [CONTENT]
    \end{tikzpicture}
    ```

### Phase 5: The Silencer (Error Suppression)
TikZJax running in an iframe often throws false-positive errors due to browser extensions or message passing timing.

-   **The Error**: `Uncaught (in promise) Error: message channel closed`
-   **The Fix**: We inject this JavaScript into the iframe head:
    ```javascript
    window.addEventListener('error', e => {
      if (e.message?.includes('message channel closed')) e.preventDefault();
    });
    window.addEventListener('unhandledrejection', e => {
      if (e.reason?.message?.includes('message channel closed')) e.preventDefault();
    });
    ```
    This suppresses the console noise while allowing genuine rendering errors to be handled.

### Phase 6: The Auto-Resize (MutationObserver)
Since the TikZ diagram size is unknown until render time, the iframe defaults to `0px`.

-   **Mechanism**: We place a `MutationObserver` inside the iframe.
-   **Trigger**: It watches the `<body>` for the creation of an `<svg>` element.
-   **Action**: Once found, it measures the SVG's `getBoundingClientRect()` and sets the `window.frameElement.style.height` and `width` on the parent page.
-   **Result**: The iframe snaps to the exact size of the diagram.

### Phase 7: The Density Reduction (Pure Coordinate Expansion)
AI-generated TikZ diagrams often have cramped, overlapping elements because the AI uses tight spacing.

**The Problem: Proportional Scaling Doesn't Work**
-   Using `scale=X` in TikZ acts like a magnifying glass—it zooms EVERYTHING proportionally.
-   If text overlaps at `scale=1`, it still overlaps at `scale=2` (just bigger).
-   `Density = Content Size / Available Space`. Scaling increases both equally.

**The Solution: Decouple Space from Content**
We inject default options that expand the *coordinate system* while keeping *text compact*:

```latex
\begin{tikzpicture}[x=5cm, y=5cm, node distance=7cm, every node/.append style={font=\small}]
```

| Option | Effect | Default | Our Value |
|--------|--------|---------|-----------|
| `x=5cm` | Horizontal unit vector | 1cm | 5cm (5x expansion) |
| `y=5cm` | Vertical unit vector | 1cm | 5cm (5x expansion) |
| `node distance=7cm` | Spacing for relative positioning | 1cm | 7cm (7x expansion) |
| `font=\small` | Text size | Normal | Small (reduces content size) |

**Why These Values:**
-   Default TikZ unit: 1cm
-   Typical academic node with text: ~2-3cm wide
-   Safe spacing to prevent overlap: ~2-3x node width
-   Conservative: `5cm` provides ~2.5x safety margin

**The Iframe Resize Logic:**
The MutationObserver measures the resulting SVG using `scrollWidth`/`scrollHeight` (to capture full content extent) plus a small buffer:
```javascript
const w = Math.max(document.body.scrollWidth, svg.getBoundingClientRect().width);
const h = Math.max(document.body.scrollHeight, svg.getBoundingClientRect().height);
window.frameElement.style.height = (h + 5) + 'px';
window.frameElement.style.width = (w + 5) + 'px';
```

The iframe has **fixed width** (100% of parent) and **dynamic height** (adapts to content).

---

## Summary of Critical Rules

1.  **NEVER** let `latex.js` see `\begin{tikzpicture}`.
2.  **NEVER** pass Unicode characters to TikZJax.
3.  **NEVER** normalize/prettify code inside a TikZ block (keep raw `--`).
4.  **ALWAYS** wrap the injected code in `\begin{tikzpicture}`.
5.  **ALWAYS** use an iframe.
6.  **NEVER** use `scale=X` to fix density (it zooms everything proportionally).
7.  **ALWAYS** expand the coordinate system (`x=`, `y=`, `node distance=`) to create space.
8.  **ALWAYS** keep text compact (`font=\small`) to reduce content size.
