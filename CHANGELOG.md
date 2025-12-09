<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.15] - 2025-12-09 (The "Algorithm & Layout" Update)
### Added
- **Algorithmic Environment Support**:
    - **Feature**: Full parsing for `\begin{algorithmic}` blocks (States, loops, conditionals).
    - **Styling**: `Courier New`, gray line numbers, and bold keywords (`if`, `then`, `for`).
    - **Logic**: Implemented `processAlgorithms` with smart indentation handling.
- **Center Environment Support**:
    - **Feature**: Added universal support for `\begin{center}` ... `\end{center}`.
    - **Fix**: Resolves "orphaned tags" around tables and figures.

### Fixed
- **Exposed HTML Tags in Algorithms**:
    - **Root Cause**: `parseLatexFormatting` was "double-escaping" injected HTML.
    - **Fix**: Inverted pipeline to format content *before* injecting structural HTML keywords.
- **Subsubsection Styling**:
    - **Fix**: Changed `\subsubsection` (h4) from Italic/Normal to **Bold/Normal** to match standard LaTeX `article` class.

## [1.9.14] - 2025-12-09 (The "Ghost Class" Fix)
### Fixed
- **Persistent Math Scrollbars**:
    - **Symptom**: Vertical scrollbars appeared on equation numbers (e.g., `(2)`).
    - **Root Cause**: Targeted a non-existent CSS class (`.equation-container`) instead of the actual KaTeX output (`.katex-display`). The browser's default overflow handling for the inner element caused sub-pixel scrolling.
    - **Fix**: Targeted `.katex-display` directly with `overflow: hidden !important` and `scrollbar-width: none`.

## [1.9.13] - 2025-12-09 (The "Bulletproof" Robustness Update)
### Fixed (Universal Math & Layout)
- **Missing Link in List Rendering (The "String Injection" Strategy)**:
    - **Symptom**: `LATEXPREVIEWMATH47` placeholders appeared in lists instead of rendered math.
    - **Root Cause**: The post-render DOM `TreeWalker` failed to traverse deeply nested list items created by `innerHTML`.
    - **Fix**: Implemented **String-Level Replacement** (`html.replace`) *before* DOM injection. This guarantees placeholders are restored regardless of nesting depth.
- **Missing List Bullets (The "Specificity" Fix)**:
    - **Symptom**: `itemize` and `enumerate` lists had no bullets/numbers.
    - **Root Cause**: `latex-base.css` contained a nuclear reset `li { list-style: none }` which beat inherited styles from `ul`.
    - **Fix**: Updated `latex-article.css` to target `.latex-itemize li` directly with `!important`, overriding the base reset.
- **"The Theta Problem" (Math Normalization)**:
    - **Symptom**: AI output `$\theta$_t` (subscript outside formatting) causing rendering errors.
    - **Fix**: Added `Normalizer` regex to pre-process and repair orphaned subscripts/superscripts (`$_x` -> `_x`) before extraction.
- **Fragmented Equations (The "Healer")**:
    - **Symptom**: `$A$ = $B$` (operators outside math mode).
    - **Fix**: Added "Math Healer" to merge adjacent math blocks separated by standard operators.
- **Text Mode Arrows**:
    - **Symptom**: `\rightarrow` rendered as code in text mode.
    - **Fix**: Added explicit HTML entity replacements (`&rarr;`, `&rArr;`, etc.) to the text parser.

## [1.9.6] - 2025-12-09 (Layout Robustness: Headers, TikZ, Tables)
### Fixed
- **Section Headers ("Introduction")**: Corrected Semantic HTML/CSS mismatch.
    - Updated CSS to style `h2` as Section (previously expected `h3`).
    - Updated Regex to `[\s\S]*?` to support newlines in titles.
- **Blank TikZ Diagrams**:
    - **Comment Stripping**: Regex `safeTikz.replace(/%.*$/gm, '')` prevents comments from killing flattened code.
    - **Library Injection**: Added `arrows, shapes, calc` to script block.
    - **Crash Prevention**: Stripped `\sffamily` and sanitized `itemize`/`[leftmargin=*]` to `$\bullet$`.
    - **Visibility**: Added `min-height: 200px` to iframe.
- **Table Layout**:
    - **Width**: Forced to `100%` (was `auto`) to prevent text wrapping.
    - **Data Sanitation**: Added regex to escape specific AI typos (`Built-in & Comprehensive` -> `\&`).
- **Citation Rendering**:
    - **ID Logic**: Enforced "ID Match" mode. `ref_5` -> `[5]` instead of sequential `[1]`.

## [1.8.2] - 2025-12-09 (Intent Engine Restoration & CSS Corruption Fix)
### Fixed
- **CSS Class Name Corruption**: Template literals with spaces in class names broke all styling.
  - **Symptom**: Preview rendered as plain text with no formatting (no title styling, no sections).
  - **Root Cause**: Previous edits introduced spaces in class names: `latex - preview` instead of `latex-preview`.
  - **Affected Areas**: Dynamic style injection (lines 916-923) and JSX className attributes (lines 1194, 1206).
  - **Fix**: Corrected all instances to use proper hyphenated class names.
  - **Lesson**: Template literal edits can corrupt class names if spaces are introduced around hyphens.

## [1.6.43] - 2025-12-09 (SSOT Alignment & Indentation Fix)
### Fixed
- **Phantom Indentation**: All paragraphs were forcibly indented by 1.5em due to a global CSS variable.
  - **Correction**: Set `--parindent: 0` in `latex-base.css`.
  - **Impact**: Restores modern, clean paragraph alignment.
- **Parbox Crash**: Regex-based parsing failed on nested braces within `\parbox`.
  - **Correction**: Implemented **Manual Character Walker/Parser** (`processParboxes`).
  - **Impact**: Correctly handles complex, nested LaTeX commands inside parboxes.
- **Math Extraction Gaps**: `\( ... \)` inline math was not extracted, causing render glitches.
  - **Correction**: Added standard inline math extraction and enforced strict SSOT order (Structured -> Display -> Inline -> Legacy).

### Added
- **SSOT Enforcement**: `LatexPreview.tsx` is now 100% aligned with `LATEX_PREVIEW_SYSTEM.md`.

### Added
- **Full TikZ Intent Engine Restoration**: Restored the complete 450-line Intent Engine (`createTikzBlock`) with all v1.5.x-v1.6.40 fixes.
  - **Contents**:
    - pgfplots rejection
    - ASCII sanitization (btoa fix)
    - Bezier brace polyfill (v1.6.21)
    - Coordinate parsing (v1.5.6-v1.5.7)
    - Intent classification (WIDE/FLAT/COMPACT/LARGE/MEDIUM)
    - Adaptive Y-scaling (v1.6.31/v1.6.40)
    - Bifurcated safety net (v1.6.37)
    - Goldilocks protocol
  - **Reasoning**: Intent Engine was accidentally removed during previous architecture changes.
- **v1.6.41 FLAT Intent Font Reduction**: Added `font=\small` for FLAT diagrams with ≥5 nodes.
  - **Problem**: FLAT diagrams with `minimum width` nodes had text overflow because x/y multipliers don't shrink text.
  - **Solution**: Inject `font=\small` when `nodeMatches.length >= 5` to fit labels within fixed-width boxes.

## [1.8.1] - 2025-12-08 (The Nuclear Option)
### Architecture Change
- **Removed `latex.js` Dependency**: Completely removed the fragile `latex.js` library.
  - **Reasoning**: It was the single point of failure (crashes on unknown macros, no tabularx support, no TikZ support, difficult error handling). The "Containment" strategy was costing more effort than a replacement.
- **Implemented Custom Parser (`latex-to-html.ts`)**: Built a robust, fault-tolerant TypeScript parser.
  - **Philosophy**: "Show Something." Never crash. If a command is unknown, strip it or show a placeholder, but render the rest of the document.
- **Future Development Plan**: Archived the "Iterative Long-Form Generation" strategy (The Architect/Mason/Artist pipeline) to `docs/future_development_plan.md`.
  - **Reasoning**: Feature deferred, but the detailed architectural planning (including "Full Context Propagation" findings) is valuable and preserved.

### Changed
- **Unified Result View**: Renamed `SplitPreview` component to `UnifiedResultView` to reflect the removal of side-by-side mode.
  - **Impact**: Purely semantic refactor for codebase clarity.
- **UI Header Consolidation**: Merged redundant "Document Editor" headers in the Result Page.
  - **Metric**: Reduced vertical header usage by ~50px.
  - **Action**: Consolidated "Original | LaTeX" toggle and "Copy/Preview" controls into a single top-level toolbar.
  - **Removal**: Deleted the "Document Editor" label as per user feedback ("It is not an editor").

## [1.7.4] - 2025-12-08 (Persistence Investigation)
### Investigated
- **Database Persistence**: Confirmed that `advancedOptions` (like `reviewDepth` and the proposed `generationMode`) are ephemeral and **not persisted** in the `conversion_jobs` table.
- **Decision**: No database schema changes will be made for future flags. We accept the limitation that manual API retries lose these flags in exchange for **Zero DB Risk** (No Migrations).

## [1.7.3] - 2025-12-08 (Sophisticated Terminology)
### Changed
- **Processing Page Labels**: User rejected "abstract" labels ("Drafting", "Research").
  - **New Terminology**: Implemented "Sophisticated Active Verbs" to reflect technical depth:
    1. Formulating Execution Strategy
    2. Conducting Online Research
    3. Synthesizing Core Arguments
    4. Executing AI Peer Review
    5. Verify and Injecting Citations
    6. Compiling LaTeX Source
  - **Reasoning**: The UI must communicate the *complexity* of the work, not just the status. Simple nouns felt "uninspiring".

## [1.7.2] - 2025-12-08 (Progress Logic Alignment)
### Fixed
- **Stuck Progress Bar**: The progress indicator was stuck at "Phase 1" despite logs showing advanced activity.
  - **Root Cause**: **Frontend-Backend State Desynchronization**. The frontend regex was listening for the old 5-Phase signal (`[Phase X/5]`), but the backend `service.ts` had been upgraded to a 6-Phase pipeline (`[Phase X/6]`).
  - **Correction**: Updated `ProcessingPage.tsx` regex to match `Page X/6` and specific role keywords (`[Thinker]`, `[Librarian]`).
  - **Lesson**: When refactoring backend pipelines, *always* audit the frontend listeners.

## [1.7.1] - 2025-12-08 (Aggressive Typography & Layout Refinement)
### Changed
- **Wide-Format Dashboard**: Processing Page felt "cramped" and "tall".
  - **Correction**: Increased container width from `max-w-4xl` to **`max-w-6xl`**.
  - **Geometric Integrity**: Enforced `aspect-square` on step indicators to prevent "vertical rectangle" distortion.
- **Aggressive Typography Upgrade ("125% Scale")**: Replaced the "Global 115% Hack" with a native component-level redesign.
  - **Problem**: "Tiny UI" was unreadable. Global CSS zoom (`html { font-size: 115% }`) was rejected as a "dirty patch".
  - **Solution**: Manually shifted all typography codes up by 2 steps.
    - **Baseline**: `text-lg` (18px) is the new minimum for inputs/buttons.
    - **Hero**: `text-8xl` (96px) for commanding presence.
    - **Impact**: Achieves "Ctrl-+ twice" impact natively without browser zoom side-effects.
- **Upload Zone "Squashed" Dimensions**: Recalibrated the center interaction area.
  - **Metric**: `min-h-[360px]` → `min-h-[240px]` (height reduction).
  - **Metric**: `max-w-4xl` → `max-w-3xl` (width reduction).
  - **Reasoning**: The aggressive fonts made the container feel "too vast". Squashing it balances the visual weight of the large text.
- **Layout Unification**: Removed the separator between Upload Zone and Features.
  - **Metric**: Removed `border-t`, reduced padding `pt-10` → `pt-4`.
  - **Result**: A cohesive single-view experience without artificial dividers.

### Fixed
- **Responsive Header Logo**: Restored functionality to abbreviate "Auto Academic Paper" to "AAP" on mobile.
  - **Implementation**: `md:hidden` utility classes (no JS).
- **Hero Alignment**: Fixed "Leaning Left" visual bug by enforcing `flex-col items-center` on the Hero container.

## [1.7.0] - 2025-12-08 (Responsive AI Configuration)
### Added
- **Responsive AI Configuration Page**: Converted the AI Config modal to a dedicated `/config` page route.
  - **Problem**: Modal dialogs are not mobile-friendly.
  - **Solution**: Full-page design with accordion-style sections.
- **"Same as Writer" Toggle**: Added switch in Strategist section to copy Writer's settings.
### Removed
- **AIConfigModal Usage**: Replaced with `/config` navigation.

## [1.6.26] - 2025-12-08
### Fixed
- **TikZ Brace Polyfill (Vertical Artifacts)**: The manual brace polyfill (v1.6.21) assumed all braces were horizontal, applying Y-axis offsets. Vertical braces were rendered as straight lines or distorted loops (the "Vertical Line" artifact).
  - **Correction**: Implemented **Orientation Detection** (`dy > dx`).
    - **Vertical Braces**: Apply offsets to X-axis (creating curvature). Default direction points Left (-X).
    - **Horizontal Braces**: Apply offsets to Y-axis (creating curvature). Default direction points Up (+Y).
  - **Impact**: Vertical braces now curve correctly away from the content, eliminating the "straight line" visual bug and reducing perceived overlap.

## [1.6.40] - 2025-12-08 (Compact Layout Tuning)
### Fixed
- **TikZ Excessive Empty Space**: The Adaptive Y-Scaling (v1.6.31) targeted a 12cm physical height, which was too aggressive for naturally compact diagrams.
  - **Correction**: Reduced target height from **12cm → 8cm** and lowered Y-clamp range from **[1.3, 2.2] → [1.0, 1.8]**.
  - **Reasoning**: Diagrams with moderate vertical span (e.g., 5-6 units) were being stretched 2x when they only needed 1.3x.
  - **Impact**: ~30% reduction in vertical empty space for compact diagrams while maintaining readability.

## [1.6.39] - 2025-12-08 (X/Y Injection Restoration)
### Fixed
- **TikZ "Tiny Diagram" Regression**: The v1.6.38 edit accidentally removed the critical line that injects calculated `x=...cm, y=...cm` values into the TikZ options for LARGE intent diagrams.
  - **Symptom**: All LARGE intent diagrams (Pipelines, Cycles, Wide) rendered at native TikZ scale (1cm=1cm), then got shrunk by "Zoom-to-Fit" to appear "tiny".
  - **Correction**: Restored the `extraOpts += `, x=\${xUnit}cm, y=\${yUnit}cm\`` injection line.
  - **Impact**: Re-enables Adaptive Density Optimization for all absolute-layout diagrams.

## [1.6.38] - 2025-12-08 (Title Gap Restoration)
### Fixed
- **TikZ Title Gap Explosion**: Adaptive Y-Scaling (v1.6.31) universally applied `y=1.5cm` (or calculated value) to LARGE intent, including Relative Layouts. This caused absolute title offsets (e.g., `+(0,2)`) to scale physically to `3cm`, creating a massive gap between title and content.
  - **Correction**: Restored **Title Gap Compression** (v1.6.12 Logic).
  - **Logic**: If `verticalSpan === 0` (Relative Layout), we force `y=0.5cm`.
  - **Impact**: Titles anchored with absolute offsets (e.g., `+(0,2)`) now sit tightly (`1cm`) above the diagram, while the nodes themselves use the spacious `node distance=8.4cm` (from v1.6.37).

## [1.6.37] - 2025-12-08 (Bifurcated Safety Net)
### Fixed
- **TikZ Cycle Diagram Regression (Threshold Bias)**: The v1.6.36 fix used a 2.5cm threshold, but many Text-Heavy diagrams use `node distance=3cm`, which slipped through and rendered as squashed.
  - **Correction**: Implemented **Bifurcated Logic** in the Safety Net.
  - **Logic**:
    -   **Text-Heavy (Cycle)**: Aggressive Protection. Override ANY distance < 8.4cm. (Fixes Squashing).
    -   **Text-Light (Pipeline)**: Permissive Respect. Override ONLY distance < 0.5cm. (Preserves Compactness).
  - **Impact**: Solves the "Goldilocks" problem by acknowledging that text-heavy diagrams operate on a fundamentally different physical scale than text-light ones.

## [1.6.36] - 2025-12-08 (Text-Heavy Safety Net) [PARTIAL]
### Fixed
- **TikZ Cycle Diagram Regression ("Squashed again")**: The "Strict Respect" rule (v1.6.35) allowed text-heavy diagrams (Cycles) to use tiny node distances.
  - **Status**: Partially effective (Pipeline vs 0.8cm), but failed for "Medium" distance cycles (3cm). Superseded by v1.6.37.
  - **Correction**: Re-introduced the **Text-Heavy Safety Net** with conditional logic.
  - **Logic**:
    -   **IF** `isTextHeavy` (avg label > 30 chars) **AND** `node distance < 2.5cm`: **OVERRIDE** (Force 8.4cm).
    -   **ELSE**: **RESPECT** user intent (allows tight Pipelines).
  - **Impact**: Universally solves both "Explosion" (for Pipelines) and "Squash" (for Cycles) by detecting content density.

## [1.6.35] - 2025-12-08 (Strict Node Distance Protocol) [PARTIAL]
### Fixed
- **TikZ Relative Layout Explosion**: The system was overriding explicit `node distance=0.8cm` with `8.4cm` (10x expansion).
  - **Status**: Fixed explosion but caused regression for text-heavy diagrams. Superseded by v1.6.36.
  - **Correction**: Implemented **Strict Respect** for user-defined node distances.
  - **Logic**: If the user sets a distance >= 0.5cm, we **TRUST IT** and do not override. We only inject defaults for missing or near-zero distances.
  - **Impact**: Flowcharts with `node distance` retain their intended compactness while still benefiting from Adaptive Y-Scaling.

## [1.6.31] - 2025-12-08 (Adaptive Y-Axis Scaling)
### Fixed
- **TikZ "Fix One, Ruin Others" Regression**: The "Vertical Boost" (v1.6.28, y=2.2cm) fixed "Squashed" diagrams but exploded tall/sparse diagrams.
  - **Correction**: Implemented **Adaptive Y-Scaling**.
    - **Logic**: `y = 12cm / VerticalSpan`.
    - **Clamps**: Min 1.3cm (for tall diagrams), Max 2.2cm (for squashed diagrams).
    - **Impact**: Provides "Goldilocks" spacing. Short diagrams get maximum boost; tall diagrams get constrained spacing.

## [1.6.29] - 2025-12-08 (Unified Intent Architecture)
### Fixed
- **TikZ Classification Logic Trap**: Wide diagrams (>14cm) were triggering `WIDE` intent (Legacy Scaling) instead of `LARGE` intent (Density Optimized), bypassing fixes.
  - **Correction**: All Absolute Layouts (`Span > 0`) now strictly enter `LARGE/FLAT` intent.
  - **Impact**: Ensures modern density logic applies to all diagrams, preventing "Blind Shrinking".

## [1.6.28] - 2025-12-08 (Vertical Boost Strategy) [PARTIAL]
### Fixed
- **TikZ Vertical Compression ("Squashed" Look)**: Acknowledged failure of symmetrical density.
  - **Status**: Partially effective but caused regression (Explosion). Superseded by v1.6.31.

## [Abandoned] Node Inflation (v1.6.30-34)
- **Attempt**: To increase node size (`inner sep`) when boosting Y-axis.
- **Outcome**: **FAILED**. Render engine completely ignored explicit padding instructions despite multiple strategies (Injection, Decoupling, Scorched Earth).
- **Resolution**: Feature abandoned to preserve system integrity. Code reverted.
### Fixed
- **TikZ High-Definition Density (The Universal Overlap Fix)**: Previous fixes (1.3cm/1.5cm) were insufficient for wide text content in absolute layouts.
  - **Correction**: Implemented **Adaptive Density Logic**:
    - **Small Diagrams (Span <= 7)**: Force **Tight Grid (1.3cm)** to prevent "Huge Empty Gaps".
    - **Large Diagrams (Span > 7)**: Force **Loose Grid (1.8cm)** and **25cm Width Budget**.
  - **Impact**: Large diagrams now render with ~1.8cm unit spacing (70% expansion vs 1.0). The `katex-autoscale` engine then shrinks the visual view to fit the container. This effectively reduces font size relative to geometry by ~40%, clearing even the most stubborn text overlaps (like "Inputs (emails, docs)" vs braces).

## [1.6.24] - 2025-12-08 (Partial Fix)
### Fixed
- **TikZ Edge-Case Collision**: Symmetrical clamping (`x=1.3cm`) was slightly too tight for nodes with very long text (e.g., "(emails, docs, data)") placed adjacent to other elements.
  - **Correction**: Relaxed the **X-Axis Clamp** from 1.3cm to **1.5cm**.
  - **Impact**: Provides 15% more horizontal breathing room for text expansion without returning to the "loose" visuals of 1.6cm+. The default grid is now (`x=1.5cm, y=1.3cm`) for maximum safe density.

## [1.6.23] - 2025-12-08
### Fixed
- **TikZ Logic Trap**: Diagrams with explicit Absolute Coordinates were falling through to "COMPACT" intent if they had >8 nodes, causing blind `scale=0.75` shrinking and neutralizing our v1.6.22 fix.
  - **Correction**: Updated intent classification to prioritize `horizontalSpan > 0` (Absolute Layouts) as **LARGE** intent.
  - **Impact**: Ensures absolute layouts invoke the "Density Equation" logic (Width Budget 19cm + Auto-Zoom), rather than being crushed by generic node-count heuristics.

## [1.6.22] - 2025-12-08
### Fixed
- **TikZ High-Density Cramping**: Dense diagrams (Span ~14cm) were being rendered at 1:1 scale (`x=1cm`), causing massive text overlap.
  - **Correction**: Increased calculation "Width Budget" from 14cm to **19cm**.
  - **Reasoning**: This allows `xUnit` to expand to **1.35cm** (clamped to 1.3), increasing physical spacing by 30%. The Zoom-to-Fit engine then shrinks the entire view to fit the container, effectively shrinking the font relative to the geometry. Resolves "Density Equation".

## [1.6.21] - 2025-12-08
### Fixed
- **TikZ Brace Parsing**: The regex for the "Manual Bezier Brace Polyfill" (`decoration={brace}`) was too strict, failing on spaces (e.g., `decorate, decoration`).
  - **Symptom**: Rendering crash (`! Package pgfkeys Error: I do not know the key '/pgf/decoration/.expanded'`).
  - **Fix**: Updated the regex in `LatexPreview.tsx` to be robust against whitespace (`\s*`) around keys and commas.

## [1.6.20] - 2025-12-08
### Fixed
- **TikZ Symmetrical Clamping**: Tuned horizontal protection to clamp `xUnit` at **1.3cm** (down from 1.6cm) to match the vertical `yUnit` clamp.
  - **Reasoning**: Creates a symmetrical "Max Grid" of 1.3cm for absolute diagrams, ensuring consistent compactness and preventing horizontal gaps from feeling "loose" compared to vertical ones.

## [1.6.19] - 2025-12-08
### Fixed
- **TikZ Horizontal Scaling**: The calculated optimal unit (up to 2.5cm) was too aggressive for diagrams with small coordinate spans (e.g., 3.5 units), creating large horizontal gaps.
  - **Correction**: Clamped `xUnit` to **1.6cm** for "Large Intent" diagrams with absolute positioning.
  - **Reasoning**: This provides a modest boost (1.6x) over standard 1cm units without creating "outrageous" loose space.

## [1.6.18] - 2025-12-08
### Fixed
- **TikZ Vertical Explosion (Levels)**: Hierarchical diagrams with "Large Intent" (Text Heavy) and explicit coordinates were checking X-width and expanding *both* X and Y to fill the page, leading to `y=2.5cm`.
  - **Correction**: Decoupled X and Y expansion logic for absolute layouts.
  - **Fix**: X expands to fill width (max 2.5cm), but **Y is clamped at 1.3cm**.
  - **Result**: Wide text fits, but vertical stacking remains compact (2.6cm gap vs 5cm gap).

## [1.6.17] - 2025-12-08
### Fixed
- **TikZ Coordinate Explosion**: Diagrams with explicit absolute coordinates (e.g., `at (0,4)`) were being inflated by the "Goldilocks" density boost (`y=1.5cm`).
  - **Symptom**: "Outrageously big" gaps between nodes.
  - **Root Cause**: The density check `horizontalSpan < 7` assumed that small-span diagrams needed expansion. However, diagrams with *any* explicit span (`> 0`) are by definition user-controlled and should not be distorted.
  - **Fix**: Restricted the Goldilocks boost to **Relative Positioning Only** (`horizontalSpan === 0`). Absolute coordinates are now respected (or scaled proportionally via Medium intent).

## [1.6.16] - 2025-12-08
### Fixed
- **Universal Math Repair**: `$\theta$_t` and `^2` (orphaned subscripts/superscripts) were crashing the renderer.
  - **Root Cause**: Invalid LaTeX syntax where subscripts exist outside math mode.
  - **Fix**: Implemented "Universal Regex" in `server/ai/utils.ts` that detects `MathEnd + Operator + Payload` and merges them back into the math block.
  - **Scope**: Handles subscripts, superscripts, single chars, and braced groups.
  - **Philosophy**: "Sanitize at Source" (Rule 9) - fix the data before it reaches the fragile client.

## [1.6.15] - 2025-12-08
### Refactored
- **Chunked Editor (Phase 6)**: Refactored the Editor to process the document **Section-by-Section** instead of as a monolith.
  - **Problem**: Large 70k+ char documents exceeded the output token limit (4k/8k), causing the AI to truncate the JSON response mid-file, deleting half the paper.
  - **Solution**: The Editor loop now iterates through sections, independently processing each one.
  - **Impact**: Eliminates truncation risk. Scales to infinite document length.
### Fixed
- **Diagram Corruption**: Phase 6 Editor is now **strictly prohibited** from modifying the `content` of enhancements. It can only edit `title` and `description`.
- **Editor Duplication**: Fixed a bug where `phase6_Editor` was called twice in `service.ts`.

## [1.6.14] - 2025-12-08
### Added
- **Feedback-Loop Retry (Self-Healing)**: Implemented an intelligent retry mechanism for Phase 6.
  - **Logic**: If `validateLatexSyntax` fails, the error message is captured and injected back into the prompt: *"PREVIOUS ATTEMPT FAILED: [Error]. FIX THIS."*
  - **Result**: The AI self-corrects syntax errors (e.g., closing missing braces) instead of blindly retrying.

## [1.6.13] - 2025-12-08
### Added
- **Deep Review Mode**: Added user toggle to switch between "Quick Review" (Single Pass) and "Deep Review" (6-Phase rigorous analysis).
- **Backend Flow**: Connected `advancedOptions.reviewDepth` from UI to `service.ts`.

## [1.6.12] - 2025-12-08
### Fixed
- **TikZ Title Gap**: Diagrams with title nodes at `+(0,2)` had excessive whitespace between the title and the content boxes.
  - **Root Cause**: For LARGE intent relative positioning diagrams, TikZ's default y-unit (1cm) made `+(0,2)` = 2cm gap.
  - **Discovery**: `node distance` controls relative positioning (`below of=`, `right of=`) but NOT coordinate offsets like `+(0,2)`. These are independent systems.
  - **Fix**: Inject `y=0.5cm` for LARGE relative diagrams, compressing `+(0,2)` to 1cm while `node distance=8.4cm` remains unaffected.
  - **Goldilocks Exclusion**: LARGE intent is now excluded from Goldilocks Protocol's x/y injection to prevent conflicts.

## [1.6.11] - 2025-12-08
### Added
- **TikZ Loading Placeholder**: Added visual feedback while TikZ diagrams render.
  - **Display**: Shows `[ Generating diagram... ]` with subtle pulsing animation.
  - **Architecture**: Fully contained inside the TikZ iframe (preserves isolation philosophy).
  - **Auto-Hide**: The existing `MutationObserver` (used for height resizing) now hides the placeholder when the SVG appears.
  - **Design Decision**: ASCII-only text for maximum compatibility; avoids emoji rendering issues across systems.
  - **Layout**: Uses `flex-direction: column` on body to stack loading state above diagram container.

## [1.5.16] - 2025-12-08
### Fixed
- **Table Thousand Separators**: Numbers like `105{,}000` were rendering with literal `{,}` instead of `105,000`.
  - **Root Cause**: Missing handler for LaTeX thousand separator pattern.
  - **Fix**: Added `{,}` → `,` replacement in `parseLatexFormatting()`.
- **Table `\&` Corruption**: Cells containing escaped ampersands (e.g., "Fear \& Greed") were being split incorrectly across rows and columns.
  - **Root Cause Chain**: AI generates `\&` → JSON escaping doubles it → `fixAIJsonEscaping` doubles again → Result is `\\&` (row break + column sep).
  - **Fix**: Added pre-normalization in `splitCells()` to convert `\\&` → `\&` before parsing. This is **robust** because it handles any AI that produces double-escaped ampersands.
  - **Universal**: Applies to all future tables regardless of AI model or escaping behavior.

## [1.5.15] - 2025-12-08
### Fixed
- **IEEE Citation Grouping**: Citations were rendering as `[1][2]` instead of `[1, 2]`.
  - **Root Cause**: The client-side citation renderer was joining individual bracket labels with an empty string.
  - **Fix**: Rewrote the `\cite{}` handler in `LatexPreview.tsx` to group all valid citation numbers into a single bracket pair.
  - **Result**: `\cite{ref_1,ref_2}` now correctly renders as `[1, 2]` (IEEE/Nature style).

## [1.5.14] - 2025-12-07
### Fixed
- **List Numbering (Enumerate)**: `latex.js` was rendering `enumerate` lists as "1Text" without dots or spacing.
  - **Fix**: Implemented **Manual Leaf-First Recursive Parser** in `LatexPreview.tsx`.
  - **Strategy**: Extracts `\begin{enumerate}` blocks, converts them to HTML `<ol>`, and bypasses `latex.js` entirely.
  - **Styling**: Added aggressive `!important` overrides in `latex-article.css` to defeat Tailwind's global property resets.
- **Algorithm Styling**: Algorithms were rendering as unstyled text because the CSS class was missing.
  - **Fix**: Added `.algorithm-wrapper` styles to `latex-article.css`.
  - **Logic**: Updated parser to rely on this class for grey background framing.

## [1.5.13] - 2025-12-07
### Fixed
- **Citation Robustness (The Auditor Fix)**: "Universal Citation Processor" updated to a **Robust Tokenizer**.
  - **Logic**: No longer assumes comma separators. Now splits content by `/[,\s;]+/` (Commans, Semicolons, Spaces, Newlines).
  - **Impact**: Correctly parses `(ref_1; ref_2)` or `(ref_1 ref_2)` which previously failed and rendered as raw text.
  - **Logging**: Added deep transparency logs for every citation match and merge operation.

## [1.5.12] - 2025-12-07
### Refactored
- **Phase 4: The Peer Reviewer**: Rebranded "The Critic" to "The Peer Reviewer".
  - **New Role**: Acts as a Senior PI conducting a "Nature/Science" caliber review.
  - **Capabilities**: Now uses the **Librarian Agent** (Web/Search capable) instead of the Strategist.
  - **New Criteria**: Assesses **Novelty** (Originality), **Rigor** (Logic), and **Validity** (Claim Verification).
  - **Data Flow**: Outputs a structured `ReviewReport` consuming `ctx.references` to prevent blind guessing.

## [1.5.11] - 2025-12-07
### Refactored
- **Citation System Overhaul**: Replaced ad-hoc regex with a two-pass **Universal Citation Processor**.
  1. **Tokenization**: Converts ANY parenthesized reference block `(ref_X...)` to `\cite{X}`.
  2. **Normalization**: Recursively merges adjacent citations `\cite{A} \cite{B}` into `\cite{A,B}`.
  - **Result**: Guarantees Standard Academic Formatting (e.g., `[2, 7]`) regardless of AI output variations.

## [1.5.10] - 2025-12-07
### Fixed
- **Citation Grouping**: Compiler now correctly groups multiple citations like `(ref_1, ref_2)` into `\cite{ref_1,ref_2}`, enabling `natbib` to render them as compressed groups `[1, 2]`. Previously they were left as raw text.

## [1.5.9] - 2025-12-07
### Fixed
- **TikZ Scaling Explosion**: "Goldilocks Protocol" (Text Heavy boost) was incorrectly expanding absolute-coordinate diagrams.
  - **Fix**: Restricted boost to only apply if `horizontalSpan < 7` (Index-based layouts) or unknown. Physical layouts (Span >= 7) are now exempt.
- **TikZ Font Shrinkage**: MEDIUM intent was arbitrarily scaling diagrams to 0.8x based on node count.
  - **Fix**: "Smart Scaling": If `horizontalSpan <= 14cm` (fits A4), use `scale=1.0` to preserve readability.

## [1.5.8] - 2025-12-07
### Fixed
- **Tiny Equation Bug**: Equations using verbose commands (`\mathrm`, `\text`) were being incorrectly shrunk by auto-scaling.
  - **Fix**: Auto-scaling heuristic now strips `\mathrm`, `\text`, `\left`, `\right`, etc. before counting characters.
- **Environment Inflation**: `\begin{equation}` wrapper tags were inflating character count, triggering unwanted scaling.
  - **Fix**: Explicitly skipped auto-scaling for all structured math environments (`equation`, `align`, `gather`).
- **Equation Scrollbars**: Removed unwanted scrollbars from display math.
  - **Fix**: Changed `overflow-x: auto` to `hidden` in CSS; rely on auto-scaling for long equations.

## [1.5.7] - 2025-12-07
### Added
- **FLAT Intent (TikZ)**: New intent classification for timeline-style diagrams with extreme aspect ratios (> 3:1).
  - **Detection**: Extracts ALL `(x,y)` coordinate pairs (not just `at` patterns) to calculate true vertical extent.
  - **Root Cause Fix**: Previous regex only matched `at (x,y)` patterns, missing `\draw (x,y)` coordinates that define vertical extent.
  - **Trigger**: Aspect ratio (horizontal/vertical) > 3.0 activates FLAT intent.
  - **Correction**: Multiplier-based expansion: `y × (ratio/2)`, `x × 1.5`.
  - **Override Behavior**: Strips existing `x=`/`y=` values before injecting calculated ones (TikZ uses first value).

### Changed
- **Coordinate Extraction**: Now captures ALL `(x,y)` patterns in TikZ code, not just `at (x,y)`, for accurate span/aspect calculations.
- **Priority Order**: Updated to `WIDE > FLAT > node distance > text density > node count > MEDIUM`.
- **Documentation**: Updated `TIKZ_HANDLING.md` and `LATEX_PREVIEW_SYSTEM.md` with FLAT intent specifications.

## [1.5.6] - 2025-12-07
### Added
- **WIDE Intent (TikZ)**: New intent classification for diagrams using absolute positioning (`\node at (x,y)`) that exceed A4 safe width.
  - **Detection**: Extracts X coordinates from `at (x,y)` patterns, calculates horizontal span.
  - **Trigger**: Horizontal span > 14cm activates WIDE intent (takes priority over all other intents).
  - **Scaling**: Dynamic `scale = min(1.0, 14/span) × 0.9` with floor at 0.5.
  - **Requirement**: `transform shape` is mandatory for proportional shrinking.
- **Explicit Coordinate Exemption**: MEDIUM and LARGE intents now skip automatic scaling if `x=` or `y=` are explicitly set in TikZ options.

### Changed
- **Documentation**: Updated `TIKZ_HANDLING.md` and `LATEX_PREVIEW_SYSTEM.md` with WIDE intent specifications.

## [1.5.5] - 2025-12-06
### Added
- **Hybrid Intent Logic**: Refactored TikZ classification (Phase 7) to use a "Hybrid" approach.
  - **Text Density Override**: Explicitly detects text-heavy diagrams (`>30` chars/node) and forces `LARGE` intent globally.
  - **Goldilocks Hoist**: "Coordinate Boost" (`x=2.2cm, y=1.5cm`) now applies to ALL dense diagrams, preventing label overlap regardless of original node distance.

## [1.5.4] - 2025-12-06
### Fixed
- **Math Rendering**: Resolved critical bug where `align*` environments rendered as red text.
  - **Fix**: Updated regex to pass the *entire* environment match (including `\begin{align*}`) to KaTeX, rather than just the body.
- **Table Math**: Resolved `LATEXPREVIEWMATH` placeholders appearing in table cells.
  - **Fix**: Implemented `resolvePlaceholders()` helper to recursively resolve placeholders inside manually parsed table cells.

## [1.5.3] - 2025-12-06
### Fixed
- **TikZ Standardization (Polyfill)**:
  - **Geometric Polyfill**: Replaced incompatible `decoration={brace}` commands with manual Bezier curve drawing logic. This bypasses the `PGFkeys` error in TikZJax.
  - **Mirror Support**: Polyfill now looks for `mirror` keyword and flips curvature accordingly.
  - **Iframe Resizing**: Tightened resize buffer from `20px` to `5px` (calculated via `getBoundingClientRect`) to eliminate whitespace.

## [1.5.2] - 2025-12-06
### Fixed
- **Root Cause Remediation**: Replaced fragile hacks with robust, native solutions.
  - **Headers**: Switched `\paragraph` replacer to inject valid LaTeX (`\vspace`, `\textbf`) instead of HTML tags, removing artifacts.
  - **Math Scaling**: Reverted to `transform` (calculated width) for stable layout, but removed all interactive CSS (hover/icons) for a clean print look.

## [1.5.1] - 2025-12-06
### Fixed
- **Audit Remediation (Stability Hardening)**: Addressed 3 critical rendering risks identified by external audit.
  - **TikZ Nested Brackets**: Replaced brittle regex extraction with `extractTikzBlocks` manual parser. Safely handles nested options like `[label={[0,1]}]`.
  - **Table Row Integrity**: Replaced naive row splitting with `smartSplitRows`. Prevents `\\` inside `\parbox` or braces from corrupting the table structure.
  - **Placeholder Safety**: Added `DOM.normalize()` before injection to prevent browser text-node splitting from breaking placeholder replacement.

## [1.5.0] - 2025-12-06
### Added
- **Responsive TikZ Architecture (v1.4.0 Re-architecture)**: Abandoned manual "intent-based" scaling hacks in favor of professional web standards.
  - **CSS-Driven Layout**: Enforced `width: auto`, `max-width: 100%`, and `margin: 0 auto` on SVG elements to ensure perfect responsiveness.
  - **Height-Only Observation**: Updated iframe resize observers to only manage height, relying on the browser's layout engine for width.
  - **Centering**: Added Flexbox centering to TikZ containers, resolving left-alignment issues.
- **Native TabularX Parsing**:
  - **Parser Upgrade**: Updated manual parser to natively handle `\begin{tabularx}` environments (previously skipped/nuked) by ignoring the width argument.
  - **Whitespace Robustness**: Fixed "Table Body - Parse Failed" errors caused by whitespace in command arguments (e.g., `\begin{tabular} {cols}`).
- **Parsing Order Fix**: Moved standard table parsing *before* `tabularx` replacement to ensure nested tables are correctly extracted.

## [1.4.0] - 2025-12-06
### Added
- **Strict Containment Protocol**: Enforced "Code is Law" rules for `latex.js`.
  - **Dangerous Macros**: `\eqref`, `\ref`, `\label`, `\url`, `\footnote` are now strictly intercepted and sanitized to safe HTML/text before reaching the renderer.
  - **Parent Node Surgery**: Implemented deep DOM surgery in `LatexPreview.tsx` to prevent invalid HTML nesting (e.g., `<div>` inside `<p>`) for block-level placeholders.
  - **Parbox Support**: Added support for `\columnwidth` in the manual parbox parser.
- **Documentation**: Updated `ARCHITECTURE.md` and `LATEX_PREVIEW_SYSTEM.md` to fully align with the strict implementation.

## [1.3.0] - 2025-12-06
### Added
- **Recall Last Generation**: Added Persistence/Recall feature. Users can now restore their last generated paper (including LaTeX source) from the database across page reloads and browser sessions.
- **Import LaTeX**: Added "Import LaTeX" feature on the landing page, allowing users to upload local `.tex` files for immediate preview and debugging.
- **Intent-Based TikZ Scaling**: Implemented "True Dynamic Scaling" architecture for diagrams:
  - **Compact Strategy**: Automatically detects tight diagrams (e.g., entity flow) and scales them down (`scale=0.75` + `transform shape`) to fit A4 pages.
  - **Large Strategy**: Automatically detects text-heavy diagrams (e.g., cycle processes) and expands spacing (`node distance=8.4cm`) without shrinking text to ensure readability.

## [1.2.0] - 2025-12-06
### Added
- **6-Phase AI Pipeline**: Refactored "Research-First" architecture:
  - Phase 1: Strategist (analyze input → research queries)
  - Phase 2: Librarian (find papers BEFORE writing)
  - Phase 3: Thinker (draft with evidence awareness)
  - Phase 4: Critic (identify weak claims)
  - Phase 5: Rewriter (strengthen text with evidence)
  - Phase 6: Editor (insert citation markers)
- **PipelineContext Pattern**: Shared state object for data flow between phases.
- **Compiler Logic**: Added `compileCitations()` to `latexGenerator.ts` to convert `(ref_X)` → `\cite{ref_X}`.

### Fixed
- **Standalone Tabular**: Added handler for `\begin{tabular}...\end{tabular}` outside table wrappers (was causing "unknown environment: tabular" crash).
- **TikZ Math Placeholders**: Moved TikZ extraction BEFORE math extraction so TikZJax receives raw math (not LATEXPREVIEWMATH placeholders).
- **TikZ Sizing**: Removed forced spacing overrides that inflated diagrams. Diagrams now render at natural size.
- **TikZ Centering**: Wrapped TikZ iframes in centered flex container.
- **Math Display Rhythm**: Added consistent 1.5em spacing above/below display equations.
- **Math Font Size**: Increased display equation font size to 1.1em.

## [1.1.4] - 2025-12-05
### Fixed
- **TikZ Diagram Density**: Implemented "Pure Density Reduction" strategy to eliminate cramped/overlapping diagrams.
  - Removed proportional `scale=X` option (which zooms everything equally, preserving density).
  - Implemented coordinate expansion: `x=5cm, y=5cm` (5x grid expansion).
  - Added relative spacing: `node distance=7cm`.
  - Added text compaction: `font=\small`.
  - Fixed iframe resize logic using `scrollWidth`/`scrollHeight` for accurate sizing.
  - Balanced internal padding (20px + 5px buffer).

## [1.1.3] - 2025-12-05
### Fixed
- **TikZ Coordinate Error**: Removed aggressive typography normalization (`--` to `–`) which was corrupting TikZ path syntax.
- **TikZ Context**: Explicitly wrapped extracted TikZ code in `\begin{tikzpicture}` environment to prevent "Undefined control sequence" errors.
- **TikZ Encoding**: Added ASCII sanitization to prevent `btoa` crashes on unicode characters.
- **Browser Compatibility**: Removed `amsmath` and `graphicx` from the client-side safe preamble to eliminate `require is not defined` errors.
- **Build Stability**: Fixed duplicate variable declarations in `LatexPreview.tsx` via code cleanup.

## [1.1.2] - 2025-12-04
### Changed
- **UI Simplification**: Removed "Split View" mode. The interface now defaults to the "LaTeX Preview" for a cleaner, focused experience.
- **Preview Stability**: Added support for `\hfill` and Q.E.D. symbols (`\hfill$\square$`) in the LaTeX previewer, preventing crashes in mathematical proofs.

## [1.1.1] - 2025-12-04
### Added
- **Formal Academic Citations**: Enforced standard `\cite{ref_X}` syntax and automatic `\begin{thebibliography}` generation.
- **Robust Previewer**: Implemented "Fragment Rendering" strategy in `LatexPreview.tsx` to bypass `latex.js` limitations with complex document structures.
- **Blockquote Support**: Added automatic conversion of text-only equations to styled HTML blockquotes to prevent rendering issues.

### Fixed
- **Database Migration**: Added missing `progress` column to `conversion_jobs` table.
- **Preview Crash**: Resolved `SyntaxError: 2 levels of balancing remaining` by stripping `\documentclass` and `\begin{document}` wrappers.
- **Underscore Crash**: Fixed `SyntaxError: "_" found` by automatically escaping underscores in citation keys (`ref_1` -> `ref\_1`).
- **Cut-off Text**: Fixed issue where long sentences wrapped in `\begin{equation*}` were rendered as single non-breaking lines.

## [1.1.0] - 2025-12-04
### Added
- **Latest AI Models (Dec 2025)**: Updated default configurations to support the latest models:
    - **Poe**: Claude-Sonnet-4.5 (Writer/Strategist), Gemini-2.5-Pro (Librarian).
    - **OpenAI**: GPT-5.1, o3-pro.
    - **Anthropic**: Claude Opus 4.5.
    - **xAI**: Grok 4.1.
- **Markdown Support**: Added full support for uploading and processing `.md` files.
- **Upload Folder Access**: Added a "Folder" icon button to the header to instantly open the local uploads directory in the system file explorer.
- **Database Logging**: Enabled Drizzle ORM query logging for deeper debugging visibility.

### Changed
- **Logging System**: Removed 80-character truncation limit on API logs to ensure full error transparency.
- **Cleanup**: Removed obsolete test scripts and debug files (`test_poe_whitelist.ts`, `debug_preview_*.html`, etc.) to maintain a clean codebase.

## [0.2.0] - 2025-12-02 (Stable Release)

### Added
- **Sanitization Layer (Server-Side)**: Implemented `sanitizeLatexOutput` in `server/ai/utils.ts` to automatically strip invalid characters (e.g., unicode math symbols) and dangerous commands before JSON parsing.
- **Sanitization Layer (Client-Side)**: Added robust handling in `LatexPreview.tsx` to prevent browser crashes. Unsupported features (like `tabularx`) are now displayed as raw code blocks instead of breaking the renderer.
- **Gospel Rule (Tool Safety)**: Formalized the strict prohibition of `replace_file_content` to prevent file corruption.
- **5-Phase Pipeline Documentation**: Updated `ARCHITECTURE.md` and `5_phase_pipeline_mapping.md` to accurately reflect the "Thinker -> Critic -> Librarian -> Editor -> Compiler" workflow.

### Changed
- **Rebranding**: Renamed application from "Auto-Academic Formatter" to **"Auto Academic Paper"** across all documentation, UI, and configuration files.
- **Reference Manager System**: Implemented a deterministic "Compiler" (`compileBibliography`) to handle citation numbering and bibliography generation, replacing the hallucination-prone AI generation.
- **Key-Based Citations**: Updated AI prompts to use stable keys (e.g., `(ref_1)`) instead of numerical citations, ensuring 100% accuracy in mapping.
- **Strict Content Integrity**: Removed "Roleplaying" personas. Implemented strict task-based prompts forbidding fabrication, hallucination, and fake data.
- **"Digital Typesetter" Console**: Replaced the opaque spinner on the Processing Page with a live, granular activity log.
- **Direct Append Bibliography**: Refactored `LatexPreview.tsx` to append the bibliography HTML directly to the DOM, bypassing `latex.js` rendering logic entirely to prevent duplication.

### Fixed
- **Server Crash (EADDRINUSE)**: Fixed a critical server crash caused by a zombie process on port 5000.
- **File Corruption**: Resolved massive data loss in `server/ai/service.ts` caused by `replace_file_content` failure.
- **LaTeX Preview Crash**: Fixed `Invalid UTF-8 byte sequence` and `unreachable` errors in the browser renderer by removing invalid unicode replacements.
- **Ghost Bibliography**: Fixed duplicate bibliography rendering by implementing "Direct Append" strategy.
- **Citation Key Mismatch**: Fixed a bug where `ref.id` was used instead of `ref.key`.

## [0.1.0] - 2025-11-29
### Added
- **Initial migration to Railway and Poe API**.
- **Basic LaTeX rendering with `latex.js`**.
- **"Draft Mode" for handling cases with no research data**.
