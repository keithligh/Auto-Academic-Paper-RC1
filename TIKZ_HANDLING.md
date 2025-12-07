# TikZ Handling Strategy: The "Sandbox & Silence" Protocol

This document details the specific engineering strategies used to render compiled TikZ diagrams in the browser within the Auto Academic Paper application.

Rendering TikZ in the browser is notoriously difficult because TikZ is a Turing-complete language that requires a full TeX engine. We use a **Hybrid Isolation Strategy** (part of the **Strict Containment Protocol** detailed in `LATEX_PREVIEW_SYSTEM.md`) to achieve this without crashing the main application.

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
-   **Output**: We inject a warning placeholder: `⚠️ Complex diagram (pgfplots) - not supported in browser preview`.

### Phase 1: The Heist (Extraction)
Before the main document is parsed by `latex.js`, we steal the TikZ code.

-   **Manual Parser**: We do NOT use robust regex alone. We use a character-level parser to handle nested brackets `[...]` inside optional arguments (e.g., `label={[0,1]}`).
-   **Proprietary extraction**: See `LatexPreview.tsx` for the loop safety logic.
-   **Placeholder**: We replace the entire block with a safe ID: `LATEXPREVIEWTIKZBLOCK1`.

### Phase 2: The Detox (Sanitization)
Raw LaTeX cannot be fed directly to TikZJax strings because of JavaScript encoding issues.

1.  **ASCII Enforcement (The `btoa` Fix)**
    -   **Problem**: TikZJax uses `btoa()` internally. Unicode crashes it.
    -   **Solution**: We run `.replace(/[^\x00-\x7F]/g, '')` to strip non-ASCII chars.

2.  **Typography Denormalization**: We preserve double-hyphens `--` for paths.

### Phase 3: The Sandbox (Iframe Isolation)
We inject TikZ code into a dedicated `<iframe>`.
-   **CSS Isolation**: Prevents Tailwind conflicts.
-   **Error Containment**: Crashes stay in the iframe.

### Phase 4: The Context Injection (The Wrapping Fix)
We explicitly re-wrap extracted content in `\begin{tikzpicture}` inside the iframe.

### Phase 5: The Silencer (Error Suppression)
We suppress `message channel closed` errors caused by TikZJax/Iframe interaction issues.

### Phase 6: The Auto-Resize (MutationObserver)
A `MutationObserver` inside the iframe watches for `<svg>` creation and resizes the iframe height to match the diagram.

### Phase 7: The "Hybrid Intent" Scaling (v1.5.5)

We generate diagrams using AI, which means we don't always know the size. "One size fits all" failed. We now use a **Hybrid Intent** system that combines explicit AI signals with implicit content analysis.

#### A. The Heuristics
1.  **Explicit Intent**: Does the code include `node distance=Xcm`?
    *   `< 2.0cm` -> **COMPACT** (Pipeline)
    *   `>= 2.5cm` -> **LARGE** (Cycle/Flowchart)
2.  **Implicit Fallback (Density)**: If no distance is set:
    *   **Text Heavy** (>30 chars/node) -> **LARGE**
    *   **Node Heavy** (>=8 nodes) -> **COMPACT**
3.  **NEW (v1.5.6) - Absolute Positioning Override**: If using `at (x,y)` syntax:
    *   **Horizontal Span > 14cm** -> **WIDE** (takes priority over all other intents)

#### B. The WIDE Intent (v1.5.6)

> **Problem Case**: Diagrams that use **absolute positioning** (`\node at (0,0)`, `\node at (4,0)`, etc.) instead of `node distance` are not detected by the node-distance heuristics. If these diagrams span too wide (e.g., 5 nodes at 4cm intervals = 16cm total), they overflow the A4 content width (~14cm) and get responsively shrunk by CSS, causing node overlap.

**Detection Logic:**
```
1. Extract all "at (x,y)" coordinates from the TikZ code
2. Calculate horizontal span: maxX - minX
3. If span > 14cm → WIDE intent
```

**The Math:**
-   A4 paper width: 210mm
-   Standard margins: 25mm each side
-   **Safe content width**: 160mm ≈ 16cm, but we use **14cm** as target for safety buffer

**Scaling Formula:**
```
scaleFactor = min(1.0, 14 / horizontalSpan) × 0.9
finalScale = max(0.5, scaleFactor)  // Floor at 50%
```

**Why `transform shape` is REQUIRED for WIDE:**
Unlike LARGE (text readability), WIDE diagrams need **proportional shrinking**. If we scale coordinates without scaling nodes, nodes will overlap. `transform shape` ensures text shrinks with the geometry.

#### C. The Execution Rules

| Type | Goal | Scaling Logic | Extra Style Injection |
| :--- | :--- | :--- | :--- |
| **WIDE** | Fit to A4 | Dynamic: `14/span × 0.9` (floor 0.5) | **`transform shape`** (REQUIRED) |
| **COMPACT** | Fit to A4 | `scale=0.75` (>=8 nodes) / `0.85` | `node distance=1.5cm`, `transform shape` |
| **LARGE** | Readability | `scale=0.85` (>=6 nodes) / `1.0` | `align=center`*, `node distance=8.4cm` (Text) / `5.0cm` (Node) |
| **MEDIUM** | Balance | `scale=0.8` (>=6 nodes) / `0.9` | `node distance=2.5cm` |

*Note: `transform shape` is strictly exempt from LARGE to keep text readable.*
*Note*: `align=center` is injected if `text width` is missing, ensuring multi-line labels render correctly.
*Note*: WIDE, COMPACT, and MEDIUM all use `transform shape`. Only LARGE exempts it.

#### D. Priority Order (v1.5.6)
```
WIDE > node distance > text density > node count > MEDIUM (default)
```

WIDE takes highest priority because absolute-positioning overflow is a **hard constraint** — the diagram simply won't fit without scaling.

#### E. The Safety Nets (Hidden Logic)
1.  **The 5cm Safety Net**: In LARGE mode, if an explicit distance is `< 4.0cm`, it is forcibly boosted to `5.0cm` to prevent cramping.
2.  **The Goldilocks Protocol**: For diagrams that are **Text Heavy** (lots of explanations), we apply a **Global Coordinate Boost** to prevent overlapping:
    -   **Injection**: `x=2.2cm, y=1.5cm`
    -   **Reason**: Moves nodes further apart horizontally without affecting the text size.
3.  **Explicit Coordinate Exemption**: If the diagram already specifies `x=` or `y=` in options, we skip automatic scaling for MEDIUM to respect author intent.

---

## Summary of Critical Rules

1.  **NEVER** let `latex.js` see `\begin{tikzpicture}`.
2.  **NEVER** pass Unicode characters to TikZJax.
3.  **ALWAYS** use the manual bracket parser for extraction (Regex is insufficient).
4.  **ALWAYS** use `transform shape` for **COMPACT** and **WIDE** diagrams (scales text).
5.  **NEVER** use `transform shape` for **LARGE** diagrams (keeps text readable).
6.  **ALWAYS** check for **absolute positioning** (`at (x,y)`) overflow before applying other intents.
