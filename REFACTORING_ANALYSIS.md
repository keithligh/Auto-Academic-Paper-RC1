# LatexPreview Refactoring Analysis: What Went Wrong and How to Fix It

**Date:** 2025-12-10
**Purpose:** Document the logic, reasoning, and proper implementation approach for refactoring LatexPreview.tsx without breaking existing functionality.

---

## Executive Summary

The refactoring effort aimed to transform a **1,586-line monolithic file** (`LatexPreview.tsx`) into a **modular architecture** with specialized "engine" modules. The goal was noble: improve maintainability, testability, and separation of concerns.

**Result:** The refactor introduced **critical bugs** that broke TikZ rendering completely.

**Root Cause:** Improper code migration that added unnecessary transformations and changed proven logic without understanding the delicate balance of the existing system.

---

## 1. Architecture Comparison

### Old Architecture: "The Monolith" (v4 - Working)

**File Structure:**
```
client/src/components/LatexPreview.tsx (1,586 lines)
├── Component Logic (React hooks, refs, state)
├── sanitizeLatexForBrowser() - The "God Object"
│   ├── parseLatexFormatting() - Inline formatting helper
│   ├── createMathBlock() - KaTeX rendering
│   ├── createTikzBlock() - TikZ iframe generation (500+ lines!)
│   ├── processParboxes() - Parbox parsing
│   ├── Citation processing
│   ├── Table processing
│   ├── List processing
│   ├── Algorithm processing
│   └── Environment processing
└── Rehydration logic (TreeWalker)
```

**Characteristics:**
- ✅ **Self-contained:** All logic in one place
- ✅ **Battle-tested:** Hundreds of fixes accumulated over time
- ✅ **Proven stable:** Known to work with complex diagrams
- ❌ **Hard to maintain:** Finding specific logic requires scrolling
- ❌ **No reusability:** Can't test engines independently
- ❌ **Coupling:** Component and processing logic mixed

### New Architecture: "The Modular System" (v5 - Broken)

**File Structure:**
```
client/src/
├── components/
│   └── LatexPreview.tsx (126 lines)
│       └── Calls processLatex() and handles React rendering
└── lib/latex-unifier/
    ├── processor.ts (368 lines) - "The Pipeline" (orchestrator)
    ├── healer.ts (92 lines) - "The Doctor" (pre-processing)
    ├── tikz-engine.ts (379 lines) - "The Architect" (TikZ extraction)
    ├── table-engine.ts (333 lines) - "The Grid" (table parsing)
    └── citation-engine.ts (157 lines) - "The Librarian" (citations)
```

**Total:** 126 + 1,329 = **1,455 lines** (vs. 1,586 old)

**Characteristics:**
- ✅ **Modular:** Each engine has clear responsibility
- ✅ **Testable:** Can unit test engines independently
- ✅ **Maintainable:** Easier to find and fix specific logic
- ❌ **Broken:** TikZ rendering failed completely
- ❌ **Added complexity:** New bugs introduced during migration
- ❌ **State management:** Shared `blocks` object passed around

---

## 2. What Broke: The Critical Bugs

### Bug #1: The `sanitizeStr` Function (CRITICAL)

**Location:** `tikz-engine.ts` lines 38-58 (initial refactor)

**What Happened:**
The refactored code added a new `sanitizeStr` function that **did not exist in the old working code**:

```typescript
const sanitizeStr = (s: string) => s
    .replace(/%.*$/gm, '')        // Strip comments
    .replace(/\\textbf\s*\{/g, '{\\bfseries ')
    .replace(/\\textit\s*\{/g, '{\\itshape ')
    .replace(/\\sffamily/g, '')
    .replace(/\\rmfamily/g, '')
    .replace(/\\ttfamily/g, '')
    .replace(/\\n(?![a-zA-Z])/g, ' ')
    .replace(/\n/g, ' ');         // ❌ FATAL: Flattens ALL newlines!
```

**Why This Broke Everything:**

1. **Line 58: `.replace(/\n/g, ' ')`** - Replaced ALL newlines with spaces
2. Multi-line TikZ code was flattened into a single line
3. TikZ parsing relies on line structure for node definitions
4. Result: `"No shape named 'empathize' is known"` errors

**Example:**
```tikz
\node (empathize) [rectangle, draw] {Empathize};
\node (define) [rectangle, draw, below of=empathize] {Define};
\draw[->] (empathize) -- (define);
```

Became:
```tikz
\node (empathize) [rectangle, draw] {Empathize}; \node (define) [rectangle, draw, below of=empathize] {Define}; \draw[->] (empathize) -- (define);
```

This corrupted the structure and broke node references.

**Why It Was Added:**
Someone thought they needed to "sanitize" the TikZ code, possibly to:
- Strip comments before flattening (line 40)
- Convert font commands to TikZJax-compatible forms
- **But:** The old code never had this function!

**The Fix:**
Remove the entire `sanitizeStr` function. The old code only did:
```typescript
// Old working approach:
let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, ''); // ASCII only
// Then: Ampersand escaping, Bezier polyfill
// NO NEWLINE FLATTENING
```

---

### Bug #2: Comment Stripping Strategy

**Location:** `tikz-engine.ts` line 40 (in `sanitizeStr`)

**What Happened:**
The comment stripping used simple regex:
```typescript
.replace(/%.*$/gm, '')  // Strip everything after %
```

**Problem:**
This breaks when TikZ code contains escaped percents:
```tikz
\node {100\% complete};  % This is a comment
```

The regex strips `\% complete}; % This is a comment`, leaving just:
```tikz
\node {100
```

**The Right Way (from TIKZ_HANDLING.md v1.9.25):**
```typescript
// Token Replacement Strategy - Three steps:
result = result.replace(/\\%/g, '__PCT__');     // 1. Save escaped %
result = result.replace(/%.*$/gm, '');          // 2. Strip comments
result = result.replace(/__PCT__/g, '\\%');     // 3. Restore escaped %
```

**Why This Matters:**
Academic papers often have percentage values in diagrams. Breaking this causes node label corruption.

---

### Bug #3: Logic Duplication

**Location:** Multiple engines

**What Happened:**
The `parseLatexFormatting` function was **duplicated** in:
- `table-engine.ts` (lines 20-96)
- `processor.ts` (used implicitly via table-engine)

**Old Code:**
Had ONE `parseLatexFormatting` helper inside `sanitizeLatexForBrowser` used consistently everywhere.

**New Code:**
Each engine reimplements or imports different versions, risking inconsistency.

**Proper Approach:**
Create `formatter.ts` with the single source of truth:
```typescript
// lib/latex-unifier/formatter.ts
export function parseLatexFormatting(text: string): string {
    // Single implementation
}
```

---

## 3. Why Did This Happen? Root Cause Analysis

### Anti-Pattern #1: "Improving" While Refactoring

**What Happened:**
The refactorer thought: *"While I'm moving this code, let me also add comment stripping and font sanitization!"*

**Why This Is Wrong:**
- **Refactoring ≠ Rewriting**
- Refactoring = Move code without changing behavior
- "Improvements" = Introduce new bugs

**Lesson:**
> "If it ain't broke, don't fix it." Move code EXACTLY as-is first, THEN improve in separate commits.

---

### Anti-Pattern #2: Not Understanding the "Why"

**What Happened:**
The old code had NO `sanitizeStr`, NO newline flattening, NO comment stripping in TikZ processing.

**The refactorer assumed:**
- "The old code must be missing this"
- "I'll add proper sanitization"

**Reality:**
- The old code **intentionally** did minimal processing
- TikZ code needs to preserve structure
- Over-sanitization breaks rendering

**Lesson:**
> Before adding new logic during a refactor, ask: "Why doesn't the old code do this?"
> If the old code works, the absence of logic is **intentional**, not an oversight.

---

### Anti-Pattern #3: No Incremental Testing

**What Happened:**
The entire refactor was done in one pass:
1. Split into 5 engine files
2. Add new sanitization logic
3. Deploy

**No Testing Between Steps:**
- No verification that tikz-engine.ts works alone
- No comparison of old vs. new TikZ HTML output
- No unit tests for edge cases

**Proper Approach:**
1. **Step 1:** Extract `healLatex` to healer.ts → Test
2. **Step 2:** Extract `processTikz` to tikz-engine.ts **with ZERO changes** → Test
3. **Step 3:** Extract `processCitations` to citation-engine.ts → Test
4. **Step 4:** Extract `processTables` to table-engine.ts → Test
5. **Step 5:** Create processor.ts orchestrator → Test
6. **Step 6:** Only THEN consider improvements in separate PRs

**Each step must:**
- Produce identical output to the old code
- Pass regression tests
- Be committed separately

---

## 4. How to Refactor Correctly: The Safe Migration Path

### Phase 1: Preparation (Before Writing Code)

**4.1.1. Document the Old System**
```bash
# Create a snapshot of current behavior
npm run build
npm run test > test_baseline.txt

# Document all test cases
- Test with simple TikZ (2-3 nodes)
- Test with complex TikZ (8+ nodes, absolute positioning)
- Test with TikZ containing comments
- Test with TikZ containing escaped % characters
- Test with tables containing TikZ
- Test with math equations
- Test with citations
```

**4.1.2. Create Comparison Harness**
```typescript
// test/refactor-validation.test.ts
import { sanitizeLatexForBrowser as oldSanitize } from '../old/LatexPreview';
import { processLatex as newProcess } from '../new/processor';

describe('Refactor Validation', () => {
    testCases.forEach(({ name, latex }) => {
        it(`produces identical output for: ${name}`, () => {
            const oldResult = oldSanitize(latex);
            const newResult = newProcess(latex);

            expect(normalizeHtml(newResult.html)).toBe(normalizeHtml(oldResult.sanitized));
            expect(newResult.blocks).toEqual(oldResult.blocks);
        });
    });
});
```

---

### Phase 2: Extract Engines (One at a Time)

**4.2.1. Extract Healer (Safest First)**

**Step 1:** Identify all pre-processing logic:
```typescript
// Old location: sanitizeLatexForBrowser, lines 690-820
content = content.replace(/^```latex\s*/i, '');  // Markdown
content = content.replace(/\\n(?!ewline)/g, '\n');  // Newline fix
content = content.replace(/\\section\*?\s*\{References\}/gi, '');  // Ghost header
// ... etc
```

**Step 2:** Copy EXACTLY to healer.ts:
```typescript
// lib/latex-unifier/healer.ts
export function healLatex(content: string): string {
    let healed = content;
    // PASTE EXACT CODE FROM OLD VERSION
    // NO MODIFICATIONS
    return healed;
}
```

**Step 3:** Test in isolation:
```typescript
describe('healLatex', () => {
    it('strips markdown fences', () => {
        expect(healLatex('```latex\\n$x$\\n```')).toBe('$x$');
    });
    // Add tests for ALL heal cases
});
```

**Step 4:** Integrate back:
```typescript
// LatexPreview.tsx (still monolithic)
function sanitizeLatexForBrowser(latex: string) {
    let content = healLatex(latex);  // Use new healer
    // ... rest of old code unchanged
}
```

**Step 5:** Regression test:
```bash
npm test  # Must pass ALL existing tests
```

**Step 6:** Commit:
```bash
git add .
git commit -m "refactor: Extract healLatex to healer.ts (no behavior change)"
```

---

**4.2.2. Extract TikZ Engine (Most Complex)**

**Step 1:** Identify TikZ processing boundaries:
```typescript
// Old code: createTikzBlock function (lines 164-615)
const createTikzBlock = (tikzCode: string, options: string = ''): string => {
    // ALL 450+ lines
}

// Extraction loop (lines 710-775)
while (content.includes('\\begin{tikzpicture}')) {
    // Manual parsing logic
}
```

**Step 2:** Copy to tikz-engine.ts:
```typescript
// tikz-engine.ts
export interface TikzResult {
    cleanedContent: string;
    blocks: Record<string, string>;
}

// PASTE createTikzBlock EXACTLY (lines 164-615 from old file)
function createTikzBlock(tikzCode: string, options: string, blocks: Record<string, string>): string {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;

    // ❌ DO NOT ADD: sanitizeStr function
    // ❌ DO NOT ADD: comment stripping
    // ❌ DO NOT ADD: newline flattening

    // ✅ ONLY ASCII enforcement:
    let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, '');

    // ✅ ONLY ampersand escaping:
    safeTikz = safeTikz.replace(/\\\\&/g, '\\\\ \\&');
    safeTikz = safeTikz.replace(/([^\\])&/g, '$1\\&');

    // ✅ REST OF CODE EXACTLY AS-IS
    // ... Intent Engine logic
    // ... Iframe generation
}

export function processTikz(content: string): TikzResult {
    // PASTE extraction loop EXACTLY (lines 710-775)
}
```

**Step 3:** Test in isolation:
```typescript
describe('processTikz', () => {
    it('handles simple diagrams', () => {
        const input = `\\begin{tikzpicture}
\\node (a) {A};
\\node (b) [below of=a] {B};
\\draw[->] (a) -- (b);
\\end{tikzpicture}`;

        const result = processTikz(input);
        expect(result.blocks).toHaveProperty('LATEXPREVIEWTIKZ0');
        expect(result.blocks.LATEXPREVIEWTIKZ0).toContain('<iframe');
    });

    it('preserves newlines', () => {
        const input = `\\begin{tikzpicture}
\\node (a) {A};
\\end{tikzpicture}`;
        const result = processTikz(input);
        // Verify iframe srcdoc contains unflattened code
        expect(result.blocks.LATEXPREVIEWTIKZ0).toContain('\\n');
    });

    it('handles escaped percents', () => {
        const input = `\\begin{tikzpicture}
\\node {100\\% done};
\\end{tikzpicture}`;
        const result = processTikz(input);
        expect(result.blocks.LATEXPREVIEWTIKZ0).toContain('100\\%');
    });
});
```

**Step 4:** Compare with old version:
```typescript
// Compare output HTML character-by-character
const oldHtml = oldCreateTikzBlock(tikzCode, options);
const newHtml = newProcessTikz(fullCode).blocks['LATEXPREVIEWTIKZ0'];
expect(newHtml).toBe(oldHtml);  // Must be IDENTICAL
```

**Step 5:** Commit:
```bash
git commit -m "refactor: Extract processTikz to tikz-engine.ts (no behavior change)"
```

---

**4.2.3. Extract Math, Citations, Tables (Similar Process)**

Repeat the same pattern for each engine:
1. Copy EXACT code
2. Test in isolation
3. Compare outputs
4. Commit separately

---

### Phase 3: Create Orchestrator (processor.ts)

**Step 1:** Create pipeline that calls engines in EXACT old order:
```typescript
// processor.ts
export function processLatex(content: string): ProcessResult {
    const blocks = {};

    // 1. Healer (old line 690)
    let processed = healLatex(content);

    // 2. Metadata (old line 693)
    // ... EXACT old logic

    // 3. Preamble (old line 700)
    // ... EXACT old logic

    // 4. TikZ (old line 710)
    const tikzResult = processTikz(processed);
    processed = tikzResult.cleanedContent;
    Object.assign(blocks, tikzResult.blocks);

    // 5. Math (old line 785)
    // ... EXACT old logic

    // Continue in EXACT old order
}
```

**Step 2:** Test orchestration:
```typescript
describe('processLatex integration', () => {
    it('produces identical output to old sanitizeLatexForBrowser', () => {
        const testLatex = fs.readFileSync('test/fixtures/complex_paper.tex');

        const oldResult = oldSanitize(testLatex);
        const newResult = processLatex(testLatex);

        expect(newResult.html).toBe(oldResult.sanitized);
        expect(newResult.blocks).toEqual(oldResult.blocks);
    });
});
```

---

### Phase 4: Update Component

**Step 1:** Replace old call:
```typescript
// LatexPreview.tsx
// OLD:
const { sanitized, blocks } = sanitizeLatexForBrowser(latexContent);

// NEW:
import { processLatex } from '../lib/latex-unifier/processor';
const { html, blocks } = processLatex(latexContent);
```

**Step 2:** Regression test entire app:
```bash
npm run build
npm run test
# Manual testing of all diagram types
```

---

### Phase 5: Cleanup (Only After Everything Works)

Now and ONLY now can you:
- Remove old `sanitizeLatexForBrowser`
- Remove LatexPreview - Copy (3).tsx backups
- Add improvements in separate PRs

---

## 5. Golden Rules for Safe Refactoring

### Rule #1: Refactor ≠ Rewrite
**DO:**
- Move code to new files
- Rename variables for clarity
- Extract helper functions

**DON'T:**
- Add new features
- "Fix" old code
- Change algorithms

### Rule #2: One Change at a Time
Each commit should:
- Change ONE thing
- Pass ALL tests
- Be revertable independently

### Rule #3: Test at Every Step
- Unit tests for each engine
- Integration tests for processor
- Regression tests for component
- Manual testing of edge cases

### Rule #4: Preserve the "Why"
If old code seems "weird":
- It's probably intentional
- There's a bug it prevents
- Don't remove without understanding

Example: Why no newline flattening in TikZ?
- Because TikZ parser needs structure
- Discovered through painful debugging
- Documented in TIKZ_HANDLING.md

### Rule #5: Keep Backups
```bash
cp LatexPreview.tsx "LatexPreview - Working Backup.tsx"
```
Don't delete until 100% confident.

---

## 6. Lessons Learned

### What Went Right
1. **Modularity Goal:** Separating concerns is good
2. **Documentation:** Each engine has clear responsibility
3. **Naming:** "Healer", "Architect", "Grid" are intuitive

### What Went Wrong
1. **Added logic during move:** sanitizeStr didn't exist
2. **No incremental testing:** Big bang refactor
3. **Changed proven algorithms:** Newline flattening
4. **No output comparison:** Didn't verify HTML matches

### What to Do Next Time
1. **Extract, don't rewrite:** Copy-paste EXACT code first
2. **Test at each step:** Green tests after each commit
3. **Compare outputs:** Old HTML === New HTML
4. **Separate improvements:** Refactor first, improve later

---

## 7. Recovery Plan (Current State)

### Immediate Fix (✅ Done)
```bash
# Remove the destructive sanitizeStr function
git revert <bad-commit-hash>
# OR manually delete lines 38-58 in tikz-engine.ts
```

### Validation
Test these cases:
```latex
% Case 1: Simple nodes
\begin{tikzpicture}
\node (a) {A};
\node (b) [below of=a] {B};
\draw[->] (a) -- (b);
\end{tikzpicture}

% Case 2: Escaped percent
\begin{tikzpicture}
\node {100\% complete};
\end{tikzpicture}

% Case 3: Complex positioning
\begin{tikzpicture}[node distance=3cm]
\node (empathize) [rectangle, draw] {Empathize};
\node (define) [rectangle, draw, below of=empathize] {Define};
\draw[->] (empathize) -- (define);
\end{tikzpicture}
```

All should render without "No shape named" errors.

---

## 8. Future Refactoring Checklist

Before starting:
- [ ] Read this document
- [ ] Create backup of working code
- [ ] Set up regression test suite
- [ ] Plan incremental steps (one engine at a time)

For each engine:
- [ ] Copy EXACT code from old version
- [ ] Write unit tests
- [ ] Compare output with old version
- [ ] Commit separately
- [ ] Verify ALL existing tests still pass

After completion:
- [ ] Keep old code in backup files for 2 weeks
- [ ] Monitor production for edge cases
- [ ] Document any "weird" logic discovered
- [ ] Update TIKZ_HANDLING.md with insights

---

## Conclusion

The refactoring failure teaches us that **working code is more valuable than clean code**.

The old LatexPreview.tsx was "messy" but **proven**. It handled:
- Hundreds of edge cases
- Complex TikZ diagrams
- Multi-line equations
- Nested tables
- Citation grouping

The refactor broke this by:
1. Adding unnecessary transformations
2. Changing proven logic
3. Not testing incrementally

**The Right Way:**
- Extract WITHOUT changes
- Test at EVERY step
- Improve AFTER it works

> "Make it work, make it right, make it fast." — Kent Beck

We tried to make it right before making it work. That was the mistake.

---

**Status:** This document should be used as the blueprint for any future refactoring of LatexPreview or similar complex rendering systems.
