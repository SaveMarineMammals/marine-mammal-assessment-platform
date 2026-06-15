const DEV_PROTOCOL_KEY = 'mmap_dev_protocol';
const GLOVE_MODE_KEY = 'mmap_glove_mode';

export function getDevProtocolKey(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(DEV_PROTOCOL_KEY);
}

export function setDevProtocolKey(value: string | null): void {
  if (value) {
    localStorage.setItem(DEV_PROTOCOL_KEY, value);
  } else {
    localStorage.removeItem(DEV_PROTOCOL_KEY);
  }
}

export function getGloveMode(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(GLOVE_MODE_KEY) === '1';
}

export function setGloveMode(enabled: boolean): void {
  localStorage.setItem(GLOVE_MODE_KEY, enabled ? '1' : '0');
}

export function applyGloveModeClass(enabled: boolean): void {
  document.documentElement.classList.toggle('glove-mode', enabled);
}
