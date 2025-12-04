import { useState } from "react";
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
  // Default to "latex" view as requested
  const [activeView, setActiveView] = useState<"original" | "latex">("latex");
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
    <div className="w-full flex flex-col">
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4 px-4">
        <h3 className="text-lg font-semibold text-foreground">Document Preview</h3>
        <div className="flex gap-2">
          <Button
            variant={activeView === "original" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("original")}
            data-testid="button-view-original"
          >
            Original
          </Button>
          <Button
            variant={activeView === "latex" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("latex")}
            data-testid="button-view-latex"
          >
            LaTeX
          </Button>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex flex-1 gap-4">
        {/* Single View: Original Only */}
        {activeView === "original" && (
          <div className="flex-1">
            <Card className="h-full flex flex-col">
              <div className="p-4 border-b border-card-border flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-muted-foreground" />
                <h4 className="text-sm font-medium text-foreground">Original Content</h4>
              </div>
              <ScrollArea className="flex-1 p-6">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground leading-relaxed bg-transparent">
                  {originalContent}
                </pre>
              </ScrollArea>
            </Card>
          </div>
        )}

        {/* Single View: LaTeX Only */}
        {activeView === "latex" && (
          <div className="flex-1">
            <Card className="h-full flex flex-col">
              <div className="p-4 border-b border-card-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CodeBracketIcon className="w-5 h-5 text-muted-foreground" />
                  <h4 className="text-sm font-medium text-foreground">Enhanced LaTeX</h4>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLatex}
                    className="h-8 px-3"
                    title="Copy LaTeX Code"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant={latexViewMode === "code" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLatexViewMode("code")}
                    data-testid="button-latex-code-single"
                    className="h-8 px-3"
                  >
                    <CodeBracketIcon className="w-4 h-4 mr-1" />
                    Code
                  </Button>
                  <Button
                    variant={latexViewMode === "preview" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLatexViewMode("preview")}
                    data-testid="button-latex-preview-single"
                    className="h-8 px-3"
                  >
                    <EyeIcon className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {latexViewMode === "code" ? (
                  <div className="p-6 bg-muted/30">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground leading-relaxed bg-transparent">
                      {latexContent}
                    </pre>
                  </div>
                ) : (
                  <LatexPreview latexContent={latexContent} className="min-h-full" />
                )}
              </ScrollArea>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile: Tabbed View */}
      <div className="md:hidden flex-1">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="h-full flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="original" className="flex-1">Original</TabsTrigger>
            <TabsTrigger value="latex" className="flex-1">LaTeX</TabsTrigger>
          </TabsList>

          <TabsContent value="original" className="flex-1 mt-4">
            <Card className="h-full flex flex-col">
              <ScrollArea className="flex-1 p-6">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground leading-relaxed bg-transparent">
                  {originalContent}
                </pre>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="latex" className="flex-1 mt-4">
            <Card className="h-full flex flex-col">
              <div className="p-3 border-b border-card-border flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">LaTeX</h4>
                <div className="flex gap-1">
                  <Button
                    variant={latexViewMode === "code" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLatexViewMode("code")}
                    data-testid="button-latex-code-mobile"
                    className="h-7 px-2 text-xs"
                  >
                    Code
                  </Button>
                  <Button
                    variant={latexViewMode === "preview" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLatexViewMode("preview")}
                    data-testid="button-latex-preview-mobile"
                    className="h-7 px-2 text-xs"
                  >
                    Preview
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {latexViewMode === "code" ? (
                  <div className="p-6 bg-muted/30">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground leading-relaxed bg-transparent">
                      {latexContent}
                    </pre>
                  </div>
                ) : (
                  <LatexPreview latexContent={latexContent} className="min-h-full" />
                )}
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
