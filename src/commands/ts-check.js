import childProcess from 'node:child_process';
import { program } from '../command.js';
import getMicroservices from '../helpers/get-microservices.js';

/**
 * Check typescript for each microservice
 */
const runCheckTypescript = () => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync('npm run ts:check', {
      stdio: 'inherit',
      cwd: msDir,
    });

    console.info(`Typescript check done: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('ts-check')
  .description('Check typescript for each microservice')
  .action(() => {
    runCheckTypescript();
  });
