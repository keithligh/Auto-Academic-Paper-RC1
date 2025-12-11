/**
 * Fix JSON escaping issues from AI responses.
 * 
 * IMPORTANT: This function operates on RAW JSON strings, before JSON.parse().
 * When AI outputs invalid escape sequences (like \& or \% for LaTeX),
 * we double the backslash to make it valid JSON. This ensures:
 * - `\&` (invalid) becomes `\\&` (valid) which parses to `\&` (correct)
 */
export function fixAIJsonEscaping(jsonString: string): string {
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
                    // Valid JSON escape sequence - mark as escaped
                    escape = true;
                    result += char;
                } else {
                    // Invalid JSON escape (like \& \% \#) - double the backslash to fix
                    // This turns \& into \\& which is valid JSON, parsing to \&
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
 * Sanitize AI-generated LaTeX for the server-side compiler.
 * This acts as a safety net for things the prompt failed to prevent.
 */
export function sanitizeLatexOutput(text: string): string {
    return text
        // Universal Math Repair (v1.6.16):
        // Fixes orphaned subscripts/superscripts like `$\theta$_t` or `^2` by merging them back into math mode.
        // Matches: Closing $ (not escaped), followed by _ or ^, followed by a char or {...} block.
        // Replacement: Moves the operator and payload BEFORE the closing $.
        .replace(/(?<!\\)\$\s*([_^])\s*(\{[^}]*\}|[a-zA-Z0-9])/g, '$1$2$')
        // Replace unsupported symbols
        .replace(/\\smalltriangleup/g, '$\\triangle$')
        .replace(/\\checkmark/g, '$\\checkmark$')
        // Strip colors (server-side safety)
        .replace(/\\textcolor\{[^}]+\}\{([^}]*)\}/g, '$1')
        .replace(/\\color\{[^}]+\}/g, '')
        // Ensure \theta is in math mode if not already
        .replace(/(?<!\$)\\theta/g, '$\\theta$');
}

/**
 * Robustly extracts and parses JSON from AI output.
 * Handles markdown fences, extra text, and both Objects/Arrays.
 */
export function extractJson(content: string): any {
    // 1. Remove markdown fences (Robust Regex)
    let clean = content.trim();
    // Remove ```json ... ``` or just ``` ... ```
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

    // 2. Find the outer-most JSON structure (Object or Array)
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');

    let start = -1;
    let end = -1;

    // Determine if it's an Object or Array based on which appears first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = findBalancedJsonEnd(clean, start, '{', '}');
    } else if (firstBracket !== -1) {
        start = firstBracket;
        end = findBalancedJsonEnd(clean, start, '[', ']');
    }

    if (start !== -1 && end !== -1) {
        clean = clean.substring(start, end + 1);
    } else if (start !== -1) {
        // Truncated or malformed (no closing found) - take everything from start
        clean = clean.substring(start);
    }

    // 3. Fix escaping issues (Legacy helper)
    // Only apply if simple parse fails, to avoid breaking valid JSON?
    // The legacy code applied it always. Let's keep it but be careful.
    // Actually, let's try to parse FIRST. If it fails, then fix escaping.

    try {
        return JSON.parse(clean);
    } catch (e) {
        // If simple parse fails, try fixing escaping
        const fixed = fixAIJsonEscaping(clean);
        try {
            return JSON.parse(fixed);
        } catch (e2) {
            // DETECT TRUNCATION: Check for common JSON parsing errors related to incomplete output
            const errorMsg = e2 instanceof Error ? e2.message : String(e2);
            const isTruncated =
                errorMsg.includes("Unexpected end of JSON input") ||
                errorMsg.includes("Unterminated string") ||
                errorMsg.includes("End of data");

            if (isTruncated) {
                // Throw a specific error that we can catch upstream to abort retries
                throw new Error(`AI_OUTPUT_TRUNCATED: The model response was cut off. This usually means the model hit its max output token limit. Try reducing the 'Enhancement Level' or using a model with a larger context window.`);
            }

            // If that also fails, throw the original error but with more context
            // We truncate the content in the error message to avoid spam
            const preview = clean.length > 200 ? clean.substring(clean.length - 200) : clean;
            throw new Error(`Failed to parse JSON: ${errorMsg}. End of content: "...${preview}"`);
        }
    }
}

/**
 * Escapes special LaTeX characters in a string.
 */
export function escapeLatex(text: string): string {
    if (!text) return "";
    return text
        .replace(/\\/g, "\\textbackslash{}")
        .replace(/[{}]/g, (m) => `\\${m}`)
        .replace(/[%$#&_]/g, (m) => `\\${m}`)
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}");
}

/**
 * Finds the matching closing brace for a JSON structure, respecting strings and escapes.
 * Returns the index of the matching closeChar, or -1 if not found.
 */
function findBalancedJsonEnd(text: string, startIndex: number, openChar: string, closeChar: string): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (char === '\\' && !escaped) {
                escaped = true;
            } else if (char === '"' && !escaped) {
                inString = false;
            } else {
                escaped = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === openChar) {
            depth++;
        } else if (char === closeChar) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Applies a list of patch replacements to a text string.
 * Uses robust whitespace normalization to find matches even if newlines/spaces differ slightly.
 */
export function applyPatches(content: string, patches: { original: string; new: string }[]): string {
    let currentContent = content;

    for (const patch of patches) {
        // 1. Try Exact Match First
        if (currentContent.includes(patch.original)) {
            currentContent = currentContent.replace(patch.original, patch.new);
            console.log(`[Patch] Exact match applied for: "${patch.original.substring(0, 30)}..."`);
            continue;
        }

        // 2. Fuzzy Match (Normalize whitespace)
        // We accept that the AI might have turned newlines into spaces or vice versa
        // Strategy: Create a regex from the 'original' text where every whitespace sequence is \s+

        // Escape regex special characters in the search string
        const escapedSearch = patch.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Replace whitespace sequences with generic whitespace regex
        const fuzzyPatternStr = escapedSearch.replace(/\s+/g, '\\s+');
        const fuzzyRegex = new RegExp(fuzzyPatternStr);

        if (fuzzyRegex.test(currentContent)) {
            currentContent = currentContent.replace(fuzzyRegex, patch.new);
            console.log(`[Patch] Fuzzy match applied for: "${patch.original.substring(0, 30)}..."`);
        } else {
            console.warn(`[Patch] WARNING: Could not find match for patch: "${patch.original.substring(0, 50)}..."`);
            // We do NOT stop. We skip this patch and continue, preserving the rest of the file.
        }
    }

    return currentContent;
}
