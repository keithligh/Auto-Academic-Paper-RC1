import { GrokProvider } from "./ai/adapters/grok";
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from root
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.XAI_API_KEY;

if (!apiKey) {
    console.error("❌ XAI_API_KEY is missing from .env");
    process.exit(1);
}

console.log("✅ Found XAI_API_KEY");

const models = [
    "grok-4-1-fast",
    "grok-4-1-fast-non-reasoning" // Hypothetical model ID, verify via error or success
];

async function testModel(modelName: string) {
    console.log(`\nTesting Model: ${modelName}...`);
    const provider = new GrokProvider({
        provider: 'grok',
        model: modelName,
        apiKey: apiKey as string,
        isVerified: true
    });

    try {
        console.log("- Testing standard chat completion...");
        const result = await provider.completion("Say 'Hello World'", "You are a test bot.");
        console.log(`  ✅ Success: ${result.substring(0, 50)}...`);

        // Test Research/Web Search capability (since this is for Librarian)
        console.log("- Testing Agentic Search (Librarian capability)...");
        // We mock a simple search prompt 
        // Note: The current GrokProvider implementation might default to 'grok-beta' if not changed. 
        // This test will help confirm if we need that backend change.
        if (provider.supportsResearch) {
            // For test purposes, we won't call the full research method if it requires complex setup, 
            // but we can try the completion with enableWebSearch=true
            const searchResult = await provider.completion("What is the latest version of TypeScript?", "You are a researcher.", undefined, true);
            console.log(`  ✅ Search Success: ${searchResult.substring(0, 50)}...`);
        }

    } catch (error: any) {
        console.error(`  ❌ Failed: ${error.message}`);
        if (error.response) {
            console.error(`     Status: ${error.response.status}`);
            console.error(`     Data: ${JSON.stringify(error.response.data)}`);
        }
    }
}

async function run() {
    for (const model of models) {
        await testModel(model);
    }
}

run();
