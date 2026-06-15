import type { FormFieldDefinition, FormSectionDefinition } from '@mmap/schema/protocol';
import type { AssessmentLocation } from '../../db/types.js';

export type FormValues = Record<string, unknown> & {
  location?: AssessmentLocation | LocationInput;
};

export interface LocationInput {
  latitude: string;
  longitude: string;
  accuracy_meters?: string;
}

export function getFieldString(values: FormValues, name: string): string {
  const value = values[name];
  return typeof value === 'string' ? value : '';
}

export function getLocationInput(values: FormValues): LocationInput {
  const location = values.location;
  if (!location || typeof location !== 'object') {
    return { latitude: '', longitude: '' };
  }

  const typed = location as LocationInput;
  return {
    latitude: typed.latitude ?? '',
    longitude: typed.longitude ?? '',
    accuracy_meters: typed.accuracy_meters,
  };
}

export function flattenAssessmentFields(sections: FormSectionDefinition[]): FormFieldDefinition[] {
  return sections.flatMap((section) => section.fields);
}

export function fieldId(name: string): string {
  return `field-${name.replace(/\./g, '-')}`;
}

export function isFieldRequired(field: FormFieldDefinition): boolean {
  return field.required === true;
}
