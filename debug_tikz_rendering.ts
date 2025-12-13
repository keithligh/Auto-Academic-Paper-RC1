
import { processTikz } from './client/src/lib/latex-unifier/tikz-engine.ts';

// Sample failing TikZ code based on user report and typical structure
// The error was "No shape named 'empathize' is known"
// This implies a usage like \draw (empathize) -- (define); but 'empathize' isn't valid.

const problematicLatex = `
\\begin{tikzpicture}[node distance=3cm, auto]
    % Comment that might trigger stripping issues if % is in label
    \\node (empathize) [rectangle, draw] {Empathize 100\\%};
    \\node (define) [rectangle, draw, below of=empathize] {Define};
    \\draw[->] (empathize) -- (define);
\\end{tikzpicture}
`;

console.log("--- INPUT LATEX ---");
console.log(problematicLatex);

try {
    const result = processTikz(problematicLatex);
    console.log("\n--- OUTPUT BLOCKS ---");
    // Extract the generated HTML from the block
    const blockKey = Object.keys(result.blocks)[0];
    if (blockKey) {
        const html = result.blocks[blockKey];
        // Decode the srcdoc to see the actual TikZ code passed to the engine
        const srcdocMatch = html.match(/srcdoc="([^"]*)"/);
        if (srcdocMatch) {
            const rawSrcDoc = srcdocMatch[1]
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');

            const tikzCodeMatch = rawSrcDoc.match(/<script type="text\/tikz">([\s\S]*?)<\/script>/);
            if (tikzCodeMatch) {
                console.log("\n--- GENERATED TIKZ CODE ---");
                console.log(tikzCodeMatch[1].trim());
            } else {
                console.log("Could not find TikZ script block in srcdoc");
                console.log(rawSrcDoc);
            }

        } else {
            console.log("Could not find srcdoc in HTML");
            console.log(html);
        }
    } else {
        console.log("No blocks generated!");
    }
} catch (error) {
    console.error("Error processing TikZ:", error);
}
