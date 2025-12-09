# 6-Phase Content Generation Pipeline Report

## Executive Summary

The **Auto Academic Paper** system uses a deterministic, 6-phase "**Research-First**" pipeline to transform raw input documents into rigorous academic papers. This report documents the complete system architecture, prompts, and data flow.

**Pipeline Philosophy**: Research happens **BEFORE** writing (Phase 2), not after. This ensures the Writer Agent drafts with awareness of available evidence, preventing hallucinated citations.

---

## Architecture Overview

### Technology Stack
- **Implementation**: `server/ai/service.ts` (947 lines)
- **Pattern**: Shared `PipelineContext` object passed between phases
- **Agent Roles**: 3 distinct agents (Writer, Librarian, Strategist)
- **Architecture**: BYOK (Bring Your Own Key) - user provides API keys

### Data Flow

```
Input → Phase 1 (Strategist) → Research Queries
     → Phase 2 (Librarian) → References (Card Catalog)
     → Phase 3 (Thinker) → Draft (with awareness of evidence)
     → Phase 4 (Peer Reviewer) → Review Report
     → Phase 5 (Rewriter) → Improved Draft
     → Phase 6 (Editor) → Final Draft with (ref_X) markers
     → Compiler (latexGenerator.ts) → LaTeX document with \cite{ref_X}
```

### PipelineContext Structure
```typescript
interface PipelineContext {
    // Input
    originalContent: string;
    paperType: string;           // "research_paper" | "essay" | "thesis"
    enhancementLevel: string;    // "minimal" | "standard" | "advanced"
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
```

---

## Phase 1: The Strategist (Analysis)

### Role
Analyzes input text and generates targeted research queries to find supporting academic evidence.

### Agent
**Strategist Agent**

### Configuration
Query count scales with `enhancementLevel`:

| Enhancement Level | Query Count | Focus |
|-------------------|-------------|-------|
| **Minimal** | 3-4 | Only the most critical claims that absolutely require evidence |
| **Standard** | 5-7 | Key claims and arguments that would benefit from scholarly support |
| **Advanced** | 8-10 | Comprehensive coverage of all claims, theories, and methodological statements |

### Paper Type Guidance

| Paper Type | Guidance |
|------------|----------|
| **research_paper** | Focus on empirical studies, methodological approaches, and quantitative findings. |
| **essay** | Focus on arguments, philosophical foundations, and critical perspectives. |
| **thesis** | Focus on foundational theories, seminal works, and comprehensive evidence. |

### System Prompt (Lines 251-258)
```
You are an academic research strategist specializing in {paperType} documents.

Your task is to analyze input text and generate specific, targeted research queries that will find the most relevant academic papers to support the document's arguments.

ENHANCEMENT LEVEL: {ENHANCEMENTLEVEL}
{focus based on enhancement level}

{paper type guidance if applicable}
```

### User Prompt (Lines 260-286)
```
INPUT TEXT:
{first 10,000 chars of originalContent}

TASK:
Analyze this text and generate {config.count} specific research queries.

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

Return ONLY the JSON.
```

### Timeout & Retry
- **Timeout**: 5 minutes (300,000ms)
- **Retries**: 2 attempts with p-retry

---

## Phase 2: The Librarian (Research)

### Role
Searches for real, peer-reviewed academic papers **BEFORE** any writing occurs.

### Agent
**Librarian Agent** (must support `supportsResearch` capability)

### Logic (Lines 313-374)
1. Iterates through each research query sequentially
2. For each query, sends a search prompt
3. Verifies the paper exists and is peer-reviewed
4. Adds valid papers to the `references` array (Card Catalog)
5. Assigns sequential keys: `ref_1`, `ref_2`, etc.

### Prompt (Lines 330-350)
```
Find ONE peer-reviewed academic paper for this query:

QUERY: {query}

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

If NO suitable paper found, return: {"found": false}
```

### System Prompt
```
You are a Research Librarian.
```

### Key Design Decision: Research-First Architecture
By researching **BEFORE** drafting, we avoid the "hallucinated citation" problem. The Writer Agent (Phase 3) is given the list of real papers and told: "Here is the evidence that exists. Write your paper based on this."

---

## Phase 3: The Thinker (Drafting)

### Role
Drafts the academic paper with **awareness** of available evidence, but does **NOT** insert citations yet.

### Agent
**Writer Agent**

### Enhancement Types Configuration (Lines 381-386)
```typescript
const enabledEnhancementTypes: string[] = [];
if (ctx.advancedOptions.formula) enabledEnhancementTypes.push("formula", "equation");
if (ctx.advancedOptions.hypothesis) enabledEnhancementTypes.push("hypothesis");
if (ctx.advancedOptions.diagram) enabledEnhancementTypes.push("diagram");
if (ctx.advancedOptions.logical_structure) enabledEnhancementTypes.push("logical_structure", "theorem", "proof");
if (ctx.advancedOptions.symbol) enabledEnhancementTypes.push("symbol");
enabledEnhancementTypes.push("table", "figure", "code_listing", "algorithm");
```

### Reference Summary (Lines 389-391)
If references were found in Phase 2:
```
AVAILABLE EVIDENCE (from preliminary research):
- {author} ({year}): "{title}"
...

You may structure your arguments knowing this evidence exists, but do NOT insert citations yet.
```

If no references found:
```
No evidence found in preliminary research. Write based on general knowledge.
```

### System Prompt (Lines 393-423)
```
You are a distinguished academic researcher and editor.

YOUR MISSION:
Take the raw INPUT TEXT and elevate it into a rigorous, well-structured academic paper.{referenceSummary}

CORE RESPONSIBILITIES:
1. **IDENTIFY SUBJECT & STRUCTURE**: Analyze the document structure, identify the main subject and key sections.
2. **ANALYZE THE SOURCE**: Read the SOURCE MATERIAL deeply. Understand its core arguments.
3. **STRUCTURE LOGICALLY**: Organize into standard academic format (Introduction, Background, Analysis, Discussion, Conclusion).
4. **ELEVATE THE TONE**: Rewrite informal language into precise, objective academic prose.
5. **ENHANCE**: Propose diagrams, tables, or formalisms that clarify complex ideas.

=== SOURCE MATERIAL START ===
{ctx.originalContent}
=== SOURCE MATERIAL END ===

TECHNICAL CONSTRAINTS (WEB PREVIEW COMPATIBILITY):
- The output will be rendered in a lightweight web-based LaTeX previewer (tikzjax in iframe).
- **PGFPLOTS IS TOO HEAVY:** The 'pgfplots' and 'axis' libraries are too complex. Use standard TikZ primitives.
- **AVOID:** Do not use \textwidth, \columnwidth, or \maxwidth. Use fixed dimensions (e.g., 10cm).

CRITICAL INSTRUCTIONS:
- NO CITATIONS: Do NOT cite any sources. Do NOT use (ref_1), [1], \cite{}, etc.
- NO BIBLIOGRAPHY: The "references" array should be empty.
- NO EQREF: Do NOT use \eqref{}. Use (\ref{}) manually.
- GENERATE ENHANCEMENTS: Add scholarly elements (diagrams, formulas, theorems, etc.).
- NO NESTED SECTIONS: Do NOT use \section commands inside the "content" field.
- NO SECTION NUMBERING: Use "Introduction", NOT "1. Introduction".
- ABSTRACT LENGTH: The abstract MUST be exactly 150-200 words. No shorter, no longer.
- NO COLORS: Do NOT use \textcolor or \color.
- Output valid JSON matching the schema.
```

### User Prompt (Lines 425-443)
```
Transform the SOURCE MATERIAL into a {paperType} ({enhancementLevel} enhancements).

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String (MUST be 150-200 words)",
  "sections": [{ "name": "String (NO NUMBERS)", "content": "LaTeX String (NO CITATIONS)" }],
  "references": [],
  "enhancements": [{ "type": "String", "title": "String", "description": "String", "content": "LaTeX", "location": "String", "reasoning": "String" }]
}

ENHANCEMENT TYPES: {enabledEnhancementTypes}

SPECIAL INSTRUCTIONS FOR DIAGRAMS:
- For "diagram" type: MUST USE 'tikzpicture' environment.
- Avoid 'pgfplots'/'axis'. Use standard TikZ primitives (\draw, \node, etc.).
- Use fixed dimensions (cm) and explicit calculations.

Return ONLY the JSON.
```

### Timeout & Retry
- **Timeout**: 15 minutes (900,000ms)
- **Retries**: 2 attempts
- **Progress Logging**: Every 5 seconds during generation

---

## Phase 4: The Peer Reviewer (Verification)

### Role
Acts as a **Senior Principal Investigator** conducting a rigorous peer review. Verifies evidence and evaluates Novelty, Rigor, and Significance.

### Agent
**Librarian Agent** (Role: Senior PI)

### Modes
The Peer Reviewer operates in **two distinct modes** (configurable via `advancedOptions.reviewDepth`):

#### Mode A: Quick Review (Single-Pass)

**Logic**: Fast, consolidated review suitable for rapid iteration.

**System Prompt (Lines 506-523)**:
```
You are a Senior Principal Investigator conducting a rigorous Peer Review of a draft paper.
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
Do NOT hallucinate connections. If the reference doesn't mention it, it's UNVERIFIED.
```

**User Prompt (Lines 525-546)**:
```
DRAFT PAPER:
{draftText}

AVAILABLE REFERENCES (Card Catalog):
{referencesText}

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

Return ONLY the JSON.
```

#### Mode B: Deep Review (Multi-Pass - Version 1.6.13)

**Logic**: Rigorous, 6-sub-phase "Nature/Science" caliber review. Each sub-phase uses a dedicated AI call for maximum context usage and reasoning depth.

| Sub-Phase | Function | Purpose | Lines |
|-----------|----------|---------|-------|
| **4.1** | `phase4_1_ExtractClaims` | Identifies every substantive factual claim in the draft | 609-615 |
| **4.2** | `phase4_2_MapEvidence` | Maps extracted claims to specific references in the Card Catalog | 617-623 |
| **4.3** | `phase4_3_Verify` | Rigorously judges whether the mapped evidence actually supports the claim | 625-633 |
| **4.4** | `phase4_4_CritiqueMethodology` | Evaluates study design, sampling bias, validity, and limitations | 635-641 |
| **4.5** | `phase4_5_AnalyzeStructure` | Assesses logical flow, coherence, redundancies, and missing sections | 643-649 |
| **4.6** | `phase4_6_AssessNovelty` | Determines originality, derivative nature, and contribution to the field | 651-657 |

**4.1 Extract Claims Prompt (Line 612)**:
```
Extract all substantive factual claims, data points, and specific arguments from the text below. Ignore general intro/outro fluff. Return a JSON list of strings.
```

**4.2 Map Evidence Prompt (Line 621)**:
```
Map these claims to the provided references. Which reference supports which claim? Return JSON { "mappings": [{ "claim": text, "ref_key": key }] }
```

**4.3 Verify Prompt (Line 629)**:
```
Based on the evidence map, generate the final list of verified vs unverified claims. Be strict. Return JSON { supported_claims: [], unverified_claims: [] } matching the schema.
```

**4.4 Methodology Critique Prompt (Line 638)**:
```
Critique the research methodology. Limitations? Validity? Sampling bias? logical fallacies? Return a concise paragraph string.
```

**4.5 Structure Analysis Prompt (Line 646)**:
```
Analyze the structure, flow, and coherence. Redundancies? Missing sections? Logical progression? Return a concise paragraph string.
```

**4.6 Novelty Assessment Prompt (Line 654)**:
```
Assess the novelty and contribution. Originality? derivatives? New insights? Return a concise paragraph string.
```

**Consolidation (Lines 592-599)**:
All sub-phase results are consolidated into a single `ReviewReport`:
```typescript
ctx.reviewReport = {
    supported_claims: verificationResult.supported_claims,
    unverified_claims: verificationResult.unverified_claims,
    critique: `${structureAnalysis.substring(0, 500)}\n\nMethodology Note: ${methodologyCritique.substring(0, 300)}`,
    novelty_check: noveltyCheck,
    methodology_critique: methodologyCritique,
    structure_analysis: structureAnalysis
};
```

**Key Benefit**: By splitting the review, the AI is not forced to "cram" all reasoning into one context window. It can focus strictly on one aspect at a time.

---

## Phase 5: The Rewriter (Synthesis)

### Role
**Deterministically** rewrites the draft based on the Peer Review Report to strengthen arguments with evidence.

### Agent
**Writer Agent**

### Enhancement Level Instructions (Lines 684-701)

| Level | Instructions |
|-------|--------------|
| **Minimal** | Make only essential changes to integrate evidence. Keep the original writing style intact. Add evidence as brief parenthetical notes. Do NOT add new formulas, theorems, or complex structures. |
| **Standard** | Rewrite claims to naturally incorporate evidence. Improve clarity and academic rigor. Add transitional phrases that connect evidence to arguments. Maintain a balanced, professional tone. |
| **Advanced** | Significantly strengthen arguments with detailed evidence synthesis. Add scholarly discourse markers ("This finding aligns with...", "Building upon..."). Create logical bridges between claims and supporting research. Elevate the prose to publication-quality academic writing. Add nuanced qualifications where appropriate. |

### Paper Type Context (Lines 706-711)

| Paper Type | Context |
|------------|---------|
| **research_paper** | Focus on methodology and empirical evidence. |
| **thesis** | Build comprehensive arguments with thorough evidence integration. |
| **essay** | Maintain a clear argumentative thread while incorporating evidence. |

### System Prompt (Lines 713-736)
```
You are a distinguished academic editor specializing in evidence integration.

YOUR MISSION:
Transform a draft paper into a compelling, well-supported academic document by integrating available research evidence into the prose.

{enhancementGuide based on enhancement level}

PAPER TYPE: {paperType}
{paperContext}

CRITICAL RULES:
1. You are REWRITING sentences, not just adding citation markers.
2. Integrate evidence NATURALLY into the prose structure.
3. PRESERVE all LaTeX formatting (\\textbf, \\begin{itemize}, etc.).
4. Do NOT add (ref_X) or \\cite{} markers - that's for the next phase.
5. NO EQREF: Do NOT use \\eqref{}. Use (\\ref{}) manually.
6. Keep the academic tone consistent throughout.
7. Ensure each claim is strengthened by the most relevant reference.

EVIDENCE INTEGRATION TECHNIQUES:
- "Research by [Author] demonstrates that..."
- "According to recent studies in this field..."
- "This phenomenon is well-documented in the literature..."
- "Empirical evidence supports the notion that..."
```

### User Prompt (Lines 738-765)
```
DRAFT PAPER:
{draftText}

PEER REVIEW REPORT:
{JSON.stringify(ctx.reviewReport)}

AVAILABLE REFERENCES (from our research):
{referencesText}

TASK:
1. Address the PEER REVIEW REPORT.
2. FOR SUPPORTED CLAIMS: Rewrite sentences to naturally integrate the specific evidence identified ($$ref_X$$) and Reasoning.
3. FOR UNVERIFIED CLAIMS: Apply the "Suggestion" (e.g., soften "It is proven" to "It is hypothesized").
4. FOR CRITICAL FEEDBACK: Improve the logical flow and emphasize the "Novelty" points identified by the PI.
5. Maintain academic rigor and flow.
6. Apply {enhancementLevel} enhancement level guidance.
7. Do NOT add citation markers ((ref_X)) yet - that is Phase 6.

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String (MUST be 150-200 words)",
  "sections": [{ "name": "String", "content": "LaTeX String (REWRITTEN)" }],
  "references": [],
  "enhancements": [preserve existing]
}

Return ONLY the JSON.
```

### Timeout & Retry
- **Timeout**: 15 minutes (900,000ms)
- **Retries**: 2 attempts
- **Progress Logging**: Every 5 seconds during generation
- **Enhancement Preservation**: Automatically preserves enhancements from original draft (Lines 796-798)

---

## Phase 6: The Editor (Citation)

### Role
Inserts `(ref_X)` citation markers at appropriate locations. The **ONLY** task is to add citations—no content changes.

### Agent
**Writer Agent**

### Architecture: Chunked Processing (Version 1.6.15)

**Problem**: Sending the entire paper to the AI at once can result in:
- Context window overflow
- Truncated outputs
- LaTeX corruption

**Solution**: Process **sections and enhancements individually** in a loop (Lines 839-892 for sections, 895-938 for enhancements).

### Section Processing (Lines 839-892)

For each section:

**System Prompt (Lines 847-856)**:
```
You are a citation editor. Your ONLY task is to insert (ref_X) markers into the provided text section.

CRITICAL RULES:
1. Use (ref_X) format, NOT \cite{ref_X}.
2. Match references to appropriate sentences using the provided Reference List.
3. PRESERVE all existing LaTeX formatting.
4. Do NOT rewrite the content - only ADD citation markers.
5. You are seeing ONE section of a larger paper. Use the provided Title/Abstract for context.

{if previous attempt failed: error message and "FIX THIS ERROR"}
```

**User Prompt (Lines 858-868)**:
```
PAPER CONTEXT:
TITLE: {title}
ABSTRACT: {abstract}

REFERENCES TO INSERT:
{referencesText}

CURRENT SECTION TO EDIT:
SECTION NAME: {section.name}
CONTENT:
{section.content}

TASK:
1. Insert (ref_X) markers at the end of relevant sentences.
2. Return ONLY the updated LaTeX content for this section.
3. Do not return JSON, just the LaTeX string.
```

**Validation (Lines 877-880)**:
- Each section's output is validated for LaTeX syntax
- If invalid, the retry mechanism kicks in with the error message injected into the prompt

**Retry**: 3 attempts with error feedback

### Enhancement Processing (Lines 895-938)

For each enhancement:

**System Prompt (Lines 905-911)**:
```
You are a citation editor. Your ONLY task is to insert (ref_X) markers into the enhancement description.

CRITICAL RULES:
1. Use (ref_X) format.
2. Return JSON with updated 'title' and 'description'.
3. DO NOT return the 'content' field (we will preserve the original).
{if previous error: error message}
```

**User Prompt (Lines 913-921)**:
```
PAPER CONTEXT:
TITLE: {title}
ABSTRACT: {abstract}

REFERENCES TO INSERT:
{referencesText}

ENHANCEMENT:
TITLE: {enh.title}
DESCRIPTION: {enh.description}

TASK:
1. Insert (ref_X) markers into Title or Description if relevant.
2. Return JSON: { "title": "...", "description": "..." }
```

**Critical Design Decision (Lines 898-899, 928)**:
- **SKIP** modifying the `content` field for diagrams to prevent truncation/corruption
- Only `title` and `description` are editable
- The `content` field (TikZ diagrams, etc.) is **PRESERVED** automatically

**Retry**: 3 attempts with error feedback

### Final Step (Line 941)
```typescript
ctx.finalDraft.references = ctx.references;
```
Ensures the references array is from the Card Catalog (prevents hallucination).

---

## The Compiler (Post-Processing)

### Location
`server/latexGenerator.ts` (Lines 51-110)

### Role
Deterministic conversion of `(ref_X)` markers to `\cite{ref_X}` and bibliography generation.

### The Compiler Function: `compileCitations` (Lines 53-110)

**Step 1: Build Valid Keys Set (Lines 55-56)**
```typescript
const validKeys = new Set(references.map(r => r.key));
```

**Step 2: Replace (ref_X) with \cite{ref_X} (Lines 61-78)**

**Strategy**: "Parse, don't Regex" - Two-Pass Universal Processor

**Pass 1: Tokenization (Lines 61-78)**
```typescript
let compiled = text.replace(/\(\s*(ref_[\s\S]*?)\)/g, (match, content) => {
    // Split by comma, semicolon, or whitespace
    const tokens = content.split(/[,\s;]+/);

    // Find valid keys in tokens
    const valid = tokens.filter((t: string) => {
        const cleanT = t.trim().replace(/[^a-zA-Z0-9_]/g, ''); // Strip punctuation
        return validKeys.has(cleanT);
    });

    if (valid.length > 0) {
        return `\\cite{${valid.join(',')}}`;
    } else {
        return match; // Keep original text if no valid keys
    }
});
```

**Example Transformations**:
- `(ref_1)` → `\cite{ref_1}`
- `(ref_1, ref_2)` → `\cite{ref_1,ref_2}`
- `(ref_1; ref_2)` → `\cite{ref_1,ref_2}`
- `(invalid_ref)` → `(invalid_ref)` (preserved as-is)

**Step 3: Citation Merging (Lines 83-91)**

Combines adjacent `\cite{}` commands iteratively:
```typescript
\cite{ref_1} \cite{ref_2} → \cite{ref_1,ref_2}
```

Loop runs until no more merges are possible (max 10 iterations for safety).

**Step 4: Citation Repair - Hallucination Detection (Lines 94-108)**

Scans for any `\cite{}` commands and verifies all keys exist in the valid set:
```typescript
compiled = compiled.replace(/\\cite\{([^}]+)\}/g, (match, key) => {
    const keys = key.split(',');
    const allValid = keys.every((k: string) => validKeys.has(k.trim()));

    if (allValid) {
        return match;
    } else {
        console.warn(`[Compiler] Hallucinated citation detected: ${match}`);
        return `[?]`;
    }
});
```

If ANY key in a `\cite{}` command is not in the Card Catalog, replace with `[?]`.

### Bibliography Generation (Lines 269-280)

Deterministically generated from the `references` list:
```latex
\begin{thebibliography}{99}
\bibitem{ref_1} Author. \textit{Title}. Venue, Year.
\bibitem{ref_2} ...
\end{thebibliography}
```

---

## Configuration Summary

### Enhancement Levels

| Level | Description | Query Count | Rewrite Style |
|-------|-------------|-------------|---------------|
| **minimal** | Light touch, essential evidence only | 3-4 | Brief parenthetical notes |
| **standard** | Balanced rigor and clarity | 5-7 | Natural evidence integration |
| **advanced** | Publication-quality depth | 8-10 | Comprehensive scholarly synthesis |

### Paper Types

| Type | Strategist Focus | Rewriter Context |
|------|------------------|------------------|
| **research_paper** | Empirical studies, methodological approaches, quantitative findings | Methodology and empirical evidence |
| **essay** | Arguments, philosophical foundations, critical perspectives | Clear argumentative thread with evidence |
| **thesis** | Foundational theories, seminal works, comprehensive evidence | Comprehensive arguments with thorough integration |

### Review Modes

| Mode | Description | Sub-Phases | Use Case |
|------|-------------|------------|----------|
| **quick** | Single-pass consolidated review | 1 | Rapid iteration |
| **deep** | Multi-pass rigorous review (v1.6.13) | 6 | Nature/Science caliber quality |

### Advanced Options

| Option | Effect | Phase |
|--------|--------|-------|
| `formula` | Enables formula/equation enhancements | Phase 3 |
| `hypothesis` | Enables hypothesis enhancements | Phase 3 |
| `diagram` | Enables diagram enhancements | Phase 3 |
| `logical_structure` | Enables logical_structure/theorem/proof enhancements | Phase 3 |
| `symbol` | Enables symbol definition enhancements | Phase 3 |
| `reviewDepth` | "quick" or "deep" | Phase 4 |

---

## Technical Details

### Retry & Error Handling

| Phase | Timeout | Retries | Library |
|-------|---------|---------|---------|
| Phase 1 | 5 min | 2 | p-retry |
| Phase 2 | N/A | Per-query error logging | try/catch |
| Phase 3 | 15 min | 2 | p-retry |
| Phase 4 (Quick) | Default | 2 | p-retry |
| Phase 4 (Deep) | Default per sub-phase | 0 | try/catch |
| Phase 5 | 15 min | 2 | p-retry |
| Phase 6 (Sections) | Default | 3 per section | p-retry |
| Phase 6 (Enhancements) | Default | 3 per enhancement | p-retry |

### Progress Reporting

Each phase reports progress via the `logger` callback with `JobProgress` objects:
```typescript
await this.log(message, {
    phase: "Phase X: Name",
    step: "Current Step",
    progress: 0-100,
    details: "Additional info"
});
```

### Schema Validation

- **Phase 3 Output**: Validated against `aiResponseSchema`
- **Phase 6 Sections**: Validated with `validateLatexSyntax()`
- **JSON Parsing**: Uses `extractJson()` utility for robust parsing

---

## Citation Format Evolution

### Phase 3: No Citations
```
"Machine learning has revolutionized natural language processing."
```

### Phase 5: Prose Integration
```
"Research by Smith demonstrates that machine learning has revolutionized natural language processing."
```

### Phase 6: Marker Insertion
```
"Research by Smith demonstrates that machine learning has revolutionized natural language processing (ref_1)."
```

### Compiler: LaTeX Conversion
```
"Research by Smith demonstrates that machine learning has revolutionized natural language processing \cite{ref_1}."
```

---

## Key Design Decisions

### 1. Research-First Architecture
**Rationale**: Prevents hallucinated citations. The Writer knows what evidence exists before drafting.

### 2. Separation of Concerns
**Rationale**:
- Phase 3: Creative writing flow (no citation distraction)
- Phase 5: Evidence integration (prose rewriting)
- Phase 6: Technical referencing (marker insertion)

### 3. (ref_X) Intermediate Format
**Rationale**:
- Plain text, can't break LaTeX
- Easy to parse and validate
- Deterministic conversion to `\cite{ref_X}`

### 4. Chunked Processing in Phase 6
**Rationale**:
- Prevents context overflow
- Enables LaTeX validation per chunk
- Preserves diagram content integrity

### 5. The Card Catalog Pattern
**Rationale**:
- Single source of truth for references (Phase 2 output)
- Prevents hallucination (Line 941: `ctx.finalDraft.references = ctx.references`)
- Enables strict verification in Phase 4

### 6. Two Review Modes
**Rationale**:
- Quick: For rapid iteration and prototyping
- Deep: For publication-quality rigor

---

## File References

| File | Purpose | Lines of Code |
|------|---------|---------------|
| `server/ai/service.ts` | 6-Phase Pipeline Implementation | 947 |
| `server/latexGenerator.ts` | The Compiler (Citation conversion + Bibliography) | 300 |
| `6_phase_pipeline_mapping.md` | Architecture alignment documentation | 55 |
| `CONTENT_GENERATION_PIPELINE.md` | High-level pipeline documentation | 180 |

---

## Conclusion

The 6-Phase Content Generation Pipeline is a deterministic, research-first system that transforms raw text into rigorous academic papers by:

1. **Strategizing**: Identifying what evidence is needed
2. **Researching**: Finding real papers BEFORE writing
3. **Drafting**: Writing with awareness of available evidence
4. **Reviewing**: Verifying claims against the Card Catalog
5. **Rewriting**: Strengthening prose with evidence integration
6. **Editing**: Adding citation markers
7. **Compiling**: Deterministic LaTeX generation

This architecture ensures **zero hallucinated citations**, **verifiable evidence**, and **publication-quality output**.

---

**Report Version**: 1.0
**Generated**: 2025-12-09
**System Version**: 1.6.15 (Chunked Editor)
