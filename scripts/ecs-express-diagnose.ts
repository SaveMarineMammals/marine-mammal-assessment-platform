import { spawnSync } from 'node:child_process';

function requireArg(index: number, hint: string): string {
  const value = process.argv[index];
  if (!value) {
    console.error(
      `Usage: pnpm exec tsx scripts/ecs-express-diagnose.ts <service-name> [account-id] [region]`,
    );
    console.error(
      `Example: pnpm exec tsx scripts/ecs-express-diagnose.ts mmap-staging-api 963120167952 us-east-1`,
    );
    console.error(hint);
    process.exit(1);
  }
  return value;
}

function awsJson(args: string[]): unknown {
  const result = spawnSync('aws', [...args, '--output', 'json'], {
    encoding: 'utf8',
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

  return JSON.parse(result.stdout) as unknown;
}

function awsText(args: string[]): void {
  const result = spawnSync('aws', args, {
    encoding: 'utf8',
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const serviceName = requireArg(2, 'Missing service name (e.g. mmap-staging-api).');
const accountId = process.argv[3] ?? process.env.AWS_ACCOUNT_ID ?? '';
const region = process.argv[4] ?? process.env.AWS_REGION ?? 'us-east-1';

if (!accountId) {
  console.error('Provide account ID as the second argument or set AWS_ACCOUNT_ID.');
  process.exit(1);
}

const serviceArn = `arn:aws:ecs:${region}:${accountId}:service/default/${serviceName}`;

console.log(`ECS Express service: ${serviceArn}`);
console.log('');

const describe = awsJson([
  'ecs',
  'describe-express-gateway-service',
  '--service-arn',
  serviceArn,
  '--region',
  region,
]) as {
  expressGatewayService?: {
    status?: { statusCode?: string; statusReason?: string };
    currentDeployment?: string;
    activeServiceRevisions?: Array<{
      healthCheckPath?: string;
      primaryContainer?: { image?: string; containerPort?: number };
      networkConfiguration?: { securityGroups?: string[]; subnets?: string[] };
      ingressPaths?: Array<{ accessType?: string; endpoint?: string }>;
    }>;
  };
};

const service = describe.expressGatewayService;
if (!service) {
  console.error('No expressGatewayService in response.');
  process.exit(1);
}

console.log('Status:', service.status?.statusCode ?? '(unknown)');
if (service.status?.statusReason) {
  console.log('Reason:', service.status.statusReason);
}
console.log('Current deployment:', service.currentDeployment ?? '(none)');

const revision = service.activeServiceRevisions?.[0];
if (revision) {
  console.log('Image:', revision.primaryContainer?.image ?? '(unknown)');
  console.log('Container port:', revision.primaryContainer?.containerPort ?? '(unknown)');
  console.log('Health check path:', revision.healthCheckPath ?? '(unknown)');
  console.log(
    'Security groups:',
    (revision.networkConfiguration?.securityGroups ?? []).join(', ') || '(none)',
  );
  console.log('Subnets:', (revision.networkConfiguration?.subnets ?? []).join(', ') || '(none)');
  const publicPath = revision.ingressPaths?.find((path) => path.accessType === 'PUBLIC');
  console.log('Public endpoint:', publicPath?.endpoint ?? '(none — check public subnets)');
}

console.log('');
console.log('--- Deployment resources (TEXT-ONLY, 60s max) ---');
awsText([
  'ecs',
  'monitor-express-gateway-service',
  '--service-arn',
  serviceArn,
  '--region',
  region,
  '--resource-view',
  'DEPLOYMENT',
  '--mode',
  'TEXT-ONLY',
  '--monitor-timeout',
  '60',
]);

console.log('');
console.log('--- Recent container logs ---');
const logGroup = serviceName.replace(/-api$/, '').replace(/^mmap-/, '/mmap-');
const resolvedLogGroup = `${logGroup}/api`;

awsText([
  'logs',
  'tail',
  resolvedLogGroup,
  '--region',
  region,
  '--since',
  '2h',
  '--format',
  'short',
]);

console.log('');
console.log('If deployment is stuck >30m: cancel it in the ECS console or run');
console.log(
  `  terraform -chdir=infra/terraform/environments/staging apply -replace='module.api.aws_ecs_express_gateway_service.express' -auto-approve`,
);
