# Analysis of Content Generation Pipeline & Rewriter (Phase 5)

## 1. Current Pipeline Architecture

The pipeline currently operates in 6 phases:
1.  **Strategist**: Generating research queries.
2.  **Librarian**: Finding sources.
3.  **Thinker**: Drafting the *initial* comprehensive paper.
4.  **Peer Reviewer**: analyzing the draft and generating a report (claims to verify, issues to fix).
5.  **Rewriter**: *Surgical* integration of evidence based on the Review Report.
6.  **Editor**: Inserting citation markers.

## 2. Analysis of Phase 5 (The Rewriter)

**Current Role**: The Rewriter is currently implemented as a **Surgical Editor**, not a "Comprehensive Writer".

**Key Prompt Instructions (observed in `server/ai/service.ts`):**
*   **"Surgical Editing Only"**: The system prompt explicitly states: *"This is TARGETED editing, NOT wholesale rewriting."* and *"Strengthen SPECIFIC claims... while preserving all other content unchanged."*
*   **"Copy Exactly"**: It instructs the AI to *"Copy EXACTLY as-is from the draft"* for all non-flagged content.
*   **Explicit Prohibitions**: *"DO NOT: 'Improve' or rephrase unmarked sentences... Condense paragraphs for 'conciseness'... Restructure sections"*.

**Potential Cause of "Summarization":**
Since Phase 5 is asked to output the *entire* paper (JSON with all sections) but only *modify* specific sentences, there is a high risk of **"Lazy Copying"**.
*   Large Language Models (LLMs) often struggle when asked to copy large blocks of text verbatim without modification. They tend to summarize, truncate, or write placeholders (e.g., "[... rest of section unchanged ...]") to save tokens/effort, effectively "summarizing" the paper against instructions.

## 3. Analysis of Phase 3 (The Thinker)

**Current Role**: The Thinker is the primary **Drafting Agent**. This is where "Comprehensive Writing" is currently designed to happen.

**Key Prompt Instructions:**
*   *"Take the raw INPUT TEXT and elevate it into a rigorous, well-structured academic paper."*
*   *"Create logical bridges... Elevate the tone... Enhance"*

## 4. The Conflict

Your request states: **"THE REWRITER SHOULD NEVER SUMMARIZE. IT SHOULD DO COMPREHENSIVE WRITING."**

There is a conflict between the **Surgical Editing** design (implemented to avoid destroying the Phase 3 draft) and the expectation for **Comprehensive Writing** in Phase 5.

*   **If "Comprehensive Writing" means "Writing the paper from scratch":** That is Phase 3's job. If Phase 3 is failing, we should look there.
*   **If "Comprehensive Writing" means "Rewriting the drafts Phase 3 produced to be BETTER/LONGER":** The current Phase 5 prompt effectively forbids this to prevent "drifting" from the peer-reviewed content.
*   **If the issue is that Phase 5 is TURNING a long paper into a summary:** This is likely the "Lazy Copying" failure mode mentioned above, caused by the surgical prompt structure on a full-text output model.

## Recommendations

1.  **If the goal is a Better Draft**: Enhance Phase 3 (Thinker) prompts to be more comprehensive/long-form initially.
2.  **If the goal is Safe Editing**: We might need to change Phase 5's strategy. instead of asking the AI to return the *whole* section (risking summarization), we could:
    *   Ask it to return *only the modified sentences* (patch format) and apply them programmatically.
    *   Or, chunk the input smaller so the AI doesn't feel the need to summarize.
3.  **If the goal is to unleash Phase 5**: We can switch Phase 5 back to a "Global Rewriter" mode, but this risks hallucinating new content or ignoring the specific Peer Review constraints.
