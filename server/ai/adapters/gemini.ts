import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider, ProviderConfig } from "../provider";
import { extractJson } from "../utils";

export class GeminiProvider implements AIProvider {
    private client: GoogleGenerativeAI;
    private config: ProviderConfig;
    public id: string = "gemini";
    public model: string;
    public supportsResearch: boolean = false;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.model = config.model;
        this.client = new GoogleGenerativeAI(config.apiKey);
    }

    async completion(prompt: string, systemPrompt: string): Promise<string> {
        const model = this.client.getGenerativeModel({
            model: this.config.model,
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    async jsonCompletion(prompt: string, systemPrompt: string, schema?: any): Promise<any> {
        const model = this.client.getGenerativeModel({
            model: this.config.model,
            systemInstruction: systemPrompt,
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            return extractJson(text);
        } catch (e) {
            console.error("Failed to parse JSON response from Gemini:", text);
            throw new Error("AI response was not valid JSON");
        }
    }
}
