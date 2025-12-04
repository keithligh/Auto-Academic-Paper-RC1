<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
