/*
 * GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content.
 * ALWAYS USE write_to_file.
 * REASON: THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. THIS IS A PLATFORM BUG.
 */
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { AIConfig, ProviderConfig, SearchConfig } from "@shared/schema";

const STORAGE_KEY = "ai_config_v1";

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o",
    isVerified: false
};

const DEFAULT_SEARCH_CONFIG: SearchConfig = {
    provider: "none",
    apiKey: ""
};

const DEFAULT_CONFIG: AIConfig = {
    writer: { ...DEFAULT_PROVIDER_CONFIG },
    librarian: { ...DEFAULT_PROVIDER_CONFIG, provider: "poe", model: "Gemini-2.5-Pro" },
    strategist: { ...DEFAULT_PROVIDER_CONFIG },
    search: { ...DEFAULT_SEARCH_CONFIG }
};

interface AIConfigContextType {
    config: AIConfig;
    updateWriter: (updates: Partial<ProviderConfig>) => void;
    updateLibrarian: (updates: Partial<ProviderConfig>) => void;
    updateStrategist: (updates: Partial<ProviderConfig>) => void;
    updateSearch: (updates: Partial<SearchConfig>) => void;
    setAgentVerified: (agent: 'writer' | 'librarian' | 'strategist', isVerified: boolean) => void;
    resetConfig: () => void;
    getHeaders: () => { "X-AI-Config": string };
}

export const AIConfigContext = createContext<AIConfigContextType>(null!);

export function AIConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<AIConfig>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                let parsed = JSON.parse(stored);

                // Safety check: Ensure parsed is a non-null object
                if (!parsed || typeof parsed !== 'object') {
                    return DEFAULT_CONFIG;
                }

                // Migration: Handle old global isVerified flag
                const oldGlobalVerified = parsed.isVerified;

                // Migration: If 'writer' is missing, use default
                if (!parsed.writer) {
                    parsed.writer = { ...DEFAULT_CONFIG.writer };
                }
                // Ensure writer has isVerified field
                if (typeof parsed.writer.isVerified === 'undefined') {
                    parsed.writer.isVerified = oldGlobalVerified || false;
                }

                // Migration: 'researcher' -> 'librarian'
                if (parsed.researcher && !parsed.librarian) {
                    parsed.librarian = parsed.researcher;
                    delete parsed.researcher;
                }
                // If 'librarian' is still missing, use default
                if (!parsed.librarian) {
                    parsed.librarian = { ...DEFAULT_CONFIG.librarian };
                }
                // Ensure librarian has isVerified field
                if (typeof parsed.librarian.isVerified === 'undefined') {
                    parsed.librarian.isVerified = oldGlobalVerified || false;
                }

                // Migration: 'editor' -> 'strategist'
                if (parsed.editor && !parsed.strategist) {
                    parsed.strategist = parsed.editor;
                    delete parsed.editor;
                }
                // If 'strategist' is still missing (old 2-agent config), copy 'writer' or use default
                if (!parsed.strategist) {
                    parsed.strategist = parsed.writer ? { ...parsed.writer } : { ...DEFAULT_CONFIG.strategist };
                }
                // Ensure strategist has isVerified field
                if (typeof parsed.strategist.isVerified === 'undefined') {
                    parsed.strategist.isVerified = oldGlobalVerified || false;
                }

                // Migration: If 'search' is missing, use default
                if (!parsed.search) {
                    parsed.search = { ...DEFAULT_CONFIG.search };
                }

                // Remove old global isVerified if it exists
                delete parsed.isVerified;

                return parsed as AIConfig;
            } catch (e) {
                console.error("Failed to parse AI Config", e);
                // Fallback to default config on error
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }, [config]);

    const updateWriter = (updates: Partial<ProviderConfig>) => {
        setConfig(prev => ({
            ...prev,
            writer: { ...prev.writer, ...updates, isVerified: false }
        }));
    };

    const updateLibrarian = (updates: Partial<ProviderConfig>) => {
        setConfig(prev => ({
            ...prev,
            librarian: { ...prev.librarian, ...updates, isVerified: false }
        }));
    };

    const updateStrategist = (updates: Partial<ProviderConfig>) => {
        setConfig(prev => ({
            ...prev,
            strategist: { ...prev.strategist, ...updates, isVerified: false }
        }));
    };

    const updateSearch = (updates: Partial<SearchConfig>) => {
        setConfig(prev => ({
            ...prev,
            search: { ...(prev.search || DEFAULT_SEARCH_CONFIG), ...updates }
        }));
    };

    const setAgentVerified = (agent: 'writer' | 'librarian' | 'strategist', isVerified: boolean) => {
        setConfig(prev => ({
            ...prev,
            [agent]: { ...prev[agent], isVerified }
        }));
    };

    const resetConfig = () => {
        setConfig(DEFAULT_CONFIG);
        localStorage.removeItem(STORAGE_KEY);
    };

    const getHeaders = () => {
        return {
            "X-AI-Config": JSON.stringify(config)
        };
    };

    return (
        <AIConfigContext.Provider value={{
            config,
            updateWriter,
            updateLibrarian,
            updateStrategist,
            updateSearch,
            setAgentVerified,
            resetConfig,
            getHeaders
        }}>
            {children}
        </AIConfigContext.Provider>
    );
}
