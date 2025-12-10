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
}

export function processLatex(latex: string): SanitizeResult {
    const blocks: Record<string, string> = {};
    let blockCount = 0;

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
            mathPlaceholders.push(katex.renderToString(math, { throwOnError: false }));
            return `__MATH_PROTECT_${mathPlaceholders.length - 1}__`;
        });

        // 2. Unescape LaTeX Special Chars
        protectedText = protectedText
            .replace(/\\%/g, '%')
            .replace(/\\\&/g, '&')
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
            .replace(/\\newline/g, '<br/>');

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

    // --- VERBATIM / CODE BLOCK EXTRACTION ---
    content = content.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (m, code) => {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return createPlaceholder(`<pre class="latex-verbatim"> ${escaped}</pre> `);
    });

    // --- MATH ENGINE REFACTORING (Phase 3) ---
    const { sanitized: mathSanitized, blocks: mathBlocks } = processMath(content);
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

    // --- ENVIRONMENT NORMALIZATION ---
    content = content.replace(/\\begin\{theorem\}([\s\S]*?)\\end\{theorem\}/g, (m, body) => {
        return createPlaceholder(`<div class="theorem"> <strong>Theorem.</strong> ${parseLatexFormatting(body.trim())}</div> `);
    });
    content = content.replace(/\\begin\{lemma\}([\s\S]*?)\\end\{lemma\}/g, (m, body) => {
        return createPlaceholder(`<div class="lemma"> <strong>Lemma.</strong> ${parseLatexFormatting(body.trim())}</div> `);
    });
    content = content.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, (m, body) => {
        return createPlaceholder(`<div class="proof"> <em>Proof.</em> ${parseLatexFormatting(body.trim())} <span style="float:right;">∎</span></div> `);
    });
    content = content.replace(/\\begin\{definition\}([\s\S]*?)\\end\{definition\}/g, (m, body) => {
        return createPlaceholder(`<div class="definition"> <strong>Definition.</strong> ${parseLatexFormatting(body.trim())}</div> `);
    });
    content = content.replace(/\\begin\{corollary\}([\s\S]*?)\\end\{corollary\}/g, (m, body) => {
        return createPlaceholder(`<div class="corollary"> <strong>Corollary.</strong> ${parseLatexFormatting(body.trim())}</div> `);
    });
    content = content.replace(/\\begin\{remark\}([\s\S]*?)\\end\{remark\}/g, (m, body) => {
        return createPlaceholder(`<div class="remark"> <em>Remark.</em> ${parseLatexFormatting(body.trim())}</div> `);
    });

    // --- FIGURE/TABLE FLATTENING ---
    content = content.replace(/Built-in\s+&\s+Comprehensive/g, 'Built-in \\& Comprehensive');
    content = content.replace(/\\begin\{(figure|table)\}(\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (m, env, opt, body) => {
        let cleaned = body
            .replace(/\\centering/g, '')
            .replace(/\\caption\{[^}]*\}/g, '')
            .replace(/\\label\{[^}]*\}/g, '')
            .trim();
        return cleaned;
    });

    // --- TABLE ENGINE REFACTORING (Phase 5) ---
    const { sanitized: tableSanitized, blocks: tableBlocks } = processTables(content, parseLatexFormatting);
    content = tableSanitized;
    Object.assign(blocks, tableBlocks);

    // --- COMMAND STRIPPING ---
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

    return { sanitized: content, blocks, bibliographyHtml, hasBibliography };
}
