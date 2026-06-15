import { describe, expect, it } from 'vitest';
import {
  getDefaultProtocolEntry,
  getFormDefinitionForProtocol,
  getProtocolEntry,
  isProtocolSyncable,
  loadSchemaRegistry,
} from './registry-loader.js';

describe('schema registry', () => {
  it('loads registry.json with manatee and dolphin entries', () => {
    const registry = loadSchemaRegistry();
    expect(registry.protocols).toHaveLength(2);
    expect(registry.protocols.map((entry) => entry.assessment_type)).toEqual([
      'manatee_v1',
      'dolphin_v1',
    ]);
  });

  it('returns default manatee protocol', () => {
    const entry = getDefaultProtocolEntry();
    expect(entry.assessment_type).toBe('manatee_v1');
    expect(entry.syncable).toBe(true);
  });

  it('loads form definitions for each protocol', () => {
    const manatee = getFormDefinitionForProtocol({
      assessment_type: 'manatee_v1',
      protocol_version: '1.0.0',
    });
    expect(manatee.measurements.sections.length).toBeGreaterThan(5);

    const dolphin = getFormDefinitionForProtocol({
      assessment_type: 'dolphin_v1',
      protocol_version: '0.1.0',
    });
    expect(dolphin.measurements.sections).toHaveLength(2);
  });

  it('marks dolphin stub as non-syncable', () => {
    expect(
      isProtocolSyncable({
        assessment_type: 'dolphin_v1',
        protocol_version: '0.1.0',
      }),
    ).toBe(false);
  });

  it('resolves protocol entries by type and version', () => {
    const entry = getProtocolEntry('dolphin_v1', '0.1.0');
    expect(entry.label).toContain('stub');
  });
});
