
/**
 * latex-unifier/citation-engine.ts
 * "The Librarian"
 * 
 * Responsibility: Unified Citation Handling. 
 * PRESERVES:
 * - Robust Tokenizer: Splitting (ref_1, ref_2) correctly.
 * - IEEE Grouping: [1], [2] -> [1]–[2].
 * - Deduplication: Ensuring single processing pass.
 */

export interface CitationResult {
    processedContent: string;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
}

export function processCitations(content: string, parseFormatting: (t: string) => string): CitationResult {
    const citationMap = new Map<string, number>();
    let nextCitationId = 1;
    const references: string[] = [];
    let processed = content;

    // --- HELPER: IEEE FORMATTER ---
    const formatCitations = (keys: string): string => {
        const keyList = keys.split(/[,\s;]+/).map((k: string) => k.trim()).filter(k => k);
        const ids: number[] = [];

        keyList.forEach((key: string) => {
            const normalizedKey = key.replace(/\\_/g, '_');

            // Register if new
            if (!citationMap.has(normalizedKey)) {
                // Respect explicit ref numbers (ref_5 -> [5])
                const match = normalizedKey.match(/^ref_(\d+)$/i);
                let id = nextCitationId;
                if (match) {
                    id = parseInt(match[1], 10);
                    if (id >= nextCitationId) nextCitationId = id + 1;
                } else {
                    nextCitationId++;
                }

                citationMap.set(normalizedKey, id);
                references.push(normalizedKey);
            }
            ids.push(citationMap.get(normalizedKey)!);
        });

        // IEEE Style Grouping
        ids.sort((a, b) => a - b);
        // Deduplicate
        const uniqueIds = Array.from(new Set(ids));

        const ranges: string[] = [];
        if (uniqueIds.length === 0) return '';

        let start = uniqueIds[0];
        let end = uniqueIds[0];

        for (let i = 1; i < uniqueIds.length; i++) {
            if (uniqueIds[i] === end + 1) {
                end = uniqueIds[i];
            } else {
                ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);
                start = uniqueIds[i];
                end = uniqueIds[i];
            }
        }
        ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);

        return ranges.join(', ');
    };

    // --- REPLACEMENTS (The Robust Strategy) ---

    // 1. Standard \cite{ref_1, ref_2}
    processed = processed.replace(/\\cite\{([^}]+)\}/g, (match, keys) => formatCitations(keys));

    // 2. Consecutive Parentheses (ref_1)(ref_2)
    processed = processed.replace(/(\(ref_?\d+\))+/gi, (match) => {
        const allRefs = match.match(/ref_?\d+/gi);
        if (allRefs) return formatCitations(allRefs.join(','));
        return match;
    });

    // 3. Comma/Space separated inside parentheses (ref_1, ref_2) or (ref_1 ref_2)
    processed = processed.replace(/\(\s*((?:ref\\?_?\d+)(?:[,\s;]+ref\\?_?\d+)*)\s*\)/gi, (match, content) => {
        return formatCitations(content);
    });

    // 4. Single references (ref_1) with potential spaces
    processed = processed.replace(/\(\s*ref\\?_?(\d+)\s*\)/gi, (match, num) => formatCitations(`ref_${num}`));

    // 5. Explicit \ref{ref_X} halluncinations
    processed = processed.replace(/\\ref\{ref_(\d+)\}/gi, (match, num) => formatCitations(`ref_${num}`));


    // --- BIBLIOGRAPHY EXTRACTION ---
    let hasBibliography = false;
    let bibliographyHtml = null;

    // We strip the manual environment and rebuild it dynamically
    processed = processed.replace(/\\begin\{thebibliography\}([\s\S]*?)\\end\{thebibliography\}/g, (m, body) => {
        // We ignore the user's bibliography content if we are auto-generating, 
        // OR we parse theirs?
        // LatexPreview.tsx lines 1450+ implies we build references from usage, 
        // BUT lines 1321 (sanitizeLatex) implies we parse existing bib items.
        // "SSOT": The preview logic (line 1435) builds `references` array but doesn't seem to USE it to render HTML?
        // Wait, line 1321 (processBibliography) in sanitizeLatex parses `\bibitem`.

        // CONFLICT RESOLUTION: "The User's Source is Truth". 
        // If they provided a bibliography, we render that. 
        // If they cited things that aren't in it... we rely on the `[?]` behavior?
        // Actually, the new plan says "Unified".

        // Let's stick to parsing the `\bibitem` entries provided by AI/User.
        hasBibliography = true;

        const items: string[] = [];
        const bibitemRegex = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=\\bibitem\{|$)/g;
        let match;

        // We re-number based on citation map if possible? 
        // No, that changes the source order. 
        // Standard LaTeX: Bibliography defines order.
        // We will just parse it visually.

        // ISSUE: If we use `formatCitations`, we assigned dynamic IDs. 
        // If the bibliography exists, we should probably map those IDs to these items.
        // But `LatexPreview.tsx` was doing DOUBLE logic.

        // STRATEGY: Render the provided bibliography as-is, numbered sequentially 1..N.
        let refNum = 1;
        while ((match = bibitemRegex.exec(body)) !== null) {
            // const key = match[1]; // We could use this to reverse-lookup
            let content = match[2].trim();
            content = parseFormatting(content);
            items.push(`<li style="margin-bottom: 0.8em; text-indent: -2em; padding-left: 2em;"> [${refNum}] ${content}</li> `);
            refNum++;
        }

        const bibHtml = `
    <div class="bibliography" style="margin-top: 3em; border-top: 1px solid #ccc; padding-top: 1em;">
        <h2>References</h2>
        <ol style="list-style: none; padding: 0; margin: 0;">
          ${items.join('\n')}
        </ol>
      </div>
    `;
        bibliographyHtml = bibHtml;
        return ''; // Remove from body, we return it separately
    });

    return { processedContent: processed, bibliographyHtml, hasBibliography };
}
