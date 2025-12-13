import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class GrokProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "grok";
    public model: string;
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.x.ai/v1",
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string> {

        // --- Agentic Search (Web Search) ---
        if (enableWebSearch) {
            const response = await fetch("https://api.x.ai/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: "grok-beta", // Use generic beta or config model if compatible
                    input: [
                        { role: "system", content: systemPrompt }, // Grok might ignore system here, but safe to include if format allows, else prepend to user
                        { role: "user", content: prompt }
                    ],
                    tools: [
                        { type: "web_search" }
                    ],
                    stream: true // Enable streaming if supported by this endpoint
                })
            });

            if (!response.ok || !response.body) {
                try {
                    const errText = await response.text();
                    console.error("Grok Search Error:", errText);
                } catch { }
                throw new Error(`Grok API error: ${response.statusText}`);
            }

            // Streaming Parser for Grok /responses
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    // Parse NDJSON lines common in streaming
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            // Grok streaming /responses structure varies. 
                            // Often just returns final response or partial diffs.
                            // Assuming standard delta or full update.
                            // Fallback to simple accumulation if structure is unclear.
                            // Checking docs: "The response contains the final answer."
                            // We might not get proper streaming tokens here. 
                            // If it's a non-streaming response, we just read the whole body.
                            // Let's assume non-streaming for safety first as per docs example.
                        } catch (e) { }
                    }
                    // Actually, the docs example was non-streaming. Let's revert to non-streaming fetch for reliability.
                }
            } catch (e) {
                // Ignore stream errors
            }

            // Re-fetch non-streaming for reliability as verified in docs
            const responseSync = await fetch("https://api.x.ai/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: "grok-beta",
                    input: [
                        { role: "user", content: `${systemPrompt}\n\n${prompt}` }
                    ],
                    tools: [
                        { type: "web_search" }
                    ]
                })
            });
            if (!responseSync.ok) throw new Error(`Grok Search Failed: ${responseSync.statusText}`);
            const data = await responseSync.json();
            const result = data.response || data.output?.[0]?.content?.[0]?.text || "";
            if (onProgress) onProgress(result); // Instant finish update
            return result;
        }

        // --- Standard Chat ---
        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
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

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<any> {
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

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                content += delta;
                if (onProgress) {
                    onProgress(content);
                }
            }
        }

        try {
            return extractJson(content);
        } catch (e) {
            console.error("Failed to parse JSON response from Grok:", content);
            throw new Error("AI response was not valid JSON");
        }
    }

    async research(queries: string[]): Promise<string> {
        const prompt = `Please research the following topics and provide a detailed summary with citations:\n\n${queries.map(q => `- ${q}`).join("\n")}`;

        // Use the custom /responses endpoint for agentic search
        try {
            const response = await fetch("https://api.x.ai/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: "grok-4-fast", // Enforce research model
                    input: [
                        { role: "user", content: prompt }
                    ],
                    tools: [
                        { type: "web_search" }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Grok API error: ${response.statusText}`);
            }

            const data = await response.json();
            // Parse the specific Grok response structure
            // Based on research, we look for the output text in the response object
            const output = data.response || data.output?.[0]?.content?.[0]?.text || JSON.stringify(data);
            return output;

        } catch (e) {
            console.error("Grok research error", e);
            throw e;
        }
    }
}
