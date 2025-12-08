/**
 * ROBUSTNESS TEST FOR fixAIJsonEscaping CHANGES
 * 
 * This test verifies:
 * 1. The original fix worked correctly
 * 2. The new fix doesn't break JSON parsing
 * 3. Edge cases are handled properly
 */

// Original function (BEFORE fix)
function fixAIJsonEscaping_ORIGINAL(jsonString) {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        if (char === '"' && !escape) {
            inString = !inString;
            result += char;
            escape = false;
            continue;
        }
        if (inString) {
            if (char === '\\' && !escape) {
                const nextChar = i < jsonString.length - 1 ? jsonString[i + 1] : '';
                if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
                    escape = true;
                    result += char;
                } else {
                    result += '\\\\';  // DOUBLE the backslash
                    escape = false;
                }
                continue;
            }
        }
        result += char;
        escape = false;
    }
    return result;
}

// New function (AFTER fix)
function fixAIJsonEscaping_NEW(jsonString) {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        if (char === '"' && !escape) {
            inString = !inString;
            result += char;
            escape = false;
            continue;
        }
        if (inString) {
            if (char === '\\' && !escape) {
                const nextChar = i < jsonString.length - 1 ? jsonString[i + 1] : '';
                if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
                    escape = true;
                    result += char;
                } else {
                    result += char;  // KEEP as-is (my change)
                    escape = false;
                }
                continue;
            }
        }
        result += char;
        escape = false;
    }
    return result;
}

// TEST CASES
console.log("=== REGRESSION ANALYSIS FOR fixAIJsonEscaping ===\n");

const testCases = [
    // Case 1: PROPERLY escaped LaTeX (AI does it right)
    {
        name: "Properly escaped \\&",
        input: '{"content": "Fear \\\\& Greed"}',  // \\& in JSON = \& in string
        description: "AI correctly escapes backslash"
    },
    // Case 2: IMPROPERLY escaped LaTeX (AI makes mistake)
    {
        name: "Improperly escaped \\&",
        input: '{"content": "Fear \\& Greed"}',  // \& in JSON = INVALID
        description: "AI forgets to escape backslash"
    },
    // Case 3: Properly escaped newline
    {
        name: "Properly escaped \\n",
        input: '{"content": "Line1\\nLine2"}',
        description: "Normal JSON newline"
    },
    // Case 4: LaTeX percentage
    {
        name: "LaTeX \\%",
        input: '{"content": "100\\\\% success"}',
        description: "Properly escaped LaTeX percent"
    },
    // Case 5: Improperly escaped LaTeX percentage
    {
        name: "Improperly escaped \\%",
        input: '{"content": "100\\% success"}',
        description: "AI forgets to escape backslash for %"
    },
    // Case 6: LaTeX table row break
    {
        name: "LaTeX \\\\ row break",
        input: '{"content": "Row1\\\\\\\\Row2"}',  // \\\\\\\\ in source = \\\\ in JSON = \\ in string
        description: "Properly escaped LaTeX row break"
    },
    // Case 7: Complex mixed content
    {
        name: "Mixed LaTeX content",
        input: '{"content": "Price: 100\\\\% \\\\& Fee: 50\\\\%"}',
        description: "Multiple escaped symbols"
    },
];

console.log("Legend:");
console.log("  ✅ = Works correctly");
console.log("  ❌ = JSON parse fails");
console.log("  ⚠️  = Potential data corruption\n");

testCases.forEach((tc, i) => {
    console.log(`--- Test ${i + 1}: ${tc.name} ---`);
    console.log(`Description: ${tc.description}`);
    console.log(`Input JSON: ${tc.input}`);

    // Test with ORIGINAL function
    const originalFixed = fixAIJsonEscaping_ORIGINAL(tc.input);
    let originalParsed = null;
    let originalStatus = "";
    try {
        originalParsed = JSON.parse(originalFixed);
        originalStatus = "✅ Parsed";
    } catch (e) {
        originalStatus = "❌ FAIL: " + e.message.substring(0, 50);
    }

    // Test with NEW function  
    const newFixed = fixAIJsonEscaping_NEW(tc.input);
    let newParsed = null;
    let newStatus = "";
    try {
        newParsed = JSON.parse(newFixed);
        newStatus = "✅ Parsed";
    } catch (e) {
        newStatus = "❌ FAIL: " + e.message.substring(0, 50);
    }

    console.log(`\n  ORIGINAL function:`);
    console.log(`    Fixed JSON: ${originalFixed}`);
    console.log(`    Status: ${originalStatus}`);
    if (originalParsed) console.log(`    Parsed content: "${originalParsed.content}"`);

    console.log(`\n  NEW function:`);
    console.log(`    Fixed JSON: ${newFixed}`);
    console.log(`    Status: ${newStatus}`);
    if (newParsed) console.log(`    Parsed content: "${newParsed.content}"`);

    // Compare
    if (originalParsed && newParsed) {
        if (originalParsed.content === newParsed.content) {
            console.log(`\n  🔄 SAME RESULT`);
        } else {
            console.log(`\n  ⚠️  DIFFERENT RESULT!`);
            console.log(`     Original: "${originalParsed.content}"`);
            console.log(`     New:      "${newParsed.content}"`);
        }
    } else if (!originalParsed && !newParsed) {
        console.log(`\n  Both failed (edge case)`);
    } else {
        console.log(`\n  ⚠️  BEHAVIOR CHANGE: One succeeded, one failed`);
    }

    console.log("\n");
});

// SPECIAL: Test what the actual table content looks like
console.log("=== ACTUAL TABLE CONTENT SIMULATION ===\n");
const tableRow = 'Sentiment (Fear \\& Greed) & Not forecast & 22--28';
console.log("If AI outputs properly escaped JSON for this row:");
console.log(`  JSON: "Sentiment (Fear \\\\& Greed) & Not forecast & 22--28"`);
console.log(`  After parse: "Sentiment (Fear \\& Greed) & Not forecast & 22--28"`);
console.log(`  Cell splitter sees: \\& (escaped amp) - SHOULD NOT SPLIT HERE ✅`);
console.log(`  Cell splitter sees: & (unescaped) - SHOULD SPLIT HERE ✅`);
console.log("\nIf AI outputs DOUBLE-escaped (the \\\\& bug):");
console.log(`  JSON: "Sentiment (Fear \\\\\\\\& Greed) & Not forecast & 22--28"`);
console.log(`  After parse: "Sentiment (Fear \\\\& Greed) & Not forecast & 22--28"`);
console.log(`  In LaTeX: \\\\ = row break, & = column separator`);
console.log(`  RESULT: Row breaks in the middle of the cell! ❌`);
