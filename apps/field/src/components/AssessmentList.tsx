import { formatLocalTimeShort } from '@mmap/geo-time';
import type { StoredAssessment } from '../db/types.js';
import { formatProtocolLabel } from '../lib/measurements.js';

interface AssessmentListProps {
  assessments: StoredAssessment[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  showCreateButton?: boolean;
}

function formatStartedAt(assessment: StoredAssessment): string {
  return formatLocalTimeShort(
    assessment.assessment_started_at,
    assessment.location.latitude,
    assessment.location.longitude,
    { includeTimeZoneName: true },
  );
}

export function AssessmentList({
  assessments,
  onSelect,
  onCreate,
  showCreateButton = true,
}: AssessmentListProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Assessments</h2>
        {showCreateButton ? (
          <button type="button" className="button button--primary" onClick={onCreate}>
            New Assessment
          </button>
        ) : null}
      </div>

      {assessments.length === 0 ? (
        <p className="empty-state">
          No assessments yet. Create one to begin capture — works fully offline.
        </p>
      ) : (
        <ul className="assessment-list">
          {assessments.map((assessment) => (
            <li key={assessment.id}>
              <button
                type="button"
                className="assessment-card"
                onClick={() => onSelect(assessment.id)}
              >
                <span className="assessment-card__name">{assessment.name}</span>
                <span className="assessment-card__meta">
                  {formatProtocolLabel(assessment.assessment_type, assessment.protocol_version)} ·{' '}
                  {formatStartedAt(assessment)}
                </span>
                <span className="assessment-card__location">
                  {assessment.location.latitude.toFixed(4)},{' '}
                  {assessment.location.longitude.toFixed(4)}
                </span>
                <span className={`assessment-card__badge badge--${assessment.sync_status}`}>
                  {assessment.sync_status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
