import { useState } from 'react';
import { validateAssessmentByProtocol } from '@mmap/schema/protocol';
import { formatLocalTime, toUtcIso } from '@mmap/geo-time';
import type { AssessmentWithMeasurements } from '../db/types.js';
import { updateAssessment } from '../data/repository.js';
import { formatProtocolLabel } from '../lib/measurements.js';
import { AssessmentForm } from './AssessmentForm.js';
import { MeasurementPanel } from './MeasurementPanel.js';
import { ValidationBanner } from './ValidationMessages.js';

interface AssessmentDetailProps {
  data: AssessmentWithMeasurements;
  onBack: () => void;
  onUpdated: () => void;
  className?: string;
}

export function AssessmentDetail({ data, onBack, onUpdated, className }: AssessmentDetailProps) {
  const { assessment, measurements } = data;
  const { location } = assessment;
  const [isEditing, setIsEditing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ReturnType<typeof validateAssessmentByProtocol>['errors']
  >([]);

  const isComplete = Boolean(assessment.assessment_ended_at);

  async function handleCompleteAssessment() {
    setError(null);
    setValidationErrors([]);

    const endedAt = toUtcIso(new Date());
    const candidate = {
      ...assessment,
      assessment_ended_at: endedAt,
    };
    const validation = validateAssessmentByProtocol(assessment.assessment_type, candidate, {
      mode: 'complete',
    });

    if (!validation.success) {
      setValidationErrors(validation.errors);
      setError(validation.errors.map((issue) => issue.message).join(' '));
      return;
    }

    const proceed = window.confirm('Mark this assessment complete and set the end time to now?');
    if (!proceed) {
      return;
    }

    try {
      setIsCompleting(true);
      await updateAssessment(assessment.id, { assessment_ended_at: endedAt });
      onUpdated();
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : 'Unable to complete assessment.',
      );
    } finally {
      setIsCompleting(false);
    }
  }

  if (isEditing) {
    return (
      <AssessmentForm
        mode="edit"
        assessment={assessment}
        assessmentType={assessment.assessment_type}
        protocolVersion={assessment.protocol_version}
        onSaved={() => {
          setIsEditing(false);
          onUpdated();
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <>
      <section className={['panel', 'assessment-detail', className].filter(Boolean).join(' ')}>
        <div className="panel__header assessment-detail__header">
          <button
            type="button"
            className="button button--ghost assessment-detail__back"
            onClick={onBack}
          >
            Back
          </button>
          <h2>{assessment.name}</h2>
        </div>

        <ValidationBanner
          errors={validationErrors}
          summary="Complete the required fields before marking this assessment complete."
        />

        <div className="detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setIsEditing(true)}
          >
            Edit Assessment
          </button>
          {!isComplete ? (
            <button
              type="button"
              className="button button--primary"
              onClick={handleCompleteAssessment}
              disabled={isCompleting}
            >
              {isCompleting ? 'Completing…' : 'Complete Assessment'}
            </button>
          ) : null}
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Protocol</dt>
            <dd>{formatProtocolLabel(assessment.assessment_type, assessment.protocol_version)}</dd>
          </div>
          <div>
            <dt>Started (local)</dt>
            <dd>
              {formatLocalTime(
                assessment.assessment_started_at,
                location.latitude,
                location.longitude,
              )}
            </dd>
          </div>
          <div>
            <dt>Started (UTC)</dt>
            <dd>{assessment.assessment_started_at}</dd>
          </div>
          {assessment.assessment_ended_at ? (
            <>
              <div>
                <dt>Ended (local)</dt>
                <dd>
                  {formatLocalTime(
                    assessment.assessment_ended_at,
                    location.latitude,
                    location.longitude,
                  )}
                </dd>
              </div>
              <div>
                <dt>Ended (UTC)</dt>
                <dd>{assessment.assessment_ended_at}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>Status</dt>
            <dd>{isComplete ? 'Complete' : 'Draft (in progress)'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              {location.accuracy_meters ? ` (±${location.accuracy_meters} m)` : ''}
            </dd>
          </div>
          {assessment.organization ? (
            <div>
              <dt>Organization</dt>
              <dd>{assessment.organization}</dd>
            </div>
          ) : null}
          {assessment.campaign ? (
            <div>
              <dt>Campaign</dt>
              <dd>{assessment.campaign}</dd>
            </div>
          ) : null}
          {assessment.notes ? (
            <div>
              <dt>Notes</dt>
              <dd>{assessment.notes}</dd>
            </div>
          ) : null}
          <div>
            <dt>Sync status</dt>
            <dd>{assessment.sync_status}</dd>
          </div>
        </dl>

        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <MeasurementPanel
        assessmentId={assessment.id}
        assessmentType={assessment.assessment_type}
        protocolVersion={assessment.protocol_version}
        latitude={location.latitude}
        longitude={location.longitude}
        measurements={measurements}
        onChanged={onUpdated}
        readOnly={false}
      />
    </>
  );
}
