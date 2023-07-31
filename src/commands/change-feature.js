import inquirer from 'inquirer';
import fs from 'node:fs';
import chalk from 'chalk';
import fse from 'fs-extra';
import { Argument } from 'commander';
import { getMsFolder, program } from '../command.js';
import replaceStrInFile from '../helpers/replace-in-file.js';
import downloadRepository from '../helpers/download-repository.js';

/**
 * Create/remove microservice feature
 */
const runChangeFeature = async (name, action, { feat, isStaging }) => {
  const msPath = `${getMsFolder()}/${name}`;
  const msSrcPath = `${getMsFolder()}/${name}/src`;
  const tempPath = `${getMsFolder()}/${name}/temp`;

  let feature = feat;

  if (!feature) {
    const prompt = await inquirer
      .prompt([
        {
          type: 'list',
          name: 'answer',
          message: 'Please choose feature: ',
          choices: ['none', 'db', 'remote-config'],
        },
      ]);
    feature = prompt.answer;
  }

  if (feature === 'none') {
    return;
  }

  if (!fs.existsSync(msPath)) {
    console.log(`Microservice "${chalk.red(name)}" not exist!`);

    return;
  }

  console.info(`Prepare to change feature ${chalk.yellow(feature)} for: ${chalk.green(name)}`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  try {

    switch (feature) {
      // Add or remove DB support feature
      case 'db':
        if (action === 'add') {
          replaceStrInFile('withDb: false', 'withDb: true', `${msSrcPath}/constants/index.ts`);
        } else {
          replaceStrInFile('withDb: true', 'withDb: false', `${msSrcPath}/constants/index.ts`);
        }
        break;

      case 'remote-config':
        await downloadRepository(tempPath, isStaging);

        if (action === 'add') {
          const destPath = `${msPath}/template/features/remote-config`;

          if (!fs.existsSync(destPath)) {
            fse.copySync(`${tempPath}/template/features/remote-config`, msSrcPath, {});
          } else {
            console.log(`Feature ${chalk.red(feature)} already exist.`);
          }
        } else {
          fse.removeSync(`${msSrcPath}/config/remote.ts`);
          fse.removeSync(`${msSrcPath}/interfaces/remote-config.ts`);
        }

        break;
    }
  } catch (e) {
    console.log(`Failed ${action} feature ${chalk.red(feature)}: ${e.message}`);

    return;
  } finally {
    fse.removeSync(tempPath);
  }

  console.info(`Feature ${chalk.yellow(action)} success: ${chalk.green(feature)}`);
};

/**
 * Add command to CLI
 */
program.command('feature')
  .description('Add or remove some microservice features like support DB etc.')
  .addArgument(new Argument('<name>', 'microservice name'))
  .addArgument(new Argument('<action>', 'action name').choices(['add', 'remove']))
  .option('--staging', 'use staging configuration', false)
  .action((name, action, { staging }) => {
    void runChangeFeature(name, action, { isStaging: staging });
  });

export default runChangeFeature;
