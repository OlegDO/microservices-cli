import fs from 'node:fs';
import childProcess from 'node:child_process';
import getMicroservices from '../helpers/get-microservices.js';
import { program } from '../command.js';

/**
 * Install npm packages for each microservice
 */
const runGlobalInstall = (command = 'i') => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    const packageJson = `${msDir}/package.json`;

    if (!fs.existsSync(packageJson)) {
      console.info(`Skip install: ${msDir}`);

      continue;
    }

    childProcess.execSync(`npm ${command}`, {
      stdio: 'inherit',
      cwd: msDir,
    });

    console.info(`Install done: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('global-install')
  .description('Run npm install/ci for each microservice')
  .option('--ci', 'run npm "ci" instead "install"', false)
  .action(({ ci }) => {
    runGlobalInstall(ci ? 'ci' : 'i');
  });
