# Poe API Integration Guide

## Overview
Poe is a primary provider for the **Auto Academic Paper** system, particularly for the **Librarian Agent** due to its access to search-capable bots like Google Gemini. We connect to Poe using its **OpenAI-compatible API**.

## Connection Details
- **Base URL**: `https://api.poe.com/bot/` (or similar, handled by `openai` lib with custom base URL)
- **Authentication**: Bearer Token (User's API Key)
- **Library**: Standard `openai` Node.js library

## Web Search & Research (Librarian Agent)

The **Librarian Agent** requires a model capable of browsing the internet to verify claims. On Poe, we rely on specific bots that have native web search capabilities enabled.

### Whitelisted Research Models
The system explicitly whitelists the following bots for the Librarian phase. If a user selects a non-whitelisted bot, the research phase will fail or warn.

*   **Gemini-2.5-Pro**: High-reasoning, search-capable model.
*   **Gemini-2.5-Flash**: Faster, search-capable model.

> **Note**: `Gemini-2.0-Flash` was previously supported but has been removed from the whitelist.

### Implementation Strategy
We do **not** use special flags like `--web_search true` in the prompt. Instead, we select a bot that has search enabled by default (like the Gemini bots on Poe) and prompt it to "search for X".

## Code Example (Adapter)

```typescript
// server/ai/adapters/poe.ts

const poeSearchModels = ["Gemini-2.5-Pro", "Gemini-2.5-Flash"];

if (!poeSearchModels.includes(config.model)) {
    throw new Error(`Model ${config.model} is not whitelisted for research on Poe.`);
}

// The prompt explicitly instructs the bot to search
const prompt = "You are a Research Librarian. Search for the following claims...";
```

## Important Notes
- **Rate Limits**: Subject to Poe's API limits.
- **Points**: Deducted from the API key owner's account.
- **Context Window**: Depends on the underlying bot/model.
