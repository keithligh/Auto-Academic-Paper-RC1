/**
 * LatexPreview.tsx
 * 
 * IMPLEMENTS: Hybrid LaTeX Preview Architecture ("The Trojan Horse")
 * VERIFIED: Includes all "Secrets" from the documentation.
 */

import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import '@/styles/latex-katex.css';
import '@/styles/latex-article.css';

// We trust latex.js only as a dumb text formatter for the safe zone.
// We do NOT trust its type definitions.
declare const latexjs: any;

interface LatexPreviewProps {
  latexContent: string;
  className?: string;
}

interface SanitizeResult {
  sanitized: string;
  blocks: Record<string, string>;
  bibliographyHtml: string | null;
}

/**
 * THE TROJAN HORSE SANITIZER
 * 
 * 1. Sanitization (The Shield): Strip dangerous preambles/commands.
 * 2. Extraction (The Heist): Steal complex elements (Math, TikZ, Tables).
 * 3. Injection (The Trojan Horse): Insert safe placeholders.
 */
function sanitizeLatexForBrowser(latex: string): SanitizeResult {
  const blocks: Record<string, string> = {};
  let blockCount = 0;
  let bibliographyHtml: string | null = null;
  const citationMap: Record<string, number> = {}; // Maps 'ref_1' -> 1

  // === HELPER: Create placeholder ===
  const createPlaceholder = (html: string): string => {
    const id = `LATEXPREVIEWBLOCK${blockCount++}`;
    blocks[id] = html;
    return `\n\n${id}\n\n`;
  };

  // === HELPER: Safe Text Formatting for Extracted Blocks ===
  const parseLatexFormatting = (text: string): string => {
    // 1. Protection Protocol: Extract inline math FIRST
    const mathPlaceholders: string[] = [];
    let protectedText = text.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (m, math) => {
      mathPlaceholders.push(katex.renderToString(math, { throwOnError: false }));
      return `__MATH_PROTECT_${mathPlaceholders.length - 1}__`;
    });

    // 2. Unescape LaTeX Special Chars
    protectedText = protectedText
      .replace(/\\%/g, '%')
      .replace(/\\\&/g, '&')
      .replace(/\\#/g, '#')
      .replace(/\\_/g, '_')
      .replace(/\\\{/g, '{')
      .replace(/\\\}/g, '}');

    // 3. HTML Escaping (MUST happen before typography to prevent &ndash; -> &amp;ndash;)
    protectedText = protectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 4. Typography Normalization
    protectedText = protectedText
      .replace(/---/g, '&mdash;')
      .replace(/--/g, '&ndash;')
      .replace(/``/g, '&ldquo;')
      .replace(/''/g, '&rdquo;')
      .replace(/\\textcircled\{([^{}])\}/g, '($1)');

    // 4. Macro Replacement
    protectedText = protectedText
      .replace(/\\eqref\{([^{}]*)\}/g, '(\\ref{$1})') // Sanitization: eqref -> (\ref)
      .replace(/\\ref\{([^{}]*)\}/g, '[$1]') // Sanitization: ref -> [key] (Prevent latex.js lookup issues)
      .replace(/\\label\{([^{}]*)\}/g, '') // Sanitization: Nuke labels (latex.js doesn't need them)
      .replace(/\\url\{([^{}]*)\}/g, '<code>$1</code>') // Sanitization: url -> monospaced text
      .replace(/\\footnote\{([^{}]*)\}/g, ' ($1)') // Sanitization: footnote -> inline text
      .replace(/\\textbf\{([^{}]*)\}/g, '<strong>$1</strong>')
      .replace(/\\textit\{([^{}]*)\}/g, '<em>$1</em>')
      .replace(/\\underline\{([^{}]*)\}/g, '<u>$1</u>')
      .replace(/\\texttt\{([^{}]*)\}/g, '<code>$1</code>')
      .replace(/\\bullet/g, '&#8226;')
      .replace(/~/g, '&nbsp;')
      .replace(/\\times/g, '&times;')
      .replace(/\\checkmark/g, '&#10003;');

    // 5. Restore Math
    return protectedText.replace(/__MATH_PROTECT_(\d+)__/g, (m, idx) => mathPlaceholders[parseInt(idx)]);
  };

  // === HELPER: Create KaTeX math block ===
  const createMathBlock = (mathContent: string, displayMode: boolean): string => {
    const id = `LATEXPREVIEWMATH${blockCount++}`;
    try {
      let html = katex.renderToString(mathContent, {
        displayMode,
        throwOnError: false,
        strict: false,
        macros: { "\\eqref": "\\href{#1}{#1}", "\\label": "" }
      });

      // STRATEGY: Auto-scale long equations to fit container (Auditor Suggestion)
      if (displayMode) {
        // Heuristic: Average char width in KaTeX is ~0.5em.
        // A4 Printable area width is approx 45-50em.
        const estimatedWidthEm = mathContent.length * 0.4; // Conservative estimate
        const maxEm = 50;

        if (estimatedWidthEm > maxEm) {
          const scale = Math.max(0.55, maxEm / estimatedWidthEm); // Floor at 0.55x
          // REVERT: User confirmed 'transform' works for fitting, 'zoom' does not.
          // Restoring transform logic with calculated width.
          html = `<div class="katex-autoscale" style="transform: scale(${scale.toFixed(2)}); transform-origin: left center; width: ${(100 / scale).toFixed(1)}%;">${html}</div>`;
        }
      }

      blocks[id] = html;
    } catch (e) {
      blocks[id] = `<span style="color:red;">Math Error</span>`;
    }
    return displayMode ? `\n\n${id}\n\n` : id;
  };

  // === HELPER: Create TikZ iframe block ===
  const createTikzBlock = (tikzCode: string, options: string = ''): string => {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
      blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - renders in PDF only</div>`;
      return `\n\n${id}\n\n`;
    }

    // SANITIZATION: TikZJax (btoa) crashes on Unicode. Force ASCII.
    let safeTikz = tikzCode
      .replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII

    // SANITIZATION: TikZJax has issues with decoration={...} nested syntax
    // Convert decoration={name,option=value,...} to just decoration=name
    // The .expanded key error occurs when TikZJax tries to process nested decoration options
    // Pattern: decoration={word,anything} -> decoration={word}
    safeTikz = safeTikz.replace(/decoration=\{([a-zA-Z]+),[^}]+\}/g, 'decoration=$1');

    // === DYNAMIC DENSITY REDUCTION ===
    // Count complexity indicators
    const nodeMatches = safeTikz.match(/\\node/g) || [];
    const drawMatches = safeTikz.match(/\\draw/g) || [];
    const arrowMatches = safeTikz.match(/->/g) || [];

    // HEURISTIC: Extract ACTUAL node label text (not TikZ options)
    const nodeLabelMatches = safeTikz.match(/\\node[^;]*\{([^}]*)\}/g) || [];
    let totalLabelText = 0;
    nodeLabelMatches.forEach(match => {
      const labelMatch = match.match(/\{([^}]*)\}$/);
      if (labelMatch) {
        // Remove LaTeX formatting commands from label
        const label = labelMatch[1].replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
        totalLabelText += label.length;
      }
    });
    const avgLabelTextPerNode = nodeMatches.length > 0 ? totalLabelText / nodeMatches.length : 0;

    // Legacy metrics for compatibility
    const rawText = safeTikz.replace(/\\[a-zA-Z]+/g, '').replace(/[{}()\[\]]/g, '');
    const textDensityScore = nodeMatches.length > 0 ? (rawText.length / nodeMatches.length) : 0;
    const isTextHeavy = avgLabelTextPerNode > 40; // Use accurate label-based metric
    const baseComplexity = nodeMatches.length + drawMatches.length + (arrowMatches.length / 2);

    // REFACTOR (v1.5.5): HYBRID INTENT (Phase 7 + Density Override)
    // We analyze the AI's *intent* based on 'node distance', BUT we fallback to 
    // text density if the distance is missing (to catch implicit "Large" layout).
    // See TIKZ_HANDLING.md for the "8.4cm" magic number.

    let intent = 'MEDIUM'; // Default
    let nodeDist = 2.0; // Default assumption if missing

    // 1. EXTRACT INTENT
    const distMatch = options.match(/node distance\s*=\s*([\d\.]+)/);
    if (distMatch) {
      nodeDist = parseFloat(distMatch[1]);
    }

    // 2. CLASSIFY
    if (distMatch) {
      // Explicit intent wins
      if (nodeDist < 2.0) intent = 'COMPACT';
      else if (nodeDist >= 2.5) intent = 'LARGE';
    } else {
      // Implicit intent (Inference)
      if (isTextHeavy) intent = 'LARGE'; // Text-heavy = Cycle = Large
      else if (nodeMatches.length >= 8) intent = 'COMPACT'; // Many nodes = Pipeline = Compact
    }

    // 3. EXECUTE RULES (The Table)
    let extraOpts = '';

    if (intent === 'COMPACT') {
      // GOAL: Fit to A4
      const scale = nodeMatches.length >= 8 ? 0.75 : 0.85;
      if (!options.includes('scale=')) extraOpts += `, scale=${scale}`;
      if (!options.includes('transform shape')) extraOpts += ', transform shape';
      if (!options.includes('node distance')) extraOpts += ', node distance=1.5cm';

    } else if (intent === 'LARGE') {
      // GOAL: Readability
      // Magic Number from Doc: 8.4cm for text-heavy expansions
      const scale = nodeMatches.length >= 6 ? 0.85 : 1.0;
      if (!options.includes('scale=')) extraOpts += `, scale=${scale}`;

      if (!options.includes('node distance')) {
        // If we forced LARGE due to text density, we use the proven magic number
        const targetDist = isTextHeavy ? 8.4 : 5.0;
        extraOpts += `, node distance=${targetDist}cm`;
      } else {
        // If AI set a distance, we allow it but boost it if it's clearly too small for a cycle
        if (nodeDist < 4.0) extraOpts += ', node distance=5cm';
      }

      // Mandatory for Large
      if (!options.includes('text width')) extraOpts += ', every node/.append style={align=center}';

    } else {
      // MEDIUM
      const scale = nodeMatches.length >= 6 ? 0.8 : 0.9;
      if (!options.includes('scale=')) extraOpts += `, scale=${scale}`;
      if (!options.includes('node distance')) extraOpts += ', node distance=2.5cm';
    }

    // Merge logic
    let finalOptions = options.trim();
    if (!finalOptions) {
      finalOptions = extraOpts ? `[${extraOpts.replace(/^,/, '').trim()}]` : '[]';
    } else if (finalOptions.startsWith('[') && finalOptions.endsWith(']')) {
      finalOptions = finalOptions.slice(0, -1) + extraOpts + ']';
    } else {
      finalOptions = `[${finalOptions}${extraOpts}]`;
    }

    const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    /* RESPONSIVE SVG: The Holy Grail */
    body { 
      margin: 0; 
      padding: 0; 
      display: flex; 
      justify-content: center; 
      align-items: flex-start; 
      overflow: hidden; /* Hide scrollbars, let height grow */
      width: 100%;
    }
    svg { 
      width: auto !important; 
      height: auto !important; 
      max-width: 100% !important; 
      display: block;
      margin: 0 auto;
    }
    .tikzjax-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }
  </style>
  <script>
    window.addEventListener('error', e => { if (e.message?.includes('message channel closed')) e.preventDefault(); });
    window.addEventListener('unhandledrejection', e => { if (e.reason?.message?.includes('message channel closed')) e.preventDefault(); });
  </script>
</head>
<body>
  <div class="tikzjax-container">
    <script type="text/tikz">
      \\begin{tikzpicture}${finalOptions}
      ${safeTikz}
      \\end{tikzpicture}
    </script>
  </div>
  <script>
    // Iframe resize logic - HEIGHT ONLY
    // We let the width be 100% (controlled by parent), we only adapt height to fit content.
    const observer = new MutationObserver(() => {
      const svg = document.querySelector('svg');
      if (svg && window.frameElement) {
         // Add a small buffer for tooltips/shadows
         const h = document.body.scrollHeight;
         window.frameElement.style.height = (h + 20) + 'px';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  </script>
</body>
</html>`;
    const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    // Wrapper must be 100% width to allow iframe to fill it
    blocks[id] = `<div style="display: flex; justify-content: center; width: 100%; margin: 1em 0;"><iframe srcdoc="${srcdoc}" style="border: none; width: 100%; overflow: hidden;"></iframe></div>`;
    return `\n\n${id}\n\n`;
  };

  // === SECRET: Manual Parbox Parser (Character-by-Character) ===
  const processParboxes = (txt: string): string => {
    const output: string[] = [];
    let i = 0;

    while (i < txt.length) {
      if (txt.startsWith('\\parbox', i)) {
        const start = i;
        i += 7; // skip \parbox

        // Find first argument (width)
        while (i < txt.length && txt[i] !== '{') i++;
        if (i >= txt.length) { output.push(txt.slice(start)); break; }

        let braceDepth = 1;
        i++; // skip {
        let widthContent = '';
        while (i < txt.length && braceDepth > 0) {
          if (txt[i] === '{') braceDepth++;
          else if (txt[i] === '}') braceDepth--;
          if (braceDepth > 0) widthContent += txt[i];
          i++;
        }

        // Find second argument (content)
        while (i < txt.length && txt[i] !== '{') i++;
        if (i >= txt.length) { output.push(txt.slice(start)); break; }

        braceDepth = 1;
        i++; // skip {
        let boxContent = '';
        while (i < txt.length && braceDepth > 0) {
          if (txt[i] === '{') braceDepth++;
          else if (txt[i] === '}') braceDepth--;
          if (braceDepth > 0) boxContent += txt[i];
          i++;
        }

        // Processing
        let cssWidth = '100%';
        if (widthContent.includes('textwidth') || widthContent.includes('linewidth') || widthContent.includes('columnwidth')) {
          const factor = parseFloat(widthContent) || 1;
          cssWidth = `${factor * 100}%`;
        }

        output.push(createPlaceholder(`<div class="parbox" style="width: ${cssWidth}">${parseLatexFormatting(boxContent)}</div>`));
      } else {
        output.push(txt[i]);
        i++;
      }
    }
    return output.join('');
  };

  // =============================================
  // 1. PREPARE CONTENT
  // =============================================

  // Typography Normalization (Spec compliance)
  let content = latex
    .replace(/^```latex\s*/i, '').replace(/```$/, '');

  // --- 1.1 THE NUCLEAR PREAMBLE REPLACEMENT (Strict Mode) ---
  let extractedTitle = 'Draft Paper';
  let extractedAuthor = 'Author';
  let extractedDate = '';

  const titleMatch = content.match(/\\title\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
  if (titleMatch) extractedTitle = titleMatch[1].trim();
  const authorMatch = content.match(/\\author\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
  if (authorMatch) extractedAuthor = authorMatch[1].trim();
  const dateMatch = content.match(/\\date\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
  if (dateMatch) extractedDate = dateMatch[1].trim();

  // Strip headers
  content = content.replace(/(?:\\(?:section|subsection|subsubsection)\*?\s*\{\s*(?:References|Bibliography|Works Cited)\s*\})/gi, '');

  const docStartRegex = /\\begin\{document\}/;
  const docEndRegex = /\\end\{document\}/;
  const startMatch = content.match(docStartRegex);
  const endMatch = content.match(docEndRegex);

  if (startMatch) {
    let startIndex = startMatch.index! + startMatch[0].length;
    let endIndex = endMatch ? endMatch.index! : content.length;
    content = content.substring(startIndex, endIndex);
  } else {
    content = content.replace(/\\documentclass\[.*?\]\{.*?\}/, '').replace(/\\usepackage\{.*?\}/g, '');
  }

  // =============================================
  // 2. EXTRACTION (THE HEIST)
  // =============================================

  // --- A. TIKZ & IMAGES (MUST BE FIRST!) ---
  // --- A. TIKZ & IMAGES (MUST BE FIRST!) ---
  // AUDIT FIX #1: Manual Extraction for nested brackets in options
  // Old Regex: /\\begin\{tikzpicture\}\s*(\[[\s\S]*?\])?([\s\S]*?)\\end\{tikzpicture\}/g
  // Problem: Fails on [label={[0,1]}]

  let loopSafety = 0;
  while (content.includes('\\begin{tikzpicture}')) {
    if (loopSafety++ > 100) {
      console.error('TikZ extraction loop safety limit reached');
      break;
    }

    const startTag = '\\begin{tikzpicture}';
    const endTag = '\\end{tikzpicture}';
    const startIdx = content.indexOf(startTag);
    if (startIdx === -1) break;

    let cursor = startIdx + startTag.length;

    // 1. Skip whitespace
    while (cursor < content.length && /\s/.test(content[cursor])) cursor++;

    // 2. Parse Optional Arguments [...]
    let options = '';
    if (content[cursor] === '[') {
      const optStart = cursor;
      let depth = 0;
      let inString = false;

      while (cursor < content.length) {
        const char = content[cursor];
        if (char === '"' && content[cursor - 1] !== '\\') inString = !inString;

        if (!inString) {
          if (char === '[' || char === '{') depth++;
          else if (char === ']' || char === '}') depth--;
        }

        cursor++;

        // Break if we closed the main bracket [ ... ]
        if (depth === 0 && content[cursor - 1] === ']') break;
      }
      options = content.substring(optStart, cursor);
    }

    // 3. Find End Tag
    const bodyStart = cursor;
    const endIdx = content.indexOf(endTag, cursor);

    if (endIdx === -1) {
      console.error('Unclosed TikZ environment found');
      break;
    }

    const body = content.substring(bodyStart, endIdx);

    // 4. Create Block
    console.log('TikZ Match (Manual):', { options: options.substring(0, 50), bodyLength: body.length });
    const placeholder = createTikzBlock(body, options);

    // 5. Replace in content (Extract and substitute)
    const blockLen = (endIdx + endTag.length) - startIdx;
    content = content.substring(0, startIdx) + placeholder + content.substring(endIdx + endTag.length);
  }

  content = content.replace(/\\begin\{forest\}([\s\S]*?)\\end\{forest\}/g, () => createPlaceholder(`<div class="latex-placeholder-box">[Tree Diagram]</div>`));
  content = content.replace(/\\includegraphics\[.*?\]\{.*?\}/g, () => createPlaceholder(`<div class="latex-placeholder-box image">[Image]</div>`));

  // --- B. MATH (KaTeX) ---
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => createMathBlock(math, true));
  content = content.replace(/\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, (m, env, math) => createMathBlock(math, true));
  content = content.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (m, math) => createMathBlock(math, false));

  // --- C. BIBLIOGRAPHY (Two-Pass) ---
  let nextCitationId = 1;
  const bibMatches = Array.from(content.matchAll(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g));
  bibMatches.forEach(m => {
    if (!citationMap[m[1]]) citationMap[m[1]] = nextCitationId++;
  });

  content = content.replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g, (match) => {
    let listHtml = '<ul class="bib-list">';
    match.replace(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\})/g,
      (m, key, text) => {
        const id = citationMap[key];
        listHtml += `<li><span class="bib-label">[${id}]</span> ${parseLatexFormatting(text.trim())}</li>`;
        return '';
      }
    );
    listHtml += '</ul>';
    bibliographyHtml = `<div class="bibliography"><h3>References</h3>${listHtml}</div>`;
    return '';
  });

  content = content.replace(/\\cite\{([^}]+)\}/g, (m, key) => {
    const keys = key.split(',').map((k: string) => k.trim());
    const labels = keys.map((k: string) => citationMap[k] ? `[${citationMap[k]}]` : `[?]`);
    return labels.join('');
  });


  // --- E. ABSTRACT EXTRACTION (Manual Control) ---
  const abstractMatch = content.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  if (abstractMatch) {
    const abstractContent = abstractMatch[1].trim();
    const paragraphs = abstractContent.split(/\n\s*\n/).map(p => {
      return `<p>${parseLatexFormatting(p.trim())}</p>`;
    }).join('');

    const abstractHtml = `
      <div class="abstract">
        <div class="abstract-title">Abstract</div>
        ${paragraphs}
      </div>
    `;
    const id = createPlaceholder(abstractHtml);
    content = content.replace(abstractMatch[0], id);
  }

  // --- F. TABLES (Standard) ---
  // MOVED UP: Must process Standard Tables BEFORE Standalone Tables
  content = content.replace(/\\begin\{table(\*?)\}(\[.*?\])?([\s\S]*?)\\end\{table\1\}/g, (m, star, pos, inner) => {
    let caption = '';
    const captionMatch = inner.match(/\\caption\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    if (captionMatch) caption = `<div class="table-caption"><strong>Table:</strong> ${parseLatexFormatting(captionMatch[1])}</div>`;

    // === HELPER: Manual Tabular Parser ===
    const parseTabular = (inner: string): string | null => {
      const startTagTabular = '\\begin{tabular}';
      const startTagTabularX = '\\begin{tabularx}';

      let startIdx = inner.indexOf(startTagTabular);
      let startIdxX = inner.indexOf(startTagTabularX);
      let isTabularX = false;
      let startTag = startTagTabular;

      // Detect which one comes first
      if (startIdxX !== -1) {
        if (startIdx === -1 || startIdxX < startIdx) {
          startIdx = startIdxX;
          startTag = startTagTabularX;
          isTabularX = true;
        }
      }

      if (startIdx === -1) {
        console.warn('parseTabular: Start tag not found in inner content', inner.substring(0, 50));
        return null; // Not a standard tabular
      }

      let cursor = startIdx + startTag.length;
      console.log(`parseTabular: Found ${startTag} at`, startIdx);

      // HELPER: Skip Whitespace
      while (cursor < inner.length && /\s/.test(inner[cursor])) {
        cursor++;
      }

      // Optional arg [pos] - Common to both tabular and tabularx
      if (inner[cursor] === '[') {
        console.log('parseTabular: Found optional arg [');
        while (cursor < inner.length && inner[cursor] !== ']') cursor++;
        cursor++; // skip ]
        // Skip whitespace again after optional arg
        while (cursor < inner.length && /\s/.test(inner[cursor])) {
          cursor++;
        }
      }

      // TabularX SPECIFIC: Mandatory Width Argument {width}
      if (isTabularX) {
        if (inner[cursor] !== '{') {
          console.error('parseTabular: (TabularX) Expected {width} but found', inner[cursor]);
          return null;
        }
        // Skip balanced braces for width
        let braceDepth = 1;
        cursor++;
        while (cursor < inner.length && braceDepth > 0) {
          if (inner[cursor] === '{') braceDepth++;
          else if (inner[cursor] === '}') braceDepth--;
          cursor++;
        }
        // Skip whitespace after width
        while (cursor < inner.length && /\s/.test(inner[cursor])) {
          cursor++;
        }
      }

      console.log('parseTabular: Cursor at char:', inner[cursor], 'Context:', inner.substring(cursor, cursor + 10));

      // Mandatory arg {cols} - Handle nested braces!
      if (inner[cursor] !== '{') {
        console.error('parseTabular: Expected {cols} but found', inner[cursor]);
        return null; // Should be {
      }

      let braceDepth = 1;
      cursor++;
      while (cursor < inner.length && braceDepth > 0) {
        if (inner[cursor] === '{') braceDepth++;
        else if (inner[cursor] === '}') braceDepth--;
        cursor++;
      }

      // Found end of cols. The rest until \end{tabular} is the body.
      const endTag = isTabularX ? '\\end{tabularx}' : '\\end{tabular}';
      const endIdx = inner.indexOf(endTag, cursor);
      if (endIdx === -1) {
        console.error(`parseTabular: End tag ${endTag} not found`);
        return null;
      }

      const body = inner.substring(cursor, endIdx);
      console.log('parseTabular: Successfully extracted body. Length:', body.length);

      // Render
      // AUDIT FIX #2: Smart Row Splitting (Brace-aware)
      const smartSplitRows = (text: string): string[] => {
        const res: string[] = [];
        let buf = '';
        let depth = 0;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (c === '{') depth++;
          else if (c === '}') depth--;

          // Detect \\ at depth 0
          if (depth === 0 && c === '\\' && text[i + 1] === '\\') {
            res.push(buf);
            buf = '';
            i++; // Skip next slash
            continue;
          }
          buf += c;
        }
        if (buf) res.push(buf);
        return res;
      };

      const rows = smartSplitRows(body).filter(r => r.trim());
      let tableHtml = '<table><tbody>';
      rows.forEach(row => {
        let r = row.trim().replace(/\\hline/g, '').replace(/\\cline\{.*?\}/g, '')
          .replace(/\\toprule/g, '').replace(/\\midrule/g, '').replace(/\\bottomrule/g, '');
        if (!r) return;
        tableHtml += '<tr>';
        r.split('&').forEach(cell => {
          tableHtml += `<td>${parseLatexFormatting(cell.trim())}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      return tableHtml;
    };

    const tableHtml = parseTabular(inner);
    if (tableHtml) {
      return createPlaceholder(`<div class="table-wrapper">${caption}${tableHtml}</div>`);
    }
    return createPlaceholder(`<div class="table-wrapper">${caption}<div class="latex-placeholder-box">[Table Body - Parse Failed]</div></div>`);
  });

  // --- G. TABLES (Standalone) ---
  // MOVED DOWN: Naked tabulars defined here.
  const parseStandaloneTabular = (body: string): string => {
    const rows = body.split('\\\\').filter((r: string) => r.trim());
    let tableHtml = '<table><tbody>';
    rows.forEach((row: string) => {
      let r = row.trim().replace(/\\hline/g, '').replace(/\\cline\{.*?\}/g, '')
        .replace(/\\toprule/g, '').replace(/\\midrule/g, '').replace(/\\bottomrule/g, '');
      if (!r) return;
      tableHtml += '<tr>';
      r.split('&').forEach((cell: string) => {
        tableHtml += `<td>${parseLatexFormatting(cell.trim())}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  };

  content = content.replace(
    /\\begin\{tabular\}(?:\[[^\]]*\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}([\s\S]*?)\\end\{tabular\}/g,
    (match: string, body: string) => {
      const tableHtml = parseStandaloneTabular(body);
      return createPlaceholder(`<div class="table-wrapper">${tableHtml}</div>`);
    }
  );

  // --- H. ALGORITHMS ---
  content = content.replace(/\\begin\{algorithmic\}([\s\S]*?)\\end\{algorithmic\}/g, (m, body) => {
    const formatted = body
      .replace(/\\State/g, '<br><strong>State</strong> ')
      .replace(/\\If\{([^{}]*)\}/g, '<br><strong>If</strong> $1 <strong>then</strong>')
      .replace(/\\EndIf/g, '<br><strong>EndIf</strong>')
      .replace(/\\For\{([^{}]*)\}/g, '<br><strong>For</strong> $1 <strong>do</strong>')
      .replace(/\\EndFor/g, '<br><strong>EndFor</strong>');
    return createPlaceholder(`<div class="algorithm-wrapper"><code>${parseLatexFormatting(formatted)}</code></div>`);
  });
  content = content.replace(/\\begin\{algorithm(\*?)\}([\s\S]*?)\\end\{algorithm\1\}/g, '$2');

  // --- I. PARBOX (Manual Parser) ---
  content = processParboxes(content);

  // --- J. ENVIRONMENTS ---
  ['theorem', 'lemma', 'definition', 'corollary', 'proposition'].forEach(env => {
    const regex = new RegExp(`\\\\begin\\{${env}\\}(.*?)([\\s\\S]*?)\\\\end\\{${env}\\}`, 'g');
    content = content.replace(regex, (m, args, body) => {
      const title = env.charAt(0).toUpperCase() + env.slice(1);
      return `\n\n\\textbf{${title}:} ${body}\n\n`;
    });
  });
  content = content.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, (m, body) => `\n\n\\textit{Proof:} ${body} \u220E\n\n`);

  // --- J2. PARAGRAPH/SUBPARAGRAPH ---
  // Ensure they look like headers (Bold, Run-in)
  // Fix: Handle \paragraph*{Title} and optional spaces
  content = content
    .replace(/\\paragraph\*?\{([^{}]*)\}/g, '\n\n\\vspace{1em}\\noindent\\textbf{$1} ')
    .replace(/\\subparagraph\*?\{([^{}]*)\}/g, '\n\n\\noindent\\textbf{$1} ');

  // --- K. COMMAND STRIPPING ---
  content = content
    .replace(/\\tableofcontents/g, '')
    .replace(/\\listoffigures/g, '')
    .replace(/\\listoftables/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\input\{.*?\}/g, '')
    .replace(/\\include\{.*?\}/g, '');

  // --- D. TABLES (Fallback for unparsed TabularX/Longtable) ---
  // MOVED DOWN: Catch-all for things we couldn't parse manually
  content = content.replace(/\\begin\{(tabularx|longtable)\}([\s\S]*?)\\end\{\1\}/g, () => createPlaceholder(`<div class="latex-placeholder-box table">[Complex Table/TabularX (Fallback)]</div>`));

  content = content.replace(/\\begin\{CJK.*?\}([\s\S]*?)\\end\{CJK.*?\}/g, '$1');

  // =============================================
  // 3. SAFE ZONE PREPARATION
  // =============================================

  // Underscore Protection
  content = content.replace(/_/g, '\\_').replace(/\\\\_/g, '\\_');

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
}

export function LatexPreview({ latexContent, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    if (!containerRef.current || !latexContent) return;

    const render = () => {
      try {
        setError(null);
        containerRef.current!.innerHTML = "";

        if (typeof latexjs === 'undefined') {
          throw new Error('LaTeX.js library not loaded.');
        }

        const { sanitized, blocks, bibliographyHtml } = sanitizeLatexForBrowser(latexContent);

        const generator = new latexjs.HtmlGenerator({ hyphenate: false });

        try {
          const doc = latexjs.parse(sanitized, { generator: generator });
          containerRef.current!.appendChild(generator.domFragment());
        } catch (parseErr: any) {
          console.error("latex.js parse error:", parseErr);
          throw new Error(`Browser Render Error: ${parseErr.message}`);
        }

        // AUDIT FIX #3: Normalize DOM to prevent text node splitting
        // Merges adjacent text nodes (e.g. "LATEXPREVIEW" + "BLOCK1") so regex works.
        containerRef.current!.normalize();

        const walker = document.createTreeWalker(
          containerRef.current!,
          NodeFilter.SHOW_TEXT,
          null
        );

        const nodesToProcess: Text[] = [];
        let node: Text | null;
        while ((node = walker.nextNode() as Text)) {
          if (node.textContent?.includes('LATEXPREVIEW')) {
            nodesToProcess.push(node);
          }
        }

        nodesToProcess.forEach(textNode => {
          const text = textNode.textContent || '';
          const parts = text.split(/(LATEXPREVIEW[A-Z]+[0-9]+)/g);

          if (parts.length <= 1) return;

          const fragment = document.createDocumentFragment();

          // SECRET: The Parent Node Surgery
          const parent = textNode.parentElement;
          if (parent && parent.childNodes.length === 1 && parts.length === 3 && !parts[0].trim() && !parts[2].trim()) {
            const key = parts[1];
            if (blocks[key]) {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = blocks[key];
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
              }
              parent.replaceWith(fragment);
              return;
            }
          }

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

        if (bibliographyHtml) {
          const bibEl = document.createElement('div');
          bibEl.classList.add('bibliography-section');
          bibEl.innerHTML = bibliographyHtml;
          containerRef.current!.appendChild(bibEl);
        }

        // FEATURE: Responsive Math (Scale-to-Fit like TikZ)
        // We look for equations that overflow and shrink them (zoom) to fit.
        // This is "responsive" in the sense of fitting the A4 page width.
        const mathBlocks = containerRef.current!.querySelectorAll('.katex-display');
        mathBlocks.forEach((block) => {
          const el = block as HTMLElement;
          // Reset previous scaling
          el.style.transform = '';
          el.style.width = '';

          if (el.scrollWidth > el.clientWidth) {
            const scale = el.clientWidth / el.scrollWidth;
            // Use zoom for simpler flow reflow in Chrome/Edge. 
            // Fallback to transform for others if needed, but zoom is cleaner here.
            // We cap the shrink at 50% to prevent unreadable microscopic text.
            const safeScale = Math.max(scale, 0.5);

            if (safeScale < 1) {
              // @ts-ignore
              el.style.zoom = safeScale;
            }
          }
        });

      } catch (err: any) {
        console.error("Preview Render Error:", err);
        setError(err.message || 'Unknown error');
      }
    };

    const timeoutId = setTimeout(render, 50);
    return () => clearTimeout(timeoutId);

  }, [latexContent]);

  if (error) {
    return (
      <div className={`latex-preview ${className}`}>
        <div style={{ padding: '20px', background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '4px' }}>
          <strong style={{ color: '#cc0000' }}>Preview Notice:</strong>
          <p>{error}</p>
          <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9em' }}>
            The preview uses a simplified browser renderer.
            <strong>Your PDF download will still come out perfectly.</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`latex-preview ${className}`}
    />
  );
}
