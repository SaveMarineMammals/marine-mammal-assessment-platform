import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeasurementSectionDefinition } from '@mmap/schema/protocol';
import { AddMeasurementForm } from './AddMeasurementForm.js';

vi.mock('../data/repository.js', () => ({
  addMeasurement: vi.fn(async () => undefined),
}));

const temperatureSection: MeasurementSectionDefinition = {
  type: 'external_temperature',
  label: 'External Temperature',
  widget: 'number',
  unit: '°C',
  step: '0.1',
};

const bloodPressureSection: MeasurementSectionDefinition = {
  type: 'blood_pressure',
  label: 'Blood Pressure',
  widget: 'blood_pressure',
  unit: 'mmHg',
};

describe('AddMeasurementForm', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderForm(section: MeasurementSectionDefinition = temperatureSection) {
    act(() => {
      root.render(
        <AddMeasurementForm
          assessmentId="assessment-1"
          assessmentType="manatee_v1"
          protocolVersion="1.0.0"
          measurementSection={section}
          sequence={1}
          latitude={17.5}
          longitude={-88.2}
          onAdded={() => undefined}
          onCancel={() => undefined}
        />,
      );
    });
  }

  it('puts the required value field before optional method and notes', () => {
    renderForm();

    const valueInput = container.querySelector('#field-value');
    const optionalToggle = container.querySelector('.optional-fields__toggle');
    expect(valueInput).not.toBeNull();
    expect(optionalToggle).not.toBeNull();
    expect(container.querySelector('#field-method')).toBeNull();
    expect(container.querySelector('#field-notes')).toBeNull();

    const valuePosition = container.innerHTML.indexOf('id="field-value"');
    const togglePosition = container.innerHTML.indexOf('optional-fields__toggle');
    expect(valuePosition).toBeGreaterThan(-1);
    expect(togglePosition).toBeGreaterThan(valuePosition);
  });

  it('keeps optional fields collapsed until expanded', () => {
    renderForm();

    const toggle = container.querySelector('.optional-fields__toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.textContent).toContain('Add method or notes');

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('#field-method')).not.toBeNull();
    expect(container.querySelector('#field-notes')).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders Cancel and Save Reading in one action row', () => {
    renderForm();

    const actions = container.querySelector('.form-actions');
    expect(actions).not.toBeNull();
    expect(actions?.querySelectorAll('button')).toHaveLength(2);
    expect(actions?.textContent).toContain('Cancel');
    expect(actions?.textContent).toContain('Save Reading');
  });

  it('shows blood pressure values before optional fields', () => {
    renderForm(bloodPressureSection);

    expect(container.querySelector('#field-systolic')).not.toBeNull();
    expect(container.querySelector('#field-diastolic')).not.toBeNull();
    expect(container.querySelector('#field-method')).toBeNull();

    const systolicPosition = container.innerHTML.indexOf('id="field-systolic"');
    const togglePosition = container.innerHTML.indexOf('optional-fields__toggle');
    expect(systolicPosition).toBeGreaterThan(-1);
    expect(togglePosition).toBeGreaterThan(systolicPosition);
  });
});
