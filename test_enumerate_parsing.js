
const testInput = `
Background content...
\\begin{enumerate}
  \\item First Item
  \\item Second Item
  \\begin{enumerate}
    \\item Nested A
    \\item Nested B
  \\end{enumerate}
  \\item Third Item
\\end{enumerate}
Final content.
`;

function parseLatexFormatting(text) {
    return text.trim(); // Mock formatter
}

function processEnumerate(content) {
    let placeholders = [];

    // Regex to match an enumerate block that does NOT contain another \\begin{enumerate}
    // This targets the "leaf" nodes (deepest nested lists) first.
    const leafRegex = /\\begin\{enumerate\}((?:(?!\\begin\{enumerate\}).)*?)\\end\{enumerate\}/s;

    while (true) {
        const match = content.match(leafRegex);
        if (!match) break;

        const fullMatch = match[0];
        const innerContent = match[1];

        // Parse items
        // Split by \item, filter empty
        const items = innerContent.split(/\\item\s+/).filter(i => i.trim());

        // Build HTML
        const listHtml = `<ol class="latex-enumerate">\n` +
            items.map(item => `  <li>${parseLatexFormatting(item)}</li>`).join('\n') +
            `\n</ol>`;

        // Store placeholder
        const id = `__ENUMERATE_${placeholders.length}__`;
        placeholders.push({ id, html: listHtml });

        // Replace in content
        content = content.replace(fullMatch, id);
    }

    // Resolve placeholders (Reverse order? No, string replace works)
    // But we might have nested placeholders: <li>__ENUMERATE_0__</li>
    // So we just replace all placeholders in the final string? 
    // Or do we need to recursive resolve? 
    // Since we replaced the inner block with an ID, the outer block parsed that ID as an item content.
    // So `<li>Item with __ENUMERATE_0__</li>`.

    // We need a final pass to swap IDs back to HTML.
    // Since IDs are simple strings, we can loop.

    // However, we replaced from Inside-Out.
    // Content: "__ENUMERATE_1__" (Outer list referencing Inner list)

    // We need to resolve recursively or iteratively?
    // Iteratively replacing all placeholders until none remain?

    let hasPlaceholder = true;
    while (hasPlaceholder) {
        hasPlaceholder = false;
        placeholders.forEach(p => {
            if (content.includes(p.id)) {
                content = content.replace(p.id, p.html);
                hasPlaceholder = true;
            }
        });
        // Safety break
        if (!placeholders.some(p => content.includes(p.id))) break;
    }

    return content;
}

console.log(processEnumerate(testInput));
