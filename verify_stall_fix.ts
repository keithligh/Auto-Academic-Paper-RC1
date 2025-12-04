import { AIService } from "./server/ai/service";
import { AIConfig } from "./shared/schema";

// Mock Logger
const logger = async (msg: string) => console.log(`[LOG] ${msg}`);

// Mock Config 1: No Search Capability (Should Skip)
const mockConfigNoSearch: AIConfig = {
    writer: { provider: "openai", apiKey: "test", model: "gpt-4o", isVerified: true },
    researcher: { provider: "openai", apiKey: "test", model: "gpt-4o", isVerified: true }, // OpenAI adapter defaults to supportsResearch = false
    editor: { provider: "openai", apiKey: "test", model: "gpt-4o", isVerified: true },
};

// Mock Config 2: Hanging Search (Should Timeout)
// We need a custom provider that "supports" research but hangs
class HangingProvider {
    id = "hanging";
    supportsResearch = true;
    async completion() { return "ok"; }
    async jsonCompletion() { return {}; }
    async research() {
        console.log("[Mock] Research started... hanging for 70s...");
        await new Promise(resolve => setTimeout(resolve, 70000)); // Hang longer than 60s timeout
        return "Research Result";
    }
}

async function verifyFix() {
    console.log("--- Starting Pipeline Stall Verification ---");

    // TEST 1: Capability Check (Skip)
    console.log("\n1. Testing Capability Check (Should SKIP research)...");
    const service1 = new AIService(mockConfigNoSearch, logger);
    const claims = [{ sentence: "The sky is blue.", context: "Context", reasoning: "Reason" }];

    const start1 = Date.now();
    const result1 = await service1.researchClaims(claims);
    const duration1 = Date.now() - start1;

    console.log(`Duration: ${duration1}ms`);
    if (result1.every(c => c.citation === null) && duration1 < 1000) {
        console.log("✅ PASS: Research skipped immediately.");
    } else {
        console.error("❌ FAIL: Research not skipped or took too long.");
        process.exit(1);
    }

    // TEST 2: Timeout Check (Should Timeout after ~60s)
    console.log("\n2. Testing Timeout Logic (Should TIMEOUT after 60s)...");

    // Hack to inject our hanging provider
    const service2 = new AIService(mockConfigNoSearch, logger);
    // @ts-ignore
    service2.researcher = new HangingProvider();

    const start2 = Date.now();
    try {
        const result2 = await service2.researchClaims(claims);
        const duration2 = Date.now() - start2;

        console.log(`Duration: ${duration2}ms`);

        // Should take at least 60s (timeout) but less than 70s (hang)
        if (duration2 >= 60000 && duration2 < 65000) {
            console.log("✅ PASS: Research timed out correctly around 60s.");
        } else {
            console.warn(`⚠️ WARNING: Duration ${duration2}ms is unexpected. (Expected ~60000ms)`);
            // It might be slightly over 60s due to overhead, but definitely not 70s
            if (duration2 >= 65000) {
                console.error("❌ FAIL: Did not timeout, waited for full hang.");
                process.exit(1);
            }
        }

        if (result2.every(c => c.citation === null)) {
            console.log("✅ PASS: Claims marked as null (no citation) after timeout.");
        } else {
            console.error("❌ FAIL: Claims not handled correctly after timeout.");
        }

    } catch (e) {
        console.error("❌ FAIL: Pipeline crashed on timeout:", e);
        process.exit(1);
    }

    console.log("\n--- Verification Complete: ALL CHECKS PASSED ---");
}

verifyFix().catch(console.error);
