import type {
  ValidationIssue,
  ValidationOptions,
  ValidationResult,
} from '../common/validation-result.js';
import { failureResult, issue, successResult } from '../common/validation-result.js';
import { collectMeasurementWarnings } from './ranges.js';
import {
  MANATEE_V1_PROTOCOL,
  MANATEE_V1_VERSION,
  manateeAssessmentCompleteSchema,
  manateeAssessmentDraftSchema,
  manateeMeasurementSchema,
  type ManateeAssessmentComplete,
  type ManateeAssessmentDraft,
  type ManateeMeasurement,
} from './zod-schemas.js';
import type { ZodError } from 'zod';

export type AssessmentType = typeof MANATEE_V1_PROTOCOL | 'dolphin_v1';

export function getProtocolVersion(assessmentType: AssessmentType): string {
  if (assessmentType === MANATEE_V1_PROTOCOL) {
    return MANATEE_V1_VERSION;
  }
  if (assessmentType === 'dolphin_v1') {
    return '0.1.0';
  }
  throw new Error(`Unknown assessment type: ${assessmentType}`);
}

function zodIssuesToValidationIssues(
  error: ZodError,
  severity: 'error' | 'warning' = 'error',
): ValidationIssue[] {
  return error.issues.map((zodIssue) =>
    issue(zodIssue.path.join('.') || '(root)', zodIssue.message, severity, zodIssue.code),
  );
}

function validateAssessmentEndedAfterStarted(
  assessment: ManateeAssessmentDraft | ManateeAssessmentComplete,
): ValidationIssue[] {
  if (!assessment.assessment_ended_at) {
    return [];
  }

  const started = new Date(assessment.assessment_started_at).getTime();
  const ended = new Date(assessment.assessment_ended_at).getTime();

  if (ended < started) {
    return [
      issue(
        'assessment_ended_at',
        'assessment_ended_at must be on or after assessment_started_at',
        'error',
        'INVALID_ASSESSMENT_WINDOW',
      ),
    ];
  }

  return [];
}

function validateProtocolVersionLocked(
  assessment: ManateeAssessmentDraft | ManateeAssessmentComplete,
): ValidationIssue[] {
  if (assessment.protocol_version !== MANATEE_V1_VERSION) {
    return [
      issue(
        'protocol_version',
        `protocol_version must be ${MANATEE_V1_VERSION} for manatee_v1 assessments`,
        'error',
        'PROTOCOL_VERSION_MISMATCH',
      ),
    ];
  }
  return [];
}

export function validateManateeAssessment(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult<ManateeAssessmentDraft | ManateeAssessmentComplete> {
  const mode = options.mode ?? 'draft';
  const schema =
    mode === 'complete' ? manateeAssessmentCompleteSchema : manateeAssessmentDraftSchema;
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return failureResult(zodIssuesToValidationIssues(parsed.error));
  }

  const crossFieldErrors = [
    ...validateAssessmentEndedAfterStarted(parsed.data),
    ...validateProtocolVersionLocked(parsed.data),
  ];

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

export function validateManateeMeasurement(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult<ManateeMeasurement> {
  const collectWarnings = options.collectWarnings ?? true;
  const parsed = manateeMeasurementSchema.safeParse(input);

  if (!parsed.success) {
    return failureResult(zodIssuesToValidationIssues(parsed.error));
  }

  const warnings: ValidationIssue[] = collectWarnings
    ? collectMeasurementWarnings(parsed.data).map((warning) =>
        issue(warning.path, warning.message, 'warning', warning.code),
      )
    : [];

  return successResult(parsed.data, warnings);
}
