import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import type { FormFieldDefinition, FormSectionDefinition } from '@mmap/schema/protocol';
import type { AssessmentLocation } from '../../db/types.js';
import {
  fieldId,
  getFieldString,
  getLocationInput,
  isFieldRequired,
  type FormValues,
  type LocationInput,
} from './form-utils.js';

interface GeoFieldProps {
  field: FormFieldDefinition;
  values: FormValues;
  onChange: (next: FormValues) => void;
  disabled?: boolean;
}

function GeoField({ field, values, onChange, disabled }: GeoFieldProps) {
  const location = getLocationInput(values);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const inputId = fieldId(field.name);

  function updateLocation(next: Partial<LocationInput>) {
    onChange({
      ...values,
      location: { ...location, ...next },
    });
  }

  function handleCaptureGps() {
    if (!navigator.geolocation) {
      setGeoError('GPS is not available on this device. Enter coordinates manually.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          accuracy_meters: position.coords.accuracy
            ? position.coords.accuracy.toFixed(1)
            : undefined,
        });
        setIsLocating(false);
      },
      (error) => {
        setGeoError(error.message || 'Unable to capture GPS location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="geo-field">
      <button
        type="button"
        className="button button--secondary"
        onClick={handleCaptureGps}
        disabled={disabled || isLocating}
        aria-describedby={`${inputId}-help`}
      >
        {isLocating ? 'Capturing GPS…' : 'Capture GPS'}
      </button>
      <p className="hint" id={`${inputId}-help`}>
        If GPS fails, enter latitude and longitude manually.
      </p>

      <label className="field" htmlFor={`${inputId}-latitude`}>
        <span>
          Latitude
          {isFieldRequired(field) ? <span className="required-marker"> (required)</span> : null}
        </span>
        <input
          id={`${inputId}-latitude`}
          type="number"
          step="any"
          value={location.latitude}
          onChange={(event) => updateLocation({ latitude: event.target.value })}
          required={isFieldRequired(field)}
          disabled={disabled}
          aria-required={isFieldRequired(field)}
        />
      </label>

      <label className="field" htmlFor={`${inputId}-longitude`}>
        <span>
          Longitude
          {isFieldRequired(field) ? <span className="required-marker"> (required)</span> : null}
        </span>
        <input
          id={`${inputId}-longitude`}
          type="number"
          step="any"
          value={location.longitude}
          onChange={(event) => updateLocation({ longitude: event.target.value })}
          required={isFieldRequired(field)}
          disabled={disabled}
          aria-required={isFieldRequired(field)}
        />
      </label>

      {location.accuracy_meters ? (
        <p className="hint">GPS accuracy: {location.accuracy_meters} m</p>
      ) : null}
      {geoError ? <p className="form-error">{geoError}</p> : null}
    </div>
  );
}

interface SchemaFieldProps {
  field: FormFieldDefinition;
  values: FormValues;
  onChange: (next: FormValues) => void;
  disabled?: boolean;
}

export function SchemaField({ field, values, onChange, disabled }: SchemaFieldProps) {
  const inputId = fieldId(field.name);
  const value = getFieldString(values, field.name);
  const required = isFieldRequired(field);

  if (field.widget === 'geo') {
    return <GeoField field={field} values={values} onChange={onChange} disabled={disabled} />;
  }

  if (field.widget === 'textarea') {
    return (
      <label className="field" htmlFor={inputId}>
        <span>
          {field.label}
          {required ? <span className="required-marker"> (required)</span> : null}
        </span>
        <textarea
          id={inputId}
          rows={field.rows ?? 3}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
          required={required}
          disabled={disabled}
          aria-required={required}
        />
      </label>
    );
  }

  if (field.widget === 'datetime') {
    return (
      <label className="field" htmlFor={inputId}>
        <span>
          {field.label}
          {required ? <span className="required-marker"> (required)</span> : null}
        </span>
        <input
          id={inputId}
          type="datetime-local"
          value={value}
          onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
          required={required}
          disabled={disabled}
          aria-required={required}
        />
      </label>
    );
  }

  if (field.widget === 'number') {
    return (
      <label className="field" htmlFor={inputId}>
        <span>
          {field.label}
          {field.unit ? ` (${field.unit})` : ''}
          {required ? <span className="required-marker"> (required)</span> : null}
        </span>
        <input
          id={inputId}
          type="number"
          step={field.step ?? 'any'}
          min={field.min}
          max={field.max}
          value={value}
          onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
          required={required}
          disabled={disabled}
          aria-required={required}
        />
      </label>
    );
  }

  return (
    <label className="field" htmlFor={inputId}>
      <span>
        {field.label}
        {required ? <span className="required-marker"> (required)</span> : null}
      </span>
      <input
        id={inputId}
        type="text"
        value={value}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
        required={required}
        disabled={disabled}
        aria-required={required}
      />
    </label>
  );
}

interface SchemaFormRendererProps {
  sections: FormSectionDefinition[];
  values: FormValues;
  onChange: (next: FormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export function SchemaFormRenderer({
  sections,
  values,
  onChange,
  onSubmit,
  submitLabel,
  cancelLabel = 'Cancel',
  onCancel,
  isSaving = false,
  disabled = false,
  children,
}: SchemaFormRendererProps) {
  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {sections.map((section) => {
        if (section.widget === 'fieldset') {
          return (
            <fieldset key={section.id} className="fieldset">
              {section.title ? <legend>{section.title}</legend> : null}
              {section.fields.map((field) => (
                <SchemaField
                  key={field.name}
                  field={field}
                  values={values}
                  onChange={onChange}
                  disabled={disabled}
                />
              ))}
            </fieldset>
          );
        }

        return (
          <div key={section.id} className="form-section">
            {section.fields.map((field) => (
              <SchemaField
                key={field.name}
                field={field}
                values={values}
                onChange={onChange}
                disabled={disabled}
              />
            ))}
          </div>
        );
      })}

      {children}

      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="button button--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
        ) : null}
        <button type="submit" className="button button--primary" disabled={isSaving || disabled}>
          {isSaving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function parseLocationFromForm(values: FormValues): AssessmentLocation {
  const location = getLocationInput(values);
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = location.accuracy_meters ? Number(location.accuracy_meters) : undefined;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  return {
    latitude,
    longitude,
    accuracy_meters: accuracy !== undefined && Number.isFinite(accuracy) ? accuracy : undefined,
  };
}
