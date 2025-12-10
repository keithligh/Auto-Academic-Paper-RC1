# Start Over: Clean Refactoring From Scratch

**Status:** Abandoning current broken modular system. Starting fresh from working monolithic version.

**Decision:** The current modular implementation is beyond repair. We're rolling back to the proven working code and redoing the refactor properly using the safe process.

---

## Step 1: Rollback to Working Version

### 1.1: Backup Current Broken State (For Reference Only)

```bash
# Create a "broken attempt" branch to preserve what we learned
git checkout -b archive/broken-modular-attempt
git add -A
git commit -m "archive: Broken modular refactor attempt (for reference only)

This branch preserves the broken modular system for reference.
Issues found:
- sanitizeStr function broke TikZ structure
- Newline flattening destroyed node references
- Multiple engines have discrepancies from working version

ABANDONED: Starting fresh from working monolithic version.
See REFACTOR_START_OVER.md for new plan.
"

git push origin archive/broken-modular-attempt
```

### 1.2: Return to Main Branch and Clean Slate

```bash
# Go back to main branch
git checkout main

# Or create fresh refactor branch
git checkout -b refactor/latex-preview-v2-clean-start
```

### 1.3: Restore Working Monolithic Version

```bash
# Copy the WORKING backup to main file
cp "client/src/components/LatexPreview - Copy (3).tsx" client/src/components/LatexPreview.tsx

# Remove the broken modular system completely
rm -rf client/src/lib/latex-unifier

# Verify it works
git add .
git commit -m "revert: Restore working monolithic LatexPreview.tsx

Rolled back to proven working v4 monolithic version.
Starting refactoring process over from scratch using safe methodology.

Source: LatexPreview - Copy (3).tsx (1,586 lines)
Status: Known working, battle-tested

Next: Follow SAFE_REFACTORING_GUIDE.md Phase 1
"
```

### 1.4: Test That Old Version Works

```bash
# Build and run
npm run dev

# Manual test checklist:
# [ ] Simple TikZ renders
# [ ] Complex TikZ with multiple nodes renders
# [ ] TikZ with escaped % renders
# [ ] Math equations render
# [ ] Tables render
# [ ] Citations render
```

**Expected:** Everything works perfectly ✅

---

## Step 2: Set Up Proper Refactoring Infrastructure

Now we follow **SAFE_REFACTORING_GUIDE.md** exactly.

### 2.1: Create Clean Refactor Branch

```bash
git checkout -b refactor/latex-preview-safe-extraction
```

### 2.2: Create Test Fixtures Directory

```bash
mkdir -p test/fixtures/refactor-validation
```

### 2.3: Create Test Fixtures

**File 1: Simple TikZ**
```bash
cat > test/fixtures/refactor-validation/simple-tikz.tex << 'EOF'
\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows,shapes}
\begin{document}

\section{Simple Test}

\begin{tikzpicture}
\node (a) {A};
\node (b) [below of=a] {B};
\draw[->] (a) -- (b);
\end{tikzpicture}

\end{document}
EOF
```

**File 2: TikZ with Escaped Percent**
```bash
cat > test/fixtures/refactor-validation/tikz-with-percent.tex << 'EOF'
\documentclass{article}
\usepackage{tikz}
\begin{document}

\begin{tikzpicture}
\node (progress) {100\% complete};
\node (status) [below of=progress] {Success: 95\%};
\draw[->] (progress) -- (status);
\end{tikzpicture}

\end{document}
EOF
```

**File 3: Complex Multi-Node Diagram**
```bash
cat > test/fixtures/refactor-validation/complex-tikz.tex << 'EOF'
\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows,shapes}
\begin{document}

\begin{tikzpicture}[node distance=3cm, auto]
\node (empathize) [rectangle, draw] {Empathize};
\node (define) [rectangle, draw, below of=empathize] {Define};
\node (ideate) [rectangle, draw, below of=define] {Ideate};
\node (prototype) [rectangle, draw, below of=ideate] {Prototype};
\node (test) [rectangle, draw, below of=prototype] {Test};

\draw[->] (empathize) -- (define);
\draw[->] (define) -- (ideate);
\draw[->] (ideate) -- (prototype);
\draw[->] (prototype) -- (test);
\draw[->] (test) edge[bend right=60] (empathize);
\end{tikzpicture}

\end{document}
EOF
```

**File 4: Math and Tables**
```bash
cat > test/fixtures/refactor-validation/math-tables.tex << 'EOF'
\documentclass{article}
\usepackage{amsmath}
\begin{document}

\section{Math Test}

Inline math: $x = y^2$

Display math:
\[
E = mc^2
\]

Multi-line:
\begin{align}
x &= y + z \\
a &= b + c
\end{align}

\section{Table Test}

\begin{table}
\begin{tabular}{|l|c|r|}
\hline
Left & Center & Right \\
\hline
A & B & C \\
Built-in \& Comprehensive & D & E \\
\hline
\end{tabular}
\caption{Test Table}
\end{table}

\end{document}
EOF
```

**File 5: Citations**
```bash
cat > test/fixtures/refactor-validation/citations.tex << 'EOF'
\documentclass{article}
\begin{document}

\section{Test}

Single citation (ref_1).

Multiple citations (ref_1, ref_2, ref_3).

Non-consecutive (ref_1, ref_3, ref_5).

\begin{thebibliography}{9}
\bibitem{ref_1} First reference
\bibitem{ref_2} Second reference
\bibitem{ref_3} Third reference
\bibitem{ref_5} Fifth reference
\end{thebibliography}

\end{document}
EOF
```

### 2.4: Commit Fixtures

```bash
git add test/fixtures/refactor-validation
git commit -m "test: Add refactoring validation fixtures

Created test .tex files covering all major features:
- Simple TikZ diagrams
- TikZ with escaped percent characters
- Complex multi-node diagrams
- Math equations (inline, display, multi-line)
- Tables with escaped ampersands
- Citations (single, multiple, ranges)

These fixtures will be used to validate each refactoring step.
"
```

---

## Step 3: Extract Old Function for Testing

### 3.1: Create Test Helper

```bash
mkdir -p client/src/lib/test-helpers
touch client/src/lib/test-helpers/old-sanitize.ts
```

### 3.2: Extract Function

```typescript
// client/src/lib/test-helpers/old-sanitize.ts
/**
 * TEMPORARY: Old sanitizeLatexForBrowser for testing
 *
 * This is extracted from the working LatexPreview.tsx to use as baseline
 * for comparison during refactoring.
 *
 * SOURCE: LatexPreview.tsx (restored from backup)
 * LINES: Approximately 35-1300
 *
 * DO NOT MODIFY. This is the baseline truth.
 * Will be deleted after refactoring is complete and validated.
 */

import katex from 'katex';

export interface OldSanitizeResult {
    sanitized: string;
    blocks: Record<string, string>;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
}

export function oldSanitizeLatexForBrowser(latex: string): OldSanitizeResult {
    // TODO: Copy ENTIRE sanitizeLatexForBrowser function from LatexPreview.tsx
    // Lines ~35-1300

    // For now, placeholder
    throw new Error('TODO: Copy the full function from LatexPreview.tsx');
}
```

**Manual action needed:**
1. Open `client/src/components/LatexPreview.tsx`
2. Find the `sanitizeLatexForBrowser` function (starts around line 35)
3. Copy the ENTIRE function (about 1,265 lines)
4. Paste into `old-sanitize.ts` replacing the placeholder
5. Fix any import issues

### 3.3: Commit Helper

```bash
git add client/src/lib/test-helpers/old-sanitize.ts
git commit -m "test: Extract old sanitizeLatexForBrowser for baseline comparison

Extracted the working sanitizeLatexForBrowser function to use as
baseline for testing during refactoring.

This function is the TRUTH. All refactored engines will be compared
against this to ensure identical behavior.

Will be deleted after refactoring is complete.
"
```

---

## Step 4: Create Validation Test Infrastructure

### 4.1: Create Test File

```bash
mkdir -p client/src/lib/__tests__
touch client/src/lib/__tests__/refactor-baseline.test.ts
```

### 4.2: Baseline Test Suite

```typescript
// client/src/lib/__tests__/refactor-baseline.test.ts
import fs from 'fs';
import path from 'path';
import { oldSanitizeLatexForBrowser } from '../test-helpers/old-sanitize';

describe('Refactoring Baseline Tests', () => {
    const fixturesDir = path.join(__dirname, '../../../test/fixtures/refactor-validation');

    function normalize(html: string): string {
        return html.replace(/\s+/g, ' ').trim();
    }

    describe('Old Version Baseline (Verify It Works)', () => {
        it('processes simple TikZ', () => {
            const latex = fs.readFileSync(path.join(fixturesDir, 'simple-tikz.tex'), 'utf-8');
            const result = oldSanitizeLatexForBrowser(latex);

            expect(result.blocks).toBeDefined();
            expect(Object.keys(result.blocks).length).toBeGreaterThan(0);

            // Should have TikZ block
            const tikzBlocks = Object.keys(result.blocks).filter(k => k.includes('TIKZ'));
            expect(tikzBlocks.length).toBe(1);
        });

        it('processes TikZ with escaped percent', () => {
            const latex = fs.readFileSync(path.join(fixturesDir, 'tikz-with-percent.tex'), 'utf-8');
            const result = oldSanitizeLatexForBrowser(latex);

            const tikzBlock = Object.values(result.blocks).find((b: any) =>
                typeof b === 'string' && b.includes('tikzpicture')
            ) as string;

            expect(tikzBlock).toBeDefined();
            expect(tikzBlock).toContain('100');
            expect(tikzBlock).toContain('95');
        });

        it('processes complex multi-node diagram', () => {
            const latex = fs.readFileSync(path.join(fixturesDir, 'complex-tikz.tex'), 'utf-8');
            const result = oldSanitizeLatexForBrowser(latex);

            const tikzBlock = Object.values(result.blocks).find((b: any) =>
                typeof b === 'string' && b.includes('tikzpicture')
            ) as string;

            expect(tikzBlock).toContain('empathize');
            expect(tikzBlock).toContain('define');
            expect(tikzBlock).toContain('ideate');
            expect(tikzBlock).toContain('prototype');
            expect(tikzBlock).toContain('test');
        });

        it('processes math equations', () => {
            const latex = fs.readFileSync(path.join(fixturesDir, 'math-tables.tex'), 'utf-8');
            const result = oldSanitizeLatexForBrowser(latex);

            const mathBlocks = Object.keys(result.blocks).filter(k => k.includes('MATH'));
            expect(mathBlocks.length).toBeGreaterThan(0);
        });

        it('processes tables', () => {
            const latex = fs.readFileSync(path.join(fixturesDir, 'math-tables.tex'), 'utf-8');
            const result = oldSanitizeLatexForBrowser(latex);

            const tableBlocks = Object.keys(result.blocks).filter(k => k.includes('TABLE'));
            expect(tableBlocks.length).toBeGreaterThan(0);
        });

        it('processes citations', () => {
            const latex = fs.readFileSync(path.join(fixturesDir, 'citations.tex'), 'utf-8');
            const result = oldSanitizeLatexForBrowser(latex);

            expect(result.hasBibliography).toBe(true);
            expect(result.bibliographyHtml).toBeTruthy();
        });
    });
});
```

### 4.3: Run Baseline Tests

```bash
npm test -- refactor-baseline.test.ts
```

**Expected:** All tests pass ✅ (verifies old version works)

### 4.4: Commit Test Infrastructure

```bash
git add .
git commit -m "test: Add baseline validation test suite

Created comprehensive test suite that validates the working
old version processes all fixture types correctly.

This establishes the baseline. As we extract engines, we'll add
comparison tests to ensure new version produces identical output.

All baseline tests pass ✅
"
```

---

## Step 5: Phase 1 - Extract Healer (First Engine)

Now we follow the safe process: Extract ONE engine at a time.

### 5.1: Create healer.ts

```bash
mkdir -p client/src/lib/latex-unifier
touch client/src/lib/latex-unifier/healer.ts
```

### 5.2: Extract Healer Code

**Open LatexPreview.tsx and find the healing logic:**

It's in the `sanitizeLatexForBrowser` function, approximately lines 690-820.

Look for:
- Markdown fence stripping: `content.replace(/^```latex/...)`
- Newline fixes: `content.replace(/\\n(?!ewline)/...)`
- Ghost header removal: `content.replace(/\\section\*?\s*\{References\}/...)`
- Math fragment healing
- Etc.

**Copy EXACT code to healer.ts:**

```typescript
// client/src/lib/latex-unifier/healer.ts
/**
 * latex-unifier/healer.ts
 * Pre-processing fixes for LaTeX input
 *
 * EXTRACTED FROM: LatexPreview.tsx lines 690-820 (approx)
 * DATE: 2025-12-10
 * CHANGES: None - exact copy
 */

export function healLatex(content: string): string {
    let healed = content;

    // === COPY EXACT CODE FROM LatexPreview.tsx ===
    // Lines 690-820

    // Example (fill in with actual code):
    healed = healed.replace(/^```latex\s*/i, '').replace(/```$/, '');
    healed = healed.replace(/\\n(?!(ewline|ewpage|oindent))/g, '\n');
    healed = healed.replace(/\\section\*?\s*\{\s*(?:References|Bibliography)\s*\}/gi, '');

    // ... COPY ALL THE REST EXACTLY ...

    return healed;
}
```

**Manual action:** Copy the exact healing logic from LatexPreview.tsx

### 5.3: Create Healer Tests

```bash
touch client/src/lib/latex-unifier/__tests__/healer.test.ts
```

```typescript
// client/src/lib/latex-unifier/__tests__/healer.test.ts
import { healLatex } from '../healer';

describe('healLatex', () => {
    it('strips markdown fences', () => {
        const input = '```latex\n$x = y$\n```';
        const output = healLatex(input);
        expect(output).toBe('$x = y$');
    });

    it('fixes ambiguous newlines', () => {
        const input = 'foo\\nbar';
        const output = healLatex(input);
        expect(output).toBe('foo\nbar');
    });

    it('does not break real newline commands', () => {
        const input = 'foo\\newline bar';
        const output = healLatex(input);
        expect(output).toBe('foo\\newline bar');
    });

    it('removes ghost References headers', () => {
        const input = '\\section{References}\\nActual content';
        const output = healLatex(input);
        expect(output).not.toContain('\\section{References}');
    });

    // Add tests for ALL healer functions
});
```

### 5.4: Integrate Healer Back Into LatexPreview.tsx

```typescript
// client/src/components/LatexPreview.tsx

import { healLatex } from '../lib/latex-unifier/healer';

function sanitizeLatexForBrowser(latex: string): SanitizeResult {
    // OLD: let content = latex.replace(/^```latex...
    // NEW:
    let content = healLatex(latex);

    // ... rest of function unchanged ...
}
```

### 5.5: Test Integration

```bash
npm test -- refactor-baseline.test.ts
```

**Expected:** All baseline tests still pass ✅

### 5.6: Manual Browser Test

```bash
npm run dev
# Test all fixture files manually
```

**Expected:** Everything still renders correctly ✅

### 5.7: Commit Healer

```bash
git add .
git commit -m "refactor: Extract healLatex to healer.ts (Phase 1/6)

EXTRACTION:
- Moved pre-processing logic from LatexPreview.tsx to healer.ts
- No behavior changes
- Exact copy of working code

TESTING:
- Unit tests added for all healer functions
- All baseline tests pass
- Manual testing confirms rendering works

INTEGRATION:
- LatexPreview.tsx now calls healLatex()
- Rest of sanitizeLatexForBrowser unchanged

STATUS: 1 of 6 engines extracted ✅
NEXT: Extract TikZ engine
"
```

---

## Step 6: Continue With Other Engines

Follow same process for each engine:

1. **TikZ Engine** (CRITICAL - most complex)
2. **Math Engine**
3. **Citation Engine**
4. **Table Engine**
5. **Create Processor** (orchestrator)
6. **Update Component**

**Each step:**
- Extract EXACT code
- Write tests
- Compare output with old version
- Integrate
- Test
- Commit

**NEVER:**
- "Improve" while extracting
- Change logic
- Add new features
- Skip tests

---

## Success Metrics

After each extraction:
- ✅ All baseline tests pass
- ✅ Manual browser testing shows identical rendering
- ✅ No new bugs introduced
- ✅ Code is committed

After all extractions:
- ✅ All engines extracted
- ✅ Processor orchestrator created
- ✅ Component updated
- ✅ Old monolith can be archived
- ✅ Documentation updated

---

## Quick Reference: Safe Extraction Steps

```
For each engine:

1. Create engine file
2. Copy EXACT code from LatexPreview.tsx
3. Write unit tests
4. Run tests → Must pass
5. Integrate back into LatexPreview.tsx
6. Run baseline tests → Must still pass
7. Manual browser test → Must render correctly
8. Commit with descriptive message
9. Move to next engine

REPEAT until all 5 engines extracted.
```

---

## Timeline

- **Healer:** 1-2 hours
- **TikZ:** 4-6 hours (most complex)
- **Math:** 2-3 hours
- **Citations:** 2-3 hours
- **Tables:** 3-4 hours
- **Processor:** 2-3 hours
- **Integration:** 1-2 hours

**Total:** 15-23 hours (2-3 full work days)

---

## Ready to Start?

1. **Execute Step 1:** Rollback and clean slate
2. **Execute Step 2-4:** Set up infrastructure
3. **Execute Step 5:** Extract healer (first engine)
4. **Continue:** Extract remaining engines one by one

Follow the process. Trust the process. Test at every step.

**Start now:** Run the Step 1.1 commands to create the archive branch.
