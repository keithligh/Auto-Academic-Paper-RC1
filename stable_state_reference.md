<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Stable State Reference (v2.0)

**Last Verified:** 2025-11-30
**Status:** STABLE - DO NOT MODIFY WITHOUT VERIFICATION

## 1. Core Architecture Decisions

### A. UI Architecture: "The Digital Typesetter"
**Goal:** A professional, transparent, and precise interface for researchers.
**Implementation:**
-   **Landing Page:** "The Desk" - Minimalist upload zone.
-   **Processing Page:** "The Console" - Transparent, granular progress logs (no opaque spinners).
-   **Results Page:** "The Editor" - 30:70 Split View (Original Context / Live Preview).
-   **Aesthetic:** Strict Light Mode, Serif Typography (`Merriweather`), Monospace Data (`JetBrains Mono`).

### B. TikZ Diagram Rendering (Iframe Isolation)
**Problem:** `TikZJax` modifies the DOM in ways that conflict with React's virtual DOM.
**Solution:** Render every TikZ diagram inside an isolated `<iframe>`.
**Implementation:**
-   **Isolation:** `LatexPreview.tsx` generates an HTML string with `srcdoc`.
-   **Centering:** All iframes and images are forced to `display: block; margin: 0 auto` via CSS to prevent "leaning left".
-   **Dynamic Resizing:** A `MutationObserver` inside the iframe updates height.

### C. LaTeX Preview (Sanitization Strategy)
**Problem:** Browser-based `latex.js` crashes on unsupported commands.
**Solution:** Aggressive Pre-Sanitization.
**Implementation:**
-   **Strip Packages:** Remove ALL `\usepackage{...}`.
-   **Placeholders:** Replace complex environments with visual placeholders.
-   **Macro Fixes:** Explicitly replace `\qed` with Unicode `∎` to prevent browser crashes.
-   **Helper Functions:** `createPlaceholder` and `replaceWithTikzBlock` are CRITICAL. **DO NOT DELETE.**

## 2. "Golden Rules" for Maintenance

### Rule #1: CONFIRM DESTRUCTIVE CHANGES (CRITICAL)
**Never** delete a working feature (like Split View) without explicit user confirmation.
-   **Interpretation != Permission:** "Prioritize Preview" does not mean "Delete Code View".

### Rule #2: Atomic Writes Only
**Never** use `replace_file_content` for React components.
-   **Protocol:** Always use `write_to_file` to overwrite the entire file. This prevents syntax corruption.

### Rule #3: Verify Syntax Before Restarting
**Never** restart the server without checking for syntax errors.

## 3. Verification Checklist (Before Committing)
1.  **Server Start:** Does `npm run dev` start without errors?
2.  **Build:** Does `npm run build` pass?
3.  **Preview:** Do diagrams render centered?
4.  **Console:** Are there any `ReferenceError` messages?

---
**Use this document as the absolute source of truth for maintaining the stability of this version.**
