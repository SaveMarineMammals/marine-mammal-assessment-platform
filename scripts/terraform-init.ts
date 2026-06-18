import { runTerraform, requireArg } from './terraform-lib.js';

const rootDir = requireArg(2, 'terraform environment directory');
const bucket = requireArg(3, 'state bucket');
const key = requireArg(4, 'state key');
const region = process.argv[5] ?? 'us-east-1';
const lockTable = requireArg(6, 'lock table');

runTerraform(
  [
    '-chdir',
    rootDir,
    'init',
    '-input=false',
    `-backend-config=bucket=${bucket}`,
    `-backend-config=key=${key}`,
    `-backend-config=region=${region}`,
    `-backend-config=dynamodb_table=${lockTable}`,
  ],
  { cwd: undefined },
);
