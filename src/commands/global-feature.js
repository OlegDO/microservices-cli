import {Argument} from 'commander';
import path from 'node:path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'node:fs';
import fse from 'fs-extra';
import { getMsFolder, program } from '../command.js';
import downloadRepository from '../helpers/download-repository.js';

/**
 * Create/remove global feature
 */
const runChangeGlobalFeature = async (action, { isStaging }) => {
  const rootPath = path.resolve(`../${getMsFolder()}`);
  const tempPath = `${rootPath}/temp`;

  const { feature } = await inquirer
    .prompt([
      {
        type: 'list',
        name: 'feature',
        message: 'Please choose feature: ',
        choices: ['none', 'integration tests'],
      },
    ]);

  if (feature === 'none') {
    return;
  }

  console.info(`Prepare to change global feature ${chalk.yellow(feature)}`);
  isStaging && console.info(chalk.yellow('Staging mode'));

  try {
    await downloadRepository(tempPath, isStaging);

    switch (feature) {
      case 'integration tests':
        if (action === 'add') {
          const destPath = `${rootPath}/tests`;

          if (!fs.existsSync(destPath)) {
            fse.copySync(`${tempPath}/tests`, rootPath, {});
          } else {
            console.log(`Global feature ${chalk.red(feature)} already exist.`);
          }
        } else {
          fse.removeSync(`${rootPath}/tests`);
        }
        break;
    }
  } catch (e) {
    console.log(`Failed ${action} global feature ${chalk.red(feature)}`);

    return;
  }

  console.info(`Feature ${chalk.yellow(action)} success: ${chalk.green(feature)}`);
}

/**
 * Add command to CLI
 */
program.command('global-feature')
  .description('Add or remove global features like integration tests etc.')
  .addArgument(new Argument('<action>', 'action name').choices(['add', 'remove']))
  .option('--staging', 'use staging configuration', false)
  .action((action, { staging }) => {
    void runChangeGlobalFeature(action, { isStaging: staging });
  });
