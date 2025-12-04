# OpenAI API Integration Guide

## Overview
OpenAI provides powerful text generation models (e.g., GPT-5.1, o3-pro) but **does NOT support native web search** via the API.

> **CRITICAL WARNING**: OpenAI models cannot be used for the **Research Agent** because they lack online search capabilities. They are strictly for the **Writer** and **Editor** agents.

## Connection Details
- **Base URL**: `https://api.openai.com/v1`
- **Authentication**: Bearer Token (`OPENROUTER_API_KEY` or `OPENAI_API_KEY`)
- **Library**: `openai` Node.js library

## Recommended Models (Dec 2025)
*   **GPT-5.1**: Current flagship model.
*   **o3-pro**: Best for complex reasoning, math, and coding.
*   **o3-mini**: Cost-effective reasoning.

## API Usage (Responses API)
The recommended API for text generation is the **Responses API**.

### Code Example

```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
    model: "gpt-5.1", // Updated model ID
    input: "Write a summary of..."
});

console.log(response.output_text);
```

### Structured Outputs
OpenAI supports structured JSON outputs, which is essential for our Writer/Editor agents.

```javascript
const response = await client.responses.create({
    model: "gpt-5.1",
    input: "...",
    response_format: { type: "json_object" } // or json_schema
});
```

## Important Notes
- **No Search**: Do not attempt to pass web search flags or plugins.
- **Reasoning Models**: Models like `o3-pro` are available but also do not support web search in this API.
