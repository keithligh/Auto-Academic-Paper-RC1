# LaTeX Preview System: Implementation Guide for New Developers

## Prerequisites

You should understand:
- React hooks (useState, useEffect, useRef)
- CSS box model (margin, padding, box-sizing)
- CSS cascade and specificity
- DOM manipulation (TreeWalker, DocumentFragment)
- Basic LaTeX structure (preamble, \begin{document}, sections)

---

## Architecture Overview

```
Input LaTeX → Sanitize → latex.js Parse → Inject HTML Blocks → Scale → Display
                ↓                            ↑
         Extract Complex                Store in Map
         (Math/TikZ/Tables)              (blocks{})
```

**Philosophy:** Don't trust latex.js with complex LaTeX. Extract it first, render with specialized tools (KaTeX, TikZJax), then inject back as HTML.

---

# Part 1: CSS Foundation

## Step 1: Create Base Styles (`latex-article.css`)

**Location:** `client/src/styles/latex-article.css`

### 1.1 Import Dependencies

```css
/* Import base LaTeX-compatible styles (optional, for advanced users) */
@import "latex-base.css";

/* Import Google Fonts for academic serif look */
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap');
```

**Why Lora?** Closest web font to LaTeX's Computer Modern serif. Fallback to Times New Roman.

---

### 1.2 The Paper Container

```css
.latex-preview {
    /* Font Stack */
    font-family: 'Lora', 'Times New Roman', serif !important;
    line-height: 1.6 !important;  /* Will be overridden to 1.8 later */
    color: #000 !important;

    /* A4 Dimensions (210mm × 297mm ISO standard) */
    width: 210mm;
    max-width: 100%;           /* Responsive: shrink on small screens */
    min-height: 297mm;

    /* THE KEY: Margins = padding */
    /* Standard LaTeX article has ~25mm margins on all sides */
    padding: 25mm 25mm;

    /* Centering */
    margin: 0 auto;

    /* Paper appearance */
    background-color: white !important;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);  /* Elevation effect */

    /* Critical for size calculation */
    box-sizing: border-box;

    /* Prevent overflow */
    overflow-x: hidden;
}
```

**Box Model Breakdown:**
```
┌─────────────────────────────────────┐
│ 210mm (total width)                 │
│  ┌─────────────────────────────┐   │
│  │ 25mm padding                 │   │
│  ├─────────────────────────────┤   │
│25mm│  Content Area (160mm)   │25mm│
│  │                             │   │
│  ├─────────────────────────────┤   │
│  │ 25mm padding                 │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Why `box-sizing: border-box`?**
- Without it: `width = content width` (padding adds to total)
- With it: `width = total width` (padding is inside)
- Result: `210mm` includes padding, so content area = 210 - 50 = 160mm

---

### 1.3 Typography Elements

```css
/* Title */
.latex-preview .title,
.latex-preview h1.title {
    text-align: center;
    font-size: 24pt;
    font-weight: bold;
    margin-bottom: 1em;
    line-height: 1.2;
}

/* Author */
.latex-preview .author {
    text-align: center;
    font-size: 14pt;
    margin-bottom: 0.5em;
    font-style: italic;
}

/* Date */
.latex-preview .date {
    text-align: center;
    font-size: 12pt;
    margin-bottom: 2em;
}
```

---

### 1.4 Sections

```css
.latex-preview h2 {
    font-size: 16pt;
    font-weight: bold;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
}

.latex-preview h3 {
    font-size: 14pt;
    font-weight: bold;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
}

.latex-preview h4 {
    font-size: 12pt;
    font-weight: bold;
    font-style: italic;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
}
```

**Note:** No underlines (academic papers don't use them).

---

### 1.5 Paragraphs

```css
.latex-preview p {
    margin-bottom: 1em;
    text-align: justify;        /* Academic style */
    text-justify: inter-word;
    font-size: 11pt;
    text-indent: 0 !important;  /* Modern style: no indent */
}
```

**Design decision:** We use `text-indent: 0` for modern look. Traditional LaTeX indents first line of each paragraph except after headings.

---

### 1.6 Lists

```css
.latex-preview ul,
.latex-preview ol {
    margin-bottom: 1em;
    padding-left: 2em;
}

.latex-preview li {
    margin-bottom: 0.2em;
}
```

---

### 1.7 Tables

```css
.table-wrapper {
    width: 100%;
    overflow-x: auto;
    margin: 1.5em 0;
}

.table-wrapper table {
    margin: 0 auto;
    border-collapse: collapse;
    width: 90%;
}

.table-wrapper td {
    padding: 4px 8px;
    border-bottom: 1px solid #eee;
    text-align: left !important;
}

/* Header row */
.table-wrapper tr:first-child td {
    border-top: 2px solid #000;
    border-bottom: 1px solid #000;
    font-weight: bold;
}

/* Bottom row */
.table-wrapper tr:last-child td {
    border-bottom: 2px solid #000;
}
```

**Styling philosophy:** Matches LaTeX `booktabs` package (professional horizontal lines only).

---

### 1.8 Math Display

```css
.latex-preview .katex-display {
    margin: 1.5em 0 !important;
    font-size: 1.1em;
    overflow-x: hidden;     /* Wide equations handled by scaling */
    overflow-y: hidden;
    max-width: 100% !important;
}

/* Inline math */
.latex-preview .katex:not(.katex-display) {
    margin: 0;
    font-size: 1em;  /* Match body text */
}
```

---

### 1.9 Code Blocks (Verbatim)

```css
.latex-verbatim {
    background-color: #f9f9f9;
    border: 1px solid #eee;
    padding: 1em;
    margin: 1.5em 0;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    line-height: 1.4;
    overflow-x: auto;
    white-space: pre-wrap;
}
```

---

### 1.10 Bibliography

```css
.bib-list {
    list-style: none;
    padding: 0;
}

.bib-list li {
    margin-bottom: 0.5em;
    padding-left: 2em;
    text-indent: -2em;  /* Hanging indent */
}

.bib-label {
    font-weight: bold;
}
```

**Save this file.** This is your visual foundation.

---

# Part 2: React Component Structure

## Step 2: Create the LatexPreview Component

**Location:** `client/src/components/LatexPreview.tsx`

### 2.1 Imports and Setup

```typescript
import { useEffect, useState, useRef } from 'react';
import katex from 'katex';
import '@/styles/latex-katex.css';
import '@/styles/latex-article.css';

// latex.js is loaded via <script> tag in index.html
declare const latexjs: any;

interface LatexPreviewProps {
  latexContent: string;
  className?: string;
}

interface SanitizeResult {
  sanitized: string;                    // Clean LaTeX for latex.js
  blocks: Record<string, string>;       // Extracted HTML blocks
  bibliographyHtml: string | null;      // Bibliography HTML
}
```

**Why `declare const latexjs: any`?**
- latex.js is loaded globally via `<script src="/js/latex.js">`
- TypeScript doesn't know about global variables
- We bypass type safety intentionally (latex.js types are unreliable)

---

### 2.2 Component State

```typescript
export function LatexPreview({ latexContent, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // ... rest of component
}
```

**State design:**
- `containerRef`: Direct DOM access for latex.js output
- `error`: Display error boundary without crashing app

---

### 2.3 Runtime Style Injection

```typescript
const styleInjection = `
  .latex-preview { line-height: 1.8 !important; }
  .latex-preview > * + * { margin-top: 1.5em; }
  .latex-preview .katex-display { margin-top: 1.5em !important; }
  .latex-preview p > div { margin-top: 1.5em !important; }
`;

useEffect(() => {
  const styleId = 'latex-preview-dynamic-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = styleInjection;
    document.head.appendChild(style);
  }
}, []); // Run once on mount
```

**Why runtime injection instead of CSS file?**
- Easy to modify without rebuilding
- Uses `!important` to override CSS file
- Can be different per-component (future extensibility)

**The "Lobotomized Owl" selector (`> * + *`):**
```css
.latex-preview > * + * { margin-top: 1.5em; }
```
- `>` = Direct children only
- `*` = Any element type
- `+` = Adjacent sibling
- Result: All elements after the first get `margin-top: 1.5em`

**Example:**
```html
<div class="latex-preview">
  <h2>Introduction</h2>       <!-- No margin-top (first child) -->
  <p>Paragraph 1.</p>          <!-- margin-top: 1.5em (after h2) -->
  <p>Paragraph 2.</p>          <!-- margin-top: 1.5em (after p) -->
  <div class="katex">...</div> <!-- margin-top: 1.5em (after p) -->
</div>
```

---

# Part 3: The Sanitization Pipeline

## Step 3: Extract Complex Elements

### 3.1 Sanitizer Function Skeleton

```typescript
function sanitizeLatexForBrowser(latex: string): SanitizeResult {
  const blocks: Record<string, string> = {};
  let blockCount = 0;
  let bibliographyHtml: string | null = null;
  const citationMap: Record<string, number> = {};

  // Helper: Create placeholder
  const createPlaceholder = (html: string): string => {
    const id = `LATEXPREVIEWBLOCK${blockCount++}`;
    blocks[id] = html;
    return `\n\n${id}\n\n`;
  };

  // ... extraction logic ...

  return { sanitized: finalLatex, blocks, bibliographyHtml };
}
```

**Design pattern:**
1. Extract complex element (Math, TikZ, Table)
2. Render it to HTML using specialized tool (KaTeX, TikZJax, custom parser)
3. Store HTML in `blocks` map with unique ID
4. Replace element in LaTeX with placeholder text (e.g., `LATEXPREVIEWBLOCK0`)
5. latex.js sees simple placeholder text, not complex LaTeX
6. After rendering, we inject HTML back in place of placeholder

---

### 3.2 Strip Preamble

```typescript
let content = latex
  .replace(/^```latex\s*/i, '').replace(/```$/, ''); // Strip markdown fences

// Extract metadata
let extractedTitle = 'Draft Paper';
let extractedAuthor = 'Author';
let extractedDate = '';

const titleMatch = content.match(/\\title\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
if (titleMatch) extractedTitle = titleMatch[1].trim();

const authorMatch = content.match(/\\author\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
if (authorMatch) extractedAuthor = authorMatch[1].trim();

const dateMatch = content.match(/\\date\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
if (dateMatch) {
  extractedDate = dateMatch[1].trim();
  if (extractedDate === '\\today') {
    extractedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

// Extract content between \begin{document} and \end{document}
const docStartRegex = /\\begin\{document\}/;
const docEndRegex = /\\end\{document\}/;
const startMatch = content.match(docStartRegex);
const endMatch = content.match(docEndRegex);

if (startMatch) {
  let startIndex = startMatch.index! + startMatch[0].length;
  let endIndex = endMatch ? endMatch.index! : content.length;
  content = content.substring(startIndex, endIndex);
} else {
  // Fallback: strip common preamble commands
  content = content
    .replace(/\\documentclass\[.*?\]\{.*?\}/, '')
    .replace(/\\usepackage\{.*?\}/g, '');
}
```

**Why strip preamble?**
- latex.js crashes on most `\usepackage` commands
- We extract metadata (title, author, date) manually
- We rebuild minimal preamble later

---

### 3.3 Extract Math (KaTeX)

```typescript
const createMathBlock = (mathContent: string, displayMode: boolean): string => {
  const id = `LATEXPREVIEWMATH${blockCount++}`;
  try {
    let html = katex.renderToString(mathContent, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
    blocks[id] = html;
  } catch (e) {
    blocks[id] = `<span style="color:red;">Math Error</span>`;
  }
  return displayMode ? `\n\n${id}\n\n` : id;
};

// Extract in order (CRITICAL):
// 1. Structured environments first
content = content.replace(
  /\\begin\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g,
  (m, env, star, math) => createMathBlock(m, true)
);

// 2. Display math \[...\]
content = content.replace(
  /\\\[([\s\S]*?)\\\]/g,
  (m, math) => createMathBlock(math, true)
);

// 3. Inline math \(...\)
content = content.replace(
  /\\\(([\s\S]*?)\\\)/g,
  (m, math) => createMathBlock(math, false)
);

// 4. Inline math $...$
content = content.replace(
  /(?<!\\)\$([^$]+)(?<!\\)\$/g,
  (m, math) => createMathBlock(math, false)
);
```

**Why this order matters:**
- `align*` environment might contain `\\[4pt]` (spacing command)
- If we extract `\[...\]` first, we'd incorrectly match `\\[4pt]` as display math
- Result: `align*` body gets corrupted with placeholder text
- Solution: Extract structured environments before standalone delimiters

**KaTeX rendering:**
- Input: `E = mc^2`
- Output: `<span class="katex"><span class="katex-mathml">...</span><span class="katex-html">...</span></span>`
- Stored in `blocks['LATEXPREVIEWMATH0']`
- LaTeX becomes: `... LATEXPREVIEWMATH0 ...`

---

### 3.4 Extract TikZ (Iframe Isolation)

```typescript
const createTikzBlock = (tikzBody: string, options: string): string => {
  const id = `LATEXPREVIEWTIKZ${blockCount++}`;

  // Build complete HTML page for iframe
  const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
      width: 100%;
    }
    svg {
      max-width: 100% !important;
      height: auto !important;
      display: block;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <script type="text/tikz">
    \\begin{tikzpicture}${options}
      ${tikzBody}
    \\end{tikzpicture}
  </script>
</body>
</html>`;

  const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  blocks[id] = `<div style="display: flex; justify-content: center; width: 100%; margin: 1em 0;">
    <iframe srcdoc="${srcdoc}" style="border: none; width: 100%; overflow: hidden;"></iframe>
  </div>`;

  return `\n\n${id}\n\n`;
};

// Extract TikZ with manual parser (handles nested brackets)
let loopSafety = 0;
while (content.includes('\\begin{tikzpicture}')) {
  if (loopSafety++ > 100) break;

  const startTag = '\\begin{tikzpicture}';
  const endTag = '\\end{tikzpicture}';
  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) break;

  let cursor = startIdx + startTag.length;

  // Skip whitespace
  while (cursor < content.length && /\s/.test(content[cursor])) cursor++;

  // Parse optional arguments [...]
  let options = '';
  if (content[cursor] === '[') {
    const optStart = cursor;
    let depth = 0;
    while (cursor < content.length) {
      const char = content[cursor];
      if (char === '[' || char === '{') depth++;
      else if (char === ']' || char === '}') depth--;
      cursor++;
      if (depth === 0 && content[cursor - 1] === ']') break;
    }
    options = content.substring(optStart, cursor);
  }

  // Find end tag
  const bodyStart = cursor;
  const endIdx = content.indexOf(endTag, cursor);
  if (endIdx === -1) break;

  const body = content.substring(bodyStart, endIdx);
  const placeholder = createTikzBlock(body, options);

  // Replace in content
  content = content.substring(0, startIdx) + placeholder +
            content.substring(endIdx + endTag.length);
}
```

**Why iframe isolation?**
- TikZJax is heavy (loads WASM, fonts, external scripts)
- Runs in separate context (can't crash main page)
- CSS isolation (TikZ styles don't leak to paper)
- Security sandbox

**Iframe srcdoc:**
- Avoids external file dependency
- Inline HTML encoded in attribute
- Renders immediately

---

### 3.5 Extract Tables (Manual Parser)

This is complex. For brevity, the key concept:

```typescript
// Simple example (real implementation is ~200 lines)
content = content.replace(
  /\\begin\{tabular\}\{[^}]+\}([\s\S]*?)\\end\{tabular\}/g,
  (match, body) => {
    // Parse rows: split by \\
    const rows = body.split(/\\\\/).filter(r => r.trim());

    let tableHtml = '<table><tbody>';
    rows.forEach(row => {
      // Parse cells: split by &
      const cells = row.split('&').map(c => c.trim());
      tableHtml += '<tr>';
      cells.forEach(cell => {
        tableHtml += `<td>${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    return createPlaceholder(`<div class="table-wrapper">${tableHtml}</div>`);
  }
);
```

**Real implementation needs:**
- Brace-aware splitting (don't split on `&` inside `\textbf{A & B}`)
- Handle `\hline`, `\toprule`, `\midrule`, `\bottomrule`
- Resolve nested placeholders (math inside cells)
- Support `tabularx`, handle width arguments

---

### 3.6 Extract Bibliography

```typescript
// Build citation map
let nextCitationId = 1;
const bibMatches = Array.from(
  content.matchAll(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g)
);
bibMatches.forEach(m => {
  if (!citationMap[m[1]]) citationMap[m[1]] = nextCitationId++;
});

// Extract bibliography block
content = content.replace(
  /\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g,
  (match) => {
    let listHtml = '<ul class="bib-list">';
    match.replace(
      /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\})/g,
      (m, key, text) => {
        const id = citationMap[key];
        listHtml += `<li><span class="bib-label">[${id}]</span> ${text.trim()}</li>`;
        return '';
      }
    );
    listHtml += '</ul>';
    bibliographyHtml = `<div class="bibliography"><h3>References</h3>${listHtml}</div>`;
    return ''; // Remove from content
  }
);

// Replace citations with numbers
content = content.replace(/\\cite\{([^}]+)\}/g, (m, key) => {
  const keys = key.split(',').map((k: string) => k.trim());
  const validNums = keys
    .map((k: string) => citationMap[k])
    .filter((n: number | undefined): n is number => n !== undefined);
  return validNums.length > 0 ? `[${validNums.join(', ')}]` : '[?]';
});
```

**Design:**
- Extract `\bibitem{ref_1}` entries, assign numbers (1, 2, 3...)
- Convert to HTML list with proper formatting
- Replace `\cite{ref_1,ref_2}` with `[1, 2]` (IEEE style)
- Store bibliography HTML separately (append at end, not via placeholder)

---

### 3.7 Rebuild Minimal LaTeX

```typescript
// Remove dangerous commands
content = content
  .replace(/\\tableofcontents/g, '')
  .replace(/\\listoffigures/g, '')
  .replace(/\\listoftables/g, '')
  .replace(/\\maketitle/g, '')
  .replace(/\\input\{.*?\}/g, '')
  .replace(/\\include\{.*?\}/g, '')
  .replace(/\\label\{.*?\}/g, '')
  .replace(/\\ref\{.*?\}/g, '[?]')
  .replace(/\\footnote\{.*?\}/g, '');

// Build safe preamble
const safePreamble = `
\\documentclass{article}
\\title{${extractedTitle}}
\\author{${extractedAuthor}}
\\date{${extractedDate}}
\\begin{document}
\\maketitle
`;

const finalLatex = safePreamble + content + '\n\\end{document}';

return { sanitized: finalLatex, blocks, bibliographyHtml };
```

**What latex.js receives:**
```latex
\documentclass{article}
\title{My Paper Title}
\author{John Doe}
\date{December 8, 2025}
\begin{document}
\maketitle

\section{Introduction}
Some text here.

LATEXPREVIEWMATH0

\section{Methods}

LATEXPREVIEWTIKZ0

\end{document}
```

**Simple, clean, safe.**

---

# Part 4: Rendering Pipeline

## Step 4: The Main Render Effect

```typescript
useEffect(() => {
  if (!containerRef.current || !latexContent) return;

  const render = () => {
    try {
      setError(null);
      containerRef.current!.innerHTML = ""; // Clear previous

      // Check latex.js loaded
      if (typeof latexjs === 'undefined') {
        throw new Error('LaTeX.js library not loaded.');
      }

      // Step 1: Sanitize
      const { sanitized, blocks, bibliographyHtml } =
        sanitizeLatexForBrowser(latexContent);

      // Step 2: Parse with latex.js
      const generator = new latexjs.HtmlGenerator({ hyphenate: false });

      try {
        const doc = latexjs.parse(sanitized, { generator: generator });
        containerRef.current!.appendChild(generator.domFragment());
      } catch (parseErr: any) {
        console.error("latex.js parse error:", parseErr);

        // Build helpful error message
        let errorMsg = `LaTeX Parse Error: ${parseErr.message}`;

        if (parseErr.location) {
          const loc = parseErr.location;
          errorMsg += `\n\nLocation: Line ${loc.start?.line || '?'}`;

          const lines = sanitized.split('\n');
          if (loc.start?.line && loc.start.line <= lines.length) {
            const lineNum = loc.start.line - 1;
            errorMsg += `\nProblematic line: ${lines[lineNum]}`;
          }
        }

        if (parseErr.message.includes('\\end{document} missing')) {
          errorMsg += `\n\n💡 This usually means latex.js encountered invalid syntax.`;
          errorMsg += `\nThe LaTeX may contain unsupported commands.`;
        }

        throw new Error(errorMsg);
      }

      // Step 3: Inject HTML blocks (next section)
      // ...

    } catch (err: any) {
      console.error("Preview Render Error:", err);
      setError(err.message || 'Unknown error');
    }
  };

  render(); // Run immediately (no setTimeout)

}, [latexContent]); // Re-run when content changes
```

**Why no setTimeout?**
- latex.js is synchronous
- DOM is available immediately after `appendChild`
- `setTimeout` adds race conditions
- Use `requestAnimationFrame` for layout-dependent operations (later)

---

## Step 5: Placeholder Injection

```typescript
// Normalize DOM (merge split text nodes)
containerRef.current!.normalize();

// Walk the DOM tree
const walker = document.createTreeWalker(
  containerRef.current!,
  NodeFilter.SHOW_TEXT, // Only text nodes
  null
);

// Collect text nodes containing placeholders
const nodesToProcess: Text[] = [];
let node: Text | null;
while ((node = walker.nextNode() as Text)) {
  if (node.textContent?.includes('LATEXPREVIEW')) {
    nodesToProcess.push(node);
  }
}

// Replace placeholders with HTML
nodesToProcess.forEach(textNode => {
  const text = textNode.textContent || '';
  const parts = text.split(/(LATEXPREVIEW[A-Z]+[0-9]+)/g);

  if (parts.length <= 1) return; // No placeholders

  const fragment = document.createDocumentFragment();

  // SECRET: Parent Node Surgery
  const parent = textNode.parentElement;
  if (parent && parent.childNodes.length === 1 &&
      parts.length === 3 && !parts[0].trim() && !parts[2].trim()) {
    // Parent contains ONLY placeholder (e.g., <p>LATEXPREVIEWMATH0</p>)
    const key = parts[1];
    if (blocks[key]) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = blocks[key];
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
      parent.replaceWith(fragment); // Replace <p> with <div class="katex-display">
      return;
    }
  }

  // Regular inline replacement
  parts.forEach(part => {
    if (blocks[part]) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = blocks[part];
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
    } else if (part) {
      fragment.appendChild(document.createTextNode(part));
    }
  });

  textNode.replaceWith(fragment);
});

// Append bibliography at end
if (bibliographyHtml) {
  const bibEl = document.createElement('div');
  bibEl.classList.add('bibliography-section');
  bibEl.innerHTML = bibliographyHtml;
  containerRef.current!.appendChild(bibEl);
}
```

**Why "Parent Node Surgery"?**
```html
<!-- Bad: Invalid HTML -->
<p>
  <div class="katex-display">...</div>
</p>

<!-- Good: Valid HTML -->
<div class="katex-display">...</div>
```

**If parent contains ONLY placeholder:**
- Don't inject into parent
- Replace parent entirely with our HTML
- Result: Valid DOM structure

---

## Step 6: Auto-Scaling Wide Elements

```typescript
requestAnimationFrame(() => {
  if (!containerRef.current) return;

  // Find elements that might overflow
  const elements = containerRef.current.querySelectorAll(
    '.katex-display, .table-wrapper'
  );

  elements.forEach((el) => {
    const element = el as HTMLElement;

    // Reset styles to measure true size
    element.style.transform = '';
    element.style.width = '';
    element.style.transformOrigin = 'left center';

    // Check if content overflows container
    if (element.scrollWidth > element.clientWidth) {
      // Calculate scale factor (min 0.55 to keep readable)
      // 0.98 safety buffer prevents pixel-perfect clipping
      const scale = Math.max(
        0.55,
        (element.clientWidth / element.scrollWidth) * 0.98
      );

      if (scale < 1) {
        element.style.transform = `scale(${scale})`;
        element.style.width = `${(100 / scale)}%`;
        element.style.overflowX = 'hidden';
      }
    }
  });
});
```

**Why `requestAnimationFrame`?**
- Browser needs to paint before layout metrics are accurate
- `scrollWidth` and `clientWidth` require layout calculation
- `requestAnimationFrame` runs right after next paint
- No artificial delay, no race condition

**Scaling math:**
```
scrollWidth = 800px (actual content width)
clientWidth = 600px (container width)

scale = (600 / 800) * 0.98 = 0.735

Result:
- transform: scale(0.735) → Visual width = 588px
- width: 136% → Layout width = 816px
- After scaling, 816 * 0.735 ≈ 600px (fits perfectly)
```

**Why expand width to `${100/scale}%`?**
- `transform: scale()` shrinks visually but doesn't change layout space
- Without width adjustment, element stays 600px layout but looks 441px
- Expanding to `136%` makes layout match visual size after scaling

---

# Part 5: Error Handling

## Step 7: Error Display Component

```typescript
if (error) {
  return (
    <div className={`latex-preview ${className}`}>
      <div style={{
        padding: '20px',
        background: '#fff3f3',
        border: '1px solid #ffcccc',
        borderRadius: '4px'
      }}>
        <strong style={{ color: '#cc0000' }}>Preview Render Error</strong>
        <pre style={{
          marginTop: '10px',
          padding: '10px',
          background: '#f9f9f9',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.85em',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}>{error}</pre>
        <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9em' }}>
          💡 <strong>Note:</strong> The preview uses a browser-based renderer
          with limited LaTeX support. Your LaTeX source may still compile
          correctly with a full LaTeX compiler.
        </p>
      </div>
    </div>
  );
}
```

**Design decision:** Don't crash the whole app. Show helpful error message with context.

---

## Step 8: Return Statement

```typescript
return (
  <div
    ref={containerRef}
    className={`latex-preview ${className}`}
  />
);
```

**This div:**
- Receives latex.js output via `appendChild`
- Has `.latex-preview` class (triggers all CSS)
- Initially empty, filled by render effect

---

# Part 6: Integration

## Step 9: Load latex.js Globally

**File:** `client/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- TikZ fonts -->
  <link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">

  <!-- latex.js (CRITICAL: Must load before React) -->
  <script src="/js/latex.js"></script>

  <title>Auto Academic Paper</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Place `latex.js` file in:** `public/js/latex.js`

**Why global script tag?**
- latex.js NPM package is unstable
- Local copy ensures version stability
- Loaded before React, available immediately

---

## Step 10: Use the Component

```typescript
// In your page/component
import { LatexPreview } from '@/components/LatexPreview';

export function PaperView({ latexSource }: { latexSource: string }) {
  return (
    <div className="container">
      <LatexPreview latexContent={latexSource} />
    </div>
  );
}
```

---

# Part 7: Testing & Debugging

## Step 11: Test Cases

### Test 1: Basic Document
```latex
\documentclass{article}
\title{Test Paper}
\author{Test Author}
\date{\today}
\begin{document}
\maketitle

\section{Introduction}
This is a test paragraph.

\section{Methods}
Another paragraph here.

\end{document}
```

**Expected:** Two sections with proper formatting, centered title/author.

---

### Test 2: Math
```latex
\begin{document}

Inline math: $E = mc^2$

Display math:
\[
  \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
\]

Equation environment:
\begin{equation}
  \nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t}
\end{equation}

\end{document}
```

**Expected:** Math rendered by KaTeX, placeholders replaced correctly.

---

### Test 3: TikZ
```latex
\begin{document}

\begin{tikzpicture}
  \node (A) at (0,0) {A};
  \node (B) at (2,0) {B};
  \draw[->] (A) -- (B);
\end{tikzpicture}

\end{document}
```

**Expected:** Diagram in iframe, centered, scaled to fit.

---

### Test 4: Bibliography
```latex
\begin{document}

Citation test \cite{ref_1}.

\begin{thebibliography}{99}
\bibitem{ref_1} Author Name. \textit{Paper Title}. Journal, 2024.
\end{thebibliography}

\end{document}
```

**Expected:** `[1]` in text, bibliography at bottom.

---

## Step 12: Common Issues & Solutions

### Issue 1: "latex.js not defined"
**Symptom:** Console error `latexjs is not defined`

**Solution:**
- Check `<script src="/js/latex.js">` in `index.html`
- Verify file exists at `public/js/latex.js`
- Ensure script loads before React app

---

### Issue 2: Placeholders Not Replaced
**Symptom:** See `LATEXPREVIEWMATH0` in output

**Debug:**
```typescript
console.log('Blocks:', blocks);
console.log('Text nodes found:', nodesToProcess.length);
```

**Common causes:**
- Text node splitting (fixed by `.normalize()`)
- Incorrect regex (check `split(/(LATEXPREVIEW[A-Z]+[0-9]+)/g)`)
- Placeholder not in `blocks` map

---

### Issue 3: Math Not Rendering
**Symptom:** Red "Math Error" or raw LaTeX

**Debug:**
```typescript
try {
  const html = katex.renderToString(mathContent, {
    displayMode,
    throwOnError: true, // Change to true to see error
  });
} catch (e) {
  console.error('KaTeX error:', e);
}
```

**Common causes:**
- Invalid LaTeX syntax (check KaTeX compatibility)
- Missing `katex.css` import
- KaTeX not installed (`npm install katex`)

---

### Issue 4: Styles Not Applying
**Symptom:** Plain unstyled text

**Debug:**
```typescript
useEffect(() => {
  console.log('Style element exists:',
    !!document.getElementById('latex-preview-dynamic-styles'));
}, []);
```

**Common causes:**
- CSS file not imported (`import '@/styles/latex-article.css'`)
- Wrong class name (check `className="latex-preview"`)
- CSS specificity conflict (add `!important` to runtime styles)

---

### Issue 5: Wide Math Overflows
**Symptom:** Horizontal scrollbar on equations

**Debug:**
```typescript
requestAnimationFrame(() => {
  const mathBlocks = containerRef.current!.querySelectorAll('.katex-display');
  mathBlocks.forEach(el => {
    console.log('Math:', {
      scroll: el.scrollWidth,
      client: el.clientWidth,
      overflow: el.scrollWidth > el.clientWidth
    });
  });
});
```

**Common causes:**
- `requestAnimationFrame` not running (check console)
- CSS `overflow-x: auto` overriding `hidden`
- Scale calculation wrong (check math)

---

# Part 8: Advanced Topics

## Optional Enhancement 1: Loading State

```typescript
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const render = () => {
    setIsLoading(true);
    try {
      // ... rendering logic ...
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };
  render();
}, [latexContent]);

if (isLoading) {
  return <div className="latex-preview">Rendering...</div>;
}
```

---

## Optional Enhancement 2: Debounced Updates

```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash';

const debouncedContent = useMemo(
  () => debounce((content) => setRenderedContent(content), 500),
  []
);

useEffect(() => {
  debouncedContent(latexContent);
}, [latexContent]);
```

**Use case:** Live editor with frequent updates (avoid re-rendering every keystroke).

---

## Optional Enhancement 3: Memoized Sanitization

```typescript
import { useMemo } from 'react';

const sanitized = useMemo(
  () => sanitizeLatexForBrowser(latexContent),
  [latexContent]
);
```

**Benefit:** Avoid re-parsing if content hasn't changed.

---

# Checklist: Implementation Complete

- [ ] CSS files created (`latex-article.css`, `latex-base.css`)
- [ ] LatexPreview component created
- [ ] Runtime style injection working
- [ ] Sanitization pipeline implemented (Math, TikZ, Tables)
- [ ] latex.js loaded globally
- [ ] Placeholder injection working
- [ ] Auto-scaling implemented
- [ ] Error handling working
- [ ] Bibliography rendering working
- [ ] Tested with sample documents
- [ ] Console errors cleared
- [ ] Responsive design verified

---

# Summary: Key Principles

1. **Don't trust latex.js** - Extract complex elements first
2. **Placeholders are temporary** - Always replace with real HTML
3. **CSS cascade matters** - Runtime styles need `!important`
4. **Parent Node Surgery** - Maintain valid DOM structure
5. **requestAnimationFrame for layout** - Never `setTimeout`
6. **Graceful degradation** - Show error, don't crash app
7. **Box model is critical** - `box-sizing: border-box` everywhere
8. **Specificity wins** - Last style with equal specificity wins

---

# Resources

- **KaTeX Docs:** https://katex.org/docs/api.html
- **TikZJax:** https://github.com/kisonecat/tikzjax
- **CSS Specificity Calculator:** https://specificity.keegan.st/
- **LaTeX Commands:** https://www.overleaf.com/learn

---

**You now have a complete guide to rebuild the preview system from scratch. Good luck!**
