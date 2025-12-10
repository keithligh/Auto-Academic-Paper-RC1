/**
 * LatexPreview.tsx
 *
 * IMPLEMENTS: Hybrid "Auditor Spec" Parser (Refined v4)
 * 1. Sanitization: "Hybrid Encapsulation" logic (Math, TikZ, Lists from LatexPreview - Copy (3).tsx)
 * 2. Rendering: Custom Regex HTML Converter (No latex.js)
 * 3. Styling: Strict latex-article.css (A4 Paper, Times New Roman)
 *
 * FIXES v4:
 * - IEEE CITATION STYLE: [1], [1]-[3] citation rendering.
 * - METADATA RESCUE: Extract Title/Author/Date BEFORE preamble stripping.
 * - Aggressive Preamble Stripping (Package removal, Comment removal)
 * - Abstract Environment support
 */

import { useEffect, useState, useRef } from 'react';
// import katex from 'katex'; // Removed: Handled by processor.ts
import '@/styles/latex-katex.css';
import '@/styles/latex-article.css';
import { processLatex } from '../lib/latex-unifier/processor';

// Remove latexjs declaration as we are removing it
// declare const latexjs: any; 

interface LatexPreviewProps {
  latexContent: string;
  className?: string;
}

interface SanitizeResult {
  sanitized: string;
  blocks: Record<string, string>;
  bibliographyHtml: string | null;
  hasBibliography: boolean;
}

/**
 * THE HYBRID ENCAPSULATION SANITIZER (REUSED FROM BACKUP)
 * Extracts complex elements (Math, TikZ, Tables, Lists) into safe placeholders.
 */
// Exported for testing purposes
// sanitizeLatexForBrowser is now imported as processLatex from processor.ts

export function LatexPreview({ latexContent, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Runtime styles (Auditor Spec)
  useEffect(() => {
    const styleId = 'latex-preview-dynamic-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .latex-preview { line-height: 1.8 !important; }
        .latex-preview > * + * { margin-top: 1.5em; }
        .latex-preview .katex-display { margin-top: 1.5em !important; }
        .latex-preview p > div { margin-top: 1.5em !important; }
        .latex-preview iframe { display: block; margin: 0 auto; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !latexContent) return;

    try {
      // 1. Sanitize and Extract (Trojan Horse)
      const { sanitized, blocks, bibliographyHtml, hasBibliography } = processLatex(latexContent);

      // 2. Custom Parser (Replacements) - REPLACES latex.js
      let html = sanitized;
      console.log("[LatexPreview Debug] RAW HTML:", html.substring(0, 500)); // Debug Header rendering

      // --- A. METADATA EXTRACTION (BEFORE PREAMBLE STRIP) ---
      let title = '';
      let author = '';
      let date = '';

      // Match Title
      const titleMatch = html.match(/\\title\{([^{}]+)\}/);
      if (titleMatch) title = titleMatch[1];

      // Match Author
      const authorMatch = html.match(/\\author\{([^{}]+)\}/);
      if (authorMatch) author = authorMatch[1];

      // Match Date
      const dateMatch = html.match(/\\date\{([^}]*)\}/);
      if (dateMatch) {
        const dateContent = dateMatch[1];
        // Simple \today support
        if (dateContent.includes('\\today')) {
          date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          // Preserve other text? Assume \today is solitary for now for valid papers
        } else {
          date = dateContent;
        }
      }

      // --- B. PREAMBLE & JUNK CLEANUP ---

      // If \begin{document} exists, discard everything before it
      const docStart = html.indexOf('\\begin{document}');
      if (docStart !== -1) {
        html = html.substring(docStart + '\\begin{document}'.length);
      } else {
        // Fallback: strip aggressive preamble commands
        html = html.replace(/\\documentclass\[.*?\]\{.*?\}/g, '');
        html = html.replace(/\\usepackage(\[.*?\])?\{.*?\}/g, '');
        html = html.replace(/\\usetikzlibrary\{.*?\}/g, '');
        html = html.replace(/\\newtheorem\{.*?\}(\[.*?\])?\{.*?\}/g, '');
        html = html.replace(/\\title\{.*?\}/g, '');
        html = html.replace(/\\author\{.*?\}/g, '');
        html = html.replace(/\\date\{.*?\}/g, '');
      }
      // Remove valid document end
      html = html.replace(/\\end\{document\}/g, '');

      // Strip Comments
      html = html.replace(/^\s*%.*$/gm, '');

      // --- C. CITATION PARSING REMOVED (Handled by citation-engine) ---
      // References stored in 'bibliographyHtml' from sanitize step.

      // --- D. HEADER CONSTRUCTION & INJECTION ---

      const headerHtml = `
        ${title ? `<h1 class="title">${title}</h1>` : ''}
        ${author ? `<div class="author">${author}</div>` : ''}
        ${date ? `<div class="date">${date}</div>` : ''}
`;

      if (html.includes('\\maketitle')) {
        html = html.replace(/\\maketitle/g, headerHtml);
      } else if (title || author) {
        // Prepend if maketitle missing but metadata found
        html = headerHtml + html;
      }

      // --- E. ENVIRONMENTS ---

      // Abstract
      html = html.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g,
        '<div class="abstract"><h3>Abstract</h3><p>$1</p></div>'
      );

      // Center (v1.9.15) - Fixes Unparsed \begin{center} tags
      html = html.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, '<div style="text-align: center;">$1</div>');

      // Sections
      // Sections - Allow whitespace and NEWLINES inside braces (robust matching)
      html = html.replace(/\\section\*?\s*\{([\s\S]*?)\}/g, '<h2>$1</h2>');
      html = html.replace(/\\subsection\*?\s*\{([\s\S]*?)\}/g, '<h3>$1</h3>');
      html = html.replace(/\\subsubsection\*?\s*\{([\s\S]*?)\}/g, '<h4>$1</h4>');
      html = html.replace(/\\paragraph\*?\s*\{([\s\S]*?)\}/g, '<strong>$1</strong> ');

      // Text formatting
      html = html.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
      // Markdown Compatibility (Global)
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
      html = html.replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
      html = html.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
      // Fix: Support manual line breaks
      html = html.replace(/\\\\/g, '<br/>');
      html = html.replace(/\\newline/g, '<br/>');
      html = html.replace(/\\today/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));

      // Paragraphs
      // Fix: Normalize AI usage of literal "\n" to real newlines
      html = html.replace(/\\n/g, '\n');

      html = html.split(/\n\n+/).filter(p => p.trim()).map(para => {
        para = para.trim();
        if (!para) return '';
        if (para.match(/^<h[1-6]/)) return para;
        if (para.match(/^<div/)) return para;
        if (para.startsWith('LATEXPREVIEW')) return para;
        if (para.match(/^<(ul|ol|li|table|tr|td|pre)/)) return para;

        return `<p>${para}</p>`;
      }).join('\n');

      // 3. Inject HTML
      // FIX (v1.9.12): Pre-inject placeholders at string level to ensure Lists/Tables catch them.
      // The DOM Walker is a safety net, but string replacement is more robust for simple substitutions.
      html = html.replace(/(LATEXPREVIEW[A-Z]+[0-9]+)/g, (match) => {
        return blocks[match] ? blocks[match] : match;
      });

      containerRef.current.innerHTML = html;

      // 4. Placeholder Injection (The Trojan Horse)
      containerRef.current.normalize();
      const walker = document.createTreeWalker(
        containerRef.current,
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
        const fragment = document.createDocumentFragment();

        const parent = textNode.parentElement;
        const isBlockContext = parent && (parent.tagName === 'DIV' || parent.tagName === 'P') && parent.childNodes.length === 1;

        parts.forEach(part => {
          if (blocks[part]) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = blocks[part];

            if (isBlockContext && parent.tagName === 'P') {
              // unwrapping logic handled by browser parser mostly
            }

            while (tempDiv.firstChild) {
              fragment.appendChild(tempDiv.firstChild);
            }
          } else if (part) {
            fragment.appendChild(document.createTextNode(part));
          }
        });

        textNode.replaceWith(fragment);
      });

      // 5. Bibliography Injection (Optimized v4)
      if (bibliographyHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bibliographyHtml;
        // Append the contents (usually a wrapper div from engine)
        while (tempDiv.firstChild) {
          containerRef.current.appendChild(tempDiv.firstChild);
        }
      }

      // 6. Auto-Scaling (Auditor Spec)
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const elements = containerRef.current.querySelectorAll('.katex-display, .table-wrapper');
        elements.forEach((el) => {
          const element = el as HTMLElement;
          // Reset
          element.style.transform = '';
          element.style.width = '';
          element.style.transformOrigin = 'left center';

          if (element.scrollWidth > element.clientWidth) {
            const scale = Math.max(0.55, (element.clientWidth / element.scrollWidth) * 0.98);
            if (scale < 1) {
              element.style.transform = `scale(${scale})`;
              element.style.width = `${(100 / scale)}% `;
              element.style.overflowX = 'hidden';
            }
          }
        });
      });

    } catch (err: any) {
      console.error("Preview Render Error:", err);
      setError(err.message || 'Unknown error');
    }
  }, [latexContent]);

  if (error) {
    return (
      <div className={`latex-preview ${className}`}>
        <div style={{ padding: '20px', background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '4px' }}>
          <strong style={{ color: '#cc0000' }}>Render Error:</strong>
          <p>{error}</p>
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
