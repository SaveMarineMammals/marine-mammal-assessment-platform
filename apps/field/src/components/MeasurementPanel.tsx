import { useMemo, useState } from 'react';
import { formatLocalTimeShort } from '@mmap/geo-time';
import type { StoredMeasurement } from '../db/types.js';
import { getFormDefinition } from '../lib/protocol-registry.js';
import { formatMeasurementValue } from '../lib/measurements.js';
import { AddMeasurementForm } from './AddMeasurementForm.js';

interface MeasurementPanelProps {
  assessmentId: string;
  assessmentType: string;
  protocolVersion: string;
  latitude: number;
  longitude: number;
  measurements: StoredMeasurement[];
  onChanged: () => void;
  readOnly?: boolean;
}

export function MeasurementPanel({
  assessmentId,
  assessmentType,
  protocolVersion,
  latitude,
  longitude,
  measurements,
  onChanged,
  readOnly = false,
}: MeasurementPanelProps) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const formDefinition = useMemo(
    () => getFormDefinition(assessmentType, protocolVersion),
    [assessmentType, protocolVersion],
  );

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(
      formDefinition.measurements.sections.map((section) => [
        section.type,
        [] as StoredMeasurement[],
      ]),
    ) as Record<string, StoredMeasurement[]>;

    for (const measurement of measurements) {
      if (!groups[measurement.measurement_type]) {
        groups[measurement.measurement_type] = [];
      }
      groups[measurement.measurement_type].push(measurement);
    }

    for (const section of formDefinition.measurements.sections) {
      groups[section.type]?.sort(
        (left, right) =>
          new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime(),
      );
    }

    return groups;
  }, [formDefinition.measurements.sections, measurements]);

  return (
    <section className="panel measurement-panel">
      <div className="panel__header">
        <h2>Measurements</h2>
        <span className="hint">{measurements.length} total readings</span>
      </div>

      {formDefinition.measurements.sections.map((section) => {
        const readings = grouped[section.type] ?? [];
        const isAdding = activeType === section.type;

        return (
          <article key={section.type} className="measurement-group">
            <div className="measurement-group__header">
              <h3>{section.label}</h3>
              {!readOnly ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setActiveType(isAdding ? null : section.type)}
                  aria-expanded={isAdding}
                >
                  {isAdding ? 'Close' : 'Add Reading'}
                </button>
              ) : null}
            </div>

            {readings.length === 0 ? (
              <p className="hint">No readings yet.</p>
            ) : (
              <ul className="reading-list">
                {readings.map((reading) => (
                  <li key={reading.id} className="reading-list__item">
                    <div className="reading-list__value">
                      {formatMeasurementValue(
                        assessmentType,
                        section.type,
                        reading.value,
                        section.unit,
                      )}
                    </div>
                    <div className="reading-list__meta">
                      {formatLocalTimeShort(reading.recorded_at, latitude, longitude, {
                        includeTimeZoneName: true,
                      })}
                      {reading.method ? ` · ${reading.method}` : ''}
                      {reading.sequence ? ` · #${reading.sequence}` : ''}
                    </div>
                    {reading.notes ? (
                      <div className="reading-list__notes">{reading.notes}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {isAdding ? (
              <AddMeasurementForm
                assessmentId={assessmentId}
                assessmentType={assessmentType}
                protocolVersion={protocolVersion}
                measurementSection={section}
                sequence={readings.length + 1}
                latitude={latitude}
                longitude={longitude}
                onAdded={() => {
                  setActiveType(null);
                  onChanged();
                }}
                onCancel={() => setActiveType(null)}
              />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
