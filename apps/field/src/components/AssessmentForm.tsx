import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { validateAssessmentByProtocol } from '@mmap/schema/protocol';
import type { StoredAssessment } from '../db/types.js';
import { createAssessment, updateAssessment } from '../data/repository.js';
import { getCollectorId } from '../lib/ids.js';
import {
  datetimeLocalValueToUtc,
  nowDatetimeLocalValue,
  utcToDatetimeLocalValue,
} from '../lib/datetime-input.js';
import { getFormDefinition } from '../lib/protocol-registry.js';
import { parseLocationFromForm, SchemaFormRenderer } from './form/SchemaFormRenderer.js';
import { getFieldString, type FormValues } from './form/form-utils.js';
import { ValidationBanner } from './ValidationMessages.js';

interface AssessmentFormProps {
  mode: 'create' | 'edit';
  assessment?: StoredAssessment;
  assessmentType: string;
  protocolVersion: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

function buildInitialValues(
  assessmentType: string,
  protocolVersion: string,
  assessment?: StoredAssessment,
): FormValues {
  const formDefinition = getFormDefinition(assessmentType, protocolVersion);
  const defaults = formDefinition.assessment.defaults ?? {};

  if (!assessment) {
    const defaultLocation = defaults.location as
      | { latitude: string; longitude: string }
      | undefined;
    return {
      name: '',
      assessment_started_at: nowDatetimeLocalValue(),
      assessment_ended_at: '',
      location: defaultLocation ?? { latitude: '17.5043', longitude: '-88.1962' },
      organization: typeof defaults.organization === 'string' ? defaults.organization : '',
      campaign: '',
      notes: '',
    };
  }

  return {
    name: assessment.name,
    assessment_started_at: utcToDatetimeLocalValue(assessment.assessment_started_at),
    assessment_ended_at: assessment.assessment_ended_at
      ? utcToDatetimeLocalValue(assessment.assessment_ended_at)
      : '',
    location: {
      latitude: String(assessment.location.latitude),
      longitude: String(assessment.location.longitude),
      accuracy_meters:
        assessment.location.accuracy_meters !== undefined
          ? String(assessment.location.accuracy_meters)
          : undefined,
    },
    organization: assessment.organization ?? '',
    campaign: assessment.campaign ?? '',
    notes: assessment.notes ?? '',
  };
}

export function AssessmentForm({
  mode,
  assessment,
  assessmentType,
  protocolVersion,
  onSaved,
  onCancel,
}: AssessmentFormProps) {
  const formDefinition = useMemo(
    () => getFormDefinition(assessmentType, protocolVersion),
    [assessmentType, protocolVersion],
  );

  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(assessmentType, protocolVersion, assessment),
  );
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ReturnType<typeof validateAssessmentByProtocol>['errors']
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  function buildAssessmentPayload(location: ReturnType<typeof parseLocationFromForm>) {
    const startedAt = datetimeLocalValueToUtc(getFieldString(values, 'assessment_started_at'));
    const endedAtRaw = getFieldString(values, 'assessment_ended_at');
    const endedAt = endedAtRaw ? datetimeLocalValueToUtc(endedAtRaw) : undefined;

    return {
      id: assessment?.id ?? crypto.randomUUID(),
      name: getFieldString(values, 'name').trim(),
      assessment_started_at: startedAt,
      assessment_ended_at: endedAt,
      location,
      assessment_type: assessmentType,
      protocol_version: protocolVersion,
      collector_id: assessment?.collector_id ?? getCollectorId(),
      organization: getFieldString(values, 'organization').trim() || undefined,
      campaign: getFieldString(values, 'campaign').trim() || undefined,
      notes: getFieldString(values, 'notes').trim() || undefined,
      sync_status: assessment?.sync_status ?? ('local-only' as const),
      created_at: assessment?.created_at,
      updated_at: assessment?.updated_at,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationErrors([]);

    if (!getFieldString(values, 'name').trim()) {
      setError('Name is required.');
      return;
    }

    try {
      const location = parseLocationFromForm(values);
      const payload = buildAssessmentPayload(location);
      const validation = validateAssessmentByProtocol(assessmentType, payload, {
        mode: payload.assessment_ended_at ? 'complete' : 'draft',
      });

      if (!validation.success) {
        setValidationErrors(validation.errors);
        return;
      }

      setIsSaving(true);

      if (mode === 'create') {
        const created = await createAssessment({
          name: payload.name,
          location,
          assessment_type: assessmentType,
          protocol_version: protocolVersion,
          assessment_started_at: payload.assessment_started_at,
          organization: payload.organization,
          campaign: payload.campaign,
          notes: payload.notes,
        });
        onSaved(created.id);
        return;
      }

      if (!assessment) {
        throw new Error('Assessment is required for edit mode.');
      }

      const updated = await updateAssessment(assessment.id, {
        name: payload.name,
        location,
        assessment_started_at: payload.assessment_started_at,
        assessment_ended_at: payload.assessment_ended_at ?? null,
        organization: payload.organization,
        campaign: payload.campaign,
        notes: payload.notes,
      });
      onSaved(updated.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save assessment.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{mode === 'create' ? 'New Assessment' : 'Edit Assessment'}</h2>
        <span className="hint">{formDefinition.label}</span>
      </div>

      <ValidationBanner
        errors={validationErrors}
        summary="Fix the highlighted fields before saving this assessment."
      />

      <SchemaFormRenderer
        sections={formDefinition.assessment.sections}
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitLabel={mode === 'create' ? 'Start Assessment' : 'Save Changes'}
        onCancel={onCancel}
        isSaving={isSaving}
      >
        {error ? <p className="form-error">{error}</p> : null}
      </SchemaFormRenderer>
    </section>
  );
}
