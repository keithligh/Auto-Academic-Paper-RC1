    // ====== REPAIR: THE MECHANIC ======
    async repairLatex(latex: string, errors: string[]): Promise < string > {
    await this.log(`[Repair] Attempting to fix ${errors.length} LaTeX errors...`, { phase: "Finalization", step: "Repairing LaTeX", progress: 99 });

    const systemPrompt = `You are a LaTeX Syntax Repair Specialist.
YOUR TASK: Fix the syntax errors in the provided LaTeX code.
ERRORS FOUND:
${errors.map(e => `- ${e}`).join("\n")}

CRITICAL RULES:
1. Fix ONLY the errors listed. Do not rewrite the content.
2. Return the FULL corrected LaTeX document.
3. Ensure all environments (begin/end) are balanced.
4. Escape special characters if they caused the error.

OUTPUT: The corrected LaTeX code ONLY. No markdown, no explanations.`;

    const userPrompt = `BROKEN LATEX:
${latex}`;

    try {
        return await this.writer.completion(userPrompt, systemPrompt);
    } catch(e: any) {
        await this.log(`[Repair] Failed to repair LaTeX: ${e.message}`);
        return latex; // Return original if repair fails
    }
}
