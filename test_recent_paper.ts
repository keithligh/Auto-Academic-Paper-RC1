/**
 * Test: Does Gemini actually read search results?
 * We'll query for a VERY RECENT paper (2024) that can't be in training data
 * Run with: npx tsx test_recent_paper.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;
const BOT_NAME = "Gemini25Pro-AAP";

// Query for something VERY recent - definitely not in training data
const QUERY = `Find a research paper or article published in 2025 (this year) about AI, LLMs, or machine learning.
Provide the URL, authors, publication date, and a brief summary.
If you find one, quote ONE specific sentence from it to prove you actually read the content.`;

async function testRecentPaper() {
    console.log(`🔬 Testing if bot reads actual search results (not training data)\n`);
    console.log(`Query: Find a 2025 paper/article about AI\n`);
    console.log("─".repeat(60));

    const response = await fetch("https://api.poe.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${POE_API_KEY}`
        },
        body: JSON.stringify({
            model: BOT_NAME,
            messages: [{ role: "user", content: QUERY }],
            temperature: 0.2,
            stream: true
        })
    });

    if (!response.ok) {
        console.error(`❌ Error: ${response.status}`);
        return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
            if (line === 'data: [DONE]') continue;
            try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content || "";
                if (content) {
                    fullText += content;
                    process.stdout.write(content);
                }
            } catch { }
        }
    }

    console.log("\n" + "─".repeat(60));

    // Analysis
    console.log("\n📊 Analysis:");

    const hasUrl = /https?:\/\/[^\s]+/.test(fullText);
    const has2024 = /202[34]/.test(fullText);
    const hasQuote = /"[^"]{20,}"/.test(fullText) || /「[^」]+」/.test(fullText);

    console.log(`  Has URL: ${hasUrl ? '✅' : '❌'}`);
    console.log(`  Mentions 2024: ${has2024 ? '✅' : '❌'}`);
    console.log(`  Contains quoted text: ${hasQuote ? '✅' : '⚠️'}`);

    if (has2024 && hasUrl) {
        console.log("\n✅ Bot appears to be reading actual search results (found recent content)");
    } else {
        console.log("\n⚠️ May be relying on training data - no recent content found");
    }
}

testRecentPaper();
