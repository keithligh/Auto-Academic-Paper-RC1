import { PoeProvider } from "./ai/adapters/poe";
import { ProviderConfig } from "./ai/provider";

const mockConfig = (model: string): ProviderConfig => ({
    provider: "poe",
    apiKey: "test",
    model,
    baseURL: "https://api.poe.com/v1"
});

const testCases = [
    { model: "Gemini-2.5-Pro", expected: true },
    { model: "Gemini-2.5-Flash", expected: true },
    { model: "Gemini-2.0-Flash", expected: true },
    { model: "GPT-4", expected: false },
    { model: "Claude-3-Opus", expected: false },
];

console.log("Running Poe Whitelist Verification...");

let passed = 0;
let failed = 0;

async function runTests() {
    for (const test of testCases) {
        const provider = new PoeProvider(mockConfig(test.model));
        let result = false;
        try {
            // We expect research() to throw if not whitelisted
            // Since we can't actually call the API without a key, we just check if it throws the whitelist error immediately
            // The whitelist check is the FIRST thing in the method.
            await provider.research(["test query"]);
            // If it doesn't throw, it passed the whitelist check (but will fail on API call)
            result = true;
        } catch (e: any) {
            if (e.message.includes("not whitelisted")) {
                result = false;
            } else {
                // Any other error means it passed the whitelist check (e.g. API error)
                result = true;
            }
        }

        if (result === test.expected) {
            console.log(`[PASS] ${test.model}: ${result ? "Allowed" : "Blocked"}`);
            passed++;
        } else {
            console.error(`[FAIL] ${test.model}: Expected ${test.expected}, got ${result}`);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests();
