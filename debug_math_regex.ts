
const content = `\\subsection*{Formalization of Strategy and Constraint Mapping}
A small set of equations formally defining the strategy tuple S and its mapping to constraint sets and translated text.

\\begin{align*}
  S &= (p, a, c, F, Q), \\\\
  \\mathcal{C}(S) &= \\{\\text{obligations},\\ \\text{prohibitions},\\ \\text{priority rules}\\}, \\\\
  T' &= \\operatorname{LLM}(T, L_s, L_t, \\mathcal{C}(S), G(S)).
\\end{align*}

The design of TranslationAI can be formalized`;

const regex = /\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g;

console.log("--- Testing Regex ---");
let match;
let found = false;
while ((match = regex.exec(content)) !== null) {
    console.log("Found match!");
    console.log("Env:", match[1]);
    console.log("Body:", match[2]);
    found = true;
}

if (!found) {
    console.log("NO MATCH FOUND.");
}
