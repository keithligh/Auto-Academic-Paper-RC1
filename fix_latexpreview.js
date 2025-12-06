const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('client/src/components/LatexPreview.tsx');
const content = fs.readFileSync(targetFile, 'utf8');
const lines = content.split('\n');

// Target lines: 622 to 706 (1-indexed) => 621 to 705 (0-indexed)
const startLine0 = 621;
const endLine0 = 705;

// Verification
const expectedStart = '// --- F. TABLES (Standard) ---';
const foundStart = lines[startLine0].trim();

console.log(`Checking line ${startLine0 + 1}: Expected "${expectedStart}", Found "${foundStart}"`);

if (foundStart === expectedStart) {
    console.log(`Deleting lines ${startLine0 + 1} to ${endLine0 + 1}...`);
    lines.splice(startLine0, endLine0 - startLine0 + 1);
    fs.writeFileSync(targetFile, lines.join('\n'));
    console.log('Successfully removed duplicate block.');
} else {
    console.error('ABORTING: Line mismatch. File may have changed.');
    process.exit(1);
}
