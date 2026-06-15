import { readFileSync } from 'node:fs';

import { dirname, join } from 'node:path';

import { fileURLToPath } from 'node:url';

export {
  getDefaultProtocolEntry,
  getFormDefinitionForProtocol,
  getPackageRoot,
  getProtocolEntry,
  isProtocolSyncable,
  listProtocolEntries,
  loadFormDefinition,
  loadSchemaRegistry,
  parseProtocolKey,
  protocolKeyToString,
} from './registry-loader.js';

export type {
  FormDefinition,
  FormFieldDefinition,
  FormSectionDefinition,
  FormWidget,
  MeasurementSectionDefinition,
  ProtocolKey,
  ProtocolRegistryEntry,
  SchemaRegistry,
} from './form-types.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SCHEMA_PATHS = {
  definitions: join(packageRoot, 'schemas/manatee_v1/definitions.schema.json'),

  assessment: join(packageRoot, 'schemas/manatee_v1/assessment.schema.json'),

  measurement: join(packageRoot, 'schemas/manatee_v1/measurement.schema.json'),
} as const;

export function loadJsonSchema(path: keyof typeof SCHEMA_PATHS): unknown {
  const contents = readFileSync(SCHEMA_PATHS[path], 'utf8');

  return JSON.parse(contents) as unknown;
}

export const manateeV1RegistryEntry = {
  assessment_type: 'manatee_v1',

  protocol_version: '1.0.0',

  assessment_schema: './schemas/manatee_v1/assessment.schema.json',

  measurement_schema: './schemas/manatee_v1/measurement.schema.json',

  definitions_schema: './schemas/manatee_v1/definitions.schema.json',

  form_definition: './form-definitions/manatee_v1.json',
} as const;
