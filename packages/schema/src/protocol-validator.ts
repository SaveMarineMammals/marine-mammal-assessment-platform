import type { ValidationOptions, ValidationResult } from './common/validation-result.js';
import { MANATEE_V1_PROTOCOL } from './manatee_v1/zod-schemas.js';
import { validateManateeAssessment, validateManateeMeasurement } from './manatee_v1/validate.js';
import { DOLPHIN_V1_PROTOCOL } from './dolphin_v1/zod-schemas.js';
import { validateDolphinAssessment, validateDolphinMeasurement } from './dolphin_v1/validate.js';

export function validateAssessmentByProtocol(
  assessmentType: string,
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult<unknown> {
  switch (assessmentType) {
    case MANATEE_V1_PROTOCOL:
      return validateManateeAssessment(input, options);
    case DOLPHIN_V1_PROTOCOL:
      return validateDolphinAssessment(input, options);
    default:
      throw new Error(`No assessment validator registered for ${assessmentType}`);
  }
}

export function validateMeasurementByProtocol(
  assessmentType: string,
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult<unknown> {
  switch (assessmentType) {
    case MANATEE_V1_PROTOCOL:
      return validateManateeMeasurement(input, options);
    case DOLPHIN_V1_PROTOCOL:
      return validateDolphinMeasurement(input);
    default:
      throw new Error(`No measurement validator registered for ${assessmentType}`);
  }
}

export function getProtocolVersionForType(assessmentType: string): string {
  switch (assessmentType) {
    case MANATEE_V1_PROTOCOL:
      return '1.0.0';
    case DOLPHIN_V1_PROTOCOL:
      return '0.1.0';
    default:
      throw new Error(`Unknown assessment type: ${assessmentType}`);
  }
}
