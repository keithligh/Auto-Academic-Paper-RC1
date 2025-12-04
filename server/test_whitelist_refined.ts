import { OpenAICompatibleProvider } from "./ai/adapters/openai";
import { ProviderConfig } from "./ai/provider";

const mockConfig = (provider: any, model: string = "test-model"): ProviderConfig => ({
    provider,
    apiKey: "test",
    model,
    baseURL: "http://test"
});

const testCases = [
    // Poe Whitelist (Model Level)
    { provider: "poe", model: "Gemini-2.5-Pro", expected: true },
    { provider: "poe", model: "Gemini-2.5-Flash", expected: true },
    { provider: "poe", model: "Gemini-2.0-Flash", expected: true },
    { provider: "poe", model: "GPT-4", expected: false }, // Not in whitelist

    // Grok (Provider Level)
    { provider: "grok", model: "grok-4-fast", expected: true },
    { provider: "grok", model: "any-model", expected: true },

    // OpenRouter (Provider Level)
    { provider: "openrouter", model: "openai/gpt-4o:online", expected: true },
    { provider: "openrouter", model: "openai/gpt-4o", expected: true }, // Now allowed at provider level

    // Others (Restricted)
    { provider: "openai", model: "gpt-4o", expected: false },
    { provider: "anthropic", model: "claude-3-5-sonnet", expected: false },
];

console.log("Running Refined Whitelist Verification...");

let passed = 0;
let failed = 0;

for (const test of testCases) {
    const provider = new OpenAICompatibleProvider(mockConfig(test.provider, test.model));
    const result = provider.supportsResearch;
    if (result === test.expected) {
        console.log(`[PASS] ${test.provider} (${test.model}): ${result}`);
        passed++;
    } else {
        console.error(`[FAIL] ${test.provider} (${test.model}): Expected ${test.expected}, got ${result}`);
        failed++;
    }
}

console.log(`\nResults: ${passed} Passed, ${failed} Failed`);

if (failed > 0) process.exit(1);
