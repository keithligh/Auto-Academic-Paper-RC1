/**
 * Test: Gemini Flash JSON Output
 * reproduction of the Phase 2 failure
 * Run with: npx tsx test_flash_json.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;
const BOT_NAME = "Gemini25Flash-APP";

const QUERY = "impact of transformer architecture on NLP";

const PROMPT = `Find ONE peer-reviewed academic paper for this query:

QUERY: ${QUERY}

CONTEXT: Web search results have been provided to augment your knowledge. Use them to find a real, verifiable paper.

TASK:
1. From the web search context, identify a real, peer-reviewed academic paper.
2. Extract the author(s), title, venue, year, and URL (DOI or arXiv preferred).
3. Include a brief abstract snippet as proof of verification.

**ZERO HALLUCINATION POLICY**:
- If NO relevant paper appears in the search results, return { "found": false }.
- DO NOT invent titles, authors, or DOIs from memory.
- Only cite papers that appear in the provided search context.

OUTPUT FORMAT (JSON only, no markdown fences):
{
    "found": true,
    "reference": {
        "author": "Author names",
        "title": "Paper title",
        "venue": "Journal/Conference",
        "year": 2024,
        "url": "https://doi.org/...",
        "abstract": "Brief abstract snippet..."
    }
}

If NO suitable paper found, return: { "found": false }`;

async function testFlash() {
    console.log(`🔬 Testing Gemini Flash JSON output...\n`);

    // Using simple fetch to mirror PoeProvider
    const response = await fetch("https://api.poe.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${POE_API_KEY}`
        },
        body: JSON.stringify({
            model: BOT_NAME,
            messages: [{ role: "user", content: PROMPT }],
            temperature: 0.3,
            stream: false
        })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    console.log("RAW RESPONSE:");
    console.log("─".repeat(40));
    console.log(JSON.stringify(content)); // log as string literal to see newlines/hidden chars
    console.log("─".repeat(40));

    // Try to Reproduce the Parse Error
    try {
        parseJsonLikeApp(content);
        console.log("✅ Parsed successfully");
    } catch (e: any) {
        console.log(`❌ Parse Error: ${e.message}`);
    }
}

// Minimal implementation of the app's extraction logic
function parseJsonLikeApp(content: string) {
    let clean = content.trim();
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

    const firstBrace = clean.indexOf('{');
    // Simplified extraction for test
    if (firstBrace !== -1) {
        clean = clean.substring(firstBrace);
        // We aren't implementing the full balanced finder here unless needed, 
        // usually JSON.parse handles the rest if it's clean enough
    }

    return JSON.parse(clean);
}

testFlash();
