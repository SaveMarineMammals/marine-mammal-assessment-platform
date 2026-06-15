export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
  code?: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type ValidationMode = 'draft' | 'complete';

export interface ValidationOptions {
  /** draft allows missing assessment_ended_at; complete requires it before sync */
  mode?: ValidationMode;
  /** When true (default), out-of-range vitals produce warnings instead of blocking */
  collectWarnings?: boolean;
}

export function successResult<T>(data: T, warnings: ValidationIssue[] = []): ValidationResult<T> {
  return { success: true, data, errors: [], warnings };
}

export function failureResult<T>(
  errors: ValidationIssue[],
  warnings: ValidationIssue[] = [],
): ValidationResult<T> {
  return { success: false, errors, warnings };
}

export function issue(
  path: string,
  message: string,
  severity: ValidationSeverity = 'error',
  code?: string,
): ValidationIssue {
  return { path, message, severity, code };
}
