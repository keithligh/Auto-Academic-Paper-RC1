/**
 * Test Script: List Poe Bots
 * Checks which bots are accessible with the current API key
 * Run with: npx tsx debug_list_poe_bots.ts
 */

import 'dotenv/config';

const POE_API_KEY = process.env.POE_API_KEY;

if (!POE_API_KEY) {
    console.error("❌ POE_API_KEY not found in .env file");
    process.exit(1);
}

async function checkBot(botName: string) {
    console.log(`Checking bot: ${botName}...`);
    try {
        const response = await fetch("https://api.poe.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${POE_API_KEY}`
            },
            body: JSON.stringify({
                model: botName,
                messages: [{ role: "user", content: "Hi" }],
                stream: false
            })
        });

        if (response.ok) {
            console.log(`✅ FOUND: ${botName}`);
            return true;
        } else {
            console.log(`❌ FAILED: ${botName} (${response.status} ${response.statusText})`);
            return false;
        }
    } catch (e: any) {
        console.log(`❌ ERROR: ${botName} (${e.message})`);
        return false;
    }
}

async function debugBots() {
    console.log("🔍 Debugging Poe Bots...");

    // Check likely variations
    const candidates = [
        "Gemini25Flash-AAP",   // What I used
        "Gemini25Flash-APP",   // What you typed in prompt
        "Gemini25Pro-AAP",     // Known good
        "Gemini-2.5-Flash",    // Vanilla
    ];

    for (const bot of candidates) {
        await checkBot(bot);
    }

    // Note: Poe API doesn't have a simple "list bots" endpoint for API tokens easily accessible 
    // in this context without specific scopes, strictly speaking. 
    // The most effective way is to probe or check the Poe website.
}

debugBots();
