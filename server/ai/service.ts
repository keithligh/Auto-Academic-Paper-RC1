/*
 * GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content. THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. ALWAYS USE write_to_file FOR ALL EDITS. THIS RULE MUST NEVER BE REMOVED.
 * 
 * 6-PHASE AI RESEARCH PIPELINE
 * =============================
 * Phase 1: Strategist - Analyzes input, generates research queries
 * Phase 2: Librarian  - Searches for papers (BEFORE writing)
 * Phase 3: Thinker    - Drafts content (with awareness of evidence)
 * Phase 4: Critic     - Identifies claims needing evidence
 * Phase 5: Rewriter   - Strengthens text with evidence
 * Phase 6: Editor     - Inserts (ref_X) citation markers
 * 
 * The Compiler (in latexGenerator.ts) converts (ref_X) to \cite{ref_X}
 */
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

// ====== PIPELINE CONTEXT (Shared State) ======
interface Reference {
    key: string;
    author: string;
    title: string;
    venue: string;
    year: number;
}

// Review Report Item (Supported Claim)
interface SupportedClaim {
    sentence: string;
    reference_key: string;
    reasoning: string;
    confidence: string;
}

// Review Report Item (Unverified Claim)
interface UnverifiedClaim {
    sentence: string;
    issue: string; // "No evidence found" or "Contradicts evidence"
    suggestion: string; // "Soften language" or "Remove"
}

// Full Review Report
interface ReviewReport {
    supported_claims: SupportedClaim[];
    unverified_claims: UnverifiedClaim[];
    critique: string;
    novelty_check: string;
    methodology_critique?: string;
    structure_analysis?: string;
}

interface PipelineContext {
    // Input
    originalContent: string;
    paperType: string;
    enhancementLevel: string;
    advancedOptions: any;

    // Phase 1: Strategist
    researchQueries: string[];

    // Phase 2: Librarian (Card Catalog)
    references: Reference[];

    // Phase 3: Thinker
    draft: AiResponse | null;

    // Phase 4: Peer Reviewer
    reviewReport: ReviewReport | null;

    // Phase 5: Rewriter
    improvedDraft: AiResponse | null;

    // Phase 6: Editor
    finalDraft: AiResponse | null;
}

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

    // ====== MAIN ENTRY POINT: 6-PHASE PIPELINE ======
    async generatePaper(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any = {}
    ): Promise<AiResponse> {
        await this.log(`[AI Service] Starting 6-Phase Research Pipeline...`, { phase: "Initialization", step: "Pipeline Start", progress: 5 });
        await this.log(`[Config] Writer: ${this.writer.model}, Librarian: ${this.librarian.model}, Strategist: ${this.strategist.model}`);

        // Initialize PipelineContext
        const ctx: PipelineContext = {
            originalContent: content,
            paperType,
            enhancementLevel,
            advancedOptions,
            researchQueries: [],
            references: [],
            draft: null,
            reviewReport: null,
            improvedDraft: null,
            finalDraft: null
        };

        try {
            // Phase 1: Strategist (Analyze input, generate research queries)
            await this.phase1_Strategist(ctx);

            // Phase 2: Librarian (Search for papers BEFORE writing)
            await this.phase2_Librarian(ctx);

            // Phase 3: Thinker (Draft with knowledge of evidence)
            await this.phase3_Thinker(ctx);

            // Phase 4: The Peer Reviewer (Verify claims against evidence)
            await this.phase4_PeerReviewer(ctx);

            // Phase 5: Rewriter (Strengthen text with evidence)
            await this.phase5_Rewriter(ctx);

            // Phase 6: Editor (Insert citation markers)
            await this.phase6_Editor(ctx);



            // Merge reviewReport into final response for persistence
            if (ctx.finalDraft && ctx.reviewReport) {
                (ctx.finalDraft as any).reviewReport = ctx.reviewReport;
            }

            return ctx.finalDraft!;

        } catch (error: any) {
            await this.log(`[AI Service] CRITICAL ERROR: ${error.message}`, { phase: "Error", step: "Failed", progress: 0, details: error.message });
            throw error;
        }
    }

    // ====== PHASE 1: THE STRATEGIST ======
    private async phase1_Strategist(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 1/6] The Strategist: Analyzing input and generating research queries...`, { phase: "Phase 1: Strategy", step: "Analyzing Input", progress: 8 });

        // Determine query count based on enhancement level
        const queryConfig = {
            minimal: { count: "3-4", focus: "Only the most critical claims that absolutely require evidence" },
            standard: { count: "5-7", focus: "Key claims and arguments that would benefit from scholarly support" },
            advanced: { count: "8-10", focus: "Comprehensive coverage of all claims, theories, and methodological statements" }
        };
        const config = queryConfig[ctx.enhancementLevel as keyof typeof queryConfig] || queryConfig.standard;

        // Paper type specific guidance (keys must match schema: research_paper, essay, thesis)
        const paperTypeGuidance = {
            research_paper: "Focus on empirical studies, methodological approaches, and quantitative findings.",
            essay: "Focus on arguments, philosophical foundations, and critical perspectives.",
            thesis: "Focus on foundational theories, seminal works, and comprehensive evidence."
        };
        const paperGuidance = paperTypeGuidance[ctx.paperType as keyof typeof paperTypeGuidance] || "";

        const systemPrompt = `You are an academic research strategist specializing in ${ctx.paperType} documents.

Your task is to analyze input text and generate specific, targeted research queries that will find the most relevant academic papers to support the document's arguments.

ENHANCEMENT LEVEL: ${ctx.enhancementLevel.toUpperCase()}
${config.focus}

${paperGuidance ? `PAPER TYPE GUIDANCE:\n${paperGuidance}` : ""}`;

        const userPrompt = `INPUT TEXT:
${ctx.originalContent.substring(0, 10000)}

TASK:
Analyze this text and generate ${config.count} specific research queries.

QUERY GENERATION STRATEGY:
1. Identify the core thesis and main arguments
2. Find claims that make factual or empirical assertions
3. Note any theories, frameworks, or methodologies mentioned
4. Look for comparative or evaluative statements

OUTPUT FORMAT (JSON):
{
  "queries": [
    "exact search query suitable for Google Scholar or academic databases",
    "another specific query..."
  ]
}

QUERY QUALITY GUIDELINES:
- Be specific (include key terms, concepts, author names if mentioned)
- Use academic vocabulary
- Focus on findable, citable claims
- Avoid overly broad queries

Return ONLY the JSON.`;

        return await pRetry(async () => {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Strategist timed out after 5 minutes")), 300000)
            );

            const completionPromise = this.strategist.jsonCompletion(
                userPrompt,
                systemPrompt,
                null,
                async () => { }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);
            ctx.researchQueries = result.queries || [];

            await this.log(`[Strategist] Generated ${ctx.researchQueries.length} research queries.`, { phase: "Phase 1: Strategy", step: "Complete", progress: 12, details: `${ctx.researchQueries.length} queries` });
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Strategist] Attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`, { phase: "Phase 1: Strategy", step: "Error - Retrying", progress: 8 });
            }
        });
    }

    // ====== PHASE 2: THE LIBRARIAN ======
    private async phase2_Librarian(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 2/6] The Librarian: Searching for ${ctx.researchQueries.length} papers...`, { phase: "Phase 2: Research", step: "Starting Research", progress: 15 });

        if (!this.librarian.supportsResearch) {
            await this.log(`[Librarian] Warning: Provider does not support research. Skipping.`);
            return;
        }

        let refNumber = 1;

        for (let i = 0; i < ctx.researchQueries.length; i++) {
            const query = ctx.researchQueries[i];
            const progressPercent = 15 + Math.floor((i / ctx.researchQueries.length) * 15); // 15% to 30%

            await this.log(`[Librarian] Searching query ${i + 1}/${ctx.researchQueries.length}...`, { phase: "Phase 2: Research", step: `Query ${i + 1}/${ctx.researchQueries.length}`, progress: progressPercent, details: query.substring(0, 50) + "..." });

            try {
                const prompt = `Find ONE peer-reviewed academic paper for this query:

QUERY: ${query}

TASK:
1. Search for a real, verifiable academic paper.
2. Verify the paper exists.
3. Return the reference.

OUTPUT FORMAT (JSON):
{
  "found": true,
  "reference": {
    "author": "Author names",
    "title": "Paper title",
    "venue": "Journal/Conference",
    "year": YYYY
  }
}

If NO suitable paper found, return: {"found": false}`;

                const resultStr = await this.librarian.completion(prompt, "You are a Research Librarian.", undefined, true);
                const research = extractJson(resultStr);

                if (research.found && research.reference) {
                    ctx.references.push({
                        key: `ref_${refNumber}`,
                        author: research.reference.author,
                        title: research.reference.title,
                        venue: research.reference.venue,
                        year: research.reference.year
                    });
                    await this.log(`[Librarian] ✓ Found: ${research.reference.author}`, { phase: "Phase 2: Research", step: `Found Source`, progress: progressPercent, details: research.reference.title });
                    refNumber++;
                } else {
                    await this.log(`[Librarian] ✗ No paper found for query.`, { phase: "Phase 2: Research", step: `No Source`, progress: progressPercent });
                }
            } catch (e: any) {
                await this.log(`[Librarian] Error on query ${i + 1}: ${e.message}`, { phase: "Phase 2: Research", step: `Error`, progress: progressPercent, details: e.message });
            }
        }

        await this.log(`[Librarian] Research complete: ${ctx.references.length} papers found.`, { phase: "Phase 2: Research", step: "Complete", progress: 30, details: `${ctx.references.length} references` });
    }

    // ====== PHASE 3: THE THINKER ======
    private async phase3_Thinker(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 3/6] The Thinker: Drafting paper (with ${ctx.references.length} references available)...`, { phase: "Phase 3: Drafting", step: "Starting Draft", progress: 32 });

        const enabledEnhancementTypes: string[] = [];
        if (ctx.advancedOptions.formula) enabledEnhancementTypes.push("formula", "equation");
        if (ctx.advancedOptions.hypothesis) enabledEnhancementTypes.push("hypothesis");
        if (ctx.advancedOptions.diagram) enabledEnhancementTypes.push("diagram");
        if (ctx.advancedOptions.logical_structure) enabledEnhancementTypes.push("logical_structure", "theorem", "proof");
        if (ctx.advancedOptions.symbol) enabledEnhancementTypes.push("symbol");
        enabledEnhancementTypes.push("table", "figure", "code_listing", "algorithm");

        // Show the Thinker what evidence is available
        const referenceSummary = ctx.references.length > 0
            ? `\n\nAVAILABLE EVIDENCE (from preliminary research):\n${ctx.references.map(r => `- ${r.author} (${r.year}): "${r.title}"`).join("\n")}\n\nYou may structure your arguments knowing this evidence exists, but do NOT insert citations yet.`
            : `\n\nNo evidence found in preliminary research. Write based on general knowledge.`;

        const systemPrompt = `You are a distinguished academic researcher and editor.
    
YOUR MISSION:
Take the raw INPUT TEXT and elevate it into a rigorous, well-structured academic paper.${referenceSummary}

CORE RESPONSIBILITIES:
1. **IDENTIFY SUBJECT & STRUCTURE**: Analyze the document structure, identify the main subject and key sections.
2. **ANALYZE THE SOURCE**: Read the SOURCE MATERIAL deeply. Understand its core arguments.
3. **STRUCTURE LOGICALLY**: Organize into standard academic format (Introduction, Background, Analysis, Discussion, Conclusion).
4. **ELEVATE THE TONE**: Rewrite informal language into precise, objective academic prose.
5. **ENHANCE**: Propose diagrams, tables, or formalisms that clarify complex ideas.

=== SOURCE MATERIAL START ===
${ctx.originalContent}
=== SOURCE MATERIAL END ===

TECHNICAL CONSTRAINTS (WEB PREVIEW COMPATIBILITY):
- The output will be rendered in a lightweight web-based LaTeX previewer (tikzjax in iframe).
- **PGFPLOTS IS TOO HEAVY:** The 'pgfplots' and 'axis' libraries are too complex. Use standard TikZ primitives.
- **AVOID:** Do not use \\textwidth, \\columnwidth, or \\maxwidth. Use fixed dimensions (e.g., 10cm).

CRITICAL INSTRUCTIONS:
- NO CITATIONS: Do NOT cite any sources. Do NOT use (ref_1), [1], \\cite{}, etc.
- NO BIBLIOGRAPHY: The "references" array should be empty.
- NO EQREF: Do NOT use \\eqref{}. Use (\\ref{}) manually.
- GENERATE ENHANCEMENTS: Add scholarly elements (diagrams, formulas, theorems, etc.).
- NO NESTED SECTIONS: Do NOT use \\section commands inside the "content" field.
- NO SECTION NUMBERING: Use "Introduction", NOT "1. Introduction".
- NO COLORS: Do NOT use \\textcolor or \\color.
- Output valid JSON matching the schema.`;

        const userPrompt = `Transform the SOURCE MATERIAL into a ${ctx.paperType} (${ctx.enhancementLevel} enhancements).

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String (NO NUMBERS)", "content": "LaTeX String (NO CITATIONS)" }],
  "references": [],
  "enhancements": [{ "type": "String", "title": "String", "description": "String", "content": "LaTeX", "location": "String", "reasoning": "String" }]
}

ENHANCEMENT TYPES: ${enabledEnhancementTypes.join(", ")}

SPECIAL INSTRUCTIONS FOR DIAGRAMS:
- For "diagram" type: MUST USE 'tikzpicture' environment.
- Avoid 'pgfplots'/'axis'. Use standard TikZ primitives (\\draw, \\node, etc.).
- Use fixed dimensions (cm) and explicit calculations.

Return ONLY the JSON.`;

        return await pRetry(async () => {
            let lastLogTime = 0;
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Thinker timed out after 15 minutes")), 900000)
            );

            const completionPromise = this.writer.jsonCompletion(
                userPrompt,
                systemPrompt,
                aiResponseSchema,
                async (text) => {
                    const now = Date.now();
                    if (now - lastLogTime > 5000) {
                        await this.log(`[Thinker] Drafting... (${text.length} chars generated)`, { phase: "Phase 3: Drafting", step: "Generating Text", progress: 40, details: `${text.length} chars` });
                        lastLogTime = now;
                    }
                }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            if (typeof result === 'string') {
                const sanitized = sanitizeLatexOutput(result);
                ctx.draft = extractJson(sanitized);
            } else {
                ctx.draft = result;
            }

            await this.log(`[Thinker] Draft complete: ${ctx.draft?.sections?.length || 0} sections.`, { phase: "Phase 3: Drafting", step: "Draft Complete", progress: 50, details: `${ctx.draft?.sections?.length || 0} sections` });
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Thinker] Attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`, { phase: "Phase 3: Drafting", step: "Error - Retrying", progress: 35 });
            }
        });
    }

    // ====== PHASE 4: THE PEER REVIEWER ======
    private async phase4_PeerReviewer(ctx: PipelineContext): Promise<void> {
        const reviewDepth = ctx.advancedOptions?.reviewDepth || "quick";
        await this.log(`[Phase 4/6] The Peer Reviewer: Starting ${reviewDepth.toUpperCase()} review process...`, { phase: "Phase 4: Peer Review", step: "Starting Review", progress: 52 });

        if (reviewDepth === "deep") {
            await this.phase4_DeepReview(ctx);
        } else {
            await this.phase4_QuickReview(ctx);
        }
    }

    // Original Single-Pass Review (Consolidated)
    private async phase4_QuickReview(ctx: PipelineContext): Promise<void> {
        await this.log(`[PeerReviewer] Running Quick Review (Single Pass)...`, { phase: "Phase 4: Peer Review", step: "Reviewing Draft", progress: 53 });

        if (!ctx.draft) {
            await this.log(`[PeerReviewer] Error: No draft to review.`);
            return;
        }

        const draftText = ctx.draft.sections.map(s => `### ${s.name}\n${s.content}`).join("\n\n");
        const referencesText = JSON.stringify(ctx.references, null, 2);

        const systemPrompt = `You are a Senior Principal Investigator conducting a rigorous Peer Review of a draft paper.
YOUR AUTHORITY:
You have the "Card Catalog" (our gathered evidence) and the Draft. Your word is law.

YOUR TASK:
Perform a "Nature/Science" caliber review focusing on:
1.  **Verification**: Do the references actually support the claims? (The Evidence Map).
2.  **Novelty**: Does this paper offer new insights or just repeat known facts?
3.  **Rigor**: Is the logical flow sound? Are the conclusions earned?

OUTPUT STRUCTURE:
- **supported_claims**: Claims where you can point to a specific 'ref_X' and say "This proves it."
- **unverified_claims**: Claims that sound factual but look like hallucinations or guesses.
- **novelty_check**: A brief assessment of whether the work feels derivative or significant.
- **critique**: High-level feedback on logic and flow.

CRITICAL RULE:
Do NOT hallucinate connections. If the reference doesn't mention it, it's UNVERIFIED.`;

        const userPrompt = `DRAFT PAPER:
${draftText}

AVAILABLE REFERENCES (Card Catalog):
${referencesText}

TASK:
Perform a Peer Review. Map claims to evidence.

OUTPUT FORMAT (JSON):
{
  "supported_claims": [
    { "sentence": "Exact text...", "reference_key": "ref_X", "reasoning": "Ref X explicitly states...", "confidence": "High" }
  ],
  "unverified_claims": [
    { "sentence": "Exact text...", "issue": "No matching evidence", "suggestion": "Soften to 'hypothesized' or remove" }
  ],
  "novelty_check": "The paper presents... but lacks...",
  "critique": "General assessment..."
}

Return ONLY the JSON.`;

        return await pRetry(async () => {
            const result: any = await this.librarian.jsonCompletion(userPrompt, systemPrompt);
            ctx.reviewReport = result || { supported_claims: [], unverified_claims: [], critique: "No review generated.", novelty_check: "N/A" };

            const supportedCount = ctx.reviewReport?.supported_claims?.length || 0;
            const unverifiedCount = ctx.reviewReport?.unverified_claims?.length || 0;
            const novelty = ctx.reviewReport?.novelty_check ? ctx.reviewReport.novelty_check.substring(0, 100) + "..." : "N/A";
            const critique = ctx.reviewReport?.critique ? ctx.reviewReport.critique.substring(0, 150) + "..." : "N/A";

            await this.log(`[PeerReviewer] Review complete: ${supportedCount} verified, ${unverifiedCount} unverified.`, { phase: "Phase 4: Peer Review", step: "Review Complete", progress: 58, details: `${supportedCount} verified` });
            if (ctx.reviewReport?.novelty_check) {
                await this.log(`[PeerReviewer] Novelty Check: ${novelty}`, { phase: "Phase 4: Peer Review", step: "Novelty Analysis", progress: 58 });
            }
            if (ctx.reviewReport?.critique) {
                await this.log(`[PeerReviewer] Critique: ${critique}`, { phase: "Phase 4: Peer Review", step: "Critique", progress: 58 });
            }
        }, { retries: 2 });
    }

    // New Deep Review (Multi-Phase)
    private async phase4_DeepReview(ctx: PipelineContext): Promise<void> {
        if (!ctx.draft) return;

        await this.log(`[DeepReview] Starting 6-Phase Deep Analysis...`, { phase: "Phase 4: Peer Review", step: "Deep Review Start", progress: 53 });

        // 4.1 Claim Extraction
        const claims = await this.phase4_1_ExtractClaims(ctx);

        // 4.2 Evidence Mapping
        const evidenceMap = await this.phase4_2_MapEvidence(ctx, claims);

        // 4.3 Verification Deep-Dive
        const verificationResult = await this.phase4_3_Verify(ctx, claims, evidenceMap);

        // 4.4 Methodology Critique
        const methodologyCritique = await this.phase4_4_CritiqueMethodology(ctx);

        // 4.5 Structure Analysis
        const structureAnalysis = await this.phase4_5_AnalyzeStructure(ctx);

        // 4.6 Novelty Assessment
        const noveltyCheck = await this.phase4_6_AssessNovelty(ctx);

        // Consolidate into Review Report
        ctx.reviewReport = {
            supported_claims: verificationResult.supported_claims,
            unverified_claims: verificationResult.unverified_claims,
            critique: `${structureAnalysis.substring(0, 500)}\n\nMethodology Note: ${methodologyCritique.substring(0, 300)}`,
            novelty_check: noveltyCheck,
            methodology_critique: methodologyCritique,
            structure_analysis: structureAnalysis
        };

        const supportedCount = ctx.reviewReport.supported_claims.length;
        const unverifiedCount = ctx.reviewReport.unverified_claims.length;
        const noveltyShort = noveltyCheck.substring(0, 100) + "...";

        await this.log(`[DeepReview] Complete. ${supportedCount} Verified, ${unverifiedCount} Unverified.`, { phase: "Phase 4: Peer Review", step: "Deep Review Complete", progress: 59 });
        await this.log(`[DeepReview] Novelty: ${noveltyShort}`, { phase: "Phase 4: Peer Review", step: "Novelty Analysis", progress: 59 });
    }

    private async phase4_1_ExtractClaims(ctx: PipelineContext): Promise<string[]> {
        await this.log(`[DeepReview] 4.1 Extracting Claims...`, { phase: "Phase 4: Peer Review", step: "4.1 Extracting Claims", progress: 54 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Extract all substantive factual claims, data points, and specific arguments from the text below. Ignore general intro/outro fluff. Return a JSON list of strings.`;
        const result = await this.librarian.jsonCompletion(`TEXT:\n${draftText}`, prompt);
        return result?.claims || result || [];
    }

    private async phase4_2_MapEvidence(ctx: PipelineContext, claims: string[]): Promise<any> {
        await this.log(`[DeepReview] 4.2 Mapping Evidence...`, { phase: "Phase 4: Peer Review", step: "4.2 Mapping Evidence", progress: 55 });
        const referencesText = JSON.stringify(ctx.references, null, 2);
        const claimsText = JSON.stringify(claims.slice(0, 50), null, 2); // Limit to top 50 to avoid overload if massive
        const prompt = `Map these claims to the provided references. Which reference supports which claim? Return JSON { "mappings": [{ "claim": text, "ref_key": key }] }`;
        return await this.librarian.jsonCompletion(`CLAIMS:\n${claimsText}\n\nREFS:\n${referencesText}`, prompt);
    }

    private async phase4_3_Verify(ctx: PipelineContext, claims: string[], evidenceMap: any): Promise<{ supported_claims: SupportedClaim[], unverified_claims: UnverifiedClaim[] }> {
        await this.log(`[DeepReview] 4.3 Verifying Claims...`, { phase: "Phase 4: Peer Review", step: "4.3 Verifying", progress: 56 });
        // Simplified verification logic for brevity - in real deep mode, could validte each mapping
        // Here we ask the AI to produce the final lists based on the map
        const prompt = `Based on the evidence map, generate the final list of verified vs unverified claims. Be strict. Return JSON { supported_claims: [], unverified_claims: [] } matching the schema.`;
        const input = `CLAIMS:\n${JSON.stringify(claims)}\n\nEVIDENCE_MAP:\n${JSON.stringify(evidenceMap)}`;
        const result = await this.librarian.jsonCompletion(input, prompt);
        return result || { supported_claims: [], unverified_claims: [] };
    }

    private async phase4_4_CritiqueMethodology(ctx: PipelineContext): Promise<string> {
        await this.log(`[DeepReview] 4.4 Critiquing Methodology...`, { phase: "Phase 4: Peer Review", step: "4.4 Methodology", progress: 57 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Critique the research methodology. Limitations? Validity? Sampling bias? logical fallacies? Return a concise paragraph string.`;
        const result = await this.librarian.completion(prompt, `Draft:\n${draftText}`);
        return result || "No methodology critique generated.";
    }

    private async phase4_5_AnalyzeStructure(ctx: PipelineContext): Promise<string> {
        await this.log(`[DeepReview] 4.5 Analyzing Structure...`, { phase: "Phase 4: Peer Review", step: "4.5 Structure", progress: 58 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Analyze the structure, flow, and coherence. Redundancies? Missing sections? Logical progression? Return a concise paragraph string.`;
        const result = await this.librarian.completion(prompt, `Draft:\n${draftText}`);
        return result || "No structure analysis generated.";
    }

    private async phase4_6_AssessNovelty(ctx: PipelineContext): Promise<string> {
        await this.log(`[DeepReview] 4.6 Assessing Novelty...`, { phase: "Phase 4: Peer Review", step: "4.6 Novelty", progress: 59 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Assess the novelty and contribution. Originality? derivatives? New insights? Return a concise paragraph string.`;
        const result = await this.librarian.completion(prompt, `Draft:\n${draftText}`);
        return result || "Novelty assessment unavailable.";
    }

    // ====== PHASE 5: THE REWRITER ======
    private async phase5_Rewriter(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 5/6] The Rewriter: Strengthening text with evidence...`, { phase: "Phase 5: Rewriting", step: "Starting Rewrite", progress: 60 });

        if (!ctx.draft) {
            await this.log(`[Rewriter] Error: No draft to rewrite.`);
            return;
        }

        // If no report or no verified claims, skip rewrite?
        if (!ctx.reviewReport || (ctx.reviewReport.supported_claims.length === 0 && ctx.reviewReport.unverified_claims.length === 0)) {
            await this.log(`[Rewriter] No claims to address in Peer Review. Skipping rewrite.`);
            ctx.improvedDraft = ctx.draft;
            return;
        }

        const draftText = JSON.stringify({
            title: ctx.draft.title,
            abstract: ctx.draft.abstract,
            sections: ctx.draft.sections
        }, null, 2);

        const referencesText = JSON.stringify(ctx.references, null, 2);

        // Build enhancement-level specific instructions
        const enhancementInstructions = {
            minimal: `ENHANCEMENT LEVEL: MINIMAL
- Make only essential changes to integrate evidence.
- Keep the original writing style intact.
- Add evidence as brief parenthetical notes.
- Do NOT add new formulas, theorems, or complex structures.`,
            standard: `ENHANCEMENT LEVEL: STANDARD
- Rewrite claims to naturally incorporate evidence.
- Improve clarity and academic rigor.
- Add transitional phrases that connect evidence to arguments.
- Maintain a balanced, professional tone.`,
            advanced: `ENHANCEMENT LEVEL: ADVANCED
- Significantly strengthen arguments with detailed evidence synthesis.
- Add scholarly discourse markers ("This finding aligns with...", "Building upon...").
- Create logical bridges between claims and supporting research.
- Elevate the prose to publication-quality academic writing.
- Add nuanced qualifications where appropriate.`
        };

        const enhancementGuide = enhancementInstructions[ctx.enhancementLevel as keyof typeof enhancementInstructions] || enhancementInstructions.standard;

        // Build paper type context (keys must match schema: research_paper, essay, thesis)
        const paperTypeContext = {
            research_paper: "Focus on methodology and empirical evidence.",
            thesis: "Build comprehensive arguments with thorough evidence integration.",
            essay: "Maintain a clear argumentative thread while incorporating evidence."
        };
        const paperContext = paperTypeContext[ctx.paperType as keyof typeof paperTypeContext] || "";

        const systemPrompt = `You are a distinguished academic editor specializing in evidence integration.

YOUR MISSION:
Transform a draft paper into a compelling, well-supported academic document by integrating available research evidence into the prose.

${enhancementGuide}

PAPER TYPE: ${ctx.paperType}
${paperContext}

CRITICAL RULES:
1. You are REWRITING sentences, not just adding citation markers.
2. Integrate evidence NATURALLY into the prose structure.
3. PRESERVE all LaTeX formatting (\\\\textbf, \\\\begin{itemize}, etc.).
4. Do NOT add (ref_X) or \\\\cite{} markers - that's for the next phase.
5. NO EQREF: Do NOT use \\\\eqref{}. Use (\\\\ref{}) manually.
6. Keep the academic tone consistent throughout.
7. Ensure each claim is strengthened by the most relevant reference.

EVIDENCE INTEGRATION TECHNIQUES:
- "Research by [Author] demonstrates that..."
- "According to recent studies in this field..."
- "This phenomenon is well-documented in the literature..."
- "Empirical evidence supports the notion that..."`;

        const userPrompt = `DRAFT PAPER:
${draftText}

PEER REVIEW REPORT:
${JSON.stringify(ctx.reviewReport, null, 2)}

AVAILABLE REFERENCES (from our research):
${referencesText}

TASK:
1. Address the PEER REVIEW REPORT.
2. FOR SUPPORTED CLAIMS: Rewrite sentences to naturally integrate the specific evidence identified ($$ref_X$$) and Reasoning.
3. FOR UNVERIFIED CLAIMS: Apply the "Suggestion" (e.g., soften "It is proven" to "It is hypothesized").
4. FOR CRITICAL FEEDBACK: Improve the logical flow and emphasize the "Novelty" points identified by the PI.
5. Maintain academic rigor and flow.
6. Apply ${ctx.enhancementLevel.toUpperCase()} enhancement level guidance.
7. Do NOT add citation markers ((ref_X)) yet - that is Phase 6.

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String", "content": "LaTeX String (REWRITTEN)" }],
  "references": [],
  "enhancements": [preserve existing]
}

Return ONLY the JSON.`;

        return await pRetry(async () => {
            let lastLogTime = 0;
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Rewriter timed out after 15 minutes")), 900000)
            );

            const completionPromise = this.writer.jsonCompletion(
                userPrompt,
                systemPrompt,
                aiResponseSchema,
                async (text) => {
                    const now = Date.now();
                    if (now - lastLogTime > 5000) {
                        await this.log(`[Rewriter] Rewriting... (${text.length} chars)`, { phase: "Phase 5: Rewriting", step: "Rewriting Text", progress: 68, details: `${text.length} chars` });
                        lastLogTime = now;
                    }
                }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);

            if (typeof result === 'string') {
                const sanitized = sanitizeLatexOutput(result);
                ctx.improvedDraft = extractJson(sanitized);
            } else {
                ctx.improvedDraft = result;
            }

            // Preserve enhancements from original draft
            if (ctx.improvedDraft && ctx.draft?.enhancements) {
                ctx.improvedDraft.enhancements = ctx.draft.enhancements;
            }

            await this.log(`[Rewriter] Rewrite complete.`, { phase: "Phase 5: Rewriting", step: "Complete", progress: 75 });
        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Rewriter] Attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`, { phase: "Phase 5: Rewriting", step: "Error - Retrying", progress: 60 });
            }
        });
    }

    // ====== PHASE 6: THE EDITOR (CHUNKED Refactor v1.6.15) ======
    private async phase6_Editor(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 6/6] The Editor: Inserting citation markers...`, { phase: "Phase 6: Editing", step: "Starting Editor", progress: 78 });

        if (!ctx.improvedDraft) {
            await this.log(`[Editor] Error: No improved draft to edit.`);
            ctx.finalDraft = ctx.draft;
            return;
        }

        // If no references, just pass through
        if (ctx.references.length === 0) {
            await this.log(`[Editor] No references. Skipping citation insertion.`);
            ctx.finalDraft = ctx.improvedDraft;
            return;
        }

        // Initialize finalDraft as a deep copy of improvedDraft
        // We will update it section by section
        ctx.finalDraft = JSON.parse(JSON.stringify(ctx.improvedDraft));
        if (!ctx.finalDraft) return; // Typescript safety

        const referencesText = JSON.stringify(ctx.references, null, 2);
        const globalContext = `PAPER CONTEXT:
TITLE: ${ctx.finalDraft.title}
ABSTRACT: ${ctx.finalDraft.abstract}

REFERENCES TO INSERT:
${referencesText}`;

        // Process Sections (Chunked)
        for (let i = 0; i < ctx.finalDraft.sections.length; i++) {
            const section = ctx.finalDraft.sections[i];
            await this.log(`[Editor] Processing Section ${i + 1}/${ctx.finalDraft.sections.length}: "${section.name}"...`, { phase: "Phase 6: Editing", step: `Editing Section ${i + 1}`, progress: 80 + Math.floor((i / ctx.finalDraft.sections.length) * 10) });

            let lastError: string | null = null;

            await pRetry(async () => {
                const systemPrompt = `You are a citation editor. Your ONLY task is to insert (ref_X) markers into the provided text section.
        
CRITICAL RULES:
1. Use (ref_X) format, NOT \\cite{ref_X}.
2. Match references to appropriate sentences using the provided Reference List.
3. PRESERVE all existing LaTeX formatting.
4. Do NOT rewrite the content - only ADD citation markers.
5. You are seeing ONE section of a larger paper. Use the provided Title/Abstract for context.

${lastError ? `\nPREVIOUS ATTEMPT FAILED WITH ERROR:\n${lastError}\n\nFIX THIS ERROR.` : ""}`;

                const userPrompt = `${globalContext}

CURRENT SECTION TO EDIT:
SECTION NAME: ${section.name}
CONTENT:
${section.content}

TASK:
1. Insert (ref_X) markers at the end of relevant sentences.
2. Return ONLY the updated LaTeX content for this section.
3. Do not return JSON, just the LaTeX string.`;

                const result = await this.writer.completion(userPrompt, systemPrompt);
                let newContent = sanitizeLatexOutput(result);

                // If result is wrapped in quotes or markdown block, strip them
                newContent = newContent.replace(/^```latex\n?/, '').replace(/\n?```$/, '').trim();

                // Validate LaTeX Validity of this chunk
                const val = validateLatexSyntax(newContent);
                if (!val.valid) {
                    throw new Error(`Invalid LaTeX in section '${section.name}': ${val.errors[0]}`);
                }

                // Update the section in place
                ctx.finalDraft!.sections[i].content = newContent;

            }, {
                retries: 3,
                onFailedAttempt: async (error: any) => {
                    lastError = error.message;
                    await this.log(`[Editor] Section '${section.name}' failed: ${error.message}. Retrying...`);
                }
            });
        }

        // Process Enhancements (Chunked - Text Fields Only)
        if (ctx.finalDraft.enhancements) {
            for (let i = 0; i < ctx.finalDraft.enhancements.length; i++) {
                const enh = ctx.finalDraft.enhancements[i];
                // SKIP modifying 'content' for diagrams to prevent truncation/corruption
                // Only allowed to modify title and description
                await this.log(`[Editor] Processing Enhancement ${i + 1}/${ctx.finalDraft.enhancements.length}: "${enh.title}"...`, { phase: "Phase 6: Editing", step: `Editing Enhancement ${i + 1}`, progress: 90 });

                let lastError: string | null = null;

                await pRetry(async () => {
                    const systemPrompt = `You are a citation editor. Your ONLY task is to insert (ref_X) markers into the enhancement description.
        
CRITICAL RULES:
1. Use (ref_X) format.
2. Return JSON with updated 'title' and 'description'.
3. DO NOT return the 'content' field (we will preserve the original).
${lastError ? `\nPREVIOUS ERROR: ${lastError}` : ""}`;

                    const userPrompt = `${globalContext}

ENHANCEMENT:
TITLE: ${enh.title}
DESCRIPTION: ${enh.description}

TASK:
1. Insert (ref_X) markers into Title or Description if relevant.
2. Return JSON: { "title": "...", "description": "..." }`;

                    const result = await this.writer.jsonCompletion(userPrompt, systemPrompt);

                    if (result && result.description) {
                        ctx.finalDraft!.enhancements![i].title = result.title || enh.title;
                        ctx.finalDraft!.enhancements![i].description = result.description;
                        // CONTENT IS PRESERVED AUTOMATICALLY AS WE DON'T OVERWRITE IT
                    }
                }, {
                    retries: 3,
                    onFailedAttempt: async (error: any) => {
                        lastError = error.message;
                        await this.log(`[Editor] Enhancement '${enh.title}' failed: ${error.message}. Retrying...`);
                    }
                });
            }
        }

        // Ensure references are from our Card Catalog (prevent hallucination)
        ctx.finalDraft.references = ctx.references;

        await this.log(`[Editor] Editing complete. Pipeline finished.`, { phase: "Phase 6: Editing", step: "Complete", progress: 95 });
    }
}

