import { requireArg, resolveVarFile, runTerraform } from './terraform-lib.js';

const workingDirectory = requireArg(2, 'working directory');
const varFile = process.argv[3];

const applyArgs = ['apply', '-input=false', '-auto-approve', ...resolveVarFile(workingDirectory, varFile)];
runTerraform(applyArgs, { cwd: workingDirectory });
