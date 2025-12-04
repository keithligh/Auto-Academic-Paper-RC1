# Anthropic API Integration Guide

## Overview
Anthropic provides the Claude family of models (e.g., Claude 3.5 Sonnet) via the Messages API. It **does NOT support native web search** via the API.

> **CRITICAL WARNING**: Claude models cannot be used for the **Research Agent** because they lack online search capabilities. They are strictly for the **Writer** and **Editor** agents.

## Connection Details
- **Base URL**: `https://api.anthropic.com/v1`
- **Authentication**: `x-api-key` header
- **Library**: `@anthropic-ai/sdk` (Node.js) or standard HTTP requests

## API Usage (Messages API)

### Code Example

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const msg = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1000,
  messages: [
    { role: "user", content: "Write a summary of..." }
  ]
});

console.log(msg.content);
```

## Important Notes
- **No Search**: Do not attempt to pass web search flags or plugins.
- **Thinking Models**: Claude 3.7 Sonnet supports extended thinking, but this is for reasoning, not web search.
