import childProcess from 'node:child_process';
import fs from 'node:fs';
import { program } from '../command.js';
import getMicroservices from '../helpers/get-microservices.js';

/**
 * Build each microservice
 */
const runBuild = () => {
  const microservices = getMicroservices(true, true);

  for (const msDir of microservices) {
    childProcess.execSync('npm run build', {
      stdio: 'inherit',
      cwd: msDir,
    });

    const packageJsonJs = `${msDir}/lib/package.json.js`;

    if (!fs.existsSync(packageJsonJs)) {
      fs.writeFileSync(
        packageJsonJs,
        'Object.defineProperty(exports, \'__esModule\', { value: true });\nvar version = "1.0.0";\nexports.version = version;',
      );
      console.info(`Create package.json js: ${packageJsonJs}`);
    }

    console.info(`Build done: ${msDir}`);
  }
};

/**
 * Add command to CLI
 */
program.command('build')
  .description('Build microservices')
  .action(() => {
    runBuild();
  });
