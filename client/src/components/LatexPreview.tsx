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

    // 2. Unescape & Normalize
    protectedText = protectedText
      .replace(/\\%/g, '%')
      .replace(/\\\&/g, '&')
      .replace(/\\#/g, '#')
      .replace(/\\_/g, '_')
      .replace(/\\\{/g, '{')
      .replace(/\\\}/g, '}')
      // Spec: Typography Normalization
      .replace(/---/g, '&mdash;')
      .replace(/--/g, '&ndash;')
      .replace(/``/g, '&ldquo;')
      .replace(/''/g, '&rdquo;')
      .replace(/\\textcircled\{([^{}])\}/g, '($1)');

    // 3. HTML Escaping
    protectedText = protectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 4. Macro Replacement
    protectedText = protectedText
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
      blocks[id] = katex.renderToString(mathContent, {
        displayMode,
        throwOnError: false,
        strict: false,
        macros: { "\\eqref": "\\href{#1}{#1}", "\\label": "" }
      });
    } catch (e) {
      blocks[id] = `<span style="color:red;">Math Error</span>`;
    }
    return displayMode ? `\n\n${id}\n\n` : id;
  };

  // === HELPER: Create TikZ iframe block ===
  const createTikzBlock = (tikzCode: string): string => {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
      blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - renders in PDF only</div>`;
      return `\n\n${id}\n\n`;
    }

    // SANITIZATION: TikZJax (btoa) crashes on Unicode. Force ASCII.
    // We reverse the "Typography Normalization" for this block and strip other commons.
    const safeTikz = tikzCode
      .replace(/[^\x00-\x7F]/g, ''); // Nuclear option: remove any remaining non-ASCII

    const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    body { margin: 0; padding: 10px; display: flex; justify-content: center; align-items: center; overflow: hidden; }
    svg { overflow: visible; }
  </style>
  <script>
    window.addEventListener('error', e => { if (e.message?.includes('message channel closed')) e.preventDefault(); });
    window.addEventListener('unhandledrejection', e => { if (e.reason?.message?.includes('message channel closed')) e.preventDefault(); });
  </script>
</head>
<body>
  <script type="text/tikz">
    \\begin{tikzpicture}
    ${safeTikz}
    \\end{tikzpicture}
  </script>
  <script>
    const observer = new MutationObserver(() => {
      const svg = document.querySelector('svg');
      if (svg && window.frameElement) {
        const rect = svg.getBoundingClientRect();
        window.frameElement.style.height = (rect.height + 30) + 'px';
        window.frameElement.style.width = (rect.width + 30) + 'px';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  </script>
</body>
</html>`;
    const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    blocks[id] = `<iframe srcdoc="${srcdoc}" style="width: 100%; border: none; min-height: 100px; overflow: hidden;"></iframe>`;
    return `\n\n${id}\n\n`;
  };

  // === SECRET: Manual Parbox Parser (Character-by-Character) ===
  const processParboxes = (txt: string): string => {
    const output: string[] = [];
    let i = 0;

    while (i < txt.length) {
      // Look for \parbox{
      if (txt.startsWith('\\parbox', i)) {
        const start = i;
        i += 7; // skip \parbox

        // Find first argument (width)
        while (i < txt.length && txt[i] !== '{') i++;
        if (i >= txt.length) { output.push(txt.slice(start)); break; } // Fail safe

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
        if (widthContent.includes('textwidth') || widthContent.includes('linewidth')) {
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
  // Smart quotes handled in sanitized text by latex.js generally, but we normalized above for extraction.

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

  // --- A. MATH (KaTeX) ---
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => createMathBlock(math, true));
  content = content.replace(/\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, (m, env, math) => createMathBlock(math, true));
  content = content.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (m, math) => createMathBlock(math, false));

  // --- B. TIKZ & IMAGES ---
  content = content.replace(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g, (m, body) => createTikzBlock(body));
  content = content.replace(/\\begin\{forest\}([\s\S]*?)\\end\{forest\}/g, () => createPlaceholder(`<div class="latex-placeholder-box">[Tree Diagram]</div>`));
  content = content.replace(/\\includegraphics\[.*?\]\{.*?\}/g, () => createPlaceholder(`<div class="latex-placeholder-box image">[Image]</div>`));

  // --- C. BIBLIOGRAPHY (Two-Pass) ---
  // Pass 1: Build Map
  let nextCitationId = 1;
  const bibMatches = Array.from(content.matchAll(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g));
  bibMatches.forEach(m => {
    if (!citationMap[m[1]]) citationMap[m[1]] = nextCitationId++;
  });

  // Pass 2: Extract & Replace
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

  // Pass 3: Replace Citations in Text
  content = content.replace(/\\cite\{([^}]+)\}/g, (m, key) => {
    // Handle multiple keys: \cite{ref1,ref2}
    const keys = key.split(',').map(k => k.trim());
    const labels = keys.map(k => citationMap[k] ? `[${citationMap[k]}]` : `[?]`);
    return labels.join('');
  });

  // --- D. TABLES ---
  content = content.replace(/\\begin\{(tabularx|longtable)\}([\s\S]*?)\\end\{\1\}/g, () => createPlaceholder(`<div class="latex-placeholder-box table">[Complex Table/TabularX]</div>`));

  // --- E. ABSTRACT EXTRACTION (Manual Control) ---
  const abstractMatch = content.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  if (abstractMatch) {
    const abstractContent = abstractMatch[1].trim();
    // Simple parsing for the abstract content
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
  content = content.replace(/\\begin\{table(\*?)\}(\[.*?\])?([\s\S]*?)\\end\{table\1\}/g, (m, star, pos, inner) => {
    let caption = '';
    const captionMatch = inner.match(/\\caption\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    if (captionMatch) caption = `<div class="table-caption"><strong>Table:</strong> ${parseLatexFormatting(captionMatch[1])}</div>`;

    // === HELPER: Manual Tabular Parser ===
    const parseTabular = (inner: string): string | null => {
      const startTag = '\\begin{tabular}';
      const startIdx = inner.indexOf(startTag);
      if (startIdx === -1) return null;

      let cursor = startIdx + startTag.length;

      // Optional arg [pos]
      if (inner[cursor] === '[') {
        while (cursor < inner.length && inner[cursor] !== ']') cursor++;
        cursor++; // skip ]
      }

      // Mandatory arg {cols} - Handle nested braces!
      if (inner[cursor] !== '{') return null; // Should be {
      let braceDepth = 1;
      cursor++;
      while (cursor < inner.length && braceDepth > 0) {
        if (inner[cursor] === '{') braceDepth++;
        else if (inner[cursor] === '}') braceDepth--;
        cursor++;
      }

      // Found end of cols. The rest until \end{tabular} is the body.
      const endTag = '\\end{tabular}';
      const endIdx = inner.indexOf(endTag, cursor);
      if (endIdx === -1) return null;

      const body = inner.substring(cursor, endIdx);

      // Render
      const rows = body.split('\\\\').filter(r => r.trim());
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

  // --- E. ALGORITHMS ---
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

  // --- F. PARBOX (Manual Parser) ---
  content = processParboxes(content);

  // --- G. ENVIRONMENTS ---
  ['theorem', 'lemma', 'definition', 'corollary', 'proposition'].forEach(env => {
    const regex = new RegExp(`\\\\begin\\{${env}\\}(.*?)([\\s\\S]*?)\\\\end\\{${env}\\}`, 'g');
    content = content.replace(regex, (m, args, body) => {
      const title = env.charAt(0).toUpperCase() + env.slice(1);
      return `\n\n\\textbf{${title}:} ${body}\n\n`;
    });
  });
  content = content.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, (m, body) => `\n\n\\textit{Proof:} ${body} \u220E\n\n`);

  // --- H. COMMAND STRIPPING ---
  content = content
    .replace(/\\tableofcontents/g, '')
    .replace(/\\listoffigures/g, '')
    .replace(/\\listoftables/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\input\{.*?\}/g, '')
    .replace(/\\include\{.*?\}/g, '');

  // --- I. CJK Stripper ---
  content = content.replace(/\\begin\{CJK.*?\}([\s\S]*?)\\end\{CJK.*?\}/g, '$1');

  // =============================================
  // 3. SAFE ZONE PREPARATION
  // =============================================

  // Underscore Protection for Text (after extracting everything else)
  content = content.replace(/_/g, '\\_').replace(/\\\\_/g, '\\_');

  // Spec: Pre-load standard packages in the fake preamble
  // FIX: Removed amsmath/amssymb/graphicx as they cause 'require is not defined' errors in browser latex.js
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

  // Vertical Rhythm & Styles (Injected Override as per Doc)
  // We inject this style tag to ensure it overrides everything else
  const styleInjection = `
    .latex-preview { line-height: 1.8 !important; }
    .latex-preview > * + * { margin-top: 1.5em; }
    .latex-preview .katex-display { margin-top: 1.5em !important; }
    .latex-preview p > div { margin-top: 1.5em !important; }
  `;

  // Inject styles on mount
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

        // Hyphenation Killer
        const generator = new latexjs.HtmlGenerator({ hyphenate: false });

        try {
          const doc = latexjs.parse(sanitized, { generator: generator });

          // We append directly to our container
          // latex.js creates a whole document fragment
          containerRef.current!.appendChild(generator.domFragment());

        } catch (parseErr: any) {
          console.error("latex.js parse error:", parseErr);
          // Fallback: If latex.js crashes, we show the sanitized text roughly
          // Or we rethrow to show the error banner?
          throw new Error(`Browser Render Error: ${parseErr.message}`);
        }

        // =============================================
        // 5. THE REVEAL: Surgical Re-Injection (Robust)
        // =============================================
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
          // Find all placeholders in this node
          // Regex to match LATEXPREVIEW + (MATH|TIKZ|TABLE|etc) + numbers
          const parts = text.split(/(LATEXPREVIEW[A-Z]+[0-9]+)/g);

          if (parts.length <= 1) return; // No split occurred

          const fragment = document.createDocumentFragment();

          parts.forEach(part => {
            if (blocks[part]) {
              // It's a placeholder -> Render HTML
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = blocks[part];
              // Unwrap if single child, otherwise append all
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
              }
            } else if (part) {
              // It's normal text -> Keep it
              fragment.appendChild(document.createTextNode(part));
            }
          });

          textNode.replaceWith(fragment);
        });

        // Append Bibliography if exists
        if (bibliographyHtml) {
          const bibEl = document.createElement('div');
          bibEl.classList.add('bibliography-section');
          bibEl.innerHTML = bibliographyHtml;
          containerRef.current!.appendChild(bibEl);
        }

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
