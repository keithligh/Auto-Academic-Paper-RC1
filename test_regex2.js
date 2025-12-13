// Test regex pattern
const testContent = `blah blah

\\begin{algorithm}
\\caption{Test}
\\label{test}
\\begin{enumerate}
\\item test item
\\end{enumerate}
\\end{algorithm}`;

console.log('Test 4: Fixed regex with correct \\s\\S');
const fixedRegex = /\\begin\{algorithm\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{algorithm\}/g;
console.log('  Pattern:', fixedRegex);
const matches = testContent.match(fixedRegex);
console.log('  Matches:', matches);
console.log('  Match count:', matches ? matches.length : 0);
