import childProcess from 'node:child_process';
import { program } from '../command.js';
import getMicroservices from '../helpers/get-microservices.js';

/**
 * Run lint for each microservice
 */
const runLint = (shouldFix = false) => {
  const microservices = getMicroservices(true, true);
  const action = shouldFix ? 'fix' : 'check'

  for (const msDir of microservices) {
    childProcess.execSync(`npm run lint:${action}`, {
      stdio: 'inherit',
      cwd: msDir,
    });

    console.info(`Lint check done: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('lint')
  .description('Run linter for each microservice')
  .option('--fix', 'check and fix problems', false)
  .action(({ fix }) => {
    runLint(fix);
  });
