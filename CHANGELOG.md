<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.3] - 2025-12-06
### Fixed
- **TikZ Decoration Rendering**: Fixed PGFkeys error "I do not know the key '/pgf/decoration/.expanded'" that occurred when rendering TikZ diagrams with brace decorations.
  - **Root Cause**: TikZJax cannot properly process nested key-value pairs in decoration options like `decoration={brace,amplitude=5pt}`.
  - **Solution**: Added sanitization in `LatexPreview.tsx` to strip nested decoration options, converting `decoration={name,options...}` to `decoration=name`.
  - **Impact**: All TikZ diagrams using `\draw[decorate,decoration={...}]` syntax now render correctly without emergency stops.

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
- Initial migration to Railway and Poe API.
- Basic LaTeX rendering with `latex.js`.
- "Draft Mode" for handling cases with no research data.
