# Project Roadmap

**STATUS: STABLE / ACTIVE (v1.1.0)**

The core "5-Phase Pipeline" and "BYOK Architecture" have been successfully implemented and stabilized. The project is a **Local-First, Single-User, BYOK (Bring Your Own Key)** application.

## ✅ Completed Milestones

-   [x] **5-Phase Pipeline:** Thinker -> Critic -> Librarian -> Editor -> Compiler.
-   [x] **BYOK Architecture:** Support for user-provided keys (OpenAI, Anthropic, Poe, etc.).
-   [x] **Streaming Updates:** Granular, real-time progress logs for all phases.
-   [x] **Robustness:** Timeouts, retries, and error handling for AI calls.
-   [x] **UI Overhaul:** "Digital Typesetter" aesthetic and intuitive configuration.
-   [x] **Markdown Support:** Full support for `.md` file uploads.
-   [x] **Local File Access:** "Open Uploads Folder" button for quick access.

## 🚀 Future: Local Enhancements

The focus is on improving the local user experience and expanding local capabilities.

### 1. Local AI Expansion
-   [ ] **Ollama Integration:** Deepen support for fully local models (Llama 3, Mistral) for users with powerful GPUs.
-   [ ] **Local Embeddings:** Use local embedding models for document analysis instead of API calls.

### 2. File Management
-   [ ] **Drag-and-Drop Folders:** Better integration with the user's local file system.
-   [ ] **Export Options:** Direct export to DOCX or Markdown alongside PDF.

### 3. User Experience
-   [ ] **Custom Templates:** Allow users to define their own LaTeX templates.
-   [ ] **Offline Mode:** Ensure the app works completely offline when using local models (Ollama).

## ⚠️ Maintenance Mode

-   **No Bandaids:** Fix root causes only.
-   **Atomic Writes:** Always write full files.
-   **Verify First:** Test changes locally before committing.
