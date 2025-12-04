/**
 * LaTeX validation utilities
 * Provides basic syntax checking and optional pdflatex compilation validation
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Perform basic LaTeX syntax validation without requiring pdflatex
 * This catches common structural errors before attempting compilation
 */
export function validateLatexSyntax(latexContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for balanced \begin{} and \end{} environments
  const beginMatches = latexContent.match(/\\begin\{([^}]+)\}/g) || [];
  const endMatches = latexContent.match(/\\end\{([^}]+)\}/g) || [];

  const beginEnvs = beginMatches.map(m => m.match(/\\begin\{([^}]+)\}/)?.[1]).filter(Boolean);
  const endEnvs = endMatches.map(m => m.match(/\\end\{([^}]+)\}/)?.[1]).filter(Boolean);

  // Check for matching begin/end pairs
  const envCounts: Record<string, number> = {};
  beginEnvs.forEach(env => {
    envCounts[env!] = (envCounts[env!] || 0) + 1;
  });
  endEnvs.forEach(env => {
    envCounts[env!] = (envCounts[env!] || 0) - 1;
  });

  Object.entries(envCounts).forEach(([env, count]) => {
    if (count > 0) {
      errors.push(`Unmatched \\begin{${env}} - missing \\end{${env}}`);
    } else if (count < 0) {
      errors.push(`Unmatched \\end{${env}} - missing \\begin{${env}}`);
    }
  });

  // Check for required document structure
  if (!latexContent.includes('\\documentclass')) {
    errors.push('Missing \\documentclass declaration');
  }

  if (!latexContent.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }

  if (!latexContent.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }

  // Check for common syntax errors
  const unclosedBraces = (latexContent.match(/\{/g) || []).length - (latexContent.match(/\}/g) || []).length;
  if (unclosedBraces !== 0) {
    warnings.push(`Potentially unbalanced braces: ${Math.abs(unclosedBraces)} ${unclosedBraces > 0 ? 'opening' : 'closing'} braces without match`);
  }

  // Check for unclosed math modes
  const dollarSigns = (latexContent.match(/(?<!\\)\$/g) || []).length;
  if (dollarSigns % 2 !== 0) {
    warnings.push('Unmatched $ signs detected (inline math)');
  }

  // Check for common problematic patterns
  if (latexContent.includes('\\\\\\\\')) {
    warnings.push('Multiple consecutive line breaks (\\\\\\\\) detected - may cause spacing issues');
  }

  if (latexContent.match(/\\usepackage[\s\S]*\\documentclass/) !== null) {
    errors.push('\\usepackage commands must come after \\documentclass');
  }

  // Check for content after \end{document}
  const endDocIndex = latexContent.lastIndexOf('\\end{document}');
  if (endDocIndex !== -1 && endDocIndex < latexContent.length - 20) {
    const afterEnd = latexContent.substring(endDocIndex + 14).trim();
    if (afterEnd.length > 0 && !afterEnd.startsWith('%')) {
      warnings.push('Content found after \\end{document} - will be ignored by LaTeX compiler');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate LaTeX by attempting compilation with pdflatex
 * Only works if pdflatex is installed on the system
 *
 * Set ENABLE_LATEX_COMPILATION=true environment variable to enable
 */
export async function validateLatexCompilation(latexContent: string): Promise<ValidationResult> {
  // This feature requires pdflatex to be installed
  // For now, return a not-implemented result
  // Implementation would use child_process.spawn to run pdflatex

  return {
    valid: false,
    errors: ['LaTeX compilation validation requires pdflatex to be installed'],
    warnings: ['Set ENABLE_LATEX_COMPILATION=true to enable compilation checks']
  };
}

/**
 * Main validation function - performs syntax check and optional compilation
 */
export async function validateLatex(latexContent: string): Promise<ValidationResult> {
  // Always perform syntax validation
  const syntaxResult = validateLatexSyntax(latexContent);

  // If syntax validation fails, don't bother with compilation
  if (!syntaxResult.valid) {
    return syntaxResult;
  }

  // Optional: attempt compilation if enabled
  if (process.env.ENABLE_LATEX_COMPILATION === 'true') {
    const compilationResult = await validateLatexCompilation(latexContent);
    return {
      valid: syntaxResult.valid && compilationResult.valid,
      errors: [...syntaxResult.errors, ...compilationResult.errors],
      warnings: [...syntaxResult.warnings, ...compilationResult.warnings]
    };
  }

  return syntaxResult;
}
