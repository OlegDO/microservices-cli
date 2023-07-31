import fs from 'node:fs';
import chalk from 'chalk';
import fse from 'fs-extra';
import { getMsFolder, program } from '../command.js';
import runChangeFeature from './change-feature.js';
import replaceStrInFile from '../helpers/replace-in-file.js';
import downloadRepository from '../helpers/download-repository.js';

/**
 * Create new microservice
 */
const runCreateMicroservice = async (name, isStaging, withDb) => {
  const msPath = `${getMsFolder()}/${name}`;
  const tempPath = `${getMsFolder()}/${name}/temp`;

  if (fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" exist!`);

    return;
  }

  console.log(`Creating new microservice: ${chalk.green(name)}`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  await downloadRepository(tempPath, isStaging);

  fse.copySync(`${tempPath}/template/new`, msPath, {});

  replaceStrInFile('microservice-name', name, `${msPath}/package.json`);
  replaceStrInFile('microservice-name', name, `${msPath}/package-lock.json`);
  replaceStrInFile(
    'microservice-name',
    name,
    `${msPath}/sonar-project.properties`,
  );
  replaceStrInFile('microservice-name', name, `${msPath}/src/constants/index.ts`);
  replaceStrInFile('microservice-name', name, `${msPath}/README.md`);

  if (withDb) {
    await runChangeFeature(name, 'add', { isStaging, feat: 'db' });
  }

  fse.removeSync(tempPath);

  console.info(`Microservice created: ${chalk.green(msPath)}`);
};

/**
 * Add command to CLI
 */
program.command('create')
  .description('Create new microservice')
  .argument('<name>', 'microservice name')
  .option('--staging', 'use staging configuration', false)
  .option('--with-db', 'create new microservice with DB config', false)
  .action((name, { staging, withDb }) => {
    void runCreateMicroservice(name, staging, withDb);
  });
