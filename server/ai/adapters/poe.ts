/*
 * GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content.
 * ALWAYS USE write_to_file.
 * REASON: THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. THIS IS A PLATFORM BUG.
 */
import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class PoeProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "poe";
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = { ...config, model: config.model.trim() }; // Ensure model is trimmed

        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.poe.com/v1",
            timeout: 900000, // 15 minutes to match service timeout
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {
        // Build user message with optional web search (from pre-BYOK line 152-157)
        const userMessage: any = {
            role: "user",
            content: prompt
        };

        if (enableWebSearch) {
            userMessage.parameters = { web_search: true };
        }

        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: systemPrompt },
                userMessage,
            ],
            temperature: 0.7,
            stream: true,
        });

        let fullText = "";

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                fullText += content;
                if (onProgress) {
                    onProgress(fullText);
                }
            }
        }

        return fullText;
    }

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void): Promise<any> {
        const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Output valid JSON only. Do not include markdown formatting like \`\`\`json.`;

        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: enhancedSystemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 0.3,
            stream: true,
        });

        let content = "";

        let consecutiveNewlines = 0;
        const MAX_CONSECUTIVE_NEWLINES = 10;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                content += delta;
                if (onProgress) {
                    onProgress(content);
                }

                // Loop Detection: Check for excessive consecutive newlines
                // This handles cases where the AI gets stuck in a whitespace loop
                if (delta.includes('\n')) {
                    // DEBUG: Log newline chunks to verify origin
                    if (/^\s*$/.test(delta)) {
                        console.log(`[PoeProvider] Received whitespace-only delta: ${JSON.stringify(delta)}`);
                    }

                    // Count newlines at the end of the content
                    let i = content.length - 1;
                    let count = 0;
                    while (i >= 0 && content[i] === '\n') {
                        count++;
                        i--;
                    }
                    consecutiveNewlines = count;
                } else {
                    consecutiveNewlines = 0;
                }

                if (consecutiveNewlines >= MAX_CONSECUTIVE_NEWLINES) {
                    console.warn(`[PoeProvider] Detected whitespace loop (${consecutiveNewlines} newlines). Terminating stream.`);
                    if (stream.controller) {
                        stream.controller.abort();
                    }
                    break;
                }
            }
        }

        console.log("[Poe Raw Response]", content.length > 500 ? content.substring(0, 500) + "... [TRUNCATED]" : content);

        try {
            const fs = await import("fs");
            const path = await import("path");
            fs.appendFileSync(path.join(process.cwd(), "server", "raw_response.log"), `\n\n[${new Date().toISOString()}] POE RAW: ${content}\n`);
        } catch (err) {
            console.error("Failed to write log", err);
        }

        try {
            return extractJson(content);
        } catch (e) {
            console.error("Failed to parse JSON response from Poe:", content);
            throw new Error("AI response was not valid JSON");
        }
    }

    /**
     * Fix JSON escaping issues from AI responses.
     * (Legacy function from pre-byok-poe.ts)
     */
    private fixAIJsonEscaping(jsonString: string): string {
        let result = '';
        let inString = false;
        let escape = false;

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            if (char === '"' && !escape) {
                inString = !inString;
                result += char;
                escape = false;
                continue;
            }
            if (inString) {
                if (char === '\\' && !escape) {
                    const nextChar = i < jsonString.length - 1 ? jsonString[i + 1] : '';
                    if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
                        escape = true;
                        result += char;
                    } else {
                        result += '\\\\';
                        escape = false;
                    }
                    continue;
                }
            }
            result += char;
            escape = false;
        }
        return result;
    }

    async research(queries: string[]): Promise<string> {
        const poeSearchModels = ["Gemini-2.5-Pro", "Gemini-2.5-Flash"];
        if (!poeSearchModels.includes(this.config.model)) {
            throw new Error(`Model ${this.config.model} is not whitelisted for research on Poe.`);
        }

        if (queries.length === 0) return "{}";

        // Librarian Prompt from pre-byok-poe.ts
        const prompt = `You are a Research Librarian.
    
    RESEARCH TASKS:
    ${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

    INSTRUCTIONS:
    1. SEARCH ONLINE for high-quality academic references for these specific topics.
    2. VERIFY that these papers actually exist.
    3. OUTPUT FORMAT: Return a JSON array of references.
    
    REQUIRED JSON FORMAT:
    {
        "references": [
            { "key": "authorYear", "author": "Names", "title": "Title", "venue": "Journal", "year": 2024, "url": "link if available" }
        ]
    }
    `;

        console.log("[Poe Debug] Sending Librarian request:", {
            model: this.config.model,
            prompt: prompt.substring(0, 100) + "..."
        });

        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                {
                    role: "user",
                    content: prompt,
                    parameters: { web_search: true }
                } as any,
            ],
            temperature: 0.1,
        });

        const content = response.choices[0]?.message?.content || "{}";

        // Process JSON (Battle-Tested Logic)
        try {
            const parsed = extractJson(content);

            if (parsed.references && Array.isArray(parsed.references)) {
                // Assign unique IDs (Librarian's Card Catalog)
                parsed.references = parsed.references.map((ref: any, index: number) => ({
                    ...ref,
                    key: `ref_${index + 1}`
                }));
                return JSON.stringify(parsed);
            }

            return "{}";
        } catch (e) {
            console.error("Failed to parse Librarian response:", e);
            return "{}";
        }
    }
}
