
import { applyPatches } from "./server/ai/utils"; // Assuming TS execution context. For manual running we might need ts-node.

// Mock console.log to capture output
const logs: string[] = [];
const originalLog = console.log;
console.log = (...args) => logs.push(args.join(" "));
const originalWarn = console.warn;
console.warn = (...args) => logs.push("WARN: " + args.join(" "));

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion Failed: ${message}`);
    }
}

async function runTests() {
    console.log("Starting Patch Tests...");

    // Test 1: Exact Match
    {
        const content = "The quick brown fox jumps over the lazy dog.";
        const patches = [{ original: "quick brown fox", new: "slow white bear" }];
        const result = applyPatches(content, patches);
        assert(result === "The slow white bear jumps over the lazy dog.", "Test 1 Failed");
        console.log("Test 1 Passed: Exact Match");
    }

    // Test 2: Whitespace Insensitivity (Newlines vs Spaces)
    {
        const content = "The quick\nbrown fox\njumps.";
        const patches = [{ original: "quick brown fox", new: "slow\nwhite\nbear" }];
        const result = applyPatches(content, patches);
        assert(result === "The slow\nwhite\nbear\njumps.", "Test 2 Failed");
        console.log("Test 2 Passed: Whitespace Insensitivity");
    }

    // Test 3: Multiple Patches
    {
        const content = "One. Two. Three.";
        const patches = [
            { original: "One.", new: "1." },
            { original: "Three.", new: "3." }
        ];
        const result = applyPatches(content, patches);
        assert(result === "1. Two. 3.", "Test 3 Failed");
        console.log("Test 3 Passed: Multiple Patches");
    }

    // Test 4: Overlapping/Conflicting Patches (Should handle gracefully - usually by applying first valid one found if using sequential, or failing safe)
    // Our logic is sequential application.
    {
        const content = "Hello World";
        const patches = [
            { original: "Hello", new: "Hi" },
            { original: "Hi World", new: "Bye Earth" } // This depends on if it sees the NEW content. Usually replace should look at current state.
        ];
        // If we apply patches sequentially to the *modified* string:
        // 1. "Hi World"
        // 2. "Bye Earth"
        // If we apply to *original* string indices, it's harder.
        // Let's assume sequential application on modified string is the easiest reliable way for LLMs who might see the "previous" patch.
        // Actually, LLMs usually output patches based on the ORIGINAL text.
        // BUT, implementing simultaneous patching is hard with fuzzy matching.
        // Sequential application is risky if patches overlap.
        // Let's trust the sequential application for now as long as patches are distinct.

        const result = applyPatches(content, patches);
        assert(result === "Bye Earth", "Test 4 Failed");
        console.log("Test 4 Passed: Sequential Application");
    }

    // Test 5: Patch Not Found
    {
        const content = "Hello World";
        const patches = [{ original: "Goodbye", new: "See ya" }];
        const result = applyPatches(content, patches);
        assert(result === "Hello World", "Test 5 Failed");
        // Check logs for warning
        assert(logs.some(l => l.includes("Could not find match")), "Test 5 Failed: No warning log");
        console.log("Test 5 Passed: Patch Not Found Safety");
    }
    // Test 6: Fuzzy Match with LaTeX Chars
    {
        const content = "Value is $30% and & more.";
        // AI might forget escapes in "original"
        const patches = [{ original: "Value is $30% and & more.", new: "Changed" }];
        // Note: applyPatches 'original' string is treated as literal text to find, so regex special chars must be escaped internally by the utility.
        const result = applyPatches(content, patches);
        assert(result === "Changed", "Test 6 Failed");
        console.log("Test 6 Passed: Special Char Safety");
    }

    console.log("All Tests Passed!");
}

runTests().catch(e => console.error(e));

// Restore logs
console.log = originalLog;
console.warn = originalWarn;
