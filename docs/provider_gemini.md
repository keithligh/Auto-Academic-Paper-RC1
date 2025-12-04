# Gemini API Integration Guide

## Overview
Google's Gemini API provides access to models like Gemini 2.5 Flash and Pro. While the platform offers various tools, for the purpose of this application, **we do NOT use Gemini for the Research Agent**.

> **CRITICAL WARNING**: Gemini models must **not** be used for the **Research Agent**. They are strictly for the **Writer** and **Editor** agents.

## Connection Details
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta`
- **Authentication**: `x-goog-api-key` header or query param
- **Library**: `@google/genai` (Node.js) or standard HTTP requests

## API Usage

### Code Example (Node.js)

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works",
  });
  console.log(response.text);
}
```

## Important Notes
- **No Search**: Do not attempt to use Google Search tools for the Research Agent in this implementation.
- **Structured Outputs**: Supported via `responseSchema` in generation config.
