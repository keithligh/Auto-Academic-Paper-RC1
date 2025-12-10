# LatexPreview Refactoring: Redo Execution Plan

**Date:** 2025-12-10
**Purpose:** Step-by-step plan to properly complete the refactoring from current state
**Current Status:** Modular system exists but has bugs. TikZ rendering partially fixed but needs validation.

---

## Current State Assessment

### What We Have Now

```
✅ client/src/lib/latex-unifier/
   ✅ healer.ts (92 lines) - Looks good
   ⚠️ tikz-engine.ts (379 lines) - Just fixed, needs validation
   ❓ table-engine.ts (333 lines) - Needs validation
   ❓ citation-engine.ts (157 lines) - Needs validation
   ❓ processor.ts (368 lines) - Needs validation

✅ client/src/components/
   ✅ LatexPreview.tsx (126 lines) - Uses new pipeline
   ✅ LatexPreview - Copy (3).tsx (1,586 lines) - Working backup
```

### What We Need to Do

**Option A: Fix-in-Place** (Recommended - Less risky)
- Validate each engine against working backup
- Fix discrepancies one by one
- Keep modular structure

**Option B: Rollback and Redo** (Nuclear option)
- Revert to monolith
- Re-extract using safe process
- More work but guaranteed correct

**Recommendation:** **Option A** - We've already done the hard work of splitting. Let's validate and fix.

---

## Execution Plan: Fix-in-Place (Option A)

### Phase 1: Setup Validation Framework (1-2 hours)

#### 1.1: Create Test Fixtures

```bash
mkdir -p test/fixtures/refactor-validation
```

**Create test files:**

```bash
# test/fixtures/refactor-validation/simple-tikz.tex
cat > test/fixtures/refactor-validation/simple-tikz.tex << 'EOF'
\documentclass{article}
\begin{document}
\begin{tikzpicture}
\node (a) {A};
\node (b) [below of=a] {B};
\draw[->] (a) -- (b);
\end{tikzpicture}
\end{document}
EOF

# test/fixtures/refactor-validation/tikz-with-percent.tex
cat > test/fixtures/refactor-validation/tikz-with-percent.tex << 'EOF'
\documentclass{article}
\begin{document}
\begin{tikzpicture}
\node (progress) {100\% complete};
\node (status) [below of=progress] {Success: 95\%};
\draw[->] (progress) -- (status);
\end{tikzpicture}
\end{document}
EOF

# test/fixtures/refactor-validation/complex-diagram.tex
cat > test/fixtures/refactor-validation/complex-diagram.tex << 'EOF'
\documentclass{article}
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

# test/fixtures/refactor-validation/math-and-tables.tex
cat > test/fixtures/refactor-validation/math-and-tables.tex << 'EOF'
\documentclass{article}
\begin{document}
\section{Test}

Inline math: $x = y^2$

Display math:
\[
E = mc^2
\]

Table:
\begin{table}
\begin{tabular}{|l|c|r|}
\hline
Left & Center & Right \\
\hline
A & B & C \\
\hline
\end{tabular}
\end{table}

Citations: (ref_1) and (ref_2, ref_3)

\begin{thebibliography}{9}
\bibitem{ref_1} First reference
\bibitem{ref_2} Second reference
\bibitem{ref_3} Third reference
\end{thebibliography}
\end{document}
EOF
```

#### 1.2: Create Comparison Script

```bash
touch test/compare-old-new.ts
```

```typescript
// test/compare-old-new.ts
import fs from 'fs';
import path from 'path';

// Import OLD working version
// We need to temporarily expose the old function
import { LatexPreview as OldComponent } from '../client/src/components/LatexPreview - Copy (3)';

// Import NEW modular version
import { processLatex as newProcess } from '../client/src/lib/latex-unifier/processor';

/**
 * Extract the old sanitizeLatexForBrowser function
 * Since it's not exported, we'll need to copy it to a test helper
 */
// For now, we'll create a wrapper

const fixturesDir = path.join(__dirname, 'fixtures/refactor-validation');

function compareOutputs(testFile: string) {
    const latex = fs.readFileSync(path.join(fixturesDir, testFile), 'utf-8');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testFile}`);
    console.log('='.repeat(60));

    // TODO: Call old version
    // const oldResult = oldSanitize(latex);

    // Call new version
    const newResult = newProcess(latex);

    console.log('NEW OUTPUT:');
    console.log('- HTML length:', newResult.html.length);
    console.log('- Blocks count:', Object.keys(newResult.blocks).length);
    console.log('- Block types:', Object.keys(newResult.blocks).map(k => k.match(/LATEXPREVIEW([A-Z]+)/)?.[1]).filter(Boolean));

    // Visual inspection for now
    if (testFile.includes('tikz')) {
        console.log('\nTikZ iframes generated:', Object.keys(newResult.blocks).filter(k => k.includes('TIKZ')).length);
        Object.keys(newResult.blocks).forEach(key => {
            if (key.includes('TIKZ')) {
                const hasIframe = newResult.blocks[key].includes('<iframe');
                const hasSrcdoc = newResult.blocks[key].includes('srcdoc=');
                console.log(`  ${key}: iframe=${hasIframe}, srcdoc=${hasSrcdoc}`);
            }
        });
    }
}

// Run tests
const testFiles = fs.readdirSync(fixturesDir);
testFiles.forEach(file => {
    if (file.endsWith('.tex')) {
        compareOutputs(file);
    }
});
```

#### 1.3: Create Old Function Extractor

Since the old `sanitizeLatexForBrowser` isn't exported, we need to extract it:

```bash
touch client/src/lib/old-sanitize.ts
```

```typescript
// client/src/lib/old-sanitize.ts
/**
 * TEMPORARY: Extracted from LatexPreview - Copy (3).tsx for testing
 * This file will be deleted after validation is complete
 */

import katex from 'katex';

export interface OldSanitizeResult {
    sanitized: string;
    blocks: Record<string, string>;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
}

export function oldSanitizeLatexForBrowser(latex: string): OldSanitizeResult {
    // COPY EXACT CODE from LatexPreview - Copy (3).tsx
    // Lines 35-1300 (the entire sanitizeLatexForBrowser function)

    // This is TEMPORARY for testing only
    // Will be deleted after validation

    // [Copy the full function here]
    throw new Error('TODO: Copy function from backup file');
}
```

**Action:** Manually copy the `sanitizeLatexForBrowser` function from `LatexPreview - Copy (3).tsx` lines 35-1300 into this file.

#### 1.4: Create Validation Test Suite

```bash
touch client/src/lib/latex-unifier/__tests__/validation.test.ts
```

```typescript
// client/src/lib/latex-unifier/__tests__/validation.test.ts
import fs from 'fs';
import path from 'path';
import { oldSanitizeLatexForBrowser } from '../../old-sanitize';
import { processLatex } from '../processor';

describe('Refactoring Validation: Old vs New', () => {
    const fixturesDir = path.join(__dirname, '../../../../test/fixtures/refactor-validation');

    const normalize = (html: string) => {
        // Normalize whitespace for comparison
        return html.replace(/\s+/g, ' ').trim();
    };

    const testCases = [
        { file: 'simple-tikz.tex', description: 'Simple TikZ diagram' },
        { file: 'tikz-with-percent.tex', description: 'TikZ with escaped %' },
        { file: 'complex-diagram.tex', description: 'Complex multi-node diagram' },
        { file: 'math-and-tables.tex', description: 'Math, tables, citations' },
    ];

    testCases.forEach(({ file, description }) => {
        describe(description, () => {
            let latex: string;
            let oldResult: any;
            let newResult: any;

            beforeAll(() => {
                latex = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
                oldResult = oldSanitizeLatexForBrowser(latex);
                newResult = processLatex(latex);
            });

            it('produces same number of blocks', () => {
                expect(Object.keys(newResult.blocks).length).toBe(Object.keys(oldResult.blocks).length);
            });

            it('produces same block types', () => {
                const oldTypes = Object.keys(oldResult.blocks).map(k => k.replace(/\d+$/, '')).sort();
                const newTypes = Object.keys(newResult.blocks).map(k => k.replace(/\d+$/, '')).sort();
                expect(newTypes).toEqual(oldTypes);
            });

            it('produces equivalent HTML structure', () => {
                // Not exact match (order might differ), but structure should be similar
                const oldNorm = normalize(oldResult.sanitized);
                const newNorm = normalize(newResult.html);

                // Length should be within 10%
                const lengthDiff = Math.abs(oldNorm.length - newNorm.length) / oldNorm.length;
                expect(lengthDiff).toBeLessThan(0.1);
            });

            if (file.includes('tikz')) {
                it('generates TikZ iframes correctly', () => {
                    const oldTikzBlocks = Object.keys(oldResult.blocks).filter(k => k.includes('TIKZ'));
                    const newTikzBlocks = Object.keys(newResult.blocks).filter(k => k.includes('TIKZ'));

                    expect(newTikzBlocks.length).toBe(oldTikzBlocks.length);

                    newTikzBlocks.forEach(key => {
                        expect(newResult.blocks[key]).toContain('<iframe');
                        expect(newResult.blocks[key]).toContain('srcdoc=');
                        expect(newResult.blocks[key]).toContain('tikzpicture');
                    });
                });

                it('preserves newlines in TikZ code', () => {
                    const tikzBlock = Object.values(newResult.blocks).find((b: any) =>
                        typeof b === 'string' && b.includes('tikzpicture')
                    );

                    // Decode srcdoc to check actual content
                    const srcdocMatch = (tikzBlock as string).match(/srcdoc="([^"]+)"/);
                    expect(srcdocMatch).toBeTruthy();

                    const decoded = srcdocMatch![1]
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&');

                    // Should contain multiple \node commands (not all on one line)
                    const nodeMatches = decoded.match(/\\node/g);
                    if (nodeMatches && nodeMatches.length > 1) {
                        // If there are multiple nodes, they shouldn't all be on same line
                        // (This is indirect - checking that structure is preserved)
                        expect(decoded).toMatch(/\\node.*\\node/s);
                    }
                });
            }
        });
    });
});
```

---

### Phase 2: Validate Each Engine (4-6 hours)

#### 2.1: Validate Healer

```bash
cd client && npm test -- healer.test.ts
```

**If passes:** ✅ Healer is good

**If fails:**
1. Compare `healer.ts` with old code (LatexPreview - Copy (3).tsx lines 690-820)
2. Find discrepancies
3. Fix to match old code EXACTLY
4. Re-test

#### 2.2: Validate TikZ Engine (Current Priority)

**Run validation:**
```bash
npm test -- validation.test.ts
```

**Expected issues to check:**

1. **Newline preservation:**
   - Old code: Preserves newlines ✅
   - New code: Should preserve after our fix ✅
   - **Test:** Multi-line TikZ should work

2. **Escaped percent handling:**
   - Old code: No special handling (works because no comment stripping)
   - New code: Should work (we removed sanitizeStr)
   - **Test:** `100\%` in node labels should render

3. **Intent Engine logic:**
   - Old code: Lines 245-520 in createTikzBlock
   - New code: Lines 111-262 in tikz-engine.ts
   - **Action:** Line-by-line comparison needed

**Detailed comparison checklist:**

```bash
# Create comparison script
cat > scripts/compare-tikz-logic.sh << 'EOF'
#!/bin/bash
echo "Comparing TikZ Intent Engine logic..."

# Extract Intent Engine from old file
sed -n '245,520p' "client/src/components/LatexPreview - Copy (3).tsx" > /tmp/old-intent.txt

# Extract Intent Engine from new file
sed -n '111,262p' "client/src/lib/latex-unifier/tikz-engine.ts" > /tmp/new-intent.txt

echo "Old Intent Engine (275 lines):"
wc -l /tmp/old-intent.txt

echo "New Intent Engine (151 lines):"
wc -l /tmp/new-intent.txt

echo "Running diff..."
diff -u /tmp/old-intent.txt /tmp/new-intent.txt || echo "DIFFERENCES FOUND!"
EOF

chmod +x scripts/compare-tikz-logic.sh
./scripts/compare-tikz-logic.sh
```

**If differences found:**
1. Review each difference
2. Determine if intentional or bug
3. Fix bugs to match old behavior
4. Document intentional improvements separately

#### 2.3: Validate Math Engine

**The math engine logic is in processor.ts (lines 86-132)**

**Compare with old code:**
- Old location: LatexPreview - Copy (3).tsx lines 113-161 (createMathBlock)
- Old math extraction: Lines 785-825

**Checklist:**
- [ ] KaTeX options match (displayMode, throwOnError, macros)
- [ ] Autoscale heuristic matches (lines 127-153 old vs 97-118 new)
- [ ] Math extraction order matches:
  - [ ] Structured environments first (equation, align, gather)
  - [ ] Display math `\[...\]`
  - [ ] Inline math `\(...\)`
  - [ ] Dollar signs `$$...$$` and `$...$`

**Create test:**
```typescript
// __tests__/math-validation.test.ts
describe('Math Processing Validation', () => {
    it('handles long single-line equations with autoscale', () => {
        const latex = `\\[ x = \\alpha + \\beta + \\gamma + \\delta + \\epsilon + \\zeta + \\eta + \\theta + \\iota + \\kappa + \\lambda + \\mu + \\nu + \\xi + \\pi \\]`;

        const result = processLatex(latex);
        const mathBlock = Object.values(result.blocks).find((b: any) =>
            typeof b === 'string' && b.includes('katex')
        );

        // Should apply autoscale transform
        expect(mathBlock).toContain('transform: scale(');
    });

    it('does NOT autoscale multi-line equations', () => {
        const latex = `\\begin{align}
x &= y \\\\
z &= w
\\end{align}`;

        const result = processLatex(latex);
        const mathBlock = Object.values(result.blocks).find((b: any) =>
            typeof b === 'string' && b.includes('katex')
        );

        // Should NOT apply autoscale to multi-line
        expect(mathBlock).not.toContain('katex-autoscale');
    });
});
```

#### 2.4: Validate Citation Engine

**Compare:**
- Old: Lines 1315-1450 in LatexPreview - Copy (3).tsx
- New: citation-engine.ts (157 lines)

**Key logic to verify:**
- [ ] IEEE grouping: `[1], [2], [3]` → `[1]–[3]`
- [ ] Citation map building
- [ ] Bibliography parsing with `\bibitem`
- [ ] Reference numbering

**Create test:**
```typescript
// __tests__/citation-validation.test.ts
describe('Citation Processing Validation', () => {
    it('formats consecutive citations as ranges', () => {
        const latex = `Text (ref_1, ref_2, ref_3) more text`;
        const result = processLatex(latex);

        // Should produce [1]–[3]
        expect(result.html).toContain('[1]–[3]');
    });

    it('handles non-consecutive citations', () => {
        const latex = `Text (ref_1, ref_3, ref_5) more text`;
        const result = processLatex(latex);

        // Should produce [1], [3], [5]
        expect(result.html).toMatch(/\[1\],\s*\[3\],\s*\[5\]/);
    });
});
```

#### 2.5: Validate Table Engine

**Compare:**
- Old: Lines 850-1100 (approximately)
- New: table-engine.ts (333 lines)

**Key logic:**
- [ ] Scorched Earth Walker (character-by-character parsing)
- [ ] Nested brace handling
- [ ] Row splitting on `\\`
- [ ] Cell splitting on `&`
- [ ] Escaped ampersand handling: `\&` → literal `&`
- [ ] `\multicolumn` support
- [ ] Table wrapper extraction

**Create test:**
```typescript
// __tests__/table-validation.test.ts
describe('Table Processing Validation', () => {
    it('handles escaped ampersands in cells', () => {
        const latex = `\\begin{tabular}{|l|l|}
Built-in \\& Comprehensive & Feature
\\end{tabular}`;

        const result = processLatex(latex);
        const tableBlock = Object.values(result.blocks).find((b: any) =>
            typeof b === 'string' && b.includes('<table>')
        );

        expect(tableBlock).toContain('Built-in &amp; Comprehensive');
    });

    it('handles thousand separators {,}', () => {
        const latex = `\\begin{tabular}{|r|}
1{,}234{,}567
\\end{tabular}`;

        const result = processLatex(latex);
        const tableBlock = Object.values(result.blocks).find((b: any) =>
            typeof b === 'string' && b.includes('<table>')
        );

        expect(tableBlock).toContain('1,234,567');
    });
});
```

---

### Phase 3: Fix Discrepancies (2-8 hours depending on issues)

For each failing test:

1. **Identify the discrepancy:**
   ```bash
   # Run specific test
   npm test -- validation.test.ts -t "TikZ with escaped %"
   ```

2. **Find the source:**
   - Compare old code line-by-line with new code
   - Use `git diff` on backup file

3. **Fix:**
   - Make minimal change to match old behavior
   - Don't "improve" - just match

4. **Test:**
   - Run specific test again
   - Run full validation suite
   - Manual browser test

5. **Commit:**
   ```bash
   git add .
   git commit -m "fix(tikz): Match old behavior for X

   - Found discrepancy in [specific logic]
   - Old code: [what it did]
   - New code was: [what it was doing wrong]
   - Fixed to: [what it does now]
   - Test: [which test now passes]"
   ```

---

### Phase 4: Integration Testing (2-4 hours)

#### 4.1: Full Pipeline Test

```typescript
// __tests__/full-pipeline.test.ts
describe('Full Pipeline Integration', () => {
    it('handles complex academic paper with everything', () => {
        const latex = fs.readFileSync('test/fixtures/full-academic-paper.tex', 'utf-8');

        const oldResult = oldSanitizeLatexForBrowser(latex);
        const newResult = processLatex(latex);

        // Should have same block counts
        expect(Object.keys(newResult.blocks).length).toBe(Object.keys(oldResult.blocks).length);

        // Should have all expected block types
        const blockTypes = Object.keys(newResult.blocks).map(k => k.replace(/\d+$/, ''));
        expect(blockTypes).toContain('LATEXPREVIEWTIKZ');
        expect(blockTypes).toContain('LATEXPREVIEWMATH');
        expect(blockTypes).toContain('LATEXPREVIEWTABLE');
    });
});
```

#### 4.2: Manual Browser Testing

Create test page:

```bash
touch client/public/refactor-test.html
```

```html
<!DOCTYPE html>
<html>
<head>
    <title>Refactor Validation</title>
</head>
<body>
    <h1>Refactoring Validation - Manual Tests</h1>

    <div id="test-results"></div>

    <script type="module">
        import { processLatex } from '/src/lib/latex-unifier/processor.ts';

        const tests = [
            {
                name: 'Simple TikZ',
                latex: `\\begin{tikzpicture}
\\node (a) {A};
\\node (b) [below of=a] {B};
\\draw[->] (a) -- (b);
\\end{tikzpicture}`
            },
            {
                name: 'TikZ with 100%',
                latex: `\\begin{tikzpicture}
\\node {100\\% done};
\\end{tikzpicture}`
            },
            // Add more tests
        ];

        const resultsDiv = document.getElementById('test-results');

        tests.forEach(({ name, latex }) => {
            const section = document.createElement('div');
            section.innerHTML = `<h2>${name}</h2>`;

            try {
                const result = processLatex(latex);
                section.innerHTML += `<p>✅ Processed successfully</p>`;
                section.innerHTML += `<p>Blocks: ${Object.keys(result.blocks).length}</p>`;

                // Render output
                const preview = document.createElement('div');
                preview.innerHTML = result.html;

                // Replace placeholders
                Object.keys(result.blocks).forEach(key => {
                    preview.innerHTML = preview.innerHTML.replace(key, result.blocks[key]);
                });

                section.appendChild(preview);
            } catch (e) {
                section.innerHTML += `<p>❌ Error: ${e.message}</p>`;
            }

            resultsDiv.appendChild(section);
        });
    </script>
</body>
</html>
```

**Test in browser:**
```bash
npm run dev
# Navigate to http://localhost:5173/refactor-test.html
```

**Manual checklist:**
- [ ] Simple TikZ renders
- [ ] Complex TikZ renders (no "No shape named" errors)
- [ ] TikZ with % renders correctly
- [ ] Math equations display properly
- [ ] Tables format correctly
- [ ] Citations show as [1], [2], [1]–[3]
- [ ] Bibliography appears

---

### Phase 5: Performance & Edge Cases (1-2 hours)

#### 5.1: Performance Test

```typescript
// __tests__/performance.test.ts
describe('Performance Regression', () => {
    it('processes large document in reasonable time', () => {
        const largePaper = fs.readFileSync('test/fixtures/large-paper.tex', 'utf-8');

        const startOld = Date.now();
        oldSanitizeLatexForBrowser(largePaper);
        const oldTime = Date.now() - startOld;

        const startNew = Date.now();
        processLatex(largePaper);
        const newTime = Date.now() - startNew;

        // New version should not be more than 50% slower
        expect(newTime).toBeLessThan(oldTime * 1.5);
    });
});
```

#### 5.2: Edge Cases

Test these scenarios:
- [ ] Empty document
- [ ] Document with only preamble
- [ ] Nested environments (TikZ in table)
- [ ] Very long equations
- [ ] Unicode characters
- [ ] Malformed LaTeX (unclosed environments)

---

### Phase 6: Cleanup & Documentation (1 hour)

#### 6.1: Remove Temporary Files

**Once ALL tests pass:**

```bash
# Remove old sanitize helper
rm client/src/lib/old-sanitize.ts

# Keep backup files for 1 more week
# Don't delete yet:
# - LatexPreview - Copy (3).tsx
# - LatexPreview - Copy (2).tsx
# - LatexPreview - Copy.tsx
```

#### 6.2: Update Documentation

```bash
# Update LATEX_PREVIEW_SYSTEM.md
# Add section: "Modular Architecture (v5)"
```

```markdown
## Modular Architecture (v5)

As of v5, the LaTeX preview system uses a modular pipeline:

- `healer.ts` - Pre-processing fixes
- `tikz-engine.ts` - TikZ diagram extraction (preserves all v4 Intent Engine logic)
- `math-engine.ts` - KaTeX math rendering
- `citation-engine.ts` - IEEE citation formatting
- `table-engine.ts` - Table parsing with Scorched Earth Walker
- `processor.ts` - Pipeline orchestrator

All v4 logic has been preserved. See REFACTORING_ANALYSIS.md for details.
```

#### 6.3: Final Commit

```bash
git add .
git commit -m "refactor: Complete safe migration to modular architecture (v5)

VALIDATION COMPLETE:
- All engines tested against v4 baseline
- Output comparison tests pass
- Manual testing confirms all rendering works
- Performance within acceptable range
- Edge cases handled

PRESERVED FROM V4:
- TikZ Intent Engine (WIDE/FLAT/COMPACT/LARGE/MEDIUM)
- Bezier polyfill for decorative braces
- Bifurcated Safety Net (8.4cm vs 0.5cm)
- Math autoscale heuristic
- IEEE citation grouping
- Scorched Earth table walker

NEW BENEFITS:
- Modular, testable code
- Clear separation of concerns
- Easier to maintain
- No behavior changes

See REFACTORING_ANALYSIS.md for complete migration history.
"
```

---

## Success Criteria

### All Must Be True:

- ✅ All unit tests pass
- ✅ All validation tests pass (old vs new output matches)
- ✅ Manual browser testing shows correct rendering
- ✅ No "No shape named" errors in any TikZ diagrams
- ✅ Performance within 50% of old version
- ✅ Edge cases handled gracefully
- ✅ Code review approved
- ✅ Documentation updated

**Only then:** Consider the refactor complete.

---

## Rollback Plan (If Needed)

If at ANY point validation fails and can't be fixed in 2 hours:

### Emergency Rollback:

```bash
# 1. Revert to old working version
git checkout client/src/components/LatexPreview.tsx
git restore "client/src/components/LatexPreview - Copy (3).tsx"
cp "client/src/components/LatexPreview - Copy (3).tsx" client/src/components/LatexPreview.tsx

# 2. Remove broken modular system
rm -rf client/src/lib/latex-unifier

# 3. Test that old version works
npm run dev
# Manually test TikZ rendering

# 4. Commit rollback
git add .
git commit -m "revert: Rollback to monolithic LatexPreview (modular version had issues)

Issues found during validation:
- [List issues]

Rolled back to working v4 monolith.
Will re-attempt refactor using stricter validation process.
"

# 5. Push
git push origin main
```

### Then: Start over following SAFE_REFACTORING_GUIDE.md Phase 1.

---

## Timeline Estimate

| Phase | Time | Can Parallelize? |
|-------|------|------------------|
| Setup validation | 1-2 hours | No |
| Validate healer | 30 min | No |
| Validate TikZ | 2-3 hours | No |
| Validate math | 1 hour | After healer |
| Validate citations | 1 hour | After healer |
| Validate tables | 1-2 hours | After healer |
| Fix discrepancies | 2-8 hours | No |
| Integration testing | 2-4 hours | After all validated |
| Performance testing | 1 hour | After integration |
| Cleanup | 1 hour | After all tests pass |

**Total: 12-23 hours** (depending on issues found)

**Realistic: Plan for 3-4 work days** to be safe.

---

## Next Steps (Start Here)

1. **Create branch:**
   ```bash
   git checkout -b refactor/validation-and-fixes
   ```

2. **Run Phase 1.1:** Create test fixtures (copy commands above)

3. **Run Phase 1.2-1.4:** Set up validation framework

4. **Run Phase 2:** Start validating engines one by one

5. **Report status:** After each engine validation, commit and report:
   - ✅ Pass: Move to next engine
   - ❌ Fail: Document issues, fix, re-test

---

## Questions Before Starting?

- **Q:** Should we rollback or fix-in-place?
  **A:** Fix-in-place (Option A) - we've already done the splitting work.

- **Q:** How exact should the output match be?
  **A:** HTML structure should be equivalent. Exact character match not required (whitespace/order may differ).

- **Q:** What if we find intentional improvements in new code?
  **A:** Document them separately. For now, match old behavior. Improve in separate PR after validation complete.

- **Q:** How long should we keep backup files?
  **A:** Minimum 1 week after successful deployment. Ideally 1 month.

---

**Ready to begin?** Start with Phase 1.1 - Creating test fixtures.
