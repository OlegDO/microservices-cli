import { Option } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { program } from '../command.js';
import replaceStrInFile from '../helpers/replace-in-file.js';

/**
 * Patch package version
 */
const runPatchPackageVersion = (workDir = '.', version = '1.0.0', isSilent = false) => {
  for (const file of ['package.json', 'lib/package.json', 'lib/package.json.js']) {
    const filePath = path.resolve(`${workDir}/${file}`);

    if (!fs.existsSync(filePath)) {
      if (!isSilent) {
        console.info(chalk.yellow('Skip file:'), filePath);
      }

      continue;
    }

    replaceStrInFile('(version.+)("1.0.0")', `$1"${version}"`, filePath);

    if (!isSilent) {
      console.info(chalk.green('Patched file:'), filePath);
    }
  }
};

/**
 * Add command to CLI
 */
program.command('patch-package-version')
  .description('Update package version')
  .addOption(new Option('--dir [dir]', 'working directory').env('WORK_DIR'))
  .addOption(new Option('--package-version [packageVersion]', 'new package version').env('PACKAGE_VERSION'))
  .option('--is-silent', 'run command without output', false)
  .action(({ dir, packageVersion, isSilent }) => {
    void runPatchPackageVersion(dir, packageVersion, isSilent);
  });
