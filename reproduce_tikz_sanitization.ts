
const tikzCode = `
    % Define styles
    \\tikzstyle{layer} = [rectangle, draw, thick, minimum width=6cm, minimum height=1.2cm, fill=gray!10]
    \\tikzstyle{actor} = [rectangle, draw, thick, minimum width=2.5cm, fill=blue!10]
    \\tikzstyle{infra} = [cylinder, shape border rotate=90, draw, thick, minimum width=2.5cm, fill=green!10, aspect=0.3]

    % Layers
    \\node (ui) [layer] {\\textbf{User Interface Layer} \\\\ Visual Workflow Design, Business Logic Abstraction};
    \\node (integ) [layer, below of=ui] {\\textbf{AI Integration Layer} \\\\ Model Connectors, Hardware Optimization, Inference Engine};
    \\node (gov) [layer, below of=integ] {\\textbf{Governance & Control Layer} \\\\ Prompt Config, Audit Logs, Access Control, Versioning};
    \\node (deploy) [layer, below of=gov] {\\textbf{Deployment Layer} \\\\ On-Premise, Sovereign Cloud, Hybrid};

    % External Actors/Systems
    \\node (users) [actor, above of=ui, yshift=0.5cm] {Business Users};
    \\node (models) [actor, right of=integ, xshift=2.5cm] {Open-Source LLMs \\\\ (Qwen, GLM, DeepSeek)};
    \\node (gpu) [infra, below of=deploy, yshift=-0.5cm] {GPU Infrastructure \\\\ (DGX Spark, MXC, etc.)};

    % Arrows
    \\draw[<->, thick] (users) -- (ui);
    \\draw[<->, thick] (ui) -- (integ);
    \\draw[<->, thick] (integ) -- (gov);
    \\draw[<->, thick] (gov) -- (deploy);
    \\draw[->, thick] (deploy) -- (gpu);
    \\draw[<->, thick] (integ) -- (models);
`;

const sanitizeStr = (s) => s
    .replace(/%.*$/gm, '') // CRITICAL: Strip comments before flattening
    .replace(/\\textbf\s*\{/g, '{\\bfseries ')
    .replace(/\\textit\s*\{/g, '{\\itshape ')
    .replace(/\\sffamily/g, '') // Crash prevention
    .replace(/\\rmfamily/g, '')
    .replace(/\\ttfamily/g, '')
    .replace(/\\n(?![a-zA-Z])/g, ' ') // Fix \n literal
    .replace(/\n/g, ' ');

const result = sanitizeStr(tikzCode);
console.log("ORIGINAL:");
console.log(tikzCode);
console.log("\nSANITIZED:");
console.log(result);

// Check for missing node definitions
if (!result.includes('\\node (users)')) {
    console.error("ERROR: \\node (users) is MISSING in sanitized output!");
} else {
    console.log("SUCCESS: \\node (users) is present.");
}
