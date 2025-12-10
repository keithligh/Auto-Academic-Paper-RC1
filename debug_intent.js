
const tikzInput = `\\begin{tikzpicture}[x=1cm,y=1cm]
  % Timeline axis
  \\draw[->] (0,0) -- (10,0) node[right] {Time};

  % Media points
  \\node[below] at (1,0) {Print};
  \\fill (1,0) circle (0.05cm);

  \\node[below] at (3,0) {Web};
  \\fill (3,0) circle (0.05cm);

  \\node[below] at (5,0) {Online ref.};
  \\fill (5,0) circle (0.05cm);

  \\node[below] at (7,0) {Social media};
  \\fill (7,0) circle (0.05cm);

  \\node[below] at (9,0) {AI output};
  \\fill (9,0) circle (0.05cm);

  % Arrow for increasing need of critical thinking
  \\draw[->] (0,0.5) -- (9.5,2.5) node[above] {Growing need for logic and critical thinking};
\\end{tikzpicture}`;

function process(html) {
    const match = html.match(/\\begin\{tikzpicture\}(\[.*?\])?([\s\S]*?)\\end\{tikzpicture\}/);
    if (!match) return "NO MATCH";

    let options = match[1] || '';
    const safeTikz = match[2];

    // --- LOGIC FROM LatexPreview.tsx ---
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
    const aspectRatio = verticalSpan > 0 ? horizontalSpan / verticalSpan : 0;
    const isFlat = horizontalSpan > 0 && verticalSpan > 0 && aspectRatio > 3.0;

    let intent = 'MEDIUM';
    if (horizontalSpan > 0) {
        if (isFlat) intent = 'FLAT';
        else intent = 'LARGE';
    }

    console.log(`Span: ${horizontalSpan}x${verticalSpan}`);
    console.log(`Ratio: ${aspectRatio}`);
    console.log(`Intent: ${intent}`);
    console.log(`Options Before: ${options}`);

    let extraOpts = '';
    let processedOptions = options.trim();

    if (intent === 'FLAT') {
        const targetRatio = 2.0;
        const yBoost = aspectRatio / targetRatio;
        const yMultiplier = Math.min(3.0, Math.max(1.5, yBoost));
        const xMultiplier = 1.5;

        const existingXMatch = options.match(/x\s*=\s*([\d.]+)/);
        const existingYMatch = options.match(/y\s*=\s*([\d.]+)/);

        const baseX = existingXMatch ? parseFloat(existingXMatch[1]) : 1.0;
        const baseY = existingYMatch ? parseFloat(existingYMatch[1]) : 1.0;

        const newX = (baseX * xMultiplier).toFixed(1);
        const newY = (baseY * yMultiplier).toFixed(1);

        console.log(`Multipliers: x=${xMultiplier}, y=${yMultiplier}`);
        console.log(`Base: x=${baseX}, y=${baseY}`);
        console.log(`New: x=${newX}, y=${newY}`);

        // Strip Logic
        processedOptions = processedOptions.replace(/,?\s*x\s*=\s*[\d.]+\s*(cm)?/gi, '');
        processedOptions = processedOptions.replace(/,?\s*y\s*=\s*[\d.]+\s*(cm)?/gi, '');

        extraOpts += `, x=${newX}cm, y=${newY}cm, scale=1.0`;
    }

    console.log(`Options After Strip: "${processedOptions}"`);
    console.log(`Extra Opts: "${extraOpts}"`);

    let finalOptions = processedOptions;
    if (!finalOptions || finalOptions === '[]' || finalOptions.trim() === '[]') {
        finalOptions = extraOpts ? `[${extraOpts.replace(/^,\s*/, '').trim()}]` : '[]';
    } else if (finalOptions.startsWith('[') && finalOptions.endsWith(']')) {
        finalOptions = finalOptions.slice(0, -1) + extraOpts + ']';
    }

    console.log(`Final Options: "${finalOptions}"`);
    return finalOptions;
}

process(tikzInput);
