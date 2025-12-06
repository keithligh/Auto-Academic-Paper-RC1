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
    public model: string;
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = { ...config, model: config.model.trim() }; // Ensure model is trimmed
        this.model = this.config.model;

        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.poe.com/v1",
            timeout: 900000, // 15 minutes to match service timeout
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {
        // Build user message with optional web search
        const userMessage: any = {
            role: "user",
            content: prompt
        };

        // Whitelist Check (Refined from test_whitelist_refined.ts)
        // Verified models that support web search on Poe
        const poeSearchModels = [
            "Gemini-1.5-Pro",
            "Gemini-1.5-Flash",
            "Gemini-2.5-Pro",
            "Gemini-2.5-Flash",
            "GPT-4o",
            "Claude-3.5-Sonnet", // Allows generic search context
            "Perplexity-Sonar"
        ];

        // Only attach web_search parameter if the model supports it or if it's explicitly requested
        if (enableWebSearch) {
            const isKnownSearchModel = poeSearchModels.some(m =>
                this.config.model.includes(m) || m.includes(this.config.model)
            );

            if (isKnownSearchModel) {
                userMessage.parameters = { web_search: true };
            } else {
                console.warn(`[PoeProvider] Model ${this.config.model} may not support web_search, but parameters are being sent.`);
                userMessage.parameters = { web_search: true }; // Try anyway, as Poe often updates support
            }
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
                        escape = false; // logic correction
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

    // DEAD CODE REMOVAL: The dedicated 'research' method has been removed.
    // The orchestration is handled by 'service.ts' using the standard 'completion' method
    // with { web_search: true } enabled by the refined whitelist above.
    // This aligns the Code with the Architecture (Service Orchestration).
}
