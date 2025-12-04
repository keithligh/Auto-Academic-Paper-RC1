import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Settings2, Lock, ExternalLink, PenTool, Globe, ClipboardList, ArrowRight, CheckCircle2, AlertCircle, Loader2, PlayCircle, Search, Brain } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { ProviderType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PROVIDER_DOCS: Record<string, string> = {
    openai: "https://platform.openai.com/docs/models",
    anthropic: "https://docs.anthropic.com/en/docs/about-claude/models",
    gemini: "https://ai.google.dev/gemini-api/docs/models/gemini",
    poe: "https://creator.poe.com/docs/api",
    grok: "https://docs.x.ai/docs/models",
    openrouter: "https://openrouter.ai/models",
    ollama: "https://ollama.com/library",
    custom: "https://platform.openai.com/docs/models"
};

interface AIConfigModalProps {
    trigger?: React.ReactNode;
}

export function AIConfigModal({ trigger }: AIConfigModalProps) {
    const { config, updateWriter, updateLibrarian, updateStrategist, updateSearch, setAgentVerified, resetConfig } = useAIConfig();
    const [open, setOpen] = useState(false);

    // Verification state comes directly from config - no separate state needed
    const [verifyingScope, setVerifyingScope] = useState<string | null>(null);
    const [verificationError, setVerificationError] = useState<string | null>(null);

    const { toast } = useToast();

    const [useWriterForStrategist, setUseWriterForStrategist] = useState(
        JSON.stringify(config.strategist) === JSON.stringify(config.writer)
    );

    const handleStrategistToggle = (checked: boolean) => {
        setUseWriterForStrategist(checked);
        if (checked) {
            updateStrategist(config.writer);
            // If writer is verified, strategist is implicitly verified when sharing config
            if (config.writer.isVerified) {
                setAgentVerified('strategist', true);
            }
        } else {
            setAgentVerified('strategist', false);
        }
    };

    const handleVerifyScope = async (scope: 'writer' | 'librarian' | 'strategist') => {
        setVerifyingScope(scope);
        setVerificationError(null);

        try {
            // Send config + scope to backend
            const payload = { ...config, scope };
            const res = await apiRequest("POST", "/api/verify-ai-config", payload);
            const data = await res.json();

            if (data.status === "ok") {
                // Mark this agent as verified in the config
                setAgentVerified(scope, true);
                // If writer is verified and strategist uses writer config, verify strategist too
                if (scope === 'writer' && useWriterForStrategist) {
                    setAgentVerified('strategist', true);
                }

                toast({
                    title: "Connection Successful",
                    description: `${scope.charAt(0).toUpperCase() + scope.slice(1)} agent connected.`,
                    variant: "default",
                });
            } else {
                throw new Error(data.error || "Verification failed");
            }
        } catch (error: any) {
            setVerificationError(error.message);
            setAgentVerified(scope, false);
        } finally {
            setVerifyingScope(null);
        }
    };

    const handleSave = () => {
        // Require all agents to be verified before saving
        if (config.writer.isVerified && config.librarian.isVerified && config.strategist.isVerified) {
            setOpen(false);
            toast({
                title: "Configuration Saved",
                description: "AI System is ready.",
            });
        }
    };

    const isAllVerified = config.writer.isVerified && config.librarian.isVerified && config.strategist.isVerified;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant={isAllVerified ? "outline" : "destructive"} size="sm" className="gap-2">
                        <Settings2 className="w-4 h-4" />
                        {isAllVerified ? "AI Settings" : "Setup AI (Required)"}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-serif">AI Agent Configuration</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* 1. Security Banner */}
                    <Alert className="bg-yellow-50 border-yellow-200 text-yellow-900">
                        <Lock className="h-4 w-4 text-yellow-700" />
                        <AlertTitle className="text-yellow-800 font-semibold">Your Keys Are Safe</AlertTitle>
                        <AlertDescription className="text-yellow-700 text-sm mt-1">
                            API keys are stored <strong>locally in your browser</strong> (LocalStorage).
                            This system is <strong>completely local</strong> (apart from the online AI API) and has <strong>no internet connection</strong> to any other system.
                        </AlertDescription>
                    </Alert>

                    {/* 2. Pipeline Visualization - REMOVED to reduce clutter */}

                    {/* 3. Verification Error Alert */}
                    {verificationError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Verification Failed</AlertTitle>
                            <AlertDescription>
                                {verificationError}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* 4. Tabs */}
                    <Tabs defaultValue="writer" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="writer" className="gap-2">
                                <PenTool className="w-4 h-4" /> Writer
                                {config.writer.isVerified && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            </TabsTrigger>
                            <TabsTrigger value="strategist" className="gap-2">
                                <Brain className="w-4 h-4" /> Strategist
                                {config.strategist.isVerified && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            </TabsTrigger>
                            <TabsTrigger value="librarian" className="gap-2">
                                <Globe className="w-4 h-4" /> Librarian
                                {config.librarian.isVerified && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            </TabsTrigger>
                        </TabsList>

                        {/* --- STRATEGIST TAB (was Editor) --- */}
                        <TabsContent value="strategist" className="space-y-4 py-4 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
                            <div className="bg-slate-50 p-3 rounded border border-slate-100 flex gap-3">
                                <Brain className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-sm text-slate-900">The Research Strategist</h4>
                                    <p className="text-sm text-slate-600">
                                        Responsible for analyzing the document to identify key claims and generating search queries.
                                        Can use the same model as the Writer.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <Switch
                                    id="use-writer"
                                    checked={useWriterForStrategist}
                                    onCheckedChange={handleStrategistToggle}
                                />
                                <Label htmlFor="use-writer">Use Writer Configuration</Label>
                            </div>

                            {useWriterForStrategist ? (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600 space-y-2">
                                    <div className="flex items-center gap-2 text-slate-900 font-medium">
                                        <PenTool className="w-4 h-4" />
                                        Using Writer's Configuration
                                    </div>
                                    <p>The Strategist will use the same API key and model as the Writer.</p>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <span className="text-xs uppercase tracking-wider text-slate-500">Provider</span>
                                            <div className="font-medium">{config.writer.provider || "Not configured"}</div>
                                        </div>
                                        <div>
                                            <span className="text-xs uppercase tracking-wider text-slate-500">Model</span>
                                            <div className="font-medium">{config.writer.model || "Not configured"}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid gap-2">
                                        <Label>Provider</Label>
                                        <Select
                                            value={config.strategist.provider}
                                            onValueChange={(v) => updateStrategist({ provider: v as ProviderType, model: "" })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="poe" className="font-semibold">Poe (Proxy) - Recommended</SelectItem>
                                                <SelectItem value="grok">Grok (xAI)</SelectItem>
                                                <SelectItem value="openai">OpenAI</SelectItem>
                                                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                                                <SelectItem value="gemini">Google Gemini</SelectItem>
                                                <SelectItem value="openrouter">OpenRouter</SelectItem>
                                                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>API Key</Label>
                                        <Input
                                            type="password"
                                            value={config.strategist.apiKey}
                                            onChange={(e) => updateStrategist({ apiKey: e.target.value })}
                                            placeholder={`Enter ${config.strategist.provider} API Key`}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex justify-between">
                                            <Label>Model ID</Label>
                                            <a
                                                href={PROVIDER_DOCS[config.strategist.provider]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                View Official Models <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                        <Input
                                            value={config.strategist.model}
                                            onChange={(e) => updateStrategist({ model: e.target.value })}
                                            placeholder="e.g. gpt-3.5-turbo, claude-3-haiku"
                                        />
                                    </div>

                                    {config.strategist.provider === "ollama" && (
                                        <div className="grid gap-2">
                                            <Label>Base URL (Optional)</Label>
                                            <Input
                                                value={config.strategist.baseURL || "http://localhost:11434/v1"}
                                                onChange={(e) => updateStrategist({ baseURL: e.target.value })}
                                                placeholder="http://localhost:11434/v1"
                                            />
                                            <p className="text-xs text-slate-500">
                                                Default: <code className="px-1 py-0.5 bg-slate-100 rounded">http://localhost:11434/v1</code>.
                                                Change only if running Ollama on a custom port or remote server.
                                            </p>
                                        </div>
                                    )}

                                    <Button
                                        variant="secondary"
                                        onClick={() => handleVerifyScope('strategist')}
                                        disabled={verifyingScope === 'strategist' || config.strategist.isVerified}
                                        className="w-full"
                                    >
                                        {verifyingScope === 'strategist' ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing Connection...</>
                                        ) : config.strategist.isVerified ? (
                                            <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Connection Verified</>
                                        ) : (
                                            <><PlayCircle className="mr-2 h-4 w-4" /> Test Strategist Connection</>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </TabsContent>

                        {/* --- LIBRARIAN TAB (was Researcher) --- */}
                        <TabsContent value="librarian" className="space-y-4 py-4 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
                            <div className="bg-slate-50 p-3 rounded border border-slate-100 flex gap-3">
                                <Globe className="w-5 h-5 text-green-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-sm text-slate-900">The Research Librarian</h4>
                                    <p className="text-sm text-slate-600">
                                        Responsible for browsing the internet to find empirical evidence and citations.
                                        Requires a model with online search capabilities (e.g., Gemini).
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Provider</Label>
                                    <Select
                                        value={config.librarian.provider}
                                        onValueChange={(v) => updateLibrarian({ provider: v as ProviderType, model: "" })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="poe" className="font-semibold">Poe - Recommended</SelectItem>
                                            <SelectItem value="grok">Grok (xAI)</SelectItem>
                                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>API Key</Label>
                                    <Input
                                        type="password"
                                        value={config.librarian.apiKey}
                                        onChange={(e) => updateLibrarian({ apiKey: e.target.value })}
                                        placeholder={`Enter ${config.librarian.provider} API Key`}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex justify-between">
                                        <Label>Model ID</Label>
                                        <a
                                            href={PROVIDER_DOCS[config.librarian.provider]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            View Official Models <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                    <Input
                                        value={config.librarian.model}
                                        onChange={(e) => {
                                            updateLibrarian({ model: e.target.value });
                                            setVerificationError(null); // Clear error immediately on change
                                        }}
                                        onBlur={(e) => updateLibrarian({ model: e.target.value.trim() })} // Trim on blur
                                        placeholder="e.g. Gemini-2.5-Pro, Gemini-2.5-Flash"
                                    />
                                </div>

                                <Button
                                    variant="secondary"
                                    onClick={() => handleVerifyScope('librarian')}
                                    disabled={verifyingScope === 'librarian' || config.librarian.isVerified}
                                    className="w-full"
                                >
                                    {verifyingScope === 'librarian' ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing Connection...</>
                                    ) : config.librarian.isVerified ? (
                                        <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Connection Verified</>
                                    ) : (
                                        <><PlayCircle className="mr-2 h-4 w-4" /> Test Librarian Connection</>
                                    )}
                                </Button>
                            </div>
                        </TabsContent>

                        {/* --- WRITER TAB --- */}
                        <TabsContent value="writer" className="space-y-4 py-4 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
                            <div className="bg-slate-50 p-3 rounded border border-slate-100 flex gap-3">
                                <PenTool className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-sm text-slate-900">The Academic Writer</h4>
                                    <p className="text-sm text-slate-600">
                                        Responsible for synthesizing the draft and research into a final academic paper.
                                        Best suited for reasoning models like Claude 3.5 Sonnet or GPT-4o.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Provider</Label>
                                    <Select
                                        value={config.writer.provider}
                                        onValueChange={(v) => updateWriter({ provider: v as ProviderType, model: "" })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="poe" className="font-semibold">Poe - Recommended</SelectItem>
                                            <SelectItem value="grok">Grok (xAI)</SelectItem>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                                            <SelectItem value="gemini">Google Gemini</SelectItem>
                                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                                            <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                            <SelectItem value="custom">Custom (OpenAI Compatible)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>API Key</Label>
                                    <Input
                                        type="password"
                                        value={config.writer.apiKey}
                                        onChange={(e) => updateWriter({ apiKey: e.target.value })}
                                        placeholder={`Enter ${config.writer.provider} API Key`}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex justify-between">
                                        <Label>Model ID</Label>
                                        <a
                                            href={PROVIDER_DOCS[config.writer.provider]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            View Official Models <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                    <Input
                                        value={config.writer.model}
                                        onChange={(e) => updateWriter({ model: e.target.value })}
                                        placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022"
                                    />
                                </div>

                                {config.writer.provider === "ollama" && (
                                    <div className="grid gap-2">
                                        <Label>Base URL (Optional)</Label>
                                        <Input
                                            value={config.writer.baseURL || "http://localhost:11434/v1"}
                                            onChange={(e) => updateWriter({ baseURL: e.target.value })}
                                            placeholder="http://localhost:11434/v1"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Default: <code className="px-1 py-0.5 bg-slate-100 rounded">http://localhost:11434/v1</code>.
                                            Change only if running Ollama on a custom port or remote server.
                                        </p>
                                    </div>
                                )}

                                <Button
                                    variant="secondary"
                                    onClick={() => handleVerifyScope('writer')}
                                    disabled={verifyingScope === 'writer' || config.writer.isVerified}
                                    className="w-full"
                                >
                                    {verifyingScope === 'writer' ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing Connection...</>
                                    ) : config.writer.isVerified ? (
                                        <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Connection Verified</>
                                    ) : (
                                        <><PlayCircle className="mr-2 h-4 w-4" /> Test Writer Connection</>
                                    )}
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-between pt-4 border-t">
                        <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                                if (confirm("Are you sure you want to remove all API keys? This cannot be undone.")) {
                                    resetConfig();
                                    setOpen(false);
                                    toast({
                                        title: "Keys Removed",
                                        description: "All API keys have been removed from your browser.",
                                    });
                                }
                            }}
                        >
                            Remove Keys
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!isAllVerified}
                                className={isAllVerified ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                                {isAllVerified ? (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Verified & Saved
                                    </>
                                ) : (
                                    "Save Configuration"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
