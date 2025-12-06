
/**
 * debug_vis_logic.ts
 * Reproduction script for TikZ logic analysis (Item 1)
 */

const testTikz = `
\\begin{tikzpicture}[node distance=2cm]
\\node (A) {Start};
\\node (B) [right of=A] {End};
\\draw [decorate,decoration={brace,mirror}] (A) -- (B);
\\end{tikzpicture}
`;

function analyzeTikz(tikz: string) {
    console.log("Analyzing TikZ Code...");
    const nodeMatches = tikz.match(/\\node/g) || [];
    const distMatch = tikz.match(/node distance\s*=\s*([\d\.]+)/);

    console.log(`Node Count: ${nodeMatches.length}`);
    if (distMatch) {
        console.log(`Explicit Node Distance: ${distMatch[1]}`);
    } else {
        console.log("No explicit node distance found.");
    }

    // Test Polyfill Regex
    const braceRegex = /\\draw\[decorate,decoration=\{brace([^}]*)\}\]\s*\(([^)]+)\)\s*--\s*\(([^)]+)\)/g;
    let match;
    while ((match = braceRegex.exec(tikz)) !== null) {
        console.log(`Brace Detected: ${match[0]}`);
        console.log(`Options: ${match[1]}`);
        console.log(`Start: ${match[2]}, End: ${match[3]}`);
    }
}

analyzeTikz(testTikz);
