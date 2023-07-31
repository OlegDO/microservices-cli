import fs from 'node:fs';
import childProcess from 'node:child_process';
import getMicroservices from '../helpers/get-microservices.js';
import replaceStrInFile from '../helpers/replace-in-file.js';
import { program } from '../command.js';

/**
 * Update npm package for each microservice
 */
const runGlobalUpdate = (packageName, version = null) => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    const packageJson = `${msDir}/package.json`;

    if (!fs.existsSync(packageJson) || !fs.readFileSync(packageJson).includes(packageName)) {
      console.info(`Skip update package: ${msDir}`);

      continue;
    }

    if (version) {
      replaceStrInFile(
        `"${packageName}": "\\^[\\d\\.]+"`,
        `"${packageName}": "^${version}"`,
        packageJson,
      );
    }

    childProcess.execSync(`npm update ${packageName}`, {
      stdio: 'inherit',
      cwd: msDir,
    });

    console.info(`Package updated for: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('global-update')
  .description('Update provided npm package for each microservice')
  .argument('<package-name>', 'package name')
  .argument('[version]', 'package version', undefined, null)
  .action((packageName, version) => {
    runGlobalUpdate(packageName, version);
  });
