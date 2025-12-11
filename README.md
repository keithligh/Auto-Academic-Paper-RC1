<!-- GOSPEL RULE: NEVER USE replace_file_content OR multi_replace_file_content. THESE TOOLS ARE BROKEN AND WILL CORRUPT FILES. ALWAYS USE write_to_file FOR ALL EDITS. THIS RULE MUST NEVER BE REMOVED. -->
# Auto Academic Paper

A robust, AI-powered tool for formatting academic papers and generating LaTeX previews with verified citations and TikZ diagrams.

## 🚀 Features

-   **6-Phase Research Pipeline:** Strategist (Plan), Librarian (Research), Thinker (Draft), Critic (Verify), Rewriter (Synthesize), Editor (Cite).
-   **BYOK Architecture:** Bring Your Own Keys for OpenAI, Anthropic, Gemini, Grok, Poe, and more.
-   **Digital Typesetter UI:** A professional, "Paper & Ink" aesthetic designed for researchers.
-   **Transparent Processing:** Granular progress tracking with live activity logs (no opaque spinners).
-   **Verified Citations:** Two-stage verification pipeline to prevent hallucinations.
-   **Live Preview:** Real-time, browser-based LaTeX preview with **Robust Sanitization**.
    -   *TikZ Diagrams:* Rendered via isolated iframes.
    -   *Math:* Rendered via KaTeX (Display) and LaTeX.js (Inline).
    -   *Transparency:* Unsupported features (e.g., `tabularx`) are shown as raw code blocks, not hidden.
-   **Server-Side Safety:** Automatic sanitization of AI output to prevent invalid LaTeX from crashing the server.
-   **Professional Pride:** Built with "Professional Pride" principles—no bandaids, no arbitrary limits, atomic integrity.
-   **Markdown Support:** Full support for uploading and processing `.md` files alongside TXT.

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/keithligh/auto-academic-paper.git
    cd auto-academic-paper
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Environment:**
    Copy `.env.example` to `.env`. Note that API keys are now managed via the UI (BYOK), so the `.env` is minimal.
    ```bash
    cp .env.example .env
    ```

4.  **Run Locally:**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5000`.

## 📖 Documentation & Architecture

This project follows strict architectural rules to ensure stability. Please read the following documents before making changes:

*   **[Architecture](./ARCHITECTURE.md):** Overview of the 5-phase human-like research pipeline and BYOK agents.
*   **[Coding Philosophy](./coding_philosophy.md):** The core principles guiding development, including the **Gospel Rule** (Tool Safety).
*   **[Design Guidelines](./design_guidelines.md):** UI/UX standards for the application.

## ⚖️ License & Usage

This project is publicly available for educational and reference purposes.
**Note:** Contributions are currently **not accepted**. This repository is maintained as a stable reference implementation.

## 🏗️ Tech Stack

-   **Frontend:** React, TypeScript, TailwindCSS, Wouter
-   **Backend:** Express, NodeJS
-   **LaTeX Rendering:** latex.js, TikZJax (WASM via CDN), KaTeX
-   **AI Providers:** 
    -   **Direct:** OpenAI, Anthropic, Google Gemini, xAI (Grok), Ollama
    -   **Proxy:** Poe API (access to Claude, Gemini, etc.)

---
*Last Updated: 2025-12-04 (v1.1.0)*
