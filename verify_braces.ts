
import fs from 'fs';

function checkBalancing(text: string) {
    const lines = text.split('\n');
    let braceLevel = 0;
    const stack: { type: string, line: number, name?: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check braces {}
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '{') {
                if (j > 0 && line[j - 1] === '\\') continue; // Escaped \{
                braceLevel++;
                stack.push({ type: '{', line: i + 1 });
            } else if (char === '}') {
                if (j > 0 && line[j - 1] === '\\') continue; // Escaped \}
                braceLevel--;
                if (stack.length > 0 && stack[stack.length - 1].type === '{') {
                    stack.pop();
                } else {
                    console.error(`Error: Unmatched '}' at line ${i + 1}, col ${j + 1}`);
                }
            }
        }

        // Check environments
        const beginMatch = line.match(/\\begin\{([^}]+)\}/);
        if (beginMatch) {
            stack.push({ type: 'env', name: beginMatch[1], line: i + 1 });
        }

        const endMatch = line.match(/\\end\{([^}]+)\}/);
        if (endMatch) {
            const envName = endMatch[1];
            let found = false;
            // Search stack from top
            for (let k = stack.length - 1; k >= 0; k--) {
                if (stack[k].type === 'env' && stack[k].name === envName) {
                    // Pop everything up to this point (assuming proper nesting)
                    // If not properly nested, this simple check might be loose, but good enough for now
                    stack.splice(k, 1);
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.error(`Error: Unmatched \\end{${envName}} at line ${i + 1}`);
            }
        }
    }

    if (stack.length > 0) {
        console.log("Unbalanced items remaining:");
        stack.forEach(item => {
            console.log(`- ${item.type} ${item.name || ''} at line ${item.line}`);
        });
    } else {
        console.log("Braces and environments appear balanced.");
    }
}

const content = fs.readFileSync('debug_sanitized.tex', 'utf-8');
checkBalancing(content);
