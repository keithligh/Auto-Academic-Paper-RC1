import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
console.log('Type:', typeof pdfParse);
console.log('Keys:', Object.keys(pdfParse).length > 0 ? Object.keys(pdfParse) : 'none');
console.log('Is function:', typeof pdfParse === 'function');
console.log('Has default:', pdfParse.default !== undefined);
if (pdfParse.default) {
  console.log('Default type:', typeof pdfParse.default);
}
