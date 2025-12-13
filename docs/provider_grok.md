# xAI (Grok) Provider Setup

The Auto Academic Paper Generator supports xAI's Grok models, including the high-speed `grok-4-1-fast` and its reasoning variants. This provider is fully compatible with the **Librarian's Agentic Search** capabilities.

## 1. Get your API Key
1.  Sign up at [console.x.ai](https://console.x.ai/).
2.  Generate a new API Key.
3.  Add it to your `.env` file:
    ```env
    XAI_API_KEY=xai-................................
    ```

## 2. Supported Models

| Model | Use Case | Search Capable? |
| :--- | :--- | :--- |
| `grok-4-1-fast` | **Recommended**. Extremely fast, balanced reasoning. | ✅ Yes (Agentic) |
| `grok-4-1-fast-non-reasoning` | Pure speed, less internal monologue. Good for simple queries. | ✅ Yes (Agentic) |
| `grok-beta` | Legacy beta model. | ❌ Chat Only |

## 3. Configuration in App

### For General Roles (Writer, Strategist)
1.  Go to **AI Configuration**.
2.  Select **xAI (Grok)** as the provider.
3.  Enter your model ID manualy if needed, or use the defaults.

### For The Librarian (Research)
**Grok is a top-tier choice for the Librarian due to its native web search integration.**

1.  Go to **AI Configuration** -> **The Librarian**.
2.  Select **xAI (Grok)**.
3.  Use the **Dropdown Menu** to select `grok-4-1-fast` (Recommended).
4.  The system will automatically use xAI's "Agentic Search" endpoint (`/responses`) to perform live research.

## 4. Agentic Search Capabilities
When used by the Librarian, Grok does not just autocomplete text. It acts as an agent:
1.  **Iterative Research**: It creates its own search queries.
2.  **Web Browsing**: It reads pages to find specific evidence.
3.  **Citation**: It returns verified sources which the system adds to your "Card Catalog".

## Troubleshooting
-   **404 Not Found**: Ensure you are using a model that supports the Research endpoint (`grok-4-1-fast`). Older models may fail if "Web Search" is enabled.
-   **API Key Error**: Verify `XAI_API_KEY` is loaded in `.env`.
