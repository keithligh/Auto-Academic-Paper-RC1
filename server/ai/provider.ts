import { z } from "zod";

import { AIConfig, ProviderConfig } from "@shared/schema";

export { AIConfig, ProviderConfig };


export interface AIProvider {
    id: string;
    model: string;

    /**
     * Standard text completion
     * @param enableWebSearch Optional flag to enable web search (Poe-specific)
     */
    completion(prompt: string, systemPrompt: string, onProgress?: (text: string) => void, enableWebSearch?: boolean): Promise<string>;

    /**
     * Structured JSON completion
     * @param history Optional conversation history (for multi-turn simulation)
     */
    jsonCompletion(prompt: string, systemPrompt: string, schema?: any, onProgress?: (text: string) => void, history?: { role: string, content: string }[]): Promise<any>;

    /**
     * Whether this provider supports online research
     */
    supportsResearch: boolean;

    /**
     * Perform online research (if supported)
     */
    research?(queries: string[]): Promise<string>;
}
