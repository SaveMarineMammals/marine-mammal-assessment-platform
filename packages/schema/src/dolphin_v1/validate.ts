import type { ValidationOptions, ValidationResult } from '../common/validation-result.js';
import { failureResult, issue, successResult } from '../common/validation-result.js';
import {
  DOLPHIN_V1_VERSION,
  dolphinAssessmentCompleteSchema,
  dolphinAssessmentDraftSchema,
  dolphinMeasurementSchema,
  type DolphinAssessmentComplete,
  type DolphinAssessmentDraft,
  type DolphinMeasurement,
} from './zod-schemas.js';
import type { ZodError } from 'zod';

function zodIssuesToValidationIssues(error: ZodError) {
  return error.issues.map((zodIssue) =>
    issue(zodIssue.path.join('.') || '(root)', zodIssue.message, 'error', zodIssue.code),
  );
}

function validateProtocolVersion(assessment: DolphinAssessmentDraft | DolphinAssessmentComplete) {
  if (assessment.protocol_version !== DOLPHIN_V1_VERSION) {
    return [
      issue(
        'protocol_version',
        `protocol_version must be ${DOLPHIN_V1_VERSION} for dolphin_v1 assessments`,
        'error',
        'PROTOCOL_VERSION_MISMATCH',
      ),
    ];
  }
  return [];
}

export function validateDolphinAssessment(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult<DolphinAssessmentDraft | DolphinAssessmentComplete> {
  const mode = options.mode ?? 'draft';
  const schema =
    mode === 'complete' ? dolphinAssessmentCompleteSchema : dolphinAssessmentDraftSchema;
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return failureResult(zodIssuesToValidationIssues(parsed.error));
  }

  const crossFieldErrors = validateProtocolVersion(parsed.data);

  if (mode === 'complete' && !parsed.data.assessment_ended_at) {
    crossFieldErrors.push(
      issue(
        'assessment_ended_at',
        'assessment_ended_at is required before sync',
        'error',
        'MISSING_END_TIME',
      ),
    );
  }

  if (crossFieldErrors.length > 0) {
    return failureResult(crossFieldErrors);
  }

  return successResult(parsed.data);
}

export function validateDolphinMeasurement(input: unknown): ValidationResult<DolphinMeasurement> {
  const parsed = dolphinMeasurementSchema.safeParse(input);

  if (!parsed.success) {
    return failureResult(zodIssuesToValidationIssues(parsed.error));
  }

  return successResult(parsed.data);
}
