# Incident Report: Math Rendering Debugging Session (Dec 6, 2025)

## Status: ✅ RESOLVED

## Summary
A debugging session to fix math rendering issues in the LaTeX preview system. After several failed attempts that were rolled back, two root causes were identified and fixed.

## Initial Problem
User reported that `align*` math environments were rendering as **red text** instead of properly formatted equations.

## Root Cause Identified (Correctly)
The extraction was working correctly - `latex.js` was NOT seeing the math. The red text was actually coming from **KaTeX** failing to render the math content properly.

**Why KaTeX failed:** The extraction code stripped the `\begin{align*}...\end{align*}` wrapper and passed only the body content to KaTeX. Without the alignment environment, KaTeX didn't understand the `&` alignment characters and rendered errors.

## Attempted Fixes (All Rolled Back)

### Attempt 1: Replace Regex with Manual Parser
- **Rationale:** Assumed the regex was failing to extract math
- **Result:** Extraction was already working; this was unnecessary

### Attempt 2: Wrap body in `\begin{aligned}...\end{aligned}`
- **Rationale:** Provide KaTeX with alignment context
- **Result:** Caused math to render at SMALLER font size because `aligned` is an inner environment

### Attempt 3: CSS fixes for centering and spacing
- **Changes:** Modified `latex-article.css` with flexbox centering, reduced margins
- **Result:** Did not fix the size issue; created inconsistent spacing

### Attempt 4: Remove newlines from placeholders
- **Rationale:** Reduce paragraph spacing from latex.js
- **Result:** No visible improvement

### Attempt 5: Pass complete environment to KaTeX
- **Rationale:** KaTeX supports `align*` directly, so pass `\begin{align*}...\end{align*}`
- **Status:** Never tested - user requested rollback at this point

## Files Modified (All Rolled Back)
1. `client/src/components/LatexPreview.tsx`
   - Multiple versions of `createMathBlock` function
   - Added debug logging
   - Changed placeholder return format
   
2. `client/src/styles/latex-article.css`
   - Modified `.katex-display` styles

## Debug Scripts Created (Not Rolled Back)
- `debug_math_regex.ts`
- `debug_manual_extract.ts`
- `debug_robust_extract.ts`
- `debug_manual_failure.ts`
- `debug_mismatch.ts`
- `debug_manual_end.ts`

## Key Learnings

1. **The "Red Text" was from KaTeX, not latex.js**
   - Console logging proved extraction was working
   - The placeholder `LATEXPREVIEWMATH` was being created
   - KaTeX was receiving malformed input (body without environment wrapper)

2. **`aligned` vs `align*` in KaTeX**
   - `aligned` is an INNER environment (renders smaller)
   - `align*` is a DISPLAY environment (renders at full size)
   - They are NOT interchangeable

3. **Bandaid Approach Failed**
   - Made multiple incremental fixes without fully understanding the problem
   - Each "fix" introduced new issues
   - Should have created a minimal test case first

## Correct Fix (Implemented v1.5.4)
The correct approach would be:
```typescript
// When extracting align*, pass the COMPLETE environment to KaTeX
if (envName) {
  contentToRender = `\\begin{${envName}}${mathContent}\\end{${envName}}`;
}
```

This reconstructs the full LaTeX environment that KaTeX can render properly.

## Recommendations for Future Work
1. Create isolated test cases before modifying production code
2. Understand the difference between KaTeX's inner and display environments
3. Follow the Architecture document strictly - the extraction was correct, the rendering was the issue
4. Don't make CSS changes to fix rendering logic problems
