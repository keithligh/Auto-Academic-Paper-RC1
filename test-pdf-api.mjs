import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfModule = require('pdf-parse');

console.log('Module keys:', Object.keys(pdfModule));
console.log('\nPDFParse type:', typeof pdfModule.PDFParse);
console.log('PDFParse.prototype:', pdfModule.PDFParse.prototype);

// Check if it's the default export pattern
console.log('\nChecking for default function...');
const moduleKeys = Object.keys(pdfModule);
moduleKeys.forEach(key => {
  const val = pdfModule[key];
  if (typeof val === 'function' && val.name !== 'PDFParse') {
    console.log(`Found function: ${key}, type: ${typeof val}`);
  }
});

// Try to see the actual usage
console.log('\nModule default:', pdfModule.default);
console.log('Module itself callable?', typeof pdfModule === 'function');
