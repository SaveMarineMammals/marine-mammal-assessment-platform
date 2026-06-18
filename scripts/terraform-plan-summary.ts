import { readFileSync, writeFileSync } from 'node:fs';
import { requireArg } from './terraform-lib.js';

interface PlanJson {
  resource_changes?: Array<{
    address?: string;
    change?: { actions?: string[] };
  }>;
}

const planJsonPath = requireArg(2, 'plan json path');
const summaryPath = requireArg(3, 'summary output path');

const plan = JSON.parse(readFileSync(planJsonPath, 'utf8')) as PlanJson;
const destroys = [
  ...new Set(
    (plan.resource_changes ?? [])
      .filter((change) => change.change?.actions?.includes('delete'))
      .map((change) => change.address)
      .filter((address): address is string => Boolean(address)),
  ),
];

const summary =
  destroys.length > 0
    ? `destroy_detected=true\ndestroy_count=${destroys.length}\n`
    : 'destroy_detected=false\ndestroy_count=0\n';

writeFileSync(summaryPath, summary, 'utf8');

if (destroys.length > 0) {
  console.error('Resources scheduled for destroy:');
  for (const address of destroys) {
    console.error(address);
  }
}
