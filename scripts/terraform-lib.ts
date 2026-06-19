import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function runTerraform(args: string[], options: { cwd?: string } = {}): void {
  const result = spawnSync('terraform', args, {
    stdio: 'inherit',
    cwd: options.cwd,
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function captureTerraform(args: string[], options: { cwd?: string } = {}): string {
  const result = spawnSync('terraform', args, {
    encoding: 'utf8',
    cwd: options.cwd,
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

export function requireArg(index: number, name: string): string {
  const value = process.argv[index];
  if (!value) {
    console.error(`Missing required argument: ${name}`);
    process.exit(1);
  }
  return value;
}

export function resolveVarFile(workingDirectory: string, varFile: string | undefined): string[] {
  if (!varFile) {
    return [];
  }

  const candidates = [join(workingDirectory, varFile), varFile];
  return candidates.some((candidate) => existsSync(candidate)) ? ['-var-file', varFile] : [];
}
