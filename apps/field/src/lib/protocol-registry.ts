import registryDocument from '@mmap/schema/registry.json';
import manateeForm from '@mmap/schema/form-definitions/manatee_v1.json';
import dolphinForm from '@mmap/schema/form-definitions/dolphin_v1.json';
import type {
  FormDefinition,
  ProtocolKey,
  ProtocolRegistryEntry,
  SchemaRegistry,
} from '@mmap/schema/protocol';

const FORM_DEFINITIONS: Record<string, FormDefinition> = {
  'manatee_v1@1.0.0': manateeForm as FormDefinition,
  'dolphin_v1@0.1.0': dolphinForm as FormDefinition,
};

export const schemaRegistry = registryDocument as SchemaRegistry;

export function protocolKeyToString(key: ProtocolKey): string {
  return `${key.assessment_type}@${key.protocol_version}`;
}

export function listProtocolEntries(): ProtocolRegistryEntry[] {
  return schemaRegistry.protocols;
}

export function getDefaultProtocolEntry(): ProtocolRegistryEntry {
  const entry = schemaRegistry.protocols.find((protocol) => protocol.default);
  if (!entry) {
    throw new Error('Schema registry has no default protocol entry');
  }
  return entry;
}

export function getProtocolEntry(
  assessmentType: string,
  protocolVersion?: string,
): ProtocolRegistryEntry {
  const matches = schemaRegistry.protocols.filter(
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

  return matches[0];
}

export function getFormDefinition(assessmentType: string, protocolVersion: string): FormDefinition {
  const key = protocolKeyToString({
    assessment_type: assessmentType,
    protocol_version: protocolVersion,
  });
  const form = FORM_DEFINITIONS[key];
  if (!form) {
    throw new Error(`No form definition registered for ${key}`);
  }
  return form;
}

export function isProtocolSyncable(assessmentType: string, protocolVersion: string): boolean {
  return getProtocolEntry(assessmentType, protocolVersion).syncable;
}

export function parseProtocolKey(value: string): ProtocolKey {
  const [assessment_type, protocol_version] = value.split('@');
  if (!assessment_type || !protocol_version) {
    throw new Error(`Invalid protocol key: ${value}`);
  }
  return { assessment_type, protocol_version };
}
