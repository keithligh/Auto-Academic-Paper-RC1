/**
 * Processor (Orchestrator) for LaTeX Preview
 * 
 * COORDINATES:
 * 1. Healer (Sanitization)
 * 2. TikZ Engine
 * 3. Math Engine
 * 4. Citation Engine
 * 5. Table Engine
 * 6. Remaining unextracted logic (Lists, Algorithms, Verbatim, etc.)
 */

import katex from 'katex';
import { healLatex } from './healer';
import { processTikz } from './tikz-engine';
import { processMath } from './math-engine';
import { processCitations } from './citation-engine';
import { processTables } from './table-engine';

export interface SanitizeResult {
    sanitized: string;
    blocks: Record<string, string>;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
    metadata: {
        title: string;
        author: string;
        date: string;
    };
}

export function processLatex(latex: string): SanitizeResult {
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    // --- MACRO EXTRACTION (v1.9.41) ---
    // Extract definitions from preamble BEFORE it gets stripped.
    const extractMacros = (txt: string): Record<string, string> => {
        const macros: Record<string, string> = {};

        // Match \newcommand{\name}{value}
        // Simplified regex: doesn't handle nested braces perfectly, but good enough for simple variable wrappers
        const newCommandRegex = /\\newcommand\s*\{\\([a-zA-Z]+)\}\s*\{([^}]*)\}/g;
        let match;
        while ((match = newCommandRegex.exec(txt)) !== null) {
            macros[`\\${match[1]}`] = match[2];
        }

        // Match \def\name{value}
        const defRegex = /\\def\s*\\([a-zA-Z]+)\s*\{([^}]*)\}/g;
        while ((match = defRegex.exec(txt)) !== null) {
            macros[`\\${match[1]}`] = match[2];
        }

        return macros;
    };

    const globalMacros = extractMacros(latex);
    // Add common defaults that missing packages might imply
    // (None for now, relying on extraction)

    // Debug
    if (Object.keys(globalMacros).length > 0) {
        console.log("[Processor] Extracted Macros:", globalMacros);
    }

    const createPlaceholder = (html: string): string => {
        const id = `LATEXPREVIEWBLOCK${blockCount++}`;
        blocks[id] = html;
        return `\n\n${id}\n\n`;
    };

    // --- HELPER: Base Formatting for Blocks ---
    const parseLatexFormatting = (text: string): string => {
        // 1. Protection Protocol: Extract inline math FIRST
        const mathPlaceholders: string[] = [];
        let protectedText = text.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (m, math) => {
            // FIX (v1.9.41): Inject extracted macros into KaTeX
            try {
                mathPlaceholders.push(katex.renderToString(math, {
                    throwOnError: false,
                    macros: globalMacros
                }));
            } catch (e) {
                mathPlaceholders.push(`<span class="latex-math-error" style="color:red">\${math}</span>`);
            }
            return `__MATH_PROTECT_${mathPlaceholders.length - 1}__`;
        });

        // 2. Unescape LaTeX Special Chars
        // REORDERED (v1.9.40): Double-escapes MUST be handled BEFORE single-escapes.
        protectedText = protectedText
            .replace(/\\\\%/g, '%') // Double-escape first
            .replace(/\\%/g, '%')   // Then single
            .replace(/\\\\&/g, '&') // Double-escape first
            .replace(/\\\&/g, '&')  // Then single
            .replace(/\\#/g, '#')
            .replace(/\\_/g, '_')
            .replace(/\\\{/g, '{')
            .replace(/\\\}/g, '}');

        // 3. HTML Escaping
        protectedText = protectedText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 4. Typography Normalization
        protectedText = protectedText
            .replace(/---/g, '&mdash;')
            .replace(/--/g, '&ndash;')
            .replace(/``/g, '&ldquo;')
            .replace(/''/g, '&rdquo;')
            .replace(/\\textcircled\{([^{}])\}/g, '($1)');

        // 5. Macro Replacement
        const nested = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';
        protectedText = protectedText
            .replace(/\\eqref\{([^{}]*)\}/g, '(\\ref{$1})')
            .replace(/\\ref\s*\{([^{}]*)\}/g, '[$1]')
            .replace(/\\label\{([^{}]*)\}/g, '')
            .replace(/\\url\{([^{}]*)\}/g, '<code>$1</code>')
            .replace(/\\footnote\{([^{}]*)\}/g, ' ($1)')
            .replace(new RegExp(`\\\\textbf\\{${nested}\\}`, 'g'), '<strong>$1</strong>')
            .replace(new RegExp(`\\\\textit\\{${nested}\\}`, 'g'), '<em>$1</em>')
            .replace(new RegExp(`\\\\emph\\{${nested}\\}`, 'g'), '<em>$1</em>')
            .replace(new RegExp(`\\\\underline\\{${nested}\\}`, 'g'), '<u>$1</u>')
            .replace(new RegExp(`\\\\texttt\\{${nested}\\}`, 'g'), '<code>$1</code>')
            .replace(new RegExp(`\\\\textsc\\{${nested}\\}`, 'g'), '<span style="font-variant: small-caps;">$1</span>')
            // Markdown Compatibility (v1.9.15) - Handle AI Hallucinations
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\\bullet/g, '&#8226;')
            .replace(/~/g, '&nbsp;')
            .replace(/\\times/g, '&times;')
            .replace(/\\checkmark/g, '&#10003;')
            .replace(/\\approx/g, '&#8776;')
            .replace(/\\,/g, '&thinsp;')
            .replace(/\\rightarrow/g, '&rarr;')
            .replace(/\\Rightarrow/g, '&rArr;')
            .replace(/\\leftarrow/g, '&larr;')
            .replace(/\\Leftarrow/g, '&lArr;')
            .replace(/\\leftrightarrow/g, '&harr;')
            .replace(/\\Leftrightarrow/g, '&hArr;')
            .replace(/\\longrightarrow/g, '&rarr;')
            .replace(/\\Longrightarrow/g, '&rArr;')
            .replace(/\{:\}/g, ':')
            .replace(/\{,\}/g, ',')
            .replace(/\\:/g, ':')
            .replace(/\\\//g, '/')
            .replace(/\\\\/g, '<br/>')
            .replace(/\\newline/g, '<br/>')
            // Cleanup Residue: Handle raw (ref_X) that missed the compiler
            .replace(/\(ref_(\d+)\)/g, '<span class="citation-placeholder">[ref_$1]</span>');

        // 6. Restore Math (Immediate Protection Restoration)
        protectedText = protectedText.replace(/__MATH_PROTECT_(\d+)__/g, (m, idx) => mathPlaceholders[parseInt(idx)]);

        return protectedText;
    };

    // --- CONTENT PREPARATION ---
    let content = healLatex(latex);

    // --- CITATION ENGINE REFACTORING (Phase 4) ---
    const { sanitized: citationSanitized, bibliographyHtml: generatedBib } = processCitations(content);
    content = citationSanitized;
    const bibliographyHtml = generatedBib;

    // --- TIKZ REFACTORING (Phase 2) ---
    const { sanitized: tikzSanitized, blocks: tikzBlocks } = processTikz(content);
    content = tikzSanitized;
    Object.assign(blocks, tikzBlocks);

    // --- CODE BLOCKS (Verbatim & Listings) ---
    // Extract early to prevent Math/Command parsing inside code
    content = content.replace(/\\begin\{(verbatim|lstlisting)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (m, envName, code) => {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return createPlaceholder(`<pre class="latex-verbatim"> ${escaped}</pre> `);
    });

    // --- MATH ENGINE REFACTORING (Phase 3) ---
    // PASS MACROS (v1.9.42): Ensure inline math ($A$) gets the preamble definitions
    const { sanitized: mathSanitized, blocks: mathBlocks } = processMath(content, globalMacros);
    content = mathSanitized;
    Object.assign(blocks, mathBlocks);

    // --- LISTS ---
    const processLists = (txt: string, depth: number = 0): string => {
        let output = '';
        let i = 0;
        while (i < txt.length) {
            if (txt.startsWith('\\begin{enumerate}', i)) {
                i += 17;
                // Handle options [label=...]
                if (txt[i] === '[') {
                    let d = 0;
                    while (i < txt.length) {
                        if (txt[i] === '[') d++;
                        if (txt[i] === ']') d--;
                        i++;
                        if (d === 0) break;
                    }
                }
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{enumerate}', i)) listDepth++;
                    if (txt.startsWith('\\end{enumerate}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 15;
                output += createPlaceholder(`<ol class="latex-enumerate">\n${processLists(listContent, depth + 1)} \n</ol> `);
            } else if (txt.startsWith('\\begin{itemize}', i)) {
                i += 15;
                // Handle options [noitemsep]
                if (txt[i] === '[') {
                    let d = 0;
                    while (i < txt.length) {
                        if (txt[i] === '[') d++;
                        if (txt[i] === ']') d--;
                        i++;
                        if (d === 0) break;
                    }
                }
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{itemize}', i)) listDepth++;
                    if (txt.startsWith('\\end{itemize}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 13;
                output += createPlaceholder(`<ul class="latex-itemize">\n${processLists(listContent, depth + 1)} \n</ul> `);
            } else if (txt.startsWith('\\begin{description}', i)) {
                i += 19;
                // Handle options [style=...]
                if (txt[i] === '[') {
                    let d = 0;
                    while (i < txt.length) {
                        if (txt[i] === '[') d++;
                        if (txt[i] === ']') d--;
                        i++;
                        if (d === 0) break;
                    }
                }
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{description}', i)) listDepth++;
                    if (txt.startsWith('\\end{description}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 17;
                output += createPlaceholder(`<ul class="latex-description" style="list-style: none; padding-left: 1em;">\n${processLists(listContent, depth + 1)} \n</ul> `);
            } else if (txt.startsWith('\\item', i)) {
                i += 5;
                // Handle \item[x]
                let label = '';
                if (txt[i] === '[') {
                    i++;
                    let d = 1;
                    while (i < txt.length && d > 0) {
                        if (txt[i] === '[') d++;
                        else if (txt[i] === ']') d--;

                        if (d > 0) {
                            label += txt[i];
                            i++;
                        }
                    }
                    i++; // skip closing ]
                }
                let itemContent = '';
                while (i < txt.length && !txt.startsWith('\\item', i)) {
                    itemContent += txt[i];
                    i++;
                }
                const processedItem = processLists(itemContent, depth);

                if (label) {
                    output += `<li style="list-style: none;"><strong>${parseLatexFormatting(label)}</strong> ${parseLatexFormatting(processedItem)}</li> `;
                } else {
                    output += `<li> ${parseLatexFormatting(processedItem)}</li> `;
                }
            } else {
                output += txt[i];
                i++;
            }
        }
        return output;
    };
    content = processLists(content);

    // --- METADATA EXTRACTION (Moved from LatexPreview) ---
    let title = '';
    let author = '';
    let date = '';

    // Match Title (Support Nested Braces)
    const nestedContent = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)'; // Level 1 nesting support
    const titleMatch = content.match(new RegExp(`\\\\title\\{${nestedContent}\\}`));
    if (titleMatch) title = titleMatch[1];

    // Match Author
    const authorMatch = content.match(new RegExp(`\\\\author\\{${nestedContent}\\}`));
    if (authorMatch) author = authorMatch[1];

    // Match Date
    const dateMatch = content.match(/\\date\{([^}]*)\}/);
    if (dateMatch) {
        const dateContent = dateMatch[1];
        if (dateContent.includes('\\today')) {
            date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            date = dateContent;
        }
    }

    // --- ALGORITHMS ---
    const processAlgorithms = (content: string): string => {
        return content.replace(/\\begin\{algorithmic\}(\[[^\]]*\])?([\s\S]*?)\\end\{algorithmic\}/g, (m, opt, body) => {
            let lines = body.split(/\\STATE\s+/).filter((l: string) => l.trim().length > 0);

            // If no STATE commands, try splitting by newline if it looks like raw code
            if (lines.length <= 1 && body.includes('\n')) {
                lines = body.split('\n').filter((l: string) => l.trim().length > 0);
            }

            let html = '<div class="latex-algorithm">';
            let indentLevel = 0;
            let lineNum = 1;

            const parseLine = (line: string): string => {
                let lineContent = line.trim();
                let currentIndent = indentLevel;

                if (/^\\IF/i.test(lineContent) || /^\\FOR/i.test(lineContent) || /^\\WHILE/i.test(lineContent)) {
                    indentLevel++;
                } else if (/^\\ENDIF/i.test(lineContent) || /^\\ENDFOR/i.test(lineContent) || /^\\ENDWHILE/i.test(lineContent)) {
                    indentLevel--;
                    currentIndent = indentLevel;
                    lineContent = lineContent.replace(/^\\(ENDIF|ENDFOR|ENDWHILE)/i, '<span class="latex-alg-keyword">$1</span>');
                } else if (/^\\ELSE/i.test(lineContent)) {
                    currentIndent = indentLevel - 1;
                    lineContent = lineContent.replace(/^\\ELSE/i, '<span class="latex-alg-keyword">else</span>');
                }

                let formattedContent = parseLatexFormatting(lineContent);

                formattedContent = formattedContent
                    .replace(/^\\IF(?![a-zA-Z])/i, '<span class="latex-alg-keyword">if</span>')
                    .replace(/^\\FOR(?![a-zA-Z])/i, '<span class="latex-alg-keyword">for</span>')
                    .replace(/^\\WHILE(?![a-zA-Z])/i, '<span class="latex-alg-keyword">while</span>')
                    .replace(/\\IF\s*\{([^}]+)\}/i, '<span class="latex-alg-keyword">if</span> $1 <span class="latex-alg-keyword">then</span>')
                    .replace(/\\FOR\s*\{([^}]+)\}/i, '<span class="latex-alg-keyword">for</span> $1 <span class="latex-alg-keyword">do</span>')
                    .replace(/\\WHILE\s*\{([^}]+)\}/i, '<span class="latex-alg-keyword">while</span> $1 <span class="latex-alg-keyword">do</span>')
                    .replace(/^\\ENDIF/i, '<span class="latex-alg-keyword">endif</span>')
                    .replace(/^\\ENDFOR/i, '<span class="latex-alg-keyword">endfor</span>')
                    .replace(/^\\ENDWHILE/i, '<span class="latex-alg-keyword">endwhile</span>')
                    .replace(/^\\ELSE/i, '<span class="latex-alg-keyword">else</span>')
                    .replace(/^\\STATE\s*/i, '');

                const indentStyle = `style="padding-left: ${currentIndent * 1.5}em"`;

                return `<div class="latex-alg-line" ${indentStyle}>
                    <span class="latex-alg-lineno">${lineNum++}.</span>
                    <span class="latex-alg-content">${formattedContent}</span>
                  </div>`;
            };

            const commands = body.split(/(?=\\(?:STATE|IF|FOR|WHILE|ENDIF|ENDFOR|ENDWHILE|ELSE))/g).filter((s: string) => s.trim().length > 0);

            commands.forEach((cmd: string) => {
                let cleanCmd = cmd.trim();
                if (cleanCmd.startsWith('\\STATE')) {
                    cleanCmd = cleanCmd.replace(/^\\STATE\s*/, '');
                }
                html += parseLine(cleanCmd);
            });

            html += '</div>';
            return createPlaceholder(html);
        });
    };
    content = processAlgorithms(content);

    // --- ENVIRONMENT NORMALIZATION (Robust Loop from LatexPreview) ---
    const envs = ["algorithm", "hypothesis", "remark", "definition", "theorem", "lemma", "proposition", "corollary"];
    envs.forEach(env => {
        const robustRegex = new RegExp(`\\\\begin\\{${env}\\}(?:\\[(.*?)\\])?([\\s\\S]*?)\\\\end\\{${env}\\}`, 'g');
        content = content.replace(robustRegex, (match, title, body) => {
            const titleHtml = title ? `<strong>(${title})</strong> ` : '';
            // We use a safe placeholder to prevent text processing from mangling the env logic
            return createPlaceholder(`<div class="${env}"> <strong>${env.charAt(0).toUpperCase() + env.slice(1)}.</strong> ${titleHtml}${parseLatexFormatting(body)}</div> `);
        });
    });

    // --- ABSTRACT & CENTER (Moved from LatexPreview) ---
    content = content.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (m, body) =>
        createPlaceholder(`<div class="abstract"><h3>Abstract</h3><p>${parseLatexFormatting(body)}</p></div>`)
    );
    content = content.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, (m, body) =>
        `<div style="text-align: center;">${parseLatexFormatting(body)}</div>`
    );

    // --- FIGURE/TABLE/ALGORITHM FLATTENING ---
    content = content.replace(/Built-in\s+&\s+Comprehensive/g, 'Built-in \\& Comprehensive');
    content = content.replace(/\\begin\{(figure|table|algorithm)\}(\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (m, env, opt, body) => {
        let cleaned = body
            .replace(/\\centering/g, '')
            .replace(/\\caption\{[^}]*\}/g, '')
            .replace(/\\label\{[^}]*\}/g, '')
            // Cleanup Residue
            .trim();
        return cleaned;
    });


    // --- TABLE ENGINE REFACTORING (Phase 5) ---
    const { sanitized: tableSanitized, blocks: tableBlocks } = processTables(content, parseLatexFormatting);
    content = tableSanitized;
    Object.assign(blocks, tableBlocks);

    // --- PREAMBLE & JUNK CLEANUP (Migrated from LatexPreview) ---
    // If \begin{document} exists, discard everything before it (AFTER extracting metadata/macros)
    const docStart = content.indexOf('\\begin{document}');
    if (docStart !== -1) {
        content = content.substring(docStart + '\\begin{document}'.length);
    }

    // Remove valid document end
    content = content.replace(/\\end\{document\}/g, '');

    // Strip Comments
    content = content.replace(/^\s*%.*$/gm, '');

    // --- COMMAND STRIPPING (Fallback & Cleanup) ---
    // Even if we sliced, these might appear in the body via inclusion or error
    content = content.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
    content = content.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
    content = content.replace(/\\tableofcontents/g, '');
    content = content.replace(/\\listoffigures/g, '');
    content = content.replace(/\\listoftables/g, '');
    content = content.replace(/\\input\{[^}]*\}/g, '');
    content = content.replace(/\\include\{[^}]*\}/g, '');
    content = content.replace(/\\newpage/g, '');
    content = content.replace(/\\clearpage/g, '');
    content = content.replace(/\\pagebreak/g, '');
    content = content.replace(/\\noindent/g, '');
    content = content.replace(/\\vspace\{[^}]*\}/g, '');
    content = content.replace(/\\hspace\{[^}]*\}/g, '');

    // --- GHOST HEADER EXORCISM ---
    content = content.replace(/\\section\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');
    content = content.replace(/\\subsection\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');

    // --- MANUAL PARBOX WALKER ---
    const processParboxes = (txt: string): string => {
        let result = '';
        let i = 0;
        while (i < txt.length) {
            if (txt.startsWith('\\parbox', i)) {
                i += 7; // skip \parbox

                // Parse 1st arg: Width
                while (i < txt.length && txt[i] !== '{') i++; // find first {
                let widthArg = '';
                if (i < txt.length) {
                    let braceDepth = 0;
                    if (txt[i] === '{') {
                        braceDepth = 1;
                        i++;
                        while (i < txt.length && braceDepth > 0) {
                            if (txt[i] === '{') braceDepth++;
                            else if (txt[i] === '}') braceDepth--;

                            if (braceDepth > 0) widthArg += txt[i];
                            i++;
                        }
                    }
                }

                // Parse 2nd arg: Content
                while (i < txt.length && txt[i] !== '{') i++; // find second {
                let contentArg = '';
                if (i < txt.length) {
                    let braceDepth = 0;
                    if (txt[i] === '{') {
                        braceDepth = 1;
                        i++;
                        while (i < txt.length && braceDepth > 0) {
                            if (txt[i] === '{') braceDepth++;
                            else if (txt[i] === '}') braceDepth--;

                            if (braceDepth > 0) contentArg += txt[i];
                            i++;
                        }
                    }
                }

                let cssWidth = '100%';
                const textwidthMatch = widthArg.match(/([\d.]+)\\textwidth/);
                const linewidthMatch = widthArg.match(/([\d.]+)\\linewidth/);
                if (textwidthMatch) {
                    cssWidth = `${parseFloat(textwidthMatch[1]) * 100}% `;
                } else if (linewidthMatch) {
                    cssWidth = `${parseFloat(linewidthMatch[1]) * 100}% `;
                }

                result += createPlaceholder(`<div class="parbox" style="width: ${cssWidth}; display: inline-block; vertical-align: top;"> ${parseLatexFormatting(contentArg)}</div> `);

            } else {
                result += txt[i];
                i++;
            }
        }
        return result;
    };
    content = processParboxes(content);

    // Extract Bibliography (thebibliography environment)
    let hasBibliography = false;
    content = content.replace(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/g, (m, body) => {
        hasBibliography = true;

        const items: string[] = [];
        const bibitemRegex = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=\\bibitem\{|$)/g;
        let match;
        let refNum = 1;

        while ((match = bibitemRegex.exec(body)) !== null) {
            const key = match[1];
            let content = match[2].trim();
            content = parseLatexFormatting(content);
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

        return createPlaceholder(bibHtml);
    });

    // --- SECTION HEADERS (Moved from LatexPreview) ---
    content = content.replace(/\\section\*?\s*\{([\s\S]*?)\}/g, '<h2>$1</h2>');
    content = content.replace(/\\subsection\*?\s*\{([\s\S]*?)\}/g, '<h3>$1</h3>');
    content = content.replace(/\\subsubsection\*?\s*\{([\s\S]*?)\}/g, '<h4>$1</h4>');
    content = content.replace(/\\paragraph\*?\s*\{([\s\S]*?)\}/g, '<strong>$1</strong> ');

    // --- PARAGRAPH & TEXT FORMATTING ---
    // 1. Handle explicit paragraph breaks
    content = content.replace(/\\par(?![a-zA-Z])/g, '\n\n');

    // 2. Normalize Newlines (AI artifact fix)
    content = content.replace(/\\n/g, '\n');

    // 3. Apply Text Formatting (Bold, Italic, Unescape)
    content = parseLatexFormatting(content);

    // 4. Paragraph Wrapping (The "Universal Paragraph Map")
    // Split by double newlines and wrap non-block content in <p>
    // Fix (Peer Review): Use \n\s*\n+ to catch blank lines with spaces
    content = content.split(/\n\s*\n+/).filter(p => p.trim()).map(para => {
        para = para.trim();
        if (!para) return '';
        // Skip block elements that shouldn't be in <p>
        if (para.match(/^<h[1-6]/)) return para;
        if (para.match(/^<div/)) return para;
        if (para.match(/^<ol/)) return para; // Lists
        if (para.match(/^<ul/)) return para;
        if (para.startsWith('LATEXPREVIEW')) return para; // Placeholders
        if (para.match(/^<(table|pre)/)) return para;

        return `<p>${para}</p>`;
    }).join('\n');

    return { sanitized: content, blocks, bibliographyHtml, hasBibliography, metadata: { title, author, date } };
}
