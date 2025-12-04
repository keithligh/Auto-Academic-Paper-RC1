import { DocumentAnalysis, Enhancement } from "@shared/schema";

function escapeLatex(text: string): string {
    return text
        .replace(/\\/g, "\\textbackslash{}")
        .replace(/[{}]/g, (m) => `\\${m}`)
        .replace(/[%$#&_]/g, (m) => `\\${m}`)
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}");
}

function formatEnhancement(enh: Enhancement): string {
    if (!enh.title || !enh.description || !enh.content) {
        // Log warning but don't crash
        console.warn(`[LatexGenerator] Enhancement ${enh.id} missing fields. Skipping.`);
        return "";
    }
    const title = escapeLatex(enh.title);
    const desc = escapeLatex(enh.description);
    let content = enh.content;

    // NOTE: We do NOT sanitize pgfplots/axis here anymore.
    // We want the full code in the PDF.
    // The frontend (LatexPreview.tsx) will handle preview limitations gracefully.

    if (enh.type === "symbol") {
        return "";
    }

    return `\\subsection*{${title}}\n${desc}\n\n${content}\n\n`;
}

function formatAuthorInfo(name?: string, affiliation?: string): string {
    const n = name ? escapeLatex(name) : "Author Name";
    if (affiliation && affiliation.trim()) {
        const aff = escapeLatex(affiliation);
        return `${n}\\\\${aff}`;
    }
    return n;
}

// Generate LaTeX document from analysis
export async function generateLatex(
    analysis: DocumentAnalysis,
    enhancements: Enhancement[],
    paperType: string,
    authorName?: string,
    authorAffiliation?: string
): Promise<string> {
    try {
        const enabled = enhancements.filter((e) => e.enabled);

        if (!analysis.title) {
            console.warn("[LatexGenerator] Analysis missing title. Using default.");
            analysis.title = "Untitled Academic Paper";
        }
        if (!analysis.abstract) {
            console.warn("[LatexGenerator] Analysis missing abstract. Using default.");
            analysis.abstract = "Abstract not provided.";
        }

        const title = escapeLatex(analysis.title);
        const abstract = analysis.abstract;

        const symbolDefs = enabled
            .filter((e) => e.type === "symbol")
            .map((e) => (e.content?.endsWith("\n") ? e.content : `${e.content}\n`))
            .join("");

        let latex = `\\documentclass[12pt]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{amsthm}
\\usepackage[margin=1in]{geometry}
\\usepackage[numbers]{natbib}
\\usepackage{listings}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage{tabularx}

% TikZ and diagram packages
\\usepackage{tikz}
\\usetikzlibrary{positioning,arrows,shapes,calc,decorations.pathreplacing}
\\usepackage{forest}

% Theorem environments
\\newtheorem{theorem}{Theorem}
\\newtheorem{lemma}{Lemma}
\\newtheorem{proposition}{Proposition}
\\newtheorem{corollary}{Corollary}
\\newtheorem{hypothesis}{Hypothesis}
\\newtheorem{definition}{Definition}
\\newtheorem{remark}{Remark}
\\newtheorem{constraint}{Constraint}

${symbolDefs ? `% Symbol definitions
${symbolDefs}` : ""}% Title and author
\\title{${title}}
\\author{${formatAuthorInfo(authorName, authorAffiliation)}}
\\date{\\today}

\\begin{document}
\\maketitle
\\begin{abstract}
${abstract}
\\end{abstract}

`;

        if (!analysis.sections || analysis.sections.length === 0) {
            console.warn("[LatexGenerator] No sections found. Creating default section.");
            analysis.sections = [{ name: "Introduction", content: "Content generation failed or was empty." }];
        }

        // Track placed enhancements to avoid duplicates
        const placedEnhancementIds = new Set<string>();

        for (const sec of analysis.sections) {
            try {
                if (!sec.name || !sec.content) {
                    console.warn(`[LatexGenerator] Skipping invalid section: ${JSON.stringify(sec)}`);
                    continue;
                }
                const secName = escapeLatex(sec.name);
                const secContent = sec.content;

                // Add Section Header
                latex += `\\section{${secName}}\n\n`;

                // --- INLINE ENHANCEMENT PLACEMENT ---
                // Find enhancements for this section
                const secEnhs = enabled.filter((e) => {
                    if (e.type === "symbol") return false;
                    const loc = (e.location || "").toLowerCase().trim();
                    const name = sec.name?.toLowerCase().trim() || "";
                    const nameNoNum = name.replace(/^\d+\.\s*/, "");
                    return (
                        name.includes(loc) || loc.includes(name) || nameNoNum.includes(loc) || loc.includes(nameNoNum)
                    );
                });

                // Insert enhancements immediately after header
                for (const enh of secEnhs) {
                    try {
                        if (enh.id && placedEnhancementIds.has(enh.id)) continue;
                        if (enh.id) placedEnhancementIds.add(enh.id);

                        latex += formatEnhancement(enh);
                    } catch (enhError) {
                        console.error(`[LatexGenerator] Failed to format enhancement ${enh.id}:`, enhError);
                    }
                }

                // Add Section Content
                latex += `${secContent}\n\n`;

            } catch (secError) {
                console.error(`[LatexGenerator] Error processing section ${sec.name}:`, secError);
                latex += `\\section{${sec.name || "Error"}}\n\n[Section content could not be generated due to an error]\n\n`;
            }
        }

        // --- UNMATCHED ENHANCEMENTS ---
        // Append to end of document, NO separate section header
        const unmatched = enabled.filter((e) => {
            if (e.type === "symbol") return false;
            return e.id && !placedEnhancementIds.has(e.id);
        });

        if (unmatched.length > 0) {
            latex += `\n% --- Additional Enhancements ---\n`;
            for (const enh of unmatched) {
                try {
                    latex += formatEnhancement(enh);
                } catch (enhError) {
                    console.error(`[LatexGenerator] Failed to format unmatched enhancement ${enh.id}:`, enhError);
                }
            }
        }

        latex += `\\end{document}\n`;

        return latex;
    } catch (error: any) {
        console.error("[LatexGenerator] CRITICAL ERROR:", error);
        return `\\documentclass{article}
\\title{Generation Error}
\\author{System}
\\begin{document}
\\maketitle
\\section*{Critical Error}
The system encountered a critical error while generating the LaTeX document.
\\begin{verbatim}
${error.message || String(error)}
\\end{verbatim}
\\end{document}`;
    }
}
