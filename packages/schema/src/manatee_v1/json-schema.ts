import AjvModule from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type AjvInstance = {
  addSchema(schema: object): void;
  getSchema(key: string): ValidateFunction | undefined;
};

type AjvConstructor = new (options?: object) => AjvInstance;
type AddFormatsFn = (ajv: AjvInstance) => AjvInstance;

const Ajv2020 = ((AjvModule as unknown as { default?: AjvConstructor }).default ??
  AjvModule) as AjvConstructor;

const addFormats = ((addFormatsModule as unknown as { default?: AddFormatsFn }).default ??
  addFormatsModule) as AddFormatsFn;

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '../../schemas/manatee_v1');

function readSchema(filename: string): object {
  return JSON.parse(readFileSync(join(schemaDir, filename), 'utf8')) as object;
}

let cachedValidators: {
  validateAssessment: ValidateFunction;
  validateMeasurement: ValidateFunction;
} | null = null;

export function createManateeV1JsonSchemaValidators() {
  if (cachedValidators) {
    return cachedValidators;
  }

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: false,
  });
  addFormats(ajv);

  ajv.addSchema(readSchema('definitions.schema.json'));
  ajv.addSchema(readSchema('assessment.schema.json'));
  ajv.addSchema(readSchema('measurement.schema.json'));

  const validateAssessment = ajv.getSchema(
    'https://mmap.dev/schemas/manatee_v1/assessment.schema.json',
  );
  const validateMeasurement = ajv.getSchema(
    'https://mmap.dev/schemas/manatee_v1/measurement.schema.json',
  );

  if (!validateAssessment || !validateMeasurement) {
    throw new Error('Failed to compile manatee_v1 JSON Schemas');
  }

  cachedValidators = { validateAssessment, validateMeasurement };
  return cachedValidators;
}

export function validateAssessmentWithJsonSchema(data: unknown): boolean {
  const { validateAssessment } = createManateeV1JsonSchemaValidators();
  return validateAssessment(data) as boolean;
}

export function validateMeasurementWithJsonSchema(data: unknown): boolean {
  const { validateMeasurement } = createManateeV1JsonSchemaValidators();
  return validateMeasurement(data) as boolean;
}

export function getJsonSchemaErrors(data: unknown, type: 'assessment' | 'measurement'): string[] {
  const validators = createManateeV1JsonSchemaValidators();
  const validate =
    type === 'assessment' ? validators.validateAssessment : validators.validateMeasurement;

  validate(data);
  return (validate.errors ?? []).map((error: ErrorObject) => {
    const path = error.instancePath || '(root)';
    return `${path}: ${error.message ?? 'invalid'}`;
  });
}
