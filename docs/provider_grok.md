# Grok API Integration Guide

## Overview
Grok (xAI) provides an OpenAI-compatible API for standard chat, but uses a **specialized endpoint** for its Agentic Search capabilities (server-side tool use).

## Connection Details
- **Base URL**: `https://api.x.ai/v1`
- **Authentication**: Bearer Token (`XAI_API_KEY`)
- **Standard Chat**: `/chat/completions` (OpenAI compatible)
- **Agentic Search**: `/responses` (Custom endpoint)

## Agentic Search (Research Agent)
To use Grok as a Research Agent, we must use the `/responses` endpoint with the `grok-4-fast` model and server-side tools.

### Endpoint
`POST https://api.x.ai/v1/responses`

### Payload Structure
Unlike the standard OpenAI `messages` array, this endpoint uses `input`.

```json
{
  "model": "grok-4-fast",
  "input": [
    {
      "role": "user",
      "content": "Search query here"
    }
  ],
  "tools": [
    {
      "type": "web_search",
      "filters": {
         "allowed_domains": ["..."] // Optional
      }
    }
  ]
}
```

### Key Differences from OpenAI
1.  **Endpoint**: `/responses` instead of `/chat/completions`.
2.  **Parameter**: `input` instead of `messages`.
3.  **Tools**: Server-side execution is automatic. The response contains the final answer.

## Code Example (Raw HTTP)

```typescript
const response = await fetch("https://api.x.ai/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "grok-4-fast",
    input: [{ role: "user", content: "Latest fusion energy breakthroughs" }],
    tools: [{ type: "web_search" }]
  })
});
```

## Important Notes
- **Model**: Use `grok-4-fast` for best search performance.
- **Citations**: Returned in the response object (if needed, though we primarily want the text).
- **Rate Limits**: Check headers or console.
