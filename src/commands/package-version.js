import { Option } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import github from '@actions/core';
import { program } from '../command.js';

/**
 * Get package version from package.json
 * NOTE: used in CI/CD
 */
const runOutputPackageVersion = async (workDir = '.') => {
  const packageJson = path.resolve(`${workDir}/package.json`);

  if (!fs.existsSync(packageJson)) {
    const error = `package.json not found in path: ${chalk.red(packageJson)}`;

    console.log(error);

    return github.setFailed(`Action failed with error ${error}`);
  }

  const { version } = (await import(packageJson, { assert: { type: 'json' } })).default;

  console.log(`Version package: ${chalk.green(version)}`);
  github.setOutput('version', version);
}

program.command('package-version')
  .description('Get version from package.json')
  .addOption(new Option('--dir [dir]', 'working directory').env('WORK_DIR'))
  .action(({ dir }) => {
    void runOutputPackageVersion(dir);
  });
