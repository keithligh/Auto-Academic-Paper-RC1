
## 62. The Preamble Pollution Principle (Crash Prevention)
- **Incident**: The regex parser choked on `\usepackage[...sort&compress...]` because of the special character `&`.
- **Root Cause**: We allowed Preamble processing, even though the browser preview mocks styles via CSS.
- **Lesson**: **If you don't need it, delete it.** The Preamble is for the LaTeX Engine, not the Preview Engine. Aggressively strip all `\usepackage` and `\documentclass` commands to prevent syntax collisions. "Mocking" means ignoring the source of truth, not parsing it.

## 63. The Text-Mode Syntax Gap (Typography)
- **Incident**: `105{,}000` rendered literally as `105{,}000`.
- **Root Cause**: LaTeX uses math syntax (`{}`) in text mode to control spacing. HTML sees this as literal text.
- **Lesson**: **Sanitization is Typography.** You cannot just "escape HTML". You must also "translate typography". A Global Replacement Layer (`{,}` -> `,`) is mandatory for bridging the gap between TeX's strict spacing rules and HTML's loose ones.
