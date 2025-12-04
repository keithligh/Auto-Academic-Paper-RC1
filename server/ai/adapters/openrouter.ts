import OpenAI from "openai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class OpenRouterProvider implements AIProvider {
    private client: OpenAI;
    private config: ProviderConfig;
    public id: string = "openrouter";
    public supportsResearch: boolean = true;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: {
                "HTTP-Referer": "https://auto-academic-formatter.local",
                "X-Title": "Auto-Academic Formatter"
            }
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
            console.error("Failed to parse JSON response from OpenRouter:", content);
            throw new Error("AI response was not valid JSON");
        }
    }

    async research(queries: string[]): Promise<string> {
        const prompt = `Please research the following topics and provide a detailed summary with citations:\n\n${queries.map(q => `- ${q}`).join("\n")}`;

        // Use 'plugins' parameter for web search
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: "You are a helpful research assistant. Search the web for the user's queries and provide a comprehensive answer with citations." },
                { role: "user", content: prompt },
            ],
            extra_body: {
                plugins: [
                    {
                        id: "web",
                    }
                ]
            }
        } as any);

        return response.choices[0]?.message?.content || "";
    }
}
