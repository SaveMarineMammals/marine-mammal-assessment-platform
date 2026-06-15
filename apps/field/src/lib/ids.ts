const COLLECTOR_ID_KEY = 'mmap-collector-id';

export function getCollectorId(): string {
  const existing = localStorage.getItem(COLLECTOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const collectorId = crypto.randomUUID();
  localStorage.setItem(COLLECTOR_ID_KEY, collectorId);
  return collectorId;
}

export function createId(): string {
  return crypto.randomUUID();
}
