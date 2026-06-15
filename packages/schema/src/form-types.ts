export type FormWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'datetime'
  | 'geo'
  | 'blood_pressure'
  | 'fieldset';

export interface FormFieldDefinition {
  name: string;
  label?: string;
  widget: FormWidget;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  rows?: number;
  step?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  method_placeholder?: string;
}

export interface FormSectionDefinition {
  id: string;
  title?: string;
  widget?: 'fieldset';
  fields: FormFieldDefinition[];
}

export interface MeasurementSectionDefinition {
  type: string;
  label: string;
  widget: 'number' | 'blood_pressure';
  unit: string;
  step?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  method_placeholder?: string;
}

export interface FormDefinition {
  assessment_type: string;
  protocol_version: string;
  label: string;
  assessment: {
    sections: FormSectionDefinition[];
    defaults?: Record<string, unknown>;
  };
  measurements: {
    common_fields: FormFieldDefinition[];
    sections: MeasurementSectionDefinition[];
  };
}

export interface ProtocolRegistryEntry {
  assessment_type: string;
  protocol_version: string;
  label: string;
  syncable: boolean;
  default?: boolean;
  assessment_schema: string;
  measurement_schema: string;
  definitions_schema?: string;
  form_definition: string;
}

export interface SchemaRegistry {
  version: number;
  protocols: ProtocolRegistryEntry[];
}

export interface ProtocolKey {
  assessment_type: string;
  protocol_version: string;
}
