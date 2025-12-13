import { AIConfig } from "@shared/schema";

// Mock Config
const mockConfig: AIConfig = {
    writer: { provider: "poe", apiKey: "test", model: "Claude-3.5-Sonnet", isVerified: true },
    librarian: { provider: "poe", apiKey: "test", model: "Gemini-1.5-Pro", isVerified: true }, // Should be allowed
    strategist: { provider: "poe", apiKey: "test", model: "Claude-3.5-Sonnet", isVerified: true }
};

// Mock Whitelist Logic (copied from poe.ts for isolation)
const poeSearchModels = [
    "Gemini-1.5-Pro",
    "Gemini-1.5-Flash",
    "Gemini-Pro-1.5",
    "GPT-4o",
    "Claude-3.5-Sonnet", // Added for testing
    "Gemini25Pro-AAP",
    "Gemini25Flash-AAP"
];

function validateModel(model: string) {
    if (!poeSearchModels.includes(model)) {
        throw new Error(`Model ${model} is not whitelisted`);
    }
    return true;
}

// Test
try {
    console.log("Testing Whitelist...");
    validateModel(mockConfig.librarian.model);
    console.log("✓ Librarian model is valid");
} catch (e: any) {
    console.error("✗ Librarian model failed:", e.message);
    process.exit(1);
}
