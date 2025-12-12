
import { PoeProvider } from "../server/ai/adapters/poe";
import * as readline from 'readline';

async function testPoeSearch() {
    console.log("=== Poe Web Search Verification ===");

    // 1. Get API Key
    let apiKey = process.argv[2];
    if (!apiKey) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        apiKey = await new Promise(resolve => {
            rl.question('Enter your Poe API Key: ', (answer) => {
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
    const provider = new PoeProvider({
        provider: "poe",
        apiKey: apiKey,
        model: "Gemini-2.5-Flash", // User's preferred model
        isVerified: true
    });

    // 3. Define Test Query (Something requiring recent/web info)
    // Use a dynamic query about a recent event or "current price" to ensure it's not training data.
    // However, "current price" fluctuates. 
    // Let's ask for the main headline of a specific news site today, or just "What is the current date and what are the top 3 tech news stories today?"
    const query = "What is the EXACT current date today? And finding one specific recent news event from this week (provide a URL source).";

    console.log(`\nQuery: "${query}"`);
    console.log("Model: Gemini-2.5-Flash");
    console.log("Mode: Web Search ENABLED");
    console.log("...\n");

    try {
        const response = await provider.completion(
            query,
            "You are a helpful assistant with access to the internet. Use your search tool to answer current questions. ALWAYS provide a URL source.",
            (text) => process.stdout.write(text.slice(-5)), // Minimal progress logging
            true // Enable Web Search
        );

        console.log("\n\n=== RESPONSE ===\n");
        console.log(response);

        console.log("\n\n=== VERIFICATION ===");
        if (response.toLowerCase().includes("http") || response.includes("2024") || response.includes("2025")) {
            console.log("PASS: Response contains URL or current year.");
        } else {
            console.log("WARNING: Response might not contain a source URL. Check output manually.");
        }

    } catch (error) {
        console.error("\nERROR:", error);
    }
}

testPoeSearch();
