/*
 * GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file.
 */
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ConversionJob } from "@shared/schema";
import { SplitPreview } from "@/components/SplitPreview";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ResultPage() {
    const [, params] = useRoute("/results/:id");
    const [, setLocation] = useLocation();
    const jobId = params?.id;

    const { data: job, isLoading } = useQuery<ConversionJob>({
        queryKey: ["/api/conversions", jobId],
        enabled: !!jobId,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!job || job.status !== "completed") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <h1 className="text-xl font-semibold">Job not found or not completed</h1>
                <Button onClick={() => setLocation("/")}>Go Home</Button>
            </div>
        );
    }

    const handleExportLatex = () => {
        if (!job?.latexContent) return;
        const blob = new Blob([job.latexContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${job.originalFileName.replace(/\.[^/.]+$/, "")}.tex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-white text-foreground font-sans">
            <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <h1
                        className="font-serif text-lg font-bold text-gray-900 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLocation("/")}
                    >
                        Auto Academic Paper
                    </h1>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={() => setLocation("/")}>
                            New Document
                        </Button>
                        <Button onClick={handleExportLatex}>
                            Export LaTeX
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8 px-6">
                <SplitPreview
                    originalContent={job.originalContent || ""}
                    latexContent={job.latexContent || ""}
                    fileName={job.originalFileName}
                />
            </main>
        </div>
    );
}
