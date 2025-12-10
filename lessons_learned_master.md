
## 65. The Code-Doc Divergence (The "Missing Fix" Trap)
- **Incident**: A critical TikZ fix (Percent Stripping) was well-documented in `TIKZ_HANDLING.md` (v1.9.25) but completely missing from the actual `tikz-engine.ts` codebase.
- **Root Cause**: Likely a copy-paste error during a refactor where an older version of the file was used, or the documentation was written "ahead of the code" and the implementation was forgotten.
- **Lesson**: **Documentation is not Proof.** When debugging, never assume the code matches the documentation. Believe the code (or the lack thereof). Always verify that documented "fixes" are actually present in the runtime files.
