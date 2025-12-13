
const tikzCode = `
\\begin{tikzpicture}
  % Axes
  \\draw[->] (0,0) -- (6,0) node[right] {Integration Depth ($I$)};
  \\draw[->] (0,0) -- (0,5) node[above] {Utility ($U$)};

  % Theoretical Max Curve (Concave down, high peak)
  \\draw[thick, blue] (0,0) .. controls (2,4) and (4,4.5) .. (5.5,3) node[right] {$U_{max}$ (Ideal)};

  % Realized Utility Curve (Lower, peaks earlier due to Risk)
  \\draw[thick, red, dashed] (0,0) .. controls (1.5,2.5) and (3,1) .. (5.5,-1) node[right] {$U_{real}$ (Actual)};

  % Gap Annotation
  \\draw[<->, thick] (3, 3.8) -- (3, 1.2) node[midway, right] {$\\Delta_{gap}$};

  % Constraint Line
  \\draw[gray, dotted] (2.5, 0) -- (2.5, 5) node[above] {Talent Constraint ($T_{AI}$)};

\\end{tikzpicture}
`;

function process(safeTikz, options = "") {
    console.log("--- Analyzing TikZ ---");

    // 1. Coordinates
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

    console.log(`Coords: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);

    const horizontalSpan = (maxX !== -Infinity && minX !== Infinity) ? (maxX - minX) : 0;
    const verticalSpan = (maxY !== -Infinity && minY !== Infinity) ? (maxY - minY) : 0;

    console.log(`Span: ${horizontalSpan} x ${verticalSpan}`);

    const isFlat = horizontalSpan > 0 && verticalSpan > 0 && (horizontalSpan / verticalSpan) > 3.0;

    let intent = 'MEDIUM';
    if (horizontalSpan > 0) {
        if (isFlat) intent = 'FLAT';
        else intent = 'LARGE';
    }

    console.log(`Intent: ${intent}`);

    let extraOpts = "";
    if (intent === 'LARGE') {
        const optimalUnit = Math.min(2.5, 25 / (horizontalSpan || 1));
        const dynamicClamp = horizontalSpan > 7 ? 1.8 : 1.3;
        const xUnit = Math.min(dynamicClamp, optimalUnit); // Keeps width constraint

        const targetHeight = 8; // cm 
        const rawY = verticalSpan > 0 ? (targetHeight / verticalSpan) : 1.0;
        let yUnit = Math.min(1.8, Math.max(1.0, rawY));

        console.log(`Maths:`);
        console.log(`optimalUnit (25/span): ${optimalUnit}`);
        console.log(`dynamicClamp (span>7?): ${dynamicClamp}`);
        console.log(`xUnit: ${xUnit}`);
        console.log(`targetHeight: ${targetHeight}`);
        console.log(`rawY (8/span): ${rawY}`);
        console.log(`yUnit (clamped 1.0-1.8): ${yUnit}`);

        extraOpts += `, x=${xUnit.toFixed(2)}cm, y=${yUnit.toFixed(2)}cm`;
    }

    console.log(`Final Extra Opts: ${extraOpts}`);
}

process(tikzCode);
