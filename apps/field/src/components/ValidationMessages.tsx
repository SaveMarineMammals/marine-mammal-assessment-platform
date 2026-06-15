import type { ValidationIssue } from '@mmap/schema/protocol';

interface ValidationMessagesProps {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

export function ValidationMessages({ errors = [], warnings = [] }: ValidationMessagesProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="validation-messages">
      {errors.length > 0 ? (
        <div className="validation-messages__errors" role="alert" aria-live="assertive">
          {errors.map((issue) => (
            <p key={`${issue.path}-${issue.message}`}>
              <strong>{issue.path}:</strong> {issue.message}
            </p>
          ))}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="validation-messages__warnings" role="status" aria-live="polite">
          {warnings.map((issue) => (
            <p key={`${issue.path}-${issue.message}`}>
              <strong>{issue.path}:</strong> {issue.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface ValidationBannerProps {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  summary: string;
}

export function ValidationBanner({ errors = [], warnings = [], summary }: ValidationBannerProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div
      className={`validation-banner ${errors.length > 0 ? 'validation-banner--error' : 'validation-banner--warning'}`}
      role={errors.length > 0 ? 'alert' : 'status'}
      aria-live={errors.length > 0 ? 'assertive' : 'polite'}
    >
      <strong>{errors.length > 0 ? 'Cannot save yet' : 'Review warnings'}</strong>
      <p>{summary}</p>
      <ValidationMessages errors={errors} warnings={warnings} />
    </div>
  );
}
