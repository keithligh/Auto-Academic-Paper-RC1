# OpenRouter API Integration Guide

## Overview
OpenRouter provides a unified interface to many models. For the Research Agent, we leverage its **Web Search** capabilities, which can be accessed via model suffixes or plugins.

## Connection Details
- **Base URL**: `https://openrouter.ai/api/v1`
- **Authentication**: Bearer Token (`OPENROUTER_API_KEY`)
- **Library**: Standard `openai` Node.js library

## Enabling Web Search
There are two primary ways to enable web search for OpenRouter models:

### 1. Model Suffix (Recommended)
Append `:online` to the model ID. This is the simplest method and works for many models.
- Example: `openai/gpt-4o:online`
- Example: `google/gemini-pro-1.5:online`

### 2. Web Plugin
Explicitly include the `plugins` parameter in the request body. This allows for more customization (e.g., choosing the search engine).

```json
{
  "model": "openai/gpt-4o",
  "plugins": [
    {
      "id": "web",
      "engine": "exa", // or "native"
      "max_results": 5
    }
  ]
}
```

## Parsing Results
Search results are returned in the `message.content` (integrated by the model) or as `annotations` in the response object if using the plugin directly.
*Note: For our application, we primarily rely on the model integrating the search results into its text response.*

## Code Example (OpenAI Compatible)

```typescript
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://your-site.com", // Optional
        "X-Title": "Auto Academic Paper" // Optional
    }
});

// Method 1: Suffix
const response = await client.chat.completions.create({
    model: "openai/gpt-4o:online",
    messages: [{ role: "user", content: "Latest news on AI" }]
});

// Method 2: Plugin (requires extra_body)
const responsePlugin = await client.chat.completions.create({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content: "Latest news on AI" }],
    extra_body: {
        plugins: [{ id: "web" }]
    }
});
```

## Important Notes
- **Pricing**: Web search incurs extra costs (e.g., Exa search is $4/1000 results).
- **Native vs. Exa**: Native search is used by default for supported providers (OpenAI, Perplexity, etc.). Exa is used for others.
