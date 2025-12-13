
import { processTikz } from '../client/src/lib/latex-unifier/tikz-engine';

const tikzCode = `
\\begin{tikzpicture}[>=stealth, node distance=2.2cm, every node/.style={font=\\small}]
\\tikzset{box/.style={draw, rounded corners, align=center, minimum width=2.8cm, minimum height=1.0cm}}
\\node[box] (PP) {Publishing\\\\Printing (PP)};
\\node[box, right=of PP] (PR) {Premium\\\\Packaging (PR)};
\\node[box, below=of PP] (CM) {Corrugated\\\\Manufacturing (CM)};
\\node[box, below=of PR] (PT) {Paper\\\\Trading (PT)};

\\draw[->, color=Maroon] (PT) -- node[align=center, right, color=Maroon] {procurement\\\\optionalities} (PR);
\\draw[->, color=Maroon] (PT) -- node[align=center, left, color=Maroon] {supply assurance\\\\\& traceability} (CM);
\\draw[->, color=Maroon] (PT) -- node[align=center, left, color=Maroon] {grade matching\\\\\& documentation} (PP);

\\node[align=center, font=\\footnotesize] at ($(PP)!0.5!(PT)+(0.0,-1.8)$) {\\textit{Boundary conditions: coordination costs,}\\newline\\textit{design-for-recycling constraints,}\\newline\\textit{digital integration capabilities}};
\\end{tikzpicture}
`;

console.log("--- Processing TikZ ---");
const result = processTikz(tikzCode);
console.log("--- Result Blocks ---");
Object.values(result.blocks).forEach(b => console.log(b));
