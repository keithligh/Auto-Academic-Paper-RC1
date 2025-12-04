/*
 * GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content.
 * ALWAYS USE write_to_file.
 * REASON: THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. THIS IS A PLATFORM BUG.
 */
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import katex from 'katex';
import 'katex/dist/katex.min.css';

// latex.js loaded via local script in index.html
declare const latexjs: any;
declare global {
  interface Window {
    tikzJaxTimeout: any;
  }
}

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
 * LaTeX sanitization for browser-based latex.js rendering.
 * 
 * TESTED CAPABILITIES (based on actual browser testing):
 * ✅ WORKS: Inline math ($...$), Display math (\[...\]), Lists (itemize, enumerate)
 * ✅ WORKS: Equation environments (equation, align, gather) via KaTeX
 * ❌ FAILS: tables, verbatim, TikZ (handled via iframes)
 */
function sanitizeLatexForBrowser(latex: string): SanitizeResult {
  const blocks: Record<string, string> = {};
  let blockCount = 0;
  let bibliographyHtml: string | null = null;

  // Helper for math blocks
  const replaceWithMathBlock = (match: string, math: string) => {
    const id = `LATEXPREVIEWMATHBLOCK${blockCount++}`;
    // Store the raw math content
    blocks[id] = math;
    // Return the ID surrounded by newlines to ensure it's treated as a text block
    return `\n\n${id}\n\n`;
  };

  // Helper to create a placeholder block
  const createPlaceholder = (content: string) => {
    const id = `LATEXPREVIEWBLOCK${blockCount++}`;
    blocks[id] = content;
    return `\n\n${id}\n\n`;
  };

  // Helper to create a "Raw Code Block" for unsupported features (NO FAKE PLACEHOLDERS)
  const createUnsupportedBlock = (name: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return createPlaceholder(`
      <div class="unsupported-feature" style="border: 1px dashed #f59e0b; background: #fffbeb; padding: 12px; border-radius: 4px; margin: 1em 0;">
        <div style="color: #b45309; font-weight: bold; font-size: 0.9em; margin-bottom: 8px;">
          ⚠️ Browser Preview: '${name}' not supported
        </div>
        <pre style="font-family: monospace; font-size: 0.8em; overflow-x: auto; background: rgba(255,255,255,0.5); padding: 8px;">${escaped}</pre>
        <div style="color: #92400e; font-size: 0.8em; margin-top: 8px; font-style: italic;">
          (This content is preserved and will render correctly in the final PDF)
        </div>
      </div>
    `);
  };

  // Helper for TikZ blocks
  const replaceWithTikzBlock = (match: string, code: string) => {
    // FEATURE DETECTION: Check for unsupported TikZ libraries/environments
    // pgfplots and axis are NOT supported by the lightweight tikzjax
    if (code.includes("\\begin{axis}") || code.includes("\\begin{pgfplots}") || code.includes("\\addplot")) {
      return createUnsupportedBlock("Complex Diagram (pgfplots)", code);
    }

    const id = `LATEXPREVIEWTIKZBLOCK${blockCount++}`;

    // Construct the iframe content
    // We use a data URI or srcdoc to isolate the TikZ environment
    // CRITICAL: We use single quotes for data-tex-packages to wrap the JSON, 
    // ensuring it remains valid after srcdoc unescaping.
    const iframeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
          <script src="https://tikzjax.com/v1/tikzjax.js"></script>
          <style>
            body { margin: 0; padding: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100%; }
            svg { overflow: visible; display: block; margin: 0 auto; }
          </style>
          <script>
            // Suppress "message channel closed" errors which are common with iframes/extensions
            window.addEventListener('error', function(e) {
              if (e.message && e.message.includes('message channel closed')) {
                e.preventDefault();
                e.stopPropagation();
              }
            });
            window.addEventListener('unhandledrejection', function(e) {
              if (e.reason && e.reason.message && e.reason.message.includes('message channel closed')) {
                e.preventDefault();
                e.stopPropagation();
              }
            });
          </script>
      </head>
      <body>
          <script type="text/tikz" data-tex-packages='{"pgfplots":""}'>
              ${code}
          </script>
          <script>
            // Auto-resize iframe based on SVG content
            const observer = new MutationObserver(() => {
              const svg = document.querySelector('svg');
              if (svg) {
                const rect = svg.getBoundingClientRect();
                // Send new height to parent
                if (window.frameElement) {
                    window.frameElement.style.height = (rect.height + 20) + 'px';
                    window.frameElement.style.width = (rect.width + 20) + 'px';
                }
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
          </script>
      </body>
      </html>
    `;

    // Escape for srcdoc
    // This turns " into &quot;
    // So '{"pgfplots":""}' becomes '{&quot;pgfplots&quot;:&quot;&quot;}'
    // Inside srcdoc="..." this is valid.
    // Browser unescapes to '{"pgfplots":""}' which is valid HTML attribute.
    const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    blocks[id] = `<iframe srcdoc="${srcdoc}" class="tikz-iframe" style="width: 100%; min-height: 100px; border: none; margin: 1.5em auto; display: block; overflow: hidden;"></iframe>`;
    return `\n\n${id}\n\n`;
  };

  // Helper to parse basic LaTeX formatting inside cells
  const parseLatexFormatting = (text: string): string => {
    // 0. Handle inline math first (using KaTeX)
    // We use a placeholder to protect it from HTML escaping
    const mathBlocks: string[] = [];
    // FIX: Use negative lookbehind to avoid matching escaped dollars \$
    let processed = text.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (match, math) => {
      try {
        const html = katex.renderToString(math, { throwOnError: false, displayMode: false });
        mathBlocks.push(html);
        return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
      } catch (e) {
        return match;
      }
    });

    // 1. Unescape common LaTeX special characters
    processed = processed
      .replace(/\\([%#_{}$])/g, (match, char) => char) // \% -> %, \# -> #, \$ -> $, etc.
      .replace(/\\&/g, '&')           // \& -> &
      .replace(/\\textbackslash/g, '\\');

    // 2. HTML Escape
    processed = processed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 3. Formatting
    processed = processed
      .replace(/\\textbf\{([^{}]+)\}/g, '<strong>$1</strong>')
      .replace(/\\textit\{([^{}]+)\}/g, '<em>$1</em>')
      .replace(/\\texttt\{([^{}]+)\}/g, '<code>$1</code>')
      .replace(/\\underline\{([^{}]+)\}/g, '<u>$1</u>')
      // Spacing
      .replace(/\\quad/g, '&emsp;')
      .replace(/\\qquad/g, '&emsp;&emsp;')
      .replace(/\\,/g, '&thinsp;')
      // Common table symbols (fallback if not in math mode)
      .replace(/\\bullet/g, '&#8226;')
      .replace(/\\circ/g, '&#9675;')
      .replace(/\\checkmark/g, '&#10003;')
      .replace(/\\times/g, '&times;')
      .replace(/\\textcolor\{([^}]+)\}\{([^}]*)\}/g, '<span style="color: $1">$2</span>');

    // 4. Restore math
    processed = processed.replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => {
      return mathBlocks[parseInt(index)];
    });

    return processed;
  };

  let content = latex;
  content = content.replace(/^```latex\s*/i, '');
  content = content.replace(/^```\s*/i, '');
  content = content.replace(/```\s*$/, '');
  content = content.trim();

  // === PREAMBLE & PACKAGES ===
  // Remove ONLY unsupported packages and commands
  content = content
    // Strip standard packages that cause 'require is not defined' in browser
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '')
    .replace(/\\usetikzlibrary\{[^}]*\}/g, '')
    // We keep \newtheorem as it might be needed, but if it fails we can strip it later.
    .replace(/\\newtheorem\{[^}]*\}\{[^}]*\}/g, '');

  // === SANITIZE TIKZ CRASHERS ===
  // tikzjax crashes on \maxwidth, \textwidth, and complex math units like {3*0.8}cm
  // We replace them with safe fixed values for the preview.
  content = content
    .replace(/\\maxwidth/g, '10cm')
    .replace(/\\textwidth/g, '10cm')
    .replace(/\\columnwidth/g, '10cm')
    // Replace complex math units: {number*number}cm -> 5cm (safe fallback)
    .replace(/\{[\d\.]+\*[\d\.]+\}cm/g, '5cm')
    // Replace specific pattern seen in logs: {\maxwidth*0.8}cm -> 8cm
    .replace(/\{\\maxwidth\*[\d\.]+\}cm/g, '8cm');

  // === ENVIRONMENT STRIPPING ===
  // latex.js doesn't support CJK or theorem-like environments, so we strip the wrappers but keep content
  content = content
    .replace(/\\begin\{CJK\}\{[^}]*\}\{[^}]*\}/g, '')
    .replace(/\\end\{CJK\}/g, '')
    // Replace theorem-like environments with LaTeX formatting (latex.js will render these)
    .replace(/\\begin\{theorem\}/g, '\n\n\\textbf{Theorem:} ')
    .replace(/\\end\{theorem\}/g, '\n')
    .replace(/\\begin\{lemma\}/g, '\n\n\\textbf{Lemma:} ')
    .replace(/\\end\{lemma\}/g, '\n')
    .replace(/\\begin\{proposition\}/g, '\n\n\\textbf{Proposition:} ')
    .replace(/\\end\{proposition\}/g, '\n')
    .replace(/\\begin\{corollary\}/g, '\n\n\\textbf{Corollary:} ')
    .replace(/\\end\{corollary\}/g, '\n')
    .replace(/\\begin\{definition\}/g, '\n\n\\textbf{Definition:} ')
    .replace(/\\end\{definition\}/g, '\n')
    .replace(/\\begin\{hypothesis\}/g, '\n\n\\textbf{Hypothesis:} ')
    .replace(/\\end\{hypothesis\}/g, '\n')
    .replace(/\\begin\{remark\}/g, '\n\n\\textbf{Remark:} ')
    .replace(/\\end\{remark\}/g, '\n')
    .replace(/\\begin\{proof\}/g, '\n\n\\textit{Proof:} ')
    .replace(/\\end\{proof\}/g, ' \u220E\n')
    .replace(/\\qed/g, ' \u220E')
    // Handle 'constraint' environment (Fix for crash)
    .replace(/\\begin\{constraint\}/g, '\n\n\\textbf{Constraint:} ')
    .replace(/\\end\{constraint\}/g, '\n')

    // Handle Algorithms (simple code block fallback)
    .replace(/\\begin\{algorithm\}(?:\[.*?\])?/g, '')
    .replace(/\\end\{algorithm\}/g, '')
    .replace(/\\begin\{algorithmic\}(?:\[.*?\])?([\s\S]*?)\\end\{algorithmic\}/g, (match, code) => {
      // 1. Pre-process operators to ensure they work in both text and math mode
      let clean = code
        .replace(/\\OR/gi, '\\textbf{or}')
        .replace(/\\AND/gi, '\\textbf{and}')
        .replace(/\\NOT/gi, '\\textbf{not}')
        .replace(/\\TRUE/gi, '\\textbf{true}')
        .replace(/\\FALSE/gi, '\\textbf{false}')
        .replace(/\\neq/g, '≠')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥');

      // 2. Parse math and basic formatting
      clean = parseLatexFormatting(clean);

      // 3. Replace algorithmic keywords
      clean = clean
        .replace(/\\State/gi, '\n')
        .replace(/\\If/gi, '<strong>If</strong>')
        .replace(/\\EndIf/gi, '<strong>EndIf</strong>')
        .replace(/\\ElsIf/gi, '<strong>ElseIf</strong>')
        .replace(/\\Else/gi, '<strong>Else</strong>')
        .replace(/\\For/gi, '<strong>For</strong>')
        .replace(/\\EndFor/gi, '<strong>EndFor</strong>')
        .replace(/\\While/gi, '<strong>While</strong>')
        .replace(/\\EndWhile/gi, '<strong>EndWhile</strong>')
        .replace(/\\Require/gi, '<strong>Require:</strong>')
        .replace(/\\Ensure/gi, '<strong>Ensure:</strong>')
        .replace(/\\Procedure\{([^}]*)\}\{([^}]*)\}/gi, '<strong>Procedure</strong> $1($2)')
        .replace(/\\EndProcedure/gi, '<strong>EndProcedure</strong>')
        .replace(/\\Call\{([^}]*)\}\{([^}]*)\}/gi, '$1($2)')
        .replace(/\\Return/gi, '<strong>Return</strong>');

      return createPlaceholder(`<pre class="code-block whitespace-pre-wrap break-words font-mono text-sm bg-muted/30 p-4 rounded-md"><strong>Algorithm:</strong>\n${clean}</pre>`);
    });

  // === DOCUMENT STRUCTURE & METADATA ===
  // Extract metadata before stripping preamble
  const titleMatch = content.match(/\\title\{((?:[^{}]|\{[^{}]*\})*)\}/);
  const authorMatch = content.match(/\\author\{((?:[^{}]|\{[^{}]*\})*)\}/);
  const dateMatch = content.match(/\\date\{((?:[^{}]|\{[^{}]*\})*)\}/);

  const title = titleMatch ? parseLatexFormatting(titleMatch[1]) : '';
  const author = authorMatch ? parseLatexFormatting(authorMatch[1]) : '';
  const date = dateMatch ? parseLatexFormatting(dateMatch[1]) : '';

  // Extract BODY content (between \begin{document} and \end{document})
  const bodyMatch = content.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (bodyMatch) {
    content = bodyMatch[1];
  } else {
    // Fallback: just strip preamble commands if no document env found
    content = content.replace(/\\documentclass\[.*?\]\{.*?\}/, '');
  }

  // Strip \maketitle (we will render it manually)
  content = content.replace(/\\maketitle/g, '');

  // Convert abstract environment to a section
  content = content.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (match, absContent) => {
    return `\\section*{Abstract}\n${absContent}`;
  });

  // Prepend Manual Header
  let headerHtml = '';
  if (title) {
    headerHtml += `<div class="latex-title" style="font-size: 2em; font-weight: bold; text-align: center; margin-bottom: 0.5em;">${title}</div>`;
  }
  if (author) {
    headerHtml += `<div class="latex-author" style="font-size: 1.2em; text-align: center; margin-bottom: 0.2em;">${author}</div>`;
  }
  if (date && !date.includes('\\today')) { // Skip \today as it might not parse
    headerHtml += `<div class="latex-date" style="font-size: 1em; text-align: center; margin-bottom: 2em; color: #666;">${date}</div>`;
  } else if (title || author) {
    headerHtml += `<div style="margin-bottom: 2em;"></div>`;
  }

  if (headerHtml) {
    const id = `LATEXPREVIEWHEADER${blockCount++}`;
    blocks[id] = headerHtml;
    content = `\n\n${id}\n\n` + content;
  }

  // === BIBLIOGRAPHY & CITATIONS ===
  const citationMap: Record<string, string> = {};

  // 1. Extract and parse the bibliography (Robust & Simple)
  // We use a whitespace-tolerant regex to find ALL bibliography blocks.
  const allItems: string[] = [];
  const seenKeys = new Set<string>();

  // Regex: \begin{thebibliography} ... \end{thebibliography} (Ultra-Robust)
  content = content.replace(/\\begin\s*\{\s*thebibliography\s*\}[\s\S]*?\\end\s*\{\s*thebibliography\s*\}/gi, (match) => {
    let counter = 1;
    // Strip the wrapper tags to avoid capturing \end{thebibliography} in the last item
    const innerContent = match
      .replace(/^\\begin\s*\{\s*thebibliography\s*\}/i, '')
      .replace(/\\end\s*\{\s*thebibliography\s*\}$/i, '');

    // Regex to capture \bibitem[label]{key} content
    const itemRegex = /\\bibitem\s*(?:\[(.*?)\])?\s*\{([^}]*)\}([\s\S]*?)(?=\\bibitem|$)/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(innerContent)) !== null) {
      const label = itemMatch[1] ? itemMatch[1] : `${counter++}`;
      const key = itemMatch[2].trim();
      const text = itemMatch[3].trim()
        .replace(/\\newblock/g, ' ')
        .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
        .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
        .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
        .replace(/\\url\{([^}]*)\}/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\\doi\{([^}]*)\}/g, 'doi:$1');

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        citationMap[key] = label;
        allItems.push(`<li id="ref-${key}" style="margin-bottom: 0.5em;">
          <span style="font-weight: bold; margin-right: 0.5em;">[${label}]</span>
          ${text}
        </li>`);
      }
    }
    return ''; // Remove the bibliography block ONLY. Headers are handled separately.
  });

  if (allItems.length > 0) {
    bibliographyHtml = `<div class="bibliography-preview" style="margin-top: 3em; padding-top: 2em; border-top: 2px solid #eee;">
      <h2 class="section-title" style="font-size: 16pt; font-weight: bold; margin-bottom: 1em; border-bottom: 1px solid #eee; padding-bottom: 0.5em;">References</h2>
      <ul style="list-style: none; padding: 0;">${allItems.join('')}</ul>
    </div>`;
  }

  // 2. Remove "Ghost Headers" (References, Bibliography, etc.)
  content = content.replace(/(?:\\(?:section|subsection|subsubsection|paragraph|textbf)\*?\s*\{\s*(?:References|Bibliography|Works Cited)\s*\})/gi, '');

  // 3. Replace citations with labels from the map
  const replaceCitation = (match: string, keys: string) => {
    return keys.split(',').map(k => {
      const key = k.trim();
      const label = citationMap[key];
      // NO FAKE: Show missing key explicitly
      return label ? `[${label}]` : `<span style="color: red; font-weight: bold;">[MISSING: ${key}]</span>`;
    }).join(', ');
  };

  content = content
    .replace(/\\cite\{([^}]*)\}/g, replaceCitation)
    .replace(/\\citep\{([^}]*)\}/g, replaceCitation)
    .replace(/\\citet\{([^}]*)\}/g, replaceCitation)
    .replace(/\\bibitem\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '') // Cleanup any stray bibitems
    // Fix formatting issues reported by user
    .replace(/\\label\{[^}]*\}/g, '') // Remove \label{...} as it breaks preview
    .replace(/\\ensuremath\{([^}]*)\}/g, '$$$1$$') // Convert \ensuremath{x} to $x$
    .replace(/\\ensuremath\s*(\\[a-zA-Z]+)/g, '$$$1$$') // Convert \ensuremath\theta to $\theta$
    .replace(/\\ensuremath\s*([a-zA-Z0-9])/g, '$$$1$$') // Convert \ensuremath x to $x$
    .replace(/\\ensuremath/g, '') // Catch-all: Remove stray \ensuremath if arguments failed to match
    //.replace(/\\textcolor\{[^}]+\}\{([^}]*)\}/g, '$1') // REMOVED: Handled in parseLatexFormatting
    .replace(/\\checkmark/g, '✓') // Replace \checkmark with unicode
    .replace(/\\checkmark/g, '✓')
    .replace(/\\smalltriangleup/g, '\\triangle')
    // FIX: latex.js does not support \hfill.
    // We handle the common QED case (right-aligned box) and strip others.
    .replace(/\\hfill\s*\\(\$|\\\(|\\\[)?(square|Box|square)(\$|\\\)|\\])?/gi, (match) => {
      return createPlaceholder('<span style="float:right; font-size: 1.2em;">&#9633;</span>');
    })
    .replace(/\\hfill/g, ' '); // Replace remaining \hfill with space to prevent crash

  // === FIX: UNWRAP TEXT-ONLY EQUATIONS ===
  // The AI sometimes wraps long text sentences in \begin{equation*} \text{...} \end{equation*}.
  // This causes them to render as a single non-breaking line in latex.js, getting cut off.
  // We detect this pattern and unwrap it to normal text (or a blockquote).
  content = content.replace(/\\begin\{equation\*?\}\s*\\text\{((?:[^{}]|\{[^{}]*\})*)\}\s*\\end\{equation\*?\}/g, (match, textContent) => {
    // Recursively parse formatting inside the text
    const html = `<blockquote style="border-left: 4px solid #ccc; margin: 1.5em 10px; padding: 0.5em 10px; color: #555; font-style: italic;">${parseLatexFormatting(textContent)}</blockquote>`;
    return createPlaceholder(html);
  });

  // === EQUATION ENVIRONMENTS ===
  // We manually handle display math to ensure perfect spacing.
  // We replace them with placeholders and render them using KaTeX directly in the post-processing step.
  // KaTeX supports align, gather, etc. in display mode.
  content = content
    .replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, replaceWithMathBlock)
    // NO FAKE: Pass align/gather/multline directly to KaTeX
    .replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{aligned}${body}\\end{aligned}`))
    .replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{gathered}${body}\\end{gathered}`))
    .replace(/\\begin\{eqnarray\*?\}([\s\S]*?)\\end\{eqnarray\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{aligned}${body}\\end{aligned}`))
    .replace(/\\begin\{multline\*?\}([\s\S]*?)\\end\{multline\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{multline}${body}\\end{multline}`))
    .replace(/\\\[([\s\S]*?)\\\]/g, replaceWithMathBlock)
    .replace(/\$\$([\s\S]*?)\$\$/g, replaceWithMathBlock);

  // === FIX: ESCAPE UNDERSCORES IN CITATION KEYS ===
  // latex.js crashes on underscores in text mode (e.g. "ref_1").
  // Since we have already extracted math blocks, it is safe to escape these specific patterns.
  content = content.replace(/ref_(\d+)/g, 'ref\\_$1');

  // === GRAPHICS & DIAGRAMS ===
  // Extract TikZ environments before other graphics processing
  // ROBUST PARSING: Use a loop to handle nested environments correctly.
  // Regex `[\s\S]*?` is non-greedy and fails on nested \begin{tikzpicture}...\end{tikzpicture}
  const processTikzEnvironments = (text: string): string => {
    let result = text;
    // Loop until no more top-level tikzpictures are found
    while (true) {
      const beginMarker = '\\begin{tikzpicture}';
      const endMarker = '\\end{tikzpicture}';
      const startIndex = result.indexOf(beginMarker);

      if (startIndex === -1) break;

      // Find the matching end marker by counting nesting
      let depth = 0;
      let endIndex = -1;
      let searchIndex = startIndex;

      while (searchIndex < result.length) {
        const nextBegin = result.indexOf(beginMarker, searchIndex + 1);
        const nextEnd = result.indexOf(endMarker, searchIndex + 1);

        if (nextEnd === -1) {
          // No closing marker found at all - broken LaTeX
          break;
        }

        if (nextBegin !== -1 && nextBegin < nextEnd) {
          // Found a nested begin before the next end
          depth++;
          searchIndex = nextBegin;
        } else {
          // Found an end
          if (depth === 0) {
            endIndex = nextEnd;
            break; // Found the matching end
          }
          depth--;
          searchIndex = nextEnd;
        }
      }

      if (endIndex !== -1) {
        const fullMatch = result.substring(startIndex, endIndex + endMarker.length);
        const body = result.substring(startIndex + beginMarker.length, endIndex);

        console.log('[LaTeX Preview] Found TikZ diagram (Robust)');
        const replacement = replaceWithTikzBlock(fullMatch, `\\begin{tikzpicture}${body}\\end{tikzpicture}`);

        // Replace the found block and continue searching AFTER the replacement
        // Note: replaceWithTikzBlock returns a unique ID, so we won't find it again.
        result = result.substring(0, startIndex) + replacement + result.substring(endIndex + endMarker.length);
      } else {
        // Could not find matching end, skip this one to avoid infinite loop
        console.warn('[LaTeX Preview] Unclosed TikZ environment found, skipping extraction.');
        break;
      }
    }
    return result;
  };

  content = processTikzEnvironments(content);

  // NO FAKE: Expose unsupported environments as raw code
  content = content
    .replace(/(\\begin\s*\{\s*forest\s*\}[\s\S]*?\\end\s*\{\s*forest\s*\})/g, (match) => createUnsupportedBlock('forest', match))
    .replace(/(\\includegraphics(\[[^\]]*\])?\{[^}]*\})/g, (match) => createUnsupportedBlock('image', match));

  // === CODE BLOCKS ===
  // Convert verbatim and lstlisting to HTML pre blocks
  content = content.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (match: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return createPlaceholder(`<pre class="code-block">${escaped}</pre>`);
  });

  content = content.replace(/\\begin\{lstlisting\}(?:\[.*?\])?([\s\S]*?)\\end\{lstlisting\}/g, (match: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return createPlaceholder(`<pre class="code-block">${escaped}</pre>`);
  });

  // === TABLES ===
  // 0. Convert tabularx to tabular (Standardize for HTML rendering)
  // We strip the width argument and keep the column definition.
  // Robust Regex: Handles optional [pos], spaces, and braces.
  content = content.replace(/\\begin\{tabularx\}(?:\[[^\]]*\])?\s*\{[^}]*\}\s*\{([^}]*)\}/g, '\\begin{tabular}{$1}')
    .replace(/\\end\{tabularx\}/g, '\\end{tabular}');

  // Convert tabular to HTML tables
  content = content.replace(/\\begin\{tabular\}(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?([\s\S]*?)\\end\{tabular\}/g, (match: string, body: string) => {
    const rows = body.split('\\\\').filter((r: string) => r.trim());
    let htmlRows = rows.map((row: string) => {
      let cleanRow = row.replace(/\\hline/g, '').trim();
      if (!cleanRow) return '';

      const cells = cleanRow.split('&').map((c: string) => c.trim());
      const htmlCells = cells.map((c: string) => `<td>${parseLatexFormatting(c)}</td>`).join('');
      return `<tr>${htmlCells}</tr>`;
    }).join('');

    return createPlaceholder(`<div class="table-wrapper"><table><tbody>${htmlRows}</tbody></table></div>`);
  });

  // Clean up remaining table commands
  // NO FAKE: Expose unsupported table environments
  content = content
    .replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, (match: string) => {
      return match.replace(/\\begin\{table\}(\[.*?\])?/g, '').replace(/\\end\{table\}/g, '');
    })
    .replace(/(\\begin\{tabularx\}[\s\S]*?\\end\{tabularx\})/g, (match) => createUnsupportedBlock('tabularx', match))
    .replace(/(\\begin\{longtable\}[\s\S]*?\\end\{longtable\})/g, (match) => createUnsupportedBlock('longtable', match));

  // === FLOATING ENVIRONMENTS ===
  content = content
    .replace(/\\begin\{figure\}(\[[^\]]*\])?\s*/g, '\n')
    .replace(/\\end\{figure\}/g, '\n')
    .replace(/\\caption\{[^}]*\}/g, '')
    .replace(/\\label\{[^}]*\}/g, '')
    // NO FAKE: Show missing ref
    .replace(/\\ref\{([^}]*)\}/g, '<span style="color: red; font-weight: bold;">[MISSING REF: $1]</span>');

  // === SPECIAL COMMANDS ===
  content = content
    .replace(/\\input\{[^}]*\}/g, '')
    .replace(/\\include\{[^}]*\}/g, '')
    //.replace(/\\maketitle/g, '') // Keep maketitle
    .replace(/\\tableofcontents/g, '')
    .replace(/\\listoffigures/g, '')
    .replace(/\\listoftables/g, '')
    // Fix unknown macro \text (amsmath) -> \textrm (standard LaTeX) for latex.js
    .replace(/\\text\{/g, '\\textrm{')
    // Fix unknown macro \theta (must be in math mode) -> $\theta$
    // Use negative lookbehind to avoid double-wrapping if already in math mode ($...$)
    .replace(/(?<!\$)\\theta/g, '$\\theta$');

  // === UNICODE CHARACTERS ===
  content = content
    .replace(/—/g, '---')
    .replace(/–/g, '--')
    .replace(/'/g, "`")
    .replace(/'/g, "'")
    .replace(/"/g, "``")
    .replace(/"/g, "''")
    // Handle \textcircled{x} -> (x)
    .replace(/\\textcircled\{([^{}]+)\}/g, '($1)')

    // === FIX: BRACKET AMBIGUITY ===
    // latex.js crashes if a line starts with [ (interpreted as optional arg to previous command)
    // We wrap [ in {} to force it as text: {[}
    .replace(/(^|\n)\s*\[/g, '$1{[}')
    // Also replace \\ with \newline to avoid \\[ ambiguity
    .replace(/\\\\/g, '\\newline');

  // Robustly handle \parbox{width}{content} -> <div style="width:...">content</div>
  const processParboxes = (latex: string): string => {
    let result = latex;
    if (!result.includes('\\parbox')) return result;

    while (true) {
      const idx = result.indexOf('\\parbox');
      if (idx === -1) break;

      let curr = idx + 7;
      while (curr < result.length && /\s/.test(result[curr])) curr++;

      // Skip optional args [pos]
      for (let i = 0; i < 3; i++) {
        if (curr < result.length && result[curr] === '[') {
          let depth = 0;
          let endOpt = -1;
          for (let j = curr; j < result.length; j++) {
            if (result[j] === '[') depth++;
            else if (result[j] === ']') depth--;
            if (depth === 0) { endOpt = j; break; }
          }
          if (endOpt !== -1) {
            curr = endOpt + 1;
            while (curr < result.length && /\s/.test(result[curr])) curr++;
          } else break;
        } else break;
      }

      // Extract Arg 1 (width)
      let width = '';
      let endArg1 = -1;
      if (curr < result.length && result[curr] === '{') {
        let depth = 0;
        for (let j = curr; j < result.length; j++) {
          if (result[j] === '{') depth++;
          else if (result[j] === '}') depth--;
          if (depth === 0) { endArg1 = j; break; }
        }
        if (endArg1 !== -1) {
          width = result.substring(curr + 1, endArg1);
          curr = endArg1 + 1;
          while (curr < result.length && /\s/.test(result[curr])) curr++;
        } else {
          // Malformed, just strip command
          result = result.substring(0, idx) + result.substring(idx + 7);
          continue;
        }
      } else {
        result = result.substring(0, idx) + result.substring(idx + 7);
        continue;
      }

      // Extract Arg 2 (content)
      let content = '';
      let endArg2 = -1;
      if (curr < result.length && result[curr] === '{') {
        let depth = 0;
        for (let j = curr; j < result.length; j++) {
          if (result[j] === '{') depth++;
          else if (result[j] === '}') depth--;
          if (depth === 0) { endArg2 = j; break; }
        }
        if (endArg2 !== -1) {
          content = result.substring(curr + 1, endArg2);

          // Process width to CSS
          let cssWidth = width;
          if (width.includes('\\textwidth') || width.includes('\\linewidth') || width.includes('\\columnwidth')) {
            // Simple heuristic: 0.5\textwidth -> 50%
            const match = width.match(/^([\d\.]+)\\/);
            if (match) {
              const val = parseFloat(match[1]);
              cssWidth = `${val * 100}%`;
            } else {
              cssWidth = '100%';
            }
          }

          // Process content (basic formatting)
          const htmlContent = parseLatexFormatting(content);

          // Create placeholder
          const placeholder = createPlaceholder(
            `<div class="latex-parbox" style="width: ${cssWidth};">${htmlContent}</div>`
          );

          result = result.substring(0, idx) + placeholder + result.substring(endArg2 + 1);
        } else {
          result = result.substring(0, idx) + result.substring(idx + 7);
        }
      } else {
        result = result.substring(0, idx) + result.substring(idx + 7);
      }
    }
    return result;
  };

  // Process parboxes to fix diagram layout
  content = processParboxes(content);

  return { sanitized: content, blocks, bibliographyHtml };
}



export function LatexPreview({ latexContent, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !latexContent) return;

    const render = () => {
      try {
        setError(null);
        containerRef.current!.innerHTML = "";

        if (typeof latexjs === 'undefined') {
          throw new Error('LaTeX.js library not loaded. Check index.html script tags.');
        }

        console.log('[LaTeX Preview] Starting render...');

        // Sanitize content for browser compatibility
        const { sanitized, blocks, bibliographyHtml } = sanitizeLatexForBrowser(latexContent);
        console.log('[LaTeX Preview] Sanitized content length:', sanitized.length);
        console.log('[LaTeX Preview] Sanitized tail:', sanitized.slice(-200));

        // --- DIAGNOSTICS ---
        const diagnoseLatex = (tex: string) => {
          const openBraces = (tex.match(/\{/g) || []).length;
          const closeBraces = (tex.match(/\}/g) || []).length;
          if (openBraces !== closeBraces) {
            console.warn(`[LaTeX Preview] Brace mismatch! Open: ${openBraces}, Close: ${closeBraces}`);
          }

          const begins = Array.from(tex.matchAll(/\\begin\{([^}]+)\}/g)).map(m => m[1]);
          const ends = Array.from(tex.matchAll(/\\end\{([^}]+)\}/g)).map(m => m[1]);

          const beginCounts: Record<string, number> = {};
          begins.forEach(b => beginCounts[b] = (beginCounts[b] || 0) + 1);
          ends.forEach(e => {
            if (beginCounts[e]) beginCounts[e]--;
            else console.warn(`[LaTeX Preview] Orphan \\end{${e}}`);
          });
          Object.entries(beginCounts).forEach(([env, count]) => {
            if (count > 0) console.warn(`[LaTeX Preview] Unclosed \\begin{${env}} (Count: ${count})`);
          });

          if (/%.*\\end\{document\}/.test(tex)) {
            console.warn('[LaTeX Preview] \\end{document} appears to be commented out!');
          }
        };
        diagnoseLatex(sanitized);
        // -------------------

        // Safety check: Ensure \end{document} exists
        let finalLatex = sanitized;
        // REMOVED: We now strip the document environment, so we don't need to enforce \end{document}
        // if (!/(^|[^\\])\\end\{document\}/.test(finalLatex)) {
        //   console.warn('[LaTeX Preview] Valid \\end{document} missing. Appending it.');
        //   finalLatex += '\n\\end{document}';
        // }

        // Create generator and parse
        const generator = new latexjs.HtmlGenerator({
          hyphenate: false,
          fontPth: '/fonts/'
        });
        latexjs.parse(finalLatex, { generator: generator });

        // Apply styles
        const styles = generator.stylesAndScripts("");
        if (styles && typeof styles.forEach === 'function') {
          styles.forEach((style: HTMLElement) => {
            if (!document.head.contains(style)) {
              document.head.appendChild(style);
            }
          });
        }

        // Render
        const fragment = generator.domFragment();
        containerRef.current!.appendChild(fragment);

        // === BIBLIOGRAPHY INJECTION ===
        if (bibliographyHtml) {
          const bibDiv = document.createElement('div');
          bibDiv.innerHTML = bibliographyHtml;
          while (bibDiv.firstChild) {
            containerRef.current!.appendChild(bibDiv.firstChild);
          }
        }

        // Post-process to inject raw HTML from blocks
        const walker = document.createTreeWalker(
          containerRef.current!,
          NodeFilter.SHOW_TEXT,
          null
        );

        const nodesToReplace: { node: Text, id: string }[] = [];
        let currentNode = walker.nextNode();
        while (currentNode) {
          const text = currentNode.textContent || '';
          // Check if this text node contains any of our block IDs
          for (const id in blocks) {
            if (text.includes(id)) {
              nodesToReplace.push({ node: currentNode as Text, id });
              break;
            }
          }
          currentNode = walker.nextNode();
        }

        // Perform replacements with deduplication
        const processedIds = new Set<string>();

        nodesToReplace.forEach(({ node, id }) => {
          try {
            if (processedIds.has(id)) {
              node.textContent = '';
              return;
            }

            processedIds.add(id);

            let htmlContent = '';

            if (id.startsWith('LATEXPREVIEWMATHBLOCK')) {
              // Render math using KaTeX
              const math = blocks[id];
              try {
                const renderedMath = katex.renderToString(math, {
                  displayMode: true,
                  throwOnError: false
                });
                // Wrap in our robust container
                htmlContent = `<div class="katex-display-wrapper" style="display: block; margin: 1.5em 0; text-align: center;">${renderedMath}</div>`;
              } catch (e: any) {
                console.error('KaTeX render error:', e);
                // NO FAKE: Show detailed error
                const errorMsg = e.message || String(e);
                const escapedMath = math.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                htmlContent = `
                  <div class="latex-error-block" style="border: 1px solid #ef4444; background: #fef2f2; padding: 8px; border-radius: 4px; margin: 1em 0;">
                    <div style="color: #b91c1c; font-weight: bold; font-size: 0.9em;">Math Rendering Error</div>
                    <div style="font-family: monospace; font-size: 0.8em; color: #b91c1c; margin-top: 4px;">${errorMsg}</div>
                    <div style="font-family: monospace; font-size: 0.8em; color: #666; margin-top: 4px; white-space: pre-wrap;">${escapedMath}</div>
                  </div>
                `;
              }
            } else if (id.startsWith('LATEXPREVIEWTIKZBLOCK')) {
              // TikZ block - just insert the script tag
              htmlContent = blocks[id];
            } else {
              // Standard HTML block
              htmlContent = blocks[id];
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;

            // We want to replace the parent element if it's just a wrapper for this text
            const parent = node.parentNode;
            if (parent) {
              // If the parent only contains this text (trimmed), replace the parent
              if (parent.textContent?.trim() === id && parent.nodeName !== 'BODY' && parent !== containerRef.current) {
                while (tempDiv.firstChild) {
                  parent.parentNode?.insertBefore(tempDiv.firstChild, parent);
                }
                parent.parentNode?.removeChild(parent);
              } else {
                // Just replace the text node
                const span = document.createElement('span');
                span.innerHTML = htmlContent;
                parent.replaceChild(span, node);
              }
            }
          } catch (e) {
            console.error('Failed to inject HTML block:', id, e);
          }
        });

        console.log('[LaTeX Preview] Render complete');

      } catch (err: any) {
        console.error('[LaTeX Preview] Render error:', err);
        console.error('[LaTeX Preview] Error stack:', err.stack);
        setError(err.message || String(err));
      }
    };

    render();
  }, [latexContent]);

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertDescription>
          <p className="font-semibold mb-1">Preview Rendering Error</p>
          <p className="text-sm">{error}</p>
          <p className="text-sm mt-2 text-muted-foreground">
            This error indicates the LaTeX contains features that cannot be rendered in the browser.
            Your full LaTeX document will compile correctly when downloaded.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap');

        /* Document Container - The "Page" */
        .latex-preview {
            font-family: 'Lora', 'Times New Roman', serif !important;
            line-height: 1.8 !important; /* Increased for readability */
            color: #000 !important;
            
            /* A4 Dimensions (approx) */
            width: 210mm;
            max-width: 100%;
            min-height: 297mm;
            margin: 0 auto;
            padding: 25mm 25mm;
            /* Standard margins */
        
            background-color: white !important;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
            box-sizing: border-box;
            overflow: hidden; /* Prevent internal scrollbars */
        }
        
        /* Robust Vertical Spacing (Lobotomized Owl) */
        .latex-preview > * + * {
            margin-top: 1.5em;
        }

        /* Fix for equations inside paragraphs or tight spacing */
        .latex-preview .katex-display {
            display: block !important;
            margin-top: 1.5em !important;
            margin-bottom: 1.5em !important;
        }
        
        /* UNIVERSAL FONT SIZE: Force formulas to match normal text size */
        .latex-preview .katex {
            font-size: 1em !important;
        }

        .latex-preview p > div {
            margin-top: 1.5em !important;
            margin-bottom: 1.5em !important;
        }

        /* Reset for internal elements */
        .latex-preview img,
        .latex-preview svg,
        .latex-preview .tikz-iframe,
        .latex-preview figure {
            display: block !important;
            margin-left: auto !important;
            margin-right: auto !important;
            text-align: center !important;
            max-width: 100%;
        }

        .latex-preview * {
            box-sizing: border-box;
        }
        
        /* Title Area */
        .latex-preview .title,
        .latex-preview h1.title {
            text-align: center;
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 1em;
            line-height: 1.2;
            color: #000;
        }
        
        .latex-preview .author {
            text-align: center;
            font-size: 14pt;
            margin-bottom: 0.5em;
            font-style: italic;
        }
        
        .latex-preview .date {
            text-align: center;
            font-size: 12pt;
            margin-bottom: 2em;
            color: #000;
        }
        
        /* Abstract */
        .latex-preview .abstract,
        .latex-preview div.abstract,
        .latex-preview .list.quotation + p {
            margin: 0 4em 2em 4em !important;
            font-size: 10pt !important;
            font-style: italic !important;
            line-height: 1.4 !important;
            text-align: justify !important;
        }
        
        .latex-preview .abstract-title,
        .latex-preview .list.center .bf {
            display: block;
            text-align: center;
            font-weight: bold;
            font-variant: small-caps;
            margin-bottom: 0.5em;
            font-size: 10pt;
            font-style: normal;
        }
        
        /* Sectioning */
        .latex-preview h1,
        .latex-preview h2,
        .latex-preview h3,
        .latex-preview h4 {
            color: #000;
            line-height: 1.3;
            margin-top: 1.5em;
            margin-bottom: 0.8em;
        }
        
        .latex-preview h2 {
            font-size: 16pt;
            font-weight: bold;
            border-bottom: none;
        }
        
        .latex-preview h3 {
            font-size: 14pt;
            font-weight: bold;
        }
        
        .latex-preview h4 {
            font-size: 12pt;
            font-weight: bold;
            font-style: italic;
        }
        
        /* Paragraphs */
        .latex-preview p {
            margin-bottom: 1.5em; /* Increased from 1em */
            text-align: justify;
            text-justify: inter-word;
            font-size: 11pt;
            text-indent: 0; /* User requested no indentation */
            line-height: 1.8; /* Increased from default/inherited */
        }
        
        .latex-preview p.noindent {
            text-indent: 0;
        }
        
        /* Lists */
        .latex-preview ul.list,
        .latex-preview ol.list {
            margin-bottom: 1em;
            padding-left: 2em;
            list-style: none !important; /* latex.js handles bullets manually */
        }
        
        .latex-preview li {
            margin-bottom: 0.5em;
            position: relative;
            padding-left: 1.5em; /* Space for bullet */
        }

        .latex-preview li .itemlabel {
            position: absolute;
            left: 0;
            top: 0;
            font-weight: bold;
        }

        .latex-preview li p {
            margin: 0;
            display: inline-block;
            vertical-align: top;
        }

        /* Fix for extra spacing when p follows item label */
        .latex-preview li > p:first-of-type {
            margin-top: 0 !important;
        }
        
        /* Placeholders */
        .latex-preview .latex-parbox {
            display: inline-block;
            vertical-align: top;
            word-wrap: break-word;
            padding: 0 5px;
            box-sizing: border-box;
        }

        .latex-preview span[style*="color: gray"] {
            display: block;
            padding: 1em;
            background: #f8f9fa;
            border: 1px solid #ccc;
            text-align: center;
            color: #666;
            font-family: monospace;
            font-size: 0.9em;
            margin: 1.5em auto !important;
            width: 80%;
        }

        /* Tables */
        .latex-preview .table-wrapper {
            width: 100%;
            overflow-x: auto;
            margin: 2em 0;
            display: flex;
            justify-content: center;
        }

        .latex-preview table {
            border-collapse: collapse;
            margin: 0 auto;
            font-size: 10pt;
            width: auto;
            max-width: 100%;
        }

        .latex-preview td {
            padding: 0.5em 1em;
            border-top: 1px solid #ddd;
            border-bottom: 1px solid #ddd;
            text-align: left;
        }

        .latex-preview tr:first-child td {
            border-top: 2px solid #000;
            font-weight: bold;
        }

        .latex-preview tr:last-child td {
            border-bottom: 2px solid #000;
        }

        /* Code Blocks */
        .latex-preview .code-block {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9em;
            background: #f5f5f5;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
            margin: 1.5em 0;
            white-space: pre;
            border: 1px solid #eee;
        }

        /* Bibliography Styles */
        .bibliography-preview {
          margin-top: 3em;
          padding-top: 2em;
          border-top: 2px solid #eee;
        }
      `}</style>

      {/* Transparency Notice */}
      <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Structure Preview:</strong> This browser-based preview shows document structure and basic formatting.
          Advanced features (complex equations, diagrams, citations) are shown as placeholders.
          Download the full LaTeX for complete rendering.
        </AlertDescription>
      </Alert>

      {/* Preview Content */}
      <div className="preview-viewer bg-gray-100/50 dark:bg-gray-950/50 p-6 rounded-lg border">
        <div
          ref={containerRef}
          className="latex-preview"
        />
      </div>
    </div>
  );
}
