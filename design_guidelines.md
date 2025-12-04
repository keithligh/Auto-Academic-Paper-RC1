<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Design Guidelines: Auto Academic Paper

## Design Approach

**Core Aesthetic**: "The Digital Typesetter" / "Paper & Ink"
-   **Vibe**: Professional, precise, academic, trustworthy.
-   **Headings / Content**: `Merriweather` (Serif) - Evokes the feel of a printed journal.
-   **UI / Controls**: `Inter` (Sans-serif) - Clean, modern, legible at small sizes.
-   **Data / Logs**: `JetBrains Mono` or `Consolas` - Technical, precise.

### Colors
-   **Background**: White (`#ffffff`) or subtle off-white (`#fafafa`).
-   **Foreground**: Ink Black (`#111111`) or Dark Gray (`#333333`).
-   **Accents**:
    -   **Processing**: Green (`#22c55e`) for success, Amber (`#f59e0b`) for warnings.
    -   **Error**: Editorial Red (`#ef4444`).
    -   **Borders**: Light Gray (`#e5e7eb`).

---

## Page Layouts

### 1. Landing Page ("The Desk")
-   **Goal**: minimal friction upload.
-   **Elements**:
    -   **Hero**: "Auto Academic Paper" (Serif, Large).
    -   **Upload Zone**: Central, prominent, dashed border.
    -   **Features**: 3-column grid (Analysis, Enhancements, LaTeX).

### 2. Processing Page ("The Console")
-   **Primary**: Black background, White text, sharp corners or slightly rounded (`rounded-md`).
-   **Secondary**: White background, Black border, Black text.
-   **Destructive**: Red text, Red border/background.

### 3. Preview Page ("The Proof")
-   **Goal**: Transparency and Verification.
-   **Principle: Preview Transparency**:
    -   **Unsupported Features**: If a LaTeX feature (e.g., `tabularx`) cannot be rendered in the browser, **show the raw code** in a styled block.
    -   **Do Not Hide**: Never hide content just because it can't be rendered. The user must see that the data exists.
    -   **Do Not Fake**: Do not use "approximate" HTML tables if they might be misleading.

### Status Indicators
-   **Processing**: Pulsing green dot.
-   **Stalled**: Pulsing amber indicator.
-   **Failed**: Static red icon.

### Animations
-   **Style**: "Snap" or "Fade". No bouncy, springy motion.
-   **Duration**: Fast (200ms).