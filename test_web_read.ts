/**
 * Test: Does Gemini read actual web search results?
 * Query for something that ONLY exists on the web in 2025
 * Run with: npx tsx test_web_read.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;
const BOT_NAME = "Gemini25Pro-AAP";

// Query for something that MUST come from live web search
const QUERY = `Search the web and find a news article or blog post about AI published in December 2025.

Return:
1. The exact URL
2. The publication date
3. The headline/title
4. Quote the first sentence of the article verbatim

This tests if you can access live web content.`;

async function test() {
    console.log(`🔬 Web Search Test: Finding December 2025 content\n`);

    const response = await fetch("https://api.poe.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${POE_API_KEY}`
        },
        body: JSON.stringify({
            model: BOT_NAME,
            messages: [{ role: "user", content: QUERY }],
            temperature: 0.1,
            stream: false  // Non-streaming for cleaner output
        })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No response";

    console.log("Response:\n" + "─".repeat(60));
    console.log(content);
    console.log("─".repeat(60));

    // Check for 2025 indicators
    const has2025 = content.includes("2025");
    const hasDecember = /december|dec\.?\s*2025/i.test(content);
    const hasUrl = /https?:\/\/[^\s]+/.test(content);

    console.log("\n📊 Evidence of live web access:");
    console.log(`  Mentions 2025: ${has2025 ? '✅' : '❌'}`);
    console.log(`  Mentions December 2025: ${hasDecember ? '✅' : '❌'}`);
    console.log(`  Contains URL: ${hasUrl ? '✅' : '❌'}`);

    if (hasDecember && hasUrl) {
        console.log("\n✅ CONFIRMED: Bot is reading live web search results!");
    } else if (has2025) {
        console.log("\n⚠️ Found 2025 content but unclear if from live search");
    } else {
        console.log("\n❌ No evidence of live web access - may be using training data");
    }
}

test();
