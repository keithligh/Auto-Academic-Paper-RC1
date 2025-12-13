
const content = `Preceding text.

\\begin{algorithm}[H]
\\caption{Algo}
\\begin{algorithmic}
\\State Code
\\end{algorithmic}
\\end{algorithm}

\\subsection*{Reliability Function}
Section content.`;

console.log("--- INPUT ---");
console.log(content);
console.log("-------------");

function runTest(regexName, regex) {
    console.log(`\nTesting ${regexName}:`);
    const match = regex.exec(content);
    if (match) {
        console.log("MATCH FOUND!");
        console.log("Full match length:", match[0].length);
        console.log("Captured Group 1 (Start to End):", match[0]);

        if (match[0].includes("Reliability Function")) {
            console.error("FAIL: Swallowed subsection!");
        } else {
            console.log("PASS: Stopped correctly.");
        }
    } else {
        console.log("No match found.");
    }
}

// 1. Current Regex (v1.9.90 with [\s\S])
// Note: Double escaping for string logic: \\begin -> literal \begin
const regexCurrent = /(\\begin\{[^}]+\}(?:(?!\\section|\\subsection|\\subsubsection)[\s\S])*?(\\end\{[^}]+\}|$))/g;

runTest("Current Regex", regexCurrent);

// 2. Debugging: Does lookahead work?
const regexLookahead = /\\subsection/g;
if (regexLookahead.test(content)) console.log("Subsection reachable.");

// 3. Alternative: Lazy dot matching
const regexLazy = /(\\begin\{[^}]+\}[\s\S]*?(\\end\{[^}]+\}|$))/g;
runTest("Lazy Regex (Old)", regexLazy);
