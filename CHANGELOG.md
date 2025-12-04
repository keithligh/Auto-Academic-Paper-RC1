<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
