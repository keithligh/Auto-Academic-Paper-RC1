import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { useAIConfig } from "@/context/AIConfigContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

export function AIConfigModal({ trigger }: { trigger?: React.ReactNode }) {
    const { config, updateProviderConfig, verifyConnection, isVerifying, resetConfig } = useAIConfig();
    const [activeTab, setActiveTab] = useState("writer");

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

    const renderProviderStatus = (isVerified: boolean) => {
        if (isVerified) {
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
        }
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" /> Unverified</Badge>;
    };

    const getPlaceholder = (provider: string) => {
        if (provider === "poe") return "Your Poe API Key";
        if (provider === "openai") return "sk-...........................";
        if (provider === "anthropic") return "sk-ant-.......................";
        if (provider === "gemini") return "AIza..........................";
        return "API Key";
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="w-4 h-4" />
                        AI Configuration
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-serif">AI Agent Configuration</DialogTitle>
                            <DialogDescription>
                                Configure the "Bring Your Own Key" (BYOK) settings for each agent in the pipeline.
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={resetConfig} className="text-muted-foreground">
                                Reset Defaults
                            </Button>
                            <Button onClick={() => verifyConnection()} disabled={isVerifying}>
                                {isVerifying ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Verify All
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex">
                    <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex-1 flex h-full">
                        <div className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
                            <TabsList className="flex flex-col h-auto bg-transparent gap-2 w-full">
                                <TabsTrigger value="writer" className="w-full justify-start px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <div className="text-left">
                                        <div className="font-semibold">The Writer</div>
                                        <div className="text-xs text-muted-foreground">Drafting & Editing</div>
                                    </div>
                                </TabsTrigger>
                                <TabsTrigger value="strategist" className="w-full justify-start px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <div className="text-left">
                                        <div className="font-semibold">The Strategist</div>
                                        <div className="text-xs text-muted-foreground">Critique & Planning</div>
                                    </div>
                                </TabsTrigger>
                                <TabsTrigger value="librarian" className="w-full justify-start px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <div className="text-left">
                                        <div className="font-semibold">The Librarian</div>
                                        <div className="text-xs text-muted-foreground">Research & Fact Check</div>
                                    </div>
                                </TabsTrigger>
                            </TabsList>

                            <div className="mt-auto">
                                <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                                    <Info className="w-4 h-4" />
                                    <AlertTitle className="text-xs font-bold">Privacy Note</AlertTitle>
                                    <AlertDescription className="text-[10px] leading-tight mt-1">
                                        API keys are stored locally in your browser. They are never sent to our servers, only directly to the AI providers.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto">
                            {/* STRATEGIST TAB */}
                            <TabsContent value="strategist" className="mt-0 space-y-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium">The Strategist (Critic)</h3>
                                        <p className="text-sm text-muted-foreground">Responsible for analyzing drafts, identifying weak claims, and planning research.</p>
                                    </div>
                                    {renderProviderStatus(config.strategist.isVerified || false)}
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Provider Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Provider</Label>
                                                <Select
                                                    value={config.strategist.provider}
                                                    onValueChange={(val: any) => updateProviderConfig("strategist", { provider: val })}
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
                                                    value={config.strategist.model}
                                                    onChange={(e) => updateProviderConfig("strategist", { model: e.target.value })}
                                                    placeholder="e.g. Claude-Sonnet-4.5, GPT-5.1, Grok-4.1"
                                                />
                                                <p className="text-[10px] text-muted-foreground">Must match the provider's model ID exactly.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={config.strategist.apiKey}
                                                onChange={(e) => updateProviderConfig("strategist", { apiKey: e.target.value })}
                                                placeholder={getPlaceholder(config.strategist.provider)}
                                            />
                                        </div>

                                        {config.strategist.provider === "custom" && (
                                            <div className="space-y-2">
                                                <Label>Base URL</Label>
                                                <Input
                                                    value={config.strategist.baseURL || ""}
                                                    onChange={(e) => updateProviderConfig("strategist", { baseURL: e.target.value })}
                                                    placeholder="https://api.example.com/v1"
                                                />
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => verifyConnection("strategist")}
                                                disabled={isVerifying}
                                            >
                                                Test Connection
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* LIBRARIAN TAB */}
                            <TabsContent value="librarian" className="mt-0 space-y-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium">The Librarian (Researcher)</h3>
                                        <p className="text-sm text-muted-foreground">Responsible for finding citations and verifying facts. Needs web access.</p>
                                    </div>
                                    {renderProviderStatus(config.librarian.isVerified || false)}
                                </div>

                                <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800 mb-4">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertTitle>Web Search Required</AlertTitle>
                                    <AlertDescription>
                                        The Librarian requires a model capable of web search (e.g., Perplexity, Gemini, or Poe with web-enabled bots).
                                    </AlertDescription>
                                </Alert>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Provider Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Provider</Label>
                                                <Select
                                                    value={config.librarian.provider}
                                                    onValueChange={(val: any) => updateProviderConfig("librarian", { provider: val })}
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
                                                    value={config.librarian.model}
                                                    onChange={(e) => updateProviderConfig("librarian", { model: e.target.value })}
                                                    placeholder="e.g. Gemini-2.5-Pro, Gemini-3.0-Pro"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={config.librarian.apiKey}
                                                onChange={(e) => updateProviderConfig("librarian", { apiKey: e.target.value })}
                                                placeholder={getPlaceholder(config.librarian.provider)}
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => verifyConnection("librarian")}
                                                disabled={isVerifying}
                                            >
                                                Test Connection
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* WRITER TAB */}
                            <TabsContent value="writer" className="mt-0 space-y-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium">The Writer (Editor)</h3>
                                        <p className="text-sm text-muted-foreground">Responsible for initial drafting and final citation insertion.</p>
                                    </div>
                                    {renderProviderStatus(config.writer.isVerified || false)}
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Provider Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Provider</Label>
                                                <Select
                                                    value={config.writer.provider}
                                                    onValueChange={(val: any) => updateProviderConfig("writer", { provider: val })}
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
                                                    value={config.writer.model}
                                                    onChange={(e) => updateProviderConfig("writer", { model: e.target.value })}
                                                    placeholder="e.g. Claude-Sonnet-4.5, GPT-5.1, o3-pro"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={config.writer.apiKey}
                                                onChange={(e) => updateProviderConfig("writer", { apiKey: e.target.value })}
                                                placeholder={getPlaceholder(config.writer.provider)}
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => verifyConnection("writer")}
                                                disabled={isVerifying}
                                            >
                                                Test Connection
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
