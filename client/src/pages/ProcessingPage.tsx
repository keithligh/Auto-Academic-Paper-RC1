/*
 * GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content.
 * ALWAYS USE write_to_file.
 * REASON: THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. THIS IS A PLATFORM BUG.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ConversionJob } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Terminal, Loader2, Clock } from "lucide-react";

// Micro-steps for the UI visualization
const MICRO_STEPS = [
    { id: "init", label: "Upload & Extract", duration: 3000 },
    { id: "thinker", label: "Phase 1: Thinker", duration: 8000 },
    { id: "critic", label: "Phase 2: Critic", duration: 4000 },
    { id: "librarian", label: "Phase 3: Librarian", duration: 6000 },
    { id: "editor", label: "Phase 4: Editor", duration: 6000 },
    { id: "compiler", label: "Phase 5: Compiler", duration: 2000 },
];

export default function ProcessingPage() {
    const [, params] = useRoute("/processing/:id");
    const [, setLocation] = useLocation();
    const jobId = params?.id;

    // Local state
    const [logs, setLogs] = useState<string[]>([]);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [stallWarning, setStallWarning] = useState(false);
    const lastUpdateRef = useRef<number>(Date.now());
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Poll for job status
    const { data: job, error, isError } = useQuery<ConversionJob>({
        queryKey: ["/api/conversions", jobId],
        enabled: !!jobId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            // Stop polling if completed or failed
            return status === "processing" || status === "pending" ? 2000 : false;
        },
        retry: false,
    });

    // Effect: Handle Job Completion/Failure
    useEffect(() => {
        if (job?.status === "completed") {
            setTimeout(() => setLocation(`/results/${jobId}`), 1000);
        }
    }, [job?.status, jobId, setLocation]);

    // Rotating status messages for long-running steps
    const [statusMessage, setStatusMessage] = useState("");

    useEffect(() => {
        const messages = [
            "Analyzing document structure...",
            "Identifying key arguments...",
            "Cross-referencing citations...",
            "Verifying academic sources...",
            "Synthesizing research data...",
            "Formatting mathematical expressions...",
            "Optimizing LaTeX code..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            setStatusMessage(messages[i % messages.length]);
            i++;
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Effect: Update logs from job data (REAL-TIME LOGGING)
    useEffect(() => {
        if (job?.logs && Array.isArray(job.logs)) {
            setLogs(job.logs);
            // Auto-scroll
            if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
            }
            // Update timestamp for Stall Detection
            lastUpdateRef.current = Date.now();
            setStallWarning(false);
        }
    }, [job?.logs]);

    // Effect: Stall Detection (The Safety Net)
    // If logs haven't changed for >10 seconds, show "Deep research" warning
    useEffect(() => {
        const interval = setInterval(() => {
            if (job?.status === 'processing' && Date.now() - lastUpdateRef.current > 10000) {
                setStallWarning(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [job?.status]);

    // Effect: Sync Progress Bar with Real Logs
    useEffect(() => {
        if (!job || !job.logs) return;

        const logString = job.logs.join(" ");
        let newStepIndex = 0;

        // Determine step based on log content
        // Determine step based on log content
        if (logString.includes("[Phase 5/5]")) {
            newStepIndex = 5; // Compiler
        } else if (logString.includes("[Phase 4/5]")) {
            newStepIndex = 4; // Editor
        } else if (logString.includes("[Phase 3/5]")) {
            newStepIndex = 3; // Librarian
        } else if (logString.includes("[Phase 2/5]")) {
            newStepIndex = 2; // Critic
        } else if (logString.includes("[Phase 1/5]")) {
            newStepIndex = 1; // Thinker
        } else {
            newStepIndex = 0; // Upload & Extract
        }

        setActiveStepIndex(newStepIndex);
    }, [job?.logs]);

    // Initial Log
    useEffect(() => {
        if (logs.length === 0 && !job?.logs) {
            setLogs(["Initializing processing environment..."]);
        }
    }, []);

    // Error State (404)
    if (isError || (job === undefined && error)) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6 border border-red-100 bg-red-50/50 p-8 rounded-xl">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-serif font-bold text-red-900">Job Not Found</h3>
                        <p className="text-sm text-red-700 leading-relaxed">
                            The conversion job could not be found. The server may have restarted or the ID is invalid.
                        </p>
                    </div>
                    <Button onClick={() => setLocation("/")} variant="outline" className="w-full border-red-200 text-red-900 hover:bg-red-100">
                        Return Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-foreground font-sans selection:bg-gray-100">
            {/* Header */}
            <header className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <span className="font-serif font-bold text-lg tracking-tight">Auto Academic Paper</span>
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                        <span>STATUS: {job?.status?.toUpperCase() || "CONNECTING..."}</span>
                        <div className={`w-2 h-2 rounded-full ${job?.status === 'processing' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-12 px-6 max-w-4xl mx-auto space-y-12">

                {/* 1. Status Heading */}
                <div className="text-center space-y-4">
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">
                        {job?.status === 'failed' ? 'Processing Failed' : 'Transforming into Academic Paper'}
                    </h1>
                    <p className="text-gray-500 font-sans">
                        {job?.originalFileName || "Document"}
                    </p>
                    {job?.status === 'processing' && (
                        <div className="h-6 overflow-hidden">
                            <p className="text-sm text-blue-600 font-medium transition-all duration-500">
                                {statusMessage}
                            </p>
                        </div>
                    )}
                </div>

                {/* 2. Micro-Steps Visualization */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {MICRO_STEPS.map((step, index) => {
                        const isActive = index === activeStepIndex;
                        const isCompleted = index < activeStepIndex;

                        return (
                            <div key={step.id} className={`
                relative flex flex-col items-center p-4 rounded-lg border transition-all duration-500
                ${isActive ? 'border-black bg-gray-50 shadow-sm scale-105 z-10' : 'border-gray-100 bg-white'}
                ${isCompleted ? 'border-gray-200' : ''}
              `}>
                                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center mb-3 transition-colors duration-300
                  ${isActive ? 'bg-black text-white' : ''}
                  ${isCompleted ? 'bg-gray-100 text-gray-600' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-50 text-gray-300' : ''}
                `}>
                                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> :
                                        isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                            <span className="text-xs font-mono">{index + 1}</span>}
                                </div>
                                <span className={`text-xs font-medium text-center ${isActive ? 'text-black' : 'text-gray-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 3. Live Activity Log (Console) */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Terminal className="w-4 h-4" />
                            <span>Activity Log</span>
                        </div>
                        {stallWarning && (
                            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span className="hidden md:inline">Deep research in progress... this may take a moment.</span>
                                <span className="md:hidden">Processing...</span>
                            </div>
                        )}
                    </div>

                    <div
                        ref={logContainerRef}
                        className="h-64 bg-gray-900 rounded-xl p-4 overflow-y-auto font-mono text-xs text-gray-300 shadow-inner scroll-smooth"
                    >
                        {logs.map((log, i) => {
                            const splitIndex = log.indexOf(']');
                            const timestamp = splitIndex > -1 ? log.substring(0, splitIndex + 1) : '';
                            const message = splitIndex > -1 ? log.substring(splitIndex + 1) : log;

                            return (
                                <div key={i} className="py-0.5 border-l-2 border-transparent hover:border-gray-700 pl-2 transition-colors">
                                    <span className="text-gray-500 mr-2">{timestamp}</span>
                                    <span className="text-gray-100">{message}</span>
                                </div>
                            );
                        })}
                        {job?.status === 'processing' && (
                            <div className="py-0.5 pl-2 animate-pulse text-gray-500">
                                _
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Actions / Error Recovery */}
                {job?.status === 'failed' && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="font-medium text-red-900">Processing Error</h4>
                            <p className="text-sm text-red-700">{job.error}</p>
                        </div>
                        <Button onClick={() => setLocation("/")} variant="destructive">
                            Try Again
                        </Button>
                    </div>
                )}

            </main>
        </div>
    );
}
