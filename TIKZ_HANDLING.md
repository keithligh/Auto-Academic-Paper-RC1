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
1. Extract ALL (x,y) coordinate pairs from TikZ code (not just "at" patterns)
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

#### BA. The BRACE Intent (v1.7.0)

> **Problem Case**: Diagrams with **decorative braces below the main content** (e.g., timeline labels, phase annotations) use small coordinate scales like `[x=0.8cm, y=0.8cm]`. When brace labels are positioned at negative y-coordinates (below the x-axis), they overlap with x-axis labels and each other due to vertical cramping.

**Example:** The "Infatuation Diagram" has:
- Coordinate system: `[x=0.8cm, y=0.8cm]`
- Main content: y from 0 to 7
- Brace labels: y = -0.7 to -2.0 (below x-axis)
- Physical depth: `2.0 × 0.8 = 1.6cm` (too cramped for text labels)

**Detection Logic:**
```
1. Has brace decorations: decoration={brace
2. Has negative y-coordinates: minY < 0
3. Has small y-scale: yScale < 1.0
→ BRACE intent
```

**Solution Formula:**
```javascript
// Calculate required y-scale to achieve 2.5cm comfortable depth
negativeExtent = |minY| × yScale  // Current physical depth below x-axis
targetDepth = 2.5  // cm - comfortable spacing for brace labels
requiredYScale = targetDepth / |minY|

// Boost y-axis (prioritize vertical space)
newYScale = max(1.5, min(2.5, requiredYScale))

// Modest x-axis boost for horizontal breathing room
newXScale = max(1.0, existingXScale × 1.25)
```

**Key Design Decisions:**
- **No `transform shape`**: We want text at normal readable size. The boosted coordinate grid provides space naturally.
- **Strip old x/y**: Must replace existing small scales (like 0.8cm) with calculated larger scales.
- **Priority**: Takes precedence over FLAT because vertical overlap is a hard failure, while aspect ratio is aesthetic.

**Result:** For the Infatuation Diagram with minY=-2.0, y=0.8cm:
- Current depth: `2.0 × 0.8 = 1.6cm`
- Required: `targetDepth / 2.0 = 2.5 / 2.0 = 1.25cm` per unit
- Applied: `max(1.5, min(2.5, 1.25)) = 1.5cm` per unit
- New depth: `2.0 × 1.5 = 3.0cm` ✓ Comfortable spacing!

#### BB. The FLAT Intent (v1.5.7)

> **Problem Case**: Timeline-style diagrams have extreme **aspect ratios** (e.g., 10cm wide × 2.5cm tall = 4:1). These diagrams look "squashed" and unprofessional. Labels on the timeline become cramped because horizontal space is limited relative to text size.

**The Root Cause Discovery:**
Initial detection only looked for `at (x,y)` patterns. Timeline diagrams often have:
- Nodes at y=0: `\node at (1,0)`, `\node at (3,0)` → verticalSpan = 0
- Draw commands with vertical extent: `\draw (0,0.5) -- (9.5,2.5)` → NOT captured by `at` regex

**The Fix:** Extract **ALL** `(x,y)` coordinate pairs, not just `at (x,y)`:
```javascript
const allCoordMatches = safeTikz.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g);
```

**Detection Logic:**
```
1. Extract ALL (x,y) from TikZ body (nodes, draws, fills, paths)
2. Calculate: horizontalSpan = maxX - minX, verticalSpan = maxY - minY
3. Calculate: aspectRatio = horizontalSpan / verticalSpan
4. If aspectRatio > 3.0 → FLAT intent
```

**Correction Formula (Multiplier-Based):**
Unlike WIDE (which shrinks), FLAT **expands** the coordinate system:
```
targetRatio = 2.0  // Balanced appearance
yMultiplier = min(3.0, max(1.5, aspectRatio / targetRatio))
xMultiplier = 1.5  // 50% horizontal expansion for labels

newY = existingY × yMultiplier  // e.g., 1cm × 2.5 = 2.5cm
newX = existingX × xMultiplier  // e.g., 1cm × 1.5 = 1.5cm
```

**Why Stripping Old Values is Required:**
The diagram may have explicit `[x=1cm, y=1cm]`. Simply appending new values doesn't work (TikZ uses first value). We must:
```javascript
// Strip old x/y from options before merging
options = options.replace(/x\s*=\s*[\d.]+\s*(cm)?/g, '');
options = options.replace(/y\s*=\s*[\d.]+\s*(cm)?/g, '');
```


**Additional Injection:** None. (Space expansion handles labels sufficiently).

#### C. The Execution Rules

| Type | Goal | Scaling Logic | Extra Style Injection |
| :--- | :--- | :--- | :--- |
| **WIDE** | Fit to A4 | Dynamic: `14/span × 0.9` (floor 0.5) | **`transform shape`** (REQUIRED) |
| **BRACE** | Vertical Space for Labels | Y-boost: `max(1.5, targetDepth / |minY|)`, X-boost: `xScale × 1.25` | Strip old x/y, **NO** `transform shape` |
| **FLAT** | Balance Ratio | Multiplier: `y × (ratio/2)`, `x × 1.5` | Strip old x/y |
| **COMPACT** | Fit to A4 | `scale=0.75` (>=8 nodes) / `0.85` | `node distance=1.5cm`, `transform shape` |
| **LARGE** | Readability | `scale=0.85` (>=6 nodes) / `1.0` | `align=center`*, `node distance=8.4cm` (Text) / `5.0cm` (Node) |
| **MEDIUM** | Balance | **Smart Scale**: `1.0` (Fits A4) or `0.8/0.9` | `node distance=2.5cm` |

*Note: `transform shape` is strictly exempt from LARGE and BRACE to keep text readable.*
*Note*: `align=center` is injected if `text width` is missing, ensuring multi-line labels render correctly.
*Note*: WIDE, COMPACT, and MEDIUM all use `transform shape`. LARGE and BRACE exempt text scaling.

#### D. Priority Order (v1.7.0)
```
WIDE > BRACE > FLAT > node distance > text density > node count > MEDIUM (default)
```

- **WIDE** takes highest priority (hard overflow constraint - diagram won't fit on page)
- **BRACE** takes second priority (vertical overlap causes label illegibility - hard failure)
- **FLAT** takes third priority (aspect ratio distortion is visually severe but readable)

#### E. The Safety Nets (Hidden Logic)
1.  **The 5cm Safety Net**: In LARGE mode, if an explicit distance is `< 4.0cm`, it is forcibly boosted to `5.0cm` to prevent cramping.
2.  **The Goldilocks Protocol (Universal v1.5.8)**: For diagrams that are **Text Heavy**, we apply a **Global Coordinate Boost** (`x=2.2cm`) ONLY if:
    -   Average text/node > 30 chars
    -   **AND** `horizontalSpan < 7` (Index-based/Small)
    -   **Reason**: Prevents "Explosion" of physical layouts (e.g., width 10) while saving dense index layouts (width 1-2).
3.  **Maximize Space Override (v1.6.4 upgrade)**: For **LARGE** diagrams (Text Heavy), we prioritize physical space over user intent. If the AI provides restrictive coordinates (e.g., `x=0.8cm`), we **STRIP** them and inject calculated values (`optimalUnit = 14cm / horizontalSpan`) to force the diagram to expand to the full width of the view. We also enforce `font=\small` to reduce content density. This solves the "Density Equation" by expanding Space while shrinking Content.
4.  **FLAT Coordinate Override**: For FLAT intent, existing `x=` and `y=` values are **stripped and replaced** with calculated multiplied values (cannot skip, must fix ratio).

---

## Summary of Critical Rules

1.  **NEVER** let `latex.js` see `\begin{tikzpicture}`.
2.  **NEVER** pass Unicode characters to TikZJax.
3.  **ALWAYS** use the manual bracket parser for extraction (Regex is insufficient).
4.  **ALWAYS** use `transform shape` for **COMPACT** and **WIDE** diagrams (scales text).
5.  **NEVER** use `transform shape` for **LARGE** diagrams (keeps text readable).
6.  **ALWAYS** extract **ALL** `(x,y)` coordinate pairs (not just `at (x,y)`) for span/aspect calculations.
7.  **ALWAYS** strip and replace existing `x=`/`y=` values for **FLAT** intent (cannot skip, must fix ratio).
