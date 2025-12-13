
const content = `Preceding text.

\\begin{algorithm}[H]
\\caption{Broken Algo}
\\begin{algorithmic}
\\State Code
\\end{algorithmic}
% OMG MISSING END TAG

\\subsection*{Reliability Function}
Section content.`;

console.log("--- INPUT (BROKEN) ---");
console.log(content);
console.log("----------------------");

function runTest(regexName, regex) {
    console.log(`\nTesting ${regexName}:`);
    let found = false;
    // Reset regex index
    regex.lastIndex = 0;

    // Use replace loop to simulate processor.ts
    const result = content.replace(regex, (m) => {
        found = true;
        console.log("MATCH FOUND!");
        console.log("Full match length:", m.length);
        console.log("Captured Content:", m);

        if (m.includes("Reliability Function")) {
            console.error("FAIL: Swallowed subsection!");
        } else {
            console.log("PASS: Stopped correctly at subsection boundary.");
        }
        return "REPLACED";
    });

    if (!found) console.log("No match found.");
}

// 1. Current Regex (v1.9.90 with [\s\S])
const regexCurrent = /(\\begin\{[^}]+\}(?:(?!\\section|\\subsection|\\subsubsection)[\s\S])*?(\\end\{[^}]+\}|$))/g;

runTest("Current Regex", regexCurrent);

// 2. Control: Greedy dot (Old v1.9.89 logic with no lookahead)
// Note: dot doesn't match newline without s flag, but we use [\s\S] for simulation
const regexGreedy = /(\\begin\{[^}]+\}[\s\S]*?(\\end\{[^}]+\}|$))/g;
runTest("Greedy Regex (Control)", regexGreedy);
