# 6-Phase Pipeline & Agent Mapping

This document confirms the alignment between the **System Architecture** and the **Current Implementation**.

## The "Human-Like" Research Pipeline (6 Steps)

As defined in `ARCHITECTURE.md` and implemented in `server/ai/service.ts`:

| Phase | Name | Role | Agent Used | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **The Strategist** | Analysis | **Strategist Agent** | Analyzes input, generates research queries. |
| **2** | **The Librarian** | Research | **Librarian Agent** | Searches for papers **BEFORE** writing (prevents hallucinations). |
| **3** | **The Thinker** | Drafting | **Writer Agent** | Drafts content + `enhancements`. **KNOWS EVIDENCE EXISTS** but NO CITATIONS yet. |
| **4** | **The Critic** | Verification | **Strategist Agent** | Identifies claims needing stronger evidence. |
| **5** | **The Rewriter** | Synthesis | **Writer Agent** | **REWRITES** text to integrate evidence naturally. |
| **6** | **The Editor** | Citation | **Writer Agent** | Inserts `(ref_X)` markers. The **Compiler** converts these to `\cite{ref_X}`. |

## Key Design Decisions

### Research-First Architecture
Research happens **BEFORE** writing (Phase 2), not after. This ensures:
- The Thinker writes with awareness of available evidence
- Arguments are structured around provable claims
- No "force-fitting" citations into existing text

### Citation Format
- **Editor outputs**: `(ref_X)` - Plain text, can't break LaTeX
- **Compiler converts**: `(ref_X)` → `\cite{ref_X}` - 100% deterministic

### PipelineContext Pattern
All phases share a `PipelineContext` object that accumulates data:
```typescript
interface PipelineContext {
  researchQueries: string[];  // Phase 1 output
  references: Reference[];     // Phase 2 output (Card Catalog)
  draft: AiResponse;           // Phase 3 output
  claims: Claim[];             // Phase 4 output
  improvedDraft: AiResponse;   // Phase 5 output
  finalDraft: AiResponse;      // Phase 6 output
}
```

## Agent Summary

| Agent | Used In Phases |
|-------|---------------|
| **Writer Agent** | 3 (Thinker), 5 (Rewriter), 6 (Editor) |
| **Strategist Agent** | 1 (Strategist), 4 (Critic) |
| **Librarian Agent** | 2 (Librarian) |
| **System (Compiler)** | Post-processing in `latexGenerator.ts` |

## Conclusion

The implementation is **100% aligned** with the "Research-First" design philosophy. Research happens before writing, the Rewriter strengthens text, and the Compiler handles citation formatting deterministically.
