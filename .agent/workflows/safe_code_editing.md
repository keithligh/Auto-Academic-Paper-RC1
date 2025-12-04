---
description: How to safely edit complex files without corrupting them
---

# Safe Code Editing Workflow

This workflow defines the strict protocol for editing files, especially large or complex components like `LatexPreview.tsx`.

## 1. PRE-EDIT ANALYSIS
- **View Context:** ALWAYS call `view_file` on the specific lines you intend to modify AND the surrounding lines (at least 20 lines before and after).
- **Identify Dependencies:** Check if the code you are removing contains helper functions (e.g., `createPlaceholder`, `sanitizeLatexForBrowser`). **DO NOT DELETE HELPER FUNCTIONS** unless you have explicitly verified they are unused by searching the *entire file*.

## 2. EDITING STRATEGY
- **Prefer `replace_file_content`:** Use this for single, contiguous blocks.
- **Use `multi_replace_file_content`:** Use this for multiple, non-contiguous edits.
- **Avoid "Rewrite":** Do NOT try to replace the entire file content unless absolutely necessary. This is where most corruption happens.
- **Anchor Correctly:** When using `replace_file_content`, ensure your `TargetContent` is unique. Include enough context (comments, whitespace) to make it unique.

## 3. POST-EDIT VERIFICATION (MANDATORY)
- **Syntax Check:** Immediately after editing, run a syntax check or linter if available.
- **Build Check:** Run `npm run dev` (or equivalent) to ensure the build didn't break.
- **Runtime Check:** If the file is a UI component, verify it loads in the browser.

## 4. CRITICAL FILES (DO NOT TOUCH WITHOUT CAUTION)
- `client/src/components/LatexPreview.tsx`: Contains critical regex and helper functions.
    - **DO NOT DELETE:** `sanitizeLatexForBrowser`, `createPlaceholder`, `replaceWithTikzBlock`, `parseLatexFormatting`.
    - **DO NOT MODIFY:** The Iframe isolation logic for TikZ.
