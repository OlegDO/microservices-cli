import { Command, Option } from 'commander';
import fs from 'node:fs';
import chalk from 'chalk';
import packageJson from '../package.json' assert { type: 'json' };

const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .addOption(new Option('--only [microservices]', 'apply commands only for provided microservices, e.g. "users authentication authorization"').env('ONLY'))
  .option('--ms-folder [folder]', 'microservices folder', 'microservices')
  .option('--env-path [env-path]', 'microservices environment path', '.env')
  .hook('preAction', (_, actionCommand) => {
    if (['init', 'package-version', 'changed-microservices'].includes(actionCommand.name())) {
      return;
    }

    // Check current directory, it should be project root
    const root = process.cwd();

    if (!fs.existsSync(`${root}/${getMsFolder()}`) || !fs.existsSync(`${root}/package.json`)) {
      console.log(chalk.red('The command must be run from project root directory.'));
      process.exit(1);

      return false;
    }
  });

/**
 * Filter for microservices
 */
const getFilteredMsNames = () => {
  const options = program.opts();
  return process.env.ONLY || options.only || '';
}

/**
 * Get microservices folder
 */
const getMsFolder = () => {
  const options = program.opts();
  return options.msFolder;
}

/**
 * Get .env file path
 */
const getEnvPath = () => {
  const options = program.opts();
  return options.envPath;
}

export {
  program,
  getFilteredMsNames,
  getEnvPath,
  getMsFolder,
}
