import { describe, expect, it } from 'vitest';
import {
  formatCsvRow,
  isPublicPseudonymizationEnabled,
  parseBbox,
  pseudonymizeAssessmentName,
} from './public-dataset.js';

describe('public dataset service', () => {
  it('parses bbox query values', () => {
    expect(parseBbox('17.0,-89.0,18.0,-88.0')).toEqual({
      minLat: 17,
      minLon: -89,
      maxLat: 18,
      maxLon: -88,
    });
  });

  it('rejects invalid bbox values', () => {
    expect(() => parseBbox('bad')).toThrow('bbox must be minLat,minLon,maxLat,maxLon');
  });

  it('escapes csv values with commas', () => {
    expect(formatCsvRow(['Belize', 'CMARI, Belize', 17.5])).toBe('Belize,"CMARI, Belize",17.5\n');
  });

  it('pseudonymizes names when enabled', () => {
    const original = process.env.PUBLIC_PSEUDONYMIZE_NAMES;
    process.env.PUBLIC_PSEUDONYMIZE_NAMES = 'true';
    expect(isPublicPseudonymizationEnabled()).toBe(true);
    expect(pseudonymizeAssessmentName('Belize-2026-014')).toMatch(/^Beli…-[0-9a-f]{8}$/);
    expect(pseudonymizeAssessmentName('Belize-2026-014')).toBe(
      pseudonymizeAssessmentName('Belize-2026-014'),
    );
    process.env.PUBLIC_PSEUDONYMIZE_NAMES = original;
  });
});
