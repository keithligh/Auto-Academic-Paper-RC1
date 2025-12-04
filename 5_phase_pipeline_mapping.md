# 5-Phase Pipeline & Agent Mapping

This document confirms the alignment between the **System Architecture** and the **Current Implementation**.

## The "Human-Like" Research Pipeline (5 Steps)

As defined in `ARCHITECTURE.md` and implemented in `server/ai/service.ts`:

| Phase | Name | Role | Agent Used | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **The Thinker** | Drafting | **Writer Agent** | **Separate Enhancements:** Drafts content + `enhancements` array. NO CITATIONS. |
| **2** | **The Critic** | Verification | **Strategist Agent** | Identifies claims needing evidence. |
| **3** | **The Librarian** | Research | **Librarian Agent** | Finds verified citations. |
| **4** | **The Editor** | Synthesis | **Writer Agent** | **INSERT ONLY:** Appends `(ref_X)` keys. NO REWRITING. <br> **SANITIZATION:** Runs `sanitizeLatexOutput` (server-side) to prevent corruption. |
| **5** | **The Compiler** | Formatting | **System** | Stitches enhancements + Formats bibliography. <br> **PREVIEW:** Uses `LatexPreview.tsx` with robust sanitization (iframes for TikZ, placeholders for unsupported). |

## Addressing the "Missing Writer Step"

*   **There is no "Writer Phase":** The design deliberately names the phases based on *activity* (Thinker, Editor), not the agent name.
*   **The Writer Agent is present:** It performs the heavy lifting in **Phase 1** (Drafting) and **Phase 4** (Inserting Citations).
*   **3 Agents, 5 Steps:**
    1.  **Writer Agent** (used twice)
    2.  **Strategist Agent** (used once)
    3.  **Librarian Agent** (used once)
    *   *Total: 3 Agents across 5 Steps.*

## Conclusion

The implementation is **100% aligned** with the design document. The "Writer" is not missing; it is simply wearing the hat of "The Thinker" and "The Editor".