import { toUtcIso } from '@mmap/geo-time';
import type { StoredAssessment, StoredMeasurement } from '../db/types.js';

export const BACKUP_VERSION = '1.0.0';

export interface MmapFieldBackup {
  version: typeof BACKUP_VERSION;
  exported_at: string;
  assessments: StoredAssessment[];
  measurements: StoredMeasurement[];
}

export type DuplicateStrategy = 'skip' | 'replace';

export interface ImportResult {
  importedAssessments: number;
  importedMeasurements: number;
  skippedAssessments: number;
  skippedMeasurements: number;
  replacedAssessments: number;
  replacedMeasurements: number;
  errors: string[];
}

export interface StorageSummary {
  assessmentCount: number;
  measurementCount: number;
  pendingSyncCount: number;
  approximateBytes: number;
}

export function getBackupFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `mmap-backup-${year}-${month}-${day}.json`;
}

export function isMmapFieldBackup(value: unknown): value is MmapFieldBackup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MmapFieldBackup>;
  return (
    candidate.version === BACKUP_VERSION &&
    typeof candidate.exported_at === 'string' &&
    Array.isArray(candidate.assessments) &&
    Array.isArray(candidate.measurements)
  );
}

export function parseBackupJson(raw: unknown): MmapFieldBackup {
  if (!isMmapFieldBackup(raw)) {
    throw new Error('Invalid backup file format.');
  }
  return raw;
}

export function estimateBackupBytes(backup: MmapFieldBackup): number {
  return new TextEncoder().encode(JSON.stringify(backup)).length;
}

export function createBackupPayload(
  assessments: StoredAssessment[],
  measurements: StoredMeasurement[],
): MmapFieldBackup {
  return {
    version: BACKUP_VERSION,
    exported_at: toUtcIso(new Date()),
    assessments,
    measurements,
  };
}

export function downloadBackupFile(backup: MmapFieldBackup, filename = getBackupFilename()): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
