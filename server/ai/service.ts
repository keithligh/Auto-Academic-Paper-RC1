/*
 * GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content.
 * ALWAYS USE write_to_file.
 * REASON: THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. THIS IS A PLATFORM BUG.
 */
import { AIConfig } from "@shared/schema";
import { AIProvider } from "./provider";
import { OpenAICompatibleProvider } from "./adapters/openai";
import { PoeProvider } from "./adapters/poe";
import { GrokProvider } from "./adapters/grok";
import { OpenRouterProvider } from "./adapters/openrouter";
import { AnthropicProvider } from "./adapters/anthropic";
import { GeminiProvider } from "./adapters/gemini";
import { OllamaProvider } from "./adapters/ollama";
import { aiResponseSchema, type AiResponse, type Enhancement, type DocumentAnalysis } from "@shared/schema";
import { fixAIJsonEscaping, extractJson, escapeLatex, sanitizeLatexOutput } from "./utils";
import pRetry from "p-retry";

// ==========================================
// HELPER FUNCTIONS (Legacy from pre-byok-poe.ts)
// ==========================================

function sanitizeInputText(text: string): string {
    const headerRegex = /(\\((sub)?section\*?|textbf|large|Large|LARGE)\s*\{(References|Bibliography|Works Cited)\}|^\s*(References|Bibliography|Works Cited)\s*$)/m;
    const refItemStartRegex = /^\s*\[\d+\]/m;

    const lines = text.split('\n');
    let cutOffIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (headerRegex.test(line)) {
            let foundRef = false;
            for (let j = 1; j <= 5 && i + j < lines.length; j++) {
                if (refItemStartRegex.test(lines[i + j])) {
                    foundRef = true;
                    break;
                }
            }
            if (foundRef) {
                cutOffIndex = i;
                break;
            }
        }
        if (refItemStartRegex.test(line) && /^\[1\]/.test(line)) {
            cutOffIndex = i;
            break;
        }
    }

    if (cutOffIndex !== -1) {
        return lines.slice(0, cutOffIndex).join('\n').trim();
    }
    return text;
}

function compileBibliography(sections: any[], rawReferences: any[]): { compiledSections: any[], finalBibliography: string } {
    const citationMap = new Map<string, number>(); // ref_id -> new_number
    let nextNumber = 1;
    const usedReferences: any[] = [];

    if (!sections || !Array.isArray(sections)) {
        console.error("[compileBibliography] Invalid sections:", sections);
        return { compiledSections: [], finalBibliography: "" };
    }

    // 1. Scan and Replace Keys
    console.log(`[compileBibliography] Processing ${sections.length} sections...`);
    const compiledSections = sections.map((section, idx) => {
        if (!section) {
            console.warn(`[compileBibliography] Section ${idx} is null/undefined`);
            return { name: "Unknown", content: "" };
        }
        let content = section.content || "";

        // Regex to find (ref_X), \cite{ref_X}, or [ref_X]
        // We normalize all of them to \cite{ref_X} and ensure they are in the bibliography
        content = content.replace(/(?:\(ref_(\d+)\)|\\cite\{ref_(\d+)\}|\[ref_(\d+)\])/g, (match: string, id1: string, id2: string, id3: string) => {
            const id = id1 || id2 || id3;
            const fullId = `ref_${id}`;

            if (!citationMap.has(fullId)) {
                const refData = rawReferences.find(r => r.key === fullId);
                if (refData) {
                    citationMap.set(fullId, nextNumber);
                    usedReferences.push({ ...refData, number: nextNumber });
                    nextNumber++;
                } else {
                    return "[?]";
                }
            }
            return `\\cite{${fullId}}`;
        });

        return { ...section, content };
    });

    // 2. Generate Bibliography
    // We generate a standard LaTeX bibliography environment
    // \bibitem{ref_X} ...
    let bibContent = "\\begin{thebibliography}{99}\n";
    usedReferences.forEach(ref => {
        // ESCAPE LATEX CHARACTERS IN BIBLIOGRAPHY FIELDS
        const author = escapeLatex(ref.author || "Unknown Author");
        const title = escapeLatex(ref.title || "Unknown Title");
        const venue = escapeLatex(ref.venue || "Unknown Venue");
        const year = ref.year || "????";

        bibContent += `\\bibitem{${ref.key}} ${author}. \\textit{${title}}. ${venue}, ${year}.\n`;
    });
    bibContent += "\\end{thebibliography}";

    return { compiledSections, finalBibliography: bibContent };
}

// ==========================================
// AI SERVICE CLASS
// ==========================================

export class AIService {
    private strategist: AIProvider;
    private librarian: AIProvider;
    private writer: AIProvider;
    private logger: (msg: string) => Promise<void>;

    constructor(config: AIConfig, logger: (msg: string) => Promise<void>) {
        this.logger = logger;
        this.strategist = this.createProvider(config.strategist);
        this.librarian = this.createProvider(config.librarian);
        this.writer = this.createProvider(config.writer);
    }

    private createProvider(config: any): AIProvider {
        switch (config.provider) {
            case "openai": return new OpenAICompatibleProvider(config);
            case "poe": return new PoeProvider(config);
            case "grok": return new GrokProvider(config);
            case "openrouter": return new OpenRouterProvider(config);
            case "anthropic": return new AnthropicProvider(config);
            case "gemini": return new GeminiProvider(config);
            case "ollama": return new OllamaProvider(config);
            default: throw new Error(`Unknown provider: ${config.provider}`);
        }
    }

    private async log(msg: string) {
        await this.logger(msg);
    }

    async verifyConnections(scope?: string): Promise<{ success: boolean; error?: string }> {
        try {
            // If scope is provided, verify only that agent
            if (scope === 'writer') {
                await this.writer.completion("test", "test");
            } else if (scope === 'librarian') {
                await this.librarian.completion("test", "test");
            } else if (scope === 'strategist') {
                await this.strategist.completion("test", "test");
            } else {
                // Verify all
                await Promise.all([
                    this.writer.completion("test", "test"),
                    this.librarian.completion("test", "test"),
                    this.strategist.completion("test", "test")
                ]);
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // 5-PHASE PIPELINE IMPLEMENTATION
    // ==========================================

    // Wrapper for backward compatibility with routes.ts
    async processDocument(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any
    ): Promise<AiResponse> {
        return this.analyzeDocument(content, paperType, enhancementLevel, advancedOptions);
    }

    async analyzeDocument(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any
    ): Promise<AiResponse> {
        const sanitizedContent = sanitizeInputText(content);
        if (sanitizedContent.length !== content.length) {
            await this.log(`[Input] Sanitized input (removed existing bibliography).`);
        }

        // PHASE 1: THE THINKER (Writer Agent)
        // Drafts the paper WITHOUT citations.
        const draft = await this.phase1_Thinker(sanitizedContent, paperType, enhancementLevel, advancedOptions);

        // PHASE 2: THE CRITIC (Strategist Agent)
        // Identifies claims needing evidence.
        const claims = await this.phase2_Critic(draft, enhancementLevel);

        // PHASE 3: THE LIBRARIAN (Librarian Agent)
        // Researches evidence for claims.
        const researchedClaims = await this.phase3_Librarian(claims);

        // PHASE 4: THE EDITOR (Writer Agent)
        // Inserts citations into the draft.
        const finalDraft = await this.phase4_Editor(draft, researchedClaims);

        // PHASE 5: THE COMPILER (Internal)
        // Formats the bibliography.
        const compiledDraft = this.phase5_Compiler(finalDraft);

        return compiledDraft;
    }

    // --- Phase 1: The Thinker ---
    private async phase1_Thinker(content: string, paperType: string, enhancementLevel: string, advancedOptions: any): Promise<AiResponse> {
        await this.log(`[Phase 1/5] The Thinker (Writer Agent): Drafting paper...`);

        const enabledEnhancementTypes: string[] = [];
        if (advancedOptions.formula) enabledEnhancementTypes.push("formula", "equation");
        if (advancedOptions.hypothesis) enabledEnhancementTypes.push("hypothesis");
        if (advancedOptions.diagram) enabledEnhancementTypes.push("diagram");
        if (advancedOptions.logical_structure) enabledEnhancementTypes.push("logical_structure", "theorem", "proof");
        if (advancedOptions.symbol) enabledEnhancementTypes.push("symbol");
        enabledEnhancementTypes.push("table", "figure", "code_listing", "algorithm");

        const systemPrompt = `You are a distinguished academic researcher.

ROLE:
1. You are THE THINKER. You will draft a complete academic paper WITH scholarly enhancements.
2. CRITICAL: Do NOT add citations yet. You will write the content first, and citations will be added later.
3. Transform the INPUT TEXT into a well-structured academic paper.

TECHNICAL CONSTRAINTS (WEB PREVIEW COMPATIBILITY):
- The output will be rendered in a lightweight web-based LaTeX previewer (tikzjax in iframe).
- **PGFPLOTS IS TOO HEAVY:** The 'pgfplots' and 'axis' libraries are too complex for this environment and cause rendering failures.
- **BEST PRACTICE:** Use standard TikZ primitives (\\node, \\draw, \\path) to construct diagrams manually. This ensures high performance and compatibility.
- **AVOID:** Do not use \\textwidth, \\columnwidth, or \\maxwidth (undefined in preview). Use fixed dimensions (e.g., 10cm).
- **SIMPLIFY MATH:** Do not use complex unit math like {3*0.8}cm. Calculate values explicitly (e.g., 2.4cm).

CRITICAL INSTRUCTIONS:
- NO CITATIONS: Do NOT cite any sources. Do NOT use (ref_1), [1], [2], etc.
- NO BIBLIOGRAPHY: Do NOT include a References section. The "references" array should be empty.
- GENERATE ENHANCEMENTS: Add scholarly elements (diagrams, formulas, theorems, etc.) as appropriate.
- ENHANCEMENT LEVEL: ${enhancementLevel} - adjust density accordingly.
- FOCUS ON IDEAS: Write clear, well-argued content expressing academic ideas.
- REMOVE INPUT BIBLIOGRAPHY: If the INPUT TEXT contains a bibliography, REMOVE IT completely.
- NO NESTED SECTIONS: Do NOT use \\section commands inside the "content" field.
- **NO SECTION NUMBERING:** Do NOT include numbers in section titles (e.g., use "Introduction", NOT "1. Introduction").
- **NO TRAILING NEWLINES:** Do NOT output excessive newlines (\\n\\n\\n) at the end of sections. Be concise.
- **NO HALLUCINATIONS:** Do NOT generate repetitive or looping text. Stick to the input context.
- **NO COLORS:** Do NOT use \\textcolor, \\color, or any color commands. Academic papers must be black and white.
- Output valid JSON matching the schema.
`;

        const userPrompt = `Transform this text into a ${paperType} (${enhancementLevel} enhancements).

INPUT TEXT:
${content}

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String (NO NUMBERS)", "content": "LaTeX String (NO CITATIONS)" }],
  "references": [],
  "enhancements": [{ "type": "String", "title": "String", "description": "String", "content": "LaTeX", "location": "String", "reasoning": "String" }]
}

ENHANCEMENT TYPES (use these only):
${enabledEnhancementTypes.join(", ")}

SPECIAL INSTRUCTIONS FOR DIAGRAMS:
- For "diagram" type: MUST USE 'tikzpicture' environment.
- TECHNICAL NOTE: Avoid 'pgfplots'/'axis' due to web preview limitations.
- RECOMMENDATION: Construct diagrams using standard TikZ primitives (\\draw, \\node, etc.).
- REMINDER: Use fixed dimensions (cm) and explicit calculations.
- Example: \\begin{tikzpicture} \\draw (0,0) -- (1,1); \\end{tikzpicture}

SPECIAL INSTRUCTIONS FOR TABLES:
- **NO COLORS:** Do NOT use \\textcolor or \\color in tables.
- **STATUS INDICATORS:** Use standard symbols (e.g., $\\checkmark$, $\\times$, $\\triangle$) instead of colors. Do NOT use \\smalltriangleup.
- **FORMAT:** Use standard LaTeX table environments. For text-heavy tables, use 'tabularx' with 'X' columns to prevent overflow.
- **EXAMPLE:** \\begin{tabularx}{\\textwidth}{|l|X|} ... \\end{tabularx}

SPECIAL INSTRUCTION FOR CONTENT:
- Do NOT end sections with multiple newlines.
- Ensure all JSON strings are properly escaped.
`;

        return await pRetry(async () => {
            let lastSectionName = "";
            let lastCheckTime = 0;
            let lastLogTime = 0;
            // 15 minute timeout for the Thinker (drafting takes time)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI request timed out after 15 minutes")), 900000)
            );

            const completionPromise = this.writer.jsonCompletion(
                userPrompt,
                systemPrompt,
                aiResponseSchema,
                async (text) => {
                    // Throttle regex checks to every 500ms
                    const now = Date.now();
                    if (now - lastCheckTime < 500) return;
                    lastCheckTime = now;

                    // Log character count every 5 seconds to show liveness
                    if (now - lastLogTime > 5000) {
                        await this.log(`[Thinker] Drafting... (${text.length} chars generated)`);
                        lastLogTime = now;
                    }

                    // Simple heuristic to detect progress in JSON stream
                    // We look for "name": "Section Name" patterns
                    // OPTIMIZATION: Only scan the last 2000 characters to avoid O(N^2) regex on full text
                    const scanWindow = text.slice(-2000);
                    const matches = scanWindow.match(/"name":\s*"([^"]+)"/g);

                    if (matches && matches.length > 0) {
                        // We can't track total section count easily with a window, 
                        // but we can log the *latest* section found in this window.
                        const newSection = matches[matches.length - 1];
                        const sectionName = newSection.match(/"name":\s*"([^"]+)"/)?.[1];

                        // Use a simple dedup check based on the name
                        if (sectionName && sectionName !== lastSectionName) {
                            await this.log(`[Thinker] Drafting section: ${sectionName}...`);
                            lastSectionName = sectionName;
                        }
                    }
                }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            // Sanitize the output before parsing (Server-side Safety Net)
            if (typeof result === 'string') {
                const sanitizedResponse = sanitizeLatexOutput(result);
                const parsed = extractJson(sanitizedResponse);
                await this.log(`[Thinker] Draft complete: ${parsed.sections?.length || 0} sections.`);
                return parsed;
            }

            await this.log(`[Thinker] Draft complete: ${result.sections?.length || 0} sections.`);
            return result;
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                // IMPROVED ERROR LOGGING: Explicitly log message and stack
                const errorMsg = error.message || "Unknown error";
                const errorStack = error.stack || "No stack trace";
                const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error)); // This captures non-enumerable props like stack if possible

                await this.log(`[Thinker] Attempt ${error.attemptNumber} failed: ${errorMsg}`);
                console.error(`[Thinker] Detailed Error:`, errorDetails);
                console.error(`[Thinker] Stack Trace:`, errorStack);
            }
        });
    }

    // --- Phase 2: The Critic ---
    private async phase2_Critic(draft: AiResponse, enhancementLevel: string): Promise<any[]> {
        await this.log(`[Phase 2/5] The Critic (Strategist Agent): Identifying claims...`);

        let targetClaims = "5-7 key claims";
        if (enhancementLevel === "minimal") targetClaims = "2-3 critical claims";
        if (enhancementLevel === "advanced") targetClaims = "8-12 important claims";

        const draftText = draft.sections.map(s => `### ${s.name}\n${s.content}`).join("\n\n");

        const systemPrompt = `You are an academic reviewer identifying claims that need citations.`;
        const userPrompt = `DRAFT PAPER:
${draftText}

TASK:
Identify ${targetClaims} that would benefit from supporting citations. Look for:
- Factual claims about performance, outcomes, or comparisons
- Empirical statements referencing studies or data
- Technical claims about algorithms, complexity, or methods
- Statements invoking established theories or frameworks

NOTE: Be selective, not robotic. Focus on claims that genuinely need evidence.

OUTPUT FORMAT (JSON array):
[
  {
    "section": "Section name",
    "sentence": "Exact sentence needing citation",
    "context": "Surrounding 1-2 sentences for context",
    "reasoning": "Why this claim needs evidence"
  }
]

Return ONLY the JSON array, nothing else.`;

        return await pRetry(async () => {
            let lastClaimCount = 0;
            let lastCheckTime = 0;

            // 15 minute timeout for the AI request
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI request timed out after 15 minutes")), 900000)
            );

            const completionPromise = this.strategist.jsonCompletion(
                userPrompt,
                systemPrompt,
                null, // No schema validation for now as it's an array
                async (text) => {
                    // Throttle regex checks to every 500ms
                    const now = Date.now();
                    if (now - lastCheckTime < 500) return;
                    lastCheckTime = now;

                    // Simple heuristic to detect progress in JSON array
                    // We look for "sentence": "..." patterns
                    const matches = text.match(/"sentence":\s*"([^"]+)"/g);
                    if (matches && matches.length > lastClaimCount) {
                        await this.log(`[Critic] Identifying claim ${matches.length}...`);
                        lastClaimCount = matches.length;
                    }
                }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            await this.log(`[Critic] Identified ${result.length} claims.`);
            return result;
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Critic] Attempt ${error.attemptNumber} failed: ${error.message || String(error)}. Retrying...`);
            }
        });
    }

    // --- Phase 3: The Librarian ---
    private async phase3_Librarian(claims: any[]): Promise<any[]> {
        await this.log(`[Phase 3/5] The Librarian (Librarian Agent): Researching ${claims.length} claims...`);

        if (!this.librarian.supportsResearch) {
            await this.log(`[Librarian] Warning: Configured provider does not support research. Skipping.`);
            return claims.map(c => ({ ...c, citation: null }));
        }

        const researchedClaims: any[] = [];
        let refNumber = 1;

        for (let i = 0; i < claims.length; i++) {
            const claim = claims[i];
            await this.log(`[Librarian] Researching claim ${i + 1}/${claims.length}...`);

            try {
                // We construct a query prompt, but if the provider supports 'research' natively (like Poe adapter),
                // we might need to adapt. However, the 'research' method in AIProvider takes string[].
                // The legacy code did one-by-one research.
                // To support the legacy logic, we need to ask the provider to find a paper.
                // If the provider is Poe, we can use the 'research' method if it accepts a prompt?
                // No, AIProvider.research takes queries: string[].
                // But here we want to pass a full prompt with context.
                // We should use 'completion' with enableWebSearch=true if available.

                const prompt = `Find ONE academic paper that supports this specific claim.

CLAIM: ${claim.sentence}
CONTEXT: ${claim.context}
REASON: ${claim.reasoning}

TASK:
1. Search online for a peer-reviewed academic paper that directly supports this claim.
2. Verify the paper exists and is relevant.
3. Return a single best-matching reference.

OUTPUT FORMAT (JSON):
{
  "found": true,
  "reference": {
    "author": "Author names",
    "title": "Paper title",
    "venue": "Journal/Conference",
    "year": YYYY,
    "url": "URL if available"
  },
  "searchQuery": "The exact query you used"
}

If NO suitable paper found, return: {"found": false, "searchQuery": "query used"}
`;
                // Use completion with web search enabled
                const resultStr = await this.librarian.completion(prompt, "You are a Research Librarian.", undefined, true);

                // Parse result using robust extractor
                const research = extractJson(resultStr);

                if (research.found && research.reference) {
                    const citation = {
                        key: `ref_${refNumber}`,
                        author: research.reference.author,
                        title: research.reference.title,
                        venue: research.reference.venue,
                        year: research.reference.year
                    };
                    researchedClaims.push({ ...claim, citation, searchQuery: research.searchQuery });
                    await this.log(`[Librarian] ✓ Found: ${research.reference.author}`);
                    refNumber++;
                } else {
                    researchedClaims.push({ ...claim, citation: null, searchQuery: research.searchQuery });
                    await this.log(`[Librarian] ✗ No evidence found.`);
                }

            } catch (e: any) {
                await this.log(`[Librarian] Error on claim ${i + 1}: ${e.message}`);
                researchedClaims.push({ ...claim, citation: null });
            }
        }

        return researchedClaims;
    }

    // --- Phase 4: The Editor ---
    private async phase4_Editor(draft: AiResponse, researchedClaims: any[]): Promise<AiResponse> {
        const citedClaims = researchedClaims.filter(c => c.citation !== null);
        await this.log(`[Phase 4/5] The Editor (Writer Agent): Inserting ${citedClaims.length} citations...`);

        const citationsList = citedClaims.map(c => ({
            section: c.section,
            sentence: c.sentence,
            citationKey: c.citation.key,
            reference: c.citation
        }));

        const draftText = JSON.stringify({
            title: draft.title,
            abstract: draft.abstract,
            sections: draft.sections
        }, null, 2);

        const citationsText = JSON.stringify(citationsList, null, 2);

        const systemPrompt = `You are an academic editor inserting citations into a draft paper.

ROLE:
1. You will receive a DRAFT PAPER and a list of CITATIONS TO INSERT.
2. Insert each citation at the END of the specified sentence using the citation key format (ref_1), (ref_2), etc.
3. PRESERVE ALL CONTENT EXACTLY - only add citations, don't modify anything else.

CRITICAL INSTRUCTIONS:
- INSERT CITATIONS: Add (ref_X) at the end of each specified sentence
- PRESERVE CONTENT: Do NOT modify the text, only add citations
- EXACT KEYS: Use the exact citation keys provided (ref_1, ref_2, etc.)
- NO NESTED SECTIONS: Do NOT use \\section commands inside the "content" field
- NO SECTION NUMBERING: Do NOT include numbers in section titles
- NO NESTED SECTIONS: Do NOT use \\section commands inside the "content" field
- NO SECTION NUMBERING: Do NOT include numbers in section titles
- **NO TRAILING NEWLINES:** Do NOT output excessive newlines (\\n\\n\\n) at the end of sections.
- **NO COLORS:** Do NOT use \\textcolor or \\color.
- Output valid JSON matching the schema`;

        const userPrompt = `Insert citations into this draft.

DRAFT PAPER:
${draftText}

CITATIONS TO INSERT:
${citationsText}

INSTRUCTIONS:
- Find each sentence in its section
- Add the citation key at the end of each sentence in the format: (ref_X)
- Leave uncited sentences unchanged

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String (NO NUMBERS)", "content": "LaTeX String WITH citations" }],
  "references": [{ "key": "ref_1", "author": "...", "title": "...", "venue": "...", "year": YYYY }]
}

Return ONLY the JSON.`;

        return await pRetry(async () => {
            let lastLogTime = 0;

            // 15 minute timeout for the Editor
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI request timed out after 15 minutes")), 900000)
            );

            const completionPromise = this.writer.jsonCompletion(
                userPrompt,
                systemPrompt,
                aiResponseSchema,
                async (text) => {
                    // Log character count every 5 seconds
                    const now = Date.now();
                    if (now - lastLogTime > 5000) {
                        await this.log(`[Editor] Inserting citations... (${text.length} chars generated)`);
                        lastLogTime = now;
                    }
                }
            );
            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            // Sanitize the output before parsing (Server-side Safety Net)
            if (typeof result === 'string') {
                const sanitizedResponse = sanitizeLatexOutput(result);
                const parsed = extractJson(sanitizedResponse);
                await this.log(`[Editor] Editing complete.`);
                // Restore enhancements from original draft (Editor might drop them)
                parsed.enhancements = draft.enhancements;

                // Ensure references match what we sent
                if (!citedClaims || !Array.isArray(citedClaims)) {
                    await this.log(`[Editor] CRITICAL WARNING: citedClaims is invalid: ${typeof citedClaims}`);
                    parsed.references = [];
                } else {
                    parsed.references = citedClaims.map(c => c.citation);
                }
                return parsed;
            }

            // Restore enhancements from original draft (Editor might drop them)
            result.enhancements = draft.enhancements;

            // Ensure references match what we sent
            if (!citedClaims || !Array.isArray(citedClaims)) {
                await this.log(`[Editor] CRITICAL WARNING: citedClaims is invalid: ${typeof citedClaims}`);
                result.references = [];
            } else {
                result.references = citedClaims.map(c => c.citation);
            }

            await this.log(`[Editor] Citations inserted.`);
            return result;
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Editor] Attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`);
            }
        });
    }

    // --- Phase 5: The Compiler ---
    private phase5_Compiler(draft: AiResponse): AiResponse {
        this.log(`[Phase 5/5] The Compiler: Formatting bibliography...`);

        // SAFETY CHECK: Ensure sections exist
        if (!draft.sections || !Array.isArray(draft.sections)) {
            console.error("[Compiler] CRITICAL ERROR: 'sections' is missing or invalid in draft:", JSON.stringify(draft).slice(0, 200));
            this.log(`[Compiler] CRITICAL ERROR: Draft is missing sections. Returning raw draft.`);
            return draft;
        }

        if (draft.references && draft.references.length > 0) {
            try {
                const { compiledSections, finalBibliography } = compileBibliography(draft.sections, draft.references);

                // Filter out any existing reference sections
                const cleanSections = compiledSections.filter((s: any) =>
                    !/^(\d+\.?\s*)?(references|bibliography|works cited)$/i.test(s.name.trim())
                );

                // Append new bibliography
                cleanSections.push({
                    name: "References",
                    content: finalBibliography
                });

                return {
                    ...draft,
                    sections: cleanSections,
                    references: [] // Clear raw refs
                };
            } catch (error: any) {
                console.error("[Compiler] CRITICAL ERROR in compileBibliography:", error);
                this.log(`[Compiler] CRITICAL ERROR: Bibliography compilation failed: ${error.message}. Returning raw draft.`);
                return draft;
            }
        }

        return draft;
    }
}
