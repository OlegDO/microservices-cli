import { Argument } from 'commander';
import fs from 'node:fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fse from 'fs-extra';
import path from 'node:path';
import childProcess from 'node:child_process';
import { getMsFolder, program } from '../command.js';
import downloadRepository from '../helpers/download-repository.js';
import replaceStrInFile from '../helpers/replace-in-file.js';
import appendLineToFile from '../helpers/append-to-file.js';
import prependLineToFile from '../helpers/prepend-to-file.js';

/**
 * Create extended microservice
 */
const runExtendMicroservice = async (name, isStaging) => {
  const msFolder = getMsFolder();
  const msPath = `${msFolder}/${name}`;
  const msSrcPath = `${msPath}/src`;
  const tempPath = `${msPath}/temp`;
  const targetMsPath = `${tempPath}/microservices/${name}`;

  if (fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" already exists!`);

    return;
  }

  const { type } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Please choose type: ',
        choices: ['package', 'docker'],
      },
    ]);

  console.info(`Prepare to extend microservice: ${chalk.green(name)}.`)
  isStaging && console.info(chalk.yellow('Staging mode'));

  fse.ensureDirSync(msPath, {});

  await downloadRepository(tempPath, isStaging);

  if (!fs.existsSync(targetMsPath)) {
    console.log(`Unknown microservice for extend: "${chalk.red(name)}"`);

    return;
  }

  switch (type) {
    case 'docker':
      fse.copySync(`${tempPath}/template/docker`, msPath, {});

      if (name === 'authorization') {
        // copy default permissions
        fse.copySync(`${tempPath}/microservices/authorization/migrations/permissions/list`, `${msPath}/permissions`, {});

        replaceStrInFile('#volumes', 'volumes', 'docker-compose.ms.yml');
        replaceStrInFile('#  -', '  -', 'docker-compose.ms.yml');

        // docker file should include our permission when build
        appendLineToFile(`${msPath}/Dockerfile`, 'COPY ./permissions $WEB_PATH/lib/migrations/permissions/list');
        appendLineToFile(`${msPath}/Dockerfile`, 'COPY ./lib/package.json.js $WEB_PATH/lib/package.json.js');
      } else {
        replaceStrInFile('authorization', name, `${msPath}/Dockerfile`);
        replaceStrInFile('authorization', name, `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/export.js', '', `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/import.js', '', `${msPath}/package.json`);
        replaceStrInFile('node lib/migrations/permissions/sync.js', '', `${msPath}/package.json`);
        replaceStrInFile('authorization', name, `${msPath}/package-lock.json`);
        replaceStrInFile('authorization', name, `${msPath}/README.md`);
      }

      break;

    case 'package':
      fse.copySync(`${tempPath}/template/new/__helpers__`, `${msPath}/__helpers__`, {});
      fse.copySync(`${tempPath}/template/new/__tests__/index-test.ts`, `${msPath}/__tests__/index-test.ts`, {});
      fse.copySync(`${tempPath}/template/package`, msPath, { overwrite: true });
      fse.copySync(`${targetMsPath}/src/index.ts`, `${msPath}/src/index.ts`, {});
      fse.copySync(`${targetMsPath}/src/tracer.ts`, `${msPath}/src/tracer.ts`, {});

      const files = fs.readdirSync(`${tempPath}/template/new`);

      files.forEach((file) => {
        const filePath = path.resolve(`${tempPath}/template/new/${file}`);

        if (fs.lstatSync(filePath).isFile()) {
          fse.copySync(filePath, `${msPath}/${file}`, {});
        }
      });

      prependLineToFile(`${msPath}/src/index.ts`, "import '@config/di';");
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msSrcPath}/constants/index.ts`);
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msSrcPath}/config/start.ts`);
      replaceStrInFile('microservice-name', `microservice-${name}`, `${msPath}/package.json`);

      childProcess.execSync('npm i --save require-in-the-middle', {
        stdio: 'inherit',
        cwd: msPath,
      });
      childProcess.execSync(`npm i --save @lomray/microservice-${name}`, {
        stdio: 'inherit',
        cwd: msPath,
      });

      break;
  }

  fse.removeSync(tempPath);

  console.info(`Microservice extended: ${chalk.green(msPath)}`);
}

/**
 * Add command to CLI
 */
program.command('extend')
  .description('Create extended microservice')
  .addArgument(new Argument('<name>', 'microservice name, e.g authorization, users etc.'))
  .option('--staging', 'use staging configuration', false)
  .action((name, { staging }) => {
    void runExtendMicroservice(name, staging);
  });
