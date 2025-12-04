import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class GrokProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "grok";
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://api.x.ai/v1",
        });
    }

    async completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void): Promise<string> {
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
