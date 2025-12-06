# Hybrid LaTeX Preview Architecture

The browser-based preview system uses a **Hybrid Rendering Strategy** to overcome the severe limitations of pure JavaScript LaTeX renderers. This architecture ensures that complex academic documents render faithfully in the browser without requiring a server-side PDF compilation for every keystroke.

## The Problem: Why Pure `latex.js` Fails

Client-side libraries like `latex.js` are fundamentally broken for real-world academic LaTeX. Attempting to use them directly is a nightmare scenario.
**Note:** We use a **local, pinned version** of `latex.js` (`/public/js/latex.js`) to ensure stability, as newer NPM versions often introduce breaking changes.

1. **The "House of Cards" Stability**: A single unsupported macro (like `\usepackage{geometry}`) doesn't just look bad—it **crashes the entire renderer**. The user sees a blank screen instead of their document.
2. **No Macro Expansion**: Unlike a real TeX engine, it cannot expand macros. It expects a rigid, pre-defined subset of LaTeX. Standard academic templates (IEEE, ACM) are completely incompatible.
3. **Missing Critical Features**: It has zero support for **TikZ** (diagrams), **tabularx** (tables), or **BibTeX** (citations).
4. **Silent Failures**: When it fails, it often throws obscure JavaScript errors ("undefined is not a function") rather than helpful LaTeX compiler errors.

## The Solution: "The Trojan Horse" Strategy

The secret to our stability is that **we lie to `latex.js`**. We treat it not as a LaTeX engine, but as a dumb text formatter.

We do not trust it with *anything* complex. Instead, we use a multi-stage **Trojan Horse** pipeline:

1. **Sanitization (The Shield)**: We aggressively strip the document of anything that would crash `latex.js` (like the preamble).
2. **Extraction (The Heist)**: We identify complex elements (Math, TikZ, Tables) and **steal them** from the document before `latex.js` sees them.
3. **Placeholder Injection (The Trojan Horse)**: We replace these elements with unique **Placeholder IDs** (e.g., `LATEXPREVIEWTIKZBLOCK1`). `latex.js` happily renders these as simple text.
4. **Surgical Re-Injection (The Reveal)**: After rendering, we use a `TreeWalker` to hunt down our placeholders in the DOM and swap them with high-fidelity outputs from specialized renderers (KaTeX, TikZJax, HTML Tables).

---

## Implementation Details

The logic is encapsulated in `client/src/components/LatexPreview.tsx`.

### 1. The "Nuclear" Preamble Replacement

Professional LaTeX preambles are full of packages that crash browser parsers. We strip the **entire** preamble and replace it with a minimal, safe version.

**Original:**

```latex
\documentclass[12pt]{article}
\usepackage{geometry}
\usepackage{titlesec}
\usepackage{tikz}
...
\begin{document}
```

**Sanitized (fed to latex.js):**

```latex
\documentclass{article}
\title{Extracted Title}
\author{Extracted Author}
\date{Extracted Date}
\begin{document}
```

**Critically**, we do **NOT** include `\usepackage{amsmath}` or other standard packages in this fake preamble, because `latex.js` attempts to load them via `require()` calls that fail in the browser environment. We rely on KaTeX (for math) and our custom logic to handle those features.

### Critical: Extraction Order

> **⚠️ IMPORTANT (v1.2.0)**: The order of extraction matters!

TikZ must be extracted **BEFORE** math because TikZJax handles math natively. If we extract math first, TikZ node labels will contain placeholder text like `LATEXPREVIEWMATH10` instead of actual formulas.

**Correct order:**
1. TikZ & Images
2. Math (KaTeX)
3. Tables
4. Bibliography
5. Everything else

### 2. Math Rendering (KaTeX)

`latex.js` has poor math support. We use **KaTeX**, which is the gold standard for web-based math.

- **Extraction**: Regex finds `\begin{equation}`, `\[...\]`, `\begin{align}`, `\begin{gather}`.
- **Placeholder**: Replaced with `LATEXPREVIEWMATHBLOCK{N}`.
- **Rendering**: The math string is rendered to HTML string using `katex.renderToString()`.
- **Injection**: After `latex.js` finishes, we walk the DOM, find the placeholder text, and replace its parent node with the KaTeX HTML.

### 3. Diagram Rendering (TikZ via Iframe)

TikZ is a Turing-complete vector graphics language. No simple JS library can parse it safely on the main thread.

- **Extraction**: Regex finds `\begin{tikzpicture}` environments.
- **Placeholder**: Replaced with `LATEXPREVIEWTIKZBLOCK{N}`.
- **Rendering**: We construct a complete HTML page that loads **TikZJax** and inject it into an `<iframe>`.
- **Environment Wrapping**: We explicitly wrap the extracted TikZ code in `\begin{tikzpicture} ... \end{tikzpicture}` inside the iframe script tag.
- **Responsive SVG Layout (v1.4.0)**: CSS-driven `max-width: 100%` ensures perfect fit on A4 pages without manual scaling hacks.
- **Centering**: Iframes are wrapped in flexbox containers for horizontal centering.
- **ASCII Sanitization**: We strip non-ASCII characters to prevent `btoa` errors.
- **No Typography Normalization**: We **DO NOT** convert `--` to `–` inside TikZ (breaks path syntax).
- **Isolation**: The `<iframe>` isolates the heavy processing and CSS conflicts.

### 4. Table Rendering (Manual Parsing & Order of Operations)
     
`latex.js` fails on `tabularx`, `booktabs`, and nested formatting in tables.

- **Native TabularX Support (v1.3.1)**: We natively support `tabularx` by parsing it like a standard `tabular` environment. We intentionally **ignore the width argument** and let the browser handle the layout (auto-width), which is superior for responsive HTML.
- **Order of Operations**:
  1. **Standard Tables (`\begin{table}`)**: Must be processed **FIRST**. This allows us to extract the inner `tabular` or `tabularx` content correctly.
  2. **Standalone Tabulars**: Use the same parser to handle tables not wrapped in a float.
  3. **Fallback**: Only after the above are attempted do we "nuke" remaining `tabularx`/`longtable` environments into placeholders.
- **Extraction**: Regex parses standard `tabular` and `tabularx` blocks.
- **Transformation**: We manually parse rows (`\\`) and cells (`&`). We apply basic text formatting to cell contents.
- **Output**: We generate a standard HTML `<table>`.
- **Injection**: `latex.js` sees a placeholder; we swap it for our HTML table.
- **Math Safety (v1.5.4)**: Inner math `LATEXPREVIEWMATH` placeholders are recursively resolved via `resolvePlaceholders()` during cell parsing to ensure formulas appear correctly inside table cells.


### 5. Bibliography Injection

`latex.js` cannot handle BibTeX or complex `thebibliography` environments.

- **Extraction**: We use regex to find all `\bibitem{key}` entries.
- **Map Construction**: We map citation keys (`ref_1`) to labels (`[1]`).
- **Citation Replacement**: We replace `\cite{ref_1}` in the text with `[1]`.
- **Rendering**: We build a clean HTML list (`<ul>`) of references.
- **Injection**: This list is appended to the end of the document container.

### 6. Algorithm Rendering

`latex.js` does not support the `algorithm` or `algpseudocode` packages.

- **Extraction**: Regex finds `\begin{algorithmic}` blocks.
- **Transformation**:
  - Keywords (`\State`, `\If`, `\For`) are replaced with bold HTML equivalents.
  - Indentation is preserved via `<pre>` blocks.
  - Math inside algorithms is parsed via our custom formatter.
- **Output**: A styled code block mimicking the look of academic algorithms.

### 7. Advanced Layout & CSS

To achieve a "What You See Is What You Get" (WYSIWYG) feel, we implement several layout strategies:

- **Parbox Handling**: `\parbox{width}{content}` is parsed and converted to `<div style="width: ...">`, allowing for multi-column layouts often found in academic headers.
- **A4 Page Simulation**: The container uses fixed dimensions (`210mm` width) and padding to simulate a real paper page.
- **Vertical Rhythm**: We use targeted margin strategies on headers (`h1`-`h4`) and lists (`ul`, `ol`, `p + p`) to ensure consistent vertical spacing, mimicking standard LaTeX document classes.

### 8. Text Formatting & Symbol Normalization (Scoped)

To ensure consistent rendering in **manually parsed blocks** (Tables, Algorithms, Parboxes), we perform aggressive normalization of text and symbols *before* generating their HTML replacements. Note: The main document body relies on `latex.js`'s native parser.

- **Order of Operations**:
  1. **Inline Math Extraction**: `$...$` is extracted first to prevent HTML escaping from corrupting math syntax.
  2. **Unescaping**: Common LaTeX escapes (`\%`, `\#`, `\&`) are converted to their character equivalents.
  3. **HTML Escaping**: The remaining text is HTML-escaped (`<` -> `&lt;`) to prevent XSS.
  4. **Macro Replacement**: Standard macros are replaced with HTML:
    - `\textbf{...}` -> `<strong>...</strong>`
    - `\textit{...}` -> `<em>...</em>`
    - `\underline{...}` -> `<u>...</u>`
  5. **Symbol Mapping**: LaTeX symbols are mapped to HTML entities:
    - `\bullet` -> `&#8226;`
    - `\times` -> `&times;`
    - `\checkmark` -> `&#10003;`

### 9. Environment Normalization

`latex.js` does not natively support theorem-like environments (`theorem`, `lemma`, `proof`). We "flatten" these into standard text formatting.

- **Strategy**: Regex replacement converts environments into bold headers.
  - `\begin{theorem} ... \end{theorem}` -> `\textbf{Theorem:} ...`
  - `\begin{proof} ... \end{proof}` -> `\textit{Proof:} ... \u220E` (QED symbol)
- **Benefit**: This allows the content to be rendered perfectly by the basic text engine without requiring complex CSS counters or package support.

### 10. Security & Isolation

Rendering user-generated LaTeX in the browser presents security risks (XSS).

- **TikZ Isolation**: TikZ code is rendered inside a sandboxed `<iframe>` using `srcdoc`. This prevents the TikZ rendering script from accessing the main application's DOM or cookies.
- **HTML Escaping**: All manual text parsing (tables, algorithms) strictly escapes HTML special characters before injection.
- **No External Resources**: The previewer is configured to block loading of external images or scripts (except the trusted TikZJax CDN).

---

## Summary of Capabilities

| Feature | Handled By | Strategy |
| --- | --- | --- |
| **Text & Layout** | `latex.js` | Native rendering of sanitized text. |
| **Math** | **KaTeX** | Extraction -> Placeholder -> Injection. |
| **Diagrams** | **TikZJax** | Extraction -> Iframe Isolation. |
| **Tables** | **Custom Parser** | Regex Parse -> HTML Table Generation. |
| **Citations** | **Custom Parser** | Regex Extract -> HTML List -> Injection. |

---

## 12. Specific Technical Implementations ("Secrets")

This section documents the exact "magic" implementations that solve the hardest problems.

### The "Parbox" Manual Parser

Regex is insufficient for nested braces in LaTeX. To handle `\parbox`, we implemented a **Manual Character-by-Character Parser** (`processParboxes`):

- **Mechanism**: It iterates through the string, tracking brace depth (`{` = +1, `}` = -1).
- **Why**: This allows us to correctly extract the width and content arguments even if the content contains other braces, commands, or environments.
- **Heuristic**: It converts LaTeX lengths like `0.5\textwidth` directly to CSS `width: 50%`.

### Vertical Rhythm Strategy (The "Lobotomized Owl")

We use a specific CSS selector strategy to manage vertical rhythm without complex calculations.

- **Implementation**: This is **injected directly** via a `<style>` tag in `LatexPreview.tsx` to ensure it overrides all other styles.
- **Selector**: `.latex-preview > * + *`
- **Rule**: `margin-top: 1.5em`
- **Effect**: This applies a margin *only* to elements that follow other elements. It ignores the first element and ensures consistent spacing between paragraphs, equations, and figures.
- **Complement**: We also specifically target `.latex-preview .katex-display` and `.latex-preview p > div` with `margin-top: 1.5em !important` to ensure equations and nested blocks obey the rhythm.

### The "Ghost Header" Exorcism

AI models often hallucinate a "References" section header *before* the bibliography, even if one is already generated.

- **The Fix**: A specific regex `(?:\\(?:section|subsection|...)\*?\s*\{\s*(?:References|Bibliography|Works Cited)\s*\})` aggressively hunts down and removes these redundant headers before rendering.

### The "Nuclear" Fallback

If the AI fails to generate a `\begin{document}`, the system doesn't crash.

- **The Safety Net**: It detects the absence of the tag and automatically wraps the entire content in a standard `article`.

### TikZ Iframe "Silence"

The TikZJax library, when running in an iframe, often throws "message channel closed" errors due to browser extension interference.

- **The Silencer**: We inject a specific event listener into the iframe that intercepts `window.error` and `unhandledrejection`. If the error message contains "message channel closed", it is `preventDefault()`'ed and suppressed, keeping the console clean for actual debugging.

---

### 13. Stability Optimizations

This section documents the specific handling of edge cases to ensure render stability.

### The "Math Protection" Protocol (For Manual Parsers)

HTML escaping is destructive to LaTeX math (e.g., `x < y` becomes `x &lt; y`, which breaks KaTeX). When we manually parse blocks (like cell contents in a Table):

- **The Trick**: We use a **Protect-Process-Restore** cycle.
  1. **Extract**: We find all `$math$` and `\[math\]` blocks *first* using regex.
  2. **Tokenize**: We replace them with safe placeholders (`__MATH_BLOCK_0__`, `__MATH_BLOCK_1__`).
  3. **Process**: We perform all HTML escaping and text formatting on the surrounding text.
  4. **Restore**: We swap the tokens back for the original LaTeX before passing it to the renderers.

### The "Parent Node Surgery"

When we inject a block element (like a `<div>` for a chart) into the DOM, `latex.js` often wraps the placeholder text in a `<p>` or `<span>`. Putting a `<div>` inside a `<p>` is invalid HTML and causes layout glitches.

- **The Surgeon**: During the `TreeWalker` injection phase, we check the parent of the placeholder node.
- **The Operation**: If the parent contains *only* our placeholder ID (e.g., `<p>LATEXPREVIEWBLOCK1</p>`), we do not just replace the text. We **replace the entire parent node** with our new content. This ensures clean, valid HTML structure.

### The "CJK Stripper" (Dual Strategy)

`latex.js` crashes if it sees `\begin{CJK}` because it tries to load non-existent font mappings.

- **The Hack**: We use regex to strip the *environment tags* (`\begin{CJK...}`, `\end{CJK}`) but **leave the content intact**.
- **The Result**:
  - **Preview**: The browser's native font fallback mechanism handles the Chinese/Japanese characters perfectly.
  - **PDF**: The tags remain (on the server), ensuring the LaTeX compiler uses the correct `CJKutf8` package for professional typesetting.

### The "Hyphenation Killer"

`latex.js` has a built-in hyphenation engine that is often too aggressive for academic text, leading to awkward breaks.

- **The Config**: We explicitly instantiate the generator with `{ hyphenate: false }`. This forces the browser to handle text wrapping, which is generally superior and more predictable.

---

## 14. The Latex.js Strict Containment Protocol

`latex.js` is the "Single Source of Failure." To mitigate this, we enforce a strict containment protocol.

### What `latex.js` is ALLOWED to Parse (The Safe Zone)

We **only** trust `latex.js` with the simplest, most fundamental text formatting duties:

1. **Core Document Structure**: parsing `\section`, `\subsection`, `\paragraph`.
2. **Basic Text Tokens**: parsing bold (`\textbf`), italic (`\textit`), underline (`\underline`), and monospace (`\texttt`).
3. **Standard Paragraphs**: handling line breaks and paragraph spacing.
4. **Simple Lists**: standard `itemize` and `enumerate` (without complex option arguments).
5. **The "Lobotomized" Preamble**: A fake, hardcoded preamble (`\documentclass{article}`) that we inject.

### What `latex.js` is FORBIDDEN from Touching (The Danger Zone)

We **intercept and remove/replace** these elements because they trigger crashes:

1. **The Real Preamble**: 100% stripped. No `\usepackage`, no custom macros.
2. **Math**: All `$..$` and `\[..\]` are extracted. `latex.js` sees only placeholders.
3. **Tables**: `tabular`, `tabularx`, `longtable` are all intercepted. `latex.js` sees only placeholders.
4. **TikZ Diagrams**: `tikzpicture` is intercepted. `latex.js` sees only placeholders.
5. **Algorithms**: `algorithmic` environments are intercepted. `latex.js` sees only placeholders.
6. **Complex Envs**: `theorem`, `proof`, `lemma` are flattened to text/bold headers. `latex.js` sees only text.
7. **Images**: `\includegraphics` is deleted/replaced. `latex.js` sees only placeholders.
8. **Forest Trees**: `forest` environments are deleted/replaced. `latex.js` sees only placeholders.
9. **BibTeX**: `bibliography` commands are intercepted or stripped.

**Summary**: If it's not simple text or a heading, `latex.js` is **not allowed to see it**.

---

# Part II: The Visual Rendering Engine

This section documents the **CSS Architecture** and **Layout Engine** that powers the visual preview.

## 15. The CSS Trinity (File Architecture)

The styling is strictly separated into three layers, located in `client/src/styles/`:

### 1. `latex-article.css` (The Skin)

This file is the **User-Facing** style controller. It turns a `<div>` into a "Paper".

- **The Container**: `.latex-preview`
  - **Dimensions**: Hardcoded to `width: 210mm` (A4 ISO standard) and `min-height: 297mm`.
  - **Illusion**: Applies `box-shadow: 0 0 15px rgba(0, 0, 0, 0.1)` to make it "pop" from the background.
  - **Margins**: `padding: 25mm` duplicates standard LaTeX article margins.
  - **Background**: Forces `background-color: white !important` to override any dark mode app themes.
  - **Injected Overrides**: `LatexPreview.tsx` injects a `<style>` block that adds `line-height: 1.8 !important` (increased from 1.6) and handles the "Lobotomized Owl" spacing.
- **Typography**:
  - **Font Stack**: `'Lora', 'Times New Roman', serif`. This mimics the serif look of academic papers (`Computer Modern` substitute).
  - **Source**: Fonts are imported via Google Fonts: `https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap`.
  - **Overrides**: Uses `!important` extensively to ensure Tailwind's reset styles (`index.css`) do not bleed into the preview.

### 2. `latex-base.css` (The Layout Engine)

This is the **Internal Mechanic**. It emulates the TeX box model using CSS Grid and Flexbox.

- **The Grid System**: The `.page` class defines a grid with named lines:
  
  ```css
  grid-template-columns: [margin-left] var(--marginleftwidth) [body] var(--textwidth) [margin-right] var(--marginrightwidth);
  ```
  
  This allows elements to be placed in the "margin par" or "body" accurately.
- **TeX Variables**: It defines CSS variables that map 1:1 to LaTeX lengths:
  - `--parindent`: `1.5em`
  - `--leftmargini`: `2.5em`
  - `--fboxsep`: `3pt`
- **List Logic**: It handles the deep nesting logic of LaTeX lists (`itemize` within `enumerate`) by calculating margins dynamically:
  
  ```css
  .list .list { --leftmargin: var(--leftmarginii); }
  ```
  

### 3. `latex-katex.css` (The Math)

A standard, unmodified KaTeX stylesheet. It ensures that math fonts (`KaTeX_Main`, `KaTeX_Math`) are loaded and positioned with pixel-perfect accuracy.

## 16. Integration with Tailwind (The Separation)

The application uses Tailwind CSS (`index.css`) for the UI shell (Sidebar, Buttons), but the Preview is **Style-Isolated**.

- **Strategy**: The preview container `.latex-preview` acts as a "CSS Reset Boundary".
- **Conflict Resolution**:
  - `latex-article.css` uses higher specificity and `!important` to win against Tailwind.
  - The `font-serif` variable in `index.css` is set to `"Merriweather"`, but `.latex-preview` forces `"Lora"`.

## 17. Special Visual Secrets

### The "Parbox" Heuristic

`\parbox{0.5\textwidth}{...}` is not natively understood by browsers.

- **The Solution**: Our TS parser extracts the width argument.
- **The Conversion**: It converts `\textwidth` to `100%`, `\columnwidth` to `100%`, and calculates fractions (e.g., `0.3\textwidth` -> `width: 30%`).
- **The Render**: It outputs a `<div class="parbox" style="width: 30%">`.

### The "A4" Responsiveness

While the preview tries to be 210mm wide, it must fit on smaller screens.

- **The Fix**: `max-width: 100%` in `latex-article.css` ensures that if the viewport is narrower than A4, the paper shrinks to fit, while `box-sizing: border-box` ensures padding doesn't break the layout.

### The "Phantom" Elements

To handle LaTeX alignment hacks (like `\phantom{abc}` which takes up space but is invisible), `latex-base.css` defines:

```css
.phantom { visibility: hidden; }
```

This is crucial for aligning equations and table columns precisely as the author intended.

---

## 18. Honest Hacks & Known Limitations

In the spirit of the "Lobotomized Owl," we document our brute-force solutions here. We do not pretend these are "parsers" or "architectures"; they are hacks that work.

### 1. Parbox "Parser" is Relative-Only

The `parbox` width calculator is **blind to absolute units**.

- **Reality**: It strictly looks for `\textwidth`, `\linewidth`, or `\columnwidth`.
- **Limitation**: If a user writes `\parbox{5cm}{...}`, the regex fails to match, and it defaults to `width: 100%`. We do not attempt to convert `cm`, `mm`, or `pt` to pixels.

### 2. Manual Formatting is "Flat"

The `parseLatexFormatting` function used for Tables and Parboxes uses **non-recursive regex**.

- **Reality**: It matches `\textbf{...}` using `[^{}]+`.
- **Limitation**: It **cannot handle nested formatting** (except for Table Rows, which now use `smartSplitRows` to respect brace nesting).
  - `\textbf{Bold}` -> **Bold** (Works)
  - `\textbf{Bold \textit{Italic}}` -> Fails (breaks on the inner brace). The user sees the raw LaTeX commands.

### 3. The Global `any` Dependency

We do not import `latex.js` as a module because the NPM package is unstable.

- **The Hack**: We load it via `<script>` tag in `index.html`.
- **The Code**: We rely on `declare const latexjs: any;` in `LatexPreview.tsx`. We completely bypass TypeScript's safety features for the core renderer.

### 4. Silent Markdown Stripping

Users often paste AI output that includes markdown code fences.

- **The Fix**: We use a brute-force regex replacement at the very start of the pipeline.
- **The Hack**: `content.replace(/^```latex\s*/i, '')`. We silently modify the user's input before processing, assuming any leading backticks are garbage.

---

## 19. Minor Normalizations & Optimizations

These details ensure a polished user experience by handling edge cases.

### Unicode & Typography

We pre-process specific unicode characters, **BUT WE DO NOT APPLY GLOBAL TYPOGRAPHY NORMALIZATION**.

- **Why**: Applying global replacement of `--` to `–` (en-dash) **CORRUPTS TIKZ CODE**. TikZ uses `--` to define paths.
- **The Rule**: Dashes are left as-is. Smart quotes are allowed but not forced.
- **Circled Text**: `\textcircled{x}` is simplified to `(x)`.

---

## 20. Final Architectures (v1.5.2 Refinements)

### Math Auto-Scaling (The "Clean Transform" Strategy)
We abandoned `zoom` (reflow bugs) and `interactive` scaling (visual clutter).
*   **Mechanism**: If `width > 50em`, apply `transform: scale(0.X)` and `width: (100/0.X)%`.
*   **UX**: No hover effects. No magnifying glass. Just a correctly scaled equation that fits the page.
*   **Fallback**: If even 0.55x scale isn't enough, we show a native horizontal scrollbar.

### Header Handling (Valid LaTeX Injection)
We previously injected HTML `<br>` tags to style `\paragraph`. This leaked into `latex.js`.
*   **The Fix**: We now replace `\paragraph{Title}` with:
    ```latex
    \vspace{1em}
    \noindent
    \textbf{Title}
    ```
*   **Result**: `latex.js` sees valid LaTeX and renders it perfectly without artifacts.

### Command Stripping (The "No-Op" List)

Certain commands are actively removed to prevent errors or clutter:

- **File System Access**: `\input{...}` and `\include{...}` are removed because the browser cannot access the server's file system.
- **Metadata Lists**: `\tableofcontents`, `\listoffigures`, `\listoftables` are removed as `latex.js` cannot generate them dynamically without a second pass.
- **Figure Wrappers**: `\begin{figure}` environments are "flattened" (tags removed, content kept) because floating layout logic is handled by CSS, not LaTeX.
- **Captions/Labels**: `\caption`, `\label`, and `\ref` are currently stripped or replaced with `[?]` placeholders to prevent undefined reference errors.

### Fatal Error Handling

If the renderer encounters a catastrophic failure (e.g., `latex.js` throws an exception):

- **The Guard**: A `try-catch` block wraps the entire render process.
- **The UI**: An `Alert` component (shadcn/ui) is rendered in place of the document.

---

## 21. The Dynamic TikZ Engine (Intent-Based Phase 7)

We adhere to the strict "Phase 7" logic documented in `TIKZ_HANDLING.md`. This strategy respects the AI's *intent* (expressed via `node distance`) while ensuring fit and readability.

### 1. The Classifier (The Intent)
We parse the original `node distance` (defaulting to 2.0cm if missing, or 1.8cm if node count > 8).
*   **COMPACT** (Pipeline): `dist < 2.0cm`.
*   **LARGE** (Cycle): `dist >= 2.5cm`.
*   **MEDIUM**: Everything else.

### 2. The Execution Rules
3. **Tables**: `tabular`, `tabularx`, `longtable` are all intercepted. `latex.js` sees only placeholders.
4. **TikZ Diagrams**: `tikzpicture` is intercepted. `latex.js` sees only placeholders.
5. **Algorithms**: `algorithmic` environments are intercepted. `latex.js` sees only placeholders.
6. **Complex Envs**: `theorem`, `proof`, `lemma` are flattened to text/bold headers. `latex.js` sees only text.
7. **Images**: `\includegraphics` is deleted/replaced. `latex.js` sees only placeholders.
8. **Forest Trees**: `forest` environments are deleted/replaced. `latex.js` sees only placeholders.
9. **BibTeX**: `bibliography` commands are intercepted or stripped.

**Summary**: If it's not simple text or a heading, `latex.js` is **not allowed to see it**.

---

# Part II: The Visual Rendering Engine

This section documents the **CSS Architecture** and **Layout Engine** that powers the visual preview.

## 15. The CSS Trinity (File Architecture)

The styling is strictly separated into three layers, located in `client/src/styles/`:

### 1. `latex-article.css` (The Skin)

This file is the **User-Facing** style controller. It turns a `<div>` into a "Paper".

- **The Container**: `.latex-preview`
  - **Dimensions**: Hardcoded to `width: 210mm` (A4 ISO standard) and `min-height: 297mm`.
  - **Illusion**: Applies `box-shadow: 0 0 15px rgba(0, 0, 0, 0.1)` to make it "pop" from the background.
  - **Margins**: `padding: 25mm` duplicates standard LaTeX article margins.
  - **Background**: Forces `background-color: white !important` to override any dark mode app themes.
  - **Injected Overrides**: `LatexPreview.tsx` injects a `<style>` block that adds `line-height: 1.8 !important` (increased from 1.6) and handles the "Lobotomized Owl" spacing.
- **Typography**:
  - **Font Stack**: `'Lora', 'Times New Roman', serif`. This mimics the serif look of academic papers (`Computer Modern` substitute).
  - **Source**: Fonts are imported via Google Fonts: `https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap`.
  - **Overrides**: Uses `!important` extensively to ensure Tailwind's reset styles (`index.css`) do not bleed into the preview.

### 2. `latex-base.css` (The Layout Engine)

This is the **Internal Mechanic**. It emulates the TeX box model using CSS Grid and Flexbox.

- **The Grid System**: The `.page` class defines a grid with named lines:
  
  ```css
  grid-template-columns: [margin-left] var(--marginleftwidth) [body] var(--textwidth) [margin-right] var(--marginrightwidth);
  ```
  
  This allows elements to be placed in the "margin par" or "body" accurately.
- **TeX Variables**: It defines CSS variables that map 1:1 to LaTeX lengths:
  - `--parindent`: `1.5em`
  - `--leftmargini`: `2.5em`
  - `--fboxsep`: `3pt`
- **List Logic**: It handles the deep nesting logic of LaTeX lists (`itemize` within `enumerate`) by calculating margins dynamically:
  
  ```css
  .list .list { --leftmargin: var(--leftmarginii); }
  ```
  

### 3. `latex-katex.css` (The Math)

A standard, unmodified KaTeX stylesheet. It ensures that math fonts (`KaTeX_Main`, `KaTeX_Math`) are loaded and positioned with pixel-perfect accuracy.

## 16. Integration with Tailwind (The Separation)

The application uses Tailwind CSS (`index.css`) for the UI shell (Sidebar, Buttons), but the Preview is **Style-Isolated**.

- **Strategy**: The preview container `.latex-preview` acts as a "CSS Reset Boundary".
- **Conflict Resolution**:
  - `latex-article.css` uses higher specificity and `!important` to win against Tailwind.
  - The `font-serif` variable in `index.css` is set to `"Merriweather"`, but `.latex-preview` forces `"Lora"`.

## 17. Special Visual Secrets

### The "Parbox" Heuristic

`\parbox{0.5\textwidth}{...}` is not natively understood by browsers.

- **The Solution**: Our TS parser extracts the width argument.
- **The Conversion**: It converts `\textwidth` to `100%`, `\columnwidth` to `100%`, and calculates fractions (e.g., `0.3\textwidth` -> `width: 30%`).
- **The Render**: It outputs a `<div class="parbox" style="width: 30%">`.

### The "A4" Responsiveness

While the preview tries to be 210mm wide, it must fit on smaller screens.

- **The Fix**: `max-width: 100%` in `latex-article.css` ensures that if the viewport is narrower than A4, the paper shrinks to fit, while `box-sizing: border-box` ensures padding doesn't break the layout.

### The "Phantom" Elements

To handle LaTeX alignment hacks (like `\phantom{abc}` which takes up space but is invisible), `latex-base.css` defines:

```css
.phantom { visibility: hidden; }
```

This is crucial for aligning equations and table columns precisely as the author intended.

---

## 18. Honest Hacks & Known Limitations

In the spirit of the "Lobotomized Owl," we document our brute-force solutions here. We do not pretend these are "parsers" or "architectures"; they are hacks that work.

### 1. Parbox "Parser" is Relative-Only

The `parbox` width calculator is **blind to absolute units**.

- **Reality**: It strictly looks for `\textwidth`, `\linewidth`, or `\columnwidth`.
- **Limitation**: If a user writes `\parbox{5cm}{...}`, the regex fails to match, and it defaults to `width: 100%`. We do not attempt to convert `cm`, `mm`, or `pt` to pixels.

### 2. Manual Formatting is "Flat"

The `parseLatexFormatting` function used for Tables and Parboxes uses **non-recursive regex**.

- **Reality**: It matches `\textbf{...}` using `[^{}]+`.
- **Limitation**: It **cannot handle nested formatting** (except for Table Rows, which now use `smartSplitRows` to respect brace nesting).
  - `\textbf{Bold}` -> **Bold** (Works)
  - `\textbf{Bold \textit{Italic}}` -> Fails (breaks on the inner brace). The user sees the raw LaTeX commands.

### 3. The Global `any` Dependency

We do not import `latex.js` as a module because the NPM package is unstable.

- **The Hack**: We load it via `<script>` tag in `index.html`.
- **The Code**: We rely on `declare const latexjs: any;` in `LatexPreview.tsx`. We completely bypass TypeScript's safety features for the core renderer.

### 4. Silent Markdown Stripping

Users often paste AI output that includes markdown code fences.

- **The Fix**: We use a brute-force regex replacement at the very start of the pipeline.
- **The Hack**: `content.replace(/^```latex\s*/i, '')`. We silently modify the user's input before processing, assuming any leading backticks are garbage.

---

## 19. Minor Normalizations & Optimizations

These details ensure a polished user experience by handling edge cases.

### Unicode & Typography

We pre-process specific unicode characters, **BUT WE DO NOT APPLY GLOBAL TYPOGRAPHY NORMALIZATION**.

- **Why**: Applying global replacement of `--` to `–` (en-dash) **CORRUPTS TIKZ CODE**. TikZ uses `--` to define paths.
- **The Rule**: Dashes are left as-is. Smart quotes are allowed but not forced.
- **Circled Text**: `\textcircled{x}` is simplified to `(x)`.

---

## 20. Final Architectures (v1.5.2 Refinements)

### Math Auto-Scaling (The "Clean Transform" Strategy)
We abandoned `zoom` (reflow bugs) and `interactive` scaling (visual clutter).
*   **Mechanism**: If `width > 50em`, apply `transform: scale(0.X)` and `width: (100/0.X)%`.
*   **UX**: No hover effects. No magnifying glass. Just a correctly scaled equation that fits the page.
*   **Fallback**: If even 0.55x scale isn't enough, we show a native horizontal scrollbar.

### Header Handling (Valid LaTeX Injection)
We previously injected HTML `<br>` tags to style `\paragraph`. This leaked into `latex.js`.
*   **The Fix**: We now replace `\paragraph{Title}` with:
    ```latex
    \vspace{1em}
    \noindent
    \textbf{Title}
    ```
*   **Result**: `latex.js` sees valid LaTeX and renders it perfectly without artifacts.

### Command Stripping (The "No-Op" List)

Certain commands are actively removed to prevent errors or clutter:

- **File System Access**: `\input{...}` and `\include{...}` are removed because the browser cannot access the server's file system.
- **Metadata Lists**: `\tableofcontents`, `\listoffigures`, `\listoftables` are removed as `latex.js` cannot generate them dynamically without a second pass.
- **Figure Wrappers**: `\begin{figure}` environments are "flattened" (tags removed, content kept) because floating layout logic is handled by CSS, not LaTeX.
- **Captions/Labels**: `\caption`, `\label`, and `\ref` are currently stripped or replaced with `[?]` placeholders to prevent undefined reference errors.

### Fatal Error Handling

If the renderer encounters a catastrophic failure (e.g., `latex.js` throws an exception):

- **The Guard**: A `try-catch` block wraps the entire render process.
- **The UI**: An `Alert` component (shadcn/ui) is rendered in place of the document.

---

## 21. The Dynamic TikZ Engine (Intent-Based Phase 7)

We adhere to the strict "Phase 7" logic documented in `TIKZ_HANDLING.md`. This strategy respects the AI's *intent* (expressed via `node distance`) while ensuring fit and readability.

### 1. The Classifier (The Intent)
We parse the original `node distance` (defaulting to 2.0cm if missing, or 1.8cm if node count > 8).
*   **COMPACT** (Pipeline): `dist < 2.0cm`.
*   **LARGE** (Cycle): `dist >= 2.5cm`.
*   **MEDIUM**: Everything else.

### 2. The Execution Rules

| Intent | Goal | Action |
| :--- | :--- | :--- |
| **COMPACT** | **Fit to A4** | `scale=0.75` (if dense), `transform shape`, `node distance=1.5cm` |
| **LARGE** | **Readability** | `scale=1.0` (or 0.85), `node distance=5cm` (Boosted), `align=center` |
| **MEDIUM** | Balance | Adjust | `scale` (0.8 if ≥6 nodes, else 0.9) + Moderate Dist (1.2x) |

### 3. The "Hybrid" Density Override (v1.5.5)
We discovered that `node distance` is not always a perfect predictor. Some "Cycle" diagrams use `node distance=2cm` (Medium) but pack 50+ words of text into nodes.

- **The Fix**: We calculate `avgLabelTextPerNode`.
- **Rule**: If `avgLabelTextPerNode > 30` (Text Heavy), we **FORCE** the `LARGE` intent rules (Spacing Boost) regardless of the original `node distance`.
- **Global Hoist**: This ensures that even "Compact" diagrams with paragraphs of text get the `x=2.2cm` breathing room they need.

This ensures that "Cycle" diagrams (Large intent) get the massive spacing they need to avoid overlap, while "Pipelines" (Compact intent) are shrunk proportionally.
