/**
 * Test Script: Custom Poe Bot (Gemini25Pro-AAP)
 * Run with: npx tsx test_custom_poe_bot.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;
const BOT_NAME = "Gemini25Pro-AAP";

if (!POE_API_KEY) {
    console.error("❌ POE_API_KEY not found in .env file");
    process.exit(1);
}

console.log(`✓ POE_API_KEY loaded`);
console.log(`📡 Testing custom bot: ${BOT_NAME}\n`);

async function testCustomBot() {
    const payload = {
        model: BOT_NAME,
        messages: [
            { role: "user", content: "Hello! Please respond with: I am Gemini25Pro-AAP and I am working!" }
        ],
        temperature: 0.3,
        stream: false
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

        console.log(`✓ Bot responded!`);
        console.log(`  Model: ${data.model || BOT_NAME}`);
        console.log(`  Response:\n---\n${content}\n---`);
        console.log(`  Tokens: ${data.usage?.total_tokens || 'N/A'}`);

        return true;

    } catch (error: any) {
        console.error(`❌ Connection failed: ${error.message}`);
        return false;
    }
}

testCustomBot().then(success => {
    console.log(`\n${success ? '✅ Custom bot test PASSED' : '❌ Custom bot test FAILED'}`);
    process.exit(success ? 0 : 1);
});
