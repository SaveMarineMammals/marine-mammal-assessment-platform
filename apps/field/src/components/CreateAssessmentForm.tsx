import { useMemo } from 'react';
import { AssessmentForm } from './AssessmentForm.js';
import { getDevProtocolKey } from '../lib/preferences.js';
import { getDefaultProtocolEntry, parseProtocolKey } from '../lib/protocol-registry.js';

interface CreateAssessmentFormProps {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

function resolveCreateProtocol() {
  const devKey = getDevProtocolKey();
  if (devKey) {
    return parseProtocolKey(devKey);
  }

  const entry = getDefaultProtocolEntry();
  return {
    assessment_type: entry.assessment_type,
    protocol_version: entry.protocol_version,
  };
}

export function CreateAssessmentForm({ onCreated, onCancel }: CreateAssessmentFormProps) {
  const protocol = useMemo(() => resolveCreateProtocol(), []);

  return (
    <AssessmentForm
      mode="create"
      assessmentType={protocol.assessment_type}
      protocolVersion={protocol.protocol_version}
      onSaved={onCreated}
      onCancel={onCancel}
    />
  );
}
