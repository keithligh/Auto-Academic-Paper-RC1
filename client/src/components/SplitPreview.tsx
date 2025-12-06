import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, CodeBracketIcon, EyeIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { LatexPreview } from "./LatexPreview";
import { useToast } from "@/hooks/use-toast";

interface SplitPreviewProps {
  originalContent: string;
  latexContent: string;
  fileName?: string;
}

export function SplitPreview({ originalContent, latexContent, fileName }: SplitPreviewProps) {
  // View State: 'latex' (default) or 'original'. Removed 'split' mode.
  const [activeView, setActiveView] = useState<"latex" | "original">("latex");
  const [latexViewMode, setLatexViewMode] = useState<"code" | "preview">("preview");
  const { toast } = useToast();

  const handleCopyLatex = async () => {
    try {
      await navigator.clipboard.writeText(latexContent);
      toast({
        title: "Copied to clipboard",
        description: "LaTeX code has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* View Toggle Header */}
      <div className="flex items-center justify-between mb-4 px-4 shrink-0">
        <h3 className="text-lg font-semibold text-foreground">Document Editor</h3>
        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant={activeView === "original" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveView("original")}
            data-testid="button-view-original"
            className="h-7 text-xs"
          >
            <DocumentTextIcon className="w-4 h-4 mr-1" />
            Original
          </Button>
          <Button
            variant={activeView === "latex" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveView("latex")}
            data-testid="button-view-latex"
            className="h-7 text-xs"
          >
            <CodeBracketIcon className="w-4 h-4 mr-1" />
            LaTeX
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden gap-4 min-h-0">

        {/* ORIGINAL CONTENT PANE */}
        {activeView === "original" && (
          <div className="w-full flex flex-col min-h-0 transition-all duration-300">
            <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
              <div className="p-3 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Source</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground/80 leading-relaxed bg-transparent">
                    {originalContent}
                  </pre>
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}

        {/* LATEX CONTENT PANE */}
        {activeView === "latex" && (
          <div className="w-full flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm">
              <div className="p-2 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 px-2">
                  <CodeBracketIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {latexViewMode === "preview" ? "Live Preview" : "LaTeX Source"}
                  </span>
                </div>

                {/* LaTeX Toolbar */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLatex}
                    className="h-7 px-2 text-xs hover:bg-background"
                    title="Copy LaTeX Code"
                  >
                    <ClipboardDocumentIcon className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </Button>
                  <div className="h-4 w-px bg-border my-auto mx-1" />
                  <div className="flex bg-background rounded-md border border-border p-0.5">
                    <Button
                      variant={latexViewMode === "code" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setLatexViewMode("code")}
                      className="h-6 px-2 text-[10px]"
                    >
                      Code
                    </Button>
                    <Button
                      variant={latexViewMode === "preview" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setLatexViewMode("preview")}
                      className="h-6 px-2 text-[10px]"
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative bg-muted/10">
                {latexViewMode === "code" ? (
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/90 leading-relaxed">
                        {latexContent}
                      </pre>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-full w-full overflow-y-auto">
                    {/* Pass className to manage internal scrolling if needed, or let parent handle */}
                    <LatexPreview latexContent={latexContent} className="min-h-full py-8" />
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
