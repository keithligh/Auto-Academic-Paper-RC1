import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { FileText, User, ListChecks, Code, ChartLine, Settings2, Upload, AlertCircle, FolderOpen, RotateCcw, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileCard } from "@/components/FileCard";
import { AIConfigModal } from "@/components/AIConfigModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { enhancementLevels, paperTypes } from "@shared/schema";
import { useAIConfig } from "@/context/AIConfigContext";

// Generate a unique ID for file uploads
// Generate a sanitized unique ID for file uploads
function generateUploadId(originalName: string) {
    const timestamp = Date.now();

    // Split name and extension
    const lastDotIndex = originalName.lastIndexOf('.');
    let name = originalName;
    let ext = '';

    if (lastDotIndex !== -1) {
        name = originalName.substring(0, lastDotIndex);
        ext = originalName.substring(lastDotIndex);
    }

    // Sanitize name:
    // 1. Replace spaces with underscores
    // 2. Remove Windows reserved chars (< > : " / \ | ? *)
    // 3. Remove control characters
    // 4. Trim
    const sanitizedName = name
        .replace(/\s+/g, '_')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/[\x00-\x1F]/g, '')
        .trim();

    // Fallback if name becomes empty
    const finalName = sanitizedName || 'upload';

    // Combine: timestamp-name.ext
    return `${timestamp}-${finalName}${ext}`;
}

export default function LandingPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { config } = useAIConfig();
    const [isDragActive, setIsDragActive] = useState(false);

    // Check if all agents are verified
    const isAIConfigured = config?.writer?.isVerified && config?.librarian?.isVerified && config?.strategist?.isVerified;

    // Staged File State
    const [stagedFile, setStagedFile] = useState<File | null>(null);
    const [uploadID, setUploadID] = useState<string>("");

    // Job Ticket State
    const [paperType, setPaperType] = useState("research_paper");
    const [enhancementLevel, setEnhancementLevel] = useState("standard");
    const [authorName, setAuthorName] = useState("");
    const [authorAffiliation, setAuthorAffiliation] = useState("");

    // Advanced Options
    const [advancedOptions, setAdvancedOptions] = useState({
        formula: true,
        hypothesis: true,
        diagram: true,
        logical_structure: true,
        symbol: true,
        citations: true,
    });

    const handleOptionToggle = (key: keyof typeof advancedOptions) => {
        setAdvancedOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleRecallLast = useCallback(async () => {
        try {
            const res = await apiRequest("GET", "/api/conversions/latest");
            const job = await res.json();

            if (!job || !job.id) {
                toast({
                    title: "No previous generation found",
                    description: "Generate a paper first to use this feature",
                    variant: "destructive"
                });
                return;
            }

            setLocation(`/results/${job.id}`);
        } catch (err: any) {
            toast({
                title: "Failed to recall generation",
                description: err.message || "Could not fetch latest generation",
                variant: "destructive"
            });
        }
    }, [setLocation, toast]);

    // Import LaTeX file for debugging
    const latexInputRef = useRef<HTMLInputElement>(null);

    const handleImportLatex = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const latexContent = await file.text();

            // Create a debug job entry via API
            const res = await apiRequest("POST", "/api/conversions/debug-import", {
                latexContent,
                originalFileName: file.name
            });
            const job = await res.json();

            toast({
                title: "LaTeX imported",
                description: `Imported ${file.name} for preview`
            });

            setLocation(`/results/${job.id}`);
        } catch (err: any) {
            toast({
                title: "Failed to import LaTeX",
                description: err.message || "Could not create preview job",
                variant: "destructive"
            });
        }

        // Reset input for re-import
        if (latexInputRef.current) {
            latexInputRef.current.value = '';
        }
    }, [setLocation, toast]);

    // Upload File to Local Storage
    const uploadFileToStorage = async (file: File, id: string) => {
        const url = `/api/local-upload/${id}`;
        await fetch(url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
        });
    };

    // Create Job Mutation
    const createJobMutation = useMutation({
        mutationFn: async () => {
            if (!stagedFile || !uploadID) throw new Error("No file staged");

            // Upload the file first
            await uploadFileToStorage(stagedFile, uploadID);

            // Create the job
            const res = await apiRequest("POST", "/api/conversions", {
                fileName: stagedFile.name,
                fileType: stagedFile.type,
                fileSize: stagedFile.size.toString(),
                uploadURL: `/api/local-upload/${uploadID}`,
                paperType,
                enhancementLevel,
                authorName,
                authorAffiliation,
                advancedOptions,
            });
            return res.json();
        },
        onSuccess: (data) => {
            setLocation(`/processing/${data.jobId}`);
        },
        onError: (error) => {
            toast({
                title: "Processing Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setStagedFile(file);

            // Generate upload ID locally
            const id = generateUploadId(file.name);
            setUploadID(id);
        }
    }, []);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            "text/plain": [".txt"],
            "text/markdown": [".md"],
        },
        maxFiles: 1,
        onDragEnter: () => setIsDragActive(true),
        onDragLeave: () => setIsDragActive(false),
        onDropAccepted: () => setIsDragActive(false),
        disabled: !isAIConfigured
    });

    const handleRemoveFile = () => {
        setStagedFile(null);
        setUploadID("");
    };

    return (
        <div className="min-h-screen bg-white text-foreground font-sans selection:bg-gray-100">
            {/* Header */}
            <header className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1
                            className="text-xl font-serif font-bold text-gray-900 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setLocation("/")}
                        >
                            Auto Academic Paper
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRecallLast}
                            title="Recall Last Generation"
                            className="gap-2"
                        >
                            <RotateCcw className="w-4 h-4 text-gray-500" />
                            <span className="hidden sm:inline text-sm">Recall Last</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => latexInputRef.current?.click()}
                            title="Import LaTeX File for Debug"
                            className="gap-2"
                        >
                            <FileUp className="w-4 h-4 text-gray-500" />
                            <span className="hidden sm:inline text-sm">Import LaTeX</span>
                        </Button>
                        <input
                            ref={latexInputRef}
                            type="file"
                            accept=".tex,.latex,text/x-latex"
                            className="hidden"
                            onChange={handleImportLatex}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => apiRequest("POST", "/api/open-upload-folder")}
                            title="Open Uploads Folder"
                        >
                            <FolderOpen className="w-5 h-5 text-gray-500" />
                        </Button>
                        <AIConfigModal />
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-12 px-6">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Hero Section */}
                    {!stagedFile && (
                        <div className="text-center space-y-3 mb-12">
                            <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight text-gray-900 text-center">
                                Auto Academic Paper
                            </h1>
                            <p className="text-xl text-gray-500 font-sans max-w-2xl mx-auto">
                                Transform rough drafts into verified research papers.
                            </p>
                        </div>
                    )}

                    {/* Upload Zone */}
                    {!stagedFile && (
                        <>
                            {!isAIConfigured ? (
                                <AIConfigModal trigger={
                                    <div className="relative group cursor-pointer max-w-2xl mx-auto min-h-[220px] flex flex-col items-center justify-center gap-4 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                                        <div className="flex flex-col items-center gap-4 text-gray-400 group-hover:text-gray-500 transition-colors">
                                            <div className="p-3 rounded-full bg-white border border-gray-100 shadow-sm group-hover:scale-110 transition-transform duration-200">
                                                <Settings2 className="w-6 h-6" strokeWidth={1.5} />
                                            </div>
                                            <div className="space-y-1 text-center">
                                                <h3 className="text-xl font-serif font-medium">
                                                    Configure AI to Enable Upload
                                                </h3>
                                                <p className="text-sm">
                                                    Click to setup API keys
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                } />
                            ) : (
                                <div
                                    {...getRootProps()}
                                    className={`
                                        relative group cursor-pointer
                                        max-w-2xl mx-auto min-h-[220px]
                                        flex flex-col items-center justify-center gap-4
                                        bg-white rounded-xl
                                        border-2 border-dashed transition-all duration-200
                                        ${isDragActive
                                            ? "border-black bg-gray-50 scale-[1.01]"
                                            : "border-gray-200 hover:border-gray-400 hover:bg-gray-50/50"
                                        }
                                    `}
                                >
                                    <input {...getInputProps()} />
                                    <div className={`
                                        p-3 rounded-full bg-white border border-gray-100 shadow-sm
                                        transition-transform duration-200 group-hover:scale-110
                                    `}>
                                        <Upload className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <h3 className="text-xl font-serif text-gray-900">
                                            Drop Manuscript Here
                                        </h3>
                                        <p className="text-sm text-gray-500 font-medium">
                                            PDF, DOCX, TXT, or MD
                                        </p>
                                    </div>
                                    <Button variant="outline" className="rounded-full">
                                        Select from Device
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Job Ticket */}
                    {stagedFile && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-2xl font-serif font-bold text-gray-900">Job Ticket</h2>
                                        <Button variant="ghost" size="sm" onClick={handleRemoveFile} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                            Cancel
                                        </Button>
                                    </div>

                                    <FileCard
                                        fileName={stagedFile.name}
                                        fileSize={(stagedFile.size / 1024 / 1024).toFixed(2) + " MB"}
                                        fileType={stagedFile.type.split("/")[1] || "file"}
                                        onRemove={handleRemoveFile}
                                    />

                                    <Card className="p-6 space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="font-medium text-gray-900 flex items-center gap-2">
                                                <User className="w-4 h-4" /> Author Information
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Author Name</Label>
                                                    <Input
                                                        placeholder="e.g. Dr. Jane Smith"
                                                        value={authorName}
                                                        onChange={(e) => setAuthorName(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Affiliation</Label>
                                                    <Input
                                                        placeholder="e.g. University of Example"
                                                        value={authorAffiliation}
                                                        onChange={(e) => setAuthorAffiliation(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="p-6 space-y-4">
                                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                                            <Settings2 className="w-4 h-4" /> Advanced Options
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="citations"
                                                    checked={advancedOptions.citations}
                                                    onCheckedChange={() => handleOptionToggle('citations')}
                                                />
                                                <Label htmlFor="citations" className="cursor-pointer">Citation Verification</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="formula"
                                                    checked={advancedOptions.formula}
                                                    onCheckedChange={() => handleOptionToggle('formula')}
                                                />
                                                <Label htmlFor="formula" className="cursor-pointer">Formula Editing</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="hypothesis"
                                                    checked={advancedOptions.hypothesis}
                                                    onCheckedChange={() => handleOptionToggle('hypothesis')}
                                                />
                                                <Label htmlFor="hypothesis" className="cursor-pointer">Hypothesis Highlighting</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="diagram"
                                                    checked={advancedOptions.diagram}
                                                    onCheckedChange={() => handleOptionToggle('diagram')}
                                                />
                                                <Label htmlFor="diagram" className="cursor-pointer">Diagram Generation</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="logical_structure"
                                                    checked={advancedOptions.logical_structure}
                                                    onCheckedChange={() => handleOptionToggle('logical_structure')}
                                                />
                                                <Label htmlFor="logical_structure" className="cursor-pointer">Logical Structure</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="symbol"
                                                    checked={advancedOptions.symbol}
                                                    onCheckedChange={() => handleOptionToggle('symbol')}
                                                />
                                                <Label htmlFor="symbol" className="cursor-pointer">Symbol Normalization</Label>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                <div className="space-y-6">
                                    <Card className="p-6 bg-gray-50 border-gray-200">
                                        <h3 className="font-serif font-bold text-lg mb-4">Job Summary</h3>
                                        <div className="space-y-4 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">File</span>
                                                <span className="font-medium truncate max-w-[150px]">{stagedFile.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Enhancements</span>
                                                <span className="font-medium">{Object.values(advancedOptions).filter(Boolean).length} Selected</span>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                                            <div className="space-y-2">
                                                <Label>Paper Type</Label>
                                                <RadioGroup value={paperType} onValueChange={setPaperType}>
                                                    {paperTypes.map(t => (
                                                        <div key={t.value} className="flex items-center space-x-2">
                                                            <RadioGroupItem value={t.value} id={`paper-${t.value}`} />
                                                            <Label htmlFor={`paper-${t.value}`} className="font-normal cursor-pointer">{t.label}</Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Enhancement Level</Label>
                                                <RadioGroup value={enhancementLevel} onValueChange={setEnhancementLevel}>
                                                    {enhancementLevels.map(l => (
                                                        <div key={l.value} className="flex items-center space-x-2">
                                                            <RadioGroupItem value={l.value} id={l.value} />
                                                            <Label htmlFor={l.value} className="font-normal cursor-pointer">{l.label}</Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </div>

                                            <Button
                                                size="lg"
                                                className="w-full"
                                                onClick={() => createJobMutation.mutate()}
                                                disabled={createJobMutation.isPending}
                                            >
                                                {createJobMutation.isPending ? "Processing..." : "Submit Job"}
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Features Grid */}
                    {!stagedFile && (
                        <div className="grid md:grid-cols-3 gap-6 pt-8 max-w-5xl mx-auto border-t border-gray-100">
                            <div className="flex flex-col items-center text-center space-y-2 p-3">
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    <ListChecks className="w-5 h-5 text-gray-700" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Verified Citations</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Instantly format references according to any style guide.
                                </p>
                            </div>
                            <div className="flex flex-col items-center text-center space-y-2 p-3">
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    <Code className="w-5 h-5 text-gray-700" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Automated LaTeX</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Generate perfect mathematical typesetting and document structure.
                                </p>
                            </div>
                            <div className="flex flex-col items-center text-center space-y-2 p-3">
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    <ChartLine className="w-5 h-5 text-gray-700" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Vector Diagrams</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Convert sketches and images into sharp, scalable figures.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
