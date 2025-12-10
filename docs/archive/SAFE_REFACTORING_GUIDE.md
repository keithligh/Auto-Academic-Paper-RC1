# Safe Refactoring Guide: Quick Reference

**Purpose:** Step-by-step checklist for safely refactoring LatexPreview or similar complex rendering systems.

**Read First:** [REFACTORING_ANALYSIS.md](./REFACTORING_ANALYSIS.md) for detailed context.

---

## Pre-Flight Checklist

Before touching ANY code:

- [ ] **1.** Read REFACTORING_ANALYSIS.md in full
- [ ] **2.** Understand WHY the old code works (check TIKZ_HANDLING.md, LATEX_PREVIEW_SYSTEM.md)
- [ ] **3.** Create working branch: `git checkout -b refactor/latex-preview-safe`
- [ ] **4.** Backup working code:
```bash
cp client/src/components/LatexPreview.tsx client/src/components/LatexPreview.BACKUP.tsx
git add client/src/components/LatexPreview.BACKUP.tsx
git commit -m "backup: Save working LatexPreview before refactor"
```
- [ ] **5.** Document current behavior:
```bash
npm run test > test_baseline_before_refactor.txt
```
- [ ] **6.** Create test fixtures:
```bash
mkdir -p test/fixtures/refactor-validation
# Add test .tex files with TikZ, tables, math, citations
```

---

## Phase 1: Set Up Testing Infrastructure

### Create Validation Test Suite

```bash
# Create test file
touch client/src/lib/latex-unifier/refactor-validation.test.ts
```

```typescript
// client/src/lib/latex-unifier/refactor-validation.test.ts
import fs from 'fs';
import path from 'path';

// Import old version (will be in BACKUP file)
import { sanitizeLatexForBrowser as oldSanitize } from '../../components/LatexPreview.BACKUP';

// Import new version (will be created incrementally)
import { processLatex as newProcess } from './processor';

const fixturesDir = path.join(__dirname, '../../../test/fixtures/refactor-validation');

describe('Refactor Validation: Old vs New Output', () => {
    const testCases = [
        'simple-tikz.tex',
        'complex-tikz-with-percent.tex',
        'tikz-with-comments.tex',
        'math-equations.tex',
        'tables-with-citations.tex',
        'full-paper.tex'
    ];

    testCases.forEach(fileName => {
        it(`produces identical output for ${fileName}`, () => {
            const latex = fs.readFileSync(path.join(fixturesDir, fileName), 'utf-8');

            const oldResult = oldSanitize(latex);
            const newResult = newProcess(latex);

            // Normalize HTML for comparison (whitespace differences OK)
            const normalize = (html: string) => html.replace(/\s+/g, ' ').trim();

            expect(normalize(newResult.html)).toBe(normalize(oldResult.sanitized));
            expect(Object.keys(newResult.blocks).length).toBe(Object.keys(oldResult.blocks).length);
        });
    });
});
```

**Commit:**
```bash
git add .
git commit -m "test: Add refactor validation test suite"
```

---

## Phase 2: Extract Engines (ONE AT A TIME)

### Step 2.1: Extract Healer

**Why First?** It's the safest - pure pre-processing with no state.

#### 2.1.A: Create healer.ts

```bash
mkdir -p client/src/lib/latex-unifier
touch client/src/lib/latex-unifier/healer.ts
```

```typescript
// healer.ts
/**
 * latex-unifier/healer.ts
 * Pre-processing fixes for LaTeX input
 *
 * EXTRACTION DATE: [TODAY]
 * SOURCE: LatexPreview.BACKUP.tsx lines 690-820
 * CHANGES: None - exact copy
 */

export function healLatex(content: string): string {
    let healed = content;

    // === COPY EXACT CODE FROM OLD FILE ===
    // Lines 690-820 from LatexPreview.BACKUP.tsx

    // Example (fill in from backup):
    healed = healed.replace(/^```latex\s*/i, '').replace(/```$/, '');
    healed = healed.replace(/\\n(?!(ewline|ewpage))/g, '\n');
    healed = healed.replace(/\\section\*?\s*\{\s*(?:References)\s*\}/gi, '');
    // ... etc. EXACT COPY

    return healed;
}
```

#### 2.1.B: Test healer in isolation

```typescript
// healer.test.ts
import { healLatex } from './healer';

describe('healLatex', () => {
    it('strips markdown fences', () => {
        expect(healLatex('```latex\n$x$\n```')).toBe('$x$');
    });

    it('fixes ambiguous newlines', () => {
        expect(healLatex('foo\\nbar')).toBe('foo\nbar');
        expect(healLatex('\\newline')).toBe('\\newline'); // Don't break real commands
    });

    it('removes ghost References headers', () => {
        expect(healLatex('\\section{References}')).toBe('');
    });

    // Add tests for ALL healer cases from old code
});
```

**Run tests:**
```bash
npm test -- healer.test.ts
```

**Expected:** All pass ✅

#### 2.1.C: Integrate into old code

```typescript
// LatexPreview.tsx (still mostly old code)
import { healLatex } from '../lib/latex-unifier/healer';

function sanitizeLatexForBrowser(latex: string) {
    // OLD: let content = latex.replace(/^```latex...
    // NEW:
    let content = healLatex(latex);

    // ... rest of old code unchanged
}
```

#### 2.1.D: Run regression tests

```bash
npm test
```

**Expected:** All pass, zero breakage ✅

#### 2.1.E: Commit

```bash
git add .
git commit -m "refactor: Extract healLatex to healer.ts (no behavior change)

- Extracted pre-processing logic from LatexPreview.tsx
- Added unit tests for healer
- Integrated back into LatexPreview.tsx
- All regression tests pass
- Zero behavior change"
```

---

### Step 2.2: Extract TikZ Engine

**Why Second?** It's the most complex, so we want to isolate it early.

#### 2.2.A: Create tikz-engine.ts

```typescript
// tikz-engine.ts
/**
 * latex-unifier/tikz-engine.ts
 * TikZ diagram extraction and iframe generation
 *
 * EXTRACTION DATE: [TODAY]
 * SOURCE: LatexPreview.BACKUP.tsx lines 164-775
 * CHANGES: None - exact copy
 */

let blockCount = 0;

export interface TikzResult {
    cleanedContent: string;
    blocks: Record<string, string>;
}

// === COPY createTikzBlock EXACTLY ===
// Lines 164-615 from LatexPreview.BACKUP.tsx
function createTikzBlock(tikzCode: string, options: string, blocks: Record<string, string>): string {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;

    // pgfplots rejection
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
        blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - not supported in browser preview</div>`;
        return `\n\n${id}\n\n`;
    }

    // ⚠️ CRITICAL: DO NOT ADD sanitizeStr function
    // ⚠️ CRITICAL: DO NOT flatten newlines
    // ⚠️ CRITICAL: Keep EXACT old logic

    // ASCII enforcement (from old line 172)
    let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, '');

    // Ampersand escaping (from old line 177-178)
    safeTikz = safeTikz.replace(/\\\\&/g, '\\\\ \\&');
    safeTikz = safeTikz.replace(/([^\\])&/g, '$1\\&');

    // === COPY REST OF OLD CODE EXACTLY ===
    // Bezier polyfill (lines 185-243)
    // Intent Engine (lines 245-520)
    // Iframe generation (lines 528-615)

    return `\n\n${id}\n\n`;
}

// === COPY extraction loop EXACTLY ===
// Lines 710-775 from LatexPreview.BACKUP.tsx
export function processTikz(content: string): TikzResult {
    let cleaned = content;
    const blocks: Record<string, string> = {};

    let loopSafety = 0;
    while (cleaned.includes('\\begin{tikzpicture}')) {
        if (loopSafety++ > 100) break;

        // === COPY EXACT OLD LOGIC ===
        // Manual bracket parser for options
        // Node extraction
        // ... (lines 718-775)
    }

    return { cleanedContent: cleaned, blocks };
}
```

#### 2.2.B: Test tikz-engine in isolation

```typescript
// tikz-engine.test.ts
import { processTikz } from './tikz-engine';

describe('processTikz', () => {
    it('extracts simple TikZ diagrams', () => {
        const input = `Text before
\\begin{tikzpicture}
\\node (a) {A};
\\end{tikzpicture}
Text after`;

        const result = processTikz(input);

        expect(result.cleanedContent).toContain('Text before');
        expect(result.cleanedContent).toContain('LATEXPREVIEWTIKZ0');
        expect(result.cleanedContent).toContain('Text after');
        expect(result.blocks['LATEXPREVIEWTIKZ0']).toContain('<iframe');
    });

    it('preserves newlines in TikZ code', () => {
        const input = `\\begin{tikzpicture}
\\node (a) {A};
\\node (b) {B};
\\end{tikzpicture}`;

        const result = processTikz(input);
        const iframeHtml = result.blocks['LATEXPREVIEWTIKZ0'];

        // Verify newlines are NOT flattened
        expect(iframeHtml).toMatch(/\\\\node.*\\\\node/s); // 's' flag = dotall
    });

    it('handles escaped percents in node labels', () => {
        const input = `\\begin{tikzpicture}
\\node {100\\% complete};
\\end{tikzpicture}`;

        const result = processTikz(input);
        const iframeHtml = result.blocks['LATEXPREVIEWTIKZ0'];

        expect(iframeHtml).toContain('100\\%');
    });

    it('handles multi-line node definitions', () => {
        const input = `\\begin{tikzpicture}[node distance=3cm]
\\node (empathize) [rectangle, draw] {Empathize};
\\node (define) [rectangle, draw, below of=empathize] {Define};
\\draw[->] (empathize) -- (define);
\\end{tikzpicture}`;

        const result = processTikz(input);
        const iframeHtml = result.blocks['LATEXPREVIEWTIKZ0'];

        // Verify both nodes are present
        expect(iframeHtml).toContain('empathize');
        expect(iframeHtml).toContain('define');
    });
});
```

**Run tests:**
```bash
npm test -- tikz-engine.test.ts
```

**Expected:** All pass ✅

#### 2.2.C: Compare output with old version

```typescript
// tikz-engine-comparison.test.ts
import { sanitizeLatexForBrowser as oldSanitize } from '../../components/LatexPreview.BACKUP';
import { processTikz } from './tikz-engine';

describe('TikZ Engine: Old vs New Comparison', () => {
    it('produces identical iframe HTML for simple diagram', () => {
        const tikzCode = `\\begin{tikzpicture}
\\node (a) {A};
\\end{tikzpicture}`;

        // Old version
        const oldResult = oldSanitize(tikzCode);
        const oldTikzHtml = Object.values(oldResult.blocks)[0];

        // New version
        const newResult = processTikz(tikzCode);
        const newTikzHtml = Object.values(newResult.blocks)[0];

        // Must be IDENTICAL
        expect(newTikzHtml).toBe(oldTikzHtml);
    });
});
```

**Run test:**
```bash
npm test -- tikz-engine-comparison.test.ts
```

**Expected:** Pass ✅ (HTML must be IDENTICAL)

**If fails:** Your extraction is NOT exact - review and copy again.

#### 2.2.D: Integrate into old code

```typescript
// LatexPreview.tsx
import { processTikz } from '../lib/latex-unifier/tikz-engine';

function sanitizeLatexForBrowser(latex: string) {
    // ... healer, preamble stripping ...

    // OLD: manual TikZ extraction loop (lines 710-775)
    // NEW:
    const tikzResult = processTikz(content);
    content = tikzResult.cleanedContent;
    Object.assign(blocks, tikzResult.blocks);

    // ... rest continues
}
```

#### 2.2.E: Run regression tests

```bash
npm test
```

**Expected:** All pass ✅

#### 2.2.F: Manual testing

```bash
npm run dev
# Test in browser:
# 1. Simple TikZ diagram
# 2. Complex TikZ with absolute positioning
# 3. TikZ with escaped % characters
# 4. TikZ with comments
```

**Expected:** All render correctly ✅

#### 2.2.G: Commit

```bash
git add .
git commit -m "refactor: Extract processTikz to tikz-engine.ts (no behavior change)

- Extracted TikZ processing from LatexPreview.tsx
- Preserved all Intent Engine logic
- Preserved Bezier polyfill
- NO newline flattening
- NO sanitizeStr function
- Added comprehensive unit tests
- Output comparison tests pass
- All regression tests pass
- Manual testing confirms rendering works"
```

---

### Step 2.3: Extract Math Engine

**Follow same pattern:**
1. Create math-engine.ts
2. Copy EXACT createMathBlock logic
3. Test in isolation
4. Compare outputs
5. Integrate
6. Test
7. Commit

---

### Step 2.4: Extract Citation Engine

Repeat pattern...

---

### Step 2.5: Extract Table Engine

Repeat pattern...

---

## Phase 3: Create Processor Orchestrator

### Step 3.1: Create processor.ts

```typescript
// processor.ts
/**
 * latex-unifier/processor.ts
 * Main pipeline orchestrator
 *
 * Calls engines in EXACT order from old code
 */

import { healLatex } from './healer';
import { processTikz } from './tikz-engine';
import { processMath } from './math-engine';
import { processCitations } from './citation-engine';
import { processTables } from './table-engine';

export interface ProcessResult {
    html: string;
    blocks: Record<string, string>;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
}

export function processLatex(content: string): ProcessResult {
    const blocks: Record<string, string> = {};

    // Step 1: Healer (old line 690)
    let processed = healLatex(content);

    // Step 2: Metadata extraction (old line 693)
    // === COPY EXACT OLD LOGIC ===

    // Step 3: Preamble stripping (old line 700)
    // === COPY EXACT OLD LOGIC ===

    // Step 4: TikZ extraction (old line 710)
    const tikzResult = processTikz(processed);
    processed = tikzResult.cleanedContent;
    Object.assign(blocks, tikzResult.blocks);

    // Step 5: Math extraction (old line 785)
    const mathResult = processMath(processed);
    processed = mathResult.cleanedContent;
    Object.assign(blocks, mathResult.blocks);

    // Continue in EXACT old order...

    return {
        html: processed,
        blocks,
        bibliographyHtml: null, // Fill in
        hasBibliography: false  // Fill in
    };
}
```

### Step 3.2: Integration test

```typescript
// processor-integration.test.ts
import { sanitizeLatexForBrowser as oldSanitize } from '../../components/LatexPreview.BACKUP';
import { processLatex } from './processor';

describe('Processor Integration: Complete Pipeline', () => {
    it('produces identical output to old version for full paper', () => {
        const latex = `
\\documentclass{article}
\\begin{document}
\\section{Test}
This is a test with TikZ:
\\begin{tikzpicture}
\\node {Test};
\\end{tikzpicture}
And math: $x = y^2$
\\end{document}
`;

        const oldResult = oldSanitize(latex);
        const newResult = processLatex(latex);

        const normalize = (html: string) => html.replace(/\s+/g, ' ').trim();

        expect(normalize(newResult.html)).toBe(normalize(oldResult.sanitized));
        expect(Object.keys(newResult.blocks).length).toBe(Object.keys(oldResult.blocks).length);
    });
});
```

### Step 3.3: Commit

```bash
git commit -m "refactor: Create processor.ts orchestrator (no behavior change)"
```

---

## Phase 4: Update Component

### Step 4.1: Update LatexPreview.tsx

```typescript
// LatexPreview.tsx
import { processLatex } from '../lib/latex-unifier/processor';

export function LatexPreview({ latexContent }: LatexPreviewProps) {
    // ... React hooks ...

    useEffect(() => {
        if (!containerRef.current || !latexContent) return;

        try {
            // NEW: Use modular pipeline
            const { html, blocks, bibliographyHtml, hasBibliography } = processLatex(latexContent);

            // ... rest of rendering logic unchanged ...

        } catch (err) {
            // ... error handling unchanged ...
        }
    }, [latexContent]);

    // ... return JSX unchanged ...
}
```

### Step 4.2: Run ALL tests

```bash
npm test
```

**Expected:** All pass ✅

### Step 4.3: Manual testing

Test EVERY diagram type:
- [ ] Simple TikZ (2-3 nodes)
- [ ] Complex TikZ (8+ nodes)
- [ ] TikZ with absolute positioning
- [ ] TikZ with escaped %
- [ ] TikZ with comments
- [ ] Math equations (inline and display)
- [ ] Tables
- [ ] Citations
- [ ] Full academic paper

**Expected:** Everything renders correctly ✅

### Step 4.4: Commit

```bash
git commit -m "refactor: Update LatexPreview.tsx to use modular processor

- Replaced sanitizeLatexForBrowser with processLatex
- No behavior change
- All tests pass
- Manual testing confirms all diagrams render"
```

---

## Phase 5: Cleanup

### Step 5.1: Remove old code

**Only AFTER everything works for 1 week in production:**

```bash
# Remove backup files
rm client/src/components/LatexPreview.BACKUP.tsx
rm client/src/components/LatexPreview - Copy (3).tsx
rm client/src/components/LatexPreview - Copy (2).tsx
rm client/src/components/LatexPreview - Copy.tsx

git add .
git commit -m "cleanup: Remove old LatexPreview backup files

Modular refactor has been stable in production for 1 week.
Safe to remove backup files."
```

### Step 5.2: Document

Update documentation:
- [ ] LATEX_PREVIEW_SYSTEM.md - Add section on modular architecture
- [ ] ARCHITECTURE.md - Document new engine structure
- [ ] README.md - Update with new file locations

---

## Rollback Plan

If ANYTHING breaks at ANY step:

```bash
# Immediate rollback
git reset --hard HEAD~1

# Or revert specific commit
git revert <bad-commit-hash>

# Restore from backup
cp client/src/components/LatexPreview.BACKUP.tsx client/src/components/LatexPreview.tsx
```

**Rule:** If a step breaks tests or rendering, **STOP**. Don't continue to next step. Fix or revert.

---

## Red Flags (STOP Immediately)

If you see any of these, **STOP and review**:

1. ❌ "Let me improve this while I'm here"
2. ❌ "The old code is missing X, I'll add it"
3. ❌ "I'll clean this up as I move it"
4. ❌ Tests fail after integration
5. ❌ Manual testing shows rendering differences
6. ❌ "I'll fix both engines in one commit"
7. ❌ "The old code seems wrong, I'll change it"

**If you catch yourself thinking these thoughts:**
- Revert your changes
- Re-read REFACTORING_ANALYSIS.md
- Start over with EXACT copy

---

## Success Criteria

Refactor is complete when:

- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All regression tests pass
- ✅ Manual testing shows identical rendering
- ✅ Old code removed (after 1 week stability)
- ✅ Documentation updated
- ✅ Team reviewed and approved
- ✅ Production stable for 1 week

**Then and only then:** Consider improvements in separate PRs.

---

## Emergency Contacts

If you get stuck:
1. Read [REFACTORING_ANALYSIS.md](./REFACTORING_ANALYSIS.md)
2. Check [TIKZ_HANDLING.md](./TIKZ_HANDLING.md) for TikZ-specific issues
3. Review git history: `git log --oneline -- LatexPreview.tsx`
4. Compare with backup: `git diff LatexPreview.BACKUP.tsx`

---

**Remember:** The goal is NOT clean code. The goal is WORKING code that's also clean.

Working > Clean > Fast

Get it working first. Keep it working. Then make it clean.
