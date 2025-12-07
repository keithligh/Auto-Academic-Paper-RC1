# Content Generation Pipeline Documentation

## 1. Overview

The **Auto Academic Paper** system employs a deterministic, 6-phase "**Research-First**" pipeline to transform raw input documents into rigorous academic papers. This pipeline is orchestrated by `server/ai/service.ts` and uses a "Bring Your Own Key" (BYOK) architecture with three distinct agent roles: **Strategist**, **Librarian**, and **Writer**.

## 2. Architecture & Data Flow

The pipeline operates sequentially, passing a shared `PipelineContext` object between phases.

```mermaid
graph TD
    Input["Raw Text / Upload"] --> Phase1
    
    subgraph "Phase 1: The Strategist (Analysis)"
        Phase1["Strategist Agent"] -->|Research Queries| Queries
        Note1["Logic: Analyzes input, identifies key claims needing evidence."]
    end
    
    Queries --> Phase2
    
    subgraph "Phase 2: The Librarian (Research)"
        Phase2["Librarian Agent"] -->|Verified Citations| References
        Note2["Logic: Searches online BEFORE writing to prevent hallucinations."]
    end
    
    References --> Phase3
    Input --> Phase3
    
    subgraph "Phase 3: The Thinker (Drafting)"
        Phase3["Writer Agent"] -->|Draft JSON| Draft
        Note3["Logic: Drafts with awareness of evidence, but NO in-text citations yet."]
    end
    
    Draft --> Phase4
    
    subgraph "Phase 4: The Peer Reviewer (Verification)"
        Phase4["Librarian Agent"] -->|Review Report| Report
        Note4["Logic: Verifies draft, checks Novelty, Rigor, and Significance."]
    end
    
    Report --> Phase5
    References --> Phase5
    
    subgraph "Phase 5: The Rewriter (Synthesis)"
        Phase5["Writer Agent"] -->|Improved Draft| ImprovedDraft
        Note5["Logic: Rewrites text to naturally integrate research findings."]
    end
    
    ImprovedDraft --> Phase6
    
    subgraph "Phase 6: The Editor (Formatting)"
        Phase6["Writer Agent"] -->|Final JSON| FinalDraft
        Note6["Logic: Inserts (ref_X) markers. No content changes."]
    end
    
    FinalDraft --> Output["LaTeX Compiler"]
```

---

## 3. Detailed Phase Logic & Prompts

### Phase 1: The Strategist (Analysis)
**Agent:** Strategist
**Input:** Raw content.
**Output:** List of `Research Queries`.
**Logic:**
1.  **Analysis:** Analyzes the input text to identify the core thesis and maintain arguments.
2.  **Strategy:** Generates targeted search queries to find supporting academic evidence *before* a single word is drafted.
3.  **Config:** Query count scales with `enhancementLevel` (3-4 for minimal, 8-10 for advanced).

#### System Prompt
```text
You are an academic research strategist specializing in {paperType} documents.
Your task is to analyze input text and generate specific, targeted research queries...
```

### Phase 2: The Librarian (Research)
**Agent:** Librarian
**Input:** Research Queries.
**Output:** List of `References` (Author, Title, Year, Venue).
**Logic:**
1.  **Iterative Search:** Executes each query individually.
2.  **Verification:** Verifies the paper exists and is peer-reviewed.
3.  **Cataloging:** Adds valid papers to the `PipelineContext.references` array.

#### Key Decision: Research-First
By researching *before* drafting, we avoid the "hallucinated citation" problem. The Writer Agent (Phase 3) is given the list of real papers and told "Here is the evidence that exists. Write your paper based on this."

### Phase 3: The Thinker (Drafting)
**Agent:** Writer
**Input:** Raw content + **Available References** (from Phase 2).
**Output:** `AiResponse` (Sections, Enhancements).
**Logic:**
1.  **Contextual Drafting:** The agent is shown the list of found papers (`AVAILABLE EVIDENCE`) and instructed to structure arguments knowing this evidence exists.
2.  **Constraint:** It must **NOT** insert citations yet. This separates the "creative flow" from the "technical referencing".
3.  **Enhancements:** Generates diagrams/tables in a separate array.

#### System Prompt
```text
YOUR MISSION: Take the raw INPUT TEXT and elevate it into a rigorous academic paper.

AVAILABLE EVIDENCE:
- Author (Year): "Title"
...

You may structure your arguments knowing this evidence exists, but do NOT insert citations yet.
```

### Phase 4: The Peer Reviewer (Verification)
**Agent:** Librarian (Role: Senior PI)
**Input:** Draft + **Available References** (The Card Catalog).
**Output:** `Review Report` (Supported Claims, Unverified Claims, **Novelty Check**, **Critique**).
**Logic:**
1.  **Verification:** Reads the draft *alongside* the library.
2.  **Mapping:** Identifies claims explicitly supported by specific papers (`supported_claims`).
3.  **Auditing:** Flags claims that sound factual but lack evidence (`unverified_claims`).
4.  **Novelty & Rigor:** Evaluates the significance of the contribution and the logical soundness of the arguments (`novelty_check`, `critique`).
5.  **No Hallucinations:** Prevents the system from asking for citations that don't exist.

### Phase 5: The Rewriter (Synthesis)
**Agent:** Writer
**Input:** Draft + Claims + References.
**Output:** `Improved Draft`.
**Logic:**
1.  **Deterministic Synthesis:** Rewrites the text based on the `Review Report`.
2.  **Verified Integration:** "The Peer Reviewer confirmed Ref_X supports this claim -> Integrate Ref_X."
3.  **Correction:** "The Peer Reviewer flagged this as Unverified -> Soften the language."
4.  **Preservation:** Preserves all LaTeX structure and diagrams.

#### System Prompt
```text
TRANSFORM:
"It is known that X is true."
INTO:
"As shown by [Author] in [Title], X is true."

Do NOT add citation markers ((ref_X)) yet. Just integrate the ideas.
```

### Phase 6: The Editor (Citation)
**Agent:** Writer
**Input:** Improved Draft + References.
**Output:** Final `AiResponse` with `(ref_X)` markers.
**Logic:**
1.  **Insertion:** The ONLY task is to insert `(ref_X)` markers at valid locations.
2.  **Compiler Logic:** The System later converts `(ref_X)` to `\cite{ref_X}` using a **Two-Pass Universal Processor** (Tokenize + Merge).

---

## 4. The Compiler & Trojan Horse
**Agent:** System (No AI)
**Logic:**
1.  **Bibliography:** Deterministically generated from the `references` list.
2.  **Sanitization:** The `LatexPreview.tsx` component uses the **Strict Containment Protocol**:
    *   **The Shield:** Strips dangerous macros.
    *   **The Heist:** Extracts TikZ and Math.
    *   **The Injection:** Renders them safely in isolation (Iframe for TikZ, KaTeX for Math).
