import { APP_VERSION } from '../generated/build-version.js';

export { APP_VERSION };

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isSemverVersion(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}
