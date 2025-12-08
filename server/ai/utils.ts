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
        end = clean.lastIndexOf('}');
    } else if (firstBracket !== -1) {
        start = firstBracket;
        end = clean.lastIndexOf(']');
    }

    if (start !== -1 && end !== -1) {
        clean = clean.substring(start, end + 1);
    } else {
        // Fallback: if no braces found, maybe it's just the content
        // But if we can't find braces, it's likely not valid JSON.
        // We'll try to parse 'clean' as is.
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
            // If that also fails, throw the original error but with more context
            // We truncate the content in the error message to avoid spam
            const preview = clean.length > 100 ? clean.substring(0, 100) + "..." : clean;
            throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}. Content preview: ${preview}`);
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
