import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  FormDefinition,
  ProtocolKey,
  ProtocolRegistryEntry,
  SchemaRegistry,
} from './form-types.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function getPackageRoot(): string {
  return packageRoot;
}

export function loadSchemaRegistry(): SchemaRegistry {
  const contents = readFileSync(join(packageRoot, 'registry.json'), 'utf8');
  return JSON.parse(contents) as SchemaRegistry;
}

export function loadFormDefinition(relativePath: string): FormDefinition {
  const normalized = relativePath.replace(/^\.\//, '');
  const contents = readFileSync(join(packageRoot, normalized), 'utf8');
  return JSON.parse(contents) as FormDefinition;
}

export function listProtocolEntries(
  registry: SchemaRegistry = loadSchemaRegistry(),
): ProtocolRegistryEntry[] {
  return registry.protocols;
}

export function getDefaultProtocolEntry(
  registry: SchemaRegistry = loadSchemaRegistry(),
): ProtocolRegistryEntry {
  const entry = registry.protocols.find((protocol) => protocol.default);
  if (!entry) {
    throw new Error('Schema registry has no default protocol entry');
  }
  return entry;
}

export function getProtocolEntry(
  assessmentType: string,
  protocolVersion?: string,
  registry: SchemaRegistry = loadSchemaRegistry(),
): ProtocolRegistryEntry {
  const matches = registry.protocols.filter(
    (protocol) => protocol.assessment_type === assessmentType,
  );

  if (matches.length === 0) {
    throw new Error(`Unknown assessment type: ${assessmentType}`);
  }

  if (protocolVersion) {
    const exact = matches.find((protocol) => protocol.protocol_version === protocolVersion);
    if (!exact) {
      throw new Error(`Unknown protocol version ${protocolVersion} for ${assessmentType}`);
    }
    return exact;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  throw new Error(
    `protocol_version is required when multiple versions exist for ${assessmentType}`,
  );
}

export function getFormDefinitionForProtocol(
  key: ProtocolKey,
  registry: SchemaRegistry = loadSchemaRegistry(),
): FormDefinition {
  const entry = getProtocolEntry(key.assessment_type, key.protocol_version, registry);
  return loadFormDefinition(entry.form_definition);
}

export function isProtocolSyncable(
  key: ProtocolKey,
  registry: SchemaRegistry = loadSchemaRegistry(),
): boolean {
  return getProtocolEntry(key.assessment_type, key.protocol_version, registry).syncable;
}

export function protocolKeyToString(key: ProtocolKey): string {
  return `${key.assessment_type}@${key.protocol_version}`;
}

export function parseProtocolKey(value: string): ProtocolKey {
  const [assessment_type, protocol_version] = value.split('@');
  if (!assessment_type || !protocol_version) {
    throw new Error(`Invalid protocol key: ${value}`);
  }
  return { assessment_type, protocol_version };
}
