
import { OpenRouterProvider } from "../server/ai/adapters/openrouter";
import * as readline from 'readline';

async function testOpenRouter() {
    console.log("=== OpenRouter Verification ===");

    // 1. Get API Key
    let apiKey = process.argv[2];
    if (!apiKey) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        apiKey = await new Promise(resolve => {
            rl.question('Enter your OpenRouter API Key: ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

    if (!apiKey) {
        console.error("API Key is required.");
        process.exit(1);
    }

    // 2. Initialize Provider
    // Note: ProviderConfig expects { provider, apiKey, model, isVerified }
    const provider = new OpenRouterProvider({
        provider: "openrouter",
        apiKey: apiKey,
        model: "google/gemini-2.0-flash-exp:free", // Example model
        isVerified: true
    });

    // 3. Test Research Capability (The fix)
    const queries = ["latest news on AI models December 2025"];
    console.log(`\nTesting Research: "${queries[0]}"`);

    try {
        const researchResult = await provider.research(queries);
        console.log("\n\n=== RESEARCH RESPONSE ===\n");
        console.log(researchResult);

        if (researchResult.length > 50) {
            console.log("PASS: Research returned content.");
        } else {
            console.log("WARNING: Research content empty.");
        }
    } catch (e: any) {
        console.error("RESEARCH FAILED:", e.message);
    }

}

}

testOpenRouter();
