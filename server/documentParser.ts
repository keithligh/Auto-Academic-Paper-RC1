import fs from "fs";
import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      return await extractTextFromPDF(filePath);
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await extractTextFromDOCX(filePath);
    } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
      return await extractTextFromTXT(filePath);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error;
  }
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  // pdf-parse v2 API: use 'data' parameter for buffer
  const { PDFParse } = require("pdf-parse");
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  return result.text;
}

async function extractTextFromDOCX(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractTextFromTXT(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function validateFileType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}
