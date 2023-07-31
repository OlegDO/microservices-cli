import childProcess from 'node:child_process';
import { program } from '../command.js';
import getMicroservices from '../helpers/get-microservices.js';

/**
 * Run tests for each microservice
 */
const runTests = (withCoverage = false) => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync(`${withCoverage ? 'nyc' : ''} npm run test`, {
      stdio: 'inherit',
      cwd: msDir,
    });

    console.info(`Tests done: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('test')
  .description('Run test for each microservice')
  .option('--coverage', 'run test with coverage', false)
  .action(({ coverage }) => {
    runTests(coverage);
  });
