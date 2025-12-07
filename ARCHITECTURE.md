# Architecture & Pipeline Reference

## The 6-Phase "Research-First" Pipeline

### Phase 1: THE STRATEGIST (Analysis)

**Agent:** Strategist Agent
**Purpose:** Analyze the input text and define the research strategy.
**Behavior:** Generates targeted `Research Queries` to find evidence *before* drafting begins.
**Output:** A list of keywords and search terms.

### Phase 2: THE LIBRARIAN (Research)

**Agent:** Librarian Agent
**Purpose:** Gather verified empirical evidence.
**Behavior:** Searches online databases to find real, peer-reviewed papers for each query. Verifies existence to prevent hallucinations.
**Output:** A catalog of `References` (Author, Title, Year, URL).

### Phase 3: THE THINKER (Drafting)

**Agent:** Writer Agent
**Purpose:** Draft the paper with full awareness of available evidence.
**Behavior:** Writes the content, structuring arguments around the known evidence from Phase 2. Generates `enhancements` (diagrams, tables).
**Output:** Draft JSON (No in-text citations yet).

### Phase 4: THE PEER REVIEWER (Critique)

**Agent:** Librarian Agent (Senior PI Role)
**Purpose:** Conduct a "Nature/Science" caliber review (Verification + Novelty + Rigor).
**Behavior:** Verifies claims against evidence, audits for logical flow, and assesses novelty/significance.
**Output:** A structured `ReviewReport` (Supported, Unverified, Novelty Check, Critique).

### Phase 5: THE REWRITER (Synthesis)

**Agent:** Writer Agent
**Purpose:** Integrate evidence naturally into the prose.
**Behavior:** Rewrites sentences to weave the research findings into the narrative (e.g., "As Smith (2023) argues...").
**Output:** Improved Draft (integrated ideas, no markers yet).

### Phase 6: THE EDITOR (Citation)

**Agent:** Writer Agent
**Purpose:** Format citations for the compiler.
**Behavior:** Inserts `(ref_X)` markers into the text. These markers map to the cataloged references.
**Output:** Final Draft with citation markers.

---

## Agent Mapping (BYOK)

The system is designed around "Bring Your Own Key" (BYOK) with three distinct agent roles:

1. **Writer Agent:**
   
   * **Role:** Drafting (Phase 3), Rewriting (Phase 5), Editing (Phase 6).
   * **Recommended Models:** Claude 3.5 Sonnet, GPT-4o.
   * **Capabilities:** High reasoning, long context, excellent writing style.

2. **Strategist Agent:**
   
   * **Role:** Analysis (Phase 1).
   * **Recommended Models:** o1-preview, Claude 3.5 Sonnet.
   * **Capabilities:** Logic, planning, skepticism.

3. **Librarian Agent:**
   
   * **Role:** Research (Phase 2), Peer Review (Phase 4).
   * **Recommended Models:** Perplexity, Gemini 2.5 (via Poe).
   * **Capabilities:** **MUST** have internet access (for Research and Novelty checks).

---

## Data Flow

```mermaid
graph TD
    User[User Upload] --> P1
    subgraph "Phase 1: Analysis"
    P1[Strategist] -->|Queries| Queries
    end

    Queries --> P2
    subgraph "Phase 2: Research"
    P2[Librarian] -->|References| Refs
    end

    Refs --> P3
    User --> P3
    subgraph "Phase 3: Drafting"
    P3[Writer] -->|Draft| Draft
    end

    Draft --> P4
    subgraph "Phase 4: Critique"
    P4[Strategist] -->|Claims| Claims
    end

    Claims --> P5
    Refs --> P5
    subgraph "Phase 5: Synthesis"
    P5[Writer] -->|Rewrite| Improved
    end

    Improved --> P6
    subgraph "Phase 6: Editing"
    P6[Writer] -->|Add Markers| Final
    end

    Final --> Compiler
    subgraph "System"
    Compiler -->|LaTeX| Output
    end
```

---

## Key Principles

### 1. Research-First Architecture

We do not ask the AI to "write and cite" simultaneously. We find the evidence *first*, then ask the AI to write a paper *about* that evidence. This eliminates the primary cause of LLM hallucinations.

### 2. Deterministic Bibliography

The bibliography is constructed programmatically from the `Librarian`'s results. The LLM never writes the `\bibliography` section, ensuring perfect formatting.

### 3. The Trojan Horse Architecture (Preview)

Visualizing LaTeX in the browser is unsafe. We use a **Strict Containment Protocol**:

- **The Shield:** Strip dangerous macros.
- **The Heist:** Extract complex nodes (Math, TikZ).
- **The Injection:** Render them in isolated environments (Iframes).

### 4. Intent-Based Diagrams

TikZ diagrams are scaled dynamically based on the AI's *intent* (deduced from `node distance` and text density), ensuring both compact pipelines and large cycles render correctly.

### 5. Transparency Over Perfection

- If no evidence is found for a claim, we do not fake it.
- Activity logs show every step: "Drafting section...", "Identifying claim...", "Researching...".
- **Preview Transparency:** Unsupported LaTeX features are shown as raw code blocks, not hidden or broken.

### 6. Zero Hallucinations

- The Bibliography is constructed deterministically from the Librarian's findings.
- The Writer is strictly forbidden from inventing citations.

### 7. The Gospel Rule (Tool Safety)

- **NEVER** use `replace_file_content` or `multi_replace_file_content`.
- **ALWAYS** use `write_to_file` to rewrite the entire file content when making changes.
- **Reason:** To prevent file corruption and "hallucinated" code states.

### 8. The "Code is Law" Rule (Latex.js Containment)

- **NEVER** trust `latex.js` for anything complex.
- **Strict Containment Protocol:**
  1. **Math**: Must use KaTeX.
  2. **TikZ**: Must use Iframe Isolation.
  3. **Tables**: Must use Custom HTML Parser.
  4. **Algorithms**: Must use Custom HTML Parser.
  5. **Citations**: Must use Custom Parser.
  6. **Macros**: Dangerous macros (`\ref`, `\label`, `\url`, `\footnote`, `\eqref`) MUST be intercepted/sanitized.
  7. **List Options**: `itemize` and `enumerate` MUST have optional arguments (`[...]`) stripped.
- `latex.js` is strictly limited to being a "dumb text formatter".

### 9. Universal Citation Processor (v1.5.13)
-   **Robust Tokenizer**: Captures citation blocks `(ref_...)` and **parses** them by splitting on any separator (comma, space, semicolon).
-   **Systemic Merger**: Recursively merges adjacent citations `[1][2]` -> `[1, 2]`.
-   **Format**: Mainstream Formal Academic (IEEE/Nature).
-   **Implementation**:
  -   **Server**: Two-pass Parser logic in `latexGenerator.ts`.
  -   **Client**: Custom grouper `[${validNums.join(', ')}]` for preview.
- **Streaming:** Real-time progress updates via `onProgress` callbacks and throttled logging.
- **Resilience:**
  - **Timeouts:** 3-minute timeout for critical AI steps (Critic).
  - **Retries:** Automatic retries for failed API calls.
  - **Throttling:** Log updates are throttled to prevent CPU spikes.
- **Sanitization:**
  - **Server:** `sanitizeLatexOutput` in `server/ai/utils.ts`.
  - **Client:** `sanitizeLatexForBrowser` in `client/src/components/LatexPreview.tsx` (Trojan Horse Architecture).
  - 

*Last Updated: 2025-12-07*
*Version: 4.0 (6-Phase Research-First Pipeline)*
