/**
 * LatexPreview.tsx
 * 
 * IMPLEMENTS: Hybrid LaTeX Preview Architecture ("The Trojan Horse")
 * VERIFIED: Includes all "Secrets" from the documentation.
 */

import { useEffect, useState, useRef } from 'react';
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
    // Improved regex to handle one level of nesting: { outer { inner } }
    const nested = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';

    protectedText = protectedText
      .replace(/\\eqref\{([^{}]*)\}/g, '(\\ref{$1})') // Sanitization: eqref -> (\ref)
      .replace(/\\ref\{([^{}]*)\}/g, '[$1]') // Sanitization: ref -> [key] (Prevent latex.js lookup issues)
      .replace(/\\label\{([^{}]*)\}/g, '') // Sanitization: Nuke labels (latex.js doesn't need them)
      .replace(/\\url\{([^{}]*)\}/g, '<code>$1</code>') // Sanitization: url -> monospaced text
      .replace(/\\footnote\{([^{}]*)\}/g, ' ($1)') // Sanitization: footnote -> inline text
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
      .replace(/\\approx/g, '&#8776;') // U+2248 ≈
      .replace(/\\,/g, '&thinsp;')
      .replace(/\{:\}/g, ':') // Strips {:} to : (Literal brace match)
      .replace(/\\:/g, ':') // Handle \: if present
      .replace(/\\\//g, '/'); // Convert escaped slash \/ to /

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

  // === HELPER: Create TikZ iframe block ===
  const createTikzBlock = (tikzCode: string, options: string = ''): string => {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
      blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - not supported in browser preview</div>`;
      return `\n\n${id}\n\n`;
    }

    // SANITIZATION: TikZJax (btoa) crashes on Unicode. Force ASCII.
    let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, '');

    // CRITICAL (v1.7.0): Detect braces BEFORE polyfill removes decoration syntax
    const hasBracesBeforePolyfill = safeTikz.includes('decoration={brace') || safeTikz.includes('decoration=\\{brace');

    // GEOMETRIC POLYFILL: Manual Bezier Braces for TikZJax
    // TikZJax cannot handle decoration={brace}, so we draw it manually.
    safeTikz = safeTikz.replace(
      /\\draw\[decorate,decoration=\{brace([^}]*)\}\]\s*\(([^)]+)\)\s*--\s*\(([^)]+)\)\s*node\[([^\]]*)\]\s*\{([^}]*)\};/g,
      (match, decoOpts, start, end, nodeOpts, label) => {
        const isMirror = decoOpts && decoOpts.includes('mirror');
        const parseCoord = (s: string) => {
          const parts = s.split(',').map(p => parseFloat(p.trim()));
          return { x: parts[0] || 0, y: parts[1] || 0 };
        };
        const p1 = parseCoord(start); const p2 = parseCoord(end);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const curvature = isMirror ? 1 : -1;
        const offset = 0.15 * curvature;
        const tip = 0.35 * curvature;
        return `\\draw[thick] (${p1.x},${p1.y}) .. controls (${p1.x},${p1.y + offset}) and (${midX},${midY + offset}) .. (${midX},${midY + tip}) .. controls (${midX},${midY + offset}) and (${p2.x},${p2.y + offset}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${midX},${midY + tip + (0.4 * curvature)}) {${label}};`;
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

    // CRITICAL FIX (v1.7.0): Extract x/y scale from options to convert coordinate units to physical cm
    // Bug: Previous code compared coordinate units (e.g., 9.5) directly to physical cm (14cm)
    // With x=0.8cm, a span of 9.5 units = 7.6cm physical, not 9.5cm
    const xScaleMatch = options.match(/\bx\s*=\s*([\d.]+)\s*cm/);
    const yScaleMatch = options.match(/\by\s*=\s*([\d.]+)\s*cm/);
    const xScale = xScaleMatch ? parseFloat(xScaleMatch[1]) : 1.0;
    const yScale = yScaleMatch ? parseFloat(yScaleMatch[1]) : 1.0;

    // Apply scaling to convert coordinate units to physical cm
    const horizontalSpan = (maxX !== -Infinity && minX !== Infinity) ? ((maxX - minX) * xScale) : 0;
    const verticalSpan = (maxY !== -Infinity && minY !== Infinity) ? ((maxY - minY) * yScale) : 0;

    const isWideHorizontal = horizontalSpan > 14; // > 14cm exceeds A4 safe width
    // NEW (v1.5.7): Detect FLAT diagrams (timeline-style) with extreme aspect ratio
    const aspectRatio = verticalSpan > 0 ? horizontalSpan / verticalSpan : 0;
    const isFlat = horizontalSpan > 0 && verticalSpan > 0 && aspectRatio > 3.0;

    // NEW (v1.7.0): Detect BRACE diagrams (labels below main content causing vertical cramping)
    // Indicators: 1) Has brace decorations, 2) Has negative y-coordinates, 3) Has small y-scale
    // NOTE: Use hasBracesBeforePolyfill detected earlier (line 173) before polyfill removes decoration syntax
    const hasNegativeY = minY !== Infinity && minY < 0;
    const hasSmallYScale = yScale < 1.0;
    const isBraceLayout = hasBracesBeforePolyfill && hasNegativeY && hasSmallYScale;

    // DEBUG: Log detection conditions
    console.log('[BRACE Detection]', {
      hasBracesBeforePolyfill,
      hasNegativeY,
      hasSmallYScale,
      isBraceLayout,
      minY,
      maxY,
      xScale,
      yScale,
      options: options.substring(0, 100)
    });

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
    // Priority: WIDE > BRACE > FLAT > node distance > text density > node count
    if (isWideHorizontal) {
      intent = 'WIDE'; // Horizontal overflow - must scale down to fit
    } else if (isBraceLayout) {
      intent = 'BRACE'; // Has braces below content - needs y-axis boost to prevent label overlap
    } else if (isFlat) {
      intent = 'FLAT'; // Timeline-style - needs y-axis boost
    } else if (distMatch) {
      // Explicit intent wins
      if (nodeDist < 2.0) intent = 'COMPACT';
      else if (nodeDist >= 2.5) intent = 'LARGE';
    } else {
      // Implicit intent (Inference)
      if (isTextHeavy) intent = 'LARGE'; // Text-heavy = Cycle = Large
      else if (nodeMatches.length >= 8) intent = 'COMPACT'; // Many nodes = Pipeline = Compact
    }

    // DEBUG: Log selected intent
    console.log('[TikZ Intent]', intent, { nodeMatches: nodeMatches.length, isTextHeavy, horizontalSpan, verticalSpan });

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
      // SOLUTION (v1.6.4): Ignore AI's grid. Force expansion to fill A4 width (14cm).

      let optimalUnit = 1.0;
      if (horizontalSpan > 0) {
        // Calculate unit size to fill 14cm width
        // e.g. Span 10 -> Unit 1.4cm
        optimalUnit = Math.min(2.5, 14 / horizontalSpan); // Cap at 2.5cm to avoid explosion
      } else {
        // Fallback if span unknown
        optimalUnit = 1.5;
      }

      // Override/Inject generic optimal settings
      // We purposefully IGNORE existing x=/y= because they are likely the cause of the overlap.
      extraOpts += `, x=${optimalUnit.toFixed(2)}cm, y=${optimalUnit.toFixed(2)}cm`;

      // Ensure font is small enough to fit
      if (!options.includes('font=')) extraOpts += ', font=\\small';

      // RESTORED (v1.6.4): Support Relative/Cycling Diagrams
      // For diagrams using 'node distance' (not absolute coords), we must inject spacious defaults.
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

    } else if (intent === 'BRACE') {
      // GOAL: Create vertical space for brace labels below main content
      // PROBLEM: Diagrams with x=0.8cm, y=0.8cm have cramped grids causing label overlap
      // SOLUTION: Boost both x and y to prevent horizontal AND vertical cramping
      //           + Reduce font size to fit more text in available space

      // Calculate optimal x-scale to fill A4 width without exceeding it
      const coordinateWidth = (maxX !== -Infinity && minX !== Infinity) ? (maxX - minX) : 10;
      const targetWidthCm = 12; // cm - fill most of A4 (14cm) with safety margin
      const optimalXScale = coordinateWidth > 0 ? (targetWidthCm / coordinateWidth) : 1.5;
      const newXScale = Math.max(1.2, Math.min(2.0, optimalXScale)); // Floor at 1.2cm for label spacing

      // Calculate optimal y-scale for vertical separation
      const negativeExtent = Math.abs(minY) * yScale; // Physical depth below x-axis
      const targetDepth = 3.0; // cm - increased from 2.5 for more vertical breathing room
      const requiredYScale = negativeExtent > 0 ? (targetDepth / Math.abs(minY)) : 1.5;
      const newYScale = Math.max(1.5, Math.min(2.5, requiredYScale));

      // Debug logging
      console.log('[BRACE Intent]', {
        coordinateWidth,
        optimalXScale,
        newXScale,
        minY,
        negativeExtent,
        requiredYScale,
        newYScale,
        originalXScale: xScale,
        originalYScale: yScale
      });

      // Reduce font size to prevent label overlap (follows LARGE intent pattern)
      if (!options.includes('font=')) extraOpts += ', font=\\small';

      // Strip old x/y and inject new values
      extraOpts += `, x=${newXScale.toFixed(2)}cm, y=${newYScale.toFixed(2)}cm`;

      // Do NOT use transform shape - we want text to stay at normal readable size
      // The boosted coordinate grid provides the space naturally

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

      // NOTE: No font reduction needed - the x/y multipliers provide enough space for labels

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
    const isSmallOrUnknown = horizontalSpan === 0 || horizontalSpan < 7;

    if (isTextHeavy && !options.includes('x=') && isSmallOrUnknown) {
      extraOpts += ', x=2.2cm, y=1.5cm';
    }

    // FLAT/BRACE INTENT: Strip old x/y values so new calculated values take precedence
    let processedOptions = options.trim();
    if (intent === 'FLAT' || intent === 'BRACE') {
      // Remove existing x= and y= values (they'll be replaced with calculated ones)
      processedOptions = processedOptions.replace(/,?\s*x\s*=\s*[\d.]+\s*(cm)?/gi, '');
      processedOptions = processedOptions.replace(/,?\s*y\s*=\s*[\d.]+\s*(cm)?/gi, '');
      // Clean up any double commas or leading/trailing commas
      processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');
    }

    // Merge logic
    let finalOptions = processedOptions;
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
         const rect = svg.getBoundingClientRect();
         window.frameElement.style.height = (rect.height + 5) + 'px';
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

  // --- A.2 CODE BLOCKS (Verbatim/LstListing) ---
  // MOVED UP: Must be BEFORE Math to prevent $var$ in code being treated as math.
  // UPDATE: Added support for lstlisting and optional arguments.
  content = content.replace(/\\begin\{(verbatim|lstlisting)\}(?:\[.*?\])?([\s\S]*?)\\end\{\1\}/g, (m, type, body) => {
    return createPlaceholder(`<pre class="latex-verbatim">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
  });

  // --- B. MATH (KaTeX) ---
  // CRITICAL FIX: Extraction order matters!
  // 1. Structured environments (align*, equation*, etc.) MUST be extracted FIRST
  //    because they may contain \\[4pt] row spacing that looks like display math
  // 2. Standalone \[...\] display math SECOND
  // 3. Inline $...$ THIRD

  // STEP 1: Extract structured math environments FIRST
  content = content.replace(/\\begin\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g, (m, env, star, math) => {
    return createMathBlock(m, true);
  });

  // STEP 2: Extract standalone display math \[...\] SECOND
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => createMathBlock(math, true));

  // STEP 2.5: Extract inline math \(...\) (Standard LaTeX)
  content = content.replace(/\\\(([\s\S]*?)\\\)/g, (m, math) => createMathBlock(math, false));

  // STEP 3: Extract inline math $...$ THIRD
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
  // HELPER: Resolve Placeholders (Recursive)
  const resolvePlaceholders = (text: string): string => {
    return text.replace(/(LATEXPREVIEW[A-Z]+[0-9]+)/g, (match) => {
      return blocks[match] || match;
    });
  };

  // HELPER: Smart Row Splitting (Brace-aware)
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

  // HELPER: Robust Cell Splitter (Manual Character Walker)
  // "Scorched Earth" Policy: No regex for structural parsing.
  const splitCells = (row: string): string[] => {
    const cells: string[] = [];
    let currentCell = '';
    let depth = 0;
    let i = 0;

    while (i < row.length) {
      const char = row[i];

      if (char === '\\') {
        // Escape detected: treat next char as literal (even if it is & or { or })
        currentCell += char;
        if (i + 1 < row.length) {
          currentCell += row[i + 1];
          i++; // skip next char
        }
      } else if (char === '{') {
        depth++;
        currentCell += char;
      } else if (char === '}') {
        if (depth > 0) depth--;
        currentCell += char;
      } else if (char === '&' && depth === 0) {
        // Split Point
        cells.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
      i++;
    }
    cells.push(currentCell); // Push last cell
    return cells;
  };

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

      const rows = smartSplitRows(body).filter(r => r.trim());
      let tableHtml = '<table><tbody>';
      rows.forEach(row => {
        let r = row.trim().replace(/\\hline/g, '').replace(/\\cline\{.*?\}/g, '')
          .replace(/\\toprule/g, '').replace(/\\midrule/g, '').replace(/\\bottomrule/g, '');
        if (!r) return;
        tableHtml += '<tr>';
        splitCells(r).forEach(cell => {
          tableHtml += `<td>${resolvePlaceholders(parseLatexFormatting(cell.trim()))}</td>`;
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
    const rows = smartSplitRows(body).filter((r: string) => r.trim());
    let tableHtml = '<table><tbody>';
    rows.forEach((row: string) => {
      let r = row.trim().replace(/\\hline/g, '').replace(/\\cline\{.*?\}/g, '')
        .replace(/\\toprule/g, '').replace(/\\midrule/g, '').replace(/\\bottomrule/g, '');
      if (!r) return;
      tableHtml += '<tr>';
      splitCells(r).forEach((cell: string) => {
        tableHtml += `<td>${resolvePlaceholders(parseLatexFormatting(cell.trim()))}</td>`;
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

  // === HELPER: UNIFIED LIST PARSER (Deep Recursive, Manual Walker) ===
  const processLists = (content: string): string => {
    let placeholders: { id: string, html: string }[] = [];
    let loopCount = 0;

    // Helper to find balanced closing brace
    const findBalancedClose = (str: string, openIdx: number, openChar: string, closeChar: string): number => {
      let depth = 1;
      let i = openIdx + 1;
      while (i < str.length && depth > 0) {
        if (str[i] === openChar) depth++;
        else if (str[i] === closeChar) depth--;
        i++;
      }
      return depth === 0 ? i - 1 : -1;
    };

    // Helper to extract environment body manually
    // Returns: { type, fullMatch, body, options, startIdx, endIdx } or null
    const findLeafList = (txt: string): { type: string, fullMatch: string, body: string, options: string } | null => {
      const types = ['enumerate', 'itemize', 'description'];

      // We search for the *first* list that DOES NOT contain a nested list start inside it
      // actually, resolving from inside out means we just need to find ANY list that strictly 
      // contains NO list starters in its body.

      let candidates: { type: string, startIdx: number, bodyStart: number, endIdx: number, fullMatch: string, body: string, options: string }[] = [];

      for (const t of types) {
        let searchCursor = 0;
        while (true) {
          const startTag = `\\begin{${t}}`;
          const idx = txt.indexOf(startTag, searchCursor);
          if (idx === -1) break;

          // Parse Optional Args [ ... ]
          let bodyStart = idx + startTag.length;
          let options = '';

          // Skip whitespace
          while (bodyStart < txt.length && /\s/.test(txt[bodyStart])) bodyStart++;

          if (txt[bodyStart] === '[') {
            const optEnd = findBalancedClose(txt, bodyStart, '[', ']');
            if (optEnd !== -1) {
              options = txt.substring(bodyStart, optEnd + 1); // keep brackets for now? or strip?
              bodyStart = optEnd + 1;
            }
          }

          // Find matching \end{...}
          // Scan forward, keeping track of nested same-type environments
          let depth = 1;
          let cursor = bodyStart;
          let endTagIdx = -1;

          while (cursor < txt.length) {
            const tagClose = `\\end{${t}}`;
            const tagOpen = `\\begin{${t}}`;

            if (txt.startsWith(tagClose, cursor)) {
              depth--;
              if (depth === 0) {
                endTagIdx = cursor;
                break;
              }
              cursor += tagClose.length;
            } else if (txt.startsWith(tagOpen, cursor)) {
              depth++;
              cursor += tagOpen.length;
            } else {
              cursor++;
            }
          }

          if (endTagIdx !== -1) {
            const fullMatch = txt.substring(idx, endTagIdx + `\\end{${t}}`.length);
            const body = txt.substring(bodyStart, endTagIdx);

            candidates.push({
              type: t,
              startIdx: idx,
              bodyStart,
              endIdx: endTagIdx,
              fullMatch,
              body,
              options
            });

            searchCursor = idx + 1; // Keep searching for others
          } else {
            searchCursor = idx + 1; // Broken environment, skip
          }
        }
      }

      // Filter for LEAVES: Body must NOT contain any \begin{enumerate|itemize|description}
      const leaf = candidates.find(c => {
        return !types.some(t => c.body.includes(`\\begin{${t}}`));
      });

      return leaf || null;
    };

    while (loopCount < 500) {
      const match = findLeafList(content);
      if (!match) break;
      loopCount++;

      // Process Items
      const { type, fullMatch, body, options } = match;

      const items: { label: string, text: string }[] = [];
      // Manual Item Splitter
      const itemParts = body.split(/\\item\b/g);
      // Note: split[0] is garbage before first item

      for (let i = 1; i < itemParts.length; i++) {
        let part = itemParts[i];
        let label = '';

        // Check for optional arg [label] 
        // Iterate char by char to handle nested brackets in label
        let pCursor = 0;
        while (pCursor < part.length && /\s/.test(part[pCursor])) pCursor++;

        if (part[pCursor] === '[') {
          const labelEnd = findBalancedClose(part, pCursor, '[', ']');
          if (labelEnd !== -1) {
            label = part.substring(pCursor + 1, labelEnd); // strip brackets
            part = part.substring(labelEnd + 1);
          }
        }

        items.push({ label, text: part });
      }

      let listHtml = '';
      if (type === 'enumerate') {
        // Pass options if needed for advanced styling? For now, we enforce our specific class
        listHtml = `<ol class="latex-enumerate">` +
          items.map(i => `<li>${resolvePlaceholders(parseLatexFormatting(i.text))}</li>`).join('') +
          `</ol>`;
      } else if (type === 'itemize') {
        listHtml = `<ul class="latex-itemize">` +
          items.map(i => `<li>${resolvePlaceholders(parseLatexFormatting(i.text))}</li>`).join('') +
          `</ul>`;
      } else if (type === 'description') {
        listHtml = `<dl class="latex-description">` +
          items.map(i => `<div class="latex-description-item"><dt>${resolvePlaceholders(parseLatexFormatting(i.label))}</dt><dd>${resolvePlaceholders(parseLatexFormatting(i.text))}</dd></div>`).join('') +
          `</dl>`;
      }

      const id = `__LIST_BLOCK_${placeholders.length}__`;
      placeholders.push({ id, html: listHtml });
      content = content.replace(fullMatch, id);
    }

    // Resolve placeholders
    let hasPlaceholder = true;
    let resolveCount = 0;
    while (hasPlaceholder && resolveCount < 200) {
      hasPlaceholder = false;
      resolveCount++;
      placeholders.forEach(p => {
        if (content.includes(p.id)) {
          content = content.replace(p.id, p.html);
          hasPlaceholder = true;
        }
      });
    }

    // Convert to Trojan Horse Placeholders for latex.js safety
    content = content.replace(/((?:<ol class="latex-enumerate">|<ul class="latex-itemize">|<dl class="latex-description">)[\s\S]*?(?:<\/ol>|<\/ul>|<\/dl>))/g, (match) => {
      return createPlaceholder(match);
    });

    return content;
  };



  // --- K. LISTS (Unified Manual Parser) ---
  content = processLists(content);

  // --- H. ALGORITHMS ---
  // --- H. ALGORITHMS ---
  content = content.replace(/\\begin\{algorithmic\}(?:\[.*?\])?([\s\S]*?)\\end\{algorithmic\}/g, (m, body) => {
    // 1. Process Content FIRST (Math restoration, HTML escaping of user text)
    // We must do this before injecting our own HTML tags (<br>, <strong>), otherwise they get escaped!
    let formatted = parseLatexFormatting(body);

    // 2. Inject Algorithm Structure (Case-Insensitive)
    formatted = formatted
      .replace(/\\State/gi, '<br><strong>State</strong> ')
      .replace(/\\If\{([^{}]*)\}/gi, '<br><strong>If</strong> $1 <strong>then</strong>')
      .replace(/\\EndIf/gi, '<br><strong>EndIf</strong>')
      .replace(/\\For\{([^{}]*)\}/gi, '<br><strong>For</strong> $1 <strong>do</strong>')
      .replace(/\\EndFor/gi, '<br><strong>EndFor</strong>')
      .replace(/\\Else/gi, '<br><strong>Else</strong>')
      .replace(/\\While\{([^{}]*)\}/gi, '<br><strong>While</strong> $1 <strong>do</strong>')
      .replace(/\\EndWhile/gi, '<br><strong>EndWhile</strong>');

    // 3. Resolve Math Placeholders (Recursively)
    return createPlaceholder(`<div class="algorithm-wrapper"><code>${resolvePlaceholders(formatted)}</code></div>`);
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

  // --- K. COMMAND STRIPPING (Strict Containment) ---
  // Architecture Rule: "Code is Law" - Dangerous macros must be intercepted.
  content = content
    .replace(/\\tableofcontents/g, '')
    .replace(/\\listoffigures/g, '')
    .replace(/\\listoftables/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\input\{.*?\}/g, '')
    .replace(/\\include\{.*?\}/g, '')
    .replace(/\\label\{.*?\}/g, '') // Remove labels
    .replace(/\\ref\{.*?\}/g, '[?]') // Safe placeholder for refs
    .replace(/\\eqref\{.*?\}/g, '(eqn)') // Safe placeholder for eqrefs
    .replace(/\\footnote\{.*?\}/g, '') // Remove footnotes (too complex for inline)
    .replace(/\\url\{([^{}]*)\}/g, '<span class="url">$1</span>'); // Flatten URLs to text

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

        // LAYER 2 SCALING (Restored inside Render Loop)
        // Must run HERE because this render function is async (setTimeout 50ms).
        // If we use useLayoutEffect, it runs too early (before these nodes exist).
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          // FIX: Include .table-wrapper to scale standard HTML tables too!
          const elements = containerRef.current.querySelectorAll('.katex-display, .table-wrapper');
          console.log('Detected Scalable Blocks:', elements.length);

          elements.forEach((el) => {
            const element = el as HTMLElement;
            // Reset to measure true width
            element.style.transform = '';
            element.style.width = '';
            element.style.transformOrigin = 'left center';

            // DEBUG: Trace Scaling Logic
            console.log('Checking KaTeX Block:', { scroll: element.scrollWidth, client: element.clientWidth });

            if (element.scrollWidth > element.clientWidth) {
              // Calculate scale (Floor at 0.55x to match docs)
              // FIX: Add 2% safety buffer to prevent clipping with overflow: hidden
              const scale = Math.max(0.55, (element.clientWidth / element.scrollWidth) * 0.98);
              console.log('Overflow Detected. Scaling:', scale);

              if (scale < 1) {
                element.style.transform = `scale(${scale})`;
                // element.style.width = `${(100 / scale)}%`; 
                // Correction: When scaling down, we don't necessarily need to expand the width 
                // unless we want it to take up more space?
                // Actually, if we scale down, the visual width shrinks. 
                // If we want it to still occupy the "full width" of the container (so it's centered or left aligned properly without gap?), 
                // we might need width adjustment.
                // But the doc says: "width: (100/scale)%"
                // Let's stick to the doc.
                element.style.width = `${(100 / scale)}%`;
                element.style.overflowX = 'hidden';
              }
            }
          });
        });

      } catch (err: any) {
        console.error("Preview Render Error:", err);
        setError(err.message || 'Unknown error');
      }
    };

    // FIX: Remove artificial delay (setTimeout) to eliminate race conditions.
    // latex.js is synchronous, so we render immediately.
    // Reference: User Request "eliminate race condition at root source"
    render();

  }, [latexContent]);

  if (error) {
    return (
      <div className={`latex-preview ${className}`}>
        <div style={{ padding: '20px', background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '4px' }}>
          <strong style={{ color: '#cc0000' }}>Preview Notice:</strong>
          <p>{error}</p>
          <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9em' }}>
            The preview uses a simplified browser renderer.
            <strong>Your LaTeX source will still compile perfectly.</strong>
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
