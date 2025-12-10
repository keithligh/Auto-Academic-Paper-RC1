
/**
 * latex-unifier/tikz-engine.ts
 * "The Architect"
 * 
 * Responsibility: Handling all TikZ extraction and layout physics.
 * PRESERVES:
 * - The Intent Engine: WIDE / FLAT / COMPACT / LARGE / MEDIUM classification.
 * - The Bifurcated Safety Net: The 8.4cm vs 0.5cm decision tree.
 * - The Goldilocks Protocol: Adaptive Y-scaling logic.
 * - Geometric Polyfill: The manual Bezier curve drawer for curly braces.
 * - Robust Extraction: Stripping comments, library injection, font safety.
 */

// Global counter for unique IDs (shared state simulator for the extraction phase)
let blockCount = 0;

export interface TikzResult {
    cleanedContent: string;
    blocks: Record<string, string>;
}

// === HELPER: Create TikZ iframe block (FULL INTENT ENGINE) ===
// Copied VERBATIM from LatexPreview.tsx lines 186-679 (Adapted for standalone function)
function createTikzBlock(tikzCode: string, options: string = '', blocks: Record<string, string>): string {
    const id = `LATEXPREVIEWTIKZ${blockCount++}`;

    // SAFETY: pgfplots rejection
    if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
        blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - not supported in browser preview</div>`;
        return `\n\n${id}\n\n`;
    }

    // SANITIZATION: TikZJax (btoa) crashes on Unicode. Force ASCII.
    let safeTikz = tikzCode.replace(/[^\x00-\x7F]/g, '');
    let safeOptions = options.replace(/[^\x00-\x7F]/g, '');

    // SANITIZATION: Remove enumitem/itemize which crashes TikZJax in nodes
    safeTikz = safeTikz.replace(/\\begin\{itemize\}\[[^\]]*\]/g, '\\begin{itemize}');
    if (safeTikz.includes('\\begin{itemize}')) {
        safeTikz = safeTikz
            .replace(/\\begin\{itemize\}/g, '')
            .replace(/\\end\{itemize\}/g, '')
            .replace(/\\item\s+/g, '\\par $\\bullet$ ');
    }

    // FIX (v1.6.10): Escape ampersands in TikZ code
    safeTikz = safeTikz.replace(/\\\\&/g, '\\\\ \\&');
    safeTikz = safeTikz.replace(/([^\\])&/g, '$1\\&');

    // GEOMETRIC POLYFILL: Manual Bezier Braces for TikZJax
    // FIX (v1.6.21): Made regex robust against whitespace
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

            let c1x, c1y, c2x, c2y, c3x, c3y, tipX, tipY;
            const mag = 0.15; // amplitude base
            const tipMag = 0.35; // tip height
            const dir = isMirror ? -1 : 1;

            if (isVertical) {
                const sign = -1 * dir;
                c1x = p1.x + (sign * mag); c1y = p1.y;
                c2x = midX + (sign * mag); c2y = midY;
                tipX = midX + (sign * tipMag); tipY = midY;
                c3x = p2.x + (sign * mag); c3y = p2.y;
                const labelX = midX + (sign * (tipMag + 0.6));
                const labelY = midY;
                return `\\draw[thick] (${p1.x},${p1.y}) .. controls (${c1x},${c1y}) and (${c2x},${c2y}) .. (${tipX},${tipY}) .. controls (${c2x},${c2y}) and (${c3x},${c3y}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${labelX},${labelY}) {${label}};`;
            } else {
                const sign = 1 * dir;
                c1x = p1.x; c1y = p1.y + (sign * mag);
                c2x = midX; c2y = midY + (sign * mag);
                tipX = midX; tipY = midY + (sign * tipMag);
                c3x = p2.x; c3y = p2.y + (sign * mag);
                const labelX = midX;
                const labelY = midY + (sign * (tipMag + 0.6));
                return `\\draw[thick] (${p1.x},${p1.y}) .. controls (${c1x},${c1y}) and (${c2x},${c2y}) .. (${tipX},${tipY}) .. controls (${c2x},${c2y}) and (${c3x},${c3y}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${labelX},${labelY}) {${label}};`;
            }
        }
    );

    // --- INTENT ENGINE LOGIC ---
    const nodeMatches = safeTikz.match(/\\node/g) || [];
    const drawMatches = safeTikz.match(/\\draw/g) || [];
    const arrowMatches = safeTikz.match(/->/g) || [];

    // HEURISTIC: Extract ACTUAL node label text
    const nodeLabelMatches = safeTikz.match(/\\node[^;]*\{([^}]*)\}/g) || [];
    let totalLabelText = 0;
    nodeLabelMatches.forEach(match => {
        const labelMatch = match.match(/\{([^}]*)\}$/);
        if (labelMatch) {
            const label = labelMatch[1].replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
            totalLabelText += label.length;
        }
    });
    const avgLabelTextPerNode = nodeMatches.length > 0 ? totalLabelText / nodeMatches.length : 0;
    const isTextHeavy = avgLabelTextPerNode > 30;

    // NEW (v1.5.6): Detect WIDE and FLAT diagrams
    const allCoordMatches = safeTikz.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g) || [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    allCoordMatches.forEach(m => {
        const coords = m.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
        if (coords) {
            const x = parseFloat(coords[1]);
            const y = parseFloat(coords[2]);
            if (!isNaN(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
            if (!isNaN(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        }
    });

    const horizontalSpan = (maxX !== -Infinity && minX !== Infinity) ? (maxX - minX) : 0;
    const verticalSpan = (maxY !== -Infinity && minY !== Infinity) ? (maxY - minY) : 0;
    // const isWideHorizontal = horizontalSpan > 14; 
    const aspectRatio = verticalSpan > 0 ? horizontalSpan / verticalSpan : 0;
    const isFlat = horizontalSpan > 0 && verticalSpan > 0 && aspectRatio > 3.0;

    // REFACTOR (v1.5.5): HYBRID INTENT
    let intent = 'MEDIUM';
    let nodeDist = 2.0;

    const distMatch = safeOptions.match(/node distance\s*=\s*([\d\.]+)/);
    if (distMatch) nodeDist = parseFloat(distMatch[1]);

    if (horizontalSpan > 0) {
        if (isFlat) intent = 'FLAT';
        else intent = 'LARGE'; // Absolute Layout uses Density Engine
    } else if (distMatch) {
        if (nodeDist < 2.0) intent = 'COMPACT';
        else if (nodeDist >= 2.5) intent = 'LARGE';
    } else {
        if (isTextHeavy) intent = 'LARGE';
        else if (nodeMatches.length >= 8) intent = 'COMPACT';
    }

    // EXECUTE RULES
    let extraOpts = '';
    let processedOptions = safeOptions.trim();

    if (intent === 'COMPACT') {
        const scale = nodeMatches.length >= 8 ? 0.75 : 0.85;
        if (!safeOptions.includes('scale=')) extraOpts += `, scale=${scale}`;
        if (!safeOptions.includes('transform shape')) extraOpts += ', transform shape';
        if (!safeOptions.includes('node distance')) extraOpts += ', node distance=1.5cm';

    } else if (intent === 'LARGE') {
        // GOAL: Readability & Maximize Spacing
        // Width Budget: 25cm
        const optimalUnit = Math.min(2.5, 25 / (horizontalSpan || 1));
        const dynamicClamp = horizontalSpan > 7 ? 1.8 : 1.3;

        // Adaptive Y-Axis Scaling (Goldilocks Vertical)
        const targetHeight = 8; // cm (v1.6.40: reduced from 12cm)
        const rawY = verticalSpan > 0 ? (targetHeight / verticalSpan) : 0.5;
        let yUnit = rawY === 0.5 ? 0.5 : Math.min(1.8, Math.max(1.0, rawY));

        const xUnit = Math.min(dynamicClamp, optimalUnit);
        extraOpts += `, x=${xUnit.toFixed(2)}cm, y=${yUnit.toFixed(2)}cm`;

        if (!safeOptions.includes('font=')) extraOpts += ', font=\\small';

        const targetDist = isTextHeavy ? 8.4 : 5.0;
        if (!safeOptions.includes('node distance')) {
            extraOpts += `, node distance=${targetDist}cm`;
        } else {
            // Bifurcated Safety Net
            if (isTextHeavy) {
                if (nodeDist < targetDist) extraOpts += `, node distance=${targetDist}cm`;
            } else {
                if (nodeDist < 0.5) extraOpts += `, node distance=${targetDist}cm`;
            }
        }

        if (!safeOptions.includes('text width')) extraOpts += ', every node/.append style={align=center}';

    } else if (intent === 'WIDE') {
        const targetWidth = 14;
        const scaleFactor = Math.min(1.0, targetWidth / horizontalSpan);
        const scale = Math.max(0.5, scaleFactor * 0.9);
        if (!safeOptions.includes('scale=')) extraOpts += `, scale=${scale.toFixed(2)}`;
        if (!safeOptions.includes('transform shape')) extraOpts += ', transform shape';

    } else if (intent === 'FLAT') {
        const targetRatio = 2.0;
        const yBoost = aspectRatio / targetRatio;
        const yMultiplier = Math.min(3.0, Math.max(1.5, yBoost));
        const xMultiplier = 1.5;

        const existingX = safeOptions.match(/x\s*=\s*([\d.]+)/);
        const existingY = safeOptions.match(/y\s*=\s*([\d.]+)/);
        const baseX = existingX ? parseFloat(existingX[1]) : 1.0;
        const baseY = existingY ? parseFloat(existingY[1]) : 1.0;

        const newX = (baseX * xMultiplier).toFixed(1);
        const newY = (baseY * yMultiplier).toFixed(1);

        processedOptions = processedOptions.replace(/,?\s*x\s*=\s*[\d.]+\s*(cm)?/gi, '');
        processedOptions = processedOptions.replace(/,?\s*y\s*=\s*[\d.]+\s*(cm)?/gi, '');
        processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');

        extraOpts += `, x=${newX}cm, y=${newY}cm, scale=1.0`;
        if (nodeMatches.length >= 5 && !safeOptions.includes('font=')) extraOpts += ', font=\\small';

    } else {
        // MEDIUM
        let scale = 0.9;
        if (horizontalSpan > 0 && horizontalSpan <= 14) scale = 1.0;
        else scale = nodeMatches.length >= 6 ? 0.8 : 0.9;

        if (!safeOptions.includes('scale=') && !safeOptions.includes('x=') && !safeOptions.includes('y=')) extraOpts += `, scale=${scale}`;

        const hasExplicitScale = safeOptions.includes('x=') || safeOptions.includes('y=');
        if (hasExplicitScale && !safeOptions.includes('transform shape')) extraOpts += ', transform shape';
        if (!safeOptions.includes('node distance')) extraOpts += ', node distance=2.5cm';
    }

    // Goldilocks Protocol: Coordinate Boost for text-heavy relative diagrams
    const isRelativeOrIndex = horizontalSpan === 0;
    if (isTextHeavy && !safeOptions.includes('x=') && isRelativeOrIndex && intent !== 'LARGE') {
        extraOpts += ', x=2.2cm, y=1.5cm';
    }

    // Large Intent Stripping (Refactored scope)
    if (intent === 'LARGE') {
        const targetDist = isTextHeavy ? 8.4 : 5.0;
        const distMatch = safeOptions.match(/node distance\s*=\s*([\d\.]+)/);
        if (distMatch && parseFloat(distMatch[1]) < targetDist) {
            processedOptions = processedOptions.replace(/,?\s*node distance\s*=\s*[\d.]+\s*(cm)?/gi, '');
            processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');
        }
    }

    // Merge Options
    let combined = extraOpts.trim();
    if (processedOptions) {
        combined += (combined ? ',' : '') + processedOptions;
    }
    combined = combined.replace(/^,/, '').replace(/,\s*,/g, ',').replace(/,$/, '');
    const finalOptions = `[${combined}]`;

    // IFRAME HTML GENERATION
    const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/node-tikzjax@latest/css/fonts.css">
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; overflow: hidden; width: 100%; }
    svg { width: auto !important; height: auto !important; max-width: 100% !important; display: block; margin: 0 auto; }
    .tikzjax-container { width: 100%; display: flex; justify-content: center; }
    .tikz-loading { width: 100%; display: flex; align-items: center; justify-content: center; padding: 40px 20px; box-sizing: border-box; color: #666; font-family: sans-serif; font-size: 14px; white-space: nowrap; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    .tikz-loading.hidden { display: none; }
  </style>
  <script>
    // SILENCE THE NOISE: Filter out TikZJax/jsTeX logs
    (function() {
      const originalLog = console.log;
      const originalGroup = console.group;
      const originalGroupEnd = console.groupEnd;
      const originalWarn = console.warn;
      const originalError = console.error;

      // NOTICE OF INTERVENTION
      originalLog('%c Antigravity: Silencing TikZJax/jsTeX console logs to reduce noise.', 'background: #222; color: #bada55; padding: 4px; border-radius: 4px;');

      const isNoise = (args) => {
        if (!args || args.length === 0) return false;
        const msg = String(args[0]);
        return msg.includes('This is jsTeX') || 
               msg.includes('Missing character:') || 
               msg.includes('entering extended mode') ||
               msg.includes('LaTeX Font Warning') ||
               msg.includes('No pages of output') ||
               msg.includes('Transcript written') ||
               msg.includes('width=device-width');
      };

      console.log = (...args) => { if (!isNoise(args)) originalLog.apply(console, args); };
      console.warn = (...args) => { if (!isNoise(args)) originalWarn.apply(console, args); };
      console.error = (...args) => { if (!isNoise(args)) originalError.apply(console, args); };
      console.group = (...args) => { if (!isNoise(args)) originalGroup.apply(console, args); };
      // Keep groupEnd to avoid nesting errors, mostly harmless
      
      window.addEventListener('error', e => { if (e.message?.includes('message channel closed')) e.preventDefault(); });
      window.addEventListener('unhandledrejection', e => { if (e.reason?.message?.includes('message channel closed')) e.preventDefault(); });
    })();
  </script>
</head>
<body>
  <div id="tikz-loading" class="tikz-loading"><div>[ Generating diagram... ]</div></div>
  <div class="tikzjax-container">
    <script type="text/tikz">
      \\usetikzlibrary{arrows,shapes,calc,positioning,decorations.pathreplacing}
      \\begin{tikzpicture}${finalOptions}
      ${safeTikz}
      \\end{tikzpicture}
    </script>
  </div>
  <script>
    const observer = new MutationObserver(() => {
      const svg = document.querySelector('svg');
      if (svg && window.frameElement) {
         const loading = document.getElementById('tikz-loading');
         if (loading) loading.classList.add('hidden');
         const rect = svg.getBoundingClientRect();
         const h = Math.max(rect.height + 25, 100); 
         window.frameElement.style.height = h + 'px';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  </script>
</body>
</html>`;

    const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    blocks[id] = `<div style="display: flex; justify-content: center; width: 100%; margin: 1em 0;"><iframe srcdoc="${srcdoc}" style="border: none; width: 100%; overflow: hidden;"></iframe></div>`;
    return `\n\n${id}\n\n`;
}

// === EXPORTED MAIN PROCESSOR ===
export function processTikz(content: string): TikzResult {
    let cleaned = content;
    const blocks: Record<string, string> = {};

    // We reset global block count simulated for this module if needed, 
    // or we just keep incrementing. To match "God Object", we keep global uniqueness.

    let loopSafety = 0;
    while (cleaned.includes('\\begin{tikzpicture}')) {
        if (loopSafety++ > 100) break;
        const startIdx = cleaned.indexOf('\\begin{tikzpicture}');
        const endIdx = cleaned.indexOf('\\end{tikzpicture}', startIdx);
        if (endIdx === -1) break;

        // Manual extraction to handle nested brackets in options
        const tagLen = '\\begin{tikzpicture}'.length;
        let bodyStart = startIdx + tagLen;
        let options = '';

        if (cleaned[bodyStart] === '[') {
            const closeOpt = cleaned.indexOf(']', bodyStart);
            if (closeOpt !== -1) {
                // Determine true closing bracket (basic brace counter if needed, but existing code used simple indexOf)
                // Existing code: content.indexOf(']', bodyStart); -> This is fragile but we are copying it.
                // Wait, LatexPreview.tsx line 740 used indexOf.
                // We should probably safeguard it? "WE NEED ALL THE PATCHES" implies mirroring logic.
                // But if it was buggy, we shouldn't copy bugs? 
                // The implementation plan says "Preserve patches".
                // Let's stick to the source logic:
                options = cleaned.substring(bodyStart + 1, closeOpt);
                bodyStart = closeOpt + 1;
            }
        }

        const body = cleaned.substring(bodyStart, endIdx);
        const placeholder = createTikzBlock(body, options, blocks);
        cleaned = cleaned.substring(0, startIdx) + placeholder + cleaned.substring(endIdx + '\\end{tikzpicture}'.length);
    }

    return { cleanedContent: cleaned, blocks };
}
