# Testing Align* Extraction Issue

## Scenario: Nested Display Math

If the LaTeX source has:
```latex
\begin{align*}
  x &= 1 \\
  \[ y = 2 \]
  z &= 3
\end{align*}
```

### Current Extraction Order:
1. **Step 1**: Extract `\[...\]` → `LATEXPREVIEWMATH0`
   ```latex
   \begin{align*}
     x &= 1 \\
     LATEXPREVIEWMATH0
     z &= 3
   \end{align*}
   ```

2. **Step 2**: Extract `align*` → Pass entire block to KaTeX
   - KaTeX receives: `\begin{align*} x &= 1 \\ LATEXPREVIEWMATH0 z &= 3 \end{align*}`
   - KaTeX tries to parse "LATEXPREVIEWMATH0" as LaTeX math
   - **FAIL**: "LATEXPREVIEWMATH0" is not valid LaTeX!

## The Problem

**You cannot nest `\[...\]` inside `align*` in LaTeX!** This is invalid syntax. But if the AI generates it (or if there's similar nesting), the extraction order causes:

1. Inner math gets extracted first
2. Outer align* contains placeholder text
3. KaTeX fails to render the placeholder
4. With `throwOnError: false`, KaTeX renders an error (possibly in red)

## Solution

**FIX THE EXTRACTION ORDER**: `align*`/`equation`/etc. should be extracted BEFORE standalone `\[...\]` blocks, because:
- Alignment environments are higher-level structures
- They handle their own math internally
- `\[...\]` is a simpler display math that should only be used standalone
