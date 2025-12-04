# Ollama API Integration Guide

## Overview
Ollama allows running LLMs locally. It provides a REST API for interaction. It **does NOT support native web search** via the API.

> **CRITICAL WARNING**: Ollama models cannot be used for the **Research Agent** because they lack online search capabilities. They are strictly for the **Writer** and **Editor** agents.

## Connection Details
- **Base URL**: `http://localhost:11434/api` (Default)
- **Authentication**: None required by default.
- **Endpoints**:
    - Chat: `/chat`
    - Generate: `/generate`

## API Usage (Chat)

### Code Example (Raw HTTP)

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "why is the sky blue?" }
  ],
  "stream": false
}'
```

### JSON Mode
Ollama supports forcing JSON output, which is useful for the Writer/Editor agents.

```json
{
  "model": "llama3.2",
  "prompt": "Respond using JSON...",
  "format": "json",
  "stream": false
}
```

## Important Notes
- **Local Execution**: Ensure the Ollama server is running.
- **No Search**: The API does not have a web search tool.
