// Reduces staging AWS spend without destroying the stack: scales the ECS Express
// API to zero tasks and stops the RDS instance. The Express-managed ALB, its public
// IPv4 addresses, and RDS storage keep billing — use `terraform destroy` for ~$0.
import { spawnSync } from 'node:child_process';

const CLUSTER = 'default';
const SERVICE = 'mmap-staging-api';
const DB_INSTANCE = 'mmap-staging-postgres';
const RESOURCE_ID = `service/${CLUSTER}/${SERVICE}`;
const SCALABLE_DIMENSION = 'ecs:service:DesiredCount';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

// Measured us-east-1 Cost Explorer (July 2026) for ALB/RDS/IPv4/storage.
// Fargate is AWS list price for 1 vCPU / 2 GiB continuous — July MTD billed $0
// because no tasks were running. status estimates use these constants.
const COST = {
  fargateTask: 36,
  rdsInstance: 12,
  alb: 16,
  publicIpv4: 7,
  rdsStorage: 2,
} as const;

const USAGE = `Usage: pnpm exec tsx scripts/staging-hibernate.ts <command> [options]

Commands:
  status      Show ECS/RDS state and estimated monthly cost (default)
  hibernate   Scale API tasks to 0 and stop RDS
  resume      Start RDS and scale API tasks back up

Options:
  --dry-run        Print the AWS calls without executing them
  --min-tasks=<n>  Task count to restore on resume (default 1)

Environment:
  AWS_REGION       Defaults to us-east-1`;

interface AwsResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface EcsState {
  exists: boolean;
  desiredCount: number;
  runningCount: number;
}

interface ScalingState {
  exists: boolean;
  minCapacity: number;
  maxCapacity: number;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const command = argv.find((arg) => !arg.startsWith('--')) ?? 'status';

function numberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return fallback;
  }
  const parsed = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function runAws(args: string[]): AwsResult {
  const result = spawnSync('aws', [...args, '--region', REGION], {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    console.error(`Could not run the AWS CLI: ${result.error.message}`);
    console.error('Install AWS CLI v2 and authenticate (aws login) before running this script.');
    process.exit(1);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// Returns null when the resource is absent or the call fails; callers treat both as
// "not deployed", which is the expected state after a staging destroy.
function awsJson<T>(args: string[]): T | null {
  const result = runAws([...args, '--output', 'json']);
  if (result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    return null;
  }
}

function awsMutate(label: string, args: string[]): boolean {
  if (dryRun) {
    console.log(`  [dry-run] aws ${args.join(' ')}`);
    return true;
  }

  const result = runAws(args);
  if (result.status !== 0) {
    console.error(`  FAILED: ${label}`);
    process.stderr.write(result.stderr);
    return false;
  }

  console.log(`  ${label}`);
  return true;
}

function readEcsState(): EcsState {
  const data = awsJson<{
    services?: Array<{ status?: string; desiredCount?: number; runningCount?: number }>;
  }>(['ecs', 'describe-services', '--cluster', CLUSTER, '--services', SERVICE]);

  const service = data?.services?.[0];
  if (!service || service.status === 'INACTIVE') {
    return { exists: false, desiredCount: 0, runningCount: 0 };
  }

  return {
    exists: true,
    desiredCount: service.desiredCount ?? 0,
    runningCount: service.runningCount ?? 0,
  };
}

function readScalingState(): ScalingState {
  const data = awsJson<{
    ScalableTargets?: Array<{ MinCapacity?: number; MaxCapacity?: number }>;
  }>([
    'application-autoscaling',
    'describe-scalable-targets',
    '--service-namespace',
    'ecs',
    '--resource-ids',
    RESOURCE_ID,
  ]);

  const target = data?.ScalableTargets?.[0];
  if (!target) {
    return { exists: false, minCapacity: 0, maxCapacity: 0 };
  }

  return {
    exists: true,
    minCapacity: target.MinCapacity ?? 0,
    maxCapacity: target.MaxCapacity ?? 0,
  };
}

function readDbStatus(): string | null {
  const data = awsJson<{ DBInstances?: Array<{ DBInstanceStatus?: string }> }>([
    'rds',
    'describe-db-instances',
    '--db-instance-identifier',
    DB_INSTANCE,
  ]);

  return data?.DBInstances?.[0]?.DBInstanceStatus ?? null;
}

function setMinCapacity(minCapacity: number, maxCapacity: number): boolean {
  return awsMutate(`Auto scaling minimum set to ${minCapacity}`, [
    'application-autoscaling',
    'register-scalable-target',
    '--service-namespace',
    'ecs',
    '--resource-id',
    RESOURCE_ID,
    '--scalable-dimension',
    SCALABLE_DIMENSION,
    '--min-capacity',
    String(minCapacity),
    '--max-capacity',
    String(Math.max(maxCapacity, minCapacity, 1)),
  ]);
}

function setDesiredCount(desiredCount: number): boolean {
  return awsMutate(`ECS desired count set to ${desiredCount}`, [
    'ecs',
    'update-service',
    '--cluster',
    CLUSTER,
    '--service',
    SERVICE,
    '--desired-count',
    String(desiredCount),
  ]);
}

function estimateMonthlyCost(ecs: EcsState, dbStatus: string | null): number {
  let total = 0;

  if (ecs.exists) {
    total += COST.alb + COST.publicIpv4 + COST.fargateTask * ecs.desiredCount;
  }

  if (dbStatus) {
    total += COST.rdsStorage;
    if (dbStatus !== 'stopped' && dbStatus !== 'stopping') {
      total += COST.rdsInstance;
    }
  }

  return total;
}

function describeState(ecs: EcsState, scaling: ScalingState, dbStatus: string | null): void {
  console.log(`Region: ${REGION}`);
  console.log('');

  if (ecs.exists) {
    console.log(`ECS ${SERVICE}: desired=${ecs.desiredCount} running=${ecs.runningCount}`);
  } else {
    console.log(`ECS ${SERVICE}: not deployed`);
  }

  if (scaling.exists) {
    console.log(`Auto scaling: min=${scaling.minCapacity} max=${scaling.maxCapacity}`);
  } else {
    console.log('Auto scaling: no scalable target registered');
  }

  console.log(`RDS ${DB_INSTANCE}: ${dbStatus ?? 'not deployed'}`);
  console.log('');
  console.log(`Estimated cost while in this state: ~$${estimateMonthlyCost(ecs, dbStatus)}/mo`);
}

function reportFloor(): void {
  const floor = COST.alb + COST.publicIpv4 + COST.rdsStorage;
  console.log('');
  console.log(`Hibernated floor: ~$${floor}/mo (ALB + public IPv4 + RDS storage).`);
  console.log('These bill while the stack exists. Run terraform destroy for ~$0/mo.');
  console.log('Note: a stopped RDS instance is auto-started by AWS after 7 days.');
}

function hibernate(): void {
  const ecs = readEcsState();
  const scaling = readScalingState();
  const dbStatus = readDbStatus();

  if (!ecs.exists && !dbStatus) {
    console.log('Staging is not deployed — nothing to hibernate (already ~$0/mo).');
    return;
  }

  console.log(`Hibernating staging in ${REGION}${dryRun ? ' (dry run)' : ''}`);
  let failed = false;

  if (ecs.exists) {
    if (scaling.exists && scaling.minCapacity > 0) {
      failed = !setMinCapacity(0, scaling.maxCapacity) || failed;
    }
    if (ecs.desiredCount > 0) {
      failed = !setDesiredCount(0) || failed;
    }
    if (!scaling.exists && ecs.desiredCount === 0) {
      console.log('  ECS already scaled to zero');
    }
  }

  if (dbStatus === 'available') {
    failed =
      !awsMutate(`RDS ${DB_INSTANCE} stopping`, [
        'rds',
        'stop-db-instance',
        '--db-instance-identifier',
        DB_INSTANCE,
      ]) || failed;
  } else if (dbStatus) {
    console.log(`  RDS ${DB_INSTANCE} left as-is (status: ${dbStatus})`);
  }

  reportFloor();

  if (failed) {
    process.exit(1);
  }
}

function resume(): void {
  const minTasks = Math.max(numberFlag('min-tasks', 1), 1);
  const ecs = readEcsState();
  const scaling = readScalingState();
  const dbStatus = readDbStatus();

  if (!ecs.exists && !dbStatus) {
    console.log('Staging is not deployed — run terraform apply to recreate it.');
    return;
  }

  console.log(`Resuming staging in ${REGION}${dryRun ? ' (dry run)' : ''}`);
  let failed = false;

  if (dbStatus === 'stopped') {
    failed =
      !awsMutate(`RDS ${DB_INSTANCE} starting`, [
        'rds',
        'start-db-instance',
        '--db-instance-identifier',
        DB_INSTANCE,
      ]) || failed;
  } else if (dbStatus) {
    console.log(`  RDS ${DB_INSTANCE} left as-is (status: ${dbStatus})`);
  }

  if (ecs.exists) {
    if (scaling.exists) {
      failed = !setMinCapacity(minTasks, scaling.maxCapacity) || failed;
    }
    failed = !setDesiredCount(minTasks) || failed;
  }

  console.log('');
  console.log('RDS takes several minutes to become available; API tasks may fail until then.');
  console.log('Check progress with: pnpm exec tsx scripts/staging-hibernate.ts status');

  if (failed) {
    process.exit(1);
  }
}

switch (command) {
  case 'status':
    describeState(readEcsState(), readScalingState(), readDbStatus());
    break;
  case 'hibernate':
    hibernate();
    break;
  case 'resume':
    resume();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('');
    console.error(USAGE);
    process.exit(1);
}
