
## 64. The Hallucination Sanitizer (Double Escape Fix)
- **Incident**: AI generated `Sentiment (Fear \\& Greed)` inside a table. The parser saw `\\` (Row Break) followed by `&`.
- **Root Cause**: The parser logic `row.split('\\\\')` is correct for LaTeX, but the AI provided illegal LaTeX (Double Escape).
- **Lesson**: **Sanitize the Input, Don't Complicate the Parser.** Instead of making the row splitter handle `\\\\` lookaheads (complex), we simply replace `\\\\&` with `\\&` (the correct single escape) inside the table body *before* splitting. Fix the data, then parse it.
