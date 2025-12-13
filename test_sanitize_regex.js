
const content = `> **Synthesizing Initial Concepts**
>
> I'm now starting to see the structure of the piece. Use the evidence.
>
>
The rapid integration of Large Language Models...`;

console.log("--- ORIGINAL ---");
console.log(content);

// Current Regex (simulated)
const currentClean = content.replace(/^> .*$/gm, "");
console.log("\n--- CURRENT REGEX (^> .*) ---");
console.log(currentClean);

// Proposed Regex (Consuming newline)
const proposedClean = content.replace(/^>.*(\r?\n|$)/gm, "");
console.log("\n--- PROPOSED REGEX (^>.*(\\n|$)) ---");
console.log(proposedClean);
