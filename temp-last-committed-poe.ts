/*
 * GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file.
 */
// Poe AI integration for AutoAcademicFormatter
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import OpenAI from "openai";
import { documentAnalysisSchema, aiResponseSchema, draftDocumentSchema, aiEnhancementSchema, type DocumentAnalysis, type Enhancement, type AiResponse, type DraftDocument, type AiEnhancement } from "@shared/schema";

// Helper to detect rate‑limit or quota errors
function isRateLimitError(error: any): boolean {
  const msg = error?.message || String(error);
  return (
    msg.includes("429") ||
    msg.includes("RATELIMIT_EXCEEDED") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit")
  );
}

/**
 * Fix JSON escaping issues from AI responses.
 */
function fixAIJsonEscaping(jsonString: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    if (char === '"' && !escape) {
      inString = !inString;
      result += char;
      escape = false;
      continue;
    }
    if (inString) {
      if (char === '\\' && !escape) {
        const nextChar = i < jsonString.length - 1 ? jsonString[i + 1] : '';
        if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
          escape = true;
          result += char;
        } else {
          result += '\\\\';
          escape = false;
        }
        continue;
      }
    }
    result += char;
    escape = false;
  }
  return result;
}

/**
 * Step 1: The Strategist (Gemini-2.5-Pro)
 * Analyzes input to identify key research opportunities.
 */
async function identifyResearchTopics(content: string, apiKey: string, logger?: (msg: string) => Promise<void>): Promise<string[]> {
  const searchBot = process.env.POE_SEARCH_BOT || "Gemini-2.5-Pro";
  const log = logger || console.log;

  await log(`[Strategist] Analyzing text to identify research opportunities...`);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.poe.com/v1",
  });

  const prompt = `You are a Research Strategist.
  
  INPUT TEXT:
  ${content.substring(0, 5000)}... (truncated for analysis)

  TASK:
  1. Analyze the text to identify 3-5 key academic claims or concepts that need empirical support.
  2. Generate specific, search-friendly queries to find this support.
  3. Focus on finding recent studies (2020-2024) if possible.

  OUTPUT FORMAT:
  Return ONLY a JSON array of strings. Example:
  ["impact of transformer models on translation accuracy 2023", "hallucination rates in large language models survey"]
  `;

  const completion = await client.chat.completions.create({
    model: searchBot,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const result = completion.choices[0]?.message?.content || "[]";
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const queries = JSON.parse(jsonMatch[0]);
      if (Array.isArray(queries)) {
        await log(`[Strategist] Identified ${queries.length} research queries: ${queries.join(", ")}`);
        return queries;
      }
    }
  } catch (e) {
    await log(`[Strategist] Failed to parse queries. Defaulting to generic search.`);
  }

  return [];
}

/**
 * Step 2: The Librarian (Gemini-2.5-Pro)
 * Searches online for real citations using targeted queries.
 */
async function performResearch(queries: string[], apiKey: string, logger?: (msg: string) => Promise<void>): Promise<string> {
  const searchBot = process.env.POE_SEARCH_BOT || "Gemini-2.5-Pro";
  const log = logger || console.log;

  if (queries.length === 0) {
    await log(`[Librarian] No specific queries provided. Skipping research.`);
    return "{}";
  }

  await log(`[Librarian] Starting online search for ${queries.length} queries...`);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.poe.com/v1",
  });

  // We combine queries into a single prompt for the Librarian to execute
  // In a more advanced version, we could run parallel calls, but for now we ask the Librarian to handle the list.
  const prompt = `You are a Research Librarian.
    
    RESEARCH TASKS:
    ${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

    INSTRUCTIONS:
    1. SEARCH ONLINE for high-quality academic references for these specific topics.
    2. VERIFY that these papers actually exist.
    3. OUTPUT FORMAT: Return a JSON array of references.
    
    REQUIRED JSON FORMAT:
    {
        "references": [
            { "key": "authorYear", "author": "Names", "title": "Title", "venue": "Journal", "year": 2024, "url": "link if available" }
        ]
    }
    `;

  await log(`[Research] Sending query to ${searchBot}...`);
  const completion = await client.chat.completions.create({
    model: searchBot,
    messages: [{
      role: "user",
      content: prompt,
      // Poe API specific: Enable web search
      parameters: { web_search: true }
    } as any],
    temperature: 0.1,
  });

  const rawResult = completion.choices[0]?.message?.content || "{}";
  await log(`[Research] Completed. Response size: ${rawResult.length} chars.`);

  let finalResult = '{"references": []}';

  try {
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.references && Array.isArray(parsed.references)) {
        await log(`[Research] Found ${parsed.references.length} citations.`);

        // Assign unique IDs to each reference (The Librarian's Card Catalog)
        parsed.references = parsed.references.map((ref: any, index: number) => ({
          ...ref,
          key: `ref_${index + 1}` // Deterministic KEY: ref_1, ref_2, etc. (matches Writer schema)
        }));

        finalResult = JSON.stringify(parsed);
      } else {
        await log(`[Research] Warning: Invalid JSON structure (missing 'references' array). Defaulting to empty.`);
      }
    } else {
      await log(`[Research] Warning: No JSON found in response. Defaulting to empty.`);
    }
  } catch (e) {
    await log(`[Research] Error parsing JSON: ${e}. Defaulting to empty.`);
  }

  return finalResult;
}

/**
 * Sanitize input text to remove existing bibliographies.
 * This prevents the AI from hallucinating them as content.
 */
function sanitizeInputText(text: string): string {
  // Regex to match a "References" header (various formats)
  const headerRegex = /(\\((sub)?section\*?|textbf|large|Large|LARGE)\s*\{(References|Bibliography|Works Cited)\}|^\s*(References|Bibliography|Works Cited)\s*$)/m;

  // Regex to match the START of a reference list item: [number]
  const refItemStartRegex = /^\s*\[\d+\]/m;

  const lines = text.split('\n');
  let cutOffIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for Header
    if (headerRegex.test(line)) {
      // Look ahead for references
      let foundRef = false;
      for (let j = 1; j <= 5 && i + j < lines.length; j++) {
        if (refItemStartRegex.test(lines[i + j])) {
          foundRef = true;
          break;
        }
      }
      if (foundRef) {
        console.log(`[Input Sanitization] Detected Bibliography Header at line ${i}: "${line}". Truncating input...`);
        cutOffIndex = i;
        break;
      }
    }

    // Check for implicit list start
    if (refItemStartRegex.test(line)) {
      // Simple heuristic: if it starts with [1], assume it's the start of a list
      if (/^\[1\]/.test(line)) {
        console.log(`[Input Sanitization] Detected start of reference list at line ${i}: "${line}". Truncating input...`);
        cutOffIndex = i;
        break;
      }
    }
  }

  if (cutOffIndex !== -1) {
    return lines.slice(0, cutOffIndex).join('\n').trim();
  }
  return text;
}

// ===== 5-PHASE HUMAN-LIKE RESEARCH PIPELINE =====

/**
 * PHASE 1: THE THINKER (Claude Opus 4.5)
 * Drafts a complete academic paper WITH enhancements but WITHOUT citations.
 */
export async function draftPaper(
  rawContent: string,
  paperType: string,
  enhancementLevel: string,
  advancedOptions: any,
  logger?: (msg: string) => Promise<void>
): Promise<AiResponse> {
  const content = sanitizeInputText(rawContent);
  if (content.length !== rawContent.length) {
    console.log(`[Input Sanitization] Input truncated from ${rawContent.length} to ${content.length} chars.`);
  }

  return await pRetry(
    async () => {
      const apiKey = process.env.POE_API_KEY;
      if (!apiKey) throw new Error("POE_API_KEY is not configured");
      const log = logger || console.log;

      const writerBot = process.env.POE_WRITER_BOT || "Claude-Opus-4.5";
      await log(`🖋️  [Phase 1/1] Drafting paper WITHOUT citations (${writerBot})...`);

      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.poe.com/v1",
      });

      // Build enhancement type list based on advanced options
      const enabledEnhancementTypes: string[] = [];
      if (advancedOptions.formula) enabledEnhancementTypes.push("formula", "equation");
      if (advancedOptions.hypothesis) enabledEnhancementTypes.push("hypothesis");
      if (advancedOptions.diagram) enabledEnhancementTypes.push("diagram");
      if (advancedOptions.logical_structure) enabledEnhancementTypes.push("logical_structure", "theorem", "proof");
      if (advancedOptions.symbol) enabledEnhancementTypes.push("symbol");
      // Always allow table, figure, code_listing, algorithm
      enabledEnhancementTypes.push("table", "figure", "code_listing", "algorithm");

      const systemPrompt = `You are a distinguished academic researcher.

ROLE:
1. You are THE THINKER. You will draft a complete academic paper WITH scholarly enhancements.
2. CRITICAL: Do NOT add citations yet. You will write the content first, and citations will be added later.
3. Transform the INPUT TEXT into a well-structured academic paper.

CRITICAL INSTRUCTIONS:
- NO CITATIONS: Do NOT cite any sources. Do NOT use (ref_1), [1], [2], etc.
- NO BIBLIOGRAPHY: Do NOT include a References section. The "references" array should be empty.
- GENERATE ENHANCEMENTS: Add scholarly elements (diagrams, formulas, theorems, etc.) as appropriate.
- ENHANCEMENT LEVEL: ${enhancementLevel} - adjust density accordingly.
- FOCUS ON IDEAS: Write clear, well-argued content expressing academic ideas.
- REMOVE INPUT BIBLIOGRAPHY: If the INPUT TEXT contains a bibliography, REMOVE IT completely.
- NO NESTED SECTIONS: Do NOT use \\\\section commands inside the "content" field.
- Output valid JSON matching the schema.
`;

      const userPrompt = `Transform this text into a ${paperType} (${enhancementLevel} enhancements).

INPUT TEXT:
${content}

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String", "content": "LaTeX String (NO CITATIONS)" }],
  "references": [],
  "enhancements": [{ "type": "String", "title": "String", "description": "String", "content": "LaTeX", "location": "String", "reasoning": "String" }]
}

ENHANCEMENT TYPES (use these only):
${enabledEnhancementTypes.join(", ")}

SPECIAL INSTRUCTIONS FOR DIAGRAMS:
- For "diagram" type: MUST USE 'tikzpicture' environment for vector graphics
- Example: \\begin{tikzpicture} ... \\end{tikzpicture}
`;

      await log(`[Thinker] Sending request to ${writerBot}...`);

      const completion = await client.chat.completions.create({
        model: writerBot,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      });

      const fullContent = completion.choices[0]?.message?.content || "";
      if (!fullContent) throw new Error("AI returned empty response");

      await log(`[Thinker] Received response. Processing JSON...`);

      // Clean and extract JSON
      let clean = fullContent.trim();
      clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/g, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];
      clean = fixAIJsonEscaping(clean);

      const parsed = JSON.parse(clean);
      await log(`[Thinker] Draft complete: ${parsed.sections?.length || 0} sections, ${parsed.enhancements?.length || 0} enhancements.`);

      // Validate and return
      return aiResponseSchema.parse(parsed);
    },
    { retries: 2, minTimeout: 2000 }
  );
}

// ===== END PHASE 1 =====

/**
 * PHASE 2: THE CRITIC (GPT-5.1)
 * Identifies specific claims in the draft that need supporting evidence.
 */
export async function identifyClaims(
  draft: AiResponse,
  enhancementLevel: string,
  logger?: (msg: string) => Promise<void>
): Promise<any[]> {
  return await pRetry(
    async () => {
      const apiKey = process.env.POE_API_KEY;
      if (!apiKey) throw new Error("POE_API_KEY is not configured");
      const log = logger || console.log;

      const criticBot = process.env.POE_CRITIC_BOT || "GPT-5.1";
      await log(`🔍 [Phase 2/5] Identifying claims needing evidence (${criticBot})...`);

      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.poe.com/v1",
      });

      // Determine target claim count based on enhancement level
      let targetClaims = "5-7 key claims";
      if (enhancementLevel === "minimal") targetClaims = "2-3 critical claims";
      if (enhancementLevel === "advanced") targetClaims = "8-12 important claims";

      const draftText = draft.sections.map(s => `### ${s.name}\n${s.content}`).join("\n\n");

      const prompt = `You are an academic reviewer identifying claims that need citations.

DRAFT PAPER:
${draftText}

TASK:
Identify ${targetClaims} that would benefit from supporting citations. Look for:
- Factual claims ("X performs better than Y")
- Empirical statements ("Studies show...")
- Technical claims ("Algorithm Z has O(n²) complexity")
- Established theories ("According to Smith's framework...")

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

      const completion = await client.chat.completions.create({
        model: criticBot,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const result = completion.choices[0]?.message?.content || "[]";

      // Extract JSON
      let clean = result.trim();
      clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/g, "");
      const jsonMatch = clean.match(/\[[\s\S]*\]/);
      if (jsonMatch) clean = jsonMatch[0];

      const claims = JSON.parse(clean);
      await log(`[Critic] Identified ${claims.length} claims requiring citations`);

      return claims;
    },
    { retries: 2, minTimeout: 2000 }
  );
}

// ===== END PHASE 2 =====

/**
 * PHASE 3: THE LIBRARIAN (Gemini 2.5 Pro)
 * Finds supporting evidence for each specific claim via targeted research.
 */
export async function researchClaims(
  claims: any[],
  logger?: (msg: string) => Promise<void>
): Promise<any[]> {
  const apiKey = process.env.POE_API_KEY;
  if (!apiKey) throw new Error("POE_API_KEY is not configured");
  const log = logger || console.log;

  const searchBot = process.env.POE_SEARCH_BOT || "Gemini-2.5-Pro";
  await log(`📚 [Phase 3/5] Researching evidence for ${claims.length} claims (${searchBot})...`);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.poe.com/v1",
  });

  const researchedClaims: any[] = [];
  let refNumber = 1;

  // Process each claim individually for targeted research
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    await log(`[Librarian] Claim ${i + 1}/${claims.length}: "${claim.sentence.substring(0, 60)}..."`);

    try {
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

Return ONLY valid JSON.`;

      const completion = await client.chat.completions.create({
        model: searchBot,
        messages: [{
          role: "user",
          content: prompt,
          parameters: { web_search: true }
        } as any],
        temperature: 0.1,
      });

      const result = completion.choices[0]?.message?.content || "{}";

      // Extract JSON
      let clean = result.trim();
      clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/g, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];

      const research = JSON.parse(clean);

      if (research.found && research.reference) {
        const citation = {
          key: `ref_${refNumber}`,
          author: research.reference.author,
          title: research.reference.title,
          venue: research.reference.venue,
          year: research.reference.year
        };

        researchedClaims.push({
          ...claim,
          citation,
          searchQuery: research.searchQuery
        });

        await log(`[Librarian] ✓ Found: ${research.reference.author} (${research.reference.year})`);
        refNumber++;
      } else {
        // No evidence found - leave citation as null
        researchedClaims.push({
          ...claim,
          citation: null,
          searchQuery: research.searchQuery || "unknown"
        });
        await log(`[Librarian] ✗ No evidence found for this claim`);
      }
    } catch (e: any) {
      console.error(`[Librarian] Error researching claim ${i + 1}:`, e);
      await log(`[Librarian] ✗ Search failed: ${e.message}`);

      // Mark as null citation on error
      researchedClaims.push({
        ...claim,
        citation: null,
        searchQuery: "search failed"
      });
    }
  }

  const foundCount = researchedClaims.filter(c => c.citation !== null).length;
  await log(`[Librarian] Research complete: ${foundCount}/${claims.length} claims have supporting citations`);

  return researchedClaims;
}

// ===== END PHASE 3 =====

/**
 * PHASE 4: THE EDITOR (Claude Opus 4.5)
 * Inserts citations at exact claim locations in the draft.
 */
export async function insertCitations(
  draft: AiResponse,
  researchedClaims: any[],
  logger?: (msg: string) => Promise<void>
): Promise<AiResponse> {
  return await pRetry(
    async () => {
      const apiKey = process.env.POE_API_KEY;
      if (!apiKey) throw new Error("POE_API_KEY is not configured");
      const log = logger || console.log;

      const writerBot = process.env.POE_WRITER_BOT || "Claude-Opus-4.5";
      const citedClaims = researchedClaims.filter(c => c.citation !== null);
      const uncitedClaims = researchedClaims.filter(c => c.citation === null);

      await log(`✏️  [Phase 4/5] Inserting ${citedClaims.length} citations (${writerBot})...`);
      if (uncitedClaims.length > 0) {
        await log(`[Editor] ${uncitedClaims.length} claims have no citation (will be left as-is)`);
      }

      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.poe.com/v1",
      });

      // Build citations list
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
- NO NESTED SECTIONS: Do NOT use \\\\section commands inside the "content" field
- Output valid JSON matching the schema`;

      const userPrompt = `Insert citations into this draft.

DRAFT PAPER:
${draftText}

CITATIONS TO INSERT:
${citationsText}

INSTRUCTIONS:
- Find each sentence in its section
- Add the citation key at the end: "sentence text (ref_X)."
- Leave uncited sentences unchanged

OUTPUT SCHEMA:
{
  "title": "String",
  "abstract": "String",
  "sections": [{ "name": "String", "content": "LaTeX String WITH citations" }],
  "references": [{ "key": "ref_1", "author": "...", "title": "...", "venue": "...", "year": YYYY }],
  "enhancements": [] // Will be preserved from draft
}

Return ONLY the JSON.`;

      const completion = await client.chat.completions.create({
        model: writerBot,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      });

      const fullContent = completion.choices[0]?.message?.content || "";
      if (!fullContent) throw new Error("AI returned empty response");

      await log(`[Editor] Received response. Processing JSON...`);

      // Clean and extract JSON
      let clean = fullContent.trim();
      clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/g, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];
      clean = fixAIJsonEscaping(clean);

      const parsed = JSON.parse(clean);

      // Build references array from researched claims
      const references = citedClaims.map(c => c.citation);
      parsed.references = references;

      // PRESERVE ENHANCEMENTS from original draft
      parsed.enhancements = draft.enhancements;

      await log(`[Editor] Citations inserted. ${references.length} references in bibliography.`);

      return aiResponseSchema.parse(parsed);
    },
    { retries: 2, minTimeout: 2000 }
  );
}

// ===== END PHASE 4 =====

/**
 * Step 2: Writing Phase (Claude-Opus-4.5)
 * Synthesizes the paper using the research data.
 */
export async function analyzeDocument(
  rawContent: string,
  paperType: string,
  enhancementLevel: string,
  logger?: (msg: string) => Promise<void>
): Promise<AiResponse> {
  // Sanitize input immediately
  const content = sanitizeInputText(rawContent);
  if (content.length !== rawContent.length) {
    console.log(`[Input Sanitization] Input truncated from ${rawContent.length} to ${content.length} chars.`);
  }

  return await pRetry(
    async () => {
      const apiKey = process.env.POE_API_KEY;
      if (!apiKey) throw new Error("POE_API_KEY is not configured");
      const log = logger || console.log;

      // 1. Step 1: The Strategist (Identify Topics)
      let researchQueries: string[] = [];
      try {
        researchQueries = await identifyResearchTopics(content, apiKey, logger);
      } catch (e: any) {
        console.error("[Strategist] Failed:", e);
        await log(`[Strategist] Warning: Failed to identify topics (${e.message}).`);
      }

      // 2. Step 2: The Librarian (Perform Research)
      let researchData = "{}";
      try {
        if (researchQueries.length > 0) {
          researchData = await performResearch(researchQueries, apiKey, logger);
        } else {
          await log(`[Librarian] Skipping research (no queries identified).`);
        }
      } catch (e: any) {
        console.error("[Librarian] Failed:", e);
        await log(`[Librarian] Warning: Online search failed (${e.message}).`);
      }

      // 3. Step 3: The Writer (Claude)
      const writerBot = process.env.POE_WRITER_BOT || "Claude-Opus-4.5";
      await log(`[Pipeline] Phase 3: Academic Writing & Synthesis (${writerBot})`);
      await log(`[Writing] Constructing prompt with ${enhancementLevel} enhancement level...`);

      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.poe.com/v1",
      });

      // Parse research data to determine mode
      let hasReferences = false;
      try {
        const parsedResearch = JSON.parse(researchData);
        if (parsedResearch.references && parsedResearch.references.length > 0) {
          hasReferences = true;
        }
      } catch (e) {
        // Default to false
      }

      let systemPrompt = "";
      let draftModeNote = "";

      if (hasReferences) {
        await log(`[Writing] Mode: STRICT CITATION (References available)`);
        systemPrompt = `You are a distinguished academic researcher.
          
          ROLE:
          1. You are the WRITER. You will receive INPUT TEXT and RESEARCH DATA.
          2. Use the RESEARCH DATA to cite real sources.
          3. Transform the INPUT TEXT into a rigorous academic paper.
          
          RESEARCH DATA (Use these citations):
          ${researchData}

          CRITICAL INSTRUCTIONS:
          - CLOSED LIST: You are provided a CLOSED LIST of references. You must cite ONLY from this list.
          - KEY-BASED CITATION: You MUST use the exact KEY from the provided RESEARCH DATA list (e.g., "(ref_1)", "(ref_2)").
            - The research data has a 'key' field for each reference. Use that EXACT key.
            - DO NOT USE NUMBERS: You are strictly FORBIDDEN from using "[1]", "[2]", etc.
            - DO NOT FORMAT: Just output the key exactly as is: "(ref_1)". The system will format it later.
          - CITATION STYLE: Do NOT use citation numbers as nouns or subjects. ALWAYS use the author name or a generic noun before the citation number. Citations should generally be parenthetical.
          - NO IN-TEXT BIBLIOGRAPHY: Do NOT include a "References" section or bibliography list in the content of any section. All references must be strictly in the "references" JSON array.
          - NO REFERENCE LISTS IN CONTENT: Do NOT append a list of references at the end of any section content. This is strictly forbidden.
          - REMOVE INPUT BIBLIOGRAPHY: If the INPUT TEXT contains a bibliography or reference list, REMOVE IT completely. Do not reproduce it in the output sections.
          - NO NESTED SECTIONS: Do NOT use \\section commands inside the "content" field. The JSON structure defines the sections.
          - Output valid JSON matching the schema.
          `;
      } else {
        await log(`[Writing] Mode: DRAFT (No references found). Citations DISABLED.`);
        draftModeNote = " (Note: This draft was generated without external references as online search yielded no results.)";
        systemPrompt = `You are a distinguished academic researcher.
          
          ROLE:
          1. You are the WRITER. You will receive INPUT TEXT.
          2. RESEARCH DATA IS EMPTY. Therefore, you must NOT cite any sources.
          3. Transform the INPUT TEXT into a rigorous academic paper.
          
          CRITICAL INSTRUCTIONS:
          - NO CITATIONS: Do NOT cite any sources. Do NOT invent citations. Do NOT use [1], [2], etc.
          - NO BIBLIOGRAPHY: Do NOT include a References section. Return an empty "references" array.
          - REMOVE INPUT BIBLIOGRAPHY: If the INPUT TEXT contains a bibliography or reference list, REMOVE IT completely.
          - NO NESTED SECTIONS: Do NOT use \\section commands inside the "content" field.
          - Output valid JSON matching the schema.
          `;
      }

      const userPrompt = `Transform this text into a ${paperType} (${enhancementLevel} enhancements).
      
      INPUT TEXT:
      ${content}
      
      OUTPUT SCHEMA:
      {
        "title": "String",
        "abstract": "String",
        "sections": [{ "name": "String", "content": "LaTeX String" }],
        "references": [{ "key": "String", "author": "String", "title": "String", "venue": "String", "year": Number }],
        "enhancements": [{ "type": "String", "title": "String", "description": "String", "content": "LaTeX", "location": "String", "reasoning": "String" }]
      }
      
      ENHANCEMENT TYPES:
      formula, hypothesis, diagram (MUST USE 'tikzpicture' environment), logical_structure, symbol, table, figure, equation, theorem, proof, code_listing, algorithm
      `;

      await log(`[Writing] Sending request to ${writerBot}... (Streaming enabled)`);

      const stream = await client.chat.completions.create({
        model: writerBot,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        stream: true, // Enable streaming
      });

      let fullContent = "";
      let lastLogTime = Date.now();
      let chunkCount = 0;

      // Track detected sections to avoid duplicate logs
      const detectedSections = new Set<string>();

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullContent += content;
        chunkCount++;

        // Real-time Progress Logging
        // Check for key markers in the *recent* content (last 500 chars)
        const recent = fullContent.slice(-500);

        // Detect Section Drafting
        const sectionMatch = recent.match(/"name":\s*"([^"]+)"/);
        if (sectionMatch && !detectedSections.has(sectionMatch[1])) {
          const secName = sectionMatch[1];
          // Ignore if it looks like a partial match or too short
          if (secName.length > 3) {
            await log(`[Writing] Drafting section: ${secName}...`);
            detectedSections.add(secName);
            lastLogTime = Date.now();
          }
        }

        // Detect Abstract
        if (recent.includes('"abstract":') && !detectedSections.has('abstract')) {
          await log(`[Writing] Synthesizing abstract...`);
          detectedSections.add('abstract');
          lastLogTime = Date.now();
        }

        // Detect References
        if (recent.includes('"references":') && !detectedSections.has('references')) {
          await log(`[Writing] Compiling bibliography...`);
          detectedSections.add('references');
          lastLogTime = Date.now();
        }

        // Heartbeat log every 10 seconds if no other activity
        if (Date.now() - lastLogTime > 10000) {
          const wordCount = fullContent.split(/\s+/).length;
          await log(`[Writing] Generated ${wordCount} words so far...`);
          lastLogTime = Date.now();
        }
      }

      if (!fullContent) throw new Error("AI returned empty response");

      await log(`[Writing] Received full response. Processing JSON...`);

      // Clean possible markdown fences and extract JSON
      let clean = fullContent.trim();
      clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/g, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];
      clean = fixAIJsonEscaping(clean);

      const parsed = JSON.parse(clean);
      await log(`[Writing] Successfully parsed JSON structure.`);

      // Structural Sanitization: Remove In-Text Bibliographies
      if (parsed.sections && Array.isArray(parsed.sections)) {
        parsed.sections = parsed.sections.filter((section: any) => {
          const name = section.name.toLowerCase();
          return !name.includes("references") && !name.includes("bibliography") && !name.includes("works cited");
        });

        parsed.sections.forEach((section: any) => {
          section.content = section.content.replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g, "");
          section.content = section.content.replace(/(\\section\*?\{References\}|\\textbf\{References\}|References)\s*(\n\s*\[\d+\][\s\S]*)+$/i, "");
          section.content = section.content.replace(/\n\s*\[1\][\s\S]*$/g, "");
        });
        await log(`[Writing] Structural Sanitization complete (Sections cleaned).`);
      }

      // === THE COMPILER (Reference Manager) ===
      // Replaces (ref_X) keys with [1], [2] based on appearance order.
      if (parsed.references && Array.isArray(parsed.references) && parsed.references.length > 0) {
        await log(`[Compiler] Compiling bibliography...`);
        const { compiledSections, finalBibliography } = compileBibliography(parsed.sections, parsed.references);
        parsed.sections = compiledSections;

        // Append the compiled bibliography as a new section
        parsed.sections.push({
          name: "References",
          content: finalBibliography
        });

        // Clear the raw references array as we've now baked them into the document
        parsed.references = [];
        await log(`[Compiler] Bibliography compiled with ${finalBibliography.split('\\bibitem').length - 1} items.`);
      }

      return aiResponseSchema.parse(parsed);
    },
    { retries: 2, minTimeout: 2000 }
  );
}

/**
 * The Compiler: Resolves citation keys to numbers.
 */
function compileBibliography(sections: any[], rawReferences: any[]): { compiledSections: any[], finalBibliography: string } {
  const citationMap = new Map<string, number>(); // ref_id -> new_number
  let nextNumber = 1;
  const usedReferences: any[] = [];

  // 1. Scan and Replace Keys
  const compiledSections = sections.map(section => {
    let content = section.content;

    // Regex to find (ref_X)
    // We use a replace callback to assign numbers on the fly
    content = content.replace(/\(ref_(\d+)\)/g, (match: string, id: string) => {
      const fullId = `ref_${id}`;

      if (!citationMap.has(fullId)) {
        // First time seeing this reference
        const refData = rawReferences.find(r => r.key === fullId);
        if (refData) {
          citationMap.set(fullId, nextNumber);
          usedReferences.push({ ...refData, number: nextNumber });
          nextNumber++;
        } else {
          return "[?]"; // Reference not found in database
        }
      }

      return `\\cite{${fullId}}`; // Use standard LaTeX \cite, we will generate bibitems with matching keys
    });

    return { ...section, content };
  });

  // 2. Generate Bibliography
  // We generate a standard LaTeX bibliography environment
  // \bibitem{ref_X} ...
  let bibContent = "\\begin{thebibliography}{99}\n";
  usedReferences.forEach(ref => {
    bibContent += `\\bibitem{${ref.key}} ${ref.author}. \\textit{${ref.title}}. ${ref.venue}, ${ref.year}.\n`;
  });
  bibContent += "\\end{thebibliography}";

  return { compiledSections, finalBibliography: bibContent };
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (m) => `\\${m}`)
    .replace(/[%$#&_]/g, (m) => `\\${m}`)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function formatEnhancement(enh: Enhancement): string {
  if (!enh.title || !enh.description || !enh.content) {
    throw new Error(`Enhancement is missing required fields: title=${!!enh.title}, description=${!!enh.description}, content=${!!enh.content}`);
  }
  const title = escapeLatex(enh.title);
  const desc = escapeLatex(enh.description);
  const content = enh.content;

  if (enh.type === "symbol") {
    return "";
  }

  return `\\subsection*{${title}}\n${desc}\n\n${content}\n\n`;
}

function formatAuthorInfo(name?: string, affiliation?: string): string {
  const n = name ? escapeLatex(name) : "Author Name";
  if (affiliation && affiliation.trim()) {
    const aff = escapeLatex(affiliation);
    return `${n}\\\\${aff}`;
  }
  return n;
}

// Generate LaTeX document from analysis
export async function generateLatex(
  analysis: DocumentAnalysis,
  enhancements: Enhancement[],
  paperType: string,
  authorName?: string,
  authorAffiliation?: string
): Promise<string> {
  const enabled = enhancements.filter((e) => e.enabled);
  if (!analysis.title) {
    throw new Error("Analysis is missing title. AI did not provide required field.");
  }
  if (!analysis.abstract) {
    throw new Error("Analysis is missing abstract. AI did not provide required field.");
  }
  const title = escapeLatex(analysis.title);
  const abstract = analysis.abstract;

  const symbolDefs = enabled
    .filter((e) => e.type === "symbol")
    .map((e) => (e.content?.endsWith("\n") ? e.content : `${e.content}\n`))
    .join("");

  let latex = `\\documentclass[12pt]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{amsthm}
\\usepackage[margin=1in]{geometry}
\\usepackage[numbers]{natbib}
\\usepackage{listings}
\\usepackage{algorithm}
\\usepackage{algpseudocode}

% TikZ and diagram packages
\\usepackage{tikz}
\\usetikzlibrary{positioning,arrows,shapes,calc,decorations.pathreplacing}
\\usepackage{forest}

% Theorem environments
\\newtheorem{theorem}{Theorem}
\\newtheorem{lemma}{Lemma}
\\newtheorem{proposition}{Proposition}
\\newtheorem{corollary}{Corollary}
\\newtheorem{hypothesis}{Hypothesis}
\\newtheorem{definition}{Definition}
\\newtheorem{remark}{Remark}

${symbolDefs ? `% Symbol definitions
${symbolDefs}` : ""}% Title and author
\\title{${title}}
\\author{${formatAuthorInfo(authorName, authorAffiliation)}}
\\date{\\today}

\\begin{document}
\\maketitle
\\begin{abstract}
${abstract}
\\end{abstract}

`;

  if (!analysis.sections || analysis.sections.length === 0) {
    throw new Error("Analysis has no sections. AI did not provide document structure.");
  }
  for (const sec of analysis.sections) {
    if (!sec.name || !sec.content) {
      throw new Error(`Section is missing required fields: name=${!!sec.name}, content=${!!sec.content}`);
    }
    const secName = escapeLatex(sec.name);

    // SANITIZATION: Skip sections that are likely AI-generated bibliographies
    // REMOVED: We now generate the bibliography programmatically in analyzeDocument and append it as a section.
    // If we skip it here, we lose the legitimate bibliography.
    // The AI's hallucinated bibliographies are already stripped in analyzeDocument before this stage.
    /*
    if (/^(references|bibliography|works cited)$/i.test(secName.trim())) {
      console.log(`[LaTeX Generation] Skipped redundant section: ${secName}`);
      continue;
    }
    */

    let secContent = sec.content;
    const initialLength = secContent.length;

    // SANITIZATION (Structural): Truncate content if a References header is found
    // This is a "Proper Architecture" fix: We enforce that a section cannot contain a "References" sub-section.
    // Instead of patching the string, we cut it off at the invalid boundary.
    const refHeaderMatch = secContent.match(/\\(sub)?section\*?\{(References|Bibliography|Works Cited)\}/i);
    if (refHeaderMatch && refHeaderMatch.index !== undefined) {
      console.log(`[Sanitization] Detected mid-section bibliography in '${secName}'. Truncating...`);
      secContent = secContent.substring(0, refHeaderMatch.index).trim();
    }

    latex += `\\section{${secName}}\n\n${secContent}\n\n`;
    const secEnhs = enabled.filter((e) => {
      const loc = (e.location || "").toLowerCase().trim();
      const name = sec.name?.toLowerCase().trim() || "";
      const nameNoNum = name.replace(/^\d+\.\s*/, "");
      return (
        e.type !== "symbol" &&
        (name.includes(loc) || loc.includes(name) || nameNoNum.includes(loc) || loc.includes(nameNoNum))
      );
    });
    for (const enh of secEnhs) latex += formatEnhancement(enh);
  }

  const unmatched = enabled.filter((e) => {
    if (e.type === "symbol") return false;
    const loc = (e.location || "").toLowerCase().trim();
    const matched = (analysis.sections || []).some((s: any) => {
      const name = s.name?.toLowerCase().trim() || "";
      const nameNoNum = name.replace(/^\d+\.\s*/, "");
      return (
        name.includes(loc) || loc.includes(name) || nameNoNum.includes(loc) || loc.includes(nameNoNum)
      );
    });
    return !matched;
  });
  if (unmatched.length > 0) {
    latex += `\\section*{Additional Enhancements}\n\n`;
    for (const enh of unmatched) latex += formatEnhancement(enh);
  }

  // Bibliography
  // Note: The compiler has already injected the bibliography into the sections list.
  // But if there are leftover raw references (shouldn't be), we can add them here.
  // However, with the new system, we trust the compiler.

  // We still check if there's a "References" section in the analysis.sections, which there should be.
  // So we don't need to append it again here.

  latex += `\\end{document}\n`;

  // Debug: Log first 500 chars of generated LaTeX
  console.log('[LaTeX Generation] First 500 chars:', latex.substring(0, 500));
  console.log('[LaTeX Generation] Total length:', latex.length);

  return latex;
}
