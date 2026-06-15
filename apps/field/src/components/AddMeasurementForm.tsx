import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { validateMeasurementByProtocol } from '@mmap/schema/protocol';
import type { MeasurementSectionDefinition } from '@mmap/schema/protocol';
import { formatLocalTimeShort } from '@mmap/geo-time';
import { addMeasurement } from '../data/repository.js';
import { createId } from '../lib/ids.js';
import { datetimeLocalValueToUtc, nowDatetimeLocalValue } from '../lib/datetime-input.js';
import { getFormDefinition } from '../lib/protocol-registry.js';
import { SchemaField } from './form/SchemaFormRenderer.js';
import { getFieldString, type FormValues } from './form/form-utils.js';
import { ValidationBanner } from './ValidationMessages.js';

interface AddMeasurementFormProps {
  assessmentId: string;
  assessmentType: string;
  protocolVersion: string;
  measurementSection: MeasurementSectionDefinition;
  sequence: number;
  latitude: number;
  longitude: number;
  onAdded: () => void;
  onCancel: () => void;
}

function getUnitForSection(
  assessmentType: string,
  _protocolVersion: string,
  section: MeasurementSectionDefinition,
): string {
  if (assessmentType === 'manatee_v1') {
    const units: Record<string, string> = {
      length: 'cm',
      weight: 'kg',
      internal_temperature: '°C',
      external_temperature: '°C',
      blood_pressure: 'mmHg',
      heart_rate: 'bpm',
      respiratory_rate: 'breaths/min',
    };
    return units[section.type] ?? section.unit;
  }

  if (section.type === 'body_condition') {
    return 'score';
  }

  return section.unit;
}

export function AddMeasurementForm({
  assessmentId,
  assessmentType,
  protocolVersion,
  measurementSection,
  sequence,
  latitude,
  longitude,
  onAdded,
  onCancel,
}: AddMeasurementFormProps) {
  const formDefinition = useMemo(
    () => getFormDefinition(assessmentType, protocolVersion),
    [assessmentType, protocolVersion],
  );

  const [values, setValues] = useState<FormValues>({
    recorded_at: nowDatetimeLocalValue(),
    method: '',
    notes: '',
    value: '',
    systolic: '',
    diastolic: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ReturnType<typeof validateMeasurementByProtocol>['errors']
  >([]);
  const [validationWarnings, setValidationWarnings] = useState<
    ReturnType<typeof validateMeasurementByProtocol>['warnings']
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  function buildMeasurement() {
    const recorded_at = datetimeLocalValueToUtc(getFieldString(values, 'recorded_at'));
    const base = {
      id: createId(),
      assessment_id: assessmentId,
      measurement_type: measurementSection.type,
      recorded_at,
      method: getFieldString(values, 'method').trim() || undefined,
      notes: getFieldString(values, 'notes').trim() || null,
      sequence,
    };

    if (measurementSection.widget === 'blood_pressure') {
      return {
        ...base,
        measurement_type: measurementSection.type,
        value: {
          systolic: Number(getFieldString(values, 'systolic')),
          diastolic: Number(getFieldString(values, 'diastolic')),
        },
        unit: getUnitForSection(assessmentType, protocolVersion, measurementSection),
      };
    }

    const rawValue = getFieldString(values, 'value');
    const numericValue = measurementSection.integer
      ? Number.parseInt(rawValue, 10)
      : Number(rawValue);

    return {
      ...base,
      measurement_type: measurementSection.type,
      value: numericValue,
      unit: getUnitForSection(assessmentType, protocolVersion, measurementSection),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationErrors([]);
    setValidationWarnings([]);

    try {
      const measurement = buildMeasurement();
      const validation = validateMeasurementByProtocol(assessmentType, measurement);

      if (!validation.success) {
        setValidationErrors(validation.errors);
        return;
      }

      if (validation.warnings.length > 0) {
        const proceed = window.confirm(
          [
            'This reading is outside the expected range:',
            ...validation.warnings.map((warning) => warning.message),
            'Save anyway?',
          ].join('\n'),
        );
        if (!proceed) {
          setValidationWarnings(validation.warnings);
          return;
        }
      }

      setIsSaving(true);
      await addMeasurement(measurement);
      onAdded();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save measurement.');
    } finally {
      setIsSaving(false);
    }
  }

  const commonFields = formDefinition.measurements.common_fields.map((field) => {
    if (field.name === 'method' && measurementSection.method_placeholder) {
      return { ...field, placeholder: measurementSection.method_placeholder };
    }
    return field;
  });

  return (
    <form className="measurement-form" onSubmit={handleSubmit} noValidate>
      <p className="hint">
        Recording in local time (
        {formatLocalTimeShort(
          datetimeLocalValueToUtc(getFieldString(values, 'recorded_at')),
          latitude,
          longitude,
        )}
        )
      </p>

      <ValidationBanner
        errors={validationErrors}
        warnings={validationWarnings}
        summary="Review the measurement fields before saving."
      />

      {commonFields.map((field) => (
        <SchemaField key={field.name} field={field} values={values} onChange={setValues} />
      ))}

      {measurementSection.widget === 'blood_pressure' ? (
        <div className="field-row">
          <label className="field" htmlFor="field-systolic">
            <span>
              Systolic (mmHg) <span className="required-marker">(required)</span>
            </span>
            <input
              id="field-systolic"
              type="number"
              step="1"
              min="1"
              value={getFieldString(values, 'systolic')}
              onChange={(event) => setValues({ ...values, systolic: event.target.value })}
              required
              aria-required
            />
          </label>
          <label className="field" htmlFor="field-diastolic">
            <span>
              Diastolic (mmHg) <span className="required-marker">(required)</span>
            </span>
            <input
              id="field-diastolic"
              type="number"
              step="1"
              min="1"
              value={getFieldString(values, 'diastolic')}
              onChange={(event) => setValues({ ...values, diastolic: event.target.value })}
              required
              aria-required
            />
          </label>
        </div>
      ) : (
        <label className="field" htmlFor="field-value">
          <span>
            {measurementSection.label} ({measurementSection.unit}){' '}
            <span className="required-marker">(required)</span>
          </span>
          <input
            id="field-value"
            type="number"
            step={measurementSection.step ?? 'any'}
            min={measurementSection.min}
            max={measurementSection.max}
            value={getFieldString(values, 'value')}
            onChange={(event) => setValues({ ...values, value: event.target.value })}
            required
            aria-required
          />
        </label>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Reading'}
        </button>
      </div>
    </form>
  );
}
