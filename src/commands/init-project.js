import path from 'node:path';
import fs from 'node:fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fse from 'fs-extra';
import childProcess from 'node:child_process';
import { program } from '../command.js';
import downloadRepository from '../helpers/download-repository.js';
import replaceStrInFile from '../helpers/replace-in-file.js';

/**
 * Init new project
 */
const runInitProject = async (name, isStaging) => {
  const root = path.resolve(name);
  const appName = path.basename(root);
  const tempPath = `${root}/temp`;

  if (fs.existsSync(name)) {
    console.error('Project folder already exist.');
    return;
  }

  // noinspection JSUnusedGlobalSymbols
  const { repoName } = await inquirer
    .prompt([
      {
        type: 'input',
        name: 'repoName',
        message: 'Enter repository name, e.g. "Lomray-Software/microservices": ',
        validate(value) {
          if (value?.length > 1) {
            return true;
          }

          return 'Please enter a valid repository name';
        },
      },
    ]);

  console.info(`Creating a new microservices project in ${chalk.green(root)}.`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  await downloadRepository(tempPath, isStaging);

  console.info(`Prepare to install dependencies...`);

  const files = [
    '.env',
    'package.json',
    'package-lock.json',
    'nyc.config.js',
    'docker-compose.yml',
    'docker-compose.ms.yml',
    'commitlint.config.js',
    '.prettierrc.js',
    '.npmignore',
    '.lintstagedrc.js',
    '.gitignore',
    '.gitattributes',
    '.eslintrc.js',
    '.eslintignore',
    '.editorconfig',
    '.husky',
    '.github',
    'http-requests',
    'configs',
    ['template/README.md', 'README.md'],
  ];

  files.forEach((file) => {
    if (typeof file === 'string') {
      fse.moveSync(`${tempPath}/${file}`, `${root}/${file}`, {});
    } else {
      fse.moveSync(`${tempPath}/${file[0]}`, `${root}/${file[1]}`, {});
    }
  });

  fse.ensureDirSync(`${root}/microservices`, {});
  fse.removeSync(tempPath);

  replaceStrInFile('"@lomray/microservices"', `"${appName}"`, `${root}/package.json`);
  replaceStrInFile('https://github.com/Lomray-Software/microservices', '', `${root}/package.json`);
  replaceStrInFile('"@lomray/microservices"', `"${appName}"`, `${root}/package-lock.json`);
  replaceStrInFile('Lomray-Software/microservices', repoName, `${root}/.github/workflows/build.yml`);

  childProcess.execSync('npm ci --ignore-scripts', {
    stdio: 'inherit',
    cwd: root,
  });

  console.info(chalk.green('Done!'));
}

program.command('init')
  .description('Initialize new project')
  .argument('<name>', 'project name, e.g. "awesome-api" or "sub-dir/awesome-api"')
  .option('--staging', 'init project from staging config', false)
  .action((name, { staging }) => {
    void runInitProject(name, staging);
  });
