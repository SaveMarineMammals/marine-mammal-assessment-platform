import type { ManateeMeasurement } from './zod-schemas.js';

export interface NumericRange {
  min: number;
  max: number;
  label: string;
}

export const MEASUREMENT_WARNING_RANGES: Partial<
  Record<ManateeMeasurement['measurement_type'], NumericRange>
> = {
  length: { min: 50, max: 400, label: 'cm' },
  weight: { min: 50, max: 600, label: 'kg' },
  internal_temperature: { min: 30, max: 40, label: '°C' },
  external_temperature: { min: -5, max: 45, label: '°C' },
  heart_rate: { min: 10, max: 200, label: 'bpm' },
  respiratory_rate: { min: 1, max: 60, label: 'breaths/min' },
};

export const BLOOD_PRESSURE_WARNING_RANGES = {
  systolic: { min: 40, max: 250, label: 'mmHg systolic' },
  diastolic: { min: 20, max: 150, label: 'mmHg diastolic' },
} as const;

export function collectMeasurementWarnings(measurement: ManateeMeasurement) {
  const warnings: { path: string; message: string; code: string }[] = [];

  const range = MEASUREMENT_WARNING_RANGES[measurement.measurement_type];
  if (range && typeof measurement.value === 'number') {
    if (measurement.value < range.min || measurement.value > range.max) {
      warnings.push({
        path: 'value',
        message: `${measurement.measurement_type} value ${measurement.value} is outside the expected range ${range.min}–${range.max} ${range.label}`,
        code: 'RANGE_WARNING',
      });
    }
  }

  if (measurement.measurement_type === 'blood_pressure') {
    const { systolic, diastolic } = measurement.value;
    const sysRange = BLOOD_PRESSURE_WARNING_RANGES.systolic;
    const diaRange = BLOOD_PRESSURE_WARNING_RANGES.diastolic;

    if (systolic < sysRange.min || systolic > sysRange.max) {
      warnings.push({
        path: 'value.systolic',
        message: `Systolic ${systolic} is outside the expected range ${sysRange.min}–${sysRange.max} mmHg`,
        code: 'RANGE_WARNING',
      });
    }
    if (diastolic < diaRange.min || diastolic > diaRange.max) {
      warnings.push({
        path: 'value.diastolic',
        message: `Diastolic ${diastolic} is outside the expected range ${diaRange.min}–${diaRange.max} mmHg`,
        code: 'RANGE_WARNING',
      });
    }
  }

  return warnings;
}
