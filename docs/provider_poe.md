# Poe API Integration Guide

## Overview
Poe is a primary provider for the **Auto Academic Paper** system, particularly for the **Librarian Agent** and **Peer Reviewer** due to its access to search-capable bots like Google Gemini. We connect to Poe using its **OpenAI-compatible API**.

## Connection Details
- **Base URL**: `https://api.poe.com/v1/chat/completions`
- **Authentication**: Bearer Token (User's API Key)
- **Library**: Standard `openai` Node.js library or raw `fetch`

## Custom Bots (v1.9.60+)

As of v1.9.60, we use **Custom Poe Bots** for the Librarian and Peer Reviewer phases. These bots are pre-configured with web search capabilities, eliminating the need for unreliable API parameter injection.

### Available Custom Bots

| Bot Name | Base Model | Web Search | Recommended Use |
|----------|------------|------------|-----------------|
| `Gemini25Pro-AAP` | Gemini 2.5 Pro | ✅ Pre-configured | **Librarian** (Research), **Peer Reviewer** (Fact-checking) |
| `Gemini25Flash-APP` | Gemini 2.5 Flash | ✅ Pre-configured | Quick queries, cost-sensitive tasks |

> **Note**: The bot names use different suffixes (`-AAP` vs `-APP`). This is intentional based on the bot creation on Poe.

### Why Custom Bots?

1. **Reliability**: The `parameters.web_search` API injection was unreliable across Poe API versions.
2. **Simplicity**: No need to manage whitelists or parameter injection logic.
3. **Control**: We own the bot definition and can modify its behavior directly on Poe.

**Lesson 78**: *"Don't fight the API. Own the asset."* If a platform's API doesn't reliably expose a feature, create a custom instance pre-configured with that feature.

## Web Search Activation

For custom bots, **web search is activated via the prompt, not API parameters**.

```typescript
// Phase 4 Peer Reviewer Prompt (v1.9.62)
const systemPrompt = `You have WEB SEARCH access. USE IT to verify claims against current literature.`;
```

**Lesson 80**: *"For custom bots, features are activated by instruction, not by API parameters."*

## JSON Handling (Defensive Parsing)

Flash models (`Gemini25Flash-APP`) may output malformed JSON:

**Example Problem**:
```json
"found": false
```
Instead of:
```json
{ "found": false }
```

**Solution**: `extractJson()` in `server/ai/utils.ts` auto-wraps bare key-value pairs:
```typescript
if (/^\s*"[^"]+"\s*:/.test(clean)) {
    return JSON.parse(`{${clean}}`);
}
```

**Lesson 79**: *"Assume LLMs will fail your formatting instructions."* Defensive parsing is standard practice.

## Phase Usage

| Phase | Agent | Provider | Model (Default) | Web Search |
|-------|-------|----------|-----------------|------------|
| Phase 2 | Librarian | Poe | `Gemini25Pro-AAP` | ✅ Yes (via prompt) |
| Phase 4 | Peer Reviewer | Poe (Librarian LLM) | `Gemini25Pro-AAP` | ✅ Yes (via prompt) |

## Legacy: API Parameter Injection (Deprecated)

The old approach used `parameters.web_search` injection:

```typescript
// DEPRECATED - Use custom bots instead
if (enableWebSearch) {
    messages[1].parameters = { web_search: true };
}
```

This is unreliable and has been superseded by custom bot integration.

## Supported Writer/Strategist Models (Dec 2025)
For the Writer and Strategist agents, we recommend the following high-intelligence models available on Poe:

*   **Claude-Sonnet-4.5**: Anthropic's latest agentic model (1M context).
*   **Claude-Opus-4.5**: Maximum intelligence model.
*   **GPT-5.1**: OpenAI's latest flagship.

## Important Notes
- **Rate Limits**: Subject to Poe's API limits.
- **Points**: Deducted from the API key owner's account.
- **Context Window**: Depends on the underlying bot/model.
