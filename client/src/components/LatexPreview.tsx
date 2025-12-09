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
import katex from 'katex';
import '@/styles/latex-katex.css';
import '@/styles/latex-article.css';

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
function sanitizeLatexForBrowser(latex: string): SanitizeResult {
  const blocks: Record<string, string> = {};
  let blockCount = 0;
  let bibliographyHtml: string | null = null;
  const citationMap: Record<string, number> = {};

  const createPlaceholder = (html: string): string => {
    const id = `LATEXPREVIEWBLOCK${blockCount++}`;
    blocks[id] = html;
    return `\n\n${id}\n\n`;
  };

  // --- HELPER: Base Formatting for Blocks ---
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

    // 3. HTML Escaping
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

    // 5. Macro Replacement
    const nested = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';
    protectedText = protectedText
      .replace(/\\eqref\{([^{}]*)\}/g, '(\\ref{$1})')
      .replace(/\\ref\s*\{([^{}]*)\}/g, '[$1]')
      // .replace(/\\cite\s*\{([^{}]*)\}/g, '[$1]') // REMOVED: Let main parser handle citations
      .replace(/\\label\{([^{}]*)\}/g, '')
      .replace(/\\url\{([^{}]*)\}/g, '<code>$1</code>')
      .replace(/\\footnote\{([^{}]*)\}/g, ' ($1)')
      .replace(new RegExp(`\\\\textbf\\{${nested}\\}`, 'g'), '<strong>$1</strong>')
      .replace(new RegExp(`\\\\textit\\{${nested}\\}`, 'g'), '<em>$1</em>')
      .replace(new RegExp(`\\\\emph\\{${nested}\\}`, 'g'), '<em>$1</em>')
      .replace(new RegExp(`\\\\underline\\{${nested}\\}`, 'g'), '<u>$1</u>')
      .replace(new RegExp(`\\\\texttt\\{${nested}\\}`, 'g'), '<code>$1</code>')
      .replace(new RegExp(`\\\\textsc\\{${nested}\\}`, 'g'), '<span style="font-variant: small-caps;">$1</span>')
      .replace(/\\bullet/g, '&#8226;')
      .replace(/~/g, '&nbsp;')
      .replace(/\\times/g, '&times;')
      .replace(/\\checkmark/g, '&#10003;')
      .replace(/\\approx/g, '&#8776;')
      .replace(/\\,/g, '&thinsp;')
      .replace(/\{:\}/g, ':')
      .replace(/\{,\}/g, ',')
      .replace(/\\:/g, ':')
      .replace(/\\\//g, '/');

    // 6. Restore Math
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

      // STRATEGY: Auto-scale long SINGLE-LINE equations to fit container
      // CRITICAL: Do NOT scale multi-line environments (align*, gather*, etc.)
      // because they grow VERTICALLY, not horizontally. The length-based
      // heuristic would over-shrink them.
      if (displayMode) {
        const lineCount = (mathContent.match(/\\\\/g) || []).length;
        // CRITICAL FIX: Skip auto-scaling for ALL structured math environments
        // They either grow vertically (align) or the wrapper tags inflate char count (equation)
        const isStructuredEnv = /\\begin\{(equation|align|gather|multline)/.test(mathContent);
        const isMultiLine = lineCount > 0 || isStructuredEnv;

        if (!isMultiLine) {
          // Only apply to single-line equations

          // IMPROVED HEURISTIC: Strip LaTeX commands that inflate length without width
          // e.g. \mathrm{Integration} (20 chars) -> Integration (11 chars)
          let roughContent = mathContent
            .replace(/\\mathrm\{([^}]+)\}/g, '$1')
            .replace(/\\text\{([^}]+)\}/g, '$1')
            .replace(/\\textbf\{([^}]+)\}/g, '$1')
            .replace(/\\(left|right|big|Big|bigg|Bigg)[lrv]?/g, '')
            .replace(/\\[a-zA-Z]+/g, 'C'); // Replace other macros with 1 char proxy

          const estimatedWidthEm = roughContent.length * 0.45; // Slightly bumped factor for safety
          const maxEm = 50;

          if (estimatedWidthEm > maxEm) {
            const scale = Math.max(0.55, maxEm / estimatedWidthEm);
            html = `<div class="katex-autoscale" style="transform: scale(${scale.toFixed(2)}); transform-origin: left center; width: ${(100 / scale).toFixed(1)}%;">${html}</div>`;
          }
        }
      }

      blocks[id] = html;
    } catch (e) {
      blocks[id] = `<span style="color:red;">Math Error</span>`;
    }
    return displayMode ? `\n\n${id}\n\n` : id;
  };

  // === HELPER: Create TikZ iframe block (FULL INTENT ENGINE) ===
  const createTikzBlock = (tikzCode: string, options: string = ''): string => {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
      blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - not supported in browser preview</div>`;
      return `\n\n${id}\n\n`;
    }

    // SANITIZATION: TikZJax (btoa) crashes on Unicode. Force ASCII.
    let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, '');

    // Robust Fix for Fonts inside Nodes
    safeTikz = safeTikz
      .replace(/%.*$/gm, '') // CRITICAL: Strip comments before flattening newlines, otherwise "% Comment \draw" becomes one line and \draw is lost!
      .replace(/\\textbf\s*\{/g, '{\\bfseries ')
      .replace(/\\textit\s*\{/g, '{\\itshape ')
      .replace(/\\sffamily/g, '') // Crash prevention
      .replace(/\\rmfamily/g, '')
      .replace(/\\ttfamily/g, '')
      // Fix \n (literal) only if not followed by letters (protects \node, \newline, etc)
      .replace(/\\n(?![a-zA-Z])/g, ' ')
      .replace(/\n/g, ' ');

    // SANITIZATION: Remove enumitem/itemize which crashes TikZJax in nodes
    // 1. Remove [leftmargin=*] or similar params
    safeTikz = safeTikz.replace(/\\begin\{itemize\}\[[^\]]*\]/g, '\\begin{itemize}');

    // 2. Replace itemize with manual bullets (Fake List) because TikZJax interaction with Lists inside Nodes is flaky
    if (safeTikz.includes('\\begin{itemize}')) {
      safeTikz = safeTikz
        .replace(/\\begin\{itemize\}/g, '')
        .replace(/\\end\{itemize\}/g, '')
        .replace(/\\item\s+/g, '\\par $\\bullet$ ');
    }

    // DEBUG LOGGING (To confirm fix runs in browser)
    console.log("[LatexPreview TikZ Fix] Original:", tikzCode.substring(0, 50));
    console.log("[LatexPreview TikZ Fix] Safe:", safeTikz.substring(0, 50));

    // FIX (v1.6.10): Escape ampersands in TikZ code using simpler direct approach
    // LaTeX interprets & as alignment tab in tables. In TikZ node text, we need \&
    // Direct pattern replacements (order matters!)
    safeTikz = safeTikz.replace(/\\\\&/g, '\\\\ \\&'); // \\& → \\ \& (linebreak + space + escaped ampersand)
    safeTikz = safeTikz.replace(/([^\\])&/g, '$1\\&'); // raw & → \& (but not already escaped)



    // GEOMETRIC POLYFILL: Manual Bezier Braces for TikZJax
    // TikZJax cannot handle decoration={brace}, so we draw it manually.
    // FIX (v1.6.21): Made regex robust against whitespace (e.g., "decorate, decoration")
    safeTikz = safeTikz.replace(
      /\\draw\[\s*decorate\s*,\s*decoration\s*=\s*\{\s*brace([^}]*)\}\]\s*\(([^)]+)\)\s*--\s*\(([^)]+)\)\s*node\[([^\]]*)\]\s*\{([^}]*)\};/g,
      (match, decoOpts, start, end, nodeOpts, label) => {
        const isMirror = decoOpts && decoOpts.includes('mirror');
        const parseCoord = (s: string) => {
          const parts = s.split(',').map(p => parseFloat(p.trim()));
          return { x: parts[0] || 0, y: parts[1] || 0 };
        };
        const p1 = parseCoord(start); const p2 = parseCoord(end);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const isVertical = Math.abs(dy) > Math.abs(dx);

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Curvature calculation
        // Horizontal: +Y is "Up" (Standard), -Y is "Down" (Mirror?) - TikZ default is Up? Actually default brace is usually "top".
        // Vertical: -X is "Left", +X is "Right".
        // Heuristic: We use a default amplitude factor.

        let c1x, c1y, c2x, c2y, c3x, c3y, tipX, tipY;
        const mag = 0.15; // amplitude base
        const tipMag = 0.35; // tip height

        // Direction multiplier
        const dir = isMirror ? -1 : 1;

        if (isVertical) {
          // Vertical Brace (offsets on X)
          const sign = -1 * dir; // Default -1 (Left)

          c1x = p1.x + (sign * mag); c1y = p1.y;
          c2x = midX + (sign * mag); c2y = midY;
          tipX = midX + (sign * tipMag); tipY = midY;
          c3x = p2.x + (sign * mag); c3y = p2.y;

          // Label position: Further out in X
          const labelX = midX + (sign * (tipMag + 0.6)); // v1.6.28 Boosted Offset
          const labelY = midY;

          return `\\draw[thick] (${p1.x},${p1.y}) .. controls (${c1x},${c1y}) and (${c2x},${c2y}) .. (${tipX},${tipY}) .. controls (${c2x},${c2y}) and (${c3x},${c3y}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${labelX},${labelY}) {${label}};`;
        } else {
          // Horizontal Brace (offsets on Y)
          const sign = 1 * dir; // Default +1 (Up)

          c1x = p1.x; c1y = p1.y + (sign * mag);
          c2x = midX; c2y = midY + (sign * mag);
          tipX = midX; tipY = midY + (sign * tipMag);
          c3x = p2.x; c3y = p2.y + (sign * mag);

          const labelX = midX;
          const labelY = midY + (sign * (tipMag + 0.6)); // v1.6.28 Boosted Offset

          return `\\draw[thick] (${p1.x},${p1.y}) .. controls (${c1x},${c1y}) and (${c2x},${c2y}) .. (${tipX},${tipY}) .. controls (${c2x},${c2y}) and (${c3x},${c3y}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${labelX},${labelY}) {${label}};`;
        }
      }
    );

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
    const isTextHeavy = avgLabelTextPerNode > 30; // Use accurate label-based metric
    const baseComplexity = nodeMatches.length + drawMatches.length + (arrowMatches.length / 2);

    // NEW (v1.5.6): Detect WIDE and FLAT diagrams using absolute positioning
    // Extract ALL (x,y) coordinate pairs from the TikZ code (not just "at" patterns)
    // This captures: \node at (x,y), \draw (x,y) -- (x,y), \fill (x,y), etc.
    const allCoordMatches = safeTikz.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g) || [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    allCoordMatches.forEach(m => {
      const coords = m.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
      if (coords) {
        const x = parseFloat(coords[1]);
        const y = parseFloat(coords[2]);
        if (!isNaN(x)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
        if (!isNaN(y)) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    });
    const horizontalSpan = (maxX !== -Infinity && minX !== Infinity) ? (maxX - minX) : 0;
    const verticalSpan = (maxY !== -Infinity && minY !== Infinity) ? (maxY - minY) : 0;
    const isWideHorizontal = horizontalSpan > 14; // > 14cm exceeds A4 safe width
    // NEW (v1.5.7): Detect FLAT diagrams (timeline-style) with extreme aspect ratio
    const aspectRatio = verticalSpan > 0 ? horizontalSpan / verticalSpan : 0;
    const isFlat = horizontalSpan > 0 && verticalSpan > 0 && aspectRatio > 3.0;

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
    // Priority: FLAT > LARGE (Absolute) > node distance > text density > node count
    // UNIFICATION (v1.6.29): All Absolute Layouts (Span > 0) use LARGE (Density Engine) logic.
    // This allows the "Vertical Boost" (v1.6.28) to apply to "Wide" diagrams too, fixing the squashed look.

    if (horizontalSpan > 0) {
      if (isFlat) intent = 'FLAT'; // Timeline-style (Extreme aspect ratio)
      else intent = 'LARGE';       // Absolute Layout (includes WIDE) -> Uses Adaptive Density + Vertical Boost
    } else if (distMatch) {
      // Explicit intent wins (Relative Layouts)
      if (nodeDist < 2.0) intent = 'COMPACT';
      else if (nodeDist >= 2.5) intent = 'LARGE';
    } else {
      // Implicit intent (Inference for Relative Layouts)
      if (isTextHeavy) intent = 'LARGE'; // Text-heavy = Cycle = Large
      else if (nodeMatches.length >= 8) intent = 'COMPACT'; // Many nodes = Pipeline = Compact
    }

    // 3. EXECUTE RULES (The Table)
    let extraOpts = '';

    if (intent === 'COMPACT') {
      // GOAL: Fit to A4
      const scale = nodeMatches.length >= 8 ? 0.75 : 0.85;
      if (!options.includes('scale=')) extraOpts += `, scale=${scale}`;
      // EXEMPTION REMOVED (v1.6): Explicit coordinates should still scale text proportionally in Compact mode
      if (!options.includes('transform shape')) extraOpts += ', transform shape';
      if (!options.includes('node distance')) extraOpts += ', node distance=1.5cm';

    } else if (intent === 'LARGE') {
      // GOAL: Readability & Maximize Spacing
      // PROBLEM: AI often sets tiny grids (x=0.8cm) which cause text overlap.
      // SOLUTION (v1.6.22): Ignore AI's grid. Force expansion to fill available space (25cm budget - v1.6.25/27).

      // Width Budget: 25cm (allows expansion for Zoom Engine)
      const optimalUnit = Math.min(2.5, 25 / (horizontalSpan || 1));

      // FIX (v1.6.25): Adaptive Clamp
      const dynamicClamp = horizontalSpan > 7 ? 1.8 : 1.3;

      // FIX (v1.6.31/v1.6.38): Adaptive Y-Axis Scaling (The "Goldilocks" Vertical)
      // Problem: "Universal Boost" (y=2.2) exploded tall diagrams. "Symmetry" squashed short ones.
      // Solution: Calculate yUnit based on Vertical Span to target a specific physical height.
      // v1.6.38: If verticalSpan == 0 (Relative Layout), force y=0.5 for title compression.
      // v1.6.40: Reduced targetHeight from 12cm to 8cm to reduce excessive empty space.
      const targetHeight = 8; // cm (v1.6.40: reduced from 12cm for tighter layouts)
      const rawY = verticalSpan > 0 ? (targetHeight / verticalSpan) : 0.5;

      // Clamp Y: Min 1.0cm (v1.6.40: lowered from 1.3 for tighter packing), Max 1.8cm (lowered from 2.2)
      let yUnit = rawY === 0.5 ? 0.5 : Math.min(1.8, Math.max(1.0, rawY));

      const xUnit = Math.min(dynamicClamp, optimalUnit); // Keeps width constraint

      // FIX (v1.6.39): RESTORED - This line was accidentally removed in v1.6.38!
      extraOpts += `, x=${xUnit.toFixed(2)}cm, y=${yUnit.toFixed(2)}cm`;

      // Restore missing font setting (likely lost in v1.6.29 refactor)
      if (!options.includes('font=')) extraOpts += ', font=\\small';

      // For diagrams using 'node distance' (not absolute coords), we must inject spacious defaults.
      // FIX (v1.6.5): Use consistent targetDist calculation for both branches
      // NOTE (v1.6.12): Title gap is now fixed via y=0.5cm injection, so node distance can remain at 8.4cm
      const targetDist = isTextHeavy ? 8.4 : 5.0;

      if (!options.includes('node distance')) {
        // If we forced LARGE due to text density, we use the proven magic number
        extraOpts += `, node distance=${targetDist}cm`;
      } else {
        // FIX (v1.6.37): The Bifurcated Safety Net.
        // Problem: v1.6.36 used a 2.5cm threshold, but Cycle diagrams with `node distance=3cm` were still squashed.
        // Solution: We split the logic completely based on `isTextHeavy`.

        if (isTextHeavy) {
          // STRATEGY: Aggressive Protection (Restore v1.6.5 behavior)
          // Text-heavy nodes need massive space. 3cm is NOT enough.
          // If the provided distance is less than our target (8.4cm), we FORCE the boost.
          if (nodeDist < targetDist) {
            extraOpts += `, node distance=${targetDist}cm`;
          }
        } else {
          // STRATEGY: Permissive Respect (Preserve v1.6.35 behavior)
          // Light nodes (Pipelines) look good packed tight (e.g. 0.8cm).
          // We only interfere if it's absurdly small (< 0.5cm).
          if (nodeDist < 0.5) {
            extraOpts += `, node distance=${targetDist}cm`;
          }
        }
      }

      // Mandatory for Large
      // FIX (v1.6.32): Adaptive Node Inflation. Link Padding to Vertical Boost.
      // Mandatory for Large: Alignment
      if (!options.includes('text width')) extraOpts += ', every node/.append style={align=center}';

      // Remove explicit scale if we are handling it via x/y
      // But keep transform shape if checking for safety? 
      // Actually, with expanded grid, we usually DON'T want transform shape (keep text standard size)
      // So we do nothing else.

    } else if (intent === 'WIDE') {
      // GOAL: Fit wide horizontal pipeline to A4 width
      // Calculate scale factor: target 14cm max width for A4 content area
      const targetWidth = 14; // cm - safe A4 content width
      const scaleFactor = Math.min(1.0, targetWidth / horizontalSpan);
      const scale = Math.max(0.5, scaleFactor * 0.9); // Floor at 0.5x, apply 0.9 buffer

      if (!options.includes('scale=')) extraOpts += `, scale=${scale.toFixed(2)}`;
      // MUST use transform shape to shrink nodes proportionally
      if (!options.includes('transform shape')) extraOpts += ', transform shape';

    } else if (intent === 'FLAT') {
      // GOAL: Balance extreme aspect ratio (timeline diagrams)
      // A 5:1 ratio looks compressed; target ~2:1 for visual balance
      const targetRatio = 2.0;
      const yBoost = aspectRatio / targetRatio; // e.g., 5:1 / 2:1 = 2.5x boost
      const yMultiplier = Math.min(3.0, Math.max(1.5, yBoost)); // Clamp between 1.5x and 3x
      const xMultiplier = 1.5; // 50% horizontal expansion for label spacing

      // Extract existing x/y values from options (if present) and multiply them
      const existingX = options.match(/x\s*=\s*([\d.]+)/);
      const existingY = options.match(/y\s*=\s*([\d.]+)/);
      const baseX = existingX ? parseFloat(existingX[1]) : 1.0;
      const baseY = existingY ? parseFloat(existingY[1]) : 1.0;

      const newX = (baseX * xMultiplier).toFixed(1);
      const newY = (baseY * yMultiplier).toFixed(1);

      // Replace existing x/y or add new ones
      if (existingX) {
        // Will be replaced in merge logic below
        extraOpts += `, x=${newX}cm`;
      } else {
        extraOpts += `, x=${newX}cm`;
      }
      if (existingY) {
        extraOpts += `, y=${newY}cm`;
      } else {
        extraOpts += `, y=${newY}cm`;
      }

      // FIX (v1.6.41): Add font reduction for FLAT diagrams with many nodes.
      // When nodes have `minimum width` but long text, x/y multipliers alone
      // don't prevent text overflow. Smaller font ensures labels fit.
      if (nodeMatches.length >= 5 && !options.includes('font=')) {
        extraOpts += ', font=\\small';
      }

    } else {
      // MEDIUM

      // SMART SCALING (v1.5.8): Trust the user's layout if it fits in A4
      let scale = 0.9;
      if (horizontalSpan > 0 && horizontalSpan <= 14) {
        scale = 1.0; // Fits perfectly, don't shrink
      } else {
        // Fallback or too wide
        scale = nodeMatches.length >= 6 ? 0.8 : 0.9;
      }

      // EXEMPTION: Don't scale if diagram has explicit x= or y= coordinates (already sized)
      if (!options.includes('scale=') && !options.includes('x=') && !options.includes('y=')) extraOpts += `, scale=${scale}`;

      // NEW (v1.6): Intelligent Explicit Scaling covering Un-encountered Situations
      // If user provides explicit coordinates (x=, y=), we must enforce proportional scaling 
      // (transform shape) to prevent "Huge Text / Tiny Grid" overlap.
      const hasExplicitScale = options.includes('x=') || options.includes('y=');
      if (hasExplicitScale && !options.includes('transform shape')) {
        extraOpts += ', transform shape';
      }

      // Only inject default distance if not provided
      if (!options.includes('node distance')) extraOpts += ', node distance=2.5cm';
    }

    // GOLDILOCKS PROTOCOL: Coordinate Boost for text-heavy diagrams (Global Scope)
    // RECOVERED from Artifacts: x=2.2cm (Resolve Label Overlap), y=1.5cm (Increase Height)
    // UNIVERSAL FIX (v1.5.8): Only boost if span is unknown OR small (Index-Based < 7)
    // FIX (v1.6.12): EXCLUDE LARGE intent - it uses node distance, not coordinate scaling
    // FIX (v1.6.17): EXCLUDE ABSOLUTE POSITIONING (`horizontalSpan > 0`). If user provides explicit coords,
    // we must not distort the grid. Only boost "Relative/Index" layouts (span === 0).
    const isRelativeOrIndex = horizontalSpan === 0;

    if (isTextHeavy && !options.includes('x=') && isRelativeOrIndex && intent !== 'LARGE') {
      extraOpts += ', x=2.2cm, y=1.5cm';
    }

    // FLAT INTENT: Strip old x/y values so new calculated values take precedence
    let processedOptions = options.trim();
    if (intent === 'FLAT') {
      // Remove existing x= and y= values (they'll be replaced with calculated ones)
      processedOptions = processedOptions.replace(/,?\s*x\s*=\s*[\d.]+\s*(cm)?/gi, '');
      processedOptions = processedOptions.replace(/,?\s*y\s*=\s*[\d.]+\s*(cm)?/gi, '');
      // Clean up any double commas or leading/trailing commas
      processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');
    }

    // LARGE INTENT: Strip node distance if we're overriding it (v1.6.5, v1.6.12 adaptive)
    if (intent === 'LARGE') {
      // Use same adaptive formula as above
      const targetDist = isTextHeavy ? 8.4 : 5.0;
      const distMatch = options.match(/node distance\s*=\s*([\d\.]+)/);
      if (distMatch) {
        const existingDist = parseFloat(distMatch[1]);
        if (existingDist < targetDist) {
          // Remove old node distance value (it'll be replaced with targetDist)
          processedOptions = processedOptions.replace(/,?\s*node distance\s*=\s*[\d.]+\s*(cm)?/gi, '');
          // Clean up any double commas or leading/trailing commas
          processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');
        }
      }
    }

    // Merge logic
    let finalOptions = processedOptions;
    // FIX (v1.6.5): Handle empty brackets after stripping (e.g., "[]" after removing node distance)
    if (!finalOptions || finalOptions === '[]' || finalOptions.trim() === '[]') {
      finalOptions = extraOpts ? `[${extraOpts.replace(/^,\s*/, '').trim()}]` : '[]';
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
      flex-direction: column; /* Stack loading + diagram vertically */
      align-items: center;
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
    /* Loading Placeholder Styles (v1.6.11) */
    .tikz-loading {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      box-sizing: border-box;
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      white-space: nowrap; /* Prevent text wrapping */
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    .tikz-loading.hidden { display: none; }
  </style>
  <script>
    window.addEventListener('error', e => { if (e.message?.includes('message channel closed')) e.preventDefault(); });
    window.addEventListener('unhandledrejection', e => { if (e.reason?.message?.includes('message channel closed')) e.preventDefault(); });
  </script>
</head>
<body>
  <!-- Loading Placeholder (v1.6.11) -->
  <div id="tikz-loading" class="tikz-loading">
    <div>[ Generating diagram... ]</div>
  </div>
  <div class="tikzjax-container">
    <script type="text/tikz">
      \\usetikzlibrary{arrows,shapes,calc,positioning,decorations.pathreplacing}
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
         // Hide loading placeholder once SVG appears (v1.6.11)
         const loading = document.getElementById('tikz-loading');
         if (loading) loading.classList.add('hidden');
         // Add a small buffer for tooltips/shadows, and Enforce Min-Height (200px)
         const rect = svg.getBoundingClientRect();
         const h = Math.max(rect.height + 25, 200); 
         window.frameElement.style.height = h + 'px';
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

  // --- CONTENT PREPARATION ---
  let content = latex.replace(/^```latex\s * /i, '').replace(/```$/, '');

  // NOTE: Preamble stripping handled in Render step to access raw lines before 'sanitized' normalization

  // --- EARLY CITATION PROCESSING (BEFORE LISTS/TABLES) ---
  // This ensures citations inside list items get processed
  const citationMapEarly = new Map<string, number>();
  let nextCitationIdEarly = 1;

  content = content.replace(/\\cite\{([^}]+)\}/g, (match, keys) => {
    const keyList = keys.split(',').map((k: string) => k.trim());
    const ids: number[] = [];

    keyList.forEach((key: string) => {
      const normalizedKey = key.replace(/\\_/g, '_');
      if (!citationMapEarly.has(normalizedKey)) {
        citationMapEarly.set(normalizedKey, nextCitationIdEarly);
        nextCitationIdEarly++;
      }
      ids.push(citationMapEarly.get(normalizedKey)!);
    });

    // IEEE Style Grouping
    ids.sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = ids[0];
    let end = ids[0];

    for (let i = 1; i < ids.length; i++) {
      if (ids[i] === end + 1) {
        end = ids[i];
      } else {
        ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);
        start = ids[i];
        end = ids[i];
      }
    }
    ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);

    return ranges.join(', ');
  });

  // Extract TikZ
  let loopSafety = 0;
  while (content.includes('\\begin{tikzpicture}')) {
    if (loopSafety++ > 100) break;
    const startIdx = content.indexOf('\\begin{tikzpicture}');
    const endIdx = content.indexOf('\\end{tikzpicture}', startIdx);
    if (endIdx === -1) break;

    // Extract options
    let options = '';
    // (Simplification: assuming basic option parsing for brevity, or reuse complex one if needed)
    // For now, let's grab the body and basic options match
    const tagLen = '\\begin{tikzpicture}'.length;
    let bodyStart = startIdx + tagLen;
    // Check for [options]
    if (content[bodyStart] === '[') {
      const closeOpt = content.indexOf(']', bodyStart);
      if (closeOpt !== -1) {
        options = content.substring(bodyStart + 1, closeOpt);
        bodyStart = closeOpt + 1;
      }
    }

    const body = content.substring(bodyStart, endIdx);
    const placeholder = createTikzBlock(body, options);
    content = content.substring(0, startIdx) + placeholder + content.substring(endIdx + '\\end{tikzpicture}'.length);
  }

  // --- VERBATIM / CODE BLOCK EXTRACTION ---
  // MUST Run before Math/Lists to protect code content
  content = content.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (m, code) => {
    // HTML escape the content
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return createPlaceholder(`<pre class="latex-verbatim"> ${escaped}</pre> `);
  });

  // Create Math Block Helper (Moved up for scope access if needed, but it is available)

  // Extract Math (SSOT Order: Structured -> Display -> Standard Inline -> Legacy Inline)
  content = content.replace(/\\begin\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g, (m, env, star, math) => createMathBlock(m, true));
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => createMathBlock(math, true));
  content = content.replace(/\\\(([\s\S]*?)\\\)/g, (m, math) => createMathBlock(math, false)); // Standard Inline \( ... \)
  content = content.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g, (m, math) => createMathBlock(math, true)); // Double dollar (Legacy Display)
  content = content.replace(/(?<!\\)\$(?!\$)([^$]+?)(?<!\\)\$/g, (m, math) => createMathBlock(math, false)); // Legacy Inline $ ... $

  // Extract Lists (Preserving structure)
  const processLists = (txt: string, depth: number = 0): string => {
    let output = '';
    let i = 0;
    while (i < txt.length) {
      if (txt.startsWith('\\begin{enumerate}', i)) {
        i += 17;
        // Handle options [label=...]
        if (txt[i] === '[') {
          let d = 0;
          while (i < txt.length) {
            if (txt[i] === '[') d++;
            if (txt[i] === ']') d--;
            i++;
            if (d === 0) break;
          }
        }
        let listContent = '';
        let listDepth = 1;
        while (i < txt.length && listDepth > 0) {
          if (txt.startsWith('\\begin{enumerate}', i)) listDepth++;
          if (txt.startsWith('\\end{enumerate}', i)) listDepth--;
          if (listDepth > 0) listContent += txt[i];
          else break; // End found
          i++;
        }
        i += 15; // skip \end{enumerate}
        output += createPlaceholder(`<ol class="latex-enumerate">\n${processLists(listContent, depth + 1)} \n</ol> `);
      } else if (txt.startsWith('\\begin{itemize}', i)) {
        i += 15;
        let listContent = '';
        let listDepth = 1;
        while (i < txt.length && listDepth > 0) {
          if (txt.startsWith('\\begin{itemize}', i)) listDepth++;
          if (txt.startsWith('\\end{itemize}', i)) listDepth--;
          if (listDepth > 0) listContent += txt[i];
          else break;
          i++;
        }
        i += 13;
        output += createPlaceholder(`<ul class="latex-itemize">\n${processLists(listContent, depth + 1)} \n</ul> `);
      } else if (txt.startsWith('\\item', i)) {
        i += 5;
        // Handle \item[x]
        let label = '';
        if (txt[i] === '[') {
          i++;
          while (i < txt.length && txt[i] !== ']') { label += txt[i]; i++; }
          i++; // skip ]
        }
        // Capture content until next \item or end
        let itemContent = '';
        while (i < txt.length && !txt.startsWith('\\item', i)) {
          itemContent += txt[i];
          i++;
        }
        // Recurse for internal lists
        const processedItem = processLists(itemContent, depth);
        output += `<li${label ? ` data-label="${label}"` : ''}> ${parseLatexFormatting(processedItem)}</li> `;
        // Don't advance i here, logic continues loop
      } else {
        output += txt[i];
        i++;
      }
    }
    return output;
  };
  content = processLists(content);



  // --- ENVIRONMENT NORMALIZATION (theorem, lemma, proof) ---
  content = content.replace(/\\begin\{theorem\}([\s\S]*?)\\end\{theorem\}/g, (m, body) => {
    return createPlaceholder(`<div class="theorem"> <strong>Theorem.</strong> ${parseLatexFormatting(body.trim())}</div> `);
  });
  content = content.replace(/\\begin\{lemma\}([\s\S]*?)\\end\{lemma\}/g, (m, body) => {
    return createPlaceholder(`<div class="lemma"> <strong>Lemma.</strong> ${parseLatexFormatting(body.trim())}</div> `);
  });
  content = content.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, (m, body) => {
    return createPlaceholder(`<div class="proof"> <em>Proof.</em> ${parseLatexFormatting(body.trim())} <span style="float:right;">∎</span></div> `);
  });
  content = content.replace(/\\begin\{definition\}([\s\S]*?)\\end\{definition\}/g, (m, body) => {
    return createPlaceholder(`<div class="definition"> <strong>Definition.</strong> ${parseLatexFormatting(body.trim())}</div> `);
  });
  content = content.replace(/\\begin\{corollary\}([\s\S]*?)\\end\{corollary\}/g, (m, body) => {
    return createPlaceholder(`<div class="corollary"> <strong>Corollary.</strong> ${parseLatexFormatting(body.trim())}</div> `);
  });
  content = content.replace(/\\begin\{remark\}([\s\S]*?)\\end\{remark\}/g, (m, body) => {
    return createPlaceholder(`<div class="remark"> <em>Remark.</em> ${parseLatexFormatting(body.trim())}</div> `);
  });

  // --- FIGURE/TABLE ENVIRONMENT FLATTENING ---
  // FIX (v1.9.6): Pre-sanitize known AI typos in Tables that cause column overflow (e.g. "Built-in & Comprehensive" -> unescaped &)
  content = content.replace(/Built-in\s+&\s+Comprehensive/g, 'Built-in \\& Comprehensive');

  content = content.replace(/\\begin\{(figure|table)\}(\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (m, env, opt, body) => {
    let cleaned = body
      .replace(/\\centering/g, '')
      .replace(/\\caption\{[^}]*\}/g, '')
      .replace(/\\label\{[^}]*\}/g, '')
      .trim();
    return cleaned;
  });

  // --- MANUAL TABLE WALKER (SSOT Compliant) ---
  const processTables = (text: string): string => {
    const beginTags = ['\\begin{tabular}', '\\begin{tabularx}', '\\begin{longtable}'];
    let searchPos = 0;
    let result = '';

    while (searchPos < text.length) {
      let firstMatchIndex = -1;
      let matchedTag = '';

      for (const tag of beginTags) {
        const idx = text.indexOf(tag, searchPos);
        if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
          firstMatchIndex = idx;
          matchedTag = tag;
        }
      }

      if (firstMatchIndex === -1) {
        result += text.substring(searchPos);
        break;
      }

      result += text.substring(searchPos, firstMatchIndex);

      const envName = matchedTag.replace('\\begin{', '').replace('}', '');
      const endTag = `\\end{${envName}}`;

      let depth = 1;
      let currentPos = firstMatchIndex + matchedTag.length;
      let tableContentEnd = -1;

      while (currentPos < text.length) {
        if (text.startsWith(`\\begin{${envName}}`, currentPos)) {
          depth++;
          currentPos += matchedTag.length;
        } else if (text.startsWith(endTag, currentPos)) {
          depth--;
          if (depth === 0) {
            tableContentEnd = currentPos;
            break;
          }
          currentPos += endTag.length;
        } else {
          currentPos++;
        }
      }

      if (tableContentEnd === -1) {
        result += text.substring(firstMatchIndex);
        break;
      }

      let contentStart = firstMatchIndex + matchedTag.length;

      // Skip arguments like {lcr} or {|p{3cm}|}
      let argDepth = 0;
      let inArgs = false;
      let bodyStartIndex = contentStart;

      let i = contentStart;
      while (i < tableContentEnd) {
        if (text[i] === '{') {
          argDepth++;
          inArgs = true;
        } else if (text[i] === '}') {
          argDepth--;
        } else if (!inArgs && text[i] !== ' ' && text[i] !== '[') {
          // Heuristic: If we hit non-brace/non-space, we might be in body.
        }

        if (inArgs && argDepth === 0) {
          let nextCharIdx = i + 1;
          while (nextCharIdx < tableContentEnd && text[nextCharIdx] === ' ') nextCharIdx++;
          if (text[nextCharIdx] === '{') {
            i = nextCharIdx - 1;
            inArgs = false;
          } else {
            bodyStartIndex = i + 1;
            break;
          }
        }
        i++;
      }

      const tableBody = text.substring(bodyStartIndex, tableContentEnd);

      // ROW SPLITTING
      const rows: string[] = [];
      let currentRow = '';
      let braceDepth = 0;

      for (let j = 0; j < tableBody.length; j++) {
        const char = tableBody[j];
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;

        if (braceDepth === 0 && char === '\\' && tableBody[j + 1] === '\\') {
          rows.push(currentRow);
          currentRow = '';
          j++;
        } else {
          currentRow += char;
        }
      }
      if (currentRow.trim()) rows.push(currentRow);

      // CELL SPLITTING
      const htmlRows = rows.map(row => {
        if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule)$/)) return '';

        let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');

        const cells: string[] = [];
        let currentCell = '';
        braceDepth = 0;

        for (let k = 0; k < cleanRow.length; k++) {
          const char = cleanRow[k];
          if (char === '\\' && cleanRow[k + 1] === '&') {
            currentCell += '&';
            k++;
            continue;
          }

          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;

          if (braceDepth === 0 && char === '&') {
            cells.push(currentCell.trim());
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        cells.push(currentCell.trim());

        const htmlCells = cells.map(cell => {
          const multicolMatch = cell.match(/^\\multicolumn\{(\d+)\}\{[^}]+\}\{([\s\S]*)\}$/);
          if (multicolMatch) {
            const span = multicolMatch[1];
            const content = parseLatexFormatting(multicolMatch[2]);
            return `<td colspan="${span}">${content}</td>`;
          }
          return `<td>${parseLatexFormatting(cell)}</td>`;
        }).join('');

        return `<tr>${htmlCells}</tr>`;
      }).join('');

      result += createPlaceholder(`<div class="table-wrapper"><table><tbody>${htmlRows}</tbody></table></div>`);

      searchPos = tableContentEnd + endTag.length;
    }

    return result;
  };
  content = processTables(content);

  // --- COMMAND STRIPPING ---
  content = content.replace(/\\tableofcontents/g, '');
  content = content.replace(/\\listoffigures/g, '');
  content = content.replace(/\\listoftables/g, '');
  content = content.replace(/\\input\{[^}]*\}/g, '');
  content = content.replace(/\\include\{[^}]*\}/g, '');
  content = content.replace(/\\newpage/g, '');
  content = content.replace(/\\clearpage/g, '');
  content = content.replace(/\\pagebreak/g, '');
  content = content.replace(/\\noindent/g, '');
  content = content.replace(/\\vspace\{[^}]*\}/g, '');
  content = content.replace(/\\hspace\{[^}]*\}/g, '');

  // --- GHOST HEADER EXORCISM ---
  content = content.replace(/\\section\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');
  content = content.replace(/\\subsection\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');

  // --- MANUAL PARBOX WALKER (SSOT Compliant) ---
  const processParboxes = (txt: string): string => {
    let result = '';
    let i = 0;
    while (i < txt.length) {
      if (txt.startsWith('\\parbox', i)) {
        i += 7; // skip \parbox

        // Parse 1st arg: Width
        while (i < txt.length && txt[i] !== '{') i++; // find first {
        let widthArg = '';
        if (i < txt.length) {
          let braceDepth = 0;
          // Capture brace content
          if (txt[i] === '{') {
            braceDepth = 1;
            i++;
            while (i < txt.length && braceDepth > 0) {
              if (txt[i] === '{') braceDepth++;
              else if (txt[i] === '}') braceDepth--;

              if (braceDepth > 0) widthArg += txt[i];
              i++;
            }
          }
        }

        // Parse 2nd arg: Content
        while (i < txt.length && txt[i] !== '{') i++; // find second {
        let contentArg = '';
        if (i < txt.length) {
          let braceDepth = 0;
          if (txt[i] === '{') {
            braceDepth = 1;
            i++;
            while (i < txt.length && braceDepth > 0) {
              if (txt[i] === '{') braceDepth++;
              else if (txt[i] === '}') braceDepth--;

              if (braceDepth > 0) contentArg += txt[i];
              i++;
            }
          }
        }

        // Logic from previous regex
        let cssWidth = '100%';
        const textwidthMatch = widthArg.match(/([\d.]+)\\textwidth/);
        const linewidthMatch = widthArg.match(/([\d.]+)\\linewidth/);
        if (textwidthMatch) {
          cssWidth = `${parseFloat(textwidthMatch[1]) * 100}% `;
        } else if (linewidthMatch) {
          cssWidth = `${parseFloat(linewidthMatch[1]) * 100}% `;
        }

        result += createPlaceholder(`<div class="parbox" style="width: ${cssWidth}; display: inline-block; vertical-align: top;"> ${parseLatexFormatting(contentArg)}</div> `);

      } else {
        result += txt[i];
        i++;
      }
    }
    return result;
  };
  content = processParboxes(content);

  // Extract Bibliography (thebibliography environment)
  let hasBibliography = false;
  content = content.replace(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/g, (m, body) => {
    hasBibliography = true;

    const items: string[] = [];
    const bibitemRegex = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=\\bibitem\{|$)/g;
    let match;
    let refNum = 1;

    while ((match = bibitemRegex.exec(body)) !== null) {
      const key = match[1];
      let content = match[2].trim();
      content = parseLatexFormatting(content);
      items.push(`<li style="margin-bottom: 0.8em; text-indent: -2em; padding-left: 2em;"> [${refNum}] ${content}</li> `);
      refNum++;
    }

    const bibHtml = `
    <div class="bibliography" style="margin-top: 3em; border-top: 1px solid #ccc; padding-top: 1em;">
        <h2>References</h2>
        <ol style="list-style: none; padding: 0; margin: 0;">
          ${items.join('\n')}
        </ol>
      </div>
    `;

    return createPlaceholder(bibHtml);
  });

  return { sanitized: content, blocks, bibliographyHtml, hasBibliography };
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
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !latexContent) return;

    try {
      // 1. Sanitize and Extract (Trojan Horse)
      const { sanitized, blocks, bibliographyHtml, hasBibliography } = sanitizeLatexForBrowser(latexContent);

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

      // --- C. CITATION PARSING (IEEE STYLE) ---
      const citationMap = new Map<string, number>();
      let nextCitationId = 1;
      const references: string[] = []; // To build bibliography

      // Helper function to process citation keys and return IEEE formatted string
      const formatCitations = (keys: string): string => {
        const keyList = keys.split(',').map((k: string) => k.trim());
        const ids: number[] = [];

        keyList.forEach((key: string) => {
          // Normalize key: remove escaped underscores
          const normalizedKey = key.replace(/\\_/g, '_');
          if (!citationMap.has(normalizedKey)) {
            // FIX (v1.9.5): Respect explicit ref numbers (e.g. ref_5 -> [5])
            const match = normalizedKey.match(/^ref_(\d+)$/i);
            let id = nextCitationId;
            if (match) {
              id = parseInt(match[1], 10);
              // Update nextCitationId to avoid collisions if we're jumping ahead
              if (id >= nextCitationId) nextCitationId = id + 1;
            } else {
              nextCitationId++;
            }

            citationMap.set(normalizedKey, id);
            references.push(normalizedKey);
          }
          ids.push(citationMap.get(normalizedKey)!);
        });

        // IEEE Style Grouping: [1], [2], [3] -> [1]-[3]
        ids.sort((a, b) => a - b);

        const ranges: string[] = [];
        let start = ids[0];
        let end = ids[0];

        for (let i = 1; i < ids.length; i++) {
          if (ids[i] === end + 1) {
            end = ids[i];
          } else {
            ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);
            start = ids[i];
            end = ids[i];
          }
        }
        ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);

        return ranges.join(', ');
      };

      // 1. Handle \cite{ref_1,ref_2,...}
      html = html.replace(/\\cite\{([^}]+)\}/g, (match, keys) => formatCitations(keys));

      // 2. Handle consecutive (ref_x)(ref_y)(ref_z) -> combine into single citation group
      html = html.replace(/(\(ref_?\d+\))+/gi, (match) => {
        // Extract all ref_X from the consecutive group
        const allRefs = match.match(/ref_?\d+/gi);
        if (allRefs) {
          return formatCitations(allRefs.join(','));
        }
        return match;
      });

      // 2b. FIX (v1.9.3): Handle comma-separated list inside parentheses: (ref_1, ref_5)
      // UPDATED v1.9.4: Handle escaped underscores (ref\_6) and spaces (ref_2 )
      html = html.replace(/\(\s*((?:ref\\?_?\d+)(?:\s*,\s*ref\\?_?\d+)*)\s*\)/gi, (match, content) => {
        console.log("[LatexPreview Debug] Processing Ref Match:", match, "Content:", content);
        return formatCitations(content);
      });

      // 3. Handle escaped underscores: (ref\_1)(ref\_2) -> Standardize logic
      // Note: "Consecutive" handler (2) might fail on spaces/escapes. 
      // Let's rely on a more aggressive general pass or just fix the single case below.

      // 4. Handle single (ref_x) or (ref\_x) with potential spaces
      // Matches: (ref_1), ( ref_1 ), (ref\_1)
      html = html.replace(/\(\s*ref\\?_?(\d+)\s*\)/gi, (match, num) => formatCitations(`ref_${num} `));

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

      // Sections
      // Sections - Allow whitespace and NEWLINES inside braces (robust matching)
      html = html.replace(/\\section\*?\s*\{([\s\S]*?)\}/g, '<h2>$1</h2>');
      html = html.replace(/\\subsection\*?\s*\{([\s\S]*?)\}/g, '<h3>$1</h3>');
      html = html.replace(/\\subsubsection\*?\s*\{([\s\S]*?)\}/g, '<h4>$1</h4>');

      // Text formatting
      html = html.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
      html = html.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
      html = html.replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
      html = html.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
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

      // 5. Bibliography Injection (Generated) - ONLY if no real bibliography exists
      if (references.length > 0 && !hasBibliography) {
        const bibDiv = document.createElement('div');
        bibDiv.className = 'bibliography';
        bibDiv.style.marginTop = '4em';
        bibDiv.style.borderTop = '1px solid #ccc';
        bibDiv.style.paddingTop = '1em';

        let bibItemsHtml = '<ul style="list-style: none; padding: 0;">';
        references.forEach((refKey, index) => {
          // IEEE Format: [1] J. Doe... (We only have key, so we assume key is name-like or just list it)
          bibItemsHtml += `<li style="margin-bottom: 0.5em;"> [${index + 1}] <span style="margin-left: 0.5em;"> ${refKey.replace(/_/g, ' ')}</span></li> `;
        });
        bibItemsHtml += '</ul>';

        bibDiv.innerHTML = `<h2>References</h2>` + bibItemsHtml;
        containerRef.current.appendChild(bibDiv);
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
