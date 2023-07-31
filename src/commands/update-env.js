import fs from 'node:fs';
import { program, getEnvPath } from '../command.js';
import findFile from '../helpers/find-file.js';

/**
 * Update .env file
 */
const runUpdateDotenv = (env) => {
  const folder = 'configs';
  const middlewaresFile = findFile([`middlewares.${env}.json`, 'middlewares.json'], folder);
  const cronFile = findFile([`cron.${env}.json`, 'cron.json'], folder);
  const configFile = findFile([`config.${env}.json`, 'config.local.json', 'config.json'], folder);
  const dotenvFile = getEnvPath();

  if (!middlewaresFile) {
    console.error(`Middlewares config not found in path ${folder}`);
    return;
  }

  if (!configFile) {
    console.error(`Config not found in path ${folder}`);
    return;
  }

  let cronTasks = '[]';

  if (cronFile) {
    cronTasks = JSON.stringify(
      JSON.parse(fs.readFileSync(cronFile, { encoding: 'utf8' })),
    );
  }

  const middlewares = JSON.stringify(
    JSON.parse(fs.readFileSync(middlewaresFile, { encoding: 'utf8' })),
  );
  const configs = JSON.stringify(JSON.parse(fs.readFileSync(configFile, { encoding: 'utf8' })));
  const dotenv = fs
    .readFileSync(dotenvFile, { encoding: 'utf8' })
    .replace(/MS_INIT_MIDDLEWARES=.*/, `MS_INIT_MIDDLEWARES='${middlewares}'`)
    .replace(/MS_INIT_CONFIGS=.*/, `MS_INIT_CONFIGS='${configs}'`)
    .replace(/MS_INIT_TASKS=.*/, `MS_INIT_TASKS='${cronTasks}'`);

  fs.writeFileSync(dotenvFile, dotenv, 'utf8');
};

/**
 * Add command to CLI
 */
program.command('update-env')
  .description('Update .env file according chosen environment')
  .argument('<env>', 'environment, e.g. dev, staging, prod')
  .action((env) => {
    runUpdateDotenv(env);
  });
