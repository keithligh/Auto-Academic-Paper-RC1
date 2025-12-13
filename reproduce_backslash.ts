
const tableBody = String.raw`
Header 1 & Header 2 & Header 3\ \hline
Row 1 & Row 2 & Row 3 \\
`;

function processTable(body: string) {
    console.log(`Original: ${JSON.stringify(body)}`);
    let tableBody = body;

    // Current Logic (from table-engine.ts line 116)
    // FIX (v1.9.106): Implicit Row Splitting
    tableBody = tableBody.replace(/([^\\])\\(hline|midrule|toprule|bottomrule|cline)/g, '$1\\\\ \\$2');

    console.log(`Processed: ${JSON.stringify(tableBody)}`);

    // Check for stray backslashes
    // If input was "Header 3\ \hline", and regex matched " \hline", putting " \\ \hline"
    // The preceding "\" from "Header 3\" is left alone?
    // "Header 3\ \hline" -> The char before \hline is space. 
    // The char before space is \.
    // Regex ([^\\]) matches the space? Yes.
    // So replacement is " \\ \hline".
    // Result: "Header 3\ \\ \hline".
    // The "Header 3\" part remains.
}

processTable(tableBody);
