import {
    AIConfig,
    AiResponse,
    aiResponseSchema,
    defaultAIConfig,
    documentAnalysisSchema,
    DraftDocument,
    draftDocumentSchema,
    ResearchedClaim,
    claimSchema,
    researchedClaimSchema,
    JobProgress
} from "@shared/schema";
import { AIProvider } from "./provider";
import { OpenAICompatibleProvider } from "./adapters/openai";
import { PoeProvider } from "./adapters/poe";
import { GrokProvider } from "./adapters/grok";
import { OpenRouterProvider } from "./adapters/openrouter";
import { AnthropicProvider } from "./adapters/anthropic";
import { GeminiProvider } from "./adapters/gemini";
import { OllamaProvider } from "./adapters/ollama";
import { extractJson, sanitizeLatexOutput } from "./utils";
import pRetry from "p-retry";
import { validateLatexSyntax } from "../latexValidator";

// Factory for creating providers (Internal)
class AIProviderFactory {
    static create(config: any): AIProvider {
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
}

export class AIService {
    private writer: AIProvider;
    private librarian: AIProvider;
    private strategist: AIProvider;
    private logger: (message: string, progress?: JobProgress) => Promise<void>;

    constructor(config: AIConfig, logger: (message: string, progress?: JobProgress) => Promise<void>) {
        this.logger = logger;
        this.writer = AIProviderFactory.create(config.writer);
        this.librarian = AIProviderFactory.create(config.librarian);
        this.strategist = AIProviderFactory.create(config.strategist);
    }

    private async log(message: string, progress?: JobProgress) {
        await this.logger(message, progress);
    }

    // Verify connections (REAL IMPLEMENTATION)
    async verifyConnections(scope?: string): Promise<{ success: boolean; error?: string }> {
        const providersToVerify: { name: string; provider: AIProvider }[] = [];

        if (scope) {
            if (scope === 'writer') providersToVerify.push({ name: 'Writer', provider: this.writer });
            else if (scope === 'librarian') providersToVerify.push({ name: 'Librarian', provider: this.librarian });
            else if (scope === 'strategist') providersToVerify.push({ name: 'Strategist', provider: this.strategist });
            else return { success: false, error: `Invalid scope: ${scope}` };
        } else {
            providersToVerify.push({ name: 'Writer', provider: this.writer });
            providersToVerify.push({ name: 'Librarian', provider: this.librarian });
            providersToVerify.push({ name: 'Strategist', provider: this.strategist });
        }

        for (const { name, provider } of providersToVerify) {
            try {
                // Minimal test prompt to verify connectivity and auth
                await provider.completion("Test connection. Reply with 'OK'.", "You are a connection tester.");
            } catch (error: any) {
                console.error(`[Verification] ${name} failed:`, error);
                return {
                    success: false,
                    error: `${name} Connection Failed: ${error.message || "Unknown error"}`
                };
            }
        }

        return { success: true };
    }

    // Wrapper for backward compatibility with routes.ts
    async processDocument(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any = {}
    ): Promise<AiResponse> {
        return this.generatePaper(content, paperType, enhancementLevel, advancedOptions);
    }

    // Main entry point for the 5-Phase Pipeline
    async generatePaper(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any = {}
    ): Promise<AiResponse> {
        await this.log(`[AI Service] Starting 5-Phase Research Pipeline...`, { phase: "Initialization", step: "Pipeline Start", progress: 10 });
        await this.log(`[Config] Writer: ${this.writer.model}, Librarian: ${this.librarian.model}`);

        try {
            // Phase 1: The Thinker (Drafting)
            const draft = await this.phase1_Thinker(content, paperType, enhancementLevel, advancedOptions);

            // Phase 2: The Critic (Claim Identification)
            const claims = await this.phase2_Critic(draft, enhancementLevel);

            // Phase 3: The Librarian (Research)
            const researchedClaims = await this.phase3_Librarian(claims);

            // Phase 4: The Editor (Synthesis & Citation)
            const finalDraft = await this.phase4_Editor(draft, researchedClaims);

            // Phase 5: The Compiler (Final Polish)
            // (Currently implicit in the return, but we ensure references are attached)
            return finalDraft;

        } catch (error: any) {
            await this.log(`[AI Service] CRITICAL ERROR: ${error.message}`, { phase: "Error", step: "Failed", progress: 0, details: error.message });
            throw error;
        }
    }

    // --- Phase 1: The Thinker ---
    private async phase1_Thinker(content: string, paperType: string, enhancementLevel: string, advancedOptions: any): Promise<AiResponse> {
        await this.log(`[Phase 1/5] The Thinker (Writer Agent): Drafting paper...`, { phase: "Phase 1: Drafting", step: "Starting Draft", progress: 15 });

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
- **SUBJECT MATTER ADHERENCE:** You MUST write about the TOPIC of the INPUT TEXT. Do NOT write a generic paper about "how to write a paper" or "text transformation". If the input is about "Love", write about "Love".
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
                        await this.log(`[Thinker] Drafting... (${text.length} chars generated)`, { phase: "Phase 1: Drafting", step: "Generating Text", progress: 20, details: `${text.length} chars` });
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
                            await this.log(`[Thinker] Drafting section: ${sectionName}...`, { phase: "Phase 1: Drafting", step: `Drafting: ${sectionName}`, progress: 25, details: sectionName });
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
                await this.log(`[Thinker] Draft complete: ${parsed.sections?.length || 0} sections.`, { phase: "Phase 1: Drafting", step: "Draft Complete", progress: 30 });
                return parsed;
            }

            await this.log(`[Thinker] Draft complete: ${result.sections?.length || 0} sections.`, { phase: "Phase 1: Drafting", step: "Draft Complete", progress: 30 });
            return result;
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                // IMPROVED ERROR LOGGING: Explicitly log message and stack
                const errorMsg = error.message || "Unknown error";
                const errorStack = error.stack || "No stack trace";
                const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error)); // This captures non-enumerable props like stack if possible

                await this.log(`[Thinker] Attempt ${error.attemptNumber} failed: ${errorMsg}`, { phase: "Phase 1: Drafting", step: "Error - Retrying", progress: 20, details: errorMsg });
                console.error(`[Thinker] Detailed Error:`, errorDetails);
                console.error(`[Thinker] Stack Trace:`, errorStack);
            }
        });
    }

    // --- Phase 2: The Critic ---
    private async phase2_Critic(draft: AiResponse, enhancementLevel: string): Promise<any[]> {
        await this.log(`[Phase 2/5] The Critic (Strategist Agent): Identifying claims...`, { phase: "Phase 2: Critique", step: "Identifying Claims", progress: 35 });

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
                        await this.log(`[Critic] Identifying claim ${matches.length}...`, { phase: "Phase 2: Critique", step: "Identifying Claims", progress: 35 + (matches.length * 2), details: `Found ${matches.length} claims` });
                        lastClaimCount = matches.length;
                    }
                }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            await this.log(`[Critic] Identified ${result.length} claims.`, { phase: "Phase 2: Critique", step: "Critique Complete", progress: 45, details: `${result.length} claims found` });
            return result;
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Critic] Attempt ${error.attemptNumber} failed: ${error.message || String(error)}. Retrying...`, { phase: "Phase 2: Critique", step: "Error - Retrying", progress: 35 });
            }
        });
    }

    // --- Phase 3: The Librarian ---
    private async phase3_Librarian(claims: any[]): Promise<any[]> {
        await this.log(`[Phase 3/5] The Librarian (Librarian Agent): Researching ${claims.length} claims...`, { phase: "Phase 3: Research", step: "Starting Research", progress: 50 });

        if (!this.librarian.supportsResearch) {
            await this.log(`[Librarian] Warning: Configured provider does not support research. Skipping.`);
            return claims.map(c => ({ ...c, citation: null }));
        }

        const researchedClaims: any[] = [];
        let refNumber = 1;

        for (let i = 0; i < claims.length; i++) {
            const claim = claims[i];
            const progressPercent = 50 + Math.floor((i / claims.length) * 20); // 50% to 70%
            await this.log(`[Librarian] Researching claim ${i + 1}/${claims.length}...`, { phase: "Phase 3: Research", step: `Researching Claim ${i + 1}/${claims.length}`, progress: progressPercent, details: claim.sentence.substring(0, 50) + "..." });

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
                    await this.log(`[Librarian] ✓ Found: ${research.reference.author}`, { phase: "Phase 3: Research", step: `Found Source`, progress: progressPercent, details: research.reference.title });
                    refNumber++;
                } else {
                    researchedClaims.push({ ...claim, citation: null, searchQuery: research.searchQuery });
                    await this.log(`[Librarian] ✗ No evidence found.`, { phase: "Phase 3: Research", step: `No Source Found`, progress: progressPercent });
                }

            } catch (e: any) {
                await this.log(`[Librarian] Error on claim ${i + 1}: ${e.message}`, { phase: "Phase 3: Research", step: `Error`, progress: progressPercent, details: e.message });
                researchedClaims.push({ ...claim, citation: null });
            }
        }

        return researchedClaims;
    }

    // --- Phase 4: The Editor (Smart Editor Upgrade) ---
    private async phase4_Editor(draft: AiResponse, researchedClaims: any[]): Promise<AiResponse> {
        const citedClaims = researchedClaims.filter(c => c.citation !== null);
        await this.log(`[Phase 4/5] The Editor (Smart Editor): Synthesizing ${citedClaims.length} citations and updating content...`, { phase: "Phase 4: Synthesis", step: "Starting Synthesis", progress: 70 });

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

        const enhancementsText = JSON.stringify(draft.enhancements, null, 2);
        const citationsText = JSON.stringify(citationsList, null, 2);

        const systemPrompt = `You are an Intelligent Academic Editor.

ROLE:
1. You will receive a DRAFT PAPER, a list of CITATIONS (with research evidence), and existing ENHANCEMENTS (diagrams).
2. **SYNTHESIZE**: Don't just paste citations. Update the text to incorporate the new evidence. If the evidence contradicts the draft, CORRECT the draft.
3. **UPDATE ENHANCEMENTS**: Review the diagrams/formulas. If you change section names or content, UPDATE the enhancements to match (e.g., update 'location' or 'content').
4. **PRESERVE LATEX**: The content contains LaTeX commands (\\textbf, \\begin{...}). You MUST preserve this structure.

CRITICAL INSTRUCTIONS:
- **SYNTHESIZE EVIDENCE**: Rewrite sentences to flow naturally with the new citations.
- **USE FORMAL CITATIONS**: You MUST use \\cite{ref_X} for in-text citations. DO NOT use (ref_X). Example: "As shown by Smith \\cite{ref_1}..."
- **INSERT KEYS**: Ensure every provided citation key (ref_X) is used in the text.
- **PRESERVE LATEX FORMATTING**: Do NOT strip \\textbf, \\textit, \\begin{itemize}, or \\begin{enumerate}. Only update the *text content* within them.
- **UPDATE DIAGRAMS**: If a diagram's section is renamed, update its 'location'. If the data changes, update the diagram content.
- **NO NESTED SECTIONS**: Do NOT use \\section commands inside the "content" field.
- **NO TRAILING NEWLINES**: Do NOT output excessive newlines.
- **NO COLORS**: Do NOT use \\textcolor or \\color.
- Output valid JSON matching the schema.`;

        const userPrompt = `Synthesize these citations into the draft and update enhancements.

DRAFT PAPER:
${draftText}

EXISTING ENHANCEMENTS:
${enhancementsText}

CITATIONS TO INSERT:
${citationsText}

INSTRUCTIONS:
- Rewrite the text to incorporate the evidence.
- Add \\cite{ref_X} keys.
- Update enhancements if needed (ensure 'location' matches new section names).
- **VERIFY LATEX**: Ensure all braces { } and environments \\begin...\\end are balanced.

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String (NO NUMBERS)", "content": "LaTeX String WITH citations" }],
  "references": [{ "key": "ref_1", "author": "...", "title": "...", "venue": "...", "year": YYYY }],
  "enhancements": [{ "type": "String", "title": "String", "description": "String", "content": "LaTeX", "location": "String", "reasoning": "String" }]
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
                        await this.log(`[Editor] Synthesizing... (${text.length} chars generated)`, { phase: "Phase 4: Synthesis", step: "Synthesizing Text", progress: 75, details: `${text.length} chars` });
                        lastLogTime = now;
                    }
                }
            );
            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            // Sanitize and Validate
            let parsed: AiResponse;
            if (typeof result === 'string') {
                const sanitizedResponse = sanitizeLatexOutput(result);
                parsed = extractJson(sanitizedResponse);
            } else {
                parsed = result;
            }

            // --- VALIDATION STEP (New Safeguard) ---
            await this.log(`[Editor] Validating LaTeX integrity...`, { phase: "Phase 4: Synthesis", step: "Validating LaTeX", progress: 78 });
            let validationErrors: string[] = [];

            // Validate each section
            for (const section of parsed.sections) {
                const val = validateLatexSyntax(section.content);
                if (!val.valid) {
                    validationErrors.push(`Section '${section.name}': ${val.errors.join(", ")}`);
                }
            }

            // Validate enhancements
            if (parsed.enhancements) {
                for (const enh of parsed.enhancements) {
                    const val = validateLatexSyntax(enh.content);
                    if (!val.valid) {
                        validationErrors.push(`Enhancement '${enh.title}': ${val.errors.join(", ")}`);
                    }
                }
            }

            if (validationErrors.length > 0) {
                await this.log(`[Editor] ❌ LaTeX Validation Failed:\n${validationErrors.join("\n")}`, { phase: "Phase 4: Synthesis", step: "Validation Failed", progress: 78, details: "Errors found" });
                throw new Error(`Generated LaTeX is invalid: ${validationErrors[0]}`); // Trigger pRetry
            }

            await this.log(`[Editor] ✓ LaTeX Validation Passed.`, { phase: "Phase 4: Synthesis", step: "Validation Passed", progress: 79 });

            // Ensure references match what we sent (Editor might hallucinate refs)
            if (!citedClaims || !Array.isArray(citedClaims)) {
                parsed.references = [];
            } else {
                parsed.references = citedClaims.map(c => c.citation);
            }

            await this.log(`[Editor] Editing complete.`, { phase: "Phase 4: Synthesis", step: "Complete", progress: 80 });
            return parsed;

        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Editor] Attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`, { phase: "Phase 4: Synthesis", step: "Error - Retrying", progress: 70 });
            }
        });
    }
}
