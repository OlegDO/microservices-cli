import childProcess from 'node:child_process';
import { program } from '../command.js';
import getMicroservices from '../helpers/get-microservices.js';

/**
 * Run lint staged
 */
const runLintStaged = () => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync('npx lint-staged', {
      stdio: 'inherit',
      cwd: msDir,
    });

    console.info(`Lint staged done: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('lint-staged')
  .description('Run lint staged for each microservice')
  .action(() => {
    runLintStaged();
  });
