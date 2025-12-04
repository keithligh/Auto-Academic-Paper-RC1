import React, { createContext, useContext, useState, useEffect } from "react";
import { AIConfig, ProviderConfig, SearchConfig, defaultAIConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIConfigContextType {
    config: AIConfig;
    updateConfig: (newConfig: Partial<AIConfig>) => void;
    updateProviderConfig: (type: keyof AIConfig, updates: Partial<ProviderConfig>) => void;
    resetConfig: () => void;
    verifyConnection: (scope?: string) => Promise<boolean>;
    isVerifying: boolean;
}

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
    provider: "poe",
    apiKey: "",
    model: "Claude-Sonnet-4.5",
    isVerified: false
};

const DEFAULT_SEARCH_CONFIG: SearchConfig = {
    provider: "none",
    apiKey: ""
};

const DEFAULT_CONFIG: AIConfig = {
    writer: { ...DEFAULT_PROVIDER_CONFIG },
    librarian: { ...DEFAULT_PROVIDER_CONFIG, model: "Gemini-3.0-Pro" },
    strategist: { ...DEFAULT_PROVIDER_CONFIG },
    search: { ...DEFAULT_SEARCH_CONFIG }
};

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
    // Initialize from localStorage or defaults
    const [config, setConfig] = useState<AIConfig>(() => {
        const saved = localStorage.getItem("ai_config");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure structure
                return { ...DEFAULT_CONFIG, ...parsed };
            } catch (e) {
                console.error("Failed to parse saved config", e);
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    });

    const [isVerifying, setIsVerifying] = useState(false);
    const { toast } = useToast();

    // Persist to localStorage whenever config changes
    useEffect(() => {
        localStorage.setItem("ai_config", JSON.stringify(config));
    }, [config]);

    const updateConfig = (newConfig: Partial<AIConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    const updateProviderConfig = (type: keyof AIConfig, updates: Partial<ProviderConfig>) => {
        setConfig(prev => {
            const current = prev[type] as ProviderConfig;
            // If critical fields change, reset verification status
            const needsReverification = updates.provider !== undefined || updates.apiKey !== undefined || updates.model !== undefined;

            return {
                ...prev,
                [type]: {
                    ...current,
                    ...updates,
                    isVerified: needsReverification ? false : current.isVerified
                }
            };
        });
    };

    const resetConfig = () => {
        setConfig(DEFAULT_CONFIG);
        toast({
            title: "Configuration Reset",
            description: "AI settings have been restored to defaults.",
        });
    };

    const verifyConnection = async (scope?: string): Promise<boolean> => {
        setIsVerifying(true);
        try {
            // Send current config to backend for verification
            // FIX: Spread config into body so backend receives { writer, librarian, ... } at top level
            const res = await apiRequest("POST", "/api/verify-ai-config", {
                ...config,
                scope
            });

            const data = await res.json();

            if (data.status === "ok" || data.success) {
                // Mark verified providers
                setConfig(prev => {
                    const next = { ...prev };
                    if (scope) {
                        // Update specific provider
                        if (scope === 'writer' || scope === 'librarian' || scope === 'strategist') {
                            (next[scope] as ProviderConfig).isVerified = true;
                        }
                    } else {
                        // Update all
                        (next.writer as ProviderConfig).isVerified = true;
                        (next.librarian as ProviderConfig).isVerified = true;
                        (next.strategist as ProviderConfig).isVerified = true;
                    }
                    return next;
                });

                toast({
                    title: "Connection Verified",
                    description: scope ? `${scope} connected successfully.` : "All AI services connected successfully.",
                    variant: "default" // Success
                });
                return true;
            } else {
                throw new Error(data.error || "Verification failed");
            }
        } catch (error: any) {
            toast({
                title: "Connection Failed",
                description: error.message,
                variant: "destructive"
            });
            return false;
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <AIConfigContext.Provider value={{
            config,
            updateConfig,
            updateProviderConfig,
            resetConfig,
            verifyConnection,
            isVerifying
        }}>
            {children}
        </AIConfigContext.Provider>
    );
}

export function useAIConfig() {
    const context = useContext(AIConfigContext);
    if (context === undefined) {
        throw new Error("useAIConfig must be used within an AIConfigProvider");
    }
    return context;
}
