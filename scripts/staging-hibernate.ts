// Reduces staging AWS spend without destroying the stack: stops the RDS instance.
// API is Lambda (no always-on ALB/Fargate). Public snapshots remain on S3/CloudFront.
// Use `terraform destroy` on the staging root for ~$0 beyond bootstrap.
import { spawnSync } from 'node:child_process';

const DB_INSTANCE = 'mmap-staging-postgres';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

const COST = {
  rdsInstance: 12,
  rdsStorage: 2,
} as const;

const USAGE = `Usage: pnpm exec tsx scripts/staging-hibernate.ts <command> [options]

Commands:
  status      Show RDS state and estimated monthly cost (default)
  hibernate   Stop RDS
  resume      Start RDS (takes several minutes)

Options:
  --dry-run        Print the AWS calls without executing them

Environment:
  AWS_REGION       Defaults to us-east-1`;

interface AwsResult {
  status: number;
  stdout: string;
  stderr: string;
}

function aws(args: string[], dryRun: boolean): AwsResult {
  if (dryRun) {
    console.log(`DRY-RUN: aws ${args.join(' ')}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync('aws', args, { encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function describeDb(): string | null {
  const result = aws(
    [
      'rds',
      'describe-db-instances',
      '--db-instance-identifier',
      DB_INSTANCE,
      '--region',
      REGION,
      '--query',
      'DBInstances[0].DBInstanceStatus',
      '--output',
      'text',
    ],
    false,
  );
  if (result.status !== 0) {
    return null;
  }
  const status = result.stdout.trim();
  return status && status !== 'None' ? status : null;
}

function estimateMonthlyCost(dbStatus: string | null): number {
  if (!dbStatus) {
    return 0;
  }
  let total = COST.rdsStorage;
  if (dbStatus !== 'stopped' && dbStatus !== 'stopping') {
    total += COST.rdsInstance;
  }
  return total;
}

function statusCommand(): void {
  const dbStatus = describeDb();
  console.log(`Region: ${REGION}`);
  console.log(`RDS ${DB_INSTANCE}: ${dbStatus ?? 'not deployed'}`);
  console.log('');
  console.log(`Estimated cost while in this state: ~$${estimateMonthlyCost(dbStatus)}/mo`);
  console.log('(API is Lambda — no ALB/Fargate floor. Snapshots stay on S3.)');
  if (dbStatus === 'stopped' || dbStatus === 'stopping') {
    console.log('Hibernated floor: ~$2/mo (RDS storage only). Destroy staging for ~$0.');
  }
}

function hibernateCommand(dryRun: boolean): void {
  const dbStatus = describeDb();
  if (!dbStatus) {
    console.log('Staging RDS is not deployed — nothing to hibernate (already ~$0/mo).');
    return;
  }
  console.log(`Hibernating staging RDS in ${REGION}${dryRun ? ' (dry run)' : ''}`);
  if (dbStatus === 'stopped' || dbStatus === 'stopping') {
    console.log(`RDS already ${dbStatus}`);
    return;
  }
  const result = aws(
    ['rds', 'stop-db-instance', '--db-instance-identifier', DB_INSTANCE, '--region', REGION],
    dryRun,
  );
  if (!dryRun && result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status);
  }
  console.log('Stop requested. Re-check with: pnpm exec tsx scripts/staging-hibernate.ts status');
}

function resumeCommand(dryRun: boolean): void {
  const dbStatus = describeDb();
  if (!dbStatus) {
    console.log('Staging RDS is not deployed — apply Terraform first.');
    return;
  }
  console.log(`Resuming staging RDS in ${REGION}${dryRun ? ' (dry run)' : ''}`);
  if (dbStatus === 'available' || dbStatus === 'starting') {
    console.log(`RDS already ${dbStatus}`);
    return;
  }
  const result = aws(
    ['rds', 'start-db-instance', '--db-instance-identifier', DB_INSTANCE, '--region', REGION],
    dryRun,
  );
  if (!dryRun && result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status);
  }
  console.log('Start requested. Wait several minutes, then:');
  console.log('  pnpm exec tsx scripts/staging-hibernate.ts status');
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const command = args.find((arg) => !arg.startsWith('--')) ?? 'status';

  if (command === 'help' || command === '-h' || command === '--help') {
    console.log(USAGE);
    return;
  }
  if (command === 'status') {
    statusCommand();
    return;
  }
  if (command === 'hibernate') {
    hibernateCommand(dryRun);
    return;
  }
  if (command === 'resume') {
    resumeCommand(dryRun);
    return;
  }
  console.error(`Unknown command: ${command}\n`);
  console.error(USAGE);
  process.exit(1);
}

main();
