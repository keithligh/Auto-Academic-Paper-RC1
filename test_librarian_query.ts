/**
 * Test Script: Librarian Query Simulation
 * Tests the Gemini25Pro-AAP bot for academic reference finding
 * Run with: npx tsx test_librarian_query.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;
const BOT_NAME = "Gemini25Pro-AAP";

if (!POE_API_KEY) {
    console.error("❌ POE_API_KEY not found in .env file");
    process.exit(1);
}

// Simulate Librarian Phase 2 prompt
const LIBRARIAN_PROMPT = `Find ONE academic paper or credible source for this research query:

QUERY: transformer attention mechanisms in natural language processing

TASK:
1. Search for a real, verifiable source (academic paper, research article, or authoritative reference).
2. Provide the source URL.
3. Summarize what the source says about the topic.

OUTPUT FORMAT (JSON):
{
    "found": true,
    "reference": {
        "title": "Paper/Article title",
        "author": "Author names",
        "year": 2024,
        "url": "https://...",
        "summary": "Brief 2-3 sentence summary of findings"
    }
}

If no credible source found, return: { "found": false }`;

const SYSTEM_PROMPT = "You are a Research Librarian with web search capabilities. Find real sources with verifiable URLs. Output valid JSON.";

async function testLibrarianQuery() {
    console.log(`📚 Simulating Librarian Query with ${BOT_NAME}\n`);
    console.log(`Query: "transformer attention mechanisms in NLP"\n`);
    console.log("─".repeat(60));

    const payload = {
        model: BOT_NAME,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: LIBRARIAN_PROMPT }
        ],
        temperature: 0.3,
        stream: true  // Streaming to see real-time response
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
            return;
        }

        if (!response.body) {
            console.error("❌ No response body");
            return;
        }

        // Stream and collect response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line === 'data: [DONE]') continue;
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const content = data.choices?.[0]?.delta?.content || "";
                        if (content) {
                            fullText += content;
                            process.stdout.write(content);  // Real-time output
                        }
                    } catch (e) {
                        // Ignore parse errors for partial chunks
                    }
                }
            }
        }

        console.log("\n" + "─".repeat(60));
        console.log("\n✅ Response complete");

        // Try to parse as JSON
        try {
            // Extract JSON from response (handle markdown fences)
            let jsonStr = fullText.trim();
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

            // Find JSON object
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(jsonStr);
            console.log("\n📋 Parsed Result:");
            console.log(JSON.stringify(parsed, null, 2));

            if (parsed.found && parsed.reference?.url) {
                console.log(`\n🔗 Verifiable URL: ${parsed.reference.url}`);
            }
        } catch (e) {
            console.log("\n⚠️ Response was not pure JSON (may contain explanatory text)");
            console.log("   This is okay - we can extract the citation info from the text");
        }

    } catch (error: any) {
        console.error(`❌ Connection failed: ${error.message}`);
    }
}

testLibrarianQuery();
