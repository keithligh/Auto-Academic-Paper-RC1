# OpenRouter API Integration Guide

## Overview
OpenRouter provides a unified interface to many models. For the Research Agent, we leverage its **Web Search** capabilities, which can be accessed via model suffixes or plugins.

## Connection Details
- **Base URL**: `https://openrouter.ai/api/v1`
- **Authentication**: Bearer Token (`OPENROUTER_API_KEY`)
- **Library**: Standard `openai` Node.js library (or native `fetch` for reliability)

## Enabling Web Search
There are two primary ways to enable web search for OpenRouter models:

### 1. Model Suffix (Recommended)
Append `:online` to the model ID. This is the simplest method and works for many models.
- Example: `openai/gpt-4o:online`
- Example: `openai/gpt-oss-20b:free:online`

### 2. Web Plugin
Explicitly include the `plugins` parameter in the request body. This allows for more customization (e.g., choosing the search engine).

```json
{
  "model": "openai/gpt-4o",
  "plugins": [
    {
      "id": "web",
      "engine": "exa", // Optional: "native", "exa", or undefined
      "max_results": 5,
      "search_prompt": "Some relevant web results:" // Optional custom prompt
    }
  ]
}
```

## Engine Selection
- **`native`**: Uses the model provider's built-in web search (OpenAI, Anthropic, Perplexity, xAI).
- **`exa`**: Uses Exa's search API.
- **`undefined`**: Defaults to native if available, otherwise Exa.

## Parsing Results
Web search results are standardized by OpenRouter to follow the OpenAI Chat Completion Message annotation schema:

```json
{
  "message": {
    "role": "assistant",
    "content": "Here's the latest news I found: ...",
    "annotations": [
      {
        "type": "url_citation",
        "url_citation": {
          "url": "https://www.example.com/web-search-result",
          "title": "Title of the web search result",
          "content": "Content of the web search result",
          "start_index": 100,
          "end_index": 200
        }
      }
    ]
  }
}
```
*Note: We can also rely on the model integrating the search results directly into its text response.*

## Search Context Size (Native Search)
For models with native search, you can specify the context size:

```typescript
// Example payload structure
{
  "model": "openai/gpt-4.1",
  "messages": [...],
  "web_search_options": {
    "search_context_size": "high" // "low", "medium", or "high"
  }
}
```

## Pricing
- **Exa Search**: $4 per 1000 results (approx $0.02 per request with default 5 results).
- **Native Search**: Passthrough pricing from the provider (varies by context size).

## Code Example (Fetch Implementation)
Using native `fetch` is recommended to avoid SDK compatibility issues with plugins.

```typescript
const payload = {
    model: "openai/gpt-4o:online",
    messages: [{ role: "user", content: "Latest news on AI" }],
    // To use specific plugin options, include them in the top level:
    // plugins: [{ id: "web", engine: "exa" }]
};

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://github.com/keithligh/Auto-Academic-Paper",
        "X-Title": "Auto-Academic-Paper"
    },
    body: JSON.stringify(payload)
});
```
