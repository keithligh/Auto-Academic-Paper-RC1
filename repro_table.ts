
import { processTables } from './client/src/lib/latex-unifier/table-engine';

const problemTable = `
\\begin{table}[h!]
\\centering
\\caption{Three-Tiered Framework for GenAI Value Creation}
\\begin{tabular}{|p{1.5cm}|p{2.5cm}|p{4cm}|p{3.5cm}|}
\\hline
\\textbf{Level} & \\textbf{Scope} & \\textbf{Representative Use Cases} & \\textbf{Key Performance Indicators (KPIs)} \\\\ \\hline
\\textbf{3. Strategic} & Leadership and decision-making & Policy analysis & public sentiment tracking; Strategic 'red teaming' & scenario simulation; Conversational data briefings & Time-to-insight on strategic queries; Number of unidentified risks surfaced; Reduction in analyst report latency \\\\ \\hline
\\end{tabular}
\\end{table}
`;

console.log("Processing Table...");
// Mock the identity formatting function
const mockFormat = (s: string) => s;
const result = processTables(problemTable, mockFormat);

const blockId = Object.keys(result.blocks)[0];
if (blockId) {
    const html = result.blocks[blockId];
    console.log("Generated HTML Table Row (Strategic):");

    // Extract the row for "Strategic"
    const rowMatch = html.match(/<tr>\s*<td>.*?Strategic.*?<\/tr>/s);
    if (rowMatch) {
        console.log(rowMatch[0]);
        const cellCount = (rowMatch[0].match(/<td/g) || []).length;
        console.log(`Cell Count: ${cellCount}`);
        if (cellCount > 4) {
            console.log("FAIL: Too many cells detected (Expected 4). Root cause: Unescaped ampersands.");
        } else {
            console.log("PASS: Cell count correct.");
        }
    } else {
        console.log("Could not find the row in HTML.");
        console.log(html);
    }
} else {
    console.log("No table block generated.");
}
