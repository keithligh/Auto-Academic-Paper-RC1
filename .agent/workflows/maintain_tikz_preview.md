---
description: How to maintain and debug the TikZ preview functionality
---

# Maintain TikZ Preview Workflow

This workflow documents the "Golden Rules" for the TikZ preview feature. **DEVIATION FROM THIS WORKFLOW WILL CAUSE REGRESSIONS.**

## 1. ARCHITECTURE: IFRAME ISOLATION
- **Rule:** TikZ diagrams MUST be rendered inside an isolated `<iframe>`.
- **Reason:** `TikZJax` modifies the DOM globally and conflicts with React's virtual DOM. Shared DOM integration causes crashes and missing diagrams.
- **Implementation:**
    - `LatexPreview.tsx` generates a full HTML document string.
    - This string is assigned to `iframe.srcdoc`.
    - The iframe contains its own `<script src="...">` for TikZJax.

## 2. LIBRARY LOADING: CDN ONLY
- **Rule:** Load `tikzjax.js` and `fonts.css` from `https://tikzjax.com/v1/`.
- **Reason:** Localizing these files requires complex WASM MIME type configuration and file serving logic that is fragile in this environment. The CDN is stable.
- **Do Not:** Do not try to download `tikzjax.js` to `client/public/` again.

## 3. DYNAMIC RESIZING
- **Rule:** The iframe must resize itself to fit the content.
- **Implementation:** A `MutationObserver` script is injected *inside* the iframe's HTML. It measures the `<svg>` and updates `window.frameElement.style.height`.
- **Do Not:** Do not try to measure the iframe content from the parent window (Cross-Origin issues, though `srcdoc` is technically same-origin, it's cleaner to keep logic internal).

## 4. REGEX & PARSING
- **Rule:** Use `replaceWithTikzBlock` helper function.
- **Regex:** `\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}`
- **Robustness:** Ensure the regex handles whitespace and newlines.

## 5. VERIFICATION STEPS
When modifying `LatexPreview.tsx`, ALWAYS run these checks:
1.  **Open `debug_full_repro.html`:** Verify the diagram renders.
2.  **Check Scrollbars:** The iframe should NOT have scrollbars.
3.  **Check Console:** No `ReferenceError` or `SyntaxError`.
4.  **Check Loading Placeholder (v1.6.11):** Verify `[ Generating diagram... ]` appears during compilation and disappears once the SVG renders.

## 6. LOADING PLACEHOLDER (v1.6.11)
- **Rule:** The loading state is displayed **inside the iframe**, not in React.
- **Reason:** Cross-frame `postMessage` communication would add complexity without benefit. The `MutationObserver` already exists to detect SVG completion—we simply leverage it to hide the placeholder.
- **Implementation:**
    - CSS `.tikz-loading` class with `pulse` animation inside `iframeHtml` string.
    - `MutationObserver` adds `.hidden` class when SVG appears.
- **Do Not:** Do not try to use React state or `useState` for loading state in TikZ—it requires framework-level cross-frame bridges.
