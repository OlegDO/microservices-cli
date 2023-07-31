import fse from 'fs-extra';
import chalk from 'chalk';
import getRepository from './get-repository.js';
import getGithubParams from './github-params.js';

/**
 * Download config repo
 */
const downloadRepository = async (path, isStaging) => {
  console.info(`Download configuration...`);

  try {
    fse.ensureDirSync(path, {});

    await getRepository(getGithubParams(isStaging), path);
  } catch (err) {
    console.info(chalk.red(`Failed to download configuration: ${err.message}`));

    return;
  }

  console.info(chalk.green('Downloaded.'));
}

export default downloadRepository;
