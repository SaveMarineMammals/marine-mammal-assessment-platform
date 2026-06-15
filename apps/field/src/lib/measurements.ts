export function formatMeasurementValue(
  assessmentType: string,
  measurementType: string,
  value: number | { systolic: number; diastolic: number },
  unit: string,
): string {
  if (
    measurementType === 'blood_pressure' &&
    typeof value === 'object' &&
    value !== null &&
    'systolic' in value
  ) {
    return `${value.systolic}/${value.diastolic} ${unit}`;
  }

  if (assessmentType === 'dolphin_v1' && measurementType === 'body_condition') {
    return `${value} / 5`;
  }

  return `${value} ${unit}`;
}

export function formatProtocolLabel(assessmentType: string, protocolVersion: string): string {
  if (assessmentType === 'manatee_v1') {
    return 'Manatee v1';
  }
  if (assessmentType === 'dolphin_v1') {
    return 'Dolphin stub';
  }
  return `${assessmentType} ${protocolVersion}`;
}
