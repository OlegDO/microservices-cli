import { Argument } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import childProcess from 'node:child_process';
import { getMsFolder, program } from '../command.js';

/**
 * Working with authorization permissions
 */
const runAuthorizationPermissions = async (act, isProd) => {
  let action = act;

  if (!action) {
    const prompt = await inquirer
      .prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Please choose feature: ',
          choices: [
            { name: 'Import -> Sync -> Export', value: 'update' },
            { name: 'Sync with microservices', value: 'sync' },
            { name: 'Export from DB', value: 'export' },
            { name: 'Import to DB', value: 'import' },
          ],
        },
      ]);

    action = prompt.action;
  }

  const npmCommands = [];

  switch (action) {
    case 'update':
      npmCommands.push(...['permissions:import', 'permissions:sync', 'permissions:export']);
      break;

    case 'export':
      npmCommands.push('permissions:export');
      break;

    case 'import':
      npmCommands.push('permissions:import');
      break;

    case 'sync':
      npmCommands.push('permissions:sync');
      break;

    default:
      console.log(chalk.red(`Unrecognized action: ${action}`));
      return;
  }

  console.log(chalk.yellow('Detect microservice running type...'));

  let containerId;

  try {
    containerId = String(childProcess.execSync('docker ps -aqf "name=authorization"')).trim();

    if (containerId) {
      console.log(`Seems like microservice running type is: ${chalk.green('docker')}. Container ID: ${chalk.yellow(containerId)}`);

      for (const action of npmCommands) {
        childProcess.execSync(`docker exec ${containerId} npm run ${action}:prod`, { stdio: 'inherit' });
      }

      return;
    }
  } catch (e) {
    if (!e.message.includes('Cannot connect to the Docker')) {
      console.log(`Docker error: ${e}`);
    }

    if (containerId) {
      return;
    }
  }

  console.log(`Seems like microservice running type is: ${chalk.green('node')}.`);

  for (const action of npmCommands) {
    childProcess.execSync(`npm run ${action}:${isProd ? 'prod' : 'dev'}`, {
      stdio: 'inherit',
      cwd: `${getMsFolder()}/authorization`,
    });
  }
}

/**
 * Add command to CLI
 */
program.command('permissions')
  .description('Working with permissions in authorization microservice')
  .addArgument(new Argument('[action]', 'permissions action. export - dump from DB to files, sync - get microservices meta and update in schema DB').choices(['sync', 'export', 'import']))
  .option('--is-prod', 'run command in production', false)
  .action((action, { isProd }) => {
    void runAuthorizationPermissions(action, isProd);
  });
