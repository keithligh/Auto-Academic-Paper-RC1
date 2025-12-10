# LatexPreview.tsx Refactoring Guide: Safe Modular Extraction

**Current State:** Working monolithic LatexPreview.tsx (1,586 lines)
**Goal:** Extract to modular architecture without breaking functionality
**Approach:** Incremental extraction with validation at each step

---

## Overview

The current `LatexPreview.tsx` contains a large `sanitizeLatexForBrowser` function (~1,265 lines) that handles all LaTeX processing. We'll split this into specialized engine modules while preserving exact behavior.

**Target Architecture:**
```
client/src/lib/latex-unifier/
├── healer.ts          - Pre-processing fixes
├── tikz-engine.ts     - TikZ diagram extraction
├── math-engine.ts     - KaTeX math rendering
├── citation-engine.ts - IEEE citation formatting
├── table-engine.ts    - Table parsing
└── processor.ts       - Pipeline orchestrator
```

---

## ⚠️ Critical Rules - Read First

### Rule #1: Extract Don't Rewrite
**DO:** Copy code exactly as-is
**DON'T:** "Improve" code while moving it

**Why:** The current code is battle-tested with hundreds of edge case fixes. Any change risks breaking rendering.

### Rule #2: One Engine at a Time
**DO:** Extract one engine → Test → Commit → Next engine
**DON'T:** Extract multiple engines in one commit

**Why:** If something breaks, you need to know exactly which extraction caused it.

### Rule #3: Preserve Structure
**DO:** Keep newlines, whitespace, and code structure intact
**DON'T:** Flatten multi-line code, remove comments, or reorganize logic

**Why:** Multi-line code (especially TikZ) relies on structure. Flattening breaks parsing.

### Rule #4: Test Every Step
**DO:** Run tests after each integration
**DON'T:** Skip testing until "everything is done"

**Why:** Small bugs compound. Catch them immediately.

### Rule #5: No Improvements During Refactor
**DO:** Save improvements for separate PRs after refactor complete
**DON'DON'T:** Add features, fix bugs, or optimize while refactoring

**Why:** Mixing refactoring with improvements makes it impossible to debug when things break.

---

## Common Pitfalls (Avoid These!)

### ⚠️ Pitfall #1: Adding "Sanitization" to TikZ Processing

**Temptation:** "Let me add proper comment stripping while I'm here"

**Problem:** TikZ code needs minimal processing. Over-sanitization breaks structure.

**Example of what NOT to do:**
```typescript
// ❌ BAD - Don't add this!
function sanitizeStr(s: string) {
    return s
        .replace(/%.*$/gm, '')      // Strips comments
        .replace(/\n/g, ' ');       // ❌ FATAL: Flattens structure!
}
```

**Why this breaks:**
- Flattening newlines destroys multi-line TikZ node definitions
- Simple comment stripping breaks escaped percents (`100\%`)
- TikZ parser needs structure preserved

**What TO do:**
```typescript
// ✅ GOOD - Minimal processing only
let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, ''); // ASCII only
// Then: specific fixes (ampersand escaping, bezier polyfill)
// NO newline flattening, NO comment stripping
```

### ⚠️ Pitfall #2: "Cleaning Up" Code While Moving It

**Temptation:** "This regex looks messy, let me simplify it"

**Problem:** That "messy" regex handles edge cases you don't know about.

**Example:**
```typescript
// Existing code (looks complex but handles nested braces):
const nested = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';
protectedText = protectedText.replace(
    new RegExp(`\\\\textbf\\{${nested}\\}`, 'g'),
    '<strong>$1</strong>'
);

// ❌ Don't "simplify" to:
protectedText = protectedText.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
// This breaks on: \textbf{outer {inner} text}
```

**What TO do:** Copy the complex regex EXACTLY. Document it if needed, but don't change it.

### ⚠️ Pitfall #3: Forgetting Extraction Order Matters

**Problem:** Extracting in wrong order can break dependencies.

**Critical order for TikZ extraction:**
```
1. Extract options [...]  ← Must happen before body
2. Extract body
3. Process body (ampersands, bezier, intent engine)
4. Generate iframe
```

**What NOT to do:** Don't extract body before parsing options. The manual bracket parser is there for a reason (handles nested brackets like `[label={[0,1]}]`).

### ⚠️ Pitfall #4: Assuming Absence = Oversight

**Temptation:** "The old code doesn't strip comments, I should add that"

**Reality:** The absence is **intentional**. The old code doesn't strip comments because:
- LaTeX rendering doesn't need it
- Stripping breaks escaped characters
- Adds complexity with no benefit

**Rule:** If the working code doesn't do something, assume there's a reason.

### ⚠️ Pitfall #5: Duplicating Helper Functions

**Problem:** Multiple engines need `parseLatexFormatting`. Don't copy-paste it into each engine.

**Wrong approach:**
```
tikz-engine.ts    → contains parseLatexFormatting()
table-engine.ts   → contains parseLatexFormatting() (copy-paste)
citation-engine.ts → contains parseLatexFormatting() (copy-paste)
```

**Right approach:**
```
formatter.ts      → exports parseLatexFormatting() (single source)
All engines       → import { parseLatexFormatting } from './formatter'
```

---

## Step-by-Step Extraction Process

### Phase 0: Setup (1-2 hours)

#### 0.1: Create Test Fixtures

```bash
mkdir -p test/fixtures/refactor-validation
```

Create these test files:

**simple-tikz.tex:**
```latex
\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows}
\begin{document}
\begin{tikzpicture}
\node (a) {A};
\node (b) [below of=a] {B};
\draw[->] (a) -- (b);
\end{tikzpicture}
\end{document}
```

**tikz-with-percent.tex:**
```latex
\documentclass{article}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
\node (progress) {100\% complete};
\node (status) [below of=progress] {Success: 95\%};
\draw[->] (progress) -- (status);
\end{tikzpicture}
\end{document}
```

**complex-tikz.tex:**
```latex
\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows}
\begin{document}
\begin{tikzpicture}[node distance=3cm]
\node (empathize) [rectangle, draw] {Empathize};
\node (define) [rectangle, draw, below of=empathize] {Define};
\node (ideate) [rectangle, draw, below of=define] {Ideate};
\draw[->] (empathize) -- (define);
\draw[->] (define) -- (ideate);
\end{tikzpicture}
\end{document}
```

**math-and-tables.tex:**
```latex
\documentclass{article}
\usepackage{amsmath}
\begin{document}
Inline: $x = y^2$

Display:
\[
E = mc^2
\]

Multi-line:
\begin{align}
x &= y \\
a &= b
\end{align}

\begin{table}
\begin{tabular}{|l|r|}
\hline
Text & Number \\
Built-in \& Comprehensive & 1{,}234 \\
\hline
\end{tabular}
\end{table}
\end{document}
```

**citations.tex:**
```latex
\documentclass{article}
\begin{document}
Single (ref_1). Multiple (ref_1, ref_2, ref_3).

\begin{thebibliography}{9}
\bibitem{ref_1} First reference
\bibitem{ref_2} Second reference
\bibitem{ref_3} Third reference
\end{thebibliography}
\end{document}
```

#### 0.2: Create Baseline Test

```bash
mkdir -p client/src/lib/__tests__
```

```typescript
// client/src/lib/__tests__/baseline.test.ts
import fs from 'fs';
import path from 'path';
import { LatexPreview } from '../../components/LatexPreview';

describe('Baseline Tests (Verify Working Version)', () => {
    const fixturesDir = path.join(__dirname, '../../../test/fixtures/refactor-validation');

    function loadFixture(filename: string): string {
        return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
    }

    it('renders simple TikZ without errors', () => {
        const latex = loadFixture('simple-tikz.tex');
        // Test rendering works (implementation depends on your test setup)
        expect(() => {
            // Render component or call sanitizeLatexForBrowser
        }).not.toThrow();
    });

    // Add tests for all fixtures
});
```

**Run baseline tests:**
```bash
npm test -- baseline.test.ts
```

**Expected:** All pass ✅ (Confirms working version works)

#### 0.3: Create Refactor Branch

```bash
git checkout -b refactor/latex-preview-modular
git add test/fixtures
git commit -m "test: Add baseline fixtures for refactoring validation"
```

---

### Phase 1: Extract Healer (1-2 hours)

The healer contains pre-processing logic that runs before any parsing.

#### 1.1: Identify Healer Logic

**Location in LatexPreview.tsx:** Inside `sanitizeLatexForBrowser`, look for:

```typescript
// Markdown fence stripping
content = content.replace(/^```latex\s*/i, '').replace(/```$/, '');

// Ambiguous newline fix
content = content.replace(/\\n(?!(ewline|ewpage))/g, '\n');

// Ghost header removal
content = content.replace(/\\section\*?\s*\{References\}/gi, '');

// Math fragment healing
content = content.replace(/(\$[^$]+\$)\s*([=])\s*(\$[^$]+\$)/g, ...);

// Command stripping
content = content.replace(/\\tableofcontents/g, '');
// ... etc
```

Typically this is ~130 lines of pre-processing before the main extraction loops.

#### 1.2: Create healer.ts

```bash
mkdir -p client/src/lib/latex-unifier
touch client/src/lib/latex-unifier/healer.ts
```

```typescript
// client/src/lib/latex-unifier/healer.ts
/**
 * Pre-processing fixes for LaTeX input
 *
 * EXTRACTED FROM: LatexPreview.tsx sanitizeLatexForBrowser (pre-processing section)
 * CHANGES: None - exact copy
 */

export function healLatex(content: string): string {
    let healed = content;

    // === COPY EXACT PRE-PROCESSING CODE FROM LatexPreview.tsx ===

    // Markdown fence stripping
    healed = healed.replace(/^```latex\s*/i, '').replace(/```$/, '');

    // Ambiguous newline fix
    healed = healed.replace(/\\n(?!(ewline|ewpage|oindent|ewtheorem))/g, '\n');

    // Ghost header exorcism
    healed = healed.replace(/\\section\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');
    healed = healed.replace(/\\subsection\*?\s*\{\s*(?:References|Bibliography)\s*\}/gi, '');

    // Math fragment healing
    healed = healed.replace(/(\$[^$]+\$)\s*([=])\s*(\$[^$]+\$)\s*([+])\s*(.*)$/gm, (match, p1, eq, p2, plus, rest) => {
        if (rest.includes('\\') || rest.includes('_') || rest.includes('^')) {
            const cleanP1 = p1.slice(1, -1);
            const cleanP2 = p2.slice(1, -1);
            return `$$ ${cleanP1} = ${cleanP2} + ${rest} $$`;
        }
        return match;
    });

    // Targeted healer: $...$ = $...$ -> $... = ...$
    healed = healed.replace(/(\$[^$]+\$)\s*([=+\-])\s*(\$[^$]+\$)/g, (m, p1, op, p2) => {
        return p1.slice(0, -1) + ' ' + op + ' ' + p2.slice(1);
    });

    // Redundant delimiter sanitizer
    healed = healed.replace(/\\\[([\s\S]*?)\\\]/g, (m, inner) => {
        return '\\[' + inner.replace(/(?<!\\)\$/g, '') + '\\]';
    });

    // Math notation normalization
    healed = healed.replace(/\$([^\$]+)\$_([a-zA-Z0-9]+)/g, '$$$1_{$2}$$');
    healed = healed.replace(/\$([^\$]+)\$_\s*\{([^}]+)\}/g, '$$$1_{$2}$$');

    // Table AI typos
    healed = healed.replace(/Built-in\s+&\s+Comprehensive/g, 'Built-in \\& Comprehensive');

    // Command stripping
    healed = healed
        .replace(/\\tableofcontents/g, '')
        .replace(/\\listoffigures/g, '')
        .replace(/\\listoftables/g, '')
        .replace(/\\input\{[^}]*\}/g, '')
        .replace(/\\include\{[^}]*\}/g, '')
        .replace(/\\newpage/g, '')
        .replace(/\\clearpage/g, '')
        .replace(/\\pagebreak/g, '')
        .replace(/\\noindent/g, '')
        .replace(/\\vspace\{[^}]*\}/g, '')
        .replace(/\\hspace\{[^}]*\}/g, '');

    return healed;
}
```

**⚠️ Important:** Copy ALL pre-processing logic. Don't skip any replacements even if they seem minor.

#### 1.3: Test Healer in Isolation

```typescript
// client/src/lib/latex-unifier/__tests__/healer.test.ts
import { healLatex } from '../healer';

describe('healLatex', () => {
    it('strips markdown fences', () => {
        const input = '```latex\n$x = y$\n```';
        expect(healLatex(input)).toBe('$x = y$');
    });

    it('fixes ambiguous newlines', () => {
        expect(healLatex('foo\\nbar')).toBe('foo\nbar');
    });

    it('preserves real newline commands', () => {
        expect(healLatex('\\newline')).toContain('\\newline');
    });

    it('removes ghost References headers', () => {
        expect(healLatex('\\section{References}')).not.toContain('\\section{References}');
    });

    it('heals fragmented equations', () => {
        const input = '$x$ = $y$ + z';
        const output = healLatex(input);
        expect(output).toContain('$x = y + z$');
    });

    it('fixes orphaned subscripts', () => {
        expect(healLatex('$\\theta$_t')).toBe('$\\theta_{t}$');
    });

    // Add tests for ALL healing functions
});
```

**Run tests:**
```bash
npm test -- healer.test.ts
```

**Expected:** All pass ✅

#### 1.4: Integrate Healer into LatexPreview.tsx

```typescript
// client/src/components/LatexPreview.tsx

import { healLatex } from '../lib/latex-unifier/healer';

function sanitizeLatexForBrowser(latex: string): SanitizeResult {
    // OLD CODE (delete these lines):
    // let content = latex;
    // content = content.replace(/^```latex\s*/i, '').replace(/```$/, '');
    // content = content.replace(/\\n(?!...)/g, '\n');
    // ... (all the pre-processing lines)

    // NEW CODE (add this):
    let content = healLatex(latex);

    // Rest of sanitizeLatexForBrowser continues unchanged...
    const blocks: Record<string, string> = {};
    let blockCount = 0;
    // ...
}
```

#### 1.5: Test Integration

```bash
npm test -- baseline.test.ts
npm run dev
```

**Manual test:**
- Test all fixtures in browser
- Verify all render correctly

**Expected:** Everything works ✅ (No behavior change)

#### 1.6: Commit Healer

```bash
git add .
git commit -m "refactor: Extract healLatex to healer.ts (1/6 engines)

EXTRACTED:
- Pre-processing logic from sanitizeLatexForBrowser
- ~130 lines of healing/normalization code

CHANGES:
- None - exact copy of existing code

TESTING:
- Unit tests added for all healing functions
- Integration tests pass
- Manual browser testing confirms rendering works

STATUS: 1 of 6 engines extracted
NEXT: Extract TikZ engine
"
```

---

### Phase 2: Extract TikZ Engine (4-6 hours)

**⚠️ CRITICAL:** TikZ engine is the most complex. Follow extraction rules carefully.

#### 2.1: Identify TikZ Logic

**Location in LatexPreview.tsx:**

1. **createTikzBlock function** (~450 lines)
   - Lines ~164-615
   - Contains Intent Engine, iframe generation, scaling logic

2. **Extraction loop** (~60 lines)
   - Lines ~710-775
   - Manual bracket parser for nested options

#### 2.2: Create tikz-engine.ts

```bash
touch client/src/lib/latex-unifier/tikz-engine.ts
```

```typescript
// client/src/lib/latex-unifier/tikz-engine.ts
/**
 * TikZ diagram extraction and iframe generation
 *
 * EXTRACTED FROM: LatexPreview.tsx
 * - createTikzBlock function (lines ~164-615)
 * - Extraction loop (lines ~710-775)
 *
 * PRESERVES:
 * - Intent Engine (WIDE/FLAT/COMPACT/LARGE/MEDIUM classification)
 * - Bezier polyfill for decorative braces
 * - Bifurcated Safety Net (8.4cm vs 0.5cm)
 * - All scaling logic
 *
 * CHANGES: None - exact copy
 */

let blockCount = 0;

export interface TikzResult {
    cleanedContent: string;
    blocks: Record<string, string>;
}

// === COPY createTikzBlock EXACTLY ===
function createTikzBlock(tikzCode: string, options: string, blocks: Record<string, string>): string {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;

    // pgfplots rejection
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
        blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - not supported in browser preview</div>`;
        return `\n\n${id}\n\n`;
    }

    // ⚠️ CRITICAL: ASCII enforcement ONLY
    // DO NOT add sanitizeStr function
    // DO NOT flatten newlines
    // DO NOT strip comments
    let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, '');

    // ⚠️ CRITICAL: Preserve structure
    // DO NOT add .replace(/\n/g, ' ')
    // TikZ needs multi-line structure intact

    // Ampersand escaping (from old code exactly)
    safeTikz = safeTikz.replace(/\\\\&/g, '\\\\ \\&');
    safeTikz = safeTikz.replace(/([^\\])&/g, '$1\\&');

    // === COPY REST OF createTikzBlock EXACTLY ===
    // - Bezier polyfill (lines ~185-243)
    // - Intent Engine (lines ~245-520)
    // - Iframe generation (lines ~528-615)
    //
    // DO NOT MODIFY ANY LOGIC
    // Copy character-for-character

    // [PASTE EXACT CODE HERE]

    return `\n\n${id}\n\n`;
}

// === COPY extraction loop EXACTLY ===
export function processTikz(content: string): TikzResult {
    let cleaned = content;
    const blocks: Record<string, string> = {};

    let loopSafety = 0;
    while (cleaned.includes('\\begin{tikzpicture}')) {
        if (loopSafety++ > 100) break;

        const startTag = '\\begin{tikzpicture}';
        const endTag = '\\end{tikzpicture}';
        const startIdx = cleaned.indexOf(startTag);
        if (startIdx === -1) break;

        let cursor = startIdx + startTag.length;

        // Skip whitespace
        while (cursor < cleaned.length && /\s/.test(cleaned[cursor])) cursor++;

        // Parse optional arguments [...] - MANUAL PARSER
        // ⚠️ CRITICAL: This handles nested brackets like [label={[0,1]}]
        let options = '';
        if (cleaned[cursor] === '[') {
            const optStart = cursor;
            let depth = 0;
            let inString = false;

            while (cursor < cleaned.length) {
                const char = cleaned[cursor];
                if (char === '"' && cleaned[cursor - 1] !== '\\') inString = !inString;

                if (!inString) {
                    if (char === '[' || char === '{') depth++;
                    else if (char === ']' || char === '}') depth--;
                }

                cursor++;

                if (depth === 0 && cleaned[cursor - 1] === ']') break;
            }
            options = cleaned.substring(optStart, cursor);
        }

        // Find end tag
        const bodyStart = cursor;
        const endIdx = cleaned.indexOf(endTag, cursor);

        if (endIdx === -1) {
            console.error('Unclosed TikZ environment');
            break;
        }

        const body = cleaned.substring(bodyStart, endIdx);

        // Create block
        const placeholder = createTikzBlock(body, options, blocks);

        // Replace in content
        cleaned = cleaned.substring(0, startIdx) + placeholder + cleaned.substring(endIdx + endTag.length);
    }

    return { cleanedContent: cleaned, blocks };
}
```

**⚠️ WARNING CHECKLIST:**
- ✅ NO `sanitizeStr` function added
- ✅ NO `.replace(/\n/g, ' ')` anywhere
- ✅ NO comment stripping added
- ✅ Manual bracket parser preserved exactly
- ✅ Intent Engine logic unchanged
- ✅ All scaling formulas unchanged

#### 2.3: Test TikZ Engine

```typescript
// client/src/lib/latex-unifier/__tests__/tikz-engine.test.ts
import { processTikz } from '../tikz-engine';

describe('processTikz', () => {
    it('extracts simple diagram', () => {
        const input = `Text before
\\begin{tikzpicture}
\\node (a) {A};
\\end{tikzpicture}
Text after`;

        const result = processTikz(input);

        expect(result.cleanedContent).toContain('LATEXPREVIEWTIKZ0');
        expect(result.blocks['LATEXPREVIEWTIKZ0']).toContain('<iframe');
    });

    it('preserves newlines in TikZ code', () => {
        const input = `\\begin{tikzpicture}
\\node (a) {A};
\\node (b) {B};
\\end{tikzpicture}`;

        const result = processTikz(input);
        const iframe = result.blocks['LATEXPREVIEWTIKZ0'];

        // Decode srcdoc
        const srcdocMatch = iframe.match(/srcdoc="([^"]+)"/);
        expect(srcdocMatch).toBeTruthy();

        const decoded = srcdocMatch![1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&');

        // Should contain both nodes (not flattened)
        expect(decoded).toMatch(/\\node.*\\node/s);
    });

    it('handles escaped percents', () => {
        const input = `\\begin{tikzpicture}
\\node {100\\% done};
\\end{tikzpicture}`;

        const result = processTikz(input);
        const iframe = result.blocks['LATEXPREVIEWTIKZ0'];

        expect(iframe).toContain('100');
    });

    it('handles multi-node diagrams with references', () => {
        const input = `\\begin{tikzpicture}[node distance=3cm]
\\node (empathize) [rectangle, draw] {Empathize};
\\node (define) [rectangle, draw, below of=empathize] {Define};
\\draw[->] (empathize) -- (define);
\\end{tikzpicture}`;

        const result = processTikz(input);
        const iframe = result.blocks['LATEXPREVIEWTIKZ0'];

        // Should contain both node names
        expect(iframe).toContain('empathize');
        expect(iframe).toContain('define');
    });
});
```

**Run tests:**
```bash
npm test -- tikz-engine.test.ts
```

**Expected:** All pass ✅

#### 2.4: Integrate TikZ Engine

```typescript
// client/src/components/LatexPreview.tsx

import { processTikz } from '../lib/latex-unifier/tikz-engine';

function sanitizeLatexForBrowser(latex: string): SanitizeResult {
    let content = healLatex(latex);

    // ... preamble stripping ...

    // OLD CODE (delete the manual TikZ extraction loop ~60 lines):
    // let loopSafety = 0;
    // while (content.includes('\\begin{tikzpicture}')) {
    //   ... manual extraction ...
    // }

    // NEW CODE:
    const tikzResult = processTikz(content);
    content = tikzResult.cleanedContent;
    Object.assign(blocks, tikzResult.blocks);

    // Rest continues...
}
```

#### 2.5: Test Integration

```bash
npm test -- baseline.test.ts
npm run dev
```

**Manual test (CRITICAL):**
- [ ] Simple TikZ renders
- [ ] Complex multi-node diagram renders (no "No shape named" errors)
- [ ] TikZ with `100\%` renders correctly
- [ ] All Intent Engine classifications work (WIDE/FLAT/COMPACT/LARGE/MEDIUM)

**Expected:** Everything renders perfectly ✅

#### 2.6: Commit TikZ Engine

```bash
git add .
git commit -m "refactor: Extract processTikz to tikz-engine.ts (2/6 engines)

EXTRACTED:
- createTikzBlock function (~450 lines)
- TikZ extraction loop with manual bracket parser (~60 lines)

PRESERVED:
- Intent Engine (WIDE/FLAT/COMPACT/LARGE/MEDIUM)
- Bezier polyfill for decorative braces
- Bifurcated Safety Net (8.4cm vs 0.5cm)
- Goldilocks Protocol for coordinate boost
- All scaling formulas

CRITICAL:
- NO sanitizeStr function
- NO newline flattening
- Preserves multi-line structure

CHANGES:
- None - exact copy

TESTING:
- Unit tests pass
- Integration tests pass
- Manual testing: all TikZ diagrams render correctly

STATUS: 2 of 6 engines extracted
NEXT: Extract Math engine
"
```

---

### Phase 3-5: Extract Remaining Engines

Follow the same pattern for each:

**Math Engine** (2-3 hours)
- Extract `createMathBlock`
- Extract math extraction order logic
- Preserve autoscale heuristic

**Citation Engine** (2-3 hours)
- Extract IEEE citation formatting
- Preserve grouping logic `[1]–[3]`

**Table Engine** (3-4 hours)
- Extract Scorched Earth Walker
- Preserve cell/row splitting logic
- Handle escaped ampersands

Each extraction:
1. Identify code location
2. Create engine file
3. Copy EXACT code
4. Write tests
5. Integrate
6. Test
7. Commit

---

### Phase 6: Create Processor (2-3 hours)

Once all engines extracted, create orchestrator:

```typescript
// client/src/lib/latex-unifier/processor.ts
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

    // Call engines in EXACT order from old code
    let processed = healLatex(content);

    // ... metadata extraction ...
    // ... preamble stripping ...

    const tikzResult = processTikz(processed);
    processed = tikzResult.cleanedContent;
    Object.assign(blocks, tikzResult.blocks);

    // Continue with other engines...

    return { html: processed, blocks, bibliographyHtml: null, hasBibliography: false };
}
```

---

### Phase 7: Update Component (1-2 hours)

Final step: Update LatexPreview.tsx to use processor

```typescript
// client/src/components/LatexPreview.tsx
import { processLatex } from '../lib/latex-unifier/processor';

export function LatexPreview({ latexContent }: LatexPreviewProps) {
    useEffect(() => {
        if (!containerRef.current || !latexContent) return;

        try {
            // OLD: const { sanitized, blocks } = sanitizeLatexForBrowser(latexContent);
            // NEW:
            const { html, blocks, bibliographyHtml, hasBibliography } = processLatex(latexContent);

            // Rendering logic continues...
            containerRef.current.innerHTML = html;

            // ... rest unchanged ...

        } catch (err) {
            // ... error handling ...
        }
    }, [latexContent]);
}
```

---

## Final Validation

Before declaring victory:

### Full Test Suite
```bash
npm test
```
**Expected:** All pass ✅

### Manual Testing Checklist
- [ ] All test fixtures render correctly
- [ ] Complex diagrams render (no "No shape named" errors)
- [ ] Math equations display properly
- [ ] Tables format correctly
- [ ] Citations show proper IEEE format
- [ ] No console errors
- [ ] Performance acceptable (within 50% of old version)

### Code Review Checklist
- [ ] All engines extracted
- [ ] No logic changes from original
- [ ] No "improvements" added
- [ ] Documentation updated
- [ ] Old backup files preserved (keep for 1 week)

---

## Success Criteria

✅ All unit tests pass
✅ All integration tests pass
✅ Manual testing shows identical rendering
✅ No new bugs introduced
✅ Code is cleaner and more maintainable
✅ Each engine can be tested independently

**Then:** Refactoring is complete!

---

## Timeline Summary

| Phase | Time | Cumulative |
|-------|------|------------|
| Setup | 1-2 hours | 1-2h |
| Healer | 1-2 hours | 2-4h |
| TikZ | 4-6 hours | 6-10h |
| Math | 2-3 hours | 8-13h |
| Citations | 2-3 hours | 10-16h |
| Tables | 3-4 hours | 13-20h |
| Processor | 2-3 hours | 15-23h |
| Integration | 1-2 hours | 16-25h |

**Total:** 16-25 hours (2-3 full work days)

---

## Questions & Answers

**Q: Can I improve code while extracting?**
A: NO. Save improvements for separate PRs after refactor is done.

**Q: What if I find a bug in the old code?**
A: Note it, but don't fix during refactor. Fix in separate PR after validation complete.

**Q: Should I combine multiple engines in one commit?**
A: NO. One engine per commit. Makes it easy to identify issues.

**Q: What if tests fail after integration?**
A: Revert the integration, find what changed, fix to match old behavior exactly.

**Q: How long should I keep backup files?**
A: Minimum 1 week after successful deployment. Recommend 1 month for safety.

---

## Emergency Rollback

If anything breaks:

```bash
git log  # Find last working commit
git revert <bad-commit-hash>
# Or
git reset --hard <last-working-commit>
```

Don't continue if a step breaks. Fix or revert immediately.

---

**Start with Phase 0: Setup. Good luck! 🚀**
