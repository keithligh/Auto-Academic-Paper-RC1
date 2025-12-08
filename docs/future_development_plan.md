# Long Form Content Generation Strategy

## Problem Analysis
The current system operates on a "Monolithic Generation" model:
1.  **Phase 3 (Thinker)**: Requests the *entire* paper (Abstract + All Sections + Enhancements) in a SINGLE JSON response.
2.  **Phase 5 (Rewriter)**: Similarly rewrites the entire paper in one pass.

**Constraints:**
-   **Output Token Limit**: Standard models (e.g., GPT-4o-mini, smaller open source models) often have output limits (4k or 8k tokens). A full academic paper with LaTeX formatting often exceeds this.
-   **Context Window**: Input context is less of an issue for modern models, but outputting 10k+ tokens of consistent JSON is fragile.
-   **Failure Mode**: If generation cuts off mid-JSON, the entire job fails (`extractJson` error).


## Deep Investigation Findings & Risk Mitigation

### 1. Context Loss Mitigation: "Full Context Propagation"
The primary risk of iterative generation is "Context Drift" (later sections contracting earlier ones).
-   **Strategy**: We will utilize the large *Input* Context Window (100k+) of modern "weak" models (e.g., GPT-4o-mini, Haiku, Gemini Flash).
-   **Mechanism**:
    -   **Step 1**: Generate Outline (The Architect).
    -   **Step 2**: Iterate Sections.
    -   **Input for Section N**: `[Outline] + [Abstract] + [Full Content of Sections 1 to N-1]`.
    -   **Fallthrough**: If content exceeds token limit (e.g. >100k tokens), we employ "Smart Context": `[Outline] + [Abstract] + [Summary of Sec 1..N-2] + [Full Content of Sec N-1]`.
-   **Conclusion**: This eliminates context loss for documents up to ~75,000 words (approx 200 pages), which covers 99.9% of use cases.

### 2. Database Impact: Zero Schema Changes
-   **Discovery**: The current architecture *already* treats `advancedOptions` as ephemeral (passed to API, used in memory, not computed or stored in DB).
-   **Decision**: We will **NOT** modify the database schema.
    -   `generationMode` will be passed in `advancedOptions`.
    -   **Limitation**: If a job fails and is manually retried via API without options, it defaults to standard. This is consistent with existing behavior for `reviewDepth` etc.
    -   **Benefit**: Zero risk of DB migration errors or data corruption.

## Refined Solution: Iterative Section-Based Generation

To enable long-form content on "weaker" (lower capacity) LLMs, we must decouple structure from content.

### Architectural Changes

#### 1. Phase 3 (Thinker) Refactor
Split `Phase 3` into two sub-phases:

**Phase 3a: The Architect (Structural Planning)**
-   **Constraint**: Max 4k Output Tokens.
-   **Input**: Research notes, referencing accumulated research.
-   **Output**: JSON containing the Outline and Enhancement *Specifications* (No Code).
    ```json
    {
      "title": "...",
      "abstract": "...",
      "section_plan": [
        { 
          "id": "sec_1", 
          "name": "Introduction", 
          "intent": "Introduce core thesis...", 
          "estimated_word_count": 1000 // STRICT: Max 1500 words (~2k tokens) to ensure Mason safety
        } 
      ],
      "enhancements_plan": [
        {
          "id": "enh_1",
          "type": "diagram",
          "description": "Flowchart of...",
          "content": "" // EMPTY: To be filled by The Artist
        }
      ]
    }
    ```
-   **Strategy**: If `enhancements_plan` is too large to fit in 4k with the sections, we split it. But specs are usually short.

**Phase 3b: The Mason (Content Construction)**
-   **Loop**: Iterate through `section_plan`.
-   **Constraint**: Output < 4k tokens.
-   **Context**: Pass `Outline` + `Accumulated Draft` (Full Context).
-   **Action**: Generate LaTeX content *specifically* for the current section.
-   **Instruction**: "Write approximately [estimated_word_count] words. Do NOT exceed 2000 words."
-   **Output**: Plain LaTeX string for that section.

**Phase 3c: The Artist (Visuals & Data)**
-   **Problem**: Generating TikZ code or Tables in the Architect phase blows the 4k limit.
-   **Solution**: Iterate through `enhancements_plan`.
-   **Action**: Generate the *Content* (Code) for each enhancement individually.
-   **Context**: Section context where the enhancement belongs.
-   **Output**: LaTeX Code for the specific enhancement.

#### 2. Phase 5 (Rewriter) Refactor: "Chunked Polishing"
-   **Problem**: Monolithic rewrite fails output limits.
-   **Solution**: Iterate through sections in the Draft.
-   **Input**: `[Peer Review Report] + [Original Section Content] + [Accumulated Rewritten Context]`.
-   **Action**: Rewrite *only* the current section to integrate evidence.


## Implementation Plan

### 1. New Flag: `generationMode`
Add `generationMode: 'standard' | 'long_form'` to `advancedOptions`.
-   **Standard**: Keeps current behavior (fast, good for short papers).
-   **Long Form**: Activates the Iterative Pipeline.

### 2. Modify `server/ai/service.ts`
-   Create `phase3_Thinker_LongForm(ctx)`.
-   Create `phase3_1_Architect(ctx)` -> returns Outline + Specs.
-   Create `phase3_2_Mason(ctx, sectionInfo, prevContext)` -> returns Section Content.
-   Create `phase3_3_Artist(ctx, enhancementSpec)` -> returns Enhancement Content.
-   Update `AIService` to choose strategy based on config.

### 3. Verification
-   **Unit Test**: Mock the AI provider to return a predefined outline, then mock section generations. Verify they are stitched together correctly.
-   **Manual Test**: Run a `long_form` job with a "weak" model (or simulated small limit) and verify valid LaTeX output.

## User Review Required
-   **Latency**: Long form generation will take significantly longer (linear time with length).
-   **Token Usage**: Will increase due to repetitive context sending for each section.
