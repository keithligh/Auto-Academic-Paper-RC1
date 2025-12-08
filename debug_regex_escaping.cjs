// Debug the regex escaping issue

// In the actual runtime, the string will have TWO backslash characters followed by &
// Let's simulate that

// Method 1: Two actual backslash characters
const row1 = 'Fear ' + String.fromCharCode(92) + String.fromCharCode(92) + '& Greed';
console.log("Row 1 (constructed):", JSON.stringify(row1));
console.log("Row 1 length:", row1.length);

// Check what the regex in the code actually matches
const codeRegex = /\\\\&/g;  // This is what we have in LatexPreview.tsx line 804
console.log("\nRegex from code:", codeRegex);
console.log("Regex source:", codeRegex.source);

// Test the regex
const match1 = row1.match(codeRegex);
console.log("Match result:", match1);

// The issue: /\\\\&/ in JavaScript source = looking for TWO backslashes + &
// But at runtime, '\\\\' in code = two backslash characters
// So /\\\\&/ matches: \\ (two chars) + &

// Let's verify what we NEED to match
console.log("\n=== CHARACTER ANALYSIS ===");
for (let i = 0; i < row1.length; i++) {
    console.log(`[${i}] char=${JSON.stringify(row1[i])} code=${row1.charCodeAt(i)}`);
}

// Try to replace
const replaced = row1.replace(codeRegex, '\\&');
console.log("\nAfter replace:", JSON.stringify(replaced));
console.log("Changed?", row1 !== replaced);
