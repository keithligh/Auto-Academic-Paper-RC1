
/**
 * LatexPreview.tsx
 *
 * IMPLEMENTS: Universal Unified Pipeline (v5)
 * 1. Sanitization: Delegated to `latex-unifier` (Modular Engines)
 * 2. Rendering: HTML Injection from Pipeline
 * 3. Styling: Strict latex-article.css
 *
 * HISTORY:
 * - v5: Grand Unification. Removed internal "God Object" sanitizer.
 * - v4: Hybrid "Auditor Spec" (Internal Sanitizer)
 */

import { useEffect, useState, useRef } from 'react';
import '@/styles/latex-katex.css';
import '@/styles/latex-article.css';
import { processLatex } from '../lib/latex-unifier/processor';

interface LatexPreviewProps {
  latexContent: string;
  className?: string;
}

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
        /* TikZ Loading State */
        .tikz-loading { width: 100%; display: flex; align-items: center; justify-content: center; padding: 2rem; color: #666; font-size: 0.9em; }
        .tikz-loading.hidden { display: none; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !latexContent) return;

    try {
      // 1. UNIFIED PIPELINE EXECUTION
      const { html, blocks, bibliographyHtml, hasBibliography } = processLatex(latexContent);

      // 2. INJECTION
      // We wrap the content in a standardized container
      // NOTE: processLatex already adds Header (Title/Author) to the HTML string.

      let finalHtml = html;
      if (hasBibliography && bibliographyHtml) {
        finalHtml += bibliographyHtml;
      }

      containerRef.current.innerHTML = finalHtml;
      setError(null);

      // 3. TREE WALKER REHYDRATION (Safety Net for missed placeholders)
      // The Pipeline does string replacement, but if any tokens survived in DOM text nodes, we catch them here.
      const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT, null);
      const nodesToReplace: { node: Text, match: string }[] = [];

      let currentNode = walker.nextNode();
      while (currentNode) {
        const text = currentNode.textContent || '';
        const match = text.match(/(LATEXPREVIEW[A-Z]+[0-9]+)/);
        if (match && blocks[match[1]]) {
          nodesToReplace.push({ node: currentNode as Text, match: match[1] });
        }
        currentNode = walker.nextNode();
      }

      nodesToReplace.forEach(({ node, match }) => {
        const span = document.createElement('span');
        span.innerHTML = blocks[match];
        if (node.parentNode) {
          node.parentNode.replaceChild(span, node);
        }
      });

      // 4. KATEK RENDER (Client-Side Hydration Check?)
      // KaTeX is already rendered to HTML string by the pipeline. 
      // We don't need to do anything else unless we want to re-render.

    } catch (err: any) {
      console.error("LatexPreview Pipeline Error:", err);
      setError(`Rendering Error: ${err.message}`);
      containerRef.current.innerHTML = `<div class="latex-error">
        <h3>Preview Error</h3>
        <pre>${err.message}</pre>
        <div style="margin-top: 1em; font-size: 0.8em;">Raw Logic: check console</div>
      </div>`;
    }
  }, [latexContent]);

  return (
    <div className={`latex-preview-wrapper ${className}`}>
      {error && (
        <div className="bg-red-50 border-1 border-red-200 text-red-700 p-4 mb-4 rounded text-sm">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="latex-preview prose prose-slate max-w-none print:prose-print pl-12 pr-12 pt-12 pb-24 bg-white shadow-sm min-h-[29.7cm] mx-auto"
        style={{
          width: '210mm',         // A4 Width
          minHeight: '297mm',     // A4 Height
          padding: '2.54cm',      // Standard margins
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}
