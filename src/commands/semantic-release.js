import chalk from 'chalk';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import { program } from '../command.js';
import getMicroservices from '../helpers/get-microservices.js';
import findFile from '../helpers/find-file.js';

/**
 * Run semantic release
 */
const runSemanticRelease = (isDryRun = false) => {
  const microservices = getMicroservices(true, true);
  const rootDir = process.cwd();

  for (const msDir of microservices) {
    console.info(chalk.blue(`Begin release: ${msDir}`));

    childProcess.execSync(`npx semantic-release ${isDryRun ? '--dryRun' : ''}`, {
      stdio: 'inherit',
      cwd: msDir,
      env: { ...process.env },
    });

    let nextVersion = 'unknown';

    try {
      const versionFile = findFile(['.version'], `${rootDir}/${msDir}`);

      if (!versionFile) {
        throw new Error("Package file version doesn't exist.");
      }

      nextVersion = (fs.readFileSync(versionFile, { encoding: 'utf-8' }) || '').trim();

      if (!nextVersion) {
        throw new Error('Package version is empty.');
      }

      childProcess.execSync(`npx @lomray/microservices-cli patch-package-version --package-version ${nextVersion} --dir ${msDir}`, {
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (e) {
      console.info(chalk.yellow(`Failed get package version: ${e.message}`));
    }

    console.info(chalk.green(`Semantic release done: ${msDir}. Version: ${nextVersion}`));
  }
};

/**
 * Add command to CLI
 */
program.command('semantic-release')
  .description('Run semantic release for each microservice')
  .option('--dry-run', 'pass dry-run to semantic release', false)
  .action(({ dryRun }) => {
    runSemanticRelease(dryRun);
  });
