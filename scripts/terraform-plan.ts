import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureTerraform, requireArg, resolveVarFile, runTerraform } from './terraform-lib.js';

interface PlanJson {
  resource_changes?: Array<{
    address?: string;
    change?: { actions?: string[] };
  }>;
}

const workingDirectory = requireArg(2, 'working directory');
const varFile = process.argv[3];

// CI/CD plans must never acquire the remote DynamoDB state lock; applies still lock.
const planArgs = [
  'plan',
  '-input=false',
  '-lock=false',
  '-out=tfplan',
  '-no-color',
  ...resolveVarFile(workingDirectory, varFile),
];
runTerraform(planArgs, { cwd: workingDirectory });

// Reads the local plan artifact only (no remote state lock).
const planJson = captureTerraform(['show', '-json', 'tfplan'], { cwd: workingDirectory });
const planJsonPath = join(workingDirectory, 'plan.json');
writeFileSync(planJsonPath, planJson, 'utf8');

const plan = JSON.parse(planJson) as PlanJson;
const destroyCount = (plan.resource_changes ?? []).filter((change) =>
  change.change?.actions?.includes('delete'),
).length;

const destroyDetected = destroyCount > 0;
const githubOutput = process.env.GITHUB_OUTPUT;

if (githubOutput) {
  appendFileSync(githubOutput, `destroy_detected=${destroyDetected}\n`, 'utf8');
}

if (destroyDetected) {
  console.error(`Terraform plan includes ${destroyCount} resource deletion(s).`);
  for (const change of plan.resource_changes ?? []) {
    if (change.change?.actions?.includes('delete') && change.address) {
      console.error(change.address);
    }
  }
}
