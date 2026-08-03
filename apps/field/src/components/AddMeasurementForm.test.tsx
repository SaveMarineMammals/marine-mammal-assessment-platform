import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getFormDefinition } from '../lib/protocol-registry.js';
import { AddMeasurementForm } from './AddMeasurementForm.js';

const formDefinition = getFormDefinition('manatee_v1', '1.0.0');
const externalTemperatureSection = formDefinition.measurements.sections.find(
  (section) => section.type === 'external_temperature',
);

describe('AddMeasurementForm', () => {
  it('renders the value field before optional fields and keeps actions on one row', () => {
    if (!externalTemperatureSection) {
      throw new Error('Expected external temperature section in manatee form definition');
    }

    const html = renderToStaticMarkup(
      <AddMeasurementForm
        assessmentId="assessment-1"
        assessmentType="manatee_v1"
        protocolVersion="1.0.0"
        measurementSection={externalTemperatureSection}
        sequence={1}
        latitude={17.5}
        longitude={-88.2}
        onAdded={() => undefined}
        onCancel={() => undefined}
      />,
    );

    const valueIndex = html.indexOf('id="field-value"');
    const optionalIndex = html.indexOf('class="optional-fields"');
    const actionsIndex = html.indexOf('form-actions--inline');

    expect(valueIndex).toBeGreaterThan(-1);
    expect(optionalIndex).toBeGreaterThan(valueIndex);
    expect(actionsIndex).toBeGreaterThan(optionalIndex);
    expect(html).toContain('Method &amp; notes (optional)');
  });
});
