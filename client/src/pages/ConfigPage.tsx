import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useAIConfig } from "@/context/AIConfigContext";

const providers = [
    { value: "poe", label: "Poe API (Proxy)" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "gemini", label: "Google Gemini" },
    { value: "grok", label: "xAI (Grok)" },
    { value: "ollama", label: "Ollama (Local)" },
    { value: "custom", label: "Custom / Other" },
];

const getPlaceholder = (provider: string) => {
    if (provider === "poe") return "Your Poe API Key";
    if (provider === "openai") return "sk-...........................";
    if (provider === "anthropic") return "sk-ant-.......................";
    if (provider === "gemini") return "AIza..........................";
    return "API Key";
};

interface ProviderSectionProps {
    title: string;
    description: string;
    role: "writer" | "strategist" | "librarian";
    isExpanded: boolean;
    onToggle: () => void;
    showWebSearchWarning?: boolean;
    showSameAsWriterSwitch?: boolean;
    useSameAsWriter?: boolean;
    onToggleSameAsWriter?: (checked: boolean) => void;
}

function ProviderSection({ title, description, role, isExpanded, onToggle, showWebSearchWarning, showSameAsWriterSwitch, useSameAsWriter, onToggleSameAsWriter }: ProviderSectionProps) {
    const { config, updateProviderConfig, verifyConnection, isVerifying } = useAIConfig();
    const providerConfig = config[role];

    return (
        <Card className="overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full text-left p-4 md:p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {providerConfig.isVerified ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <div>
                        <h3 className="font-semibold text-base md:text-lg">{title}</h3>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {providerConfig.isVerified ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 hidden sm:flex">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600 hidden sm:flex">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Unverified
                        </Badge>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <CardContent className="pt-0 pb-6 px-4 md:px-6 space-y-4 border-t">
                    {/* "Same as Writer" Switch */}
                    {showSameAsWriterSwitch && (
                        <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg mt-4">
                            <Label htmlFor="same-as-writer" className="text-sm font-medium cursor-pointer">
                                Use same settings as The Writer
                            </Label>
                            <Switch
                                id="same-as-writer"
                                checked={useSameAsWriter}
                                onCheckedChange={onToggleSameAsWriter}
                            />
                        </div>
                    )}

                    {showWebSearchWarning && (
                        <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800 mt-4">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertTitle>Web Search Required</AlertTitle>
                            <AlertDescription>
                                The Librarian requires a model capable of web search (e.g., Perplexity, Gemini, or Poe with web-enabled bots).
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Show message when using same as writer, otherwise show form */}
                    {useSameAsWriter ? (
                        <div className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg mt-4">
                            Using same settings as The Writer
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Provider</Label>
                                    <Select
                                        value={providerConfig.provider}
                                        onValueChange={(val: any) => updateProviderConfig(role, { provider: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {providers.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Model Name</Label>
                                    <Input
                                        value={providerConfig.model}
                                        onChange={(e) => updateProviderConfig(role, { model: e.target.value })}
                                        placeholder="e.g. Claude-Sonnet-4.5, GPT-5.1"
                                    />
                                    <p className="text-xs text-muted-foreground">Must match the provider's model ID exactly.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    value={providerConfig.apiKey}
                                    onChange={(e) => updateProviderConfig(role, { apiKey: e.target.value })}
                                    placeholder={getPlaceholder(providerConfig.provider)}
                                />
                            </div>

                            {providerConfig.provider === "custom" && (
                                <div className="space-y-2">
                                    <Label>Base URL</Label>
                                    <Input
                                        value={providerConfig.baseURL || ""}
                                        onChange={(e) => updateProviderConfig(role, { baseURL: e.target.value })}
                                        placeholder="https://api.example.com/v1"
                                    />
                                </div>
                            )}

                            <div className="pt-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => verifyConnection(role)}
                                    disabled={isVerifying}
                                >
                                    Test Connection
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

export default function ConfigPage() {
    const [, setLocation] = useLocation();
    const { config, updateProviderConfig, resetConfig, verifyConnection } = useAIConfig();
    const [expandedSection, setExpandedSection] = useState<string | null>("writer");
    const [useSameAsWriter, setUseSameAsWriter] = useState(false);

    const verifiedCount = [
        config.writer.isVerified,
        config.strategist.isVerified,
        config.librarian.isVerified
    ].filter(Boolean).length;
    const allVerified = verifiedCount === 3;

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // Handler for "Same as Writer" toggle
    const handleSameAsWriterToggle = async (checked: boolean) => {
        setUseSameAsWriter(checked);
        if (checked) {
            // Copy Writer config to Strategist
            updateProviderConfig("strategist", {
                provider: config.writer.provider,
                model: config.writer.model,
                apiKey: config.writer.apiKey,
                baseURL: config.writer.baseURL,
            });
            // Auto-verify if writer is verified
            if (config.writer.isVerified) {
                await verifyConnection("strategist");
            }
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-10">
                <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation("/")}
                            className="md:hidden"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setLocation("/")}
                            className="hidden md:flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Button>
                        <h1 className="text-lg md:text-xl font-serif font-bold">AI Configuration</h1>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetConfig} className="text-muted-foreground">
                        Reset
                    </Button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
                {/* Privacy & Security Notice - #1 User Concern */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">Your API Keys Are 100% Safe</span>
                    </div>
                    <ul className="text-sm space-y-1 ml-6 list-disc">
                        <li><strong>Stored locally</strong> in your browser (localStorage) — never on any server</li>
                        <li><strong>Sent only</strong> to the AI providers you configure (OpenAI, Anthropic, etc.)</li>
                        <li><strong>No remote servers</strong> — this entire app runs on your local machine</li>
                        <li><strong>Go fully offline</strong> with Ollama for complete privacy</li>
                    </ul>
                </div>
                <div className={`p-4 rounded-lg border ${allVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-3">
                        {allVerified ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                            <AlertTriangle className="w-6 h-6 text-amber-600" />
                        )}
                        <div>
                            <p className={`font-semibold ${allVerified ? 'text-green-700' : 'text-amber-700'}`}>
                                {allVerified ? 'All Providers Ready' : `${verifiedCount}/3 Providers Verified`}
                            </p>
                            {!allVerified && (
                                <p className="text-sm text-amber-600">
                                    Test each provider below before processing documents.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Provider Sections */}
                <div className="space-y-4">
                    <ProviderSection
                        title="The Writer"
                        description="Drafting & Editing"
                        role="writer"
                        isExpanded={expandedSection === "writer"}
                        onToggle={() => toggleSection("writer")}
                    />

                    <ProviderSection
                        title="The Strategist"
                        description="Critique & Planning"
                        role="strategist"
                        isExpanded={expandedSection === "strategist"}
                        onToggle={() => toggleSection("strategist")}
                        showSameAsWriterSwitch={true}
                        useSameAsWriter={useSameAsWriter}
                        onToggleSameAsWriter={handleSameAsWriterToggle}
                    />

                    <ProviderSection
                        title="The Librarian"
                        description="Research & Fact Check"
                        role="librarian"
                        isExpanded={expandedSection === "librarian"}
                        onToggle={() => toggleSection("librarian")}
                        showWebSearchWarning={true}
                    />
                </div>

                {/* Continue Button */}
                {allVerified && (
                    <div className="pt-4">
                        <Button
                            size="lg"
                            className="w-full md:w-auto"
                            onClick={() => setLocation("/")}
                        >
                            Continue to Upload
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
