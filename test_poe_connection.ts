/**
 * Test Script: Poe API Connection
 * Run with: npx tsx test_poe_connection.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;

if (!POE_API_KEY) {
    console.error("❌ POE_API_KEY not found in .env file");
    process.exit(1);
}

console.log("✓ POE_API_KEY loaded");
console.log(`  Key prefix: ${POE_API_KEY.substring(0, 10)}...`);

// Test model - using Claude-3.5-Sonnet for reliability
const TEST_MODEL = "Claude-3.5-Sonnet";

async function testPoeConnection() {
    console.log(`\n📡 Testing Poe API with model: ${TEST_MODEL}`);

    const payload = {
        model: TEST_MODEL,
        messages: [
            { role: "system", content: "You are a helpful assistant. Respond briefly." },
            { role: "user", content: "Say 'Hello from Poe!' and nothing else." }
        ],
        temperature: 0.3,
        stream: false  // Non-streaming for simplicity
    };

    try {
        const response = await fetch("https://api.poe.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${POE_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            console.error(`   Response: ${errText}`);
            return false;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        console.log(`✓ Response received!`);
        console.log(`  Model: ${data.model || TEST_MODEL}`);
        console.log(`  Content: "${content}"`);
        console.log(`  Tokens: ${data.usage?.total_tokens || 'N/A'}`);

        return true;

    } catch (error: any) {
        console.error(`❌ Connection failed: ${error.message}`);
        return false;
    }
}

// Run the test
testPoeConnection().then(success => {
    console.log(`\n${success ? '✅ Poe API test PASSED' : '❌ Poe API test FAILED'}`);
    process.exit(success ? 0 : 1);
});
