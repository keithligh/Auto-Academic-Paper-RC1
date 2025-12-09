# TikZ Handling Strategy: The "Sandbox & Silence" Protocol

This document details the specific engineering strategies used to render compiled TikZ diagrams in the browser within the Auto Academic Paper application.

Rendering TikZ in the browser is notoriously difficult because TikZ is a Turing-complete language that requires a full TeX engine. We use an **Iframe Isolation Strategy** (part of the **Nuclear Option Architecture** detailed in `LATEX_PREVIEW_SYSTEM.md`) to achieve this without crashing the main application.

---

## 1. The Core Problem
Client-side text parsers (like our Custom Parser or the now-defunct `latex.js`) **cannot** render TikZ. They lack the logic engine required to calculate coordinates, paths, and nodes.

The only viable browser-based solution is **TikZJax**, a WebAssembly port of the TeX engine. However, TikZJax is heavy, fragile, and prone to crashing the main thread if mishandled.

## 2. The Solution: "Extraction, Isolation, Sanitation"

We treat TikZ code not as text, but as a **Hazardous Material** that must be handled in a controlled environment.

### Phase 0: The Filter (Detection & Rejection)
Not all TikZ code is safe for the browser. Specifically, `pgfplots` (plots based on datasets) are too computationally expensive and font-dependent for TikZJax.

-   **Trigger**: We check the captured TikZ code for `\begin{axis}` or `\addplot`.
-   **Action**: If found, we **ABORT** the rendering process for that specific block.
-   **Output**: We inject a warning placeholder: `⚠️ Complex diagram (pgfplots) - not supported in browser preview`.

### Phase 1: The Heist (Extraction)
Before the main document is processed by our Custom Parser (`latex-to-html.ts`), we steal the TikZ code.

-   **Manual Parser**: We do NOT use robust regex alone. We use a character-level parser to handle nested brackets `[...]` inside optional arguments (e.g., `label={[0,1]}`).
-   **Proprietary extraction**: See `latex-to-html.ts` (specifically `extractTikzBlocks`) for the loop safety logic.
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

### Phase 5.5: The Loading Placeholder (v1.6.11)
TikZJax compilation (CDN load + WASM execution) can take 500-2000ms. To provide visual feedback:

- **Display**: ASCII placeholder `[ Generating diagram... ]` centered in the iframe
- **Animation**: Subtle CSS `pulse` animation for perceived responsiveness
- **Implementation**: Fully contained inside the iframe (no parent-child communication)
- **Architecture Rationale**: Keeping UI inside the iframe preserves the strict isolation philosophy. Using React state would require cross-frame `postMessage` patterns, adding complexity without benefit.

### Phase 6: The Auto-Resize (MutationObserver)
A `MutationObserver` inside the iframe watches for `<svg>` creation and:
1. **Hides the loading placeholder** (adds `.hidden` class) (v1.6.11)
2. **Resizes the iframe height** to match the rendered diagram

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
| **FLAT** | Balance Ratio | Multiplier: `y × (ratio/2)`, `x × 1.5` | Strip old x/y |
| **COMPACT** | Fit to A4 | `scale=0.75` (>=8 nodes) / `0.85` | `node distance=1.5cm`, `transform shape` |
| **LARGE** | Readability | `scale=0.85` (>=6 nodes) / `1.0` | `align=center`*, `node distance=8.4cm` (Text) / `5.0cm` (Node) |
| **MEDIUM** | Balance | **Smart Scale**: `1.0` (Fits A4) or `0.8/0.9` | `node distance=2.5cm` |

*Note: `transform shape` is strictly exempt from LARGE to keep text readable.*
*Note*: `align=center` is injected if `text width` is missing, ensuring multi-line labels render correctly.
*Note*: WIDE, COMPACT, and MEDIUM all use `transform shape`. Only LARGE exempts text scaling.

#### D. Priority Order (v1.5.7)
```
WIDE > FLAT > node distance > text density > node count > MEDIUM (default)
```

- **WIDE** takes highest priority (hard overflow constraint)
- **FLAT** takes second priority (aspect ratio distortion is visually severe)

#### E. The Safety Nets (Hidden Logic)
1.  **The Text-Heavy Safety Net (v1.6.5)**: In LARGE mode, if an explicit distance is less than the target distance (8.4cm for text-heavy diagrams, 5.0cm for normal), it is **stripped and replaced** with the target distance to prevent cramping. This ensures text-heavy cycle diagrams get adequate spacing (8.4cm) rather than the generic fallback (5.0cm).
2.  **The Goldilocks Protocol (Universal v1.5.8)**: For diagrams that are **Text Heavy**, we apply a **Global Coordinate Boost** (`x=2.2cm`) ONLY if:
    -   Average text/node > 30 chars
    -   **AND** `horizontalSpan < 7` (Index-based/Small)
    -   **Reason**: Prevents "Explosion" of physical layouts (e.g., width 10) while saving dense index layouts (width 1-2).
3.  **Maximize Space Override (v1.6.4 upgrade)**: For **LARGE** diagrams (Text Heavy), we prioritize physical space over user intent. If the AI provides restrictive coordinates (e.g., `x=0.8cm`), we **STRIP** them and inject calculated values (`optimalUnit = 14cm / horizontalSpan`) to force the diagram to expand to the full width of the view. We also enforce `font=\small` to reduce content density. This solves the "Density Equation" by expanding Space while shrinking Content.
4.  **FLAT Coordinate Override**: For FLAT intent, existing `x=` and `y=` values are **stripped and replaced** with calculated multiplied values (cannot skip, must fix ratio).
5.  **Title Gap Compression (v1.6.12)**: For **LARGE** intent with relative positioning (`horizontalSpan=0`), inject `y=0.5cm` to compress title offsets like `+(0,2)` from 2cm to 1cm. Key insight: `node distance` (in cm) is **NOT affected** by coordinate scaling - they are independent systems.
6.  **Goldilocks LARGE Exclusion (v1.6.12)**: **LARGE** intent is now **excluded** from the Goldilocks Protocol's x/y injection (`x=2.2cm, y=1.5cm`). LARGE uses `node distance` for spacing rather than coordinate scaling, so injecting x/y causes title offset explosions.

#### 8. The Absolute Protection Protocol (v1.6.17-20)
#### 8. The Absolute Protection Protocol (v1.6.17-31)
> **Problem**: Diagrams with explicit absolute coordinates (`\node at (0,4)`) suffered from "Squashed" vs "Exploded" dichotomy.
> **The Fix**: We introduced a specific `horizontalSpan > 0` check (Unified Intent v1.6.29) and Adaptive Y-Scaling (v1.6.31).
> 1.  **Width Budget**: We assume the diagram can fill up to **25cm** (v1.6.25).
> 2.  **Adaptive Y-Axis Scaling (v1.6.31 - "The Goldilocks Vertical")**:
    -   **Concept**: Height is cheap, but not *infinitely* cheap. We must balance squashed diagrams vs exploded ones.
    -   **Formula**: `yUnit = TargetHeight (12cm) / VerticalSpan`.
    -   **Clamping**:
        -   **Max 2.2cm**: For short diagrams (e.g., Span < 5), giving them massive vertical boost to fix "Squashed" look.
        -   **Min 1.3cm**: For tall diagrams (e.g., Span > 10), constraining them to prevent "Explosion".
    -   **Result**: A responsive vertical grid that feels proportional regardless of the input coordinate scale.
> 3.  **Unified Intent (v1.6.29)**:
    -   We abolished the `WIDE` intent for absolute layouts. If `Span > 0`, it enters the `LARGE` physics engine, ensuring the Adaptive Y logic applies universally.
> 4.  **Failed Experiment: Node Inflation**: We attempted to dynamically inflate `inner sep` based on Y-boost. This failed due to rendering engine limitations and was abandoned to preserve integrity.

#### 9. The Logic Trap (v1.6.23)
> **Problem Case**: Diagrams with explicit coordinates (Span > 0) but many nodes (>8) were falling through to `COMPACT` intent, triggering blind `scale=0.75` shrinking. This neutralized the density fixes.
> **The Fix**: We updated the intent classification priority. **Explicit Coordinates (`horizontalSpan > 0`) now strictly imply `LARGE` (Optimized Density) intent**, overriding generic node counts.
> **Rule**: Explicit Layout Signals > Implicit Complexity Heuristics.

#### 10. The Bifurcated Safety Net (v1.6.37)
> **Problem**: A conflict existed between "Pipelines" (Small labels, tight packing) and "Cycles" (Large paragraphs, loose packing). Both often come with `node distance=0.8cm` or `3cm` from the AI.
> - **v1.6.5**: Forced 8.4cm everywhere. Result: Pipelines exploded.
> - **v1.6.35**: Respected user setting. Result: Cycles squashed.
> - **v1.6.36**: Used 2.5cm threshold. Result: Pipelines Safe, but `3cm` Cycles still squashed.
>
> **The Solution (v1.6.37)**: We use the **Intent Engine** (`isTextHeavy`) to bifurcate the physics.
> 1.  **Metric**: `isTextHeavy` = Average Label Length > 30 characters.
> 2.  **Logic**:
>     -   **IF** `isTextHeavy` (Cycle): **Aggressive Protection**. Override ANY distance < **8.4cm**. (Forces proper spacing for paragraphs).
>     -   **ELSE** (Pipeline): **Permissive Respect**. Override ONLY distance < **0.5cm**. (Preserves compact layout).
> 3.  **Result**: Universal stability. Text-heavy diagrams get the space they need; Light diagrams keep the layout they have.

---

#### 11. Title Gap Restoration (v1.6.38)
> **Problem**: The "Adaptive Y-Scaling" (v1.6.31) set `y=1.5cm` (default) for relative layouts. This physically scaled absolute title offsets (like `+(0,2)`) to `3cm`, creating a huge disconnected gap.
> **The Fix**: We restored the "Title Gap Compression" logic from v1.6.12.
> - **Rule**: If `verticalSpan === 0` (Relative Layout, no absolute coordinates), we Force `y=0.5cm`.
> - **Effect**: A title at `(0,2)` renders at `1cm` physical height.
> - **Synergy**: This works perfectly with v1.6.37 because `node distance` (8.4cm) handles the *layout* spacing independently of `y` unit. The diagram stays large; the title stays close.

#### 12. X/Y Injection Restoration (v1.6.39)
> **Problem**: The v1.6.38 edit accidentally removed the line that injects `x=...cm, y=...cm` into the TikZ options.
> **Symptom**: LARGE intent diagrams rendered at native TikZ scale (1cm per unit), then Zoom-to-Fit shrunk them to appear "tiny".
> **The Fix**: Restored the critical `extraOpts += \`, x=\${xUnit}cm, y=\${yUnit}cm\`` line.
> **Lesson**: Exercise extreme care when editing complex functions. Verify before committing.

#### 13. Compact Layout Tuning (v1.6.40)
> **Problem**: Diagrams with moderate vertical span (5-6 units) were being stretched excessively due to the 12cm height target.
> **The Fix**: Reduced vertical scaling parameters:
> - **Target Height**: 12cm → 8cm.
> - **Y-Clamp Range**: [1.3, 2.2] → [1.0, 1.8].
> **Reasoning**: A diagram with 5.6 vertical span was getting `y = 12/5.6 = 2.14cm`. Now it gets `y = 8/5.6 = 1.43cm`.
> **Result**: ~30% reduction in vertical empty space while maintaining readability.

#### 14. FLAT Intent Font Reduction (v1.6.41)
> **Problem**: FLAT diagrams (timeline-style, aspect ratio > 3:1) with many nodes had overlapping text labels even after x/y multiplier expansion.
> **Root Cause**: Nodes with `minimum width=2.5cm` don't resize when coordinates scale. The text "AI research, personas, journeys" (~6cm) overflows the 2.5cm box.
> **Key Insight**: x/y multipliers expand spacing between node *centers*, but they don't shrink text that overflows fixed-width boxes.
> **The Fix**: For FLAT intent diagrams with ≥5 nodes, inject `font=\small`.
> ```typescript
> if (nodeMatches.length >= 5 && !options.includes('font=')) {
>   extraOpts += ', font=\\small';
> }
> ```
> **Why 5 nodes?**: Fewer nodes rarely cause overlap. The threshold prevents unnecessary font reduction for simple diagrams.
> **Alternative Considered**: Adding `text width` to force wrapping. Rejected because it changes the visual appearance more drastically.

---

## Summary of Critical Rules

1.  **NEVER** let the text parser see `\begin{tikzpicture}`.
3.  **ALWAYS** use the manual bracket parser for extraction (Regex is insufficient).
4.  **ALWAYS** use `transform shape` for **COMPACT** and **WIDE** diagrams (scales text).
5.  **NEVER** use `transform shape` for **LARGE** diagrams (keeps text readable).
6.  **ALWAYS** extract **ALL** `(x,y)` coordinate pairs (not just `at (x,y)`) for span/aspect calculations.
7.  **ALWAYS** strip and replace existing `x=`/`y=` values for **FLAT** intent (cannot skip, must fix ratio).

### 15. The Browser Engine Protection Suite (v1.9.12)

While the TikZ engine handles the rendering inside the iframe, the **Integration** into the main document relies on the "Hybrid Encapsulation" strategy.

- **The "Missing Link" Fix**: We discovered that TikZ placeholders (`LATEXPREVIEWTIKZBLOCK17`) were sometimes lost when nested inside complex lists or table cells because the `TreeWalker` (DOM post-processing) failed to find them.
- **The Solution (String Injection)**: We now replace the TikZ placeholder with the iframe HTML **at the string level** before the DOM is built.
- **Why it matters**: This guarantees that your diagram appears even if you nest it 5 levels deep in an `itemize` list inside a `tabular` cell. It moves the integration point from "Fragile DOM" to "Robust String".

### 15. The Browser Engine Protection Suite (v1.9.12)

While the TikZ engine handles the rendering inside the iframe, the **Integration** into the main document relies on the "Hybrid Encapsulation" strategy.

- **The "Missing Link" Fix**: We discovered that TikZ placeholders (`LATEXPREVIEWTIKZBLOCK17`) were sometimes lost when nested inside complex lists or table cells because the `TreeWalker` (DOM post-processing) failed to find them.
- **The Solution (String Injection)**: We now replace the TikZ placeholder with the iframe HTML **at the string level** before the DOM is built.
- **Why it matters**: This guarantees that your diagram appears even if you nest it 5 levels deep in an `itemize` list inside a `tabular` cell. It moves the integration point from "Fragile DOM" to "Robust String".

#### 15. The Browser Engine Protection Suite (v1.9.5)
The TikZ engine was prone to "Blank" renders due to browser limitations. We implemented a protection suite:

1.  **Comment Stripping (Critical)**: `safeTikz.replace(/%.*$/gm, '')`
    *   **Why**: We flatten code to single lines for processing. If a comment `%` exists, it consumes the entire rest of the flattened line. This caused valid code to be commented out.
2.  **Library Injection**: We inject `\usetikzlibrary{arrows,shapes,calc,positioning,decorations.pathreplacing}`.
    *   **Why**: The browser doesn't autoload libraries. Missing `arrows` causes a silent crash.
3.  **Unsupported Feature Strip**:
    *   **Fonts**: `\sffamily`, `\ttfamily`. (Reason: Missing WASM font metrics).
    *   **Environments**: `itemize` or `enumitem`. (Reason: Incompatible with WASM nodes).
        *   **Fix**: Auto-convert `\item` to `$\bullet$`.
4.  **Collapse Prevention**: `min-height: 200px` on the iframe.
    *   **Why**: If `MutationObserver` fails to detect height (0px), the diagram vanishes. This forces visibility.

#### 16. Intent Engine Implementation (v1.9.16)

> **Problem**: The intent engine was documented but not actually implemented in the code. All diagrams received hardcoded `scale=0.85,transform shape`, causing timeline diagrams to appear squashed with excessive whitespace.

**The Solution**: Implemented a runtime intent classification system that analyzes TikZ code and applies appropriate scaling strategies.

**Implementation Details:**

1. **Coordinate Extraction**: Extracts all `(x,y)` coordinate pairs using regex `\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)`
2. **Span Calculation**:
   - `horizontalSpan = maxX - minX`
   - `verticalSpan = maxY - minY`
   - `aspectRatio = horizontalSpan / verticalSpan`
3. **Node Analysis**:
   - Count total nodes via `\node` pattern matching
   - Calculate average text length per node
   - Detect explicit `node distance=Xcm` values

**Intent Classification (Priority Order):**

| Intent | Trigger Condition | Scaling Strategy | Purpose |
|--------|------------------|------------------|---------|
| **FLAT** | `aspectRatio > 3.0` AND `verticalSpan > 0` | `x=1.5cm, y={calculated}cm, scale=1.0` | Timeline diagrams - expands vertical space |
| **COMPACT** | `nodeCount >= 8` AND `horizontalSpan > 0` | `scale=0.75, transform shape, node distance=1.5cm` | Dense diagrams - shrinks to prevent overflow |
| **LARGE** | `avgTextLength > 30` AND `horizontalSpan > 0` | `scale=0.9, node distance=8.4cm` (no transform shape) | Text-heavy - expands spacing, keeps text readable |
| **DEFAULT** | All other cases | `scale=0.85, transform shape` | Standard diagrams - balanced scaling |

**FLAT Intent Details (Timeline Fix):**
```typescript
const targetRatio = 2.0;
const yMultiplier = Math.min(3.0, Math.max(1.5, aspectRatio / targetRatio));
const xMultiplier = 1.5;

// Strip existing x/y values from options
safeTikz = safeTikz.replace(/\[([^\]]*)\]/, (match, opts) => {
    let cleanOpts = opts
        .replace(/x\s*=\s*[\d.]+\s*(cm)?/g, '')
        .replace(/y\s*=\s*[\d.]+\s*(cm)?/g, '');
    return `[${cleanOpts}]`;
});

// Inject new coordinate scaling
extraOpts = `x=${xMultiplier}cm, y=${yMultiplier}cm`;

// Add font reduction for dense timelines
if (nodeCount >= 5) {
    extraOpts += ', font=\\small';
}
```

**Example: Timeline Diagram (aspectRatio = 4.0)**
- **Input**: `\begin{tikzpicture}[x=1cm,y=1cm]` with span 10×2.5cm
- **Old Behavior**: `scale=0.85,transform shape` → squashed, small, excessive whitespace
- **New Behavior**: `scale=1.0,x=1.5cm,y=2.0cm,font=\small` → expanded, balanced, no whitespace
- **Result**: Fixes both "small boxes" and "massive whitespace" issues

**Debug Logging:**
All diagrams now log their classification:
```
[TikZ Intent] Coords: 12 Span: 10.0 x 2.5 Aspect: 4.00 Nodes: 5 AvgText: 8
[TikZ Intent] FLAT: x=1.5cm, y=2.00cm
```
