
/**
 * latex-unifier/processor.ts
 * "The Pipeline"
 * 
 * Responsibility: Master Sequencer.
 * 1. Run Healer
 * 2. Run TikZ Engine (Extract)
 * 3. Run Math Parser (Extract)
 * 4. Run Table Engine (Extract)
 * 5. Formatting & Re-injection
 */

import katex from 'katex';
import { healLatex } from './healer';
import { processTikz } from './tikz-engine';
import { processTables, parseLatexFormatting } from './table-engine';
import { processCitations } from './citation-engine';

export interface ProcessResult {
    html: string;
    blocks: Record<string, string>;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
}

let pipelineBlockCount = 0;

export function processLatex(content: string): ProcessResult {
    const blocks: Record<string, string> = {};

    // 1. HEALER (Pre-process)
    let processed = healLatex(content);

    // 2. METADATA EXTRACTION (Before Preamble Strip)
    let title = '';
    let author = '';
    let date = '';

    const titleMatch = processed.match(/\\title\{([^{}]+)\}/);
    if (titleMatch) title = titleMatch[1];
    const authorMatch = processed.match(/\\author\{([^{}]+)\}/);
    if (authorMatch) author = authorMatch[1];
    const dateMatch = processed.match(/\\date\{([^}]*)\}/);
    if (dateMatch) {
        if (dateMatch[1].includes('\\today')) {
            date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            date = dateMatch[1];
        }
    }

    // 3. PREAMBLE STRIPPING
    const docStart = processed.indexOf('\\begin{document}');
    if (docStart !== -1) {
        processed = processed.substring(docStart + '\\begin{document}'.length);
    } else {
        processed = processed
            .replace(/\\documentclass\[.*?\]\{.*?\}/g, '')
            .replace(/\\usepackage(\[.*?\])?\{.*?\}/g, '')
            .replace(/\\usetikzlibrary\{.*?\}/g, '')
            .replace(/\\title\{.*?\}/g, '')
            .replace(/\\author\{.*?\}/g, '')
            .replace(/\\date\{.*?\}/g, '');
    }
    processed = processed.replace(/\\end\{document\}/g, '');

    // FIX: Remove \maketitle if it exists in the body
    processed = processed.replace(/\\maketitle/g, '');

    // 4. TIKZ ENGINE (Extraction)
    const tikzResult = processTikz(processed);
    processed = tikzResult.cleanedContent;
    Object.assign(blocks, tikzResult.blocks);

    // 5. VERBATIM / CODE (Pre-Math)
    processed = processed.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (m, code) => {
        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const id = `LATEXPREVIEWVERBATIM${pipelineBlockCount++}`;
        blocks[id] = `<pre class="latex-verbatim"> ${escaped}</pre> `;
        return `\n\n${id}\n\n`;
    });

    // 6. MATH PARSER (KaTeX)
    // Helper
    const createMathBlock = (mathContent: string, displayMode: boolean): string => {
        const id = `LATEXPREVIEWMATH${pipelineBlockCount++}`;
        try {
            let html = katex.renderToString(mathContent, {
                displayMode,
                throwOnError: false,
                strict: false,
                macros: { "\\eqref": "\\href{#1}{#1}", "\\label": "" }
            });

            // Autoscale Heuristic (Layer 1)
            if (displayMode) {
                const lineCount = (mathContent.match(/\\\\/g) || []).length;
                const isStructuredEnv = /\\begin\{(equation|align|gather|multline)/.test(mathContent);
                const isMultiLine = lineCount > 0 || isStructuredEnv;

                if (!isMultiLine) {
                    // Scaling for long single-line equations
                    let roughContent = mathContent
                        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
                        .replace(/\\text\{([^}]+)\}/g, '$1')
                        .replace(/\\textbf\{([^}]+)\}/g, '$1')
                        .replace(/\\(left|right|big|Big|bigg|Bigg)[lrv]?/g, '')
                        .replace(/\\[a-zA-Z]+/g, 'C');

                    const estimatedWidthEm = roughContent.length * 0.45;
                    const maxEm = 50;

                    if (estimatedWidthEm > maxEm) {
                        const scale = Math.max(0.55, maxEm / estimatedWidthEm);
                        html = `<div class="katex-autoscale" style="transform: scale(${scale.toFixed(2)}); transform-origin: left center; width: ${(100 / scale).toFixed(1)}%;">${html}</div>`;
                    }
                }
            }
            blocks[id] = html;
        } catch (e) {
            blocks[id] = `<span style="color:red;">Math Error</span>`;
        }
        return displayMode ? `\n\n${id}\n\n` : id;
    };

    // Math Extraction Order (Critical)
    processed = processed.replace(/\\begin\s*\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g, (m, env, star, math) => createMathBlock(m, true));
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => createMathBlock(math, true));
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (m, math) => createMathBlock(math, false));
    processed = processed.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g, (m, math) => createMathBlock(math, true));
    processed = processed.replace(/(?<!\\)\$(?!\$)([^$]+?)(?<!\\)\$/g, (m, math) => createMathBlock(math, false));

    // 7. CITATION ENGINE (Unified) - MOVED UP (CRITICAL FIX)
    // Must run BEFORE Tables and Lists so citations inside them are processed!
    // We pass parseLatexFormatting as a callback to handle formatted bibliographies
    const citationRes = processCitations(processed, (t) => parseLatexFormatting(t, blocks));
    processed = citationRes.processedContent;
    // Note: We ignore bibliographyHtml here, we use the return value at the end.


    // 8. TABLE ENGINE
    const tableResult = processTables(processed, blocks);
    processed = tableResult.cleanedContent;

    // 9. LISTS (Unified List Parser)
    // We copy the list logic effectively by using a recursive function
    const processLists = (txt: string, depth: number = 0): string => {
        let output = '';
        let i = 0;
        while (i < txt.length) {
            if (txt.startsWith('\\begin{enumerate}', i)) {
                i += 17;
                // Skip options [label=...]
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
                const id = `LATEXPREVIEWLIST${pipelineBlockCount++}`;
                blocks[id] = `<ol class="latex-enumerate">\n${processLists(listContent, depth + 1)} \n</ol> `;
                output += `\n\n${id}\n\n`;
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
                const id = `LATEXPREVIEWLIST${pipelineBlockCount++}`;
                blocks[id] = `<ul class="latex-itemize">\n${processLists(listContent, depth + 1)} \n</ul> `;
                output += `\n\n${id}\n\n`;
            } else if (txt.startsWith('\\begin{description}', i)) {
                // Copied logic
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
                const id = `LATEXPREVIEWLIST${pipelineBlockCount++}`;
                blocks[id] = `<ul class="latex-description" style="list-style: none; padding-left: 1em;">\n${processLists(listContent, depth + 1)} \n</ul> `;
                output += `\n\n${id}\n\n`;
            } else if (txt.startsWith('\\item', i)) {
                i += 5;
                let label = '';
                if (txt[i] === '[') {
                    i++;
                    let d = 1;
                    while (i < txt.length && d > 0) {
                        if (txt[i] === '[') d++;
                        else if (txt[i] === ']') d--;
                        if (d > 0) { label += txt[i]; i++; }
                    }
                    i++;
                }
                let itemContent = '';
                while (i < txt.length && !txt.startsWith('\\item', i)) {
                    itemContent += txt[i];
                    i++;
                }
                const processedItem = processLists(itemContent, depth);
                if (label) {
                    output += `<li style="list-style: none;"><strong>${parseLatexFormatting(label)}</strong> ${parseLatexFormatting(processedItem, blocks)}</li> `;
                } else {
                    output += `<li> ${parseLatexFormatting(processedItem, blocks)}</li> `;
                }
            } else {
                output += txt[i];
                i++;
            }
        }
        return output;
    };
    processed = processLists(processed);


    // 10. ALGORITHMS
    // Copied from LatexPreview.tsx lines 942-1041 roughly
    processed = processed.replace(/\\begin\{algorithmic\}(\[[^\]]*\])?([\s\S]*?)\\end\{algorithmic\}/g, (m, opt, body) => {
        const commands = body.split(/(?=\\(?:STATE|IF|FOR|WHILE|ENDIF|ENDFOR|ENDWHILE|ELSE))/g).filter((s: string) => s.trim().length > 0);
        let html = '<div class="latex-algorithm">';
        let lineNum = 1;
        let indentLevel = 0;

        const parseLine = (line: string): string => {
            let lineContent = line.trim();
            if (lineContent.startsWith('\\STATE')) lineContent = lineContent.replace(/^\\STATE\s*/, '');

            let currentIndent = indentLevel;
            if (/^\\IF/i.test(lineContent) || /^\\FOR/i.test(lineContent) || /^\\WHILE/i.test(lineContent)) {
                indentLevel++;
            } else if (/^\\ENDIF/i.test(lineContent) || /^\\ENDFOR/i.test(lineContent) || /^\\ENDWHILE/i.test(lineContent)) {
                indentLevel--;
                currentIndent = indentLevel;
            } else if (/^\\ELSE/i.test(lineContent)) {
                currentIndent = indentLevel - 1;
            }

            let formatted = parseLatexFormatting(lineContent, blocks);
            formatted = formatted
                .replace(/^\\(ENDIF|ENDFOR|ENDWHILE|ELSE)/i, match => `<span class="latex-alg-keyword">${match.substring(1).toLowerCase()}</span>`)
                .replace(/\\IF(?![a-zA-Z])/i, '<span class="latex-alg-keyword">if</span>')
                .replace(/\\FOR(?![a-zA-Z])/i, '<span class="latex-alg-keyword">for</span>')
                .replace(/\\WHILE(?![a-zA-Z])/i, '<span class="latex-alg-keyword">while</span>')
                .replace(/\\IF\s*\{([^}]+)\}/i, '<span class="latex-alg-keyword">if</span> $1 <span class="latex-alg-keyword">then</span>')
                .replace(/\\FOR\s*\{([^}]+)\}/i, '<span class="latex-alg-keyword">for</span> $1 <span class="latex-alg-keyword">do</span>')
                .replace(/\\WHILE\s*\{([^}]+)\}/i, '<span class="latex-alg-keyword">while</span> $1 <span class="latex-alg-keyword">do</span>');

            return `<div class="latex-alg-line" style="padding-left: ${currentIndent * 1.5}em">
                      <span class="latex-alg-lineno">${lineNum++}.</span>
                      <span class="latex-alg-content">${formatted}</span>
                    </div>`;
        };

        commands.forEach(cmd => { html += parseLine(cmd); });
        html += '</div>';
        const id = `LATEXPREVIEWALGO${pipelineBlockCount++}`;
        blocks[id] = html;
        return `\n\n${id}\n\n`;
    });

    // 11. ENVIRONMENT NORMALIZATION (Theorems & Abstracts)
    const createEnvPlaceholder = (cls: string, title: string, body: string) => {
        const id = `LATEXPREVIEWENV${pipelineBlockCount++}`;
        blocks[id] = `<div class="${cls}"> ${title} ${parseLatexFormatting(body.trim(), blocks)}</div> `;
        return `\n\n${id}\n\n`;
    };

    // Abstract
    processed = processed.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (m, body) => {
        const id = `LATEXPREVIEWENV${pipelineBlockCount++}`;
        // Standard academic abstract styling
        blocks[id] = `<div class="abstract" style="margin: 2em 3em; font-size: 0.9em;">
            <div style="text-align: center; font-weight: bold; margin-bottom: 0.5em;">Abstract</div>
            ${parseLatexFormatting(body.trim(), blocks)}
        </div>`;
        return `\n\n${id}\n\n`;
    });

    // Keywords
    processed = processed.replace(/\\keywords\{([^}]*)\}/g, (m, kw) => {
        const id = `LATEXPREVIEWENV${pipelineBlockCount++}`;
        blocks[id] = `<div class="keywords" style="margin: 1em 3em; font-size: 0.9em;">
            <strong>Keywords:</strong> ${parseLatexFormatting(kw.trim(), blocks)}
        </div>`;
        return `\n\n${id}\n\n`;
    });

    processed = processed.replace(/\\begin\{theorem\}([\s\S]*?)\\end\{theorem\}/g, (m, body) => createEnvPlaceholder('theorem', '<strong>Theorem.</strong>', body));
    processed = processed.replace(/\\begin\{lemma\}([\s\S]*?)\\end\{lemma\}/g, (m, body) => createEnvPlaceholder('lemma', '<strong>Lemma.</strong>', body));
    processed = processed.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, (m, body) => createEnvPlaceholder('proof', '<em>Proof.</em>', body + ' <span style="float:right;">∎</span>'));
    processed = processed.replace(/\\begin\{definition\}([\s\S]*?)\\end\{definition\}/g, (m, body) => createEnvPlaceholder('definition', '<strong>Definition.</strong>', body));


    // 12. PARAGRAPHS & HEADERS (Visual)
    processed = processed.replace(/\\section\*?\s*\{([\s\S]*?)\}/g, '<h2>$1</h2>');
    processed = processed.replace(/\\subsection\*?\s*\{([\s\S]*?)\}/g, '<h3>$1</h3>');
    processed = processed.replace(/\\subsubsection\*?\s*\{([\s\S]*?)\}/g, '<h4>$1</h4>');
    processed = processed.replace(/\\paragraph\*?\s*\{([\s\S]*?)\}/g, '<strong>$1</strong> ');

    processed = processed.split(/\n\n+/).filter(p => p.trim()).map(para => {
        para = para.trim();
        if (!para) return '';
        if (para.match(/^<h[1-6]/)) return para;
        if (para.startsWith('LATEXPREVIEW')) return para;
        return `<p>${parseLatexFormatting(para, blocks)}</p>`;
    }).join('\n');


    // 13. HEADER GENERATION
    const headerHtml = `
        ${title ? `<h1 class="title">${title}</h1>` : ''}
        ${author ? `<div class="author">${author}</div>` : ''}
        ${date ? `<div class="date">${date}</div>` : ''}
    `;
    processed = headerHtml + processed;

    // 14. INJECTION (Re-Unification)
    // We do multiple passes to handle nested blocks (Lists inside Tables inside Lists)
    let dirty = true;
    let loops = 0;
    while (dirty && loops < 5) {
        dirty = false;
        processed = processed.replace(/(LATEXPREVIEW[A-Z]+[0-9]+)/g, (match) => {
            if (blocks[match]) {
                return blocks[match]; // Just replace one level?
                // Actually, if we replace one level, the result might contain MORE placeholders.
                // The loop handles that.
            }
            return match;
        });
        // Check if any placeholders remain
        if (processed.match(/LATEXPREVIEW[A-Z]+[0-9]+/)) dirty = true;
        loops++;
    }

    return {
        html: processed,
        blocks,
        bibliographyHtml: citationRes.bibliographyHtml,
        hasBibliography: citationRes.hasBibliography
    };
}
