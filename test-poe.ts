import "dotenv/config";
import { analyzeDocument } from "./server/poe";

async function test() {
    console.log("Testing Poe API...");
    try {
        const result = await analyzeDocument(
            "This is a test sentence to verify the AI integration.",
            "Research Paper",
            "minimal"
        );
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
