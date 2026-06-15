export type SyncEntityType = 'assessment' | 'measurement';

export interface SyncBatchItemResult {
  entity_type: SyncEntityType;
  entity_id: string;
  status: 'synced' | 'error';
  error?: string;
}

export interface SyncBatchResponse {
  batch_id: string;
  results: SyncBatchItemResult[];
}

export interface SyncRunResult {
  attempted: number;
  synced: number;
  failed: number;
  skipped: number;
  error?: string;
}
